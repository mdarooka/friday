import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const WIDTHS = [800, 1280, 1920, 2880];
const file = w => `assets/images/home-hero-jaipur-arch-${w}.jpg`;

test('home hero is a real photograph with a responsive srcset, inside the plate frame', async () => {
  const html = await read('index.html');
  const bg = html.match(/<div class="hero__bg">([\s\S]*?)<\/div><\/div>/)?.[1] ?? '';
  assert.match(bg, /^<div class="plate plate--photo plate--fill"><img class="plate__svg"/);
  assert.doesNotMatch(bg, /<svg/, 'the procedural plate is gone from the hero');
  const img = bg.match(/<img [^>]*>/)?.[0] ?? '';
  assert.ok(img.includes(`src="${file(1920)}"`));
  for (const w of WIDTHS) assert.ok(img.includes(`${file(w)} ${w}w`), `srcset has ${w}w`);
  assert.match(img, / sizes="100vw"/);
  assert.match(img, / alt=""/);
  assert.match(img, / fetchpriority="high"/);
  assert.match(img, / decoding="async"/);
  assert.match(img, / width="2880" height="1879"/);
  assert.doesNotMatch(img, /loading="lazy"/);
  assert.match(html, /<div class="hero__scrim"><\/div>/, 'scrim is kept');
});

test('home page head preloads the hero image', async () => {
  const html = await read('index.html');
  const link = html.match(/<link rel="preload" as="image"[^>]*>/)?.[0] ?? '';
  assert.ok(link, 'expected an image preload');
  assert.match(link, /imagesizes="100vw"/);
  for (const w of WIDTHS) assert.ok(link.includes(`${file(w)} ${w}w`));
  assert.ok(html.indexOf(link) < html.indexOf('href="assets/css/friday.css"'), 'preload comes before the stylesheet');
});

test('only the home page preloads a hero photo; other pages are untouched', async () => {
  for (const name of ['about.html', 'privacy.html', 'goa-guide.html']) {
    assert.doesNotMatch(await read(name), /home-hero-jaipur-arch/, name);
  }
});

test('photo plates switch off the grain and halftone overlays', async () => {
  const css = await read('assets/css/friday.css');
  assert.match(css, /\.plate--photo::before,\s*\.plate--photo::after\s*\{\s*content:\s*none;/);
  assert.match(css, /\.plate--photo > \.plate__svg\s*\{[^}]*object-fit:\s*cover;[^}]*object-position:\s*50% 45%/);
});

test('hero image files exist at sensible weights', async () => {
  const limits = { 800: 150e3, 1280: 300e3, 1920: 450e3, 2880: 1.2e6 };
  for (const w of WIDTHS) {
    const { size } = await stat(new URL(`../${file(w)}`, import.meta.url));
    assert.ok(size > 10e3 && size <= limits[w], `${w}w is ${size} bytes`);
  }
});

test('photo credit is recorded in assets/images/CREDITS.md', async () => {
  const md = await read('assets/images/CREDITS.md');
  for (const w of WIDTHS) assert.ok(md.includes(`home-hero-jaipur-arch-${w}.jpg`), `lists ${w}w file`);
  assert.ok(md.includes('https://unsplash.com/photos/oCCrwu8aDV4'));
  assert.ok(md.includes('Anirudh') && md.includes('https://unsplash.com/@underroot'));
  assert.ok(md.includes('Unsplash License') && md.includes('https://unsplash.com/license'));
  assert.ok(md.includes('2026-10-08'));
  assert.match(md, /not legally required/);
});
