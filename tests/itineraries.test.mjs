import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';
import { getItinerary, saveItinerary, openStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';

const post = (request, body, opts) => request('/api/itineraries', 'POST', body, opts);

test('GET /api/health is public and reports the itinerary provider and knowledge', async (t) => {
  const { request } = await startApp(t);
  const r = await request('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.result.ok, true);
  assert.equal(r.result.itineraryProvider, 'local');
  assert.ok(Array.isArray(r.result.knowledge.sources) && typeof r.result.knowledge.chars === 'number');
  assert.equal((await request('/api/health', 'POST', {})).status, 405);
});

test('GET /api/destinations lists all six with trip types and durations', async (t) => {
  const { request } = await startApp(t);
  const { result } = await request('/api/destinations');
  assert.equal(result.destinations.length, 6);
  const goa = result.destinations.find((d) => d.id === 'goa');
  assert.equal(goa.name, 'Goa');
  assert.ok(goa.tripTypes.includes('Beach downtime'));
  assert.deepEqual(goa.durations.map((x) => x.days), [4, 7, 14]);
});

test('GET /api/destinations/:id returns the catalog; unknown is 404', async (t) => {
  const { request } = await startApp(t);
  const r = await request('/api/destinations/kyoto');
  assert.equal(r.status, 200);
  assert.equal(r.result.id, 'kyoto');
  assert.ok(Object.keys(r.result.places).length > 20);
  assert.ok(r.result.areas.every((a) => a.at && a.town));
  assert.equal(r.result.map, undefined);
  assert.equal((await request('/api/destinations/atlantis')).status, 404);
  assert.equal((await request('/api/destinations/__proto__')).status, 404);
});

test('POST /api/itineraries works signed out, saves, and GET returns it to anyone holding the id', async (t) => {
  const { request, db } = await startApp(t);
  const body = { destination: 'goa', types: ['Beach downtime'], days: 5, dates: { start: '2027-01-10' }, pace: 'relaxed', base: 'Quiet boutique village' };
  const r = await post(request, body);
  assert.equal(r.status, 201);
  const made = r.result;
  assert.match(made.id, /^it_[a-f0-9]{16}$/);
  assert.equal(made.provider, 'local');
  assert.equal(made.plan.days.length, 5);
  assert.equal(made.plan.days[0].date, '2027-01-10');
  assert.equal(made.plan.stay, 'casa-anjuna');
  assert.equal(r.headers.get('location'), '/api/itineraries/' + made.id);

  const got = await request('/api/itineraries/' + made.id);   // no cookie
  assert.equal(got.status, 200);
  assert.equal(got.result.id, made.id);
  assert.deepEqual(got.result.plan, made.plan);
  assert.equal(got.result.request.destination, 'goa');
  assert.ok(got.result.createdAt);

  assert.equal((await db.one('SELECT user_id FROM itineraries WHERE id=$1', [made.id])).user_id, null);
});

test('a signed-in generation records its owner; the id is still the only key to read it', async (t) => {
  const { request, db } = await startApp(t);
  const a = await signUp(request, 'Owner');
  const made = (await post(request, { destination: 'kerala', days: 3 }, { cookie: a.cookie })).result;
  const owner = (await db.one('SELECT id FROM users WHERE email=$1', ['Owner@example.com'.toLowerCase()])).id;
  assert.equal((await db.one('SELECT user_id FROM itineraries WHERE id=$1', [made.id])).user_id, owner);
  assert.equal((await request('/api/itineraries/' + made.id)).status, 200);
});

test('the same request gives the same plan', async (t) => {
  const { request } = await startApp(t);
  const body = { destination: 'kerala', types: ['Tea hills and wildlife'], days: 6 };
  const a = (await post(request, body)).result, b = (await post(request, body)).result;
  assert.notEqual(a.id, b.id);
  assert.deepEqual(a.plan, b.plan);
});

test('types default to the first trip type when omitted', async (t) => {
  const { request } = await startApp(t);
  assert.equal((await post(request, { destination: 'goa', days: 3 })).status, 201);
});

test('bad input is 400', async (t) => {
  const { request } = await startApp(t);
  const bads = [
    { destination: 'goa' }, { destination: 'goa', days: 0 }, { destination: 'goa', days: 22 }, { destination: 'goa', days: 2.5 },
    { destination: 'goa', days: '3' }, { destination: 'goa', days: 3, types: [] }, { destination: 'goa', days: 3, types: 'Beach downtime' },
    { destination: 'goa', days: 3, types: ['Nonsense'] }, { destination: 'goa', days: 3, types: [5] }, { destination: 'goa', days: 3, pace: 'frantic' },
    { destination: 'goa', days: 3, dates: { start: 'tomorrow' } }, { destination: 'goa', days: 3, dates: { start: '2027-02-30' } },
    { destination: 'goa', days: 3, dates: '2027-01-01' }, { destination: 'goa', days: 3, base: 7 }, { destination: 'goa', days: 3, base: 'x'.repeat(121) },
    { destination: 7, days: 3 }, { days: 3 }
  ];
  for (const b of bads) {
    const r = await post(request, b);
    assert.equal(r.status, 400, JSON.stringify(b));
    assert.ok(r.result.error);
  }
  assert.equal((await post(request, undefined, { raw: '{not json' })).status, 400);
  assert.equal((await post(request, undefined, { raw: '[1,2]' })).status, 400);
  assert.equal((await post(request, undefined, { raw: '' })).status, 400);   // an empty body has no destination
});

test('unknown destination is 404', async (t) => {
  const { request } = await startApp(t);
  assert.equal((await post(request, { destination: 'atlantis', days: 3 })).status, 404);
});

test('an oversized body is 413 and the server stays healthy', async (t) => {
  const { request } = await startApp(t);
  assert.equal((await post(request, { destination: 'goa', days: 3, base: 'x'.repeat(200000) })).status, 413);
  assert.equal((await request('/api/health')).status, 200);
});

test('POST keeps the CSRF origin check and JSON content type', async (t) => {
  const { request } = await startApp(t);
  const body = { destination: 'goa', days: 3 };
  assert.equal((await post(request, body, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/itineraries', 'POST', body, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
});

test('generation is rate limited', async (t) => {
  const { request } = await startApp(t);
  const codes = [];
  for (let i = 0; i < 22; i++) codes.push((await post(request, { destination: 'goa', days: 1 })).status);
  assert.equal(codes.filter((c) => c === 201).length, 20);
  assert.equal(codes.at(-1), 429);
});

test('unknown itinerary ids, unknown routes and wrong methods', async (t) => {
  const { request } = await startApp(t);
  assert.equal((await request('/api/itineraries/it_0000000000000000')).status, 404);
  assert.equal((await request('/api/itineraries/..%2F..%2Fpackage.json')).status, 404);
  assert.equal((await request('/api/itineraries/%E0%A4%A')).status, 400);
  assert.equal((await request('/api/itineraries')).status, 405);
});

test('the store only accepts minted ids', async (t) => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  assert.equal(await getItinerary(db, '../../x'), null);
  await assert.rejects(() => saveItinerary(db, { id: '../x' }), /invalid itinerary id/);
});

test('the itinerary provider is validated at startup, separately from AI_PROVIDER', async (t) => {
  assert.throws(() => createApp({ origin: 'http://localhost:4871', memory: true, env: { ITINERARY_PROVIDER: 'bard' } }), /ITINERARY_PROVIDER/);
  assert.throws(() => createApp({ origin: 'http://localhost:4871', memory: true, env: { OPENAI_AUTH: 'chatgpt' } }), /OPENAI_AUTH/);
  const a = await startApp(t, { env: { ITINERARY_PROVIDER: '' } });
  const b = await startApp(t, { env: { ITINERARY_PROVIDER: '', OPENAI_API_KEY: 'sk-test' } });
  const c = await startApp(t, { env: { ITINERARY_PROVIDER: '', OPENAI_API_KEY: 'sk-test', AI_PROVIDER: 'perplexity' } });
  assert.equal((await a.request('/api/health')).result.itineraryProvider, 'local');
  assert.equal((await b.request('/api/health')).result.itineraryProvider, 'openai');
  assert.equal((await c.request('/api/health')).result.itineraryProvider, 'openai');
});
