import test from 'node:test';
import assert from 'node:assert/strict';
import { createGooglePlacesIntegration } from '../server/places.mjs';

const id='ChIJ123456789',ref='A123456789_photo';
const place={id,displayName:{text:'Tenryu-ji'},formattedAddress:'68 Sagatenryuji Susukinobabacho, Kyoto',location:{latitude:35.015,longitude:135.673},websiteUri:'https://www.tenryuji.com/',googleMapsUri:'https://maps.google.com/?cid=123',rating:4.5,userRatingCount:12500,regularOpeningHours:{weekdayDescriptions:['Monday: 8:30 AM – 5:00 PM']},photos:[{name:`places/${id}/photos/${ref}`,authorAttributions:[{displayName:'Photo author',uri:'https://profiles.google.com/person'}]}],reviews:[{text:{text:'Beautiful temple grounds.'},rating:5,authorAttribution:{displayName:'Visitor',uri:'https://profiles.google.com/visitor'},relativePublishTimeDescription:'2 months ago'}]};
const ok=data=>({ok:true,status:200,json:async()=>data});
const request=async(handler,path,method='GET',user={id:'u1'},url)=>handler({path,method,user,url});

test('Google Places search uses fixed endpoint and explicit field mask, returning attributed fields',async()=>{
  const calls=[];const handle=createGooglePlacesIntegration({apiKey:'places-server-key',fetch:async(url,options)=>{calls.push({url:String(url),options});return ok({places:[place]});}});
  const response=await request(handle,'/api/place-details','GET',{id:'u1'},'https://friday.example/api/place-details?q=Tenryu-ji%20Kyoto');
  assert.equal(response.status,200);assert.equal(calls[0].url,'https://places.googleapis.com/v1/places:searchText');
  assert.equal(calls[0].options.headers['X-Goog-Api-Key'],'places-server-key');
  assert.match(calls[0].options.headers['X-Goog-FieldMask'],/places\.photos/);assert.match(calls[0].options.headers['X-Goog-FieldMask'],/places\.reviews/);
  const result=response.data.places[0];assert.equal(result.title,'Tenryu-ji');assert.equal(result.rating,4.5);assert.equal(result.reviewsCount,12500);
  assert.match(result.openingHours[0],/8:30 AM/);assert.equal(result.reviews[0].author,'Visitor');assert.equal(result.photos[0].attribution,'Photo author');
  assert.ok(result.photos[0].url.startsWith('/api/place-photo/'));assert.equal(JSON.stringify(response).includes('places-server-key'),false);
});

test('exact details uses a validated place id, and photo proxy validates a signed provider reference',async()=>{
  const calls=[];const handle=createGooglePlacesIntegration({apiKey:'server-key',fetch:async(url,options)=>{calls.push({url:String(url),options});return url.includes('/media?')?ok({photoUri:'https://lh3.googleusercontent.com/photo'}) : ok(place);}});
  const details=await request(handle,`/api/place-details/${id}`);
  assert.equal(details.status,200);assert.equal(calls[0].url,`https://places.googleapis.com/v1/places/${id}`);
  assert.equal((await request(handle,'/api/place-details/%2e%2e%2fusers')).status,422);
  const mediaUrl=new URL(details.data.place.photos[0].url,'https://friday.example');
  const media=await request(handle,mediaUrl.pathname,'GET',{id:'u1'},mediaUrl.href);
  assert.equal(media.status,302);assert.equal(media.redirect,'https://lh3.googleusercontent.com/photo');
  assert.equal(calls[1].options.headers['X-Goog-Api-Key'],'server-key');
  const modified=`https://friday.example${mediaUrl.pathname.replace(ref,'B123456789')}${mediaUrl.search}`;
  assert.equal((await request(handle,new URL(modified).pathname,'GET',{id:'u1'},modified)).status,404);
  const expired=`https://friday.example${mediaUrl.pathname}?expires=1&sig=${mediaUrl.searchParams.get('sig')}`;
  assert.equal((await request(handle,new URL(expired).pathname,'GET',{id:'u1'},expired)).status,404);
});

test('unauthenticated, unconfigured, malformed search, and unsafe photo targets fail closed',async()=>{
  const disabled=createGooglePlacesIntegration({apiKey:''});
  assert.equal((await request(disabled,'/api/place-details','GET',null,'https://friday.example/api/place-details?q=Kyoto')).status,401);
  assert.equal((await request(disabled,'/api/place-details','GET',{id:'u1'},'https://friday.example/api/place-details?q=Kyoto')).status,503);
  const handle=createGooglePlacesIntegration({apiKey:'k',fetch:async()=>ok({places:[]})});
  assert.equal((await request(handle,'/api/place-details','GET',{id:'u1'},'https://friday.example/api/place-details?q=x')).status,422);
});
