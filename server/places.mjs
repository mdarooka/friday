import { createHmac, timingSafeEqual } from 'node:crypto';

const endpoint='https://places.googleapis.com/v1';
const searchFields='places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,places.photos,places.reviews';
const detailsFields='id,displayName,formattedAddress,websiteUri,googleMapsUri,location,rating,userRatingCount,regularOpeningHours,photos,reviews';
const nearbyFields='places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.location,places.rating';
const nearbyTypes={
  'things-to-do':['tourist_attraction','museum','art_gallery','park','amusement_park','aquarium','zoo'],
  restaurants:['restaurant'],
  cafes:['cafe'],
};
const failure=(status,message)=>({status,data:{error:message}});
const safeText=(v,max=1000)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ').slice(0,max):'';
const httpsUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:''}catch{return ''}};
const goodId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{6,150}$/.test(id);
const goodRef=ref=>typeof ref==='string'&&/^[A-Za-z0-9_-]{8,180}$/.test(ref);

export function createGooglePlacesIntegration({apiKey,fetch:fetcher=fetch}) {
  const configured=!!apiKey;
  const fetchGoogle=async(url,options={})=>{
    let response;try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(20000)});}catch{throw Object.assign(new Error('Place details are temporarily unavailable.'),{status:502});}
    if(!response.ok)throw Object.assign(new Error(response.status===404?'This place could not be found.':'Place details are temporarily unavailable.'),{status:response.status===404?404:502});
    return response;
  };
  const fetchJson=async(url,options)=>{const response=await fetchGoogle(url,options);try{return await response.json()}catch{throw Object.assign(new Error('Place details are temporarily unavailable.'),{status:502});}};
  const photoSig=(placeId,ref,expires)=>createHmac('sha256',apiKey).update(`${placeId}\n${ref}\n${expires}`).digest('base64url');
  // Signed photo links expire after 15 minutes, so they are never stored as-is: records keep whatever link they were saved
  // with, and the server re-signs any /api/place-photo/ link (signPhoto below) each time it reads one back.
  const signPhoto=(placeId,ref)=>{
    if(!configured||!goodId(placeId)||!goodRef(ref))return '';
    const expires=Date.now()+15*60_000;
    return `/api/place-photo/${placeId}/${ref}?expires=${expires}&sig=${photoSig(placeId,ref,expires)}`;
  };
  const photoUrl=(placeId,name)=>{
    const match=String(name||'').match(/^places\/([A-Za-z0-9_-]{6,150})\/photos\/([A-Za-z0-9_-]{8,180})$/);
    if(!match||match[1]!==placeId)return '';
    return signPhoto(match[1],match[2]);
  };
  const fetchPhoto=async(id,ref)=>{
    if(!configured)return failure(503,'Google Places is not configured yet.');
    if(!goodId(id)||!goodRef(ref))return failure(404,'This place photo is no longer available.');
    let result;try{result=await fetchJson(`${endpoint}/places/${id}/photos/${ref}/media?maxWidthPx=1200&skipHttpRedirect=true`,{headers:{'X-Goog-Api-Key':apiKey}});}catch(e){return failure(e.status||502,e.message||'Place photo is temporarily unavailable.');}
    const image=httpsUrl(result.photoUri);
    if(!image||!new URL(image).hostname.endsWith('.googleusercontent.com'))return failure(502,'Place photo is temporarily unavailable.');
    return {status:302,redirect:image,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}};
  };
  const normalize=place=>{
    const id=goodId(place?.id)?place.id:'';if(!id)return null;
    const name=safeText(place.displayName?.text,300);
    const sourceUrl=httpsUrl(place.googleMapsUri)||`https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(id)}`;
    const hours=Array.isArray(place.regularOpeningHours?.weekdayDescriptions)?place.regularOpeningHours.weekdayDescriptions.map(x=>safeText(x,200)).slice(0,7):[];
    const photos=Array.isArray(place.photos)?place.photos.slice(0,5).flatMap(photo=>{
      const url=photoUrl(id,photo.name);if(!url)return [];
      const match=String(photo.name||'').match(/^places\/([A-Za-z0-9_-]{6,150})\/photos\/([A-Za-z0-9_-]{8,180})$/);
      const authors=Array.isArray(photo.authorAttributions)?photo.authorAttributions.slice(0,5).map(a=>({name:safeText(a.displayName,200),url:httpsUrl(a.uri)})).filter(a=>a.name):[];
      return [{url,placeId:match?.[1]||id,photoReference:match?.[2]||'',attribution:authors.map(a=>a.name).join(', ')||'Google Maps contributors',sourceUrl,authorAttributions:authors}];
    }):[];
    const reviews=Array.isArray(place.reviews)?place.reviews.slice(0,5).flatMap(review=>{
      const text=safeText(review.text?.text,1200);const author=safeText(review.authorAttribution?.displayName,200);
      if(!text&&!author)return [];
      return [{text,author,authorUrl:httpsUrl(review.authorAttribution?.uri),rating:typeof review.rating==='number'&&review.rating>=0&&review.rating<=5?review.rating:undefined,published:safeText(review.relativePublishTimeDescription,120)}];
    }):[];
    return {id,googlePlaceId:id,title:name,address:safeText(place.formattedAddress,500),description:'',url:httpsUrl(place.websiteUri)||sourceUrl,sourceUrl,attribution:'Google Maps',location:place.location&&Number.isFinite(place.location.latitude)&&Number.isFinite(place.location.longitude)?{latitude:place.location.latitude,longitude:place.location.longitude}:null,rating:typeof place.rating==='number'&&place.rating>=0&&place.rating<=5?place.rating:undefined,reviewsCount:Number.isSafeInteger(place.userRatingCount)&&place.userRatingCount>=0?place.userRatingCount:undefined,openingHours:hours,photos,reviews};
  };
  const searchNearby=async({lat,lng,radius=5000,category='things-to-do'}={})=>{
    if(!configured)return failure(503,'Google Places is not configured yet.');
    if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180||!Number.isFinite(radius)||radius < 100||radius > 50000||!nearbyTypes[category])return failure(422,'Choose a valid location, radius, and nearby category.');
    let result;
    try{
      result=await fetchJson(`${endpoint}/places:searchNearby`,{method:'POST',headers:{'content-type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':nearbyFields},body:JSON.stringify({includedTypes:nearbyTypes[category],maxResultCount:20,rankPreference:'DISTANCE',locationRestriction:{circle:{center:{latitude:lat,longitude:lng},radius}}})});
    }catch(e){return failure(e.status||502,e.message||'Nearby places are temporarily unavailable.');}
    const places=Array.isArray(result.places)?result.places.slice(0,20).map(normalize).filter(Boolean):[];
    return {status:200,data:{provider:'Google Places',attribution:'Google Maps',places}};
  };
  const getDetails=async id=>{
    if(!configured)return failure(503,'Google Places is not configured yet.');
    if(!goodId(id))return failure(422,'Invalid place identifier.');
    let place;try{place=await fetchJson(`${endpoint}/places/${encodeURIComponent(id)}`,{headers:{'X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':detailsFields}});}catch(e){return failure(e.status||502,e.message||'Place details are temporarily unavailable.');}
    const normalized=normalize(place);return normalized?{status:200,data:{provider:'Google Places',attribution:'Google Maps',place:normalized}}:failure(404,'This place could not be found.');
  };
  const authError=()=>failure(401,'Please sign in.');
  async function handlePlaces({path,method,url,user}) {
    if(!path?.startsWith('/api/place-details')&&!path?.startsWith('/api/place-photo/'))return null;
    const userId=typeof user==='string'?user:user?.id;if(!userId)return authError();
    if(!configured)return failure(503,'Google Places is not configured yet.');
    const requestUrl=url instanceof URL?url:new URL(url||`http://localhost${path}`);
    if(path==='/api/place-details'&&method==='GET'){
      const query=(requestUrl.searchParams.get('q')||'').trim();
      if(query.length<2||query.length>160)return failure(422,'Enter a place name or address.');
      let result;try{result=await fetchJson(`${endpoint}/places:searchText`,{method:'POST',headers:{'content-type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':searchFields},body:JSON.stringify({textQuery:query,pageSize:5})});}catch(e){return failure(e.status||502,e.message||'Place details are temporarily unavailable.');}
      return {status:200,data:{provider:'Google Places',attribution:'Google Maps',places:(result.places||[]).slice(0,5).map(normalize).filter(Boolean)}};
    }
    const detailMatch=path.match(/^\/api\/place-details\/([A-Za-z0-9_-]{6,150})$/);
    if(path.startsWith('/api/place-details/')&&!detailMatch)return failure(422,'Invalid place identifier.');
    if(detailMatch&&method==='GET'){
      const [,id]=detailMatch;return getDetails(id);
    }
    const photoMatch=path.match(/^\/api\/place-photo\/([A-Za-z0-9_-]{6,150})\/([A-Za-z0-9_-]{8,180})$/);
    if(path.startsWith('/api/place-photo/')&&!photoMatch)return failure(404,'This place photo is no longer available.');
    if(photoMatch&&method==='GET'){
      const [,id,ref]=photoMatch,expires=Number(requestUrl.searchParams.get('expires')||0),given=requestUrl.searchParams.get('sig')||'';
      const expected=photoSig(id,ref,expires);
      const signature=Buffer.from(given),computed=Buffer.from(expected);
      if(!goodId(id)||!goodRef(ref)||!Number.isSafeInteger(expires)||expires<Date.now()||expires>Date.now()+15*60_000||signature.length!==computed.length||!timingSafeEqual(signature,computed))return failure(404,'This place photo is no longer available.');
      return fetchPhoto(id,ref);
    }
    return null;
  }
  handlePlaces.signPhoto=signPhoto;
  handlePlaces.fetchPhoto=fetchPhoto;
  handlePlaces.searchNearby=searchNearby;
  handlePlaces.getDetails=getDetails;
  return handlePlaces;
}
