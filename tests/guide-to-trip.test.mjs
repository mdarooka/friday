import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const app = await read('assets/js/trip-app.js');

/* Run the planner's own FT.requestedDestination() against a fake catalogue and URL. */
function resolver(search) {
  const body = /FT\.requestedDestination = \(\) => \{[\s\S]*?\n  \};/.exec(app);
  assert.ok(body, 'FT.requestedDestination exists in trip-app.js');
  const FT = { DESTINATIONS: { goa: { id: 'goa' }, kyoto: { id: 'kyoto' } }, dest: (id) => (id && FT.DESTINATIONS[id]) || null };
  vm.runInNewContext(body[0], { FT, location: { search }, URLSearchParams });
  return () => FT.requestedDestination();
}

test('?destination= resolves a catalogue destination, tolerating case and whitespace', () => {
  assert.equal(resolver('?destination=goa')().id, 'goa');
  assert.equal(resolver('?destination=Goa&from_guide=kerala')().id, 'goa');
  assert.equal(resolver('?destination=%20KYOTO%20')().id, 'kyoto');
});

test('unknown, empty and prototype-key destinations are ignored', () => {
  for (const search of ['', '?destination=', '?destination=atlantis', '?destination=constructor', '?destination=__proto__', '?destination=toString', '?destination=goa%00']) {
    assert.equal(resolver(search)(), null, search);
  }
});

test('the new-trip screen seeds and focuses the prompt, and a guide link with trips lands on #/new', () => {
  assert.match(app, /const presetDestination = FT\.requestedDestination\(\);\n\s+const starterText = presetDestination \? \(presetDestination\.prompt/);
  // focus happens even on narrow screens when a destination was preselected
  assert.match(app, /if \(presetDestination \|\| !isNarrow\(\)\) \{ const ta = \$\('\.fx-prompt__ta', el\)/);
  // a bare ?destination= (no #/new) still routes home → new, even when the traveller has trips
  assert.match(app, /if \(FT\.requestedDestination\(\) && parseHash\(location\.hash\)\.name === 'home'\)[\s\S]{0,200}'#\/new'/);
  // the hand-off is consumed once a trip is created
  assert.match(app, /q\.delete\('destination'\); q\.delete\('from_guide'\)/);
});

test('every guide page links the planner with destination, from_guide and #/new, and its destination exists', async () => {
  const guides = readdirSync(new URL('..', import.meta.url)).filter((f) => /^[a-z]+-guide\.html$/.test(f));
  assert.ok(guides.includes('kerala-guide.html'));
  for (const file of guides) {
    const id = file.replace('-guide.html', '');
    const html = await read(file);
    assert.ok(html.includes(`href="trip.html?destination=${id}&amp;from_guide=${id}#/new"`), `${file} planner CTA`);
    assert.match(html, /data-guide-cta="planner"/);
    assert.ok(await read(`build/trip-data/${id}.js`), `${id} is a catalogue destination`);
  }
});

test('from_guide reaches trip analytics for kerala and kyoto, and unknown values are ignored', async () => {
  const source = await read('assets/js/guide-analytics.js');
  const events = [];
  const run = (search) => {
    events.length = 0;
    const A = { uuid: () => 'id', pathname: () => '/trip.html', track: (name, data) => { events.push({ name, data }); return Promise.resolve(); }, firstTouch: () => ({}), currentTags: () => ({}), referrerHost: () => null, flush() {} };
    const window = { FridayAnalytics: A };
    vm.runInNewContext(source, { window, location: { pathname: '/trip.html', search, hash: '#/new' }, URLSearchParams, Object, Number, Date, Promise, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, history: { replaceState() {} }, document: {} });
    return window.FridayGuideAnalytics;
  };
  const started = () => events.find((e) => e.name === 'trip_started').data;
  for (const id of ['kerala', 'kyoto']) {
    await run(`?destination=${id}&from_guide=${id}`).tripStarted({});
    assert.deepEqual([started().destination, started().from_guide], [id, true]);
  }
  await run('?destination=goa&from_guide=evil').tripStarted({});
  assert.deepEqual([started().destination, started().from_guide], [null, false]);
});
