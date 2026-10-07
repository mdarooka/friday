import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../assets/js/trip-backend.js',import.meta.url),'utf8');
function makeBridge({owner='owner-a',initial=[],legacy='untouched legacy draft',failCaps=false,hexclave=false,location={protocol:'http:',href:'http://friday.test/trip.html',origin:'http://friday.test'}}={}){
  let user={id:owner,email:owner+'@example.com',name:owner,profile:{city:'Kyoto',airports:['KIX'],onboarded:true}},state={},listener,persist=false,jobDone=false,jobResult={text:'Researched answer',sources:[],days:[],places:[],questions:[]},guestStorageUsed=false;
  const records=new Map();let serial=0;for(const [kind,items] of Object.entries(initial)){const map=new Map();for(const item of items)map.set(item.id,{...item});records.set(kind,map);}
  const removed=[];const calls=[];const profiles=[];const ft={DESTINATIONS:{kyoto:{id:'kyoto',name:'Kyoto',places:{}}}};
  ft.dest=id=>ft.DESTINATIONS[id]||null;ft.place=(dest,id)=>ft.dest(dest)?.places?.[id]||null;
  ft.store={get:()=>state,setPersistence:v=>{persist=v;},useGuestStorage:()=>{guestStorageUsed=true;},replaceState:next=>{state=JSON.parse(JSON.stringify(next));},on:(name,fn)=>{listener=fn;return ()=>{listener=null;};},emit:(name,payload)=>listener&&listener(payload)};
  const storage={getItem:()=>legacy,removeItem:()=>removed.push(true)};
  async function fetch(url,options={}){
    const path=new URL(url,'http://friday.test').pathname,method=options.method||'GET',body=options.body?JSON.parse(options.body):{},headers=options.headers||{};calls.push({path,method,body,auth:typeof headers.get==='function'?headers.get('Authorization'):headers.Authorization});
    let result={},status=200;
    if(path==='/api/capabilities'){
      if(failCaps)throw new Error('Failed to fetch');
      result=hexclave?{research:true,places:true,authRequired:true,authProvider:'hexclave',authConfigured:true,hexclaveProjectId:'project-test'}:{research:true,places:true};
    }
    else if(path==='/api/auth/me')result={user};
    else if(path==='/api/profile'&&method==='PATCH'){Object.assign(user.profile,body);profiles.push({...body});result={user};}
    else if(path==='/api/auth/logout'){user=null;result={ok:true};}
    else if(path==='/api/research'&&method==='POST')result={job:{id:'job-1',status:'running'}};
    else if(path==='/api/research/job-1')result={job:{id:'job-1',status:jobDone?'completed':'running',stage:jobDone?'Research complete':'Checking sources',result:jobResult}};
    else if(path==='/api/trips/uuid-1'&&method==='GET')result={record:records.get('trips').get('uuid-1')};
    else {
      const match=path.match(/^\/api\/(trips|places|lists|bookings|memories|alerts|imports)(?:\/([^/]+))?$/);
      if(match){const [,kind,id]=match;let map=records.get(kind);if(!map){map=new Map();records.set(kind,map);}
        if(method==='GET'&&!id)result={records:[...map.values()]};
        else if(method==='POST'){const record={id:'uuid-new-'+(++serial),kind,data:body.data,version:1,updated:'now'};map.set(record.id,record);result={record};status=201;}
        else if(method==='PUT'){const old=map.get(id);if(!old){status=404;result={error:'missing'};}else{const record={...old,data:body.data,version:old.version+1};map.set(id,record);result={record};}}
        else if(method==='DELETE'){map.delete(id);result={ok:true};}
        else if(method==='GET'&&id){const record=map.get(id);if(record)result={record};else{status=404;result={error:'missing'};}}
      } else {status=404;result={error:'missing'};}
    }
    return {ok:status>=200&&status<300,status,json:async()=>result};
  }
  class HexclaveClientApp{getAuthorizationHeader(){return 'Bearer live-hexclave-session';}}
  const window={FakeHexclaveClientApp:HexclaveClientApp};const ctx={window,location,localStorage:storage,Map,Set,URL,Headers,Request,Date,Math,JSON,setTimeout,clearTimeout,console};Object.defineProperty(ctx,'fetch',{get(){return window.fetch;},set(value){window.fetch=value;}});window.fetch=fetch;ctx.window.FridayTrip=ft;ctx.window.addEventListener=()=>{};
  const testSource=source.replace("import('https://esm.sh/@hexclave/js@1.0.125')",'Promise.resolve({HexclaveClientApp:window.FakeHexclaveClientApp})');
  vm.runInNewContext(testSource,ctx);
  return {backend:ft.backend,ft,ctx,get state(){return state;},records,calls,profiles,removed,get persistence(){return persist;},setJobDone(v){jobDone=v;},get guestStorageUsed(){return guestStorageUsed;}};
}

