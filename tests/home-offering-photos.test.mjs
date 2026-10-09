import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const WIDTHS = [640, 1000, 1600];
const PHOTOS = {
  Packages: { base: 'offering-packages-suitcases', height: 1067, limit1000: 150e3 },
  'Friday AI': { base: 'offering-ai-map', height: 1071, limit1000: 150e3 },
};
const file = (base, w) => `assets/images/${base}-${w}.jpg`;

async function cards() {
  const html = await read('index.html');
  const section = html.match(/<section class="section" id="offerings">([\s\S]*?)<\/section>/)?.[1] ?? '';
  const out = {};
  for (const m of section.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)) {
    const name = m[1].match(/<p class="eyebrow eyebrow--accent">([^<]*)<\/p>/)?.[1];
    out[name] = m[1];
  }
  return out;
}

test('offerings section still has the three cards in order', async () => {
  assert.deepEqual(Object.keys(await cards()), ['Villas', 'Packages', 'Friday AI']);
});

for (const [name, { base, height }] of Object.entries(PHOTOS)) {
  test(`${name} card uses a lazy responsive photo inside the offering frame`, async () => {
    const card = (await cards())[name];
    assert.match(card, /<div class="plate plate--photo card__plate offering-art"><img class="plate__svg"/);
    const img = card.match(/<img [^>]*>/)?.[0] ?? '';
    assert.ok(img.includes(`src="${file(base, 1600)}"`));
    for (const w of WIDTHS) assert.ok(img.includes(`${file(base, w)} ${w}w`), `srcset has ${w}w`);
    assert.match(img, / sizes="\(max-width: 980px\) 100vw, 33vw"/);
    assert.match(img, / alt=""/);
    assert.match(img, / loading="lazy"/);
    assert.match(img, / decoding="async"/);
    assert.match(img, new RegExp(` width="1600" height="${height}"`));
    assert.match(img, / style="object-position:\d+% \d+%"/);
    assert.doesNotMatch(img, /fetchpriority/);
    assert.doesNotMatch(card, /<svg|assets\/illustrations\//, 'the illustration is gone from this card');
  });

  test(`${name} photo files exist at sensible weights`, async () => {
    const limits = { 640: 80e3, 1000: 150e3, 1600: 350e3 };
    for (const w of WIDTHS) {
      const { size } = await stat(new URL(`../${file(base, w)}`, import.meta.url));
      assert.ok(size > 10e3 && size <= limits[w], `${w}w is ${size} bytes`);
    }
  });
}

test('Villas card keeps its illustration', async () => {
  const card = (await cards()).Villas;
  assert.match(card, /<div class="card__plate offering-art"><img src="assets\/illustrations\/friday-villas\.svg" width="1200" height="760" alt="Illustration of a villa among green terraces" loading="lazy" decoding="async"><\/div>/);
  assert.doesNotMatch(card, /plate--photo|srcset/);
});

test('offering photo plates stay still on hover, like the Villas illustration', async () => {
  const css = await read('assets/css/friday.css');
  assert.match(css, /\.offering-art\.plate--photo > \.plate__svg\s*\{[^}]*transform:\s*none;/);
  /* The site-wide zoom is `a:hover > .plate .plate__svg` (0,3,1): the still rule needs a hover selector of its own to win. */
  assert.match(css, /a:hover > \.offering-art\.plate--photo > \.plate__svg\s*\{[^}]*transform:\s*none;/);
});

test('offering photo credits are recorded in assets/images/CREDITS.md', async () => {
  const md = await read('assets/images/CREDITS.md');
  for (const { base } of Object.values(PHOTOS)) {
    for (const w of WIDTHS) assert.ok(md.includes(`${base}-${w}.jpg`), `lists ${base} ${w}w`);
  }
  for (const s of [
    'https://unsplash.com/photos/a-pile-of-luggage-stacked-on-top-of-a-suitcase-6VFqT6vPY78',
    'https://images.unsplash.com/photo-1637043398520-4dec20e83d63',
    'engin akyurt', 'https://unsplash.com/@enginakyurt',
    'https://unsplash.com/photos/green-and-blue-map-rCx_m5bcDgk',
    'https://images.unsplash.com/photo-1553903148-895cebaaab4b',
    'Aubrey Odom', 'https://unsplash.com/@octoberroses',
  ]) assert.ok(md.includes(s), `mentions ${s}`);
  assert.ok(md.split('Licence: Unsplash License, https://unsplash.com/license').length - 1 >= 3, 'every photo lists its licence');
  assert.ok(md.split('Downloaded: 2026-10-08').length - 1 >= 3);
});

test('the other pages are untouched by the offering photos', async () => {
  for (const name of ['about.html', 'villas.html', 'trip.html']) {
    assert.doesNotMatch(await read(name), /offering-(packages-suitcases|ai-map)/, name);
  }
});
