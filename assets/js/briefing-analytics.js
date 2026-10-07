/* Pre-departure briefing events (briefing_sent, briefing_opened). Sent through FridayAnalytics (friday-analytics.js). */
(function () {
  'use strict';
  var A = window.FridayAnalytics;

  function track(name, data) {
    if (!['briefing_sent', 'briefing_opened'].includes(name) || !data || typeof data.trip_id !== 'string') return Promise.resolve(false);
    return A.track(name, data).then(function () { return true; });
  }

  window.FridayBriefingAnalytics = { track: track };
})();