test('bridge leaves legacy browser draft untouched, hydrates owner data, and saves airport removals',async()=>{
  const trip={id:'client-trip',title:'Kyoto',destId:'kyoto',prefs:{dates:{start:'2026-11-01'}},plan:{days:[],stay:null},threads:[{id:'thread',messages:[]}],versions:[]};
  const fixture=makeBridge({initial:{trips:[{id:'uuid-1',kind:'trips',version:1,data:{title:'Kyoto',days:[],messages:[],claudeState:trip}}]}});
  const init=await fixture.backend.init();assert.equal(init.user.id,'owner-a');assert.equal(fixture.state.trips[0].id,'client-trip');assert.equal(fixture.state.trips[0].serverId,'uuid-1');assert.equal(fixture.persistence,false);assert.deepEqual(fixture.removed,[]);
  await fixture.backend.saveProfile({city:'Kyoto',airports:[]});assert.deepEqual(fixture.profiles.at(-1),{city:'Kyoto',airports:[]});
  assert.equal(fixture.calls.some(x=>x.method==='POST'&&x.path==='/api/trips'),false);
});

test('concurrent bridge syncs create one owner-scoped record and persist deletions',async()=>{
  const fixture=makeBridge();await fixture.backend.init();
  const trip={id:'local-new',title:'Osaka',destId:'kyoto',plan:{days:[],stay:null},threads:[],prefs:{},versions:[]};fixture.state.trips.push(trip);
  await Promise.all([fixture.backend.sync(),fixture.backend.sync()]);
  assert.equal(fixture.calls.filter(x=>x.path==='/api/trips'&&x.method==='POST').length,1);assert.ok(trip.serverId);
  fixture.state.trips=[];await fixture.backend.sync();assert.equal(fixture.records.get('trips').has(trip.serverId),false);
});

test('Gmail booking hydration preserves date review evidence and trip attachment payloads',async()=>{
  const trip={id:'client-trip',serverId:'trip-server',title:'Japan',destId:'kyoto',prefs:{},plan:{days:[],stay:null},threads:[],versions:[]};
  const booking={id:'booking-server',kind:'bookings',version:1,data:{title:'Flight confirmation',type:'flight',source:'google-gmail',externalId:'gmail-msg-1',start:'',end:'',dateStatus:'needs-clarification',confirmationDate:'2026-10-05',sourceEvidence:'Booking reference AB3',sourceUrl:'https://mail.google.com/mail/u/0/#all/gmail-msg-1'}};
  const fixture=makeBridge({initial:{trips:[{id:'trip-server',kind:'trips',version:1,data:{title:'Japan',claudeState:trip}}],bookings:[booking]}});
  await fixture.backend.init();
  const hydrated=fixture.state.bookings[0];
  assert.equal(hydrated.dateStatus,'needs-clarification');assert.equal(hydrated.sourceEvidence,'Booking reference AB3');
  hydrated.tripId='client-trip';await fixture.backend.sync();
  const written=fixture.records.get('bookings').get('booking-server').data;
  assert.equal(written.source,'google-gmail');assert.equal(written.externalId,'gmail-msg-1');
  assert.equal(written.dateStatus,'needs-clarification');assert.equal(written.sourceEvidence,'Booking reference AB3');
  assert.equal(written.tripId,'trip-server');
});

