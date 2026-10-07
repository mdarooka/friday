/* One-time, explicit transfer of a reviewed villa plan into the Friday planner. */
(function () {
  'use strict';
  var FT = window.FridayTrip = window.FridayTrip || {};
  var KEY = 'friday.villa.plan.v1';
  var hydrated = new Set();
  function api(path) { return fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Place details are unavailable.'); return j; }); }); }
  function makeDestId(id) { return 'villa-' + String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120); }
  function mapUrl(placeId) { return 'https://www.google.com/maps/search/?api=1&query_place_id=' + encodeURIComponent(placeId); }
  function valid(payload) { return payload && payload.version === 1 && payload.villa && typeof payload.villa.id === 'string' && Array.isArray(payload.days) && payload.days.length > 0; }
  function installTrip(payload) {
    if (!valid(payload) || !FT.trips || !FT.store || !FT.router) return null;
    var destId = makeDestId(payload.villa.id), villaAt = payload.villa.lat != null && payload.villa.lng != null ? [payload.villa.lng, payload.villa.lat] : null, dest = { id: destId, name: payload.villa.city || payload.villa.name, tripTitle: payload.villa.name + ' stay', threadTitle: 'Plan around ' + payload.villa.name, areas: [{ id: 'villa', name: payload.villa.city || payload.villa.name, town: payload.villa.city || payload.villa.name, at: villaAt }], places: {}, map: {} };
    if (villaAt) dest.map.bounds = [villaAt[0] - .08, villaAt[1] - .08, villaAt[0] + .08, villaAt[1] + .08];
    dest.places['villa-base'] = { id: 'villa-base', name: payload.villa.name, kind: 'stay', label: 'Your villa', area: 'villa', at: villaAt, address: payload.villa.address || '', url: payload.villa.googleMapsUrl || '', sourceUrl: payload.villa.googleMapsUrl || '', blurb: 'Your Friday stay', photos: [], ownerProvided: true };
    var refs = [], planDays = [];
    payload.days.forEach(function (day, i) {
      var items = [];
      (day.stops || []).forEach(function (stop, j) {
        if (!stop || typeof stop.id !== 'string' || !stop.id) return;
        var ref = stop.source === 'google' ? 'vg-' + stop.id : 'vc-' + stop.id;
        var entry = stop.source === 'google'
          ? { id: ref, googlePlaceId: stop.id, provider: 'google', name: 'Nearby place', kind: 'sight', label: 'Nearby place', area: 'villa', at: null, url: '', sourceUrl: '', address: '', blurb: '', photos: [] }
          : { id: ref, source: 'curated', name: stop.name, kind: stop.category || 'sight', label: stop.category || 'Nearby place', area: 'villa', at: stop.lat != null && stop.lng != null ? [Number(stop.lng), Number(stop.lat)] : null, url: stop.mapsUrl || '', sourceUrl: stop.mapsUrl || '', address: '', blurb: stop.description || '', photos: [] };
        dest.places[ref] = entry;
        refs.push(stop.source === 'google' ? { id: ref, source: 'google', googlePlaceId: stop.id } : { id: ref, source: 'curated', stop: stop });
        items.push({ id: 'vstop-' + i + '-' + j, place: ref, time: '', note: '' });
      });
      planDays.push({ id: 'vday-' + i, area: 'villa', town: payload.villa.city || payload.villa.name, date: null, notes: day.focus || '', items: items });
    });
    if (!planDays.length) return null;
    FT.DESTINATIONS = FT.DESTINATIONS || {}; FT.DESTINATIONS[destId] = dest;
    var trip = FT.trips.create();
    FT.store.update(function (state) {
      var current = state.trips.filter(function (t) { return t.id === trip.id; })[0]; if (!current) return;
      current.destId = destId; current.destName = dest.name; current.title = payload.villa.name + ' · ' + (payload.villa.city || 'Friday stay');
      current.villaOrigin = { villaId: payload.villa.id, name: payload.villa.name, city: payload.villa.city, address: payload.villa.address, lat: payload.villa.lat, lng: payload.villa.lng, googleMapsUrl: payload.villa.googleMapsUrl, placeRefs: refs };
      current.plan = { days: planDays, stay: 'villa-base' };
    });
    hydrateTrip(trip.id);
    FT.router.go('#/trip/' + trip.id);
    return trip;
  }
  function prepareTrip(t) {
    if (!t || !t.villaOrigin || !Array.isArray(t.villaOrigin.placeRefs)) return null;
    FT.DESTINATIONS = FT.DESTINATIONS || {};
    if (FT.DESTINATIONS[t.destId]) return FT.DESTINATIONS[t.destId];
    var villaAt = t.villaOrigin.lat != null && t.villaOrigin.lng != null ? [t.villaOrigin.lng, t.villaOrigin.lat] : null;
    var city = t.villaOrigin.city || t.villaOrigin.name;
    var dest = { id: t.destId, name: city, region: city, tripTitle: t.villaOrigin.name + ' stay', threadTitle: 'Plan around ' + t.villaOrigin.name, areas: [{ id: 'villa', name: city, town: city, at: villaAt }], places: {}, map: {} };
    if (villaAt) dest.map.bounds = [villaAt[0] - .08, villaAt[1] - .08, villaAt[0] + .08, villaAt[1] + .08];
    dest.places['villa-base'] = { id: 'villa-base', name: t.villaOrigin.name, kind: 'stay', label: 'Your villa', area: 'villa', at: villaAt, address: t.villaOrigin.address || '', url: t.villaOrigin.googleMapsUrl || '', sourceUrl: t.villaOrigin.googleMapsUrl || '', blurb: 'Your Friday stay', photos: [], ownerProvided: true };
    t.villaOrigin.placeRefs.forEach(function (ref) {
      if (ref.source === 'curated' && ref.stop) {
        var s = ref.stop; dest.places[ref.id] = { id: ref.id, source: 'curated', name: s.name, kind: s.category || 'sight', label: s.category || 'Nearby place', area: 'villa', at: s.lat != null && s.lng != null ? [Number(s.lng), Number(s.lat)] : null, url: s.mapsUrl || '', sourceUrl: s.mapsUrl || '', address: '', blurb: s.description || '', photos: [] };
      } else if (ref.googlePlaceId) dest.places[ref.id] = { id: ref.id, googlePlaceId: ref.googlePlaceId, provider: 'google', name: 'Nearby place', kind: 'sight', label: 'Nearby place', area: 'villa', at: null, url: '', sourceUrl: mapUrl(ref.googlePlaceId), address: '', blurb: '', photos: [] };
    });
    FT.DESTINATIONS[t.destId] = dest;
    return dest;
  }
  function prepareCatalogs() {
    if (!FT.store || !FT.store.get) return;
    var state = FT.store.get();
    (state && state.trips || []).forEach(prepareTrip);
  }
  function hydrateTrip(tripId) {
    var t = FT.store && FT.store.trip(tripId); if (!t || !t.villaOrigin || !Array.isArray(t.villaOrigin.placeRefs)) return Promise.resolve();
    var dest = prepareTrip(t);
    var todo = t.villaOrigin.placeRefs.filter(function (r) { var key = t.destId + ':' + r.googlePlaceId; return r.source === 'google' && r.googlePlaceId && !hydrated.has(key); });
    return Promise.all(todo.map(function (ref) {
      var cacheKey = t.destId + ':' + ref.googlePlaceId; hydrated.add(cacheKey);
      return api('/api/villas/' + encodeURIComponent(t.villaOrigin.villaId) + '/places/' + encodeURIComponent(ref.googlePlaceId)).then(function (r) {
        var p = r.place; if (!p) return;
        var lat = Number(p.lat != null ? p.lat : p.location && p.location.latitude), lng = Number(p.lng != null ? p.lng : p.location && p.location.longitude);
        dest.places[ref.id] = { id: ref.id, googlePlaceId: ref.googlePlaceId, provider: 'google', name: p.title || p.name || 'Nearby place', kind: 'sight', label: 'Nearby place', area: 'villa', at: Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null, url: '', sourceUrl: mapUrl(ref.googlePlaceId), address: '', blurb: '', photos: [], rating: null, reviews: null, openingHours: [] };
      }).catch(function () { hydrated.delete(cacheKey); });
    })).then(function () { if (todo.length && FT.store) FT.store.emit('change', { tripIds: [tripId], hydrated: true }); });
  }
  FT.villa = FT.villa || {};
  FT.villa.prepareCatalogs = prepareCatalogs;
  function importPending() {
    var raw;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    var payload; try { payload = JSON.parse(raw); } catch (e) { return; }
    if (installTrip(payload)) { try { sessionStorage.removeItem(KEY); } catch (e) {} }
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!FT.store || !FT.store.on) return;
    // trip-app boot awaits backend/guest initialization before its first route event.
    var imported = false;
    FT.store.on('route', function (route) {
      if (!imported) { imported = true; importPending(); }
      if (route && route.name === 'trip') hydrateTrip(route.id);
    });
  });
})();
