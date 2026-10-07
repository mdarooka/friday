import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sitemapXml, robotsTxt } = require('../build/site-metadata.js');
const { GUIDES, guideFiles } = require('../build/destination-guides.js');
const source = (await readFile(new URL('../assets/js/friday-analytics.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../assets/js/guide-analytics.js', import.meta.url), 'utf8'));
const guidesHtml = Object.fromEntries(await Promise.all(
  GUIDES.map(async (guide) => [guide.id, await readFile(new URL(`../${guide.file}`, import.meta.url), 'utf8')])
));

function setup(pathname = '/kerala-guide.html', search = '?utm_source=reddit&utm_medium=community&utm_campaign=kerala_guide') {
  const values = new Map();
  const batches = [];
  class FakeHexclaveClientApp {
    constructor(options) {
      assert.equal(options.automaticSideEffects, false);
      assert.equal(options.analytics.enabled, false);
      this[Symbol.for('StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals')] = {
        sendAnalyticsEventBatch: async body => {
          batches.push(JSON.parse(body));
          return { status: 'ok', data: { ok: true } };
        },
      };
    }
    async getUser(options) { assert.equal(options.or, 'anonymous'); return {}; }
  }
  const window = { FakeHexclaveClientApp, addEventListener() {} };
  const context = {
    window,
    location: { pathname, search },
    document: { referrer: 'https://www.reddit.com/r/IndiaTravel/thread?token=private', addEventListener() {} },
    URL, URLSearchParams, Symbol, Math, Date, crypto: { randomUUID: (() => { let i = 0; return () => `guide-event-${++i}`; })() },
    localStorage: { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value) },
    fetch: async () => ({ ok: true, json: async () => ({ hexclaveProjectId: 'project-id' }) }),
  };
  const script = source.replace("import('https://esm.sh/@hexclave/js@1.0.125')", 'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })');
  vm.runInNewContext(script, context);
  return { analytics: window.FridayGuideAnalytics, batches, values };
}

