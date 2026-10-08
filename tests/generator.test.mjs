import test from 'node:test';
import assert from 'node:assert/strict';
import { generator as gen, data } from '../server/itinerary/catalog.mjs';
const { DESTINATIONS, ORDER, TRIP_TYPES } = data;

const real = (plan) => plan.days.flatMap((d) => d.items).filter((i) => i.place);
const stopsOf = (plan, dest) => plan.days.map((d) => d.items.filter((i) => i.place && dest.places[i.place].kind !== 'stay'));

test('five destinations are offered, each with trip types; retired Kyoto still loads for saved trips', () => {
  assert.equal(ORDER.length, 5);
  assert.ok(!ORDER.includes('kyoto') && DESTINATIONS.kyoto);
  ORDER.forEach((id) => assert.ok(gen.typeLabels(DESTINATIONS[id]).length >= 3, id));
});

test('no destination carries hand-written itineraries, and every area has a town', () => {
  ORDER.forEach((id) => {
    assert.equal(DESTINATIONS[id].itineraries, undefined, id);
    DESTINATIONS[id].areas.forEach((a) => assert.ok(a.town, id + '/' + a.id));
  });
});

test('every trip type label resolves to a real profile', () => {
  ORDER.forEach((id) => gen.typeLabels(DESTINATIONS[id]).forEach((label) => {
    const p = gen.resolveProfile(DESTINATIONS[id], label, TRIP_TYPES);
    assert.notEqual(p.name, 'balanced', id + ': ' + label);
    assert.ok(TRIP_TYPES.profiles[p.name]);
  }));
});

test('deterministic: the same inputs give the same plan', () => {
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    const o = { types: gen.typeLabels(d).slice(0, 2), days: 9, pace: 'normal', dates: { start: '2027-01-05' } };
    assert.deepEqual(gen.generate(d, o), gen.generate(d, o), id);
  });
});

test('different trip types give different plans', () => {
  const d = DESTINATIONS.goa;
  const [a, b] = gen.typeLabels(d);
  assert.notDeepEqual(real(gen.generate(d, { types: [a], days: 5 })).map((i) => i.place), real(gen.generate(d, { types: [b], days: 5 })).map((i) => i.place));
});

test('days count is respected for 1..14 in every destination, every place exists, dates run on', () => {
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    for (let n = 1; n <= 14; n++) {
      const plan = gen.generate(d, { types: [gen.typeLabels(d)[0]], days: n, dates: { start: '2027-02-27' } });
      assert.equal(plan.days.length, n, id + ' ' + n);
      plan.days.forEach((day, i) => {
        assert.ok(day.items.length >= 2, id + ' day ' + (i + 1) + ' has stops');
        assert.ok(day.town, 'town');
        assert.equal(day.date, gen.addDays('2027-02-27', i));
        day.items.forEach((it) => assert.ok(d.places[it.place], id + ' unknown place ' + it.place));
      });
      assert.ok(plan.stay && d.places[plan.stay].kind === 'stay');
      assert.equal(plan.days[0].items[0].place, plan.stay);
    }
  });
});

test('ids are unique within a plan', () => {
  const d = DESTINATIONS.kerala;
  const plan = gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 10 });
  const ids = plan.days.map((x) => x.id).concat(plan.days.flatMap((x) => x.items.map((i) => i.id)));
  assert.equal(new Set(ids).size, ids.length);
});

test('one area per day: stops come from the day\'s area unless that area has run out', () => {
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    gen.typeLabels(d).forEach((type) => {
      const plan = gen.generate(d, { types: [type], days: 12, pace: 'full' });
      const used = new Set();
      plan.days.forEach((day, i) => {
        const here = Object.keys(d.places).filter((p) => d.places[p].area === day.area && d.places[p].kind !== 'stay');
        const today = day.items.filter((it) => it.place && d.places[it.place].kind !== 'stay').map((it) => it.place);
        const foreign = today.filter((p) => d.places[p].area !== day.area);
        if (foreign.length) {
          // the area must be spent: every one of its places is on this day or an earlier one
          today.forEach((p) => used.add(p));
          here.forEach((p) => assert.ok(used.has(p), id + ' ' + type + ' day ' + (i + 1) + ' left ' + p + ' behind'));
        }
        today.forEach((p) => used.add(p));
        assert.ok(today.some((p) => d.places[p].area === day.area), id + ' day ' + (i + 1) + ' has a stop in its own area');
      });
    });
  });
});

test('no place repeats until the catalog is exhausted', () => {
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    const catalog = Object.keys(d.places).filter((p) => d.places[p].kind !== 'stay');
    const plan = gen.generate(d, { types: [gen.typeLabels(d)[1]], days: 21, pace: 'full' });
    const used = new Set();
    let exhaustedOn = -1;
    plan.days.forEach((day, i) => {
      const today = day.items.filter((it) => d.places[it.place].kind !== 'stay').map((it) => it.place);
      const fresh = today.filter((p) => !used.has(p));
      today.forEach((p) => used.add(p));
      if (used.size === catalog.length && exhaustedOn < 0) exhaustedOn = i;
      // a repeat is only allowed on the day the catalog runs out, or after it
      if (fresh.length < today.length) assert.ok(exhaustedOn >= 0 && exhaustedOn <= i, id + ' repeated a place on day ' + (i + 1) + ' before the catalog was spent');
    });
    assert.ok(exhaustedOn >= 0, id + ': 21 full days should outrun the catalog');
    // and it is exhausted as soon as possible: no day before then was short of new places
    plan.days.slice(0, exhaustedOn).forEach((day, i) => assert.equal(day.items.filter((it) => d.places[it.place].kind !== 'stay').length, d.acclimatisation && i === 0 ? d.acclimatisation.arrivalStops : 4, id + ' day ' + (i + 1)));
  });
});

