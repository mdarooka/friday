import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openStore } from '../server/store.mjs';
import { createGoogleIntegration } from '../server/google.mjs';
import { extractBooking } from '../server/booking-extraction.mjs';

const origin='https://friday.example',key='a'.repeat(64);
const opened=[];after(()=>Promise.all(opened.map(db=>db.close())));   // PGlite instances keep the process alive until closed
function setup(fetch=async()=>{throw new Error('unexpected fetch')},options={}) {
  const db=openStore({memory:true});opened.push(db);   // the full schema; the seed queries run first because every call waits for the same connection
  db.query("INSERT INTO users(id,email,name,password) VALUES('alice','alice@example.com','Alice','x'),('bob','bob@example.com','Bob','x')").catch(()=>{});
  const handle=createGoogleIntegration({db,origin,clientId:'client.apps.googleusercontent.com',clientSecret:'secret-server-side',encryptionKey:key,fetch,now:()=>new Date('2026-10-05T12:00:00.000Z'),...options});
  const call=(path,method='GET',body={},user='alice',url)=>handle({path,method,body,user:{id:user},url});
  return {db,call};
}
const json=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
async function connect(call,kind='gmail') {
  const start=await call('/api/integrations/google/start','POST',{kind});
  assert.equal(start.status,200);
  const auth=new URL(start.data.authorizationUrl),state=auth.searchParams.get('state');
  assert.equal(auth.searchParams.get('access_type'),'offline');assert.equal(auth.searchParams.get('response_type'),'code');
  assert.equal(auth.searchParams.get('scope'),kind==='gmail'?'https://www.googleapis.com/auth/gmail.readonly':'https://www.googleapis.com/auth/calendar.events.readonly');
  assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.ok(auth.searchParams.get('code_challenge'));
  return {state,auth};
}

test('OAuth state is owner-bound, one-use, PKCE protected, and stores encrypted refresh credentials',async()=>{
  const seen=[];const {db,call}=setup(async(url,options)=>{seen.push({url:String(url),options});return json({access_token:'short-token',refresh_token:'long-refresh-secret',scope:'https://www.googleapis.com/auth/gmail.readonly'});});
  const {state,auth}=await connect(call);
  assert.equal(auth.searchParams.get('state').length>30,true);
  const encryptedVerifier=(await db.one('SELECT state_hash,verifier FROM google_oauth_states')).verifier;
  assert.ok(encryptedVerifier.startsWith('v1.'));assert.notEqual(encryptedVerifier,auth.searchParams.get('code_challenge'));
  assert.equal(auth.searchParams.has('include_granted_scopes'),false);
  const wrongOwner=await call('/api/integrations/google/callback','GET',{},'bob',`${origin}/api/integrations/google/callback?state=${state}&code=good`);
  assert.equal(wrongOwner.status,400);assert.equal(seen.length,0);
  const callback=await call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${state}&code=good`);
  assert.equal(callback.status,303);assert.match(callback.redirect,/google=connected/);
  assert.equal(seen[0].url,'https://oauth2.googleapis.com/token');
  const verifier=new URLSearchParams(seen[0].options.body).get('code_verifier');
  assert.equal(createHash('sha256').update(verifier).digest('base64url'),auth.searchParams.get('code_challenge'));
  const stored=(await db.one('SELECT refresh_token FROM google_connections WHERE user_id=$1',['alice'])).refresh_token;
  assert.ok(stored.startsWith('v1.'));assert.equal(stored.includes('long-refresh-secret'),false);
  const replay=await call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${state}&code=good`);
  assert.equal(replay.status,400);assert.equal(seen.length,3);
});

