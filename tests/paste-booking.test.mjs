import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { extractBooking } from '../server/booking-extraction.mjs';
import { prepareBriefing } from '../server/briefing.mjs';
import { vaultModeOptions } from './fake-vault.mjs';
const origin='http://localhost:4871';
const iso=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
async function fixture(t) {
  const server=createApp({memory:true,origin,airportFetch:async()=>{throw new Error('geocoder disabled in tests');},...vaultModeOptions({})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));});
  const request=async(url,method='GET',data,cookie='')=>{
    const res=await fetch(base+url,{method,headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),Cookie:cookie},body:data?JSON.stringify(data):undefined});
    return {status:res.status,result:(res.headers.get('content-type')||'').includes('application/json')?await res.json():await res.text(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  };
  return request;
}
const flightText=`Your flight is confirmed
Airline: IndiGo flight 6E 512, BOM to GOI. Booking reference: QX7K2P. Departure date: ${iso(30)}. E-ticket attached.`;
const cancelText='Your flight booking has been cancelled. Booking reference: QX7K2P.';

test('extractBooking tags pasted emails with type and reference',()=>{
  const flight=extractBooking({source:'pasted-email',subject:'Flight confirmed',body:flightText,today:iso(0)});
  assert.equal(flight.booking.source,'pasted-email');assert.equal(flight.booking.type,'flight');assert.equal(flight.booking.ref,'QX7K2P');assert.equal(flight.booking.dateStatus,'confirmed');
  const hotel=extractBooking({source:'pasted-email',subject:'Hotel reservation confirmed',body:'Reservation number H88123. Check-in: 12 March 2027. Check-out: 15 March 2027.',today:'2027-03-01'});
  assert.equal(hotel.booking.type,'hotel');assert.equal(hotel.booking.ref,'H88123');
  assert.equal(extractBooking({subject:'Hotel reservation confirmed',body:'Check-in: 12 March 2027.',today:'2027-03-01'}).booking.source,'google-gmail');
});

test('parse-email endpoint previews a booking and saves nothing',async t=>{
  const request=await fixture(t);
  assert.equal((await request('/api/bookings/parse-email','POST',{text:flightText})).status,401);
  const signup=await request('/api/auth/signup','POST',{name:'P',email:'p@example.com',password:'long test password 123'});
  const cookie=signup.cookie;
  assert.equal((await request('/api/bookings/parse-email','POST',{text:'   '},cookie)).status,422);
  assert.equal((await request('/api/bookings/parse-email','POST',{text:'x'.repeat(20001)},cookie)).status,422);
  const before=(await request('/api/bookings','GET',undefined,cookie)).result.records.length;
  const ok=await request('/api/bookings/parse-email','POST',{text:flightText,subject:'Flight confirmed'},cookie);
  assert.equal(ok.status,200);assert.equal(ok.result.booking.source,'pasted-email');assert.equal(ok.result.booking.type,'flight');assert.equal(ok.result.booking.start,iso(30));
  const noSubject=await request('/api/bookings/parse-email','POST',{text:`Hotel booking confirmed\nCheck-in: ${iso(40)}\nCheck-out: ${iso(43)}`},cookie);
  assert.equal(noSubject.result.booking.name,'Hotel booking confirmed');
  assert.deepEqual((await request('/api/bookings/parse-email','POST',{text:cancelText},cookie)).result,{skip:'cancelled'});
  assert.deepEqual((await request('/api/bookings/parse-email','POST',{text:'Hello, just saying hi.'},cookie)).result,{skip:'not-confirmed'});
  assert.equal((await request('/api/bookings','GET',undefined,cookie)).result.records.length,before);
});

test('a reviewed pasted booking makes the trip eligible for the briefing',()=>{
  const tripId='6c0c0b79-689a-47ab-a2da-2c0bba79ee7c',start=iso(5),now=new Date();
  const bookingRows=[{id:'b1',data:JSON.stringify({tripId,title:'IndiGo 6E 512',type:'flight',source:'pasted-email',start,dateStatus:'confirmed'})}];
  const briefing=prepareBriefing({tripId,tripData:{title:'Goa',startDate:start},bookingRows,recipient:'p@example.com',origin,now});
  assert.equal(briefing.eligible,true);
  // An unreviewed import (no dateStatus) is not confirmed; hand-typed bookings without a source still are.
  bookingRows[0].data=JSON.stringify({tripId,title:'IndiGo 6E 512',source:'google-gmail',start});
  assert.equal(prepareBriefing({tripId,tripData:{title:'Goa',startDate:start},bookingRows,recipient:'p@example.com',origin,now}).eligible,false);
});
