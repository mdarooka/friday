import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.mjs';
import { createOpenAIProvider, buildPrompt } from '../server/itinerary/providers/openai.mjs';
import { createAuth } from '../server/itinerary/providers/openai-auth.mjs';
import { getDestination } from '../server/itinerary/catalog.mjs';

const goa = getDestination('goa');
const request = { destination: 'goa', types: ['Beach downtime'], days: 3, dates: { start: '2027-01-10' }, pace: 'normal', base: null };
const auth = createAuth({ OPENAI_API_KEY: 'sk-secret-123' });

const ok = (content) => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) });
const day = (area, ...ids) => ({ area, stops: ids.map((place) => ({ place, note: 'Note for ' + place })) });

test('the auth source is separate from the provider, and reads OPENAI_API_KEY', async () => {
  assert.deepEqual(await auth.getAuth(), { baseUrl: 'https://api.openai.com/v1', headers: { Authorization: 'Bearer sk-secret-123' } });
  assert.equal(createAuth({}).getAuth(), null);
  assert.equal(createAuth({ OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'http://x/v1/' }).getAuth().baseUrl, 'http://x/v1');
  assert.equal(auth.redact('a sk-secret-123 b'), 'a [redacted] b');
  assert.throws(() => createAuth({ OPENAI_AUTH: 'chatgpt' }), /OPENAI_AUTH/);
});

test('the prompt carries only ids, names, kinds and areas', () => {
  const { user } = buildPrompt(goa, request);
  const j = JSON.parse(user);
  const p = j.catalog.places.find((x) => x.id === 'baga-beach');
  assert.deepEqual(Object.keys(p).sort(), ['area', 'id', 'kind', 'name']);
  assert.ok(!user.includes(goa.places['baga-beach'].blurb));
  assert.ok(!j.catalog.places.some((x) => x.kind === 'stay'));
  assert.equal(j.stopsPerDay, 3);
});

test('a valid model response is used, and the request is well formed', async () => {
  let seen;
  const fetchMock = async (url, init) => {
    seen = { url, init };
    return ok({ days: [day('calangute', 'baga-beach', 'brittos'), day('anjuna', 'anjuna-beach', 'gunpowder'), day('vagator', 'chapora-fort', 'thalassa')] })();
  };
  const p = createOpenAIProvider({ auth, model: 'gpt-5-mini', fetch: fetchMock });
  const plan = await p.generate(goa, request);
  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen.init.headers.Authorization, 'Bearer sk-secret-123');
  const sent = JSON.parse(seen.init.body);
  assert.equal(sent.model, 'gpt-5-mini');
  assert.equal(sent.response_format.type, 'json_schema');
  assert.equal(sent.response_format.json_schema.strict, true);
  assert.deepEqual(plan.days.map((d) => d.area), ['calangute', 'anjuna', 'vagator']);
  assert.deepEqual(plan.days[0].items.slice(1).map((i) => i.place), ['baga-beach', 'brittos']);
  assert.equal(plan.days[0].items[1].note, 'Note for baga-beach');
  assert.equal(plan.days[0].date, '2027-01-10');
  assert.ok(plan.stay);
  assert.equal(plan.days[0].items[0].place, plan.stay);
  assert.equal(plan.days[0].town, 'Candolim');
});

test('unknown ids, hotels and repeats are dropped; empty notes fall back to the blurb', async () => {
  const resp = { days: [
    day('calangute', 'baga-beach', 'made-up-place', 'taj-fort-aguada', 'brittos'),
    { area: 'nowhere', stops: [{ place: 'anjuna-beach', note: '' }, { place: 'baga-beach', note: 'again' }] },
    day('vagator', '__proto__', 'chapora-fort')
  ] };
  const plan = await createOpenAIProvider({ auth, model: 'm', fetch: ok(resp) }).generate(goa, request);
  const places = plan.days.map((d) => d.items.map((i) => i.place).filter((x) => x !== plan.stay));
  assert.deepEqual(places, [['baga-beach', 'brittos'], ['anjuna-beach'], ['chapora-fort']]);
  assert.equal(plan.days[1].area, 'anjuna');   // an invalid area is replaced by the first place's area
  assert.equal(plan.days[1].items[0].note, goa.places['anjuna-beach'].blurb);
});

