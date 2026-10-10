import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const helper = await read('assets/js/quote-reply-draft.js');

function load() {
  const window = {};
  vm.runInNewContext(helper, { window, encodeURIComponent, String, Number, parseInt, Array });
  return window.FridayQuoteReplyDraft;
}

const quote = {
  customerEmail: 'traveler@example.com',
  snapshot: { destination: 'Kerala', dates: { start: '2026-12-01', end: '2026-12-10' }, travelers: 2 },
};

test('draft reply opens a mailto link to the traveller with trip details and a Friday sign-off', () => {
  const draft = load().build(quote);
  assert.equal(draft.to, 'traveler@example.com');
  assert.equal(draft.subject, 'Your Friday trip to Kerala');
  assert.match(draft.body, /^Hello,/);
  assert.match(draft.body, /your Kerala trip \(2026-12-01 to 2026-12-10, 2 travellers\) with Friday/);
  assert.match(draft.body, /Warm regards,\nFriday$/);
  assert.equal(draft.href.startsWith('mailto:traveler%40example.com?subject=Your%20Friday%20trip%20to%20Kerala&body='), true);
  // Round-trips: the link carries exactly the subject and body, with line breaks encoded.
  const parsed = new URL(draft.href.replace('mailto:', 'mailto://'));
  assert.equal(parsed.searchParams.get('subject'), draft.subject);
  assert.equal(parsed.searchParams.get('body'), draft.body);
});

test('missing trip fields are skipped, not printed as blanks or undefined', () => {
  const draft = load().build({ customerEmail: 'a@example.com', snapshot: { dates: { start: '2027-01-05' }, travelers: 0 } });
  assert.equal(draft.subject, 'Your Friday trip');
  assert.match(draft.body, /your trip \(2027-01-05\) with Friday/);
  assert.equal(/undefined|null|\(\)|  /.test(draft.body), false);
  const bare = load().build({ customerEmail: 'b@example.com', snapshot: {} });
  assert.match(bare.body, /Thank you for planning your trip with Friday\./);
});

test('no draft without a usable traveller email, and header-breaking text is flattened', () => {
  const api = load();
  assert.equal(api.build({ customerEmail: '', snapshot: {} }), null);
  assert.equal(api.build({ customerEmail: 'not an email', snapshot: {} }), null);
  assert.equal(api.build(null), null);
  const injected = api.build({ customerEmail: 'c@example.com', snapshot: { destination: 'Goa\r\nBcc: spy@example.com' } });
  assert.equal(injected.subject.includes('\n'), false);
  assert.equal(injected.subject.includes('\r'), false);
  assert.equal(injected.href.includes('%0D%0ABcc'), false);
});

test('the console wires Draft reply as a visible link that only counts a $click and does not send', async () => {
  const admin = await read('assets/js/admin.js');
  assert.match(admin, /function draftReplyMarkup\(q\)/);
  assert.match(admin, />Draft reply<\/a>/);
  assert.match(admin, /FridayAnalytics\.track\('\$click', \{ path: '\/admin\.html', control: 'draft-reply' \}\)/);
  const generate = await read('build/generate.js');
  assert.match(generate, /'assets\/js\/quote-reply-draft\.js', 'assets\/js\/admin\.js'/);
  const html = await read('admin.html');
  assert.match(html, /assets\/js\/quote-reply-draft\.js/);
  assert.ok(html.indexOf('quote-reply-draft.js') < html.indexOf('assets/js/admin.js'));
});
