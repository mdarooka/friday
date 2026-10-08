import test from 'node:test';
import assert from 'node:assert/strict';
import {startApp,signUp} from './helpers.mjs';
import {claudeMessage,parseJsonText} from '../server/providers/claude.mjs';
import {vibeOptionsFrom} from '../server/reel-workflow.mjs';
import {vibeOptionIndex} from '../server/reel-chat.mjs';
const source='https://example.com/garden';
// HEXCLAVE_PROJECT_ID is blank on purpose: the vault-mode harness would otherwise inject fake Hexclave keys, which switch email delivery on and turn the expected 'blocked' notification into 'delivery_unknown'.
const brief={placeName:'Garden',destination:'Kyoto, Japan',days:2,travelers:2,startDate:'2027-04-01'};
function options(overrides={}){return {env:{HEXCLAVE_PROJECT_ID:'',AUTH_PROVIDER:'local',AUTH_REQUIRED:'true',QUOTE_ADMIN_EMAILS:'admin@example.com',FRIDAY_ENQUIRY_EMAIL:'owner@example.test'},hexclaveAuth:{configured:false,currentUser:async()=>null},ai:{provider:'claude',apiKey:'fake',model:'fake'},reelPickVibeOptions:async()=>{throw new Error('options unavailable in this test');},reelInterpret:async text=>({fields:text==='change'?{days:3}:text.startsWith('https:')?brief:{},edit:text==='change'}),researchLink:async({url})=>({url,extracted:!url.includes('unavailable'),places:[{title:'Garden',sourceUrl:url}],sources:[{url}]}),reelResearch:async({trip})=>({text:'Sourced draft',sources:[{url:source}],questions:[],days:Array.from({length:trip.days},(_,i)=>({title:'Day '+(i+1),notes:'Access needs confirmation.',items:[{title:i===0?'Garden':'Walk '+i,description:'A researched visit.',sourceUrl:source}]}))}),...overrides};}

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
 await send('https://instagram.com/reel/unavailable Garden');let r=await send('Generate itinerary');assert.deepEqual(r.result.suggestions,['Use confirmed place','Match the vibe']);
 assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
 r=await send('Use confirmed place');assert.equal(r.result.draft.source.status,'user_attested_only');
});

test('draft validator rejects prices, unknown sources, wrong day counts and missing anchor',async t=>{
 for(const mode of ['price','source','days','anchor']){
  const opts=options();const base=opts.reelResearch;opts.reelResearch=async input=>{const r=await base(input);if(mode==='price')r.days[0].items[0].description='100 euros';if(mode==='source')r.days[0].items[0].sourceUrl='https://invented.example';if(mode==='days')r.days.pop();if(mode==='anchor')r.days[0].items[0].title='Something else';return r;};
  const {request}=await startApp(t,opts);const a=await signUp(request,'Customer');const r=await request('/api/friday/reels','POST',{...brief,url:'https://instagram.com/reel/test',pace:'balanced',destinationConfirmed:true},{cookie:a.cookie});if(mode==='anchor')assert.equal(r.result.needsClarification,true);else assert.ok(r.status===422||r.status===502,mode);assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
 }
});

test('Claude adapter uses server key, enables web search and extracts actual citations',async()=>{
 const r=await claudeMessage({prompt:'Research a trip',web:true,config:{apiKey:'secret',model:'test',fetch:async(url,init)=>{
 assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(init.headers['x-api-key'],'secret');const b=JSON.parse(init.body);assert.equal(b.model,'test');assert.equal(b.tools[0].name,'web_search');
 return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'Answer',citations:[{url:source,title:'Garden'}]}]}));
 }}});assert.deepEqual(r.sources,[{url:source,title:'Garden'}]);
 await assert.rejects(claudeMessage({prompt:'x',config:{model:'test',fetch:async()=>new Response('{}',{status:401})}}),e=>e.status===503);
});

