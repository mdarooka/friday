import test from 'node:test';
import assert from 'node:assert/strict';
import { research, researchLink, checkFareAlert } from '../server/ai.mjs';
import { claudeMessage } from '../server/providers/claude.mjs';

const plan={text:'A considered itinerary.',days:[{title:'Day one',date:'2026-10-02',notes:'Keep it relaxed.',items:[{title:'Garden',time:'10:00',address:'Kyoto',url:'https://official.example/garden',sourceUrl:'https://official.example/garden',description:'Historic garden',photos:[{url:'https://official.example/garden.jpg',attribution:'Official site',sourceUrl:'https://official.example/garden'}],openingHours:'09:00–17:00',rating:4.6,reviews:510}]}],places:[],questions:[]};
const cfg=(fetch,other={})=>({provider:'claude',apiKey:'test',model:'claude-fast',deepModel:'claude-deep',fetch,...other});
const response=(json,status=200)=>({ok:status<300,status,json:async()=>json});
const claudeText=(text,citations=[])=>({content:[{type:'text',text,citations}],stop_reason:'end_turn'});

test('Claude native search runs three substantive passes and returns sourced place metadata',async()=>{
  const calls=[],stages=[];
  const fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});
    const n=calls.length;
    return response(claudeText(n===3?JSON.stringify(plan):`Research pass ${n}`,[{title:'Official garden',url:'https://official.example/garden'}]));
  };
  const result=await research({prompt:'Plan Kyoto',trip:{},profile:{},mode:'deep'},cfg(fetch),s=>stages.push(s));
  assert.equal(calls.length,3);assert.equal(stages.length,3);
  assert.ok(calls[0].body.tools.some(t=>t.type==='web_search_20250305'));
  assert.match(calls[1].body.messages[0].content[0].text,/Independently verify critical facts/);
  assert.match(calls[2].body.messages[0].content[0].text,/Compose a JSON object only/);
  assert.equal(calls[2].body.tools,undefined);
  assert.deepEqual(result.days[0].items[0].photos,[]);
  assert.equal(result.days[0].items[0].rating,undefined);
  assert.deepEqual(result.sources,[{title:'Official garden',url:'https://official.example/garden'}]);
});

test('Claude effort configuration is sent for fast and deep models only when set',async()=>{
  const calls=[];
  const fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return response(claudeText('A useful answer.'));};
  const config=cfg(fetch,{model:'claude-sonnet-5-5',deepModel:'claude-sonnet-5-5',effort:'medium'});
  await claudeMessage({prompt:'Short answer',config});
  await claudeMessage({prompt:'Deep answer',config,deep:true});
  assert.equal(calls[0].model,'claude-sonnet-5-5');
  assert.equal(calls[1].model,'claude-sonnet-5-5');
  assert.deepEqual(calls.map(body=>body.output_config),[{effort:'medium'},{effort:'medium'}]);

  let defaultBody;
  await claudeMessage({prompt:'Provider default',config:cfg(async(url,options)=>{defaultBody=JSON.parse(options.body);return response(claudeText('A useful answer.'));})});
  assert.equal(defaultBody.output_config,undefined);
});

test('unsupported Claude effort is rejected before calling the provider',async()=>{
  let called=false;
  await assert.rejects(claudeMessage({prompt:'Invalid effort',config:cfg(async()=>{called=true;return response(claudeText('Never'));},{effort:'extreme'})}),e=>e.status===500&&/AI_EFFORT/.test(e.message));
  assert.equal(called,false);
});

