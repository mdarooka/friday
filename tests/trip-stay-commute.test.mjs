import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = { FridayTrip: { plate: () => '<svg aria-hidden="true"></svg>' } };
const context = { window, URL, location: { href: 'https://friday.example/trip.html' }, console };
vm.runInNewContext(readFileSync(new URL('../assets/js/trip-chat.js', import.meta.url), 'utf8'), context);
const { stayIdeasBlock, stayIdeasHTML } = window.FridayTrip.chat._x;

const destination = {
  id: 'coastline', name: 'Coastline',
  areas: [
    { id: 'beach', town: 'Candolim', at: [73.762, 15.541] },
    { id: 'capital', town: 'Panjim', at: [73.83, 15.493] },
    { id: 'south', town: 'Colva', at: [73.93, 15.28] },
    { id: 'hills', town: 'Hill Town', at: [74.9, 15.9] }
  ],
  stays: { ids: ['beachHotel', 'capitalHotel', 'southHotel', 'hillHotel'] },
  places: {
    beachHotel: { name: 'Beach Hotel', kind: 'stay', area: 'beach' },
    capitalHotel: { name: 'Capital Inn', kind: 'stay', area: 'capital' },
    southHotel: { name: 'South Resort', kind: 'stay', area: 'south' },
    hillHotel: { name: 'Hill Lodge', kind: 'stay', area: 'hills' }
  }
};
window.FridayTrip.DESTINATIONS = { coastline: destination };
const day = area => ({ area, items: [] });

test('a short hop to the next area asks before suggesting a hotel change', () => {
  const block = stayIdeasBlock(destination, { days: [day('beach'), day('beach'), day('capital')] });
  assert.equal(block.groups[0].commute, undefined);
  assert.ok(block.groups[1].commute.mins <= 45);
  const html = stayIdeasHTML(block);
  assert.match(html, /Panjim is roughly \d+ min by road from Candolim, close enough to keep/);
  assert.match(html, /Would you like to change hotels\?/);
  assert.match(html, /data-choice="keep"[^>]*>Keep my hotel/);
  assert.match(html, /data-choice="change"[^>]*>Change hotel/);
  assert.doesNotMatch(html, /Capital Inn/, 'stays near a short hop wait for the traveller to choose');
  assert.match(html, /Beach Hotel/);
});

test('choosing to change hotels shows the stays, and keeping one hides them', () => {
  const block = stayIdeasBlock(destination, { days: [day('beach'), day('capital')] });
  block.groups[1].choice = 'change';
  let html = stayIdeasHTML(block);
  assert.match(html, /Capital Inn/);
  assert.match(html, /Keep your Candolim hotel instead/);
  block.groups[1].choice = 'keep';
  html = stayIdeasHTML(block);
  assert.doesNotMatch(html, /Capital Inn/);
  assert.match(html, /Keeping <strong>your Candolim hotel<\/strong> for these days/);
  assert.match(html, /Show stays near Panjim/);
});

test('a long drive suggests moving but still lets the traveller keep one hotel', () => {
  const block = stayIdeasBlock(destination, { days: [day('beach'), day('hills')] });
  assert.ok(block.groups[1].commute.mins >= 120);
  const html = stayIdeasHTML(block);
  assert.match(html, /Hill Lodge/);
  assert.match(html, /moving hotels saves a long drive each way/);
  assert.match(html, /Keep your Candolim hotel anyway/);
});

test('areas without coordinates show stays without a commute note', () => {
  const d = { ...destination, id: 'plain', areas: destination.areas.map(({ at, ...a }) => a) };
  window.FridayTrip.DESTINATIONS.plain = d;
  const block = stayIdeasBlock(d, { days: [day('beach'), day('capital')] });
  assert.equal(block.groups[1].commute, undefined);
  const html = stayIdeasHTML(block);
  assert.match(html, /Capital Inn/);
  assert.doesNotMatch(html, /change hotels/);
});
