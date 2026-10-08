import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaudeProvider } from '../server/itinerary/providers/claude.mjs';
import { createItineraryService } from '../server/itinerary/service.mjs';
import { getDestination } from '../server/itinerary/catalog.mjs';

const goa = getDestination('goa');
const request = { destination: 'goa', types: ['Beach downtime'], days: 1, dates: { start: '2027-01-10' }, pace: 'normal', base: null };
const ids = Object.keys(goa.places).filter((id) => goa.places[id].kind !== 'stay');
const okFetch = (capture) => async (url, init) => {
  capture.url = url; capture.init = init; capture.body = JSON.parse(init.body);
  return { ok: true, status: 200, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'submit_itinerary', input: { days: [{ area: 'nope', stops: [{ place: ids[0], note: 'Go early.' }, { place: 'invented-place', note: 'x' }] }] } }] }) };
};

test('claude provider calls the Anthropic Messages API and validates against the catalog', async () => {
  const cap = {};
  const plan = await createClaudeProvider({ apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', fetch: okFetch(cap) }).generate(goa, request);
  assert.equal(cap.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(cap.init.headers['x-api-key'], 'sk-ant-test');
  assert.equal(cap.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(cap.body.model, 'claude-sonnet-5-5');
  assert.equal(cap.body.tools[0].name, 'submit_itinerary');
  assert.equal(plan.days.length, 1);
  const placed = plan.days[0].items.map((i) => i.place);
  assert.ok(placed.includes(ids[0]));
  assert.ok(!placed.includes('invented-place'));
});

test('claude provider accepts a JSON text reply and rejects unusable output', async () => {
  const text = JSON.stringify({ days: [{ area: goa.areas[0].id, stops: [{ place: ids[1], note: 'n' }] }] });
  const plan = await createClaudeProvider({ apiKey: 'k', model: 'm', fetch: async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '```json\n' + text + '\n```' }] }) }) }).generate(goa, request);
  assert.equal(plan.days.length, 1);
  const bad = createClaudeProvider({ apiKey: 'k', model: 'm', fetch: async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'sorry' }] }) }) });
  await assert.rejects(bad.generate(goa, request), /not valid JSON/);
  const refused = createClaudeProvider({ apiKey: 'k', model: 'm', fetch: async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'refusal', content: [] }) }) });
  await assert.rejects(refused.generate(goa, request), /declined/);
});

test('itinerary service falls back to local on failure and redacts the key', async () => {
  const svc = createItineraryService({ env: { ANTHROPIC_API_KEY: 'sk-ant-secret' }, fetch: async () => ({ ok: false, status: 500, text: async () => 'boom sk-ant-secret' }) });
  assert.equal(svc.name, 'claude');
  const out = await svc.generate(goa, request);
  assert.equal(out.provider, 'local');
  assert.ok(out.plan.days.length);
  assert.ok(!out.fallbackReason.includes('sk-ant-secret'));
  assert.equal(createItineraryService({ env: {} }).name, 'local');
  assert.throws(() => createItineraryService({ env: { ITINERARY_PROVIDER: 'gpt' } }), /ITINERARY_PROVIDER/);
});
