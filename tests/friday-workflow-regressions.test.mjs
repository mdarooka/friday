import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../server/store.mjs';
import { createFridayWorkflow } from '../server/friday-workflow.mjs';
import { createHexclaveEmailService } from '../server/hexclave/email.mjs';
import catalog from '../build/data.js';

async function fixture({fetch=async()=>({ok:true,json:async()=>({id:'email-1'})}),env={},aiConfig={}}={}) {
  const db=store.openStore({ memory: true });
  await store.createUser(db,{id:'alice',email:'alice@example.com',name:'Alice',password:'hash'});
  await store.createUser(db,{id:'bob',email:'bob@example.com',name:'Bob',password:'hash'});
  const email=createHexclaveEmailService({db,store,env,fetch});
  const workflow=createFridayWorkflow({db,store,env,fetch,email,aiConfig,tripFind:async(id,owner)=>await store.findTripId(db,id,owner)});
  const owner={id:'alice',email:'alice@example.com'},other={id:'bob',email:'bob@example.com'};
  return {db,workflow,owner,other};
}
const listingId=`departure:${catalog.departures[0].slug}`;
const complete={destination:'Tsavo',startDate:'2027-04-01',endDate:'2027-04-05',travelers:2,budget:'5000',listingIds:[listingId]};
const startDraft=(workflow,owner,answers=complete,message='Plan a trip to Tsavo')=>workflow.plan(owner,{message,answers});

test('Friday uses only owner verified upcoming bookings and rejects invalid date ranges safely',async()=>{
  const {db,workflow,owner,other}=await fixture();
  await store.insertRecord(db,{id:'owned-future',userId:'alice',kind:'bookings',data:JSON.stringify({title:'Future flight',source:'google-gmail',start:'2027-04-01',end:'2027-04-03',dateStatus:'confirmed'}),updated:new Date().toISOString()});
  await store.insertRecord(db,{id:'owned-unclear',userId:'alice',kind:'bookings',data:JSON.stringify({title:'Unclear hotel',start:'2027-04-01',dateStatus:'needs-clarification'}),updated:new Date().toISOString()});
  await store.insertRecord(db,{id:'owned-old',userId:'alice',kind:'bookings',data:JSON.stringify({title:'Past confirmed trip',start:'2020-04-01',dateStatus:'confirmed'}),updated:new Date().toISOString()});
  await store.insertRecord(db,{id:'foreign',userId:'bob',kind:'bookings',data:JSON.stringify({title:'Bob flight',start:'2027-05-01',dateStatus:'confirmed'}),updated:new Date().toISOString()});
  const result=await workflow.plan(owner,{message:'Help plan around my booking',answers:{destination:'Japan'}});
  assert.ok(result.questions.some(q=>q.key==='bookingIds'));
  assert.deepEqual(result.questions.find(q=>q.key==='bookingIds').options.map(x=>x.id).filter(id=>id!=='none'),['owned-future']);
  const hidden=await workflow.plan(other,{message:'Help plan around my booking',answers:{destination:'Japan'}});
  assert.deepEqual(hidden.questions.find(q=>q.key==='bookingIds').options.map(x=>x.id).filter(id=>id!=='none'),['foreign']);
  const invalid=await workflow.plan(owner,{message:'Plan a trip to Japan',answers:{...complete,startDate:'not-a-date',endDate:'not-a-date'}});
  assert.ok(invalid.questions.some(q=>q.key==='startDate'));
  assert.ok(invalid.questions.some(q=>q.key==='endDate'));
  await assert.doesNotReject(()=>workflow.listDrafts(owner));
  const old=await workflow.plan(owner,{message:'Plan a trip around my old booking',scope:'all'});
  assert.ok(old.questions.find(q=>q.key==='bookingIds').options.some(x=>x.id==='owned-old'));
  await store.closeStore(db);
});

