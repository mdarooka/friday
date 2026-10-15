import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { replyBy } from '../server/reply-by.mjs';
import { paceLine } from '../server/prequote-checklist.mjs';
import { startApp, signUp } from './helpers.mjs';
import * as store from '../server/store.mjs';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('reply promise is 30 hours later in India time', () => {
  const onTheHour = replyBy(new Date('2026-10-15T03:30:00.000Z'));
  assert.equal(onTheHour.at, '2026-10-16T09:30:00.000Z');
  assert.equal(onTheHour.label, 'Fri 3 PM');
  assert.equal(onTheHour.text, 'Your designer replies by Fri 3 PM');
  const half = replyBy(new Date('2026-10-15T09:00:00.000Z'));
  assert.equal(half.label, 'Fri 8:30 PM');
});

test('pace line names the last trip pace', () => {
  assert.equal(paceLine('relaxed'), 'A slower pace');
  assert.equal(paceLine('normal'), 'A balanced pace');
  assert.equal(paceLine('full'), 'Fuller days');
  assert.equal(paceLine(''), '');
});

test('departure interest, a reel link and a gift tag join the quote queue', async (t) => {
  const { request } = await startApp(t, { env: { AUTH_PROVIDER: 'local' }, hexclaveAuth: { configured: false, currentUser: async () => null } });
  const user = await signUp(request, 'Departure');
  const bad = await request('/api/callbacks', 'POST', {
    name: 'Meera Shah', phone: '9876543210', bestTime: 'evening', entryPoint: 'departure', reelUrl: 'http://instagram.com/reel/1',
  }, { cookie: user.cookie });
  assert.equal(bad.status, 422);
  const made = await request('/api/callbacks', 'POST', {
    name: 'Meera Shah', phone: '9876543210', bestTime: 'evening', entryPoint: 'departure',
    topic: 'Driving the Dolomites', reelUrl: 'https://www.instagram.com/reel/example', gift: true,
  }, { cookie: user.cookie });
  assert.equal(made.status, 201);
  assert.match(made.result.replyBy.text, /^Your designer replies by /);
  const queue = await request('/api/admin/quotes', 'GET', undefined, { cookie: user.cookie });
  assert.equal(queue.status, 200);
  const row = queue.result.quotes.find((item) => item.id === made.result.id);
  assert.equal(row.entryPoint, 'departure');
  assert.equal(row.reelUrl, 'https://www.instagram.com/reel/example');
  assert.equal(row.gift, true);
});

test('food and pace is prefilled from the traveller profile and the last trip', async (t) => {
  const { request, db } = await startApp(t, { env: { AUTH_PROVIDER: 'local' }, hexclaveAuth: { configured: false, currentUser: async () => null } });
  const user = await signUp(request, 'Pace');
  assert.equal((await request('/api/profile', 'PATCH', { other: 'Jain meals' }, { cookie: user.cookie })).status, 200);
  await store.insertRecord(db, {
    id: 'trip-pace', userId: user.result.user.id, kind: 'trips',
    data: JSON.stringify({ pace: 'relaxed' }), updated: new Date().toISOString(),
  });
  const items = (await request('/api/callbacks/checklist-items', 'GET', undefined, { cookie: user.cookie })).result.items;
  const food = items.find((item) => item.id === 'foodpace');
  assert.equal(food.prefill, 'Jain meals. A slower pace');
});

test('public pages carry the Diwali card, seat interest, guide feedback and a hidden WhatsApp slot', async () => {
  const home = await read('index.html');
  const breaks = await read('when-india-travels.html');
  const departures = await read('departures.html');
  const contact = await read('contact.html');
  const goa = await read('goa-guide.html');
  const rajasthan = await read('rajasthan-guide.html');
  const mumbai = await read('mumbai-quiet-weekend.html');
  const friday = await read('assets/js/friday.js');
  assert.match(home, /class="hero-diwali"/);
  assert.match(home, /Plan this break/);
  assert.match(home, /data-whatsapp-slot/);
  assert.match(await read('assets/css/friday.css'), /a\[data-whatsapp-slot\]:not\(\.is-on\)/);
  assert.match(breaks, /data-diwali-pin/);
  assert.match(breaks, /Book by 8 Oct 2026/);
  assert.match(breaks, /Catalogue starting points, not live inventory/);
  assert.match(departures, /data-entry-point="departure"/);
  assert.match(departures, /Tell me when seats open/);
  assert.match(departures, /not a live seat map/);
  assert.match(contact, /name="reelUrl"/);
  assert.match(contact, /A designer checks every place/);
  assert.match(contact, /Gift a Friday weekend/);
  assert.match(contact, /data-whatsapp-slot/);
  assert.match(friday, /classList\.add\('is-on'\)/);
  assert.match(friday, /data-whatsapp-slot/);
  assert.match(friday, /whatsappNumber/);
  for (const html of [goa, rajasthan, mumbai]) assert.match(html, /data-guide-feedback=/);
  assert.match(goa, /data-guide-feedback="goa"/);
  assert.match(rajasthan, /data-guide-feedback="rajasthan"/);
  assert.match(mumbai, /data-guide-feedback="mumbai-quiet-weekend"/);
});
