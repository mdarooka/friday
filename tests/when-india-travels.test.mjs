import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../build/data/india-breaks.js');
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const html = await read('when-india-travels.html');
const sitemap = await read('sitemap.xml');
const decode = (value) => value.replace(/&amp;/g, '&');
const TODAY = '2026-10-07';
const buildToday = B.isoDay();
const rows = () => B.upcomingBreaks(buildToday);

test('when-india-travels.html has title, canonical, social tags and is in the sitemap', () => {
  assert.match(html, /<title>Long weekends &amp; holidays from India &middot; Friday<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/when-india-travels\.html">/);
  assert.match(html, /<meta property="og:title" content="Long weekends &amp; holidays from India/);
  assert.match(html, /<meta property="og:image" content="https:\/\//);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="twitter:title" content="Long weekends/);
  assert.doesNotMatch(html, /name="robots"/);
  assert.match(sitemap, /<loc>https:\/\/fridaytravel\.vercel\.app\/when-india-travels\.html<\/loc>/);
  assert.doesNotMatch(sitemap, /long-weekends/);
  assert.match(html, /<h1[^>]*>When India<br>travels\.<\/h1>/);
  assert.match(html, /Friday is still designed in Bombay/);
});

test('every row has the schema, sources, and open-ended suggestions (no destination list)', () => {
  assert.equal(B.DESTINATIONS, undefined);
  assert.equal(B.breaksGoodFor, undefined);
  const codes = new Set(Object.keys(B.REGION_NAMES));
  const ids = new Set();
  for (const brk of B.BREAKS) {
    for (const field of ['id', 'name', 'kind', 'group', 'regions', 'startDate', 'endDate', 'nights', 'note', 'researchNote', 'verified', 'confidence', 'source']) assert.ok(field in brk, `${brk.id} has ${field}`);
    assert.ok(!ids.has(brk.id), `${brk.id} is unique`); ids.add(brk.id);
    assert.equal(typeof brk.verified, 'boolean');
    assert.ok(['official', 'reliable-unofficial', 'estimate'].includes(brk.confidence), brk.id);
    if (brk.verified) assert.equal(brk.confidence, 'official', `${brk.id} verified rows are official`);
    assert.ok(['long-weekend', 'holiday', 'festival-window', 'school-break'].includes(brk.kind), brk.id);
    assert.ok(Array.isArray(brk.source) && brk.source.length >= 1 && brk.source.every((u) => /^https:\/\//.test(u)), `${brk.id} sources`);
    assert.ok(brk.note.length > 10 && brk.researchNote.length > 10);
    assert.doesNotMatch(brk.note, /\b(RH|DoPT|G\.O\.|bridge)\b/, `${brk.id} public note has no jargon`);
    assert.ok(brk.regions.length && brk.regions.every((r) => r === 'national' || codes.has(r)), `${brk.id} regions`);
    const group = brk.kind === 'school-break' ? 'school' : brk.regions.includes('national') ? 'national' : 'festival';
    assert.equal(brk.group, group, `${brk.id} group`);
    assert.equal(B.nightsBetween(brk.startDate, brk.endDate), brk.nights, `${brk.id} nights`);
    assert.ok(!('picks' in brk), `${brk.id} has no picks`);
    const suggestions = brk.suggestions || [];
    assert.ok(suggestions.length <= 2, brk.id);
    if (brk.nights >= B.MIN_NIGHTS) assert.ok(suggestions.length >= 1, `${brk.id} has a suggestion`);
    for (const sug of suggestions) {
      assert.ok(typeof sug.place === 'string' && sug.place.length >= 2 && sug.place.length <= 60, `${brk.id}: place`);
      assert.ok(sug.reason.length > 20, `${brk.id}: reason`);
      const start = sug.start || brk.startDate;
      assert.ok(start >= brk.startDate && start <= brk.endDate, `${brk.id} suggestion start inside the window`);
      if (brk.nights > 14) assert.ok(sug.nights, `${brk.id} long windows set suggestion nights`);
      const nights = sug.nights || B.plannerNights(brk);
      assert.ok(nights >= 1 && nights <= 30, `${brk.id} suggestion nights`);
      assert.doesNotMatch(`${sug.reason} ${sug.caveat}`, /\u20b9|\bRs\.?\s*\d|discount|% off|book now|only \d+ left/i);
    }
  }
  assert.equal(B.BREAKS.filter((b) => !b.verified).length > 0, true);
  assert.ok(B.BREAKS.some((b) => b.group === 'school' && b.regions.includes('KA')), 'south school row');
  assert.ok(B.BREAKS.some((b) => b.group === 'school' && b.regions.includes('DL')), 'north school row');
});

test('only rows you can travel on (2+ nights) are shown, and past rows are dropped', () => {
  const hidden = ['eid-ul-fitr-2027', 'janmashtami-2027', 'dussehra-2027', 'chhath-2026', 'maha-shivratri-2027', 'gudi-padwa-ugadi-2027', 'maharashtra-day-2027', 'ganesh-2027', 'onam-2027'];
  const shown = B.upcomingBreaks(TODAY).map((b) => b.id);
  for (const id of hidden) {
    assert.ok(B.BREAKS.some((b) => b.id === id), `${id} stays in the data`);
    assert.ok(!shown.includes(id), `${id} is not shown`);
    assert.ok(!html.includes(`id="${id}"`), `${id} is not rendered`);
  }
  assert.ok(B.upcomingBreaks(TODAY).every((b) => b.nights >= 2));
  assert.equal(shown.length, B.BREAKS.filter((b) => b.nights >= 2).length);
  assert.ok(B.upcomingBreaks(TODAY, { all: true }).length > shown.length);
  assert.ok(!B.upcomingBreaks('2026-10-22').some((b) => b.id === 'dussehra-2026'));
});

test('rows still to be confirmed are marked quietly; verified rows are not; sources never appear on the page', () => {
  const tbc = (html.match(/data-wit-tbc/g) || []).length;
  assert.equal(tbc, rows().filter((b) => !b.verified).length);
  assert.ok(tbc > 0);
  assert.match(html, /Checked against official lists, October 2026/);
  assert.match(html, /moon can move by a day/);
  assert.doesNotMatch(html, /Still being checked/);
  assert.doesNotMatch(html, /podareducation|drikpanchang|maharashtra\.gov\.in|DoPT|researchNote/);
  assert.doesNotMatch(html, /\bRH\b/);
});

test('upcomingBreaks drops past rows, sorts by date, and filters by group and region', () => {
  const all = B.upcomingBreaks(TODAY);
  assert.ok(all.some((b) => b.id === 'diwali-2026'));
  const later = B.upcomingBreaks('2027-03-01');
  assert.ok(!later.some((b) => b.id === 'diwali-2026'));
  assert.ok(later.length && later.every((b) => b.endDate >= '2027-03-01'));
  const dates = all.map((b) => b.startDate);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok(B.upcomingBreaks('2027-03-27').some((b) => b.id === 'holi-easter-2027'), 'a break still running is kept');
  assert.equal(B.upcomingBreaks('2030-01-01').length, 0);
  assert.ok(B.upcomingBreaks(TODAY, { group: 'national' }).every((b) => b.group === 'national'));
  const kolkata = B.upcomingBreaks(TODAY, { region: 'west-bengal' }).map((b) => b.id);
  assert.ok(kolkata.includes('durga-puja-2026') && kolkata.includes('diwali-2026'));
  assert.ok(kolkata.includes('guru-nanak-2026') && !kolkata.includes('diwali-2026-mh') && !kolkata.includes('sankranti-pongal-2027'));
  assert.equal(B.nextBreak(TODAY, 'all').group, 'national');
  assert.equal(B.nextBreak(TODAY, 'west-bengal').id, 'durga-puja-2026');
});

test('Ladakh is only a May/June suggestion, Kyoto is never suggested, and places are not limited to a short list', () => {
  let ladakh = 0;
  const places = new Set();
  for (const brk of B.upcomingBreaks(TODAY)) {
    for (const sug of brk.suggestions) {
      places.add(sug.place);
      const month = Number(sug.start.slice(5, 7));
      if (/ladakh/i.test(sug.place)) { ladakh++; assert.ok([5, 6].includes(month), `${brk.id} ladakh in month ${month}`); }
      assert.ok(!/kyoto/i.test(`${sug.place} ${sug.reason} ${sug.caveat}`), `${brk.id} still suggests Kyoto`);
    }
  }
  assert.ok(ladakh > 0);
  assert.ok(!/kyoto/i.test(html), 'no Kyoto on the page');
  assert.ok(places.size >= 20, 'a wide spread of places');
  for (const place of ['Coorg', 'Andaman Islands', 'Meghalaya', 'Bhutan', 'Himachal Pradesh', 'Vietnam']) assert.ok(places.has(place), place);
});

test('the three groups render in order, with no hidden attributes in the static HTML', () => {
  const at = (group) => html.indexOf(`data-wit-group="${group}"`);
  assert.ok(at('national') > 0 && at('national') < at('festival') && at('festival') < at('school'));
  assert.match(html, /<h2 class="h2" id="national-h">National long weekends<\/h2>/);
  assert.match(html, /<h2 class="h2" id="festival-h">Festival breaks<\/h2>/);
  assert.match(html, /<h2 class="h2" id="school-h">School holidays<\/h2>/);
  // The header's sign-out buttons start hidden until the session check shows a signed-in user.
  assert.doesNotMatch(html.replace(/<button [^>]*data-(?:nav|menu)-signout hidden>/g, ''), /\shidden[\s=>]/);
  assert.match(html, /<script type="application\/json" id="wit-data">/);
  const ids = [...html.matchAll(/<article class="lw-break" id="([a-z0-9-]+)" data-wit-row data-regions="([^"]*)" data-types="([^"]*)"/g)];
  assert.equal(ids.length, rows().length);
  for (const group of B.GROUPS) {
    const start = at(group);
    const next = B.GROUPS.map(at).filter((i) => i > start).sort((a, b) => a - b)[0] || html.length;
    const rendered = [...html.slice(start, next).matchAll(/<article class="lw-break" id="([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(rendered, B.upcomingBreaks(buildToday, { group }).map((b) => b.id), group);
  }
});

const GUIDE_FILES = { goa: 'goa-guide.html', kerala: 'kerala-guide.html', rajasthan: 'rajasthan-guide.html', 'near bombay': 'mumbai-quiet-weekend.html' };
const guideOf = (place) => GUIDE_FILES[String(place).toLowerCase()] || null;

test('suggestions render per row: a guide link when Friday has a guide, otherwise planner and designer links', () => {
  const all = rows().flatMap((b) => b.suggestions.map((sug) => ({ brk: b, sug })));
  const guideLinks = [...html.matchAll(/<a class="btn btn--sm" href="([^"]+)" data-break-cta="guide" data-break-id="([a-z0-9-]+)" data-break-place="([^"]+)">Read the ([^<]+?) guide /g)];
  const planLinks = [...html.matchAll(/<a class="btn btn--sm" href="([^"]+)" data-break-cta="planner" data-break-id="([a-z0-9-]+)" data-break-place="([^"]+)">Plan with Friday /g)];
  const callLinks = [...html.matchAll(/<a class="link" href="(contact\.html\?topic=[^"]+)" data-break-cta="callback" data-break-id="([a-z0-9-]+)" data-break-place="([^"]+)">Talk to a designer /g)];
  const guided = all.filter((x) => guideOf(x.sug.place));
  assert.ok(guided.length > 0 && guided.length < all.length);
  assert.equal(guideLinks.length, guided.length);
  assert.equal(planLinks.length, all.length - guided.length);
  assert.equal(callLinks.length, all.length - guided.length);
  assert.doesNotMatch(html, /data-break-destination|destination=/);
  for (const [, href, breakId, place] of guideLinks) {
    const sug = rows().find((b) => b.id === breakId).suggestions.find((x) => decode(place) === x.place);
    assert.ok(sug, `${breakId}/${place}`);
    const url = new URL(decode(href), 'https://fridaytravel.vercel.app/');
    assert.equal(url.pathname.slice(1), guideOf(sug.place));
    assert.equal(url.searchParams.get('start'), sug.start);
    assert.equal(url.searchParams.get('nights'), String(sug.nights));
    assert.equal(url.searchParams.get('from'), 'india_breaks');
  }
  for (const [, href, breakId, place] of planLinks) {
    const brk = rows().find((b) => b.id === breakId);
    const sug = brk.suggestions.find((x) => decode(place) === x.place);
    assert.ok(sug && !guideOf(sug.place), `${breakId}/${place}`);
    const url = new URL(decode(href), 'https://fridaytravel.vercel.app/');
    assert.equal(url.pathname, '/trip.html');
    assert.equal(url.searchParams.get('place'), sug.place);
    assert.equal(url.searchParams.get('start'), sug.start);
    assert.equal(url.searchParams.get('nights'), String(sug.nights));
    assert.match(url.searchParams.get('start'), /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(brk.suggestions.length >= 1);
  }
  for (const [, href, breakId, place] of callLinks) {
    const brk = rows().find((b) => b.id === breakId);
    const topic = new URL(decode(href), 'https://fridaytravel.vercel.app/').searchParams.get('topic');
    assert.equal(topic, `${brk.name} \u00b7 ${decode(place)}`);
    assert.ok(href.endsWith('#callback-title'));
  }
  assert.doesNotMatch(html, /data-break-city/);
  for (const brk of rows()) assert.ok(brk.suggestions.length >= 1, `${brk.id} shows a suggestion`);
  assert.match(html, /href="kerala-guide\.html\?start=/);
  assert.match(html, /href="mumbai-quiet-weekend\.html\?start=/);
  assert.match(html, /Read the quiet weekend guide/);
});

test('every guide page offers both Plan with Friday and Talk to a designer, and carries break dates through', async () => {
  for (const file of ['goa-guide.html', 'kerala-guide.html', 'rajasthan-guide.html']) {
    const page = await read(file);
    assert.match(page, /data-guide-cta="planner"/, file);
    assert.match(page, /data-guide-cta="quote"/, file);
    const call = page.match(/<a class="link" data-guide-cta="callback"[^>]*href="(contact\.html\?topic=[^"]+#callback-title)">Talk to a designer/);
    assert.ok(call, `${file} has a callback CTA`);
    assert.doesNotMatch(page, /lw-goodfor|Good for<\/span>/, `${file} has no Good for note`);
  }
  assert.match(await read('goa-guide.html'), /href="contact\.html\?topic=Goa#callback-title"/);
  const source = await read('assets/js/guide-analytics.js');
  assert.match(source, /function carryDates/);
  assert.match(source, /target !== 'callback'/);
});

test('the callback flow reads ?topic= and sends it with the request', async () => {
  const script = await read('assets/js/friday.js');
  assert.match(script, /villaParams\.get\('topic'\)/);
  assert.match(script, /\.\.\.\(topic\?\{topic\}:\{\}\)/);
  const contact = await read('contact.html');
  assert.match(contact, /id="callback-title"/);
  assert.match(contact, /data-callback-form/);
});

test('analytics: both CTAs fire the shared guide event with surface=india_breaks and the selected region', async () => {
  const source = await read('assets/js/guide-analytics.js');
  assert.match(source, /data-break-cta/);
  assert.match(source, /surface: 'india_breaks'/);
  assert.match(source, /target !== 'guide' && target !== 'planner' && target !== 'callback'/);
  assert.doesNotMatch(source, /city_breaks|data-break-city|data-break-destination/);
  for (const key of ['region:', 'break_id:', 'place:', 'target: target']) assert.ok(source.includes(key), key);
  assert.match(html, /assets\/js\/guide-analytics\.js/);
  assert.match(html, /assets\/js\/when-india-travels\.js/);
});

test('region keys resolve from state keys, state codes and the old city links', () => {
  assert.equal(B.resolveRegion('MH'), 'maharashtra');
  assert.equal(B.resolveRegion('maharashtra'), 'maharashtra');
  assert.equal(B.resolveRegion('DL'), 'delhi');
  assert.equal(B.resolveRegion('ka'), 'karnataka');
  assert.equal(B.resolveRegion('all'), 'all');
  assert.equal(B.resolveRegion('ZZ'), null);
  assert.equal(B.resolveRegion(''), null);
  for (const [key, code] of [['tamil-nadu', 'TN'], ['telangana', 'TS'], ['west-bengal', 'WB'], ['gujarat', 'GJ']]) assert.equal(B.resolveRegion(code), key);
  /* old ?region= city values keep working */
  for (const [old, key] of [['mumbai-pune', 'maharashtra'], ['delhi-ncr', 'delhi'], ['Delhi NCR', 'delhi'], ['bengaluru', 'karnataka'], ['chennai', 'tamil-nadu'],
    ['hyderabad', 'telangana'], ['kolkata', 'west-bengal'], ['ahmedabad', 'gujarat']]) assert.equal(B.resolveRegion(old), key, old);
});

test('the filter lists states only, and each one changes at least one break on the page', () => {
  const states = B.REGION_FILTERS.filter((f) => f.key !== 'all');
  assert.deepEqual(states.map((f) => f.key), ['maharashtra', 'delhi', 'karnataka', 'tamil-nadu', 'telangana', 'west-bengal', 'gujarat']);
  for (const f of states) {
    assert.ok(B.BREAKS.some((b) => b.nights >= B.MIN_NIGHTS && b.regions.some((r) => f.codes.includes(r))), `${f.key} has a regional break`);
    assert.ok(f.codes.every((c) => B.REGION_NAMES[c]), `${f.key} code has a name`);
  }
  assert.ok(!states.some((f) => /Mumbai|Pune|NCR|Bengaluru|Chennai|Hyderabad|Kolkata|Ahmedabad/.test(f.label)), 'no city labels');
});

/* A tiny DOM: just what assets/js/when-india-travels.js touches. */
function runScript(source, { search = '', stored = null, storedType = null, home = false } = {}) {
  const data = JSON.parse(html.match(/<script type="application\/json" id="wit-data">(.*?)<\/script>/s)[1]);
  const el = (attrs) => {
    const a = { ...attrs };
    return { hidden: false, attrs: a, children: [], textContent: '', getAttribute: (n) => (n in a ? a[n] : null), setAttribute(n, v) { a[n] = String(v); }, removeAttribute(n) { delete a[n]; }, addEventListener(type, fn) { this.handler = fn; }, querySelectorAll(sel) { return sel === '[data-wit-row]' ? this.children : []; } };
  };
  const rowEls = [...html.matchAll(/<article class="lw-break" id="([a-z0-9-]+)" data-wit-row data-regions="([^"]*)" data-types="([^"]*)" data-end="([^"]*)"/g)].map((m) => Object.assign(el({ 'data-regions': m[2], 'data-types': m[3], 'data-end': m[4] }), { id: m[1] }));
  const groups = B.GROUPS.map((g) => Object.assign(el({ 'data-wit-group': g }), { children: [] }));
  for (const row of rowEls) {
    const brk = B.BREAKS.find((b) => b.id === row.id);
    groups[B.GROUPS.indexOf(brk.group)].children.push(row);
  }
  const links = data.filters.map((f) => el({ 'data-wit-filter': f.key }));
  const nameSlot = el({});
  const typeNameSlot = el({});
  const typeLinks = data.types.map((t) => el({ 'data-wit-type': t.key }));
  const status = el({});
  const closeEls = { '[data-wit-close]': el({}), '[data-wit-close-lead]': el({}), '[data-wit-close-link]': el({ href: data.close.default.href }), '[data-wit-close-label]': el({}), '[data-wit-close-more]': el({}), '[data-wit-status]': status };
  const teaser = el({});
  const slots = { '[data-wit-teaser-break]': el({}), '[data-wit-teaser-dates]': el({}), '[data-wit-teaser-place]': el({}), '[data-wit-teaser-nights]': el({}), '[data-wit-teaser-link]': el({ href: 'when-india-travels.html' }) };
  teaser.querySelector = (sel) => slots[sel] || null;
  const body = el({});
  const storage = new Map([...(stored ? [['friday.breaks-region.v1', stored]] : []), ...(storedType ? [['friday.breaks-type.v1', storedType]] : [])]);
  const replaced = [];
  const doc = {
    body,
    getElementById: (id) => (id === 'wit-data' ? { textContent: JSON.stringify(data) } : null),
    querySelectorAll: (sel) => ({ '[data-wit-row]': home ? [] : rowEls, '[data-wit-filter]': links, '[data-wit-group]': groups, '[data-wit-region-name]': [nameSlot], '[data-wit-type]': typeLinks, '[data-wit-type-name]': [typeNameSlot] }[sel] || []),
    querySelector: (sel) => (sel === '[data-wit-teaser]' && home ? teaser : home ? null : closeEls[sel] || null),
  };
  const context = {
    document: doc, URLSearchParams, Date, Array, Object, String, JSON,
    location: { search, pathname: '/when-india-travels.html' }, history: { replaceState: (a, b, url) => replaced.push(url) },
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v) },
  };
  vm.runInNewContext(source, context);
  const visible = () => rowEls.filter((r) => !r.hidden).map((r) => r.id);
  return { rowEls, groups, links, typeLinks, typeNameSlot, status, closeEls, body, nameSlot, slots, storage, replaced, visible, data };
}

test('the region filter hides only non-matching regional rows; national rows always show', async () => {
  const source = await read('assets/js/when-india-travels.js');
  const ids = (key) => B.upcomingBreaks(B.isoDay(), { region: key }).map((b) => b.id);
  const everything = runScript(source);
  assert.deepEqual(everything.visible().sort(), ids('all').slice().sort(), 'All shows every row');
  assert.equal(everything.body.attrs['data-wit-region'], 'all');
  assert.equal(everything.links[0].attrs['aria-current'], 'true');

  for (const filter of B.REGION_FILTERS.filter((f) => f.key !== 'all')) {
    const run = runScript(source, { search: `?region=${filter.key}` });
    const shown = run.visible();
    assert.deepEqual(shown.slice().sort(), ids(filter.key).slice().sort(), filter.key);
    for (const brk of rows()) {
      const row = run.rowEls.find((r) => r.id === brk.id);
      if (B.isPureNational(brk)) assert.equal(row.hidden, false, `${filter.key}: national ${brk.id} stays`);
      else assert.equal(row.hidden, !brk.regions.some((r) => filter.codes.includes(r)), `${filter.key}: ${brk.id}`);
    }
    assert.equal(run.body.attrs['data-wit-region'], filter.key);
  }
  const chennai = runScript(source, { search: '?region=tamil-nadu' });
  assert.ok(chennai.rowEls.find((r) => r.id === 'guru-nanak-2026').hidden, 'national + states row hidden for a non-listed region');
  assert.ok(!chennai.rowEls.find((r) => r.id === 'diwali-2026').hidden, 'pure national row stays');
  assert.ok(!chennai.rowEls.find((r) => r.id === 'ayutha-pooja-2026-tn').hidden);
  assert.ok(chennai.rowEls.find((r) => r.id === 'durga-puja-2026').hidden);
  const mumbai = runScript(source, { search: '?region=maharashtra' });
  assert.ok(!mumbai.rowEls.find((r) => r.id === 'guru-nanak-2026').hidden, 'listed region keeps it');
  assert.ok(!everything.rowEls.find((r) => r.id === 'guru-nanak-2026').hidden, 'All shows it');
  const kolkata = runScript(source, { search: '?region=west-bengal' });
  assert.ok(kolkata.rowEls.find((r) => r.id === 'diwali-2026-mh').hidden);
  assert.ok(!kolkata.rowEls.find((r) => r.id === 'durga-puja-2026').hidden);
  assert.ok(!kolkata.groups[0].hidden, 'national section stays');
});

test('?region=MH preselects Maharashtra, then the remembered choice, then All; clicks update the URL and storage', async () => {
  const source = await read('assets/js/when-india-travels.js');
  const mh = runScript(source, { search: '?region=MH' });
  assert.equal(mh.body.attrs['data-wit-region'], 'maharashtra');
  assert.equal(mh.nameSlot.textContent, 'Maharashtra');
  assert.ok(mh.rowEls.find((r) => r.id === 'durga-puja-2026').hidden);
  assert.ok(!mh.rowEls.find((r) => r.id === 'diwali-2026-mh').hidden);
  assert.equal(runScript(source, { stored: 'tamil-nadu' }).body.attrs['data-wit-region'], 'tamil-nadu');
  assert.equal(runScript(source, { search: '?region=ZZ', stored: 'tamil-nadu' }).body.attrs['data-wit-region'], 'tamil-nadu');
  assert.equal(runScript(source, { search: '?region=karnataka', stored: 'tamil-nadu' }).body.attrs['data-wit-region'], 'karnataka')
  assert.equal(runScript(source, { search: '?region=bengaluru' }).body.attrs['data-wit-region'], 'karnataka', 'old city link')
  assert.equal(runScript(source, { stored: 'chennai' }).body.attrs['data-wit-region'], 'tamil-nadu', 'old saved city');
  assert.equal(runScript(source, {}).body.attrs['data-wit-region'], 'all');
  const run = runScript(source, {});
  const link = run.links.find((l) => l.attrs['data-wit-filter'] === 'telangana');
  let prevented = false;
  link.handler({ preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(run.body.attrs['data-wit-region'], 'telangana');
  assert.equal(run.storage.get('friday.breaks-region.v1'), 'telangana');
  assert.deepEqual(run.replaced, ['/when-india-travels.html?region=telangana']);
  assert.equal(run.links.find((l) => l.attrs['data-wit-filter'] === 'gujarat').attrs.href, '?region=gujarat');
  assert.doesNotMatch(source, /\/api\/|fetch\(|auth\/me/);
});

const indexHtml = await read('index.html');
const sourceJs = await read('assets/js/when-india-travels.js');
const homeSection = (page) => page.match(/<section class="section section--tight home-breaks"[^]*?<\/section>/)[0];
const trackOf = (section) => section.match(/<ul class="wit-track" data-wit-track>[^]*?<\/ul>/)[0];
const regionalOf = (section) => section.match(/<template data-wit-regional>[^]*?<\/template>/)[0];
const cardsIn = (section) => [...section.matchAll(/<li class="wit-card-item" data-wit-card data-regions="([^"]*)" data-start="[^"]*" data-end="([^"]*)" data-id="[^"]*">\s*<a class="wit-card" href="([^"]*)">([^]*?)<\/li>/g)];
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('the homepage section renders from the data: heading, lede, link, and one card per upcoming national break', () => {
  const section = homeSection(indexHtml);
  const upcoming = B.upcomingBreaks(buildToday).filter(B.isPureNational);
  assert.match(section, /<p class="eyebrow">When India travels<\/p>/);
  assert.match(section, /<h2 class="h2" id="home-breaks-title">When India<br><em>travels\.<\/em><\/h2>/);
  assert.match(section, /<p class="lede">The long weekends, festival breaks and school holidays coming up, and the places that suit each one\.<\/p>/);
  assert.match(section, /<a class="link" data-wit-teaser-link href="when-india-travels\.html">See every break <span class="arrow">&rarr;<\/span><\/a>/);
  assert.doesNotMatch(section, /style="(?!--i|object-position:)|top pick|destination=/);
  const cards = cardsIn(trackOf(section));
  assert.equal(cards.length, upcoming.length);
  assert.ok(upcoming.length > 3, 'all upcoming national breaks, not just three');
  cards.forEach((m, i) => {
    const brk = upcoming[i];
    assert.equal(m[1], brk.regions.join(' '));
    assert.equal(m[2], brk.endDate);
    assert.equal(m[3], `when-india-travels.html#${brk.id}`);
    assert.ok(html.includes(`id="${brk.id}"`), `${brk.id} has an anchor on the page`);
    assert.match(m[4], /<p class="eyebrow eyebrow--accent wit-card__dates">[^<]+ · \d+ nights?<\/p>/);
    assert.match(m[4], new RegExp(`<h3 class="h3 wit-card__t">${escapeRe(escHtml(brk.name))}</h3>`));
    assert.ok(m[4].includes(`First idea: <span>${escHtml(brk.suggestions[0].place)}</span>`));
    assert.match(m[4], /<p class="wit-card__note">[^<]*[.!?]<\/p>/);
    assert.doesNotMatch(m[4], /<p class="wit-card__note">[^<]*[.!?]\s+\S/, 'one sentence only');
  });
  assert.ok(cards.every((m, i) => i === 0 || upcoming[i - 1].startDate <= upcoming[i].startDate), 'date order');
  const dates = (id) => cards[upcoming.findIndex((b) => b.id === id)][4].match(/wit-card__dates">([^<]*)</)[1];
  if (buildToday.startsWith('2026')) assert.equal(dates('dussehra-2026'), '17–20 Oct · 3 nights');
});

test('past breaks are left out of the homepage section at build time', () => {
  const LW = require('../build/when-india-travels.js');
  const later = '2026-11-13';
  const section = LW.homeTeaser({ esc: escHtml, today: later });
  const ids = cardsIn(trackOf(section)).map((m) => m[3].split('#')[1]);
  assert.deepEqual(ids, B.upcomingBreaks(later).filter(B.isPureNational).map((b) => b.id));
  for (const gone of ['dussehra-2026', 'durga-puja-2026', 'diwali-2026', 'kali-puja-2026']) assert.ok(!ids.includes(gone) && !regionalOf(section).includes(`#${gone}"`), `${gone} is past`);
  assert.ok(ids.includes('christmas-2026'));
  assert.equal(LW.homeTeaser({ esc: escHtml, today: '2030-01-01' }), '');
});

test('the default homepage carousel is national only: no state-specific rows in the static HTML, which waits in a template', () => {
  const section = homeSection(indexHtml);
  const track = cardsIn(trackOf(section)).map((m) => m[3].split('#')[1]);
  const upcoming = B.upcomingBreaks(buildToday);
  assert.deepEqual(track, upcoming.filter(B.isPureNational).map((b) => b.id));
  const regional = upcoming.filter((b) => !B.isPureNational(b)).map((b) => b.id);
  assert.ok(regional.length > 5);
  for (const id of regional) assert.ok(!trackOf(section).includes(`#${id}"`), `${id} is not in the static carousel`);
  for (const id of ['school-dasara-2026-blr', 'navratri-2026-gj']) assert.ok(!trackOf(section).includes(id));
  assert.ok(!/Dasara break \(Bengaluru|Navratri \(Ahmedabad/.test(trackOf(section)));
  assert.deepEqual(cardsIn(regionalOf(section)).map((m) => m[3].split('#')[1]), regional, 'the template holds exactly the regional rows');
  assert.match(section, /<template data-wit-regional>/);
  if (buildToday.startsWith('2026-10')) assert.deepEqual(track.slice(0, 3), ['dussehra-2026', 'diwali-2026', 'christmas-2026']);
});

test('the carousel markup is a scroll-snap row of links, with labelled arrow buttons that are hidden without JS', async () => {
  const css = await read('assets/css/friday.css');
  const section = homeSection(indexHtml);
  assert.match(section, /data-wit-carousel role="group" aria-roledescription="carousel" aria-label="Upcoming breaks"/);
  assert.match(section, /<ul class="wit-track" data-wit-track>/);
  assert.match(section, /<div class="wit-nav" data-wit-nav hidden>/);
  assert.match(section, /<button class="wit-nav__btn" type="button" data-wit-prev aria-label="Previous breaks" disabled>/);
  assert.match(section, /<button class="wit-nav__btn" type="button" data-wit-next aria-label="Next breaks">/);
  assert.ok(cardsIn(section).every((m) => m[0].includes('<a class="wit-card" href=')), 'each card is a link');
  assert.match(css, /\.wit-track \{[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;[^}]*scrollbar-width: none;/);
  assert.match(css, /\.wit-card-item \{[^}]*scroll-snap-align: start;/);
  assert.match(css, /\.home-breaks__grid \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 2fr\);[^}]*gap: clamp\(2rem, 5vw, 5rem\);/);
  assert.match(css, /\.wit-card \{[^}]*border: 1px solid rgba\(21, 20, 15, \.14\);[^}]*border-radius: 14px;[^}]*background: rgba\(255, 255, 255, \.35\);/);
  assert.match(css, /\.wit-card__dates \{[^}]*white-space: nowrap;/);
  assert.match(css, /flex-basis: calc\(\(100% - var\(--wit-gap\)\) \/ 1\.15\)/);
});

function runCarousel({ stored = null, today = buildToday, reduced = false, storedType = null } = {}) {
  const el = (attrs = {}) => {
    const a = { ...attrs };
    return { hidden: false, disabled: false, attrs: a, listeners: {}, getAttribute: (n) => (n in a ? a[n] : null), setAttribute(n, v) { a[n] = String(v); }, addEventListener(type, fn) { this.listeners[type] = fn; } };
  };
  const section = homeSection(indexHtml);
  const make = (m, i) => Object.assign(el({ 'data-regions': m[1], 'data-end': m[2], 'data-start': m[0].match(/data-start="([^"]*)"/)[1], 'data-id': m[3].split('#')[1] }), { offsetLeft: i * 300, offsetWidth: 280, id: m[3].split('#')[1], closest() { return this; } });
  const cards = cardsIn(trackOf(section)).map(make);
  const waiting = cardsIn(regionalOf(section)).map(make);
  waiting.forEach((c) => { c.cloneNode = () => Object.assign(el({ ...c.attrs }), { id: c.id, closest() { return this; } }); });
  const track = Object.assign(el(), {
    scrollLeft: 0, clientWidth: 900, scrolled: [], scrollBy(o) { this.scrolled.push(o); }, scrollTo(o) { this.scrolledTo = o; },
    querySelectorAll: (sel) => (sel === '[data-wit-card]' ? cards : []),
    insertBefore(node, ref) { cards.splice(cards.indexOf(ref), 0, node); }, appendChild(node) { cards.push(node); },
  });
  Object.defineProperty(track, 'scrollWidth', { get: () => cards.length * 300 });
  const prev = Object.assign(el(), { disabled: true }), next = el(), nav = Object.assign(el(), { hidden: true }), link = el({ href: 'when-india-travels.html' });
  const tpl = { content: { querySelectorAll: (sel) => (sel === '[data-wit-card]' ? waiting : []) } };
  const parts = { '[data-wit-track]': track, '[data-wit-prev]': prev, '[data-wit-next]': next, '[data-wit-nav]': nav, '[data-wit-teaser-link]': link, '[data-wit-regional]': tpl };
  const teaser = { querySelector: (sel) => parts[sel] || null, querySelectorAll: () => [] };
  const data = JSON.parse(html.match(/<script type="application\/json" id="wit-data">(.*?)<\/script>/s)[1]);
  const storage = new Map([...(stored ? [['friday.breaks-region.v1', stored]] : []), ...(storedType ? [['friday.breaks-type.v1', storedType]] : [])]);
  const FakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [`${today}T12:00:00`])); } };
  vm.runInNewContext(sourceJs, {
    document: { body: el(), getElementById: (id) => (id === 'wit-data' ? { textContent: JSON.stringify(data) } : null), querySelectorAll: () => [], querySelector: (sel) => (sel === '[data-wit-teaser]' ? teaser : null) },
    window: { addEventListener() {}, matchMedia: () => ({ matches: reduced }) },
    URLSearchParams, Date: FakeDate, Array, Object, String, JSON,
    location: { search: '', pathname: '/' }, history: { replaceState() {} },
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem() {} },
  });
  return { cards, track, prev, next, nav, link, visible: () => cards.filter((c) => !c.hidden).map((c) => c.id) };
}

test('carousel script: with nothing saved only national breaks show; a saved state adds its own in date order; the type filter is ignored', () => {
  const national = B.upcomingBreaks(buildToday).filter(B.isPureNational).map((b) => b.id);
  const none = runCarousel();
  assert.deepEqual(none.visible(), national);
  assert.equal(none.nav.hidden, false);
  assert.equal(none.link.attrs.href, 'when-india-travels.html');
  assert.deepEqual(runCarousel({ stored: 'all' }).visible(), national, 'All is not a state');
  const wb = runCarousel({ stored: 'west-bengal' });
  const expected = B.upcomingBreaks(buildToday, { region: 'west-bengal' }).map((b) => b.id);
  assert.deepEqual(wb.visible(), expected);
  assert.ok(expected.length > national.length - 20 && expected.some((id) => !national.includes(id)), 'regional rows were added');
  assert.ok(expected.includes('dussehra-2026') && expected.includes('durga-puja-2026') && !expected.includes('navratri-2026-gj'));
  assert.ok(national.every((id) => expected.includes(id)), 'national rows stay');
  assert.equal(wb.link.attrs.href, 'when-india-travels.html?region=west-bengal');
  assert.deepEqual(runCarousel({ stored: 'west-bengal', storedType: 'school' }).visible(), expected, 'no type filter on the homepage');
  assert.equal(runCarousel({ stored: 'gujarat' }).visible().includes('navratri-2026-gj'), true);
});

test('carousel script: breaks that ended after the build are hidden by date', () => {
  const ids = runCarousel({ today: '2026-11-13' }).visible();
  assert.ok(!ids.includes('dussehra-2026') && !ids.includes('diwali-2026') && ids.includes('christmas-2026'));
  assert.deepEqual(ids, B.upcomingBreaks('2026-11-13').filter(B.isPureNational).map((b) => b.id));
  const wb = runCarousel({ today: '2026-11-13', stored: 'west-bengal' }).visible();
  assert.ok(!wb.includes('durga-puja-2026') && !wb.includes('kali-puja-2026'));
  assert.deepEqual(wb, B.upcomingBreaks('2026-11-13', { region: 'west-bengal' }).map((b) => b.id));
});

test('carousel script: arrows scroll one card and disable at each end; reduced motion is respected; focus keeps the card in view', () => {
  const run = runCarousel();
  assert.equal(run.prev.disabled, true);
  assert.equal(run.next.disabled, false);
  run.next.listeners.click();
  assert.equal(JSON.stringify(run.track.scrolled[0]), JSON.stringify({ left: 300, behavior: 'smooth' }));
  run.track.scrollLeft = 600;
  run.track.listeners.scroll();
  assert.equal(run.prev.disabled, false);
  run.prev.listeners.click();
  assert.equal(JSON.stringify(run.track.scrolled[1]), JSON.stringify({ left: -300, behavior: 'smooth' }));
  run.track.scrollLeft = run.track.scrollWidth - run.track.clientWidth;
  run.track.listeners.scroll();
  assert.equal(run.next.disabled, true);
  run.track.scrollLeft = 0;
  run.track.listeners.focusin({ target: run.cards[4] });
  assert.equal(run.track.scrolledTo.left, 4 * 300 + 280 - 900);
  const calm = runCarousel({ reduced: true });
  calm.next.listeners.click();
  assert.equal(calm.track.scrolled[0].behavior, 'auto');
});

test('When India travels is linked from the footer, field notes, the Mumbai guide, the guides and the homepage, not the top nav', async () => {
  const index = await read('index.html');
  const mumbai = await read('mumbai-quiet-weekend.html');
  const notes = await read('field-notes.html');
  const guides = await read('guides.html');
  for (const page of [index, mumbai, notes, guides, html]) {
    assert.match(page, /<ul class="foot__list">[^]*?<li><a href="when-india-travels\.html">When India travels<\/a><\/li>/);
    const header = page.match(/<header[^]*?<\/header>/)[0];
    assert.doesNotMatch(header, /when-india-travels\.html/);
    assert.doesNotMatch(page, /long-weekends\.html/);
  }
  assert.match(notes, /href="when-india-travels\.html"[^>]*>[^]*?When India travels/);
  assert.match(mumbai, /href="when-india-travels\.html\?region=MH"/);
  assert.match(mumbai, /Planning around a long weekend\?/);
  assert.match(index, /assets\/js\/when-india-travels\.js/);
  assert.match(index, /href="when-india-travels\.html"/);
  assert.match(html, /href="guides\.html"/);
  assert.match(html, /data-wit-close-link href="trip\.html"/, 'Closer to home is neutral in the static HTML');
});

test('the planner reads ?start= and ?nights= when it opens a new trip', async () => {
  const source = await read('assets/js/trip-app.js');
  const body = source.match(/\/\* BEGIN requested-dates[^]*?\*\/\n([^]*?)\n\s*\/\* END requested-dates \*\//)[1];
  const FT = {};
  vm.runInNewContext(body, { FT, URLSearchParams, Date });
  const parse = FT.parseRequestedDates;
  assert.deepEqual({ ...parse('?destination=goa&start=2026-11-06&nights=5', TODAY) }, { start: '2026-11-06', end: '2026-11-11', nights: 5 });
  assert.equal(parse('?start=2026-12-28&nights=7', TODAY).end, '2027-01-04');
  assert.equal(parse('?start=2026-10-07&nights=1', TODAY).end, '2026-10-08', 'today is not the past');
  assert.equal(parse('?start=2026-10-06&nights=3', TODAY), null, 'past');
  assert.equal(parse('?start=2026-02-30&nights=3', '2026-01-01'), null, 'not a real date');
  assert.equal(parse('?start=2026-13-01&nights=3', '2026-01-01'), null);
  assert.equal(parse('?start=tomorrow&nights=3', TODAY), null);
  assert.equal(parse('?start=2026-11-06&nights=0', TODAY), null);
  assert.equal(parse('?start=2026-11-06&nights=31', TODAY), null);
  assert.equal(parse('?start=2026-11-06&nights=2.5', TODAY), null);
  assert.equal(parse('?start=2026-11-06', TODAY), null);
  assert.equal(parse('', TODAY), null);
  assert.match(source, /created\.prefs = Object\.assign\(\{\}, created\.prefs, \{ dates: \{ start: dates\.start, end: dates\.end \}/);
  assert.match(source, /q\.delete\('start'\); q\.delete\('nights'\)/);
});

test('the planner reads ?place= as plain text, capped and cleaned, and a catalogue id or name there presets the destination', async () => {
  const source = await read('assets/js/trip-app.js');
  const block = source.match(/\/\* BEGIN requested-place[^]*?\*\/\n([^]*?)\n\s*\/\* END requested-place \*\//)[1];
  const FT = {};
  vm.runInNewContext(block, { FT, URLSearchParams });
  const place = FT.parseRequestedPlace;
  assert.equal(place('?place=Coorg'), 'Coorg');
  assert.equal(place('?place=%20%20Andaman%20%20Islands%20'), 'Andaman Islands');
  assert.equal(place('?place=' + 'x'.repeat(200)).length, 80);
  assert.equal(place('?place=a%00b%0Ac%1Fd'), 'a b c d');
  assert.equal(place(''), '');
  assert.equal(place('?place=%20%20'), '');
  assert.equal(place('?place=<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>', 'kept as text; it is escaped where it is shown');
  assert.match(source, /esc\(starterText \+ datesNote\)/, 'escaped into the textarea');
  assert.match(source, /'Plan a trip to ' \+ presetPlace \+ '\.'/);
  assert.match(source, /Where should we go\?/);
  assert.match(source, /q\.delete\('place'\)/);
  assert.match(source, /own\(place\) \|\| own\(byName\)/);
});

test('the planner no longer steers a traveller to six destinations, and plans an outside place through the server', async () => {
  const chat = await read('assets/js/trip-chat.js');
  assert.doesNotMatch(chat, /In this preview I can plan|Detailed suggestions are currently available|I do not have detailed place suggestions/);
  assert.match(chat, /Name any place, in India or abroad/);
  assert.match(chat, /function freeformPlan/);
  assert.match(chat, /postJson\('api\/itineraries', body\)/);
  assert.match(chat, /preplanned\[d\.id\]/);
});

/* ------------------------------------------------------------ type of break */
const ALL_ROWS = () => B.upcomingBreaks(B.isoDay());

test('every row has a types field that follows its kind and length, and every type pill matches at least one row', () => {
  const allowed = B.TYPE_FILTERS.filter((t) => t.key !== 'all').map((t) => t.key);
  assert.deepEqual(allowed, ['festival', 'school', 'long-weekend', 'short-escape']);
  assert.deepEqual(B.TYPE_FILTERS.map((t) => t.label), ['All', 'Festival breaks', 'School holidays', 'Long weekends', 'Short escapes']);
  for (const brk of B.BREAKS) {
    assert.ok(Array.isArray(brk.types) && brk.types.length >= 1 && brk.types.every((t) => allowed.includes(t)), `${brk.id} types`);
    assert.equal(brk.types.includes('school'), brk.kind === 'school-break', `${brk.id} school`);
    assert.equal(brk.types.includes('long-weekend'), brk.kind === 'long-weekend', `${brk.id} long weekend`);
    assert.equal(brk.types.includes('short-escape'), brk.kind !== 'school-break' && brk.nights <= 2, `${brk.id} short escape`);
    if (brk.group === 'festival') assert.ok(brk.types.includes('festival'), `${brk.id} regional festival rows are festival breaks`);
    if (brk.kind === 'school-break') assert.deepEqual(brk.types, ['school']);
  }
  const rows = ALL_ROWS();
  for (const t of allowed) assert.ok(rows.filter((b) => b.types.includes(t)).length >= 1, `${t} has a row`);
  assert.equal(rows.filter((b) => B.matchesType(b, 'all')).length, rows.length);
  assert.deepEqual(rows.filter((b) => b.types.includes('short-escape')).map((b) => b.id).sort(), ['bakrid-2027', 'christmas-2026', 'new-year-2027', 'shivaji-jayanti-2027']);
  assert.equal(B.resolveType('Festival breaks'), 'festival');
  assert.equal(B.resolveType('short-escape'), 'short-escape');
  assert.equal(B.resolveType('nonsense'), null);
  assert.deepEqual(B.upcomingBreaks(B.isoDay(), { type: 'school', region: 'maharashtra' }).map((b) => b.group), ['school', 'school', 'school', 'school']);
});

test('the page renders a Type of break filter with the same pills as Show breaks for, and every row carries data-types', () => {
  assert.match(html, /<h2 class="eyebrow" id="wit-filter-h">Show breaks for<\/h2>/);
  assert.match(html, /<h2 class="eyebrow" id="wit-type-h">Type of break<\/h2>/);
  const pills = [...html.matchAll(/<a class="lw-city-link" href="\?type=([a-z-]+)" data-wit-type="([a-z-]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(pills.map((m) => [m[1], m[2], m[3]]), B.TYPE_FILTERS.map((t) => [t.key, t.key, t.label]));
  for (const brk of ALL_ROWS()) assert.match(html, new RegExp(`id="${brk.id}" data-wit-row data-regions="[^"]*" data-types="${brk.types.join(' ')}"`));
  // The header's sign-out buttons start hidden until the session check shows a signed-in user.
  assert.doesNotMatch(html.replace(/<button [^>]*data-(?:nav|menu)-signout hidden>/g, ''), /\shidden[\s=>]/);
});

test('the type filter and the state filter combine (state AND type), hide empty sections, and say so when nothing matches', async () => {
  const source = await read('assets/js/when-india-travels.js');
  const expected = (region, type) => B.upcomingBreaks(B.isoDay(), { region, type }).map((b) => b.id).sort();
  for (const region of B.REGION_FILTERS) {
    for (const type of B.TYPE_FILTERS) {
      const run = runScript(source, { search: `?region=${region.key}&type=${type.key}` });
      assert.deepEqual(run.visible().sort(), expected(region.key, type.key), `${region.key} + ${type.key}`);
      assert.equal(run.body.attrs['data-wit-type'], type.key);
      assert.equal(run.status.textContent === '', expected(region.key, type.key).length > 0, `${region.key} + ${type.key} status`);
    }
  }
  /* Just a type: the state stays All. */
  const festival = runScript(source, { search: '?type=festival' });
  assert.equal(festival.body.attrs['data-wit-region'], 'all');
  assert.equal(festival.visible().length, 20);
  assert.equal(festival.typeNameSlot.textContent, 'Festival breaks');
  assert.ok(festival.groups[2].hidden, 'the school section is empty and hidden');
  assert.ok(!festival.groups[0].hidden && !festival.groups[1].hidden);
  const mhSchool = runScript(source, { search: '?region=MH&type=school' });
  assert.equal(mhSchool.visible().length, 4);
  assert.ok(mhSchool.groups[0].hidden && mhSchool.groups[1].hidden && !mhSchool.groups[2].hidden);
  /* A combination with nothing shows a sensible message and hides every section. */
  const empty = runScript(source, { search: '?region=telangana&type=school' });
  assert.deepEqual(empty.visible(), []);
  assert.ok(empty.groups.every((g) => g.hidden));
  assert.match(empty.status.textContent, /No breaks match school holidays in Telangana/);
  assert.match(empty.status.textContent, /choose All/);
  assert.equal(runScript(source, { search: '?region=gujarat&type=school' }).visible().length, 0);
  assert.equal(runScript(source, {}).status.textContent, '');
});

test('each filter keeps the other filter\'s value in its links and in the address; type is remembered like the state', async () => {
  const source = await read('assets/js/when-india-travels.js');
  const run = runScript(source, { search: '?region=karnataka&type=festival' });
  assert.equal(run.links.find((l) => l.attrs['data-wit-filter'] === 'delhi').attrs.href, '?region=delhi&type=festival');
  assert.equal(run.links.find((l) => l.attrs['data-wit-filter'] === 'all').attrs.href, '?region=all&type=festival');
  assert.equal(run.typeLinks.find((l) => l.attrs['data-wit-type'] === 'school').attrs.href, '?region=karnataka&type=school');
  assert.equal(run.typeLinks.find((l) => l.attrs['data-wit-type'] === 'all').attrs.href, '?region=karnataka');
  assert.equal(run.typeLinks.find((l) => l.attrs['data-wit-type'] === 'festival').attrs['aria-current'], 'true');
  let prevented = 0;
  const click = (link) => link.handler({ preventDefault() { prevented++; } });
  click(run.typeLinks.find((l) => l.attrs['data-wit-type'] === 'school'));
  assert.equal(prevented, 1);
  assert.equal(run.body.attrs['data-wit-region'], 'karnataka', 'state kept');
  assert.equal(run.body.attrs['data-wit-type'], 'school');
  assert.equal(run.storage.get('friday.breaks-type.v1'), 'school');
  assert.equal(run.storage.get('friday.breaks-region.v1'), undefined, 'a type click does not touch the saved state');
  assert.equal(run.replaced.at(-1), '/when-india-travels.html?region=karnataka&type=school');
  click(run.links.find((l) => l.attrs['data-wit-filter'] === 'delhi'));
  assert.equal(run.body.attrs['data-wit-type'], 'school', 'type kept');
  assert.equal(run.storage.get('friday.breaks-region.v1'), 'delhi');
  assert.equal(run.replaced.at(-1), '/when-india-travels.html?region=delhi&type=school');
  click(run.typeLinks.find((l) => l.attrs['data-wit-type'] === 'all'));
  assert.equal(run.storage.get('friday.breaks-type.v1'), 'all');
  assert.equal(run.replaced.at(-1), '/when-india-travels.html?region=delhi');
  /* selection order: ?type= -> last choice on this device -> All */
  assert.equal(runScript(source, { storedType: 'long-weekend' }).body.attrs['data-wit-type'], 'long-weekend');
  assert.equal(runScript(source, { search: '?type=short-escape', storedType: 'long-weekend' }).body.attrs['data-wit-type'], 'short-escape');
  assert.equal(runScript(source, { search: '?type=bogus', storedType: 'school' }).body.attrs['data-wit-type'], 'school');
  assert.equal(runScript(source, { search: '?type=Festival%20breaks' }).body.attrs['data-wit-type'], 'festival');
  assert.equal(runScript(source, {}).body.attrs['data-wit-type'], 'all');
  assert.equal(runScript(source, { storedType: 'school', stored: 'gujarat' }).body.attrs['data-wit-region'], 'gujarat');
});

test('Closer to home is neutral in the HTML and for every state without its own short-escape guide; Maharashtra gets the Mumbai guide', async () => {
  const source = await read('assets/js/when-india-travels.js');
  const block = html.match(/<p class="lede lw-close"[^]*?<\/p>/)[0];
  assert.doesNotMatch(block, /Bombay|Mumbai|Pune|mumbai-quiet-weekend/);
  assert.match(block, /wherever you are starting/);
  assert.match(block, /data-wit-close-link href="trip\.html"/);
  assert.match(block, /href="contact\.html\?topic=Short%20escape#callback-title"/);
  assert.match(block, /href="guides\.html"/);
  assert.match(html, /<h2 class="h2" id="wit-close-h">A short escape instead\?<\/h2>/);
  assert.deepEqual(Object.keys(B.CLOSE_BY_REGION), ['maharashtra']);
  assert.equal(B.CLOSE_BY_REGION.maharashtra.href, 'mumbai-quiet-weekend.html');
  assert.ok((await read('mumbai-quiet-weekend.html')).length > 0);
  for (const filter of B.REGION_FILTERS) {
    const run = runScript(source, { search: `?region=${filter.key}` });
    const lead = run.closeEls['[data-wit-close-lead]'].textContent;
    const link = run.closeEls['[data-wit-close-link]'].attrs.href;
    const more = run.closeEls['[data-wit-close-more]'];
    if (filter.key === 'maharashtra') {
      assert.match(lead, /In Maharashtra, starting from Mumbai\?/);
      assert.equal(link, 'mumbai-quiet-weekend.html');
      assert.equal(run.closeEls['[data-wit-close-label]'].textContent, 'the quiet weekend guide');
      assert.equal(more.hidden, true);
    } else {
      assert.equal(lead, B.CLOSE_NEUTRAL.lead, filter.key);
      assert.equal(link, 'trip.html', filter.key);
      assert.equal(run.closeEls['[data-wit-close-label]'].textContent, B.CLOSE_NEUTRAL.label);
      assert.equal(more.hidden, false);
      assert.doesNotMatch(lead, /Bombay|Mumbai|Pune/);
    }
  }
  /* moving between states swaps it back */
  const run = runScript(source, { search: '?region=MH' });
  run.links.find((l) => l.attrs['data-wit-filter'] === 'all').handler({ preventDefault() {} });
  assert.equal(run.closeEls['[data-wit-close-link]'].attrs.href, 'trip.html');
  assert.equal(run.closeEls['[data-wit-close-more]'].hidden, false);
});
