/* When India travels: a state filter and a type-of-break filter for when-india-travels.html, a state-aware "Closer to home" block, and a
   state-aware homepage breaks carousel. Every row is already in the page's HTML; without this script all of them are simply listed.
   The two filters combine (state AND type). ?type= works like ?region= (a type key such as festival, school, long-weekend, short-escape).
   Rows that are only national always show; a national row tagged with states shows for those states and under All. Selection: ?region= (a state key, an old city key such as mumbai-pune, or a state code such as MH) -> the last choice on this device -> All.
   Nothing here talks to the server. */
(function () {
  'use strict';
  var dataEl = document.getElementById('wit-data');
  if (!dataEl) return;
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (_) { return; }
  var storeKey = 'friday.breaks-region.v1';
  var typeStoreKey = 'friday.breaks-type.v1';
  var filters = data.filters || [];
  var typeFilters = data.types || [];
  var defaultType = data.defaultType || 'all';

  function find(key) { for (var i = 0; i < filters.length; i++) if (filters[i].key === key) return filters[i]; return null; }
  /* "mumbai-pune", "MH", "Delhi NCR" -> a filter key, or null */
  function resolve(value) {
    var text = String(value == null ? '' : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!text) return null;
    if (find(text)) return text;
    for (var i = 0; i < filters.length; i++) {
      for (var j = 0; j < filters[i].codes.length; j++) if (filters[i].codes[j].toLowerCase() === text) return filters[i].key;
      var aliases = filters[i].aliases || [];
      for (var k = 0; k < aliases.length; k++) if (aliases[k] === text) return filters[i].key;
    }
    return null;
  }
  function remembered() { try { return resolve(localStorage.getItem(storeKey)); } catch (_) { return null; } }
  function remember(key) { try { localStorage.setItem(storeKey, key); } catch (_) {} }
  function fromUrl() { try { return resolve(new URLSearchParams(location.search || '').get('region')); } catch (_) { return null; } }
  function slug(value) { return String(value == null ? '' : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function findType(key) { for (var i = 0; i < typeFilters.length; i++) if (typeFilters[i].key === key) return typeFilters[i]; return null; }
  /* "festival", "Long weekends" -> a type key, or null */
  function resolveType(value) {
    var text = slug(value);
    if (!text) return null;
    if (findType(text)) return text;
    for (var i = 0; i < typeFilters.length; i++) if (slug(typeFilters[i].label) === text) return typeFilters[i].key;
    return null;
  }
  function rememberedType() { try { return resolveType(localStorage.getItem(typeStoreKey)); } catch (_) { return null; } }
  function rememberType(key) { try { localStorage.setItem(typeStoreKey, key); } catch (_) {} }
  function typeFromUrl() { try { return resolveType(new URLSearchParams(location.search || '').get('type')); } catch (_) { return null; } }
  var today = (function () { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
  function list(nodes) { return Array.prototype.slice.call(nodes || []); }

  /* ---------------------------------------------------------- the page */
  var rows = list(document.querySelectorAll('[data-wit-row]'));
  if (rows.length) {
    var links = list(document.querySelectorAll('[data-wit-filter]'));
    var typeLinks = list(document.querySelectorAll('[data-wit-type]'));
    var groups = list(document.querySelectorAll('[data-wit-group]'));
    var nameSlots = list(document.querySelectorAll('[data-wit-region-name]'));
    var typeNameSlots = list(document.querySelectorAll('[data-wit-type-name]'));
    var statusEl = document.querySelector('[data-wit-status]');
    var close = {
      block: document.querySelector('[data-wit-close]'), lead: document.querySelector('[data-wit-close-lead]'),
      link: document.querySelector('[data-wit-close-link]'), label: document.querySelector('[data-wit-close-label]'), more: document.querySelector('[data-wit-close-more]'),
    };
    var closeData = data.close || {};
    var current = { region: data.default, type: defaultType };
    /* Breaks that ended after the page was built are not shown. */
    var ended = function (row) { return (row.getAttribute('data-end') || '9999') < today; };

    /* "Closer to home": a state with its own short-escape guide gets it; everyone else (and All) gets the neutral block. */
    var showClose = function (key) {
      if (!close.block || !closeData['default']) return;
      var own = closeData.byRegion && closeData.byRegion[key];
      var copy = own || closeData['default'];
      if (close.lead) close.lead.textContent = copy.lead;
      if (close.label) close.label.textContent = copy.label;
      if (close.link) close.link.setAttribute('href', copy.href);
      if (close.more) close.more.hidden = !!own;
    };

    /* Keep each filter's links carrying the other filter's value, so a link (or a copied address) holds both. */
    var query = function (region, type) {
      return '?region=' + region + (type && type !== 'all' ? '&type=' + type : '');
    };
    var show = function () {
      var filter = find(current.region) || find(data.default);
      var type = findType(current.type) || findType(defaultType) || { key: 'all', label: 'All' };
      var codes = filter && filter.key !== 'all' ? filter.codes : null;
      var any = false;
      rows.forEach(function (row) {
        var regions = String(row.getAttribute('data-regions') || '').split(' ');
        var types = String(row.getAttribute('data-types') || '').split(' ');
        var pureNational = regions.length === 1 && regions[0] === 'national';
        var stateMatch = !codes || pureNational || regions.some(function (r) { return codes.indexOf(r) !== -1; });
        var typeMatch = type.key === 'all' || types.indexOf(type.key) !== -1;
        row.hidden = !(stateMatch && typeMatch) || ended(row);
        if (!row.hidden) any = true;
      });
      groups.forEach(function (group) {
        group.hidden = !list(group.querySelectorAll('[data-wit-row]')).some(function (row) { return !row.hidden; });
      });
      links.forEach(function (link) {
        var key = link.getAttribute('data-wit-filter');
        if (key === filter.key) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
        link.setAttribute('href', query(key, type.key));
      });
      typeLinks.forEach(function (link) {
        var key = link.getAttribute('data-wit-type');
        if (key === type.key) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
        link.setAttribute('href', query(filter.key, key));
      });
      nameSlots.forEach(function (n) { n.textContent = filter.key === 'all' ? 'All regions' : filter.label; });
      typeNameSlots.forEach(function (n) { n.textContent = type.key === 'all' ? 'All types' : type.label; });
      if (statusEl) {
        statusEl.textContent = any ? '' : 'No breaks match ' + (type.key === 'all' ? '' : type.label.toLowerCase() + ' in ') + (filter.key === 'all' ? 'all regions' : filter.label) + ' just yet. Try another state or type, or choose All.';
      }
      showClose(filter.key);
      if (document.body) {
        document.body.setAttribute('data-wit-region', filter.key);
        document.body.setAttribute('data-wit-type', type.key);
      }
      current = { region: filter.key, type: type.key };
    };
    var pick = function (region, type) {
      current = { region: region, type: type };
      show();
      try { history.replaceState(null, '', location.pathname + query(current.region, current.type)); } catch (_) {}
    };
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var key = resolve(link.getAttribute('data-wit-filter'));
        if (!key) return;
        event.preventDefault();
        remember(key);
        pick(key, current.type);
      });
    });
    typeLinks.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var key = resolveType(link.getAttribute('data-wit-type'));
        if (!key) return;
        event.preventDefault();
        rememberType(key);
        pick(current.region, key);
      });
    });
    current = { region: fromUrl() || remembered() || data.default, type: typeFromUrl() || rememberedType() || defaultType };
    show();
  }

  /* ------------------------------------------------------ the homepage carousel
     The HTML holds the national breaks only (a scroll-snap row that works without JavaScript); state-specific breaks wait in a
     <template>. Here: with no saved state nothing is added; with one, that state's breaks are inserted in date order. Breaks that
     ended after the build are hidden. The saved type filter is not applied here. */
  var teaser = document.querySelector('[data-wit-teaser]');
  if (teaser) {
    var track = teaser.querySelector('[data-wit-track]');
    var saved = remembered();
    var savedFilter = saved && saved !== 'all' ? find(saved) : null;
    var savedCodes = savedFilter ? savedFilter.codes : null;
    var tpl = teaser.querySelector('[data-wit-regional]');
    var order = function (c) { return (c.getAttribute('data-start') || '') + ' ' + (c.getAttribute('data-id') || ''); };
    if (track && tpl && savedCodes) {
      list(tpl.content ? tpl.content.querySelectorAll('[data-wit-card]') : []).forEach(function (item) {
        var regions = String(item.getAttribute('data-regions') || '').split(' ');
        if (!regions.some(function (r) { return savedCodes.indexOf(r) !== -1; })) return;
        var before = null;
        list(track.querySelectorAll('[data-wit-card]')).some(function (c) {
          if (order(c) > order(item)) { before = c; return true; }
          return false;
        });
        var clone = item.cloneNode(true);
        if (before) track.insertBefore(clone, before); else track.appendChild(clone);
      });
    }
    var cards = list(track ? track.querySelectorAll('[data-wit-card]') : []);
    cards.forEach(function (card) {
      card.hidden = (card.getAttribute('data-end') || '9999') < today;
    });
    var seeAll = teaser.querySelector('[data-wit-teaser-link]');
    if (seeAll && savedFilter) seeAll.setAttribute('href', 'when-india-travels.html?region=' + savedFilter.key);

    var prev = teaser.querySelector('[data-wit-prev]');
    var next = teaser.querySelector('[data-wit-next]');
    var nav = teaser.querySelector('[data-wit-nav]');
    if (track && prev && next) {
      if (nav) nav.hidden = false;
      var shown = function () { return cards.filter(function (c) { return !c.hidden; }); };
      var smooth = function () {
        try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; } catch (_) { return 'auto'; }
      };
      /* one card plus the gap, measured from the first two visible cards */
      var step = function () {
        var vis = shown();
        if (!vis.length) return track.clientWidth;
        if (vis.length > 1) return vis[1].offsetLeft - vis[0].offsetLeft;
        return vis[0].offsetWidth;
      };
      var update = function () {
        prev.disabled = track.scrollLeft <= 1;
        next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
      };
      prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: smooth() }); });
      next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: smooth() }); });
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      /* keep a focused card fully inside the row (horizontal only, so the page does not jump) */
      track.addEventListener('focusin', function (event) {
        var item = event.target && event.target.closest ? event.target.closest('[data-wit-card]') : null;
        if (!item) return;
        var left = item.offsetLeft, right = left + item.offsetWidth;
        if (left < track.scrollLeft) track.scrollTo({ left: left, behavior: smooth() });
        else if (right > track.scrollLeft + track.clientWidth) track.scrollTo({ left: right - track.clientWidth, behavior: smooth() });
      });
      update();
    }
  }
})();
