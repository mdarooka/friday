/*
 * trip-chatgpt.js — "Sign in with ChatGPT": plan trips with the visitor's own ChatGPT plan.
 *
 * OAuth 2.0 Authorization Code + PKCE (public client, no secret) with OpenID Connect, run entirely in this browser.
 * The page then calls https://api.openai.com/v1/responses with the visitor's bearer token.
 *
 * WHY THE TOKENS NEVER LEAVE THE BROWSER: OpenAI's Sign in with ChatGPT terms allow plan usage only for the signed-in
 * user's own requests, from a runtime that user controls, with access and refresh tokens stored locally under the
 * user's control, not on a server or any shared/managed environment. So the tokens live in this browser's
 * localStorage only. Do NOT send them to Friday's server, log them, put them in a URL, or add them to any record or
 * draft that is synced. The server only supplies the prompt and later validates the model's draft (see requestPlan in
 * trip-chat.js); it never sees a credential. This must not become general-purpose API access: it serves this app's
 * own AI features, for the signed-in person, and nothing else.
 *
 * One module for both sides: in the browser a classic script that adds FridayTrip.chatgpt; in Node (tests)
 * `require('./trip-chatgpt.js')` gives the same API, so the pure helpers can be unit-tested.
 *
 *   chatgpt.enabled()            capabilities.chatgpt.enabled (a client id is configured on the server)
 *   chatgpt.connect()            popup (or redirect) sign-in -> Promise<account>
 *   chatgpt.disconnect()         forget the tokens
 *   chatgpt.connected()          tokens present
 *   chatgpt.account()            { email, name } for display only, or null
 *   chatgpt.generate(bundle)     { instructions, input, schema, model } -> parsed JSON; throws ChatGPTError
 *   chatgpt.onChange(fn)         called after connect / disconnect
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    var FT = root.FridayTrip = root.FridayTrip || {};
    FT.chatgpt = api;
    api._boot();
  }
})(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  var STORE_KEY = 'friday.chatgpt.v1';          // the only place tokens are kept
  var PENDING_KEY = 'friday.chatgpt.pending';   // sessionStorage: redirect-flow state (no tokens)
  var CALLBACK_KEY = 'friday.chatgpt.callback'; // sessionStorage: code handed over by chatgpt-callback.html
  var MSG_TYPE = 'friday-chatgpt-callback';
  var RESPONSES_URL = 'https://api.openai.com/v1/responses';
  var TIMEOUT_MS = 45000;

  /* ------------------------------------------------------------ errors */
  function ChatGPTError(code, message, status) {
    var e = new Error(message || code);
    e.name = 'ChatGPTError'; e.code = code; if (status) e.status = status;
    return e;
  }

  /* ------------------------------------------------------------ pure helpers */
  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function randomToken(bytes) {
    var a = new Uint8Array(bytes || 32);
    root.crypto.getRandomValues(a);
    return b64url(a);
  }
  /* PKCE S256: base64url(SHA-256(ascii(verifier))) */
  function pkceChallenge(verifier) {
    var data = new Uint8Array(String(verifier).length);
    for (var i = 0; i < data.length; i++) data[i] = String(verifier).charCodeAt(i) & 255;
    return root.crypto.subtle.digest('SHA-256', data).then(function (d) { return b64url(new Uint8Array(d)); });
  }
  function buildAuthorizeUrl(o) {
    var q = [
      ['response_type', 'code'], ['client_id', o.clientId], ['redirect_uri', o.redirectUri], ['scope', o.scopes],
      ['state', o.state], ['nonce', o.nonce], ['code_challenge', o.challenge], ['code_challenge_method', 'S256']
    ].map(function (kv) { return encodeURIComponent(kv[0]) + '=' + encodeURIComponent(kv[1]); }).join('&');
    return o.endpoint + (o.endpoint.indexOf('?') < 0 ? '?' : '&') + q;
  }
  /* The returned state must equal the one we generated (CSRF defence). Constant shape, string compare. */
  function checkState(expected, got) {
    if (typeof expected !== 'string' || !expected || typeof got !== 'string' || expected.length !== got.length) return false;
    var diff = 0;
    for (var i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
    return diff === 0;
  }
  function parseCallback(search) {
    var out = {}, s = String(search || '').replace(/^[?#]/, '');
    s.split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('='), k = decodeURIComponent(i < 0 ? p : p.slice(0, i)), v = i < 0 ? '' : decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
      out[k] = v;
    });
    return out;
  }
  /* Display only (name, email, nonce echo). The signature is NOT verified here and nothing trusts this on the client. */
  function decodeIdToken(jwt) {
    try {
      var part = String(jwt).split('.')[1];
      var json = new TextDecoder().decode(b64urlDecode(part));
      return JSON.parse(json) || null;
    } catch (e) { return null; }
  }
  function formBody(obj) {
    return Object.keys(obj).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]); }).join('&');
  }
  /* Text of a Responses API result: output_text if present, else the first output_text part of a message. */
  function extractOutput(json) {
    if (!json) return { text: '' };
    if (typeof json.output_text === 'string' && json.output_text) return { text: json.output_text };
    var items = Array.isArray(json.output) ? json.output : [];
    for (var i = 0; i < items.length; i++) {
      var parts = items[i] && Array.isArray(items[i].content) ? items[i].content : [];
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].type === 'refusal') return { refusal: String(parts[j].refusal || 'declined') };
        if (parts[j].type === 'output_text' && typeof parts[j].text === 'string') return { text: parts[j].text };
      }
    }
    return { text: '' };
  }
  function responsesBody(bundle) {
    return {
      model: bundle.model, instructions: bundle.instructions, input: bundle.input, store: false,
      text: { format: { type: 'json_schema', name: 'itinerary', strict: true, schema: bundle.schema } }
    };
  }

  /* ------------------------------------------------------------ storage (every access guarded) */
  function lsGet(store, key) { try { var v = root[store] && root[store].getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(store, key, val) { try { root[store].setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function lsDel(store, key) { try { root[store].removeItem(key); } catch (e) { /* ignore */ } }
  function tokens() { return lsGet('localStorage', STORE_KEY); }

  var listeners = [];
  function changed() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  /* ------------------------------------------------------------ config + discovery */
  function config() {
    var b = root.FridayTrip && root.FridayTrip.backend;
    var c = b && b.capabilities && b.capabilities.chatgpt;
    return c && c.enabled && c.clientId ? c : null;
  }
  function fetchJson(url, opts, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || TIMEOUT_MS);
    var o = Object.assign({}, opts || {}); if (ctl) o.signal = ctl.signal;
    return root.fetch(url, o).then(function (r) { clearTimeout(t); return r; }, function (e) {
      clearTimeout(t);
      throw ChatGPTError(e && e.name === 'AbortError' ? 'timeout' : 'network', e && e.name === 'AbortError' ? 'Timed out' : 'Network error');
    });
  }
  function discover(issuer) {
    var fallback = { authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/oauth/token' };
    return fetchJson(issuer + '/.well-known/openid-configuration', { headers: { Accept: 'application/json' } }, 8000)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        return j && j.authorization_endpoint && j.token_endpoint
          ? { authorization_endpoint: j.authorization_endpoint, token_endpoint: j.token_endpoint } : fallback;
      }, function () { return fallback; });
  }

  /* ------------------------------------------------------------ token exchange / refresh */
  function tokenRequest(endpoint, params) {
    return fetchJson(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: formBody(params)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.access_token) throw ChatGPTError('auth', (j && (j.error_description || j.error)) || 'Sign-in failed', r.status);
        return j;
      });
    });
  }
  function saveTokens(j, prev, ep, cfg, nonce) {
    var claims = j.id_token ? decodeIdToken(j.id_token) : null;
    if (nonce && claims && claims.nonce && claims.nonce !== nonce) throw ChatGPTError('auth', 'Sign-in response did not match this request');
    var p = prev || {};
    var rec = {
      access: j.access_token,
      refresh: j.refresh_token || p.refresh || '',
      expiresAt: Date.now() + (Number(j.expires_in) > 0 ? Number(j.expires_in) : 3600) * 1000,
      email: (claims && claims.email) || p.email || '',
      name: (claims && claims.name) || p.name || '',
      clientId: cfg.clientId, tokenEndpoint: ep
    };
    if (!lsSet('localStorage', STORE_KEY, rec)) throw ChatGPTError('storage', 'This browser would not keep the sign-in');
    return rec;
  }
  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    var t = tokens();
    if (!t || !t.refresh || !t.tokenEndpoint) return Promise.reject(ChatGPTError('auth', 'Please connect ChatGPT again'));
    refreshing = tokenRequest(t.tokenEndpoint, { grant_type: 'refresh_token', refresh_token: t.refresh, client_id: t.clientId })
      .then(function (j) { return saveTokens(j, t, t.tokenEndpoint, { clientId: t.clientId }); })
      .catch(function (e) { if (e && e.code === 'auth') { lsDel('localStorage', STORE_KEY); changed(); } throw e; })
      .then(function (v) { refreshing = null; return v; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  /* ------------------------------------------------------------ connect */
  function finish(pending, cb) {
    if (cb.error) throw ChatGPTError(cb.error === 'access_denied' ? 'cancelled' : 'auth', cb.error_description || cb.error);
    if (!checkState(pending.state, cb.state)) throw ChatGPTError('auth', 'Sign-in response did not match this request');
    if (!cb.code) throw ChatGPTError('auth', 'No authorization code returned');
    return tokenRequest(pending.tokenEndpoint, {
      grant_type: 'authorization_code', code: cb.code, redirect_uri: pending.redirectUri,
      client_id: pending.clientId, code_verifier: pending.verifier
    }).then(function (j) {
      var rec = saveTokens(j, null, pending.tokenEndpoint, pending, pending.nonce);
      changed();
      return { email: rec.email, name: rec.name };
    });
  }
  function connect() {
    var cfg = config();
    if (!cfg) return Promise.reject(ChatGPTError('disabled', 'ChatGPT sign-in is not set up'));
    var verifier = randomToken(48), state = randomToken(24), nonce = randomToken(24);
    return Promise.all([discover(cfg.issuer), pkceChallenge(verifier)]).then(function (r) {
      var ep = r[0];
      var pending = {
        verifier: verifier, state: state, nonce: nonce, clientId: cfg.clientId, redirectUri: cfg.redirectUri,
        tokenEndpoint: ep.token_endpoint
      };
      var url = buildAuthorizeUrl({
        endpoint: ep.authorization_endpoint, clientId: cfg.clientId, redirectUri: cfg.redirectUri, scopes: cfg.scopes,
        state: state, nonce: nonce, challenge: r[1]
      });
      var popup = null;
      try { popup = root.open(url, 'friday-chatgpt', 'popup,width=520,height=720'); } catch (e) { popup = null; }
      if (!popup) {   // blocked: full-page redirect; resume() completes it when we come back
        lsSet('sessionStorage', PENDING_KEY, pending);
        root.location.assign(url);
        return new Promise(function () { /* the page is leaving */ });
      }
      return new Promise(function (resolve, reject) {
        var done = false, timer, poll;
        var end = function (fn, v) {
          if (done) return; done = true;
          root.removeEventListener('message', onMsg); clearInterval(poll); clearTimeout(timer);
          try { popup.close(); } catch (e) { /* ignore */ }
          fn(v);
        };
        function onData(d) {
          if (!d || d.type !== MSG_TYPE || done) return;
          Promise.resolve().then(function () { return finish(pending, d); }).then(function (a) { end(resolve, a); }, function (e) { end(reject, e); });
        }
        function onMsg(ev) { if (ev.origin === root.location.origin && ev.source === popup) onData(ev.data); }
        function onBc(ev) { onData(ev.data); }   // the sign-in site may have severed window.opener; state is still checked
        var bc = null;
        try { bc = new root.BroadcastChannel('friday-chatgpt'); bc.onmessage = onBc; } catch (e) { bc = null; }
        var endAll = end;
        end = function (fn, v) { if (bc) { try { bc.close(); } catch (e) { /* ignore */ } } endAll(fn, v); };
        poll = setInterval(function () { if (popup.closed) setTimeout(function () { end(reject, ChatGPTError('cancelled', 'Sign-in window closed')); }, 600); }, 700);
        timer = setTimeout(function () { end(reject, ChatGPTError('timeout', 'Sign-in timed out')); }, 5 * 60 * 1000);
      });
    });
  }
  /* The redirect fallback: chatgpt-callback.html left the code in sessionStorage. */
  function resume() {
    var cb = lsGet('sessionStorage', CALLBACK_KEY), pending = lsGet('sessionStorage', PENDING_KEY);
    if (!cb) return Promise.resolve(null);
    lsDel('sessionStorage', CALLBACK_KEY); lsDel('sessionStorage', PENDING_KEY);
    if (!pending) return Promise.resolve(null);
    return Promise.resolve().then(function () { return finish(pending, cb); }).catch(function () { return null; });
  }
  function disconnect() { lsDel('localStorage', STORE_KEY); changed(); }

  /* ------------------------------------------------------------ the model call */
  function callOnce(bundle, access) {
    return fetchJson(RESPONSES_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access },
      body: JSON.stringify(responsesBody(bundle))
    }, TIMEOUT_MS);
  }
  function generate(bundle) {
    if (!bundle || !bundle.instructions || !bundle.input || !bundle.schema) return Promise.reject(ChatGPTError('bad_request', 'Missing prompt'));
    var t = tokens();
    if (!t || !t.access) return Promise.reject(ChatGPTError('not_connected', 'ChatGPT is not connected'));
    var ready = t.expiresAt && t.expiresAt - Date.now() < 60000 && t.refresh ? refresh() : Promise.resolve(t);
    return ready.then(function (cur) {
      return callOnce(bundle, cur.access).then(function (r) {
        if (r.status !== 401) return r;
        return refresh().then(function (n) { return callOnce(bundle, n.access); });   // refresh once on 401
      });
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw ChatGPTError('auth', 'ChatGPT rejected the sign-in', r.status);
      if (!r.ok) throw ChatGPTError('http', 'ChatGPT returned HTTP ' + r.status, r.status);
      return r.json().catch(function () { throw ChatGPTError('bad_json', 'Unreadable response'); });
    }).then(function (json) {
      var out = extractOutput(json);
      if (out.refusal) throw ChatGPTError('refused', 'The model declined the request');
      try { return JSON.parse(out.text); } catch (e) { throw ChatGPTError('bad_json', 'The reply was not valid JSON'); }
    });
  }

  function _boot() {
    if (typeof document === 'undefined') return;
    var go = function () { resume().then(function (a) { if (a) changed(); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  return {
    enabled: function () { return !!config(); },
    connected: function () { var t = tokens(); return !!(t && t.access); },
    account: function () { var t = tokens(); return t && t.access ? { email: t.email || '', name: t.name || '' } : null; },
    connect: connect, disconnect: disconnect, generate: generate, resume: resume,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    ChatGPTError: ChatGPTError, MSG_TYPE: MSG_TYPE, CALLBACK_KEY: CALLBACK_KEY,
    // pure helpers, exported for tests
    b64url: b64url, pkceChallenge: pkceChallenge, buildAuthorizeUrl: buildAuthorizeUrl, checkState: checkState,
    parseCallback: parseCallback, decodeIdToken: decodeIdToken, extractOutput: extractOutput, responsesBody: responsesBody,
    _boot: _boot
  };
});
