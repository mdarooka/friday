import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';

test('Friday workflow routes enforce session, ownership, admin allowlist, preview confirmation and quote status',async t=>{
  const {request}=await startApp(t,{env:{AUTH_PROVIDER:'local',AUTH_REQUIRED:'true',QUOTE_ADMIN_EMAILS:'admin@example.com',HEXCLAVE_PROJECT_ID:'project-test',HEXCLAVE_SECRET_SERVER_KEY:'test-server-key'},hexclaveAuth:{configured:false,currentUser:async()=>null},emailFetch:async(url,options)=>{
    assert.equal(url,'https://api.hexclave.com/api/v1/emails/send-email');
    const sent=JSON.parse(options.body);assert.deepEqual(sent.emails,['customer@example.com']);assert.match(sent.html,/Amount: USD 4200\.00/);return new Response(null,{status:202});
  }});
  assert.equal((await request('/api/friday/drafts')).status,401);
  const customer=await signUp(request,'Customer'),other=await signUp(request,'Other'),admin=await signUp(request,'Admin');
  assert.deepEqual((await request('/api/friday/status','GET',undefined,{cookie:customer.cookie})).result,{quoteAdmin:false,emailConfigured:true,commissionEmailConfigured:false});
  assert.equal((await request('/api/admin/quotes','GET',undefined,{cookie:customer.cookie})).status,403);
  const answer={destination:'Kenya',startDate:'2026-11-01',endDate:'2026-11-10',travelers:2,budget:'4200 USD',listingIds:['departure:super-tuskers'],bookingIds:[]};
  const planned=await request('/api/friday/plan','POST',{message:'Plan a Kenya trip around this package',answers:answer},{cookie:customer.cookie});
  assert.equal(planned.status,200);const draft=planned.result.draft;assert.ok(draft);
  assert.equal((await request('/api/friday/plan','POST',{message:'Change it',tripId:'00000000-0000-4000-8000-000000000001',answers:answer},{cookie:customer.cookie})).status,404);
  assert.equal((await request('/api/friday/plan','POST',{message:'Adjust the trip',draftId:draft.id,draftVersion:0,answers:answer},{cookie:customer.cookie})).status,409);
  assert.equal((await request('/api/friday/plan','POST',{message:'Adjust the trip',draftId:draft.id,draftVersion:draft.version,answers:answer},{cookie:other.cookie})).status,404);
  assert.equal((await request('/api/friday/handoffs','POST',{draftId:draft.id,version:draft.version-1,confirmed:true},{cookie:customer.cookie})).status,409);
  const handoff=await request('/api/friday/handoffs','POST',{draftId:draft.id,version:draft.version,confirmed:true},{cookie:customer.cookie});assert.equal(handoff.status,201);
  const repeated=await request('/api/friday/handoffs','POST',{draftId:draft.id,version:draft.version,confirmed:true},{cookie:customer.cookie});assert.equal(repeated.result.handoff.id,handoff.result.handoff.id);
  const quote=(await request('/api/admin/quotes','GET',undefined,{cookie:admin.cookie})).result.quotes[0];assert.equal(quote.customerEmail,'customer@example.com');
  assert.equal((await request('/api/admin/quotes','GET',undefined,{cookie:other.cookie})).status,403);
  const preview=(await request(`/api/admin/quotes/${quote.id}/preview`,'POST',{amount:4200,currency:'USD',details:'Includes the stated trip design.'},{cookie:admin.cookie}));assert.equal(preview.status,200);assert.match(preview.result.preview.text,/Your selected plan/);
  const mismatch=await request(`/api/admin/quotes/${quote.id}/send`,'POST',{amount:4201,currency:'USD',details:'Includes the stated trip design.',previewHash:preview.result.preview.previewHash},{cookie:admin.cookie});assert.equal(mismatch.status,409);
  const sent=await request(`/api/admin/quotes/${quote.id}/send`,'POST',{amount:4200,currency:'USD',details:'Includes the stated trip design.',previewHash:preview.result.preview.previewHash},{cookie:admin.cookie});assert.equal(sent.status,200);assert.equal(sent.result.quote.status,'provider_accepted');
  assert.equal((await request(`/api/admin/quotes/${quote.id}/send`,'POST',{amount:4200,currency:'USD',details:'Includes the stated trip design.',previewHash:preview.result.preview.previewHash},{cookie:admin.cookie})).status,409);
  assert.equal((await request('/api/friday/handoffs','GET',undefined,{cookie:customer.cookie})).result.handoffs[0].status,'provider_accepted');
});
