import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';
import { createAirportLookup, titleCaseCity, haversineKm } from '../server/airports.mjs';

const geo = {
  mumbai: [{ name: 'Mumbai', latitude: 19.07283, longitude: 72.88261, country: 'India', country_code: 'IN', admin1: 'Maharashtra' }],
  'san francisco': [{ name: 'San Francisco', latitude: 37.77493, longitude: -122.41942, country: 'United States', country_code: 'US', admin1: 'California' }],
  boulder: [{ name: 'Boulder', latitude: 40.01499, longitude: -105.27055, country: 'United States', country_code: 'US', admin1: 'Colorado' }],
  nowhere: [{ name: 'Nowhere', latitude: -75, longitude: 0, country: 'Antarctica', country_code: 'AQ' }],
  portland: [
    { name: 'Portland', latitude: 45.52345, longitude: -122.67621, country: 'United States', country_code: 'US', admin1: 'Oregon' },
    { name: 'Portland', latitude: 43.66147, longitude: -70.25533, country: 'United States', country_code: 'US', admin1: 'Maine' }
  ]
};
function fakeFetch(calls = []) {
  return async (url, init) => {
    calls.push(String(url));
    const name = new URL(url).searchParams.get('name').toLowerCase();
    assert.ok(init.signal);
    return { ok: true, json: async () => ({ results: geo[name] }) };
  };
}

test('title casing keeps mixed-case words and handles separators', () => {
  assert.equal(titleCaseCity('mumbai'), 'Mumbai');
  assert.equal(titleCaseCity("  o'fallon   NEW-york "), "O'Fallon New-York");
  assert.equal(titleCaseCity('McAllen'), 'McAllen');
  assert.ok(haversineKm(0, 0, 0, 1) > 110);
});

test('lookup finds Mumbai airports within 80 km, caches, and only sends the city', async () => {
  const calls = [];
  const lookup = createAirportLookup({ fetch: fakeFetch(calls) });
  const [place] = await lookup.lookup('Mumbai');
  assert.deepEqual(place.airports.map(a => a.code), ['BOM', 'NMI']);
  assert.equal(place.region, 'Maharashtra');
  await lookup.lookup('mumbai');
  const [sf] = await lookup.lookup('San Francisco');
  assert.deepEqual(sf.airports.slice(0, 3).map(a => a.code), ['SFO', 'OAK', 'SJC']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], 'https://geocoding-api.open-meteo.com/v1/search?name=Mumbai&count=5&language=en&format=json');
});

test('lookup rewrites aliases, flags cities without airports, and falls back offline', async () => {
  const calls = [];
  const lookup = createAirportLookup({ fetch: fakeFetch(calls) });
  await lookup.lookup('Bombay');
  assert.match(calls[0], /name=Mumbai&/);
  const [boulder] = await lookup.lookup('Boulder');
  assert.equal(boulder.needsAirport, boulder.airports.length === 0);
  const [remote] = await lookup.lookup('Nowhere');
  assert.equal(remote.needsAirport, true);
  assert.deepEqual(remote.nearest, []);
  const offline = createAirportLookup({ fetch: async () => { throw new Error('offline'); } });
  assert.deepEqual((await offline.lookup('mumbai'))[0].airports.map(a => a.code), ['BOM', 'NMI']);
  assert.deepEqual(await offline.lookup('Qwertyville'), []);
});

test('airport search finds codes, names and municipalities', () => {
  const lookup = createAirportLookup({ fetch: fakeFetch() });
  assert.equal(lookup.search('nmi')[0].code, 'NMI');
  assert.ok(lookup.search('heathrow').some(a => a.code === 'LHR'));
  assert.ok(lookup.search('mumbai').length <= 10);
  assert.deepEqual(lookup.search(''), []);
});

test('airport endpoints and profile normalisation', async t => {
  const { request } = await startApp(t, { airportFetch: fakeFetch() });
  const places = await request('/api/airports?q=portland');
  assert.equal(places.status, 200);
  assert.equal(places.result.places.length, 2);
  assert.equal((await request('/api/airports')).result.places.length, 0);
  assert.equal((await request('/api/airports?q=' + 'x'.repeat(81))).status, 422);
  assert.equal((await request('/api/airports/search?q=BOM')).result.airports[0].code, 'BOM');
  assert.equal((await request('/api/airports/search?q=' + 'x'.repeat(81))).status, 422);

  const a = await signUp(request, 'airport');
  const saved = await request('/api/profile', 'PATCH', { city: 'mumbai' }, { cookie: a.cookie });
  assert.equal(saved.status, 200);
  assert.equal(saved.result.user.profile.city, 'Mumbai');
  assert.deepEqual(saved.result.user.profile.airports, ['BOM', 'NMI']);
  const typed = await request('/api/profile', 'PATCH', { city: 'qwertyville', airports: ['dxb', 'DXB', 'LHR'] }, { cookie: a.cookie });
  assert.equal(typed.result.user.profile.city, 'Qwertyville');
  assert.deepEqual(typed.result.user.profile.airports, ['DXB', 'LHR']);
  assert.equal((await request('/api/profile', 'PATCH', { airports: ['ZZZ'] }, { cookie: a.cookie })).status, 422);
  assert.equal((await request('/api/profile', 'PATCH', { airports: ['BOM', 'NMI', 'DEL', 'LHR', 'JFK', 'SFO', 'DXB'] }, { cookie: a.cookie })).status, 422);
});
