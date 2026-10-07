import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { createHexclaveAuth } from '../server/hexclave/auth.mjs';
import { createApp } from '../server/app.mjs';
import * as store from '../server/store.mjs';
const scrypt=promisify(scryptCallback);
const projectId='123e4567-e89b-42d3-a456-426614174000';
const secretServerKey='test-secret-server-key';
const appOrigin='https://friday.example';

test('Hexclave server adapter deletes a named account through the server user object',async()=>{
  let deleted='';
  const auth=createHexclaveAuth({env:{HEXCLAVE_PROJECT_ID:projectId,HEXCLAVE_SECRET_SERVER_KEY:secretServerKey},serverApp:{getUser:async id=>({id,delete:async()=>{deleted=id;}})}});
  assert.deepEqual(await auth.deleteUser('hx-account-to-delete'),{deleted:true});
  assert.equal(deleted,'hx-account-to-delete');
});

test('Hexclave server adapter verifies the request and carries verified email and restriction state',async()=>{
  const seen=[];
  const auth=createHexclaveAuth({env:{HEXCLAVE_PROJECT_ID:projectId,HEXCLAVE_SECRET_SERVER_KEY:secretServerKey},serverApp:{getUser:async options=>{seen.push(options);return{id:'hx-user-1',primaryEmail:'traveller@example.com',displayName:'Traveller',primaryEmailVerified:true,isRestricted:false,isAnonymous:false};}}});
  const request={headers:{authorization:'Bearer access'}};
  assert.equal(auth.configured,true);
  assert.deepEqual(await auth.currentUser(request),{id:'hx-user-1',email:'traveller@example.com',name:'Traveller',emailVerified:true,restricted:false,restrictedReason:null});
  assert.equal(seen[0].tokenStore,request);
  assert.equal(seen[0].includeRestricted,true);
  const restricted=createHexclaveAuth({env:{HEXCLAVE_PROJECT_ID:projectId,HEXCLAVE_SECRET_SERVER_KEY:secretServerKey},serverApp:{getUser:async()=>({id:'hx-unverified',primaryEmail:'new@example.com',primaryEmailVerified:false,isRestricted:true,restrictedReason:{type:'email_not_verified'},isAnonymous:false})}});
  assert.deepEqual(await restricted.currentUser(request),{id:'hx-unverified',email:'new@example.com',name:'new@example.com',emailVerified:false,restricted:true,restrictedReason:'email_not_verified'});
});

async function start(t,{legacy=false}={}) {
  const deletions=[];
  const server=createApp({memory:true,origin:appOrigin,env:{NODE_ENV:'production',APP_ORIGIN:appOrigin,AUTH_PROVIDER:'hexclave',HEXCLAVE_PROJECT_ID:projectId,HEXCLAVE_SECRET_SERVER_KEY:secretServerKey,AI_REVIEW_ADMIN_EMAILS:'reviewer@example.com',ADMIN_EMAILS:'reviewer@example.com'},hexclaveAuth:{configured:true,projectId,currentUser:async req=>{
    const value=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(value==='revoked'||!value)return null;
    if(value==='restricted')return{id:'restricted-owner',email:'pending@example.com',name:'Pending user',emailVerified:false,restricted:true,restrictedReason:'email_not_verified'};
    if(value==='legacy')return{id:'legacy-hex-id',email:'legacy@example.com',name:'Legacy owner',emailVerified:true,restricted:false};
    if(value==='reviewer')return{id:'reviewer-hex-id',email:'reviewer@example.com',name:'Review',emailVerified:true,restricted:false};
    return{id:'owner-'+value,email:value+'@example.com',name:value,emailVerified:true,restricted:false};
  },deleteUser:async id=>{deletions.push(id);return{deleted:true};}}});
  if(legacy){
    const password='legacy Friday password 123';
    const salt=randomBytes(16).toString('hex'),key=(await scrypt(password,salt,64)).toString('hex');
    await store.createUser(server.db,{id:'legacy-owner',email:'legacy@example.com',name:'Legacy owner',password:`${salt}:${key}`});
    await store.insertRecord(server.db,{id:'legacy-trip',userId:'legacy-owner',kind:'trips',data:JSON.stringify({title:'Saved trip'}),updated:new Date().toISOString()});
  }
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(url,method='GET',data,token='',extraHeaders={})=>{
    const res=await fetch(base+url,{method,headers:{...(data!==undefined?{'Content-Type':'application/json',Origin:appOrigin}:{}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...extraHeaders},body:data===undefined?undefined:JSON.stringify(data)});
    const result=(res.headers.get('content-type')||'').includes('json')?await res.json():await res.text();return{status:res.status,result};
  };
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));});
  return{request,db:server.db,deletions};
}

