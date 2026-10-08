import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { prepareBriefing } from '../server/briefing.mjs';
import { forwardAddressFor, forwardTokenFromRecipient, inboundSecretMatches, newForwardToken } from '../server/forward-booking.mjs';
import { vaultModeOptions } from './fake-vault.mjs';
const origin='http://localhost:4871',secret='inbound-secret-for-tests-0123456789';
const iso=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
async function fixture(t,env={}) {
  const server=createApp({memory:true,origin,airportFetch:async()=>{throw new Error('geocoder disabled in tests');},env:{TRIP_INBOUND_DOMAIN:'trips.example.com',FRIDAY_INBOUND_SECRET:secret,...env},...vaultModeOptions({})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));});
  return async(url,method='GET',data,cookie='',headers={})=>{
    const res=await fetch(base+url,{method,headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),Cookie:cookie,...headers},body:data?JSON.stringify(data):undefined});
    return {status:res.status,result:(res.headers.get('content-type')||'').includes('application/json')?await res.json():await res.text(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  };
}
async function owner(request,email) {
  const signup=await request('/api/auth/signup','POST',{name:'F',email,password:'long test password 123'});
  const trip=await request('/api/trips','POST',{data:{title:'Goa'}},signup.cookie);
  const address=(await request(`/api/trips/${trip.result.record.id}/forward-address`,'GET',undefined,signup.cookie)).result.address;
  return {cookie:signup.cookie,tripId:trip.result.record.id,address};
}
const flight=`Your flight is confirmed
Airline: IndiGo flight 6E 512, BOM to GOI. Booking reference: QX7K2P. Departure date: ${iso(30)}. E-ticket attached.`;
const inbound=(to,over={})=>({to,from:'bookings@indigo.example',subject:'Flight confirmed',text:flight,date:'Mon, 5 Oct 2026 10:00:00 +0000','message-id':'<m1@indigo.example>',...over});
const post=(request,body,key=secret)=>request('/api/inbound/trip-email','POST',body,'',key===null?{}:{'X-Friday-Inbound-Secret':key});

test('addresses are unguessable tokens on the inbound domain and parse back',()=>{
  const a=newForwardToken(),b=newForwardToken();
  assert.notEqual(a,b);assert.match(a,/^[a-f0-9]{32}$/);
  assert.equal(forwardAddressFor(a,'Trips.Example.com'),`trip-${a}@trips.example.com`);
  assert.equal(forwardAddressFor(a,''),null);assert.equal(forwardAddressFor(a,undefined),null);
  assert.equal(forwardTokenFromRecipient(`trip-${a}@trips.example.com`),a);
  assert.equal(forwardTokenFromRecipient(`Trip <TRIP-${a.toUpperCase()}@trips.example.com>`),a);
  assert.equal(forwardTokenFromRecipient(['x@y.com',`trip-${a}@trips.example.com`]),a);
  assert.equal(forwardTokenFromRecipient('someone@example.com'),null);assert.equal(forwardTokenFromRecipient(`trip-${a}x@d.com`),null);assert.equal(forwardTokenFromRecipient(undefined),null);
});

test('the shared secret is compared exactly and an empty secret disables the endpoint',async t=>{
  assert.equal(inboundSecretMatches('abc','abc'),true);
  assert.equal(inboundSecretMatches('abd','abc'),false);assert.equal(inboundSecretMatches('abcd','abc'),false);
  assert.equal(inboundSecretMatches('',''),false);assert.equal(inboundSecretMatches(undefined,'abc'),false);assert.equal(inboundSecretMatches('abc',''),false);
  const request=await fixture(t);
  const a=await owner(request,'a@example.com');
  assert.equal((await post(request,inbound(a.address),'wrong')).status,401);
  assert.equal((await post(request,inbound(a.address),null)).status,401);
  const off=await fixture(t,{FRIDAY_INBOUND_SECRET:''});
  assert.equal((await post(off,inbound(a.address),'')).status,404);
  const noDomain=await fixture(t,{TRIP_INBOUND_DOMAIN:''});
  const c=await owner(noDomain,'c@example.com');assert.equal(c.address,null);
});

