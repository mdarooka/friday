/* ==========================================================================
   FRIDAY · trip-map.js
   The map. Pure SVG, drawn in the risograph house style, no tiles.

   FridayTrip.map = { mount(el), render(trip), focus(placeId, {open}), fit(), resize() }

   How it stays cheap
   - The basemap (sea, land, parks, rivers, roads, graticule) is projected once
     into "world" units and lives in ONE <g>. Pan and zoom only rewrite that
     group's matrix — nothing is re-projected while moving.
   - Markers, town labels and road shields must keep a constant screen size, so
     they live in a second, unscaled layer; each frame only their translate()
     is rewritten (a few dozen attribute writes).
   - Label collision is a handful of rectangle tests per frame.
   - Pins that would sit on top of each other (or on the stay pill) are fanned
     out on a small ring with leader lines. That is worked out in screen space
     after every render and whenever a pan or zoom settles, never per frame;
     per frame only the displaced pins' offsets and leaders are rewritten.
   ========================================================================== */
(function () {
  'use strict';

  var FT = (window.FridayTrip = window.FridayTrip || {});

  /* ------------------------------------------------------------- constants */

  var NS = 'http://www.w3.org/2000/svg';
  var K = 1000;                       // world units per degree of latitude
  var DAY_COLORS = ['#D97757', '#0A87A8', '#5B3FD6', '#178044', '#B721C9', '#2563EB', '#B45309'];
  var SEA = '#DDF0F8';
  var HATCH = 7;                      // px between sea hairlines
  var MARKER_R = 15;

  var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(reduceQuery && reduceQuery.matches); }

  /* Kind glyphs, drawn on a 24 grid, white 1.7px line. Our own paths so the
     map never depends on another module's icon set. */
  var GLYPH = {
    food: 'M6 3v6a2.2 2.2 0 0 0 4.4 0V3 M8.2 3v18 M17.6 21V3c-2.4 1.3-3.6 4-3.6 7.2V14h3.6',
    stay: 'M3 5.5v13.5 M3 15h18 M21 19v-6.2A2.8 2.8 0 0 0 18.2 10H10v5 M6.6 11.6h.01',
    nightlife: 'M5 4h14l-7 8.5z M12 12.5V20 M8 20h8',
    beach: 'M2.5 8c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0 M2.5 13c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0 M2.5 18c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0',
    nature: 'M5 20c0-9 5-15 15-16 0 10-6 15-15 16z M5 20c3-5.5 6.5-8.5 10.5-10.5',
    museum: 'M3 9l9-5 9 5z M5.5 9.5V18 M9.8 9.5V18 M14.2 9.5V18 M18.5 9.5V18 M3 20.5h18',
    sight: 'M4 20.5V11a8 8 0 0 1 16 0v9.5 M9 20.5v-6a3 3 0 0 1 6 0v6 M2.5 20.5h19',
    church: 'M12 3v18 M6.5 9h11',
    market: 'M5 8h14l-1 12.5H6z M9 8V6.5a3 3 0 0 1 6 0V8',
    wellness: 'M12 20.5c-4.4 0-8.2-3-9-8 4 0 7 2 9 5 2-3 5-5 9-5-.8 5-4.6 8-9 8z M12 17.5c-2.2-3-2.2-7.5 0-12.5 2.2 5 2.2 9.5 0 12.5z',
    neighborhood: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z M12 10.2h.01'
  };
  var UI = {
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    layers: 'M12 3l9 5-9 5-9-5z M3 12.5l9 5 9-5 M3 16.8l9 5 9-5',
    compass: 'M12 3l4.2 16.2L12 16.8 7.8 19.2z',
    up: 'M6 14.5l6-6 6 6',
    down: 'M6 9.5l6 6 6-6',
    x: 'M6 6l12 12 M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    bookmark: 'M6.5 3.5h11v17.5L12 17l-5.5 4z',
    star: 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.6l6.1-.8z'
  };

  function icon(d, size, opts) {
    opts = opts || {};
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' + (opts.fill || 'none') +
      '" stroke="currentColor" stroke-width="' + (opts.sw || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  /* --------------------------------------------------------------- helpers */

  function esc(s) {
    var u = FT.util && FT.util.esc;
    if (u) return u(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function dayColor(i) {
    var f = FT.util && FT.util.dayColor;
    return f ? f(i) : DAY_COLORS[((i % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length];
  }
  function money(n, cur) {
    var f = FT.util && FT.util.money;
    if (f) return f(n, cur);
    return (cur || '') + Number(n).toLocaleString('en-US');
  }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function el(tag, cls, attrs) {
    var e = document.createElementNS(NS, tag);
    if (cls) e.setAttribute('class', cls);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }

  function getDest(id) {
    if (!id) return null;
    var d = FT.dest ? FT.dest(id) : null;
    return d || (FT.DESTINATIONS && FT.DESTINATIONS[id]) || null;
  }

  /* ----------------------------------------------------------------- state */

  var S = {
    host: null, root: null, clip: null, svg: null, sea: null, hatchPat: null, world: null, over: null,
    empty: null, pop: null, btn: {}, ro: null, subs: false,
    w: 0, h: 0,
    trip: null, tripId: null, dest: null, key: '\u0000', sig: '',
    V: { cx: 0, cy: 0, s: 1 },        // view: world point at the centre of the viewport, and px per world unit
    sFit: 1, sMin: 0.5, sMax: 50,
    wb: [0, 0, 1, 1],                 // world bbox of dest.map.bounds
    lim: [0, 0, 1, 1],                // world box the viewport may never leave (where the drawn land ends)
    lngC: 0, latC: 0, cosk: 1,
    fitted: false, needFit: true,
    items: [], byPid: new Map(), labels: [], shields: [], water: null, waterW: 0,
    all: false,                       // show every place as a hollow dot
    hl: null,                         // highlighted place id
    popId: null, popH: 0, popW: 292, pending: null,
    lastZoomBtn: '', didDrag: false, recentFit: -1e9, markW: 0,
    ctl: [],                          // screen rects of the corner controls, relative to the map
    userMoved: false, fitIds: null,   // has the viewer moved the view since the last fit?
    fanT0: 0, fanActive: false, settleT: 0, lastVK: '', now: 0
  };

  var labelFontsReady = false;

  /* ------------------------------------------------------------ projection */

  function proj(p) {
    return [(p[0] - S.lngC) * S.cosk * K, (S.latC - p[1]) * K];
  }

  function setGeo(bounds) {
    S.lngC = (bounds[0] + bounds[2]) / 2;
    S.latC = (bounds[1] + bounds[3]) / 2;
    S.cosk = Math.cos(S.latC * Math.PI / 180);
    var a = proj([bounds[0], bounds[3]]);
    var b = proj([bounds[2], bounds[1]]);
    S.wb = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }

  /* Smoothed path. Every vertex is kept (the curve passes through it), with
     Bezier handles along the local direction, so coastlines look drawn rather
     than faceted without drifting off the data. Sharp turns stay sharp. */
  function pathD(coords, closed) {
    var pts = [], i;
    for (i = 0; i < coords.length; i++) pts.push(proj(coords[i]));
    if (closed && pts.length > 1) {
      var f = pts[0], l = pts[pts.length - 1];
      if (f[0] === l[0] && f[1] === l[1]) pts.pop();
    }
    var n = pts.length;
    if (n < 2) return '';
    var dirs = [];
    function dirAt(i) {
      var a = pts[closed ? (i + n - 1) % n : Math.max(i - 1, 0)];
      var c = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      var p = pts[i];
      var ux = p[0] - a[0], uy = p[1] - a[1], vx = c[0] - p[0], vy = c[1] - p[1];
      var lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (!lu || !lv) return [vx || ux ? (vx || ux) / (lu || lv) : 0, vy || uy ? (vy || uy) / (lu || lv) : 0];
      var cos = (ux * vx + uy * vy) / (lu * lv);
      if (cos < 0.42) return [0, 0];                     // a real corner: keep it sharp
      var dx = ux / lu + vx / lv, dy = uy / lu + vy / lv, dl = Math.hypot(dx, dy) || 1;
      return [dx / dl, dy / dl];
    }
    for (i = 0; i < n; i++) dirs.push(dirAt(i));
    function seg(i, j) {
      var a = pts[i], b = pts[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]) / 3;
      return 'C' + f1(a[0] + dirs[i][0] * L) + ' ' + f1(a[1] + dirs[i][1] * L) + ' ' +
        f1(b[0] - dirs[j][0] * L) + ' ' + f1(b[1] - dirs[j][1] * L) + ' ' + f1(b[0]) + ' ' + f1(b[1]);
    }
    var d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (i = 0; i < n - 1; i++) d += seg(i, i + 1);
    if (closed) d += seg(n - 1, 0) + 'Z';
    return d;
  }

  /* --------------------------------------------------------- text measuring */

  var mctx = null;
  function measure(text, font, spacing) {
    try {
      if (!mctx) mctx = document.createElement('canvas').getContext('2d');
      mctx.font = font;
      return mctx.measureText(text).width + (spacing || 0) * text.length;
    } catch (e) {
      return text.length * 7;
    }
  }
  var LABEL_FONT = {
    town: { font: '500 12px Inter, ui-sans-serif, system-ui, sans-serif', ls: 0, h: 14 },
    region: { font: '500 10px Inter, ui-sans-serif, system-ui, sans-serif', ls: 2.4, h: 12 },
    park: { font: 'italic 500 14px "Cormorant Garamond", Georgia, serif', ls: 0, h: 16 }
  };

  /* ------------------------------------------------------------------ mount */

  function mount(host) {
    if (!host) return;
    if (S.host === host && S.root && host.contains(S.root)) return;
    if (S.ro) { S.ro.disconnect(); S.ro = null; }
    S.host = host;
    host.textContent = '';

    var root = h('div', 'fm');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Trip map');
    root.tabIndex = -1;
    S.root = root;

    var clip = h('div', 'fm-clip');
    S.clip = clip;

    var svg = el('svg', 'fm-svg', { width: '100%', height: '100%', role: 'application', 'aria-label': 'Map. Drag to pan, scroll to zoom.' });
    svg.setAttribute('focusable', 'false');
    var defs = el('defs');
    defs.innerHTML =
      '<pattern id="fm-hatch" width="' + HATCH + '" height="' + HATCH + '" patternUnits="userSpaceOnUse">' +
      '<path d="M0 ' + (HATCH / 2) + 'H' + HATCH + '" stroke="#7FB8D0" stroke-opacity=".32" stroke-width="1" shape-rendering="crispEdges"/></pattern>' +
      '<radialGradient id="fm-shadow"><stop offset="0" stop-color="#15140F" stop-opacity=".34"/><stop offset=".6" stop-color="#15140F" stop-opacity=".16"/><stop offset="1" stop-color="#15140F" stop-opacity="0"/></radialGradient>';
    svg.appendChild(defs);
    S.hatchPat = defs.querySelector('#fm-hatch');

    S.sea = el('rect', 'fm-sea', { x: 0, y: 0, width: '100%', height: '100%', fill: SEA });
    svg.appendChild(S.sea);
    svg.appendChild(el('rect', 'fm-hatch', { x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#fm-hatch)' }));
    S.world = el('g', 'fm-world');
    svg.appendChild(S.world);
    S.over = el('g', 'fm-over');
    S.gLabels = el('g', 'fm-labels');
    S.gShields = el('g', 'fm-shields');
    S.gDots = el('g', 'fm-dots');
    S.gMarks = el('g', 'fm-marks');
    S.gLeads = el('g', 'fm-leads');
    S.over.appendChild(S.gLabels);
    S.over.appendChild(S.gShields);
    S.over.appendChild(S.gDots);
    S.over.appendChild(S.gLeads);
    S.over.appendChild(S.gMarks);
    svg.appendChild(S.over);
    S.svg = svg;
    clip.appendChild(svg);

    var empty = h('div', 'fm-empty',
      '<div class="fm-empty__in">' +
      '<svg viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="2" fill="currentColor" stroke="none"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10"/></svg>' +
      '<p>Your map fills in as you plan</p></div>');
    empty.hidden = true;
    S.empty = empty;
    clip.appendChild(empty);

    var pop = h('div', 'fm-pop');
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    S.pop = pop;
    clip.appendChild(pop);

    root.appendChild(clip);

    /* controls */
    var layers = h('button', 'fm-btn fm-layers', icon(UI.layers, 18));
    layers.type = 'button';
    layers.setAttribute('aria-pressed', 'false');
    var zoom = h('div', 'fm-zoom');
    var zin = h('button', 'fm-btn', icon(UI.plus, 18)); zin.type = 'button'; zin.title = 'Zoom in'; zin.setAttribute('aria-label', 'Zoom in');
    var zout = h('button', 'fm-btn', icon(UI.minus, 18)); zout.type = 'button'; zout.title = 'Zoom out'; zout.setAttribute('aria-label', 'Zoom out');
    var comp = h('button', 'fm-btn fm-compass', icon(UI.compass, 18, { fill: 'currentColor', sw: 1.2 }) + '<span class="fm-compass__n" aria-hidden="true">N</span>');
    comp.type = 'button'; comp.title = 'Reset view'; comp.setAttribute('aria-label', 'Reset view');
    zoom.appendChild(zin); zoom.appendChild(zout); zoom.appendChild(comp);
    var coll = h('button', 'fm-collapse', '');
    coll.type = 'button';
    var mark = h('div', 'fm-mark', '<i aria-hidden="true"></i>Friday cartography');
    root.appendChild(layers); root.appendChild(zoom); root.appendChild(coll); root.appendChild(mark);
    S.btn = { layers: layers, zin: zin, zout: zout, comp: comp, coll: coll, zoom: zoom, mark: mark };
    setLayersUI();

    layers.addEventListener('click', function () {
      S.all = !S.all;
      setLayersUI();
      buildOverlay();
      requestDraw();
    });
    zin.addEventListener('click', function () { zoomAt(S.w / 2, S.h / 2, 1.7); });
    zout.addEventListener('click', function () { zoomAt(S.w / 2, S.h / 2, 1 / 1.7); });
    comp.addEventListener('click', function () { closePop(); fit(); });
    coll.addEventListener('click', function () {
      var id = S.tripId;
      if (!id || !FT.store) return;
      FT.store.update(function (st) {
        var t = (FT.store.trip && FT.store.trip(id)) || (st.trips || []).filter(function (x) { return x.id === id; })[0];
        if (t) t.mapCollapsed = !t.mapCollapsed;
      });
    });

    host.appendChild(root);
    wireInput();
    wirePopover();

    if (window.ResizeObserver) {
      S.ro = new ResizeObserver(function () { resize(); });
      S.ro.observe(host);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { labelFontsReady = true; remeasureLabels(); refreshControls(); requestDraw(); });
    }
    ensureSubs();
    S.key = '\u0000';
    S.sig = '';
    S.needFit = true;
    readSize();
    var t = FT.store && FT.store.trip ? FT.store.trip() : null;
    render(t);
    setTimeout(function () { refreshControls(); requestDraw(); }, 0);
  }

  function ensureSubs() {
    if (S.subs || !FT.store || !FT.store.on) return;
    S.subs = true;
    FT.store.on('change', function () {
      if (!S.host) return;
      render(FT.store.trip ? FT.store.trip() : S.trip);
    });
    FT.store.on('map:fit', function () { sync(); fit(); });
    FT.store.on('map:fit-places', function (p) {
      sync();
      var ids = p && (p.placeIds || p.places);
      if (ids && ids.length) { S.recentFit = performance.now(); fit(ids); }
    });
    FT.store.on('plan:highlight', function (p) { setHighlight(p && p.placeId ? p.placeId : null); });
    FT.store.on('route', function () { closePop(); });
  }

  function setLayersUI() {
    var b = S.btn.layers;
    if (!b) return;
    var t = S.all ? 'Hide other places' : 'Show all places';
    b.title = t;
    b.setAttribute('aria-label', t);
    b.setAttribute('aria-pressed', S.all ? 'true' : 'false');
    b.classList.toggle('is-on', S.all);
  }

  /* ---------------------------------------------------------------- sizing */

  function readSize() {
    if (!S.host) return false;
    var w = S.host.clientWidth, hh = S.host.clientHeight;
    var changed = w !== S.w || hh !== S.h;
    S.w = w; S.h = hh;
    return changed;
  }

  /* Screen rectangles of the corner controls (layers, zoom stack, chevron, the
     cartography mark), relative to the map. Hidden controls have no box. */
  function refreshControls() {
    if (!S.root) return;
    var list = [], r0 = S.root.getBoundingClientRect(), b = S.btn, markR = 0;
    [b.layers, b.zoom, b.coll, b.mark].forEach(function (n) {
      if (!n) return;
      var r = n.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      var box = [r.left - r0.left, r.top - r0.top, r.right - r0.left, r.bottom - r0.top];
      list.push(box);
      if (n === b.mark) markR = box[2];
    });
    S.ctl = list;
    S.markW = markR ? markR + 8 : 0;
  }

  /* The map is often first drawn while its pane is hidden (0x0). Once it has a
     real size, fit to the plan; after that (window resize, collapse/expand)
     refit only while the viewer hasn't panned or zoomed since the last fit. */
  function resize() {
    if (!S.host) return;
    var pw = S.w, ph = S.h;
    if (!readSize()) return;
    if (S.w < 2 || S.h < 2) return;
    var wasZero = pw < 2 || ph < 2;
    refreshControls();
    computeFit();
    if (S.needFit || !S.fitted) {
      if (S.dest) applyFit(false, S.fitIds);
      S.needFit = false;
    } else if (S.dest && !S.userMoved) {
      applyFit(false, S.fitIds);
    } else {
      /* a pane mid-way through opening or closing is too small to clamp against */
      if (S.w >= 120 && S.h >= 120) clampView();
      if (wasZero) layoutFan(true);
    }
    closePopIfClipped();
    requestDraw();
  }

  /* ------------------------------------------------------------- data build */

  function planPlaceIds(trip) {
    var out = [], seen = {};
    var plan = trip && trip.plan;
    if (!plan) return out;
    (plan.days || []).forEach(function (d) {
      (d.items || []).forEach(function (it) {
        if (it.place && !seen[it.place]) { seen[it.place] = 1; out.push(it.place); }
      });
    });
    if (plan.stay && !seen[plan.stay]) out.push(plan.stay);
    return out;
  }

  function placeOf(id) {
    var d = S.dest;
    if (!d || !d.places || !d.places[id]) return null;
    var p = d.places[id];
    if (!p.id) p = Object.assign({ id: id }, p);
    return p;
  }

  function boundsFromPlaces(dest) {
    var w = 180, s = 90, e = -180, n = -90, any = false;
    var ps = (dest && dest.places) || {};
    Object.keys(ps).forEach(function (k) {
      var a = ps[k].at;
      if (!a) return;
      any = true;
      w = Math.min(w, a[0]); e = Math.max(e, a[0]); s = Math.min(s, a[1]); n = Math.max(n, a[1]);
    });
    if (!any) return [70, 8, 88, 25];
    var px = Math.max(0.05, (e - w) * 0.15), py = Math.max(0.05, (n - s) * 0.15);
    return [w - px, s - py, e + px, n + py];
  }

  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function niceStep(span) {
    var raw = span / 6;
    var steps = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
    return 10;
  }

  /* Where may the viewport go? A little past the bounds on every side (60% of
     the span). Land, parks and roads that run off the bounds are carried on far
     beyond that (see extend), so zooming out, or a pin-fitting view wider than
     the bounds, shows land colour rather than a clipped edge; on a side where
     the land really ends (an island, an open coast) it is plain sea. */
  var EXT = 4;                          // how far (in spans) bleeding land is carried on
  function limitBox(m, b) {
    var spanX = b[2] - b[0], spanY = b[3] - b[1];
    var w = Infinity, e = -Infinity, so = Infinity, n = -Infinity, any = false;
    (m.land || []).forEach(function (poly) {
      poly.forEach(function (q) {
        any = true;
        w = Math.min(w, q[0]); e = Math.max(e, q[0]); so = Math.min(so, q[1]); n = Math.max(n, q[1]);
      });
    });
    var eps = 1e-9;
    S.bleed = { w: any && w <= b[0] + eps, s: any && so <= b[1] + eps, e: any && e >= b[2] - eps, n: any && n >= b[3] - eps };
    S.bounds = b;
    var L = [b[0] - spanX * 0.6, b[1] - spanY * 0.6, b[2] + spanX * 0.6, b[3] + spanY * 0.6];
    var a = proj([L[0], L[3]]), c = proj([L[2], L[1]]);
    return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])];
  }

  /* Data is authored to the bounds, so anything that reaches or runs past them
     on a side the land bleeds off is pushed further out. When the pane is wider
     than the bounds, land, parks and roads then carry on instead of showing a
     clipped edge. Sides where the land really ends (an open coast) are left. */
  function extend(coords) {
    var B = S.bleed, b = S.bounds;
    if (!B || !(B.w || B.e || B.s || B.n)) return coords;
    var sx = b[2] - b[0], sy = b[3] - b[1], eps = 1e-6;
    return coords.map(function (q) {
      var x = q[0], y = q[1];
      if (B.w) { if (x < b[0] - eps) x = b[0] - (b[0] - x) * 8; else if (x <= b[0] + eps) x = b[0] - sx * EXT; }
      if (B.e) { if (x > b[2] + eps) x = b[2] + (x - b[2]) * 8; else if (x >= b[2] - eps) x = b[2] + sx * EXT; }
      if (B.s) { if (y < b[1] - eps) y = b[1] - (b[1] - y) * 8; else if (y <= b[1] + eps) y = b[1] - sy * EXT; }
      if (B.n) { if (y > b[3] + eps) y = b[3] + (y - b[3]) * 8; else if (y >= b[3] - eps) y = b[3] + sy * EXT; }
      return [x, y];
    });
  }

  function isRing(line) {
    if (!line || line.length < 4) return false;
    var a = line[0], z = line[line.length - 1];
    return Math.abs(a[0] - z[0]) < 1e-9 && Math.abs(a[1] - z[1]) < 1e-9;
  }

  function buildBase(dest) {
    clearNode(S.world); clearNode(S.gLabels); clearNode(S.gShields);
    S.labels = []; S.shields = []; S.water = null;
    if (!dest) return;
    var m = dest.map || {};
    var b = m.bounds || boundsFromPlaces(dest);
    setGeo(b);
    var W = S.wb;
    S.lim = limitBox(m, b);
    var i, g, p, d;

    /* shore halo + land */
    var landD = (m.land || []).map(function (poly) { return pathD(extend(poly), true); }).join('');
    if (landD) {
      p = el('path', 'fm-halo fm-ns', { d: landD }); S.world.appendChild(p);
      p = el('path', 'fm-land fm-ns', { d: landD }); S.world.appendChild(p);
    }

    /* graticule — 1px ochre at 6% */
    var spanLng = b[2] - b[0], spanLat = b[3] - b[1];
    var step = niceStep(Math.max(spanLng, spanLat));
    var gd = '';
    var x0 = W[0] - (W[2] - W[0]) * 2, x1 = W[2] + (W[2] - W[0]) * 2;
    var y0 = W[1] - (W[3] - W[1]) * 2, y1 = W[3] + (W[3] - W[1]) * 2;
    var lngA = Math.floor((b[0] - spanLng * 2) / step) * step, lngB = b[2] + spanLng * 2;
    var latA = Math.floor((b[1] - spanLat * 2) / step) * step, latB = b[3] + spanLat * 2;
    var c = 0;
    for (var lg = lngA; lg <= lngB && c < 120; lg += step, c++) {
      var xx = proj([lg, S.latC])[0];
      gd += 'M' + f1(xx) + ' ' + f1(y0) + 'V' + f1(y1);
    }
    c = 0;
    for (var lt = latA; lt <= latB && c < 120; lt += step, c++) {
      var yy = proj([S.lngC, lt])[1];
      gd += 'M' + f1(x0) + ' ' + f1(yy) + 'H' + f1(x1);
    }
    S.world.appendChild(el('path', 'fm-grat fm-ns', { d: gd }));

    /* parks */
    var parkD = (m.parks || []).map(function (poly) { return pathD(extend(poly), true); }).join('');
    if (parkD) S.world.appendChild(el('path', 'fm-park fm-ns', { d: parkD }));

    /* rivers & estuaries */
    var lakeD = '', waterD = '';
    (m.water || []).forEach(function (line) {
      if (isRing(line)) lakeD += pathD(extend(line), true);          // a closed ring is a lake
      else waterD += pathD(extend(line), false);
    });
    if (lakeD) S.world.appendChild(el('path', 'fm-lake fm-ns', { d: lakeD }));
    if (waterD) {
      S.water = el('path', 'fm-water fm-ns', { d: waterD });
      S.world.appendChild(S.water);
    }

    /* roads: pale casing + gold line */
    var roads = (m.roads || []).filter(function (r) { return r && r.path && r.path.length > 1; });
    if (roads.length) {
      var roadD = roads.map(function (r) { return pathD(extend(r.path), false); }).join('');
      S.world.appendChild(el('path', 'fm-road-case fm-ns', { d: roadD }));
      S.world.appendChild(el('path', 'fm-road fm-ns', { d: roadD }));
    }

    /* road shields, 1–2 per road along its length */
    roads.forEach(function (r) {
      if (!r.ref) return;
      var pts = extend(r.path).map(proj);
      var lens = [0], tot = 0;
      for (var j = 1; j < pts.length; j++) {
        tot += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
        lens.push(tot);
      }
      var at = tot > 900 ? [0.28, 0.72] : [0.5];
      at.forEach(function (fr) {
        var target = tot * fr, k = 1;
        while (k < lens.length - 1 && lens[k] < target) k++;
        var seg = lens[k] - lens[k - 1] || 1, t = (target - lens[k - 1]) / seg;
        var px = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t;
        var py = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
        var txt = String(r.ref);
        var tw = measure(txt, '600 9px Inter, ui-sans-serif, system-ui, sans-serif', 0.3);
        var wdt = Math.max(16, tw + 9);
        var g2 = el('g', 'fm-shield');
        g2.innerHTML = '<rect x="' + f1(-wdt / 2) + '" y="-7.5" width="' + f1(wdt) + '" height="15" rx="5"/><text y="0.5" text-anchor="middle" dominant-baseline="central">' + esc(txt) + '</text>';
        S.gShields.appendChild(g2);
        S.shields.push({ el: g2, x: px, y: py, w: wdt, h: 15, pri: 2, vis: true, txt: txt });
      });
    });

    /* labels */
    (m.labels || []).forEach(function (lb) {
      if (!lb || !lb.at || !lb.t) return;
      var kind = LABEL_FONT[lb.kind] ? lb.kind : 'town';
      var pr = proj(lb.at);
      var t = el('text', 'fm-lb fm-lb--' + kind, { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      var txt = kind === 'region' ? String(lb.t).toUpperCase() : String(lb.t);
      t.textContent = txt;
      S.gLabels.appendChild(t);
      S.labels.push({ el: t, x: pr[0], y: pr[1], kind: kind, txt: txt, w: 0, h: LABEL_FONT[kind].h, pri: kind === 'town' ? 1 : kind === 'park' ? 2 : 3, vis: true });
    });
    remeasureLabels();
  }

  function remeasureLabels() {
    S.labels.forEach(function (l) {
      var f = LABEL_FONT[l.kind];
      l.w = measure(l.txt, f.font, f.ls);
    });
  }

  /* -------------------------------------------------------------- overlays */

  function planInfo() {
    var trip = S.trip, plan = trip && trip.plan, days = [];
    var dayOf = {};
    if (plan && plan.days) {
      plan.days.forEach(function (d, i) {
        var pts = [];
        (d.items || []).forEach(function (it) {
          if (!it.place) return;
          if (dayOf[it.place] == null) dayOf[it.place] = i;
          pts.push(it.place);
        });
        days.push(pts);
      });
    }
    return { plan: plan, days: days, dayOf: dayOf, stay: plan && plan.stay };
  }

  function markerHTML(p, color, isStay, cur) {
    var glyph = GLYPH[p.kind] || GLYPH.neighborhood;
    var iconG = '<path d="' + glyph + '" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
    if (isStay) {
      var price = p.price != null ? money(p.price, cur) : '';
      var tw = price ? measure(price, '500 12px Inter, ui-sans-serif, system-ui, sans-serif', 0) : 0;
      var wdt = price ? Math.round(34 + tw + 8) : 30;
      var left = -wdt / 2;
      return {
        w: wdt, html:
          '<g class="fm-mk-in"><rect x="' + f1(left - 1) + '" y="-16" width="' + (wdt + 2) + '" height="32" rx="16" class="fm-mk-ring"/>' +
          '<ellipse cx="0" cy="3" rx="' + f1(wdt / 2 + 6) + '" ry="20" fill="url(#fm-shadow)" class="fm-mk-sh"/>' +
          '<rect x="' + f1(left) + '" y="-15" width="' + wdt + '" height="30" rx="15" class="fm-mk-stay"/>' +
          '<circle cx="' + f1(left + 15) + '" cy="0" r="11.5" class="fm-mk-stay-dot"/>' +
          '<g transform="translate(' + f1(left + 15 - 8) + ' -8) scale(.667)">' + iconG + '</g>' +
          (price ? '<text x="' + f1(left + 31) + '" y="0.5" dominant-baseline="central" class="fm-mk-price">' + esc(price) + '</text>' : '') +
          '</g>'
      };
    }
    return {
      w: 30, html:
        '<g class="fm-mk-in"><ellipse cx="0" cy="3" rx="21" ry="21" fill="url(#fm-shadow)" class="fm-mk-sh"/>' +
        '<circle r="' + MARKER_R + '" fill="' + color + '" class="fm-mk-disc k-' + esc(String(p.kind || 'neighborhood')) + '"/>' +
        '<g transform="translate(-8 -8) scale(.667)">' + iconG + '</g></g>'
    };
  }

  function addItem(cfg) {
    var g = el('g', 'fm-mk' + (cfg.cls ? ' ' + cfg.cls : ''), { 'data-pid': cfg.pid, tabindex: 0, role: 'button', 'aria-label': cfg.label });
    g.innerHTML = cfg.html;
    cfg.host.appendChild(g);
    var it = { pid: cfg.pid, el: g, stay: /fm-mk--stay/.test(cfg.cls || ''), x: cfg.x, y: cfg.y, hw: cfg.hw, hh: cfg.hh, top: cfg.top, kind: cfg.kind, color: cfg.color || '#15140F', vis: true, sx: 0, sy: 0, ox: 0, oy: 0, tox: 0, toy: 0, fx: 0, fy: 0, lead: null };
    S.items.push(it);
    if (!S.byPid.has(cfg.pid) || cfg.kind === 'plan') S.byPid.set(cfg.pid, it);
    return it;
  }

  function buildOverlay() {
    /* remove old route lines (they live in the world group) */
    var old = S.world.querySelectorAll('.fm-route');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    clearNode(S.gDots); clearNode(S.gMarks); clearNode(S.gLeads);
    S.items = []; S.byPid = new Map(); S.fanActive = false;
    if (!S.dest) return;
    var cur = S.dest.currency || '';
    var info = planInfo();
    var inPlan = {};

    /* routes: one dashed polyline per day, under the markers */
    info.days.forEach(function (ids, di) {
      var pts = [];
      ids.forEach(function (pid) {
        var p = placeOf(pid);
        if (!p || !p.at) return;
        var w = proj(p.at), last = pts[pts.length - 1];
        if (last && Math.abs(last[0] - w[0]) < 0.5 && Math.abs(last[1] - w[1]) < 0.5) return;
        pts.push(w);
      });
      if (pts.length < 2) return;
      var d = 'M' + pts.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L');
      var r = el('path', 'fm-route fm-ns', { d: d, stroke: dayColor(di) });
      S.world.appendChild(r);
    });

    /* hollow dots for every other place */
    if (S.all && S.dest.places) {
      var ps = planPlaceIds(S.trip);
      ps.forEach(function (id) { inPlan[id] = 1; });
      Object.keys(S.dest.places).forEach(function (id) {
        if (inPlan[id]) return;
        var p = placeOf(id);
        if (!p || !p.at) return;
        var w = proj(p.at);
        addItem({ pid: id, host: S.gDots, cls: 'fm-mk--dot', x: w[0], y: w[1], hw: 6, hh: 6, top: 8, kind: 'dot', label: p.name,
          html: '<circle r="4.6" class="fm-dot"/><circle r="11" fill="transparent"/><title>' + esc(p.name) + '</title>' });
      });
    }

    /* plan markers (later ones on top; stay last) */
    var order = [], seen = {};
    info.days.forEach(function (ids, di) {
      ids.forEach(function (pid) { if (!seen[pid]) { seen[pid] = 1; order.push(pid); } });
    });
    if (info.stay && !seen[info.stay]) order.push(info.stay);
    order.sort(function (a, b) { return (a === info.stay ? 1 : 0) - (b === info.stay ? 1 : 0); });
    order.forEach(function (pid) {
      var p = placeOf(pid);
      if (!p || !p.at) return;
      var w = proj(p.at);
      var isStay = pid === info.stay || p.kind === 'stay';
      var di = info.dayOf[pid] != null ? info.dayOf[pid] : 0;
      var mk = markerHTML(p, dayColor(di), isStay, cur);
      addItem({ pid: pid, host: S.gMarks, x: w[0], y: w[1], hw: mk.w / 2 + 2, hh: 17, top: 19, kind: 'plan', color: dayColor(di), label: p.name + (isStay ? ' (stay)' : ''), html: mk.html, cls: isStay ? 'fm-mk--stay' : '' });
    });

    ensureGhost();
    applyHighlightClass();
    layoutFan(true);
  }

  /* A popover target that isn't drawn otherwise gets a temporary ringed pin. */
  function ensureGhost() {
    var old = S.gMarks.querySelector('.fm-mk--ghost');
    if (old) {
      S.items = S.items.filter(function (i) { return i.el !== old; });
      old.parentNode.removeChild(old);
    }
    if (!S.popId || S.byPid.has(S.popId)) return;
    var p = placeOf(S.popId);
    if (!p || !p.at) return;
    var w = proj(p.at);
    var glyph = GLYPH[p.kind] || GLYPH.neighborhood;
    var it = addItem({ pid: S.popId, host: S.gMarks, cls: 'fm-mk--ghost', x: w[0], y: w[1], hw: 15, hh: 15, top: 17, kind: 'ghost', label: p.name,
      html: '<g class="fm-mk-in"><ellipse cx="0" cy="3" rx="21" ry="21" fill="url(#fm-shadow)" class="fm-mk-sh"/><circle r="15" class="fm-ghost"/><g transform="translate(-8 -8) scale(.667)"><path d="' + glyph + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></g>' });
    S.byPid.set(S.popId, it);
  }

  function applyHighlightClass() {
    S.items.forEach(function (it) {
      var on = it.pid === S.hl && it.kind !== 'dot';
      it.el.classList.toggle('is-hl', on);
      if (on) it.el.parentNode.appendChild(it.el);
    });
    S.items.forEach(function (it) { it.el.classList.toggle('is-open', S.popId === it.pid && it.kind !== 'dot'); });
  }

  function setHighlight(pid) {
    if (S.hl === pid) return;
    S.hl = pid;
    applyHighlightClass();
  }

  /* ---------------------------------------------------------------- render */

  function signature(trip, dest) {
    var plan = trip && trip.plan;
    var days = plan && plan.days ? plan.days.map(function (d) {
      return (d.items || []).map(function (i) { return i.place; }).join(',');
    }).join('|') : '';
    // A villa trip stores only stable Google Place IDs. Hydrated names and
    // coordinates live in the runtime catalog, so include the current pin
    // projection to rebuild the overlay when those transient details arrive.
    var visibleIds = S.all && dest && dest.places ? Object.keys(dest.places) : planPlaceIds(trip);
    var pins = visibleIds.map(function (id) {
      var p = dest && dest.places && dest.places[id];
      return [id, p && p.at || null, p && p.name || '', p && p.label || ''];
    });
    return [S.all ? 1 : 0, plan && plan.stay || '', days, JSON.stringify(pins)].join('#');
  }

  function render(trip) {
    if (!S.host) return;
    ensureSubs();
    S.trip = trip || null;
    S.tripId = trip ? trip.id : null;
    var dest = trip && trip.destId ? getDest(trip.destId) : null;
    S.dest = dest;
    var key = (trip ? trip.id : '') + '|' + (dest ? dest.id : '');
    var collapsed = !!(trip && trip.mapCollapsed);
    S.root.classList.toggle('is-collapsed', collapsed);
    S.root.classList.toggle('is-empty', !dest);
    S.empty.hidden = !!dest;
    S.svg.style.visibility = dest ? '' : 'hidden';
    var c = S.btn.coll;
    c.innerHTML = icon(collapsed ? UI.down : UI.up, 18) + '<span>Map</span>';
    c.title = collapsed ? 'Show map' : 'Hide map';
    c.setAttribute('aria-label', c.title);
    c.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

    var rebuilt = false;
    if (key !== S.key) {
      S.key = key;
      S.popId = null; S.pop.hidden = true; S.pending = null;
      buildBase(dest);
      S.needFit = true;
      S.fitted = false;
      S.sig = '';
      rebuilt = true;
    }
    var sig = signature(trip, dest);
    if (sig !== S.sig || rebuilt) {
      S.sig = sig;
      buildOverlay();
    }
    if (S.popId) renderPop();
    readSize();
    if (S.w > 1 && S.h > 1 && dest) {
      computeFit();
      if (S.needFit) { applyFit(false); S.needFit = false; }
      flushPending();
    }
    requestDraw();
  }

  function sync() {
    if (!S.host || !FT.store || !FT.store.trip) return;
    var t = FT.store.trip();
    if (t) render(t);
  }

  /* ------------------------------------------------------------------- view */

  function fitFor(box, pad, capMul, free) {
    var w = S.w, hh = S.h;
    var bw = Math.max(box[2] - box[0], 1), bh = Math.max(box[3] - box[1], 1);
    var aw = Math.max(20, w - pad.l - pad.r), ah = Math.max(20, hh - pad.t - pad.b);
    var s = Math.min(aw / bw, ah / bh);
    if (capMul) s = Math.min(s, S.sFit * capMul);
    s = free ? Math.max(s, 1e-6) : clamp(s, S.sMin, S.sMax);
    var bxc = (box[0] + box[2]) / 2, byc = (box[1] + box[3]) / 2;
    var pcx = pad.l + aw / 2, pcy = pad.t + ah / 2;
    return { cx: bxc - (pcx - w / 2) / s, cy: byc - (pcy - hh / 2) / s, s: s };
  }

  /* Padding is relative to the pane: 12% of its smaller side, 28 to 64px. */
  function basePad() {
    return Math.round(clamp(Math.min(S.w, S.h) * 0.12, 28, 64));
  }

  /* Plan pins as world points with the half-size of what is drawn there. */
  function pinsOf(ids) {
    var pins = [];
    (ids || planPlaceIds(S.trip)).forEach(function (id) {
      var p = placeOf(id);
      if (!p || !p.at) return;
      var q = proj(p.at), it = S.byPid.get(id);
      pins.push({ x: q[0], y: q[1], hw: it && it.kind === 'plan' ? it.hw : 17, hh: 17 });
    });
    return pins;
  }

  /* Would every pin, drawn at zoom s with the view centred on (cx, cy), sit fully
     inside the map and clear of the corner controls? */
  function pinsFit(pins, s, cx, cy) {
    var w = S.w, hh = S.h, m = 6, g = 4, i, k, p, sx, sy, c;
    for (i = 0; i < pins.length; i++) {
      p = pins[i];
      sx = w / 2 + (p.x - cx) * s; sy = hh / 2 + (p.y - cy) * s;
      if (sx - p.hw < m || sx + p.hw > w - m || sy - p.hh < m || sy + p.hh > hh - m) return false;
      for (k = 0; k < S.ctl.length; k++) {
        c = S.ctl[k];
        if (sx + p.hw > c[0] - g && sx - p.hw < c[2] + g && sy + p.hh > c[1] - g && sy - p.hh < c[3] + g) return false;
      }
    }
    return true;
  }

  var SHIFTS = (function () {
    var out = [], a, b;
    for (a = -4; a <= 4; a++) for (b = -4; b <= 4; b++) out.push([a * 14, b * 14]);
    return out.sort(function (u, v) { return Math.hypot(u[0], u[1]) - Math.hypot(v[0], v[1]); });
  })();

  /* The largest zoom at which the pins' box, padded by basePad(), holds every
     pin clear of the edges and the corner controls. Start from the padded fit,
     try nudging the view a little, then zoom out a notch and try again. With
     `free` the result isn't held to the zoom limits (that is how those limits
     are found). */
  function solveFit(pins, box, capMul, free) {
    var bp = basePad(), f = fitFor(box, { t: bp, r: bp, b: bp, l: bp }, capMul, true);
    var out = free ? f : (function () { f.s = clamp(f.s, S.sMin, S.sMax); return f; })();
    if (!pins.length || S.w < 120 || S.h < 120) return out;
    var s = f.s, cx = f.cx, cy = f.cy, n, j;
    for (n = 0; n < 200; n++) {
      for (j = 0; j < SHIFTS.length; j++) {
        var nx = cx - SHIFTS[j][0] / s, ny = cy - SHIFTS[j][1] / s;
        if (pinsFit(pins, s, nx, ny)) {
          return { cx: nx, cy: ny, s: free ? s : clamp(s, S.sMin, S.sMax) };
        }
      }
      s *= 0.97;
    }
    return { cx: cx, cy: cy, s: free ? s : clamp(s, S.sMin, S.sMax) };
  }

  /* World box of some pins, never tighter than 7% of the bounds (a lone stop or
     a tight cluster shouldn't zoom to the pavement). */
  function boxOf(pins) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pins.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
    var minW = (S.wb[2] - S.wb[0]) * 0.07, minH = (S.wb[3] - S.wb[1]) * 0.07;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (x1 - x0 < minW) { x0 = cx - minW / 2; x1 = cx + minW / 2; }
    if (y1 - y0 < minH) { y0 = cy - minH / 2; y1 = cy + minH / 2; }
    return [x0, y0, x1, y1];
  }

  function computeFit() {
    refreshControls();
    /* limits use a floor size so a map animating open/closed never rewrites the zoom */
    var ww = Math.max(S.w, 240), hh = Math.max(S.h, 200), pad = 6;
    var bw = Math.max(S.wb[2] - S.wb[0], 1), bh = Math.max(S.wb[3] - S.wb[1], 1);
    S.sFit = Math.min((ww - pad * 2) / bw, (hh - pad * 2) / bh);
    /* Zoom out no further than the smaller of "the whole bounds fit" and "the
       plan's pins fit", so the pins can always be brought into view. */
    var boundsFit = Math.min((S.w - pad * 2) / bw, (S.h - pad * 2) / bh);
    var pins = pinsOf(null), pinFit = Infinity;
    if (pins.length) pinFit = solveFit(pins, boxOf(pins), 9, true).s;
    S.sMin = Math.max(Math.min(boundsFit, pinFit), 1e-6);
    S.sMax = Math.max(S.sFit * 90, S.sMin * 4);
  }

  function targetFor(ids) {
    var pins = pinsOf(ids);
    if (!pins.length) return fitFor(S.wb, { t: 6, r: 6, b: 6, l: 6 }, 0);
    return solveFit(pins, boxOf(pins), 9, false);
  }

  function applyFit(animate, ids) {
    if (!S.dest || S.w < 2 || S.h < 2) return;
    var t = targetFor(ids);
    S.fitted = true;
    S.fitIds = ids || null;
    if (animate) flyTo(t.cx, t.cy, t.s, 650);
    else { stopAnim(); setView(t.cx, t.cy, t.s); layoutFan(true); }
    S.userMoved = false;
  }

  /* The view may stray a little (60px) past the drawn extent, so a fit that has
     to leave room for the controls is never pushed back under them. */
  function clampView() {
    var V = S.V;
    V.s = clamp(V.s, S.sMin, S.sMax);
    var hx = S.w / 2 / V.s, hy = S.h / 2 / V.s, L = S.lim, sl = 60 / V.s;
    var l0 = L[0] - sl, l1 = L[1] - sl, l2 = L[2] + sl, l3 = L[3] + sl;
    V.cx = l2 - l0 <= hx * 2 ? (l0 + l2) / 2 : clamp(V.cx, l0 + hx, l2 - hx);
    V.cy = l3 - l1 <= hy * 2 ? (l1 + l3) / 2 : clamp(V.cy, l1 + hy, l3 - hy);
  }

  function setView(cx, cy, s) {
    S.V.cx = cx; S.V.cy = cy; S.V.s = s;
    clampView();
    requestDraw();
  }

  /* --------------------------------------------------------------- animation */

  var anim = null, raf = 0, lastT = 0;
  function stopAnim() { anim = null; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function flyTo(cx, cy, s, dur) {
    S.userMoved = true;            // applyFit clears this again once it has asked for the move
    if (reduced() || !dur) { stopAnim(); setView(cx, cy, s); return; }
    var V = S.V;
    anim = { type: 'fly', t0: performance.now(), dur: dur, from: { cx: V.cx, cy: V.cy, ls: Math.log(V.s) }, to: { cx: cx, cy: cy, ls: Math.log(clamp(s, S.sMin, S.sMax)) } };
    requestDraw();
  }

  function zoomAt(ax, ay, factor) {
    var V = S.V;
    S.userMoved = true;
    var base = anim && anim.type === 'zoom' ? anim.target : V.s;
    var target = clamp(base * factor, S.sMin, S.sMax);
    if (reduced()) {
      stopAnim();
      var wx = V.cx + (ax - S.w / 2) / V.s, wy = V.cy + (ay - S.h / 2) / V.s;
      setView(wx - (ax - S.w / 2) / target, wy - (ay - S.h / 2) / target, target);
      return;
    }
    anim = { type: 'zoom', target: target, ax: ax, ay: ay, wx: V.cx + (ax - S.w / 2) / V.s, wy: V.cy + (ay - S.h / 2) / V.s };
    requestDraw();
  }

  function stepAnim(now) {
    if (!anim) return;
    var V = S.V, dt = Math.min(50, now - lastT || 16);
    if (anim.type === 'fly') {
      var t = clamp((now - anim.t0) / anim.dur, 0, 1), k = easeInOut(t);
      V.cx = anim.from.cx + (anim.to.cx - anim.from.cx) * k;
      V.cy = anim.from.cy + (anim.to.cy - anim.from.cy) * k;
      V.s = Math.exp(anim.from.ls + (anim.to.ls - anim.from.ls) * k);
      if (t >= 1) anim = null;
    } else if (anim.type === 'zoom') {
      var ls = Math.log(V.s), lt = Math.log(anim.target);
      var nl = ls + (lt - ls) * (1 - Math.exp(-dt / 85));
      if (Math.abs(lt - nl) < 0.0015) { nl = lt; }
      V.s = Math.exp(nl);
      V.cx = anim.wx - (anim.ax - S.w / 2) / V.s;
      V.cy = anim.wy - (anim.ay - S.h / 2) / V.s;
      if (nl === lt) anim = null;
    } else if (anim.type === 'inertia') {
      var f = Math.exp(-dt / 260);
      anim.vx *= f; anim.vy *= f;
      V.cx -= anim.vx * dt / V.s;
      V.cy -= anim.vy * dt / V.s;
      if (Math.hypot(anim.vx, anim.vy) < 0.02) anim = null;
    }
    clampView();
  }

  function requestDraw() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    S.now = now;
    stepAnim(now);
    lastT = now;
    draw();
    if (anim || S.fanActive) requestDraw();
  }

  /* -------------------------------------------------------------------- draw */

  function rectsHit(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  }

  /* ---------------------------------------------------------- pin fan-out
     Pins whose centres land within ~30px of each other, or on the stay pill, are
     displaced: each colliding group is spread evenly on a small ring (22px plus
     6px a pin) around the group's centroid, with a thin leader line back to a
     small dot at the true spot. The stay pill never moves; pins are pushed away
     from it, and away from the edges and corner controls.

     This is worked out in screen space by layoutFan(), after every render/fit
     and whenever a pan or zoom has settled (not per frame). It only sets each
     pin's target offset; draw() eases the offsets in over 150ms (at once under
     prefers-reduced-motion) and rewrites just those pins and their leaders. */
  var FAN = { r0: 22, per: 6, dur: 150, settle: 120, half: 15 };

  function pinsNear(ax, ay, bx, by) {
    var dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    return dx * dx + dy * dy < 32 * 32 || (dx < 27 && dy < 27);
  }

  function layoutFan(instant) {
    if (!S.dest || S.w < 2 || S.h < 2) return;
    refreshControls();
    var V = S.V, sc = V.s, w = S.w, hh = S.h;
    var tx = w / 2 - V.cx * sc, ty = hh / 2 - V.cy * sc;
    var list = [], stays = [], i, j, it, M = 60;
    for (i = 0; i < S.items.length; i++) {
      it = S.items[i];
      if (it.kind !== 'plan') continue;
      it.ax = it.x * sc + tx; it.ay = it.y * sc + ty;
      it.tox = 0; it.toy = 0;
      if (it.ax < -M || it.ax > w + M || it.ay < -M || it.ay > hh + M) continue;
      if (it.stay) stays.push(it); else list.push(it);
    }

    function hitsStay(x, y) {
      for (var k = 0; k < stays.length; k++) {
        var st = stays[k];
        if (Math.abs(x - st.ax) < st.hw + FAN.half + 1 && Math.abs(y - st.ay) < 16 + FAN.half + 1) return true;
      }
      return false;
    }
    /* 0 if a pin centred here is fully on the map, clear of the corner controls
       and the stay pill; otherwise a rough cost, for picking the least bad spot */
    function edgeCost(x, y) {
      var r = FAN.half + 1, m = 3, k, c, bad = 0;
      if (x - r < m || x + r > w - m || y - r < m || y + r > hh - m) bad += 1;
      for (k = 0; k < S.ctl.length; k++) {
        c = S.ctl[k];
        if (x + r > c[0] - 3 && x - r < c[2] + 3 && y + r > c[1] - 3 && y - r < c[3] + 3) { bad += 1; break; }
      }
      if (hitsStay(x, y)) bad += 3;
      return bad;
    }
    function cost(x, y, g) {
      var bad = edgeCost(x, y), k, o;
      /* and not on top of a pin from another group, wherever that is for now */
      for (k = 0; k < n; k++) {
        o = list[k];
        if (o.grp !== g && pinsNear(x, y, o.px, o.py)) { bad += 2; break; }
      }
      return bad;
    }

    /* union-find over pins that touch */
    var n = list.length, parent = [];
    for (i = 0; i < n; i++) { parent.push(i); list[i].gi = i; list[i].px = list[i].ax; list[i].py = list[i].ay; }
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function join(a, b) { a = find(a); b = find(b); if (a === b) return false; parent[a] = b; return true; }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      if (pinsNear(list[i].ax, list[i].ay, list[j].ax, list[j].ay)) join(i, j);
    }

    var OFFS = [0, 1, -1, 2, -2, 3, -3, 4];
    function place(g) {
      var m = g.length, k, cx = 0, cy = 0, touch = false;
      for (k = 0; k < m; k++) { cx += g[k].ax; cy += g[k].ay; if (hitsStay(g[k].ax, g[k].ay)) touch = true; }
      cx /= m; cy /= m;
      if (m === 1 && !touch) { g[0].px = g[0].ax; g[0].py = g[0].ay; return; }
      var R = FAN.r0 + FAN.per * m, step = Math.PI * 2 / m;
      /* away from the nearest stay pill, and towards the middle of the map */
      var ux = 0, uy = -1, best = Infinity;
      stays.forEach(function (st) {
        var d = Math.hypot(cx - st.ax, cy - st.ay);
        if (d < best) { best = d; ux = cx - st.ax; uy = cy - st.ay; }
      });
      var ul = Math.hypot(ux, uy);
      if (ul < 1) { ux = 0; uy = -1; } else { ux /= ul; uy /= ul; }
      var vx = w / 2 - cx, vy = hh / 2 - cy, vl = Math.hypot(vx, vy) || 1;
      vx /= vl; vy /= vl;
      g.sort(function (p, q) { return Math.atan2(p.ay - cy, p.ax - cx) - Math.atan2(q.ay - cy, q.ax - cx); });
      var a0 = m === 1 ? Math.atan2(uy, ux) : Math.atan2(g[0].ay - cy, g[0].ax - cx);
      var dirs = [[0, 0]], d, q = Math.SQRT1_2;
      for (d = 10; d <= 160; d += 10) dirs.push([ux * d, uy * d], [vx * d, vy * d], [d, 0], [-d, 0], [0, d], [0, -d], [d * q, d * q], [-d * q, d * q], [d * q, -d * q], [-d * q, -d * q]);
      var c, o, ang, bad, x, y, bestBad = Infinity, bestC = 0, bestA = a0;
      for (c = 0; c < dirs.length; c++) {
        for (o = 0; o < OFFS.length; o++) {
          ang = a0 + OFFS[o] * step / 8;
          bad = 0;
          for (k = 0; k < m && bad < bestBad; k++) {
            x = cx + dirs[c][0] + Math.cos(ang + k * step) * R;
            y = cy + dirs[c][1] + Math.sin(ang + k * step) * R;
            bad += cost(x, y, g);
          }
          if (bad < bestBad) { bestBad = bad; bestC = c; bestA = ang; }
        }
        if (bestBad === 0) break;
      }
      for (k = 0; k < m; k++) {
        g[k].px = cx + dirs[bestC][0] + Math.cos(bestA + k * step) * R;
        g[k].py = cy + dirs[bestC][1] + Math.sin(bestA + k * step) * R;
      }
      if (bestBad > 0) {
        /* no whole ring fits: slide just the pins that don't, to the nearest free spot */
        S.dbg.fallback++;
        var r2, a2, j2, ok2, nx, ny;
        for (k = 0; k < m; k++) {
          if (!cost(g[k].px, g[k].py, g)) continue;
          var bestK = null, bestKc = cost(g[k].px, g[k].py, g);
          for (r2 = 6; r2 <= 90 && bestKc > 0; r2 += 6) {
            for (a2 = 0; a2 < 16; a2++) {
              nx = g[k].px + Math.cos(a2 * Math.PI / 8) * r2; ny = g[k].py + Math.sin(a2 * Math.PI / 8) * r2;
              var cc = cost(nx, ny, g);
              ok2 = true;
              for (j2 = 0; j2 < m; j2++) if (j2 !== k && Math.hypot(g[j2].px - nx, g[j2].py - ny) < 32) { ok2 = false; break; }
              if (ok2 && cc < bestKc) { bestKc = cc; bestK = [nx, ny]; if (!cc) break; }
            }
          }
          if (bestK) { g[k].px = bestK[0]; g[k].py = bestK[1]; }
        }
      }
    }

    /* place every group; a pin that lands beside a pin of another group pulls
       that group in too, and everything is placed again */
    var pass, groups, merged, key;
    S.dbg = { fallback: 0, passes: 0 };
    for (pass = 0; pass < 6; pass++) {
      groups = {};
      for (i = 0; i < n; i++) { key = find(i); (groups[key] = groups[key] || []).push(list[i]); }
      var order = Object.keys(groups).map(function (kk) { return groups[kk]; });
      order.forEach(function (g) { g.forEach(function (m) { m.grp = g; }); });
      order.sort(function (p, q) { return q.length - p.length; });     // the big knots get first pick of the room
      order.forEach(place);
      merged = false;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        if (find(i) !== find(j) && pinsNear(list[i].px, list[i].py, list[j].px, list[j].py)) { join(i, j); merged = true; }
      }
      S.dbg.passes = pass + 1;
      if (!merged) break;
    }

    /* A crowded pane can leave a pin with no room on its ring (over the edge, a
       control or the stay pill, or on another pin). Give each such pin the
       nearest free spot on the map instead. */
    function trouble(m) {
      var b = edgeCost(m.px, m.py), k;
      for (k = 0; k < n; k++) if (list[k] !== m && pinsNear(m.px, m.py, list[k].px, list[k].py)) return b + 2;
      return b;
    }
    var rep2, r3, a3, moved, nx, ny, found;
    for (rep2 = 0; rep2 < 2; rep2++) {
      moved = false;
      for (i = 0; i < n; i++) {
        it = list[i];
        if (!it.grp || (it.grp.length < 2 && Math.hypot(it.px - it.ax, it.py - it.ay) < 1)) continue;
        if (!trouble(it)) continue;
        found = null;
        for (r3 = 6; r3 <= 320 && !found; r3 += 6) {
          for (a3 = 0; a3 < 24; a3++) {
            nx = it.px + Math.cos(a3 * Math.PI / 12) * r3; ny = it.py + Math.sin(a3 * Math.PI / 12) * r3;
            var sx0 = it.px, sy0 = it.py;
            it.px = nx; it.py = ny;
            var t3 = trouble(it);
            it.px = sx0; it.py = sy0;
            if (!t3) { found = [nx, ny]; break; }
          }
        }
        if (found) { it.px = found[0]; it.py = found[1]; moved = true; S.dbg.repaired = (S.dbg.repaired || 0) + 1; }
      }
      if (!moved) break;
    }

    var moving = false;
    for (i = 0; i < n; i++) {
      it = list[i];
      it.tox = it.px - it.ax; it.toy = it.py - it.ay;
      if (Math.hypot(it.tox, it.toy) < 0.5) { it.tox = 0; it.toy = 0; }
    }
    for (i = 0; i < S.items.length; i++) {
      it = S.items[i];
      if (it.kind !== 'plan') continue;
      if (Math.abs(it.tox - it.ox) > 0.3 || Math.abs(it.toy - it.oy) > 0.3) moving = true;
    }
    if (!moving) return;
    if (instant || reduced()) {
      S.fanActive = false;
      for (i = 0; i < S.items.length; i++) { it = S.items[i]; if (it.kind === 'plan') { it.ox = it.tox; it.oy = it.toy; } }
    } else {
      for (i = 0; i < S.items.length; i++) { it = S.items[i]; if (it.kind === 'plan') { it.fx = it.ox; it.fy = it.oy; } }
      S.fanT0 = performance.now();
      S.fanActive = true;
    }
    requestDraw();
  }

  /* one thin leader (day colour, 60%) and a dot at the pin's true spot */
  function leadOf(it) {
    if (it.lead) return it.lead;
    var g = el('g', 'fm-lead'), ln = el('line', null, { stroke: it.color }), dot = el('circle', null, { r: 2.6, fill: it.color });
    g.appendChild(ln); g.appendChild(dot);
    g.style.display = 'none';
    S.gLeads.appendChild(g);
    it.lead = { g: g, ln: ln, dot: dot, on: false };
    return it.lead;
  }

  function draw() {
    if (!S.dest || S.w < 2 || S.h < 2) return;
    var V = S.V, s = V.s, w = S.w, hh = S.h;
    var tx = w / 2 - V.cx * s, ty = hh / 2 - V.cy * s;
    S.world.setAttribute('transform', 'matrix(' + s + ' 0 0 ' + s + ' ' + tx + ' ' + ty + ')');
    S.hatchPat.setAttribute('patternTransform', 'translate(0 ' + f1(((ty % HATCH) + HATCH) % HATCH) + ')');
    if (S.water) {
      var ww = Math.round(clamp(3.2 * Math.pow(s / S.sFit, 0.32), 3, 6.5) * 10) / 10;
      if (ww !== S.waterW) { S.waterW = ww; S.water.style.strokeWidth = ww + 'px'; }
    }

    var occupied = [], i, it, sx, sy;
    var M = 48;

    /* markers & dots: true screen positions, plus the fan-out offset for pins */
    if (S.fanActive) {
      var fk = clamp((S.now - S.fanT0) / FAN.dur, 0, 1), fe = easeOut(fk);
      for (i = 0; i < S.items.length; i++) {
        it = S.items[i];
        if (it.kind !== 'plan') continue;
        it.ox = it.fx + (it.tox - it.fx) * fe;
        it.oy = it.fy + (it.toy - it.fy) * fe;
      }
      if (fk >= 1) S.fanActive = false;
    }
    for (i = 0; i < S.items.length; i++) {
      it = S.items[i];
      sx = it.x * s + tx; sy = it.y * s + ty;
      it.tx = sx; it.ty = sy;
      it.vis2 = sx > -M && sx < w + M && sy > -M && sy < hh + M;
      if (it.kind === 'plan') { sx += it.ox; sy += it.oy; }
      it.sx = sx; it.sy = sy;
    }
    for (i = 0; i < S.items.length; i++) {
      it = S.items[i];
      var on = it.vis2 || (it.sx > -M && it.sx < w + M && it.sy > -M && it.sy < hh + M);
      if (on !== it.vis) { it.vis = on; it.el.style.display = on ? '' : 'none'; }
      if (on) {
        it.el.setAttribute('transform', 'translate(' + f1(it.sx) + ' ' + f1(it.sy) + ')');
        if (it.kind !== 'dot') occupied.push([it.sx - it.hw, it.sy - it.hh, it.sx + it.hw, it.sy + it.hh]);
      }
      if (it.kind === 'plan') {
        var moved = on && (Math.abs(it.ox) + Math.abs(it.oy) > 0.5), ld = it.lead;
        if (moved) {
          ld = leadOf(it);
          ld.ln.setAttribute('x1', f1(it.tx)); ld.ln.setAttribute('y1', f1(it.ty));
          ld.ln.setAttribute('x2', f1(it.sx)); ld.ln.setAttribute('y2', f1(it.sy));
          ld.dot.setAttribute('cx', f1(it.tx)); ld.dot.setAttribute('cy', f1(it.ty));
          if (!ld.on) { ld.on = true; ld.g.style.display = ''; }
        } else if (ld && ld.on) { ld.on = false; ld.g.style.display = 'none'; }
      }
    }

    /* a pan or zoom has settled: fan out again for the new view */
    var vk = f1(V.cx) + ',' + f1(V.cy) + ',' + s.toFixed(4) + ',' + w + ',' + hh;
    if (vk !== S.lastVK) {
      S.lastVK = vk;
      clearTimeout(S.settleT);
      S.settleT = setTimeout(function () { layoutFan(false); }, FAN.settle);
    }

    /* controls and the cartography mark keep their corners clear of labels */
    if (S.ctl.length) S.ctl.forEach(function (c) { occupied.push([c[0] - 4, c[1] - 4, c[2] + 4, c[3] + 4]); });
    else occupied.push([0, 0, 56, 56], [w - 56, 0, w, 130], [w - 56, hh - 56, w, hh], [0, hh - 30, 190, hh]);

    /* the popover also claims space */
    if (S.popId) {
      var pr = placePopover();
      if (pr) occupied.push(pr);
    }

    /* labels & shields, by priority, dropping whatever collides */
    var pool = S.labels.concat(S.shields);
    pool.sort(function (a, b) { return a.pri - b.pri; });
    for (i = 0; i < pool.length; i++) {
      var l = pool[i];
      sx = l.x * s + tx; sy = l.y * s + ty;
      var hw = l.w / 2 + 4, hh2 = l.h / 2 + 2;
      var box = [sx - hw, sy - hh2, sx + hw, sy + hh2];
      var show = box[2] > 0 && box[0] < w && box[3] > 0 && box[1] < hh;
      if (show) {
        for (var j = 0; j < occupied.length; j++) if (rectsHit(box, occupied[j])) { show = false; break; }
      }
      if (show) occupied.push(box);
      if (show !== l.vis) { l.vis = show; l.el.style.display = show ? '' : 'none'; }
      if (show) l.el.setAttribute('transform', 'translate(' + f1(sx) + ' ' + f1(sy) + ')');
    }

    /* zoom buttons at their limits */
    var lim = (s <= S.sMin * 1.001 ? 'o' : '') + (s >= S.sMax / 1.001 ? 'i' : '');
    if (lim !== S.lastZoomBtn) {
      S.lastZoomBtn = lim;
      S.btn.zin.disabled = lim.indexOf('i') >= 0;
      S.btn.zout.disabled = lim.indexOf('o') >= 0;
    }
  }

  /* ---------------------------------------------------------------- input */

  function local(e) {
    var r = S.svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function wireInput() {
    var svg = S.svg;
    var ptrs = new Map();
    var drag = null, pinch = null, samples = [];

    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      S.didDrag = false;
      stopAnim();
      var p = local(e);
      ptrs.set(e.pointerId, p);
      if (ptrs.size === 1) {
        drag = { id: e.pointerId, x: p[0], y: p[1], cx: S.V.cx, cy: S.V.cy, moved: false };
        samples = [];
      } else if (ptrs.size === 2) {
        var a = Array.from(ptrs.values());
        S.userMoved = true;
        pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1, s: S.V.s };
        var mx = (a[0][0] + a[1][0]) / 2, my = (a[0][1] + a[1][1]) / 2;
        pinch.wx = S.V.cx + (mx - S.w / 2) / S.V.s;
        pinch.wy = S.V.cy + (my - S.h / 2) / S.V.s;
        drag = null;
        S.didDrag = true;
      }
    });

    svg.addEventListener('pointermove', function (e) {
      if (!ptrs.has(e.pointerId)) return;
      var p = local(e);
      ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size >= 2) {
        var a = Array.from(ptrs.values());
        var d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1;
        var s = clamp(pinch.s * d / pinch.d, S.sMin, S.sMax);
        var mx = (a[0][0] + a[1][0]) / 2, my = (a[0][1] + a[1][1]) / 2;
        S.V.s = s;
        S.V.cx = pinch.wx - (mx - S.w / 2) / s;
        S.V.cy = pinch.wy - (my - S.h / 2) / s;
        clampView();
        requestDraw();
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      var dx = p[0] - drag.x, dy = p[1] - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        S.didDrag = true;
        S.userMoved = true;
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        S.root.classList.add('is-drag');
      }
      S.V.cx = drag.cx - dx / S.V.s;
      S.V.cy = drag.cy - dy / S.V.s;
      clampView();
      var now = performance.now();
      samples.push([now, p[0], p[1]]);
      while (samples.length > 1 && now - samples[0][0] > 90) samples.shift();
      requestDraw();
    });

    function up(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId) {
        if (drag.moved && samples.length > 1 && !reduced() && e.type === 'pointerup') {
          var a = samples[0], b = samples[samples.length - 1], dt = b[0] - a[0];
          if (dt > 0 && performance.now() - b[0] < 60) {
            var vx = (b[1] - a[1]) / dt, vy = (b[2] - a[2]) / dt;
            if (Math.hypot(vx, vy) > 0.15) {
              anim = { type: 'inertia', vx: vx, vy: vy };
              requestDraw();
            }
          }
        }
        drag = null;
      }
      if (!ptrs.size) S.root.classList.remove('is-drag');
      if (ptrs.size === 1) {
        var only = Array.from(ptrs.entries())[0];
        drag = { id: only[0], x: only[1][0], y: only[1][1], cx: S.V.cx, cy: S.V.cy, moved: true };
        samples = [];
      }
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e);
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 240 : 1);
      var k = e.ctrlKey ? 0.011 : 0.0021;
      zoomAt(p[0], p[1], Math.exp(clamp(-dy, -220, 220) * k));
    }, { passive: false });

    svg.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('.fm-mk')) return;
      var p = local(e);
      zoomAt(p[0], p[1], e.shiftKey ? 0.5 : 2);
    });

    svg.addEventListener('click', function (e) {
      if (S.didDrag) { S.didDrag = false; return; }
      var mk = e.target.closest ? e.target.closest('.fm-mk') : null;
      if (mk) {
        var pid = mk.getAttribute('data-pid');
        focus(pid, { open: true });
      } else if (S.popId) {
        closePop();
      }
    });

    svg.addEventListener('keydown', function (e) {
      var mk = e.target.closest ? e.target.closest('.fm-mk') : null;
      if (mk && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        focus(mk.getAttribute('data-pid'), { open: true });
      }
    });

    S.root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.popId) { closePop(); e.stopPropagation(); return; }
      if (e.target !== S.svg && e.target !== S.root) return;
      var step = 90 / S.V.s, k = e.key;
      if (k === '+' || k === '=') zoomAt(S.w / 2, S.h / 2, 1.7);
      else if (k === '-' || k === '_') zoomAt(S.w / 2, S.h / 2, 1 / 1.7);
      else if (k === 'ArrowLeft') flyTo(S.V.cx - step, S.V.cy, S.V.s, 220);
      else if (k === 'ArrowRight') flyTo(S.V.cx + step, S.V.cy, S.V.s, 220);
      else if (k === 'ArrowUp') flyTo(S.V.cx, S.V.cy - step, S.V.s, 220);
      else if (k === 'ArrowDown') flyTo(S.V.cx, S.V.cy + step, S.V.s, 220);
      else return;
      e.preventDefault();
    });

    document.addEventListener('pointerdown', function (e) {
      if (!S.popId || !S.root) return;
      if (S.root.contains(e.target)) return;
      closePop();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.popId) closePop();
    });
  }

  /* ---------------------------------------------------------------- popover */

  function planDayOf(pid) {
    var plan = S.trip && S.trip.plan;
    if (!plan || !plan.days) return -1;
    for (var i = 0; i < plan.days.length; i++) {
      var its = plan.days[i].items || [];
      for (var j = 0; j < its.length; j++) if (its[j].place === pid) return i;
    }
    return -1;
  }

  function isSaved(pid) {
    try { return !!(FT.saved && FT.saved.has && S.dest && FT.saved.has(S.dest.id, pid)); } catch (e) { return false; }
  }

  function popHTML(p) {
    var plate = '';
    if (FT.plate) {
      try { plate = FT.plate(p.id, { scene: p.scene, tone: p.tone, ratio: 'square' }); } catch (e) { plate = ''; }
    }
    var meta = [];
    if (p.label) meta.push(esc(p.label));
    if (p.kind === 'stay' && p.price != null) meta.push(esc(money(p.price, S.dest.currency || '')) + '/night');
    else if (p.rating != null) meta.push('<span class="fm-pop__rate"><span class="fm-pop__star">' + icon(UI.star, 11, { fill: 'currentColor', sw: 1 }) + '</span>' + esc(p.rating) + (p.reviews ? ' (' + num(p.reviews) + ')' : '') + '</span>');
    var di = planDayOf(p.id);
    var saved = isSaved(p.id);
    var add = di >= 0
      ? '<button type="button" class="fm-pop__btn fm-pop__btn--in" data-act="focus">' + icon(UI.check, 14, { sw: 2 }) + 'In plan · Day ' + (di + 1) + '</button>'
      : '<button type="button" class="fm-pop__btn fm-pop__btn--add" data-act="add">Add to plan</button>';
    return '<button type="button" class="fm-pop__x" data-act="close" aria-label="Close">' + icon(UI.x, 14, { sw: 1.8 }) + '</button>' +
      '<div class="fm-pop__head"><div class="plate fm-pop__plate">' + plate + '</div>' +
      '<div class="fm-pop__id"><h3 class="fm-pop__name">' + esc(p.name) + '</h3><div class="fm-pop__meta">' + meta.join('<span class="fm-pop__dot">·</span>') + '</div></div></div>' +
      (p.blurb ? '<p class="fm-pop__blurb">' + esc(p.blurb) + '</p>' : '') +
      '<div class="fm-pop__acts">' +
      '<button type="button" class="fm-pop__btn fm-pop__btn--save' + (saved ? ' is-on' : '') + '" data-act="save" aria-pressed="' + (saved ? 'true' : 'false') + '">' +
      icon(UI.bookmark, 14, { fill: saved ? 'currentColor' : 'none' }) + (saved ? 'Saved' : 'Save') + '</button>' + add + '</div>' +
      '<i class="fm-pop__tail"></i>';
  }

  function renderPop() {
    var p = S.popId && placeOf(S.popId);
    if (!p) { S.pop.hidden = true; S.popId = null; return; }
    var html = popHTML(p);
    if (S.pop.__html !== html) {
      S.pop.innerHTML = html;
      S.pop.__html = html;
      S.pop.setAttribute('aria-label', p.name);
    }
    S.pop.hidden = false;
    S.popW = Math.min(292, Math.max(200, S.w - 16));
    S.pop.style.width = S.popW + 'px';
    S.popH = S.pop.offsetHeight;
  }

  function openPop(pid) {
    S.popId = pid;
    S.pop.__html = '';
    ensureGhost();
    renderPop();
    applyHighlightClass();
    requestDraw();
  }

  function closePop() {
    if (!S.popId) return;
    S.popId = null;
    S.pop.hidden = true;
    S.pop.__html = '';
    ensureGhost();
    applyHighlightClass();
    requestDraw();
  }

  function closePopIfClipped() {
    if (S.popId && (S.w < 120 || S.h < 120)) closePop();
  }

  function placePopover() {
    var it = S.byPid.get(S.popId);
    if (!it) return null;
    var w = S.popW, ph = S.popH, pad = 8;
    var mx = it.sx, my = it.sy;
    var left = clamp(mx - w / 2, pad, Math.max(pad, S.w - w - pad));
    var top = my - it.top - 10 - ph;
    var below = false;
    if (top < pad) {
      /* not enough room above: put it below if that fits, else pin to the top edge */
      var t2 = my + it.top + 10;
      if (t2 + ph <= S.h - pad) { top = t2; below = true; }
      else top = pad;
    }
    S.pop.style.transform = 'translate(' + f1(left) + 'px,' + f1(top) + 'px)';
    S.pop.style.setProperty('--tx', f1(clamp(mx - left, 16, w - 16)) + 'px');
    S.pop.classList.toggle('is-below', below);
    var hide = mx < -30 || mx > S.w + 30 || my < -30 || my > S.h + 30;
    S.pop.style.visibility = hide ? 'hidden' : '';
    return [left - 2, top - 2, left + w + 2, top + ph + 2];
  }

  function wirePopover() {
    S.pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act'), pid = S.popId;
      if (act === 'close') closePop();
      else if (act === 'save') {
        if (FT.saved && FT.saved.toggle && S.dest) {
          FT.saved.toggle(S.dest.id, pid);
          renderPop();
        }
      } else if (act === 'add') {
        if (FT.plan && FT.plan.addItem && S.tripId) {
          FT.plan.addItem(S.tripId, null, pid);
          sync();
          renderPop();
        }
      } else if (act === 'focus') {
        if (FT.store && FT.store.emit) FT.store.emit('map:focus', { placeId: pid });
      }
    });
    S.pop.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    S.pop.addEventListener('wheel', function (e) { e.stopPropagation(); });
  }

  /* ----------------------------------------------------------------- public */

  function flushPending() {
    if (!S.pending) return;
    var q = S.pending; S.pending = null;
    focus(q.id, q.opts);
  }

  function focus(pid, opts) {
    opts = opts || {};
    var open = opts.open !== false;
    if (!S.host) return;
    sync();
    var p = pid && placeOf(pid);
    if (!p || !p.at) return;
    /* a day's "show on map" fits its stops, then focuses the first one without opening it: keep the fit */
    if (!open && performance.now() - S.recentFit < 300) { closePop(); return; }
    if (S.w < 2 || S.h < 2 || !S.fitted) {
      S.pending = { id: pid, opts: opts };
      return;
    }
    if (open) openPop(pid);
    else closePop();
    var w = proj(p.at);
    var s = Math.max(S.V.s, Math.min(S.sFit * 4.5, S.sMax));
    if (S.V.s > S.sFit * 4.5) s = S.V.s;
    var ay = S.h / 2;
    if (open) ay = clamp(S.popH + 46, S.h * 0.5, Math.max(S.h * 0.5, S.h - 34));
    if (S.h < S.popH + 90) ay = S.h - 40;
    flyTo(w[0], w[1] - (ay - S.h / 2) / s, s, 560);
  }

  function fit(arg) {
    if (!S.host) return;
    if (!S.dest) { requestDraw(); return; }
    if (S.w < 2 || S.h < 2) { S.needFit = true; return; }
    computeFit();
    var ids = Array.isArray(arg) ? arg : arg && Array.isArray(arg.places) ? arg.places : null;
    var instant = !!(arg && arg.instant) || !S.fitted;
    applyFit(!instant, ids);
  }

  FT.map = {
    mount: mount,
    render: render,
    focus: focus,
    fit: fit,
    resize: function () { resize(); },
    /* read-only view for debugging and tests */
    view: function () { return { cx: S.V.cx, cy: S.V.cy, s: S.V.s, sFit: S.sFit, w: S.w, h: S.h, popId: S.popId, fan: S.dbg, fitIds: S.fitIds, userMoved: S.userMoved }; }
  };
})();