for (const guide of GUIDES) {
  test(`${guide.id} guide answers the researched questions and has canonical/social metadata`, () => {
    const html = guidesHtml[guide.id];
    assert.match(html, new RegExp(guide.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 24)));
    assert.match(html, new RegExp(guide.days.eyebrow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(guide.season.eyebrow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(guide.compare.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(guide.budget.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(`<link rel="canonical" href="https://fridaytravel\\.vercel\\.app/${guide.file}">`));
    assert.match(html, /<meta property="og:image" content="https:\/\/fridaytravel\.vercel\.app\/assets\/images\//);
    assert.match(html, /data-guide-cta="planner"/);
    assert.match(html, /data-guide-cta="quote"/);
    if (guide.id !== 'kerala') assert.match(html, new RegExp(`data-guide-destination="${guide.id}"`));
    assert.match(html, new RegExp(`from_guide=${guide.id}`));
    assert.match(html, /Where to go/);
    assert.match(html, /Ask Friday about a quote/);
  });
}

test('Kerala guide keeps the original FAQ wording', () => {
  const guide = guidesHtml.kerala;
  assert.match(guide, /Kerala Travel Guide/);
  assert.match(guide, /How many days do you need in Kerala\?/);
  assert.match(guide, /When is the best time to visit Kerala\?/);
  assert.match(guide, /Is Alleppey or Kumarakom better for a houseboat\?/);
  assert.match(guide, /What does a Kerala trip cost\?/);
  assert.match(guide, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/kerala-guide\.html">/);
  assert.match(guide, /<meta property="og:image" content="https:\/\/fridaytravel\.vercel\.app\/assets\/images\/og\/kerala-guide\.jpg\?v=\d+">/);
  assert.match(guide, /data-guide-cta="planner"/);
  assert.match(guide, /data-guide-cta="quote"/);
});

test('Kyoto guide has three arcs, stays, Bombay notes, CTAs and feedback', async () => {
  const kyoto = await readFile(new URL('../kyoto-guide.html', import.meta.url), 'utf8');
  assert.match(kyoto, /Kyoto Travel Guide/);
  for (const q of ['A classic first visit', 'Slower: crafts, gardens and temples', 'Seasonal and day trips', 'A shortlist by neighbourhood', 'Do Indian passport holders need a visa\\?', 'How do you get from KIX or Itami\\?']) assert.match(kyoto, new RegExp(q));
  assert.match(kyoto, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/kyoto-guide\.html">/);
  assert.match(kyoto, /href="trip\.html\?destination=kyoto&amp;from_guide=kyoto#\/new"/);
  assert.match(kyoto, /contact\.html\?quote_path=guide&amp;destination=kyoto/);
  assert.match(kyoto, /data-guide-feedback="kyoto"/);
  assert.match(await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8'), /kyoto-guide\.html/);
});

test('sitemap generation emits an absolute guide URL when an origin is configured; robots leaves guides crawlable', () => {
  const map = sitemapXml(['index.html', 'kerala-guide.html'], 'https://friday.example');
  assert.match(map, /<loc>https:\/\/friday\.example\/kerala-guide\.html<\/loc>/);
  const robots = robotsTxt('https://friday.example');
  assert.match(robots, /Sitemap: https:\/\/friday\.example\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/trip\.html/);
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(robots, /Disallow: \/admin-villas\n/);
  assert.match(robots, /Disallow: \/api\//);
  for (const guide of GUIDES) {
    assert.doesNotMatch(robots, new RegExp(`Disallow: /${guide.id}-guide`));
  }
});

test('production metadata uses Friday’s canonical domain when no build origin is configured', async () => {
  const metadata = require('../build/site-metadata.js');
  assert.equal(metadata.siteOrigin({}), 'https://fridaytravel.vercel.app');
  const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
  const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
  assert.match(sitemap, /https:\/\/fridaytravel\.vercel\.app\/field-notes\.html/);
  assert.match(robots, /Sitemap: https:\/\/fridaytravel\.vercel\.app\/sitemap\.xml/);
});

test('generated legal pages use a real effective date and do not mark About as current', async () => {
  const [privacy, terms, fieldNotes] = await Promise.all([
    readFile(new URL('../privacy.html', import.meta.url), 'utf8'),
    readFile(new URL('../terms.html', import.meta.url), 'utf8'),
    readFile(new URL('../field-notes.html', import.meta.url), 'utf8'),
  ]);
  for (const html of [privacy, terms]) {
    assert.match(html, /October 7, 2026/);
    assert.doesNotMatch(html, /OWNER: launch date/);
    assert.doesNotMatch(html, /href="about\.html" aria-current="page"/);
  }
  assert.match(fieldNotes, /Travel guides and considered starting points/);
  assert.match(fieldNotes, /A thoughtful first plan for Kerala/);
  assert.match(fieldNotes, /href="kerala-guide\.html"/);
  assert.doesNotMatch(fieldNotes, /This page has moved/);
});

test('guide view, CTA, and trip start events carry only safe attribution and guide status', async () => {
  const fixture = setup();
  await fixture.analytics.flush();
  await fixture.analytics.trackCta('planner', 'kerala');
  await fixture.analytics.tripStarted({ destId: 'kerala' });
  const events = fixture.batches.flatMap(batch => batch.events);
  assert.deepEqual(events.map(event => event.event_type), ['public_page_viewed', 'guide_viewed', 'guide_cta_clicked', 'trip_started']);
  assert.equal(events[0].data.path, '/kerala-guide.html');
  const view = events[1].data;
  assert.equal(view.destination, 'kerala');
  assert.equal(view.path, '/kerala-guide.html');
  assert.equal(view.referrer_host, 'www.reddit.com');
  assert.equal(view.utm_source, 'reddit');
  assert.equal(view.utm_medium, 'community');
  assert.equal(view.utm_campaign, 'kerala_guide');
  assert.equal(JSON.stringify(events).includes('token=private'), false);
  assert.equal(events[2].data.target, 'planner');
  assert.equal(events[3].data.from_guide, true);
  assert.equal(events[3].data.destination, 'kerala');
  assert.equal(events[3].data.first_touch_landing_path, '/kerala-guide.html');
});

test('Goa and Rajasthan guide paths attribute analytics to the matching destination', async () => {
  for (const id of ['goa', 'rajasthan']) {
    const fixture = setup(`/${id}-guide.html`, `?utm_source=reddit&utm_medium=community&utm_campaign=${id}_guide`);
    await fixture.analytics.flush();
    await fixture.analytics.trackCta('planner', id);
    await fixture.analytics.tripStarted({ destId: id });
    const events = fixture.batches.flatMap(batch => batch.events);
    assert.equal(events[1].event_type, 'guide_viewed');
    assert.equal(events[1].data.destination, id);
    assert.equal(events[2].data.destination, id);
    assert.equal(events[3].data.from_guide, true);
    assert.equal(events[3].data.destination, id);
  }
});
