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
  const kolkata = B.upcomingBreaks(TODAY, { region: 'kolkata' }).map((b) => b.id);
  assert.ok(kolkata.includes('durga-puja-2026') && kolkata.includes('diwali-2026'));
  assert.ok(kolkata.includes('guru-nanak-2026') && !kolkata.includes('diwali-2026-mh') && !kolkata.includes('sankranti-pongal-2027'));
  assert.equal(B.nextBreak(TODAY, 'all').group, 'national');
  assert.equal(B.nextBreak(TODAY, 'kolkata').id, 'durga-puja-2026');
});

test('Ladakh is only a May/June suggestion, Kyoto only a 6+ night spring or autumn one, and places are not limited to a short list', () => {
  let ladakh = 0, kyoto = 0;
  const places = new Set();
  for (const brk of B.upcomingBreaks(TODAY)) {
    for (const sug of brk.suggestions) {
      places.add(sug.place);
      const month = Number(sug.start.slice(5, 7));
      if (/ladakh/i.test(sug.place)) { ladakh++; assert.ok([5, 6].includes(month), `${brk.id} ladakh in month ${month}`); }
      if (/kyoto/i.test(sug.place)) { kyoto++; assert.ok(sug.nights >= 6, `${brk.id} kyoto nights`); assert.ok([3, 4, 10, 11].includes(month), `${brk.id} kyoto month ${month}`); }
    }
  }
  assert.ok(ladakh > 0 && kyoto > 0);
  assert.ok(places.size >= 20, 'a wide spread of places');
  for (const place of ['Coorg', 'Andaman Islands', 'Meghalaya', 'Bhutan', 'Himachal Pradesh', 'Vietnam']) assert.ok(places.has(place), place);
});

test('the three groups render in order, with no hidden attributes in the static HTML', () => {
  const at = (group) => html.indexOf(`data-wit-group="${group}"`);
  assert.ok(at('national') > 0 && at('national') < at('festival') && at('festival') < at('school'));
  assert.match(html, /<h2 class="h2" id="national-h">National long weekends<\/h2>/);
  assert.match(html, /<h2 class="h2" id="festival-h">Festival breaks<\/h2>/);
  assert.match(html, /<h2 class="h2" id="school-h">School holidays<\/h2>/);
  assert.doesNotMatch(html, /\shidden[\s=>]/);
  assert.match(html, /<script type="application\/json" id="wit-data">/);
  const ids = [...html.matchAll(/<article class="lw-break" id="([a-z0-9-]+)" data-wit-row data-regions="([^"]*)"/g)];
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

test('region keys resolve from keys and state codes', () => {
  assert.equal(B.resolveRegion('MH'), 'mumbai-pune');
  assert.equal(B.resolveRegion('mumbai-pune'), 'mumbai-pune');
  assert.equal(B.resolveRegion('HR'), 'delhi-ncr');
  assert.equal(B.resolveRegion('Delhi NCR'), 'delhi-ncr');
  assert.equal(B.resolveRegion('ka'), 'bengaluru');
  assert.equal(B.resolveRegion('all'), 'all');
  assert.equal(B.resolveRegion('ZZ'), null);
  assert.equal(B.resolveRegion(''), null);
  for (const [key, code] of [['chennai', 'TN'], ['hyderabad', 'TS'], ['kolkata', 'WB'], ['ahmedabad', 'GJ']]) assert.equal(B.resolveRegion(code), key);
});

/* A tiny DOM: just what assets/js/when-india-travels.js touches. */
function runScript(source, { search = '', stored = null, home = false } = {}) {
  const data = JSON.parse(html.match(/<script type="application\/json" id="wit-data">(.*?)<\/script>/s)[1]);
  const el = (attrs) => {
    const a = { ...attrs };
    return { hidden: false, attrs: a, children: [], textContent: '', getAttribute: (n) => (n in a ? a[n] : null), setAttribute(n, v) { a[n] = String(v); }, removeAttribute(n) { delete a[n]; }, addEventListener(type, fn) { this.handler = fn; }, querySelectorAll(sel) { return sel === '[data-wit-row]' ? this.children : []; } };
  };
  const rowEls = [...html.matchAll(/<article class="lw-break" id="([a-z0-9-]+)" data-wit-row data-regions="([^"]*)" data-end="([^"]*)"/g)].map((m) => Object.assign(el({ 'data-regions': m[2], 'data-end': m[3] }), { id: m[1] }));
  const groups = B.GROUPS.map((g) => Object.assign(el({ 'data-wit-group': g }), { children: [] }));
  for (const row of rowEls) {
    const brk = B.BREAKS.find((b) => b.id === row.id);
    groups[B.GROUPS.indexOf(brk.group)].children.push(row);
  }
  const links = data.filters.map((f) => el({ 'data-wit-filter': f.key }));
  const nameSlot = el({});
  const teaser = el({});
  const slots = { '[data-wit-teaser-break]': el({}), '[data-wit-teaser-dates]': el({}), '[data-wit-teaser-place]': el({}), '[data-wit-teaser-nights]': el({}), '[data-wit-teaser-link]': el({ href: 'when-india-travels.html' }) };
  teaser.querySelector = (sel) => slots[sel] || null;
  const body = el({});
  const storage = new Map(stored ? [['friday.breaks-region.v1', stored]] : []);
  const replaced = [];
  const doc = {
    body,
    getElementById: (id) => (id === 'wit-data' ? { textContent: JSON.stringify(data) } : null),
    querySelectorAll: (sel) => ({ '[data-wit-row]': home ? [] : rowEls, '[data-wit-filter]': links, '[data-wit-group]': groups, '[data-wit-region-name]': [nameSlot] }[sel] || []),
    querySelector: (sel) => (sel === '[data-wit-teaser]' && home ? teaser : null),
  };
  const context = {
    document: doc, URLSearchParams, Date, Array, Object, String, JSON,
    location: { search, pathname: '/when-india-travels.html' }, history: { replaceState: (a, b, url) => replaced.push(url) },
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v) },
  };
  vm.runInNewContext(source, context);
  const visible = () => rowEls.filter((r) => !r.hidden).map((r) => r.id);
  return { rowEls, groups, links, body, nameSlot, slots, storage, replaced, visible, data };
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
  const chennai = runScript(source, { search: '?region=chennai' });
  assert.ok(chennai.rowEls.find((r) => r.id === 'guru-nanak-2026').hidden, 'national + states row hidden for a non-listed region');
  assert.ok(!chennai.rowEls.find((r) => r.id === 'diwali-2026').hidden, 'pure national row stays');
  assert.ok(!chennai.rowEls.find((r) => r.id === 'ayutha-pooja-2026-tn').hidden);
  assert.ok(chennai.rowEls.find((r) => r.id === 'durga-puja-2026').hidden);
  const mumbai = runScript(source, { search: '?region=mumbai-pune' });
  assert.ok(!mumbai.rowEls.find((r) => r.id === 'guru-nanak-2026').hidden, 'listed region keeps it');
  assert.ok(!everything.rowEls.find((r) => r.id === 'guru-nanak-2026').hidden, 'All shows it');
  const kolkata = runScript(source, { search: '?region=kolkata' });
  assert.ok(kolkata.rowEls.find((r) => r.id === 'diwali-2026-mh').hidden);
  assert.ok(!kolkata.rowEls.find((r) => r.id === 'durga-puja-2026').hidden);
  assert.ok(!kolkata.groups[0].hidden, 'national section stays');
});

