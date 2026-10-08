/* Native Hexclave page views and clicks on the villa enquiry flow only. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.FridayNativePageAnalytics) return;

  var capture = { ready: false, app: null };
  window.FridayNativePageAnalytics = capture;

  fetch('/api/capabilities', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
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
      capture.app = app;
      capture.ready = true;
    })
    .catch(function () {
      // Analytics must never interrupt a public page.
    });
})();
