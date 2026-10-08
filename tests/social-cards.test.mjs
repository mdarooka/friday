import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { startApp, signUp } from './helpers.mjs';

const require = createRequire(import.meta.url);
const cards = require('../build/social-cards.js');
const origin = 'http://localhost:4871';
const meta = (html, key) => new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`).exec(html)?.[1];
const count = (html, key) => (html.match(new RegExp(`<meta (?:property|name)="${key}"`, 'g')) || []).length;

test('every card exists as a JPEG of 1200x630 within WhatsApp\'s 300 KB budget', async () => {
  for (const key of cards.cardKeys()) {
    const file = new URL(`../${cards.cardFile(key)}`, import.meta.url);
    assert.ok((await stat(file)).size <= 300 * 1024, `${key} size`);
    const bytes = await readFile(file);
    assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], `${key} is a JPEG`);
    let i = 2, size = null;
    while (i < bytes.length) { // find the SOF marker
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      if (m >= 0xc0 && m <= 0xc3) { size = [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)]; break; }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
    assert.deepEqual(size, [1200, 630], `${key} dimensions`);
  }
});

test('card URLs are absolute and version-stamped; destination ids normalise safely', () => {
  assert.equal(cards.cardUrl('goa', 'https://fridaytravel.vercel.app/'), `https://fridaytravel.vercel.app/assets/images/og/goa.jpg?v=${cards.CARD_VERSION}`);
  assert.equal(cards.cardUrl('nowhere', 'https://x.test'), null);
  assert.equal(cards.normalizeDestinationId(' Goa '), 'goa');
  for (const bad of ['constructor', '../goa', 'goa-guide', '', null, undefined]) assert.equal(cards.normalizeDestinationId(bad), null);
  assert.equal(cards.matchDestinationText('Japan'), 'kyoto');
  assert.equal(cards.matchDestinationText('A week in Kerala backwaters'), 'kerala');
  assert.equal(cards.matchDestinationText('Paris'), null);
});

test('generated guide pages carry their own absolute og:image, dimensions, alt and twitter card', async () => {
  for (const id of ['kerala']) {
    const html = await readFile(new URL(`../${id}-guide.html`, import.meta.url), 'utf8');
    assert.match(meta(html, 'og:image'), new RegExp(`^https://[^/]+/assets/images/og/${id}-guide\\.jpg\\?v=\\d+$`));
    assert.equal(meta(html, 'og:image:width'), '1200'); assert.equal(meta(html, 'og:image:height'), '630');
    assert.ok(meta(html, 'og:image:alt')); assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(html, 'twitter:image'), meta(html, 'og:image'));
  }
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(meta(home, 'og:image'), /friday-social\.jpg$/); // other pages keep the default
});

test('trip.html?destination= gets that destination\'s card, once, and unknown ids keep the defaults', async t => {
  const { request } = await startApp(t);
  const goa = (await request('/trip.html?destination=Goa')).result;
  assert.equal(meta(goa, 'og:image'), `${origin}/assets/images/og/goa.jpg?v=${cards.CARD_VERSION}`);
  assert.equal(meta(goa, 'og:title'), 'Plan a trip to Goa · Friday');
  assert.match(goa, /<title>Plan a trip to Goa · Friday<\/title>/);
  assert.equal(meta(goa, 'og:image:width'), '1200');
  for (const key of ['og:title', 'og:image', 'og:description', 'twitter:card']) assert.equal(count(goa, key), 1, key);
  for (const url of ['/trip.html?destination=atlantis', '/trip.html?destination=constructor', '/trip.html']) {
    const page = (await request(url)).result;
    assert.match(meta(page, 'og:image'), /friday-social\.jpg$/, url);
  }
  assert.equal((await request('/assets/images/og/goa.jpg?v=1')).status, 200);
});

test('shared links on trip.html and app.html inject the trip title and destination card without private data', async t => {
  const { request } = await startApp(t);
  const owner = await signUp(request, 'OgOwner');
  const trip = (await request('/api/trips', 'POST', { data: { title: 'Kerala <slow> rail', destination: 'Kerala', startDate: '2026-12-01', endDate: '2026-12-05', messages: [{ role: 'user', text: 'PRIVATE chat' }], notes: 'PRIVATE note', days: [{ title: 'Day', items: [{ title: 'Backwater' }] }] } }, { cookie: owner.cookie })).result.record;
  const token = new URL((await request(`/api/trips/${trip.id}/share`, 'POST', {}, { cookie: owner.cookie })).result.share.url, origin).searchParams.get('share');
  for (const [page, user] of [['trip.html', 'WhatsApp/2.24'], ['app.html', 'WhatsApp/2.24']]) {
    const html = (await request(`/${page}?share=${token}`, 'GET', undefined, { headers: { 'User-Agent': user } })).result;
    assert.equal(meta(html, 'og:title'), 'Kerala &lt;slow&gt; rail · a Friday itinerary', page);
    assert.equal(meta(html, 'og:image'), `${origin}/assets/images/og/kerala.jpg?v=${cards.CARD_VERSION}`, page);
    assert.equal(meta(html, 'og:url'), `${origin}/${page}?share=${token}`);
    assert.match(meta(html, 'og:description'), /^Kerala · 2026-12-01–2026-12-05 · 1 stop\. Shared with you on Friday\.$/);
    assert.equal(count(html, 'og:image'), 1, page);
    assert.equal(/PRIVATE/.test(html), false, 'no private data');
  }
});

test('expired, malformed and unknown share tokens fall back to the page defaults', async t => {
  const { request } = await startApp(t);
  for (const token of ['f'.repeat(64), 'nope', '../etc', '<script>']) {
    const html = (await request(`/trip.html?share=${encodeURIComponent(token)}`)).result;
    assert.equal(meta(html, 'og:title'), 'Plan a trip · Friday', token);
    assert.match(meta(html, 'og:image'), /friday-social\.jpg$/, token);
    assert.equal(html.includes(token), false, 'the token is never echoed into the page');
  }
});
