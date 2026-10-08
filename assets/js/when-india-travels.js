/* When India travels: a region filter for when-india-travels.html and the homepage breaks carousel (state-aware).
   Every row is already in the page's HTML; without this script all of them are simply listed.
   Rows that are only national always show; a national row tagged with states shows for those states and under All. Selection: ?region= (a state key, an old city key such as mumbai-pune, or a state code such as MH) -> the last choice on this device -> All.
   Nothing here talks to the server. */
(function () {
  'use strict';
  var dataEl = document.getElementById('wit-data');
  if (!dataEl) return;
  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (_) { return; }
  var storeKey = 'friday.breaks-region.v1';
  var filters = data.filters || [];

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
  var today = (function () { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
  function list(nodes) { return Array.prototype.slice.call(nodes || []); }

  /* ---------------------------------------------------------- the page */
  var rows = list(document.querySelectorAll('[data-wit-row]'));
  if (rows.length) {
    var links = list(document.querySelectorAll('[data-wit-filter]'));
    var groups = list(document.querySelectorAll('[data-wit-group]'));
    var nameSlots = list(document.querySelectorAll('[data-wit-region-name]'));
    /* Breaks that ended after the page was built are not shown. */
    var ended = function (row) { return (row.getAttribute('data-end') || '9999') < today; };

    var show = function (key) {
      var filter = find(key) || find(data.default);
      var codes = filter && filter.key !== 'all' ? filter.codes : null;
      rows.forEach(function (row) {
        var regions = String(row.getAttribute('data-regions') || '').split(' ');
        var pureNational = regions.length === 1 && regions[0] === 'national';
        var match = !codes || pureNational || regions.some(function (r) { return codes.indexOf(r) !== -1; });
        row.hidden = !match || ended(row);
      });
      groups.forEach(function (group) {
        group.hidden = !list(group.querySelectorAll('[data-wit-row]')).some(function (row) { return !row.hidden; });
      });
      links.forEach(function (link) {
        if (link.getAttribute('data-wit-filter') === filter.key) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
      });
      nameSlots.forEach(function (n) { n.textContent = filter.key === 'all' ? 'All regions' : filter.label; });
      if (document.body) document.body.setAttribute('data-wit-region', filter.key);
      return filter.key;
    };
    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var key = resolve(link.getAttribute('data-wit-filter'));
        if (!key) return;
        event.preventDefault();
        show(key);
        remember(key);
        try { history.replaceState(null, '', location.pathname + '?region=' + key); } catch (_) {}
      });
    });
    show(fromUrl() || remembered() || data.default);
  }

  /* ------------------------------------------------------ the homepage carousel
     Every upcoming break is already in the HTML as a card in a scroll-snap row. Here: hide breaks that ended after the
     build, narrow to the saved state (plus national breaks), and wire up the arrow buttons. */
  var teaser = document.querySelector('[data-wit-teaser]');
  if (teaser) {
    var track = teaser.querySelector('[data-wit-track]');
    var cards = list(teaser.querySelectorAll('[data-wit-card]'));
    var saved = remembered();
    var savedFilter = saved && saved !== 'all' ? find(saved) : null;
    var savedCodes = savedFilter ? savedFilter.codes : null;
    cards.forEach(function (card) {
      var regions = String(card.getAttribute('data-regions') || '').split(' ');
      var pureNational = regions.length === 1 && regions[0] === 'national';
      var match = !savedCodes || pureNational || regions.some(function (r) { return savedCodes.indexOf(r) !== -1; });
      card.hidden = !match || (card.getAttribute('data-end') || '9999') < today;
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
