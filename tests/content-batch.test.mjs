import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ORDER } = require('../build/trip-data/index.js');
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('new guides are public catalogue pages and Kyoto stays off the new-trip list', async () => {
  const sitemap = await read('sitemap.xml');
  for (const file of ['srilanka-guide.html', 'kyoto-guide.html', 'ladakh-guide.html', 'note-goa-for-diwali.html', 'note-rajasthan-for-diwali.html', 'note-what-friday-shipped.html']) {
    assert.match(sitemap, new RegExp(file));
  }
  assert.deepEqual(ORDER, ['goa', 'kerala', 'rajasthan', 'ladakh', 'srilanka']);
  assert.equal(ORDER.includes('kyoto'), false);
  const kyoto = await read('kyoto-guide.html');
  assert.match(kyoto, /data-guide-feedback="kyoto"/);
  assert.match(kyoto, /href="trip\.html\?from_guide=kyoto#\/new"/);
  assert.doesNotMatch(kyoto, /trip\.html\?destination=kyoto/);
  assert.match(kyoto, /mid-November to early December/);
  assert.match(kyoto, /Sample catalogue|sample data/i);
  const ladakh = await read('ladakh-guide.html');
  assert.match(ladakh, /3,500 m/);
  assert.match(ladakh, /after day three|after at least three nights/i);
  assert.match(ladakh, /data-guide-feedback="ladakh"/);
  const sri = await read('srilanka-guide.html');
  assert.match(sri, /December to March/);
  assert.match(sri, /data-guide-feedback="srilanka"/);
  const home = await read('index.html');
  const breaks = await read('when-india-travels.html');
  assert.match(home, /note-goa-for-diwali\.html/);
  assert.match(breaks, /note-rajasthan-for-diwali\.html/);
});

test('Lapland at Christmas is a marked sample with a spare aurora night and no price', async () => {
  const html = await read('departures.html');
  assert.match(html, /id="departure-lapland-christmas"/);
  assert.match(html, /Spare night/);
  assert.match(html, /Not live inventory|not a live departure|Sample itinerary/i);
  assert.doesNotMatch(html.slice(html.indexOf('id="departure-lapland-christmas"'), html.indexOf('id="departure-lapland-christmas"') + 2500), /₹|\$\d|hotel/);
  const note = await read('note-what-friday-shipped.html');
  assert.match(note, /Request a destination/);
  assert.match(note, /Draft reply/);
  assert.match(note, /product note/i);
});
