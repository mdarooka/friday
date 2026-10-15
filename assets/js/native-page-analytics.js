/* Native Hexclave page views and clicks on Friday's public pages.
   Loaded before friday-analytics.js so both share this analytics-enabled client. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.FridayNativePageAnalytics) return;

  var capture = { ready: false, app: null, client: null };
  window.FridayNativePageAnalytics = capture;

  capture.client = fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (response) {
      if (!response.ok) throw new Error('Friday analytics is unavailable.');
      return response.json();
    })
    .then(function (capabilities) {
      if (!capabilities.hexclaveProjectId) throw new Error('Friday analytics is not configured.');
      return import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
        return new mod.HexclaveClientApp({
          projectId: capabilities.hexclaveProjectId,
          tokenStore: 'cookie',
          devTool: false,
          automaticSideEffects: true,
          analytics: { enabled: true, replays: { enabled: false } },
        });
      });
    })
    .then(function (app) {
      var identified = app && typeof app.getUser === 'function' ? app.getUser({ or: 'anonymous' }) : Promise.resolve();
      return Promise.resolve(identified).then(function () {
        capture.app = app;
        capture.ready = true;
        return app;
      });
    })
    .catch(function (error) {
      // Analytics must never interrupt a public page. Later custom events may retry their own client.
      capture.client = null;
      throw error;
    });
})();
