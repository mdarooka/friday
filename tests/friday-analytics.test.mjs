import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = name => readFile(new URL(`../assets/js/${name}`, import.meta.url), 'utf8');
const scripts = await Promise.all(['friday-analytics.js', 'quote-analytics.js', 'callback-analytics.js', 'guide-analytics.js', 'trip-analytics.js', 'briefing-analytics.js'].map(read));

function setup({ failFirst = 0 } = {}) {
  const values = new Map();
  const batches = [];
  const counts = { clients: 0, fetches: 0, users: 0 };
  let failures = failFirst;
  class FakeHexclaveClientApp {
    constructor() {
      counts.clients++;
      this[Symbol.for('StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals')] = {
        sendAnalyticsEventBatch: async body => {
          if (failures > 0) { failures--; throw new Error('offline'); }
          batches.push(JSON.parse(body));
          return { status: 'ok', data: { ok: true } };
        },
      };
    }
    async getUser() { counts.users++; return {}; }
  }
  const window = { FakeHexclaveClientApp, FridayTrip: {}, addEventListener() {} };
  const context = {
    window,
    location: { pathname: '/contact.html', search: '?utm_source=instagram' },
    document: { referrer: '', addEventListener() {} },
    URL, URLSearchParams, Symbol, Math, Date, crypto: { randomUUID: (() => { let i = 0; return () => `id-${++i}`; })() },
    localStorage: { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    fetch: async () => { counts.fetches++; return { ok: true, json: async () => ({ hexclaveProjectId: 'project-id' }) }; },
  };
  const source = scripts.join('\n').replaceAll("import('https://esm.sh/@hexclave/js@1.0.125')", 'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })');
  vm.runInNewContext(source, context);
  return { window, batches, counts, values };
}

test('all feature scripts on one page share a single Hexclave client and capabilities lookup', async () => {
  const { window, batches, counts } = setup();
  await window.FridayQuoteAnalytics.track('enquiry', 'enquiry-1');
  await window.FridayCallbackAnalytics.track('contact', 'callback-1');
  await window.FridayTrip.tripAnalytics.trackCreated({ returning: true });
  await window.FridayBriefingAnalytics.track('briefing_opened', { trip_id: 'trip-1' });
  const types = batches.flatMap(batch => batch.events.map(event => event.event_type));
  assert.deepEqual(types, ['public_page_viewed', 'quote_requested', 'callback_requested', 'trip_created', 'briefing_opened']);
  assert.equal(counts.clients, 1);
  assert.equal(counts.fetches, 1);
  assert.equal(counts.users, 1);
});

test('quote and callback events share one first-touch source', async () => {
  const { window, batches } = setup();
  await window.FridayQuoteAnalytics.track('enquiry', 'enquiry-1');
  await window.FridayCallbackAnalytics.track('contact', 'callback-1');
  const [quote, callback] = batches.flatMap(batch => batch.events).filter(event => event.event_type !== 'public_page_viewed');
  assert.equal(quote.data.source, 'instagram');
  assert.equal(callback.data.source, 'instagram');
});

test('an event that fails to send stays queued and is delivered once on the next flush', async () => {
  const { window, batches, values } = setup({ failFirst: 2 });
  await window.FridayAnalytics.flush();
  assert.equal(batches.length, 0);
  assert.equal(JSON.parse(values.get('friday.analytics-events.v1')).length, 1);
  await window.FridayAnalytics.flush();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].events[0].event_type, 'public_page_viewed');
  await window.FridayAnalytics.flush();
  assert.equal(batches.length, 1);
  assert.equal(JSON.parse(values.get('friday.analytics-events.v1')).length, 0);
});

test('the planner reports new trips to the guide script under the name it exposes', async () => {
  const planner = await read('trip-app.js');
  assert.match(planner, /window\.FridayGuideAnalytics\.tripStarted\(t\)/);
  assert.doesNotMatch(planner, /FT\.guideAnalytics/);
});
