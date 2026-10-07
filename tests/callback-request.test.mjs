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
  const tripContext = { name: 'Goa weekend', destination: 'Goa', startDate: '2026-11-12', endDate: '2026-11-16' };
  const submitted = await request('/api/callbacks', 'POST', { name: 'Traveler Jane', phone: '+91 98765-43210', bestTime: 'afternoon', entryPoint: 'planner', tripId: 'trip_123', tripContext }, { cookie: admin.cookie });
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
  assert.match(notification, /Goa weekend/);
  assert.match(notification, /2026-11-12/);

  const response = await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(response.status, 200);
  const callback = response.result.quotes.find(row => row.id === submitted.result.id);
  assert.equal(callback.kind, 'callback');
  assert.equal(callback.name, 'Traveler Jane');
  assert.equal(callback.phone, '+919876543210');
  assert.equal(callback.bestTime, 'afternoon');
  assert.equal(callback.entryPoint, 'planner');
  assert.equal(callback.tripId, 'trip_123');
  assert.deepEqual(callback.tripContext, tripContext);
  const ownStatus = await request('/api/callbacks?tripId=trip_123', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(ownStatus.status, 200);
  assert.deepEqual(ownStatus.result.requests.map(row => row.status), ['new']);
  const other = await signUp(request, 'OtherTraveler');
  const otherStatus = await request('/api/callbacks?tripId=trip_123', 'GET', undefined, { cookie: other.cookie });
  assert.deepEqual(otherStatus.result.requests, []);
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

test('WhatsApp number is exposed only when a valid international number is configured', async t => {
  const { request } = await startApp(t, { env: { FRIDAY_WHATSAPP_NUMBER: '+91 98765-43210' } });
  const valid = await request('/api/capabilities');
  assert.equal(valid.result.whatsappNumber, '919876543210');
  const { request: invalidRequest } = await startApp(t, { env: { FRIDAY_WHATSAPP_NUMBER: 'not-a-number' } });
  assert.equal((await invalidRequest('/api/capabilities')).result.whatsappNumber, '');
});

test('planner contact rail stays off shared-trip links', async () => {
  const integrations = await readFile(new URL('../assets/js/trip-integrations.js', import.meta.url), 'utf8');
  let appended = 0;
  const document = {
    body: { appendChild: () => { appended += 1; } },
    querySelector: selector => selector === '[data-app]' ? {} : null,
    createElement: () => { throw new Error('shared links should not create a contact rail'); },
  };
  vm.runInNewContext(integrations, {
    window: { location: { search: '?share=shared-trip-token' }, FridayTrip: {} },
    document,
    URLSearchParams,
  });
  assert.equal(appended, 0);
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
  assert.match(integrations, /Your designer has this trip/);
  assert.match(integrations, /We’ll reply within 30 hours/);
  assert.match(integrations, /https:\/\/wa\.me\//);
  assert.match(integrations, /startDate.*endDate/);
  assert.match(integrations, /answers: initialAnswers/);
  assert.match(integrations, /currentTripContext\.destination/);
  assert.match(integrations, /callbackCta\.innerHTML !== confirmedLabel/);
  assert.match(integrations, /if \(!designerNav\) doc\.body\.appendChild\(contactRail\)/);
  assert.match(integrations, /We’ll start your quote request with these trip details/);
  const plannerCss = await readFile(new URL('../assets/css/trip.css', import.meta.url), 'utf8');
  assert.match(plannerCss, /\.fx-planner-contact\s*\{[\s\S]*display:\s*flex/);
  assert.doesNotMatch(plannerCss, /\.fx-planner-contact\s*\{[^}]*position:\s*fixed/);
  assert.match(plannerCss, /\.fx-start-header__nav \.fx-planner-contact/);
  assert.match(contact, /Already planning\? Talk to your designer/);
  assert.match(contact, /Your enquiry will be sent to Friday\. A travel designer replies within 30 hours of an enquiry\./);
  const help = await readFile(new URL('../help.html', import.meta.url), 'utf8');
  const generator = await readFile(new URL('../build/generate.js', import.meta.url), 'utf8');
  assert.match(help, /How does a quote work\?/);
  assert.match(help, /What does Gmail or Calendar access mean\?/);
  assert.match(help, /A travel designer replies within 30 hours of an enquiry/);
  assert.match(help, /mailto:manavdarooka1@gmail\.com/);
  assert.match(generator, /How does a quote work\?/);
  assert.match(generator, /What does Gmail or Calendar access mean\?/);
  assert.match(generator, /A travel designer replies within 30 hours of an enquiry/);
});


test('callback phone patterns use the same current-browser validation on contact and planner forms', async () => {
  const contact = await readFile(new URL('../contact.html', import.meta.url), 'utf8');
  const integrations = await readFile(new URL('../assets/js/trip-integrations.js', import.meta.url), 'utf8');
  const contactPattern = contact.match(/id="callback-phone"[^>]*pattern="([^"]+)"/);
  const plannerPattern = integrations.match(/form\.querySelector\('\[name=\"phone\"\]'\)\.pattern = '([^']+)'/);
  assert.ok(contactPattern, 'contact phone input has a pattern');
  assert.ok(plannerPattern, 'planner phone input has a pattern');
  const patterns = [contactPattern[1], JSON.parse('"' + plannerPattern[1] + '"')];
  for (const p of patterns) {
    const phone = new RegExp(`^(?:${p})$`, 'v');
    assert.equal(phone.test('+91 98765 43210'), true);
    assert.equal(phone.test('12345'), false);
    assert.equal(phone.test('9876543210'), true);
  }
  assert.equal(patterns[0], patterns[1], 'contact and planner patterns stay consistent');
});