test('Hexclave account deletion request removes the mapped sign-in account through the server admin adapter',async t=>{
  const {request,deletions,db}=await start(t);
  assert.equal((await request('/api/auth/me','GET',undefined,'alice')).status,200);
  const submitted=await request('/api/account/data-requests','POST',{},'alice');assert.equal(submitted.status,201);
  assert.equal((await request('/api/admin/data-requests','GET',undefined,'reviewer')).status,200);
  const completed=await request('/api/admin/data-requests/'+submitted.result.request.id+'/complete','POST',{},'reviewer');
  assert.equal(completed.status,200);assert.equal(completed.result.request.status,'completed');
  assert.deepEqual(deletions,['owner-alice']);
  assert.equal(await db.one("SELECT id FROM users WHERE email='alice@example.com'"),undefined);
});

test('Hexclave tokens are rechecked, restricted users stay outside private APIs, and review stays owner-scoped',async t=>{
  const {request}=await start(t);
  assert.equal((await request('/api/itineraries/prompt','POST',{destination:'goa',days:1})).status,401);
  assert.equal((await request('/api/itineraries','POST',{destination:'goa',days:1})).status,401);
  const me=await request('/api/auth/me','GET',undefined,'alice');
  assert.equal(me.status,200);assert.equal(me.result.user.email,'alice@example.com');
  const created=await request('/api/trips','POST',{data:{title:'Alice trip'}},'alice');
  assert.equal(created.status,201);
  assert.equal((await request('/api/trips','GET',undefined,'bob')).result.records.length,0);
  assert.equal((await request('/api/trips/'+created.result.record.id,'GET',undefined,'bob')).status,404);
  assert.equal((await request('/api/ai-conversations/events','POST',{ownerId:me.result.user.id,conversationId:'alice-thread',eventId:'one',role:'user',content:{text:'Plan Kyoto'},status:'completed'},'alice')).status,200);
  assert.equal((await request('/api/trips','GET',undefined,'revoked')).status,401);
  const restricted=await request('/api/auth/me','GET',undefined,'restricted');
  assert.equal(restricted.result.verificationRequired,true);
  assert.equal((await request('/api/trips','GET',undefined,'restricted')).status,401);
  assert.equal((await request('/api/auth/me','GET',undefined,'revoked')).result.user,null);
  // A legacy Friday cookie is never accepted once Hexclave owns the account provider.
  assert.equal((await request('/api/auth/me','GET',undefined,'',{Cookie:'friday_session=not-a-hexclave-token'})).result.user,null);
  assert.equal((await request('/api/admin/ai-conversations','GET',undefined,'alice')).status,403);
  const reviewer=await request('/api/auth/me','GET',undefined,'reviewer');
  assert.equal(reviewer.result.user.email,'reviewer@example.com');
  const reviewed=await request('/api/admin/ai-conversations','GET',undefined,'reviewer');
  assert.equal(reviewed.status,200);assert.equal(reviewed.result.events.length,1);assert.equal(reviewed.result.events[0].owner_id,me.result.user.id);
});

test('enforced itinerary queries require an owner and saved results can only be read by that owner',async t=>{
  const {request}=await start(t);
  const body={destination:'goa',days:1};
  assert.equal((await request('/api/itineraries/prompt','POST',body,undefined)).status,401);
  const prompt=await request('/api/itineraries/prompt','POST',body,'alice');assert.equal(prompt.status,200);
  const made=await request('/api/itineraries','POST',body,'alice');assert.equal(made.status,201);
  assert.equal((await request('/api/itineraries/'+made.result.id,'GET',undefined,'')).status,401);
  assert.equal((await request('/api/itineraries/'+made.result.id,'GET',undefined,'bob')).status,404);
  assert.equal((await request('/api/itineraries/'+made.result.id,'GET',undefined,'alice')).status,200);
});

test('legacy Friday data only links after the existing password is proved',async t=>{
  const {request,db}=await start(t,{legacy:true});
  assert.equal((await request('/api/auth/me','GET',undefined,'legacy')).result.legacyAccountAvailable,true);
  assert.equal((await request('/api/auth/link-legacy','POST',{password:'wrong'},'legacy')).status,401);
  const linked=await request('/api/auth/link-legacy','POST',{password:'legacy Friday password 123'},'legacy');
  assert.equal(linked.status,200);assert.equal(linked.result.user.id,'legacy-owner');
  assert.equal((await request('/api/trips','GET',undefined,'legacy')).result.records[0].data.title,'Saved trip');
  assert.equal((await db.one('SELECT COUNT(*) AS n FROM hexclave_identities')).n,1);
});
