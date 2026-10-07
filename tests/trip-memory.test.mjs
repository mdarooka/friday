import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/trip-memory.js', import.meta.url), 'utf8');
const window = { FridayTrip: {} };
vm.runInNewContext(source, { window, String, Array });

test('saved profile preferences and explicit memories become selectable trip context', () => {
  const items = window.FridayTrip.memoryContext.list({
    prefs: { homeCity: 'Delhi', airports: ['DEL'], hotels: 'Small locally owned hotels' },
    memory: [{ id: 'one', city: 'Kyoto', text: 'Leave mornings unplanned' }, { id: 'empty', text: '' }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(items)), [
    { key: 'profile-0', label: 'Home city', text: 'Delhi', source: 'profile' },
    { key: 'profile-1', label: 'Departure airports', text: 'DEL', source: 'profile' },
    { key: 'profile-2', label: 'Hotels', text: 'Small locally owned hotels', source: 'profile' },
    { key: 'memory-one', label: 'Kyoto', text: 'Leave mornings unplanned', source: 'memory', id: 'one' },
  ]);
  assert.match(window.FridayTrip.memoryContext.apply('Plan Kyoto', [items[3]]), /you chose to apply these.*Leave mornings unplanned/s);
  assert.equal(window.FridayTrip.memoryContext.apply('Plan Kyoto', []), 'Plan Kyoto');
});


test('quote handoff only includes preferences the traveler explicitly chose to share', () => {
  const preferences = [{ label: 'Kyoto', text: 'Leave mornings unplanned' }];
  const heading = 'Preferences the traveler chose to share with the travel designer:';
  const shared = window.FridayTrip.memoryContext.quoteInstructions('Plan a calm trip', preferences, true);
  assert.match(shared, /Plan a calm trip/);
  assert.match(shared, /Leave mornings unplanned/);
  assert.equal(window.FridayTrip.memoryContext.quoteInstructions('Plan a calm trip', preferences, false), 'Plan a calm trip');
  assert.equal(window.FridayTrip.memoryContext.quoteInstructions(shared, preferences, true).split(heading).length - 1, 1);
});

test('the composer summary reflects selected notes and offers a clear fresh-start state', () => {
  const summarize = window.FridayTrip.memoryContext.summary;
  assert.equal(summarize([]), 'Start with your own words');
  assert.equal(summarize([{ text: 'Slow mornings' }, { text: 'Vegetarian food' }, { text: 'Small stays' }]), 'Planning with: Slow mornings · Vegetarian food +1');
  assert.equal(summarize([{ text: '  Leave mornings open and unplanned for a relaxed pace  ' }]), 'Planning with: Leave mornings open and unp…');
  assert.equal(summarize([{ label: 'Home city', text: 'Delhi' }, { label: 'Hotels', text: 'Small locally owned stays' }]), 'Planning with: Home base set · Small locally owned stays');
});
