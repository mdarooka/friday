import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers.mjs';
import { KNOWLEDGE_PREAMBLE } from '../server/itinerary/providers/openai.mjs';
import { getDestination } from '../server/itinerary/catalog.mjs';

const require = createRequire(import.meta.url);
const cg = require('../assets/js/trip-chatgpt.js');
const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'knowledge');
const goa = getDestination('goa');
const body = { destination: 'goa', types: ['Beach downtime'], days: 3, pace: 'normal' };
const SIWC = { SIWC_CLIENT_ID: 'test-client', SIWC_SCOPES: 'openid offline_access api.responses', SIWC_MODEL: 'gpt-test', SIWC_ISSUER: 'https://auth.example.test/' };

test('capabilities: chatgpt block exists only when configured, public values only', async (t) => {
  const off = await startApp(t);
  assert.deepEqual((await off.request('/api/capabilities')).result.chatgpt, { enabled: false });

  const on = await startApp(t, { env: { ...SIWC, SIWC_CLIENT_SECRET: 'shh-secret', OPENAI_API_KEY: 'sk-never-shown' } });
  const { chatgpt } = (await on.request('/api/capabilities')).result;
  assert.deepEqual(chatgpt, {
    enabled: true, clientId: 'test-client', issuer: 'https://auth.example.test', scopes: 'openid offline_access api.responses',
    model: 'gpt-test', redirectUri: 'http://localhost:4871/chatgpt-callback.html'
  });
  const raw = JSON.stringify((await on.request('/api/capabilities')).result);
  assert.ok(!/shh-secret|sk-never-shown/.test(raw));

  const d = await startApp(t, { env: { SIWC_CLIENT_ID: 'c' } });
  const def = (await d.request('/api/capabilities')).result.chatgpt;
  assert.equal(def.issuer, 'https://auth.openai.com');
  assert.equal(def.scopes, 'openid profile email offline_access');
  assert.equal(def.model, 'gpt-5-mini');
});

test('the callback page is served and carries no secrets', async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(base + '/chatgpt-callback.html');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('friday-chatgpt-callback') && html.includes('location.origin'));
  assert.ok(!/client_secret|access_token|refresh_token/.test(html));
});

