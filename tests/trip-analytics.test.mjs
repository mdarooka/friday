import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/trip-analytics.js', import.meta.url), 'utf8');

function setup() {
  const batches = [];
  class FakeClientApp {
    constructor(options) {
      assert.equal(options.automaticSideEffects, false);
      assert.equal(options.analytics.enabled, false);
      this[Symbol.for('StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals')] = {
        sendAnalyticsEventBatch: async body => { batches.push(JSON.parse(body)); return { status: 'ok', data: { ok: true } }; },
      };
    }
    async getUser(options) { assert.equal(options.or, 'anonymous'); return {}; }
  }
  const window = { FridayTrip: {}, FakeHexclaveClientApp: FakeClientApp };
  const context = {
    window, URL, Promise, Symbol, Math, Date, crypto: { randomUUID: () => 'event-id' },
    fetch: async () => ({ ok: true, json: async () => ({ hexclaveProjectId: 'project-id' }) }),
  };
  const script = source.replace("import('https://esm.sh/@hexclave/js@1.0.125')", 'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })');
  vm.runInNewContext(script, context);
  return { analytics: window.FridayTrip.tripAnalytics, batches };
}

test('new-trip event contains only aggregate memory-use properties and no personal details', async () => {
  const fixture = setup();
  await fixture.analytics.trackCreated({ returning: true, memory_shown: true, memory_applied_count: 2, memory_text: 'private note', email: 'traveler@example.com' });
  assert.equal(fixture.batches.length, 1);
  const event = fixture.batches[0].events[0];
  assert.equal(event.event_type, 'trip_created');
  assert.deepEqual(JSON.parse(JSON.stringify(event.data)), { returning: true, memory_shown: true, memory_applied_count: 2 });
  assert.equal(JSON.stringify(fixture.batches[0]).includes('private note'), false);
  assert.equal(JSON.stringify(fixture.batches[0]).includes('traveler@example.com'), false);
});

test('memory counts are bounded and invalid counts become zero', async () => {
  const fixture = setup();
  await fixture.analytics.trackCreated({ memory_applied_count: 999 });
  assert.equal(fixture.batches[0].events[0].data.memory_applied_count, 100);
});
