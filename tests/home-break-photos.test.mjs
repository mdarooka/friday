import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const B = require('../build/data/india-breaks.js');
const { THEMES, WIDTHS, WIDTH, HEIGHT, SIZES } = require('../build/data/break-photos.js');
const LW = require('../build/when-india-travels.js');

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const file = (base, w) => `assets/images/${base}-${w}.jpg`;
const LIMITS = { 480: 80e3, 800: 130e3, 1200: 160e3 };
const escHtml = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const homeSection = page => page.match(/<section class="section section--tight home-breaks"[^]*?<\/section>/)[0];
const cardsIn = section => [...section.matchAll(/<li class="wit-card-item"[^>]*data-id="([^"]*)">([^]*?)<\/li>/g)].map(m => ({ id: m[1], html: m[2] }));

/* Every break a visitor can see on a card: all rows with enough nights, whatever today is, so a row that is not shown yet cannot slip through. */
const shown = B.BREAKS.filter(b => b.nights >= B.MIN_NIGHTS);

test('every break that can show as a card names a valid photo theme', () => {
  assert.ok(shown.length >= 30);
  for (const brk of shown) {
    assert.equal(typeof brk.photo, 'string', `${brk.id} has no photo theme`);
    assert.ok(Object.hasOwn(THEMES, brk.photo), `${brk.id} uses unknown photo theme "${brk.photo}"`);
  }
  for (const brk of B.BREAKS) if (brk.photo != null) assert.ok(Object.hasOwn(THEMES, brk.photo), `${brk.id}: unknown photo theme "${brk.photo}"`);
});

test('every theme is used by at least one break and has a complete catalogue entry', () => {
  const used = new Set(B.BREAKS.map(b => b.photo));
  for (const [key, theme] of Object.entries(THEMES)) {
    assert.ok(used.has(key), `theme ${key} is not used by any break`);
    assert.equal(theme.base, `break-${key}`);
    assert.deepEqual(theme.widths, WIDTHS);
    assert.equal(theme.width, WIDTH);
    assert.equal(theme.height, HEIGHT);
    assert.equal(WIDTH / HEIGHT, 1.6, 'files are 16:10, like the card frame');
    assert.match(theme.position, /^\d+% \d+%$/);
  }
});

test('every theme has all three sized files, at sensible weights', async () => {
  for (const theme of Object.values(THEMES)) {
    for (const w of WIDTHS) {
      const { size } = await stat(new URL(`../${file(theme.base, w)}`, import.meta.url));
      assert.ok(size > 5e3 && size <= LIMITS[w], `${file(theme.base, w)} is ${size} bytes`);
    }
  }
});

test('every theme photo is credited in assets/images/CREDITS.md with its licence check', async () => {
  const md = await read('assets/images/CREDITS.md');
  for (const [key, theme] of Object.entries(THEMES)) {
    const entry = md.split('\n## ').find(s => s.includes(`(\`${key}\`)`));
    assert.ok(entry, `CREDITS.md has an entry for ${key}`);
    for (const w of WIDTHS) assert.ok(entry.includes(`${theme.base}-${w}.jpg`), `${key} entry lists ${w}w`);
    assert.match(entry, /Source page: https:\/\/unsplash\.com\/photos\/\S+ \(Unsplash id [\w-]+; original: https:\/\/images\.unsplash\.com\/photo-[\w-]+, \d+ x \d+\)/);
    assert.match(entry, /Photographer: .+, https:\/\/unsplash\.com\/@\S+/);
    assert.ok(entry.includes('Licence: Unsplash License, https://unsplash.com/license (free commercial use; not an Unsplash+ photo; checked on the photo page 2026-10-08)'));
    assert.ok(entry.includes('Downloaded: 2026-10-08'));
  }
});

test('each homepage card starts with its break\'s photo: lazy, decorative, responsive, inside the link', async () => {
  const page = await read('index.html');
  const section = homeSection(page);
  const cards = [...cardsIn(section), ...cardsIn(section.match(/<template data-wit-regional>[^]*?<\/template>/)[0])];
  assert.ok(cards.length > 10);
  for (const card of cards) {
    const brk = B.BREAKS.find(b => b.id === card.id);
    const theme = THEMES[brk.photo];
    const m = card.html.match(/^\s*<a class="wit-card" href="[^"]*">\s*(<div class="plate plate--photo plate--ratio-l wit-card__photo">(<img [^>]*>)<\/div>)\s*<p class="eyebrow eyebrow--accent wit-card__dates">/);
    assert.ok(m, `${card.id}: the photo is the first thing in the card link, above the dates`);
    const img = m[2];
    assert.ok(img.includes(`src="${file(theme.base, 1200)}"`), card.id);
    for (const w of WIDTHS) assert.ok(img.includes(`${file(theme.base, w)} ${w}w`), `${card.id} srcset has ${w}w`);
    assert.ok(img.includes(` sizes="${SIZES}"`));
    assert.match(img, / alt=""/);
    assert.match(img, / loading="lazy"/);
    assert.match(img, / decoding="async"/);
    assert.match(img, new RegExp(` width="${WIDTH}" height="${HEIGHT}"`));
    assert.ok(img.includes(`style="object-position:${theme.position}"`));
    assert.doesNotMatch(img, /fetchpriority/);
    assert.equal((card.html.match(/<img /g) || []).length, 1);
  }
});

test('neighbouring cards never repeat a photo, for the national track and for every state filter', () => {
  const today = '2026-10-08';
  const keys = ['all', ...B.REGION_FILTERS.map(f => f.key).filter(k => k !== 'all')];
  for (const key of keys) {
    const rows = B.upcomingBreaks(today, { region: key });
    // the homepage track holds the national rows plus the saved state's rows, in date order
    const track = rows.filter(b => B.isPureNational(b) || key !== 'all').sort((a, b) => (a.startDate + a.id).localeCompare(b.startDate + b.id));
    for (let i = 1; i < track.length; i++) assert.notEqual(track[i].photo, track[i - 1].photo, `${key}: ${track[i - 1].id} and ${track[i].id} share a photo`);
  }
});

test('a card without a valid theme fails the build instead of rendering a broken image', () => {
  const real = B.BREAKS.find(b => b.id === 'dussehra-2026');
  const saved = real.photo;
  try {
    real.photo = 'not-a-theme';
    assert.throws(() => LW.homeTeaser({ esc: escHtml, today: '2026-10-08' }), /dussehra-2026 has no valid photo theme/);
  } finally {
    real.photo = saved;
  }
});

test('the photo runs flush across the top of the card and stays still on hover', async () => {
  const css = await read('assets/css/friday.css');
  assert.match(css, /\.wit-card \{[^}]*--wit-pad: clamp\(1\.1rem, 1\.6vw, 1\.5rem\);[^}]*padding: var\(--wit-pad\);/);
  assert.match(css, /\.wit-card__photo \{[^}]*margin: calc\(-1 \* var\(--wit-pad\)\) calc\(-1 \* var\(--wit-pad\)\) var\(--wit-pad\);[^}]*border-radius: 13px 13px 0 0;/);
  assert.match(css, /\.wit-card:hover > \.wit-card__photo\.plate--photo > \.plate__svg \{[^}]*transform: none;/);
});

test('only the homepage carousel gets the photos: the full page is untouched', async () => {
  assert.doesNotMatch(await read('when-india-travels.html'), /break-[a-z-]+-(480|800|1200)\.jpg|wit-card__photo/);
});