test('parseJsonText strips code fences and surrounding prose',()=>{
 assert.deepEqual(parseJsonText('```json\n{"a":1}\n```'),{a:1});
 assert.deepEqual(parseJsonText('Here you go: {"a":2} Thanks'),{a:2});
 assert.throws(()=>parseJsonText('no json'));
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

const research=(calls,title)=>async input=>{calls.push(input);return {text:'Sourced draft',sources:[{url:source}],questions:[],days:Array.from({length:input.trip.days},(_,i)=>({title:'Day '+(i+1),notes:'Check access.',items:[{title:i===0?title:'Walk '+i,description:'A visit.',sourceUrl:source}]}))};};
const baliBrief={placeName:'Tegallalang Rice Terraces',destination:'Bali, Indonesia',days:2,travelers:2,startDate:'2027-04-01'};

test('a reel from anywhere in the world is planned in its own place',async t=>{
 const calls=[];const {request}=await startApp(t,options({researchLink:async({url})=>({url,extracted:true,places:[{title:'Tegallalang Rice Terraces',sourceUrl:url}],sources:[{url}]}),reelInterpret:async text=>({fields:text.startsWith('https:')?baliBrief:{},edit:false}),reelResearch:research(calls,'Tegallalang Rice Terraces')}));
 const a=await signUp(request,'Customer');const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'bali',message},{cookie:a.cookie});
 let r=await send('https://instagram.com/reel/bali Tegallalang Rice Terraces');assert.deepEqual(r.result.suggestions,['Generate itinerary']);
 const d=(r=await send('Generate itinerary')).result.draft;
 assert.equal(d.destination,'Bali, Indonesia');assert.equal(d.inspiredBy,undefined);assert.equal(calls.length,1);assert.equal(calls[0].trip.destination,'Bali, Indonesia');
});

test('unknown place is matched by vibe to any place in the world',async t=>{
 const calls=[],picks=[];const {request}=await startApp(t,options({reelInterpret:async text=>({fields:text.startsWith('https:')?{days:2,travelers:2,unknownPlace:true,vibe:'terraced coast'}:{},edit:false}),reelPickVibe:async i=>{picks.push(i);return {destination:'Lisbon, Portugal',reason:'Sunny hillside city with sea views.'};},reelResearch:research(calls,'Alfama'),researchLink:async({url})=>({url,extracted:true,title:'Coastal cafe',places:[],sources:[{url}]})}));
 const a=await signUp(request,'Customer');assert.equal((await request('/api/profile','PATCH',{hotels:'Boutique stays'},{cookie:a.cookie})).status,200);
 const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'vibe',message},{cookie:a.cookie});
 let r=await send('https://instagram.com/reel/x I do not know where this is');assert.match(r.result.text,/anywhere in the world with the same vibe/);assert.deepEqual(r.result.suggestions,['Generate itinerary']);
 r=await send('Generate itinerary');const d=r.result.draft;
 assert.equal(d.destination,'Lisbon, Portugal');assert.equal(d.inspiredBy.mode,'vibe');assert.equal(calls[0].trip.destination,'Lisbon, Portugal');assert.match(r.result.text,/matched to the reel's vibe/);assert.match(r.result.text,/chosen for a similar vibe|similar vibe/);
 assert.equal(picks[0].prefs.hotels,'Boutique stays');assert.equal(picks[0].hints.vibe,'terraced coast');assert.ok(d.warnings.some(w=>/couldn't identify/.test(w)));
});

test('"Match the vibe" works after the place question',async t=>{
 const calls=[];const {request}=await startApp(t,options({reelInterpret:async text=>({fields:text.startsWith('https:')?{days:2,travelers:2}:{},edit:false}),reelPickVibe:async()=>({destination:'Lisbon, Portugal',reason:'Similar feel.'}),reelResearch:research(calls,'Alfama')}));
 const a=await signUp(request,'Customer');const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'cmd',message},{cookie:a.cookie});
 let r=await send('https://instagram.com/reel/x');assert.deepEqual(r.result.suggestions,['Match the vibe']);assert.match(r.result.text,/Match the vibe/);
 r=await send('Match the vibe');assert.match(r.result.text,/anywhere in the world/);r=await send('Generate itinerary');assert.equal(r.result.draft.destination,'Lisbon, Portugal');
});

test('an unverifiable anchor asks for clarification or a vibe match and saves nothing',async t=>{
 const calls=[];const {request}=await startApp(t,options({reelResearch:async i=>{const r=await research(calls,'Something else')(i);return r;}}));const a=await signUp(request,'Customer');
 const r=await request('/api/friday/reels','POST',{...brief,url:'https://instagram.com/reel/test',pace:'balanced',destinationConfirmed:true},{cookie:a.cookie});
 assert.equal(r.status,200);assert.equal(r.result.needsClarification,true);assert.equal(r.result.canMatchVibe,true);
 assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
 const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'anchor',message},{cookie:a.cookie});
 await send('https://instagram.com/reel/test Garden');const c=await send('Generate itinerary');assert.deepEqual(c.result.suggestions,['Match the vibe']);assert.match(c.result.text,/Match the vibe/);
});