test('late research completion keeps manual trip edits and advances only the backend version cache',async()=>{
  const trip={id:'client-trip',title:'Kyoto',destId:'kyoto',prefs:{},plan:{days:[],stay:null},threads:[],versions:[]};
  const record={id:'uuid-1',kind:'trips',version:1,data:{title:'Kyoto',days:[],messages:[],claudeState:trip},updated:'now'};
  const fixture=makeBridge({initial:{trips:[record]}});await fixture.backend.init();
  const progress=[];const pending=fixture.backend.research('client-trip','Find quiet gardens','deep',undefined,s=>progress.push(s));
  await new Promise(resolve=>setTimeout(resolve,0));fixture.state.trips[0].title='My manual title';fixture.setJobDone(true);
  const result=await pending;assert.equal(result.text,'Researched answer');assert.equal(fixture.state.trips[0].title,'My manual title');assert.deepEqual(progress,['Checking sources','Research complete']);
});

test('reload rebuilds a reviewable Claude draft and keeps persisted research visible',async()=>{
  const trip={id:'client-trip',title:'Kyoto',destName:'Kyoto',destId:'research-kyoto',prefs:{},plan:{days:[],stay:null},threads:[{id:'thread',messages:[{id:'answer',role:'assistant',done:true,blocks:[{t:'text',text:'A quiet garden.'}]}]}],versions:[]};
  const record={id:'uuid-1',kind:'trips',version:2,data:{title:'Kyoto',destination:'Kyoto',days:[],messages:[{role:'assistant',text:'A quiet garden.',sources:[{title:'Guide',url:'https://example.com'}],places:[{title:'Garden',description:'Quiet grounds',url:'https://example.com/garden'}]}],researchDraft:{jobId:'job',days:[{title:'Day one',date:'2026-11-01',items:[{title:'Garden',notes:'Go early'}]}]},claudeState:trip},updated:'now'};
  const fixture=makeBridge({initial:{trips:[record]}});await fixture.backend.init();
  const hydrated=fixture.state.trips[0];assert.equal(hydrated.threads[0].messages.length,1);assert.match(hydrated.threads[0].messages[0].blocks[0].text,/A quiet garden/);
  assert.ok(hydrated.researchDraft);assert.equal(hydrated.researchDraft.plan.days[0].town,'Day one');
  assert.ok(hydrated.researchDraft.catalog.areas.every(area=>!Object.hasOwn(area,'at')));
  const garden=Object.values(fixture.ft.DESTINATIONS['research-kyoto'].places).find(p=>p.name==='Garden');assert.ok(garden);assert.equal(garden.url,'https://example.com/garden');
});

test('saved Google places keep the provider ID and photo attribution metadata',async()=>{
  const fixture=makeBridge();await fixture.backend.init();
  const photo={url:'/api/place-photo/Abcdef/abcdefgh?sig=signed',placeId:'Abcdef',photoReference:'abcdefgh',attribution:'Photographer'};
  const saved=await fixture.backend.savePlace({id:'Abcdef',googlePlaceId:'Abcdef',title:'Garden',city:'Kyoto',photos:[photo],rating:4.8});
  const record=fixture.records.get('places').get(saved.serverId);
  assert.equal(record.data.googlePlaceId,'Abcdef');assert.equal(record.data.photos[0].photoReference,'abcdefgh');assert.equal(record.data.photos[0].attribution,'Photographer');
  await fixture.backend.load();const hydrated=fixture.state.saved[0];assert.equal(hydrated.googlePlaceId,'Abcdef');
  const place=fixture.ft.DESTINATIONS[hydrated.destId].places[hydrated.placeId];assert.equal(place.googlePlaceId,'Abcdef');
});

