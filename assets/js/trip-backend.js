/* Friday account and persistence bridge. Loaded after trip-app.js, before DOM ready. */
(function () {
  'use strict';
  var FT=window.FridayTrip=window.FridayTrip||{};
  var state=null,user=null,capabilities={},authState={},hexclaveApp=null,hexclaveLoad=null,initializationError=null,records={trips:new Map(),places:new Map(),lists:new Map(),bookings:new Map(),memories:new Map(),alerts:new Map(),imports:new Map()},queue=Promise.resolve(),timer=null,ready=false,unsubscribe=null,pending=new Map(),syntheticCatalogKeys=new Set(),lastProfile='';
  function authorizationHeader(){
    /* getAuthorizationHeader() ignores restricted (unverified-email) users; resolve the user explicitly so they stay signed in for the verification screen. */
    if(typeof hexclaveApp.getUser!=='function')return Promise.resolve(hexclaveApp.getAuthorizationHeader());
    return Promise.resolve(hexclaveApp.getUser({includeRestricted:true})).then(function(u){return u&&typeof u.getAuthorizationHeader==='function'?u.getAuthorizationHeader():null;});
  }
  function installAuthorizedFetch(){
    if(typeof window==='undefined'||typeof window.fetch!=='function'||window.fetch.__fridayHexclave)return;
    var original=window.fetch.bind(window);
    var wrapped=function(input,init){
      var url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch(e){return original(input,init);}
      if(!hexclaveApp||url.origin!==location.origin)return original(input,init);
      return authorizationHeader().then(function(value){
        if(!value)return original(input,init);
        var headers=new Headers(init&&init.headers||(typeof Request!=='undefined'&&input instanceof Request?input.headers:undefined));
        if(!headers.has('Authorization'))headers.set('Authorization',value);
        return original(input,Object.assign({},init||{},{headers:headers}));
      });
    };
    wrapped.__fridayHexclave=true;window.fetch=wrapped;
  }
  function setupHexclave(projectId){
    if(hexclaveApp)return Promise.resolve(hexclaveApp);
    if(hexclaveLoad)return hexclaveLoad;
    if(!projectId)return Promise.reject(new Error('Friday account sign-in is not configured yet.'));
    hexclaveLoad=import('https://esm.sh/@hexclave/js@1.0.125').then(function(mod){
      var returnPath=/(?:^|\/)trip-briefing\.html$/.test(location.pathname||'')?location.pathname+location.search:'/trip.html';
      hexclaveApp=new mod.HexclaveClientApp({projectId:projectId,tokenStore:'cookie',devTool:false,urls:{default:{type:'hosted'},afterSignIn:returnPath,afterSignUp:returnPath,afterSignOut:'/trip.html'}});
      installAuthorizedFetch();return hexclaveApp;
    }).catch(function(error){hexclaveLoad=null;throw new Error('Friday could not load its secure sign-in service. Check your connection and try again.');});
    return hexclaveLoad;
  }
  if(typeof window!=='undefined')installAuthorizedFetch();
  var names={trips:'trips',places:'saved',lists:'lists',bookings:'bookings',memories:'memory',alerts:'notifications',imports:'imports'};
  function request(path,method,data){
    try {
      if(typeof fetch!=='function')return Promise.reject(new Error('Network unavailable'));
      var options={method:method||'GET',credentials:'same-origin',headers:{'Accept':'application/json'}};
      if(data!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}
      return fetch(path,options).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw Object.assign(new Error(j.error||'Friday could not complete that request.'),{status:r.status});return j;});});
    }catch(err){
      return Promise.reject(err);
    }
  }
  function logConversation(event){var ownerId=event&&event.ownerId||user&&user.id||capabilities.auditOwnerId;return request('/api/ai-conversations/events','POST',Object.assign({},event,{ownerId:ownerId}));}
  function blank(){return {v:1,trips:[],currentTripId:null,prefs:{homeCity:'',airports:[],airlines:'',hotels:'',hotelBudget:'',business:'',other:''},memory:[],saved:[],lists:[],imports:[],bookings:[],notifications:[],dismissed:{prefsCard:false,studioCard:false},sideCollapsed:false};}
  function install(next){
    if(FT.store&&FT.store.replaceState)FT.store.replaceState(next,{persist:false});
    state=FT.store&&FT.store.get?FT.store.get():next;
  }
  function titleOf(x){return x&&String(x.title||x.name||x.text||x.label||'Saved item').slice(0,200);}
  function msgText(m){
    if(typeof m.text==='string')return m.text;
    var blocks=Array.isArray(m.blocks)?m.blocks:[];
    return blocks.map(function(b){return typeof b==='string'?b:(b&&typeof b.text==='string'?b.text:'');}).filter(Boolean).join('\n').slice(0,12000);
  }
  function normalizedTrip(t){
    var d=FT.dest&&FT.dest(t.destId),villaRefs=t.villaOrigin&&Array.isArray(t.villaOrigin.placeRefs)?t.villaOrigin.placeRefs:[],days=(t.plan&&Array.isArray(t.plan.days)?t.plan.days:[]).map(function(day){return {title:day.title||day.town||day.area||'Day',date:day.date||'',notes:day.notes||'',items:(day.items||[]).map(function(it){var p=FT.place&&FT.place(t.destId,it.place),ref=villaRefs.filter(function(x){return x.id===it.place;})[0];if(ref&&ref.source==='google')return {title:'Nearby place',googlePlaceId:ref.googlePlaceId,source:'google-place',time:it.time||''};var at=p&&Array.isArray(p.at)&&isFinite(p.at[0])&&isFinite(p.at[1])?{lat:p.at[1],lng:p.at[0]}:{};return Object.assign({title:(p&&p.name)||it.title||it.place||'Place',time:it.time||'',notes:it.note||it.notes||'',address:p&&p.address||'',url:p&&p.url||''},at);})};});
    var messages=[];(t.threads||[]).forEach(function(th){(th.messages||[]).forEach(function(m){var text=msgText(m);if(text&&['user','assistant'].indexOf(m.role)>=0)messages.push({role:m.role,text:text});});});
    var range=t.prefs&&t.prefs.dates||{};
    var stayPlace=t.plan&&t.plan.stay&&FT.place?FT.place(t.destId,t.plan.stay):null;
    var stay=stayPlace?{name:stayPlace.name||stayPlace.title||'',address:stayPlace.address||'',start:range.start||'',end:range.end||''}:null;
    return {title:titleOf(t),destination:d&&d.name||t.destName||t.destination||'',startDate:range.start||'',endDate:range.end||'',days:days,stay:stay,messages:messages,archived:!!t.archived,claudeState:t};
  }
  function payload(kind,item){
    var data={title:titleOf(item),claudeState:item};
    if(kind==='trips')data=normalizedTrip(item);
    if(kind==='places')['name','city','url','sourceUrl','notes','address','openingHours','rating','reviews','photos','phone','price','category','listId','tripId','googlePlaceId'].forEach(function(k){if(item[k]!==undefined)data[k]=item[k];});
    if(kind==='alerts')['kind','origin','destination','departDate','returnDate','currency','targetPrice','at','done','text','tripId'].forEach(function(k){if(item[k]!==undefined)data[k]=item[k];});
    if(kind==='memories')['text','city','date','at'].forEach(function(k){if(item[k]!==undefined)data[k]=item[k];});
    if(kind==='imports')['url','note','summary','sourceUrl','createdAt'].forEach(function(k){if(item[k]!==undefined)data[k]=item[k];});
    if(kind==='bookings'&&item.tripId){var trip=state.trips.find(function(t){return t.id===item.tripId;});if(trip)data.tripId=trip.serverId||trip.id;}
    if(kind==='bookings')['type','source','externalId','sourceUrl','start','end','date','dateStatus','confirmationDate','sourceEvidence','sender','location','notes','ref','price','currency'].forEach(function(k){if(item[k]!==undefined)data[k]=item[k];});
    return data;
  }
  function savedCatalog(record,item){
    if(!FT.DESTINATIONS)return item;
    var data=record.data||{},destId=item.destId||('saved-city-'+String(data.city||'elsewhere').toLowerCase().replace(/[^a-z0-9]+/g,'-')),placeId=item.placeId||('saved-place-'+record.id);
    var city=String(data.city||'Saved places'),dest=FT.DESTINATIONS[destId]||(FT.DESTINATIONS[destId]={id:destId,name:city,places:{}});if(destId.indexOf('saved-city-')===0)syntheticCatalogKeys.add(destId);dest.places=dest.places||{};
    if(!dest.places[placeId])dest.places[placeId]={id:placeId,name:String(data.title||item.name||'Saved place'),label:String(data.category||''),kind:String(data.category||''),blurb:String(data.notes||data.description||''),address:String(data.address||''),url:String(data.url||data.sourceUrl||''),sourceUrl:data.sourceUrl||'',googlePlaceId:data.googlePlaceId||'',photos:Array.isArray(data.photos)?data.photos:[],rating:data.rating,openingHours:data.openingHours,reviews:data.reviews};
    if(data.googlePlaceId)item.googlePlaceId=data.googlePlaceId;
    item.destId=destId;item.placeId=placeId;item.name=dest.places[placeId].name;item.title=item.name;item.city=city;item.url=dest.places[placeId].url;item.notes=dest.places[placeId].blurb;
    return item;
  }
  function recoverDraft(item,raw,messages){
    if(!raw||!Array.isArray(raw.days)||item.researchDraft)return;
    var slug=String(item.destName||raw.destination||item.title||'journey').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'journey';
    var destId=item.destId||('research-'+slug),dest=FT.dest&&FT.dest(destId);dest=dest?JSON.parse(JSON.stringify(dest)):{id:destId,name:item.destName||raw.destination||item.title||'Your destination',tripTitle:item.title,threadTitle:'Research notes',areas:[],places:{}};
    dest.id=destId;dest.places=dest.places||{};dest.areas=dest.areas||[];
    (messages||[]).flatMap(function(m){return m.places||[];}).forEach(function(p){var name=p.title||p.name;if(!name)return;var pid=p.id||('research-'+String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));dest.places[pid]={id:pid,name:name,kind:p.category||'sight',label:p.category||'Place',area:'research',address:p.address||'',url:p.url||'',sourceUrl:p.sourceUrl||'',blurb:p.description||p.notes||'',photos:p.photos||[],rating:p.rating,reviews:p.reviews,openingHours:p.openingHours||''};});
    if(!dest.areas.length)dest.areas.push({id:'research',name:dest.name,town:dest.name});
    var plan={days:raw.days.map(function(day,i){var area=day.area||'research';if(!dest.areas.some(function(a){return a.id===area;}))dest.areas.push({id:area,name:day.town||day.title||dest.name,town:day.town||day.title||dest.name});return {id:'server-draft-day-'+i,area:area,town:day.town||day.title||dest.name,date:day.date||null,items:(day.items||[]).map(function(it,j){var name=typeof it==='string'?it:(it.title||it.name||it.place||'Stop'),pid=Object.keys(dest.places).find(function(k){return dest.places[k].name===name;})||null;return {id:'server-draft-item-'+i+'-'+j,place:pid,name:pid?undefined:name,time:typeof it==='object'?(it.time||''):'',note:typeof it==='object'?(it.notes||it.description||it.note||''):''};})};})};
    if(FT.DESTINATIONS)FT.DESTINATIONS[destId]=dest;if(destId.indexOf('research-')===0)syntheticCatalogKeys.add(destId);
    item.researchDraft={destId:destId,catalog:dest,plan:plan,basePlan:item.plan||null,createdAt:new Date().toISOString()};
  }
  function hydrateRecord(kind,record){
    records[kind].set(record.id,record);
    var original=record.data&&record.data.claudeState||{};
    var item=JSON.parse(JSON.stringify(original));item.id=original.id||record.id;item.serverId=record.id;
    if(kind==='places'){
      if(!Object.keys(original).length){item={id:record.id,serverId:record.id,listId:record.data.listId||'',city:record.data.city||'',url:record.data.url||record.data.sourceUrl||'',sourceUrl:record.data.sourceUrl||'',notes:record.data.notes||'',address:record.data.address||'',openingHours:record.data.openingHours||'',rating:record.data.rating,reviews:record.data.reviews,photos:record.data.photos||[],googlePlaceId:record.data.googlePlaceId||'',name:record.data.title,title:record.data.title};}
      return savedCatalog(record,item);
    }
    if(kind==='bookings'&&!Object.keys(original).length){item={id:record.id,serverId:record.id,tripId:record.data.tripId||'',name:record.data.title||'Travel confirmation',title:record.data.title||'Travel confirmation',type:record.data.type||(record.data.source==='google-calendar'?'reservation':'other'),start:record.data.start||record.data.date||'',end:record.data.end||'',ref:record.data.reference||'',price:record.data.price??null,currency:record.data.currency||'',source:record.data.source,sourceUrl:record.data.sourceUrl||'',notes:record.data.notes||'',sender:record.data.sender||'',location:record.data.location||'',dateStatus:record.data.dateStatus||'',confirmationDate:record.data.confirmationDate||'',sourceEvidence:record.data.sourceEvidence||'',externalId:record.data.externalId||''};}
    if(kind==='bookings'){if(record.data.verification)item.verification=record.data.verification;else delete item.verification;}   // staff verification is server-owned: never trust a copy inside claudeState
    if(kind==='lists'&&!Object.keys(original).length)item={id:record.id,serverId:record.id,name:record.data.title,title:record.data.title};
    if(kind==='imports'&&!Object.keys(original).length)item={id:record.id,serverId:record.id,title:record.data.title||record.data.url||'Saved link',url:record.data.url||'',note:record.data.note||record.data.notes||'',summary:record.data.summary||'',sourceUrl:record.data.sourceUrl||'',createdAt:record.data.createdAt||record.updated};
    if(kind==='memories'&&!Object.keys(original).length)item={id:record.id,serverId:record.id,title:record.data.title||'Travel memory',text:record.data.text||record.data.notes||'',city:record.data.city||'',date:record.data.date||''};
    if(kind==='alerts'&&!Object.keys(original).length)item={id:record.id,serverId:record.id,title:record.data.title||'Travel alert',...record.data};
    if(kind==='trips'){
      item.title=record.data.title||item.title;item.archived=!!record.data.archived;
      if(!item.prefs)item.prefs={};if(!item.prefs.dates&&(record.data.startDate||record.data.endDate))item.prefs.dates={start:record.data.startDate,end:record.data.endDate};
      if(!item.plan)item.plan={days:[],stay:null};
      recoverDraft(item,record.data.researchDraft,record.data.messages);
      var catalog=item.researchDraft&&item.researchDraft.catalog||item.catalog;
      if(catalog&&catalog.id&&FT.DESTINATIONS){FT.DESTINATIONS[catalog.id]=catalog;if(catalog.id.indexOf('research-')===0)syntheticCatalogKeys.add(catalog.id);}
      // Merge server messages into a native visible thread, without replacing the user's current trip object.
      if(Array.isArray(record.data.messages)&&record.data.messages.length){item.threads=Array.isArray(item.threads)?item.threads:[];var th=item.threads.find(function(x){return x.id===item.activeThreadId;})||item.threads[0];if(!th){th={id:'server-thread',title:'Friday research',createdAt:new Date().toISOString(),messages:[]};item.threads.push(th);item.activeThreadId=th.id;}record.data.messages.forEach(function(m){var already=th.messages.some(function(x){var text=msgText(x);return x.role===m.role&&(text===m.text||(m.role==='assistant'&&text.indexOf(m.text)===0));});if(already)return;var text=m.text||'';if(m.role==='assistant'&&Array.isArray(m.sources)&&m.sources.length)text+='\n\n**Sources**\n'+m.sources.map(function(s){return '- ['+(s.title||s.url)+']('+s.url+')';}).join('\n');var blocks=text?[{id:'server-block-'+th.messages.length,t:'text',text:text,rev:1}]:[];if(m.role==='assistant'&&Array.isArray(m.places)&&m.places.length)blocks.push({id:'server-places-'+th.messages.length,t:'places',places:m.places.map(function(p){return {title:p.title||p.name||'Place',id:p.id||'',description:p.description||p.notes||'',photos:p.photos||[],category:p.category||'',address:p.address||'',url:p.url||'',sourceUrl:p.sourceUrl||'',rating:p.rating||null,reviews:p.reviews||null,openingHours:p.openingHours||''};})});th.messages.push({id:'server-message-'+th.messages.length,role:m.role,blocks:blocks,done:true,at:Date.now()});});}
      if(record.data.researchDraft&&!item.researchDraft)item.pendingResearchDraft=record.data.researchDraft;
    }
    return item;
  }
  function load(){
    ready=false;Object.keys(records).forEach(function(k){records[k].clear();});pending.clear();
    return Promise.all(Object.keys(names).map(function(kind){return request('/api/'+kind).then(function(r){return [kind,r.records||[]];});})).then(function(groups){
      var next=blank();groups.forEach(function(pair){var kind=pair[0],items=pair[1];next[names[kind]]=items.map(function(r){return hydrateRecord(kind,r);});});
      next.bookings.forEach(function(b){var trip=next.trips.find(function(t){return t.serverId===b.tripId;});if(trip)b.tripId=trip.id;});
      return request('/api/auth/me').then(function(r){var p=r.user&&r.user.profile||{};user=r.user;lastProfile=JSON.stringify(p);next.prefs=Object.assign(next.prefs,{homeCity:p.city||'',airports:p.airports||[],airlines:p.airlines||'',avoidAirlines:p.avoidAirlines||'',hotels:p.hotels||'',hotelBudget:p.budget||'',business:p.business||'',other:p.other||''});install(next);ready=true;return next;});
    });
  }
  function saveProfile(patch){
    var map={homeCity:'city',city:'city',airlines:'airlines',avoidAirlines:'avoidAirlines',hotels:'hotels',hotelBudget:'budget',budget:'budget',business:'business',other:'other',airports:'airports'};var body={};Object.keys(patch||{}).forEach(function(k){if(map[k])body[map[k]]=patch[k];});
    return request('/api/profile','PATCH',body).then(function(r){user=r.user;lastProfile=JSON.stringify(user.profile||{});return r.user;});
  }
  function syncProfile(){
    if(!state||!state.prefs)return Promise.resolve();var p=state.prefs,body={airlines:p.airlines||'',avoidAirlines:p.avoidAirlines||'',hotels:p.hotels||'',budget:p.hotelBudget||'',business:p.business||'',other:p.other||''};
    if(p.homeCity){body.city=p.homeCity;body.airports=Array.isArray(p.airports)?p.airports:[];}
    if(JSON.stringify(Object.assign({},user&&user.profile||{},body))===lastProfile)return Promise.resolve();
    return request('/api/profile','PATCH',body).then(function(r){user=r.user;lastProfile=JSON.stringify(user.profile||{});});
  }
  function syncOne(kind,item){
    var map=records[kind],serverId=item.serverId||item.id,existing=map.get(serverId),data=payload(kind,item);
    var lock=kind+':'+serverId;if(pending.has(lock))return pending.get(lock);
    var task;
    if(existing){if(JSON.stringify(existing.data)===JSON.stringify(data))return Promise.resolve();task=request('/api/'+kind+'/'+existing.id,'PUT',{version:existing.version,data:data}).then(function(r){map.set(r.record.id,r.record);item.serverId=r.record.id;});}
    else task=request('/api/'+kind,'POST',{data:data}).then(function(r){map.set(r.record.id,r.record);item.serverId=r.record.id;});
    pending.set(lock,task);return task.finally(function(){pending.delete(lock);});
  }
  function sync(){
    if(!ready||!user||!state)return Promise.resolve();
    var tasks=[syncProfile()];Object.keys(names).forEach(function(kind){var items=state[names[kind]]||[],present=new Set(items.map(function(item){return item.serverId||item.id;}));items.forEach(function(item){tasks.push(syncOne(kind,item));});records[kind].forEach(function(record,id){if(!present.has(id))tasks.push(request('/api/'+kind+'/'+id,'DELETE',{}).then(function(){records[kind].delete(id);}));});});
    return Promise.all(tasks).catch(function(e){if(FT.ui&&FT.ui.toast)FT.ui.toast(e.message);throw e;});
  }
  function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(function(){timer=null;queue=queue.then(sync).catch(function(){});},500);}
  function finishHexclaveAuth(){return hexclaveApp.getUser({includeRestricted:true}).then(function(current){return request('/api/auth/me').then(function(r){authState=r||{};user=r.user||null;if(!user){install(blank());ready=false;return null;}syntheticCatalogKeys.forEach(function(k){if(FT.DESTINATIONS)delete FT.DESTINATIONS[k];});syntheticCatalogKeys.clear();install(blank());return load().then(function(){return user;});});});}
  function auth(path,data){
    if(capabilities.authProvider==='hexclave')return setupHexclave(capabilities.hexclaveProjectId).then(function(app){
      var values=data||{},result;
      if(path==='signup')result=app.signUpWithCredential({email:String(values.email||'').trim(),password:values.password,noRedirect:true});
      else result=app.signInWithCredential({email:String(values.email||'').trim(),password:values.password,noRedirect:true});
      return Promise.resolve(result).then(function(r){if(r.status==='error')throw new Error(r.error.humanReadableMessage||'Friday could not sign you in. Please check your details.');return app.getUser({includeRestricted:true}).then(function(current){if(path==='signup'&&current&&values.name&&typeof current.setDisplayName==='function')return current.setDisplayName(String(values.name).trim()).catch(function(){}).then(function(){return finishHexclaveAuth();});return finishHexclaveAuth();});});
    });
    return request(path==='signup'?'/api/auth/signup':'/api/auth/login','POST',data).then(function(r){user=r.user;syntheticCatalogKeys.forEach(function(k){if(FT.DESTINATIONS)delete FT.DESTINATIONS[k];});syntheticCatalogKeys.clear();install(blank());return load().then(function(){return user;});});
  }
  function init(){
    initializationError=null;
    syntheticCatalogKeys.forEach(function(k){if(FT.DESTINATIONS)delete FT.DESTINATIONS[k];});syntheticCatalogKeys.clear();
    var getCaps=(typeof location!=='undefined'&&location.protocol==='file:')
      ?Promise.resolve({authRequired:false,offline:true})
      :request('/api/capabilities').catch(function(){return {authRequired:true,authProvider:'hexclave',authConfigured:false,offline:true};});
    return getCaps.then(function(r){
      capabilities=r||{authRequired:false,offline:true};
      if(capabilities.authProvider==='hexclave')return setupHexclave(capabilities.hexclaveProjectId).then(function(){
        if(FT.store&&FT.store.setPersistence)FT.store.setPersistence(false);
        ready=false;Object.keys(records).forEach(function(k){records[k].clear();});pending.clear();install(blank());
        return request('/api/auth/me').catch(function(err){if(err&&err.status===401)return {user:null};throw err;}).then(function(r){authState=r||{};user=r.user||null;return user?load():{v:1};});
      });
      if(capabilities.authRequired===false){
        user=null;
        authState={};
        if(FT.store&&FT.store.useGuestStorage)FT.store.useGuestStorage();
        state=FT.store&&FT.store.get?FT.store.get():blank();
        return {user:null};
      }
      if(FT.store&&FT.store.setPersistence)FT.store.setPersistence(false);
      ready=false;Object.keys(records).forEach(function(k){records[k].clear();});pending.clear();install(blank());
      return request('/api/auth/me').catch(function(err){
        if(err&&err.status===401)return {user:null};
        throw err;
      }).then(function(r){authState=r||{};user=r.user;return user?load():{v:1};});
    }).then(function(){
      if(user&&FT.store&&FT.store.on&&!unsubscribe)unsubscribe=FT.store.on('change',schedule);
      return {user:user,capabilities:capabilities};
    }).catch(function(error){initializationError=error;throw error;});
  }
  function research(tripId,prompt,mode,image,onProgress,conversationId,ownerId){
    var trip=state.trips.find(function(t){return t.id===tripId||t.serverId===tripId;});
    if(!trip)return Promise.reject(new Error('This journey is no longer available.'));
    return syncOne('trips',trip).then(function(){return request('/api/research','POST',{tripId:trip.serverId||trip.id,prompt:prompt,mode:mode||'deep',image:image,conversationId:conversationId,ownerId:ownerId||user&&user.id||capabilities.auditOwnerId});}).then(function(start){
      var jobId=start.job.id;
      return new Promise(function(resolve,reject){var elapsed=0,lastStage='';function poll(){request('/api/research/'+jobId).then(function(r){var j=r.job;if(!j){reject(new Error('Research job was not found.'));return;}if(j.stage&&j.stage!==lastStage){lastStage=j.stage;if(typeof onProgress==='function')onProgress(j.stage);}if(j.status==='failed'){reject(new Error(j.error||'Research could not finish.'));return;}if(j.status==='completed'){var a=j.result||{};request('/api/trips/'+(trip.serverId||trip.id)).then(function(r){records.trips.set(r.record.id,r.record);resolve({text:a.text||'',sources:a.sources||[],days:a.days||[],places:a.places||[],questions:a.questions||[],jobId:jobId});}).catch(reject);return;}elapsed+=1200;if(elapsed>240000){reject(new Error('Research is taking longer than expected. You can return to this journey and check again.'));return;}setTimeout(poll,1200);}).catch(reject);}poll();});
    });
  }
  function share(tripId){var t=state.trips.find(function(x){return x.id===tripId||x.serverId===tripId;});if(!t)return Promise.reject(new Error('Journey not found.'));return syncOne('trips',t).then(function(){return request('/api/trips/'+(t.serverId||t.id)+'/share','POST',{});}).then(function(r){return r.share;});}
  function savePlace(place){
    var item=Object.assign({id:'saved_'+Math.random().toString(36).slice(2),name:titleOf(place),title:titleOf(place),city:'',url:'',sourceUrl:'',notes:'',photos:[]},place||{});
    item.googlePlaceId=item.googlePlaceId||item.id;
    if(item.id===item.googlePlaceId)item.id='saved_'+Math.random().toString(36).slice(2);
    item.title=titleOf(item);item.name=item.title;
    savedCatalog({id:item.id,data:item},item);state.saved.push(item);
    return syncOne('places',item).then(function(){if(FT.store&&FT.store.emit)FT.store.emit('change',{tripIds:[]});return item;});
  }
  function extractPost(url,note,context){context=context||{};return request('/api/imports/extract','POST',{url:url,note:note||'',conversationId:context.conversationId,tripId:context.tripId,ownerId:context.ownerId||user&&user.id||capabilities.auditOwnerId}).then(function(r){return r.result;});}
  function placeDetails(query){return request('/api/place-details?q='+encodeURIComponent(query||''));}
  function placeDetail(placeId){return request('/api/place-details/'+encodeURIComponent(placeId));}
  function checkFareAlert(alert,context){context=context||{};return request('/api/alerts/check','POST',Object.assign({},alert||{},context,{ownerId:context.ownerId||user&&user.id||capabilities.auditOwnerId})).then(function(r){return r.result;});}
  function revokeShare(tripId){var t=state.trips.find(function(x){return x.id===tripId||x.serverId===tripId;});if(!t)return Promise.reject(new Error('Journey not found.'));return request('/api/trips/'+(t.serverId||t.id)+'/share','DELETE',{});}
  function shared(token){return request('/api/shared/'+encodeURIComponent(token));}
  FT.backend={init:init,request:request,logConversation:logConversation,signup:function(d){return auth('signup',d);},login:function(d){return auth('login',d);},forgotPassword:function(email){return setupHexclave(capabilities.hexclaveProjectId).then(function(app){return app.sendForgotPasswordEmail(String(email||'').trim());}).then(function(r){if(r.status==='error'&&r.error.errorCode!=='USER_NOT_FOUND')throw new Error(r.error.humanReadableMessage||'Friday could not send that email.');return {ok:true};});},resendVerification:function(){return setupHexclave(capabilities.hexclaveProjectId).then(function(app){return app.getUser({includeRestricted:true});}).then(function(current){if(!current)return Promise.reject(new Error('Please sign in again to resend the verification email.'));return current.sendVerificationEmail();});},linkLegacy:function(password){return request('/api/auth/link-legacy','POST',{password:password}).then(function(r){authState={};user=r.user;return load().then(function(){return user;});});},freshAccount:function(){return request('/api/auth/fresh-account','POST',{}).then(function(r){authState={};user=r.user;return load().then(function(){return user;});});},logout:function(){if(capabilities.authProvider==='hexclave')return setupHexclave(capabilities.hexclaveProjectId).then(function(app){return app.getUser({includeRestricted:true});}).then(function(current){return current?current.signOut({redirectUrl:location.href}):undefined;}).then(function(){user=null;authState={};syntheticCatalogKeys.forEach(function(k){if(FT.DESTINATIONS)delete FT.DESTINATIONS[k];});syntheticCatalogKeys.clear();install(blank());return {ok:true};});return request('/api/auth/logout','POST',{}).then(function(r){user=null;syntheticCatalogKeys.forEach(function(k){if(FT.DESTINATIONS)delete FT.DESTINATIONS[k];});syntheticCatalogKeys.clear();install(blank());return r;});},airports:function(q){return request('/api/airports?q='+encodeURIComponent(q||'')).then(function(r){return r.places||[];});},searchAirports:function(q){return request('/api/airports/search?q='+encodeURIComponent(q||'')).then(function(r){return r.airports||[];});},placeDetails:placeDetails,placeDetail:placeDetail,checkFareAlert:checkFareAlert,saveProfile:saveProfile,refresh:load,load:load,sync:sync,research:research,share:share,revokeShare:revokeShare,savePlace:savePlace,extractPost:extractPost,shared:shared,get user(){return user;},get capabilities(){return capabilities;},get authState(){return authState;},get authApp(){return hexclaveApp;},get auditOwnerId(){return user&&user.id||capabilities.auditOwnerId||null;},get initializationError(){return initializationError;}};
  FT.backend.respondShared=function(token,data){return request('/api/shared/'+encodeURIComponent(token)+'/responses','POST',data);};
  FT.backend.shareResponses=function(tripId){var t=state.trips.find(function(x){return x.id===tripId||x.serverId===tripId;});if(!t)return Promise.reject(new Error('Journey not found.'));return request('/api/trips/'+(t.serverId||t.id)+'/share/responses');};
  FT.backend.clearShareResponses=function(tripId){var t=state.trips.find(function(x){return x.id===tripId||x.serverId===tripId;});if(!t)return Promise.reject(new Error('Journey not found.'));return request('/api/trips/'+(t.serverId||t.id)+'/share/responses','DELETE',{});};
  FT.backend.dataRequests=function(){return request('/api/account/data-requests');};
  FT.backend.createDeletionRequest=function(){return request('/api/account/data-requests','POST',{});};
  FT.backend.exportData=function(){return fetch('/api/account/export',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(response){if(!response.ok)return response.json().then(function(body){throw new Error(body.error||'Could not download your data.');});return response.blob();});};
})();
