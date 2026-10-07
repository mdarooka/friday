/* Quote conversion events (quote_requested) with first-touch attribution. Sent through FridayAnalytics (friday-analytics.js). */
(function () {
  'use strict';
  var A = window.FridayAnalytics;
  var paths = ['enquiry', 'planner', 'villa', 'package'];

  function track(path, requestId) {
    if (paths.indexOf(path) === -1) path = 'enquiry';
    var id = typeof requestId === 'string' && requestId.length <= 160 ? requestId : A.uuid();
    var touch = A.firstTouch();
    var data = { request_id: id, path: path, source: touch.source, medium: touch.medium, campaign: touch.campaign, referrer: touch.referrer };
    if (new URLSearchParams(location.search || '').get('from') === 'mumbai-quiet-weekend') data.from = 'mumbai-quiet-weekend';
    return A.track('quote_requested', data, id);
  }
  function pathForEnquiry(form) {
    var requested = new URLSearchParams(location.search || '').get('quote_path');
    if (['villa', 'package'].includes(requested)) return requested;
    try {
      var selected = Array.from(new FormData(form).getAll('composition')).map(function (value) { return String(value).toLowerCase(); });
      if (selected.some(function (value) { return value.includes('villa'); })) return 'villa';
      if (selected.some(function (value) { return value.includes('package'); })) return 'package';
    } catch (_) {}
    return 'enquiry';
  }
  function plannerPath() {
    try {
      if (sessionStorage.getItem('friday.quote-path.v1') === 'villa') {
        sessionStorage.removeItem('friday.quote-path.v1');
        return 'villa';
      }
    } catch (_) {}
    return 'planner';
  }

  window.FridayQuoteAnalytics = { firstTouch: A.firstTouch, track: track, pathForEnquiry: pathForEnquiry, plannerPath: plannerPath };
})();