test('villa-origin trip sync stores Google Place IDs without runtime Google content',async()=>{
  const fixture=makeBridge();await fixture.backend.init();
  const villaId='villa-public-1',destId='villa-'+villaId,googleId='ChIJ123456789',ref='vg-'+googleId;
  fixture.ft.DESTINATIONS[destId]={id:destId,name:'Coast',places:{
    'villa-base':{id:'villa-base',name:'Owner villa',kind:'stay',address:'Owner supplied address',url:'https://maps.google.com/owner-pin',at:[72,19]},
    [ref]:{id:ref,provider:'google',googlePlaceId:googleId,name:'Secret Google Place Name',address:'Google result address',url:'https://google.example/result',at:[72.1,19.1],blurb:'Google content',rating:4.9}
  }};
  const trip={id:'villa-trip',title:'Owner villa · Coast',destId,destName:'Coast',plan:{stay:'villa-base',days:[{id:'day',town:'Coast',items:[{id:'stop',place:ref,time:'',note:''}]}]},villaOrigin:{villaId,name:'Owner villa',city:'Coast',address:'Owner supplied address',lat:19,lng:72,googleMapsUrl:'https://maps.google.com/owner-pin',placeRefs:[{id:ref,source:'google',googlePlaceId:googleId}]},threads:[],prefs:{},versions:[]};
  fixture.state.trips.push(trip);await fixture.backend.sync();
  const record=fixture.records.get('trips').get(trip.serverId),wire=JSON.stringify(record.data);
  assert.equal(record.data.days[0].items[0].googlePlaceId,googleId);assert.equal(record.data.days[0].items[0].title,'Nearby place');
  assert.equal(wire.includes('Secret Google Place Name'),false);assert.equal(wire.includes('Google result address'),false);assert.equal(wire.includes('google.example/result'),false);assert.equal(wire.includes('72.1'),false);
  assert.equal(wire.includes('Owner supplied address'),true);assert.equal(wire.includes('maps.google.com/owner-pin'),true);
});

test('fare watches and explicit memory edits round-trip through owner records',async()=>{
  const fixture=makeBridge();await fixture.backend.init();
  const watch={id:'fw_test',kind:'fare-watch',title:'SFO → Tokyo',origin:'SFO',destination:'Tokyo',departDate:'2026-11-01',returnDate:'',currency:'USD',targetPrice:900,at:'2026-10-01T12:00:00Z',done:false,text:'Advisory only'};
  const memory={id:'mem_test',text:'Prefers quiet gardens',city:'Kyoto',at:'2026-10-01T12:00:00Z'};
  fixture.state.notifications.push(watch);fixture.state.memory.push(memory);await fixture.backend.sync();
  const alertRecord=fixture.records.get('alerts').get(watch.serverId);assert.equal(alertRecord.data.kind,'fare-watch');assert.equal(alertRecord.data.targetPrice,900);
  const memoryRecord=fixture.records.get('memories').get(memory.serverId);assert.equal(memoryRecord.data.text,'Prefers quiet gardens');
  await fixture.backend.load();assert.equal(fixture.state.notifications.find(x=>x.id==='fw_test').origin,'SFO');assert.equal(fixture.state.memory.find(x=>x.id==='mem_test').city,'Kyoto');
  fixture.state.memory[0].text='Prefers slow mornings';await fixture.backend.sync();assert.equal(fixture.records.get('memories').get(memory.serverId).data.claudeState.text,'Prefers slow mornings');
  fixture.state.notifications=[];fixture.state.memory=[];await fixture.backend.sync();assert.equal(fixture.records.get('alerts').has(watch.serverId),false);assert.equal(fixture.records.get('memories').has(memory.serverId),false);
});

test('bridge fails closed when capabilities are unavailable and keeps browser drafts untouched',async()=>{
  const fixture=makeBridge({failCaps:true});
  await assert.rejects(fixture.backend.init(),/secure sign-in service|not configured/);
  assert.equal(fixture.backend.capabilities.authRequired,true);
  assert.equal(fixture.guestStorageUsed,false);
  assert.deepEqual(fixture.removed,[]);
});

test('bridge detects file protocol and uses guest storage directly without network',async()=>{
  const fixture=makeBridge({failCaps:true,location:{protocol:'file:'}});
  const init=await fixture.backend.init();
  assert.equal(init.user,null);
  assert.equal(init.capabilities.authRequired,false);
  assert.equal(fixture.guestStorageUsed,true);
  assert.equal(fixture.calls.some(x=>x.path==='/api/capabilities'),false);
});

test('Hexclave session header is added to direct same-origin planner fetches',async()=>{
  const fixture=makeBridge({hexclave:true});
  const init=await fixture.backend.init();assert.equal(init.capabilities.authProvider,'hexclave');
  await fixture.ctx.window.fetch('/api/itineraries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:'goa',days:1})});
  const planner=fixture.calls.find(x=>x.path==='/api/itineraries'&&x.method==='POST');
  assert.ok(planner);
  assert.equal(planner.auth,'Bearer live-hexclave-session');
});
