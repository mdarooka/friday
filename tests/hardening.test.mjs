import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { startApp, signUp, origin } from './helpers.mjs';
import { createApp } from '../server/app.mjs';
import { createGooglePlacesIntegration } from '../server/places.mjs';

/* A raw request, so the client cannot tidy the path before the server sees it. */
const raw = (base, rawPath, headers = {}) => new Promise((resolve, reject) => {
  const u = new URL(base);
  http.get({ host: u.hostname, port: u.port, path: rawPath, headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
});

test('static files: encoded or odd paths cannot leave the public set', async (t) => {
  const { base } = await startApp(t);
  assert.equal(await raw(base, '/assets/js/friday.js'), 200);
  for (const p of [
    '/assets/..%2Fbuild%2Fgenerate.js', '/assets/%2e%2e/build/generate.js', '/assets/js/..%2F..%2Fserver%2Fapp.mjs', '/assets/%2E%2E%2Fbuild%2Fdata.js',
    '/assets//js/friday.js', '//assets/js/friday.js', '/assets/js%5Cfriday.js', '/assets%5Cjs%5Cfriday.js', '/assets/js/friday.js%00.css',
    '/%E0%A4%A', '/build/generate.js', '/server/app.mjs', '/package.json', '/.env', '/.data/friday.sqlite'
  ]) assert.equal(await raw(base, p), 404, p);
});

test('static files: a symlink out of the root is not followed, and a symlinked root still works', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'friday-root-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'site/assets'), { recursive: true });
  await writeFile(path.join(dir, 'site/assets/ok.css'), 'a{}');
  await writeFile(path.join(dir, 'outside.css'), 'secret{}');
  await symlink(path.join(dir, 'outside.css'), path.join(dir, 'site/assets/link.css'));
  await symlink(path.join(dir, 'site'), path.join(dir, 'root-link'));
  const { base } = await startApp(t, { root: path.join(dir, 'root-link') });
  assert.equal(await raw(base, '/assets/ok.css'), 200);
  assert.equal(await raw(base, '/assets/link.css'), 404);
});

test('CSRF: development accepts an Origin that matches the Host; production accepts only APP_ORIGIN', async (t) => {
  const dev = await startApp(t);
  const body = (n) => ({ name: n, email: `${n}@example.com`, password: 'long test password 123' });
  const same = dev.base;   // http://127.0.0.1:<port>, the Host the client used
  assert.equal((await dev.request('/api/auth/signup', 'POST', body('LocalA'), { headers: { Origin: same } })).status, 200);
  assert.equal((await dev.request('/api/auth/login', 'POST', body('LocalA'), { headers: { Origin: same } })).status, 200);
  assert.equal((await dev.request('/api/auth/signup', 'POST', body('LocalB'))).status, 200);   // the configured APP_ORIGIN still works
  assert.equal((await dev.request('/api/auth/signup', 'POST', body('LocalC'), { headers: { Origin: 'http://evil.example' } })).status, 403);
  assert.equal((await dev.request('/api/auth/signup', 'POST', body('LocalD'), { headers: { Origin: 'http://127.0.0.1:1' } })).status, 403);
  assert.equal((await dev.request('/api/auth/signup', 'POST', body('LocalE'), { headers: { Origin: 'null' } })).status, 403);
  const prod = await startApp(t, { env: { NODE_ENV: 'production' }, origin: 'https://friday.example' });
  assert.equal((await prod.request('/api/auth/signup', 'POST', body('ProdA'), { headers: { Origin: prod.base } })).status, 403);
  const ok = await prod.request('/api/auth/signup', 'POST', body('ProdB'), { headers: { Origin: 'https://friday.example' } });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /; Secure/);
});

test('production refuses to start without APP_ORIGIN', () => {
  assert.throws(() => createApp({ dbPath: ':memory:', env: { NODE_ENV: 'production' } }), /APP_ORIGIN must be set/);
  createApp({ dbPath: ':memory:', env: { NODE_ENV: 'production', APP_ORIGIN: 'https://friday.example' } }).close();
});

test('rate limits key on the socket address unless TRUST_PROXY=1, then on the right-most forwarded hop', async (t) => {
  const direct = await startApp(t);
  const codes = [];
  for (let i = 0; i < 21; i++) codes.push((await direct.request('/api/itineraries', 'POST', { destination: 'goa', days: 1 }, { headers: { 'X-Forwarded-For': `9.9.9.${i}` } })).status);
  assert.equal(codes.at(-1), 429, 'a spoofed X-Forwarded-For does not escape the limit by default');

  const proxied = await startApp(t, { env: { TRUST_PROXY: '1' } });
  const go = (hop) => proxied.request('/api/itineraries', 'POST', { destination: 'goa', days: 1 }, { headers: { 'X-Forwarded-For': `spoofed-by-client, ${hop}` } });
  for (let i = 0; i < 20; i++) assert.equal((await go('10.0.0.1')).status, 201);
  assert.equal((await go('10.0.0.1')).status, 429);
  assert.equal((await go('10.0.0.2')).status, 201, 'another client behind the proxy has its own allowance');
});

test('login is throttled per email, whatever address the attempts come from', async (t) => {
  const { request } = await startApp(t, { env: { TRUST_PROXY: '1' } });
  await signUp(request, 'Throttled', { headers: { 'X-Forwarded-For': '10.1.0.1' } });
  const attempt = (i, email = 'throttled@example.com') => request('/api/auth/login', 'POST', { email, password: 'wrong password 123' }, { headers: { 'X-Forwarded-For': `10.1.1.${i}` } });
  for (let i = 0; i < 10; i++) assert.equal((await attempt(i)).status, 401);
  assert.equal((await attempt(10)).status, 429);
  assert.equal((await attempt(11, 'someone-else@example.com')).status, 401, 'other emails are unaffected');
});

