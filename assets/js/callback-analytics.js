/* Callback-request conversion events (callback_requested). Sent through FridayAnalytics (friday-analytics.js). */
(function () {
  'use strict';
  var A = window.FridayAnalytics;

  function track(entryPoint, requestId) {
    if (!['planner', 'contact'].includes(entryPoint)) return Promise.resolve();
    var id = typeof requestId === 'string' && requestId.length <= 160 ? requestId : A.uuid();
    var touch = A.firstTouch();
    return A.track('callback_requested', {
      request_id: id, path: entryPoint === 'planner' ? 'planner' : 'enquiry', entry_point: entryPoint,
      source: touch.source || 'direct', medium: touch.medium || null, campaign: touch.campaign || null, referrer: touch.referrer || null,
    }, id);
  }

  window.FridayCallbackAnalytics = { track: track };
})();