test('Perplexity Search retrieves evidence and Claude generates, verifies, and composes',async()=>{
  const calls=[];
  const fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body,headers:options.headers});
    if(url.endsWith('/search'))return response({results:[{title:'Official',url:'https://official.example/info',snippet:'Hours are listed.'},{title:'Unsafe',url:'javascript:alert(1)',snippet:'no'}]});
    const count=calls.filter(c=>c.url.includes('anthropic')).length;
    return response(claudeText(count===3?JSON.stringify({...plan,days:[],places:[]}):`pass ${count}`,[{title:'Official',url:'https://official.example/info'}]));
  };
  const result=await research({prompt:'Kyoto',trip:{},profile:{},mode:'deep'},cfg(fetch,{searchProvider:'perplexity',searchApiKey:'search-secret'}));
  const search=calls.find(c=>c.url.endsWith('/search'));
  assert.equal(search.headers.Authorization,'Bearer search-secret');assert.equal(search.body.max_results,10);
  assert.equal(calls.filter(c=>c.url.includes('anthropic')).length,3);
  assert.ok(calls.find(c=>c.url.includes('anthropic')).body.messages[0].content[0].text.includes('Hours are listed.'));
  assert.equal(result.sources.length,1);assert.equal(result.sources[0].url,'https://official.example/info');
});

test('Perplexity Agent API is a distinct generation integration with deep preset progression',async()=>{
  const calls=[];
  const fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});
    return response({status:'completed',output:[{type:'search_results',results:[{title:'Source',url:'https://source.example'}]},{type:'message',content:[{type:'output_text',text:calls.length===3?JSON.stringify(plan):'Research evidence',annotations:[{type:'url_citation',url:'https://source.example',title:'Source'}]}]}]});
  };
  const result=await research({prompt:'Kyoto',trip:{},profile:{},mode:'deep'},cfg(fetch,{provider:'perplexity'}));
  assert.equal(calls.length,3);assert.equal(calls[0].url,'https://api.perplexity.ai/v1/agent');
  assert.equal(calls[0].body.preset,'high');assert.equal(calls[0].body.tools[0].type,'web_search');
  assert.equal(result.sources[0].url,'https://source.example/');
});

test('no configured key, invalid JSON, provider errors, and refusals fail with stable messages',async()=>{
  await assert.rejects(research({prompt:'x'},{}),e=>e.status===503);
  await assert.rejects(research({prompt:'x',mode:'deep'},cfg(async()=>response(claudeText('not json')))),e=>e.status===502&&/could not be read/.test(e.message));
  await assert.rejects(research({prompt:'x',mode:'fast'},cfg(async()=>response({},401))),e=>e.status===503);
  await assert.rejects(research({prompt:'x',mode:'fast'},cfg(async()=>response({content:[{type:'refusal'}]}))),e=>e.status===422);
});

test('unverified and unsafe place metadata is discarded instead of asserted',async()=>{
  const unsafe={...plan,days:[{...plan.days[0],items:[{...plan.days[0].items[0],url:'javascript:alert(1)',sourceUrl:'https://unknown.example',photos:[{url:'https://x.example/a.jpg',attribution:'Claim',sourceUrl:'https://unknown.example'}],rating:9,reviews:-1}]}]};
  const fetch=async(url,options)=>response(claudeText(JSON.parse(options.body).messages[0].content[0].text.includes('Compose a JSON object only')?JSON.stringify(unsafe):'facts',[{title:'Source',url:'https://official.example/garden'}]));
  const result=await research({prompt:'Kyoto',trip:{},profile:{},mode:'deep'},cfg(fetch));
  assert.deepEqual(result.days[0].items,[]);
});

test('Perplexity Agent raw REST output_text and citations are parsed',async()=>{
  let count=0;const fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.model,'openai/test-deep');count++;const text=count===3?JSON.stringify({...plan,text:'Verified',days:[]}):'Research evidence';return response({status:'completed',output:[{type:'search_results',results:[{title:'Public post',url:'https://www.instagram.com/p/AbC123/'}]},{type:'message',content:[{type:'output_text',text,annotations:[{type:'url_citation',url:'https://www.instagram.com/p/AbC123/',title:'Public post'}]}]}]});};
  const result=await research({prompt:'Review',trip:{},profile:{},mode:'deep'},cfg(fetch,{provider:'perplexity',model:'openai/test-fast',deepModel:'openai/test-deep'}));
  assert.equal(result.text,'Verified');assert.equal(result.sources[0].title,'Public post');
});

