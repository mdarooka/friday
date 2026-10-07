/* ==========================================================================
   FRIDAY PLANNER: core (trip-app.js)
   util, store, router, ui, trips, plan, saved, bookings, log, the sidebar,
   and the Home / New trip / Bookings / Saved / Notifications / Preferences pages.

   Plain ES2020 classic script. No network requests. Every call into Map, Chat
   or Workspace is guarded, so these pages work even when those files are absent.
   ========================================================================== */
(function () {
  'use strict';

  const FT = (window.FridayTrip = window.FridayTrip || {});
  const doc = document;
  let STORAGE_KEY = 'friday.planner.v1';
  const DAY_COLORS = ['#D97757', '#0A87A8', '#5B3FD6', '#178044', '#B721C9', '#2563EB', '#B45309'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS.map((m) => m.slice(0, 3));
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_MS = 864e5;

  const $ = (s, c) => (c || doc).querySelector(s);
  const $$ = (s, c) => Array.from((c || doc).querySelectorAll(s));
  const noop = () => {};
  const isNarrow = () => window.innerWidth < 900;
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ======================================================================
     util
     ====================================================================== */

  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let uidCounter = 0;
  const uid = (prefix) => (prefix || 'x') + '_' + Math.random().toString(36).slice(2, 8) + (uidCounter++ % 36).toString(36);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  const parseIso = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  };
  const toIso = (ms) => {
    const d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  };
  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  const addDays = (iso, n) => toIso(parseIso(iso) + n * DAY_MS);
  const diffDays = (a, b) => Math.round((parseIso(b) - parseIso(a)) / DAY_MS);
  const parts = (iso) => {
    const d = new Date(parseIso(iso));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), w: d.getUTCDay() };
  };
  const fmtDay = (iso) => {
    const p = parts(iso);
    return { weekday: WEEKDAYS[p.w].slice(0, 3), date: MON[p.m] + ' ' + p.d, long: WEEKDAYS[p.w] + ', ' + MONTHS[p.m] + ' ' + p.d };
  };
  const fmtRange = (s, e) => {
    if (!s) return '';
    const a = parts(s);
    if (!e || e === s) return MON[a.m] + ' ' + a.d + ', ' + a.y;
    const b = parts(e);
    if (a.y !== b.y) return MON[a.m] + ' ' + a.d + ', ' + a.y + ' – ' + MON[b.m] + ' ' + b.d + ', ' + b.y;
    if (a.m === b.m) return MON[a.m] + ' ' + a.d + ' – ' + b.d + ', ' + a.y;
    return MON[a.m] + ' ' + a.d + ' – ' + MON[b.m] + ' ' + b.d + ', ' + a.y;
  };
  /** {y, m}: m is a JS month index (0 = January), as returned by Date#getMonth. */
  const monthLabel = (o) => (o && MONTHS[o.m] ? MONTHS[o.m] + ' ' + o.y : '');
  const weeksUntil = (iso) => Math.max(0, Math.round(diffDays(today(), iso) / 7));
  const timeAgo = (x) => {
    const t = typeof x === 'number' ? x : Date.parse(x);
    if (isNaN(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd';
    const w = Math.floor(d / 7);
    if (d < 35) return w + 'w';
    const mo = Math.floor(d / 30);
    return mo < 12 ? mo + 'mo' : Math.floor(d / 365) + 'y';
  };
  const CUR = { INR: '₹', USD: '$', JPY: '¥', EUR: '€', GBP: '£', LKR: 'Rs ' };
  const money = (n, cur) => {
    if (n == null || n === '' || isNaN(+n)) return '';
    const sym = CUR[cur] || cur || '';
    const v = +n;
    const str = Math.abs(v - Math.round(v)) < 0.005 ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sym + str;
  };
  const safeWebUrl = (value) => { if (typeof value !== 'string' || !value.trim()) return ''; try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } };

  /** Escape first, then a small markdown subset: **bold**, *italic*, `code`, [text](url), line breaks, "- " lists. */
  function md(text) {
    const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if (!src) return '';
    const inline = (s) => {
      const stash = [];
      let h = esc(s);
      h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
        if (/^\s*(javascript|data|vbscript):/i.test(url)) return label;
        const ext = /^https?:\/\//i.test(url);
        stash.push('<a href="' + url + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>');
        return '\u0000' + (stash.length - 1) + '\u0000';
      });
      h = h.replace(/`([^`\n]+)`/g, (m, c) => { stash.push('<code>' + c + '</code>'); return '\u0000' + (stash.length - 1) + '\u0000'; });
      h = h.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
      return h.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
    };
    const out = [];
    let para = [];
    let list = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list.length) { out.push('<ul>' + list.map((l) => '<li>' + inline(l) + '</li>').join('') + '</ul>'); list = []; } };
    src.split('\n').forEach((line) => {
      if (!line.trim()) { flushPara(); flushList(); return; }
      const li = /^\s*[-•]\s+(.*)$/.exec(line);
      if (li) { flushPara(); list.push(li[1]); } else { flushList(); para.push(line.trim()); }
    });
    flushPara(); flushList();
    return out.join('');
  }

  /* ---- icons: 24px grid, 1.5px line, round caps, currentColor ---- */
  const dot = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 1.2) + '" fill="currentColor" stroke="none"/>';
  const ICONS = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    ticket: '<path d="M3.5 8.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1V10a2 2 0 0 0 0 4v1.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4z"/><path d="M14.5 7.5v1.8M14.5 11.1v1.8M14.5 14.7v1.8"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5S14.5 18.1 12 20.5C9.5 18.1 8.4 15.3 8.4 12S9.5 5.9 12 3.5z"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    bed: '<path d="M3.5 18.5V6"/><path d="M3.5 14.5h17v4"/><path d="M20.5 14.5V12a2.5 2.5 0 0 0-2.5-2.5h-7v5"/><circle cx="7" cy="11.5" r="1.6"/>',
    fork: '<path d="M6 3.5v6a2 2 0 0 0 4 0v-6"/><path d="M8 3.5v17"/><path d="M17 20.5v-17c-2.200 1.500-3.500 4-3.500 7 0 1.600.9 2.700 2 3H17"/>',
    glass: '<path d="M5 4.500h14L12 12z"/><path d="M12 12v8M8.500 20h7"/>',
    waves: '<path d="M3 8.500c1.500 0 1.500-1.500 3-1.500s1.500 1.500 3 1.500 1.500-1.500 3-1.500 1.500 1.500 3 1.500 1.500-1.500 3-1.500 1.500 1.500 3 1.500"/><path d="M3 13c1.500 0 1.500-1.500 3-1.500s1.500 1.500 3 1.500 1.500-1.500 3-1.500 1.500 1.500 3 1.500 1.500-1.500 3-1.500 1.500 1.500 3 1.500"/><path d="M3 17.500c1.500 0 1.500-1.500 3-1.500s1.500 1.500 3 1.500 1.500-1.500 3-1.500 1.500 1.500 3 1.500 1.500-1.500 3-1.500 1.500 1.500 3 1.500"/>',
    leaf: '<path d="M5 19c0-8 5-13.500 14.500-14.500C19.500 14 14.500 19.500 6.500 19.500"/><path d="M5 19c3-4.500 6-7 10-9"/>',
    columns: '<path d="M3.500 8.500L12 4l8.500 4.500z"/><path d="M6 11.500v6M10 11.500v6M14 11.500v6M18 11.500v6"/><path d="M4 20h16"/>',
    spa: '<path d="M12 4.500c2 2 3 4.200 3 6.700s-1 4.500-3 6.300c-2-1.800-3-3.800-3-6.300s1-4.700 3-6.700z"/><path d="M9.200 12.800C7 12 5 12 3.500 12.500 4 15.500 6.500 17.500 10 17.500"/><path d="M14.800 12.800c2.200-.8 4.200-.8 5.700-.3-.5 3-3 5-6.500 5"/><path d="M6.500 20.500h11"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    landmark: '<path d="M4 20h16"/><path d="M6 20v-7M10 20v-7M14 20v-7M18 20v-7"/><path d="M4 13h16"/><path d="M12 3.500c-3 1.500-5 3.700-5.500 6.500h11C17 7.200 15 5 12 3.500z"/>',
    cross: '<path d="M12 3.500v17M6.500 9h11"/>',
    search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
    'chevron-down': '<path d="M6 9.500l6 6 6-6"/>',
    'chevron-up': '<path d="M6 14.500l6-6 6 6"/>',
    'chevron-left': '<path d="M14.500 6l-6 6 6 6"/>',
    'chevron-right': '<path d="M9.500 6l6 6-6 6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6.500a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12"/>',
    users: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19c0-3.200 2.700-5.500 6-5.500s6 2.300 6 5.500"/><path d="M15.500 5.500a3 3 0 0 1 0 6M17.500 14c2 .6 3.500 2.400 3.500 5"/>',
    dots: dot(5.5, 12) + dot(12, 12) + dot(18.5, 12),
    sidebar: '<rect x="3.500" y="4.500" width="17" height="15" rx="2"/><path d="M9.500 4.500v15"/>',
    sparkle: '<path d="M11 4l1.900 5.100L18 11l-5.100 1.900L11 18l-1.900-5.100L4 11l5.100-1.900z"/><path d="M18.500 3.500v4M16.500 5.500h4"/>',
    undo: '<path d="M8 5L3.500 9.500 8 14"/><path d="M4 9.500h9.500a5.500 5.500 0 0 1 0 11H9"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.500-5.800"/><path d="M4 4.500v4h4"/><path d="M12 8v4.500l3 1.500"/>',
    copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="1.500"/><path d="M15.500 8.500V6A1.500 1.500 0 0 0 14 4.500H6A1.500 1.500 0 0 0 4.500 6v8A1.500 1.500 0 0 0 6 15.500h2.500"/>',
    'thumb-up': '<path d="M8 10.500V19H4.500v-8.500z"/><path d="M8 10.500l3.500-6.500c1.500 0 2.500 1 2.500 2.500V9h4.500a1.500 1.500 0 0 1 1.500 1.800l-1.300 6.500a2 2 0 0 1-2 1.700H8"/>',
    'thumb-down': '<g transform="rotate(180 12 12)"><path d="M8 10.500V19H4.500v-8.500z"/><path d="M8 10.500l3.500-6.500c1.500 0 2.500 1 2.500 2.500V9h4.500a1.500 1.500 0 0 1 1.500 1.800l-1.300 6.500a2 2 0 0 1-2 1.700H8"/></g>',
    mic: '<rect x="9" y="3.500" width="6" height="11" rx="3"/><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v3"/>',
    image: '<rect x="3.500" y="4.500" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.700"/><path d="M4 17l5-4.500 4 3.500 3-2.500 4.500 4"/>',
    'send-plane': '<path d="M20.500 3.500L10 14"/><path d="M20.500 3.500L14 20.500l-4-6.500-6.500-4z"/>',
    navigation: '<path d="M20 4L4 10.500l6.500 2.500L13 19.500z"/>',
    calendar: '<rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
    mail: '<rect x="3.500" y="5.500" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    trash: '<path d="M4.500 7h15M9 7V4.500h6V7"/><path d="M6.500 7l1 12.500h9l1-12.500M10 11v5M14 11v5"/>',
    edit: '<path d="M4 20l1-4L16.500 4.500a2 2 0 0 1 3 3L8 19z"/><path d="M14.500 6.500l3 3"/>',
    pen: '<path d="M4 20l1-4L16.500 4.500a2 2 0 0 1 3 3L8 19z"/><path d="M14.500 6.500l3 3"/>',
    grip: dot(9, 6) + dot(15, 6) + dot(9, 12) + dot(15, 12) + dot(9, 18) + dot(15, 18),
    stop: '<rect x="6.500" y="6.500" width="11" height="11" rx="1.500" fill="currentColor"/>',
    printer: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="1.500"/><path d="M7 14h10v6H7z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
    map: '<path d="M3.500 6.500l5.500-2 6 2 5.500-2v13l-5.500 2-6-2-5.500 2z"/><path d="M9 4.500v13M15 6.500v13"/>',
    list: '<path d="M8.500 6.500H20M8.500 12H20M8.500 17.500H20"/>' + dot(4.500, 6.500, 0.9) + dot(4.500, 12, 0.9) + dot(4.500, 17.500, 0.9),
    star: '<path d="M12 3.800l2.500 5.200 5.700.8-4.100 4 1 5.700-5.100-2.700-5.100 2.700 1-5.700-4.100-4 5.700-.8z"/>',
    clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
    compass: '<circle cx="12" cy="12" r="8.500"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
    layers: '<path d="M12 4l8.500 4.500L12 13 3.500 8.500z"/><path d="M3.500 12.500L12 17l8.500-4.500"/><path d="M3.500 16.500L12 21l8.500-4.500"/>',
    plane: '<path d="M12 3c.8 0 1.500.9 1.500 2v5l7 4.500v2l-7-2v3.500l2 1.500V21l-3.500-1-3.500 1v-1.500l2-1.500V14.500l-7 2v-2l7-4.500V5c0-1.100.7-2 1.500-2z"/>',
    message: '<path d="M12 4a8 8 0 1 1-3.500 15.200L4 20l1-3.800A8 8 0 0 1 12 4z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    info: '<circle cx="12" cy="12" r="8.500"/><path d="M12 11v5"/>' + dot(12, 8, 0.9),
    heart: '<path d="M20.800 8.700c0 5.100-8.800 11.300-8.800 11.300S3.200 13.800 3.200 8.700a4.200 4.200 0 0 1 7.500-2.600L12 7.700l1.300-1.600a4.200 4.200 0 0 1 7.500 2.600z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .300 1.900l.100.100-1.800 3.100-.200-.100a1.700 1.700 0 0 0-1.900.300l-.100.100h-3.600l-.100-.200a1.700 1.700 0 0 0-1.600-1.100 1.700 1.700 0 0 0-.900.300l-.200.100-3.100-1.800.100-.200a1.700 1.700 0 0 0-.300-1.900l-.100-.100v-3.600l.200-.100a1.700 1.700 0 0 0 .800-2.500l-.100-.200 1.800-3.100.200.100a1.700 1.700 0 0 0 1.900-.300l.100-.100h3.600l.100.200a1.700 1.700 0 0 0 2.500.800l.200-.100 3.100 1.800-.100.200a1.700 1.700 0 0 0 .300 1.900l.100.100v3.600z"/>',
  };
  ICONS.suitcase = ICONS.bag;
  const icon = (name, size) => {
    size = size || 16;
    const sw = ((1.5 * 24) / size).toFixed(2);
    return '<svg class="fx-icon fx-icon--' + esc(name) + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '<circle cx="12" cy="12" r="8.500"/>') + '</svg>';
  };

  FT.util = {
    esc, uid, clamp, clone, today, addDays, diffDays, fmtDay, fmtRange, monthLabel, weeksUntil, timeAgo, money, md, icon,
    dayColor: (i) => DAY_COLORS[((i % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length],
    MONTHS, DAY_COLORS,
  };
  const U = FT.util;

  /* ======================================================================
     destinations and places
     ====================================================================== */

  FT.dest = (id) => (id && FT.DESTINATIONS && FT.DESTINATIONS[id]) || null;
  FT.place = (destId, placeId) => {
    const d = FT.dest(destId);
    const p = d && d.places && d.places[placeId];
    return p ? Object.assign({ id: placeId }, p) : null;
  };
  const destOrder = () => (FT.ORDER || Object.keys(FT.DESTINATIONS || {})).filter((id) => FT.dest(id));

  /** A generated plate as an HTML string (safe if the art file is missing). */
  function plateHtml(seed, o, ratio, cls) {
    o = o || {};
    const svg = typeof FT.plate === 'function'
      ? FT.plate(seed, { scene: o.scene, tone: o.tone, ratio: ratio === 'panorama' || ratio === 'landscape' || ratio === 'portrait' ? ratio : 'square' })
      : '';
    return '<div class="plate ' + (cls || 'plate--ratio-s') + '">' + svg + '</div>';
  }
  const placePlate = (p, cls) => plateHtml('p-' + (p.id || p.name), p, 'square', cls);

  /* ======================================================================
     store
     ====================================================================== */

  const lsGet = () => { try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } };
  const lsSet = (v) => { try { window.localStorage.setItem(STORAGE_KEY, v); return true; } catch (e) { return false; } };
  const lsDel = () => { try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ } };

  function defaults() {
    return {
      v: 1,
      trips: [],
      currentTripId: null,
      prefs: { homeCity: '', airports: [], airlines: '', hotels: '', hotelBudget: '', business: '', other: '' },
      memory: [],
      saved: [], lists: [], imports: [],
      bookings: [],
      notifications: [{ id: 'n_homecity', kind: 'home-city', text: 'Add your home city and airports', at: new Date(Date.now() - 8 * 3600e3).toISOString(), done: false }],
      dismissed: { prefsCard: false, studioCard: false },
      sideCollapsed: false,
    };
  }

  function normTrip(t) {
    const now = new Date().toISOString();
    t.id = t.id || uid('t');
    t.title = t.title || 'New trip';
    t.destId = t.destId || null;
    t.createdAt = t.createdAt || now;
    t.updatedAt = t.updatedAt || t.createdAt;
    t.prefs = Object.assign({ month: null, types: [], days: null, dates: null, base: null }, t.prefs || {});
    t.plan = t.plan || null;
    t.versions = Array.isArray(t.versions) ? t.versions : [];
    t.banner = t.banner || null;
    t.tabs = Array.isArray(t.tabs) ? t.tabs : [];
    t.activeTab = t.activeTab || 'overview';
    t.activity = Array.isArray(t.activity) ? t.activity : [];
    if (!Array.isArray(t.threads) || !t.threads.length) t.threads = [{ id: uid('th'), title: 'New conversation', createdAt: now, messages: [] }];
    if (!t.threads.some((th) => th.id === t.activeThreadId)) t.activeThreadId = t.threads[0].id;
    t.mapCollapsed = !!t.mapCollapsed;
    return t;
  }

  function loadState() {
    const base = defaults();
    let raw = null;
    try { raw = JSON.parse(lsGet()); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return base;
    const s = Object.assign(base, raw);
    s.prefs = Object.assign(defaults().prefs, raw.prefs || {});
    s.dismissed = Object.assign(defaults().dismissed, raw.dismissed || {});
    ['trips', 'memory', 'saved', 'lists', 'imports', 'bookings', 'notifications'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = base[k]; });
    if (!Array.isArray(s.prefs.airports)) s.prefs.airports = [];
    s.trips.forEach(normTrip);
    s.currentTripId = s.trips.some((t) => t.id === s.currentTripId) ? s.currentTripId : null;
    return s;
  }

  let state = loadState();
  const listeners = {};
  let depth = 0;
  let saveTimer = null;
  let noPersist = false;
  let persistenceEnabled = true;

  function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (noPersist || !persistenceEnabled) return;
    try { lsSet(JSON.stringify(state)); } catch (e) { /* storage unavailable or full */ }
  }
  function schedulePersist() {
    if (saveTimer || noPersist || !persistenceEnabled) return;
    saveTimer = setTimeout(flush, 120);
  }

  const store = {
    get: () => state,
    trip(id) {
      id = id === undefined ? state.currentTripId : id;
      return (id && state.trips.find((t) => t.id === id)) || null;
    },
    update(fn) {
      if (depth > 0) return fn(state);
      const before = new Map(state.trips.map((t) => [t.id, JSON.stringify(t)]));
      let ret;
      depth++;
      try { ret = fn(state); } finally { depth--; }
      const changed = [];
      const stamp = new Date().toISOString();
      state.trips.forEach((t) => {
        const was = before.get(t.id);
        if (was === undefined) return;
        if (was !== JSON.stringify(t)) { t.updatedAt = stamp; changed.push(t.id); }
      });
      schedulePersist();
      store.emit('change', { tripIds: changed });
      return ret;
    },
    useGuestStorage() {
      this.setPersistence(false);
      STORAGE_KEY = 'friday.planner.guest.v1';
      this.replaceState(loadState());
      this.setPersistence(true);
    },
    setPersistence(enabled) {
      persistenceEnabled = !!enabled;
      if (!persistenceEnabled && saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    },
    replaceState(next, options) {
      const base = defaults();
      const incoming = next && typeof next === 'object' ? clone(next) : {};
      state = Object.assign(base, incoming, { v: 1 });
      state.prefs = Object.assign(base.prefs, incoming.prefs || {});
      state.dismissed = Object.assign(base.dismissed, incoming.dismissed || {});
      ['trips', 'memory', 'saved', 'lists', 'imports', 'bookings', 'notifications'].forEach((k) => {
        if (!Array.isArray(state[k])) state[k] = base[k];
      });
      state.trips.forEach(normTrip);
      state.trips.forEach((trip) => { if (trip.catalog && trip.destId) { FT.DESTINATIONS = FT.DESTINATIONS || {}; FT.DESTINATIONS[trip.destId] = clone(trip.catalog); } });
      if (!state.trips.some((t) => t.id === state.currentTripId)) state.currentTripId = null;
      if (options && options.persist === false) this.setPersistence(false);
      this.emit('change', { tripIds: state.trips.map((t) => t.id), replaced: true });
      return state;
    },
    on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return () => { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn); };
    },
    emit(evt, payload) {
      (listeners[evt] || []).slice().forEach((fn) => {
        try { fn(payload); } catch (err) { if (window.console) console.error('[friday] listener for "' + evt + '" failed', err); }
      });
    },
    reset() {
      noPersist = true;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      lsDel();
      try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { /* file:// quirks */ }
      location.reload();
    },
  };
  FT.store = store;
  window.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') flush(); });

  /* ======================================================================
     ui: toast, modal, menu, confirm, prompt
     ====================================================================== */

  const overlays = []; // topmost last: {close}
  let layerEl = null;
  const layer = () => {
    if (layerEl && layerEl.isConnected) return layerEl;
    layerEl = $('[data-layer]') || doc.body.appendChild(Object.assign(doc.createElement('div'), {}));
    return layerEl;
  };
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const focusables = (root) => $$(FOCUSABLE, root).filter((el) => el.offsetParent !== null || el === doc.activeElement);
  const safeFocus = (el) => { try { if (el && el.isConnected && el.focus) el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } };
  /** A page re-render replaces nodes; describe the focused control so its twin can take focus back. */
  const focusSig = (a) => (a && a !== doc.body ? { tag: a.tagName, data: Object.assign({}, a.dataset), id: a.id, label: a.getAttribute('aria-label') } : null);
  const findTwin = (sig, root) => sig && $$(sig.tag.toLowerCase(), root || doc).find((c) => (sig.id && c.id === sig.id) || (Object.keys(sig.data).length && Object.keys(sig.data).every((k) => c.dataset[k] === sig.data[k])) || (sig.label && c.getAttribute('aria-label') === sig.label));

  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const top = overlays[overlays.length - 1];
    if (top) { e.preventDefault(); e.stopPropagation(); top.close('escape'); return; }
    if (drawerOpen) { e.preventDefault(); closeDrawer(); }
  }, true);

  function toast(text) {
    let box = $('.fx-toasts', layer());
    if (!box) {
      box = doc.createElement('div');
      box.className = 'fx-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      layer().appendChild(box);
    }
    const el = doc.createElement('div');
    el.className = 'fx-toast';
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), reducedMotion() ? 0 : 220); }, 2600);
  }

  function modal(opts) {
    opts = opts || {};
    const prev = doc.activeElement;
    const prevSig = focusSig(prev);
    const titleId = uid('mt');
    const wrap = doc.createElement('div');
    wrap.className = 'fx-modal-wrap';
    const box = doc.createElement('div');
    box.className = 'fx-modal' + (opts.className ? ' ' + opts.className : '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', titleId);
    box.tabIndex = -1;
    box.innerHTML =
      '<div class="fx-modal__head"><h2 class="fx-modal__title" id="' + titleId + '">' + esc(opts.title || '') + '</h2>' +
      '<button type="button" class="fx-icon-btn" data-close aria-label="Close">' + icon('x', 18) + '</button></div>' +
      '<div class="fx-modal__body"></div>' +
      (opts.actions && opts.actions.length ? '<div class="fx-modal__foot"></div>' : '');
    const bodyEl = $('.fx-modal__body', box);
    if (opts.body instanceof Node) bodyEl.appendChild(opts.body); else bodyEl.innerHTML = opts.body || '';
    wrap.appendChild(box);

    let closed = false;
    const entry = { close };
    function close() {
      if (closed) return;
      closed = true;
      const i = overlays.indexOf(entry);
      if (i >= 0) overlays.splice(i, 1);
      wrap.remove();
      try { if (opts.onClose) opts.onClose(); } catch (e) { console.error(e); }
      safeFocus(prev && prev.isConnected ? prev : findTwin(prevSig, $('[data-main]')));
    }
    close.el = box;

    let primaryBtn = null;
    const foot = $('.fx-modal__foot', box);
    if (foot) {
      opts.actions.forEach((a) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'fx-btn ' + (a.primary ? 'fx-btn--ink' : 'fx-btn--line') + (a.danger ? ' fx-btn--danger' : '');
        b.textContent = a.label;
        if (a.primary) primaryBtn = b;
        b.addEventListener('click', () => { if (a.onClick) a.onClick(close, b); else close(); });
        foot.appendChild(b);
      });
    }

    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    $('[data-close]', box).addEventListener('click', close);
    box.addEventListener('input', () => { const er = $('.fx-error', box); if (er) er.hidden = true; });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const f = focusables(box);
        if (!f.length) { e.preventDefault(); return; }
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (doc.activeElement === first || doc.activeElement === box)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      } else if (e.key === 'Enter' && primaryBtn && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
        e.preventDefault();
        primaryBtn.click();
      }
    });

    layer().appendChild(wrap);
    overlays.push(entry);
    if (typeof opts.onOpen === 'function') { try { opts.onOpen(box, close); } catch (e) { console.error(e); } }
    let target = $('[autofocus]', bodyEl) || $('input:not([type=hidden]),textarea,select', bodyEl);
    if (opts.focus === 'primary' && primaryBtn) target = primaryBtn;
    if (opts.focus === 'cancel' && foot) target = $('button', foot);
    if (!target) target = primaryBtn || $('[data-close]', box);
    safeFocus(target || box);
    if (target && target.select && target.tagName === 'INPUT' && target.type === 'text' && target.value) { try { target.select(); } catch (e) { /* ignore */ } }
    return close;
  }

  let openMenu = null;
  function closeMenu(returnFocus) { if (openMenu) openMenu.close(returnFocus); }

  /** Popover primitive. content is a node; it is positioned against anchorEl and closes on outside click or Esc. */
  function popover(anchorEl, contentEl, opts) {
    opts = opts || {};
    if (openMenu && openMenu.anchor === anchorEl) { closeMenu(false); return noop; }
    closeMenu(false);
    const wrap = doc.createElement('div');
    wrap.className = 'fx-menu' + (opts.className ? ' ' + opts.className : '');
    wrap.appendChild(contentEl);
    layer().appendChild(wrap);
    wrap.style.visibility = 'hidden';

    const place = () => {
      const a = anchorEl.getBoundingClientRect();
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = opts.align === 'right' ? a.right - w : a.left;
      left = clamp(left, 8, Math.max(8, vw - w - 8));
      let top = a.bottom + 6;
      if (top + h > vh - 8 && a.top - 6 - h > 8) top = a.top - 6 - h;
      top = clamp(top, 8, Math.max(8, vh - h - 8));
      wrap.style.left = left + 'px';
      wrap.style.top = top + 'px';
      wrap.style.visibility = '';
    };
    place();

    let closed = false;
    const entry = {
      anchor: anchorEl,
      place,
      el: wrap,
      close(returnFocus) {
        if (closed) return;
        closed = true;
        doc.removeEventListener('pointerdown', onDown, true);
        window.removeEventListener('resize', onResize);
        doc.removeEventListener('scroll', onScroll, true);
        const i = overlays.indexOf(entry);
        if (i >= 0) overlays.splice(i, 1);
        if (openMenu === entry) openMenu = null;
        wrap.remove();
        if (returnFocus !== false && returnFocus !== undefined) safeFocus(anchorEl);
        if (typeof opts.onClose === 'function') opts.onClose();
      },
    };
    const onDown = (e) => { if (!wrap.contains(e.target) && !anchorEl.contains(e.target)) entry.close(false); };
    const onResize = () => entry.close(false);
    const onScroll = (e) => { if (!wrap.contains(e.target)) entry.close(false); };
    doc.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    doc.addEventListener('scroll', onScroll, true);
    const origClose = entry.close;
    // Esc (and any keyboard dismissal) returns focus to the anchor.
    overlays.push({ close: () => origClose(true) });
    const me = overlays[overlays.length - 1];
    entry.close = (rf) => { const i = overlays.indexOf(me); if (i >= 0) overlays.splice(i, 1); origClose(rf); };
    openMenu = entry;
    if (typeof opts.onOpen === 'function') opts.onOpen(wrap, entry);
    return () => entry.close(false);
  }

  function menu(anchorEl, items, opts) {
    opts = opts || {};
    const root = doc.createElement('div');
    root.setAttribute('role', 'menu');
    let stack = [];

    function build(list, canBack) {
      root.innerHTML = '';
      if (canBack) {
        const back = doc.createElement('button');
        back.type = 'button';
        back.className = 'fx-menu__item fx-menu__back';
        back.setAttribute('role', 'menuitem');
        back.innerHTML = icon('chevron-left', 16) + '<span>Back</span>';
        back.addEventListener('click', () => { stack.pop(); build(stack[stack.length - 1] || items, stack.length > 0); });
        root.appendChild(back);
        root.appendChild(Object.assign(doc.createElement('div'), { className: 'fx-menu__sep', role: 'separator' }));
      }
      list.forEach((it) => {
        if (it === 'sep') { root.appendChild(Object.assign(doc.createElement('div'), { className: 'fx-menu__sep', role: 'separator' })); return; }
        if (!it) return;
        const b = doc.createElement('button');
        b.type = 'button';
        b.setAttribute('role', it.check !== undefined ? 'menuitemradio' : 'menuitem');
        if (it.check !== undefined) b.setAttribute('aria-checked', it.check ? 'true' : 'false');
        b.className = 'fx-menu__item' + (it.danger ? ' is-danger' : '') + (it.desc ? ' has-desc' : '');
        b.disabled = !!it.disabled;
        b.innerHTML =
          (it.icon ? '<span class="fx-menu__ic">' + icon(it.icon, 16) + '</span>' : '') +
          '<span class="fx-menu__tx"><span class="fx-menu__label">' + esc(it.label) + '</span>' + (it.desc ? '<span class="fx-menu__desc">' + esc(it.desc) + '</span>' : '') + '</span>' +
          (it.items ? '<span class="fx-menu__go">' + icon('chevron-right', 14) + '</span>' : '') +
          (it.check ? '<span class="fx-menu__go">' + icon('check', 16) + '</span>' : '');
        b.addEventListener('click', () => {
          if (it.items) { stack.push(it.items); build(it.items, true); focusFirst(); entry && entry.place(); return; }
          closeMenu(true);
          if (typeof it.onClick === 'function') it.onClick();
        });
        root.appendChild(b);
      });
    }
    const focusFirst = () => { const f = $('.fx-menu__item:not([disabled])', root); if (f) safeFocus(f); };
    build(items, false);

    root.addEventListener('keydown', (e) => {
      const its = $$('.fx-menu__item:not([disabled])', root);
      const i = its.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); its[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); its[its.length - 1].focus(); }
      else if (e.key === 'Tab') { closeMenu(false); }
    });

    let entry = null;
    const closer = popover(anchorEl, root, { className: opts.className, align: opts.align, onOpen: (w, en) => { entry = en; } });
    focusFirst();
    return closer;
  }

  function confirmDlg(text, o) {
    o = o || {};
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      modal({
        title: o.title || 'Please confirm',
        body: '<p class="fx-modal__text">' + esc(text) + '</p>',
        focus: o.danger ? 'cancel' : 'primary',
        actions: [
          { label: o.cancelLabel || 'Cancel', onClick: (c) => { finish(false); c(); } },
          { label: o.okLabel || 'OK', primary: true, danger: o.danger, onClick: (c) => { finish(true); c(); } },
        ],
        onClose: () => finish(false),
      });
    });
  }

  function promptDlg(title, o) {
    o = o || {};
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const input = doc.createElement('input');
      input.type = 'text';
      input.className = 'fx-input';
      input.value = o.value || '';
      input.placeholder = o.placeholder || '';
      input.setAttribute('aria-label', title);
      input.maxLength = 120;
      modal({
        title,
        body: input,
        actions: [
          { label: 'Cancel', onClick: (c) => { finish(null); c(); } },
          { label: o.okLabel || 'Save', primary: true, onClick: (c) => { const v = input.value.trim(); if (!v) { input.focus(); return; } finish(v); c(); } },
        ],
        onClose: () => finish(null),
      });
    });
  }

  FT.ui = { toast, modal, menu, popover, confirm: confirmDlg, prompt: promptDlg };

  /* ======================================================================
     log, trips
     ====================================================================== */

  FT.log = function (tripId, text, who) {
    store.update((s) => {
      const t = s.trips.find((x) => x.id === tripId);
      if (!t) return;
      t.activity.push({ at: new Date().toISOString(), who: who || 'Friday', text });
      if (t.activity.length > 200) t.activity.splice(0, t.activity.length - 200);
    });
  };

  const tripRange = (t) => {
    const days = ((t && t.plan && t.plan.days) || []).map((d) => d.date).filter(Boolean).sort();
    if (days.length) return { start: days[0], end: days[days.length - 1] };
    const d = t && t.prefs && t.prefs.dates;
    return d && d.start ? { start: d.start, end: d.end || d.start } : null;
  };
  const tripRangeLabel = (t) => { const r = tripRange(t); return r ? fmtRange(r.start, r.end) : 'No dates yet'; };
  const sortedTrips = () => state.trips.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  FT.trips = {
    create(o) {
      const destId = (o && o.destId) || null;
      const d = FT.dest(destId);
      const now = new Date().toISOString();
      const t = normTrip({
        id: uid('t'), destId, title: d ? d.tripTitle || d.name + ' trip' : 'New trip', createdAt: now, updatedAt: now,
        threads: [{ id: uid('th'), title: d && d.threadTitle ? d.threadTitle : 'New conversation', createdAt: now, messages: [] }],
      });
      store.update((s) => { s.trips.unshift(t); s.currentTripId = t.id; });
      if (window.FridayGuideAnalytics && typeof window.FridayGuideAnalytics.tripStarted === 'function') window.FridayGuideAnalytics.tripStarted(t);
      return t;
    },
    open(id) { router.go('#/trip/' + id); },
    remove(id) {
      const wasHere = router.current().name === 'trip' && router.current().id === id;
      store.update((s) => {
        s.trips = s.trips.filter((t) => t.id !== id);
        s.bookings = s.bookings.filter((b) => b.tripId !== id);
        s.notifications = s.notifications.filter((n) => n.tripId !== id);
        if (s.currentTripId === id) s.currentTripId = null;
      });
      if (wasHere) router.go('#/');
      toast('Trip deleted');
    },
    rename(id, title) {
      title = String(title || '').trim();
      if (!title) return;
      store.update((s) => { const t = s.trips.find((x) => x.id === id); if (t) t.title = title.slice(0, 120); });
    },
    duplicate(id) {
      const src = store.trip(id);
      if (!src) return null;
      const now = new Date().toISOString();
      const c = clone(src);
      c.id = uid('t');
      c.title = src.title + ' (copy)';
      c.createdAt = c.updatedAt = now;
      const map = {};
      c.threads.forEach((th) => { const n = uid('th'); map[th.id] = n; th.id = n; });
      c.activeThreadId = map[src.activeThreadId] || c.threads[0].id;
      if (c.plan) c.plan.days.forEach((d) => { d.id = uid('d'); d.items.forEach((it) => { it.id = uid('i'); }); });
      c.versions = [];
      c.banner = null;
      c.activity = [{ at: now, who: 'You', text: 'Duplicated from ' + src.title }];
      store.update((s) => { const i = s.trips.findIndex((t) => t.id === id); s.trips.splice(i + 1, 0, normTrip(c)); });
      toast('Trip duplicated');
      return c;
    },
    range: tripRange,
    rangeLabel: tripRangeLabel,
  };

  /* ======================================================================
     plan
     ====================================================================== */

  const normPlan = (plan) => {
    const p = clone(plan) || { days: [], stay: null };
    p.days = Array.isArray(p.days) ? p.days : [];
    p.stay = p.stay || null;
    p.days.forEach((d) => {
      d.id = d.id || uid('d');
      d.area = d.area || null;
      d.town = d.town || '';
      d.date = d.date || null;
      d.items = Array.isArray(d.items) ? d.items : [];
      d.items.forEach((it) => { it.id = it.id || uid('i'); it.note = it.note || ''; });
    });
    return p;
  };
  /** When every day is dated, keep dates consecutive after a remove or move. */
  const redate = (plan) => {
    const days = plan.days;
    if (!days.length || !days.every((d) => d.date)) return;
    const start = days.map((d) => d.date).sort()[0];
    days.forEach((d, i) => { d.date = addDays(start, i); });
  };
  const placeName = (t, placeId) => { const p = FT.place(t.destId, placeId); return p ? p.name : 'a place'; };
  const withTrip = (tripId, fn) => store.update((s) => { const t = s.trips.find((x) => x.id === tripId); if (t) return fn(t, s); });
  const logIn = (t, text, who) => {
    t.activity.push({ at: new Date().toISOString(), who: who || 'Friday', text });
    if (t.activity.length > 200) t.activity.splice(0, t.activity.length - 200);
  };
  const pushVersion = (t, plan, summary) => {
    t.versions.push({ at: new Date().toISOString(), summary: summary || 'Earlier plan', plan: plan ? clone(plan) : null });
    if (t.versions.length > 20) t.versions.splice(0, t.versions.length - 20);
  };

  FT.plan = {
    apply(tripId, plan, meta) {
      meta = meta || {};
      const done = withTrip(tripId, (t, s) => {
        const now = new Date().toISOString();
        // Each version is a plan as it stood, labelled with the change that produced it.
        pushVersion(t, t.plan, t.planMeta ? t.planMeta.summary : t.plan ? 'Earlier plan' : 'Empty trip');
        t.plan = normPlan(plan);
        t.planMeta = { summary: meta.summary || 'Updated the plan', at: now };
        t.banner = { text: 'Friday updated your plan.', at: now };
        t.activeTab = 'plan';
        logIn(t, meta.summary || 'Updated the plan' + (meta.changes ? ' (' + meta.changes + ' changes)' : ''));
        const text = 'Friday updated ' + t.title;
        const open = s.notifications.find((n) => n.kind === 'plan' && n.tripId === t.id && !n.done);
        if (open) { open.at = now; open.text = text; } else { s.notifications.unshift({ id: uid('n'), kind: 'plan', tripId: t.id, text, at: now, done: false }); }
        if (s.notifications.length > 30) s.notifications.length = 30;
        return true;
      });
      if (done) { store.emit('plan', { tripId }); store.emit('map:fit'); }
    },
    undo(tripId) {
      const ok = withTrip(tripId, (t) => {
        if (!t.versions.length) return false;
        const v = t.versions.pop();
        t.plan = v.plan ? normPlan(v.plan) : null;
        t.planMeta = v.plan ? { summary: v.summary, at: v.at } : null;
        t.banner = null;
        if (!t.plan && t.activeTab === 'plan') t.activeTab = 'overview';
        logIn(t, 'Undid the last plan change', 'You');
        return true;
      });
      if (ok) { store.emit('plan', { tripId }); store.emit('map:fit'); } else { toast('Nothing to undo'); }
    },
    restore(tripId, index) {
      const ok = withTrip(tripId, (t) => {
        const v = t.versions[index];
        if (!v) return false;
        pushVersion(t, t.plan, t.planMeta ? t.planMeta.summary : t.plan ? 'Earlier plan' : 'Empty trip');
        t.plan = v.plan ? normPlan(v.plan) : null;
        t.planMeta = v.plan ? { summary: v.summary, at: v.at } : null;
        t.banner = null;
        if (!t.plan && t.activeTab === 'plan') t.activeTab = 'overview';
        logIn(t, 'Restored an earlier version', 'You');
        return true;
      });
      if (ok) { store.emit('plan', { tripId }); store.emit('map:fit'); toast('Version restored'); }
    },
    addItem(tripId, dayIndex, placeId, note) {
      const ok = withTrip(tripId, (t) => {
        const p = FT.place(t.destId, placeId);
        if (!t.plan) {
          const area = p && p.area ? p.area : null;
          const a = FT.dest(t.destId) && FT.dest(t.destId).areas ? FT.dest(t.destId).areas.find((x) => x.id === area) : null;
          t.plan = { days: [{ id: uid('d'), area, town: a ? a.name : '', date: null, items: [] }], stay: null };
          t.activeTab = 'plan';
        }
        const days = t.plan.days;
        if (!days.length) days.push({ id: uid('d'), area: p ? p.area || null : null, town: '', date: null, items: [] });
        const idx = dayIndex == null ? days.length - 1 : clamp(dayIndex, 0, days.length - 1);
        days[idx].items.push({ id: uid('i'), place: placeId, note: note || '' });
        if (p && p.kind === 'stay' && !t.plan.stay) t.plan.stay = placeId;
        logIn(t, 'You added ' + placeName(t, placeId), 'You');
        return true;
      });
      if (ok) store.emit('plan', { tripId });
      return !!ok;
    },
    removeItem(tripId, itemId) {
      const ok = withTrip(tripId, (t) => {
        if (!t.plan) return false;
        for (const d of t.plan.days) {
          const i = d.items.findIndex((it) => it.id === itemId);
          if (i < 0) continue;
          const [it] = d.items.splice(i, 1);
          if (t.plan.stay === it.place && !t.plan.days.some((x) => x.items.some((y) => y.place === it.place))) t.plan.stay = null;
          logIn(t, 'You removed ' + placeName(t, it.place), 'You');
          return true;
        }
        return false;
      });
      if (ok) store.emit('plan', { tripId });
    },
    /** toIndex is the item's final index within the target day. */
    moveItem(tripId, itemId, toDayIndex, toIndex) {
      const ok = withTrip(tripId, (t) => {
        if (!t.plan || !t.plan.days[toDayIndex]) return false;
        let item = null;
        for (const d of t.plan.days) {
          const i = d.items.findIndex((it) => it.id === itemId);
          if (i >= 0) { item = d.items.splice(i, 1)[0]; break; }
        }
        if (!item) return false;
        const target = t.plan.days[toDayIndex].items;
        target.splice(clamp(toIndex == null ? target.length : toIndex, 0, target.length), 0, item);
        return true;
      });
      if (ok) store.emit('plan', { tripId });
    },
    setItemTime(tripId, itemId, time) {
      const ok = withTrip(tripId, (t) => {
        if (!t.plan) return false;
        let found = null;
        t.plan.days.forEach((day) => day.items.forEach((item) => { if (item.id === itemId) found = item; }));
        if (!found || (found.time || '') === (time || '')) return false;
        pushVersion(t, t.plan, t.planMeta ? t.planMeta.summary : 'Earlier plan');
        found.time = time || '';
        t.banner = { text: 'Stop time updated.' , at: new Date().toISOString() };
        logIn(t, time ? 'You set a stop time' : 'You cleared a stop time', 'You');
        return true;
      });
      if (ok) store.emit('plan', { tripId });
      return !!ok;
    },
    addDay(tripId) {
      const ok = withTrip(tripId, (t) => {
        if (!t.plan) { t.plan = { days: [], stay: null }; t.activeTab = 'plan'; }
        const last = t.plan.days[t.plan.days.length - 1];
        t.plan.days.push({ id: uid('d'), area: last ? last.area : null, town: last ? last.town : '', date: last && last.date ? addDays(last.date, 1) : null, items: [] });
        logIn(t, 'You added Day ' + t.plan.days.length, 'You');
        return true;
      });
      if (ok) store.emit('plan', { tripId });
    },
    removeDay(tripId, dayIndex) {
      const ok = withTrip(tripId, (t) => {
        if (!t.plan || !t.plan.days[dayIndex]) return false;
        const [d] = t.plan.days.splice(dayIndex, 1);
        redate(t.plan);
        const stay = t.plan.stay;
        if (stay && !t.plan.days.some((x) => x.items.some((y) => y.place === stay))) t.plan.stay = null;
        logIn(t, 'You removed a day' + (d.items.length ? ' with ' + d.items.length + ' stops' : ''), 'You');
        return true;
      });
      if (ok) { store.emit('plan', { tripId }); store.emit('map:fit'); }
    },
    moveDay(tripId, from, to) {
      const ok = withTrip(tripId, (t) => {
        const days = t.plan && t.plan.days;
        if (!days || !days[from] || to < 0 || to >= days.length || from === to) return false;
        const dates = days.map((d) => d.date);
        days.splice(to, 0, days.splice(from, 1)[0]);
        if (dates.every(Boolean)) days.forEach((d, i) => { d.date = dates[i]; });
        return true;
      });
      if (ok) store.emit('plan', { tripId });
    },
  };

  /* ======================================================================
     saved, bookings
     ====================================================================== */

  FT.saved = {
    has: (destId, placeId) => state.saved.some((x) => x.destId === destId && x.placeId === placeId),
    toggle(destId, placeId) {
      const had = FT.saved.has(destId, placeId);
      store.update((s) => {
        if (had) s.saved = s.saved.filter((x) => !(x.destId === destId && x.placeId === placeId));
        else s.saved.unshift({ id: uid('s'), destId, placeId, listId: null, at: new Date().toISOString() });
      });
      toast(had ? 'Removed' : 'Saved');
      return !had;
    },
  };

  FT.bookings = {
    add(b) {
      const rec = Object.assign({ id: uid('b'), tripId: null, type: 'other', name: '', start: null, end: null, ref: '', price: null, currency: '', destId: null, placeId: null }, b || {});
      store.update((s) => {
        s.bookings.push(rec);
        const t = rec.tripId && s.trips.find((x) => x.id === rec.tripId);
        if (t) logIn(t, 'You added a booking: ' + rec.name, 'You');
      });
      return rec;
    },
    remove(id) { store.update((s) => { s.bookings = s.bookings.filter((b) => b.id !== id); }); },
    update(id, patch) { store.update((s) => { const b = s.bookings.find((x) => x.id === id || x.serverId === id); if (b) Object.assign(b, patch || {}); }); },
    forTrip(tripId) { return state.bookings.filter((b) => b.tripId === tripId).sort((a, b) => (a.start || '').localeCompare(b.start || '')); },
    openForm: openBookingForm,
  };

  const BOOKING_TYPES = [
    { id: 'hotel', label: 'Hotel', icon: 'bed', ph: 'Hotel name' },
    { id: 'flight', label: 'Flight', icon: 'plane', ph: 'e.g. IndiGo 6E 512, BOM to GOI' },
    { id: 'event', label: 'Event', icon: 'ticket', ph: 'Event name' },
    { id: 'reservation', label: 'Reservation', icon: 'fork', ph: 'Restaurant, tour or activity' },
    { id: 'other', label: 'Other', icon: 'ticket', ph: 'What is booked' },
  ];
  const typeIcon = (t) => (BOOKING_TYPES.find((x) => x.id === t) || BOOKING_TYPES[3]).icon;

  function openBookingForm(tripId, dayIndex, initialType) {
    const trips = sortedTrips();
    const here = router.current();
    const initialTrip = tripId !== undefined && tripId !== null ? tripId : here.name === 'trip' ? here.id : trips[0] ? trips[0].id : '';
    let type = initialType || 'hotel';
    const body = doc.createElement('div');
    body.className = 'fx-form';
    const curOf = (id) => { const t = store.trip(id); const d = t && FT.dest(t.destId); return d && d.currency ? d.currency : '₹'; };
    body.innerHTML =
      '<div class="fx-field"><span class="fx-label" id="bk-type-l">Type</span><div class="fx-segtabs" role="radiogroup" aria-labelledby="bk-type-l">' +
      BOOKING_TYPES.map((t) => '<button type="button" role="radio" class="fx-segtab" data-type="' + t.id + '" aria-checked="' + (t.id === type) + '">' + icon(t.icon, 15) + '<span>' + t.label + '</span></button>').join('') +
      '</div></div>' +
      '<div class="fx-field"><label class="fx-label" for="bk-name">Name</label><input class="fx-input" id="bk-name" name="name" maxlength="120" autocomplete="off"></div>' +
      '<div class="fx-field" data-booking-only="flight" hidden><label class="fx-label" for="bk-flight">Flight number</label><input class="fx-input" id="bk-flight" name="flightNumber" maxlength="40" placeholder="e.g. AI 101"></div>' +
      '<div class="fx-field" data-booking-only="hotel,event" hidden><label class="fx-label" for="bk-address">' + 'Address or venue' + '</label><input class="fx-input" id="bk-address" name="address" maxlength="240" placeholder="Hotel address or event venue"></div>' +
      '<div class="fx-field"><label class="fx-label" for="bk-trip">Trip</label><select class="fx-input" id="bk-trip" name="trip">' +
      '<option value="">No trip</option>' + trips.map((t) => '<option value="' + esc(t.id) + '"' + (t.id === initialTrip ? ' selected' : '') + '>' + esc(t.title) + '</option>').join('') + '</select></div>' +
      '<div class="fx-row2"><div class="fx-field"><label class="fx-label" for="bk-start">Start</label><input class="fx-input" type="date" id="bk-start" name="start"></div>' +
      '<div class="fx-field"><label class="fx-label" for="bk-end">End</label><input class="fx-input" type="date" id="bk-end" name="end"></div></div>' +
      '<div class="fx-row2" data-booking-only="event" hidden><div class="fx-field"><label class="fx-label" for="bk-start-time">Start time</label><input class="fx-input" type="time" id="bk-start-time" name="startTime"></div><div class="fx-field"><label class="fx-label" for="bk-end-time">End time</label><input class="fx-input" type="time" id="bk-end-time" name="endTime"></div></div>' +
      '<div class="fx-row2"><div class="fx-field"><label class="fx-label" for="bk-ref">Reference</label><input class="fx-input" id="bk-ref" name="ref" maxlength="60" autocomplete="off" placeholder="Confirmation number"></div>' +
      '<div class="fx-field"><label class="fx-label" for="bk-price">Price</label><div class="fx-pricebox"><select class="fx-input" id="bk-cur" name="currency" aria-label="Currency">' +
      ['₹', '$', '¥', '€', '£'].map((c) => '<option value="' + c + '">' + c + '</option>').join('') +
      '</select><input class="fx-input" type="number" min="0" step="any" id="bk-price" name="price" inputmode="decimal" placeholder="0"></div></div></div>' +
      '<p class="fx-error" role="alert" hidden></p>';

    const q = (n) => $('[name="' + n + '"]', body);
    const err = $('.fx-error', body);
    let saving = false;
    const showErr = (msg, field) => { err.textContent = msg; err.hidden = false; if (field) field.focus(); };
    const setType = (id) => {
      type = id;
      $$('.fx-segtab', body).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === id)));
      q('name').placeholder = (BOOKING_TYPES.find((t) => t.id === id) || {}).ph || '';
      $$('[data-booking-only]', body).forEach((field) => { field.hidden = field.dataset.bookingOnly.split(',').indexOf(id) < 0; });
      const startLabel = $('label[for="bk-start"]', body), endLabel = $('label[for="bk-end"]', body);
      if (startLabel) startLabel.textContent = id === 'hotel' ? 'Check-in' : id === 'flight' ? 'Departure date' : id === 'event' ? 'Date' : 'Start';
      if (endLabel) endLabel.textContent = id === 'hotel' ? 'Check-out' : id === 'event' ? 'End date' : 'End';
    };
    setType(type);
    q('currency').value = curOf(initialTrip);
    $$('.fx-segtab', body).forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));
    q('trip').addEventListener('change', () => { q('currency').value = curOf(q('trip').value); });

    modal({
      title: 'Add a booking',
      body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Add booking', primary: true,
          onClick: (close, button) => {
            if (saving) return;
            const name = q('name').value.trim();
            const start = q('start').value || null;
            const end = q('end').value || null;
            const priceRaw = q('price').value.trim();
            if (!name) return showErr('Give the booking a name.', q('name'));
            if (start && end && end < start) return showErr('The end date is before the start date.', q('end'));
            if (priceRaw && (isNaN(+priceRaw) || +priceRaw < 0)) return showErr('Price should be a number, or left empty.', q('price'));
            const tid = q('trip').value || null;
            const t = tid && store.trip(tid);
            saving = true;
            button.disabled = true;
            button.textContent = 'Adding…';
            let booking = null;
            try {
              booking = FT.bookings.add({
                tripId: tid, type, name, start, end, ref: q('ref').value.trim(),
                price: priceRaw ? +priceRaw : null, currency: q('currency').value, destId: t ? t.destId : null,
                flightNumber: q('flightNumber').value.trim(), address: q('address').value.trim(), startTime: q('startTime').value, endTime: q('endTime').value,
              });
              if (t && dayIndex !== undefined && Number.isFinite(dayIndex)) {
                let dest = FT.dest(t.destId);
                if (!dest) {
                  const destId = 'research-custom-' + String(t.id).replace(/[^a-z0-9_-]/gi, '').slice(0, 50);
                  dest = { id: destId, name: t.destName || t.title || 'My journey', tripTitle: t.title, currency: booking.currency, areas: [{ id: 'custom', name: t.destName || t.title || 'Journey', town: t.destName || t.title || 'Journey' }], places: {}, map: {} };
                  FT.DESTINATIONS[destId] = dest;
                  store.update((s) => { const trip = s.trips.find((x) => x.id === tid); if (trip) { trip.destId = destId; trip.destName = dest.name; trip.catalog = dest; } });
                }
                const placeId = 'booking-' + booking.id;
                dest.places[placeId] = { id: placeId, name: type === 'flight' ? name + (booking.flightNumber ? ' · ' + booking.flightNumber : '') : name, kind: type, label: type === 'flight' ? 'Flight' : type === 'event' ? 'Event' : 'Stay', area: dest.areas[0] && dest.areas[0].id || 'custom', address: booking.address || '', photos: [] };
                store.update((s) => { const trip = s.trips.find((x) => x.id === tid); if (trip) trip.catalog = dest; });
                const targetDay = dayIndex < 0 ? null : dayIndex;
                FT.plan.addItem(tid, targetDay, placeId, [booking.type === 'flight' && booking.flightNumber ? 'Flight ' + booking.flightNumber : '', booking.startTime ? 'Ends ' + (booking.endTime || '') : ''].filter(Boolean).join(' · '));
                const tripNow = store.trip(tid), days = tripNow && tripNow.plan && tripNow.plan.days || [], day = dayIndex < 0 ? days[days.length - 1] : days[dayIndex];
                if (day && booking.start && !day.date) store.update((s) => { const tr = s.trips.find((x) => x.id === tid); if (tr && tr.plan && tr.plan.days[dayIndex < 0 ? tr.plan.days.length - 1 : dayIndex]) tr.plan.days[dayIndex < 0 ? tr.plan.days.length - 1 : dayIndex].date = booking.start; });
                const lastItem = day && day.items && day.items[day.items.length - 1];
                if (lastItem && booking.startTime && FT.plan.setItemTime) FT.plan.setItemTime(tid, lastItem.id, booking.startTime);
              }
            } catch (e) {
              console.error(e);
              if (booking) { close(); toast('Booking saved, but it could not be added to the itinerary.'); }
              else { saving = false; button.disabled = false; button.textContent = 'Add booking'; showErr('Could not save this booking. Please try again.'); }
              return;
            }
            close();
            toast('Booking added');
          },
        },
      ],
    });
  }

  /* ======================================================================
     router
     ====================================================================== */

  const PAGE_OF = { home: 'home', new: 'new', bookings: 'bookings', saved: 'saved', notifications: 'notifications', preferences: 'preferences', trip: 'trip' };
  let route = { name: 'home', id: null };
  let appliedKey = null;

  function parseHash(hash) {
    let h = String(hash || '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
    if (!h) h = '/';
    const m = /^\/trip\/([^/]+)$/.exec(h);
    if (m) { let id = m[1]; try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ } return { name: 'trip', id }; }
    const name = { '/': 'home', '/new': 'new', '/bookings': 'bookings', '/saved': 'saved', '/notifications': 'notifications', '/preferences': 'preferences' }[h];
    return { name: name || 'home', id: null };
  }
  const keyOf = (r) => r.name + (r.id ? '/' + r.id : '');

  const router = {
    go(hash) {
      if (typeof hash !== 'string') return;
      if (hash[0] !== '#') hash = '#' + hash;
      const cur = location.hash === '' || location.hash === '#' ? '#/' : location.hash;
      if (cur !== hash) {
        try { location.hash = hash; } catch (e) { /* ignore */ }
      }
      applyRoute(parseHash(hash));
    },
    current: () => ({ name: route.name, id: route.id }),
  };
  FT.router = router;

  let autoCollapsed = false;

  function applyRoute(r) {
    if (r.name === 'trip' && !store.trip(r.id)) {
      try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { /* ignore */ }
      r = { name: 'home', id: null };
    }
    appliedKey = keyOf(r);
    closeMenu(false);
    closeDrawer();
    route = r;
    const app = $('[data-app]');
    if (app) app.dataset.route = r.name;
    doc.body.dataset.route = r.name;

    // Sidebar starts collapsed on the trip route under 1280px, and is put back on leaving it.
    if (r.name === 'trip' && !isNarrow() && window.innerWidth < 1280 && !state.sideCollapsed) {
      autoCollapsed = true;
      store.update((s) => { s.sideCollapsed = true; });
    } else if (r.name !== 'trip' && autoCollapsed) {
      autoCollapsed = false;
      if (state.sideCollapsed) store.update((s) => { s.sideCollapsed = false; });
    }
    if (r.name === 'trip' && state.currentTripId !== r.id) store.update((s) => { s.currentTripId = r.id; });

    const pageName = r.name === 'home' && !state.trips.length ? 'new' : PAGE_OF[r.name];
    doc.body.classList.toggle('fx-start', pageName === 'new');
    $$('[data-page]').forEach((el) => { el.hidden = el.dataset.page !== pageName; });
    const pg = pages[pageName];
    if (pg) pg.render(true);
    const main = $('[data-main]');
    if (main) main.scrollTop = 0;

    if (r.name === 'trip') {
      const t = store.trip(r.id);
      doc.title = (t ? t.title : 'Trip') + ' · Friday';
      if (FT.workspace && typeof FT.workspace.open === 'function') { try { FT.workspace.open(r.id); } catch (e) { console.error(e); } }
    } else {
      const TITLES = { new: 'New trip', bookings: 'Bookings', saved: 'Saved', notifications: 'Notifications', preferences: 'Preferences' };
      doc.title = TITLES[pageName] ? TITLES[pageName] + ' \u00B7 Friday' : 'Plan a trip \u00B7 Friday';
    }
    renderSidebar(true);
    syncFrame();
    store.emit('route', { name: r.name, id: r.id });
  }

  /* ======================================================================
     sidebar
     ====================================================================== */

  let drawerOpen = false;
  let lastSideSig = '';

  const homeLabel = () => {
    const p = state.prefs;
    const ap = (p.airports || []).join(', ');
    return p.homeCity ? p.homeCity + (ap ? ' · ' + ap : '') : ap || 'Set your home city';
  };

  function syncFrame() {
    const app = $('[data-app]');
    if (!app) return;
    app.classList.toggle('is-side-collapsed', !!state.sideCollapsed);
    app.classList.toggle('is-drawer-open', drawerOpen);
    const side = $('[data-side]');
    if (side) side.setAttribute('aria-hidden', String(isNarrow() ? !drawerOpen : !!state.sideCollapsed));
    const float = $('.fx-float-toggle');
    if (float) float.hidden = !state.sideCollapsed || (route.name === 'trip' && !!FT.workspace);
    const burger = $('.fx-burger');
    if (burger) burger.setAttribute('aria-expanded', String(drawerOpen));
  }

  function openDrawer() { drawerOpen = true; syncFrame(); const b = $('.fx-side [data-act="toggle-side"]'); if (b) safeFocus(b); }
  function closeDrawer() { if (!drawerOpen) return; drawerOpen = false; syncFrame(); }
  function toggleSide() {
    if (isNarrow()) { drawerOpen ? closeDrawer() : openDrawer(); return; }
    autoCollapsed = false;
    store.update((s) => { s.sideCollapsed = !s.sideCollapsed; });
  }
  FT.sidebar = {
    toggle: toggleSide,
    open() { if (isNarrow()) openDrawer(); else if (state.sideCollapsed) toggleSide(); },
    close() { if (isNarrow()) closeDrawer(); else if (!state.sideCollapsed) toggleSide(); },
    isCollapsed: () => (isNarrow() ? !drawerOpen : !!state.sideCollapsed),
  };

  function renderSidebar(force) {
    const side = $('[data-side]');
    if (!side) return;
    const trips = sortedTrips();
    const unread = state.notifications.some((n) => !n.done);
    const sig = JSON.stringify([keyOf(route), trips.map((t) => [t.id, t.title, tripRangeLabel(t)]), unread, state.dismissed, homeLabel()]);
    if (!force && sig === lastSideSig) return;
    lastSideSig = sig;
    const on = (n) => route.name === n || (n === 'home' && route.name === 'home');
    const scrollTop = ($('.fx-side__scroll', side) || {}).scrollTop || 0;

    const startView = route.name === 'new' || (route.name === 'home' && !trips.length);
    if (startView) {
      const row = (href, label, glyph, active) => '<a class="fx-start-side__link' + (active ? ' is-active' : '') + '" href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + icon(glyph, 22) + '<span>' + label + '</span></a>';
      side.innerHTML =
        '<div class="fx-side__in fx-side__in--start">' +
        '<button class="sr fx-start-side__collapse" type="button" data-act="toggle-side" aria-label="Collapse sidebar">' + icon('sidebar', 18) + '</button>' +
        '<nav class="fx-start-side" aria-label="Planner navigation">' +
        row('#/new', 'New trip', 'suitcase', true) +
        row('#/', 'My trips', 'map', false) +
        row('#/saved', 'Saved places', 'heart', false) +
        row('#/bookings', 'Bookings', 'calendar', false) +
        '</nav>' +
        '<div class="fx-start-side__bottom"><hr><a class="fx-start-side__link' + (route.name === 'preferences' ? ' is-active' : '') + '" href="#/preferences"' + (route.name === 'preferences' ? ' aria-current="page"' : '') + '>' + icon('settings', 22) + '<span>Preferences</span></a></div>' +
        '</div>';
      return;
    }

    const tips = [];
    if (!state.dismissed.studioCard) {
      tips.push('<div class="fx-tip"><span class="fx-tip__ic">' + icon('pen', 18) + '</span><div class="fx-tip__b"><p class="fx-tip__t">Rather have it designed?</p>' +
        '<p class="fx-tip__d">Your trip plan is ready to shape. Review the suggestions, then adjust the details to suit you.</p><a class="fx-tip__link" href="commission.html">Talk with a travel designer</a></div>' +
        '<button class="fx-tip__x" type="button" data-act="dismiss" data-key="studioCard" aria-label="Dismiss">' + icon('x', 14) + '</button></div>');
    }
    if (!state.dismissed.prefsCard) {
      tips.push('<div class="fx-tip"><span class="fx-tip__ic">' + icon('bell', 18) + '</span><div class="fx-tip__b"><p class="fx-tip__t">Tell us how you like to travel—airlines, hotel style, budget—and we’ll tailor every recommendation to match.</p>' +
        '<a class="fx-tip__link" href="#/preferences">Set it up</a></div>' +
        '<button class="fx-tip__x" type="button" data-act="dismiss" data-key="prefsCard" aria-label="Dismiss">' + icon('x', 14) + '</button></div>');
    }

    side.innerHTML =
      '<div class="fx-side__in">' +
      '<div class="fx-side__top"><a class="fx-wordmark" href="index.html" aria-label="Friday, back to home">Friday</a>' +
      '<button class="fx-icon-btn" type="button" data-act="toggle-side" aria-label="Collapse sidebar" title="Collapse sidebar">' + icon('sidebar', 18) + '</button></div>' +
      '<div class="fx-seg">' +
      '<a class="fx-seg__btn' + (on('home') ? ' is-active' : '') + '" href="#/" aria-label="Home" title="Home"' + (on('home') ? ' aria-current="page"' : '') + '>' + icon('home', 18) + '</a>' +
      '<a class="fx-seg__btn' + (on('notifications') ? ' is-active' : '') + '" href="#/notifications" aria-label="Notifications' + (unread ? ' (unread)' : '') + '" title="Notifications"' + (on('notifications') ? ' aria-current="page"' : '') + '>' + icon('bell', 18) + (unread ? '<i class="fx-seg__dot"></i>' : '') + '</a>' +
      '<a class="fx-btn fx-btn--ink fx-seg__new" href="#/new">' + icon('plus', 16) + '<span>New trip</span></a></div>' +
      '<nav class="fx-nav" aria-label="Sections">' +
      '<a class="fx-nav__row' + (on('bookings') ? ' is-active' : '') + '" href="#/bookings"' + (on('bookings') ? ' aria-current="page"' : '') + '>' + icon('ticket', 18) + '<span>Bookings</span></a>' +
      '<a class="fx-nav__row' + (on('saved') ? ' is-active' : '') + '" href="#/saved"' + (on('saved') ? ' aria-current="page"' : '') + '>' + icon('globe', 18) + '<span>Saved Places</span><em class="fx-badge">Beta</em></a></nav>' +
      '<div class="fx-side__scroll">' +
      (tips.length ? '<hr class="fx-rule"><div class="fx-tips">' + tips.join('') + '</div>' : '') +
      '<hr class="fx-rule"><p class="fx-side__label">Trips</p>' +
      '<ul class="fx-trips">' +
      (trips.length ? trips.map((t) =>
        '<li class="fx-trip' + (route.name === 'trip' && route.id === t.id ? ' is-current' : '') + '" data-id="' + esc(t.id) + '">' +
        '<a class="fx-trip__link" href="#/trip/' + esc(t.id) + '"' + (route.name === 'trip' && route.id === t.id ? ' aria-current="page"' : '') + '><span class="fx-trip__t">' + esc(t.title) + '</span><span class="fx-trip__d">' + esc(tripRangeLabel(t)) + '</span></a>' +
        '<button class="fx-icon-btn fx-trip__more" type="button" data-act="trip-menu" aria-label="Actions for ' + esc(t.title) + '" aria-haspopup="menu">' + icon('dots', 18) + '</button></li>'
      ).join('') : '<li class="fx-side__none">No trips yet.</li>') +
      '</ul></div>' +
      '<div class="fx-side__foot"><a class="fx-home-pill" href="#/preferences" title="Your preferences">' + icon('home', 16) + '<span>' + esc(homeLabel()) + '</span></a></div>' +
      '</div>';
    const sc = $('.fx-side__scroll', side);
    if (sc) sc.scrollTop = scrollTop;
  }

  function wireSidebar() {
    const side = $('[data-side]');
    side.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (a) {
        const act = a.dataset.act;
        if (act === 'toggle-side') toggleSide();
        else if (act === 'dismiss') { store.update((s) => { s.dismissed[a.dataset.key] = true; }); }
        else if (act === 'trip-menu') {
          const id = a.closest('.fx-trip').dataset.id;
          const t = store.trip(id);
          if (!t) return;
          menu(a, [
            { label: 'Rename', icon: 'edit', onClick: () => promptDlg('Rename trip', { value: t.title }).then((v) => { if (v) FT.trips.rename(id, v); }) },
            { label: 'Duplicate', icon: 'copy', onClick: () => FT.trips.duplicate(id) },
            'sep',
            { label: 'Delete', icon: 'trash', danger: true, onClick: () => confirmDlg('Delete “' + t.title + '”? Its plan, conversations and bookings go with it.', { okLabel: 'Delete', danger: true, title: 'Delete trip' }).then((ok) => { if (ok) FT.trips.remove(id); }) },
          ], { align: 'right' });
        }
        return;
      }
      if (isNarrow() && e.target.closest('a[href]')) closeDrawer();
    });
  }

  /* ======================================================================
     pages: shared bits
     ====================================================================== */

  const pages = {};
  const pageEl = (n) => $('[data-page="' + n + '"]');
  const delegate = (root, type, sel, fn) => root.addEventListener(type, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
  const ochreDot = '<i class="fx-mark__dot"></i>';

  function markHtml() { return '<span class="fx-mark" aria-hidden="true"><span>F</span>' + ochreDot + '</span>'; }

  /** The place modal used by Home and Saved. */
  function placeModal(destId, placeId, o) {
    o = o || {};
    const p = FT.place(destId, placeId);
    const d = FT.dest(destId);
    if (!p) return;
    const areaName = ((d.areas || []).find((a) => a.id === p.area) || {}).name;
    let reviewCount = Number.isFinite(Number(p.reviewsCount)) ? Number(p.reviewsCount) : (typeof p.reviews === 'number' ? p.reviews : null);
    let rating = p.ratingSource && p.rating ? '★ ' + p.rating + (reviewCount ? ' (' + reviewCount.toLocaleString('en-US') + ' reviews)' : '') + ' · ' + p.ratingSource : '';
    let photos = (Array.isArray(p.photos) ? p.photos : []).filter((photo) => photo && safeWebUrl(photo.url) && safeWebUrl(photo.sourceUrl) && String(photo.attribution || '').trim());
    let photoHtml = photos.length ? '<div class="fx-pm__photos">' + photos.map((photo) => '<figure><img src="' + esc(safeWebUrl(photo.url)) + '" alt="' + esc(photo.alt || p.name) + '" loading="lazy" referrerpolicy="no-referrer">' + (photo.attribution || photo.sourceUrl ? '<figcaption>' + esc(photo.attribution || 'Photo source') + (safeWebUrl(photo.sourceUrl) ? ' · <a href="' + esc(safeWebUrl(photo.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">Source</a>' : '') + '</figcaption>' : '') + '</figure>').join('') + '</div>' : '';
    const target = o.tripId ? store.trip(o.tripId) : sortedTrips().find((t) => t.destId === destId);
    const renderBody = () =>
      '<div class="fx-pm">' + photoHtml + '<div class="fx-pm__plate">' + placePlate(p) + '</div><div class="fx-pm__info">' +
      '<p class="fx-pm__label">' + esc([p.label, areaName, d.name].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' · ')) + '</p>' +
      (rating ? '<p class="fx-pm__rating">' + esc(rating) + (p.price ? ' · reference price ' + esc(money(p.price, d.currency)) + '/night' : '') + '</p>' : (p.price ? '<p class="fx-pm__rating">Reference price · ' + esc(money(p.price, d.currency)) + '/night · verify with the venue.</p>' : '')) +
      '<p class="fx-pm__blurb">' + esc(p.blurb || '') + '</p>' + (p.rating && !p.ratingSource ? '<p class="fx-hint">Reference guide · verify with the venue.</p>' : '') + (p.address ? '<p class="fx-pm__address">' + esc(p.address) + '</p>' : '') + (Array.isArray(p.openingHours) && p.openingHours.length ? '<div class="fx-pm__hours"><strong>Opening hours</strong><p>' + esc(p.openingHours.join(' · ')) + '</p></div>' : (typeof p.openingHours === 'string' && p.openingHours ? '<div class="fx-pm__hours"><strong>Opening hours</strong><p>' + esc(p.openingHours) + '</p></div>' : '')) + (safeWebUrl(p.url) ? '<a class="fx-link" href="' + esc(safeWebUrl(p.url)) + '" target="_blank" rel="noopener noreferrer">Visit website</a>' : '') + '</div></div>';
    const body = renderBody();
    const actions = [
      { label: FT.saved.has(destId, placeId) ? 'Saved' : 'Save', onClick: (close, btn) => { const now = FT.saved.toggle(destId, placeId); btn.textContent = now ? 'Saved' : 'Save'; } },
    ];
    if (target) {
      actions.push({
        label: 'Add to ' + (target.title.length > 26 ? target.title.slice(0, 25) + '…' : target.title), primary: true,
        onClick: (close) => { FT.plan.addItem(target.id, null, placeId); close(); toast('Added to ' + target.title); router.go('#/trip/' + target.id); },
      });
    }
    const closeModal = modal({ title: p.name, body, actions, className: 'fx-modal--place' });
    if (p.googlePlaceId && FT.backend && FT.backend.placeDetail) {
      FT.backend.placeDetail(p.googlePlaceId).then((fresh) => {
        if (!fresh || !fresh.place) return;
        Object.assign(p, fresh.place, { googlePlaceId: p.googlePlaceId, ratingSource: fresh.attribution || 'Google Places' });
        reviewCount = Number.isFinite(Number(p.reviewsCount)) ? Number(p.reviewsCount) : (typeof p.reviews === 'number' ? p.reviews : null);
        rating = p.ratingSource && p.rating ? '★ ' + p.rating + (reviewCount ? ' (' + reviewCount.toLocaleString('en-US') + ' reviews)' : '') + ' · ' + p.ratingSource : '';
        photos = (Array.isArray(p.photos) ? p.photos : []).filter((photo) => photo && safeWebUrl(photo.url) && safeWebUrl(photo.sourceUrl) && String(photo.attribution || '').trim());
        photoHtml = photos.length ? '<div class="fx-pm__photos">' + photos.map((photo) => '<figure><img src="' + esc(safeWebUrl(photo.url)) + '" alt="' + esc(photo.alt || p.name) + '" loading="lazy" referrerpolicy="no-referrer">' + (photo.attribution || photo.sourceUrl ? '<figcaption>' + esc(photo.attribution || 'Photo source') + (safeWebUrl(photo.sourceUrl) ? ' · <a href="' + esc(safeWebUrl(photo.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">Source</a>' : '') + '</figcaption>' : '') + '</figure>').join('') + '</div>' : '';
        const catalog = FT.DESTINATIONS && FT.DESTINATIONS[destId]; if (catalog && catalog.places) catalog.places[placeId] = Object.assign({}, catalog.places[placeId], p);
        if (closeModal.el && closeModal.el.isConnected) { const content = $('.fx-modal__body', closeModal.el); if (content) content.innerHTML = renderBody(); }
      }).catch(() => { /* Keep the saved details visible when a live refresh is unavailable. */ });
    }
  }
  FT.placeModal = placeModal;

  function homeCityModal() {
    const p = state.prefs;
    const body = doc.createElement('div');
    body.className = 'fx-form';
    body.innerHTML =
      '<div class="fx-field"><label class="fx-label" for="hc-city">Home city</label><input class="fx-input" id="hc-city" maxlength="60" autocomplete="off" value="' + esc(p.homeCity) + '" placeholder="Enter a city"></div>' +
      '<div class="fx-field"><label class="fx-label" for="hc-air">Airports</label><input class="fx-input" id="hc-air" maxlength="40" autocomplete="off" value="' + esc((p.airports || []).join(', ')) + '" placeholder="BOM, PNQ">' +
      '<p class="fx-hint">Three-letter IATA codes, separated by commas.</p></div><p class="fx-error" role="alert" hidden></p>';
    const city = $('#hc-city', body);
    const air = $('#hc-air', body);
    const err = $('.fx-error', body);
    air.addEventListener('input', () => { const s = air.selectionStart; air.value = air.value.toUpperCase(); try { air.setSelectionRange(s, s); } catch (e) { /* ignore */ } });
    modal({
      title: 'Home city',
      body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true,
          onClick: (close) => {
            const c = city.value.trim();
            const codes = air.value.split(/[,\s]+/).filter(Boolean).map((x) => x.toUpperCase());
            const fail = (m, f) => { err.textContent = m; err.hidden = false; f.focus(); };
            if (!c) return fail('Add your home city.', city);
            if (codes.some((x) => !/^[A-Z]{3}$/.test(x))) return fail('Airport codes are three letters, separated by commas, for example BOM, PNQ.', air);
            store.update((s) => {
              s.prefs.homeCity = c;
              s.prefs.airports = codes.filter((x, i, a) => a.indexOf(x) === i);
              s.notifications.forEach((n) => { if (n.kind === 'home-city') n.done = true; });
            });
            close();
            toast('Home city saved');
          },
        },
      ],
    });
  }
  FT.homeCityModal = homeCityModal;

  function pageHead(title, right) {
    return '<div class="fx-pagehead"><h1 class="fx-h1">' + esc(title) + '</h1>' + (right || '') + '</div>';
  }

  /* ======================================================================
     page: New trip (also Home when there are no trips)
     ====================================================================== */

  pages.new = {
    render() {
      const el = pageEl('new');
      const requestedDestination = new URLSearchParams(location.search || '').get('destination');
      const presetDestination = requestedDestination && FT.dest(requestedDestination);
      const starterText = presetDestination ? (presetDestination.prompt || 'Plan a trip to ' + presetDestination.name) : '';
      const remembered = FT.memoryContext ? FT.memoryContext.list(state) : [];
      const showMemory = remembered.length > 0;
      const renderMemory = () => showMemory ? '<details class="fx-new__memory"><summary><span data-memory-count>Using ' + remembered.length + ' saved travel ' + (remembered.length === 1 ? 'detail' : 'details') + '</span><span class="fx-new__memory-review">Review</span></summary><div class="fx-new__memory-content"><p class="fx-hint">Choose what to use for this trip. Selected details go to Friday’s planner and, if you request a quote, the travel designer.</p>' + remembered.map((item) => '<div class="fx-new__memory-row"><label><input type="checkbox" data-memory-pick="' + esc(item.key) + '" checked><span><strong>' + esc(item.label) + '</strong><br>' + esc(item.text) + '</span></label>' + (item.source === 'memory' ? '<div class="fx-integration-actions"><button class="fx-btn fx-btn--line" type="button" data-memory-edit="' + esc(item.id) + '">Edit</button><button class="fx-btn fx-btn--line" type="button" data-memory-remove="' + esc(item.id) + '">Remove</button></div>' : '') + '</div>').join('') + '<button class="fx-btn fx-btn--line" type="button" data-open-prefs>Edit travel preferences</button></div></details>' : '';
      el.innerHTML =
        '<div class="fx-new"><div class="fx-new__in">' +
        '<p class="fx-new__eyebrow">Your travel designer</p>' +
        '<h1 class="fx-new__title"><span>Where would you like</span><span>your <em>next Friday</em></span><span>to take you?</span></h1>' +
        '<form class="fx-prompt" data-prompt novalidate>' +
        '<div class="fx-prompt__chips" data-chips></div>' +
        '<label class="sr" for="fx-prompt-ta">Describe your trip</label>' +
        '<textarea class="fx-prompt__ta" id="fx-prompt-ta" rows="2" placeholder="Tell Friday where you’d like to go, or paste a reel link…" maxlength="1200">' + esc(starterText) + '</textarea>' +
        '<div class="fx-prompt__row">' +
        '<button class="fx-icon-btn" type="button" data-act="attach" aria-label="Attach an image" title="Attach an image">' + icon('image', 18) + '</button>' +
        '<input type="file" accept="image/*" multiple hidden data-file>' +
        '<span class="fx-prompt__sp"></span>' +
        '<button class="fx-icon-btn" type="button" data-act="mic" aria-label="Voice input" title="Voice input">' + icon('mic', 18) + '</button>' +
        '<button class="fx-send" type="submit" disabled aria-label="Start planning">' + icon('arrow-right', 18) + '</button>' +
        '</div></form>' +
        '<p class="fx-new__helper">Start with a place, a feeling, an idea, or a reel link.</p>' +
        '<div class="fx-new__suggestions" aria-label="Ideas to get started">' +
        ['A quiet weekend', 'Somewhere by the sea', 'Art, food & culture'].map((s) => '<button class="fx-new__suggestion" type="button" data-suggestion="' + esc(s) + '">' + esc(s) + '</button>').join('') +
        '</div>' + renderMemory() +
        '</div></div>';
      if (showMemory) {
        delegate(el, 'change', '[data-memory-pick]', () => {
          const count = el.querySelectorAll('[data-memory-pick]:checked').length;
          const label = $('[data-memory-count]', el);
          if (label) label.textContent = count ? 'Using ' + count + ' saved travel ' + (count === 1 ? 'detail' : 'details') : 'No saved travel details selected';
        });
        delegate(el, 'click', '[data-memory-edit]', async (e, button) => {
          const item = (state.memory || []).find((memory) => memory.id === button.dataset.memoryEdit);
          if (item && FT.integrations && FT.integrations.editMemory) { await FT.integrations.editMemory(item); pages.new.render(); }
        });
        delegate(el, 'click', '[data-memory-remove]', async (e, button) => {
          const item = (state.memory || []).find((memory) => memory.id === button.dataset.memoryRemove);
          if (item && await FT.ui.confirm('Remove this memory from Friday?', { title: 'Remove memory', okLabel: 'Remove', danger: true })) {
            store.update((s) => { s.memory = s.memory.filter((memory) => memory.id !== item.id); });
            pages.new.render();
          }
        });
        delegate(el, 'click', '[data-open-prefs]', () => router.go('#/preferences'));
      }
      wirePrompt(el, remembered, showMemory);
      if (!isNarrow()) { const ta = $('.fx-prompt__ta', el); if (ta) safeFocus(ta); }
    },
  };

  function wirePrompt(root, rememberedItems, memoryShown) {
    const form = $('[data-prompt]', root);
    const ta = $('.fx-prompt__ta', form);
    const send = $('.fx-send', form);
    const chips = $('[data-chips]', form);
    const suggestions = $('.fx-new__suggestions', root);
    const file = $('[data-file]', form);
    let atts = [];
    let rec = null;

    const sync = () => {
      send.disabled = !ta.value.trim();
      ta.style.height = 'auto';
      ta.style.height = clamp(ta.scrollHeight, 56, 220) + 'px';
    };
    const drawChips = () => {
      chips.innerHTML = atts.map((a, i) => '<span class="fx-attach"><img alt="" src="' + a.url + '"><span>' + esc(a.name) + '</span><button type="button" data-rm="' + i + '" aria-label="Remove ' + esc(a.name) + '">' + icon('x', 12) + '</button></span>').join('');
      chips.hidden = !atts.length;
    };
    drawChips();
    ta.addEventListener('input', sync);
    if (suggestions) delegate(suggestions, 'click', '[data-suggestion]', (e, b) => {
      ta.value = b.dataset.suggestion;
      sync();
      safeFocus(ta);
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit(); }
    });
    delegate(chips, 'click', '[data-rm]', (e, b) => { const [a] = atts.splice(+b.dataset.rm, 1); if (a) URL.revokeObjectURL(a.url); drawChips(); });
    file.addEventListener('change', () => {
      Array.from(file.files || []).slice(0, 6 - atts.length).forEach((f) => { if (/^image\//.test(f.type)) atts.push({ name: f.name, url: URL.createObjectURL(f) }); });
      file.value = '';
      drawChips();
    });
    delegate(form, 'click', '[data-act]', (e, b) => {
      const act = b.dataset.act;
      if (act === 'attach') file.click();
      else if (act === 'mic') {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { toast('Voice input isn’t supported in this browser'); return; }
        if (rec) { rec.stop(); return; }
        try {
          rec = new SR();
          rec.lang = 'en-US';
          rec.interimResults = false;
          rec.onresult = (ev) => { const tx = Array.from(ev.results).map((r) => r[0].transcript).join(' '); ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + tx; sync(); };
          rec.onend = () => { rec = null; b.classList.remove('is-listening'); };
          rec.onerror = () => { rec = null; b.classList.remove('is-listening'); toast('Voice input stopped'); };
          rec.start();
          b.classList.add('is-listening');
        } catch (err) { rec = null; toast('Voice input isn’t supported in this browser'); }
      }
    });
    delegate(root, 'click', '.fx-photo', (e, b) => {
      const d = FT.dest(b.dataset.dest);
      ta.value = (d && d.prompt) || 'Plan a trip to ' + (d ? d.name : 'somewhere');
      sync();
      submit();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

    function submit() {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      const selected = Array.from(root.querySelectorAll('[data-memory-pick]:checked')).map((box) => rememberedItems.find((item) => item.key === box.dataset.memoryPick)).filter(Boolean);
      const applied = selected.map((item) => ({ label: item.label, text: item.text }));
      const planningText = FT.memoryContext ? FT.memoryContext.apply(text, applied) : text;
      const payload = { text: planningText, attachments: atts.map((a) => ({ name: a.name })) };
      const returning = state.trips.length > 0;
      const requestedDestination = new URLSearchParams(location.search || '').get('destination');
      const presetDestination = requestedDestination && FT.dest(requestedDestination);
      const trip = FT.trips.create(presetDestination ? { destId: presetDestination.id } : undefined);
      store.update((s) => { const created = s.trips.find((item) => item.id === trip.id); if (created) created.rememberedPreferences = applied; });
      if (FT.backend && FT.backend.user && FT.tripAnalytics && typeof FT.tripAnalytics.trackCreated === 'function') FT.tripAnalytics.trackCreated({ returning: returning, memory_shown: !!memoryShown, memory_applied_count: applied.length });
      router.go('#/trip/' + trip.id);
      if (FT.chat && typeof FT.chat.send === 'function') {
        try { FT.chat.send(payload); } catch (err) { console.error(err); toast('The assistant hit a snag.'); }
      } else {
        if (FT.workspace && typeof FT.workspace.setComposer === 'function') FT.workspace.setComposer(text);
        toast('The assistant isn’t available in this build.');
      }
    }
    sync();
  }

  /* ======================================================================
     page: Home
     ====================================================================== */

  let recentAll = false;

  const stayFor = (t) => {
    const d = FT.dest(t.destId);
    const range = tripRange(t);
    const nights = range && range.end !== range.start ? diffDays(range.start, range.end) : t.plan ? Math.max(1, t.plan.days.length - 1) : 1;
    const booked = FT.bookings.forTrip(t.id).find((b) => b.type === 'hotel');
    if (booked) {
      const n = booked.start && booked.end ? Math.max(1, diffDays(booked.start, booked.end)) : nights;
      const bp = booked.placeId ? FT.place(booked.destId || t.destId, booked.placeId) : null;
      return {
        name: booked.name, plate: bp || { id: 'bk-' + booked.name, scene: d && d.scene, tone: d && d.tone },
        price: booked.price != null ? money(booked.price, booked.currency || (d && d.currency)) : '', per: 'for ' + n + ' night' + (n === 1 ? '' : 's'),
        dates: booked.start ? fmtRange(booked.start, booked.end).replace(/, \d{4}$/, '').replace(/^(\w+) (\d+) – (\d+)$/, '$1 $2–$3') : '',
      };
    }
    const sp = t.plan && t.plan.stay ? FT.place(t.destId, t.plan.stay) : null;
    if (sp) {
      return {
        name: sp.name, plate: sp, price: sp.price ? money(sp.price * nights, d && d.currency) : '', per: sp.price ? 'for ' + nights + ' night' + (nights === 1 ? '' : 's') : (sp.label || ''),
        dates: range ? fmtRange(range.start, range.end).replace(/, \d{4}$/, '').replace(/^(\w+) (\d+) – (\d+)$/, '$1 $2–$3') : '',
      };
    }
    return null;
  };

  pages.home = {
    render() {
      if (!state.trips.length) { pages.new.render(); return; }
      const el = pageEl('home');
      const rail0 = $('.fx-rail', el);
      const railLeft = rail0 ? rail0.scrollLeft : 0;

      const now = today();
      const upcoming = state.trips.map((t) => ({ t, r: tripRange(t) })).filter((x) => x.r && x.r.end >= now).sort((a, b) => a.r.start.localeCompare(b.r.start))[0];
      const trip = upcoming ? upcoming.t : sortedTrips()[0];
      const range = tripRange(trip);
      const d = FT.dest(trip.destId);
      let pill = 'No dates yet';
      if (range) {
        const days = diffDays(now, range.start);
        pill = range.end < now ? 'Completed' : days <= 0 ? 'Under way' : days < 7 ? 'In ' + days + ' day' + (days === 1 ? '' : 's') : 'In ' + weeksUntil(range.start) + ' weeks';
      }
      const stay = stayFor(trip);

      // Continue exploring: places from the trip's destination, starting with the stay's area.
      const exTrip = d ? trip : sortedTrips().find((t) => FT.dest(t.destId)) || null;
      const exDest = exTrip ? FT.dest(exTrip.destId) : null;
      let exHtml = '';
      if (exDest && exDest.places) {
        const sp = exTrip.plan && exTrip.plan.stay ? FT.place(exTrip.destId, exTrip.plan.stay) : null;
        const firstArea = sp ? sp.area : exTrip.plan && exTrip.plan.days[0] ? exTrip.plan.days[0].area : null;
        const areaObj = (exDest.areas || []).find((a) => a.id === firstArea);
        const ids = Object.keys(exDest.places);
        ids.sort((a, b) => (exDest.places[b].area === firstArea) - (exDest.places[a].area === firstArea));
        const cards = ids.slice(0, 16).map((id) => {
          const p = Object.assign({ id }, exDest.places[id]);
          return '<button class="fx-pcard" type="button" data-place="' + esc(id) + '" data-dest="' + esc(exTrip.destId) + '">' + placePlate(p) + '<span class="fx-pcard__name">' + esc(p.name) + '</span><span class="fx-pcard__label">' + esc(p.label || '') + '</span></button>';
        }).join('');
        exHtml =
          '<hr class="fx-hr"><section class="fx-section" aria-labelledby="fx-ex-h"><div class="fx-section__head"><h2 class="fx-h2" id="fx-ex-h">Continue exploring ' + esc(areaObj ? areaObj.name : exDest.name) + '</h2>' +
          '<div class="fx-rail-nav"><button class="fx-icon-btn fx-icon-btn--box" type="button" data-rail="-1" aria-label="Previous places">' + icon('chevron-left', 16) + '</button><button class="fx-icon-btn fx-icon-btn--box" type="button" data-rail="1" aria-label="Next places">' + icon('chevron-right', 16) + '</button></div></div>' +
          '<div class="fx-rail" tabindex="-1">' + cards + '</div></section>';
      }

      // Recent conversations.
      const rows = [];
      state.trips.forEach((t) => t.threads.forEach((th) => { if (th.messages && th.messages.length) rows.push({ t, th, at: t.activeThreadId === th.id ? t.updatedAt : th.createdAt }); }));
      rows.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      const shown = recentAll ? rows : rows.slice(0, 3);
      const recentHtml = rows.length
        ? '<hr class="fx-hr"><section class="fx-section" aria-labelledby="fx-rc-h"><div class="fx-section__head"><h2 class="fx-h2" id="fx-rc-h">Recent</h2>' +
          (rows.length > 3 ? '<button class="fx-link" type="button" data-act="recent-all">' + (recentAll ? 'Show less' : 'View all') + ' ' + icon('arrow-right', 14) + '</button>' : '') + '</div>' +
          '<ul class="fx-recent">' + shown.map((r) => '<li><button class="fx-recent__row" type="button" data-trip="' + esc(r.t.id) + '" data-thread="' + esc(r.th.id) + '"><span class="fx-recent__ic">' + icon('message', 22) + '</span><span class="fx-recent__tx"><span class="fx-recent__t">' + esc(r.th.title || 'Conversation') + '<em>' + esc(timeAgo(r.at)) + '</em></span><span class="fx-recent__s">' + esc(r.t.title) + '</span></span></button></li>').join('') + '</ul></section>'
        : '';

      el.innerHTML =
        '<div class="fx-wrap"><div class="fx-section__head"><h1 class="fx-h1">Upcoming</h1><a class="fx-btn fx-btn--line" href="#/new">New trip</a></div><div class="fx-upcoming">' +
        '<button class="fx-cover" type="button" data-trip="' + esc(trip.id) + '" aria-label="Open ' + esc(trip.title) + '">' +
        plateHtml('cover-' + trip.id, { scene: d && d.scene, tone: d && d.tone }, 'landscape', 'plate--fill') +
        '<span class="fx-cover__scrim"></span><span class="fx-cover__body"><span class="fx-cover__title">' + esc(trip.title) + '</span><span class="fx-cover__dates">' + esc(range ? tripRangeLabel(trip) : '') + '</span><span class="fx-pill">' + esc(pill) + '</span></span></button>' +
        (stay
          ? '<div class="fx-stay fx-card"><div class="fx-stay__thumb">' + placePlate(stay.plate) + '</div><div class="fx-stay__b"><p class="fx-stay__name">' + esc(stay.name) + '</p>' +
            (stay.price ? '<p class="fx-stay__price"><b>' + esc(stay.price) + '</b> ' + esc(stay.per) + '</p>' : '<p class="fx-stay__price">' + esc(stay.per) + '</p>') + '</div>' +
            (stay.dates ? '<span class="fx-stay__dates">' + esc(stay.dates) + '</span>' : '') + '</div>'
          : '<button class="fx-stay fx-stay--empty" type="button" data-trip="' + esc(trip.id) + '"><span>No stay booked yet — ask Friday to add hotels</span></button>') +
        '</div>' + exHtml + recentHtml + '</div>';

      const rail = $('.fx-rail', el);
      if (rail) {
        rail.scrollLeft = railLeft;
        const prev = $('[data-rail="-1"]', el);
        const next = $('[data-rail="1"]', el);
        const upd = () => { prev.disabled = rail.scrollLeft <= 2; next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2; };
        rail.addEventListener('scroll', upd, { passive: true });
        [prev, next].forEach((b) => b.addEventListener('click', () => {
          const c = rail.firstElementChild;
          const step = c ? c.getBoundingClientRect().width + 16 : 200;
          rail.scrollBy({ left: +b.dataset.rail * step, behavior: reducedMotion() ? 'auto' : 'smooth' });
        }));
        requestAnimationFrame(upd);
        pages.home.upd = upd;
      }
    },
  };

  function wireHome() {
    const el = pageEl('home');
    delegate(el, 'click', '[data-place]', (e, b) => placeModal(b.dataset.dest, b.dataset.place, {}));
    delegate(el, 'click', '[data-trip]', (e, b) => {
      const id = b.dataset.trip;
      if (b.dataset.thread) store.update((s) => { const t = s.trips.find((x) => x.id === id); if (t) t.activeThreadId = b.dataset.thread; });
      router.go('#/trip/' + id);
    });
    delegate(el, 'click', '[data-act="recent-all"]', () => { recentAll = !recentAll; pages.home.render(); });
    window.addEventListener('resize', () => { if (pages.home.upd && route.name === 'home') pages.home.upd(); });
  }

  /* ======================================================================
     page: Bookings
     ====================================================================== */

  const SUITCASE = '<svg class="fx-empty__art" viewBox="0 0 160 160" width="150" height="150" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<g stroke="#15140F" stroke-width="2"><rect x="34" y="64" width="92" height="70" rx="9"/><path d="M62 64V52a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v12"/><path d="M60 64v70M100 64v70"/><path d="M46 134v6M114 134v6"/></g>' +
    '<g stroke="#B0552D" stroke-width="2"><circle cx="80" cy="99" r="14"/><path d="M87 92l-4.500 12.500L72 108l4.500-12.500z"/><path d="M126 30v16M118 38h16"/><path d="M40 40l5 5M45 40l-5 5"/></g></svg>';

  pages.bookings = {
    render() {
      const el = pageEl('bookings');
      const list = state.bookings.slice();
      const add = '<div class="fx-pagehead__actions"><button class="fx-btn fx-btn--line" type="button" data-act="gmail-bookings">Connect email</button><button class="fx-btn fx-btn--ink" type="button" data-act="add-booking">' + icon('plus', 16) + '<span>Add booking</span></button></div>';
      const emailCard = '<section class="fx-bk-email fx-card" data-email-bookings><div><p class="fx-eyebrow">Your confirmations</p><h2 class="fx-h2">Bring bookings into Friday</h2><p class="fx-muted" data-email-status>Checking Gmail connection…</p></div><div class="fx-bk-email__actions"><button class="fx-btn fx-btn--line" type="button" data-act="gmail-bookings">Manage Gmail</button><button class="fx-btn fx-btn--ink" type="button" data-act="plan-bookings">Plan around bookings</button></div></section>';
      if (!list.length) {
        el.innerHTML = '<div class="fx-wrap">' + pageHead('Bookings', add) +
          emailCard + '<div class="fx-empty">' + SUITCASE + '<h2 class="fx-empty__t">No bookings found</h2><p class="fx-empty__d">Connect Gmail to find travel confirmations, or add flights, stays and reservations by hand.</p>' +
          '<button class="fx-btn fx-btn--ink" type="button" data-act="add-booking">Add a booking</button></div></div>';
        renderGmailStatus(el);
        return;
      }
      const groups = sortedTrips().map((t) => ({ t, items: list.filter((b) => b.tripId === t.id) })).filter((g) => g.items.length);
      const loose = list.filter((b) => !b.tripId || !store.trip(b.tripId));
      if (loose.length) groups.push({ t: null, items: loose });
      el.innerHTML = '<div class="fx-wrap">' + pageHead('Bookings', add) + emailCard + renderBookingPlanTools(list) + groups.map((g) =>
        '<section class="fx-bk-group"><div class="fx-bk-group__head"><h2 class="fx-h2">' + esc(g.t ? g.t.title : 'Not on a trip') + '</h2>' +
        (g.t ? '<span class="fx-muted">' + esc(tripRangeLabel(g.t)) + '</span><a class="fx-link" href="#/trip/' + esc(g.t.id) + '">Open trip ' + icon('arrow-right', 14) + '</a>' : '') + '</div>' +
        '<ul class="fx-bk-list fx-card">' + g.items.sort((a, b) => (a.start || '').localeCompare(b.start || '')).map((b) => {
          const meta = [b.start ? fmtRange(b.start, b.end) : '', b.flightNumber ? 'Flight ' + b.flightNumber : '', b.startTime || b.endTime ? [b.startTime, b.endTime].filter(Boolean).join('–') : '', b.address, b.ref ? 'Ref ' + b.ref : ''].filter(Boolean).join(' · ');
          return '<li class="fx-bk-row"><span class="fx-bk-row__ic">' + icon(typeIcon(b.type), 18) + '</span><div class="fx-bk-row__b"><p class="fx-bk-row__name">' + esc(b.name) + '</p><p class="fx-bk-row__meta">' + esc(((BOOKING_TYPES.find((x) => x.id === b.type) || {}).label || '') + (meta ? ' · ' + meta : '')) + '</p></div>' +
            '<span class="fx-bk-row__price">' + esc(b.price != null ? money(b.price, b.currency) : '') + '</span>' +
            '<label class="fx-bk-select"><input type="checkbox" data-plan-booking="' + esc(b.serverId || b.id) + '" aria-label="Use ' + esc(b.name) + ' to plan"></label><button class="fx-icon-btn" type="button" data-del="' + esc(b.id) + '" aria-label="Delete booking ' + esc(b.name) + '">' + icon('trash', 16) + '</button></li>';
        }).join('') + '</ul></section>').join('') + '</div>';
      renderGmailStatus(el);
    },
  };
  function renderBookingPlanTools(list) {
    const trips = sortedTrips();
    const options = trips.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.title || 'Untitled trip') + '</option>').join('');
    return '<section class="fx-bk-plan" data-booking-plan><p class="fx-muted">Choose the confirmations Friday should consider. Nothing is attached to a trip unless you choose it here.</p><div class="fx-bk-plan__actions"><label class="fx-field fx-label">Attach selected to trip<select class="fx-input" data-booking-trip ' + (trips.length ? '' : 'disabled') + '><option value="">Choose a trip</option>' + options + '</select></label><button class="fx-btn fx-btn--line" type="button" data-act="attach-bookings" ' + (trips.length ? '' : 'disabled') + '>Attach selected</button><button class="fx-btn fx-btn--ink" type="button" data-act="plan-selected">Plan with selected</button></div></section>';
  }
  function renderGmailStatus(el) {
    const status = el.querySelector('[data-email-status]');
    if (!status) return;
    const controls = Array.from(el.querySelectorAll('[data-act="gmail-bookings"]'));
    function setControls(label, disabled) { controls.forEach((button) => { button.textContent = label; button.disabled = !!disabled; }); }
    if (!FT.integrations || !FT.integrations.connectionStatus) { status.textContent = 'Email connection isn’t available yet.'; setControls('Email unavailable', true); return; }
    FT.integrations.connectionStatus().then((data) => {
      const gmail = (data.connections || []).find((x) => x.kind === 'gmail');
      if (!data.configured) { status.textContent = 'Email connection isn’t available yet. You can still add bookings by hand.'; setControls('Email unavailable', true); return; }
      status.textContent = gmail ? 'Gmail is connected with read-only access. Sync confirmations from Manage Gmail.' : 'Connect Gmail with read-only access to find upcoming travel confirmations.';
      setControls(gmail ? 'Manage Gmail' : 'Connect Gmail', false);
    }).catch((err) => {
      if (!FT.backend || !FT.backend.user || err && err.status === 401) { status.textContent = 'Sign in to connect email and manage private booking confirmations.'; setControls('Sign in to connect', false); }
      else { status.textContent = 'Email connection isn’t available yet. Try again later.'; setControls('Email unavailable', true); }
    });
  }
  function wireBookings() {
    const el = pageEl('bookings');
    delegate(el, 'click', '[data-act="add-booking"]', () => openBookingForm());
    delegate(el, 'click', '[data-act="gmail-bookings"]', () => { if (FT.integrations) FT.integrations.openConnections({ onChange: () => pages.bookings.render() }); });
    delegate(el, 'click', '[data-act="plan-bookings"]', () => { if (FT.integrations) FT.integrations.openFridayPlan({}); });
    delegate(el, 'click', '[data-act="plan-selected"]', () => {
      const ids = Array.from(el.querySelectorAll('[data-plan-booking]:checked')).map((x) => x.dataset.planBooking);
      if (!ids.length) { toast('Choose the bookings Friday should consider first.'); return; }
      if (FT.integrations) FT.integrations.openFridayPlan({ answers: { bookingIds: ids } });
    });
    delegate(el, 'click', '[data-act="attach-bookings"]', () => {
      const ids = Array.from(el.querySelectorAll('[data-plan-booking]:checked')).map((x) => x.dataset.planBooking);
      const tripId = el.querySelector('[data-booking-trip]') && el.querySelector('[data-booking-trip]').value;
      if (!ids.length || !tripId) { toast('Choose bookings and a trip to attach them.'); return; }
      const trip = state.trips.find((x) => x.id === tripId);
      if (!trip) return;
      ids.forEach((id) => { const booking = state.bookings.find((x) => (x.serverId || x.id) === id); if (booking) FT.bookings.update ? FT.bookings.update(id, { tripId: trip.id }) : (booking.tripId = trip.id); });
      toast('Selected bookings attached to ' + (trip.title || 'your trip'));
      pages.bookings.render();
    });
    delegate(el, 'click', '[data-del]', (e, b) => {
      const id = b.dataset.del;
      const bk = state.bookings.find((x) => x.id === id);
      confirmDlg('Delete “' + (bk ? bk.name : 'this booking') + '”?', { okLabel: 'Delete', danger: true, title: 'Delete booking' }).then((ok) => { if (ok) { FT.bookings.remove(id); toast('Booking deleted'); } });
    });
  }

  /* ======================================================================
     page: Saved
     ====================================================================== */

  let savedFilter = 'all';
  let savedQuery = '';

  const savedBody = () => {
    const q = savedQuery.trim().toLowerCase();
    const places = state.saved.map((x) => ({ x, p: FT.place(x.destId, x.placeId), d: FT.dest(x.destId) })).filter((r) => r.p && r.d)
      .filter((r) => savedFilter === 'all' || r.x.listId === savedFilter)
      .filter((r) => !q || [r.p.name, r.p.label, r.p.kind, r.d.name, r.p.blurb].join(' ').toLowerCase().includes(q));
    const imports = savedFilter === 'all' ? state.imports.filter((i) => !q || (i.url + ' ' + (i.note || '')).toLowerCase().includes(q)) : [];
    if (!places.length && !imports.length) {
      if (q || state.saved.length || state.imports.length) return '<p class="fx-none">' + (q ? 'Nothing matches “' + esc(savedQuery.trim()) + '”.' : 'Nothing in this list yet.') + '</p>';
      return '<div class="fx-empty fx-empty--saved"><h2 class="fx-empty__t">Nothing yet.</h2>' +
        '<p class="fx-empty__d">Save places from the map and plan, or keep links from TikTok or Instagram.</p><div class="fx-empty__act">' +
        '<button class="fx-btn fx-btn--line" type="button" data-act="import">Import a post</button><button class="fx-btn fx-btn--line" type="button" data-act="new-list">New list</button></div></div>';
    }
    return '<div class="fx-grid">' +
      places.map((r) => '<article class="fx-scard"><button class="fx-scard__open" type="button" data-open="' + esc(r.x.id) + '">' + placePlate(r.p) + '<span class="fx-scard__name">' + esc(r.p.name) + '</span><span class="fx-scard__label">' + esc(r.p.label || '') + ' · ' + esc(r.d.name) + '</span></button>' +
        '<button class="fx-icon-btn fx-icon-btn--float" type="button" data-card-menu="' + esc(r.x.id) + '" aria-haspopup="menu" aria-label="Actions for ' + esc(r.p.name) + '">' + icon('dots', 18) + '</button></article>').join('') +
      imports.map((i) => {
        let host = i.url;
        try { host = new URL(i.url).hostname.replace(/^www\./, ''); } catch (e) { /* keep raw */ }
        return '<article class="fx-scard fx-scard--link fx-card"><a class="fx-scard__link" href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer"><span class="fx-scard__ic">' + icon('link', 20) + '</span><span class="fx-scard__name">' + esc(host) + '</span><span class="fx-scard__label">' + esc(i.note || i.url) + '</span></a><button class="fx-btn fx-btn--line" type="button" data-plan-saved-reel="' + esc(i.id) + '">Plan from this reel</button>' +
          '<button class="fx-icon-btn fx-icon-btn--float" type="button" data-rm-import="' + esc(i.id) + '" aria-label="Remove link ' + esc(host) + '">' + icon('x', 16) + '</button></article>';
      }).join('') + '</div>';
  };

  pages.saved = {
    render() {
      const el = pageEl('saved');
      const focusSearch = doc.activeElement && doc.activeElement.id === 'fx-saved-q';
      if (savedFilter !== 'all' && !state.lists.some((l) => l.id === savedFilter)) savedFilter = 'all';
      const count = (id) => state.saved.filter((x) => x.listId === id).length;
      el.innerHTML = '<div class="fx-wrap">' +
        pageHead('Saved', '<button class="fx-icon-btn fx-icon-btn--round fx-icon-btn--ink" type="button" data-act="add-menu" aria-haspopup="menu" aria-label="Add" title="Add">' + icon('plus', 20) + '</button>') +
        '<label class="fx-search"><span class="sr">Search saved places</span>' + icon('search', 18) + '<input id="fx-saved-q" class="fx-input" type="search" placeholder="Search names, cities, or categories" value="' + esc(savedQuery) + '" autocomplete="off"></label>' +
        (state.lists.length ? '<div class="fx-chips" role="tablist" aria-label="Lists"><button class="fx-chip' + (savedFilter === 'all' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (savedFilter === 'all') + '" data-list="all">All</button>' +
          state.lists.map((l) => '<button class="fx-chip' + (savedFilter === l.id ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (savedFilter === l.id) + '" data-list="' + esc(l.id) + '">' + esc(l.name) + '<em>' + count(l.id) + '</em></button>').join('') +
          (savedFilter !== 'all' ? '<button class="fx-icon-btn" type="button" data-act="list-menu" aria-haspopup="menu" aria-label="List actions">' + icon('dots', 18) + '</button>' : '') + '</div>' : '') +
        '<div data-saved-body>' + savedBody() + '</div></div>';
      if (focusSearch) { const i = $('#fx-saved-q', el); i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* ignore */ } }
    },
  };

  function importModal() {
    const body = doc.createElement('div');
    body.className = 'fx-form';
    body.innerHTML = '<div class="fx-field"><label class="fx-label" for="im-url">Link</label><input class="fx-input" id="im-url" type="url" placeholder="https://www.instagram.com/p/…" autocomplete="off"></div>' +
      '<div class="fx-field"><label class="fx-label" for="im-note">Note</label><input class="fx-input" id="im-note" maxlength="160" placeholder="What caught your eye?" autocomplete="off"></div><p class="fx-error" role="alert" hidden></p>';
    modal({
      title: 'Import a post',
      body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save link', primary: true,
          onClick: (close) => {
            const raw = $('#im-url', body).value.trim();
            const err = $('.fx-error', body);
            let url = null;
            try { const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); if (/^https?:$/.test(u.protocol) && u.hostname.includes('.')) url = u.href; } catch (e) { url = null; }
            if (!raw || !url) { err.textContent = raw ? 'That doesn’t look like a web link.' : 'Paste the link to a post.'; err.hidden = false; $('#im-url', body).focus(); return; }
            const note = $('#im-note', body).value.trim();
            close();
            const saveImport = async (approved) => {
              store.update((s) => { s.imports.unshift({ id: uid('im'), url: approved.url || url, note: approved.note || note, at: new Date().toISOString() }); });
              if (FT.backend && FT.backend.savePlace) await Promise.all((approved.places || []).map((place) => FT.backend.savePlace(place)));
              toast((approved.places || []).length ? 'Link and selected places saved' : 'Link saved');
            };
            if (FT.integrations && FT.integrations.reviewImport && FT.backend && FT.backend.user) {
              FT.integrations.reviewImport(url, note, saveImport).catch(async (error) => {
                const yes = await confirmDlg((error.message || 'Post extraction is unavailable.') + ' Save the link without extracted places?', { okLabel: 'Save link', title: 'Keep this link?' });
                if (yes) saveImport({ url, note, places: [] });
              });
            } else saveImport({ url, note, places: [] });
          },
        },
      ],
    });
  }
  function newList() {
    return promptDlg('New list', { placeholder: 'e.g. Somewhere for New Year', okLabel: 'Create' }).then((name) => {
      if (!name) return;
      if (state.lists.some((l) => l.name.toLowerCase() === name.toLowerCase())) { toast('You already have a list called ' + name); return; }
      const id = uid('l');
      store.update((s) => { s.lists.push({ id, name: name.slice(0, 60) }); });
      toast('List created');
    });
  }

  function wireSaved() {
    const el = pageEl('saved');
    el.addEventListener('input', (e) => {
      if (e.target.id !== 'fx-saved-q') return;
      savedQuery = e.target.value;
      $('[data-saved-body]', el).innerHTML = savedBody();
    });
    delegate(el, 'click', '[data-list]', (e, b) => { savedFilter = b.dataset.list; pages.saved.render(); });
    delegate(el, 'click', '[data-plan-saved-reel]', (e, b) => { const item = state.imports.find((x) => x.id === b.dataset.planSavedReel); if (item && FT.reel) FT.reel.open({ url: item.url, caption: item.note || '' }); });
    delegate(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'import') importModal();
      else if (a === 'new-list') newList();
      else if (a === 'add-menu') menu(b, [{ label: 'New list', icon: 'list', onClick: newList }, { label: 'Import a post', icon: 'link', onClick: importModal }], { align: 'right' });
      else if (a === 'list-menu') {
        const l = state.lists.find((x) => x.id === savedFilter);
        if (!l) return;
        menu(b, [
          { label: 'Rename list', icon: 'edit', onClick: () => promptDlg('Rename list', { value: l.name }).then((v) => { if (v) { store.update((s) => { const x = s.lists.find((y) => y.id === l.id); if (x) x.name = v.slice(0, 60); }); } }) },
          { label: 'Delete list', icon: 'trash', danger: true, onClick: () => confirmDlg('Delete the list “' + l.name + '”? The places stay saved.', { okLabel: 'Delete', danger: true, title: 'Delete list' }).then((ok) => { if (ok) { store.update((s) => { s.lists = s.lists.filter((x) => x.id !== l.id); s.saved.forEach((x) => { if (x.listId === l.id) x.listId = null; }); }); savedFilter = 'all'; } }) },
        ], { align: 'right' });
      }
    });
    delegate(el, 'click', '[data-open]', (e, b) => {
      const x = state.saved.find((s) => s.id === b.dataset.open);
      if (x) placeModal(x.destId, x.placeId, {});
    });
    delegate(el, 'click', '[data-rm-import]', (e, b) => { store.update((s) => { s.imports = s.imports.filter((i) => i.id !== b.dataset.rmImport); }); toast('Link removed'); });
    delegate(el, 'click', '[data-card-menu]', (e, b) => {
      const x = state.saved.find((s) => s.id === b.dataset.cardMenu);
      if (!x) return;
      const matching = sortedTrips().filter((t) => t.destId === x.destId);
      const lists = [{ label: 'No list', check: !x.listId, onClick: () => moveTo(x.id, null) }].concat(state.lists.map((l) => ({ label: l.name, check: x.listId === l.id, onClick: () => moveTo(x.id, l.id) })));
      menu(b, [
        { label: 'Move to list', icon: 'list', items: lists },
        { label: 'Add to trip…', icon: 'plus', disabled: !matching.length, items: matching.map((t) => ({ label: t.title, onClick: () => { FT.plan.addItem(t.id, null, x.placeId); toast('Added to ' + t.title); } })) },
        'sep',
        { label: 'Remove', icon: 'trash', danger: true, onClick: () => FT.saved.toggle(x.destId, x.placeId) },
      ], { align: 'right' });
    });
  }
  function moveTo(id, listId) {
    store.update((s) => { const x = s.saved.find((y) => y.id === id); if (x) x.listId = listId; });
    const l = state.lists.find((y) => y.id === listId);
    toast(l ? 'Moved to ' + l.name : 'Removed from list');
  }

  /* ======================================================================
     page: Notifications
     ====================================================================== */

  pages.notifications = {
    render() {
      const el = pageEl('notifications');
      const list = state.notifications.slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      el.innerHTML = '<div class="fx-wrap">' + pageHead('Notifications', '<button class="fx-btn fx-btn--line" type="button" data-act="fare-watches">Manage fare watches</button>') +
        (list.length ? '<ul class="fx-notifs">' + list.map((n) => {
          const isHome = n.kind === 'home-city';
          const trip = n.tripId && store.trip(n.tripId);
          let act = '';
          if (n.done) act = '<span class="fx-notif__done">' + icon('check', 14) + ' Done</span>';
          else if (isHome) act = '<button class="fx-btn fx-btn--ink fx-btn--sm" type="button" data-act="home-city">Set home city</button>';
          else if (trip) act = '<button class="fx-btn fx-btn--ink fx-btn--sm" type="button" data-act="open-trip" data-id="' + esc(n.id) + '">Open trip</button>';
          const ago = timeAgo(n.at);
          return '<li class="fx-notif' + (n.done ? ' is-done' : '') + '"><span class="fx-notif__ic">' + icon(isHome ? 'pin' : 'sparkle', 18) + '</span><div class="fx-notif__b"><p class="fx-notif__t">' + esc(n.text) + '</p>' + (act ? '<div class="fx-notif__act">' + act + '</div>' : '') + '</div><span class="fx-notif__time">' + esc(ago === 'now' ? 'Just now' : ago ? ago + ' ago' : '') + '</span></li>';
        }).join('') + '</ul>' : '<div class="fx-empty"><h2 class="fx-empty__t">You’re all caught up.</h2><p class="fx-empty__d">Updates to your plans will show up here.</p></div>') + '</div>';
    },
  };
  function wireNotifs() {
    const el = pageEl('notifications');
    delegate(el, 'click', '[data-act="fare-watches"]', () => { if (FT.integrations) FT.integrations.openFareWatches(); });
    delegate(el, 'click', '[data-act="home-city"]', homeCityModal);
    delegate(el, 'click', '[data-act="open-trip"]', (e, b) => {
      const n = state.notifications.find((x) => x.id === b.dataset.id);
      if (!n) return;
      store.update((s) => { const x = s.notifications.find((y) => y.id === n.id); if (x) x.done = true; });
      if (store.trip(n.tripId)) router.go('#/trip/' + n.tripId);
    });
  }

  /* ======================================================================
     page: Preferences
     ====================================================================== */

  let prefsEditing = false;
  const PREF_ROWS = [
    ['airlines', 'Airlines', 'input', 'e.g. Air India, Vistara'],
    ['hotels', 'Hotels', 'input', 'e.g. Small owner-run hotels, no chains'],
    ['hotelBudget', 'Hotel budget', 'input', 'e.g. ₹15,000 to ₹25,000 a night'],
    ['business', 'Business travel', 'textarea', 'Lounge access, expense rules, preferred hours'],
    ['other', 'Other preferences', 'textarea', 'Anything else Friday should know'],
  ];

  pages.preferences = {
    render() {
      const el = pageEl('preferences');
      const p = state.prefs;
      const chips = (p.airports || []).map((a) => '<span class="fx-chip fx-chip--mono">' + esc(a) + '</span>').join('');
      const rows = PREF_ROWS.map(([k, label, kind, ph]) => {
        const v = p[k] || '';
        const field = prefsEditing
          ? (kind === 'textarea' ? '<textarea class="fx-input" name="' + k + '" rows="3" maxlength="400" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '">' + esc(v) + '</textarea>' : '<input class="fx-input" name="' + k + '" maxlength="160" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '" value="' + esc(v) + '">')
          : '<p class="fx-kv__v' + (v ? '' : ' is-empty') + '">' + (v ? esc(v) : 'Not set') + '</p>';
        return '<div class="fx-kv"><p class="fx-kv__k">' + esc(label) + '</p>' + field + '</div>';
      }).join('');
      const mem = state.memory.slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      el.innerHTML = '<div class="fx-wrap"><div class="fx-prefs"><aside class="fx-prefs__side"><h1 class="fx-h1">Your preferences</h1>' +
        '<p class="fx-prefs__line">' + icon('home', 18) + '<span>' + (p.homeCity ? esc(p.homeCity) : '<span class="fx-muted">No home city yet</span>') + '</span></p>' +
        '<p class="fx-prefs__line">' + icon('plane', 18) + (chips || '<span class="fx-muted">No airports yet</span>') + '</p>' +
        '<button class="fx-btn fx-btn--line" type="button" data-act="home-city">Edit</button></aside>' +
        '<div class="fx-prefs__main"><section aria-labelledby="fx-tp-h"><div class="fx-prefs__head"><h2 class="fx-h2" id="fx-tp-h">Travel preferences</h2>' +
        (prefsEditing ? '<div class="fx-prefs__btns"><button class="fx-btn fx-btn--line" type="button" data-act="cancel">Cancel</button><button class="fx-btn fx-btn--ink" type="button" data-act="save">Save</button></div>' : '<button class="fx-btn fx-btn--line" type="button" data-act="edit">Edit</button>') + '</div>' +
        '<div class="fx-card fx-kvs">' + rows + '</div></section>' +
        '<section aria-labelledby="fx-mem-h"><div class="fx-prefs__head"><h2 class="fx-h2" id="fx-mem-h">' + icon('users', 20) + ' Friday memory</h2><button class="fx-btn fx-btn--line" type="button" data-act="memory-manage">Manage memory</button></div><div class="fx-card fx-mem">' +
        (mem.length ? '<ul>' + mem.map((m) => '<li><span>' + esc(m.text) + '</span><button class="fx-icon-btn" type="button" data-mem="' + esc(m.id) + '" aria-label="Forget: ' + esc(m.text) + '">' + icon('x', 16) + '</button></li>').join('') + '</ul>' : '<p class="fx-mem__none">Add details you want Friday to remember.</p>') + '</div></section>' +
        '<section class="fx-account"><div class="fx-prefs__head"><h2 class="fx-h2">Connections</h2></div><p class="fx-hint">Connect Google services only when you choose.</p><button class="fx-btn fx-btn--line" type="button" data-act="connections">Manage connections</button></section>' +
        chatgptCard() +
        (FT.backend && FT.backend.user ? '<section class="fx-account"><p class="fx-eyebrow">Signed in</p><p>' + esc((FT.backend && FT.backend.user && (FT.backend.user.name || FT.backend.user.email)) || '') + '</p><button class="fx-btn fx-btn--line" type="button" data-act="signout">Sign out</button></section>' : '<section class="fx-account"><p class="fx-eyebrow">Local planner</p><p class="fx-hint">Your trips are saved in this browser. Auth is optional until the website is complete.</p><button class="fx-btn fx-btn--line" type="button" data-act="signin">Sign in or create account</button></section>') +
        '</div></div></div>';
    },
  };
  /* "Use your ChatGPT plan" (assets/js/trip-chatgpt.js). Shown only when the server has a Sign in with ChatGPT client id. */
  function chatgptCard() {
    const cg = FT.chatgpt;
    if (!cg || !cg.enabled()) return '';
    const acct = cg.connected() ? cg.account() : null;
    return '<section class="fx-account fx-chatgpt" aria-labelledby="fx-cg-h"><div class="fx-prefs__head"><h2 class="fx-h2" id="fx-cg-h">ChatGPT</h2>' +
      (acct ? '<button class="fx-btn fx-btn--line" type="button" data-act="chatgpt-disconnect">Disconnect</button>' : '<button class="fx-btn fx-btn--ink" type="button" data-act="chatgpt-connect">Connect ChatGPT</button>') + '</div>' +
      '<div class="fx-card fx-chatgpt__card">' +
      (acct ? '<p class="fx-chatgpt__who"><span class="fx-chatgpt__dot" aria-hidden="true"></span>Connected' + (acct.email ? ' as <strong>' + esc(acct.email) + '</strong>' : '') + '</p>' : '<p class="fx-chatgpt__who fx-muted">Not connected</p>') +
      '<p class="fx-hint">Uses your ChatGPT plan for trip planning; your sign-in stays in this browser.</p></div></section>';
  }
  function wirePrefs() {
    const el = pageEl('preferences');
    if (FT.chatgpt && FT.chatgpt.onChange) FT.chatgpt.onChange(() => { if (route.name === 'preferences' && !prefsEditing) pages.preferences.render(); });
    delegate(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'home-city') homeCityModal();
      else if (a === 'chatgpt-connect') {
        b.disabled = true;
        FT.chatgpt.connect().then(() => toast('ChatGPT connected'), (err) => { if (!err || err.code !== 'cancelled') toast('Could not connect ChatGPT'); }).then(() => { if (route.name === 'preferences' && !prefsEditing) pages.preferences.render(); });
      }
      else if (a === 'chatgpt-disconnect') { FT.chatgpt.disconnect(); toast('ChatGPT disconnected'); }
      else if (a === 'connections') { if (FT.integrations) FT.integrations.openConnections({ tripId: store.get().currentTripId }); }
      else if (a === 'memory-manage') { if (FT.integrations) FT.integrations.openMemories(); }
      else if (a === 'edit') { prefsEditing = true; pages.preferences.render(); const f = $('.fx-kvs .fx-input', el); if (f) f.focus(); }
      else if (a === 'cancel') { prefsEditing = false; pages.preferences.render(); }
      else if (a === 'save') {
        const vals = {};
        $$('.fx-kvs [name]', el).forEach((f) => { vals[f.name] = f.value.trim(); });
        const save = async () => {
          try {
            if (FT.backend && FT.backend.user) await FT.backend.saveProfile(vals);
            prefsEditing = false;
            store.update((s) => { Object.assign(s.prefs, vals); });
            pages.preferences.render();
            toast('Preferences saved');
          } catch (err) { toast(err.message || 'Could not save preferences'); }
        };
        save();
      } else if (a === 'signout') {
        confirmDlg('Sign out of Friday?', { okLabel: 'Sign out', title: 'Sign out' }).then(async (ok) => {
          if (!ok) return;
          try { await FT.backend.logout(); booted = false; authGate($('[data-main]')); } catch (err) { toast(err.message || 'Could not sign out'); }
        });
      } else if (a === 'signin') {
        authGate($('[data-main]'));
      }
    });
    delegate(el, 'click', '[data-mem]', (e, b) => { store.update((s) => { s.memory = s.memory.filter((m) => m.id !== b.dataset.mem); }); });
  }

  /* ======================================================================
     change handling + boot
     ====================================================================== */

  let rafPending = false;
  function onChange() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      renderSidebar(false);
      syncFrame();
      const name = route.name === 'home' && !state.trips.length ? 'new' : route.name;
      if (name === 'new' || name === 'trip') return; // the prompt keeps its draft; the workspace owns the trip page
      if (name === 'preferences' && prefsEditing) return;
      const pg = pages[name];
      if (pg) renderKeepingFocus(pg, name);
    });
  }

  /** Re-render a page, then put focus back on the equivalent control (same tag and data attributes). */
  function renderKeepingFocus(pg, name) {
    const el = pageEl(name);
    const a = doc.activeElement;
    const sig = a && el && el.contains(a) && a !== el ? focusSig(a) : null;
    pg.render();
    if (!sig || (doc.activeElement && el.contains(doc.activeElement))) return;
    safeFocus(findTwin(sig, el));
  }

  let booted = false;
  function authGate(main) {
    const old = $('[data-auth-gate]'); if (old) old.remove();
    const box = doc.createElement('section'); box.className = 'fx-auth'; box.dataset.authGate = 'true';
    box.innerHTML = '<div class="fx-auth__card"><p class="fx-eyebrow">Friday · Your journeys</p><h1 class="fx-auth__title">A place for the plans you carry.</h1><p class="fx-auth__copy">Sign in to return to your journeys, saved places and research.</p><div class="fx-auth__tabs"><button type="button" class="fx-btn fx-btn--line" data-auth-mode="signin">Sign in</button><button type="button" class="fx-btn fx-btn--line" data-auth-mode="signup">Create account</button></div><form data-auth-form><div data-auth-fields></div><p class="fx-error" role="alert" data-auth-error></p><button class="fx-btn fx-btn--ink" type="submit">Continue</button></form><div data-auth-extra></div><p class="fx-hint" data-auth-legal hidden>By continuing, you agree to Friday’s <a class="fx-link" href="terms.html">Terms of Use</a> and <a class="fx-link" href="privacy.html">Privacy Policy</a>.</p><div data-auth-offline style="margin-top:1.2rem;text-align:center"><button class="fx-btn fx-btn--line" type="button" data-auth-skip>Continue without signing in</button></div></div>';
    main.prepend(box);
    main.querySelectorAll('.fx-page').forEach((p) => { p.hidden = true; });
    const side = $('[data-side]'); if (side) side.hidden = true;
    const form = $('[data-auth-form]', box), fields = $('[data-auth-fields]', box), extra=$('[data-auth-extra]',box), legal=$('[data-auth-legal]',box);
    const hexclave=FT.backend&&FT.backend.capabilities&&FT.backend.capabilities.authProvider==='hexclave';
    const state=FT.backend&&FT.backend.authState||{};
    if (FT.backend&&FT.backend.capabilities&&FT.backend.capabilities.authRequired) $('[data-auth-offline]',box).hidden=true;
    let mode = 'signin';
    function say(msg,text,tone){if(!msg)return;msg.textContent=text||'';if(text)msg.dataset.tone=tone||'error';else delete msg.dataset.tone;msg.hidden=!text;}
    function draw() {
      extra.innerHTML='';
      legal.hidden=true;
      const status=!!(hexclave&&(state.verificationRequired||state.accountRestricted));
      box.querySelector('.fx-auth__card').classList.toggle('fx-auth__card--status',status);
      if(hexclave&&(state.verificationRequired||state.accountRestricted)){
        form.hidden=true;box.querySelector('.fx-auth__tabs').hidden=true;
        if(state.accountRestricted){
          box.querySelector('.fx-auth__copy').textContent='Friday cannot open this account yet. '+(state.restrictedReason==='restricted_by_administrator'?'The account is waiting for review.':'Please contact Friday support for help.');
          extra.innerHTML='<div class="fx-auth__actions"><button class="fx-btn fx-btn--ink" type="button" data-refresh-auth>Check account status</button></div><p class="fx-auth__note" role="status" aria-live="polite" data-auth-message hidden></p><p class="fx-auth__quiet"><button class="fx-link fx-auth__linkbtn" type="button" data-signout-auth>Sign out</button></p>';
        } else {
          box.querySelector('.fx-auth__copy').textContent='We sent a verification link'+(state.email?' to '+state.email:'')+'. Open it to unlock your journeys.';
          extra.innerHTML='<div class="fx-auth__actions"><button class="fx-btn fx-btn--ink" type="button" data-refresh-auth>I’ve verified my email</button><button class="fx-btn fx-btn--line" type="button" data-resend-verification>Resend verification email</button></div><p class="fx-auth__note" role="status" aria-live="polite" data-auth-message hidden></p><p class="fx-auth__quiet"><button class="fx-link fx-auth__linkbtn" type="button" data-signout-auth>Sign out</button></p><p class="fx-hint fx-auth__hint">You can return here after verifying your email.</p>';
        }
        return;
      }
      if(hexclave&&state.legacyAccountAvailable){
        mode='legacy';form.hidden=false;box.querySelector('.fx-auth__tabs').hidden=true;
        box.querySelector('.fx-auth__copy').textContent='A Friday account already exists for '+(state.email||'this address')+'. Enter its password to link your saved journeys.';
        fields.innerHTML='<div class="fx-field"><label class="fx-label" for="auth-password">Existing Friday password</label><input class="fx-input" id="auth-password" name="password" type="password" maxlength="128" autocomplete="current-password" required></div>';
        form.querySelector('[type=submit]').textContent='Link existing journeys';
        extra.innerHTML='<button class="fx-btn fx-btn--line" type="button" data-fresh-account>Start a separate Friday account</button>';
        return;
      }
      form.hidden=false;box.querySelector('.fx-auth__tabs').hidden=false;
      box.querySelector('.fx-auth__copy').textContent='Sign in to return to your journeys, saved places and research.';
      fields.innerHTML = (mode === 'signup' ? '<div class="fx-field"><label class="fx-label" for="auth-name">Your name</label><input class="fx-input" id="auth-name" name="name" autocomplete="name" required></div>' : '') +
        '<div class="fx-field"><label class="fx-label" for="auth-email">Email</label><input class="fx-input" id="auth-email" name="email" type="email" autocomplete="email" required></div>' +
        '<div class="fx-field"><label class="fx-label" for="auth-password">Password · at least 12 characters</label><input class="fx-input" id="auth-password" name="password" type="password" minlength="12" maxlength="128" autocomplete="'+(mode==='signup'?'new-password':'current-password')+'" required></div>';
      form.querySelector('[type=submit]').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
      box.querySelectorAll('[data-auth-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.authMode === mode)));
      legal.hidden=false;
      if(hexclave&&mode==='signin')extra.innerHTML='<button class="fx-btn fx-btn--line" type="button" data-forgot-password>Forgot password?</button><p class="fx-auth__note" role="status" aria-live="polite" data-auth-message hidden></p>';
    }
    box.addEventListener('click', (e) => {
      const skip = e.target.closest('[data-auth-skip]');
      if (skip) {
        box.remove();
        if (side) side.hidden = false;
        booted = false;
        boot();
        return;
      }
      const resend=e.target.closest('[data-resend-verification]');
      if(resend){resend.disabled=true;const msg=$('[data-auth-message]',box);say(msg,'');FT.backend.resendVerification().then(()=>{say(msg,'A new verification link is on its way.','success');}).catch(err=>{say(msg,err.message||'Could not send a new link. Please try again.','error');}).finally(()=>{resend.disabled=false;});return;}
      const refreshAuth=e.target.closest('[data-refresh-auth]');
      if(refreshAuth){refreshAuth.disabled=true;const msg=$('[data-auth-message]',box);say(msg,'');FT.backend.init().then(()=>{if(FT.backend.user){box.remove();if(side)side.hidden=false;booted=false;boot();}else{say(msg,FT.backend.authState.accountRestricted?'Friday still cannot open this account.':'Email verification is still pending. Open the link from your inbox, then check again.','info');}}).catch(err=>{say(msg,err.message||'Could not check your account status.','error');}).finally(()=>{refreshAuth.disabled=false;});return;}
      const signoutAuth=e.target.closest('[data-signout-auth]');
      if(signoutAuth){signoutAuth.disabled=true;FT.backend.logout().then(()=>FT.backend.init()).then(()=>{box.remove();if(side)side.hidden=false;booted=false;boot();}).catch(err=>{say($('[data-auth-message]',box),err.message||'Could not sign out.','error');signoutAuth.disabled=false;});return;}
      const forgot=e.target.closest('[data-forgot-password]');
      if(forgot){const input=$('#auth-email',box),msg=$('[data-auth-message]',box);if(!input||!input.reportValidity())return;forgot.disabled=true;say(msg,'');FT.backend.forgotPassword(input.value).then(()=>{say(msg,'If an account uses that email, a password reset link is on its way.','success');}).catch(err=>{say(msg,err.message||'Could not send a reset link. Please try again.','error');}).finally(()=>{forgot.disabled=false;});return;}
      const fresh=e.target.closest('[data-fresh-account]');
      if(fresh){fresh.disabled=true;FT.backend.freshAccount().then(()=>FT.backend.init()).then(()=>{box.remove();if(side)side.hidden=false;booted=false;boot();}).catch(err=>{fresh.disabled=false;$('[data-auth-error]',box).textContent=err.message||'Could not create a separate account.';});return;}
      const b=e.target.closest('[data-auth-mode]');
      if (b) { mode=b.dataset.authMode; draw(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (form.hidden||!form.reportValidity()) return;
      const submit=form.querySelector('[type=submit]');submit.disabled=true;$('[data-auth-error]',box).textContent='';
      try {
        const payload=Object.fromEntries(new FormData(form));
        if(mode==='legacy') await FT.backend.linkLegacy(payload.password);
        else if (mode === 'signup') await FT.backend.signup(payload); else await FT.backend.login(payload);
        await FT.backend.init(); box.remove(); if (side) side.hidden=false; booted=false; await boot();
      } catch (err) { $('[data-auth-error]',box).textContent=err.message || 'Please try again.'; }
      finally { submit.disabled=false; }
    });
    draw();
  }
  function homeCityModal() {
    const user=FT.backend && FT.backend.user; if (!user || user.profile?.onboarded) return;
    let city=user.profile?.city||user.profile?.homeCity||'', airports=[...(user.profile?.airports||[])], timer;
    function chips(){const el=doc.querySelector('[data-home-airports]');if(el)el.innerHTML=airports.map((code)=>'<button type="button" class="fx-chip" data-remove-airport="'+esc(code)+'" aria-label="Remove '+esc(code)+' airport">'+esc(code)+' <span aria-hidden="true">×</span></button>').join('')||'<p class="fx-hint">No departure airports selected.</p>';}
    const body=doc.createElement('div');
    body.innerHTML='<p class="fx-hint">Your home city helps Friday suggest nearby departure airports. Remove any you prefer to avoid.</p><div class="fx-field"><label class="fx-label" for="home-city">Home city</label><input class="fx-input" id="home-city" value="'+esc(city)+'" autocomplete="address-level2"></div><div data-city-suggestions></div><div class="fx-field" data-home-airports></div>';
    const modal=FT.ui.modal({title:'Where are you based?',body,actions:[{label:'Save location',primary:true,onClick:async(close)=>{const value=$('#home-city',body).value.trim();if(!value)return;try{await FT.backend.saveProfile({city:value,airports});store.update((s)=>{s.prefs.homeCity=value;s.prefs.airports=airports.slice();s.notifications=(s.notifications||[]).filter((n)=>n.kind!=='home-city');});close();}catch(err){const note=$('[data-city-suggestions]',body);note.textContent=err.message;}}}]});
    chips();
    body.addEventListener('click',async(e)=>{const rm=e.target.closest('[data-remove-airport]');if(rm){airports=airports.filter((a)=>a!==rm.dataset.removeAirport);chips();return;}const choose=e.target.closest('[data-city]');if(choose){city=choose.dataset.city;$('#home-city',body).value=city;airports=JSON.parse(choose.dataset.airports);chips();}});
    $('#home-city',body).addEventListener('input',()=>{clearTimeout(timer);const q=$('#home-city',body).value.trim();airports=[];chips();if(q.length<2)return;timer=setTimeout(async()=>{try{const metros=await FT.backend.airports(q);if($('#home-city',body).value.trim()!==q)return;const exact=(metros||[]).find((m)=>[m.city].concat(m.aliases||[]).some((x)=>String(x).toLowerCase()===q.toLowerCase()));const box=$('[data-city-suggestions]',body);if(exact){city=exact.city;airports=(exact.airports||[]).slice();chips();box.innerHTML='<p class="fx-hint">Nearby airports · remove any you prefer to avoid.</p>';return;}box.innerHTML=(metros||[]).map((m)=>'<button type="button" class="fx-link" data-city="'+esc(m.city)+'" data-airports="'+esc(JSON.stringify(m.airports||[]))+'">'+esc(m.city)+' · '+esc((m.airports||[]).join(', '))+'</button>').join('')||'<p class="fx-hint">No nearby airport group found yet. You can still save your city.</p>';}catch(err){$('[data-city-suggestions]',body).textContent=err.message;}},250);});
    return modal;
  }
  function sharedTripView(main, trip) {
    store.replaceState(defaults(), { persist: false });
    const side=$('[data-side]');if(side)side.hidden=true;
    const maps=(item,destination)=>safeWebUrl('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([item.title||item.name,item.address,destination].filter(Boolean).join(' ')));
    main.innerHTML='<article class="fx-shared"><a class="fx-shared__brand" href="index.html">Friday<span aria-hidden="true">·</span></a><p class="fx-eyebrow">A shared itinerary</p><h1 class="fx-h1">'+esc(trip.title||'A journey')+'</h1><p class="fx-shared__destination">'+esc(trip.destination||'')+'</p><p class="fx-hint">This itinerary was shared with you. It includes no account details, conversations or reservations.</p>'+(trip.days||[]).map(function(day,i){return '<section class="fx-shared__day"><p class="fx-eyebrow">Day '+(i+1)+(day.date?' · '+esc(day.date):'')+'</p><h2 class="fx-h2">'+esc(day.title||day.town||'A day to explore')+'</h2>'+(day.notes?'<p class="fx-shared__note">'+esc(day.notes)+'</p>':'')+'<ol>'+(day.items||[]).map(function(item){const map=maps(item,trip.destination);return '<li><strong>'+esc(item.time?item.time+' · ':'')+esc(item.title||item.name||'A stop')+'</strong>'+(item.notes||item.description?'<p>'+esc(item.notes||item.description)+'</p>':'')+(item.address?'<span>'+esc(item.address)+'</span>':'')+(map?'<a class="fx-link" href="'+esc(map)+'" target="_blank" rel="noopener noreferrer">View on map</a>':'')+'</li>';}).join('')+'</ol></section>';}).join('')+'<p class="fx-shared__foot">Planned with Friday · <a class="fx-link" href="trip.html">Plan your own journey</a></p></article>';
  }
  async function boot() {
    if (booted) return;
    booted = true;
    const app = $('[data-app]');
    const main = $('[data-main]');
    if (!app || !main) return;

    const params = new URLSearchParams(location.search);
    const shareToken=new URLSearchParams(location.search).get('share');
    if(shareToken&&FT.backend&&typeof FT.backend.shared==='function'){
      try{const shared=await FT.backend.shared(shareToken);if(shared&&shared.trip){sharedTripView(main,shared.trip);return;}}
      catch(err){main.innerHTML='<section class="fx-shared"><p class="fx-eyebrow">A shared itinerary</p><h1 class="fx-h1">This link has expired.</h1><p class="fx-shared__note">Ask the person who shared it to create a new link.</p><a class="fx-btn fx-btn--ink" href="trip.html">Plan a trip</a></section>';const side=$('[data-side]');if(side)side.hidden=true;return;}
    }

    // The authenticated bridge hydrates owner-scoped data before the planner paints.
    if (FT.backend && typeof FT.backend.init === 'function') {
      try { await FT.backend.init(); }
      catch (err) {
        console.error('[friday] workspace data could not be loaded', err);
        main.innerHTML = '<section class="fx-auth"><div class="fx-auth__card"><p class="fx-eyebrow">Friday · Your journeys</p><h1 class="fx-auth__title">Your plans could not be loaded.</h1><p class="fx-auth__copy">' + esc(err.message || 'Check your connection, then try again.') + '</p><div style="display:flex;gap:0.75rem;flex-wrap:wrap"><button class="fx-btn fx-btn--ink" type="button" data-retry>Try again</button><button class="fx-btn fx-btn--line" type="button" data-offline>Continue offline</button></div></div></section>';
        main.querySelector('[data-retry]').addEventListener('click', function () { location.reload(); });
        var offlineBtn = main.querySelector('[data-offline]');
        if (FT.backend && FT.backend.capabilities && FT.backend.capabilities.authRequired) offlineBtn.hidden = true;
        if (offlineBtn) {
          offlineBtn.addEventListener('click', function () {
            if (FT.store && FT.store.useGuestStorage) FT.store.useGuestStorage();
            booted = false;
            boot();
          });
        }
        return;
      }
    }
    const googleReturn = new URLSearchParams(location.search).get('google');
    if (googleReturn) {
      const kind = new URLSearchParams(location.search).get('kind') || 'Google';
      const toast = googleReturn === 'sync-failed' && kind.toLowerCase() === 'gmail' ? 'Gmail connected, but booking scan failed. Sync confirmations to try again.' : googleReturn === 'connected' && kind.toLowerCase() === 'gmail' ? 'Gmail connected. Upcoming bookings checked.' : googleReturn === 'connected' ? kind + ' connected' : 'Google connection was cancelled';
      if (FT.ui && FT.ui.toast) FT.ui.toast(toast);
      const clean = new URL(location.href); clean.searchParams.delete('google'); clean.searchParams.delete('kind'); history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
    }
    if (!/(?:^|\/)trip-briefing\.html$/.test(location.pathname || '') && params.get('ref') === 'briefing' && params.get('trip') && FT.backend && FT.backend.user && FT.store && FT.store.get) {
      var legacyBriefingTrip = (FT.store.get().trips || []).find(function (trip) { return trip.serverId === params.get('trip') || trip.id === params.get('trip'); });
      if (legacyBriefingTrip && FT.trips && FT.trips.open) FT.trips.open(legacyBriefingTrip.id);
    }
    if (FT.backend && !FT.backend.user && FT.backend.capabilities.authRequired !== false) { authGate(main); return; }
    const briefingEntry = /(?:^|\/)trip-briefing\.html$/.test(location.pathname || '');
    if (briefingEntry) {
      const side = $('[data-side]'); if (side) side.hidden = true;
      if (!FT.backend || !FT.backend.user) { authGate(main); return; }
      const briefingTripId = new URLSearchParams(location.search).get('trip');
      if (!briefingTripId) { FT.briefingView.showMessage(main, 'Choose a trip', 'Open a trip from your planner to see its briefing.'); return; }
      main.innerHTML = '<section class="friday-briefing__state"><p class="friday-briefing__eyebrow">Your trip briefing</p><h1>Loading your trip…</h1><p>Your private briefing is being prepared.</p></section>';
      FT.backend.request('/api/trips/' + encodeURIComponent(briefingTripId) + '/briefing').then(function (response) {
        FT.briefingView.render(main, response.briefing || {});
      }).catch(function (error) {
        const unavailable = error && error.status === 404;
        FT.briefingView.showMessage(main, unavailable ? 'This briefing isn’t available' : 'Your briefing could not be loaded', unavailable ? 'This trip may have been removed or belongs to another account.' : (error.message || 'Check your connection, then try again.'), !unavailable);
        const retry = main.querySelector('[data-retry-briefing]'); if (retry) retry.addEventListener('click', function () { location.reload(); });
      });
      return;
    }
    // Villa-origin trips keep provider data out of persistence, so reconstruct
    // their runtime destination catalog before the first workspace render.
    if (FT.villa && typeof FT.villa.prepareCatalogs === 'function') FT.villa.prepareCatalogs();

    // Collapse toggle, mobile burger and scrim live beside the pages.
    const float = doc.createElement('button');
    float.type = 'button';
    float.className = 'fx-float-toggle fx-icon-btn';
    float.setAttribute('aria-label', 'Expand sidebar');
    float.title = 'Expand sidebar';
    float.innerHTML = icon('sidebar', 18);
    float.addEventListener('click', toggleSide);
    const burger = doc.createElement('button');
    burger.type = 'button';
    burger.className = 'fx-burger fx-icon-btn';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-controls', 'fx-side');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = icon('menu', 20);
    burger.addEventListener('click', toggleSide);
    main.insertBefore(burger, main.firstChild);
    main.insertBefore(float, main.firstChild);
    const scrim = doc.createElement('div');
    scrim.className = 'fx-scrim';
    scrim.addEventListener('click', closeDrawer);
    app.appendChild(scrim);
    const side = $('[data-side]');
    if (side) side.id = 'fx-side';

    // 1. restore state (done at load), 2. sidebar, 3. workspace, 4. route
    if (FT.workspace) doc.body.classList.add('fx-ws'); // the workspace brings its own sidebar button on the trip route
    wireSidebar(); wireHome(); wireBookings(); wireSaved(); wireNotifs(); wirePrefs();
    renderSidebar(true);
    syncFrame();
    if (FT.workspace && typeof FT.workspace.mount === 'function') {
      try { FT.workspace.mount($('[data-trip-root]')); } catch (err) { console.error('[friday] workspace failed to mount', err); }
    }

    store.on('change', () => {
      if (autoCollapsed && !state.sideCollapsed) autoCollapsed = false;
      onChange();
    });
    window.addEventListener('hashchange', () => {
      const r = parseHash(location.hash);
      if (keyOf(r) !== appliedKey) applyRoute(r);
    });
    window.addEventListener('resize', () => { if (!isNarrow() && drawerOpen) closeDrawer(); syncFrame(); });

    applyRoute(parseHash(location.hash));
    homeCityModal();
  }

  if (doc.readyState === 'complete') boot();
  else doc.addEventListener('DOMContentLoaded', boot);
})();
