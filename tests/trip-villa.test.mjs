import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../assets/js/trip-villa.js',import.meta.url),'utf8');

function mount({pending=null,trips=[]}={}){
  let ready;const routeListeners=[];const calls=[];const state={trips:trips.map(t=>JSON.parse(JSON.stringify(t))),currentTripId:null};const destinations={};let id=0;
  const store={on:(name,fn)=>{if(name==='route')routeListeners.push(fn);},trip:(tripId)=>state.trips.find(t=>t.id===tripId),get:()=>state,update:fn=>fn(state),emit:()=>{}};
  const ft={DESTINATIONS:destinations,store,trips:{create(){const trip={id:'created-'+(++id),title:'New trip',destId:null,plan:null,threads:[],prefs:{}};state.trips.unshift(trip);return trip;}},router:{go(hash){const tripId=hash.split('/').pop();routeListeners.slice().forEach(fn=>fn({name:'trip',id:tripId}));}}};
  const session=new Map(pending?[["friday.villa.plan.v1",JSON.stringify(pending)]]:[]);
  const document={addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')ready=fn;}};
  const fetch=async url=>{calls.push(String(url));return {ok:true,status:200,json:async()=>({place:{id:'ChIJ123456789',title:'A private cove',address:'Provider address',lat:19.25,lng:72.8,description:'Provider description'}})};};
  const ctx={window:{FridayTrip:ft},document,sessionStorage:{getItem:k=>session.get(k)||null,removeItem:k=>session.delete(k)},fetch,encodeURIComponent,Set,Promise,Number,String,Array,JSON,console};
  vm.runInNewContext(source,ctx);return {ready:()=>ready(),route:(name,id)=>routeListeners.forEach(fn=>fn({name,id})),state,calls,session,destinations:ft.DESTINATIONS,window:ctx.window};
}

const plan={version:1,villa:{id:'villa-id',name:'Owner villa',city:'Coast',address:'Owner address',lat:19,lng:72,googleMapsUrl:'https://maps.google.com/owner'},days:[{day:1,stops:[{id:'ChIJ123456789',source:'google'}]},{day:2,stops:[]}]};

test('villa plan import waits until the planner route signals initialization and keeps the villa as stay',async()=>{
  const app=mount({pending:plan});app.ready();assert.equal(app.state.trips.length,0);
  app.route('home');assert.equal(app.state.trips.length,1);assert.equal(app.session.size,0);
  const t=app.state.trips[0];assert.equal(t.plan.stay,'villa-base');assert.equal(t.plan.days.length,2);assert.equal(t.villaOrigin.placeRefs[0].googlePlaceId,'ChIJ123456789');
  assert.deepEqual(Object.keys(t.villaOrigin.placeRefs[0]).sort(),['googlePlaceId','id','source']);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(app.calls.length,1);assert.equal(app.destinations[t.destId].places['vg-ChIJ123456789'].name,'A private cove');
  assert.deepEqual(Array.from(app.destinations[t.destId].places['vg-ChIJ123456789'].at),[72.8,19.25]);
  assert.equal(app.destinations[t.destId].places['villa-base'].address,'Owner address');
});

test('reopening a villa trip reconstructs runtime catalog and refreshes details for another villa',async()=>{
  const saved={id:'existing-trip',destId:'villa-other',villaOrigin:{villaId:'other-villa',name:'Other home',city:'Bay',address:'Owner pin address',lat:20,lng:73,googleMapsUrl:'https://maps.google.com/pin',placeRefs:[{id:'vg-ChIJ123456789',source:'google',googlePlaceId:'ChIJ123456789'}]},plan:{stay:'villa-base',days:[]}};
  const app=mount({trips:[saved]});app.ready();app.route('trip','existing-trip');await new Promise(resolve=>setTimeout(resolve,0));
  const dest=app.destinations['villa-other'];assert.ok(dest);assert.equal(dest.places['villa-base'].name,'Other home');assert.equal(dest.places['vg-ChIJ123456789'].name,'A private cove');
  assert.equal(app.calls[0],'/api/villas/other-villa/places/ChIJ123456789');
});

test('saved villa destinations are reconstructed synchronously before the first workspace render',()=>{
  const saved={id:'reload-trip',destId:'villa-coast',destName:'Coast',villaOrigin:{villaId:'villa-id',name:'Owner villa',city:'Coast',address:'Owner pin address',lat:19,lng:72,placeRefs:[{id:'vg-ChIJ123456789',source:'google',googlePlaceId:'ChIJ123456789'}]},plan:{days:[{id:'day-one',area:'villa',town:'Coast',items:[{id:'one',place:'vg-ChIJ123456789'}]}]}};
  const app=mount({trips:[saved]});app.ready();
  app.window.FridayTrip.villa.prepareCatalogs();
  const dest=app.destinations['villa-coast'];
  assert.equal(dest.name,'Coast');assert.equal(dest.region,'Coast');
  assert.equal(dest.areas[0].town,'Coast');
  assert.equal(dest.places['vg-ChIJ123456789'].googlePlaceId,'ChIJ123456789');
});