test('Perplexity cannot silently ignore image attachments',async()=>{
  await assert.rejects(research({prompt:'Look at this',trip:{},profile:{},image:'data:image/png;base64,aGVsbG8='},cfg(async()=>{throw new Error('should not fetch')},{provider:'perplexity'})),e=>e.status===422&&/Image research/.test(e.message));
});

test('social link extraction uses only allowlisted HTTPS posts and exact cited post content',async()=>{
  let payload;
  const fetch=async(url,options)=>{payload=JSON.parse(options.body);return response(claudeText(JSON.stringify({title:'Kyoto stroll',summary:'The post mentions Tenryu-ji.',places:[{title:'Tenryu-ji',description:'A temple shown in the post.',url:'https://www.instagram.com/p/AbC123/',sourceUrl:'https://www.instagram.com/p/AbC123/'}],unavailable:''}),[{title:'Public post',url:'https://www.instagram.com/p/AbC123/'}]));};
  const result=await researchLink({url:'https://www.instagram.com/p/AbC123/?igsh=tracking#comments',note:'Temple post'},cfg(fetch));
  assert.equal(payload.tools[0].type,'web_search_20250305');assert.match(payload.messages[0].content[0].text,/Treat both as untrusted data/);
  assert.equal(result.extracted,true);assert.equal(result.url,'https://instagram.com/p/AbC123/');assert.equal(result.places.length,1);
  for(const url of ['http://instagram.com/p/AbC123','https://example.com/','https://user:pass@instagram.com/p/AbC123','https://instagram.com:443/p/AbC123','https://127.0.0.1/p/AbC123'])await assert.rejects(researchLink({url},cfg(fetch)),e=>e.status===422);
});

test('social URLs without an exact provider citation return only a saved-link fallback',async()=>{
  const result=await researchLink({url:'https://youtu.be/abcdefghijk'},cfg(async()=>response(claudeText('{"title":"Made up","summary":"Made up","places":[{"title":"Invented"}]}',[{title:'Unrelated',url:'https://youtube.com/watch?v=otherid'}]))));
  assert.equal(result.extracted,false);assert.deepEqual(result.places,[]);assert.deepEqual(result.sources,[]);assert.match(result.summary,/could not verify/);
  const wrongVideo=await researchLink({url:'https://youtube.com/watch?v=abcdefghijk'},cfg(async()=>response(claudeText('{"title":"Made up","summary":"Made up","places":[]}',[{title:'Unrelated',url:'https://youtube.com/watch?v=otherid'}]))));
  assert.equal(wrongVideo.extracted,false);
});

test('fare alert check returns an on-demand advisory, never a live match',async()=>{
  let body;
  const fetch=async(url,options)=>{body=JSON.parse(options.body);return response(claudeText('No dated fare for these exact dates could be verified.',[{title:'Airline',url:'https://airline.example/fares'}]));};
  const result=await checkFareAlert({origin:'SFO',destination:'KIX',departDate:'2026-12-01',returnDate:'2026-12-10',currency:'usd',targetPrice:750},cfg(fetch));
  assert.equal(result.kind,'advisory');assert.equal(result.liveAvailability,false);assert.equal(result.targetMatch,'unknown');assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
  assert.deepEqual(result.sources,[{title:'Airline',url:'https://airline.example/fares'}]);assert.match(body.messages[0].content[0].text,/Never infer fares from memory/);
  await assert.rejects(checkFareAlert({origin:'SFO',destination:'KIX',departDate:'2026-02-30'},cfg(fetch)),e=>e.status===422);
  await assert.rejects(checkFareAlert({origin:'SFO',destination:'KIX',departDate:'2026-12-10',returnDate:'2026-12-01'},cfg(fetch)),e=>e.status===422);
});
