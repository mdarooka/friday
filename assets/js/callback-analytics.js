/* Privacy-safe callback-request conversion events for Friday. */
(function () {
  'use strict';
  var attributionKey = 'friday.quote-attribution.v1';
  var queueKey = 'friday.callback-events.v1';
  var sentKey = 'friday.callback-events-sent.v1';
  var internalsKey = 'StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals';
  var appPromise = null;
  var flushPromise = Promise.resolve();

  function read(key, fallback) { try { var value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function safeTag(value) { return typeof value === 'string' && value.trim().length <= 100 && /^[A-Za-z0-9._-]+$/.test(value.trim()) ? value.trim() : null; }
  function firstTouch() {
    var saved = read(attributionKey, null);
    if (saved && typeof saved === 'object') return saved;
    var params = new URLSearchParams(location.search || ''), referrer = null;
    try { if (document.referrer) referrer = new URL(document.referrer).hostname.toLowerCase().slice(0, 200) || null; } catch (_) {}
    var value = { source: safeTag(params.get('utm_source')) || referrer || 'direct', medium: safeTag(params.get('utm_medium')), campaign: safeTag(params.get('utm_campaign')), referrer: referrer };
    write(attributionKey, value);
    return value;
  }
  function uuid() { try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {} return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14); }
  function queue() { var events = read(queueKey, []); return Array.isArray(events) ? events : []; }
  function send(event) {
    return fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('Analytics project details unavailable.'); return response.json();
    }).then(function (capabilities) {
      if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
      if (!appPromise) appPromise = import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
        return new mod.HexclaveClientApp({ projectId: capabilities.hexclaveProjectId, tokenStore: 'cookie', devTool: false, automaticSideEffects: false, analytics: { enabled: false, replays: { enabled: false } } });
      }).catch(function (error) { appPromise = null; throw error; });
      return appPromise;
    }).then(async function (app) {
      await app.getUser({ or: 'anonymous' });
      var internals = app[Symbol.for(internalsKey)];
      if (!internals || typeof internals.sendAnalyticsEventBatch !== 'function') throw new Error('Hexclave custom event sending is unavailable.');
      var now = Date.now(), attribution = event.attribution || {};
      var payload = { session_replay_segment_id: uuid(), batch_id: uuid(), sent_at_ms: now, events: [{
        event_type: 'callback_requested', event_at_ms: event.event_at_ms || now,
        data: { request_id: event.request_id, path: event.path, entry_point: event.entry_point, source: attribution.source || 'direct', medium: attribution.medium || null, campaign: attribution.campaign || null, referrer: attribution.referrer || null },
      }] };
      var result = await internals.sendAnalyticsEventBatch(JSON.stringify(payload), { keepalive: true });
      if (!result || result.status !== 'ok' || !result.data.ok) throw new Error('Hexclave did not accept the callback event.');
    });
  }
  function flush() {
    flushPromise = flushPromise.then(async function () {
      var events = queue(), delivered = read(sentKey, []); if (!Array.isArray(delivered)) delivered = [];
      while (events.length) {
        var event = events[0];
        if (delivered.indexOf(event.request_id) >= 0) { events.shift(); write(queueKey, events); continue; }
        try { await send(event); delivered.push(event.request_id); delivered = delivered.slice(-500); events.shift(); write(sentKey, delivered); write(queueKey, events); }
        catch (_) { break; }
      }
    }).catch(function () {});
    return flushPromise;
  }
  function track(entryPoint, requestId) {
    if (!['planner', 'contact'].includes(entryPoint)) return Promise.resolve();
    var id = typeof requestId === 'string' && requestId.length <= 160 ? requestId : uuid();
    var events = queue(), delivered = read(sentKey, []);
    if (!Array.isArray(delivered)) delivered = [];
    if (delivered.indexOf(id) >= 0 || events.some(function (event) { return event.request_id === id; })) return flush();
    events.push({ request_id: id, event_at_ms: Date.now(), path: entryPoint === 'planner' ? 'planner' : 'enquiry', entry_point: entryPoint, attribution: firstTouch() });
    if (!write(queueKey, events)) return Promise.resolve();
    return flush();
  }
  firstTouch();
  window.FridayCallbackAnalytics = { track: track };
  window.addEventListener && window.addEventListener('online', flush);
  if (queue().length) flush();
})();
