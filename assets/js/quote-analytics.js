/* First-touch acquisition and privacy-safe quote conversion events for Friday. */
(function () {
  'use strict';
  var attributionKey = 'friday.quote-attribution.v1';
  var queueKey = 'friday.quote-events.v1';
  var sentKey = 'friday.quote-events-sent.v1';
  var internalsKey = 'StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals';
  var appPromise = null;
  var flushPromise = Promise.resolve();

  function storageGet(key, fallback) {
    try { var value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function safeTag(value) {
    if (typeof value !== 'string') return null;
    value = value.trim();
    return value && value.length <= 100 && /^[A-Za-z0-9._-]+$/.test(value) ? value : null;
  }
  function firstTouch() {
    var saved = storageGet(attributionKey, null);
    if (saved && typeof saved === 'object') return saved;
    var params = new URLSearchParams(location.search || '');
    var source = safeTag(params.get('utm_source'));
    var medium = safeTag(params.get('utm_medium'));
    var campaign = safeTag(params.get('utm_campaign'));
    var referrer = null;
    try { if (document.referrer) referrer = new URL(document.referrer).hostname.toLowerCase().slice(0, 200) || null; } catch (_) {}
    var value = { source: source || referrer || 'direct', medium: medium, campaign: campaign, referrer: referrer };
    storageSet(attributionKey, value);
    return value;
  }
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  function queued() { var value = storageGet(queueKey, []); return Array.isArray(value) ? value : []; }
  function sent() { var value = storageGet(sentKey, []); return Array.isArray(value) ? value : []; }
  function makeApp(projectId) {
    if (!appPromise) {
      appPromise = import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
        return new mod.HexclaveClientApp({ projectId: projectId, tokenStore: 'cookie', devTool: false, automaticSideEffects: false, analytics: { enabled: false, replays: { enabled: false } } });
      }).catch(function (error) { appPromise = null; throw error; });
    }
    return appPromise;
  }
  function send(event) {
    return fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('Analytics project details unavailable.');
      return response.json();
    }).then(function (capabilities) {
      if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
      return makeApp(capabilities.hexclaveProjectId);
    }).then(async function (app) {
      await app.getUser({ or: 'anonymous' });
      var internals = app[Symbol.for(internalsKey)];
      if (!internals || typeof internals.sendAnalyticsEventBatch !== 'function') throw new Error('Hexclave custom event sending is unavailable.');
      var at = event.event_at_ms || Date.now();
      var payload = {
        session_replay_segment_id: uuid(), batch_id: uuid(), sent_at_ms: Date.now(),
        events: [{
          event_type: 'quote_requested', event_at_ms: at,
          data: {
            request_id: event.request_id,
            path: event.path,
            source: event.attribution.source,
            medium: event.attribution.medium,
            campaign: event.attribution.campaign,
            referrer: event.attribution.referrer,
          },
        }],
      };
      var result = await internals.sendAnalyticsEventBatch(JSON.stringify(payload), { keepalive: true });
      if (!result || result.status !== 'ok' || !result.data.ok) throw new Error('Hexclave did not accept the quote event.');
    });
  }
  function flush() {
    flushPromise = flushPromise.then(async function () {
      var events = queued(), delivered = sent();
      while (events.length) {
        var event = events[0];
        if (delivered.indexOf(event.request_id) !== -1) { events.shift(); storageSet(queueKey, events); continue; }
        try {
          await send(event);
          delivered.push(event.request_id);
          delivered = delivered.slice(-500);
          events.shift();
          storageSet(sentKey, delivered);
          storageSet(queueKey, events);
        } catch (_) { break; }
      }
    }).catch(function () {});
    return flushPromise;
  }
  function track(path, requestId) {
    if (!['enquiry', 'planner', 'villa', 'package'].includes(path)) path = 'enquiry';
    var id = typeof requestId === 'string' && requestId.length <= 160 ? requestId : uuid();
    var delivered = sent(), events = queued();
    if (delivered.indexOf(id) !== -1 || events.some(function (event) { return event.request_id === id; })) return flush();
    events.push({ request_id: id, event_at_ms: Date.now(), path: path, attribution: firstTouch() });
    if (!storageSet(queueKey, events)) return Promise.resolve();
    return flush();
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
  firstTouch();
  window.FridayQuoteAnalytics = { firstTouch: firstTouch, track: track, pathForEnquiry: pathForEnquiry, plannerPath: plannerPath };
  window.addEventListener && window.addEventListener('online', flush);
  if (queued().length) flush();
})();