/* ----- Google photo links ------------------------------------------------------------------------------------------ */

const photoFetch = async (url) => {
  const href = String(url);
  if (href.includes('/media')) return { ok: true, status: 200, json: async () => ({ photoUri: 'https://lh3.googleusercontent.com/photo-1' }) };
  throw new Error('unexpected fetch ' + href);
};
const stale = '/api/place-photo/Abcdef/abcdefgh?expires=1&sig=expired-signature';

test('saved photo links are re-signed when records are read, so they do not expire in storage', async (t) => {
  const places = createGooglePlacesIntegration({ apiKey: 'places-key', fetch: photoFetch });
  const { request } = await startApp(t, { places });
  const a = await signUp(request, 'PhotoOwner');
  const photo = { url: stale, placeId: 'Abcdef', photoReference: 'abcdefgh', attribution: 'Someone', sourceUrl: 'https://maps.example/x' };
  const saved = (await request('/api/places', 'POST', { data: { title: 'Garden', photos: [photo], claudeState: { photos: [{ url: stale }] } } }, { cookie: a.cookie })).result.record;
  const trip = (await request('/api/trips', 'POST', { data: { title: 'T', days: [{ title: 'D', items: [{ title: 'Garden', photos: [photo] }] }] } }, { cookie: a.cookie })).result.record;
  for (const fresh of [
    (await request('/api/places/' + saved.id, 'GET', undefined, { cookie: a.cookie })).result.record.data.photos[0].url,
    (await request('/api/places', 'GET', undefined, { cookie: a.cookie })).result.records[0].data.claudeState.photos[0].url,
    (await request('/api/trips/' + trip.id, 'GET', undefined, { cookie: a.cookie })).result.record.data.days[0].items[0].photos[0].url
  ]) {
    assert.notEqual(fresh, stale);
    const u = new URL(fresh, origin);
    assert.ok(Number(u.searchParams.get('expires')) > Date.now() + 10 * 60_000);
    const served = await request(fresh, 'GET', undefined, { cookie: a.cookie });
    assert.equal(served.status, 302);
    assert.match(served.headers.get('location'), /googleusercontent\.com/);
  }
  // The stale link itself is still refused.
  assert.equal((await request(stale, 'GET', undefined, { cookie: a.cookie })).status, 404);
});

test('shared trips carry their photos through a share-scoped route and nothing else', async (t) => {
  const places = createGooglePlacesIntegration({ apiKey: 'places-key', fetch: photoFetch });
  const app = await startApp(t, { places });
  const { request } = app;
  const a = await signUp(request, 'SharePhotos');
  const photo = { url: stale, attribution: 'Someone', sourceUrl: 'https://maps.example/x' };
  const trip = (await request('/api/trips', 'POST', { data: { title: 'Kyoto', days: [{ title: 'D', items: [{ title: 'Garden', photos: [photo, { url: 'javascript:alert(1)', sourceUrl: 'https://x.example' }, { url: 'https://img.example/a.jpg', attribution: 'B', sourceUrl: 'https://x.example' }] }] }] } }, { cookie: a.cookie })).result.record;
  const token = new URL((await request(`/api/trips/${trip.id}/share`, 'POST', {}, { cookie: a.cookie })).result.share.url, origin).searchParams.get('share');
  const shared = (await request('/api/shared/' + token)).result.trip;
  const urls = shared.days[0].items[0].photos.map((p) => p.url);
  assert.deepEqual(urls, [`/api/shared/${token}/photo/Abcdef/abcdefgh`, 'https://img.example/a.jpg']);
  const ok = await request(urls[0]);   // anonymous
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get('location'), /googleusercontent\.com/);
  assert.equal((await request(`/api/shared/${token}/photo/Zzzzzz/zzzzzzzz`)).status, 404, 'a photo the trip does not reference');
  assert.equal((await request(`/api/shared/${'0'.repeat(64)}/photo/Abcdef/abcdefgh`)).status, 404, 'an unknown share');
  assert.equal((await request('/api/place-photo/Abcdef/abcdefgh')).status, 401, 'the plain route still needs sign-in');
  const db = new DatabaseSync(app.dbPath);
  db.prepare('UPDATE shares SET expires=0 WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  db.close();
  assert.equal((await request(urls[0])).status, 404, 'an expired share');
});

/* ----- logging ----------------------------------------------------------------------------------------------------- */

test('unexpected server errors are logged without leaking details to the client', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const { request } = await startApp(t, { places: async () => { throw new Error('boom from places'); } });
  const a = await signUp(request, 'Logger');
  const r = await request('/api/place-details?q=Kyoto', 'GET', undefined, { cookie: a.cookie });
  assert.equal(r.status, 500);
  assert.equal(JSON.stringify(r.result).includes('boom'), false);
  assert.ok(logged.mock.calls.some((c) => String(c.arguments[0]).includes('boom from places')));
});

test('production research configuration uses only OpenAI credentials', async (t) => {
  for (const env of [{ANTHROPIC_API_KEY:'legacy',AI_PROVIDER:'claude'}, {PERPLEXITY_API_KEY:'legacy',AI_PROVIDER:'perplexity'}]) {
    const {request}=await startApp(t,{env});
    assert.equal((await request('/api/capabilities')).result.research,false);
  }
  const {request}=await startApp(t,{env:{OPENAI_API_KEY:'server-only',AI_PROVIDER:'claude'}});
  const capabilities=(await request('/api/capabilities')).result;
  assert.equal(capabilities.research,true);
  assert.equal(JSON.stringify(capabilities).includes('server-only'),false);
});
