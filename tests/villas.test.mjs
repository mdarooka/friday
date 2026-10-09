import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';
import * as store from '../server/store.mjs';
import { startApp, signUp } from './helpers.mjs';
import { publicVilla } from '../server/villas.mjs';

const map = 'https://maps.google.com/?q=Friday+Villa';
const villaInput = (overrides = {}) => ({
  name: 'Palm Courtyard', description: 'A test-only villa near the coast.', city: 'Alibaug', address: 'Fixture address',
  lat: 18.641, lng: 72.872, googleMapsUrl: map, googlePlaceId: 'ChIJfixture123', bedrooms: 3, maxGuests: 6,
  amenities: ['Pool', 'Garden'], nearby: [], status: 'published', ...overrides,
});
const createVilla = async (request, cookie, overrides = {}) => {
  const response = await request('/api/admin/villas', 'POST', { villa: villaInput(overrides) }, { cookie });
  assert.equal(response.status, 201, JSON.stringify(response.result));
  return response.result.villa;
};

const fixturePlace = (id, title, lat = 18.642, lng = 72.873) => ({
  id, googlePlaceId: id, title, address: `${title} address`, url: `https://www.google.com/maps/place/${encodeURIComponent(title)}`,
  sourceUrl: `https://www.google.com/maps/place/${encodeURIComponent(title)}`, location: { latitude: lat, longitude: lng }, rating: 4.7,
});

test('public villa DTO is an allowlist and drops fields added by future admin schemas', () => {
  const dto = publicVilla({ id: '12345678-1234-4abc-8abc-123456789abc', created: '2026-01-01', updated: '2026-01-02', data: {
    ...villaInput(), ownerId: 'private-owner', contactEmail: 'owner@example.com', status: 'draft', internalNotes: 'private',
  } });
  assert.deepEqual(Object.keys(dto).sort(), ['address','amenities','bedrooms','city','createdAt','description','googleMapsUrl','googlePlaceId','id','lat','lng','maxGuests','name','nearby','updatedAt'].sort());
  assert.equal(JSON.stringify(dto).includes('owner@example.com'), false);
});

test('published villa browsing uses a strict public DTO and hides drafts', async t => {
  const app = await startApp(t, { env: { VILLA_ADMIN_EMAILS: 'admin@example.com' } });
  const admin = await signUp(app.request, 'admin');
  const published = await createVilla(app.request, admin.cookie, { privateNote: 'Never return this field.' });
  const draft = await createVilla(app.request, admin.cookie, { name: 'Unlisted Villa', status: 'draft' });
  const list = await app.request('/api/villas');
  assert.equal(list.status, 200);
  assert.deepEqual(list.result.villas.map(v => v.id), [published.id]);
  assert.equal('ownerId' in list.result.villas[0], false);
  assert.equal('status' in list.result.villas[0], false);
  assert.equal('privateNote' in list.result.villas[0], false);
  assert.equal((await app.request(`/api/villas/${draft.id}`)).status, 404);
  assert.equal((await app.request(`/api/villas/${published.id}`)).result.villa.name, 'Palm Courtyard');
});

test('villa admin requires an allowlisted session and keeps each admin scoped to their own villas', async t => {
  const app = await startApp(t, { env: { AUTH_REQUIRED: 'true', VILLA_ADMIN_EMAILS: 'admin@example.com,other@example.com' } });
  assert.equal((await app.request('/api/admin/villas')).status, 401, 'the normal authenticated mode keeps admin APIs protected');
  const admin = await signUp(app.request, 'admin');
  const other = await signUp(app.request, 'other');
  const villa = await createVilla(app.request, admin.cookie);
  assert.equal((await app.request('/api/admin/villas', 'GET', undefined, { cookie: admin.cookie })).result.villas.length, 1);
  assert.equal((await app.request(`/api/admin/villas/${villa.id}`, 'GET', undefined, { cookie: other.cookie })).status, 404);
  assert.equal((await app.request(`/api/admin/villas/${villa.id}`, 'DELETE', {}, { cookie: other.cookie })).status, 404);
  assert.equal((await app.request(`/api/admin/villas/${villa.id}`, 'GET', undefined, { cookie: admin.cookie })).result.villa.id, villa.id);
  const notAdmin = await signUp(app.request, 'visitor');
  assert.equal((await app.request('/api/admin/villas', 'GET', undefined, { cookie: notAdmin.cookie })).status, 403);
});