test('POST /api/itineraries/prompt shares the prompt builder and knowledge', async (t) => {
  const { request } = await startApp(t, { env: { ...SIWC, KNOWLEDGE_DIR: FIX } });
  const r = await request('/api/itineraries/prompt', 'POST', body);
  assert.equal(r.status, 200);
  assert.equal(r.result.model, 'gpt-test');
  assert.ok(r.result.instructions.includes(KNOWLEDGE_PREAMBLE));
  assert.ok(r.result.instructions.includes('## Procedure'));
  assert.equal(JSON.parse(r.result.input).destination, goa.name);
  assert.equal(r.result.schema.required[0], 'days');

  assert.equal((await request('/api/itineraries/prompt', 'POST', { ...body, destination: 'nope' })).status, 404);
  assert.equal((await request('/api/itineraries/prompt', 'POST', { ...body, days: 99 })).status, 400);
  assert.equal((await request('/api/itineraries/prompt', 'POST', body, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/itineraries/prompt', 'GET')).status, 405);
});

const placeIds = Object.keys(goa.places).filter((id) => goa.places[id].kind !== 'stay');
const goodDraft = () => ({
  days: [0, 1, 2].map((i) => ({ area: goa.areas[0].id, stops: placeIds.slice(i * 3, i * 3 + 3).map((id) => ({ place: id, note: 'Go early.' })) }))
});

test('POST /api/itineraries with a ChatGPT draft: provider chatgpt, catalog ids only', async (t) => {
  const { request } = await startApp(t);
  const draft = goodDraft();
  draft.days[0].stops.push({ place: 'invented-place', note: 'x' }, { place: placeIds[3], note: 'repeat of day two' });
  const r = await request('/api/itineraries', 'POST', { ...body, draft, source: 'chatgpt' });
  assert.equal(r.status, 201);
  assert.equal(r.result.provider, 'chatgpt');
  assert.equal(r.result.fallbackReason, undefined);
  assert.equal(r.result.plan.days.length, 3);
  const used = r.result.plan.days.flatMap((d) => d.items.map((i) => i.place));
  assert.ok(used.every((id) => Object.hasOwn(goa.places, id)));
  assert.ok(!used.includes('invented-place'));
  assert.equal(new Set(used.filter((id) => goa.places[id].kind !== 'stay')).size, used.filter((id) => goa.places[id].kind !== 'stay').length);
  const got = await request('/api/itineraries/' + r.result.id);
  assert.equal(got.result.provider, 'chatgpt');
});

test('a garbage ChatGPT draft falls back to the server provider with a reason', async (t) => {
  const { request } = await startApp(t);
  for (const draft of [{ days: [] }, { nope: 1 }, { days: [{ stops: [{ place: 'zzz', note: 'x' }] }] }]) {
    const r = await request('/api/itineraries', 'POST', { ...body, draft, source: 'chatgpt' });
    assert.equal(r.status, 201);
    assert.equal(r.result.provider, 'local');
    assert.match(r.result.fallbackReason, /ChatGPT draft unusable/);
    assert.equal(r.result.plan.days.length, 3);
  }
  assert.equal((await request('/api/itineraries', 'POST', { ...body, draft: 'text', source: 'chatgpt' })).status, 400);
  assert.equal((await request('/api/itineraries', 'POST', { ...body, draft: goodDraft() })).status, 400);   // no source
});

test('an oversize draft is refused', async (t) => {
  const { request } = await startApp(t);
  const big = { days: [{ area: 'x', stops: [{ place: placeIds[0], note: 'n'.repeat(45000) }] }] };
  assert.equal((await request('/api/itineraries', 'POST', { ...body, draft: big, source: 'chatgpt' })).status, 413);
  const huge = { days: [{ area: 'x', stops: [{ place: placeIds[0], note: 'n'.repeat(80000) }] }] };
  assert.equal((await request('/api/itineraries', 'POST', { ...body, draft: huge, source: 'chatgpt' })).status, 413);
});

/* ---- browser module, pure helpers ---- */

test('PKCE S256 challenge matches the RFC 7636 example', async () => {
  assert.equal(await cg.pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('authorize URL carries every PKCE/OIDC parameter', () => {
  const u = new URL(cg.buildAuthorizeUrl({
    endpoint: 'https://auth.example.test/authorize', clientId: 'cid', redirectUri: 'http://localhost:4871/chatgpt-callback.html',
    scopes: 'openid profile', state: 's1', nonce: 'n1', challenge: 'ch'
  }));
  const q = Object.fromEntries(u.searchParams);
  assert.equal(u.origin + u.pathname, 'https://auth.example.test/authorize');
  assert.deepEqual(q, {
    response_type: 'code', client_id: 'cid', redirect_uri: 'http://localhost:4871/chatgpt-callback.html', scope: 'openid profile',
    state: 's1', nonce: 'n1', code_challenge: 'ch', code_challenge_method: 'S256'
  });
});

test('state check, callback parsing, id token decoding, output extraction', () => {
  assert.equal(cg.checkState('abc', 'abc'), true);
  assert.equal(cg.checkState('abc', 'abd'), false);
  assert.equal(cg.checkState('abc', 'abcd'), false);
  assert.equal(cg.checkState('', ''), false);
  assert.equal(cg.checkState('abc', undefined), false);
  assert.deepEqual(cg.parseCallback('?code=a%20b&state=s'), { code: 'a b', state: 's' });
  const jwt = 'x.' + Buffer.from(JSON.stringify({ email: 'a@b.test', name: 'Ann' })).toString('base64url') + '.y';
  assert.equal(cg.decodeIdToken(jwt).email, 'a@b.test');
  assert.equal(cg.decodeIdToken('garbage'), null);
  assert.equal(cg.extractOutput({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }] }).text, '{"a":1}');
  assert.ok(cg.extractOutput({ output: [{ content: [{ type: 'refusal', refusal: 'no' }] }] }).refusal);
  const b = cg.responsesBody({ model: 'm', instructions: 'i', input: 'x', schema: { type: 'object' } });
  assert.equal(b.text.format.type, 'json_schema');
  assert.equal(b.text.format.strict, true);
});
