/*
 * trip-generator.js — builds a day-by-day plan from a destination's place catalog.
 *
 * One module for both sides of the wire. In Node it is `require('./trip-generator.js')`; in the
 * browser it is a classic script (file:// works, no build step) that adds `FridayTrip.generate`.
 * The server's local provider, the server's Claude provider (to assemble and validate) and the
 * planner's offline fallback all call this same code.
 *
 *   generate(dest, { types, days, dates, pace, base, stay, travel, uid, table })
 *     -> { days: [{ id, area, town, date, items: [{ id, place, note }] }], stay: placeId | null }
 *
 * There is no per-destination script. A place is scored by its kind under the chosen trip type
 * (shared table: build/trip-data/trip-types.js, in the browser FridayTrip.TRIP_TYPES) and its
 * rating. Each day is one area: the area whose best unvisited places score highest, nudged toward
 * the previous day's area. When an area has fewer places left than the day needs, the day fills
 * from the nearest areas by coordinates. A place is not used twice until the catalog is exhausted.
 * A day's stops are ordered by when their kind suits the day, and each note is the place's own
 * blurb plus a slot phrase from the table. The same inputs always give the same plan.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    var FT = root.FridayTrip = root.FridayTrip || {};
    FT.generator = api;
    FT.generate = api.generate;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- table */
  function defaultTable() {
    if (typeof window !== 'undefined' && window.FridayTrip && window.FridayTrip.TRIP_TYPES) return window.FridayTrip.TRIP_TYPES;
    if (typeof require === 'function') {
      try { return require('../../build/trip-data/trip-types.js'); } catch (e) { /* not in the repo layout */ }
    }
    throw new Error('trip-generator: trip-types table is not loaded (FridayTrip.TRIP_TYPES)');
  }

  /* ---------------------------------------------------------------- helpers */
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dist(a, b) { if (!a || !b) return 99; var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function addDays(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    function z(x) { return (x < 10 ? '0' : '') + x; }
    return d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' + z(d.getUTCDate());
  }
  function validIso(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return addDays(s, 0) === s;
  }
  function pickFrom(list, rng) { return list[Math.floor(rng() * list.length) % list.length]; }

  /* ---------------------------------------------------------------- catalog */
  function areaById(dest, id) {
    var list = dest.areas || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* the name a person would say for an area: its town, else its name */
  function areaLabel(dest, id) {
    var a = areaById(dest, id);
    return a ? (a.town || a.name || '') : '';
  }
  function typeLabels(dest) {
    var t = dest && dest.clarify && dest.clarify.types && dest.clarify.types.options || [];
    return t.map(function (o) { return typeof o === 'string' ? o : o && o.label; }).filter(Boolean);
  }
  function placeIds(dest, includeStays) {
    return Object.keys(dest.places || {}).sort().filter(function (id) { return includeStays || dest.places[id].kind !== 'stay'; });
  }

  /* a trip-type label -> { weights, acclimatisationAfterDay } */
  function resolveProfile(dest, label, T) {
    var over = dest.tripTypes && dest.tripTypes[label];
    var name = typeof over === 'string' ? over : over && over.profile;
    if (!name) name = T.labels && T.labels[label];
    if (!name) {
      var low = String(label || '').toLowerCase();
      Object.keys(T.profiles).forEach(function (k) {
        if (name) return;
        (T.profiles[k].match || []).forEach(function (w) { if (!name && low.indexOf(w) >= 0) name = k; });
      });
    }
    var prof = T.profiles[name] || T.profiles.balanced;
    var weights = {}, k;
    for (k in prof.weights) weights[k] = prof.weights[k];
    if (over && typeof over === 'object' && over.weights) for (k in over.weights) weights[k] = over.weights[k];
    return { name: name || 'balanced', weights: weights, acclimatisationAfterDay: prof.acclimatisationAfterDay || 0 };
  }

  function kindScore(p, weights, tune) {
    var w = weights[p.kind];
    if (w == null) w = tune.unknownKindWeight;
    var f = 1;
    if (typeof p.rating === 'number') f = tune.ratingFloor + (tune.ratingCeil - tune.ratingFloor) * clamp((p.rating - tune.ratingLow) / (tune.ratingHigh - tune.ratingLow), 0, 1);
    else f = (tune.ratingFloor + tune.ratingCeil) / 2;
    return w * f;
  }

  /* ---------------------------------------------------------------- stay */
  var STOP_WORDS = /close|action|kind|quarter|with|near/;
  function pickStay(dest, baseLabel, o) {
    o = o || {};
    var st = dest.stays || {}, acc = dest.acclimatisation;
    var ids = (st.ids || []).filter(function (id) { return dest.places && dest.places[id]; });
    if (acc) {
      var low = ids.filter(function (id) { return (acc.highAreas || []).indexOf(dest.places[id].area) < 0; });
      if (low.length) ids = low;   /* the first nights are at the arrival base, not a far camp */
    }
    if (!ids.length) return null;
    if (baseLabel) {
      if (st.byBase && st.byBase[baseLabel] && ids.indexOf(st.byBase[baseLabel]) >= 0) return st.byBase[baseLabel];
      var words = String(baseLabel).toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length > 3 && !STOP_WORDS.test(w); });
      var best = null, bs = 0, tie = false;
      ids.forEach(function (id) {
        var p = dest.places[id];
        var hay = (p.name + ' ' + (p.blurb || '') + ' ' + (p.label || '') + ' ' + p.area + ' ' + areaLabel(dest, p.area)).toLowerCase();
        var s = 0; words.forEach(function (w) { if (hay.indexOf(w) >= 0) s++; });
        if (s > bs) { bs = s; best = id; tie = false; } else if (s === bs && s > 0) tie = true;
      });
      if (best && !tie) return best;
    }
    var near = (o.tune || (o.table || defaultTable()).tuning).stay.nearFirstDay;
    var ranked = ids.map(function (id) {
      var p = dest.places[id];
      return { id: id, s: (typeof p.rating === 'number' ? p.rating : 4) + (o.firstArea && p.area === o.firstArea ? near : 0), n: p.reviews || 0 };
    }).sort(function (a, b) { return b.s - a.s || b.n - a.n || (a.id < b.id ? -1 : 1); });
    return ranked[0].id;
  }

  /* ---------------------------------------------------------------- assembly */
  /* draft days [{ area, items: [{ place, note }] }] -> the plan the UI stores. Shared with the Claude provider. */
  function assemble(dest, drafts, opts) {
    opts = opts || {};
    var T = opts.table || defaultTable();
    var n = { d: 0, i: 0 };
    function mk(kind) { return opts.uid ? opts.uid(kind + '_') : kind + '_' + (++n[kind]); }
    var start = opts.dates && validIso(opts.dates.start) ? opts.dates.start : null;
    var days = drafts.map(function (dr, i) {
      return {
        id: mk('d'), area: dr.area, town: areaLabel(dest, dr.area), date: start ? addDays(start, i) : null,
        items: dr.items.map(function (it) { return { id: mk('i'), place: it.place, note: it.note || '' }; })
      };
    });
    var plan = { days: days, stay: null };
    if (days.length && opts.stay !== false) {
      var stay = typeof opts.stay === 'string' && dest.places[opts.stay] ? opts.stay : pickStay(dest, opts.base, { firstArea: days[0].area, table: T });
      if (stay) {
        plan.stay = stay;
        days[0].items.unshift({ id: mk('i'), place: stay, note: T.tuning.stay.note });
      }
    }
    if (days.length && opts.travel) days[0].items.unshift(Object.assign({ id: mk('i') }, opts.travel));
    return plan;
  }

  /* ---------------------------------------------------------------- generate */
  function slotOf(time, T) {
    var s = T.timeOfDay.slots;
    for (var i = 0; i < s.length; i++) if (time < s[i].below) return s[i].key;
    return s[s.length - 1].key;
  }
  function phraseFor(T, slot, kind, rng) {
    var g = T.phrases[slot] || {};
    var list = g[kind] || g.default || [];
    return list.length ? pickFrom(list, rng) : '';
  }

  function generate(dest, opts) {
    opts = opts || {};
    var T = opts.table || defaultTable();
    var tune = T.tuning;
    var labels = typeLabels(dest);
    var types = (Array.isArray(opts.types) ? opts.types : []).filter(function (t) { return typeof t === 'string' && t; });
    if (!types.length) types = [labels[0] || 'balanced'];
    var N = clamp(Math.round(Number(opts.days) || 4), 1, tune.maxDays);
    var paceKey = T.pace[opts.pace] && opts.pace !== 'default' ? opts.pace : T.pace.default;
    var stops = T.pace[paceKey].stops;
    var rng = rngFrom(hash([dest.id || dest.name || '', types.join('|'), N, paceKey].join('~')));

    var ids = placeIds(dest, false);
    var areas = (dest.areas || []).map(function (a) { return a.id; });
    if (!areas.length) ids.forEach(function (id) { if (areas.indexOf(dest.places[id].area) < 0) areas.push(dest.places[id].area); });
    var acc = dest.acclimatisation || null;
    var usage = {};
    ids.forEach(function (id) { usage[id] = 0; });
    var visits = {};
    var prevArea = null;
    var drafts = [];

    for (var di = 0; di < N; di++) {
      var prof = resolveProfile(dest, types[di % types.length], T);
      var resting = !!(acc && di === 0);
      var holdHighUntil = acc ? Math.max(acc.afterDay || 0, prof.acclimatisationAfterDay || 0) : 0;
      var allowedArea = {};
      areas.forEach(function (a) {
        if (resting) allowedArea[a] = a === acc.arrivalArea;
        else if (acc && di < holdHighUntil && (acc.highAreas || []).indexOf(a) >= 0) allowedArea[a] = false;
        else allowedArea[a] = true;
      });
      var pool = ids.filter(function (id) { return allowedArea[dest.places[id].area] !== false; });
      if (resting) {
        var gentle = pool.filter(function (id) { return (acc.gentleKinds || []).indexOf(dest.places[id].kind) >= 0; });
        if (gentle.length) pool = gentle;
      }
      if (!pool.length) pool = ids.slice();
      var dayStops = resting ? Math.min(stops, acc.arrivalStops || stops) : stops;
      var level = Infinity;
      pool.forEach(function (id) { if (usage[id] < level) level = usage[id]; });

      /* greedy pick of up to `want` places from `cands`, scoring by kind, rating, and what the day already holds */
      var score = {};
      pool.forEach(function (id) { score[id] = kindScore(dest.places[id], prof.weights, tune); });
      function choose(cands, want, chosen) {
        var out = [], have = {};
        (chosen || []).forEach(function (id) { var k = dest.places[id].kind; have[k] = (have[k] || 0) + 1; });
        var list = cands.slice();
        while (out.length < want && list.length) {
          /* the per-kind cap is soft: it only yields when nothing else is left to choose */
          var bi = -1, bs = -1e9, ci = -1, cs = -1e9;
          for (var i = 0; i < list.length; i++) {
            var k = dest.places[list[i]].kind;
            var cap = tune.maxPerKind[k];
            var s = score[list[i]] * Math.pow(tune.diversity, have[k] || 0) + rng() * 0.001;
            if (cap != null && (have[k] || 0) >= cap) { if (s > cs) { cs = s; ci = i; } continue; }
            if (s > bs) { bs = s; bi = i; }
          }
          if (bi < 0) bi = ci;
          var id = list.splice(bi, 1)[0];
          out.push(id);
          have[dest.places[id].kind] = (have[dest.places[id].kind] || 0) + 1;
        }
        return out;
      }

      /* the day's area */
      var best = null;
      areas.forEach(function (a) {
        if (allowedArea[a] === false) return;
        var cands = pool.filter(function (id) { return dest.places[id].area === a && usage[id] === level; });
        if (!cands.length) return;
        var picks = choose(cands, dayStops, []);
        var total = 0;
        picks.forEach(function (id) { total += score[id]; });
        var ar = areaById(dest, a);
        var pen = (prevArea ? tune.distance * dist(ar && ar.at, (areaById(dest, prevArea) || {}).at) : 0) + tune.areaRepeat * (visits[a] || 0);
        var s = total - pen + rng() * 0.02;
        if (!best || s > best.s) best = { a: a, s: s, picks: picks };
      });
      if (!best) {
        /* every allowed place in a known area is used more than the level: open the level up */
        var any = pool.filter(function (id) { return usage[id] === level; });
        var a0 = any.length ? dest.places[any[0]].area : areas[0];
        best = { a: a0, s: 0, picks: choose(any, dayStops, []) };
      }
      var area = best.a, picks = best.picks.slice();

      /* an area that runs out: fill from the nearest areas by coordinates, unused places first */
      if (picks.length < dayStops) {
        var here = (areaById(dest, area) || {}).at;
        var rest = pool.filter(function (id) { return picks.indexOf(id) < 0; }).sort(function (x, y) {
          var px = dest.places[x], py = dest.places[y];
          return (usage[x] - usage[y]) ||
            ((px.area === area ? 0 : 1) - (py.area === area ? 0 : 1)) ||
            (dist(px.at || (areaById(dest, px.area) || {}).at, here) - dist(py.at || (areaById(dest, py.area) || {}).at, here)) ||
            (score[y] - score[x]) || (x < y ? -1 : 1);
        });
        /* least-used places first; within a tier the kind limits hold until only capped kinds are left */
        var have = {};
        picks.forEach(function (id) { var k = dest.places[id].kind; have[k] = (have[k] || 0) + 1; });
        var r = 0;
        while (r < rest.length && picks.length < dayStops) {
          var tier = usage[rest[r]], end = r;
          while (end < rest.length && usage[rest[end]] === tier) end++;
          var group = rest.slice(r, end), left = [];
          group.forEach(function (id) {
            var kk = dest.places[id].kind, cp = tune.maxPerKind[kk];
            if (picks.length < dayStops && (cp == null || (have[kk] || 0) < cp)) { picks.push(id); have[kk] = (have[kk] || 0) + 1; } else left.push(id);
          });
          left.forEach(function (id) { if (picks.length < dayStops) picks.push(id); });
          r = end;
        }
      }

      /* order by when each kind suits the day */
      var foodSeen = 0;
      var timed = picks.map(function (id, i) {
        var p = dest.places[id], t = T.timeOfDay.kinds[p.kind];
        if (t == null) t = T.timeOfDay.defaultKind;
        if (p.kind === 'food') { foodSeen++; if (foodSeen > 1) t = T.timeOfDay.dinner; }
        return { id: id, t: t, i: i, used: usage[id] > 0 };
      }).sort(function (x, y) { return (x.t - y.t) || (x.i - y.i); });

      var items = timed.map(function (x) {
        var p = dest.places[x.id];
        var slot = resting ? 'rest' : slotOf(x.t, T);
        var phrase = phraseFor(T, slot, p.kind, rng);
        var note = [p.blurb || '', phrase].filter(Boolean).join(' ');
        if (x.used && T.phrases.revisit && T.phrases.revisit.length) note = pickFrom(T.phrases.revisit, rng) + note;
        return { place: x.id, note: note };
      });
      timed.forEach(function (x) { usage[x.id]++; });
      visits[area] = (visits[area] || 0) + 1;
      prevArea = area;
      drafts.push({ area: area, items: items });
    }
    return assemble(dest, drafts, opts);
  }

  return {
    generate: generate, assemble: assemble, pickStay: pickStay, areaLabel: areaLabel, typeLabels: typeLabels,
    resolveProfile: resolveProfile, validIso: validIso, addDays: addDays
  };
});
