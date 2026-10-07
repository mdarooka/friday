import * as store from './store.mjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { extractBooking } from './booking-extraction.mjs';

const AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN='https://oauth2.googleapis.com/token';
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR='https://www.googleapis.com/calendar/v3';
const scopes={gmail:'https://www.googleapis.com/auth/gmail.readonly',calendar:'https://www.googleapis.com/auth/calendar.events.readonly'};
const fail=(status,message)=>({status,data:{error:message}});
const hash=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>Buffer.from(value).toString('base64url');
const clean=(v,max=3000)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ').slice(0,max):'';
const isHttp=value=>{try{return ['http:','https:'].includes(new URL(value).protocol)}catch{return false}};

export function createGoogleIntegration({db,origin,clientId,clientSecret,encryptionKey,fetch:fetcher=fetch,findTripId=(userId,tripId)=>store.findTripId(db,tripId,userId),now=()=>new Date()}) {
  if(!db||!origin)throw new TypeError('Google integration requires db and origin.');
  const configured=!!(clientId&&clientSecret);
  const key=typeof encryptionKey==='string'&&/^[a-f0-9]{64}$/i.test(encryptionKey)?Buffer.from(encryptionKey,'hex'):null;
  if(configured&&!key)throw new Error('GOOGLE_TOKEN_KEY must contain 64 hexadecimal characters when Google OAuth is configured.');

  const seal=plain=>{
    if(!key)throw new Error('token encryption key unavailable');
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
    return `v1.${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(data)}`;
  };
  const unseal=sealed=>{
    if(!key)throw new Error('token encryption key unavailable');
    const [version,iv,tag,data]=String(sealed).split('.');if(version!=='v1'||!iv||!tag||!data)throw new Error('invalid encrypted token');
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');
  };
  const tokenRequest=async params=>{
    let response;try{response=await fetcher(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(30000)});}catch{throw Object.assign(new Error('Google could not complete the connection. Please try again.'),{status:502});}
    let json={};try{json=await response.json()}catch{}
    if(!response.ok||!json.access_token)throw Object.assign(new Error(json.error==='invalid_grant'?'Google access expired. Please reconnect your account.':'Google could not complete the connection. Please try again.'),{status:json.error==='invalid_grant'?409:502});
    return json;
  };
  const requestJson=async(url,accessToken,signal)=>{
    let response;try{response=await fetcher(url,{headers:{Authorization:`Bearer ${accessToken}`},signal:signal||AbortSignal.timeout(30000)});}catch{throw Object.assign(new Error('Google data is temporarily unavailable. Please try again.'),{status:502});}
    let json={};try{json=await response.json()}catch{}
    if(!response.ok)throw Object.assign(new Error(response.status===401?'Google access expired. Please reconnect your account.':'Google data is temporarily unavailable. Please try again.'),{status:response.status===401?409:502});
    return json;
  };
  const getAccess=async(userId,kind)=>{
    const row=await store.findGoogleRefreshToken(db,userId,kind);
    if(!row)throw Object.assign(new Error(`Connect Google ${kind==='gmail'?'Gmail':'Calendar'} first.`),{status:409});
    let refresh;try{refresh=unseal(row.refresh_token)}catch{throw Object.assign(new Error('Google connection needs to be set up again.'),{status:503});}
    const tokens=await tokenRequest({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:'refresh_token'});
    if(tokens.refresh_token)await store.setGoogleRefreshToken(db,userId,kind,seal(tokens.refresh_token));
    return tokens.access_token;
  };
  const listStatus=async userId=>(await store.listGoogleConnections(db,userId)).map(r=>({kind:r.kind,connected:true,scopes:JSON.parse(r.scopes),connectedAt:r.connected_at}));
  const checkTrip=async(userId,tripId)=>{
    if(!tripId)return null;
    const row=await findTripId(userId,tripId);
    if(!row)throw Object.assign(new Error('This trip was not found.'),{status:404});return row.id;
  };
  const insertRecord=async(userId,kind,data)=>{
    const rows=await store.listRecordData(db,userId,kind);
    if(rows.some(r=>{try{const old=JSON.parse(r.data);return old.source===data.source&&old.externalId===data.externalId;}catch{return false}}))return false;
    await store.insertRecord(db,{id:randomUUID(),userId,kind,data:JSON.stringify(data),updated:new Date().toISOString()});return true;
  };
  const callback=async(url,userId)=>{
    const state=url.searchParams.get('state')||'',stateHash=hash(state),row=state?await store.findGoogleOAuthState(db,stateHash,userId,Date.now()):null;
    if(!row)return fail(400,'This Google connection request expired. Please start again.');
    // Consume state before exchanging the code so callbacks cannot be replayed.
    await store.deleteGoogleOAuthState(db,stateHash);
    if(url.searchParams.has('error'))return {status:303,redirect:`${origin}/trip.html?google=cancelled&kind=${row.kind}#/bookings`};
    const code=url.searchParams.get('code');if(!code)return fail(400,'Google did not return a connection code.');
    let verifier;try{verifier=unseal(row.verifier)}catch{return fail(503,'Google connection needs to be started again.');}
    let tokens;try{tokens=await tokenRequest({code,client_id:clientId,client_secret:clientSecret,redirect_uri:`${origin}/api/integrations/google/callback`,grant_type:'authorization_code',code_verifier:verifier});}catch(e){return fail(e.status||502,e.status?e.message:'Google could not complete the connection. Please try again.');}
    const granted=String(tokens.scope||scopes[row.kind]).split(/\s+/).filter(Boolean);
    if(!granted.includes(scopes[row.kind]))return fail(403,'Google did not grant the requested read-only access.');
    const existing=await store.findGoogleRefreshToken(db,userId,row.kind);
    const refresh=tokens.refresh_token?seal(tokens.refresh_token):existing?.refresh_token;
    if(!refresh)return fail(502,'Google did not return an offline access token. Disconnect and reconnect with consent.');
    await store.upsertGoogleConnection(db,{userId,kind:row.kind,refreshToken:refresh,scopes:JSON.stringify([scopes[row.kind]]),connectedAt:new Date().toISOString()});
    if(row.kind==='gmail') {
      try { await gmailSync(userId); }
      catch { return {status:303,redirect:`${origin}/trip.html?google=sync-failed&kind=gmail#/bookings`}; }
    }
    return {status:303,redirect:`${origin}/trip.html?google=connected&kind=${row.kind}#/bookings`};
  };
  const begin=async(userId,kind)=>{
    if(!configured||!key)return fail(503,'Google connections are not configured yet.');
    if(!Object.hasOwn(scopes,kind))return fail(422,'Choose Gmail or Calendar.');
    await store.deleteExpiredGoogleOAuthStates(db,Date.now());
    const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
    await store.createGoogleOAuthState(db,{stateHash:hash(state),userId,kind,verifier:seal(verifier),expires:Date.now()+10*60_000});
    const auth=new URL(AUTH);for(const [k,v] of Object.entries({client_id:clientId,redirect_uri:`${origin}/api/integrations/google/callback`,response_type:'code',scope:scopes[kind],access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}))auth.searchParams.set(k,v);
    return {status:200,data:{authorizationUrl:auth.href,kind}};
  };
  const gmailSync=async(userId,tripId,includePast=false)=>{
    const access=await getAccess(userId,'gmail');const messages=[],summaries=[];let pageToken='';
    const deadline=AbortSignal.timeout(45000), boundedSignal=()=>AbortSignal.any([deadline,AbortSignal.timeout(12000)]);
    for(let page=0;page<3;page++){
      const query=new URLSearchParams({q:'("booking confirmed" OR "reservation confirmed" OR "confirmation number" OR "confirmation code" OR "booking reference" OR "reservation number" OR "e-ticket" OR itinerary)',maxResults:'100'});
      if(pageToken)query.set('pageToken',pageToken);
      const listing=await requestJson(`${GMAIL}/messages?${query}`,access,boundedSignal());
      summaries.push(...(listing.messages||[]).slice(0,100));
      pageToken=listing.nextPageToken||'';
      if(!pageToken)break;
    }
    const details=[];
    for(let offset=0;offset<summaries.length;offset+=5){
      const batch=summaries.slice(offset,offset+5);
      details.push(...await Promise.all(batch.map(async summary=>({summary,msg:await requestJson(`${GMAIL}/messages/${encodeURIComponent(summary.id)}?format=full`,access,boundedSignal())}))));
    }
    for(const {summary,msg} of details){
      if(deadline.aborted)throw Object.assign(new Error('Gmail booking search took too long. Please try again.'),{status:504});
      const headers=msg.payload?.headers||[];
      const header=name=>clean(headers.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||'',500);
      const plain=findBody(msg.payload,'text/plain'),html=findBody(msg.payload,'text/html'),snippet=clean(msg.snippet,1200);
      const bodyText=plain||htmlToText(html)||snippet;
      const sourceUrl=`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(msg.id||summary.id)}`;
      const rawDate=header('Date');
      const extracted=extractBooking({subject:header('Subject'),from:header('From'),body:bodyText,snippet,schema:jsonLdObjects(html),externalId:msg.id||summary.id,tripId,sourceUrl,confirmationDate:rawDate,today:now().toISOString().slice(0,10),includePast});
      if(!extracted.booking)continue;
      const data=extracted.booking;
      if(await insertRecord(userId,'bookings',data))messages.push({id:data.externalId,title:data.title,start:data.start,end:data.end,dateStatus:data.dateStatus,sender:data.sender,notes:data.notes,sourceEvidence:data.sourceEvidence,sourceUrl});
    }
    return {imported:messages.length,scanned:summaries.length,truncated:!!pageToken,bookings:messages};
  };
  const calendarSync=async(userId,tripId)=>{
    const access=await getAccess(userId,'calendar');const current=now(),end=new Date(current.getTime()+730*86400_000);
    const params=new URLSearchParams({timeMin:current.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'100'});
    const result=await requestJson(`${CALENDAR}/calendars/primary/events?${params}`,access),events=[];
    for(const event of (result.items||[]).slice(0,100)){
      if(event.status==='cancelled')continue;
      const link=isHttp(event.htmlLink)?event.htmlLink:'';
      const title=clean(event.summary,300)||'Calendar event';
      const data={type:'other',name:title,title,source:'google-calendar',externalId:event.id,tripId:tripId||'',start:event.start?.dateTime||event.start?.date||'',end:event.end?.dateTime||event.end?.date||'',location:clean(event.location,1000),notes:clean(event.description,2000),sourceUrl:link};
      if(await insertRecord(userId,'bookings',data))events.push(data);
    }
    return {imported:events.length,events};
  };
  return async function handleGoogle({path,method,body={},user,url}) {
    const userId=typeof user==='string'?user:user?.id;if(!path?.startsWith('/api/integrations/google/'))return null;
    if(!userId)return fail(401,'Please sign in.');
    const requestUrl=url instanceof URL?url:new URL(url||'http://localhost'+path);
    if(path==='/api/integrations/google/callback'&&method==='GET')return callback(requestUrl,userId);
    if(path==='/api/integrations/google/status'&&method==='GET')return {status:200,data:{configured:configured&&!!key,connections:await listStatus(userId)}};
    if(path==='/api/integrations/google/start'&&method==='POST')return begin(userId,clean(body.kind,20));
    if(path==='/api/integrations/google/disconnect'&&method==='POST'){
      if(!Object.hasOwn(scopes,body.kind))return fail(422,'Choose Gmail or Calendar.');
      await store.deleteGoogleConnection(db,userId,body.kind);await store.deleteGoogleOAuthStatesFor(db,userId,body.kind);
      return {status:200,data:{ok:true,kind:body.kind}};
    }
    if(path==='/api/integrations/google/sync'&&method==='POST'){
      if(!configured||!key)return fail(503,'Google connections are not configured yet.');
      const kind=body.kind;if(!Object.hasOwn(scopes,kind))return fail(422,'Choose Gmail or Calendar.');
      let tripId;try{tripId=await checkTrip(userId,body.tripId)}catch(e){return fail(e.status||404,e.message)}
      try{return {status:200,data:{kind,...(kind==='gmail'?await gmailSync(userId,tripId,body.includePast===true):await calendarSync(userId,tripId))}};}
      catch(e){return fail(e.status||502,e.status?e.message:'Google data is temporarily unavailable. Please try again.');}
    }
    return null;
  };
}

function findBody(payload,mimeType) {
  if(payload?.mimeType===mimeType&&payload.body?.data){try{return clean(Buffer.from(payload.body.data,'base64url').toString('utf8'),12000)}catch{return ''}}
  for(const part of payload?.parts||[]){const text=findBody(part,mimeType);if(text)return text;}
  return '';
}
function htmlToText(value){return clean(value.replace(/<\s*br\s*\/?>/gi,'\n').replace(/<\s*\/(?:p|div|tr|li|h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,' '));}
function jsonLdObjects(html){const objects=[];for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{objects.push(JSON.parse(m[1]));}catch{}}return objects;}