test('Friday reads the live published catalog, normalizes only explicit traveler counts, and preserves instruction edits',async()=>{
  const calls=[];
  const {db,workflow,owner}=await fixture({fetch:async(url,options)=>{
    calls.push({url:String(url),body:JSON.parse(options.body)});
    return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({summary:'Human review needed',segments:[{listingId,sourceIndex:999,action:'keep'},{listingId:'invented:listing',sourceIndex:0,action:'keep'}]})}]})};
  },aiConfig:{provider:'claude',apiKey:'test',model:'test-model'}});
  const publishedId='villa-live-1';
  await store.insertVilla(db,{id:publishedId,ownerId:'alice',status:'published',data:JSON.stringify({name:'Newly published villa',city:'Kyoto',description:'Quiet garden stay',maxGuests:4}),created:'2026-10-05',updated:'2026-10-05'});
  const discovery=await workflow.plan(owner,{message:'Find a villa in Kyoto',answers:{destination:'Kyoto'}});
  assert.ok(discovery.listings.some(x=>x.id===publishedId));
  const stringCount=await workflow.plan(owner,{message:'Plan a trip to Tsavo',answers:{...complete,travelers:'two'}});
  assert.ok(stringCount.questions.some(q=>q.key==='travelers'));
  const planned=await startDraft(workflow,owner,complete,'Edit this travel package for Tsavo: keep the lake day and remove the museum, please.');
  assert.equal(calls.length,1);
  assert.match(calls[0].body.messages[0].content[0].text,/keep the lake day and remove the museum/i);
  assert.ok(planned.draft);
  assert.deepEqual(planned.draft.items[0].proposedSegments,planned.draft.items[0].sourceSegments);
  assert.deepEqual(planned.draft.items[0].removedSegments,[]);
  assert.equal(planned.draft.items[0].listingId,listingId);
  await assert.rejects(()=>workflow.plan(owner,{message:'Plan a trip to Tsavo with an invented listing',answers:{...complete,listingIds:['invented:listing']}}),/Choose listings from Friday/);
  await store.closeStore(db);
});

test('Friday carries model clarification answers back into the package edit request',async()=>{
  const prompts=[];let call=0;
  const {db,workflow,owner}=await fixture({fetch:async(url,options)=>{
    prompts.push(JSON.parse(options.body).messages[0].content[0].text);
    call++;
    const result=call===1?{questions:['Should I keep all sample days?']}:{segments:[]};
    return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify(result)}]})};
  },aiConfig:{provider:'claude',apiKey:'test',model:'test-model'}});
  const message='Edit the Tsavo travel package for me';
  const first=await workflow.plan(owner,{message,answers:complete});
  assert.equal(first.questions[0].key,'instructions_1');
  const second=await workflow.plan(owner,{message,answers:{...complete,instructions_1:'Keep every day in the sample.'}});
  assert.ok(second.draft);
  assert.equal(prompts.length,2);
  assert.match(prompts[1],/instructions_1: Keep every day in the sample/);
  await store.closeStore(db);
});

test('Friday applies an exact AI removal and carries the edited itinerary into handoff',async()=>{
  const {db,workflow,owner}=await fixture({fetch:async()=>({ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({segments:[{listingId,sourceIndex:1,action:'remove'}]})}]})}),aiConfig:{provider:'claude',apiKey:'test',model:'test-model'}});
  const planned=await startDraft(workflow,owner,complete,'Edit this Tsavo travel package by removing the Tsavo days.');
  const item=planned.draft.items[0];
  assert.ok(item.sourceSegments.length>1);
  assert.deepEqual(item.removedSegments,[item.sourceSegments[1]]);
  assert.deepEqual(item.proposedSegments,item.sourceSegments.filter((_,index)=>index!==1));
  const handoff=await workflow.handoff(owner,{draftId:planned.draft.id,version:planned.draft.version,confirmed:true});
  assert.deepEqual(handoff.snapshot.items[0].removedSegments,[item.sourceSegments[1]]);
  assert.deepEqual(handoff.snapshot.items[0].proposedSegments,item.proposedSegments);
  await store.closeStore(db);
});

