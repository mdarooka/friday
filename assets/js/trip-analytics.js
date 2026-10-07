/* Privacy-safe planner outcome events for Friday. */
(function () {
  'use strict';
  var internalsKey = 'StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals';
  var appPromise = null;
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  function makeApp(projectId) {
    if (!appPromise) appPromise = import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
      return new mod.HexclaveClientApp({ projectId: projectId, tokenStore: 'cookie', devTool: false, automaticSideEffects: false, analytics: { enabled: false, replays: { enabled: false } } });
    }).catch(function (error) { appPromise = null; throw error; });
    return appPromise;
  }
  function trackCreated(input) {
    input = input || {};
    var properties = {
      returning: input.returning === true,
      memory_shown: input.memory_shown === true,
      memory_applied_count: Math.max(0, Math.min(100, Math.floor(Number(input.memory_applied_count) || 0))),
    };
    return fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('Friday analytics is unavailable.');
      return response.json();
    }).then(function (capabilities) {
      if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
      return makeApp(capabilities.hexclaveProjectId);
    }).then(async function (app) {
      await app.getUser({ or: 'anonymous' });
      var internals = app[Symbol.for(internalsKey)];
      if (!internals || typeof internals.sendAnalyticsEventBatch !== 'function') throw new Error('Hexclave custom event sending is unavailable.');
      var at = Date.now();
      var payload = { session_replay_segment_id: uuid(), batch_id: uuid(), sent_at_ms: at, events: [{ event_type: 'trip_created', event_at_ms: at, data: properties }] };
      var result = await internals.sendAnalyticsEventBatch(JSON.stringify(payload), { keepalive: true });
      if (!result || result.status !== 'ok' || !result.data.ok) throw new Error('Hexclave did not accept the trip event.');
    }).catch(function () {});
  }
  window.FridayTrip = window.FridayTrip || {};
  window.FridayTrip.tripAnalytics = { trackCreated: trackCreated };
})();
