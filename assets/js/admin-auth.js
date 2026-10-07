/* Shared Friday team authentication for standalone admin pages. */
(function () {
  'use strict';
  var app = null, load = null, capabilities = null;
  function request(path, method, data) {
    var options = { method: method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (data !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(data); }
    return fetch(path, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (result) {
        if (!response.ok) throw Object.assign(new Error(result.error || 'Friday could not complete that request.'), { status: response.status });
        return result;
      });
    });
  }
  function installAuthorizedFetch() {
    if (fetch.__fridayAdminAuth) return;
    var original = fetch.bind(window);
    var wrapped = function (input, init) {
      var url;
      try { url = new URL(typeof input === 'string' ? input : input.url, location.href); } catch (error) { return original(input, init); }
      if (!app || url.origin !== location.origin) return original(input, init);
      return Promise.resolve(app.getAuthorizationHeader()).then(function (value) {
        if (!value) return original(input, init);
        var headers = new Headers(init && init.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) headers.set('Authorization', value);
        return original(input, Object.assign({}, init || {}, { headers: headers }));
      });
    };
    wrapped.__fridayAdminAuth = true;
    window.fetch = wrapped;
  }
  function login(email, password) {
    return request('/api/auth/login', 'POST', { email: email, password: password });
  }
  function logout() {
    if (app && typeof app.signOut === 'function') {
      return Promise.resolve(app.signOut()).catch(function () {}).then(function () {
        return request('/api/auth/logout', 'POST').catch(function () {});
      });
    }
    return request('/api/auth/logout', 'POST').catch(function () {});
  }
  function getStatus() {
    return request('/api/admin/status');
  }
  function init() {
    installAuthorizedFetch();
    return request('/api/capabilities').then(function (caps) {
      capabilities = caps || {};
      if (capabilities.authProvider === 'hexclave' && capabilities.hexclaveProjectId) {
        if (!load) load = import('https://esm.sh/@hexclave/js@1.0.125').then(function (mod) {
          app = new mod.HexclaveClientApp({ projectId: capabilities.hexclaveProjectId, tokenStore: 'cookie', devTool: false, urls: { default: { type: 'hosted' }, afterSignIn: '/admin.html', afterSignUp: '/admin.html', afterSignOut: '/admin.html' } });
          installAuthorizedFetch();
          return app.getUser({ includeRestricted: true });
        }).catch(function (e) {
          console.warn('[admin-auth] Hexclave client init error:', e);
          return null;
        });
        return load;
      }
      return null;
    }).then(function () {
      return request('/api/auth/me').catch(function () { return { user: null }; });
    }).then(function (result) {
      return { user: (result && result.user) || null, capabilities: capabilities };
    });
  }
  window.FridayAdmin = { init: init, request: request, login: login, logout: logout, getStatus: getStatus, get app() { return app; }, get capabilities() { return capabilities; } };
})();
