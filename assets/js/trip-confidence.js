/* Booking confidence strip: where a booking came from, whether Friday's designer has checked it, and a way to ask about it.
   strip(booking) returns an HTML string for a booking row. "Ask designer" reuses the existing Call me back modal. */
(function () {
  'use strict';
  var FT = (window.FridayTrip = window.FridayTrip || {});
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Derived from existing fields only: server-set verification, then import markers, else the traveller added it. */
  function provenance(b) {
    b = b || {};
    var v = b.verification;
    if (v && v.verifiedAt) return { id: 'verified', label: 'Verified by your designer', title: 'Checked by Friday on ' + String(v.verifiedAt).slice(0, 10) };
    if (b.source || b.externalId) return { id: 'imported', label: 'Imported', title: b.source === 'google-calendar' ? 'Imported from your calendar' : 'Imported from your email' };
    return { id: 'manual', label: 'Added by you', title: 'You entered this booking yourself' };
  }

  function strip(b) {
    var p = provenance(b), key = esc(b.serverId || b.id);
    return '<div class="fx-bk-conf" data-confidence="' + p.id + '"><span class="fx-bk-conf__badge fx-bk-conf__badge--' + p.id + '" title="' + esc(p.title) + '">' + esc(p.label) + '</span>' +
      '<button type="button" class="fx-bk-conf__ask" data-ask-designer="' + key + '">Ask designer about this</button></div>';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-ask-designer]');
    if (!btn) return;
    var state = FT.store && FT.store.get ? FT.store.get() : { bookings: [], trips: [] };
    var id = btn.getAttribute('data-ask-designer');
    var b = (state.bookings || []).find(function (x) { return (x.serverId || x.id) === id; });
    if (!b || !FT.integrations || !FT.integrations.requestCallback) return;
    var trip = b.tripId && (state.trips || []).find(function (t) { return t.id === b.tripId || t.serverId === b.tripId; });
    FT.integrations.requestCallback({ tripId: trip ? (trip.serverId || trip.id) : undefined, topic: 'Booking: ' + String(b.name || b.title || 'Booking').slice(0, 150) });
  });

  FT.confidence = { provenance: provenance, strip: strip };
})();
