/* ==========================================================================
   Friday planner: Chat
   The conversation engine and every in-thread block.
   Contract: FridayTrip.chat = { mount(el), render(trip), send({text, attachments}),
                                 stop(), busy, newThread() }
   Messages are plain JSON on trip.threads[n].messages. Streaming mutates the
   live message objects and re-renders per block; nothing is re-streamed on load.
   ========================================================================== */
(function () {
  'use strict';
  var FT = (window.FridayTrip = window.FridayTrip || {});

  /* ------------------------------------------------------------ helpers */
  var STOP = { stop: true };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON3 = MONTHS.map(function (m) { return m.slice(0, 3); });
  var NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one'];
  /* trip.prefs.month = {y, m}; m is stored 0-based (Date style). */
  var MB = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function U() { return FT.util || {}; }
  function uid(p) {
    p = p || 'x_';
    if (U().uid) { try { return U().uid(p); } catch (e) { /* fall through */ } }
    return p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toIso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function parseIso(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoOf(dt) { return toIso(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
  function addDays(iso, n) { var d = parseIso(iso); d.setDate(d.getDate() + n); return isoOf(d); }
  function todayIso() { try { if (U().today) return U().today(); } catch (e) { /* ignore */ } return isoOf(new Date()); }
  function fmtRange(a, b) {
    if (U().fmtRange) { try { return U().fmtRange(a, b); } catch (e) { /* fall through */ } }
    var A = parseIso(a), B = parseIso(b);
    var s = MON3[A.getMonth()] + ' ' + A.getDate();
    if (A.getFullYear() === B.getFullYear() && A.getMonth() === B.getMonth()) return s + ' – ' + B.getDate() + ', ' + B.getFullYear();
    return s + (A.getFullYear() !== B.getFullYear() ? ', ' + A.getFullYear() : '') + ' – ' + MON3[B.getMonth()] + ' ' + B.getDate() + ', ' + B.getFullYear();
  }
  function fmtStayDays(a, b) {
    if (a !== b) return fmtRange(a, b);
    var day = parseIso(a);
    return MON3[day.getMonth()] + ' ' + day.getDate() + ', ' + day.getFullYear();
  }
  function money(n, sym) {
    var v = Number(n) || 0;
    var loc = sym === '₹' ? 'en-IN' : 'en-US';
    return (sym || '') + v.toLocaleString(loc);
  }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function fill(s, c) { return String(s == null ? '' : s).replace(/\{(\w+)\}/g, function (m, k) { return c[k] != null ? c[k] : ''; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lcfirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function toast(t) { try { if (FT.ui && FT.ui.toast) FT.ui.toast(t); } catch (e) { /* ignore */ } }
  function emit(evt, payload) { try { if (FT.store && FT.store.emit) FT.store.emit(evt, payload); } catch (e) { console.error(e); } }

  var ICONS = {
    sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    'thumb-up': '<path d="M7 10.5v9H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M7 10.5l3.6-6.2a1.6 1.6 0 0 1 3 .9l-.6 3.3h5a1.8 1.8 0 0 1 1.8 2.2l-1.3 6.1a2 2 0 0 1-2 1.7H7"/>',
    'thumb-down': '<path d="M7 13.5v-9H4.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1z"/><path d="M7 13.5l3.6 6.2a1.6 1.6 0 0 0 3-.9l-.6-3.3h5a1.8 1.8 0 0 0 1.8-2.2l-1.3-6.1a2 2 0 0 0-2-1.7H7"/>',
    'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
    'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
    'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
    'chevron-up': '<path d="M6 14.5l6-6 6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>'
  };
  function icon(name, size) {
    size = size || 16;
    if (U().icon) { try { var s = U().icon(name, size); if (s) return s; } catch (e) { /* fall through */ } }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function mdLocal(t) {
    var s = esc(t);
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|#|\/|[\w.\-]+\.html)[^)\s]*)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    return s.split(/\n{2,}/).map(function (para) {
      var lines = para.split('\n');
      if (lines.every(function (l) { return /^\s*- /.test(l); })) {
        return '<ul>' + lines.map(function (l) { return '<li>' + l.replace(/^\s*- /, '') + '</li>'; }).join('') + '</ul>';
      }
      return '<p>' + lines.join('<br>') + '</p>';
    }).join('');
  }
  function md(t) {
    if (U().md) { try { return U().md(String(t == null ? '' : t)); } catch (e) { /* fall through */ } }
    return mdLocal(t);
  }

  /* ------------------------------------------------------------ data access */
  function DEST(id) {
    if (!id) return null;
    try { if (FT.dest) { var d = FT.dest(id); if (d) return d; } } catch (e) { /* ignore */ }
    return (FT.DESTINATIONS && FT.DESTINATIONS[id]) || null;
  }
  function order() { return FT.ORDER || Object.keys(FT.DESTINATIONS || {}); }
  function P(d, id) { return d && d.places && d.places[id] ? d.places[id] : null; }
  function areaOf(d, id) { var a = (d.areas || []).filter(function (x) { return x.id === id; })[0]; return a || null; }
  /* the name a person would say for an area: its town, else its name */
  function areaLabel(d, id) { var a = areaOf(d, id); return a ? (a.town || a.name || '') : ''; }
  function dist(a, b) { if (!a || !b) return 1e9; var dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }

  /* ------------------------------------------------------------ store access */
  function getTrip(id) { try { return FT.store.trip(id); } catch (e) { return null; } }
  function threadById(trip, id) { return (trip.threads || []).filter(function (t) { return t.id === id; })[0] || null; }
  function activeThread(trip) {
    if (!trip) return null;
    return threadById(trip, trip.activeThreadId) || (trip.threads && trip.threads[0]) || null;
  }
  function persist(tripId, touchIt) {
    try {
      FT.store.update(function (s) {
        var t = (s.trips || []).filter(function (x) { return x.id === tripId; })[0];
        if (t) { t.threads = t.threads; if (touchIt) t.updatedAt = new Date().toISOString(); }
      });
    } catch (e) { console.error('chat persist', e); }
  }
  function ensureThread(tripId) {
    var t = getTrip(tripId); if (!t) return null;
    var th = activeThread(t);
    if (th) return th;
    FT.store.update(function (s) {
      var tt = s.trips.filter(function (x) { return x.id === tripId; })[0];
      if (!tt) return;
      var n = { id: uid('th_'), title: 'New conversation', createdAt: new Date().toISOString(), messages: [] };
      tt.threads = tt.threads || [];
      tt.threads.push(n); tt.activeThreadId = n.id;
    });
    return activeThread(getTrip(tripId));
  }

  /* ------------------------------------------------------------ module state */
  var chat = { busy: false, speed: 1 };
  var root = null, mountedKey = null, cur = null, stick = true, normalizedKeys = {};
  var bound = null, syncing = 0;

  function setBusy(v) {
    v = !!v;
    if (chat.busy === v) return;
    chat.busy = v;
    emit('chat:busy', { busy: v });
  }
  function speed() { return (chat.speed || 1) * (reduced() ? 4 : 1); }

  /* ------------------------------------------------------------ message model */
  function newMsg(role, extra) {
    return Object.assign({ id: uid('m_'), role: role, at: new Date().toISOString() }, extra || {});
  }
  function auditContent(msg) {
    if (!msg) return null;
    if (msg.role === 'user') return { text: String(msg.text || ''), attachments: (msg.attachments || []).map(function (a) { return { name: String(a.name || 'image') }; }) };
    return { text: msgPlain(msg), blocks: msg.blocks || [], waiting: !!msg.waiting, stopped: !!msg.stopped, done: !!msg.done };
  }
  var auditQueues = Object.create(null);
  function reliableAudit(event) {
    if (!event.ownerId) event.ownerId = FT.backend && FT.backend.auditOwnerId;
    if (!FT.backend || !FT.backend.logConversation) return Promise.reject(new Error('Conversation review storage is unavailable.'));
    var key=[event.ownerId,event.conversationId,event.eventId].join('/'),prior=auditQueues[key]||Promise.resolve();
    var next=prior.catch(function(){}).then(function(){
      var attempt=function(left){return FT.backend.logConversation(event).catch(function(error){if(left<=1)throw error;return new Promise(function(resolve){setTimeout(resolve,250);}).then(function(){return attempt(left-1);});});};
      return attempt(3);
    });
    auditQueues[key]=next;
    return next.finally(function(){if(auditQueues[key]===next)delete auditQueues[key];});
  }
  function auditMessage(tripId, threadId, msg, status, eventType, ownerId) {
    return reliableAudit({ conversationId: threadId, eventId: msg.id, tripId: tripId, eventType: eventType || 'chat_message', role: msg.role, content: auditContent(msg), status: status || 'completed', ownerId:ownerId });
  }
  function auditStandalone(tripId, threadId, messageId, role, content, status, eventType, ownerId) {
    return reliableAudit({ conversationId: threadId, eventId: messageId, tripId: tripId, eventType: eventType || 'chat_message', role: role, content: content, status: status || 'completed', ownerId:ownerId });
  }
  function touch(b) { b.rev = (b.rev || 0) + 1; }
  function findMsgIn(th, id) {
    if (!th) return null;
    for (var i = th.messages.length - 1; i >= 0; i--) if (th.messages[i].id === id) return th.messages[i];
    return null;
  }
  function M(turn) {
    var t = getTrip(turn.tripId); if (!t) return null;
    return findMsgIn(threadById(t, turn.threadId), turn.msgId);
  }
  function mountedCtx() {
    if (!mountedKey) return null;
    var p = mountedKey.split('/');
    var trip = getTrip(p[0]); if (!trip) return null;
    var th = threadById(trip, p[1]); if (!th) return null;
    return { trip: trip, th: th };
  }

  /* ------------------------------------------------------------ turn plumbing */
  function wait(turn, ms) {
    return new Promise(function (res) {
      if (turn.stopped) return res();
      var t = setTimeout(function () { turn.wake = null; res(); }, Math.max(0, ms / speed()));
      turn.wake = function () { clearTimeout(t); turn.wake = null; res(); };
    });
  }
  function tick(turn, ms) {
    return wait(turn, ms).then(function () { if (turn.stopped) throw STOP; });
  }
  function sync(turn) {
    if (!root || !mountedKey) return;
    if (mountedKey !== turn.tripId + '/' + turn.threadId) return;
    var msg = M(turn); if (!msg) return;
    var col = root.querySelector('.ch-col'); if (!col) return;
    var el = col.querySelector('[data-mid="' + msg.id + '"]');
    if (!el) { var ctx = mountedCtx(); if (ctx) syncThread(ctx.trip, ctx.th); }
    else syncMessage(el, msg);
    scrollEnd();
  }
  function addBlock(turn, b) {
    var msg = M(turn); if (!msg) throw STOP;
    b.id = b.id || uid('b_');
    b.rev = 1;
    msg.blocks.push(b);
    msg.thinking = false;
    sync(turn);
    return b;
  }
  function setThinking(turn, v) {
    var msg = M(turn); if (!msg) return;
    msg.thinking = !!v; sync(turn);
  }
  function save(turn) { persist(turn.tripId); }

  /* prose, streamed word by word */
  function say(turn, text) {
    var b = addBlock(turn, { t: 'text', text: '' });
    var words = String(text).match(/\S+\s*/g) || [];
    var i = 0;
    return (function step() {
      if (turn.stopped) throw STOP;
      if (i >= words.length) { save(turn); return Promise.resolve(); }
      b.text += words[i++]; touch(b); sync(turn);
      return wait(turn, 18).then(step);
    })();
  }
  function tool(turn, text, detail, gap) {
    addBlock(turn, { t: 'tool', text: text, detail: detail || null, open: false });
    save(turn);
    return tick(turn, gap == null ? 250 + Math.random() * 350 : gap);
  }
  function suggest(turn, items) {
    items = (items || []).filter(Boolean);
    if (!items.length) return;
    addBlock(turn, { t: 'suggest', items: items });
    save(turn);
  }
  function reply(turn, text, chips) {
    return tick(turn, 500).then(function () { return say(turn, text); }).then(function () { suggest(turn, chips); });
  }

  /* ------------------------------------------------------------ plan building */
  function mkItem(place, note) { return { id: uid('i_'), place: place, note: note || '' }; }
  function usedSet(plan) {
    var s = {};
    (plan.days || []).forEach(function (d) { d.items.forEach(function (i) { s[i.place] = 1; }); });
    return s;
  }
  function isStay(d, id) { var p = P(d, id); return !!p && p.kind === 'stay'; }
  /* High-altitude destinations carry an `acclimatisation` rule in their data; the generator applies it. */
  function hasAcclim(d) { return !!d.acclimatisation; }
  function firstSlot(day) { return day.items[0] && !day.items[0].place ? 1 : 0; }   /* keep a leading flight first */
  function typeOptions(d) {
    var to = d.clarify && d.clarify.types && d.clarify.types.options || [];
    return to.map(function (o) { return typeof o === 'string' ? o : o && o.label; }).filter(Boolean);
  }
  /* The offline planner: the shared generator (assets/js/trip-generator.js), run right here. The server
     runs the same code behind /api/itineraries; see requestPlan. */
  function buildPlan(d, o) {
    if (!FT.generate) return { days: [], stay: null };
    return FT.generate(d, {
      types: o.types, days: o.days, dates: o.dates, pace: o.pace || 'normal', base: o.base,
      stay: o.deep ? undefined : false, travel: o.travel, uid: uid
    });
  }

  /* ---- the backend, when there is one ----
     Served over http(s) with /api/health answering, the plan comes from POST /api/itineraries (its
     configured provider, saved server-side). On file://, with no server, or on any failure, the plan
     is built locally above. Never rejects. */
  var backendUp = null;
  function backendAvailable() {
    if (backendUp) return backendUp;
    var ok = typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
    backendUp = ok ? withTimeout(function (signal) { return fetch('api/health', { cache: 'no-store', signal: signal }); }, 2500)
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return !!(j && j.ok); }).catch(function () { return false; })
      : Promise.resolve(false);
    return backendUp;
  }
  function withTimeout(make, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    var p;
    try { p = make(ctl && ctl.signal); } catch (e) { clearTimeout(t); return Promise.reject(e); }
    return p.then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }
  /* the server's plan, with fresh client ids, unknown places dropped, and the flight put back on top */
  function adoptPlan(d, remote, o) {
    if (!remote || !Array.isArray(remote.days) || !remote.days.length) return null;
    var days = remote.days.map(function (day) {
      var items = (day.items || []).filter(function (it) { return it && P(d, it.place); })
        .map(function (it) { return mkItem(it.place, it.note); });
      return { id: uid('d_'), area: day.area, town: day.town || areaLabel(d, day.area), date: day.date || null, items: items };
    });
    if (days.some(function (x) { return !x.items.length; })) return null;
    var stay = remote.stay && P(d, remote.stay) ? remote.stay : null;
    var plan = { days: days, stay: stay };
    if (o.travel) days[0].items.unshift(Object.assign({ id: uid('i_') }, o.travel));
    return plan;
  }
  function postJson(url, body) {
    return withTimeout(function (signal) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal });
    }, 45000).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function requestPlan(d, o, turn, trip) {
    var local = function () { return buildPlan(d, o); };
    return backendAvailable().then(function (up) {
      if (!up) return local();
      var body = { destination: d.id, types: o.types, days: clamp(Math.round(o.days || 4), 1, 21), pace: o.pace || 'normal', conversationId: turn && turn.threadId, tripId: trip && (trip.serverId || trip.id), messageId: turn && turn.msgId, ownerId:turn&&turn.ownerId };
      if (o.dates && o.dates.start) body.dates = { start: o.dates.start };
      if (o.base) body.base = o.base;
      return postJson('api/itineraries', body).then(function (j) { return adoptPlan(d, j && j.plan, o) || local(); });
    }).catch(function () { return local(); });
  }
  function countItems(plan) { return plan.days.reduce(function (n, d) { return n + d.items.length; }, 0); }

  function dayFor(plan, d, placeId, avoid) {
    var p = P(d, placeId); if (!p || !plan.days.length) return 0;
    var best = -1, bs = 1e12;
    plan.days.forEach(function (day, i) {
      if (avoid && avoid[i]) return;
      var a = areaOf(d, day.area);
      var s = (day.area === p.area ? 0 : 1e6 + dist(a && a.at, p.at) * 1e3) + day.items.length * 10 + i * 0.01;
      if (s < bs) { bs = s; best = i; }
    });
    if (best < 0) return dayFor(plan, d, placeId, null);
    return best;
  }
  function pickStay(d, baseLabel, plan) {
    if (!FT.generator) return null;
    return FT.generator.pickStay(d, baseLabel, { firstArea: plan && plan.days && plan.days[0] ? plan.days[0].area : null });
  }
  function stayEdit(d, plan0, dates, baseLabel) {
    var plan = clone(plan0), changes = 0;
    if (dates && dates.start) {
      plan.days.forEach(function (day, i) { var nd = addDays(dates.start, i); if (day.date !== nd) { day.date = nd; changes++; } });
    }
    plan.days.forEach(function (day) {
      var b = day.items.length;
      day.items = day.items.filter(function (it) { return !isStay(d, it.place); });
      changes += b - day.items.length;
    });
    var stay = pickStay(d, baseLabel, plan);
    if (stay && plan.days.length) {
      plan.stay = stay;
      plan.days[0].items.splice(firstSlot(plan.days[0]), 0, mkItem(stay, 'Check in and settle in'));
      changes++;
    }
    var used = usedSet(plan);
    var foods = ((d.extras && d.extras.food) || []).filter(function (id) { return P(d, id) && !used[id]; }).slice(0, 2);
    var added = [];
    var avoid = {};
    foods.forEach(function (fid) {
      var di = dayFor(plan, d, fid, avoid); avoid[di] = 1;
      var day = plan.days[di];
      day.items.splice(Math.min(2, day.items.length), 0, mkItem(fid, P(d, fid).blurb || ''));
      added.push({ id: fid, day: di }); changes++;
    });
    return { plan: plan, changes: changes, stay: stay, foods: added };
  }
  function relaxEdit(d, plan0) {
    var plan = clone(plan0), changes = 0;
    var drop = (d.extras && d.extras.relaxedDrop) || 1;
    plan.days.forEach(function (day) {
      for (var k = 0; k < drop && day.items.length > 2; k++) {
        var worst = -1, wr = 1e9;
        day.items.forEach(function (it, i) {
          if (!it.place || !P(d, it.place) || isStay(d, it.place) || it.place === plan.stay) return;
          var r = P(d, it.place).rating; r = r == null ? 4.5 : r;
          if (r < wr) { wr = r; worst = i; }
        });
        if (worst < 0) break;
        day.items.splice(worst, 1); changes++;
      }
    });
    return { plan: plan, changes: changes };
  }
  function nearStayOrder(d, plan, ids) {
    var sp = plan.stay && P(d, plan.stay);
    if (!sp) return ids.slice();
    return ids.slice().sort(function (a, b) { return dist(d.places[a].at, sp.at) - dist(d.places[b].at, sp.at); });
  }
  function foodEdit(d, plan0) {
    var plan = clone(plan0), used = usedSet(plan);
    var ids = ((d.extras && d.extras.food) || []).filter(function (id) { return P(d, id) && !used[id]; });
    ids = nearStayOrder(d, plan, ids).slice(0, 3);
    var avoid = {}, added = [];
    ids.forEach(function (id) {
      var di = dayFor(plan, d, id, avoid); avoid[di] = 1;
      var day = plan.days[di];
      day.items.splice(Math.min(2, day.items.length), 0, mkItem(id, P(d, id).blurb || ''));
      added.push(id);
    });
    return { plan: plan, added: added, changes: added.length };
  }
  function nightEdit(d, plan0) {
    var plan = clone(plan0), used = usedSet(plan);
    var ids = ((d.extras && d.extras.nightlife) || []).filter(function (id) { return P(d, id) && !used[id]; }).slice(0, 3);
    var avoid = {}, added = [];
    if (hasAcclim(d) && plan.days.length > 1) avoid[0] = 1;
    ids.forEach(function (id) {
      var di = dayFor(plan, d, id, avoid); avoid[di] = 1;
      plan.days[di].items.push(mkItem(id, P(d, id).blurb || ''));
      added.push(id);
    });
    return { plan: plan, added: added, changes: added.length };
  }
  function applyPlan(turn, plan, summary, changes) {
    try {
      if (FT.plan && FT.plan.apply) FT.plan.apply(turn.tripId, plan, { summary: summary, changes: changes });
      else FT.store.update(function (s) {
        var t = s.trips.filter(function (x) { return x.id === turn.tripId; })[0];
        if (t) { t.plan = plan; t.banner = { text: 'Friday updated your plan.', at: new Date().toISOString() }; t.activeTab = 'plan'; }
      });
    } catch (e) { console.error('plan.apply', e); }
    sync(turn);
  }

  /* ------------------------------------------------------------ memory & prefs */
  function addMemory(lines) {
    lines = (lines || []).filter(Boolean);
    if (!lines.length) return;
    try {
      FT.store.update(function (s) {
        s.memory = s.memory || [];
        lines.forEach(function (text) {
          if (!s.memory.some(function (m) { return m.text === text; })) s.memory.push({ id: uid('mem_'), at: new Date().toISOString(), text: text });
        });
      });
    } catch (e) { console.error(e); }
  }
  function setTripPrefs(tripId, patch) {
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === tripId; })[0];
      if (!t) return;
      t.prefs = Object.assign({ month: null, types: [], days: null, dates: null, base: null }, t.prefs || {}, patch);
    });
  }
  function adoptDest(tripId, destId) {
    var d = DEST(destId); if (!d) return;
    var was = null;
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === tripId; })[0];
      if (!t) return;
      was = t.destId;
      t.destId = destId;
      t.destName = d.name;
      if (!t.title || t.title === 'New trip') t.title = d.tripTitle || (d.name + ' trip');
      var th = activeThread(t);
      if (th && (!th.title || th.title === 'New conversation')) th.title = d.threadTitle || ('Plan ' + d.name + ' trip');
    });
    if (was !== destId) emit('map:fit');
  }
  /* A place Friday has no curated data for: the map still flies there, the plan stays honest. */
  function adoptPlace(tripId, name) {
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === tripId; })[0];
      if (!t) return;
      t.destName = name;
      if (!t.title || t.title === 'New trip') t.title = name + ' Trip';
      var th = activeThread(t);
      if (th && (!th.title || th.title === 'New conversation')) th.title = 'Plan ' + name + ' Trip';
    });
    emit('map:fit');
  }
  var PSTOP = /^(a|an|the|my|me|our|us|it|its|this|that|these|those|next|last|some|any|there|here|home|now|today|tomorrow|tonight|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|week|weeks|day|days|month|months|year|summer|winter|spring|autumn|fall|holiday|vacation|trip|plan|itinerary|hotel|hotels|restaurant|restaurants|food|beach|beaches|mountains|somewhere|anywhere|nowhere|two|three|four|five|six|seven|eight|nine|ten|one|less|more|relax|relaxed|slower|day\d*|i|we|you|friday)$/i;
  var PBREAK = /^(for|with|from|on|during|next|this|and|in|at|by|around|over|under|to|between|then|where|when|that|which|if|but|so|as|it|is|are|please|thanks|thank|days?|weeks?|nights?)$/i;
  function titleCase(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
  function takePhrase(str, strict) {
    var words = str.split(/\s+/), out = [];
    for (var i = 0; i < words.length && out.length < 3; i++) {
      var w = words[i].replace(/[.,!?;:()"]+$/g, '').replace(/^["(]+/, '');
      if (!w) break;
      var raw = w;
      if (!out.length && /^(visit|visiting|explore|exploring|see|go|going|travel|travelling|traveling)$/i.test(w)) continue;
      if (!/^[A-Za-z][\w'\u2019\-]*$/.test(w)) break;
      if (PBREAK.test(w) && out.length) break;
      if (PSTOP.test(w) || (PBREAK.test(w))) break;
      if (strict && !/^[A-Z]/.test(w)) break;
      out.push(/^[A-Z]/.test(raw) ? raw : titleCase(raw.toLowerCase()));
      if (/[.,!?;:]$/.test(words[i])) break;
    }
    return out.join(' ');
  }
  /* Pull a place name out of "plan a trip to Lisbon", "Tokyo for 5 days", "visit Bali in March". */
  function extractPlace(text, strict) {
    var t = String(text || '').trim(), m, re = /\b(?:to|in|visit|visiting|explore|exploring|around|at)\s+(\S+(?:\s+\S+){0,3})/gi;
    var travel = /\b(plan|trip|travel|visit|itinerary|holiday|vacation|going|go|weekend|days?|week|explore|getaway)\b/i.test(t);
    if (!travel) return null;
    while ((m = re.exec(t))) {
      var ph = takePhrase(m[1], strict);
      if (ph) return ph;
    }
    if (!strict && (m = /^([A-Z][A-Za-z'\u2019\-]+(?:\s+[A-Z][A-Za-z'\u2019\-]+){0,2})\s+(?:for|in)\s+(?:\d+|a|the|one|two|three|four|five|six|seven|next|this)\b/.exec(t))) {
      var ph2 = takePhrase(m[1], true);
      if (ph2) return ph2;
    }
    return null;
  }

  /* ------------------------------------------------------------ clarifier model */
  function monthLabelOf(v) { return v ? MONTHS[v.m - MB] + ' ' + v.y : 'Any time'; }
  function nextMonthTiles() {
    var now = parseIso(todayIso()), out = [{ label: 'Any', sub: '', val: null }];
    for (var i = 0; i < 8; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({ label: MON3[d.getMonth()], sub: String(d.getFullYear()), val: { y: d.getFullYear(), m: d.getMonth() + MB } });
    }
    return out;
  }
  function typeSlug(prefs, d) {
    var t = (prefs.types && prefs.types[0]) || '';
    if (!t) return 'travel';
    return prefs.types.length > 1 ? 'blended' : t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  }
  function planClarifier(d) {
    var c = d.clarify || {};
    var types = c.types || { q: 'How should we shape your time in ' + d.name + '?', options: typeOptions(d) };
    var dur = c.duration || { q: 'How many days would you like to dedicate to this journey?', options: [{ label: 'A considered weekend (3–4 days)', days: 4 }, { label: 'An unhurried week (~7 days)', days: 7 }, { label: 'A deeper immersion (~10–14 days)', days: 14 }] };
    return {
      t: 'clarify', kind: 'plan', qi: 0, submitted: false, superseded: false,
      qs: [
        { key: 'month', type: 'month', q: (c.month && c.month.q) || ('Which season or month would you prefer for ' + d.name + '?'), opts: nextMonthTiles(), draft: { sel: [], free: '' } },
        { key: 'types', type: 'multi', q: types.q, opts: types.options.map(function (o) { return { label: typeof o === 'string' ? o : o.label }; }), draft: { sel: [], free: '' } },
        { key: 'duration', type: 'single', q: dur.q, opts: dur.options.map(function (o) { return { label: o.label, days: o.days }; }), draft: { sel: [], free: '' } }
      ]
    };
  }
  function defaultStayMonth(prefs) {
    if (prefs && prefs.month) return { y: prefs.month.y, m: prefs.month.m - MB };
    var n = parseIso(todayIso()), d = new Date(n.getFullYear(), n.getMonth() + 1, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }
  function stayClarifier(d, prefs) {
    var c = d.clarify || {};
    var len = clamp(Math.min(prefs.days || 4, 14), 1, 14);
    var dq = 'Select your travel dates for ' + d.name + ' so I can place stay ideas alongside your route.';
    var base = c.base || { q: 'For this {type} journey, which sanctuary or quarter should anchor your stay?', options: [] };
    return {
      t: 'clarify', kind: 'stay', qi: 0, submitted: false, superseded: false, len: len,
      qs: [
        { key: 'dates', type: 'dates', q: dq, opts: [], len: len, draft: { free: '', range: { start: null, end: null }, view: defaultStayMonth(prefs) } },
        { key: 'base', type: 'single', q: fill(base.q, { type: typeSlug(prefs, d) }), opts: (base.options || []).map(function (o) { return { label: typeof o === 'string' ? o : o.label }; }), draft: { sel: [], free: '' } }
      ]
    };
  }

  /* free-text parsing */
  function parseMonthFree(t) {
    var s = String(t).toLowerCase();
    for (var i = 0; i < 12; i++) {
      if (new RegExp('\\b' + MON3[i].toLowerCase()).test(s)) {
        var ym = /\b(20\d\d)\b/.exec(s), now = parseIso(todayIso());
        var y = ym ? +ym[1] : (i >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1);
        return { y: y, m: i + MB };
      }
    }
    return null;
  }
  function parseDaysFree(t) {
    var s = String(t).toLowerCase(), m;
    if ((m = /(\d+)\s*(?:-|to)?\s*(\d+)?\s*(day|night)/.exec(s))) return clamp(+(m[2] || m[1]), 1, 21);
    if ((m = /(\d+)\s*week/.exec(s))) return clamp(+m[1] * 7, 1, 21);
    if (/fortnight/.test(s)) return 14;
    if (/weekend/.test(s)) return 4;
    if (/week/.test(s)) return 7;
    if ((m = /\b(\d{1,2})\b/.exec(s))) return clamp(+m[1], 1, 21);
    return 7;
  }
  function defaultRange(q, prefs) {
    var v = q.draft.view || defaultStayMonth(prefs);
    var t = parseIso(todayIso()); t.setDate(t.getDate() + 1);
    var cand = new Date(v.y, v.m, 10);
    if (cand < t) cand = t;
    while (cand.getDay() !== 5) cand.setDate(cand.getDate() + 1);
    var start = isoOf(cand);
    return { start: start, end: addDays(start, (q.len || 4) - 1) };
  }
  function parseDatesFree(txt, q, prefs) {
    var s = String(txt).toLowerCase(), v = q.draft.view || defaultStayMonth(prefs);
    var m = /([a-z]{3,9})\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/.exec(s) || null;
    var mi = -1, a, b;
    if (m) { for (var i = 0; i < 12; i++) if (m[1].indexOf(MON3[i].toLowerCase()) === 0) mi = i; a = +m[2]; b = +m[3]; }
    else if ((m = /(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*([a-z]{3,9})/.exec(s))) {
      for (var j = 0; j < 12; j++) if (m[3].indexOf(MON3[j].toLowerCase()) === 0) mi = j; a = +m[1]; b = +m[2];
    }
    if (m && mi >= 0) {
      var y = v.y; if (mi < v.m - 3) y++;
      var st = toIso(y, mi, a), en = toIso(y, mi, b);
      if (b >= a) return { start: st, end: en };
    }
    return defaultRange(q, prefs);
  }

  function commit(b, q, prefs) {
    var dr = q.draft || {}, free = (dr.free || '').trim();
    var sel = dr.sel || [];
    switch (q.type) {
      case 'month':
        if (free) return { label: free, val: parseMonthFree(free), free: true };
        if (sel.length) { var o = q.opts[sel[0]]; return { label: monthLabelOf(o.val), val: o.val }; }
        return null;
      case 'multi':
        var labs = sel.slice().sort(function (a, c) { return a - c; }).map(function (i) { return q.opts[i].label; });
        var types = labs.slice();
        if (free) {
          var low = free.toLowerCase(), hit = false;
          q.opts.forEach(function (o2) {
            var ws = o2.label.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 4; });
            if (ws.some(function (w) { return low.indexOf(w) >= 0; }) && types.indexOf(o2.label) < 0) { types.push(o2.label); hit = true; }
          });
          labs.push(free);
          if (!hit && !types.length) types.push(q.opts[0].label);
        }
        if (!labs.length) return null;
        return { label: labs.join(', '), val: { types: types }, free: !!free };
      case 'single':
        if (free) return { label: free, val: { idx: -1, days: parseDaysFree(free), label: free }, free: true };
        if (sel.length) { var o3 = q.opts[sel[0]]; return { label: o3.label, val: { idx: sel[0], days: o3.days, label: o3.label } }; }
        return null;
      case 'dates':
        if (free) { var r = parseDatesFree(free, q, prefs); return { label: free, val: r, free: true }; }
        if (dr.range && dr.range.start && dr.range.end) return { label: fmtRange(dr.range.start, dr.range.end), val: { start: dr.range.start, end: dr.range.end } };
        return null;
    }
    return null;
  }
  function decideAnswer(b, q, prefs) {
    var ans = { label: 'You decide', decided: true }, dr = q.draft = q.draft || {};
    dr.free = '';
    switch (q.type) {
      case 'month':
        dr.sel = [Math.min(3, q.opts.length - 1)]; ans.val = q.opts[dr.sel[0]].val; break;
      case 'multi':
        dr.sel = [0]; ans.val = { types: [q.opts[0].label] }; break;
      case 'single':
        if (q.key === 'duration') { var i = Math.min(1, q.opts.length - 1); dr.sel = [i]; ans.val = { idx: i, days: q.opts[i].days, label: q.opts[i].label }; }
        else { dr.sel = []; ans.val = { idx: -1, label: null }; }
        break;
      case 'dates':
        var r = defaultRange(q, prefs); dr.range = r; dr.view = { y: parseIso(r.start).getFullYear(), m: parseIso(r.start).getMonth() };
        ans.val = r; break;
    }
    return ans;
  }
  function prefsForClarify(trip) { return trip.prefs || {}; }
  function answered(b) { return b.qs.filter(function (q) { return !!q.ans; }).length; }
  function showSubmit(b, i) {
    return b.qs.every(function (q, k) { return k === i || !!q.ans; });
  }

  /* ------------------------------------------------------------ deep research data */
  function distribute(nLines, nSteps) {
    var w = [], i;
    var base = nSteps === 5 ? [2, 4, 2, 1, 1] : [];
    if (!base.length) { for (i = 0; i < nSteps; i++) base.push(1); }
    var sum = base.reduce(function (a, c) { return a + c; }, 0), out = [], acc = 0;
    for (i = 0; i < nSteps; i++) { var n = i === nSteps - 1 ? nLines - acc : Math.round(nLines * base[i] / sum); n = clamp(n, 0, nLines - acc); out.push(n); acc += n; }
    return out;
  }
  function researchBlock(d, opts) {
    var deep = d.deep || {};
    var steps = opts.short ? ['Reading your request', 'Checking places and availability', 'Drafting the changes'] : (deep.steps || ['Reading the brief', 'Searching sources', 'Writing the plan']);
    var srcs = (deep.sources || []).slice(0, opts.short ? 6 : 12).map(function (s) { return { title: s.title, domain: s.domain, note: s.note }; });
    var pool = (deep.lines || []).slice();
    var nl = opts.short ? Math.min(4, pool.length) : pool.length;
    var lines = [], counts = distribute(nl, steps.length), k = 0;
    if (opts.short) pool = pool.slice(opts.offset || 0).concat(pool.slice(0, opts.offset || 0));
    counts.forEach(function (c, si) { for (var j = 0; j < c; j++) lines.push({ text: pool[k++] || '', step: si }); });
    return { t: 'research', sub: opts.sub || '', brief: opts.brief || { destination: d.name }, curated: true, steps: steps, lines: lines, sources: srcs, stepIdx: 0, lineN: 0, srcShown: 0, elapsed: 0, done: false, stopped: false, collapsed: false, short: !!opts.short, totalMs: opts.short ? 900 : 1500 };
  }
  function tripBrief(trip, request) {
    var prefs = trip && trip.prefs || {}, types = Array.isArray(prefs.types) ? prefs.types.slice(0, 2) : [];
    return { destination: trip && (trip.destName || trip.title) || '', days: Number(prefs.days) || (trip && trip.plan && trip.plan.days && trip.plan.days.length) || 0, style: types.join(' · '), request: String(request || '').slice(0, 110) };
  }
  function webUrl(value) { if (typeof value !== 'string' || !value.trim()) return ''; try { var u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } }
  function slug(value) { return String(value || 'place').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'place'; }
  function installResearchCatalog(trip, result, originalPlan, draftId) {
    var destination = trip.destId && FT.dest(trip.destId), destId = trip.destId || ('research-' + slug(trip.destName || trip.title || 'journey'));
    destination = destination ? JSON.parse(JSON.stringify(destination)) : { id: destId, name: trip.destName || trip.title || 'Your destination', tripTitle: trip.title, threadTitle: 'Research notes', match: [], areas: [], places: {}, map: {} };
    destination.id = destId; destination.places = destination.places || {}; destination.areas = destination.areas || [];
    var ids = {}, byName = {};
    (result.places || []).forEach(function (p, i) {
      if (!p || !(p.title || p.name)) return;
      var name = p.title || p.name, id = 'research-' + slug(name), suffix = 2;
      while (destination.places[id] && destination.places[id].name !== name) id = 'research-' + slug(name) + '-' + suffix++;
      var coords = p.coordinates || p.coords || p.at, at = Array.isArray(coords) && coords.length >= 2 && coords.slice(0, 2).every(function (n) { return Number.isFinite(Number(n)); }) ? [Number(coords[0]), Number(coords[1])] : null;
      var photoList = (Array.isArray(p.photos) ? p.photos : []).filter(function (ph) { return ph && webUrl(ph.url) && webUrl(ph.sourceUrl) && String(ph.attribution || '').trim(); }).map(function (ph) { return { url: webUrl(ph.url), alt: ph.alt || name, attribution: ph.attribution, sourceUrl: webUrl(ph.sourceUrl) }; });
      var place = { id: id, name: name, kind: p.category || p.kind || 'sight', label: p.category || p.kind || 'Place', area: p.area || 'research', at: at, address: p.address || '', url: webUrl(p.url), sourceUrl: webUrl(p.sourceUrl), blurb: p.description || p.blurb || '', description: p.description || '', photos: photoList, openingHours: '', rating: null, reviews: null, ratingSource: '' };
      destination.places[id] = place; ids[id] = 1; byName[String(name).toLowerCase()] = id;
    });
    (result.days || []).forEach(function (day) { (day.items || []).forEach(function (item) {
      var it = typeof item === 'string' ? { title: item } : item || {}, name = it.title || it.name || it.place;
      if (!name || byName[String(name).toLowerCase()]) return;
      var id = 'research-' + slug(name), coords = it.coordinates || it.coords || it.at, at = Array.isArray(coords) && coords.length >= 2 && coords.slice(0, 2).every(function (n) { return Number.isFinite(Number(n)); }) ? [Number(coords[0]), Number(coords[1])] : null;
      destination.places[id] = { id: id, name: name, kind: it.category || it.kind || 'sight', label: it.category || it.kind || 'Place', area: it.area || 'research', at: at, address: it.address || '', url: webUrl(it.url), blurb: it.description || it.notes || '', photos: [] }; byName[String(name).toLowerCase()] = id; ids[id] = 1;
    }); });
    if (!destination.areas.length) destination.areas.push({ id: 'research', name: destination.name, town: destination.name });
    destination.places = destination.places || {};
    var plan = { days: (result.days || []).map(function (day) {
      var area = day.area || 'research'; if (!destination.areas.some(function (a) { return a.id === area; })) destination.areas.push({ id: area, name: day.town || day.title || destination.name, town: day.town || day.title || destination.name });
      return { id: uid('d_'), area: area, town: day.town || day.title || destination.name, date: day.date || null, items: (day.items || []).map(function (item) { var it = typeof item === 'string' ? { title: item } : item || {}, name = it.title || it.name || it.place || 'Stop', pid = byName[String(name).toLowerCase()]; return { id: uid('i_'), place: pid || null, name: pid ? undefined : name, label: it.category || '', at: pid ? destination.places[pid].at : null, note: it.notes || it.description || it.note || '', time: it.time || '' }; }) };
    }) };
    var placeIds = byName;
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === trip.id; })[0];
      if (!t) return;
      (t.threads || []).forEach(function (thread) { (thread.messages || []).forEach(function (message) { (message.blocks || []).forEach(function (block) {
        if (block.t === 'draft' && !block.applied && block.draftId !== draftId) { block.superseded = true; block.rev = (block.rev || 0) + 1; }
      }); }); });
      t.researchDraft = { id: draftId, destId: destId, catalog: JSON.parse(JSON.stringify(destination)), plan: JSON.parse(JSON.stringify(plan)), basePlan: JSON.parse(JSON.stringify(originalPlan || null)), createdAt: new Date().toISOString() };
    });
    var mounted = mountedCtx();
    if (mounted && mounted.trip.id === trip.id) syncThread(mounted.trip, mounted.th);
    return { draftId: draftId, destId: destId, plan: plan, ids: ids, placeIds: placeIds, catalog: destination };
  }
  function respondWithBackend(turn, text) {
    var trip = getTrip(turn.tripId), backend = FT.backend;
    if (!backend || !backend.user || !backend.capabilities || !backend.capabilities.research) return reply(turn, 'Deep research is not available right now. Your question and plan are still here; try again when research is ready.');
    var originalPlan = trip && trip.plan ? clone(trip.plan) : null;
    var rb = { t: 'research', sub: trip && (trip.destName || trip.title) || 'Travel research', brief: tripBrief(trip, text), steps: [], lines: [], sources: [], stepIdx: -1, lineN: 0, srcShown: 0, elapsed: 0, done: false, stopped: false, collapsed: false, totalMs: 90000 };
    addBlock(turn, rb);
    var started = Date.now();
    turn.ticker = setInterval(function () { rb.elapsed = (Date.now() - started) / 1000; touch(rb); sync(turn); }, 900);
    return backend.research(turn.tripId, text, turn.mode || 'deep', turn.image, function (stage) {
      var label = String(typeof stage === 'string' ? stage : stage && (stage.label || stage.stage || stage.status) || '').replace(/[_-]+/g, ' ').trim();
      if (!label || rb.steps.indexOf(label) >= 0) return;
      var index = rb.steps.length; rb.steps.push(label); rb.lines.push({ text: label, step: index }); rb.stepIdx = index; rb.lineN = rb.lines.length; touch(rb); sync(turn);
    }, turn.threadId,turn.ownerId).then(function (result) {
      if (turn.stopped) throw STOP;
      trip = getTrip(turn.tripId); if (!trip) throw new Error('This journey is no longer available.');
      var installed = installResearchCatalog(trip, result || {}, originalPlan, uid('rd_'));
      var sources = (result.sources || []).filter(function (s) { return s && webUrl(s.url); }).map(function (s) { return { title: s.title || s.domain || s.url, domain: s.domain || (new URL(webUrl(s.url))).hostname, note: s.note || '', url: webUrl(s.url) }; });
      rb.sources = sources.map(function (s) { return { title: s.title, domain: s.domain, note: s.note }; }); rb.srcShown = rb.sources.length; rb.stepIdx = rb.steps.length; rb.elapsed = (Date.now() - started) / 1000; rb.done = true; rb.collapsed = true; touch(rb); sync(turn);
      var answer = String(result.text || '').trim();
      if (sources.length) answer += (answer ? '\n\n' : '') + '**Sources**\n' + sources.map(function (s) { return '- [' + s.title.replace(/[\[\]]/g, '') + '](' + s.url + ')'; }).join('\n');
      if (answer) addBlock(turn, { t: 'text', text: answer });
      if ((result.places || []).length) addBlock(turn, { t: 'places', places: result.places.map(function (p) { var name=p.title||p.name||'Place'; return { title: name, id: installed.placeIds[String(name).toLowerCase()] || 'research-' + slug(name), description: p.description || p.blurb || '', photos: (p.photos || []).filter(function (x) { return x && webUrl(x.url) && webUrl(x.sourceUrl) && String(x.attribution || '').trim(); }).map(function (x) { return { url: webUrl(x.url), attribution: x.attribution, sourceUrl: webUrl(x.sourceUrl) }; }), category: p.category || p.kind || '', address: p.address || '', url: webUrl(p.url), sourceUrl:webUrl(p.sourceUrl), openingHours:'' }; }) });
      if (installed.plan.days.length) {
        var draftDays = installed.plan.days.map(function (d) {
          return { title: d.town || d.area || 'Day', date: d.date, items: d.items.map(function (it) {
            return { title: it.place && installed.catalog.places[it.place] ? installed.catalog.places[it.place].name : (it.name || 'Stop'), time: it.time || '', note: it.note || '' };
          }) };
        });
        addBlock(turn, { t: 'draft', draftId: installed.draftId, destId: installed.destId, days: draftDays });
        var proposedExperiences = experienceIdeasBlock(installed.catalog, installed.plan, true);
        if (proposedExperiences) addBlock(turn, proposedExperiences);
        var guide = DEST(installed.destId), stayIdeas = guide && stayIdeasBlock(guide, installed.plan, true);
        if (stayIdeas) addBlock(turn, stayIdeas);
      }
      var questions = (result.questions || []).map(function (q) { return typeof q === 'string' ? q.trim() : String(q && (q.question || q.text || q.prompt) || '').trim(); }).filter(Boolean).map(function (label) { return { label: label }; });
      if (questions.length) suggest(turn, questions);
      persist(turn.tripId, true); save(turn); emit('map:fit');
    }).catch(function (err) { rb.done = true; rb.collapsed = false; rb.error = err.message || 'Research could not finish.'; touch(rb); sync(turn); throw err; }).finally(function () { if (turn.ticker) clearInterval(turn.ticker); turn.ticker = null; });
  }
  function fmtClock(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }

  function runResearch(turn, b, until) {
    /* The route drawing is a waiting state, not a percentage. Keep it visible until the real plan request settles. */
    var start = Date.now();
    var timer = setInterval(function () {
      var el = (Date.now() - start) / 1000; b.elapsed = el;
      var msg = M(turn); if (!msg || turn.stopped) { clearInterval(timer); return; }
      var node = root && root.querySelector('[data-bid="' + b.id + '"]');
      if (node) {
        var t = node.querySelector('.ch-r__time, .ch-making__time'); if (t) t.textContent = fmtClock(el);
      }
    }, 200);
    turn.ticker = timer;
    return Promise.all([tick(turn, b.totalMs), until || Promise.resolve()]).then(function () {
      if (turn.stopped) throw STOP;
      clearInterval(timer);
      b.stepIdx = b.steps.length; b.srcShown = b.sources.length; b.lineN = b.lines.length;
      b.elapsed = (Date.now() - start) / 1000; b.done = true; b.collapsed = true;
      touch(b); sync(turn); save(turn);
    }, function (e) { clearInterval(timer); throw e; });
  }

  function reportBlock(d) {
    var r = (d.deep && d.deep.report) || {};
    return { t: 'report', report: clone(r), sources: ((d.deep && d.deep.sources) || []).map(function (s) { return { title: s.title, domain: s.domain, note: s.note }; }), shown: 0 };
  }
  function runReport(turn, b) {
    var parts = 1 + ((b.report.sections || []).length) + (b.report.table ? 1 : 0) + 1;
    var i = 0;
    return (function step() {
      if (turn.stopped) throw STOP;
      if (i >= parts) { save(turn); return Promise.resolve(); }
      b.shown = ++i; touch(b); sync(turn);
      return wait(turn, 450).then(step);
    })();
  }

  /* ------------------------------------------------------------ flows */
  function ctxFor(d, trip, extra) {
    var p = trip.prefs || {};
    var c = { days: p.days || (trip.plan ? trip.plan.days.length : ''), month: p.month ? MONTHS[p.month.m - MB] : 'your dates', dest: d.name, stay: '', range: '' };
    if (trip.plan) {
      var dated = trip.plan.days.filter(function (x) { return x.date; });
      if (dated.length) c.range = fmtRange(dated[0].date, dated[dated.length - 1].date);
      else if (p.dates) c.range = fmtRange(p.dates.start, p.dates.end);
      if (trip.plan.stay && P(d, trip.plan.stay)) c.stay = P(d, trip.plan.stay).name;
    }
    return Object.assign(c, extra || {});
  }
  function chipsFor(d, skipText) {
    var out = (d.suggestions || []).filter(function (s) { return String(s).toLowerCase() !== String(skipText || '').toLowerCase(); });
    return out.slice(0, 3).map(function (s) { return { label: s }; });
  }
  function todo(items, doneN) { return { kind: 'todo', items: items.map(function (t, i) { return { t: t, done: i < doneN }; }) }; }
  function stayDetail(d) {
    var ids = ((d.stays && d.stays.ids) || []).filter(function (id) { return P(d, id); });
    return { kind: 'list', items: ids.map(function (id) { var p = d.places[id]; return { t: p.name, m: areaLabel(d, p.area) || p.label || '' }; }) };
  }
  function stayIdeasBlock(d, plan, generalFallback) {
    var ids = (d.stays && d.stays.ids) || [], days = plan && plan.days || [];
    if (!ids.length || !days.length) return null;
    var groups = [];
    days.forEach(function (day, i) {
      var area = day.area;
      if (!area) return;
      var group = groups[groups.length - 1];
      if (!group || group.area !== area) { group = { area: area, from: i + 1, to: i + 1, dateStart: day.date || '', dateEnd: day.date || '', ids: [] }; groups.push(group); }
      else { group.to = i + 1; group.dateEnd = day.date || ''; }
    });
    groups.forEach(function (group) {
      group.ids = ids.filter(function (id) { var p = P(d, id); return p && p.kind === 'stay' && p.area === group.area; }).slice(0, 3);
    });
    groups = groups.filter(function (group) { return group.ids.length; });
    if (!groups.length && generalFallback) {
      (d.areas || []).forEach(function (area) {
        var matches = ids.filter(function (id) { var p = P(d, id); return p && p.kind === 'stay' && p.area === area.id; }).slice(0, 3);
        if (matches.length) groups.push({ area: area.id, from: 0, to: 0, dateStart: '', dateEnd: '', ids: matches });
      });
    }
    return groups.length ? { t: 'stay-ideas', destId: d.id, groups: groups, general: !!(generalFallback && groups[0].from === 0) } : null;
  }
  function experienceIdeasBlock(d, plan, proposal, excluded) {
    var days = plan && plan.days || [], places = d && d.places || {}, usedInPlan = {}, shown = Object.assign({}, excluded || {}), groups = [];
    if (!d || !days.length) return null;
    function isExperience(p) { return p && p.name && !/stay|hotel|lodging|accommodation|resort|villa|room|flight|transport|transfer/i.test(String(p.kind || '')); }
    days.forEach(function (day) { (day.items || []).forEach(function (item) { if (item.place) usedInPlan[item.place] = true; }); });
    days.forEach(function (day, dayIndex) {
      var planned = (day.items || []).map(function (item) { return item.place; }).filter(function (id) { return id && isExperience(places[id]); });
      var picks = [];
      if (!proposal) {
        var kinds = planned.map(function (id) { return places[id].kind; });
        Object.keys(places).filter(function (id) { var p = places[id]; return isExperience(p) && p.area === day.area && !usedInPlan[id] && !shown[id]; })
          .sort(function (a, b) { return (kinds.indexOf(places[b].kind) >= 0 ? 1 : 0) - (kinds.indexOf(places[a].kind) >= 0 ? 1 : 0); })
          .slice(0, 3).forEach(function (id) { picks.push(id); shown[id] = true; });
      }
      planned.forEach(function (id) { if (picks.length < 3 && !shown[id]) { picks.push(id); shown[id] = true; } });
      if (!picks.length) return;
      var town = day.town && !/^day\s*\d/i.test(day.town) ? day.town : areaLabel(d, day.area) || d.name;
      groups.push({ dayIndex: dayIndex, area: day.area || '', town: town, date: day.date || '', items: picks.map(function (id) {
        var p = places[id], photo = (p.photos || []).filter(function (x) { return x && webUrl(x.url) && webUrl(x.sourceUrl) && String(x.attribution || '').trim(); })[0];
        return { id: id, name: p.name, kind: p.kind, label: p.label || p.kind || 'Experience', blurb: p.blurb || p.description || '', seed: p.seed || d.id + '-' + id, scene: p.scene || d.scene || 'city', tone: p.tone || d.tone || 'sand', at: p.at || null, photo: photo ? { url: webUrl(photo.url), attribution: photo.attribution, sourceUrl: webUrl(photo.sourceUrl) } : null, sourceUrl: webUrl(p.sourceUrl || p.url), sourceLabel: p.sourceUrl ? 'Source' : 'Visit site', rating: p.ratingSource && Number.isFinite(Number(p.rating)) ? Number(p.rating) : null, ratingSource: p.ratingSource || '' };
      }) });
    });
    return groups.length ? { t: 'experience-ideas', destId: d.id, proposal: !!proposal, groups: groups } : null;
  }
  function areasDetail(d) {
    var counts = {};
    Object.keys(d.places).forEach(function (id) { var a = d.places[id].area; counts[a] = (counts[a] || 0) + 1; });
    return { kind: 'list', items: Object.keys(counts).map(function (a) { return { t: areaLabel(d, a) || a, m: counts[a] + ' places' }; }) };
  }

  /* ---- travel: origin, flight item */
  var AIRPORTS = {
    goa: { code: 'GOI', at: [73.8314, 15.3808], city: 'Goa' },
    kerala: { code: 'COK', at: [76.4019, 10.152], city: 'Kochi' },
    rajasthan: { code: 'JAI', at: [75.8122, 26.8242], city: 'Jaipur' },
    ladakh: { code: 'IXL', at: [77.5465, 34.1359], city: 'Leh' },
    srilanka: { code: 'CMB', at: [79.8841, 7.1808], city: 'Colombo' },
    kyoto: { code: 'KIX', at: [135.244, 34.4347], city: 'Osaka Kansai' }
  };
  var CITY_IATA = { mumbai: 'BOM', bombay: 'BOM', delhi: 'DEL', 'new delhi': 'DEL', bangalore: 'BLR', bengaluru: 'BLR', chennai: 'MAA', kolkata: 'CCU', calcutta: 'CCU', hyderabad: 'HYD', pune: 'PNQ', ahmedabad: 'AMD', kochi: 'COK', jaipur: 'JAI', london: 'LHR', dubai: 'DXB', singapore: 'SIN', 'new york': 'JFK', paris: 'CDG', sydney: 'SYD', colombo: 'CMB', tokyo: 'HND', osaka: 'KIX' };
  function homeCity() { try { return (FT.store.get().prefs || {}).homeCity || ''; } catch (e) { return ''; } }
  function originCode(name) {
    var k = String(name || '').toLowerCase();
    if (CITY_IATA[k]) return CITY_IATA[k];
    try { var pr = FT.store.get().prefs || {}; if (pr.homeCity && pr.homeCity.toLowerCase() === k && pr.airports && pr.airports[0]) return pr.airports[0]; } catch (e) { /* ignore */ }
    return name;
  }
  function extractOrigin(text) {
    var re = /(?:[a-z,]\s+)from\s+(\S+(?:\s+\S+){0,3})/gi, m;
    while ((m = re.exec(text))) {
      var ph = takePhrase(m[1], false);
      if (ph && !/^(scratch|flights?|ground|transport|there|here|anywhere|home|my|the)\b/i.test(ph)) return ph;
    }
    return null;
  }
  function flightItem(d, origin, ground) {
    var ap = d && AIRPORTS[d.id];
    if (!ap) return null;
    var from = originCode(origin || homeCity());
    return {
      place: null, name: 'Fly ' + from + ' \u2192 ' + ap.code, label: 'Flight', at: ap.at.slice(),
      note: 'Morning departure' + (origin ? ' from ' + origin : '') + ', landing at ' + ap.city + ' (' + ap.code + ').' +
        (ground ? ' Ground transport: a pre-booked airport taxi to your base is the simplest way to arrive; Friday can arrange it.' : ' Keep the rest of the day light.')
    };
  }
  function travelFor(d, b) {
    if (!b || !(b.flight || b.originGiven)) return null;
    return flightItem(d, b.origin || null, b.ground);
  }

  /* ---- a request for a different destination: replace this trip or plan separately */
  function switchClarifier(info) {
    var nd = info.newDest ? DEST(info.newDest) : null;
    var dur = nd && nd.clarify && nd.clarify.duration ? nd.clarify.duration : genericDest(info.newName).clarify.duration;
    var org = info.origin || homeCity();
    return Object.assign({
      t: 'clarify', kind: 'switch', qi: 0, submitted: false, superseded: false,
      qs: [
        { key: 'scope', type: 'single', q: 'Should this ' + info.newName + ' itinerary replace the current ' + info.oldName + ' journey, or shall we design it as a separate voyage?', opts: [{ label: 'Replace ' + info.oldName + ' journey' }, { label: 'Design separately' }], draft: { sel: [], free: '' } },
        { key: 'month', type: 'month', q: 'Which season or month would you prefer for ' + info.newName + '?', opts: nextMonthTiles(), draft: { sel: [], free: '' } },
        { key: 'duration', type: 'single', q: 'How many days would you dedicate to the full ' + (org ? org + '\u2013' : '') + info.newName + ' journey?', opts: dur.options.map(function (o) { return { label: o.label, days: o.days }; }), draft: { sel: [], free: '' } }
      ]
    }, info);
  }
  function startSwitch(turn, trip, text, nw, here) {
    var newName = nw.dest ? DEST(nw.dest).name : nw.name;
    var org = extractOrigin(text);
    var th = threadById(trip, turn.threadId);
    var info = {
      newDest: nw.dest || null, newName: newName, oldName: here, origin: org || homeCity(), originGiven: !!org,
      flight: /\b(flights?|fly|flying|airfare|airport)\b/i.test(text), ground: /ground transport|transfers?|\btaxi|\bcabs?\b|car (hire|rental)|airport pickup/i.test(text),
      threadTitle: newName + ' Trip Plan' + (org ? ' from ' + org : ''), prevTitle: th ? th.title : ''
    };
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === trip.id; })[0], tt = t && threadById(t, turn.threadId);
      if (tt) tt.title = info.threadTitle;
    });
    return tick(turn, 450).then(function () {
      var b = switchClarifier(info);
      addBlock(turn, b);
      var msg = M(turn); msg.waiting = true; msg.done = false;
      save(turn); focusClarifier(b.id);
    });
  }
  function switchFlow(turn, b, trip) {
    var sc = ansOf(b, 'scope');
    var replace = !!(sc && !sc.decided && ((sc.val && sc.val.idx === 0) || (sc.free && /replace/i.test(sc.label))));
    var at = ansOf(b, 'month'), ad = ansOf(b, 'duration');
    var oldTitle = b.prevTitle;
    var msg = M(turn);
    if (replace) {
      if (trip.plan && trip.plan.days && trip.plan.days.length) {
        try { if (FT.plan && FT.plan.apply) FT.plan.apply(trip.id, { days: [], stay: null }, { summary: 'Replaced ' + b.oldName + ' with ' + b.newName, changes: 0 }); } catch (e) { console.error(e); }
      }
      var nd = b.newDest ? DEST(b.newDest) : null;
      FT.store.update(function (s) {
        var t = s.trips.filter(function (x) { return x.id === trip.id; })[0]; if (!t) return;
        t.destId = b.newDest || null; t.destName = b.newName;
        t.title = nd ? (nd.tripTitle || nd.name + ' trip') : b.newName + ' Trip';
        t.plan = t.plan && t.plan.days && t.plan.days.length ? { days: [], stay: null } : t.plan;
        t.prefs = { month: null, types: [], days: null, dates: null, base: null };
        t.activeTab = 'overview';
      });
      emit('map:fit');
      sync(turn);
      return startFlow(turn, b, getTrip(trip.id));
    }
    /* plan separately: the new trip takes over this thread's last exchange */
    var ctx = mountedCtx() || { th: threadById(trip, turn.threadId) };
    var th = threadById(trip, turn.threadId), i = th ? th.messages.indexOf(msg) : -1;
    var um = i > 0 ? th.messages[i - 1] : null;
    var nt = FT.trips && FT.trips.create ? FT.trips.create(b.newDest ? { destId: b.newDest } : {}) : null;
    if (!nt) return startFlow(turn, b, trip);
    if (b.newDest) { adoptDest(nt.id, b.newDest); emit('map:fit'); } else adoptPlace(nt.id, b.newName);
    var nth = ensureThread(nt.id);
    if (th && i >= 0) { th.messages.splice(um ? i - 1 : i, um ? 2 : 1); th.title = oldTitle || th.title; }
    var carried = [];
    if (um) carried.push(um);
    carried.push(msg);
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === nt.id; })[0]; if (!t) return;
      var tt = threadById(t, nth.id);
      tt.title = b.threadTitle;
      carried.forEach(function (m) { tt.messages.push(m); });
    });
    persist(trip.id);
    turn.stopped = true;   /* hand over: this turn is finished, a new one carries on in the new trip */
    var turn2 = beginTurn(nt.id, nth.id, msg.id);turn2.ownerId=turn.ownerId;
    if (FT.router && FT.router.go) FT.router.go('#/trip/' + nt.id);
    var nb = carried[carried.length - 1].blocks.filter(function (x) { return x.id === b.id; })[0] || b;
    run(turn2, function () { sync(turn2); return startFlow(turn2, nb, getTrip(nt.id)); });
    return Promise.resolve();
  }
  function startFlow(turn, b, trip) {
    var d = DEST(trip.destId);
    if (!d) return genericFlow(turn, b, trip);
    return planFlow(turn, b, trip, d);
  }

  function curatedNames() {
    var n = order().map(function (id) { var dd = DEST(id); return dd ? '**' + dd.name + '**' : null; }).filter(Boolean);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n.join('');
  }
  function curatedChips() {
    return order().map(function (id) { var dd = DEST(id); return dd ? { label: dd.prompt || ('Plan a trip to ' + dd.name), action: 'newtrip', dest: id } : null; }).filter(Boolean);
  }
  function respond(turn, text) {
    var reelThread = threadById(getTrip(turn.tripId), turn.threadId);
    if (reelThread && (reelThread.reelChat || /https:\/\/(?:www\.)?(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|pinterest\.com|x\.com|twitter\.com)\//i.test(text) || /^(?:plan from a reel|plan a reel)$/i.test(text))) {
      if (FT.reel && FT.reel.available && !FT.reel.available()) return reply(turn, 'Reel import isn’t available right now. Tell me the place or destination you have in mind and I’ll plan from that instead.');
      reelThread.reelChat = true;
      if(!FT.backend || FT.backend.auditOwnerId!==turn.ownerId) return reply(turn,'Your account changed. Reopen this conversation before continuing.');
      return FT.backend.request('/api/friday/reel-chat', 'POST', {conversationId:turn.threadId,message:text,ownerId:turn.ownerId}).then(function(result){
        if(turn.stopped || !FT.backend || FT.backend.auditOwnerId!==turn.ownerId) throw STOP;
        reelThread.reelChat=!result.closed;
        return reply(turn,result.text,(result.suggestions||[]).map(function(s){return {label:s};}));
      }).catch(function(error){if(error===STOP)throw error;return reply(turn,error.message||'Friday could not complete that request. Your previous itinerary is still saved.');});
    }

    /* Signed in with a research provider: Deep research answers. Without one, fall through to the planner below, whose
       plan comes from POST /api/itineraries (see requestPlan) instead of a dead end. */
    if (FT.backend && FT.backend.user && FT.backend.capabilities && FT.backend.capabilities.research) return respondWithBackend(turn, text);
    var trip = getTrip(turn.tripId), q = text.toLowerCase();
    var named = detectDest(q);
    var did = trip.destId, dname = trip.destName || null;
    var here = did ? (DEST(did) || {}).name : dname;
    if (!did && !dname) {
      if (named) { adoptDest(trip.id, named); did = named; trip = getTrip(trip.id); }
      else {
        var place = extractPlace(text, false);
        if (place) { adoptPlace(trip.id, place); dname = place; here = place; trip = getTrip(trip.id); }
      }
    } else if (named && named !== did) {
      return startSwitch(turn, trip, text, { dest: named }, here);
    } else if (!named) {
      var other = extractPlace(text, true);
      if (other && here && other.toLowerCase() !== String(here).toLowerCase() && /\b(plan|trip|itinerary|visit|holiday|vacation|getaway)\b/i.test(text)) {
        return startSwitch(turn, trip, text, { name: other }, here);
      }
    }
    if (!did && !dname) {
      return reply(turn, 'Where would you like to go? In this preview I can plan ' + curatedNames() + '.',
        order().map(function (id) { var dd = DEST(id); return dd ? { label: dd.prompt || ('Plan a trip to ' + dd.name), dest: id } : null; }));
    }
    if (!did) return respondGeneric(turn, trip, text, q);
    var d = DEST(did), replies = d.replies || {};
    var hasPlan = !!(trip.plan && trip.plan.days && trip.plan.days.length);
    var R = {
      reserve: /\b(reserve|reservations?|book|booking|bookings|buy)\b/i,
      relax: /relax|slower|\bless\b|leisurely|unhurried|pace|wander|rest|linger|lighten|acclimatise/i,
      night: /nightlife|\bbars?\b|\bclubs?\b|part(y|ies)\b|sundowner|sunset drinks?|dusk|twilight|evening|cocktail|lantern/i,
      food: /local food|food spots?|\beat\b|eating|restaurants?|where to eat|food near|dinner|lunch|curate.*table|dining|tables?|thali|kaiseki|baker|bistro|seafood|counter/i,
      experience: /experiences?|activities|things to do|what to do|attractions?|sightseeing|places to visit/i,
      hotel: /hotel|\bstay|restaurant|where to sleep|accommodation|resort|sanctuary|haveli|retreat|boutique/i,
      day: /\bday\s*(\d+)/i,
      dayVerb: /remove|swap|delete|drop|replace/i,
      plan: /\bplan\b|\btrip\b|itinerary|journey|voyage/i
    };
    var intent;
    if (!hasPlan) intent = R.reserve.test(q) && !R.plan.test(q) ? 'reserve' : 'plan';
    else if (R.reserve.test(q)) intent = 'reserve';
    else if (R.day.test(q) && R.dayVerb.test(q)) intent = 'dayedit';
    else if (R.relax.test(q)) intent = 'relax';
    else if (R.night.test(q)) intent = 'night';
    else if (R.food.test(q)) intent = 'food';
    else if (R.experience.test(q)) intent = 'experience';
    else if (R.hotel.test(q)) intent = 'stay';
    else if (R.plan.test(q)) intent = 'plan';
    else intent = 'fallback';

    if (intent === 'plan') {
      return tick(turn, 450).then(function () {
        var b = planClarifier(d);
        var org = extractOrigin(text);
        b.origin = org || homeCity(); b.originGiven = !!org;
        b.flight = /\b(flights?|fly|flying|airfare)\b/i.test(text); b.ground = /ground transport|transfers?|\btaxi|\bcabs?\b/i.test(text);
        addBlock(turn, b);
        var msg = M(turn); msg.waiting = true; msg.done = false;
        save(turn); focusClarifier(b.id);
      });
    }
    if (intent === 'stay') {
      return tick(turn, 450).then(function () {
        var b = stayClarifier(d, trip.prefs || {});
        addBlock(turn, b);
        var msg = M(turn); msg.waiting = true; msg.done = false;
        save(turn); focusClarifier(b.id);
      });
    }
    var followSteps = function (label) {
      var rb = researchBlock(d, { short: true, sub: d.name + (label ? ', ' + label : ''), offset: Math.floor(Math.random() * 4) });
      rb.totalMs = 900;
      addBlock(turn, rb);
      return runResearch(turn, rb);
    };
    var ctx = ctxFor(d, trip);
    switch (intent) {
      case 'reserve':
        return reply(turn, fill(replies.reserve || "I can help you shape the itinerary here. For booking questions, [talk with a Friday travel designer](#call-me-back) before making arrangements.", ctx), chipsFor(d, text));
      case 'relax':
        return followSteps('a slower pace').then(function () {
          var r = relaxEdit(d, trip.plan);
          return tick(turn, 400).then(function () { return tool(turn, 'Updated todo list', todo(['Read your plan', 'Find the busiest days', 'Trim the busiest stops'], 2)); })
            .then(function () { return tool(turn, r.changes ? 'Updated plan with ' + r.changes + ' change' + (r.changes === 1 ? '' : 's') : 'No stops to trim', null, 350); })
            .then(function () {
              if (r.changes) applyPlan(turn, r.plan, 'Paced the days more leisurely', r.changes);
              return say(turn, fill(replies.relaxed || 'I softened the busiest days so there is generous room to wander and linger.', ctx));
            }).then(function () { suggest(turn, chipsFor(d, text)); });
        });
      case 'food':
        return followSteps('curated dining').then(function () {
          var r = foodEdit(d, trip.plan);
          var c2 = ctxFor(d, trip, foodCtx(d, r.added));
          return tick(turn, 400).then(function () { return tool(turn, 'Searched ' + Object.keys(d.places).length + ' places in ' + (d.region || d.name), areasDetail(d)); })
            .then(function () { return tool(turn, r.changes ? 'Updated plan with ' + r.changes + ' change' + (r.changes === 1 ? '' : 's') : 'Nothing new to add', null, 350); })
            .then(function () {
              if (r.changes) applyPlan(turn, r.plan, 'Curated regional dining stops', r.changes);
              return say(turn, fill(replies.food || 'I added celebrated local tables near your base and along the route.', c2));
            }).then(function () { suggest(turn, chipsFor(d, text)); });
        });
      case 'night':
        return followSteps('evening plans').then(function () {
          var r = nightEdit(d, trip.plan);
          var c2 = ctxFor(d, trip, foodCtx(d, r.added, 'night'));
          return tick(turn, 400).then(function () { return tool(turn, 'Searched ' + Object.keys(d.places).length + ' places in ' + (d.region || d.name), areasDetail(d)); })
            .then(function () { return tool(turn, r.changes ? 'Updated plan with ' + r.changes + ' change' + (r.changes === 1 ? '' : 's') : 'Nothing new to add', null, 350); })
            .then(function () {
              if (r.changes) applyPlan(turn, r.plan, 'Added evening sundowners and walks', r.changes);
              return say(turn, fill(replies.nightlife || 'I added twilight stops for unhurried evenings.', c2));
            }).then(function () { suggest(turn, chipsFor(d, text)); });
        });
      case 'experience':
        if (!hasPlan) return reply(turn, 'I can suggest experiences around each day once we have a route. How many days would you like to spend in ' + d.name + '?', [{ label: d.prompt || ('Plan a trip to ' + d.name) }]);
        return tick(turn, 250).then(function () {
          var seenIdeas = {}, th = threadById(getTrip(turn.tripId), turn.threadId);
          (th && th.messages || []).forEach(function (m) { (m.blocks || []).forEach(function (block) { if (block.t === 'experience-ideas') (block.groups || []).forEach(function (group) { (group.items || []).forEach(function (item) { seenIdeas[item.id] = true; }); }); }); });
          var experiences = experienceIdeasBlock(d, trip.plan, false, seenIdeas);
          if (!experiences) return reply(turn, 'I have shown the experience ideas in Friday’s guide for this route. We can change a day or area to explore different places.', chipsFor(d, text));
          addBlock(turn, { t: 'text', text: 'Here are more places to consider around your days. Open any card for details or add it to the plan.' });
          addBlock(turn, experiences); save(turn); suggest(turn, chipsFor(d, text));
        });
      case 'dayedit':
        return dayEdit(turn, d, trip, q, replies, text);
      default:
        return reply(turn, fill(replies.fallback || "I can curate stays, add regional tables, or soften the itinerary pace. What would you like to refine?", ctx), chipsFor(d, text));
    }
  }
  /* A destination with no curated data: same clarifier, honest answer, no invented places. */
  function genericDest(name) {
    return {
      name: name,
      clarify: {
        types: { q: 'How should we shape your journey in ' + name + '?', options: ['Considered & relaxed', 'Heritage, food & living culture', 'Nature, landscapes & wildlife', 'Evening culture & nightlife'] },
        duration: { q: 'How many days would you like to dedicate to this journey?', options: [{ label: 'A considered weekend (3–4 days)', days: 4 }, { label: 'An unhurried week (~7 days)', days: 7 }, { label: 'A deeper immersion (~10–14 days)', days: 14 }] }
      }
    };
  }
  function honestText(name) {
    return "I do not have detailed place suggestions for **" + name + "** yet. Detailed suggestions are currently available for " + curatedNames() + '. Pick one and I will build it with you.';
  }
  function respondGeneric(turn, trip, text, q) {
    var name = trip.destName, replied = trip.prefs && trip.prefs.types && trip.prefs.types.length;
    if (/\b(reserve|reservations?|book|booking|bookings|buy)\b/.test(q)) {
      return reply(turn, "I can't make reservations from the planner. I can help shape your itinerary; confirm prices and availability with each provider before booking. [Talk with a Friday travel designer](#call-me-back) if you'd like help with your trip plan.", curatedChips());
    }
    if (!replied) {
      return tick(turn, 450).then(function () {
        var b = planClarifier(genericDest(name));
        b.generic = true;
        addBlock(turn, b);
        var msg = M(turn); msg.waiting = true; msg.done = false;
        save(turn); focusClarifier(b.id);
      });
    }
    return reply(turn, honestText(name), curatedChips());
  }
  function genericFlow(turn, b, trip) {
    var am = ansOf(b, 'month'), at = ansOf(b, 'types'), ad = ansOf(b, 'duration');
    var types = at && at.val && at.val.types || [];
    var days = ad && ad.val && ad.val.days || 7;
    var month = am && am.val || null;
    setTripPrefs(trip.id, { month: month, types: types, days: days, dates: null, base: null });
    var mem = [];
    if (at && !at.decided && types.length) mem.push('Likes ' + types.map(lcfirst).join(' and ') + ' trips');
    if (ad && !ad.decided) mem.push('Likes trips of around ' + days + ' days');
    addMemory(mem);
    return tick(turn, 0).then(function () { setThinking(turn, true); return tick(turn, 700); })
      .then(function () { return say(turn, honestText(trip.destName)); })
      .then(function () { suggest(turn, curatedChips()); });
  }
  function foodCtx(d, ids, kind) {
    var c = {};
    var k = kind === 'night' ? 'night' : 'food';
    ids.forEach(function (id, i) {
      var p = d.places[id];
      c[k + (i + 1)] = p.name; c[k + (i + 1) + 'Area'] = areaLabel(d, p.area);
    });
    return c;
  }
  function dayEdit(turn, d, trip, q, replies, text) {
    var plan = clone(trip.plan), nums = [], re = /\bday\s*(\d+)/g, m;
    while ((m = re.exec(q))) nums.push(+m[1]);
    var msgTxt, changes = 1;
    if (/swap/.test(q) && nums.length >= 2) {
      var a = nums[0] - 1, b = nums[1] - 1;
      if (plan.days[a] && plan.days[b] && a !== b) {
        var ia = plan.days[a].items; plan.days[a].items = plan.days[b].items; plan.days[b].items = ia;
        var ar = plan.days[a].area, tw = plan.days[a].town;
        plan.days[a].area = plan.days[b].area; plan.days[a].town = plan.days[b].town; plan.days[b].area = ar; plan.days[b].town = tw;
        msgTxt = 'Swapped **Day ' + nums[0] + '** and **Day ' + nums[1] + '**. The dates stay where they were.'; changes = 2;
      }
    } else {
      var di = (nums[0] || 1) - 1, day = plan.days[di];
      if (day && day.items.length) {
        var idx = -1;
        day.items.forEach(function (it, i) { var p = it.place && P(d, it.place); if (p && q.indexOf(p.name.toLowerCase()) >= 0) idx = i; });
        if (/swap|replace/.test(q)) {
          if (idx < 0) { var w = 1e9; day.items.forEach(function (it, i) { if (!it.place || !P(d, it.place) || isStay(d, it.place)) return; var r = P(d, it.place).rating || 4.5; if (r < w) { w = r; idx = i; } }); }
          var old = idx >= 0 && day.items[idx].place ? P(d, day.items[idx].place) : null, used = usedSet(plan);
          var alt = Object.keys(d.places).filter(function (id) { return !used[id] && d.places[id].kind !== 'stay' && d.places[id].area === day.area; })
            .sort(function (x, y) { return (d.places[y].rating || 0) - (d.places[x].rating || 0); })[0];
          if (alt && old) { day.items[idx] = mkItem(alt, d.places[alt].blurb || ''); msgTxt = 'Swapped **' + old.name + '** for **' + d.places[alt].name + '** on Day ' + (di + 1) + '.'; }
        } else {
          if (idx < 0) for (var k = day.items.length - 1; k >= 0; k--) if (day.items[k].place && !isStay(d, day.items[k].place)) { idx = k; break; }
          if (idx >= 0 && day.items.length > 1 && P(d, day.items[idx].place)) { var gone = P(d, day.items[idx].place); day.items.splice(idx, 1); msgTxt = 'Removed **' + gone.name + '** from Day ' + (di + 1) + '.'; }
        }
      }
    }
    if (!msgTxt) return reply(turn, "I couldn't find a change to make there. Try naming a day and a place, like \"remove Baga Beach from day 2\".", chipsFor(d, text));
    return tick(turn, 450).then(function () { return tool(turn, 'Updated plan with ' + changes + ' change' + (changes === 1 ? '' : 's'), null, 350); })
      .then(function () { applyPlan(turn, plan, 'Edited a day', changes); return say(turn, msgTxt); })
      .then(function () { suggest(turn, chipsFor(d, text)); });
  }

  function detectDest(q) {
    var best = null, bi = 1e9;
    order().forEach(function (id) {
      var d = DEST(id); if (!d) return;
      var words = (d.match || []).concat([d.name.toLowerCase()]);
      words.forEach(function (w) {
        var m = new RegExp('(^|[^a-z])' + String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])').exec(q);
        if (m && m.index < bi) { bi = m.index; best = id; }
      });
    });
    return best;
  }

  /* --- clarifier continuation --- */
  function continueFlow(turn, b) {
    var trip = getTrip(turn.tripId);
    if (b.kind === 'switch') return switchFlow(turn, b, trip);
    var d = DEST(trip.destId);
    if (!d) return genericFlow(turn, b, trip);
    if (b.kind === 'plan') return planFlow(turn, b, trip, d);
    return stayFlow(turn, b, trip, d);
  }
  function ansOf(b, key) { var q = b.qs.filter(function (x) { return x.key === key; })[0]; return q && q.ans; }
  function planFlow(turn, b, trip, d) {
    var am = ansOf(b, 'month'), at = ansOf(b, 'types'), ad = ansOf(b, 'duration');
    var types = at && at.val && at.val.types || [];
    if (!types.length) { var to = d.clarify && d.clarify.types && d.clarify.types.options; types = [to && to[0] ? (typeof to[0] === 'string' ? to[0] : to[0].label) : typeOptions(d)[0]]; }
    var days = ad && ad.val && ad.val.days || 7;
    var month = am && am.val || null;
    setTripPrefs(trip.id, { month: month, types: types, days: days, dates: null, base: null });
    var mem = [];
    if (at && !at.decided && types.length) mem.push('Likes ' + types.map(lcfirst).join(' and ') + ' trips');
    if (ad && !ad.decided) mem.push('Likes trips of around ' + days + ' days');
    if (am && !am.decided && month) mem.push('Prefers travelling in ' + MONTHS[month.m - MB]);
    if (b.originGiven && b.origin) mem.push('Flies from ' + b.origin);
    addMemory(mem);
    trip = getTrip(trip.id);
    var prefs = trip.prefs;
    /* ask for the plan now so it is ready when the research block finishes; the local generator answers if there is no backend */
    var planOpts = { types: types, days: days, dates: null, deep: true, pace: 'normal', travel: travelFor(d, b) };
    var planP = requestPlan(d, planOpts, turn, trip), plan = null;
    var c = ctxFor(d, trip, { days: clamp(Math.round(days), 1, 21) });
    var sub = d.name + (month ? ', ' + MONTHS[month.m - MB] + ' ' + month.y : '');
    var rb = researchBlock(d, { sub: sub, brief: { destination: d.name, days: days, style: types.slice(0, 2).join(' · ') } });
    return tick(turn, 500).then(function () { addBlock(turn, rb); return runResearch(turn, rb, planP); })
      .then(function () { return tick(turn, 300); })
      .then(function () { var rp = reportBlock(d); addBlock(turn, rp); return runReport(turn, rp); })
      .then(function () { return tick(turn, 400); })
      .then(function () { return planP; })
      .then(function (p) { plan = p; return null; })
      .then(function () { return tool(turn, 'Created plan with ' + countItems(plan) + ' stops', null, 350); })
      .then(function () { applyPlan(turn, plan, 'Created a ' + plan.days.length + '-day plan from research', countItems(plan)); return tick(turn, 300); })
      .then(function () {
        c.stay = plan.stay && P(d, plan.stay) ? P(d, plan.stay).name : '';
        var first = String((d.replies && d.replies.planDone) || 'Your plan is ready.').split(/\n{2,}/)[0];
        return say(turn, fill(first, c) + '\n\nI built it from those sources' + (c.stay ? ' and based you at **' + c.stay + '**' : '') + '. Tell me your exact dates and I can place stay ideas alongside the route. Friday can confirm prices and availability separately.');
      })
      .then(function () { var ideas = stayIdeasBlock(d, plan); if (ideas) { addBlock(turn, ideas); save(turn); } })
      .then(function () { var experiences = experienceIdeasBlock(d, plan, false); if (experiences) { addBlock(turn, experiences); save(turn); } })
      .then(function () { suggest(turn, chipsFor(d)); });
  }
  function stayFlow(turn, b, trip, d) {
    var ad = ansOf(b, 'dates'), ab = ansOf(b, 'base');
    var dates = ad && ad.val && ad.val.start ? { start: ad.val.start, end: ad.val.end } : null;
    var baseLabel = ab && ab.val && ab.val.label || null;
    setTripPrefs(trip.id, { dates: dates, base: baseLabel });
    if (ab && !ab.decided && baseLabel) addMemory(['Prefers a base: ' + lcfirst(baseLabel)]);
    trip = getTrip(trip.id);
    var r = stayEdit(d, trip.plan, dates, baseLabel);
    var replies = d.replies || {};
    var c = ctxFor(d, trip, Object.assign({ stay: r.stay ? d.places[r.stay].name : '' }, foodCtx(d, r.foods.map(function (f) { return f.id; })), {}));
    var dated = r.plan.days.filter(function (x) { return x.date; });
    c.range = dated.length ? fmtRange(dated[0].date, dated[dated.length - 1].date) : '';
    var st = d.stays || {};
    var rb = researchBlock(d, { short: true, sub: d.name + ' stays', offset: 2, brief: tripBrief(trip) });
    var steps = tick(turn, 0).then(function () { addBlock(turn, rb); return runResearch(turn, rb); });
    return steps
      .then(function () { return say(turn, fill(replies.staysIntro || 'I will pick a well-placed base and add a few dining stops.', c)); })
      .then(function () { return tick(turn, 150); })
      .then(function () { return tool(turn, 'Updated todo list', todo(['Confirm the dates', 'Shortlist hotels', 'Choose a base', 'Add dining stops'], 1)); })
      .then(function () { return tool(turn, 'Shortlisted ' + (st.ids || []).length + ' stay ideas from Friday’s guide', stayDetail(d)); })
      .then(function () { return tool(turn, 'Updated plan with ' + r.changes + ' change' + (r.changes === 1 ? '' : 's')); })
      .then(function () { return tool(turn, 'Updated todo list', todo(['Confirm the dates', 'Shortlist hotels', 'Choose a base', 'Add dining stops'], 4), 300); })
      .then(function () { applyPlan(turn, r.plan, 'Set dates and added a stay', r.changes); return tick(turn, 300); })
      .then(function () { return say(turn, fill(replies.staysDone || 'Your plan now has dates and a base.', c)); })
      .then(function () { var ideas = stayIdeasBlock(d, r.plan); if (ideas) { addBlock(turn, ideas); save(turn); } })
      .then(function () { var experiences = experienceIdeasBlock(d, r.plan, false); if (experiences) { addBlock(turn, experiences); save(turn); } })
      .then(function () { suggest(turn, chipsFor(d)); });
  }

  /* ------------------------------------------------------------ turn lifecycle */
  function run(turn, fn) {
    var outcome = 'completed';
    return Promise.resolve().then(fn).catch(function (e) {
      outcome = e === STOP ? 'stopped' : 'failed';
      if (e !== STOP) console.error('chat turn', e);
    }).then(function () {
      if (turn.ticker) clearInterval(turn.ticker);
      if (cur !== turn) return;
      if (!turn.stopped) {
        var msg = M(turn);
        if (!msg) { cur = null; setBusy(false); return; }
        if (msg) { msg.thinking = false; if (!msg.waiting) msg.done = true; }
        cur = null; setBusy(false); persist(turn.tripId, true); sync(turn);
        return auditMessage(turn.tripId, turn.threadId, msg, outcome, null, turn.ownerId).catch(function (error) { console.error('conversation audit', error); toast('Friday could not save this reply for review. Please try again.', true); });
      }
    });
  }
  function beginTurn(tripId, threadId, msgId) {
    var turn = { tripId: tripId, threadId: threadId, msgId: msgId, ownerId:FT.backend&&FT.backend.auditOwnerId, stopped: false };
    cur = turn; setBusy(true);
    return turn;
  }

  function fallbackTripId(opts) {
    if (opts && opts.tripId && getTrip(opts.tripId)) return opts.tripId;
    var t = null;
    try { t = FT.store.trip(); } catch (e) { /* ignore */ }
    if (t) return t.id;
    var s = FT.store.get(), list = (s.trips || []).slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    return list[0] ? list[0].id : null;
  }

  chat.send = function (opts) {
    opts = opts || {};
    var text = String(opts.text || '').trim();
    if (chat.busy) return;
    var atts = (opts.attachments || []).map(function (a) { return { name: a && a.name ? String(a.name) : 'image' }; });
    if (!text && !atts.length) return;
    if (chat.busy) return;
    var tripId = fallbackTripId(opts);
    if (!tripId) return;
    var th = ensureThread(tripId);
    if (!th) return;
    if (text && FT.integrations && FT.integrations.shouldDecline && FT.integrations.shouldDecline(text)) {
      var refusalId=uid('m_');
      var refusalOwner=FT.backend&&FT.backend.auditOwnerId;
      auditStandalone(tripId,th.id,refusalId,'user',{text:text},'completed',null,refusalOwner).then(function(){return auditStandalone(tripId,th.id,refusalId+'_reply','assistant',{text:'Friday focuses on planning trips, bookings, stays, and travel packages.'},'completed',null,refusalOwner);}).then(function(){toast('Friday focuses on planning trips, bookings, stays, and travel packages.');}).catch(function(e){toast(e.message||'Friday could not save this conversation for review.',true);});
      return;
    }
    if (!th.reelChat && !/https:\/\/(?:www\.)?(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|pinterest\.com|x\.com|twitter\.com)\//i.test(text) && text && FT.integrations && FT.integrations.shouldUseFridayPlan && FT.integrations.shouldUseFridayPlan(text) && FT.backend && FT.backend.user) {
      var planEventId=uid('m_');
      var planOwner=FT.backend&&FT.backend.auditOwnerId;
      auditStandalone(tripId,th.id,planEventId,'user',{text:text},'completed',null,planOwner).then(function(){FT.integrations.openFridayPlan({ tripId: opts.tripId||tripId, message: text, conversationId: th.id, ownerId:planOwner });}).catch(function(e){toast(e.message||'Friday could not save this conversation for review.',true);});
      return;
    }
    var trip = getTrip(tripId);
    var um = newMsg('user', { text: text, attachments: atts });
    var am = newMsg('assistant', { blocks: [], done: false, waiting: false, thinking: true, stopped: false, fb: null });
    /* older, unanswered clarifiers are skipped */
    th.messages.forEach(function (m) {
      if (m.role !== 'assistant') return;
      (m.blocks || []).forEach(function (b) { if (b.t === 'clarify' && !b.submitted && !b.superseded) { b.superseded = true; touch(b); } });
      if (m.waiting) { m.waiting = false; m.done = true; }
    });
    var title = null;
    th.messages.push(um, am);
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === tripId; })[0];
      if (!t) return;
      t.updatedAt = new Date().toISOString();
      var tt = threadById(t, th.id);
      if (tt && t.destId && (!tt.title || tt.title === 'New conversation') && text) title = tt.title = text.length > 34 ? text.slice(0, 32).trim() + '…' : text;
    });
    stick = true;
    var turn = beginTurn(tripId, th.id, am.id); turn.mode = opts.mode === 'fast' ? 'fast' : 'deep';
    if (root && mountedKey === tripId + '/' + th.id) { var ctx = mountedCtx(); if (ctx) syncThread(ctx.trip, ctx.th); }
    scrollEnd(true);
    Promise.all([auditMessage(tripId,th.id,um,'completed',null,turn.ownerId),auditMessage(tripId,th.id,am,'started',null,turn.ownerId)]).then(function(){if(cur===turn&&!turn.stopped)run(turn, function () { return respond(turn, text); });}).catch(function(error){
      console.error('conversation audit',error);if(cur===turn){cur=null;setBusy(false);}
      toast(error.message||'Friday could not save this question for review. Please try again.',true);
    });
  };

  chat.stop = function () {
    var turn = cur; if (!turn) return;
    turn.stopped = true;
    if (turn.wake) turn.wake();
    if (turn.ticker) clearInterval(turn.ticker);
    var msg = M(turn);
    if (msg) {
      msg.thinking = false; msg.done = true; msg.stopped = true; msg.waiting = false;
      (msg.blocks || []).forEach(function (b) {
        if (b.t === 'research' && !b.done) { b.stopped = true; b.done = true; touch(b); }
        if (b.t === 'report' && b.shown < 99) { b.shown = 99; touch(b); }
        if (b.t === 'clarify' && !b.submitted) { b.superseded = true; touch(b); }
      });
    }
    cur = null; setBusy(false);
    persist(turn.tripId); sync(turn);
    if(msg)auditMessage(turn.tripId,turn.threadId,msg,'stopped',null,turn.ownerId).catch(function(error){console.error('conversation audit',error);toast('Friday could not save this stopped reply for review.',true);});
  };

  function doSubmit(msg, b) {
    var ctx = mountedCtx(); if (!ctx || chat.busy) return;
    var trip = ctx.trip;
    b.submitted = true; b.qi = -1; touch(b);
    msg.waiting = false; msg.done = false; msg.thinking = true;
    var turn = beginTurn(trip.id, ctx.th.id, msg.id);
    persist(trip.id); sync(turn); stick = true; scrollEnd(true);
    var answerId=msg.id+'_clarification_'+(b.id||'answer');
    auditStandalone(trip.id,ctx.th.id,answerId,'user',{kind:b.kind,answers:(b.qs||[]).map(function(q){return {key:q.key,question:q.q,answer:q.ans||null};})},'completed','clarification_answer',turn.ownerId).then(function(){if(cur===turn&&!turn.stopped)run(turn, function () { return continueFlow(turn, b); });}).catch(function(error){if(cur===turn){cur=null;setBusy(false);}toast(error.message||'Friday could not save this answer for review.',true);});
  }

  chat.newThread = function () {
    var trip = null;
    try { trip = FT.store.trip(); } catch (e) { /* ignore */ }
    if (!trip) return;
    if (cur) chat.stop();
    FT.store.update(function (s) {
      var t = s.trips.filter(function (x) { return x.id === trip.id; })[0];
      if (!t) return;
      var th = { id: uid('th_'), title: 'New conversation', createdAt: new Date().toISOString(), messages: [] };
      t.threads = t.threads || []; t.threads.push(th); t.activeThreadId = th.id;
    });
    stick = true;
    chat.render(getTrip(trip.id));
  };

  /* ------------------------------------------------------------ rendering */
  function scrollEnd(force) {
    if (!root) return;
    if (!force && !stick) return;
    var go = function () { if (root && (force || stick)) root.scrollTop = root.scrollHeight; };
    go();
    if (window.requestAnimationFrame) requestAnimationFrame(go);
  }
  function chipHTML(it, i) {
    return '<button type="button" class="ch-chip" data-act="chip" data-i="' + i + '">' + icon('sparkle', 15) + '<span>' + esc(it.label) + '</span></button>';
  }
  function emptyHTML(trip) {
    var d = trip && DEST(trip.destId), hasPlan = !!(trip && trip.plan && trip.plan.days && trip.plan.days.length);
    var title = hasPlan ? 'What shall we refine?' : (d ? ('Shaping your time in ' + d.name) : 'Where shall we begin?');
    var sub = hasPlan ? 'Ask to pace the days, curate characterful stays, or uncover evening tables.' : (d ? 'Tell me how you travel and I will compose an itinerary tailored to your tempo.' : 'Name a destination or aesthetic, and we will tailor every day, stay, and route.');
    var chips;
    if (hasPlan && d && d.suggestions) chips = d.suggestions.slice(0, 3).map(function (s) { return { label: s }; });
    else if (d) chips = [{ label: d.prompt || ('Shape an itinerary for ' + d.name) }, { label: 'Pace the days more leisurely' }, { label: 'Curate design-led stays & tables' }];
    else chips = order().slice(0, 3).map(function (id) { var dd = DEST(id); return dd ? { label: dd.prompt || ('Explore ' + dd.name), dest: id } : null; }).filter(Boolean);
    return { html: '<div class="ch-empty__mark" aria-hidden="true"></div><h2 class="ch-empty__t">' + title + '</h2><p class="ch-empty__s">' + esc(sub) + '</p><div class="ch-chips">' + chips.map(chipHTML).join('') + '</div>', chips: chips };
  }
  var emptyChips = [];
  function renderEmpty(col, trip) {
    var old = col.querySelector('.ch-empty');
    var e = emptyHTML(trip);
    var sig = e.html;
    if (old && old.dataset.sig === sig) return;
    emptyChips = e.chips;
    var el = document.createElement('div');
    el.className = 'ch-empty'; el.dataset.sig = sig; el.innerHTML = e.html;
    if (old) old.replaceWith(el); else col.appendChild(el);
  }

  function userEl(msg) {
    var el = document.createElement('div');
    el.className = 'ch-msg ch-msg--user'; el.dataset.mid = msg.id;
    var h = '';
    if (msg.attachments && msg.attachments.length) {
      h += '<div class="ch-atts">' + msg.attachments.map(function (a) { return '<span class="ch-att">' + icon('image', 14) + '<span>' + esc(a.name) + '</span></span>'; }).join('') + '</div>';
    }
    if (msg.text) h += '<div class="ch-bubble">' + esc(msg.text) + '</div>';
    el.innerHTML = h;
    return el;
  }
  function botEl(msg) {
    var el = document.createElement('div');
    el.className = 'ch-msg ch-msg--bot'; el.dataset.mid = msg.id;
    el.innerHTML = '<div class="ch-blocks"></div><div class="ch-foot"></div><div class="ch-sugs"></div>';
    return el;
  }
  function msgPlain(msg) {
    var out = [];
    (msg.blocks || []).forEach(function (b) { if (b.t === 'text' && b.text) out.push(b.text.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')); });
    if (!out.length) (msg.blocks || []).forEach(function (b) { if (b.t === 'report') out.push(reportText(b)); });
    return out.join('\n\n');
  }
  function footHTML(msg) {
    var h = '';
    if (msg.thinking) h += '<div class="ch-think"><span>Friday is opening the notebook…</span></div>';
    if (msg.stopped) h += '<div class="ch-stopped"><i></i>Stopped</div>';
    if (msg.done && !msg.stopped && (msg.blocks || []).some(function (b) { return b.t === 'text' || b.t === 'report'; })) {
      h += '<div class="ch-fb">' +
        '<button type="button" class="ch-ic" data-act="copy" aria-label="Copy" title="Copy">' + icon('copy', 17) + '</button>' +
        '<button type="button" class="ch-ic' + (msg.fb === 'up' ? ' is-on' : '') + '" data-act="up" aria-label="Good response" aria-pressed="' + (msg.fb === 'up') + '" title="Good response">' + icon('thumb-up', 17) + '</button>' +
        '<button type="button" class="ch-ic' + (msg.fb === 'down' ? ' is-on' : '') + '" data-act="down" aria-label="Bad response" aria-pressed="' + (msg.fb === 'down') + '" title="Bad response">' + icon('thumb-down', 17) + '</button>' +
        '</div>';
    }
    return h;
  }
  function syncBlocks(cont, list, msg) {
    var existing = {};
    Array.prototype.forEach.call(cont.children, function (c) { existing[c.dataset.bid] = c; });
    var seen = {};
    list.forEach(function (b, i) {
      seen[b.id] = 1;
      var node = existing[b.id];
      if (!node || node.dataset.rev !== String(b.rev || 0)) {
        var fresh = renderBlock(msg, b);
        fresh.dataset.bid = b.id; fresh.dataset.rev = String(b.rev || 0);
        if (node && node.parentNode) {
          var hadFocus = node.contains(document.activeElement);
          syncing++;
          try { node.replaceWith(fresh); } finally { syncing--; }
          if (hadFocus) { var f = fresh.querySelector('.ch-card'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
        }
        node = fresh; existing[b.id] = fresh;
      }
      if (cont.children[i] !== node) cont.insertBefore(node, cont.children[i] || null);
    });
    Object.keys(existing).forEach(function (id) { if (!seen[id]) existing[id].remove(); });
  }
  function syncMessage(el, msg) {
    if (msg.role === 'user') return;
    var all = msg.blocks || [];
    syncBlocks(el.querySelector('.ch-blocks'), all.filter(function (b) { return b.t !== 'suggest'; }), msg);
    syncBlocks(el.querySelector('.ch-sugs'), all.filter(function (b) { return b.t === 'suggest'; }), msg);
    var foot = el.querySelector('.ch-foot');
    var sig = [msg.done, msg.stopped, msg.thinking, msg.fb, all.length].join('|');
    if (foot.dataset.sig !== sig) { foot.dataset.sig = sig; foot.innerHTML = footHTML(msg); }
  }
  function syncThread(trip, th) {
    var col = root.querySelector('.ch-col');
    if (!col) { col = document.createElement('div'); col.className = 'ch-col'; root.appendChild(col); }
    if (!th.messages.length) {
      Array.prototype.slice.call(col.querySelectorAll('.ch-msg')).forEach(function (n) { n.remove(); });
      renderEmpty(col, trip); return;
    }
    var e = col.querySelector('.ch-empty'); if (e) e.remove();
    var have = {};
    Array.prototype.forEach.call(col.querySelectorAll('.ch-msg'), function (n) { have[n.dataset.mid] = n; });
    var seen = {};
    th.messages.forEach(function (m, i) {
      seen[m.id] = 1;
      var n = have[m.id];
      if (!n) { n = m.role === 'user' ? userEl(m) : botEl(m); have[m.id] = n; }
      if (col.children[i] !== n) col.insertBefore(n, col.children[i] || null);
      syncMessage(n, m);
    });
    Object.keys(have).forEach(function (id) { if (!seen[id]) have[id].remove(); });
  }

  /* --- block renderers --- */
  function renderBlock(msg, b) {
    var el = document.createElement('div');
    switch (b.t) {
      case 'text':
        el.className = 'ch-prose'; el.innerHTML = md(b.text); break;
      case 'tool':
        el.className = 'ch-tool' + (b.open ? ' is-open' : '');
        el.innerHTML = toolHTML(b); break;
      case 'suggest':
        el.className = 'ch-chips'; el.innerHTML = b.items.map(chipHTML).join(''); break;
      case 'clarify':
        el.className = 'ch-clar'; el.innerHTML = clarifyHTML(b); break;
      case 'research':
        el.className = 'ch-r' + (b.done && b.collapsed ? ' is-sum' : ''); el.innerHTML = researchHTML(b); break;
      case 'report':
        el.className = 'ch-rep'; el.innerHTML = reportHTML(b); break;
      case 'places':
        el.className = 'ch-placecards'; el.innerHTML = placeCardsHTML(b); break;
      case 'stay-ideas':
        el.className = 'ch-stayideas'; el.innerHTML = stayIdeasHTML(b); break;
      case 'experience-ideas':
        el.className = 'ch-experiences'; el.innerHTML = experienceIdeasHTML(b); break;
      case 'friday-listings':
        el.className = 'ch-friday-listings'; el.innerHTML = '<p class="ch-friday-listings__lead">Choose a Friday listing to shape the package. Published itineraries are samples; the team confirms price and availability.</p><div class="ch-friday-listings__grid">' + (b.listings || []).map(function (l, i) { return '<article class="ch-friday-listing"><span>' + esc((l.type || 'Friday listing') + (l.city ? ' · ' + l.city : '')) + '</span><strong>' + esc(l.title || 'Travel option') + '</strong>' + (l.summary ? '<p>' + esc(l.summary) + '</p>' : '') + (webUrl(l.url) ? '<a href="' + esc(webUrl(l.url)) + '" target="_blank" rel="noopener noreferrer">View listing</a>' : '') + '<button type="button" class="ch-pill ch-pill--ink" data-act="friday-listing" data-listing-index="' + i + '">Choose for package</button></article>'; }).join('') + '</div>'; break;
      case 'draft':
        el.className = 'ch-prose ch-research-draft';
        el.innerHTML = '<h3>' + (b.applied ? 'Itinerary applied' : b.superseded ? 'Earlier itinerary proposal' : 'Itinerary proposal') + '</h3><p>' + (b.applied ? 'This proposal is now in your plan. You can edit it or undo the plan change.' : b.superseded ? 'A newer research proposal is available. This earlier proposal can no longer be applied.' : 'Review the research before adding it to your plan. Your current plan stays unchanged.') + '</p><ol>' + (b.days || []).map(function (d) { return '<li><strong>' + esc(d.title) + (d.date ? ' · ' + esc(d.date) : '') + '</strong><ul>' + (d.items || []).map(function (it) { return '<li>' + esc(it.time ? it.time + ' · ' : '') + esc(it.title) + (it.note ? ' — ' + esc(it.note) : '') + '</li>'; }).join('') + '</ul></li>'; }).join('') + '</ol>' + (b.applied ? '<span class="ch-pill is-disabled" aria-disabled="true">Applied to plan</span>' : b.superseded ? '<span class="ch-pill is-disabled" aria-disabled="true">Superseded</span>' : '<button type="button" class="ch-pill ch-pill--ink" data-act="research-review">Review and apply itinerary</button>');
        break;
      default:
        el.className = 'ch-unk';
    }
    return el;
  }
  function stayIdeasHTML(b) {
    var d = DEST(b.destId);
    if (!d) return '';
    var ctx = mountedCtx(), trip = ctx && ctx.trip;
    var inPlan = {};
    if (trip && trip.plan) (trip.plan.days || []).forEach(function (day) { (day.items || []).forEach(function (item) { if (item.place) inPlan[item.place] = true; }); });
    var groups = (b.groups || []).map(function (group, groupIndex) {
      var days = group.from ? 'Day ' + group.from + (group.to > group.from ? '–' + group.to : '') : 'Friday’s guide';
      var when = group.dateStart && group.dateEnd ? ' · ' + fmtStayDays(group.dateStart, group.dateEnd) : '';
      var cards = (group.ids || []).map(function (id) {
        var p = P(d, id); if (!p || p.kind !== 'stay') return '';
        var saved = !!(FT.saved && FT.saved.has && FT.saved.has(d.id, id));
        var art = '';
        if (FT.plate) { try { art = FT.plate(p.seed || d.id + '-' + id, { scene: p.scene || 'city', tone: p.tone || 'sand', ratio: 'square' }); } catch (e) { /* keep the paper placeholder */ } }
        return '<article class="ch-stayidea"><div class="ch-stayidea__art" aria-hidden="true">' + art + '</div>' +
          '<div class="ch-stayidea__body"><span class="ch-stayidea__type">' + esc(p.label || 'Stay') + '</span><h4>' + esc(p.name) + '</h4>' +
          (p.blurb ? '<p>' + esc(p.blurb) + '</p>' : '') + '<div class="ch-stayidea__actions">' +
          (group.from ? '<button type="button" class="ch-pill ch-pill--ink" data-act="stay-add" data-stay-id="' + esc(id) + '" data-stay-group="' + groupIndex + '"' + (inPlan[id] ? ' disabled' : '') + '>' + (inPlan[id] ? 'In plan' : 'Add to plan') + '</button>' : '') +
          '<button type="button" class="ch-stayidea__map" data-act="stay-save" data-stay-id="' + esc(id) + '" aria-pressed="' + saved + '">' + (saved ? 'Saved' : 'Save idea') + '</button>' +
          (Array.isArray(p.at) && p.at.length === 2 ? '<button type="button" class="ch-stayidea__map" data-act="stay-map" data-stay-id="' + esc(id) + '">View on map</button>' : '') +
          '</div></div></article>';
      }).join('');
      return cards ? '<section class="ch-stayideas__group"><div class="ch-stayideas__heading"><span>' + esc(days + when) + '</span><h3>Stay ideas near ' + esc(areaLabel(d, group.area) || group.area) + '</h3></div><div class="ch-stayideas__grid">' + cards + '</div></section>' : '';
    }).join('');
    return groups ? '<p class="ch-stayideas__intro">' + (b.general ? 'Stay ideas from Friday’s destination guide. Save the ones you like while you review the proposed itinerary. ' : 'Places to consider along this route. Add a stay to your working plan or save it for later. ') + 'Prices and availability need confirmation before booking.</p>' + groups : '';
  }
  function experienceIdeasHTML(b) {
    var ctx = mountedCtx(), trip = ctx && ctx.trip, inPlan = {};
    if (trip && trip.plan) (trip.plan.days || []).forEach(function (day) { (day.items || []).forEach(function (item) { if (item.place) inPlan[item.place] = true; }); });
    var groups = (b.groups || []).map(function (group, groupIndex) {
      var dayLabel = 'Day ' + (group.dayIndex + 1) + (group.date ? ' · ' + fmtStayDays(group.date, group.date) : '');
      var cards = (group.items || []).map(function (p) {
        var saved = !!(FT.saved && FT.saved.has && FT.saved.has(b.destId, p.id));
        var art = '';
        if (p.photo && webUrl(p.photo.url) && webUrl(p.photo.sourceUrl) && p.photo.attribution) art = '<img src="' + esc(webUrl(p.photo.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="ch-exp-card__credit">' + esc(p.photo.attribution) + '</span>';
        else if (FT.plate) { try { art = FT.plate(p.seed, { scene: p.scene, tone: p.tone, ratio: 'landscape' }); } catch (e) { /* keep the paper placeholder */ } }
        return '<article class="ch-exp-card"><div class="ch-exp-card__art">' + art + '</div><div class="ch-exp-card__body"><span class="ch-exp-card__type">' + esc(p.label) + '</span>' +
          '<h4>' + (b.proposal ? esc(p.name) : '<button type="button" data-act="experience-detail" data-exp-group="' + groupIndex + '" data-exp-id="' + esc(p.id) + '">' + esc(p.name) + '</button>') + '</h4>' +
          (p.rating != null && p.ratingSource && Number.isFinite(Number(p.rating)) ? '<span class="ch-exp-card__rating">★ ' + esc(Number(p.rating).toFixed(1)) + ' · ' + esc(p.ratingSource) + '</span>' : '') +
          (p.blurb ? '<p>' + esc(p.blurb) + '</p>' : '') + '<div class="ch-exp-card__actions">' +
          (b.proposal ? '<span class="ch-exp-card__state">In proposed itinerary</span>' : '<button type="button" class="ch-pill ch-pill--ink" data-act="experience-add" data-exp-group="' + groupIndex + '" data-exp-id="' + esc(p.id) + '"' + (inPlan[p.id] ? ' disabled' : '') + '>' + (inPlan[p.id] ? 'In plan' : 'Add to day ' + (group.dayIndex + 1)) + '</button><button type="button" class="ch-exp-card__link" data-act="experience-save" data-exp-group="' + groupIndex + '" data-exp-id="' + esc(p.id) + '" aria-pressed="' + saved + '">' + (saved ? 'Saved' : 'Save') + '</button>') +
          (webUrl(p.sourceUrl) ? '<a class="ch-exp-card__link" href="' + esc(webUrl(p.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' + esc(p.sourceLabel || 'Source') + '</a>' : '') +
          '</div></div></article>';
      }).join('');
      return '<section class="ch-experiences__group" data-exp-group="' + groupIndex + '"><div class="ch-experiences__head"><div><span>' + esc(dayLabel) + ' · Things to do</span><h3>Experiences in ' + esc(group.town) + '</h3></div><div class="ch-experiences__nav"><button type="button" data-act="experience-scroll" data-exp-group="' + groupIndex + '" data-dir="-1" aria-label="Previous experiences for day ' + (group.dayIndex + 1) + '">' + icon('chevron-left', 17) + '</button><button type="button" data-act="experience-scroll" data-exp-group="' + groupIndex + '" data-dir="1" aria-label="Next experiences for day ' + (group.dayIndex + 1) + '">' + icon('chevron-right', 17) + '</button></div></div><div class="ch-experiences__track" role="region" tabindex="0" aria-label="Experience ideas for day ' + (group.dayIndex + 1) + '">' + cards + '</div></section>';
    }).join('');
    return '<p class="ch-experiences__intro">' + (b.proposal ? 'Experiences included in this proposed route. Review the itinerary before adding it to your trip.' : 'More to explore along your route. Add an idea to the day, save it, or open its details. ') + 'Check opening details and ticket availability for your dates.</p>' + groups;
  }
  function placeCardsHTML(b) {
    return '<div class="ch-placecards__grid">' + (b.places || []).map(function (p, i) {
      var photo = p.photos && p.photos[0], src = photo && webUrl(photo.url), attribution = photo && (photo.attribution || photo.sourceUrl);
      return '<button type="button" class="ch-placecard" data-act="place-card" data-place-index="' + i + '">' + (src ? '<span class="ch-placecard__photo"><img src="' + esc(src) + '" alt="' + esc(p.title) + '" loading="lazy" referrerpolicy="no-referrer">' + (attribution ? '<span>' + esc(photo.attribution || 'Photo source') + '</span>' : '') + '</span>' : '<span class="ch-placecard__placeholder" aria-hidden="true">✳</span>') + '<span class="ch-placecard__body"><span class="ch-placecard__type">' + esc(p.category || p.address || 'A place to discover') + '</span><strong>' + esc(p.title) + '</strong>' + (p.description ? '<span>' + esc(p.description) + '</span>' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  function toolHTML(b) {
    var exp = !!b.detail;
    var row = '<span class="ch-tool__g" aria-hidden="true">✱</span><span class="ch-tool__t">' + esc(b.text) + '</span>' + (exp ? '<span class="ch-tool__chev">' + icon('chevron-right', 13) + '</span>' : '');
    var h = exp ? '<button type="button" class="ch-tool__row" data-act="tool" aria-expanded="' + !!b.open + '">' + row + '</button>' : '<div class="ch-tool__row">' + row + '</div>';
    if (exp && b.open) {
      h += '<div class="ch-tool__detail">';
      if (b.detail.kind === 'todo') h += '<ul class="ch-todo">' + b.detail.items.map(function (i) { return '<li class="' + (i.done ? 'is-done' : '') + '"><i>' + (i.done ? icon('check', 11) : '') + '</i>' + esc(i.t) + '</li>'; }).join('') + '</ul>';
      else h += '<ul class="ch-list">' + b.detail.items.map(function (i) { return '<li><span>' + esc(i.t) + '</span><em>' + esc(i.m || '') + '</em></li>'; }).join('') + '</ul>';
      h += '</div>';
    }
    return h;
  }

  /* --- clarifier --- */
  function optNum(i) { return '<span class="ch-opt__n">' + (i + 1) + '</span>'; }
  function calHTML(q) {
    var dr = q.draft, v = dr.view, first = new Date(v.y, v.m, 1), sd = first.getDay();
    var dim = new Date(v.y, v.m + 1, 0).getDate(), weeks = Math.ceil((sd + dim) / 7), today = todayIso();
    var r = dr.range || {}, h = '<div class="ch-cal"><div class="ch-cal__head"><span>' + MONTHS[v.m] + ' ' + v.y + '</span><span class="ch-cal__nav">' +
      '<button type="button" data-act="calnav" data-d="-1" aria-label="Previous month">' + icon('chevron-left', 15) + '</button>' +
      '<button type="button" data-act="calnav" data-d="1" aria-label="Next month">' + icon('chevron-right', 15) + '</button></span></div>' +
      '<div class="ch-cal__dow">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="ch-cal__grid">';
    for (var i = 0; i < weeks * 7; i++) {
      var dt = new Date(v.y, v.m, 1 - sd + i), iso = isoOf(dt), cls = 'ch-day';
      if (dt.getMonth() !== v.m) cls += ' is-out';
      if (iso < today) cls += ' is-past';
      if (r.start && iso === r.start) cls += ' is-start';
      if (r.end && iso === r.end) cls += ' is-end';
      if (r.start && r.end && iso > r.start && iso < r.end) cls += ' is-mid';
      h += '<button type="button" class="' + cls + '" data-act="day" data-iso="' + iso + '"' + (iso < today ? ' disabled' : '') + '>' + dt.getDate() + '</button>';
    }
    return h + '</div></div><p class="ch-cal__hint">' + (q.len ? 'Suggested length: ' + q.len + ' day' + (q.len === 1 ? '' : 's') + '. ' : '') + (r.start && !r.end ? 'Now pick the last day.' : 'Pick the first day, then the last.') + '</p>';
  }
  function activeQ(b, q, i, prefs) {
    var dr = q.draft || {}, sel = dr.sel || [], ok = !!commit(b, q, prefs);
    var h = '<div class="ch-q is-active" data-qi="' + i + '"><div class="ch-q__head"><span class="ch-q__mark' + (ok ? ' is-ok' : '') + '">' + (ok ? icon('check', 14) : '') + '</span><span class="ch-q__text">' + esc(q.q) + '</span></div><div class="ch-q__body">';
    if (q.type === 'month') {
      h += '<div class="ch-tiles">' + q.opts.map(function (o, k) {
        return '<button type="button" class="ch-tile' + (sel.indexOf(k) >= 0 ? ' is-sel' : '') + '" data-act="opt" data-i="' + k + '" aria-pressed="' + (sel.indexOf(k) >= 0) + '">' + (o.sub ? '<span>' + o.label + '</span><span>' + o.sub + '</span>' : '<span>' + o.label + '</span>') + '</button>';
      }).join('') + '</div>';
      h += '<input class="ch-free" data-act="free" type="text" placeholder="Type something else…" value="' + esc(dr.free || '') + '" autocomplete="off">';
    } else if (q.type === 'dates') {
      h += calHTML(q);
      h += '<input class="ch-free" data-act="free" type="text" placeholder="Type something else…" value="' + esc(dr.free || '') + '" autocomplete="off">';
    } else {
      if (q.type === 'multi') h += '<div class="ch-hint">Select all that apply</div>';
      h += '<div class="ch-opts" role="' + (q.type === 'multi' ? 'group' : 'radiogroup') + '">' + q.opts.map(function (o, k) {
        var on = sel.indexOf(k) >= 0;
        return '<button type="button" class="ch-opt' + (on ? ' is-sel' : '') + '" data-act="opt" data-i="' + k + '" role="' + (q.type === 'multi' ? 'checkbox' : 'radio') + '" aria-checked="' + on + '">' + optNum(k) + '<span class="ch-opt__l">' + esc(o.label) + '</span></button>';
      }).join('') +
        '<label class="ch-opt ch-opt--free">' + optNum(q.opts.length) + '<input class="ch-free ch-free--row" data-act="free" type="text" placeholder="Type something else…" value="' + esc(dr.free || '') + '" autocomplete="off"></label></div>';
    }
    h += '</div><div class="ch-q__actions">';
    var last = showSubmit(b, i);
    h += '<button type="button" class="ch-pill" data-act="decide">Let Friday decide</button>';
    if (last) h += '<button type="button" class="ch-pill ch-pill--ink" data-act="submit"' + (ok ? '' : ' disabled') + '>Submit answers <span class="ch-kbd">⌘↵</span></button>';
    else h += '<button type="button" class="ch-pill ch-pill--ink" data-act="next"' + (ok ? '' : ' disabled') + '>Next <span class="ch-kbd">' + icon('arrow-right', 13) + '</span></button>';
    return h + '</div></div>';
  }
  function clarifyHTML(b) {
    var ctx = mountedCtx(), prefs = ctx ? prefsForClarify(ctx.trip) : {};
    if (b.superseded && !b.submitted && !answered(b)) return '<div class="ch-skip">Questions skipped</div>';
    if (b.submitted || b.superseded) {
      var h = '<div class="ch-card is-done" data-cid="' + b.id + '"><ul class="ch-sum">';
      b.qs.forEach(function (q) { if (q.ans || b.submitted) h += '<li><span class="ch-sum__q">' + esc(q.q) + '</span> <b>' + esc(q.ans ? q.ans.label : '') + '</b></li>'; });
      h += '</ul>' + (b.submitted ? '<div class="ch-sum__ok">' + icon('check', 14) + 'Submitted</div>' : '<div class="ch-sum__skip">Skipped</div>') + '</div>';
      return h;
    }
    var n = b.qs.length, pct = Math.round(answered(b) / n * 100);
    var s = '<div class="ch-card" tabindex="0" data-cid="' + b.id + '" aria-label="Questions from Friday"><div class="ch-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + answered(b) + '"><i style="width:' + pct + '%"></i></div>';
    b.qs.forEach(function (q, i) {
      if (i === b.qi) s += activeQ(b, q, i, prefs);
      else if (q.ans) s += '<button type="button" class="ch-q ch-q--done" data-act="reopen" data-qi="' + i + '" title="Change this answer"><span class="ch-q__mark is-ok">' + icon('check', 14) + '</span><span class="ch-q__line"><span class="ch-q__text">' + esc(q.q) + '</span> <b>' + esc(q.ans.label) + '</b></span></button>';
      else s += '<div class="ch-q ch-q--pending"><span class="ch-q__mark"></span><span class="ch-q__text">' + esc(q.q) + '</span></div>';
    });
    if (b.qi === -1) s += '<div class="ch-q__actions ch-q__actions--foot"><button type="button" class="ch-pill ch-pill--ink" data-act="submit">Submit answers <span class="ch-kbd">⌘↵</span></button></div>';
    return s + '</div>';
  }
  function focusClarifier(bid) {
    setTimeout(function () {
      var a = document.activeElement;
      if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.value) return;
      var c = root && root.querySelector('[data-bid="' + bid + '"] .ch-card');
      if (c) { try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }, 30);
  }

  /* --- research --- */
  function favColor(i) { try { if (U().dayColor) return U().dayColor(i); } catch (e) { /* ignore */ } return ['#D97757', '#0A87A8', '#5B3FD6', '#178044', '#B721C9', '#2563EB', '#B45309'][i % 7]; }
  function makingHTML(b) {
    var brief = b.brief || {}, destination = brief.destination || b.sub || 'your journey';
    var activity = b.curated ? 'Working through Friday’s destination guide' : (b.steps[b.stepIdx] || 'Reading your request');
    var notes = b.curated ? [
      { name: 'Destination', value: destination },
      { name: 'Length', value: brief.days ? brief.days + ' ' + (brief.days === 1 ? 'day' : 'days') : 'To be shaped' },
      { name: 'Style', value: brief.style || 'Your pace, your way' }
    ] : [
      { name: 'Your request', value: brief.request || 'Travel research' },
      { name: 'Journey', value: destination },
      { name: 'Approach', value: 'Source-led research' }
    ];
    return '<div class="ch-making"><div class="ch-making__top"><span>Friday · At the design desk</span><span class="ch-making__time" aria-hidden="true">' + fmtClock(b.elapsed) + '</span><button type="button" data-act="rtoggle" aria-label="Minimise working view">' + icon('chevron-up', 14) + '</button></div>' +
      '<h2>' + (b.curated ? 'A journey is<br><em>taking shape.</em>' : 'Considering<br><em>the details.</em>') + '</h2><p class="ch-making__lead">' + (b.curated ? 'A considered route begins with the details you shared. Keep exploring your plan while Friday works.' : 'Your request stays in view while Friday checks the details and prepares a useful answer.') + '</p>' +
      '<div class="ch-making__route" aria-hidden="true"><svg viewBox="0 0 420 78" preserveAspectRatio="none"><path class="ch-making__path-base" d="M12 52 C78 52 78 16 152 16 S252 60 326 50 S383 22 408 22"/><path class="ch-making__path" d="M12 52 C78 52 78 16 152 16 S252 60 326 50 S383 22 408 22"/><circle cx="12" cy="52" r="5"/><circle cx="152" cy="16" r="5"/><circle cx="326" cy="50" r="5"/><circle cx="408" cy="22" r="5"/></svg>' + (b.curated ? '<span>THE BRIEF</span><span>THE ROUTE</span><span>THE STAYS</span><span>THE DETAILS</span>' : '<span>YOUR ASK</span><span>RESEARCH</span><span>CONTEXT</span><span>THE ANSWER</span>') + '</div>' +
      '<dl class="ch-making__brief">' + notes.map(function (n) { return '<div><dt>' + esc(n.name) + '</dt><dd>' + esc(n.value) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="ch-making__activity"><span class="ch-making__mark" aria-hidden="true"></span><div><span>Current activity</span><strong aria-live="polite">' + esc(activity) + '</strong></div></div>' +
      '<p class="ch-making__note">Friday will bring the research and itinerary back into this conversation.</p></div>';
  }
  function researchHTML(b) {
    var n = b.steps.length, srcN = b.sources.length;
    if (b.error) return '<div class="ch-r__end" role="alert"><span>Friday could not finish this research.</span><p>Your request is still here. Please try again when you are ready.</p></div>';
    if (b.stopped) return '<div class="ch-r__end"><span>Work stopped.</span><p>Your existing plan is still here.</p></div>';
    if (!b.done && b.collapsed) return '<button type="button" class="ch-making__compact" data-act="rtoggle"><span class="ch-making__mark" aria-hidden="true"></span><span>Friday is working on your request</span><span class="ch-making__time" aria-hidden="true">' + fmtClock(b.elapsed) + '</span><span class="ch-tool__chev">' + icon('chevron-down', 14) + '</span></button>';
    if (!b.done) return makingHTML(b);
    if (b.done && b.collapsed) {
      return '<button type="button" class="ch-r__sum" data-act="rtoggle"><span class="ch-r__ok">' + icon(b.stopped ? 'x' : 'check', 13) + '</span><span>' + (b.stopped ? 'Work stopped' : b.curated ? 'Route shaped with Friday’s guide · ' + fmtClock(b.elapsed) : 'Research complete · ' + srcN + ' source' + (srcN === 1 ? '' : 's') + ' · ' + fmtClock(b.elapsed)) + '</span><span class="ch-tool__chev">' + icon('chevron-right', 13) + '</span></button>';
    }
    var h = '<div class="ch-r__head"><span class="ch-r__spark">' + icon('sparkle', 16) + '</span><span class="ch-r__title">Research</span>' + (b.sub ? '<span class="ch-r__sub">· ' + esc(b.sub) + '</span>' : '') +
      '<span class="ch-r__time">' + fmtClock(b.elapsed) + '</span><button type="button" class="ch-r__tog" data-act="rtoggle" aria-label="' + (b.collapsed ? 'Expand' : 'Collapse') + '">' + icon(b.collapsed ? 'chevron-down' : 'chevron-up', 15) + '</button></div>' +
      '<div class="ch-r__bar' + (b.done ? '' : ' is-live') + '" role="progressbar" aria-label="Research progress"' + (b.done ? ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"' : '') + '><i' + (b.done ? ' style="width:100%"' : '') + '></i></div>';
    if (b.collapsed) return h;
    h += '<ol class="ch-steps">';
    b.steps.forEach(function (s, i) {
      var st = b.done ? 'done' : (i < b.stepIdx ? 'done' : (i === b.stepIdx && !b.stopped ? 'active' : 'pending'));
      h += '<li class="ch-step is-' + st + '"><span class="ch-step__m">' + (st === 'done' ? icon('check', 12) : '') + '</span><span class="ch-step__t">' + esc(s) + '</span>';
      var showLines = st === 'active' || (b.done && st === 'done');
      if (showLines) {
        var ls = b.lines.filter(function (l, k) { return l.step === i && k < b.lineN; });
        if (ls.length) h += '<div class="ch-step__lines">' + ls.map(function (l) { return '<div class="ch-tool__row"><span class="ch-tool__g">✱</span><span class="ch-tool__t">' + esc(l.text) + '</span></div>'; }).join('') + '</div>';
        var attach = b.steps.length > 1 ? 1 : 0;
        if (b.srcShown > 0 && (st === 'active' || i === attach)) {
          var shown = b.sources.slice(0, Math.min(8, b.srcShown));
          h += '<div class="ch-step__src"><span class="ch-favs">' + shown.map(function (s2, k) { return '<span class="ch-fav" style="background:' + favColor(k) + '" title="' + esc(s2.domain) + '">' + esc((s2.domain || s2.title || '?').charAt(0).toUpperCase()) + '</span>'; }).join('') + '</span><span class="ch-step__rd">Reading ' + b.srcShown + ' source' + (b.srcShown === 1 ? '' : 's') + '</span></div>';
        }
      }
      h += '</li>';
    });
    return h + '</ol>';
  }

  /* --- report --- */
  function cite(html) {
    return html.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, function (m, g) {
      return g.split(/\s*,\s*/).map(function (n) { return '<sup class="ch-cite"><button type="button" data-act="cite" data-n="' + n + '" aria-label="Source ' + n + '">' + n + '</button></sup>'; }).join('');
    });
  }
  function reportHTML(b) {
    var r = b.report, sh = b.shown || 0, h = '', i = 0;
    var show = function (k) { return sh >= k; };
    if (show(1)) h += '<h2 class="ch-rep__h">' + esc(r.title) + '</h2><div class="ch-rep__sum">' + cite(md(r.summary || '')) + '</div>';
    (r.sections || []).forEach(function (s, k) {
      if (show(2 + k)) h += '<section class="ch-rep__sec"><h3>' + esc(s.h) + '</h3><div class="ch-rep__body">' + cite(md(s.body || '')) + '</div></section>';
    });
    var k0 = 2 + (r.sections || []).length;
    if (r.table && show(k0)) {
      h += '<div class="ch-rep__tw"><table class="ch-tbl"><caption>' + esc(r.table.caption || '') + '</caption><thead><tr>' + r.table.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        r.table.rows.map(function (row) { return '<tr>' + row.map(function (c, ci) { return ci === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    if (show(k0 + (r.table ? 1 : 0))) {
      h += '<div class="ch-rep__srch">Sources</div><ol class="ch-srcs">' + b.sources.map(function (s, k) {
        return '<li class="ch-src" data-n="' + (k + 1) + '"><span class="ch-src__n">' + (k + 1) + '</span><span class="ch-src__b"><span class="ch-src__t">' + esc(s.title) + '</span><span class="ch-src__d">' + esc(s.domain) + '</span>' + (s.note ? '<span class="ch-src__note">' + esc(s.note) + '</span>' : '') + '</span></li>';
      }).join('') + '</ol><button type="button" class="ch-pill ch-pill--sm" data-act="copyrep">' + icon('copy', 14) + 'Copy report</button>';
    }
    return h;
  }
  function reportText(b) {
    var r = b.report, t = [r.title, '', r.summary, ''];
    (r.sections || []).forEach(function (s) { t.push(s.h, s.body, ''); });
    if (r.table) { t.push(r.table.caption || '', r.table.cols.join(' | ')); r.table.rows.forEach(function (row) { t.push(row.join(' | ')); }); t.push(''); }
    t.push('Sources');
    b.sources.forEach(function (s, i) { t.push((i + 1) + '. ' + s.title + ' (' + s.domain + ')'); });
    return t.join('\n');
  }

  /* ------------------------------------------------------------ interaction */
  function copyText(text, msg) {
    var done = function () { toast(msg || 'Copied'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); }); return; }
    } catch (e) { /* fall through */ }
    legacyCopy(text); done();
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    } catch (e) { /* ignore */ }
  }
  function resolve(elm) {
    var mEl = elm.closest('[data-mid]'), ctx = mountedCtx();
    if (!mEl || !ctx) return {};
    var msg = findMsgIn(ctx.th, mEl.dataset.mid), bEl = elm.closest('[data-bid]');
    var b = msg && bEl ? (msg.blocks || []).filter(function (x) { return x.id === bEl.dataset.bid; })[0] : null;
    return { msg: msg, b: b, ctx: ctx };
  }
  function resync(r) {
    touch(r.b);
    var col = root.querySelector('.ch-col'), el = col && col.querySelector('[data-mid="' + r.msg.id + '"]');
    if (el) syncMessage(el, r.msg);
  }
  function resyncExperiences(r) {
    var node = root && root.querySelector('[data-bid="' + r.b.id + '"]');
    var offsets = node ? Array.prototype.map.call(node.querySelectorAll('.ch-experiences__track'), function (track) { return track.scrollLeft; }) : [];
    resync(r);
    node = root && root.querySelector('[data-bid="' + r.b.id + '"]');
    if (node) Array.prototype.forEach.call(node.querySelectorAll('.ch-experiences__track'), function (track, i) { track.scrollLeft = offsets[i] || 0; });
  }
  function paint(r, cardEl) {
    /* light repaint on option clicks / typing: no rebuild, so focus and caret survive */
    var b = r.b, q = b.qs[b.qi]; if (!q) return;
    var qEl = cardEl.querySelector('.ch-q.is-active'), sel = (q.draft && q.draft.sel) || [];
    Array.prototype.forEach.call(qEl.querySelectorAll('[data-act="opt"]'), function (o) {
      var on = sel.indexOf(+o.dataset.i) >= 0;
      o.classList.toggle('is-sel', on);
      if (o.hasAttribute('aria-checked')) o.setAttribute('aria-checked', on); else o.setAttribute('aria-pressed', on);
    });
    var ok = !!commit(b, q, prefsForClarify(r.ctx.trip));
    var mk = qEl.querySelector('.ch-q__mark'); mk.classList.toggle('is-ok', ok); mk.innerHTML = ok ? icon('check', 14) : '';
    Array.prototype.forEach.call(qEl.querySelectorAll('[data-act="next"],[data-act="submit"]'), function (bt) { bt.disabled = !ok; });
  }
  function choose(r, i) {
    var q = r.b.qs[r.b.qi], dr = q.draft = q.draft || { sel: [], free: '' };
    dr.sel = dr.sel || [];
    var k = dr.sel.indexOf(i);
    if (q.type === 'multi') { if (k >= 0) dr.sel.splice(k, 1); else dr.sel.push(i); }
    else { dr.sel = [i]; dr.free = ''; var f = root.querySelector('[data-bid="' + r.b.id + '"] .ch-free'); if (f) f.value = ''; }
    persist(r.ctx.trip.id);
    paint(r, root.querySelector('[data-bid="' + r.b.id + '"] .ch-card'));
  }
  function firstOpen(b, from) {
    for (var k = 1; k <= b.qs.length; k++) { var i = (from + k) % b.qs.length; if (!b.qs[i].ans) return i; }
    return -1;
  }
  function goNext(r, decide) {
    var b = r.b, q = b.qs[b.qi]; if (!q) return;
    var prefs = prefsForClarify(r.ctx.trip);
    var a = decide ? decideAnswer(b, q, prefs) : commit(b, q, prefs);
    if (!a) return;
    var last = showSubmit(b, b.qi);
    q.ans = a;
    if (last && !decide) return doSubmit(r.msg, b);
    b.qi = firstOpen(b, b.qi);
    persist(r.ctx.trip.id); resync(r);
    if (b.qi === -1) { var c = root.querySelector('[data-bid="' + b.id + '"] .ch-card'); if (c) c.focus({ preventScroll: true }); }
  }
  function trySubmit(r) {
    var b = r.b; if (b.submitted || b.superseded) return;
    if (b.qi >= 0) {
      var q = b.qs[b.qi], a = commit(b, q, prefsForClarify(r.ctx.trip));
      if (!showSubmit(b, b.qi)) { if (a) goNext(r); return; }
      if (!a) return;
      q.ans = a;
    }
    if (b.qs.every(function (x) { return !!x.ans; })) doSubmit(r.msg, b);
  }

  function showResearchPlace(p, tripId) {
    if (!FT.ui || !FT.ui.modal) return;
    if (FT.backend && FT.backend.placeDetails) {
      FT.backend.placeDetails(p.title).then(function (response) {
        var match = (response.places || []).filter(function (x) { return String(x.title || '').trim().toLowerCase() === String(p.title || '').trim().toLowerCase(); })[0];
        if (match) { p = Object.assign({}, p, match, { ratingSource: response.attribution || 'Google Places', reviewsCount: match.reviewsCount || null }); }
        renderResearchPlace(p, tripId);
      }).catch(function () { renderResearchPlace(p, tripId); });
      return;
    }
    renderResearchPlace(p, tripId);
  }
  function renderResearchPlace(p, tripId) {
    var photos = (p.photos || []).filter(function (x) { return x && webUrl(x.url); });
    var reviews = Array.isArray(p.reviews) ? p.reviews.slice(0, 3) : [];
    var body = '<div class="fx-pm">' + (photos.length ? '<div class="fx-pm__photos">' + photos.map(function (x) { return '<figure><img src="' + esc(webUrl(x.url)) + '" alt="' + esc(p.title) + '" loading="lazy" referrerpolicy="no-referrer">' + (x.attribution || x.sourceUrl ? '<figcaption>' + esc(x.attribution || 'Photo source') + (webUrl(x.sourceUrl) ? ' · <a href="' + esc(webUrl(x.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">Source</a>' : '') + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>' : '') + '<div class="fx-pm__info">' + (p.category ? '<p class="fx-pm__label">' + esc(p.category) + '</p>' : '') + (p.address ? '<p class="fx-pm__address">' + esc(p.address) + '</p>' : '') + (p.description ? '<p class="fx-pm__blurb">' + esc(p.description) + '</p>' : '') + (p.rating != null && p.ratingSource ? '<p class="fx-pm__rating">★ ' + esc(p.rating) + (p.reviewsCount ? ' (' + esc(p.reviewsCount) + ' reviews)' : '') + ' · ' + esc(p.ratingSource) + '</p>' : '') + (Array.isArray(p.openingHours) && p.openingHours.length ? '<div class="fx-pm__hours"><strong>Opening hours</strong><p>' + esc(p.openingHours.join(' · ')) + '</p></div>' : '') + (reviews.length ? '<div class="fx-pm__hours"><strong>Reviews</strong>' + reviews.map(function (r) { return '<p>' + (r.rating != null ? '★ ' + esc(r.rating) + ' · ' : '') + esc(r.text || '') + (r.author ? ' — ' + (webUrl(r.authorUrl) ? '<a href="' + esc(webUrl(r.authorUrl)) + '" target="_blank" rel="noopener noreferrer">' + esc(r.author) + '</a>' : esc(r.author)) : '') + '</p>'; }).join('') + '</div>' : '') + (webUrl(p.url) ? '<a class="fx-link" href="' + esc(webUrl(p.url)) + '" target="_blank" rel="noopener noreferrer">Visit website</a>' : '') + '</div></div>';
    FT.ui.modal({ title: p.title, body: body, actions: [{ label: 'Close' }, { label: 'Save place', primary: true, onClick: async function (close) { try { if (FT.backend && FT.backend.savePlace) await FT.backend.savePlace(p); close(); toast('Place saved'); } catch (e) { toast(e.message || 'Could not save place'); } } }] });
  }
  function reviewResearchDraft(trip, block, message) {
    var fresh = getTrip(trip.id), draft = fresh && fresh.researchDraft;
    if (!block || block.applied || block.superseded || !draft || !block.draftId || draft.id !== block.draftId || !FT.ui || !FT.ui.modal) return toast('This proposal is no longer available.');
    var changed = JSON.stringify(fresh.plan || null) !== JSON.stringify(draft.basePlan || null);
    var body = document.createElement('div');
    var hasCurrentDays = !!(fresh.plan && fresh.plan.days && fresh.plan.days.length);
    var reviewNote = changed ? 'Your itinerary has changed since this proposal was made. Applying it will replace those day plans.' : hasCurrentDays ? 'Applying replaces the current day plans with this researched proposal. You can still edit every day and stop afterward.' : 'Applying adds this researched proposal to your journey. You can still edit every day and stop afterward.';
    body.innerHTML = '<p class="fx-hint">' + reviewNote + '</p><ol class="fx-draft-review">' + (draft.plan.days || []).map(function (d) { return '<li><strong>' + esc(d.town || d.area || 'Day') + (d.date ? ' · ' + esc(d.date) : '') + '</strong><ul>' + (d.items || []).map(function (it) { var place = it.place && draft.catalog.places[it.place]; return '<li>' + esc(it.time ? it.time + ' · ' : '') + esc(place ? place.name : it.name || 'Stop') + (it.note ? ' — ' + esc(it.note) : '') + '</li>'; }).join('') + '</ul></li>'; }).join('') + '</ol>';
    FT.ui.modal({ title: 'Review itinerary proposal', body: body, actions: [{ label: 'Keep current plan' }, { label: 'Apply proposal', primary: true, onClick: function (close) {
      var current = getTrip(trip.id); if (!current || !current.researchDraft || current.researchDraft.id !== block.draftId || block.superseded || block.applied) { close(); return toast('This proposal is no longer available.'); }
      if (FT.DESTINATIONS) FT.DESTINATIONS[draft.destId] = clone(draft.catalog);
      FT.store.update(function (s) { var t = s.trips.filter(function (x) { return x.id === trip.id; })[0]; if (!t) return; t.destId = draft.destId; t.destName = draft.catalog.name; t.catalog = clone(draft.catalog); delete t.researchDraft; });
      if (FT.plan && FT.plan.apply) FT.plan.apply(trip.id, clone(draft.plan), { summary: 'Applied researched itinerary', changes: draft.plan.days.reduce(function (n, d) { return n + d.items.length; }, 0) });
      if (block) { block.applied = true; touch(block); persist(trip.id, true); var ctx = mountedCtx(), msgEl = root && message && root.querySelector('[data-mid="' + message.id + '"]'); if (ctx && msgEl) syncMessage(msgEl, message); }
      close(); toast('Research added to your plan'); emit('map:fit');
    } }] });
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.tagName === 'INPUT') return;
    var act = el.dataset.act, r = resolve(el), b = r.b, msg = r.msg;
    switch (act) {
      case 'copy': if (msg) copyText(msgPlain(msg), 'Copied'); break;
      case 'up': case 'down':
        if (!msg) break;
        var mEl = el.closest('[data-mid]');
        msg.fb = msg.fb === act ? null : act;
        if (msg.fb) toast('Thanks for the feedback');
        persist(r.ctx.trip.id);
        if (mEl && mEl.isConnected) syncMessage(mEl, msg);
        break;
      case 'tool': if (b) { b.open = !b.open; persist(r.ctx.trip.id); resync(r); } break;
      case 'rtoggle': if (b) { b.collapsed = !b.collapsed; persist(r.ctx.trip.id); resync(r); } break;
      case 'cite': {
        var rep = el.closest('.ch-rep'), tgt = rep && rep.querySelector('.ch-src[data-n="' + el.dataset.n + '"]');
        if (tgt) { tgt.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); tgt.classList.remove('is-flash'); void tgt.offsetWidth; tgt.classList.add('is-flash'); }
        break;
      }
      case 'copyrep': if (b) copyText(reportText(b), 'Report copied'); break;
      case 'stay-add': if (b && b.t === 'stay-ideas' && r.ctx && r.ctx.trip && r.ctx.trip.destId === b.destId && FT.plan && FT.plan.addItem) {
        var addId = el.dataset.stayId, addGroup = (b.groups || [])[+el.dataset.stayGroup], addCatalog = DEST(b.destId);
        var already = r.ctx.trip.plan && r.ctx.trip.plan.days.some(function (day) { return day.items.some(function (item) { return item.place === addId; }); });
        if (addGroup && addGroup.from > 0 && (addGroup.ids || []).indexOf(addId) >= 0 && addCatalog && P(addCatalog, addId) && !already) {
          FT.plan.addItem(r.ctx.trip.id, addGroup.from - 1, addId, 'Stay idea to confirm');
          persist(r.ctx.trip.id); resync(r);
        }
        break;
      }
      case 'stay-save': if (b && b.t === 'stay-ideas' && r.ctx && r.ctx.trip && r.ctx.trip.destId === b.destId && FT.saved && FT.saved.toggle) {
        var stayId = el.dataset.stayId, catalog = DEST(b.destId);
        if (catalog && P(catalog, stayId) && (b.groups || []).some(function (g) { return (g.ids || []).indexOf(stayId) >= 0; })) {
          FT.saved.toggle(b.destId, stayId); persist(r.ctx.trip.id); resync(r);
        }
        break;
      }
      case 'stay-map': if (b && b.t === 'stay-ideas' && r.ctx && r.ctx.trip && r.ctx.trip.destId === b.destId) {
        var mapId = el.dataset.stayId, mapCatalog = DEST(b.destId);
        if (mapCatalog && P(mapCatalog, mapId) && (b.groups || []).some(function (g) { return (g.ids || []).indexOf(mapId) >= 0; }) && FT.map && FT.map.focus) FT.map.focus(mapId);
        break;
      }
      case 'experience-scroll': if (b && b.t === 'experience-ideas') {
        var expSection = el.closest('.ch-experiences__group'), expTrack = expSection && expSection.querySelector('.ch-experiences__track');
        if (expSection && +expSection.dataset.expGroup === +el.dataset.expGroup && expTrack) {
          var expCard = expTrack.querySelector('.ch-exp-card'), distance = expCard ? expCard.getBoundingClientRect().width + 12 : expTrack.clientWidth * .8;
          expTrack.scrollBy({ left: distance * (+el.dataset.dir < 0 ? -1 : 1), behavior: reduced() ? 'auto' : 'smooth' });
        }
        break;
      }
      case 'experience-add': if (b && b.t === 'experience-ideas' && !b.proposal && r.ctx && r.ctx.trip && r.ctx.trip.destId === b.destId && FT.plan && FT.plan.addItem) {
        var expGroup = (b.groups || [])[+el.dataset.expGroup], expId = el.dataset.expId;
        var expPlace = expGroup && (expGroup.items || []).filter(function (x) { return x.id === expId; })[0];
        var expDay = expGroup && r.ctx.trip.plan && r.ctx.trip.plan.days[expGroup.dayIndex];
        var expExists = r.ctx.trip.plan && r.ctx.trip.plan.days.some(function (day) { return day.items.some(function (item) { return item.place === expId; }); });
        if (expPlace && expDay && expDay.area === expGroup.area && P(DEST(b.destId), expId) && !expExists) {
          FT.plan.addItem(r.ctx.trip.id, expGroup.dayIndex, expId);
          persist(r.ctx.trip.id); resyncExperiences(r);
        }
        break;
      }
      case 'experience-save': if (b && b.t === 'experience-ideas' && !b.proposal && r.ctx && r.ctx.trip && r.ctx.trip.destId === b.destId && FT.saved && FT.saved.toggle) {
        var saveGroup = (b.groups || [])[+el.dataset.expGroup], saveId = el.dataset.expId;
        if (saveGroup && (saveGroup.items || []).some(function (x) { return x.id === saveId; }) && P(DEST(b.destId), saveId)) {
          FT.saved.toggle(b.destId, saveId); persist(r.ctx.trip.id); resyncExperiences(r);
        }
        break;
      }
      case 'experience-detail': if (b && b.t === 'experience-ideas' && !b.proposal && r.ctx && r.ctx.trip && r.ctx.trip.destId === b.destId && FT.placeModal) {
        var detailGroup = (b.groups || [])[+el.dataset.expGroup], detailId = el.dataset.expId;
        if (detailGroup && (detailGroup.items || []).some(function (x) { return x.id === detailId; }) && P(DEST(b.destId), detailId)) FT.placeModal(b.destId, detailId, { tripId: r.ctx.trip.id });
        break;
      }
      case 'place-card': if (b && b.places && b.places[+el.dataset.placeIndex]) { showResearchPlace(b.places[+el.dataset.placeIndex], r.ctx.trip.id); } break;
      case 'friday-listing': if (b && b.listings && b.listings[+el.dataset.listingIndex] && FT.integrations) { var chosen = b.listings[+el.dataset.listingIndex], prior = (b.answers && b.answers.listingIds || []).concat(b.draft && b.draft.listingIds || []); FT.integrations.openFridayPlan({ tripId: r.ctx.trip.id, workflowId: b.workflowId, message: b.message || 'Plan around my bookings and prepare a package', listingIds: Array.from(new Set(prior.concat(chosen.id))), draft: b.draft || null, answers: b.answers || {}, scope: b.scope || 'upcoming' }); } break;
      case 'research-review': if (r.ctx && r.ctx.trip) reviewResearchDraft(r.ctx.trip, b, msg); break;
      case 'chip': onChip(el, r); break;
      case 'opt': if (b && !b.submitted) choose(r, +el.dataset.i); break;
      case 'reopen': if (b && !b.submitted) { b.qi = +el.dataset.qi; persist(r.ctx.trip.id); resync(r); var c = root.querySelector('[data-bid="' + b.id + '"] .ch-card'); if (c) c.focus({ preventScroll: true }); } break;
      case 'decide': if (b) goNext(r, true); break;
      case 'next': if (b) goNext(r); break;
      case 'submit': if (b) trySubmit(r); break;
      case 'calnav': if (b) { var q = b.qs[b.qi], v = q.draft.view, d = new Date(v.y, v.m + (+el.dataset.d), 1); q.draft.view = { y: d.getFullYear(), m: d.getMonth() }; persist(r.ctx.trip.id); resync(r); } break;
      case 'day': if (b) {
        var q2 = b.qs[b.qi], rg = q2.draft.range = q2.draft.range || { start: null, end: null }, iso = el.dataset.iso;
        q2.draft.free = '';
        if (!rg.start || (rg.start && rg.end)) { rg.start = iso; rg.end = null; }
        else if (iso >= rg.start) rg.end = iso;
        else { rg.start = iso; rg.end = null; }
        persist(r.ctx.trip.id); resync(r);
      } break;
    }
  }
  function onChip(el, r) {
    var ctx = mountedCtx(); if (!ctx) return;
    var i = +el.dataset.i, it;
    if (r.b && r.b.t === 'suggest') it = r.b.items[i]; else it = emptyChips[i];
    if (!it) return;
    if (it.action === 'newtrip' && (it.dest || it.name)) {
      var d = it.dest ? DEST(it.dest) : null, t = FT.trips && FT.trips.create ? FT.trips.create(it.dest ? { destId: it.dest } : {}) : null;
      if (!t) return;
      if (d) { adoptDest(t.id, it.dest); emit('map:fit'); } else adoptPlace(t.id, it.name);
      if (FT.router && FT.router.go) FT.router.go('#/trip/' + t.id);
      chat.send({ text: d ? (d.prompt || ('Plan a trip to ' + d.name)) : ('Plan a trip to ' + it.name), tripId: t.id });
      return;
    }
    chat.send({ text: it.label, tripId: ctx.trip.id });
  }
  function onInput(e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('ch-free')) return;
    var r = resolve(el); if (!r.b) return;
    var q = r.b.qs[r.b.qi], dr = q.draft = q.draft || { sel: [] };
    dr.free = el.value;
    if (el.value.trim() && (q.type === 'single' || q.type === 'month')) dr.sel = [];
    if (el.value.trim() && q.type === 'dates') { /* free text wins over the calendar */ }
    paint(r, el.closest('.ch-card'));
  }
  function onChange(e) {
    if (e.target.classList && e.target.classList.contains('ch-free')) { var r = resolve(e.target); if (r.ctx) persist(r.ctx.trip.id); }
  }
  function onKey(e) {
    var card = e.target.closest && e.target.closest('.ch-card'); if (!card || !root.contains(card)) return;
    var r = resolve(card); var b = r.b; if (!b || b.submitted || b.superseded) return;
    var isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); trySubmit(r); return; }
    if (isInput) {
      if (e.key === 'Enter') { e.preventDefault(); if (b.qi >= 0) { var q0 = b.qs[b.qi]; if (commit(b, q0, prefsForClarify(r.ctx.trip))) { if (showSubmit(b, b.qi)) trySubmit(r); else goNext(r); } } }
      else if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (b.qi < 0) return;
    var q = b.qs[b.qi];
    if ((q.type === 'single' || q.type === 'multi') && /^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var i = +e.key - 1;
      if (i < q.opts.length) { e.preventDefault(); choose(r, i); }
      else if (i === q.opts.length) { e.preventDefault(); var f = card.querySelector('.ch-free'); if (f) f.focus(); }
    }
  }
  function onScroll() {
    if (!root) return;
    stick = root.scrollHeight - root.scrollTop - root.clientHeight < 90;
  }

  /* ------------------------------------------------------------ public API */
  chat.mount = function (el) {
    if (bound && bound.el !== el) {
      bound.el.removeEventListener('click', onClick); bound.el.removeEventListener('input', onInput);
      bound.el.removeEventListener('change', onChange); bound.el.removeEventListener('keydown', onKey);
      bound.el.removeEventListener('scroll', onScroll);
    }
    root = el; mountedKey = null;
    if (!el) return;
    el.classList.add('ch-thread');
    if (!bound || bound.el !== el) {
      el.addEventListener('click', onClick); el.addEventListener('input', onInput);
      el.addEventListener('change', onChange); el.addEventListener('keydown', onKey);
      el.addEventListener('scroll', onScroll, { passive: true });
      bound = { el: el };
    }
  };

  chat.render = function (trip) {
    if (!root || syncing) return;
    if (!trip) { root.innerHTML = ''; mountedKey = null; return; }
    trip = getTrip(trip.id) || trip;
    var th = activeThread(trip);
    if (!th) { th = ensureThread(trip.id); trip = getTrip(trip.id); if (!th) return; }
    var key = trip.id + '/' + th.id;
    if (key !== mountedKey || !root.querySelector('.ch-col')) {
      mountedKey = key;
      root.innerHTML = '<div class="ch-col"></div>';
      /* anything unfinished that is not the live turn was interrupted by a reload */
      var changed = false;
      th.messages.forEach(function (m) {
        if (m.role === 'assistant' && !m.done && !m.waiting && !(cur && cur.msgId === m.id)) {
          m.done = true; m.stopped = true; m.thinking = false; changed = true;
          (m.blocks || []).forEach(function (b) {
            if (b.t === 'research' && !b.done) { b.done = true; b.stopped = true; touch(b); }
            if (b.t === 'report' && b.shown < 99) { b.shown = 99; touch(b); }
          });
        }
      });
      if (changed) setTimeout(function () { persist(trip.id); }, 0);
      stick = true;
      syncThread(trip, th);
      scrollEnd(true);
      var w = th.messages[th.messages.length - 1];
      if (w && w.waiting) (w.blocks || []).forEach(function (b) { if (b.t === 'clarify' && !b.submitted && !b.superseded) focusClarifier(b.id); });
      return;
    }
    syncThread(trip, th);
  };

  chat.addFridayRecommendations = function (tripId, message, listings, context) {
    var trip = getTrip(tripId); if (!trip || !Array.isArray(listings) || !listings.length) return;
    var th = ensureThread(tripId); if (!th) return;
    context = context || {};
    if (context.workflowId) {
      var prior = null;
      (trip.threads || []).forEach(function (thread) { (thread.messages || []).forEach(function (m) { (m.blocks || []).forEach(function (block) { if (block.t === 'friday-listings' && block.workflowId === context.workflowId) prior = block; }); }); });
      if (prior) { prior.listings = listings; prior.draft = context.draft || prior.draft; prior.answers = context.answers || prior.answers; prior.scope = context.scope || prior.scope; prior.message = message || prior.message; touch(prior); persist(tripId); chat.render(getTrip(tripId)); return; }
    }
    var userMessage = newMsg('user', { text: message || 'Find travel options around my bookings' });
    var assistant = newMsg('assistant', { blocks: [{ id: uid('b'), t: 'text', text: 'Here are a few Friday listings to consider. Prices and availability are confirmed by the team.', rev: 1 }, { id: uid('b'), t: 'friday-listings', workflowId: context.workflowId, listings: listings, message: message, draft: context.draft || null, scope: context.scope || 'upcoming', answers: context.answers || {}, rev: 1 }], done: true, at: Date.now() });
    th.messages.push(userMessage, assistant);
    persist(tripId);
    chat.render(getTrip(tripId));
  };

  chat._x = { extractPlace: extractPlace, experienceIdeasBlock: experienceIdeasBlock, experienceIdeasHTML: experienceIdeasHTML };   /* exposed for tests */
  FT.chat = chat;
})();