test('a forwarded confirmation is saved as a draft the briefing ignores',async t=>{
  const request=await fixture(t);
  const a=await owner(request,'a@example.com');
  assert.match(a.address,/^trip-[a-f0-9]{32}@trips\.example\.com$/);
  assert.equal((await request(`/api/trips/${a.tripId}/forward-address`,'GET',undefined,a.cookie)).result.address,a.address);   // stable per trip
  const sent=await post(request,inbound(a.address));
  assert.equal(sent.status,202);assert.equal(sent.result.status,'saved');
  const records=(await request('/api/bookings','GET',undefined,a.cookie)).result.records;
  assert.equal(records.length,1);
  const booking=records[0].data;
  assert.equal(booking.source,'forwarded-email');assert.equal(booking.tripId,a.tripId);assert.equal(booking.type,'flight');assert.equal(booking.ref,'QX7K2P');assert.equal(booking.dateStatus,'needs-clarification');
  const start=iso(5);
  const briefing=prepareBriefing({tripId:a.tripId,tripData:{title:'Goa',startDate:start},bookingRows:[{id:'b',data:JSON.stringify({...booking,start})}],recipient:'a@example.com',origin});
  assert.equal(briefing.eligible,false);
});

test('forwarding the same message twice saves it once',async t=>{
  const request=await fixture(t);
  const a=await owner(request,'a@example.com');
  assert.equal((await post(request,inbound(a.address))).result.status,'saved');
  assert.equal((await post(request,inbound(a.address))).result.status,'duplicate');
  assert.equal((await post(request,inbound(a.address,{'message-id':'<m2@indigo.example>'}))).result.status,'saved');
  assert.equal((await request('/api/bookings','GET',undefined,a.cookie)).result.records.length,2);
});

test('cancellations, promotions and non-confirmations save nothing, and records stay with their owner',async t=>{
  const request=await fixture(t);
  const a=await owner(request,'a@example.com'),b=await owner(request,'b@example.com');
  assert.notEqual(a.address,b.address);
  const skipped=async over=>(await post(request,inbound(a.address,over))).result.status;
  assert.equal(await skipped({subject:'Booking cancelled',text:'Your flight booking has been cancelled. Booking reference: QX7K2P.','message-id':'c1'}),'skipped');
  assert.equal(await skipped({subject:'Big sale: 40% discount on flights',text:'Limited time offer on hotels','message-id':'c2'}),'skipped');
  assert.equal(await skipped({subject:'Hello',text:'Just saying hi.','message-id':'c3'}),'skipped');
  assert.equal((await post(request,inbound(`trip-${'0'.repeat(32)}@trips.example.com`))).result.status,'ignored');   // unknown token
  assert.equal((await post(request,inbound('nobody@trips.example.com'))).result.status,'ignored');
  assert.equal((await post(request,{to:a.address,subject:'x'})).status,422);   // no body to read
  assert.equal((await request('/api/bookings','GET',undefined,a.cookie)).result.records.length,0);
  // The same message to each owner's own address lands only on that owner.
  assert.equal((await post(request,inbound(a.address))).result.status,'saved');
  assert.equal((await post(request,inbound(b.address))).result.status,'saved');
  assert.equal((await request('/api/bookings','GET',undefined,a.cookie)).result.records[0].data.tripId,a.tripId);
  const forB=(await request('/api/bookings','GET',undefined,b.cookie)).result.records;
  assert.equal(forB.length,1);assert.equal(forB[0].data.tripId,b.tripId);
  assert.equal((await request(`/api/trips/${a.tripId}/forward-address`,'GET',undefined,b.cookie)).status,404);
});