test('?region=MH preselects Mumbai / Pune, then the remembered choice, then All; clicks update the URL and storage', async () => {
  const source = await read('assets/js/when-india-travels.js');
  const mh = runScript(source, { search: '?region=MH' });
  assert.equal(mh.body.attrs['data-wit-region'], 'mumbai-pune');
  assert.equal(mh.nameSlot.textContent, 'Mumbai / Pune');
  assert.ok(mh.rowEls.find((r) => r.id === 'durga-puja-2026').hidden);
  assert.ok(!mh.rowEls.find((r) => r.id === 'diwali-2026-mh').hidden);
  assert.equal(runScript(source, { stored: 'chennai' }).body.attrs['data-wit-region'], 'chennai');
  assert.equal(runScript(source, { search: '?region=ZZ', stored: 'chennai' }).body.attrs['data-wit-region'], 'chennai');
  assert.equal(runScript(source, { search: '?region=bengaluru', stored: 'chennai' }).body.attrs['data-wit-region'], 'bengaluru');
  assert.equal(runScript(source, {}).body.attrs['data-wit-region'], 'all');
  const run = runScript(source, {});
  const link = run.links.find((l) => l.attrs['data-wit-filter'] === 'hyderabad');
  let prevented = false;
  link.handler({ preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(run.body.attrs['data-wit-region'], 'hyderabad');
  assert.equal(run.storage.get('friday.breaks-region.v1'), 'hyderabad');
  assert.deepEqual(run.replaced, ['/when-india-travels.html?region=hyderabad']);
  assert.doesNotMatch(source, /\/api\/|fetch\(|auth\/me/);
});

test('the homepage teaser starts national and swaps to the saved region', async () => {
  const index = await read('index.html');
  const source = await read('assets/js/when-india-travels.js');
  const national = B.nextBreak(buildToday, 'all');
  assert.ok(index.includes('data-wit-teaser'));
  assert.ok(index.includes(national.name) && index.includes(national.suggestions[0].place));
  assert.doesNotMatch(index.match(/data-wit-teaser[^]*?<\/section>/)[0], /top pick|destination=/);
  const plain = runScript(source, { home: true });
  assert.equal(plain.slots['[data-wit-teaser-break]'].textContent, '');
  const saved = runScript(source, { home: true, stored: 'kolkata' });
  const expected = B.nextBreak(buildToday, 'kolkata');
  assert.equal(saved.slots['[data-wit-teaser-break]'].textContent, expected.name);
  assert.equal(saved.slots['[data-wit-teaser-place]'].textContent, expected.suggestions[0].place);
  assert.equal(saved.slots['[data-wit-teaser-link]'].attrs.href, 'when-india-travels.html?region=kolkata');
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
  assert.match(html, /href="mumbai-quiet-weekend\.html"/);
  assert.match(html, /href="guides\.html"/);
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
