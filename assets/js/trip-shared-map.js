/* FRIDAY · trip-shared-map.js
   A read-only map of a shared trip's stops. No tiles, no provider, no keys: a small SVG in the planner map's house style,
   drawn only from lat/lng the share endpoint already returns. Stops without coordinates are simply left off; with none
   at all, nothing is mounted and the list stays as it is.
   FridayTrip.sharedMap.mount(main, trip) runs after sharedTripView and before FT.feedback.mountShared. */
(function () {
  'use strict';
  var FT = (window.FridayTrip = window.FridayTrip || {});
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#D97757', '#0A87A8', '#5B3FD6', '#178044', '#B721C9', '#2563EB', '#B45309'];
  var W = 640, H = 360, PAD = 40;

  function node(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function ok(n) { return typeof n === 'number' && isFinite(n); }

  function collect(trip) {
    var pins = [];
    (trip.days || []).forEach(function (day, d) {
      var n = 0;
      (day.items || []).forEach(function (item, i) {
        n++;
        if (ok(item.lat) && ok(item.lng) && Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180) {
          pins.push({ day: d, item: i, n: n, lat: item.lat, lng: item.lng, title: item.title || 'A stop' });
        }
      });
    });
    return pins;
  }

  function mount(main, trip) {
    if (!main || !trip) return;
    var article = main.querySelector('.fx-shared'), firstDay = main.querySelector('.fx-shared__day');
    if (!article || !firstDay || main.querySelector('[data-shared-map]')) return;
    var pins = collect(trip);
    if (!pins.length) return;

    var lats = pins.map(function (p) { return p.lat; }), lngs = pins.map(function (p) { return p.lng; });
    var latC = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2, k = Math.cos(latC * Math.PI / 180) || 1;
    var spanX = Math.max((Math.max.apply(null, lngs) - Math.min.apply(null, lngs)) * k, 0.01);
    var spanY = Math.max(Math.max.apply(null, lats) - Math.min.apply(null, lats), 0.01);
    var scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    var lngC = (Math.min.apply(null, lngs) + Math.max.apply(null, lngs)) / 2;
    pins.forEach(function (p) { p.x = W / 2 + (p.lng - lngC) * k * scale; p.y = H / 2 - (p.lat - latC) * scale; });

    var details = document.createElement('details');
    details.className = 'fx-sharedmap'; details.setAttribute('data-shared-map', '');
    details.open = !(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
    var sum = document.createElement('summary');
    sum.textContent = 'Map of the stops · ' + pins.length + (pins.length === 1 ? ' place' : ' places');
    details.appendChild(sum);

    var dayIdx = [];
    pins.forEach(function (p) { if (dayIdx.indexOf(p.day) < 0) dayIdx.push(p.day); });
    var filters = document.createElement('div'); filters.className = 'fx-sharedmap__days';
    function chip(label, day, color) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'fx-sharedmap__chip'; b.textContent = label;
      b.setAttribute('data-day', String(day)); b.setAttribute('aria-pressed', day === -1 ? 'true' : 'false');
      if (color) b.style.setProperty('--chip', color);
      filters.appendChild(b); return b;
    }
    if (dayIdx.length > 1) { chip('All days', -1); dayIdx.forEach(function (d) { chip('Day ' + (d + 1), d, COLORS[d % COLORS.length]); }); details.appendChild(filters); }

    var svg = node('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'fx-sharedmap__svg', role: 'group', 'aria-label': 'Map of the stops on this itinerary' });
    svg.appendChild(node('rect', { width: W, height: H, fill: '#DDF0F8' }));
    for (var gx = 1; gx < 8; gx++) svg.appendChild(node('line', { x1: gx * W / 8, y1: 0, x2: gx * W / 8, y2: H, stroke: '#fff', 'stroke-opacity': '.55', 'stroke-width': 1 }));
    for (var gy = 1; gy < 5; gy++) svg.appendChild(node('line', { x1: 0, y1: gy * H / 5, x2: W, y2: gy * H / 5, stroke: '#fff', 'stroke-opacity': '.55', 'stroke-width': 1 }));
    dayIdx.forEach(function (d) {
      var line = pins.filter(function (p) { return p.day === d; });
      if (line.length > 1) svg.appendChild(node('polyline', { points: line.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '), fill: 'none', stroke: COLORS[d % COLORS.length], 'stroke-opacity': '.45', 'stroke-width': 2, 'stroke-dasharray': '5 5', 'data-line-day': d }));
    });
    var byKey = {};
    pins.forEach(function (p) {
      var color = COLORS[p.day % COLORS.length];
      var g = node('g', { class: 'fx-sharedmap__pin', tabindex: '0', role: 'button', transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')', 'data-day': p.day, 'aria-label': 'Day ' + (p.day + 1) + ', stop ' + p.n + ': ' + p.title });
      g.appendChild(node('title', {}, p.title));
      g.appendChild(node('circle', { r: 13, fill: color, stroke: '#fff', 'stroke-width': 2 }));
      g.appendChild(node('text', { y: 4.5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12, 'font-weight': 600, 'font-family': 'Inter, system-ui, sans-serif' }, String(p.n)));
      g.addEventListener('click', function () { select(p.day + ':' + p.item, true); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.day + ':' + p.item, true); } });
      byKey[p.day + ':' + p.item] = g; svg.appendChild(g);
    });
    details.appendChild(svg);
    article.insertBefore(details, firstDay);

    // List rows: tag by day/index so the pins can find them. Selecting never alters a row's contents.
    var rows = {};
    Array.prototype.forEach.call(main.querySelectorAll('.fx-shared__day'), function (section, d) {
      Array.prototype.forEach.call(section.querySelectorAll(':scope > ol > li'), function (li, i) {
        var key = d + ':' + i; rows[key] = li;
        if (byKey[key]) li.setAttribute('data-map-stop', key);
      });
    });
    var current = '';
    function select(key, scroll) {
      if (current && byKey[current]) byKey[current].classList.remove('is-on');
      if (current && rows[current]) rows[current].classList.remove('fx-sharedmap__row--on');
      current = key;
      if (byKey[key]) { byKey[key].classList.add('is-on'); svg.appendChild(byKey[key]); }
      if (rows[key]) {
        rows[key].classList.add('fx-sharedmap__row--on');
        if (scroll) {
          var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          rows[key].scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        }
      }
    }
    main.addEventListener('click', function (e) {
      var li = e.target.closest && e.target.closest('li[data-map-stop]');
      if (!li || e.target.closest('a,button,input,textarea,select,.fx-sharedmap')) return;
      select(li.getAttribute('data-map-stop'), false);
      if (!details.open) return;
      var r = details.getBoundingClientRect(); if (r.bottom < 0) details.scrollIntoView({ block: 'nearest' });
    });
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-day]'); if (!b) return;
      var day = Number(b.getAttribute('data-day'));
      Array.prototype.forEach.call(filters.children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
      Object.keys(byKey).forEach(function (key) { byKey[key].style.display = day === -1 || key.split(':')[0] === String(day) ? '' : 'none'; });
      Array.prototype.forEach.call(svg.querySelectorAll('polyline'), function (l) { l.style.display = day === -1 || l.getAttribute('data-line-day') === String(day) ? '' : 'none'; });
    });
  }

  FT.sharedMap = { mount: mount };
})();
