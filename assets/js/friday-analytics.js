/* Shared sender for Friday's privacy-safe custom events. One Hexclave client per page, one first-touch attribution record,
   and one localStorage queue so an event that fails (offline, API down) is retried on the next page load or reconnect.
   Feature scripts (quote, guide, callback, trip, briefing analytics) build their event data and call FridayAnalytics.track. */
(function () {
  'use strict';
  if (window.FridayAnalytics) return;

  var attributionKey = 'friday.attribution.v1';
  var legacyAttributionKeys = ['friday.quote-attribution.v1', 'friday.guide-attribution.v1'];
  var queueKey = 'friday.analytics-events.v1';
  var sentKey = 'friday.analytics-events-sent.v1';
  var internalsKey = 'StackAuth--DO-NOT-USE-OR-YOU-WILL-BE-FIRED--StackAppInternals';
  var clientPromise = null;
  var flushPromise = Promise.resolve();

  function read(key, fallback) {
    try { var value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function search() { try { return new URLSearchParams(location.search || ''); } catch (_) { return new URLSearchParams(''); } }
  function pathname() { try { return String(location.pathname || '/').slice(0, 200); } catch (_) { return '/'; } }
  function safeTag(value) {
    if (typeof value !== 'string') return null;
    value = value.trim();
    return value && value.length <= 100 && /^[A-Za-z0-9._-]+$/.test(value) ? value : null;
  }
  /* Only the referring hostname is kept, never its path or query string. */
  function referrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname.toLowerCase().slice(0, 200) || null : null; } catch (_) { return null; }
  }
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }
  function currentTags() {
    var params = search();
    return { utm_source: safeTag(params.get('utm_source')), utm_medium: safeTag(params.get('utm_medium')), utm_campaign: safeTag(params.get('utm_campaign')) };
  }
  /* The first visit's source, saved once and never replaced. Older per-feature records are adopted so returning visitors keep their source. */
  function firstTouch() {
    var saved = read(attributionKey, null);
    if (saved && typeof saved === 'object') return saved;
    var value = null;
    for (var i = 0; i < legacyAttributionKeys.length && !value; i++) {
      var old = read(legacyAttributionKeys[i], null);
      if (old && typeof old === 'object') value = { source: old.source || 'direct', medium: old.medium || null, campaign: old.campaign || null, referrer: old.referrer || old.referrer_host || null, landing_path: old.landing_path || null };
    }
    if (!value) {
      var tags = currentTags(), referrer = referrerHost();
      value = { source: tags.utm_source || referrer || 'direct', medium: tags.utm_medium, campaign: tags.utm_campaign, referrer: referrer, landing_path: pathname() };
    }
    write(attributionKey, value);
    return value;
  }

  function client() {
    if (!clientPromise) {
      clientPromise = fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
        if (!response.ok) throw new Error('Friday analytics is unavailable.');
        return response.json();
      }).then(function (capabilities) {
        if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
        return import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
          return new mod.HexclaveClientApp({ projectId: capabilities.hexclaveProjectId, tokenStore: 'cookie', devTool: false, automaticSideEffects: false, analytics: { enabled: false, replays: { enabled: false } } });
        });
      }).then(async function (app) {
        await app.getUser({ or: 'anonymous' });
        return app;
      }).catch(function (error) { clientPromise = null; throw error; });
    }
    return clientPromise;
  }
  async function send(event) {
    var app = await client();
    var internals = app[Symbol.for(internalsKey)];
    if (!internals || typeof internals.sendAnalyticsEventBatch !== 'function') throw new Error('Hexclave custom event sending is unavailable.');
    var payload = { session_replay_segment_id: uuid(), batch_id: uuid(), sent_at_ms: Date.now(), events: [{ event_type: event.name, event_at_ms: event.at, data: event.data }] };
    var result = await internals.sendAnalyticsEventBatch(JSON.stringify(payload), { keepalive: true });
    if (!result || result.status !== 'ok' || !result.data || !result.data.ok) throw new Error('Hexclave did not accept the ' + event.name + ' event.');
  }

  function queued() { var value = read(queueKey, []); return Array.isArray(value) ? value : []; }
  function sent() { var value = read(sentKey, []); return Array.isArray(value) ? value : []; }
  /* Sends queued events in order and stops at the first failure; the rest wait for the next flush. */
  function flush() {
    flushPromise = flushPromise.then(async function () {
      var events = queued(), delivered = sent();
      while (events.length) {
        var event = events[0];
        if (delivered.indexOf(event.id) === -1) {
          try { await send(event); } catch (_) { break; }
          delivered = delivered.concat(event.id).slice(-500);
          write(sentKey, delivered);
        }
        events.shift();
        write(queueKey, events);
      }
    }).catch(function () {});
    return flushPromise;
  }
  /* Queues one event. `id` (optional) makes it idempotent: the same name and id are sent at most once per browser. */
  function track(name, data, id) {
    var key = name + ':' + (typeof id === 'string' && id && id.length <= 160 ? id : uuid());
    var event = { id: key, name: name, at: Date.now(), data: data || {} };
    var events = queued();
    if (sent().indexOf(key) !== -1 || events.some(function (item) { return item.id === key; })) return flush();
    events.push(event);
    // Without storage (private mode, blocked site data) the event is still sent once, just not retried.
    if (!write(queueKey, events)) return send(event).catch(function () {});
    return flush();
  }

  window.FridayAnalytics = { track: track, flush: flush, firstTouch: firstTouch, currentTags: currentTags, referrerHost: referrerHost, pathname: pathname, uuid: uuid };
  try { firstTouch(); } catch (_) {}
  if (window.addEventListener) window.addEventListener('online', flush);
  if (queued().length) flush();
})();