test('Gmail OAuth performs initial sync using actual travel dates and preserves clarification evidence',async()=>{
  const requests=[];const messages=[
    {id:'future',subject:'Your flight booking is confirmed',body:'Booking reference QX9. Departure date: 12 February 2027. Return date: 20 February 2027.',date:'Thu, 1 Oct 2026 10:00:00 +0000'},
    {id:'past',subject:'Flight booking confirmed',body:'Booking reference OLD4. Departure date: 03/14/2025.',date:'Mon, 5 Oct 2026 11:00:00 +0000'},
    {id:'unclear',subject:'Your booking is confirmed',body:'Booking reference AB3. Travel date: 4 July.',date:'Mon, 5 Oct 2026 11:00:00 +0000'},
    {id:'ambiguous',subject:'Reservation confirmed',body:'Reservation number C12. Check-in: 04/05/2027.',date:'Mon, 5 Oct 2026 11:00:00 +0000'},
    {id:'cancelled',subject:'Flight booking cancelled',body:'Your booking was cancelled. Departure date: 12 February 2027.',date:'Mon, 5 Oct 2026 11:00:00 +0000'},
    {id:'promo',subject:'Travel deal: 50% discount',body:'Book your flight now! Departure date: 12 February 2027.',date:'Mon, 5 Oct 2026 11:00:00 +0000'},
  ];
  const {db,call}=setup(async(url,options)=>{requests.push({url:String(url),options});
    if(String(url)=== 'https://oauth2.googleapis.com/token'){
      const form=new URLSearchParams(options.body);return form.get('grant_type')==='authorization_code'?json({access_token:'initial-access',refresh_token:'refresh',scope:'https://www.googleapis.com/auth/gmail.readonly'}):json({access_token:'temporary-access',refresh_token:'rotated-refresh'});
    }
    if(String(url).includes('/messages?'))return json({messages:messages.map(m=>({id:m.id}))});
    const found=messages.find(m=>String(url).includes(`/messages/${m.id}?`));
    if(found)return json({id:found.id,snippet:found.body.slice(0,100),payload:{headers:[{name:'Subject',value:found.subject},{name:'From',value:'travel@example.com'},{name:'Date',value:found.date}],mimeType:'text/html',body:{data:Buffer.from(`<html><body>${found.body}</body></html>`).toString('base64url')}}});
    throw new Error(`unexpected ${url}`);
  });
  await db.query("INSERT INTO records(id,user_id,kind,data,updated) VALUES('trip-a','alice','trips','{\"title\":\"Japan\"}',$1)",[new Date().toISOString()]);
  const {state}=await connect(call);const callback=await call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${state}&code=ok`);
  assert.equal(callback.status,303);assert.match(callback.redirect,/google=connected/);
  const oldEncryptedRefresh=(await db.one('SELECT refresh_token FROM google_connections WHERE user_id=$1',['alice'])).refresh_token;
  const query=requests.find(x=>x.url.includes('/messages?')).url;
  assert.doesNotMatch(query,/newer_than|after:|before:/);
  const rows=(await db.all("SELECT data FROM records WHERE user_id='alice' AND kind='bookings' ORDER BY id")).map(x=>JSON.parse(x.data));
  assert.equal(rows.length,3); // Past flights, cancelled, and promotional messages are excluded by default.
  const future=rows.find(r=>r.externalId==='future');
  assert.equal(future.start,'2027-02-12');assert.equal(future.end,'2027-02-20');assert.equal(future.dateStatus,'confirmed');
  assert.equal(future.tripId,'');assert.match(future.sourceEvidence,/QX9/);assert.ok(future.sourceUrl.startsWith('https://mail.google.com/'));
  assert.equal(rows.find(r=>r.externalId==='unclear').dateStatus,'needs-clarification');
  assert.equal(rows.find(r=>r.externalId==='unclear').start,'');
  assert.equal(rows.find(r=>r.externalId==='ambiguous').dateStatus,'needs-clarification');
  assert.equal(requests.at(-1).options.headers.Authorization,'Bearer temporary-access');
  const past=await call('/api/integrations/google/sync','POST',{kind:'gmail',includePast:true});
  assert.equal(past.status,200);assert.equal(past.data.imported,1);
  assert.ok(await db.one("SELECT id FROM records WHERE user_id='alice' AND kind='bookings' AND data LIKE '%past%'"));
  assert.equal(JSON.parse((await db.one('SELECT scopes FROM google_connections WHERE user_id=$1',['alice'])).scopes).length,1);
  const rotated=(await db.one('SELECT refresh_token FROM google_connections WHERE user_id=$1',['alice'])).refresh_token;
  assert.ok(rotated.startsWith('v1.'));assert.notEqual(rotated,oldEncryptedRefresh);
  const other=await call('/api/integrations/google/sync','POST',{kind:'gmail'},'bob');assert.equal(other.status,409);
  const foreignTrip=await call('/api/integrations/google/sync','POST',{kind:'gmail',tripId:'trip-a'},'bob');assert.equal(foreignTrip.status,404);
});

test('Gmail extraction keeps conservative confirmation and date boundaries',()=>{
  const base={subject:'Hotel reservation confirmed',body:'Reservation number H88. Check-in: 12 March 2027. Check-out: 15 March 2027.',today:'2027-03-13'};
  const hotel=extractBooking({...base,body:`${base.body} Free cancellation until 1 March.`});
  assert.equal(hotel.booking.dateStatus,'confirmed');assert.equal(hotel.booking.start,'2027-03-12');
  const promotionalCopyWithBooking=extractBooking({subject:'Reservation confirmed — 20% discount next time',body:base.body,today:'2027-03-01'});
  assert.equal(promotionalCopyWithBooking.booking.dateStatus,'confirmed');
  const policy=extractBooking({...base,body:'Your reservation can be cancelled without charge. Check-in: 12 March 2027.'});
  assert.equal(policy.booking.dateStatus,'needs-clarification');
  const unclearCheckout=extractBooking({...base,body:'Reservation number H88. Check-in: 12 March 2027. Check-out: 14 March.'});
  assert.equal(unclearCheckout.booking.dateStatus,'needs-clarification');
  assert.notEqual(unclearCheckout.skip,'past');
  const canceled=extractBooking({...base,subject:'Your hotel reservation was cancelled'});
  assert.equal(canceled.skip,'cancelled');
  const ambiguous=extractBooking({...base,body:'Reservation number H88. Check-in: 04/05/2027.'});
  assert.equal(ambiguous.booking.dateStatus,'needs-clarification');assert.equal(ambiguous.booking.start,'');
  const noYear=extractBooking({...base,body:'Reservation number H88. Travel date: 12 March.'});
  assert.equal(noYear.booking.dateStatus,'needs-clarification');assert.equal(noYear.booking.start,'');
  const schema=extractBooking({subject:'Your reservation',body:'Hotel booking confirmation',schema:[{'@type':'LodgingReservation',checkinTime:'2027-03-12T16:00:00-07:00',checkoutTime:'2027-03-15T11:00:00-07:00'}],today:'2027-03-01'});
  assert.equal(schema.booking.start,'2027-03-12');assert.equal(schema.booking.end,'2027-03-15');
  const arbitrary=extractBooking({subject:'Travel inspiration',body:'Explore this trip',schema:[{startDate:'2027-03-12'}]});
  assert.equal(arbitrary.booking,undefined);
});

test('Gmail initial sync failure redirects with a bounded status and retains the connection',async()=>{
  const {db,call}=setup(async(url,options)=>{
    if(String(url)==='https://oauth2.googleapis.com/token')return json({access_token:'first',refresh_token:'refresh',scope:'https://www.googleapis.com/auth/gmail.readonly'});
    if(String(url).includes('/messages?'))return json({},503);
    throw new Error(`unexpected ${url}`);
  });
  const {state}=await connect(call);
  const callback=await call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${state}&code=ok`);
  assert.equal(callback.status,303);assert.equal(callback.redirect,`${origin}/trip.html?google=sync-failed&kind=gmail#/bookings`);
  assert.equal((await call('/api/integrations/google/status')).data.connections[0].kind,'gmail');
});