test('Friday materializes published segments without AI and requests clarification for booking date conflicts',async()=>{
  const {db,workflow,owner}=await fixture();
  const planned=await startDraft(workflow,owner);
  const item=planned.draft.items[0];
  assert.ok(item.sourceSegments.length>0);
  assert.deepEqual(item.proposedSegments,item.sourceSegments);
  assert.deepEqual(item.removedSegments,[]);
  await store.insertRecord(db,{id:'conflicting-booking',userId:'alice',kind:'bookings',data:JSON.stringify({title:'Flight confirmation',start:'2027-04-01',end:'2027-04-03',dateStatus:'confirmed'}),updated:new Date().toISOString()});
  const conflictAnswers={...complete,startDate:'2027-04-10',endDate:'2027-04-15',bookingIds:['conflicting-booking']};
  const conflict=await workflow.plan(owner,{message:'Plan a trip to Tsavo around my flight booking',answers:conflictAnswers});
  assert.ok(conflict.questions.some(q=>q.key==='bookingDateConflict'));
  assert.equal(conflict.draft,undefined);
  const resolved=await workflow.plan(owner,{message:'Plan a trip to Tsavo around my flight booking',answers:{...conflictAnswers,bookingDateConflict:'exclude'}});
  assert.deepEqual(resolved.draft.bookingIds,[]);
  await store.closeStore(db);
});

test('Friday accepts an explicit none choice and keeps all booking options owner scoped',async()=>{
  const {db,workflow,owner,other}=await fixture();
  await store.insertRecord(db,{id:'alice-booking',userId:'alice',kind:'bookings',data:JSON.stringify({title:'Alice trip',start:'2027-04-01',end:'2027-04-03',dateStatus:'confirmed'}),updated:new Date().toISOString()});
  await store.insertRecord(db,{id:'bob-booking',userId:'bob',kind:'bookings',data:JSON.stringify({title:'Bob trip',start:'2027-04-01',end:'2027-04-03',dateStatus:'confirmed'}),updated:new Date().toISOString()});
  const none=await workflow.plan(owner,{message:'Plan a trip to Tsavo',answers:{...complete,bookingIds:['none']}});
  assert.equal(none.questions.some(q=>q.key==='bookingIds'),false);
  assert.deepEqual(none.draft.bookingIds,[]);
  const alice=await workflow.plan(owner,{message:'Plan around my booking',answers:{destination:'Tsavo'}});
  assert.deepEqual(alice.questions.find(q=>q.key==='bookingIds').options.map(x=>x.id).filter(id=>id!=='none'),['alice-booking']);
  const bob=await workflow.plan(other,{message:'Plan around my booking',answers:{destination:'Tsavo'}});
  assert.deepEqual(bob.questions.find(q=>q.key==='bookingIds').options.map(x=>x.id).filter(id=>id!=='none'),['bob-booking']);
  await assert.rejects(()=>workflow.plan(owner,{message:'Plan a trip around a booking',answers:{...complete,bookingIds:['bob-booking']}}),/Choose a booking from your saved records/);
  await store.closeStore(db);
});

test('Friday accepts concise followup edits and lets a traveler change from flexible to fixed budget',async()=>{
  const {db,workflow,owner}=await fixture();
  const first=await workflow.plan(owner,{message:'Plan a trip to Tsavo',answers:{...complete,budget:'',flexibleBudget:true}});
  assert.equal(first.draft.flexibleBudget,true);
  const edited=await workflow.plan(owner,{message:'Remove Landscape day',draftId:first.draft.id,draftVersion:first.draft.version,answers:{instructions:'Remove Landscape day'}});
  assert.ok(edited.draft);
  assert.match(edited.draft.instructions,/Remove Landscape day/);
  const fixed=await workflow.plan(owner,{message:'Update my trip budget to $6000',draftId:edited.draft.id,draftVersion:edited.draft.version,answers:{budget:'6000',flexibleBudget:false}});
  assert.equal(fixed.draft.budget,'6000');
  assert.equal(fixed.draft.flexibleBudget,false);
  await store.closeStore(db);
});

