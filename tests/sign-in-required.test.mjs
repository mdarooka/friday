import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startApp, signUp } from './helpers.mjs';

const source = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

/* The owner's rule: exactly three things need an account: the AI features, talking to a designer, and requesting a quote. Everything else works signed out. */

const callback = { name: 'Traveler Jane', phone: '9876543210', bestTime: 'morning', entryPoint: 'contact' };
const commission = { name: 'Traveler Jane', email: 'jane@example.com', shape: 'A quiet week in Sicily' };

test('talking to a designer needs sign-in: signed out is 401 with the sign-in message, signed in is saved', async t => {
  const { request, db } = await startApp(t);
  const out = await request('/api/callbacks', 'POST', callback);
  assert.equal(out.status, 401);
  assert.equal(out.result.error, 'Please sign in to talk with a travel designer.');
  assert.equal((await db.one('SELECT count(*) AS n FROM callback_requests')).n, 0);
  const { cookie } = await signUp(request, 'Caller');
  const made = await request('/api/callbacks', 'POST', callback, { cookie });
  assert.equal(made.status, 201);
  assert.equal(made.result.saved, true);
  assert.equal((await db.one('SELECT count(*) AS n FROM callback_requests')).n, 1);
  // the pre-quote checklist questions are only a list of prompts and stay readable by anyone
  assert.equal((await request('/api/callbacks/checklist-items')).status, 200);
});

test('requesting a quote needs sign-in: signed out is 401 with the sign-in message, signed in is saved', async t => {
  const { request, db } = await startApp(t);
  const out = await request('/api/commissions', 'POST', commission);
  assert.equal(out.status, 401);
  assert.equal(out.result.error, 'Please sign in to request a quote.');
  assert.equal((await db.one('SELECT count(*) AS n FROM enquiries')).n, 0);
  const { cookie } = await signUp(request, 'Quoter');
  const made = await request('/api/commissions', 'POST', commission, { cookie });
  assert.equal(made.status, 201);
  assert.equal(made.result.saved, true);
  assert.equal((await db.one("SELECT count(*) AS n FROM enquiries WHERE kind='commissions'")).n, 1);
});

test('AI planning needs sign-in: itineraries and villa plans are 401 signed out', async t => {
  const { request } = await startApp(t);
  const out = await request('/api/itineraries', 'POST', { destination: 'goa', days: 2 });
  assert.equal(out.status, 401);
  assert.match(out.result.error, /sign in/i);
  assert.equal((await request('/api/villas/11111111-1111-4111-8111-111111111111/plan', 'POST', { days: 2 })).status, 401);
  const { cookie } = await signUp(request, 'Planner');
  assert.equal((await request('/api/itineraries', 'POST', { destination: 'goa', days: 2 }, { cookie })).status, 201);
});

test('every other AI route stays behind sign-in', async t => {
  const { request } = await startApp(t);
  const routes = [
    ['/api/research', { prompt: 'Where to eat in Goa?', tripId: 't1' }],
    ['/api/friday/plan', { message: 'Plan a trip' }],
    ['/api/friday/reel-chat', { message: 'hello' }],
    ['/api/friday/reels', { url: 'https://example.com/reel' }],
    ['/api/imports/extract', { url: 'https://example.com/post' }],
    ['/api/alerts/check', { alertId: 'a1' }],
    ['/api/bookings/parse-email', { text: 'Your booking is confirmed' }],
    ['/api/friday/handoffs', { draftId: 'd1' }],
  ];
  for (const [path, body] of routes) assert.equal((await request(path, 'POST', body)).status, 401, path);
});

test('nothing else is gated: newsletter, destination requests, destinations and the planner page work signed out', async t => {
  const { request } = await startApp(t);
  assert.equal((await request('/api/subscriptions', 'POST', { email: 'reader@example.com', consent: true })).status, 201);
  assert.equal((await request('/api/destination-requests', 'POST', { destination: 'Coorg', name: 'Traveler', email: 'traveler@example.com' })).status, 201);
  assert.equal((await request('/api/destinations')).status, 200);
  assert.equal((await request('/api/capabilities')).status, 200);
  assert.equal((await request('/trip.html')).status, 200);
  assert.equal((await request('/contact.html')).status, 200);
  assert.equal((await request('/villas.html')).status, 200);
});

test('the contact page keeps both forms visible and says a sign-in is needed only on the callback and quote buttons', async () => {
  const page = await source('contact.html');
  const hints = [...page.matchAll(/data-signin-hint="(\w+)"[^>]*>([^<]*)/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(hints.map((h) => h[0]), ['designer', 'quote']);
  for (const hint of hints) assert.match(hint[1], /You(?:&rsquo;|\u2019)ll need to sign in to send this\./);
  assert.match(page, /href="trip\.html\?signin=designer&amp;return=contact\.html%23callback-title"/);
  assert.match(page, /href="trip\.html\?signin=quote&amp;return=contact\.html%23quote"/);
  assert.match(page, /data-callback-form/);
  assert.match(page, /id="quote" data-commission/);
  // the destination request and the newsletter signup stay open
  assert.equal((page.match(/data-signin-hint/g) || []).length, 2);
  assert.match(page, /data-destination-form/);
});

test('static pages ask who is signed in only through the shared helper, and gated posts carry the Hexclave token', async () => {
  const friday = await source('assets/js/friday.js');
  assert.match(friday, /import\('https:\/\/esm\.sh\/@hexclave\/js@1\.0\.125'\)/);
  assert.match(friday, /getAuthorizationHeader/);
  assert.match(friday, /postSignedIn\('\/api\/callbacks'/);
  assert.match(friday, /postSignedIn\('\/api\/commissions'/);
  // the newsletter and destination forms keep posting without it
  assert.match(friday, /submit\(f,'\/api\/subscriptions'\)/);
  assert.match(friday, /fetch\('\/api\/destination-requests'/);
  assert.equal((friday.match(/esm\.sh/g) || []).length, 1, 'Hexclave is loaded from one place only');
});

test('the planner opens signed out; sign-in is asked for only by the gated actions', async () => {
  const app = await source('assets/js/trip-app.js');
  assert.doesNotMatch(app, /authRequired !== false\) \{ authGate\(main\); return; \}/);
  assert.match(app, /FT\.requireSignIn = requireSignIn/);
  assert.match(app, /Please sign in to talk with a travel designer\./);
  assert.match(app, /Please sign in to request a quote\./);
  assert.match(app, /Please sign in to use Friday\\u2019s AI planner\./);
  const chat = await source('assets/js/trip-chat.js');
  assert.match(chat, /FT\.requireSignIn && !FT\.requireSignIn\('ai'\)/);
  const integrations = await source('assets/js/trip-integrations.js');
  for (const reason of ['designer', 'link', 'fares', 'ai']) assert.match(integrations, new RegExp("needSignIn\\('" + reason + "'"));
  // briefings stay private
  assert.match(app, /if \(!FT\.backend \|\| !FT\.backend\.user\) \{ authGate\(main\); return; \}/);
});