test('Calendar sync imports read-only events and status/disconnect remain per account',async()=>{
  const {db,call}=setup(async(url,options)=>{
    if(String(url)==='https://oauth2.googleapis.com/token'){
      const form=new URLSearchParams(options.body);return form.get('grant_type')==='authorization_code'?json({access_token:'initial-access',refresh_token:'refresh',scope:'https://www.googleapis.com/auth/calendar.events.readonly'}):json({access_token:'calendar-access'});
    }
    if(String(url).includes('/events?'))return json({items:[{id:'e1',summary:'Flight',status:'confirmed',htmlLink:'https://calendar.google.com/event/1',start:{dateTime:'2026-11-03T08:00:00-08:00'},end:{dateTime:'2026-11-03T11:00:00-08:00'},location:'SFO'}]});
    throw new Error(`unexpected ${url}`);
  });
  const {state}=await connect(call,'calendar');await call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${state}&code=ok`);
  const status=await call('/api/integrations/google/status');assert.equal(status.data.connections[0].kind,'calendar');
  const result=await call('/api/integrations/google/sync','POST',{kind:'calendar'});assert.equal(result.data.imported,1);
  const record=JSON.parse((await db.one("SELECT data FROM records WHERE user_id='alice' AND kind='bookings'")).data);
  assert.equal(record.source,'google-calendar');assert.equal(record.location,'SFO');
  await call('/api/integrations/google/disconnect','POST',{kind:'calendar'});
  assert.deepEqual((await call('/api/integrations/google/status')).data.connections,[]);
});

test('unconfigured app, expired state, denied consent, and missing refresh token fail closed',async()=>{
  const {db,call}=setup(undefined,{clientId:'',clientSecret:'',encryptionKey:''});
  assert.deepEqual((await call('/api/integrations/google/status')).data,{configured:false,connections:[]});
  assert.equal((await call('/api/integrations/google/start','POST',{kind:'gmail'})).status,503);
  const enabled=setup(async()=>json({access_token:'a',scope:'https://www.googleapis.com/auth/gmail.readonly'}));
  const {state}=await connect(enabled.call);
  await enabled.db.query('UPDATE google_oauth_states SET expires=0');
  assert.equal((await enabled.call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${state}&code=stale`)).status,400);
  const {state:deniedState}=await connect(enabled.call);
  const denied=await enabled.call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${deniedState}&error=access_denied`);
  assert.equal(denied.status,303);assert.equal(denied.redirect,`${origin}/trip.html?google=cancelled&kind=gmail#/bookings`);
  assert.equal((await enabled.call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${deniedState}&code=again`)).status,400);
  const {state:noRefreshState}=await connect(enabled.call);
  const noRefresh=await enabled.call('/api/integrations/google/callback','GET',{},'alice',`${origin}/api/integrations/google/callback?state=${noRefreshState}&code=no-refresh`);
  assert.equal(noRefresh.status,502);assert.match(noRefresh.data.error,/offline access token/);
});

test('configured Google requires a valid 32-byte encryption key',()=>{
  assert.throws(()=>setup(undefined,{encryptionKey:'not-a-key'}),/GOOGLE_TOKEN_KEY/);
});