test('Friday draft review replaces full instructions without duplicating them and supports clearing',async()=>{
  const {db,workflow,owner}=await fixture();
  const first=await workflow.plan(owner,{message:'Plan a trip to Tsavo',answers:{...complete,instructions:'Remove Landscape day.'}});
  const text=first.draft.instructions;
  const reviewed=await workflow.plan(owner,{message:'Review this travel plan',draftId:first.draft.id,draftVersion:first.draft.version,answers:{...complete,instructions:text}});
  assert.equal(reviewed.draft.instructions,text);
  const updated=await workflow.plan(owner,{message:'Review this travel plan',draftId:reviewed.draft.id,draftVersion:reviewed.draft.version,answers:{...complete,instructions:'Keep the lake day and shorten the drive.'}});
  assert.equal(updated.draft.instructions,'Keep the lake day and shorten the drive.');
  const cleared=await workflow.plan(owner,{message:'Review this travel plan',draftId:updated.draft.id,draftVersion:updated.draft.version,answers:{...complete,instructions:''}});
  assert.equal(cleared.draft.instructions,'');
  await store.closeStore(db);
});

test('Friday can hand off a clearly marked customization request for human review without AI editing',async()=>{
  let modelCalls=0;
  const {db,workflow,owner}=await fixture({aiConfig:{provider:'claude',apiKey:'test',model:'test-model'},fetch:async()=>{modelCalls++;throw new Error('AI must be skipped');}});
  const incomplete=await workflow.plan(owner,{message:'Replace the landscape day with more rest',answers:{destination:'Tsavo',travelers:2,budget:'5000',listingIds:[listingId],designerReview:true}});
  assert.ok(incomplete.questions.some(q=>q.key==='startDate'));
  assert.equal(incomplete.draft,undefined);
  const planned=await workflow.plan(owner,{message:'Replace the landscape day with more rest',answers:{...complete,designerReview:true,instructions_1:'   '}});
  assert.equal(modelCalls,0);
  assert.equal(planned.draft.designerReview,true);
  assert.match(planned.draft.editSummary,/travel designer/i);
  assert.equal(planned.draft.items[0].proposedSegments.length,planned.draft.items[0].sourceSegments.length);
  assert.match(planned.draft.instructions,/Replace the landscape day with more rest/);
  assert.doesNotMatch(planned.draft.instructions,/instructions_1:/);
  const handoff=await workflow.handoff(owner,{draftId:planned.draft.id,version:planned.draft.version,confirmed:true});
  assert.equal(handoff.snapshot.designerReview,true);
  assert.match(handoff.snapshot.instructions,/Replace the landscape day with more rest/);
  await store.closeStore(db);
});

test('designer review opt-in applies only to the current request',async()=>{
  let modelCalls=0;
  const {db,workflow,owner}=await fixture({aiConfig:{provider:'claude',apiKey:'test',model:'test-model'},fetch:async()=>{modelCalls++;return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({segments:[{listingId,sourceIndex:0,action:'remove'}]})}]})};}});
  const first=await workflow.plan(owner,{message:'Send my package request to the designer',answers:{...complete,designerReview:true,instructions:'Replace the landscape day with more rest.'}});
  assert.equal(first.draft.designerReview,true);
  const revised=await workflow.plan(owner,{message:'Edit this package',draftId:first.draft.id,draftVersion:first.draft.version,answers:{...complete,instructions:'Remove the first sample day.'}});
  assert.equal(modelCalls,1);
  assert.equal(revised.draft.designerReview,false);
  assert.deepEqual(revised.draft.items[0].removedSegments,[revised.draft.items[0].sourceSegments[0]]);
  await store.closeStore(db);
});