test('too few usable days is an error', async () => {
  const p = createOpenAIProvider({ auth, model: 'm', fetch: ok({ days: [day('calangute', 'nope')] }) });
  await assert.rejects(p.generate(goa, request), /usable days/);
});

test('no credential is an error (so the service falls back)', async () => {
  const p = createOpenAIProvider({ auth: createAuth({}), model: 'm', fetch: async () => { throw new Error('should not be called'); } });
  await assert.rejects(p.generate(goa, request), /not configured/);
});

test('timeout aborts the request', async () => {
  const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }));
  const p = createOpenAIProvider({ auth, model: 'm', timeoutMs: 20, fetch: slow });
  await assert.rejects(p.generate(goa, request), /timed out/);
});

async function withServer(t, itineraryFetch, fn, env = {}) {
  const logs = [];
  const app = await startApp(t, { env: { ITINERARY_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-secret-123', ...env }, itineraryFetch, log: (m) => logs.push(m) });
  await fn(app.request, logs);
}
const make = (request) => request('/api/itineraries', 'POST', { destination: 'goa', types: ['Beach downtime'], days: 3 });

test('API: a valid model response is reported as provider openai', async (t) => {
  await withServer(t, ok({ days: [day('calangute', 'baga-beach'), day('anjuna', 'anjuna-beach'), day('vagator', 'chapora-fort')] }), async (request) => {
    const { result: j } = await make(request);
    assert.equal(j.provider, 'openai');
    assert.equal(j.fallbackReason, undefined);
    assert.equal(j.plan.days.length, 3);
  });
});

test('API: an upstream error falls back to local with a reason, and never leaks the key', async (t) => {
  const failing = async () => ({ ok: false, status: 401, text: async () => 'Incorrect API key provided: sk-secret-123' });
  await withServer(t, failing, async (request, logs) => {
    const r = await make(request);
    assert.equal(r.status, 201);
    const j = r.result;
    assert.equal(j.provider, 'local');
    assert.match(j.fallbackReason, /401/);
    assert.equal(j.plan.days.length, 3);
    assert.ok(!JSON.stringify(j).includes('sk-secret-123'));
    assert.ok(!logs.join('\n').includes('sk-secret-123'));
    const saved = (await request('/api/itineraries/' + j.id)).result;
    assert.equal(saved.provider, 'local');
    assert.ok(saved.fallbackReason);
    assert.ok(!JSON.stringify(saved).includes('sk-secret-123'));
  });
});

test('API: a network failure or bad JSON falls back to local', async (t) => {
  await withServer(t, async () => { throw new Error('connect ECONNREFUSED'); }, async (request) => {
    const { result: j } = await make(request);
    assert.equal(j.provider, 'local');
    assert.match(j.fallbackReason, /ECONNREFUSED/);
  });
  await withServer(t, async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) }), async (request) => {
    const { result: j } = await make(request);
    assert.equal(j.provider, 'local');
    assert.match(j.fallbackReason, /JSON/);
  });
});

test('API: openai requested without a key falls back to local', async (t) => {
  await withServer(t, async () => { throw new Error('no network expected'); }, async (request) => {
    const { result: j } = await make(request);
    assert.equal(j.provider, 'local');
    assert.match(j.fallbackReason, /not configured/);
  }, { OPENAI_API_KEY: '' });
});

test('API: OPENAI_MODEL, OPENAI_BASE_URL and OPENAI_TIMEOUT_MS are honoured', async (t) => {
  let seen;
  const capture = async (url, init) => { seen = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"days":[]}' } }] }) }; };
  await withServer(t, capture, async (request) => {
    assert.equal((await make(request)).result.provider, 'local');
    assert.equal(seen.url, 'http://proxy.example/v1/chat/completions');
    assert.equal(seen.body.model, 'custom-model');
  }, { OPENAI_MODEL: 'custom-model', OPENAI_BASE_URL: 'http://proxy.example/v1' });
  const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { const e = new Error('x'); e.name = 'AbortError'; reject(e); }));
  await withServer(t, slow, async (request) => {
    const { result: j } = await make(request);
    assert.equal(j.provider, 'local');
    assert.match(j.fallbackReason, /timed out after 25 ms/);
  }, { OPENAI_TIMEOUT_MS: '25' });
});