test('vibe mode with an unreadable reel and no hints is rejected',async t=>{
 const {request}=await startApp(t,options({reelPickVibe:async()=>({destination:'Lisbon, Portugal',reason:'x'}),researchLink:async()=>{throw Object.assign(new Error('down'),{status:502});}}));const a=await signUp(request,'Customer');
 const r=await request('/api/friday/reels','POST',{url:'https://instagram.com/reel/x',days:2,travelers:2,pace:'balanced',matchVibe:true},{cookie:a.cookie});
 assert.equal(r.status,422);assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
});

test('saved traveler preferences reach reel research without notifications',async t=>{
 const calls=[];const base=options().reelResearch;const {request}=await startApp(t,options({reelResearch:async i=>{calls.push(i);return base(i);}}));const a=await signUp(request,'Customer');
 assert.equal((await request('/api/profile','PATCH',{hotels:'Boutique heritage stays',other:'Vegetarian',notifications:'weekly'},{cookie:a.cookie})).status,200);
 const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'prefs',message},{cookie:a.cookie});
 await send('https://instagram.com/reel/test Garden');assert.equal((await send('Generate itinerary')).status,200);
 const p=calls[0].profile;assert.equal(p.hotels,'Boutique heritage stays');assert.equal(p.other,'Vegetarian');assert.equal('notifications' in p,false);assert.equal('onboarded' in p,false);
 assert.match(calls[0].prompt,/Boutique heritage stays/);assert.match(calls[0].prompt,/never state amounts or prices/);
});

