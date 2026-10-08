import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const page = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const hero = html => html.match(/<div class="phero__art"[^>]*>[\s\S]*?<\/div><\/div>/)?.[0] ?? '';

test('About page hero paints the Queens Necklace as a faded full-bleed background', async () => {
  const html = await page('about.html');
  const bg = html.match(/<div class="phero-bg phero-bg--fade" style="([^"]*)">/);
  assert.ok(bg, 'expected a faded background hero');
  assert.match(bg[1], /linear-gradient\(to bottom,var\(--paper\)[^)]*\),url\('assets\/images\/about-queens-necklace\.svg'\)/);
  assert.equal(hero(html), '', 'no separate art plate under the text');
  assert.doesNotMatch(html, /class="phero__side"/, 'no Experience/Brand meta block');
  assert.ok((await stat(new URL('../assets/images/about-queens-necklace.svg', import.meta.url))).size > 0);
});

test('night artwork is saved but not referenced by any page', async () => {
  assert.ok((await stat(new URL('../assets/images/about-queens-necklace-night.svg', import.meta.url))).size > 0);
  for (const name of ['about.html', 'index.html', 'ethos.html', 'method.html', 'villas.html']) {
    assert.doesNotMatch(await page(name), /about-queens-necklace-night/);
  }
});

test('other page heroes still use the procedural Plate', async () => {
  let checked = 0;
  for (const name of ['privacy.html', 'terms.html', 'goa-guide.html', 'kerala-guide.html', 'rajasthan-guide.html']) {
    const html = await page(name);
    assert.doesNotMatch(html, /about-queens-necklace/, name);
    const art = hero(html);
    if (!art) continue;
    checked += 1;
    assert.match(art, /<div class="plate plate--ratio-w"><svg class="plate__svg"/, name);
  }
  assert.ok(checked > 0, 'expected at least one other page hero to be checked');
});
