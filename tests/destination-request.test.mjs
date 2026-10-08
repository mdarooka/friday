import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startApp, signUp } from './helpers.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const emailConfig = { HEXCLAVE_PROJECT_ID: 'project-test', HEXCLAVE_SECRET_SERVER_KEY: 'server-secret-test' };

test('destination requests validate contact details, reach the quotes queue, and notify the team', async t => {
  const sends = [];
  const { request } = await startApp(t, {
    env: { ...emailConfig, AUTH_PROVIDER: 'local', QUOTE_ADMIN_EMAILS: 'quoteadmin@example.com', FRIDAY_ENQUIRY_EMAIL: 'studio@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
    emailFetch: async (url, options) => { sends.push({ url, body: JSON.parse(options.body) }); return new Response(null, { status: 202 }); },
  });
  const admin = await signUp(request, 'QuoteAdmin');
  const base = { destination: 'Bhutan', name: 'Traveler Jane' };
  assert.equal((await request('/api/destination-requests', 'POST', { ...base })).status, 422, 'a contact is required');
  assert.equal((await request('/api/destination-requests', 'POST', { ...base, email: 'not-an-email' })).status, 422);
  assert.equal((await request('/api/destination-requests', 'POST', { ...base, phone: '12345' })).status, 422);
  assert.equal((await request('/api/destination-requests', 'POST', { name: 'Traveler', email: 'a@example.com' })).status, 422, 'destination is required');

  const submitted = await request('/api/destination-requests', 'POST', {
    ...base, email: 'Jane@Example.com', month: 'March', groupSize: 'Two', notes: 'Somewhere quiet with snow.',
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.result.saved, true);
  assert.equal(submitted.result.delivery.notification, 'provider_accepted');
  assert.equal(sends.length, 1);
  assert.equal(sends[0].body.emails[0], 'studio@example.com');
  assert.match(sends[0].body.html, /Bhutan/);
  assert.match(sends[0].body.html, /jane@example\.com/);

  const queue = (await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie })).result.quotes;
  const requests = queue.filter(item => item.kind === 'destination_request');
  assert.equal(requests.length, 1);
  const jane = requests.find(item => item.destination === 'Bhutan');
  assert.equal(jane.name, 'Traveler Jane');
  assert.equal(jane.customerEmail, 'jane@example.com');
  assert.equal(jane.month, 'March');
  assert.equal(jane.groupSize, 'Two');
  assert.equal(jane.notes, 'Somewhere quiet with snow.');
  assert.equal(jane.phone, null);
});

test('a phone-only destination request is stored with a normalised Indian number', async t => {
  const { request } = await startApp(t, {
    env: { ...emailConfig, AUTH_PROVIDER: 'local', QUOTE_ADMIN_EMAILS: 'quoteadmin@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
  });
  const admin = await signUp(request, 'QuoteAdmin');
  const submitted = await request('/api/destination-requests', 'POST', { destination: 'Ladakh', name: 'Traveler', phone: '+91 98765-43210' });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.result.delivery.notification, 'blocked');
  const queue = (await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie })).result.quotes;
  assert.equal(queue.find(item => item.kind === 'destination_request').phone, '+919876543210');

});

test('destination request pages: one general form on contact and guides, a plain link on departures, and a noindex thank-you page', async () => {
  const contact = await read('contact.html');
  const guides = await read('guides.html');
  const departures = await read('departures.html');
  const thanks = await read('request-destination-thanks.html');
  assert.match(contact, /data-destination-form/);
  assert.match(guides, /data-destination-form/);
  assert.match(contact, /Request a destination/);
  assert.equal(departures.includes('data-destination-form'), false, 'departures page has no form');
  assert.match(departures, /href="guides\.html"[^>]*>Don’t see your destination\? Request a destination/);
  for (const file of ['departure-dolomites-manual.html', 'departure-luxor-eclipse.html', 'departure-super-tuskers.html']) {
    assert.equal((await read(file)).includes('data-destination-form'), false, `${file} has no form`);
  }
  assert.match(thanks, /noindex, nofollow/);
  assert.match(thanks, /assets\/js\/native-page-analytics\.js/);
  const sitemap = await read('sitemap.xml');
  assert.equal(sitemap.includes('request-destination-thanks'), false);
  const friday = await read('assets/js/friday.js');
  assert.match(friday, /fetch\('\/api\/destination-requests'/);
  assert.match(friday, /location\.href='request-destination-thanks\.html'/);
  const admin = await read('assets/js/admin.js');
  assert.match(admin, /Destination request: ' \+ \(q\.destination/);
});