const threeOptions=[{destination:'Lisbon, Portugal',reason:'Sunny hillside city with sea views.'},{destination:'Kotor, Montenegro',reason:'Terraced old town above a bay.'},{destination:'Oaxaca, Mexico',reason:'Markets and mountain light.'}];
const vibeOptions=(calls,list=threeOptions)=>async args=>{calls.push(args);return {options:list};};
test('vibe options need three distinct valid places with reasons',()=>{
 assert.deepEqual(vibeOptionsFrom({options:threeOptions}),threeOptions);
 assert.equal(vibeOptionsFrom({options:threeOptions.slice(0,2)}),null);
 assert.equal(vibeOptionsFrom({options:[threeOptions[0],threeOptions[0],threeOptions[1]]}),null);
 assert.equal(vibeOptionsFrom({options:[threeOptions[0],{destination:'Bali, Indonesia',reason:''},threeOptions[1]]}),null);
 assert.equal(vibeOptionsFrom({options:[threeOptions[0],{destination:'Bali, Indonesia',reason:'Costs $200 a night.'},threeOptions[1]]}),null);
 assert.equal(vibeOptionsFrom({options:[threeOptions[0],threeOptions[1],threeOptions[2]]},['oaxaca, mexico']),null);
 assert.equal(vibeOptionsFrom(null),null);
 assert.equal(vibeOptionsFrom({options:[{destination:'Bali, Indonesia',reason:'Rice terraces.'},...threeOptions]}).length,3);
});
test('the option reply accepts the place name or its number only while options are open',()=>{
 assert.equal(vibeOptionIndex('kotor, montenegro',threeOptions),1);
 assert.equal(vibeOptionIndex('option 2: kotor, montenegro',threeOptions),1);
 assert.equal(vibeOptionIndex('option 3',threeOptions),2);
 assert.equal(vibeOptionIndex('2',threeOptions),1);
 assert.equal(vibeOptionIndex('4',threeOptions),-1);
 assert.equal(vibeOptionIndex('kotor',threeOptions),-1);
 assert.equal(vibeOptionIndex('2',undefined),-1);
});
test('vibe match offers three places, the traveler picks one, and only that place is planned',async t=>{
 const calls=[],picks=[],research0=[];const {request,db}=await startApp(t,options({reelInterpret:async text=>({fields:text.startsWith('https:')?{days:2,travelers:2,unknownPlace:true,vibe:'terraced coast'}:{},edit:false}),reelPickVibeOptions:vibeOptions(picks),reelPickVibe:async()=>{throw new Error('single pick should not run');},reelResearch:async i=>{calls.push(i);return research(research0,'Kotor')(i);},researchLink:async({url})=>({url,extracted:true,title:'Coastal cafe',places:[],sources:[{url}]})}));
 const a=await signUp(request,'Customer');const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'choice',message},{cookie:a.cookie});
 let r=await send('https://instagram.com/reel/x I do not know where this is');r=await send('Generate itinerary');
 assert.equal(r.status,200);assert.equal(r.result.draft,undefined);assert.deepEqual(r.result.suggestions,['Option 1: Lisbon, Portugal','Option 2: Kotor, Montenegro','Option 3: Oaxaca, Mexico','Show other options']);
 assert.match(r.result.text,/1\. \*\*Lisbon, Portugal\*\*: Sunny hillside/);assert.match(r.result.text,/Show other options/);
 assert.equal(calls.length,0);assert.equal((await request('/api/friday/drafts','GET',undefined,{cookie:a.cookie})).result.drafts.length,0);
 r=await send('Option 2: Kotor, Montenegro');
 assert.equal(r.result.draft.destination,'Kotor, Montenegro');assert.equal(r.result.draft.inspiredBy.mode,'vibe');assert.equal(r.result.draft.inspiredBy.reason,'Terraced old town above a bay.');
 assert.equal(calls.length,1);assert.equal(calls[0].trip.destination,'Kotor, Montenegro');assert.equal(picks.length,1);
 const events=(await db.query('SELECT event,option_index FROM vibe_match_events ORDER BY id')).rows;
 assert.deepEqual(events.map(e=>[e.event,e.option_index]),[['options_shown',null],['option_picked',2],['plan_created',2]]);
 assert.equal(JSON.stringify(events).includes('choice'),false);
});
test('show other options offers new places and never repeats the ones already shown',async t=>{
 const picks=[];const second=[{destination:'Porto, Portugal',reason:'Riverside old town.'},{destination:'Hoi An, Vietnam',reason:'Lantern-lit lanes.'},{destination:'Valparaiso, Chile',reason:'Painted hills above the sea.'}];
 let round=0;const {request,db}=await startApp(t,options({reelInterpret:async text=>({fields:text.startsWith('https:')?{days:2,travelers:2,unknownPlace:true,vibe:'coast'}:{},edit:false}),reelPickVibeOptions:async args=>{picks.push(args);return {options:round++===0?threeOptions:second};},reelPickVibe:async()=>{throw new Error('unused');},researchLink:async({url})=>({url,extracted:true,title:'Coast',places:[],sources:[{url}]})}));
 const a=await signUp(request,'Customer');const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'more',message},{cookie:a.cookie});
 await send('https://instagram.com/reel/y I do not know where this is');await send('Generate itinerary');
 const r=await send('Show other options');assert.deepEqual(r.result.suggestions,['Option 1: Porto, Portugal','Option 2: Hoi An, Vietnam','Option 3: Valparaiso, Chile','Show other options']);
 assert.deepEqual(picks[1].exclude,['Lisbon, Portugal','Kotor, Montenegro','Oaxaca, Mexico']);
 const events=(await db.query("SELECT event FROM vibe_match_events WHERE event='more_options'")).rows;assert.equal(events.length,1);
});
test('fewer than three valid options or a provider failure falls back to the single place pick',async t=>{
 for(const picker of [async()=>({options:threeOptions.slice(0,2)}),async()=>{throw Object.assign(new Error('down'),{status:502});}]){
  const singles=[];const {request,db}=await startApp(t,options({reelInterpret:async text=>({fields:text.startsWith('https:')?{days:2,travelers:2,unknownPlace:true,vibe:'coast'}:{},edit:false}),reelPickVibeOptions:picker,reelPickVibe:async i=>{singles.push(i);return {destination:'Lisbon, Portugal',reason:'Similar feel.'};},researchLink:async({url})=>({url,extracted:true,title:'Coast',places:[],sources:[{url}]})}));
  const a=await signUp(request,'Customer');const send=message=>request('/api/friday/reel-chat','POST',{conversationId:'fallback',message},{cookie:a.cookie});
  await send('https://instagram.com/reel/z I do not know where this is');const r=await send('Generate itinerary');
  assert.equal(r.result.draft.destination,'Lisbon, Portugal');assert.equal(singles.length,1);
  const events=(await db.query('SELECT event,option_index FROM vibe_match_events ORDER BY id')).rows;assert.deepEqual(events.map(e=>e.event),['plan_created']);assert.equal(events[0].option_index,null);
 }
});
