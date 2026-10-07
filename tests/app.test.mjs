import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.mjs';
import { vaultModeOptions } from './fake-vault.mjs';
const origin='http://localhost:4871';
async function fixture(t,options={}) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'friday-test-'));
  const server=createApp({dbPath:path.join(dir,'db.sqlite'),origin,...options,...vaultModeOptions(options)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  const request=async(url,method='GET',data,cookie='',headers={},redirect='follow')=>{
    const res=await fetch(base+url,{method,redirect,headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),Cookie:cookie,...headers},body:data?JSON.stringify(data):undefined});
    const result=(res.headers.get('content-type')||'').includes('application/json')?await res.json():await res.text();
    return {status:res.status,result,cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
  };request.dbPath=path.join(dir,'db.sqlite');return request;
}
async function signup(request,name='A') {
  const res=await request('/api/auth/signup','POST',{name,email:`${name}@example.com`,password:'long test password 123'});
  assert.equal(res.status,200);assert.match(res.cookie,/^friday_session=/);return res;
}
test('signup, airport exclusions, persistent login and logout',async t=>{
  const request=await fixture(t),a=await signup(request);
  assert.equal(a.result.user.profile.onboarded,undefined);
  const profile=await request('/api/profile','PATCH',{city:'San Francisco',airports:['SFO','SJC']},a.cookie);
  assert.equal(profile.status,200);assert.deepEqual(profile.result.user.profile.airports,['SFO','SJC']);
  assert.equal((await request('/api/profile','PATCH',{airports:['JFK']},a.cookie)).status,422);
  assert.equal((await request('/api/profile','PATCH',{airports:[]},a.cookie)).status,200);
  const me=await request('/api/auth/me','GET',undefined,a.cookie);assert.deepEqual(me.result.user.profile.airports,[]);
  await request('/api/auth/logout','POST',{},a.cookie);
  assert.equal((await request('/api/auth/me','GET',undefined,a.cookie)).result.user,null);
  assert.equal((await request('/api/auth/login','POST',{email:'A@example.com',password:'wrong password 123'})).status,401);
  const login=await request('/api/auth/login','POST',{email:'A@example.com',password:'long test password 123'});assert.equal(login.status,200);assert.deepEqual(login.result.user.profile.airports,[]);
});
test('records enforce ownership, optimistic updates and valid dates',async t=>{
  const request=await fixture(t),a=await signup(request),b=await signup(request,'B');
  const created=await request('/api/trips','POST',{data:{title:'Kyoto',days:[]}},a.cookie);assert.equal(created.status,201);
  const record=created.result.record;
  assert.equal((await request('/api/trips/'+record.id,'GET',undefined,b.cookie)).status,404);
  assert.equal((await request('/api/trips','GET',undefined,b.cookie)).result.records.length,0);
  assert.equal((await request('/api/trips/'+record.id,'DELETE',{},b.cookie)).status,404);
  const update=await request('/api/trips/'+record.id,'PUT',{version:1,data:{title:'Kyoto gardens',days:[{title:'Day one',items:[]}],archived:true}},a.cookie);assert.equal(update.status,200);assert.equal(update.result.record.version,2);assert.equal(update.result.record.data.archived,true);
  const restored=await request('/api/trips/'+record.id,'PUT',{version:2,data:{...update.result.record.data,archived:false}},a.cookie);assert.equal(restored.result.record.data.archived,false);
  assert.equal((await request('/api/trips/'+record.id,'PUT',{version:1,data:{title:'Stale'}},a.cookie)).status,409);
  assert.equal((await request('/api/trips','POST',{data:{title:'Bad dates',startDate:'2026-11-12',endDate:'2026-11-01'}},a.cookie)).status,422);
  assert.equal((await request('/api/trips','POST',{data:{title:'Impossible date',startDate:'2026-02-31'}},a.cookie)).status,422);
  assert.equal((await request('/api/trips','POST',{data:{title:'Broken day',days:[{date:'2026-02-30',title:'Day'}]}},a.cookie)).status,422);
  assert.equal((await request('/api/trips','POST',{data:{title:'Broken stop',days:[{title:'Day',items:[null]}]}},a.cookie)).status,422);
  assert.equal((await request('/api/places','POST',{data:{title:'Bad URL',url:'javascript:alert(1)'}},a.cookie)).status,422);
});
test('every private record collection enforces owner scope',async t=>{
  const request=await fixture(t),a=await signup(request,'Owner'),b=await signup(request,'Other');
  for(const kind of ['trips','places','lists','bookings','memories','alerts','imports']) {
    const created=await request('/api/'+kind,'POST',{data:{title:`Private ${kind}`}},a.cookie);
    assert.equal(created.status,201,kind);
    const id=created.result.record.id;
    assert.equal((await request('/api/'+kind+'/'+id,'GET',undefined,b.cookie)).status,404,kind);
    assert.equal((await request('/api/'+kind+'/'+id,'PUT',{version:1,data:{title:'Stolen'}},b.cookie)).status,404,kind);
    assert.equal((await request('/api/'+kind+'/'+id,'DELETE',{},b.cookie)).status,404,kind);
    assert.equal((await request('/api/'+kind,'GET',undefined,b.cookie)).result.records.length,0,kind);
  }
});
test('cross-origin writes, private source paths, and missing provider fail safely',async t=>{
  const request=await fixture(t),a=await signup(request);
  assert.equal((await request('/api/profile','PATCH',{city:'Mumbai'},a.cookie,{Origin:'https://evil.example'})).status,403);
  for(const file of ['/server/app.mjs','/.data/friday.sqlite','/build/data.js','/.env','/package.json'])assert.equal((await request(file)).status,404);
  assert.equal((await request('/app.html')).status,200);
  assert.equal((await request('/api/capabilities')).result.research,false);
  assert.equal((await request('/api/research','POST',{prompt:'Kyoto',tripId:'bad'},a.cookie)).status,503);
});
test('public guide, robots and sitemap files are served while backend source stays private',async t=>{
  const request=await fixture(t);
  const guide=await request('/kerala-guide.html');
  assert.equal(guide.status,200);assert.match(guide.headers.get('content-type'),/text\/html/);assert.match(guide.result,/Kerala Travel Guide/);
  const robots=await request('/robots.txt');
  assert.equal(robots.status,200);assert.match(robots.headers.get('content-type'),/text\/plain/);assert.match(robots.result,/Disallow: \/api\//);assert.doesNotMatch(robots.result,/Disallow: \/kerala-guide/);
  const sitemap=await request('/sitemap.xml');
  assert.equal(sitemap.status,200);assert.match(sitemap.headers.get('content-type'),/application\/xml/);assert.match(sitemap.result,/<urlset/);
});
test('Deep jobs persist progress, save drafts and do not overwrite manual edits',async t=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const request=await fixture(t,{ai:{apiKey:'test',model:'test'},research:async(input,config,progress)=>{
    assert.equal(input.mode,'deep');assert.deepEqual(input.profile.airports,['SFO']);progress('Checking route');await gate;
    return {text:'Researched plan',sources:[{title:'Official source',url:'https://example.com'}],places:[{title:'Garden museum',city:'Kyoto',url:'https://example.com/garden',notes:'Quiet collection'}],days:[{title:'Gardens',date:'',notes:'Relaxed',items:[]}],questions:[]};
  }});
  const a=await signup(request),b=await signup(request,'B');
  await request('/api/profile','PATCH',{city:'San Francisco',airports:['SFO']},a.cookie);
  const trip=(await request('/api/trips','POST',{data:{title:'Kyoto',days:[],messages:[]}},a.cookie)).result.record;
  const started=await request('/api/research','POST',{prompt:'Research Kyoto',tripId:trip.id,mode:'deep'},a.cookie);assert.equal(started.status,202);
  assert.equal((await request('/api/research/'+started.result.job.id,'GET',undefined,b.cookie)).status,404);
  assert.equal((await request('/api/research','POST',{prompt:'Again',tripId:trip.id},a.cookie)).status,409);
  await request('/api/trips/'+trip.id,'PUT',{version:1,data:{...trip.data,brief:'My manual edit'}},a.cookie);
  release();let job;
  for(let i=0;i<40;i++){job=(await request('/api/research/'+started.result.job.id,'GET',undefined,a.cookie)).result.job;if(job.status!=='running')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(job.status,'completed');
  const saved=(await request('/api/trips/'+trip.id,'GET',undefined,a.cookie)).result.record;
  assert.equal(saved.data.brief,'My manual edit');assert.deepEqual(saved.data.days,[]);assert.equal(saved.data.researchDraft.days[0].title,'Gardens');assert.equal(saved.data.messages.length,2);assert.equal(saved.data.messages[1].places[0].title,'Garden museum');
  const savedPlaces=(await request('/api/places','GET',undefined,a.cookie)).result.records;assert.equal(savedPlaces.length,1);assert.equal(savedPlaces[0].data.tripId,trip.id);
});
test('shared trips carry only validated map pins and no other location fields',async t=>{
  const request=await fixture(t),a=await signup(request,'PinOwner');
  const trip=(await request('/api/trips','POST',{data:{title:'Pins',destination:'Japan',days:[{title:'D1',items:[{title:'Shrine',lat:35.011636789,lng:135.768,placeId:'secret-place',location:{latitude:1,longitude:2},home:'private'},{title:'Bad',lat:'x',lng:500},{title:'Half',lat:12},{title:'Out',lat:91,lng:10}]}]}},a.cookie)).result.record;
  const token=new URL((await request('/api/trips/'+trip.id+'/share','POST',{},a.cookie)).result.share.url,'http://localhost').searchParams.get('share');
  const items=(await request('/api/shared/'+token)).result.trip.days[0].items;
  assert.equal(items[0].lat,35.0116);assert.equal(items[0].lng,135.768);
  for(const i of [1,2,3]){assert.equal('lat' in items[i],false);assert.equal('lng' in items[i],false);}
  const text=JSON.stringify(items);assert.equal(text.includes('secret-place'),false);assert.equal(text.includes('private'),false);assert.equal(text.includes('latitude'),false);
});
test('profile edits preserve airport removals and enquiries persist',async t=>{
  const request=await fixture(t);const a=await signup(request,'persist');
  await request('/api/profile','PATCH',{city:'San Francisco',airports:['SFO']},a.cookie);
  const edited=await request('/api/profile','PATCH',{budget:'considered'},a.cookie);
  assert.deepEqual(edited.result.user.profile.airports,['SFO']);
  await request('/api/profile','PATCH',{city:'San Francisco'},a.cookie);
  assert.deepEqual((await request('/api/auth/me','GET',undefined,a.cookie)).result.user.profile.airports,['SFO']);
  assert.equal((await request('/api/commissions','POST',{name:'A',email:'a@example.com',message:'A thoughtful trip'})).status,201);
  const db=new DatabaseSync(request.dbPath);assert.equal(db.prepare('SELECT count(*) AS n FROM enquiries').get().n,1);db.close();
});
test('trip sharing is explicit, read-only, sanitized, owner-controlled, revocable, and expires',async t=>{
  const request=await fixture(t),a=await signup(request,'ShareOwner'),b=await signup(request,'ShareOther');
  const trip=(await request('/api/trips','POST',{data:{title:'Kyoto',destination:'Japan',startDate:'2026-11-01',endDate:'2026-11-03',messages:[{role:'user',text:'private'}],days:[{title:'Temple',date:'2026-11-01',notes:'Walk slowly',items:[{title:'Garden',time:'10:00',url:'https://example.com',reference:'secret'}]}]}},a.cookie)).result.record;
  assert.equal((await request('/api/trips/'+trip.id+'/share','POST',{},b.cookie)).status,404);
  const created=await request('/api/trips/'+trip.id+'/share','POST',{},a.cookie);assert.equal(created.status,201);
  const link=new URL(created.result.share.url,'http://localhost');const token=link.searchParams.get('share');assert.match(token,/^[a-f0-9]{64}$/);
  const shared=await request('/api/shared/'+token);assert.equal(shared.status,200);
  assert.deepEqual(shared.result.trip,{title:'Kyoto',destination:'Japan',startDate:'2026-11-01',endDate:'2026-11-03',days:[{title:'Temple',date:'2026-11-01',notes:'Walk slowly',items:[{title:'Garden',time:'10:00',notes:'',address:'',url:'https://example.com/',openingHours:'',rating:'',reviews:'',photos:[]}]}]});
  assert.equal(JSON.stringify(shared.result).includes('private'),false);assert.equal(JSON.stringify(shared.result).includes('secret'),false);
  assert.equal((await request('/api/trips/'+trip.id+'/share','DELETE',{},b.cookie)).status,404);
  const db=new DatabaseSync(request.dbPath),tokenHash=createHash('sha256').update(token).digest('hex');
  assert.equal(db.prepare('SELECT count(*) AS n FROM shares WHERE token_hash=?').get(token).n,0);
  db.prepare('UPDATE shares SET expires=0 WHERE token_hash=?').run(tokenHash);db.close();
  assert.equal((await request('/api/shared/'+token)).status,404);
  const replacement=await request('/api/trips/'+trip.id+'/share','POST',{},a.cookie);const nextToken=new URL(replacement.result.share.url,'http://localhost').searchParams.get('share');
  assert.equal((await request('/api/trips/'+trip.id+'/share','DELETE',{},a.cookie)).status,200);
  assert.equal((await request('/api/shared/'+nextToken)).status,404);
  assert.equal((await request('/api/shared/'+nextToken+'/whatsapp-click','POST',{},a.cookie)).status,404);
});
test('trip share previews are server-rendered and share use is counted in SQLite',async t=>{
  const request=await fixture(t),owner=await signup(request,'ShareMetrics');
  const trip=(await request('/api/trips','POST',{data:{title:'Kyoto <friends>',destination:'Japan',startDate:'2026-11-01',endDate:'2026-11-03',messages:[{role:'user',text:'PRIVATE conversation'}],days:[{title:'Temple',items:[{title:'Garden',photos:[{url:'https://images.example/garden.jpg'}]}]}]}},owner.cookie)).result.record;
  const created=await request('/api/trips/'+trip.id+'/share','POST',{},owner.cookie);assert.equal(created.status,201);
  const token=new URL(created.result.share.url,origin).searchParams.get('share');
  const human=await request('/app.html?share='+token,'GET',undefined,'',{'User-Agent':'Friday trip visitor'});
  assert.equal(human.status,200);assert.match(human.result,/property=\"og:title\" content=\"Kyoto &lt;friends&gt; · a Friday itinerary\"/);
  assert.match(human.result,/property=\"og:description\" content=\"Japan · 2026-11-01–2026-11-03 · 1 stop\./);
  assert.match(human.result,/property=\"og:image\" content=\"http:\/\/localhost:4871\/assets\/images\/og\/kyoto.jpg\?v=\d+\"/);
  assert.match(human.result,/property=\"og:url\" content=\"http:\/\/localhost:4871\/app.html\?share=/);
  assert.match(human.result,/name=\"twitter:card\" content=\"summary_large_image\"/);
  assert.equal(human.result.includes('PRIVATE conversation'),false);
  const bot=await request('/app.html?share='+token,'GET',undefined,'',{'User-Agent':'WhatsApp/2.24.1'});assert.equal(bot.status,200);
  assert.equal((await request('/api/shared/'+token+'/whatsapp-click','POST',{},'')).status,200);
  const db=new DatabaseSync(request.dbPath);
  const counts=Object.fromEntries(db.prepare('SELECT event_type,count(*) AS n FROM trip_share_events GROUP BY event_type').all().map(row=>[row.event_type,row.n]));db.close();
  assert.equal(counts.trip_share_link_created,1);assert.equal(counts.trip_share_link_opened,1);assert.equal(counts.trip_share_preview_bot,1);assert.equal(counts.trip_share_whatsapp_clicked,1);
  const plainTrip=(await request('/api/trips','POST',{data:{title:'No cover',destination:'India',days:[]}},owner.cookie)).result.record;
  const plainShare=await request('/api/trips/'+plainTrip.id+'/share','POST',{},owner.cookie),plainToken=new URL(plainShare.result.share.url,origin).searchParams.get('share');
  const fallback=await request('/app.html?share='+plainToken,'GET',undefined,'',{'User-Agent':'WhatsApp'});
  assert.ok(fallback.result.includes('property="og:image" content="http://localhost:4871/assets/images/friday-coastal-banner.jpg"'));
});

test('Google OAuth routes receive only the signed-in owner and preserve redirects',async t=>{
  let seen;
  const request=await fixture(t,{google:async input=>{seen=input;return input.path.endsWith('/callback')?{status:303,redirect:'http://localhost:4871/app.html?google=connected'}:{status:200,data:{configured:true,connections:[]}};}});
  const a=await signup(request,'GoogleOwner');
  const status=await request('/api/integrations/google/status','GET',undefined,a.cookie);assert.equal(status.status,200);assert.equal(seen.user.id,a.result.user.id);
  const callback=await request('/api/integrations/google/callback','GET',undefined,a.cookie,{},'manual');assert.equal(callback.status,303);assert.match(callback.headers.get('location'),/google=connected/);
  const outsider=await request('/api/integrations/google/status');assert.equal(outsider.status,401);
});
test('social extraction is authenticated, rate-limited, and never saves without user action',async t=>{
  let input;
  const request=await fixture(t,{ai:{apiKey:'test',model:'test'},researchLink:async value=>{input=value;return {url:value.url,extracted:true,title:'Post title',summary:'Grounded summary',places:[{title:'Garden',sourceUrl:value.url}],sources:[{title:'Exact post',url:value.url}]};}});
  assert.equal((await request('/api/imports/extract','POST',{url:'https://instagram.com/p/AbC123',note:'Garden'},'')).status,401);
  const a=await signup(request,'SocialOwner');const result=await request('/api/imports/extract','POST',{url:'https://instagram.com/p/AbC123',note:'Garden'},a.cookie);
  assert.equal(result.status,200);assert.deepEqual(input,{url:'https://instagram.com/p/AbC123',note:'Garden'});assert.equal(result.result.result.places[0].title,'Garden');
  assert.equal((await request('/api/places','GET',undefined,a.cookie)).result.records.length,0);
});
test('Google Places adapter is owner-gated and supports signed photo redirects',async t=>{
  let seen;
  const request=await fixture(t,{places:async input=>{seen=input;return input.path.startsWith('/api/place-photo/')?{status:302,redirect:'https://images.example/photo.jpg',headers:{'Cache-Control':'no-store'}}:{status:200,data:{places:[{title:'Garden',attribution:'Google Maps'}]}};}});
  assert.equal((await request('/api/place-details?q=Kyoto')).status,401);
  const a=await signup(request,'PlacesOwner');
  const search=await request('/api/place-details?q=Kyoto','GET',undefined,a.cookie);assert.equal(search.status,200);assert.equal(seen.user.id,a.result.user.id);
  const photo=await request('/api/place-photo/placeid/photoRef?expires=1&sig=signature','GET',undefined,a.cookie,{},'manual');assert.equal(photo.status,302);assert.match(photo.headers.get('location'),/images\.example/);
});
test('fare checks require an owned alert and return advisory data without matching live prices',async t=>{
  let input;
  const request=await fixture(t,{checkFareAlert:async value=>{input=value;return {kind:'advisory',liveAvailability:false,targetMatch:'unknown',text:'Compare dates and check with the airline.',sources:[]};}});
  const a=await signup(request,'FareOwner'),b=await signup(request,'FareOther');
  const alert=(await request('/api/alerts','POST',{data:{title:'Tokyo fares',kind:'fare-watch',origin:'SFO',destination:'HND',departDate:'2026-11-01',currency:'USD',targetPrice:900}},a.cookie)).result.record;
  assert.equal((await request('/api/alerts/check','POST',{alertId:alert.id},b.cookie)).status,404);
  const check=await request('/api/alerts/check','POST',{alertId:alert.id},a.cookie);assert.equal(check.status,200);assert.equal(input.origin,'SFO');assert.equal(input.targetPrice,900);assert.equal(check.result.result.liveAvailability,false);
  for(const invalid of [
    {title:'Bad airport',kind:'fare-watch',origin:'San Francisco',destination:'HND',departDate:'2026-11-01'},
    {title:'Bad date',kind:'fare-watch',origin:'SFO',destination:'HND',departDate:'2026-02-30'},
    {title:'Bad currency',kind:'fare-watch',origin:'SFO',destination:'HND',departDate:'2026-11-01',currency:'US'},
    {title:'Bad price',kind:'fare-watch',origin:'SFO',destination:'HND',departDate:'2026-11-01',targetPrice:-2},
  ])assert.equal((await request('/api/alerts','POST',{data:invalid},a.cookie)).status,422);
  assert.equal((await request('/api/alerts/check','POST',{origin:'SFO',destination:'HND',departDate:'2026-11-01',currency:'$',targetPrice:900},a.cookie)).status,422);
});