test('Friday handoff is version idempotent and quote delivery is server configured and single attempt',async()=>{
  const requests=[];
  const {db,workflow,owner,other}=await fixture({env:{HEXCLAVE_PROJECT_ID:'project-test',HEXCLAVE_SECRET_SERVER_KEY:'mail-key'},fetch:async(url,options)=>{
    assert.equal(url,'https://api.hexclave.com/api/v1/emails/send-email');
    requests.push({url:String(url),options});return {ok:true,json:async()=>({id:'provider-message-1'})};
  }});
  const planned=await startDraft(workflow,owner);
  const draft=planned.draft;
  await assert.rejects(()=>workflow.handoff(other,{draftId:draft.id,version:draft.version,confirmed:true}),/draft was not found/);
  const handoff=await workflow.handoff(owner,{draftId:draft.id,version:draft.version,confirmed:true});
  const duplicate=await workflow.handoff(owner,{draftId:draft.id,version:draft.version,confirmed:true});
  assert.equal(duplicate.id,handoff.id);
  assert.equal((await workflow.listHandoffs(other)).length,0);
  assert.equal((await db.one('SELECT count(*) AS n FROM friday_quotes WHERE handoff_id=$1',[handoff.id])).n,1);
  const admin=new Set([owner.email]);
  assert.equal((await workflow.adminList(owner,admin)).length,1);
  const quoteId=(await workflow.adminList(owner,admin))[0].id;
  const noConfig=createFridayWorkflow({db,store,env:{},tripFind:async()=>null});
  await assert.rejects(()=>noConfig.sendQuote(owner,admin,quoteId,{amount:100,currency:'USD',details:'Included transport'}),/not configured/);
  assert.equal((await db.one('SELECT status FROM friday_quotes WHERE id=$1',[quoteId])).status,'pending');
  const quote={amount:1250,currency:'USD',details:'A checked final quote.'};
  const preview=await workflow.previewQuote(owner,admin,quoteId,quote);
  const sent=await workflow.sendQuote(owner,admin,quoteId,{...quote,previewHash:preview.previewHash});
  assert.equal(sent.status,'provider_accepted');assert.equal(requests.length,1);
  assert.equal(JSON.parse((await db.one('SELECT status,quote FROM friday_quotes WHERE id=$1',[quoteId])).quote).amount,1250);
  await assert.rejects(()=>workflow.sendQuote(owner,admin,quoteId,{...quote,previewHash:preview.previewHash}),/cannot be changed/);
  assert.equal(requests.length,1);
  await store.closeStore(db);
});

test('Friday locks a quote after an ambiguous delivery response to prevent duplicate email',async()=>{
  let sends=0;
  const {db,workflow,owner}=await fixture({env:{HEXCLAVE_PROJECT_ID:'project-test',HEXCLAVE_SECRET_SERVER_KEY:'mail-key'},fetch:async()=>{sends++;throw new Error('connection ended after request write');}});
  const {draft}=await startDraft(workflow,owner);
  const {id:handoffId}=await workflow.handoff(owner,{draftId:draft.id,version:draft.version,confirmed:true});
  const quoteId=(await workflow.adminList(owner,new Set([owner.email])))[0].id;
  const quote={amount:900,currency:'USD',details:'Final price.'};
  const preview=await workflow.previewQuote(owner,new Set([owner.email]),quoteId,quote);
  const result=await workflow.sendQuote(owner,new Set([owner.email]),quoteId,{...quote,previewHash:preview.previewHash});
  assert.equal(result.status,'delivery_unknown');
  await assert.rejects(()=>workflow.sendQuote(owner,new Set([owner.email]),quoteId,{...quote,previewHash:preview.previewHash}),/cannot be changed/);
  assert.equal(sends,1);
  assert.ok((await workflow.listHandoffs(owner)).some(h=>h.id===handoffId));
  await store.closeStore(db);
});
