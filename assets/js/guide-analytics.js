/* Small, privacy-conscious custom-event sender shared by the public Kerala guide and planner. */
(function () {
  'use strict';

  var attributionKey = 'friday.guide-attribution.v1';
  var plannerKey = 'friday.guide-planner-click.v1';
  var queueKey = 'friday.guide-events.v1';
  var sentKey = 'friday.guide-events-sent.v1';
  var internalsKey = 'StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals';
  var appPromise = null;
  var capabilitiesPromise = null;
  var flushPromise = Promise.resolve();

  function read(key, fallback) {
    try { var value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function safeTag(value) {
    if (typeof value !== 'string') return null;
    value = value.trim();
    return value && value.length <= 100 && /^[A-Za-z0-9._-]+$/.test(value) ? value : null;
  }
  function referrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname.toLowerCase().slice(0, 200) || null : null; } catch (_) { return null; }
  }
  function firstTouch() {
    var saved = read(attributionKey, null);
    if (saved && typeof saved === 'object') return saved;
    var params = new URLSearchParams(location.search || '');
    var referrer = referrerHost();
    var value = {
      source: safeTag(params.get('utm_source')) || referrer || 'direct',
      medium: safeTag(params.get('utm_medium')),
      campaign: safeTag(params.get('utm_campaign')),
      referrer_host: referrer,
      landing_path: String(location.pathname || '/').slice(0, 200),
    };
    write(attributionKey, value);
    return value;
  }
  function currentTags() {
    var params = new URLSearchParams(location.search || '');
    return {
      utm_source: safeTag(params.get('utm_source')),
      utm_medium: safeTag(params.get('utm_medium')),
      utm_campaign: safeTag(params.get('utm_campaign')),
    };
  }
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 'guide-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  function queued() { var value = read(queueKey, []); return Array.isArray(value) ? value : []; }
  function sent() { var value = read(sentKey, []); return Array.isArray(value) ? value : []; }
  function app(id) {
    if (!appPromise) {
      appPromise = import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
        return new mod.HexclaveClientApp({ projectId: id, tokenStore: 'cookie', devTool: false, automaticSideEffects: false, analytics: { enabled: false, replays: { enabled: false } } });
      }).catch(function (error) { appPromise = null; throw error; });
    }
    return appPromise;
  }
  function projectId() {
    if (!capabilitiesPromise) {
      capabilitiesPromise = fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
        if (!response.ok) throw new Error('Friday analytics is not configured.');
        return response.json();
      }).then(function (capabilities) {
        if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
        return capabilities.hexclaveProjectId;
      }).catch(function (error) { capabilitiesPromise = null; throw error; });
    }
    return capabilitiesPromise;
  }
  async function send(event) {
    var id = await projectId();
    var client = await app(id);
    await client.getUser({ or: 'anonymous' });
    var internals = client[Symbol.for(internalsKey)];
    if (!internals || typeof internals.sendAnalyticsEventBatch !== 'function') throw new Error('Hexclave custom event sending is unavailable.');
    var payload = {
      session_replay_segment_id: uuid(), batch_id: uuid(), sent_at_ms: Date.now(),
      events: [{ event_type: event.name, event_at_ms: event.at, data: event.data }],
    };
    var result = await internals.sendAnalyticsEventBatch(JSON.stringify(payload), { keepalive: true });
    if (!result || result.status !== 'ok' || !result.data || !result.data.ok) throw new Error('Hexclave did not accept the guide event.');
  }
  function flush() {
    flushPromise = flushPromise.then(async function () {
      var events = queued(), delivered = sent();
      while (events.length) {
        var event = events[0];
        if (delivered.indexOf(event.id) !== -1) { events.shift(); write(queueKey, events); continue; }
        try {
          await send(event);
          delivered.push(event.id);
          delivered = delivered.slice(-500);
          events.shift();
          write(sentKey, delivered);
          write(queueKey, events);
        } catch (_) { break; }
      }
    }).catch(function () {});
    return flushPromise;
  }
  function track(name, data) {
    var events = queued(), delivered = sent(), id = uuid();
    if (delivered.indexOf(id) !== -1) return flush();
    events.push({ id: id, name: name, at: Date.now(), data: Object.assign({ event_id: id }, data) });
    if (!write(queueKey, events)) return Promise.resolve();
    return flush();
  }
  function trackPublicPageView() {
    var path = String(location.pathname || '/').slice(0, 200);
    if (/^\/(?:admin(?:-villas)?(?:\.html)?|chatgpt-callback\.html|app(?:\.html)?)$/.test(path)) return Promise.resolve();
    var params = currentTags();
    var touch = firstTouch();
    return track('public_page_viewed', {
      path: path, referrer_host: referrerHost(), utm_source: params.utm_source,
      utm_medium: params.utm_medium, utm_campaign: params.utm_campaign,
      first_touch_landing_path: touch.landing_path,
    });
  }
  function trackGuideView() {
    var params = currentTags();
    var touch = firstTouch();
    return track('guide_viewed', {
      destination: 'kerala', path: String(location.pathname || '/').slice(0, 200),
      referrer_host: referrerHost(), utm_source: params.utm_source,
      utm_medium: params.utm_medium, utm_campaign: params.utm_campaign,
      first_touch_landing_path: touch.landing_path,
    });
  }
  function trackCta(target, destination) {
    if (target === 'planner') write(plannerKey, { destination: destination, at: Date.now() });
    return track('guide_cta_clicked', { destination: destination, target: target });
  }
  function tripStarted(trip) {
    var params = new URLSearchParams(location.search || '');
    var marker = read(plannerKey, null);
    var markerIsFresh = marker && marker.destination === 'kerala' && Number.isFinite(marker.at) && Date.now() - marker.at <= 30 * 24 * 60 * 60 * 1000;
    var touch = firstTouch();
    var fromGuide = params.get('from_guide') === 'kerala' || !!markerIsFresh;
    var promise = track('trip_started', {
      destination: fromGuide ? 'kerala' : null, from_guide: fromGuide,
      first_touch_landing_path: touch.landing_path,
      first_touch_source: touch.source, first_touch_medium: touch.medium,
      first_touch_campaign: touch.campaign, first_touch_referrer_host: touch.referrer_host,
    });
    if (fromGuide) {
      try { localStorage.removeItem(plannerKey); } catch (_) {}
      try {
        if (typeof history !== 'undefined' && history.replaceState && params.get('from_guide') === 'kerala') {
          params.delete('from_guide');
          history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + (location.hash || ''));
        }
      } catch (_) {}
    }
    return promise;
  }

  firstTouch();
  window.FridayGuideAnalytics = { trackPublicPageView: trackPublicPageView, trackGuideView: trackGuideView, trackCta: trackCta, tripStarted: tripStarted, flush: flush };
  trackPublicPageView();
  if (location.pathname === '/kerala-guide.html' || location.pathname === '/kerala-guide') trackGuideView();
  if (window.addEventListener) window.addEventListener('online', flush);
  if (queued().length) flush();
  if (document.addEventListener) document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('[data-guide-cta]') : null;
    if (!link) return;
    var target = link.getAttribute('data-guide-cta');
    if (target === 'planner' || target === 'quote') trackCta(target, 'kerala');
  });
})();
