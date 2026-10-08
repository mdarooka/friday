/* Public page, destination guide, and guide-to-planner events. Sent through FridayAnalytics (friday-analytics.js). */
(function () {
  'use strict';
  var A = window.FridayAnalytics;
  var plannerKey = 'friday.guide-planner-click.v1';

  function read(key, fallback) {
    try { var value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function track(name, data) {
    var id = A.uuid();
    return A.track(name, Object.assign({ event_id: id }, data), id);
  }
  var GUIDES = ['kerala', 'goa', 'rajasthan'];
  function guideDestinationFromPath(pathname) {
    var match = String(pathname || '').match(/^\/([a-z0-9-]+)-guide(?:\.html)?$/);
    return match && GUIDES.indexOf(match[1]) !== -1 ? match[1] : null;
  }
  function trackPublicPageView() {
    var path = A.pathname();
    if (/^\/(?:admin(?:-villas)?(?:\.html)?|app(?:\.html)?)$/.test(path)) return Promise.resolve();
    var tags = A.currentTags();
    return track('public_page_viewed', {
      path: path, referrer_host: A.referrerHost(), utm_source: tags.utm_source,
      utm_medium: tags.utm_medium, utm_campaign: tags.utm_campaign,
      first_touch_landing_path: A.firstTouch().landing_path,
    });
  }
  function guideFromPath() {
    return guideDestinationFromPath(A.pathname());
  }
  function trackGuideView() {
    var tags = A.currentTags();
    return track('guide_viewed', {
      destination: guideFromPath() || 'kerala', path: A.pathname(),
      referrer_host: A.referrerHost(), utm_source: tags.utm_source,
      utm_medium: tags.utm_medium, utm_campaign: tags.utm_campaign,
      first_touch_landing_path: A.firstTouch().landing_path,
    });
  }
  function trackCta(target, destination) {
    if (target === 'planner') write(plannerKey, { destination: destination, at: Date.now() });
    return track('guide_cta_clicked', { destination: destination, target: target });
  }
  /* Called by the planner when a trip is created; credits the guide if the traveler arrived from it within 30 days. */
  function tripStarted(trip) {
    var params = new URLSearchParams(location.search || '');
    var marker = read(plannerKey, null);
    var markerIsFresh = marker && GUIDES.indexOf(marker.destination) !== -1 && Number.isFinite(marker.at) && Date.now() - marker.at <= 30 * 24 * 60 * 60 * 1000;
    var touch = A.firstTouch();
    var guideParam = params.get('from_guide');
    var guideDest = GUIDES.indexOf(guideParam) !== -1 ? guideParam : (markerIsFresh ? marker.destination : null);
    var fromGuide = !!guideDest;
    var promise = track('trip_started', {
      destination: guideDest, from_guide: fromGuide,
      first_touch_landing_path: touch.landing_path,
      first_touch_source: touch.source, first_touch_medium: touch.medium,
      first_touch_campaign: touch.campaign, first_touch_referrer_host: touch.referrer,
    });
    if (fromGuide) {
      try { localStorage.removeItem(plannerKey); } catch (_) {}
      try {
        if (typeof history !== 'undefined' && history.replaceState && GUIDES.indexOf(guideParam) !== -1) {
          params.delete('from_guide');
          history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + (location.hash || ''));
        }
      } catch (_) {}
    }
    return promise;
  }

  /* A guide opened from When India travels (?start=&nights=&from=india_breaks) passes the dates on to its planner link. */
  function carryDates() {
    if (!document.querySelectorAll) return;
    var q = new URLSearchParams(location.search || '');
    var start = q.get('start'), nights = q.get('nights');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{1,2}$/.test(nights || '')) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-guide-cta="planner"]'), function (a) {
      var href = a.getAttribute('href') || '', hash = '', i = href.indexOf('#');
      if (i !== -1) { hash = href.slice(i); href = href.slice(0, i); }
      if (/[?&]start=/.test(href)) return;
      a.setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'start=' + encodeURIComponent(start) + '&nights=' + encodeURIComponent(nights) + hash);
    });
  }
  carryDates();

  window.FridayGuideAnalytics = { trackPublicPageView: trackPublicPageView, trackGuideView: trackGuideView, trackCta: trackCta, tripStarted: tripStarted, trackBreakCta: trackBreakCta, flush: A.flush, guideDestinationFromPath: guideDestinationFromPath };
  trackPublicPageView();
  if (guideFromPath()) trackGuideView();
  /* When India travels page: "Plan this break" and "Call me back" on a pick. Same event as the guide CTAs, tagged surface=india_breaks. */
  function trackBreakCta(link) {
    var target = link.getAttribute('data-break-cta');
    if (target !== 'guide' && target !== 'planner' && target !== 'callback') return;
    track('guide_cta_clicked', {
      surface: 'india_breaks', target: target, place: link.getAttribute('data-break-place'),
      region: (document.body && document.body.getAttribute('data-wit-region')) || 'all', break_id: link.getAttribute('data-break-id'),
    });
  }
  if (document.addEventListener) document.addEventListener('click', function (event) {
    var cta = event.target && event.target.closest ? event.target.closest('[data-break-cta]') : null;
    if (cta) trackBreakCta(cta);
  });
  if (document.addEventListener) document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('[data-guide-cta]') : null;
    if (!link) return;
    var target = link.getAttribute('data-guide-cta');
    if (target !== 'planner' && target !== 'quote' && target !== 'callback') return;
    var destination = link.getAttribute('data-guide-destination') || guideFromPath();
    if (GUIDES.indexOf(destination) !== -1) trackCta(target, destination);
  });
})();
