import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { startApp, signUp } from './helpers.mjs';

const emailConfig = { HEXCLAVE_PROJECT_ID: 'project-test', HEXCLAVE_SECRET_SERVER_KEY: 'server-secret-test' };

test('callback requests validate Indian numbers, enter the quotes queue, and notify the team', async t => {
  const sends = [];
  const { request, db } = await startApp(t, {
    env: { ...emailConfig, AUTH_PROVIDER: 'local', QUOTE_ADMIN_EMAILS: 'quoteadmin@example.com', FRIDAY_ENQUIRY_EMAIL: 'studio@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
    emailFetch: async (url, options) => { sends.push({ url, body: JSON.parse(options.body) }); return new Response(null, { status: 202 }); },
  });
  const admin = await signUp(request, 'QuoteAdmin');
  assert.equal((await request('/api/callbacks', 'POST', { name: 'Traveler', phone: '12345', bestTime: 'morning', entryPoint: 'contact' })).status, 422);
  assert.equal((await request('/api/callbacks', 'POST', { name: 'Traveler', phone: '9876543210', bestTime: 'whenever', entryPoint: 'contact' })).status, 422);
  const submitted = await request('/api/callbacks', 'POST', { name: 'Traveler Jane', phone: '+91 98765-43210', bestTime: 'afternoon', entryPoint: 'planner', tripId: 'trip_123' });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.result.saved, true);
  assert.equal(submitted.result.delivery.notification, 'provider_accepted');
  assert.equal(sends.length, 1);
  assert.equal(sends[0].body.emails[0], 'studio@example.com');
  assert.match(sends[0].body.subject, /Friday travel enquiry/);
  const notification = sends[0].body.html;
  assert.match(notification, /Call me back/);
  assert.match(notification, /\+919876543210/);
  assert.match(notification, /afternoon/);

  const response = await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(response.status, 200);
  const callback = response.result.quotes.find(row => row.id === submitted.result.id);
  assert.equal(callback.kind, 'callback');
  assert.equal(callback.name, 'Traveler Jane');
  assert.equal(callback.phone, '+919876543210');
  assert.equal(callback.bestTime, 'afternoon');
  assert.equal(callback.entryPoint, 'planner');
  assert.equal(callback.tripId, 'trip_123');
  assert.equal((await db.one('SELECT count(*) AS n FROM callback_requests')).n, 1);
});

test('callback route rate-limits repeat submissions', async t => {
  const { request } = await startApp(t);
  const data = { name: 'Traveler', phone: '9876543210', bestTime: 'morning', entryPoint: 'contact' };
  for (let i = 0; i < 5; i++) assert.equal((await request('/api/callbacks', 'POST', data)).status, 201);
  const limited = await request('/api/callbacks', 'POST', data);
  assert.equal(limited.status, 429);
});

test('callback analytics sends one privacy-safe event with source attribution', async () => {
  const source = (await readFile(new URL('../assets/js/friday-analytics.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../assets/js/callback-analytics.js', import.meta.url), 'utf8'));
  const values = new Map();
  const batches = [];
  class FakeClientApp {
    constructor(options) {
      assert.equal(options.automaticSideEffects, false);
      this[Symbol.for('StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals')] = {
        sendAnalyticsEventBatch: async body => { batches.push(JSON.parse(body)); return { status: 'ok', data: { ok: true } }; },
      };
    }
    async getUser(options) { assert.equal(options.or, 'anonymous'); }
  }
  const window = { FakeHexclaveClientApp: FakeClientApp, addEventListener() {} };
  const context = {
    window, location: { search: '?utm_source=instagram&utm_medium=social&utm_campaign=october_launch' },
    document: { referrer: 'https://www.instagram.com/reel/private-path?token=secret' },
    URL, URLSearchParams, Symbol, Math, Date, crypto: { randomUUID: () => 'event-uuid' },
    localStorage: { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value) },
    fetch: async () => ({ ok: true, json: async () => ({ hexclaveProjectId: 'project-id' }) }),
  };
  const script = source.replace("import('https://esm.sh/@hexclave/js@1.0.125')", 'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })');
  vm.runInNewContext(script, context);
  await window.FridayCallbackAnalytics.track('planner', 'request-uuid');
  await window.FridayCallbackAnalytics.track('planner', 'request-uuid');
  assert.equal(batches.length, 1);
  const event = batches[0].events[0];
  assert.equal(event.event_type, 'callback_requested');
  assert.deepEqual(JSON.parse(JSON.stringify(event.data)), {
    request_id: 'request-uuid', path: 'planner', entry_point: 'planner', source: 'instagram', medium: 'social', campaign: 'october_launch', referrer: 'www.instagram.com',
  });
  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes('Traveler'), false);
  assert.equal(serialized.includes('+919876543210'), false);
  assert.equal(serialized.includes('private-path'), false);
  assert.equal(serialized.includes('token=secret'), false);
});

test('planner callback button is omitted on shared-trip links but remains in the planner', async () => {
  const integrations = await readFile(new URL('../assets/js/trip-integrations.js', import.meta.url), 'utf8');
  function load(search) {
    const buttons = [];
    const document = {
      body: { appendChild: button => buttons.push(button) },
      querySelector: selector => selector === '[data-app]' ? {} : null,
      createElement: () => ({ setAttribute() {}, addEventListener() {} }),
    };
    class Observer { observe() {} }
    vm.runInNewContext(integrations, {
      window: { location: { search }, FridayTrip: {} }, document,
      URLSearchParams, MutationObserver: Observer,
    });
    return buttons;
  }

  assert.equal(load('?share=shared-trip-token').length, 0);
  assert.equal(load('').length, 1);
});

test('generated contact page and planner include callback form and analytics script', async () => {
  const contact = await readFile(new URL('../contact.html', import.meta.url), 'utf8');
  const planner = await readFile(new URL('../trip.html', import.meta.url), 'utf8');
  assert.match(contact, /data-callback-form/);
  assert.match(contact, /Call me back/);
  assert.match(contact, /callback-analytics\.js/);
  assert.match(planner, /callback-analytics\.js/);
  const integrations = await readFile(new URL('../assets/js/trip-integrations.js', import.meta.url), 'utf8');
  assert.match(integrations, /label: 'Call me back'/);
  assert.match(integrations, /fx-planner-callback/);
  assert.match(await readFile(new URL('../assets/css/trip.css', import.meta.url), 'utf8'), /\.fx-planner-callback\s*\{[\s\S]*position:\s*fixed/);
});
