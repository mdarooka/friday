/* Friday pre-departure briefing analytics. Uses the same Hexclave SDK event-batch path as quote attribution. */
(function () {
  'use strict';
  var internalsKey = 'StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals';
  var appPromise = null;
  function uuid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'briefing-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); }
  function appFor(projectId) {
    if (!appPromise) appPromise = import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
      return new mod.HexclaveClientApp({ projectId: projectId, tokenStore: 'cookie', devTool: false, automaticSideEffects: false, analytics: { enabled: false, replays: { enabled: false } } });
    }).catch(function (error) { appPromise = null; throw error; });
    return appPromise;
  }
  function track(name, data) {
    if (!['briefing_sent', 'briefing_opened'].includes(name) || !data || typeof data.trip_id !== 'string') return Promise.resolve(false);
    return fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('Friday analytics details unavailable.');
      return response.json();
    }).then(function (capabilities) {
      if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
      return appFor(capabilities.hexclaveProjectId);
    }).then(async function (app) {
      await app.getUser({ or: 'anonymous' });
      var internals = app[Symbol.for(internalsKey)];
      if (!internals || typeof internals.sendAnalyticsEventBatch !== 'function') throw new Error('Hexclave event sending is unavailable.');
      var result = await internals.sendAnalyticsEventBatch(JSON.stringify({
        session_replay_segment_id: uuid(), batch_id: uuid(), sent_at_ms: Date.now(),
        events: [{ event_type: name, event_at_ms: Date.now(), data: data }],
      }), { keepalive: true });
      return !!(result && result.status === 'ok' && result.data && result.data.ok);
    }).catch(function () { return false; });
  }
  window.FridayBriefingAnalytics = { track: track };
})();
