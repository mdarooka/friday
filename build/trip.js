'use strict';

/*
 * trip.js — the planner page (trip.html) and its two generated scripts.
 *
 *   tripPage()     the complete trip.html document
 *   tripScripts()  { 'assets/js/trip-data.js': src, 'assets/js/trip-art.js': src }
 *
 * The planner is a hand-written app (assets/js/trip-*.js, assets/css/trip*.css). Only these two
 * scripts are generated, so the destination data and the plate generator have one source of truth
 * each: build/trip-data/ and build/art.js.
 */

const fs = require('fs');
const path = require('path');
const { FONT_LINKS, esc } = require('./templates');
const { siteOrigin, publicUrl } = require('./site-metadata');

/* Default share image; the server swaps in a destination or shared-trip card per request (server/social-meta.mjs). */
const DEFAULT_SOCIAL_IMAGE = publicUrl('assets/images/friday-social.jpg', siteOrigin());

const TITLE = 'Plan a trip · Friday';
const DESCRIPTION = 'Friday’s trip planner: a conversation on the left, a living plan and map on the right.';

/** Destination data. Another engineer writes build/trip-data/ in parallel, so never let it break the build. */
function loadData() {
  try {
    const d = require('./trip-data');
    return { DESTINATIONS: d.DESTINATIONS || {}, ORDER: d.ORDER || [], TRIP_TYPES: d.TRIP_TYPES || {} };
  } catch (err) {
    console.warn('[trip] build/trip-data is not loadable yet (' + err.message + '); writing empty destination data.');
    return { DESTINATIONS: {}, ORDER: [], TRIP_TYPES: {} };
  }
}

/** JSON that is safe to embed in a classic script (U+2028/9 are legal in JSON but not in old JS). */
const json = (v) => JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function tripPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4F1EA">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${esc(DEFAULT_SOCIAL_IMAGE)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A coastal travel scene with Friday’s thoughtful journeys message">
<meta name="twitter:card" content="summary_large_image">
${FONT_LINKS.replace("Inter:wght@300;400;500&", "Inter:wght@300;400;500;600&")}
<link rel="stylesheet" href="assets/css/friday.css">
<link rel="stylesheet" href="assets/css/trip.css">
<link rel="stylesheet" href="assets/css/trip-workspace.css">
<link rel="stylesheet" href="assets/css/trip-map.css">
<link rel="stylesheet" href="assets/css/trip-chat.css">
<link rel="stylesheet" href="assets/css/trip-briefing.css">
<script src="assets/js/friday-analytics.js" defer></script>
<script src="assets/js/quote-analytics.js" defer></script>
<script src="assets/js/guide-analytics.js" defer></script>
<script src="assets/js/trip-data.js" defer></script>
<script src="assets/js/trip-art.js" defer></script>
<script src="assets/js/trip-generator.js" defer></script>
<script src="assets/js/trip-memory.js" defer></script>
<script src="assets/js/trip-analytics.js" defer></script>
<script src="assets/js/trip-app.js" defer></script>
<script src="assets/js/trip-backend.js" defer></script>
<script src="assets/js/trip-integrations.js" defer></script>
<script src="assets/js/trip-prequote.js" defer></script>
<script src="assets/js/trip-reel.js" defer></script>
<script src="assets/js/trip-map.js" defer></script>
<script src="assets/js/trip-chat.js" defer></script>
<script src="assets/js/trip-feedback.js" defer></script>
<script src="assets/js/trip-confidence.js" defer></script>
<script src="assets/js/trip-shared-map.js" defer></script>
<script src="assets/js/trip-briefing-view.js" defer></script>
<script src="assets/js/trip-workspace.js" defer></script>
<script src="assets/js/trip-villa.js" defer></script>
<script src="assets/js/callback-analytics.js" defer></script>
</head>
<body class="fx">
<header class="fx-start-header" data-start-header>
  <a class="fx-start-header__wordmark" href="index.html" aria-label="Friday home">Friday</a>
  <nav class="fx-start-header__nav" aria-label="Friday website">
    <a href="villas.html">Villas</a><a href="departures.html">Packages</a><a href="about.html">About Friday</a>
  </nav>
</header>
<div class="fx-app" data-app>
  <aside class="fx-side" data-side aria-label="Planner navigation"></aside>
  <main class="fx-main" data-main>
    <section class="fx-page" data-page="home" hidden></section>
    <section class="fx-page" data-page="new" hidden></section>
    <section class="fx-page" data-page="trips" hidden></section>
    <section class="fx-page" data-page="bookings" hidden></section>
    <section class="fx-page" data-page="saved" hidden></section>
    <section class="fx-page" data-page="notifications" hidden></section>
    <section class="fx-page" data-page="preferences" hidden></section>
    <section class="fx-page fx-page--trip" data-page="trip" hidden><div data-trip-root></div></section>
  </main>
</div>
<div data-layer></div>
<noscript><p style="padding:2rem;font-family:sans-serif">Friday's planner needs JavaScript. The rest of the site does not: <a href="index.html">back to Friday</a>.</p></noscript>
</body>
</html>`;
}

function tripBriefingPage() {
  return tripPage()
    .replace('<title>' + esc(TITLE) + '</title>', '<title>Your trip briefing · Friday</title>\n<meta name="robots" content="noindex, nofollow">')
    .replace('<meta name="description" content="' + esc(DESCRIPTION) + '">', '<meta name="description" content="Your private Friday trip briefing.">')
    .replace('<body class="fx">', '<body class="fx fx-briefing-entry">');
}

function appAliasPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0;url=trip.html"><title>Friday · Your journey</title><script>location.replace('trip.html'+location.search+location.hash)</script></head><body><p><a href="trip.html">Continue to your Friday journey</a></p></body></html>`;
}


function tripScripts() {
  const data = loadData();
  const artSrc = fs.readFileSync(path.join(__dirname, 'art.js'), 'utf8');

  const dataJs = `/* Generated by build/trip.js from build/trip-data/. Do not edit. */
window.FridayTrip=window.FridayTrip||{};FridayTrip.DESTINATIONS=${json(data.DESTINATIONS)};FridayTrip.ORDER=${json(data.ORDER)};FridayTrip.TRIP_TYPES=${json(data.TRIP_TYPES)};
`;

  const artJs = `/* Generated by build/trip.js from build/art.js. Do not edit. */
window.FridayTrip=window.FridayTrip||{};
(function () {
  var module = { exports: {} };
  var exports = module.exports;
  (function (module, exports) {
${artSrc}
  })(module, exports);
  FridayTrip.plate = module.exports.plate;
  FridayTrip.PALETTES = module.exports.PALETTES;
  FridayTrip.SCENE_KEYS = module.exports.SCENE_KEYS;
})();
`;

  return { 'assets/js/trip-data.js': dataJs, 'assets/js/trip-art.js': artJs };
}

module.exports = { tripPage, tripBriefingPage, tripScripts, appAliasPage };