test('local no-login mode uses an isolated stable development owner for private APIs and villa admin', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'friday-local-auth-'));
  const regularDb = store.openStore({ dataDir: path.join(root, '.data', 'pglite') });
  const oldUser = { id: 'existing-real-owner', email: 'existing@example.com', name: 'Existing account', password: 'unusable' };
  await store.createUser(regularDb, oldUser);
  const now = new Date().toISOString();
  await store.insertVilla(regularDb, { id: '11111111-1111-4111-8111-111111111111', ownerId: oldUser.id, status: 'draft', data: JSON.stringify(villaInput({ name: 'Private existing villa' })), created: now, updated: now });
  await store.insertVillaSubmission(regularDb, { id: '22222222-2222-4222-8222-222222222222', data: JSON.stringify({ contactName: 'Private lead', email: 'private@example.com' }), created: now, updated: now });
  await store.closeStore(regularDb);

  const server = createApp({ root, origin: 'http://localhost:4871', env: { ITINERARY_PROVIDER: 'local', AUTH_REQUIRED: 'false' } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });
  const request = async (url, method = 'GET', data) => {
    const post = method !== 'GET';
    const response = await fetch(base + url, { method, headers: { ...(post ? { 'content-type': 'application/json', origin: 'http://localhost:4871' } : {}) }, body: post ? JSON.stringify(data || {}) : undefined });
    return { status: response.status, result: await response.json() };
  };

  const capabilities = await request('/api/capabilities');
  assert.equal(capabilities.result.authRequired, false);
  assert.equal(capabilities.result.localAuthBypass, true);
  assert.equal((await request('/api/auth/me')).result.user, null);
  assert.equal((await request('/api/admin/villas')).result.villas.length, 0, 'the normal account database is not opened');
  assert.equal((await request('/api/admin/villa-submissions')).result.submissions.length, 0, 'private leads in the normal database stay hidden');
  const villa = await request('/api/admin/villas', 'POST', { villa: villaInput({ status: 'draft' }) });
  assert.equal(villa.status, 201);
  assert.equal((await request('/api/admin/villas')).result.villas[0].id, villa.result.villa.id, 'the no-login owner is stable across requests');
  const trip = await request('/api/trips', 'POST', { data: { title: 'Local test trip', days: [] } });
  assert.equal(trip.status, 201, 'private planning APIs also work without a session in local mode');
  assert.equal((await request('/api/trips')).result.records.length, 1);
});

test('local auth bypass fails closed for production and non-loopback server configuration', async t => {
  const production = await startApp(t, { env: { AUTH_REQUIRED: 'false', NODE_ENV: 'production', APP_ORIGIN: 'https://friday.example' } });
  const productionCaps = await production.request('/api/capabilities');
  assert.equal(productionCaps.result.authRequired, true);
  assert.equal(productionCaps.result.localAuthBypass, false);
  assert.equal((await production.request('/api/admin/villas')).status, 401);

  const network = await startApp(t, { env: { AUTH_REQUIRED: 'false', HOST: '0.0.0.0' } });
  const networkCaps = await network.request('/api/capabilities');
  assert.equal(networkCaps.result.authRequired, true);
  assert.equal(networkCaps.result.localAuthBypass, false);
  assert.equal((await network.request('/api/admin/villas')).status, 401);
});

test('public owner submissions validate consent, filter honeypots, and keep contact data in admin inbox only', async t => {
  const app = await startApp(t, { env: { VILLA_ADMIN_EMAILS: 'admin@example.com' } });
  const admin = await signUp(app.request, 'admin');
  const body = { contactName: 'Villa Owner', email: 'owner@example.com', phone: '+91 99999 11111', villaName: 'Seaside House', city: 'Goa', consent: true };
  assert.equal((await app.request('/api/villa-submissions', 'POST', { ...body, consent: false })).status, 422);
  const honeypot = await app.request('/api/villa-submissions', 'POST', { websiteTrap: 'bot', ...body });
  assert.equal(honeypot.status, 201);
  const submitted = await app.request('/api/villa-submissions', 'POST', body);
  assert.equal(submitted.status, 201);
  assert.equal('email' in submitted.result, false);
  const inbox = await app.request('/api/admin/villa-submissions', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.result.submissions.length, 1);
  assert.equal(inbox.result.submissions[0].email, 'owner@example.com');
  const id = inbox.result.submissions[0].id;
  assert.equal((await app.request(`/api/admin/villa-submissions/${id}`, 'PATCH', { status: 'reviewed' }, { cookie: admin.cookie })).result.submission.status, 'reviewed');
  assert.equal((await app.request('/api/admin/villa-submissions', 'GET')).status, 401);
});

