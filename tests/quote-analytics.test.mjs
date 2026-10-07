import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/quote-analytics.js', import.meta.url), 'utf8');

function setup({ search = '?utm_source=instagram&utm_medium=social&utm_campaign=october_launch&email=traveler%40example.com', referrer = 'https://www.instagram.com/reel/secret?token=private', existing = {} } = {}) {
  const values = new Map(Object.entries(existing));
  const batches = [];
  let users = 0;
  class FakeClientApp {
    constructor(options) {
      assert.equal(options.automaticSideEffects, false);
      assert.equal(options.analytics.enabled, false);
      this[Symbol.for('StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals')] = {
        sendAnalyticsEventBatch: async body => {
          batches.push(JSON.parse(body));
          return { status: 'ok', data: { ok: true } };
        },
      };
    }
    async getUser(options) { users++; assert.equal(options.or, 'anonymous'); return {}; }
  }
  const window = { FakeHexclaveClientApp: FakeClientApp, addEventListener() {} };
  const context = {
    window,
    location: { search, pathname: '/contact.html' },
    document: { referrer },
    URL, URLSearchParams, Symbol, Math, Date, crypto: { randomUUID: () => 'event-uuid' },
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value),
    },
    sessionStorage: { getItem: () => null, removeItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({ hexclaveProjectId: 'project-id' }) }),
  };
  const script = source.replace("import('https://esm.sh/@hexclave/js@1.0.125')", 'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })');
  vm.runInNewContext(script, context);
  return { analytics: window.FridayQuoteAnalytics, batches, values, get users() { return users; } };
}

test('first touch keeps sanitized campaign fields and sends one non-PII quote_requested event', async () => {
  const fixture = setup();
  assert.deepEqual(JSON.parse(fixture.values.get('friday.quote-attribution.v1')), {
    source: 'instagram', medium: 'social', campaign: 'october_launch', referrer: 'www.instagram.com',
  });
  await fixture.analytics.track('planner', 'handoff-123');
  await fixture.analytics.track('planner', 'handoff-123');
  assert.equal(fixture.batches.length, 1);
  const event = fixture.batches[0].events[0];
  assert.equal(event.event_type, 'quote_requested');
  assert.equal(event.data.path, 'planner');
  assert.equal(event.data.request_id, 'handoff-123');
  assert.equal(event.data.source, 'instagram');
  assert.equal(event.data.medium, 'social');
  assert.equal(event.data.campaign, 'october_launch');
  assert.equal(event.data.referrer, 'www.instagram.com');
  assert.equal(JSON.stringify(event).includes('traveler@example.com'), false);
  assert.equal(JSON.stringify(event).includes('/reel/secret'), false);
  assert.equal(JSON.stringify(event).includes('token=private'), false);
  assert.equal(fixture.users, 1);
});

test('first touch is not replaced on later pages and invalid path tags fall back to enquiry', async () => {
  const fixture = setup({ existing: { 'friday.quote-attribution.v1': JSON.stringify({ source: 'instagram', medium: 'social', campaign: 'first', referrer: 'instagram.com' }) } });
  assert.equal(fixture.analytics.firstTouch().campaign, 'first');
  await fixture.analytics.track('unknown', 'enquiry-1');
  assert.equal(fixture.batches[0].events[0].data.path, 'enquiry');
  assert.equal(fixture.batches[0].events[0].data.source, 'instagram');
});
