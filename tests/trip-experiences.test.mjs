import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = { FridayTrip: { plate: () => '<svg aria-hidden="true"></svg>' } };
const context = { window, URL, location: { href: 'https://friday.example/trip.html' }, console };
vm.runInNewContext(readFileSync(new URL('../assets/js/trip-chat.js', import.meta.url), 'utf8'), context);
const { experienceIdeasBlock, experienceIdeasHTML } = window.FridayTrip.chat._x;

const destination = {
  id: 'sample', name: 'Sample', areas: [{ id: 'centre', town: 'Old Town' }, { id: 'coast', town: 'Coast' }],
  places: {
    centreStop: { name: 'Historic square', kind: 'sight', area: 'centre' },
    cafe: { name: 'Café <script>alert(1)</script>', kind: 'food', area: 'centre', price: 999, rating: 5, photos: [{ url: 'javascript:alert(1)', sourceUrl: 'https://example.com', attribution: 'Unknown' }] },
    museum: { name: 'Local museum', kind: 'museum', area: 'centre' },
    hotel: { name: 'Hotel', kind: 'stay', area: 'centre' },
    beach: { name: 'Beach walk', kind: 'beach', area: 'coast' },
    garden: { name: 'Coastal garden', kind: 'nature', area: 'coast' },
    transfer: { name: 'Airport transfer', kind: 'transport', area: 'coast' }
  }
};
const plan = { days: [
  { area: 'centre', town: 'Old Town', date: '2026-11-02', items: [{ place: 'centreStop' }] },
  { area: 'coast', town: 'Coast', date: '2026-11-03', items: [{ place: 'beach' }] }
] };

test('experience cards follow the itinerary day and never offer stays or transport', () => {
  const block = experienceIdeasBlock(destination, plan, false);
  assert.equal(block.groups.length, 2);
  assert.deepEqual(Array.from(block.groups[0].items, item => item.id), ['cafe', 'museum', 'centreStop']);
  assert.deepEqual(Array.from(block.groups[1].items, item => item.id), ['garden', 'beach']);
  assert.equal(new Set(block.groups.flatMap(group => group.items.map(item => item.id))).size, 5);
  const html = experienceIdeasHTML(block);
  assert.match(html, /Experiences in Old Town/);
  assert.match(html, /Add to day 1/);
  assert.doesNotMatch(html, /<script>|999|5\.0|Airport transfer|Hotel/);
  assert.match(html, /Café &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('research proposals show only proposed experiences without an add action', () => {
  const block = experienceIdeasBlock(destination, plan, true);
  assert.deepEqual(Array.from(block.groups[0].items, item => item.id), ['centreStop']);
  assert.deepEqual(Array.from(block.groups[1].items, item => item.id), ['beach']);
  const html = experienceIdeasHTML(block);
  assert.match(html, /In proposed itinerary/);
  assert.doesNotMatch(html, /data-act="experience-add"/);
});

test('a follow-up request does not repeat experience cards already shown in chat', () => {
  const first = experienceIdeasBlock(destination, plan, false);
  const excluded = Object.fromEntries(first.groups.flatMap(group => group.items.map(item => [item.id, true])));
  const next = experienceIdeasBlock(destination, plan, false, excluded);
  assert.equal(next, null);
});
