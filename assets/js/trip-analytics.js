/* Planner outcome events (trip_created) with aggregate memory-use properties only. Sent through FridayAnalytics (friday-analytics.js). */
(function () {
  'use strict';
  var A = window.FridayAnalytics;

  function trackCreated(input) {
    input = input || {};
    return A.track('trip_created', {
      returning: input.returning === true,
      memory_shown: input.memory_shown === true,
      memory_applied_count: Math.max(0, Math.min(100, Math.floor(Number(input.memory_applied_count) || 0))),
    });
  }

  window.FridayTrip = window.FridayTrip || {};
  window.FridayTrip.tripAnalytics = { trackCreated: trackCreated };
})();
