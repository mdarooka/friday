import test from 'node:test';
import assert from 'node:assert/strict';
import {startApp,signUp} from './helpers.mjs';
import {openaiMessage} from '../server/providers/openai-research.mjs';
const source='https://example.com/garden';
// HEXCLAVE_PROJECT_ID is blank on purpose: the vault-mode harness would otherwise inject fake Hexclave keys, which switch email delivery on and turn the expected 'blocked' notification into 'delivery_unknown'.
const brief={placeName:'Garden',destination:'Kyoto, Japan',days:2,travelers:2,startDate:'2027-04-01'};
function options(overrides={}){return {env:{HEXCLAVE_PROJECT_ID:'',AUTH_PROVIDER:'local',AUTH_REQUIRED:'true',QUOTE_ADMIN_EMAILS:'admin@example.com',FRIDAY_ENQUIRY_EMAIL:'owner@example.test'},hexclaveAuth:{configured:false,currentUser:async()=>null},ai:{provider:'openai',apiKey:'fake',model:'fake'},reelInterpret:async text=>({fields:text==='change'?{days:3}:text.startsWith('https:')?brief:{},edit:text==='change'}),researchLink:async({url})=>({url,extracted:!url.includes('unavailable'),places:[{title:'Garden',sourceUrl:url}],sources:[{url}]}),reelResearch:async({trip})=>({text:'Sourced draft',sources:[{url:source}],questions:[],days:Array.from({length:trip.days},(_,i)=>({title:'Day '+(i+1),notes:'Access needs confirmation.',items:[{title:i===0?'Garden':'Walk '+i,description:'A researched visit.',sourceUrl:source}]}))}),...overrides};}

test('chat collects, researches, revises and explicitly hands off the exact reviewed version',async t=>{
 const {request}=await startApp(t,options()),a=await signUp(request,'Customer'),b=await signUp(request,'Other'),admin=await signUp(request,'Admin');
 const send=(message,cookie=a.cookie)=>request('/api/friday/reel-chat','POST',{conversationId:'same-thread',message},{cookie});
 assert.equal((await send('hello','')).status,401);
 assert.match((await send('https://instagram.com/reel/test Garden')).result.text,/Generate itinerary/);
 assert.match((await send('Send for quotation')).result.text,/review/i);
 let r=await send('Generate itinerary');assert.equal(r.status,200);assert.equal(r.result.draft.days.length,2);const first=r.result.draft;
 assert.match(r.result.text,/\[Source\]/);
 assert.match((await send('Show itinerary',b.cookie)).result.text,/Paste the public reel/);
 assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:b.cookie})).result.drafts.length,0);
 assert.equal((await request('/api/friday/handoffs','POST',{draftId:first.id,version:1,confirmed:true},{cookie:b.cookie})).status,404);
 await send('Request quotation');
 await send('change');
 assert.match((await send('Send for quotation')).result.text,/review/i);
 r=await send('Generate itinerary');assert.equal(r.result.draft.days.length,3);const revised=r.result.draft;
 r=await send('Request quotation');assert.deepEqual(r.result.suggestions,['Send for quotation']);
 r=await send('Send for quotation');assert.equal(r.result.handoff.status,'queued');assert.equal(r.result.handoff.notificationStatus,'blocked');assert.doesNotMatch(JSON.stringify(r.result),/owner@example/);
 await send('Request quotation');const repeat=await send('Send for quotation');assert.equal(repeat.result.handoff.id,r.result.handoff.id);
 const quotes=await request('/api/admin/quotes','GET',undefined,{cookie:admin.cookie});assert.equal(quotes.status,200);assert.equal(quotes.result.quotes.length,1);assert.equal(quotes.result.quotes[0].snapshot.id,revised.id);
 const q=quotes.result.quotes[0];const preview=await request('/api/admin/quotes/'+q.id+'/preview','POST',{amount:100,currency:'USD',details:'Human quote'},{cookie:admin.cookie});assert.match(preview.result.preview.text,/Garden/);assert.match(preview.result.preview.text,/Day 3/);
});

test('unreadable reel requires a distinct explicit fallback; model ambiguity never grants consent',async t=>{
 const {request}=await startApp(t,options());const a=await signUp(request,'Customer');
 const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'fallback',message},{cookie:a.cookie});
 await send('https://instagram.com/reel/unavailable Garden');let r=await send('Generate itinerary');assert.deepEqual(r.result.suggestions,['Use confirmed place']);
 assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
 r=await send('Use confirmed place');assert.equal(r.result.draft.source.status,'user_attested_only');
});

test('draft validator rejects prices, unknown sources, wrong day counts and missing anchor',async t=>{
 for(const mode of ['price','source','days','anchor']){
  const opts=options();const base=opts.reelResearch;opts.reelResearch=async input=>{const r=await base(input);if(mode==='price')r.days[0].items[0].description='100 euros';if(mode==='source')r.days[0].items[0].sourceUrl='https://invented.example';if(mode==='days')r.days.pop();if(mode==='anchor')r.days[0].items[0].title='Something else';return r;};
  const {request}=await startApp(t,opts);const a=await signUp(request,'Customer');const r=await request('/api/friday/reels','POST',{...brief,url:'https://instagram.com/reel/test',pace:'balanced',destinationConfirmed:true},{cookie:a.cookie});assert.ok(r.status===422||r.status===502,mode);assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
 }
});

test('OpenAI adapter uses server key, disables storage, enables web search and extracts actual citations',async()=>{
 const r=await openaiMessage({prompt:'Research a trip',web:true,config:{apiKey:'secret',model:'test',fetch:async(url,init)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.headers.Authorization,'Bearer secret');const b=JSON.parse(init.body);assert.equal(b.store,false);assert.deepEqual(b.tools,[{type:'web_search'}]);
 return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'Answer',annotations:[{type:'url_citation',url:source,title:'Garden'}]}]}]}));
 }}});assert.deepEqual(r.sources,[{url:source,title:'Garden'}]);
 await assert.rejects(openaiMessage({prompt:'x',config:{model:'test'}}),e=>e.status===503);
});


test('a concurrent draft edit invalidates chat approval; scientific uncertainty asks clarification',async t=>{
 const opts=options();const {request}=await startApp(t,opts);const a=await signUp(request,'Customer');
 const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'stale-review',message},{cookie:a.cookie});
 await send('https://instagram.com/reel/test Garden');const generated=await send('Generate itinerary');const d=generated.result.draft;
 await send('Request quotation');
 const changed=await request('/api/friday/reels/'+d.id,'PATCH',{version:d.version,instructions:'Please add extra rest.'},{cookie:a.cookie});assert.equal(changed.status,200);
 assert.match((await send('Send for quotation')).result.text,/review/i);
 assert.equal((await request('/api/friday/handoffs','GET',undefined,{cookie:a.cookie})).result.handoffs.length,0);
 assert.equal((await request('/api/friday/reels/'+d.id,'PATCH',{version:d.version,instructions:'stale'},{cookie:a.cookie})).status,409);
 const second=await startApp(t,options({reelResearch:async()=>({questions:['Which Garden do you mean?'],days:[],sources:[]})}));const b=await signUp(second.request,'Other');
 const r=await second.request('/api/friday/reels','POST',{...brief,url:'https://instagram.com/reel/test',pace:'balanced',destinationConfirmed:true},{cookie:b.cookie});assert.equal(r.result.needsClarification,true);assert.equal(r.result.needsConfirmation,undefined);
});