test('curated nearby suggestions are radius filtered and the local proposal never repeats stops', async t => {
  const nearby = [
    { id: 'beach-1', name: 'Fixture Beach', description: 'Host-curated shoreline', category: 'things-to-do', lat: 18.642, lng: 72.873, mapsUrl: map },
    { id: 'cafe-1', name: 'Fixture Cafe', description: 'Host-curated cafe', category: 'cafes', lat: 18.643, lng: 72.874, mapsUrl: map },
    { id: 'far-1', name: 'Distant Place', description: 'Outside radius', category: 'things-to-do', lat: 18.8, lng: 73.1, mapsUrl: map },
  ];
  const app = await startApp(t, { env: { VILLA_ADMIN_EMAILS: 'admin@example.com' } });
  const admin = await signUp(app.request, 'admin');
  const villa = await createVilla(app.request, admin.cookie, { nearby });
  const found = await app.request(`/api/villas/${villa.id}/nearby?radius=1000&category=things-to-do`);
  assert.equal(found.status, 200);
  assert.equal(found.result.provider, 'curated');
  assert.deepEqual(found.result.nearby.map(place => place.id), ['beach-1']);
  const plan = await app.request(`/api/villas/${villa.id}/plan`, 'POST', { days: 4, interests: ['things-to-do', 'cafes'], pace: 'balanced' }, { cookie: admin.cookie });
  assert.equal(plan.status, 200);
  const signedOutPlan = await app.request(`/api/villas/${villa.id}/plan`, 'POST', { days: 4, interests: ['things-to-do', 'cafes'], pace: 'balanced' });
  assert.equal(signedOutPlan.status, 401);
  assert.match(signedOutPlan.result.error, /sign in/i);
  const allIds = plan.result.days.flatMap(day => day.stops.map(place => place.id));
  assert.deepEqual(allIds, ['beach-1', 'cafe-1']);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(plan.result.provider, 'local');
  assert.deepEqual(plan.result.days.map(day => day.focus), ['things-to-do', 'Time at the villa', 'Time at the villa', 'Time at the villa']);
});

test('live Google nearby and AI plan responses use only verified candidates and expose transient details', async t => {
  const candidateA = fixturePlace('ChIJfixtureA12', 'Fixture garden'), candidateB = fixturePlace('ChIJfixtureB12', 'Fixture museum');
  const places = Object.assign(async () => null, {
    searchNearby: async ({ category }) => ({ status: 200, data: { places: [category === 'things-to-do' ? candidateA : candidateB] } }),
    getDetails: async id => ({ status: 200, data: { place: id === candidateA.id ? candidateA : { ...candidateA, location: { latitude: 20, longitude: 73 } } } }),
  });
  const app = await startApp(t, {
    env: { VILLA_ADMIN_EMAILS: 'admin@example.com' }, places,
    ai: { apiKey: 'test-only', model: 'fixture-model', provider: 'claude' },
    villaResearch: async ({ prompt }) => {
      assert.match(prompt, /candidate-id/);
      return { text: JSON.stringify({ days: [{ focus: 'impossible text ignored', stops: [candidateA.id] }, { focus: 'ignored', stops: [candidateB.id] }] }) };
    },
  });
  const admin = await signUp(app.request, 'admin');
  const villa = await createVilla(app.request, admin.cookie);
  const nearby = await app.request(`/api/villas/${villa.id}/nearby?category=things-to-do`);
  assert.equal(nearby.result.provider, 'google');
  assert.equal(nearby.result.nearby[0].attribution, 'Google Maps');
  const plan = await app.request(`/api/villas/${villa.id}/plan`, 'POST', { days: 2, interests: ['things-to-do', 'cafes'], pace: 'relaxed' }, { cookie: admin.cookie });
  assert.equal(plan.status, 200);
  assert.equal(plan.result.provider, 'ai');
  assert.deepEqual(plan.result.days.map(day => day.stops.map(stop => stop.id)), [[candidateA.id], [candidateB.id]]);
  assert.deepEqual(plan.result.days.map(day => day.focus), ['things-to-do', 'cafes'], 'day focus follows its actual first stop, not model text or input order');
  assert.equal((await app.request(`/api/villas/${villa.id}/places/${candidateA.id}`)).status, 200);
  assert.equal((await app.request(`/api/villas/${villa.id}/places/${candidateB.id}`)).status, 404, 'details outside the 50 km villa radius are rejected');
});

test('AI villa plan rejects model-invented place IDs and falls back to a grounded local plan', async t => {
  const candidate = fixturePlace('ChIJfixtureC12', 'Verified place');
  const places = Object.assign(async () => null, { searchNearby: async () => ({ status: 200, data: { places: [candidate] } }) });
  const app = await startApp(t, { env: { VILLA_ADMIN_EMAILS: 'admin@example.com' }, places, ai: { apiKey: 'test-only', model: 'fixture-model' }, villaResearch: async () => ({ text: JSON.stringify({ days: [{ stops: ['made-up-place'] }] }) }) });
  const admin = await signUp(app.request, 'admin');
  const villa = await createVilla(app.request, admin.cookie);
  const plan = await app.request(`/api/villas/${villa.id}/plan`, 'POST', { days: 1, pace: 'relaxed' }, { cookie: admin.cookie });
  assert.equal(plan.result.provider, 'local');
  assert.match(plan.result.fallbackReason, /verified plan/);
  assert.deepEqual(plan.result.days[0].stops.map(stop => stop.id), [candidate.id]);
  assert.equal(plan.result.days.flatMap(day => day.stops).some(stop => stop.id === 'made-up-place'), false);
});
