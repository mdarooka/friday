/* ==========================================================================
   Friday planner — Workspace (trip view)
   Owns: top bar, split panes, thread header, composer, right pane (map slot,
   tab bar, Overview, Plan), activity drawer, print sheet.
   Contract: see docs/planner-spec.md ("Trip view (Workspace)").
   Plain ES2020 classic script. Rendering is idempotent on store 'change':
   the composer and the [data-thread] element are built once and never
   rebuilt; only title, thread list, tabs and panels are re-rendered, and only
   when their signature changed.
   ========================================================================== */
(function () {
  'use strict';
  var F = (window.FridayTrip = window.FridayTrip || {});

  /* ------------------------------------------------------------ helpers */
  var SPLIT_KEY = 'friday.planner.split';
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }

  function esc(s) {
    if (F.util && F.util.esc) return F.util.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ic(name, size) {
    try { return (F.util && F.util.icon && F.util.icon(name, size || 16)) || ''; } catch (e) { return ''; }
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function toast(t) { if (F.ui && F.ui.toast) F.ui.toast(t); }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function isNarrow() { return !!(window.matchMedia && window.matchMedia('(max-width: 899px)').matches); }
  function raf(fn) { return (window.requestAnimationFrame || setTimeout)(fn, 16); }
  function timeAgo(iso) { try { return F.util.timeAgo(iso); } catch (e) { return ''; } }
  function money(n, cur) {
    try { return F.util.money(n, cur); } catch (e) { return (cur || '') + Number(n || 0).toLocaleString('en-US'); }
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  /* ------------------------------------------------------------ state */
  var S = {
    root: null, els: {}, tripId: null, split: 50, view: 'chat',
    renaming: false, actOpen: false,
    collapsed: {},          // group key -> true
    addDayId: null, addQ: '', addFocus: false,
    busy: false, atts: [], rec: null, listening: false,
    sig: {}, hl: null, drag: null, deferRender: false,
    notesTimer: null, pop: null, unsubs: [], mounted: false
  };

  /* ------------------------------------------------------------ data access */
  function store() { return F.store; }
  function T() { return F.store && S.tripId ? F.store.trip(S.tripId) : null; }
  function upd(fn) {
    var st = F.store; if (!st) return;
    st.update(function (s) {
      var t = (s.trips || []).filter(function (x) { return x.id === S.tripId; })[0];
      if (t) fn(t, s);
    });
  }
  function destOf(t) {
    if (!t || !t.destId) return null;
    if (F.dest) return F.dest(t.destId);
    return (F.DESTINATIONS && F.DESTINATIONS[t.destId]) || null;
  }
  function placeOf(t, id) {
    if (!t || !t.destId || !id) return null;
    if (F.place) return F.place(t.destId, id);
    var d = destOf(t);
    return d && d.places && d.places[id] ? Object.assign({ id: id }, d.places[id]) : null;
  }
  function areaName(t, id) {
    var d = destOf(t), a = d && d.areas && d.areas.filter(function (x) { return x.id === id; })[0];
    if (a) return a.name;
    return String(id || '').replace(/(^|-)(\w)/g, function (m, p, c) { return (p ? ' ' : '') + c.toUpperCase(); });
  }
  var SCENES = ['peaks', 'dunes', 'sea', 'terraces', 'forest', 'arctic', 'canyon', 'isles', 'city', 'aurora'];
  var TONES = ['ember', 'indigo', 'jade', 'sand', 'rose', 'slate', 'cobalt', 'moss', 'plum', 'ice'];
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // A plan item may have no curated place ({place:null, name, label, at}): synthesize a display record from it.
  function itemPlace(t, it) {
    var p = it.place ? placeOf(t, it.place) : null;
    if (p) return p;
    var nm = it.name || it.place || 'Stop';
    var h = hashStr(nm);
    return { id: it.id, custom: true, name: nm, label: it.label || '', at: it.at || null,
      seed: 'item-' + nm, scene: SCENES[h % SCENES.length], tone: TONES[(h >>> 8) % TONES.length] };
  }
  function focusId(it) { return it.place || it.id; }
  function plateHtml(t, p) {
    var inner = '';
    if (F.plate && p) {
      try {
        inner = F.plate(p.seed || ((t.destId || 'x') + '-' + p.id), { scene: p.scene || 'city', tone: p.tone || 'sand', ratio: 'square' });
      } catch (e) { inner = ''; }
    }
    if (!inner) return '<div class="wsp-plate-empty">' + ic('pin', 18) + '</div>';
    return '<div class="plate plate--ratio-s">' + inner + '</div>';
  }
  function planPlaceIds(t) {
    var out = {};
    if (t && t.plan) t.plan.days.forEach(function (d) { d.items.forEach(function (i) { if (i.place) out[i.place] = true; }); });
    return out;
  }
  function metaLine(t, p) {
    if (!p) return '';
    var d = destOf(t), cur = d && d.currency;
    var bits = [];
    if (p.label) bits.push(esc(p.label));
    if (p.kind === 'stay' && p.price) bits.push('Reference · ' + esc(money(p.price, cur)) + '/night');
    else if (p.rating) {
      var r = '★ ' + Number(p.rating).toFixed(1);
      var reviewCount = Number.isFinite(Number(p.reviewsCount)) ? Number(p.reviewsCount) : (typeof p.reviews === 'number' ? p.reviews : 0);
      if (reviewCount) r += ' (' + reviewCount.toLocaleString('en-US') + ')';
      if (p.ratingSource) r += ' · ' + esc(p.ratingSource);
      else r = 'Reference guide · ' + r;
      bits.push(esc(r));
    }
    return bits.join(' · ');
  }
  function nightsOf(t) {
    var days = t.plan ? t.plan.days : [];
    var f = days.length && days[0].date, l = days.length && days[days.length - 1].date;
    if (f && l && F.util && F.util.diffDays) {
      var n = F.util.diffDays(f, l); if (n > 0) return n;
    }
    return Math.max(1, days.length - 1);
  }
  function planRange(t) {
    var days = t.plan ? t.plan.days : [];
    var f = days.length && days[0].date, l = days.length && days[days.length - 1].date;
    if (f && l && F.util && F.util.fmtRange) return F.util.fmtRange(f, l);
    return '';
  }

  /* ------------------------------------------------------------ popovers / menus */
  function closePop() {
    if (S.pop) {
      var p = S.pop; S.pop = null;
      document.removeEventListener('pointerdown', p.onDown, true);
      document.removeEventListener('keydown', p.onKey, true);
      window.removeEventListener('resize', p.close);
      if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
      if (p.anchor) p.anchor.setAttribute('aria-expanded', 'false');
      if (p.onClose) p.onClose();
    }
  }
  function popover(anchor, el, opts) {
    opts = opts || {};
    closePop();
    el.classList.add('wsp-pop');
    var host = S.root || document.body;
    host.appendChild(el);
    var hr = host.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = opts.align === 'left' ? r.left : r.right - w;
    left = clamp(left, 8, Math.max(8, window.innerWidth - w - 8));
    var top = r.bottom + 6;
    if (opts.above || (top + h > window.innerHeight - 8 && r.top - h - 6 > 8)) top = Math.max(8, r.top - h - 8);
    el.style.left = (left - hr.left) + 'px';
    el.style.top = (top - hr.top) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    var p = {
      el: el, anchor: anchor, onClose: opts.onClose,
      close: closePop,
      onDown: function (e) { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(); },
      onKey: function (e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(); anchor.focus && anchor.focus(); } }
    };
    S.pop = p;
    document.addEventListener('pointerdown', p.onDown, true);
    document.addEventListener('keydown', p.onKey, true);
    window.addEventListener('resize', p.close);
    return p;
  }
  // Uses FridayTrip.ui.menu when present, otherwise a small built-in fallback.
  function openMenu(anchor, items) {
    if (F.ui && F.ui.menu) { closePop(); return F.ui.menu(anchor, items); }
    var el = document.createElement('div');
    el.className = 'wsp-menu';
    items.forEach(function (it) {
      if (it === 'sep') { el.appendChild(Object.assign(document.createElement('div'), { className: 'wsp-menu__sep' })); return; }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wsp-menu__item' + (it.danger ? ' is-danger' : '');
      b.innerHTML = (it.icon ? ic(it.icon, 16) : '<span class="wsp-menu__gap"></span>') + '<span>' + esc(it.label) + '</span>';
      b.addEventListener('click', function () { closePop(); it.onClick && it.onClick(); });
      el.appendChild(b);
    });
    popover(anchor, el);
  }

  function openModal(opts) {
    if (F.ui && F.ui.modal) return F.ui.modal(opts);
    // minimal fallback
    var wrap = document.createElement('div');
    wrap.className = 'wsp-fbmodal';
    wrap.innerHTML = '<div class="wsp-fbmodal__card" role="dialog"><h3>' + esc(opts.title || '') + '</h3><div class="wsp-fbmodal__body">' +
      (typeof opts.body === 'string' ? opts.body : '') + '</div><div class="wsp-fbmodal__act"></div></div>';
    (document.querySelector('[data-layer]') || document.body).appendChild(wrap);
    function close() { wrap.remove(); }
    var act = wrap.querySelector('.wsp-fbmodal__act');
    (opts.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'wsp-btn' + (a.primary ? ' wsp-btn--ink' : '');
      b.textContent = a.label;
      b.onclick = function () { a.onClick ? a.onClick(close) : close(); };
      act.appendChild(b);
    });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    opts.onOpen && opts.onOpen(wrap);
    return close;
  }
  function confirmBox(text, okLabel) {
    if (F.ui && F.ui.confirm) return F.ui.confirm(text, { okLabel: okLabel || 'OK' });
    return Promise.resolve(window.confirm(text));
  }
  function promptBox(title, o) {
    if (F.ui && F.ui.prompt) return F.ui.prompt(title, o || {});
    return Promise.resolve(window.prompt(title, (o && o.value) || ''));
  }

  /* ------------------------------------------------------------ template */
  var TEMPLATE =
    '<header class="wsp-top">' +
      '<button type="button" class="wsp-iconbtn wsp-top__side" data-ws="side" aria-label="Show sidebar" title="Show sidebar">' + '{{sidebar}}' + '</button>' +
      '<a class="wsp-mark" href="#/" aria-label="Friday, home">Friday</a>' +
      '<span class="wsp-top__div" aria-hidden="true"></span>' +
      '<div class="wsp-title" data-ws="titlewrap"><button type="button" class="wsp-title__btn" data-ws="title" title="Rename trip"></button></div>' +
      '<div class="wsp-top__right">' +
        '<button type="button" class="wsp-share" data-ws="share" aria-haspopup="true" aria-expanded="false">{{share}}<span>Share</span></button>' +
        '<button type="button" class="wsp-act" data-ws="activity" aria-label="Activity">{{users}}<span>Activity</span></button>' +
        '<button type="button" class="wsp-iconbtn" data-ws="dots" aria-label="More" aria-haspopup="true" aria-expanded="false">{{dots}}</button>' +
      '</div>' +
    '</header>' +
    '<div class="wsp-seg" role="tablist" aria-label="Pane">' +
      '<button type="button" role="tab" data-view="chat" aria-selected="true">Chat</button>' +
      '<button type="button" role="tab" data-view="map" aria-selected="false">Map &amp; plan</button>' +
    '</div>' +
    '<div class="wsp-split" data-ws="split">' +
      '<section class="wsp-left" data-ws="left" aria-label="Conversation">' +
        '<div class="wsp-thead">' +
          '<button type="button" class="wsp-thead__title" data-ws="threadbtn" aria-haspopup="true" aria-expanded="false"><span data-ws="threadtitle"></span>{{chevron-down}}</button>' +
          '<button type="button" class="wsp-thead__plus" data-ws="newthread" aria-label="New conversation" title="New conversation">{{plus}}</button>' +
        '</div>' +
        '<div class="wsp-thread" data-thread></div>' +
        '<div class="wsp-cwrap">' +
          '<div class="wsp-composer" data-ws="composer">' +
            '<div class="wsp-atts" data-ws="atts" hidden></div>' +
            '<textarea rows="1" placeholder="Ask Friday to change dates, suggest places, or refine your itinerary…" aria-label="Message" data-ws="ta"></textarea>' +
            '<div class="wsp-crow">' +
              '<button type="button" class="wsp-iconbtn" data-ws="img" aria-label="Attach an image" title="Attach an image">{{image}}</button>' +
              '<input type="file" accept="image/*" multiple hidden data-ws="file">' +
              '<span class="wsp-grow"></span>' +
              '<button type="button" class="wsp-iconbtn wsp-mic" data-ws="mic" aria-label="Voice input" title="Voice input">{{mic}}</button>' +
              '<button type="button" class="wsp-send" data-ws="send" aria-label="Send" disabled></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div class="wsp-divider" data-ws="divider" role="separator" aria-orientation="vertical" aria-label="Resize panes" tabindex="0"></div>' +
      '<section class="wsp-right" data-ws="right" aria-label="Map and plan">' +
        '<div class="wsp-mapwrap" data-ws="mapwrap">' +
          '<div class="wsp-map" data-map></div>' +
        '</div>' +
        '<div class="wsp-tabs" data-ws="tabs"></div>' +
        '<div class="wsp-panel" data-ws="panel"></div>' +
      '</section>' +
    '</div>' +
    '<div class="wsp-scrim" data-ws="scrim" hidden></div>' +
    '<aside class="wsp-drawer" data-ws="drawer" aria-label="Activity" aria-hidden="true">' +
      '<div class="wsp-drawer__head"><h2>Activity</h2><button type="button" class="wsp-iconbtn" data-ws="drawerclose" aria-label="Close">{{x}}</button></div>' +
      '<div class="wsp-drawer__body" data-ws="drawerbody"></div>' +
    '</aside>' +
    '<div class="wsp-printdoc" data-ws="print" aria-hidden="true"></div>';

  function fillIcons(html) {
    return html.replace(/\{\{([\w-]+)\}\}/g, function (m, n) { return ic(n, 16); });
  }

  /* ------------------------------------------------------------ mount */
  function mount(rootEl) {
    if (S.mounted || !rootEl) return;
    S.mounted = true;
    S.root = rootEl;
    rootEl.classList.add('wsp');
    rootEl.setAttribute('data-view', 'chat');
    rootEl.innerHTML = fillIcons(TEMPLATE);
    var E = S.els;
    Array.prototype.forEach.call(rootEl.querySelectorAll('[data-ws]'), function (n) { E[n.getAttribute('data-ws')] = n; });
    E.thread = rootEl.querySelector('[data-thread]');
    E.map = rootEl.querySelector('[data-map]');

    var sp = parseFloat(lsGet(SPLIT_KEY));
    S.split = isFinite(sp) ? clamp(sp, 30, 70) : 50;
    applySplit();

    bindTop();
    bindComposer();
    bindDivider();
    bindPanel();
    bindTabs();
    bindMisc();

    try { if (F.map && F.map.mount) F.map.mount(E.map); } catch (e) { console.error('map.mount', e); }
    try { if (F.chat && F.chat.mount) F.chat.mount(E.thread); } catch (e) { console.error('chat.mount', e); }

    var st = F.store;
    if (st) {
      S.unsubs.push(st.on('change', onChange));
      S.unsubs.push(st.on('map:focus', onMapFocus));
      S.unsubs.push(st.on('plan:highlight', onHighlight));
      S.unsubs.push(st.on('chat:busy', function (p) { S.busy = !!(p && p.busy); syncComposer(); }));
      S.unsubs.push(st.on('tab', function (p) {
        if (!p || (p.tripId && p.tripId !== S.tripId) || !p.tab) return;
        var t = T(); if (t && t.activeTab !== p.tab) setTab(p.tab, true);
      }));
    }
    window.addEventListener('beforeprint', renderPrint);
    syncComposer();
  }

  /* ------------------------------------------------------------ open */
  function open(tripId) {
    if (!S.mounted) return;
    var st = F.store; if (!st) return;
    var changed = tripId !== S.tripId;
    S.tripId = tripId;
    var s = st.get();
    if (s && s.currentTripId !== tripId) {
      st.update(function (x) { x.currentTripId = tripId; });
    }
    if (changed) {
      S.renaming = false; S.addDayId = null; S.addQ = ''; S.hl = null;
      S.collapsed = {};
      closePop(); setActivity(false);
      clearAtts();
      S.sig = {};
      S.els.panel.scrollTop = 0;
      setView('chat');
      if (S.els.ta) { S.els.ta.value = ''; autogrow(); }
    }
    S.busy = !!(F.chat && F.chat.busy);
    var t = T(); if (!t) return;
    render();
    try { if (F.chat && F.chat.render) F.chat.render(t); } catch (e) { console.error('chat.render', e); }
    try { if (F.map && F.map.render) F.map.render(t); } catch (e) { console.error('map.render', e); }
    raf(function () { autogrow(); });
    if (changed) raf(function () { if (F.map && F.map.resize) F.map.resize(); });
  }

  function onChange(payload) {
    if (!S.tripId || !T()) return;
    var t = T();
    if (payload && payload.hydrated && Array.isArray(payload.tripIds) && payload.tripIds.indexOf(S.tripId) !== -1 && t.villaOrigin) {
      // Provider details live only in the runtime catalog, outside the saved
      // trip signature. Invalidate the visible plan without reopening the
      // workspace or disturbing its composer, view, or selected tab.
      S.sig.panelForce = true;
      render();
      try { if (F.map && F.map.render) F.map.render(t); } catch (e) { console.error('map.render', e); }
      return;
    }
    if (S.drag) { S.deferRender = true; return; }
    render();
  }

  /* ------------------------------------------------------------ render */
  function sigChanged(key, val) {
    if (S.sig[key] === val) return false;
    S.sig[key] = val; return true;
  }

  function render() {
    var t = T(); if (!t) return;
    syncResearchMode(t);
    renderTop(t);
    renderThreadHead(t);
    renderMapState(t);
    renderTabs(t);
    renderPanel(t);
    renderDrawer(t);
    syncComposer();
  }

  function renderTop(t) {
    var E = S.els;
    if (!S.renaming) {
      var title = t.title || 'New trip';
      if (sigChanged('title', title)) E.title.textContent = title;
      E.title.hidden = false;
    }
    var side = F.store.get();
    var showSide = !!(side && side.sideCollapsed);
    S.root.classList.toggle('has-side-btn', showSide);
  }

  function renderThreadHead(t) {
    var th = (t.threads || []).filter(function (x) { return x.id === t.activeThreadId; })[0] || (t.threads || [])[0];
    var title = (th && th.title) || 'New conversation';
    if (sigChanged('thread', title)) S.els.threadtitle.textContent = title;
  }

  function renderMapState(t) {
    var E = S.els, collapsed = !!t.mapCollapsed;
    var was = E.mapwrap.classList.contains('is-collapsed');
    E.mapwrap.classList.toggle('is-collapsed', collapsed);
    if (collapsed) E.mapwrap.setAttribute('aria-hidden', 'true'); else E.mapwrap.removeAttribute('aria-hidden');
    if (was !== collapsed) scheduleMapResize();
    E.mapwrap.classList.toggle('is-empty', !t.destId);
  }
  function scheduleMapResize() {
    var n = 0;
    (function tick() {
      if (F.map && F.map.resize) F.map.resize();
      if (++n < 6) setTimeout(tick, 60);
    })();
  }

  /* ------------------------------------------------------------ top bar */
  function bindTop() {
    var E = S.els;
    E.side.addEventListener('click', toggleSide);
    E.title.addEventListener('click', startRename);
    E.share.addEventListener('click', function () { openShare(E.share); });
    E.activity.addEventListener('click', function () { setActivity(!S.actOpen); });
    E.dots.addEventListener('click', function () { openDotsMenu(E.dots); });
    E.threadbtn.addEventListener('click', function () { openThreadMenu(E.threadbtn); });
    E.newthread.addEventListener('click', newThread);
    E.drawerclose.addEventListener('click', function () { setActivity(false); });
    E.scrim.addEventListener('click', function () { setActivity(false); });
    Array.prototype.forEach.call(S.root.querySelectorAll('.wsp-seg [data-view]'), function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
  }

  function toggleSide() {
    var s = F.store && F.store.get();
    var hook = F.sidebar || F.side;
    if (hook && isNarrow() && typeof hook.open === 'function') { hook.open(); return; }   // off-canvas drawer
    if (hook && typeof hook.toggle === 'function') { hook.toggle(); return; }
    var b = document.querySelector('[data-side-toggle], [data-side-open], .fx-burger, .fx-side-toggle--float');
    if (b) { b.click(); return; }
    if (s) F.store.update(function (x) { x.sideCollapsed = !x.sideCollapsed; });
  }

  function startRename() {
    var t = T(); if (!t || S.renaming) return;
    var E = S.els;
    S.renaming = true;
    var input = document.createElement('input');
    input.type = 'text'; input.className = 'wsp-title__input'; input.value = t.title || '';
    input.setAttribute('aria-label', 'Trip title'); input.maxLength = 80;
    E.title.hidden = true;
    E.titlewrap.appendChild(input);
    input.focus(); input.select();
    var done = false;
    function finish(save) {
      if (done) return; done = true;
      var v = input.value.trim();
      S.renaming = false;
      input.remove();
      E.title.hidden = false;
      if (save && v && v !== t.title) {
        if (F.trips && F.trips.rename) F.trips.rename(S.tripId, v);
        else upd(function (tr) { tr.title = v; });
      }
      S.sig.title = null; render();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function openShare(anchor) {
    var el = document.createElement('div');
    el.className = 'wsp-share-pop';
    el.innerHTML = '<p class="wsp-share-pop__hint">Create a link anyone can open to view this trip’s itinerary. It does not include your conversations or reservations.</p>' +
      '<button type="button" class="wsp-btn wsp-btn--ink" data-x="create">Create share link</button><div data-share-result></div>' +
      '<div data-x="friends"></div><hr><button type="button" class="wsp-share-pop__print" data-x="print">' + ic('printer', 16) + '<span>Print itinerary</span></button>';
    popover(anchor, el);
    var result = el.querySelector('[data-share-result]');
    var tripNow = T();
    if (F.feedback && F.backend && F.backend.request && tripNow) el.querySelector('[data-x="friends"]').appendChild(F.feedback.ownerPanel(tripNow.serverId || tripNow.id, F.backend.request));
    el.querySelector('[data-x="create"]').addEventListener('click', function () {
      var btn = el.querySelector('[data-x="create"]'), t = T();
      if (!F.backend || !F.backend.share) { toast('Sharing is unavailable right now'); return; }
      btn.disabled = true; btn.textContent = 'Creating link…';
      F.backend.share(t.id).then(function (share) {
        var url = new URL(share.url, window.location.origin).href;
        result.innerHTML = '<label class="wsp-share-pop__label" for="wsp-share-url">Share link · expires ' + esc(new Date(share.expires).toLocaleDateString()) + '</label><div class="wsp-share-pop__row"><input id="wsp-share-url" type="text" readonly value="' + esc(url) + '"><button type="button" class="wsp-btn wsp-btn--ink" data-x="copy">' + ic('copy', 14) + '<span>Copy</span></button></div><a class="wsp-btn wsp-btn--ink wsp-share-pop__whatsapp" data-x="whatsapp" href="https://wa.me/?text=' + encodeURIComponent('Join me in planning ' + (t.title || 'a trip') + ' on Friday: ' + url) + '" target="_blank" rel="noopener noreferrer">Share on WhatsApp</a><button type="button" class="wsp-share-pop__print" data-x="revoke">Revoke link</button>';
        result.querySelector('input').addEventListener('focus', function () { this.select(); });
        result.querySelector('[data-x="whatsapp"]').addEventListener('click', function () { fetch('/api/shared/' + encodeURIComponent(new URL(url).searchParams.get('share')) + '/whatsapp-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(function () {}); });
        result.querySelector('[data-x="copy"]').addEventListener('click', function () { copyText(url).then(function () { toast('Link copied'); }); });
        result.querySelector('[data-x="revoke"]').addEventListener('click', function () { F.backend.revokeShare(t.id).then(function () { result.textContent = 'Share link revoked.'; }).catch(function (e) { toast(e.message || 'Could not revoke link'); }); });
        btn.hidden = true;
      }).catch(function (e) { btn.disabled = false; btn.textContent = 'Create share link'; result.textContent = e.message || 'Could not create link'; });
    });
    el.querySelector('[data-x="print"]').addEventListener('click', function () {
      closePop();
      var t = T(); if (t && t.plan && t.activeTab !== 'plan') setTab('plan', true);
      renderPrint();
      setTimeout(function () { window.print(); }, 60);
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
    }
    return fallbackCopy(text);
  }
  function fallbackCopy(text) {
    return new Promise(function (res) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove(); res();
    });
  }

  function openDotsMenu(anchor) {
    var t = T(); if (!t) return;
    var items = [
      { label: 'Rename trip', icon: 'edit', onClick: function () { setTimeout(startRename, 0); } },
      { label: 'Duplicate trip', icon: 'copy', onClick: duplicateTrip },
      { label: 'New conversation', icon: 'plus', onClick: newThread },
      { label: 'Reset map view', icon: 'compass', onClick: resetMap }
    ];
    if (isNarrow()) items.splice(3, 0, { label: 'Activity', icon: 'users', onClick: function () { setActivity(true); } });
    items.push('sep', { label: 'Delete trip', icon: 'trash', danger: true, onClick: deleteTrip });
    openMenu(anchor, items);
  }
  function duplicateTrip() {
    if (!F.trips || !F.trips.duplicate) return;
    var res = F.trips.duplicate(S.tripId);
    var id = res && (res.id || (typeof res === 'string' ? res : null));
    if (id && F.router) F.router.go('#/trip/' + id);
    toast('Trip duplicated');
  }
  function newThread() {
    if (F.chat && F.chat.newThread) F.chat.newThread();
    setView('chat');
    setTimeout(focusComposer, 30);
  }
  function resetMap() {
    if (F.map && F.map.fit) F.map.fit();
    if (F.store) F.store.emit('map:fit');
  }
  function deleteTrip() {
    var t = T(); if (!t) return;
    confirmBox('Delete “' + (t.title || 'this trip') + '”? This can’t be undone.', 'Delete').then(function (ok) {
      if (!ok) return;
      var id = S.tripId;
      if (F.trips && F.trips.remove) F.trips.remove(id);
      var cur = F.router && F.router.current && F.router.current();
      if (cur && cur.name === 'trip' && cur.id === id) F.router.go('#/');
    });
  }

  function openThreadMenu(anchor) {
    var t = T(); if (!t) return;
    var items = (t.threads || []).map(function (th) {
      return {
        label: th.title || 'New conversation',
        icon: th.id === t.activeThreadId ? 'check' : undefined,
        onClick: function () { switchThread(th.id); }
      };
    });
    items.push('sep', { label: 'New conversation', icon: 'plus', onClick: newThread });
    openMenu(anchor, items);
  }
  function switchThread(id) {
    upd(function (tr) { tr.activeThreadId = id; });
    var t = T();
    try { if (t && F.chat && F.chat.render) F.chat.render(t); } catch (e) { console.error(e); }
    setView('chat');
  }

  function setActivity(on) {
    S.actOpen = !!on;
    var E = S.els;
    E.drawer.classList.toggle('is-open', S.actOpen);
    E.drawer.setAttribute('aria-hidden', S.actOpen ? 'false' : 'true');
    E.scrim.hidden = !S.actOpen;
    E.scrim.classList.toggle('is-open', S.actOpen);
    E.activity.classList.toggle('is-on', S.actOpen);
    if (S.actOpen) { S.sig.drawer = null; var t = T(); if (t) renderDrawer(t); E.drawerclose.focus(); }
  }
  function renderDrawer(t) {
    if (!S.actOpen) return;
    var list = (t.activity || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var sig = JSON.stringify(list.map(function (a) { return [a.at, a.text]; }));
    if (!sigChanged('drawer', sig)) return;
    S.els.drawerbody.innerHTML = list.length ? list.map(function (a) {
      return '<div class="wsp-act-row"><span class="wsp-act-row__dot"></span><div><div class="wsp-act-row__who">' + esc(a.who || 'Friday') +
        '</div><div class="wsp-act-row__text">' + esc(a.text) + '</div></div><time class="wsp-act-row__time">' + esc(timeAgo(a.at)) + '</time></div>';
    }).join('') : '<p class="wsp-empty-note">No activity yet. Changes to this trip will be listed here.</p>';
  }

  function setView(v) {
    S.view = v === 'map' ? 'map' : 'chat';
    S.root.setAttribute('data-view', S.view);
    Array.prototype.forEach.call(S.root.querySelectorAll('.wsp-seg [data-view]'), function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-view') === S.view ? 'true' : 'false');
    });
    if (S.view === 'map') scheduleMapResize();
  }

  function toggleMap() {
    upd(function (tr) { tr.mapCollapsed = !tr.mapCollapsed; });
  }

  /* ------------------------------------------------------------ split */
  function applySplit() {
    S.root.style.setProperty('--wsp-split', S.split + '%');
    S.els.divider && S.els.divider.setAttribute('aria-valuenow', String(Math.round(S.split)));
  }
  function bindDivider() {
    var E = S.els, d = E.divider;
    var dragging = false;
    function move(e) {
      if (!dragging) return;
      var r = E.split.getBoundingClientRect();
      S.split = clamp(((e.clientX - r.left) / r.width) * 100, 30, 70);
      applySplit();
      if (F.map && F.map.resize) F.map.resize();
    }
    function up(e) {
      if (!dragging) return;
      dragging = false;
      S.root.classList.remove('is-resizing');
      try { d.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      lsSet(SPLIT_KEY, String(S.split));
      if (F.map && F.map.resize) F.map.resize();
    }
    d.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true; S.root.classList.add('is-resizing');
      try { d.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      e.preventDefault();
    });
    d.addEventListener('pointermove', move);
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    d.addEventListener('dblclick', function () { S.split = 50; applySplit(); lsSet(SPLIT_KEY, '50'); if (F.map && F.map.resize) F.map.resize(); });
    d.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft') S.split = clamp(S.split - step, 30, 70);
      else if (e.key === 'ArrowRight') S.split = clamp(S.split + step, 30, 70);
      else return;
      e.preventDefault(); applySplit(); lsSet(SPLIT_KEY, String(S.split));
      if (F.map && F.map.resize) F.map.resize();
    });
  }

  /* ------------------------------------------------------------ composer */
  function autogrow() {
    var ta = S.els.ta; if (!ta) return;
    if (!ta.clientWidth) return;   // hidden page: measuring now would collapse it; open() re-measures
    ta.style.height = 'auto';
    var cs = window.getComputedStyle(ta);
    var lh = parseFloat(cs.lineHeight) || 24;
    var max = lh * 8 + 16;   // eight rows plus the textarea's vertical padding
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
    ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
  }

  var SEND_ICON = null, STOP_ICON = null;
  function syncComposer() {
    var E = S.els; if (!E.send) return;
    var t = T();
    var busy = S.busy || !!(F.chat && F.chat.busy);
    var has = !!E.ta.value.trim() || S.atts.length > 0;
    var state = busy ? 'stop' : (has ? 'ready' : 'empty');
    if (E.send.getAttribute('data-state') !== state) {
      E.send.setAttribute('data-state', state);
      E.send.disabled = state === 'empty';
      if (busy) {
        E.send.innerHTML = '<span class="wsp-stopglyph"></span>';
        E.send.setAttribute('aria-label', 'Stop');
      } else {
        if (SEND_ICON === null) SEND_ICON = ic('arrow-up', 18) || ic('send-plane', 18);
        E.send.innerHTML = SEND_ICON;
        E.send.setAttribute('aria-label', 'Send');
      }
    }
    E.mic.classList.toggle('is-listening', S.listening);
    E.mic.setAttribute('aria-pressed', S.listening ? 'true' : 'false');
  }

  function bindComposer() {
    var E = S.els;
    if (E.mode) {
      E.mode.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mode-choice]'); if (!b) return;
        var mode = b.getAttribute('data-mode-choice') === 'fast' ? 'fast' : 'deep';
        var t = T(); if (!t) return;
        F.store.update(function (s) {
          var current = s.trips.filter(function (x) { return x.id === S.tripId; })[0];
          if (current) current.researchMode = mode;
        });
        syncResearchMode(t);
      });
    }
    E.ta.addEventListener('input', function () { autogrow(); syncComposer(); });
    E.ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        doSend();
      }
    });
    E.ta.addEventListener('paste', function (e) {
      var files = e.clipboardData && e.clipboardData.files;
      if (files && files.length) {
        var imgs = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
        if (imgs.length) { e.preventDefault(); addFiles(imgs); }
      }
    });
    E.composer.addEventListener('click', function (e) {
      if (e.target === E.composer || e.target === E.atts) E.ta.focus();
    });
    E.img.addEventListener('click', function () { E.file.click(); });
    E.file.addEventListener('change', function () { addFiles(Array.prototype.slice.call(E.file.files)); E.file.value = ''; });
    E.mic.addEventListener('click', toggleMic);
    E.send.addEventListener('click', function () {
      if (S.busy || (F.chat && F.chat.busy)) { if (F.chat && F.chat.stop) F.chat.stop(); return; }
      doSend();
    });
    E.atts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      var i = +b.getAttribute('data-rm');
      var a = S.atts.splice(i, 1)[0];
      if (a && a.url) { try { URL.revokeObjectURL(a.url); } catch (x) { /* ignore */ } }
      renderAtts(); syncComposer();
    });
  }

  function addFiles(files) {
    files.forEach(function (f) {
      if (!/^image\//.test(f.type)) return;
      var url = ''; try { url = URL.createObjectURL(f); } catch (e) { /* ignore */ }
      S.atts.push({ name: f.name || 'image', url: url });
    });
    renderAtts(); syncComposer();
  }
  function renderAtts() {
    var E = S.els;
    E.atts.hidden = !S.atts.length;
    E.atts.innerHTML = S.atts.map(function (a, i) {
      return '<span class="wsp-att">' + (a.url ? '<img src="' + esc(a.url) + '" alt="">' : '') +
        '<span class="wsp-att__name">' + esc(a.name) + '</span>' +
        '<button type="button" class="wsp-att__x" data-rm="' + i + '" aria-label="Remove ' + esc(a.name) + '">' + ic('x', 12) + '</button></span>';
    }).join('');
  }
  function clearAtts() {
    S.atts.forEach(function (a) { if (a.url) { try { URL.revokeObjectURL(a.url); } catch (x) { /* ignore */ } } });
    S.atts = [];
    if (S.els.atts) renderAtts();
  }

  function doSend() {
    var t = T(); if (!t) return;
    if (S.busy || (F.chat && F.chat.busy)) return;
    var E = S.els;
    var text = E.ta.value.trim();
    if (!text && !S.atts.length) return;
    var attachments = S.atts.map(function (a) { return { name: a.name }; });
    var payload = { text: text, attachments: attachments, mode: t.researchMode === 'fast' ? 'fast' : 'deep' };
    if (S.rec) { try { S.rec.stop(); } catch (e) { /* ignore */ } }
    E.ta.value = ''; autogrow();
    clearAtts();
    syncComposer();
    if (isNarrow()) setView('chat');
    if (F.chat && F.chat.send) F.chat.send(payload);
  }

  function syncResearchMode(t) {
    if (!S.els.mode) return;
    var mode = t && t.researchMode === 'fast' ? 'fast' : 'deep';
    Array.prototype.forEach.call(S.els.mode.querySelectorAll('[data-mode-choice]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode-choice') === mode ? 'true' : 'false');
    });
    if (S.root) S.root.setAttribute('data-mode', mode);
  }

  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice input isn't supported in this browser"); return; }
    if (S.rec) { try { S.rec.stop(); } catch (e) { /* ignore */ } return; }
    var r;
    try { r = new SR(); } catch (e) { toast("Voice input isn't supported in this browser"); return; }
    r.lang = (navigator.language || 'en-US'); r.interimResults = false; r.continuous = false;
    r.onresult = function (ev) {
      var txt = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) txt += ev.results[i][0].transcript;
      }
      txt = txt.trim();
      if (txt) {
        var ta = S.els.ta;
        ta.value = (ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' : ta.value) + txt;
        autogrow(); syncComposer();
      }
    };
    r.onerror = function (ev) {
      if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')) toast('Microphone access was blocked');
    };
    r.onend = function () { S.rec = null; S.listening = false; syncComposer(); };
    try { r.start(); S.rec = r; S.listening = true; syncComposer(); }
    catch (e) { S.rec = null; S.listening = false; syncComposer(); }
  }

  function setComposer(text) {
    if (!S.els.ta) return;
    S.els.ta.value = text == null ? '' : String(text);
    autogrow(); syncComposer();
  }
  function focusComposer() {
    var ta = S.els.ta; if (!ta) return;
    ta.focus();
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------ tabs */
  function effectiveTab(t) {
    var a = t.activeTab || 'overview';
    if (a === 'overview') return a;
    if (a === 'plan') return t.plan ? 'plan' : 'overview';
    return (t.tabs || []).some(function (x) { return x.id === a; }) ? a : 'overview';
  }
  function setTab(id, quiet) {
    var t = T(); if (!t) return;
    if (t.activeTab !== id) upd(function (tr) { tr.activeTab = id; });
    if (!quiet && F.store) F.store.emit('tab', { tripId: S.tripId, tab: id });
  }

  function renderTabs(t) {
    var eff = effectiveTab(t);
    var versions = (t.versions || []).length;
    var sig = JSON.stringify([eff, !!t.plan, versions, !!t.mapCollapsed, (t.tabs || []).map(function (x) { return [x.id, x.name]; })]);
    if (!sigChanged('tabs', sig)) return;
    var html = '<div class="wsp-tabs__list" role="tablist">';
    html += tabBtn('overview', 'Trip Overview', eff === 'overview', false);
    if (t.plan) html += tabBtn('plan', 'Plan', eff === 'plan', false);
    (t.tabs || []).forEach(function (x) { html += tabBtn(x.id, x.name || 'Notes', eff === x.id, true); });
    html += '<button type="button" class="wsp-tabplus" data-act="tab-add" aria-label="Add a tab" title="Add a tab">' + ic('plus', 16) + '</button></div>';
    html += '<div class="wsp-tabs__right">';
    if (t.mapCollapsed) html += '<button type="button" class="wsp-maptab" data-act="map-expand" aria-label="Show map" title="Show map">' + ic('map', 14) + '<span>Map</span>' + ic('chevron-down', 14) + '</button>';
    if (versions) html += '<button type="button" class="wsp-iconbtn" data-act="history" aria-label="Plan history" title="Plan history" aria-haspopup="true" aria-expanded="false">' + ic('history', 17) + '</button>';
    html += '<button type="button" class="wsp-add" data-act="add-item">' + ic('plus', 14) + '<span>Add</span></button></div>';
    S.els.tabs.innerHTML = html;
  }
  function tabBtn(id, name, on, closable) {
    return '<div class="wsp-tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" class="wsp-tab__btn" data-act="tab" data-tab="' + esc(id) + '">' + esc(name) + '</button>' +
      (closable ? '<button type="button" class="wsp-tab__x" data-act="tab-close" data-tab="' + esc(id) + '" aria-label="Close ' + esc(name) + '">' + ic('x', 12) + '</button>' : '') + '</div>';
  }

  function bindTabs() {
    S.els.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'tab') setTab(b.getAttribute('data-tab'));
      else if (act === 'tab-add') addTab();
      else if (act === 'tab-close') closeTab(b.getAttribute('data-tab'));
      else if (act === 'map-expand') toggleMap();
      else if (act === 'history') openHistory(b);
      else if (act === 'add-item') openAddModal(null);
    });
  }
  function addTab() {
    promptBox('New tab', { placeholder: 'e.g. Packing list' }).then(function (name) {
      name = name && name.trim(); if (!name) return;
      var id = (F.util && F.util.uid) ? F.util.uid('tab_') : 'tab_' + Math.random().toString(36).slice(2, 9);
      upd(function (tr) {
        tr.tabs = tr.tabs || [];
        tr.tabs.push({ id: id, name: name, notes: '' });
        tr.activeTab = id;
      });
    });
  }
  function closeTab(id) {
    var t = T(); if (!t) return;
    var tab = (t.tabs || []).filter(function (x) { return x.id === id; })[0]; if (!tab) return;
    confirmBox('Close “' + tab.name + '” and delete its notes?', 'Close tab').then(function (ok) {
      if (!ok) return;
      upd(function (tr) {
        tr.tabs = (tr.tabs || []).filter(function (x) { return x.id !== id; });
        if (tr.activeTab === id) tr.activeTab = 'overview';
      });
    });
  }
  function openHistory(anchor) {
    var t = T(); if (!t) return;
    var vs = t.versions || [];
    var el = document.createElement('div');
    el.className = 'wsp-history';
    var rows = vs.map(function (v, i) { return { v: v, i: i }; }).reverse();
    el.innerHTML = '<div class="wsp-history__head">Plan history</div>' + (rows.length ? rows.map(function (r) {
      return '<div class="wsp-history__row"><div><div class="wsp-history__sum">' + esc(r.v.summary || 'Earlier plan') + '</div>' +
        '<div class="wsp-history__time">' + esc(timeAgo(r.v.at)) + ' ago</div></div>' +
        '<button type="button" class="wsp-btn" data-restore="' + r.i + '">Restore</button></div>';
    }).join('') : '<p class="wsp-empty-note">No earlier versions yet.</p>');
    popover(anchor, el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-restore]'); if (!b) return;
      var i = +b.getAttribute('data-restore');
      closePop();
      if (F.plan && F.plan.restore) F.plan.restore(S.tripId, i);
      toast('Plan restored');
    });
  }

  /* ------------------------------------------------------------ add item modal */
  function openAddModal(dayIndex) {
    var t = T(); if (!t) return;
    var d = destOf(t);
    var body = '<div class="wsp-addmodal" data-wsp-add></div>';
    openModal({
      title: 'Add to plan',
      body: body,
      actions: [{ label: 'Done', primary: true, onClick: function (close) { close(); } }],
      onOpen: function (el) {
        var root = el.querySelector('[data-wsp-add]'); if (!root) return;
        buildAddModal(root, dayIndex);
      }
    });
  }
  function buildAddModal(root, dayIndex) {
    var t = T(), d = destOf(t);
    var days = t.plan ? t.plan.days : [];
    var defDay = dayIndex != null ? dayIndex : Math.max(0, days.length - 1);
    function dayOpts() {
      var tt = T(), dd = tt.plan ? tt.plan.days : [];
      if (!dd.length) return '<option value="-1">Day 1 (new)</option>';
      return dd.map(function (x, i) {
        var lab = 'Day ' + (i + 1);
        if (x.date && F.util && F.util.fmtDay) lab += ' · ' + F.util.fmtDay(x.date).date;
        return '<option value="' + i + '"' + (i === defDay ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('');
    }
    root.innerHTML =
      '<form class="wsp-addmodal__custom" data-custom-form><strong>Add a place or stay</strong><div class="wsp-addmodal__customrow"><input name="name" required maxlength="120" placeholder="Place or stay name" aria-label="Place or stay name"><select name="kind" aria-label="Category"><option value="sight">Place</option><option value="stay">Stay</option><option value="food">Food & drink</option><option value="wellness">Wellness</option></select><button class="wsp-btn wsp-btn--ink" type="submit">Add</button></div><input name="address" maxlength="240" placeholder="Address (optional)" aria-label="Address, optional"></form><button type="button" class="wsp-btn" data-add-booking>Add a flight or event</button>' +
      (d ? '<div class="wsp-addmodal__search">' + ic('search', 16) + '<input type="search" placeholder="Search places in ' + esc(d.name) + '" aria-label="Search places"></div>' : '<p class="wsp-empty-note">You can add your own places now, or ask Friday to research a destination.</p>') +
      '<div class="wsp-addmodal__day"><label>Add to</label><select aria-label="Day">' + dayOpts() + '</select></div>' +
      '<ul class="wsp-addmodal__list"></ul>';
    var search = root.querySelector('input[type=search]'), sel = root.querySelector('[aria-label="Day"]'), ul = root.querySelector('ul'), form = root.querySelector('[data-custom-form]');
    root.querySelector('[data-add-booking]').addEventListener('click', function () { if (F.bookings && F.bookings.openForm) F.bookings.openForm(S.tripId, parseInt(sel.value, 10), 'flight'); });
    form.addEventListener('submit', function (event) {
      event.preventDefault(); var name = form.elements.name.value.trim(); if (!name) return;
      var current = T(), dest = destOf(current);
      if (!dest) {
        var destId = 'research-custom-' + String(current.id).replace(/[^a-z0-9_-]/gi, '').slice(0, 50);
        dest = { id: destId, name: current.destName || current.title || 'My journey', tripTitle: current.title, currency: '', region: '', areas: [{ id: 'custom', name: current.destName || current.title || 'Journey', town: current.destName || current.title || 'Journey' }], places: {}, map: {} };
        F.DESTINATIONS[destId] = dest;
        upd(function (tr) { tr.destId = destId; tr.destName = dest.name; tr.catalog = dest; });
      }
      var id = 'custom-' + String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6), kind = form.elements.kind.value;
      dest.places[id] = { id: id, name: name, kind: kind, label: kind === 'sight' ? 'Place' : kind, area: dest.areas[0] && dest.areas[0].id || 'custom', address: form.elements.address.value.trim(), blurb: '', photos: [] };
      upd(function (tr) { tr.catalog = dest; });
      var day = parseInt(sel.value, 10); F.plan.addItem(S.tripId, day < 0 ? null : day, id);
      form.reset(); toast('Added ' + name + ' to your plan');
    });
    function list() {
      var tt = T(), inPlan = planPlaceIds(tt);
      var q = search ? search.value.trim().toLowerCase() : '';
      var ids = Object.keys(d && d.places || {}).filter(function (id) {
        if (!q) return true;
        var p = d.places[id];
        return (p.name + ' ' + (p.label || '') + ' ' + (p.kind || '') + ' ' + areaName(tt, p.area)).toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (d.places[b].rating || 0) - (d.places[a].rating || 0); }).slice(0, 60);
      ul.innerHTML = ids.length ? ids.map(function (id) {
        var p = Object.assign({ id: id }, d.places[id]);
        var inn = !!inPlan[id];
        return '<li class="wsp-addrow"><div class="wsp-addrow__thumb">' + plateHtml(tt, p) + '</div>' +
          '<div class="wsp-addrow__txt"><div class="wsp-addrow__name">' + esc(p.name) + '</div><div class="wsp-addrow__meta">' + metaLine(tt, p) + '</div></div>' +
          '<button type="button" class="wsp-btn' + (inn ? '' : ' wsp-btn--ink') + '" data-add="' + esc(id) + '"' + (inn ? ' disabled' : '') + '>' + (inn ? 'In plan' : 'Add') + '</button></li>';
      }).join('') : (q ? '<li class="wsp-empty-note">No places match “' + esc(search.value) + '”.</li>' : '');
    }
    list();
    if (search) search.addEventListener('input', list);
    ul.onclick = function (e) {
      var b = e.target.closest('[data-add]'); if (!b || b.disabled) return;
      var v = parseInt(sel.value, 10);
      F.plan.addItem(S.tripId, v < 0 ? null : v, b.getAttribute('data-add'));
      b.disabled = true; b.textContent = 'In plan'; b.classList.remove('wsp-btn--ink');
      sel.innerHTML = dayOpts();
      sel.value = String(v < 0 ? 0 : v);
    };
    setTimeout(function () { if (search) search.focus(); }, 30);
  }

  /* ------------------------------------------------------------ panel: routing */
  function renderPanel(t) {
    var E = S.els, eff = effectiveTab(t);
    var d = destOf(t);
    var sigObj;
    if (eff === 'overview') {
      var s = F.store.get();
      sigObj = {
        e: eff, dest: t.destId, pd: tripDates(t), plan: t.plan && { stay: t.plan.stay, ids: planPlaceIds(t) },
        days: t.plan && t.plan.days.map(function (x) { return [x.date, x.items.length]; }),
        b: F.bookings && F.bookings.forTrip ? F.bookings.forTrip(t.id) : [],
        sv: (s.saved || []).filter(function (x) { return x.destId === t.destId; }).map(function (x) { return x.placeId; })
      };
    } else if (eff === 'plan') {
      var s2 = F.store.get();
      sigObj = {
        e: eff, plan: t.plan, banner: t.banner, dest: t.destId,
        sv: (s2.saved || []).filter(function (x) { return x.destId === t.destId; }).map(function (x) { return x.placeId; }),
        col: S.collapsed, add: S.addDayId, addq: S.addQ
      };
    } else {
      var tab = (t.tabs || []).filter(function (x) { return x.id === eff; })[0];
      sigObj = { e: eff, name: tab && tab.name };
    }
    var sig = JSON.stringify(sigObj);
    var force = S.sig.panelForce; S.sig.panelForce = false;
    if (!force && !sigChanged('panel', sig)) { renderPrint(); return; }
    S.sig.panel = sig;
    if (eff === 'overview') E.panel.innerHTML = overviewHtml(t);
    else if (eff === 'plan') { E.panel.innerHTML = planHtml(t); afterPlanRender(); }
    else E.panel.innerHTML = notesHtml(t, eff);
    E.panel.setAttribute('data-tab', eff);
    if (eff !== 'plan' && eff !== 'overview') bindNotes(eff);
    renderPrint();
  }
  function forcePanel() { S.sig.panelForce = true; var t = T(); if (t) renderPanel(t); }

  /* ------------------------------------------------------------ panel: notes tab */
  function notesHtml(t, id) {
    var tab = (t.tabs || []).filter(function (x) { return x.id === id; })[0] || {};
    return '<div class="wsp-notes"><h2 class="wsp-h">' + esc(tab.name || 'Notes') + '</h2>' +
      '<textarea class="wsp-notes__ta" placeholder="Write anything you want to keep with this trip…" aria-label="Notes">' + esc(tab.notes || '') + '</textarea>' +
      '<p class="wsp-notes__hint">Saved automatically.</p></div>';
  }
  function bindNotes(id) {
    var ta = S.els.panel.querySelector('.wsp-notes__ta'); if (!ta) return;
    function save() {
      clearTimeout(S.notesTimer);
      var v = ta.value;
      upd(function (tr) { var x = (tr.tabs || []).filter(function (y) { return y.id === id; })[0]; if (x) x.notes = v; });
    }
    ta.addEventListener('input', function () { clearTimeout(S.notesTimer); S.notesTimer = setTimeout(save, 400); });
    ta.addEventListener('blur', function () { if (S.notesTimer) save(); });
  }

  /* ------------------------------------------------------------ panel: overview */
  var BOOKING_ICON = { hotel: 'bed', flight: 'navigation', reservation: 'fork', other: 'ticket' };
  function openBookingForm() {
    if (F.bookings && typeof F.bookings.openForm === 'function') F.bookings.openForm(S.tripId);
    else if (F.router) F.router.go('#/bookings');
  }
  /* ---- saved places, grouped by category ---- */
  var GROUPS = [
    { id: 'stays', name: 'Stays', kinds: ['stay'] },
    { id: 'attractions', name: 'Attractions', kinds: ['sight', 'museum', 'church', 'nature', 'beach', 'neighborhood'] },
    { id: 'food', name: 'Food & drink', kinds: ['food', 'nightlife', 'market'] },
    { id: 'wellness', name: 'Wellness', kinds: ['wellness'] }
  ];
  function savedGroups(t) {
    var groups = GROUPS.map(function (g) { return { id: g.id, name: g.name, kinds: g.kinds, items: [] }; });
    var seen = {};
    function put(pid) {
      if (!pid || seen[pid]) return;
      var p = placeOf(t, pid); if (!p) return;
      seen[pid] = true;
      var g = groups.filter(function (x) { return x.kinds.indexOf(p.kind) >= 0; })[0] || groups[1];
      g.items.push(p);
    }
    if (t.destId) {
      if (t.plan && t.plan.stay) put(t.plan.stay);
      (F.store.get().saved || []).forEach(function (x) { if (x.destId === t.destId) put(x.placeId); });
    }
    return groups;
  }
  function tripDates(t) {
    var d = t.prefs && t.prefs.dates;
    return d && d.start && d.end ? d : null;
  }
  function tripNights(t) {
    var d = tripDates(t);
    if (!d || !(F.util && F.util.diffDays)) return 0;
    return Math.max(0, F.util.diffDays(d.start, d.end));
  }
  function stayCardHtml(t, p) {
    var d = destOf(t), cur = d && d.currency, n = tripNights(t), dates = tripDates(t);
    var price = p.price ? (n
      ? '<strong>' + esc(money(p.price * n, cur)) + '</strong> <span>for ' + plural(n, 'night') + '</span>'
      : '<strong>' + esc(money(p.price, cur)) + '</strong> <span>per night</span>') : '<span>Price on request</span>';
    return '<article class="wsp-stay">' +
      '<a href="#" class="wsp-stay__plate" draggable="false" data-act="focus-place" data-place="' + esc(p.id) + '" aria-label="Show ' + esc(p.name) + ' on the map">' + plateHtml(t, p) + '</a>' +
      '<div class="wsp-stay__body"><div class="wsp-stay__top"><a href="#" draggable="false" class="wsp-stay__name" data-act="focus-place" data-place="' + esc(p.id) + '">' + esc(p.name) + '</a>' +
      (dates && F.util.fmtRange ? '<span class="wsp-stay__dates">' + esc(F.util.fmtRange(dates.start, dates.end)) + '</span>' : '') + '</div>' +
      '<div class="wsp-stay__meta">' + metaLine(t, p) + '</div>' +
      '<div class="wsp-stay__foot"><div class="wsp-stay__price">' + price + '</div>' +
      '<button type="button" class="wsp-btn wsp-btn--ink wsp-btn--sm" data-act="select-room" data-place="' + esc(p.id) + '">Select room</button></div></div></article>';
  }
  function openRoomModal(placeId) {
    var t = T(); if (!t) return;
    var p = placeOf(t, placeId); if (!p) return;
    var d = destOf(t), cur = d && d.currency, n = tripNights(t), dates = tripDates(t);
    var nightly = p.price || 0;
    var rooms = [
      { id: 'std', name: 'Standard', mult: 1 },
      { id: 'dlx', name: 'Deluxe', mult: 1.35 },
      { id: 'sui', name: 'Suite', mult: 2.1 }
    ].map(function (r) {
      var per = Math.round(nightly * r.mult / 50) * 50;
      return Object.assign({ per: per, total: n ? per * n : per }, r);
    });
    var body = '<div class="wsp-room" data-wsp-room><p class="wsp-room__hotel">' + esc(p.name) + (dates && F.util.fmtRange ? ' · ' + esc(F.util.fmtRange(dates.start, dates.end)) : '') + '</p>' +
      '<div class="wsp-room__list" role="radiogroup" aria-label="Room type">' + rooms.map(function (r, i) {
        return '<label class="wsp-room__opt"><input type="radio" name="wsp-room" value="' + r.id + '"' + (i === 0 ? ' checked' : '') + '>' +
          '<span class="wsp-room__radio"></span><span class="wsp-room__txt"><span class="wsp-room__name">' + esc(r.name) + '</span>' +
          '<span class="wsp-room__sub">' + esc(money(r.per, cur)) + ' per night</span></span>' +
          '<span class="wsp-room__price">' + esc(money(r.total, cur)) + (n ? '<small> for ' + plural(n, 'night') + '</small>' : '') + '</span></label>';
      }).join('') + '</div>' +
      '<p class="wsp-room__note">Preview — nothing is reserved. Check dates, prices and availability with the property before booking.</p></div>';
    var root = null;
    openModal({
      title: 'Select room',
      body: body,
      actions: [
        { label: 'Cancel', onClick: function (close) { close(); } },
        {
          label: 'Add to bookings', primary: true, onClick: function (close) {
            var chosen = root && root.querySelector('input[name="wsp-room"]:checked');
            var room = rooms.filter(function (r) { return chosen && r.id === chosen.value; })[0] || rooms[0];
            if (F.bookings && F.bookings.add) {
              F.bookings.add({
                type: 'hotel', tripId: S.tripId, destId: t.destId, placeId: p.id,
                name: p.name + ' — ' + room.name,
                start: dates ? dates.start : null, end: dates ? dates.end : null,
                price: room.total, currency: cur || '', ref: 'Not reserved (preview)'
              });
            }
            close();
            toast('Added to bookings');
          }
        }
      ],
      onOpen: function (el) { root = el.querySelector('[data-wsp-room]'); }
    });
  }

  function overviewHtml(t) {
    var d = destOf(t), cur = d && d.currency;
    var bookings = (F.bookings && F.bookings.forTrip) ? F.bookings.forTrip(t.id) : [];
    var h = '<div class="wsp-ov">';
    h += '<div class="wsp-sec-head"><h2 class="wsp-h">Bookings</h2>' +
      (bookings.length ? '<button type="button" class="wsp-btn wsp-btn--sm" data-act="booking-add">' + ic('plus', 14) + '<span>Add a booking</span></button>' : '') + '</div>';
    if (bookings.length) {
      h += '<div class="wsp-card wsp-blist">' + bookings.map(function (b) {
        var when = '';
        if (b.start && b.end && F.util && F.util.fmtRange) when = F.util.fmtRange(b.start, b.end);
        else if (b.start && F.util && F.util.fmtDay) when = F.util.fmtDay(b.start).date;
        return '<div class="wsp-brow"><span class="wsp-brow__ic">' + ic(BOOKING_ICON[b.type] || 'ticket', 16) + '</span>' +
          '<div class="wsp-brow__txt"><div class="wsp-brow__name">' + esc(b.name) + '</div><div class="wsp-brow__meta">' +
          esc([when, b.flightNumber ? 'Flight ' + b.flightNumber : '', b.startTime || b.endTime ? [b.startTime, b.endTime].filter(Boolean).join('–') : '', b.address, b.ref ? 'Ref ' + b.ref : ''].filter(Boolean).join(' · ')) + '</div></div>' +
          (b.price ? '<div class="wsp-brow__price">' + esc(money(b.price, b.currency || cur)) + '</div>' : '') +
          '<button type="button" class="wsp-iconbtn wsp-brow__rm" data-act="booking-rm" data-id="' + esc(b.id) + '" aria-label="Remove booking">' + ic('trash', 15) + '</button></div>';
      }).join('') + '</div>';
    } else {
      h += '<div class="wsp-card wsp-empty"><span class="wsp-empty__ic">' + ic('mail', 20) + '</span>' +
        '<div class="wsp-empty__t">No bookings yet</div><div class="wsp-empty__s">Flights and hotels you book will show up here.</div>' +
        '<button type="button" class="wsp-btn" data-act="booking-add">Add a booking</button></div>';
    }
    h += '<div class="wsp-sec-head"><h2 class="wsp-h">Saved</h2></div>';
    var groups = savedGroups(t);
    var any = groups.some(function (g) { return g.items.length; });
    if (!any) h += '<div class="wsp-card wsp-none">No items yet.</div>';
    var inPlan = planPlaceIds(t);
    groups.forEach(function (g) {
      if (!g.items.length) return;
      h += '<h3 class="wsp-sub">' + esc(g.name) + '</h3>';
      if (g.id === 'stays') {
        h += g.items.map(function (p) { return stayCardHtml(t, p); }).join('');
      } else {
        h += '<div class="wsp-card wsp-slist">' + g.items.map(function (p) {
          return '<div class="wsp-row"><div class="wsp-row__thumb">' + plateHtml(t, p) + '</div>' +
            '<div class="wsp-row__txt"><a href="#" class="wsp-link" data-act="focus-place" data-place="' + esc(p.id) + '">' + esc(p.name) + '</a><div class="wsp-row__meta">' + metaLine(t, p) + '</div></div>' +
            (inPlan[p.id] ? '<span class="wsp-row__in">In plan</span>' : '<button type="button" class="wsp-btn wsp-btn--sm" data-act="saved-add" data-place="' + esc(p.id) + '">Add to plan</button>') +
            '<button type="button" class="wsp-iconbtn" data-act="saved-rm" data-place="' + esc(p.id) + '" aria-label="Remove from saved" title="Remove from saved">' + ic('x', 15) + '</button></div>';
        }).join('') + '</div>';
      }
    });
    return h + '</div>';
  }

  /* ------------------------------------------------------------ panel: plan */
  function groupsOf(t) {
    var groups = [], last = null;
    t.plan.days.forEach(function (day, i) {
      if (!last || last.area !== day.area) {
        last = { area: day.area, key: (day.area || '') + ':' + day.id, days: [] };
        groups.push(last);
      }
      last.days.push({ day: day, index: i });
    });
    return groups;
  }
  function planHtml(t) {
    var plan = t.plan, d = destOf(t), cur = d && d.currency;
    var h = '<div class="wsp-plan">';
    if (t.banner) {
      h += '<div class="wsp-banner" role="status"><span class="wsp-banner__ic">' + ic('sparkle', 16) + '</span><span class="wsp-banner__t">' + esc(t.banner.text || 'Friday updated your plan.') + '</span>' +
        '<button type="button" class="wsp-banner__undo" data-act="undo">' + ic('undo', 14) + '<span>Undo</span></button>' +
        '<button type="button" class="wsp-banner__x" data-act="banner-close" aria-label="Dismiss">' + ic('x', 15) + '</button></div>';
    }
    var groups = groupsOf(t);
    var seen = {}, chips = [];
    groups.forEach(function (g) { if (!seen[g.area]) { seen[g.area] = 1; chips.push(g); } });
    if (chips.length) {
      h += '<div class="wsp-chips">' + chips.map(function (g) {
        return '<button type="button" class="wsp-chip" data-act="area-chip" data-key="' + esc(g.key) + '">' + esc(areaName(t, g.area)) + '</button>';
      }).join('') + '</div>';
    }
    var stayPlace = plan.stay ? placeOf(t, plan.stay) : null;
    groups.forEach(function (g) {
      var closed = !!S.collapsed[g.key];
      h += '<section class="wsp-area' + (closed ? ' is-closed' : '') + '" data-key="' + esc(g.key) + '">';
      h += '<header class="wsp-areahead"><span class="wsp-areahead__ic">' + ic('pin', 16) + '</span><span class="wsp-areahead__name">' + esc(areaName(t, g.area)) + '</span><span class="wsp-grow"></span>';
      if (stayPlace && stayPlace.area === g.area) h += '<button type="button" class="wsp-iconbtn wsp-areahead__bed" data-act="area-stay" data-place="' + esc(stayPlace.id) + '" aria-label="Show ' + esc(stayPlace.name) + ' on the map" title="' + esc(stayPlace.name) + '">' + ic('bed', 16) + '</button>';
      h += '<button type="button" class="wsp-iconbtn wsp-areahead__chev" data-act="area-toggle" data-key="' + esc(g.key) + '" aria-expanded="' + (!closed) + '" aria-label="' + (closed ? 'Expand' : 'Collapse') + ' ' + esc(areaName(t, g.area)) + '">' + ic(closed ? 'chevron-down' : 'chevron-up', 16) + '</button></header>';
      if (!closed) {
        g.days.forEach(function (gd) { h += dayHtml(t, gd.day, gd.index, cur); });
      }
      h += '</section>';
    });
    h += '<div class="wsp-planfoot"><button type="button" class="wsp-btn" data-act="add-day">' + ic('plus', 14) + '<span>Add day</span></button></div>';
    return h + '</div>';
  }
  function dayHtml(t, day, i, cur) {
    var color = (F.util && F.util.dayColor) ? F.util.dayColor(i) : '#D97757';
    var fd = day.date && F.util && F.util.fmtDay ? F.util.fmtDay(day.date) : null;
    var h = '<article class="wsp-day" data-day="' + esc(day.id) + '" data-index="' + i + '" style="--dc:' + color + '">';
    h += '<header class="wsp-dayhead"><span class="wsp-dayhead__num" aria-hidden="true">' + (i + 1) + '</span><div class="wsp-dayhead__txt">' +
      (fd ? '<div class="wsp-dayhead__wd">' + esc(fd.weekday) + '</div>' : '') +
      '<div class="wsp-dayhead__date">' + esc(fd ? fd.date : 'Day ' + (i + 1)) + '</div>' +
      (day.town ? '<div class="wsp-dayhead__town">' + esc(day.town) + '</div>' : '') + '</div>' +
      '<div class="wsp-dayhead__act">' + (day.items.length ? '<a class="wsp-iconbtn" href="' + esc(dayRouteUrl(t, day)) + '" target="_blank" rel="noopener noreferrer" aria-label="Open this day’s route in Google Maps" title="Open route in Google Maps">' + ic('navigation', 16) + '</a>' : '') + '<button type="button" class="wsp-iconbtn" data-act="day-nav" data-day="' + esc(day.id) + '" aria-label="Show day on the map" title="Show on map">' + ic('map', 16) + '</button>' +
      '<button type="button" class="wsp-iconbtn" data-act="day-menu" data-day="' + esc(day.id) + '" aria-label="Day options" aria-haspopup="true" aria-expanded="false">' + ic('dots', 16) + '</button></div></header>';
    h += '<div class="wsp-items" data-day="' + esc(day.id) + '">';
    day.items.forEach(function (it) { h += itemHtml(t, it, day, cur); });
    h += '</div>';
    var open = S.addDayId === day.id;
    h += '<div class="wsp-dayfoot" data-day="' + esc(day.id) + '">';
    if (open) {
      h += '<div class="wsp-inlineadd"><span class="wsp-inlineadd__ic">' + ic('search', 15) + '</span><input type="text" class="wsp-inlineadd__in" placeholder="Search places to add" aria-label="Search places to add" value="' + esc(S.addQ) + '" data-day="' + esc(day.id) + '" autocomplete="off">' +
        '<button type="button" class="wsp-btn wsp-btn--sm" data-act="add-custom-day" data-day="' + esc(day.id) + '">Add custom</button><button type="button" class="wsp-iconbtn" data-act="add-close" aria-label="Cancel">' + ic('x', 15) + '</button><ul class="wsp-inlineadd__list" data-day="' + esc(day.id) + '"></ul></div>';
    } else {
      h += '<button type="button" class="wsp-btn wsp-btn--sm" data-act="add-open" data-day="' + esc(day.id) + '">' + ic('plus', 14) + '<span>Add item</span></button>';
    }
    return h + '</div></article>';
  }
  function dayRouteUrl(t, day) {
    var d = destOf(t), places = (day.items || []).map(function (item) { return itemPlace(t, item); }).filter(Boolean);
    var query = function (p) { return [p.name, p.address, d && d.name].filter(Boolean).join(', '); };
    var base = 'https://www.google.com/maps/dir/?api=1&travelmode=transit';
    if (places.length < 2) return base + '&destination=' + encodeURIComponent(query(places[0] || { name: d && d.name || t.title }));
    return base + '&origin=' + encodeURIComponent(query(places[0])) + '&destination=' + encodeURIComponent(query(places[places.length - 1])) + (places.length > 2 ? '&waypoints=' + encodeURIComponent(places.slice(1, -1).map(query).join('|')) : '');
  }
  function itemHtml(t, it, day, cur) {
    var p = itemPlace(t, it), fid = focusId(it);
    return '<div class="wsp-item" draggable="true" data-kind="' + esc(p && p.kind || '') + '" data-item="' + esc(it.id) + '" data-place="' + esc(fid) + '" data-day="' + esc(day.id) + '">' +
      '<span class="wsp-item__grip" aria-hidden="true">' + ic('grip', 16) + '</span>' +
      '<div class="wsp-item__body"><a href="#" draggable="false" class="wsp-link wsp-item__name" data-act="focus-place" data-place="' + esc(fid) + '">' + esc(p.name) + '</a>' +
      '<button type="button" class="wsp-item__time" data-act="time-edit" data-item="' + esc(it.id) + '" aria-label="' + esc((it.time ? 'Edit time for ' : 'Add time for ') + p.name) + '">' + ic('clock', 13) + '<span>' + esc(it.time || 'Add time') + '</span></button>' +
      (metaLine(t, p) ? '<div class="wsp-item__meta">' + metaLine(t, p) + '</div>' : '') +
      (it.note ? '<p class="wsp-item__note">' + esc(it.note) + '</p>' : '') + '</div>' +
      '<div class="wsp-item__thumb">' + plateHtml(t, p) + '</div>' +
      '<button type="button" class="wsp-iconbtn wsp-item__dots" data-act="item-menu" data-item="' + esc(it.id) + '" aria-label="Item options" aria-haspopup="true" aria-expanded="false">' + ic('dots', 16) + '</button></div>';
  }

  function afterPlanRender() {
    // Restore the inline add-item input state after a re-render.
    if (S.addDayId) {
      var inp = S.els.panel.querySelector('.wsp-inlineadd__in');
      if (inp) {
        renderInlineResults(inp);
        if (S.addFocus) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* ignore */ } }
      }
    }
    if (S.hl) markHighlight(S.hl);
  }

  function renderInlineResults(inp) {
    var t = T(); if (!t) return;
    var d = destOf(t), ul = inp.parentNode.querySelector('ul'); if (!ul) return;
    if (!d) { ul.innerHTML = ''; return; }
    var q = inp.value.trim().toLowerCase(), inPlan = planPlaceIds(t);
    var ids = Object.keys(d.places || {}).filter(function (id) {
      if (inPlan[id]) return false;
      if (!q) return true;
      var p = d.places[id];
      return (p.name + ' ' + (p.label || '') + ' ' + (p.kind || '') + ' ' + areaName(t, p.area)).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (d.places[b].rating || 0) - (d.places[a].rating || 0); }).slice(0, 8);
    ul.innerHTML = ids.length ? ids.map(function (id) {
      var p = Object.assign({ id: id }, d.places[id]);
      return '<li><button type="button" class="wsp-inlineadd__opt" data-pick="' + esc(id) + '"><span class="wsp-inlineadd__thumb">' + plateHtml(t, p) + '</span>' +
        '<span class="wsp-inlineadd__txt"><span class="wsp-inlineadd__name">' + esc(p.name) + '</span><span class="wsp-inlineadd__meta">' + metaLine(t, p) + '</span></span></button></li>';
    }).join('') : '<li class="wsp-inlineadd__none">No matching places</li>';
  }

  /* ------------------------------------------------------------ panel: events */
  function dayIndexById(t, id) {
    var days = (t.plan && t.plan.days) || [];
    for (var i = 0; i < days.length; i++) if (days[i].id === id) return i;
    return -1;
  }
  function focusPlace(id) {
    var t = T(), p = placeOf(t, id);
    if (p && (!Array.isArray(p.at) || p.at.length < 2) && F.placeModal) { F.placeModal(t.destId, id, { tripId: t.id }); return; }
    if (F.map && F.map.focus) F.map.focus(id);
    if (isNarrow()) setView('map');
  }
  function editItemTime(itemId) {
    var t = T(), item = null;
    if (!t || !t.plan) return;
    t.plan.days.forEach(function (day) { day.items.forEach(function (it) { if (it.id === itemId) item = it; }); });
    if (!item) return;
    openModal({ title: 'Set stop time', body: '<div class="fx-form"><div class="fx-field"><label class="fx-label" for="wsp-stop-time">Time</label><input class="fx-input" type="time" id="wsp-stop-time" value="' + (/^\d{2}:\d{2}$/.test(item.time || '') ? esc(item.time) : '') + '"><p class="fx-hint">Times are saved with this stop and shown in your plan.</p></div></div>', actions: [
      { label: 'Cancel' },
      { label: 'Save time', primary: true, onClick: function (close) { var input = close.el && close.el.querySelector('#wsp-stop-time'); if (!input) return; if (F.plan && F.plan.setItemTime) F.plan.setItemTime(S.tripId, itemId, input.value); close(); } }
    ] });
  }

  function bindPanel() {
    var P = S.els.panel;
    P.addEventListener('click', function (e) {
      var pick = e.target.closest('[data-pick]');
      if (pick) {
        var t0 = T(), inp0 = pick.closest('.wsp-inlineadd').querySelector('input');
        var di = dayIndexById(t0, inp0.getAttribute('data-day'));
        S.addDayId = null; S.addQ = ''; S.addFocus = false;
        if (di >= 0 && F.plan) F.plan.addItem(S.tripId, di, pick.getAttribute('data-pick'));
        forcePanel();
        return;
      }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      var t = T(); if (!t) return;
      if (act === 'focus-place') { e.preventDefault(); focusPlace(b.getAttribute('data-place')); }
      else if (act === 'area-stay') focusPlace(b.getAttribute('data-place'));
      else if (act === 'undo') { if (F.plan && F.plan.undo) F.plan.undo(S.tripId); }
      else if (act === 'banner-close') upd(function (tr) { tr.banner = null; });
      else if (act === 'area-chip') scrollToArea(b.getAttribute('data-key'));
      else if (act === 'area-toggle') {
        var k = b.getAttribute('data-key');
        if (S.collapsed[k]) delete S.collapsed[k]; else S.collapsed[k] = true;
        forcePanel();
      }
      else if (act === 'day-nav') dayNav(t, b.getAttribute('data-day'));
      else if (act === 'day-menu') dayMenu(b, t, b.getAttribute('data-day'));
      else if (act === 'item-menu') itemMenu(b, t, b.getAttribute('data-item'));
      else if (act === 'time-edit') editItemTime(b.getAttribute('data-item'));
      else if (act === 'add-open') {
        S.addDayId = b.getAttribute('data-day'); S.addQ = ''; S.addFocus = true; forcePanel();
      }
      else if (act === 'add-custom-day') {
        var customDay = dayIndexById(t, b.getAttribute('data-day')); S.addDayId = null; S.addQ = ''; S.addFocus = false; forcePanel(); openAddModal(customDay);
      }
      else if (act === 'add-close') { S.addDayId = null; S.addQ = ''; S.addFocus = false; forcePanel(); }
      else if (act === 'add-day') {
        if (F.plan && F.plan.addDay) F.plan.addDay(S.tripId);
        raf(function () { P.scrollTo({ top: P.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }); });
      }
      else if (act === 'select-room') { e.preventDefault(); openRoomModal(b.getAttribute('data-place')); }
      else if (act === 'booking-add') openBookingForm();
      else if (act === 'booking-rm') { if (F.bookings && F.bookings.remove) F.bookings.remove(b.getAttribute('data-id')); }
      else if (act === 'saved-add') { if (F.plan) F.plan.addItem(S.tripId, null, b.getAttribute('data-place')); }
      else if (act === 'saved-rm') {
        if (F.saved && F.saved.toggle && t.destId) F.saved.toggle(t.destId, b.getAttribute('data-place'));
      }
    });

    P.addEventListener('input', function (e) {
      var inp = e.target.closest('.wsp-inlineadd__in'); if (!inp) return;
      S.addQ = inp.value; renderInlineResults(inp);
    });
    P.addEventListener('focusin', function (e) { if (e.target.closest('.wsp-inlineadd__in')) S.addFocus = true; });
    P.addEventListener('focusout', function (e) {
      var inp = e.target.closest && e.target.closest('.wsp-inlineadd__in'); if (!inp) return;
      setTimeout(function () {
        if (document.activeElement === inp || (S.addDayId && !S.els.panel.contains(inp))) return;
        var within = S.els.panel.querySelector('.wsp-inlineadd:hover');
        if (within) return;
        if (!inp.value && S.addDayId) { S.addDayId = null; S.addQ = ''; S.addFocus = false; forcePanel(); }
        else S.addFocus = false;
      }, 120);
    });
    P.addEventListener('keydown', function (e) {
      var inp = e.target.closest('.wsp-inlineadd__in'); if (!inp) return;
      if (e.key === 'Escape') { e.stopPropagation(); S.addDayId = null; S.addQ = ''; S.addFocus = false; forcePanel(); }
      else if (e.key === 'Enter') {
        var first = inp.parentNode.querySelector('[data-pick]'); if (first) first.click();
      }
    });

    // hover -> plan:highlight
    P.addEventListener('mouseover', function (e) {
      var it = e.target.closest('.wsp-item');
      var pid = it ? it.getAttribute('data-place') : null;
      if (pid !== S.hl) { S.hl = pid; markHighlight(pid); if (F.store) F.store.emit('plan:highlight', { placeId: pid }); }
    });
    P.addEventListener('mouseleave', function () {
      if (S.hl) { S.hl = null; markHighlight(null); if (F.store) F.store.emit('plan:highlight', { placeId: null }); }
    });

    bindDrag(P);
  }

  function markHighlight(pid) {
    Array.prototype.forEach.call(S.els.panel.querySelectorAll('.wsp-item.is-hl'), function (n) { n.classList.remove('is-hl'); });
    if (!pid) return;
    Array.prototype.forEach.call(S.els.panel.querySelectorAll('.wsp-item'), function (n) {
      if (n.getAttribute('data-place') === pid) n.classList.add('is-hl');
    });
  }
  function onHighlight(p) {
    var pid = p && p.placeId || null;
    if (pid === S.hl) return;
    markHighlight(pid);
  }

  function scrollToArea(key) {
    var P = S.els.panel;
    var el = P.querySelector('.wsp-area[data-key="' + cssEsc(key) + '"]'); if (!el) return;
    var chips = P.querySelector('.wsp-chips');
    var top = el.offsetTop - (P.querySelector('.wsp-plan') ? P.querySelector('.wsp-plan').offsetTop : 0);
    P.scrollTo({ top: el.offsetTop - 2, behavior: reduced() ? 'auto' : 'smooth' });
    void chips; void top;
  }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

  function dayNav(t, dayId) {
    var day = (t.plan.days || []).filter(function (x) { return x.id === dayId; })[0]; if (!day || !day.items.length) return;
    var ids = day.items.map(focusId);
    if (F.store) F.store.emit('map:fit-places', { placeIds: ids });
    if (F.map && F.map.focus) F.map.focus(ids[0], { open: false });
    if (isNarrow()) setView('map');
  }

  function dayMenu(anchor, t, dayId) {
    var i = dayIndexById(t, dayId), n = t.plan.days.length;
    var items = [];
    if (i > 0) items.push({ label: 'Move up', icon: 'arrow-up', onClick: function () { F.plan.moveDay(S.tripId, i, i - 1); } });
    if (i < n - 1) items.push({ label: 'Move down', icon: 'chevron-down', onClick: function () { F.plan.moveDay(S.tripId, i, i + 1); } });
    items.push({ label: 'Add item', icon: 'plus', onClick: function () { setTimeout(function () { S.addDayId = dayId; S.addQ = ''; S.addFocus = true; forcePanel(); }, 0); } });
    items.push('sep', {
      label: 'Delete day', icon: 'trash', danger: true, onClick: function () {
        confirmBox('Delete this day and its items?', 'Delete day').then(function (ok) { if (ok) F.plan.removeDay(S.tripId, dayIndexById(T(), dayId)); });
      }
    });
    openMenu(anchor, items);
  }

  function itemMenu(anchor, t, itemId) {
    var found = null, di = -1;
    t.plan.days.forEach(function (d, i) { d.items.forEach(function (it) { if (it.id === itemId) { found = it; di = i; } }); });
    if (!found) return;
    var items = [];
    if (found.place && F.saved && t.destId) {   // only curated places can be saved
      var saved = !!F.saved.has(t.destId, found.place);
      items.push({ label: saved ? 'Unsave' : 'Save', icon: 'star', onClick: function () { F.saved.toggle(t.destId, found.place); forcePanel(); } });
    }
    items.push(
      { label: 'Move to day ▸', icon: 'calendar', onClick: function () { setTimeout(function () { moveToDayMenu(anchor, itemId, di); }, 0); } },
      'sep',
      { label: 'Remove', icon: 'trash', danger: true, onClick: function () { F.plan.removeItem(S.tripId, itemId); } }
    );
    openMenu(anchor, items);
  }
  function moveToDayMenu(anchor, itemId, from) {
    var t = T(); if (!t || !t.plan) return;
    var items = t.plan.days.map(function (d, i) {
      var lab = 'Day ' + (i + 1) + (d.date && F.util && F.util.fmtDay ? ' · ' + F.util.fmtDay(d.date).date : '') + (d.town ? ' · ' + d.town : '');
      return {
        label: lab, icon: i === from ? 'check' : undefined,
        onClick: function () { if (i !== from) F.plan.moveItem(S.tripId, itemId, i, t.plan.days[i].items.length); }
      };
    });
    openMenu(anchor, items);
  }

  /* ------------------------------------------------------------ drag & drop */
  function bindDrag(P) {
    function clearMarks() {
      Array.prototype.forEach.call(P.querySelectorAll('.drop-before,.drop-after,.drop-end,.drop-start'), function (n) {
        n.classList.remove('drop-before', 'drop-after', 'drop-end', 'drop-start');
      });
    }
    P.addEventListener('dragstart', function (e) {
      var it = e.target.closest && e.target.closest('.wsp-item');
      if (!it) return;
      S.drag = { id: it.getAttribute('data-item'), target: null };
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', S.drag.id); } catch (x) { /* ignore */ }
      requestAnimationFrame(function () { it.classList.add('is-dragging'); });
      if (S.hl) { S.hl = null; markHighlight(null); if (F.store) F.store.emit('plan:highlight', { placeId: null }); }
    });
    P.addEventListener('dragover', function (e) {
      if (!S.drag) return;
      var dayEl = e.target.closest('.wsp-day'); if (!dayEl) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (x) { /* ignore */ }
      clearMarks();
      var pr = P.getBoundingClientRect();
      if (e.clientY < pr.top + 44) P.scrollTop -= 14; else if (e.clientY > pr.bottom - 44) P.scrollTop += 14;
      var it = e.target.closest('.wsp-item');
      var dayId = dayEl.getAttribute('data-day');
      if (it && it.getAttribute('data-item') !== S.drag.id) {
        var r = it.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
        it.classList.add(before ? 'drop-before' : 'drop-after');
        S.drag.target = { dayId: dayId, ref: it.getAttribute('data-item'), pos: before ? 'before' : 'after' };
      } else if (it) {
        S.drag.target = null;
      } else if (e.target.closest('.wsp-dayhead')) {
        dayEl.classList.add('drop-start');
        S.drag.target = { dayId: dayId, ref: null, pos: 'start' };
      } else {
        dayEl.classList.add('drop-end');
        S.drag.target = { dayId: dayId, ref: null, pos: 'end' };
      }
    });
    P.addEventListener('drop', function (e) {
      if (!S.drag) return;
      e.preventDefault();
      var drag = S.drag, tg = drag.target;
      clearMarks();
      finishDrag();
      var t = T(); if (!t || !t.plan || !tg) { forcePanel(); return; }
      var toDay = dayIndexById(t, tg.dayId); if (toDay < 0) return;
      var rest = t.plan.days[toDay].items.filter(function (x) { return x.id !== drag.id; });
      var idx;
      if (tg.pos === 'start') idx = 0;
      else if (tg.pos === 'end') idx = rest.length;
      else {
        idx = rest.map(function (x) { return x.id; }).indexOf(tg.ref);
        if (idx < 0) idx = rest.length; else if (tg.pos === 'after') idx += 1;
      }
      // no-op when nothing moves
      var curDay = -1, curIdx = -1;
      t.plan.days.forEach(function (d, i) { d.items.forEach(function (x, j) { if (x.id === drag.id) { curDay = i; curIdx = j; } }); });
      if (curDay === toDay && curIdx === idx) { forcePanel(); return; }
      if (F.plan && F.plan.moveItem) F.plan.moveItem(S.tripId, drag.id, toDay, idx);
    });
    P.addEventListener('dragend', function () { clearMarks(); finishDrag(); });
    function finishDrag() {
      Array.prototype.forEach.call(P.querySelectorAll('.is-dragging'), function (n) { n.classList.remove('is-dragging'); });
      S.drag = null;
      if (S.deferRender) { S.deferRender = false; render(); }
    }
  }

  /* ------------------------------------------------------------ map:focus -> scroll & flash */
  function onMapFocus(p) {
    var t = T(); if (!t || !p || !p.placeId || !t.plan) return;
    var found = null, grp = null;
    groupsOf(t).forEach(function (g) {
      g.days.forEach(function (gd) { gd.day.items.forEach(function (it) { if (!found && (it.place === p.placeId || it.id === p.placeId)) { found = it; grp = g; } }); });
    });
    if (!found) return;
    if (effectiveTab(t) !== 'plan') { setTab('plan', true); }
    // ensure the plan panel exists and the group is open
    var tt = T(); if (tt) renderTabs(tt);
    if (S.collapsed[grp.key]) delete S.collapsed[grp.key];
    var tt2 = T(); if (tt2) { renderPanel(tt2); }
    if (isNarrow() && S.view !== 'map') setView('map');
    var run = function () {
      var el = S.els.panel.querySelector('.wsp-item[data-item="' + cssEsc(found.id) + '"]'); if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
      setTimeout(function () { el.classList.remove('is-flash'); }, 1800);
    };
    raf(run);
  }

  /* ------------------------------------------------------------ misc */
  function bindMisc() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.actOpen && !S.pop) setActivity(false);
    });
    var mq = window.matchMedia && window.matchMedia('(max-width: 899px)');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { scheduleMapResize(); });
  }

  /* ------------------------------------------------------------ print sheet */
  function renderPrint() {
    var t = T(), el = S.els.print; if (!t || !el) return;
    var sig = JSON.stringify([t.title, t.plan]);
    if (S.sig.print === sig) return;
    S.sig.print = sig;
    var d = destOf(t), cur = d && d.currency;
    if (!t.plan) { el.innerHTML = '<h1>' + esc(t.title || 'Trip') + '</h1><p>No plan yet.</p>'; return; }
    var range = planRange(t);
    var h = '<h1>' + esc(t.title || 'Trip') + '</h1><p class="wsp-printdoc__sub">' + esc([d && d.name, range, plural(t.plan.days.length, 'day')].filter(Boolean).join(' · ')) + '</p>';
    var stay = t.plan.stay ? placeOf(t, t.plan.stay) : null;
    if (stay) h += '<p class="wsp-printdoc__stay">Stay: <strong>' + esc(stay.name) + '</strong>' + (stay.price ? ' · ' + esc(money(stay.price, cur)) + '/night' : '') + '</p>';
    t.plan.days.forEach(function (day, i) {
      var fd = day.date && F.util && F.util.fmtDay ? F.util.fmtDay(day.date) : null;
      h += '<section class="wsp-printday"><h2>' + esc(fd ? fd.long || fd.date : 'Day ' + (i + 1)) + '<span> ' + esc([fd ? 'Day ' + (i + 1) : '', day.town || areaName(t, day.area)].filter(Boolean).join(' · ')) + '</span></h2><ol>';
      day.items.forEach(function (it) {
        var p = itemPlace(t, it);
        h += '<li><strong>' + esc(p.name) + '</strong>' + (metaLine(t, p) ? ' <em>' + metaLine(t, p) + '</em>' : '') + (it.note ? '<div>' + esc(it.note) + '</div>' : '') + '</li>';
      });
      h += '</ol></section>';
    });
    h += '<p class="wsp-printdoc__foot">Planned with Friday · confirm venue details before booking.</p>';
    el.innerHTML = h;
  }

  /* ------------------------------------------------------------ export */
  F.workspace = { mount: mount, open: open, setComposer: setComposer, focusComposer: focusComposer };
})();