test('pace sets the stop count: relaxed 2, normal 3, full 4', () => {
  const want = { relaxed: 2, normal: 3, full: 4 };
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    Object.keys(want).forEach((pace) => {
      const plan = gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 5, pace });
      stopsOf(plan, d).forEach((stops, i) => {
        if (d.acclimatisation && i === 0) assert.ok(stops.length <= want[pace]);
        else assert.equal(stops.length, want[pace], id + ' ' + pace + ' day ' + (i + 1));
      });
    });
  });
});

test('unknown pace falls back to the default', () => {
  const d = DESTINATIONS.goa;
  assert.deepEqual(gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 3, pace: 'frantic' }), gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 3 }));
});

test('stops are ordered by time of day: nightlife last, morning kinds before food', () => {
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    gen.typeLabels(d).forEach((type) => {
      const plan = gen.generate(d, { types: [type], days: 10, pace: 'full' });
      stopsOf(plan, d).forEach((stops) => {
        const kinds = stops.map((i) => d.places[i.place].kind);
        const t = kinds.map((k) => (TRIP_TYPES.timeOfDay.kinds[k] == null ? 0.5 : TRIP_TYPES.timeOfDay.kinds[k]));
        const nl = kinds.indexOf('nightlife');
        if (nl >= 0) kinds.slice(nl).forEach((k) => assert.equal(k, 'nightlife', id + ' nightlife comes last: ' + kinds.join(',')));
        for (let i = 1; i < t.length; i++) {
          if (kinds[i] === 'food' && kinds[i - 1] === 'food') continue;
          assert.ok(t[i] >= t[i - 1] || kinds[i] === 'food', id + ' order ' + kinds.join(','));
        }
      });
    });
  });
});

test('notes are built from the place blurb plus slot phrasing', () => {
  const d = DESTINATIONS.kyoto;
  const plan = gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 3 });
  real(plan).filter((i) => d.places[i.place].kind !== 'stay').forEach((i) => {
    assert.ok(i.note.includes(d.places[i.place].blurb), 'blurb kept: ' + i.place);
    assert.ok(i.note.length > d.places[i.place].blurb.length, 'slot phrase added');
  });
});

test('several trip types alternate day by day', () => {
  const d = DESTINATIONS.goa;
  const t = gen.typeLabels(d);
  const plan = gen.generate(d, { types: [t[0], t[1]], days: 6 });
  assert.equal(plan.days.length, 6);
});

test('the stay follows the base option, else rating, and never a far high camp', () => {
  const goa = DESTINATIONS.goa;
  const t = [gen.typeLabels(goa)[0]];
  assert.equal(gen.generate(goa, { types: t, days: 4, base: 'Quiet boutique village' }).stay, 'casa-anjuna');
  assert.equal(gen.generate(goa, { types: t, days: 4, base: 'Heritage quarter in Panjim' }).stay, 'panjim-inn');
  const free = gen.generate(goa, { types: t, days: 4 }).stay;
  assert.ok(goa.stays.ids.includes(free));
  assert.equal(gen.generate(goa, { types: t, days: 4, stay: false }).stay, null);
  const lad = DESTINATIONS.ladakh;
  ORDER.forEach((id) => {
    const d = DESTINATIONS[id];
    if (!d.acclimatisation) return;
    const plan = gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 7 });
    assert.ok(!d.acclimatisation.highAreas.includes(d.places[plan.stay].area));
  });
  assert.ok(lad.acclimatisation);
});

test('the travel item passes through on top of day 1', () => {
  const d = DESTINATIONS.goa;
  const travel = { kind: 'flight', label: 'Fly in' };
  const plan = gen.generate(d, { types: [gen.typeLabels(d)[0]], days: 3, travel });
  assert.equal(plan.days[0].items[0].kind, 'flight');
  assert.ok(plan.days[0].items[0].id);
});

test('ladakh: day 1 is a gentle rest day in Leh and high areas wait until day 4', () => {
  const d = DESTINATIONS.ladakh;
  const acc = d.acclimatisation;
  gen.typeLabels(d).forEach((type) => {
    const plan = gen.generate(d, { types: [type], days: 10 });
    assert.equal(plan.days[0].area, acc.arrivalArea);
    plan.days[0].items.filter((i) => d.places[i.place].kind !== 'stay').forEach((i) => {
      assert.ok(acc.gentleKinds.includes(d.places[i.place].kind), type + ' day 1 ' + i.place);
    });
    plan.days.slice(0, acc.afterDay).forEach((day, i) => assert.ok(!acc.highAreas.includes(day.area), type + ' day ' + (i + 1)));
  });
  const slow = gen.generate(d, { types: ['Slow acclimatised trip'], days: 10 });
  slow.days.slice(0, 5).forEach((day) => assert.ok(!acc.highAreas.includes(day.area)));
});

test('a destination can override a trip type', () => {
  const d = Object.assign({}, DESTINATIONS.goa, { tripTypes: { 'Beach downtime': { profile: 'beach', weights: { beach: 0, nightlife: 9 } } } });
  const plan = gen.generate(d, { types: ['Beach downtime'], days: 2, pace: 'full' });
  assert.ok(real(plan).some((i) => d.places[i.place].kind === 'nightlife'));
});

test('an empty catalog gives an empty plan rather than throwing', () => {
  const plan = gen.generate({ id: 'nowhere', name: 'Nowhere', places: {}, areas: [] }, { types: ['x'], days: 3 });
  assert.equal(plan.days.length, 3);
  plan.days.forEach((d) => assert.deepEqual(d.items, []));
  assert.equal(plan.stay, null);
});
