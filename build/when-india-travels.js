'use strict';
/*
 * when-india-travels.js - the markup for /when-india-travels.html and the homepage teaser.
 * All data comes from ./data/india-breaks.js. Every row is rendered statically (the page works without JavaScript);
 * assets/js/when-india-travels.js only filters rows by region.
 */
const B = require('./data/india-breaks');

const PAGE = 'when-india-travels.html';
const LABEL = 'When India travels';

/* JSON for a <script type="application/json"> block: keep "<" and U+2028/9 from ending the tag or the string. */
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));

const nightsLabel = (n) => `${n} night${n === 1 ? '' : 's'}`;

const topicFor = (brk, place) => `${brk.name} \u00b7 ${place}`;

const regionLabel = (brk) => (B.isPureNational(brk) ? 'National' : brk.regions.filter((r) => r !== 'national').map((r) => B.REGION_NAMES[r] || r).join(', '));

const normPlace = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* The guide for a suggested place, from the guide registry passed in by generate.js ([{ file, label, names }]). */
const guideFor = (guides, place) => (guides || []).find((g) => g.names.includes(normPlace(place))) || null;

function suggestionHtml(esc, brk, sug, guides) {
  const data = `data-break-id="${esc(brk.id)}" data-break-place="${esc(sug.place)}"`;
  const dates = `start=${sug.start}&nights=${sug.nights}`;
  const guide = guideFor(guides, sug.place);
  const ctas = guide
    ? `<a class="btn btn--sm" href="${esc(`${guide.file}?${dates}&from=india_breaks`)}" data-break-cta="guide" ${data}>Read the ${esc(guide.label)} guide <span class="arrow">&rarr;</span></a>`
    : `<a class="btn btn--sm" href="${esc(`trip.html?place=${encodeURIComponent(sug.place)}&${dates}`)}" data-break-cta="planner" ${data}>Plan with Friday <span class="arrow">&rarr;</span></a> <a class="link" href="${esc(`contact.html?topic=${encodeURIComponent(topicFor(brk, sug.place))}#callback-title`)}" data-break-cta="callback" ${data}>Talk to a designer <span class="arrow">&rarr;</span></a>`;
  const suggested = sug.start !== brk.startDate || sug.nights !== brk.nights
    ? `<p class="lw-pick__meta">Suggested: ${esc(B.formatRange(sug.start, addNights(sug.start, sug.nights)))} \u00b7 ${nightsLabel(sug.nights)}</p>` : '';
  return `<div class="lw-pick" data-reveal>
        <h4 class="lw-pick__t">${esc(sug.place)}</h4>
        <p class="lw-pick__why">${esc(sug.reason)}</p>
        ${sug.caveat ? `<p class="lw-pick__caveat"><span>Worth knowing</span> ${esc(sug.caveat)}</p>` : ''}
        ${suggested}
        <p class="lw-pick__cta">${ctas}</p>
      </div>`;
}

function addNights(startDate, nights) {
  const d = new Date(Date.parse(`${startDate}T00:00:00Z`) + nights * 86400000);
  return d.toISOString().slice(0, 10);
}

function rowHtml(esc, brk, guides) {
  return `<article class="lw-break" id="${esc(brk.id)}" data-wit-row data-regions="${esc(brk.regions.join(' '))}" data-end="${esc(brk.endDate)}" aria-labelledby="${esc(brk.id)}-h">
      <header class="lw-break__head">
        <p class="eyebrow eyebrow--accent">${esc(brk.dates)} \u00b7 ${nightsLabel(brk.nights)} \u00b7 ${esc(regionLabel(brk))}</p>
        <h3 class="h3" id="${esc(brk.id)}-h">${esc(brk.name)}</h3>
        <p class="lw-break__note">${esc(brk.note)}</p>
        ${brk.verified ? '' : '<p class="lw-break__note lw-break__tbc" data-wit-tbc>Date still to be confirmed.</p>'}
      </header>
      <div class="lw-picks">${brk.suggestions.map((sug) => suggestionHtml(esc, brk, sug, guides)).join('')}</div>
    </article>`;
}

function groupSection(esc, group, today, guides) {
  const rows = B.upcomingBreaks(today, { group });
  if (!rows.length) return '';
  const t = B.GROUP_TITLES[group];
  return `<section class="lw-city" id="${esc(group)}" data-wit-group="${esc(group)}" aria-labelledby="${esc(group)}-h">
  <div class="wrap">
    <p class="eyebrow">${esc(t.eyebrow)}</p>
    <h2 class="h2" id="${esc(group)}-h">${esc(t.title)}</h2>
    ${rows.map((brk) => rowHtml(esc, brk, guides)).join('')}
  </div>
</section>`;
}

/* What the browser script needs: the region filters (the page and the homepage carousel both filter by state). */
function clientData() {
  return { default: B.DEFAULT_REGION, filters: B.REGION_FILTERS };
}

const dataScript = () => `<script type="application/json" id="wit-data">${safeJson(clientData())}</script>`;

function whenIndiaTravelsBody({ PageHero, esc, today, guides }) {
  return `
${PageHero({
    eyebrow: 'Long weekends &amp; holidays',
    title: 'When India<br>travels.',
    lede: 'India plans around a few big breaks, and they differ by city and state. Here is how a Friday designer would use each one: a couple of ideas for where to go, what to watch for, and when to ask for a call. Friday plans trips anywhere, so treat them as starting points. Friday is still designed in Bombay.',
    background: 'assets/illustrations/friday-when-india-travels.svg',
    meta: [{ k: 'Showing', v: '<span data-wit-region-name>All regions</span>' }, { k: 'Dates', v: 'Checked against official lists, October 2026' }],
  })}
<section class="section section--tight lw-picker" aria-labelledby="wit-filter-h">
  <div class="wrap">
    <h2 class="eyebrow" id="wit-filter-h">Show breaks for</h2>
    <ul class="lw-cities">${B.REGION_FILTERS.map((f) => `<li><a class="lw-city-link" href="?region=${esc(f.key)}" data-wit-filter="${esc(f.key)}">${esc(f.label)}</a></li>`).join('')}</ul>
    <p class="lw-status" data-wit-status role="status" aria-live="polite"></p>
  </div>
</section>
<div class="lw-cities-list" data-wit-list>
${B.GROUPS.map((g) => groupSection(esc, g, today, guides)).join('\n')}
</div>
<section class="section section--tight" aria-labelledby="wit-close-h"><div class="wrap">
  <p class="eyebrow">Closer to home</p>
  <h2 class="h2" id="wit-close-h">A short escape instead?</h2>
  <p class="lede lw-close" style="margin-top:1rem">For two quiet nights near Bombay, read <a class="link" href="mumbai-quiet-weekend.html">the quiet weekend guide <span class="arrow">&rarr;</span></a> Or browse <a class="link" href="guides.html">the destination guides <span class="arrow">&rarr;</span></a></p>
  <p class="lw-fineprint">Dates come from central and state holiday lists and school calendars, checked in October 2026. Dates that depend on the moon can move by a day, and a few 2027 lists are still to be confirmed (those rows say so). Check with your employer or school before you plan. Friday does not book anything here: a designer closes your trip with you by call or quote.</p>
</div></section>
${dataScript(today)}`;
}

/* One sentence for a card: the first sentence of the break's public note. */
const firstSentence = (text) => {
  const t = String(text || '').trim();
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : t;
};

/* The card's date line has to stay on one line: "17\u201320 Oct" when the break starts this year, "14\u201317 Jan 2027" for a short
   break in a later year, and no year at all for a range that runs across two months ("11 Apr \u2013 31 May"; the page has the full dates). */
function cardDates(brk, today) {
  if (brk.dates.includes(' \u2013 ')) return brk.dates.replace(/ \d{4}/g, '');
  return brk.startDate.slice(0, 4) === B.isoDay(today).slice(0, 4) ? brk.dates.replace(/ \d{4}$/, '') : brk.dates;
}

function breakCardHtml(esc, brk, today) {
  const first = brk.suggestions[0];
  return `<li class="wit-card-item" data-wit-card data-regions="${esc(brk.regions.join(' '))}" data-end="${esc(brk.endDate)}">
          <a class="wit-card" href="${PAGE}#${esc(brk.id)}">
            <p class="eyebrow eyebrow--accent wit-card__dates">${esc(cardDates(brk, today))} \u00b7 ${nightsLabel(brk.nights)}</p>
            <h3 class="h3 wit-card__t">${esc(brk.name)}</h3>
            <p class="wit-card__note">${esc(firstSentence(brk.note))}</p>
            ${first ? `<p class="wit-card__idea">First idea: <span>${esc(first.place)}</span></p>` : ''}
          </a>
        </li>`;
}

/* The homepage section: the heading on the left, a scroll-snap carousel of every upcoming break on the right.
   Without JavaScript it is a horizontally scrollable row (the arrow buttons stay hidden until the script runs). */
function homeTeaser({ esc, today }) {
  const rows = B.upcomingBreaks(today);
  if (!rows.length) return '';
  return `<section class="section section--tight home-breaks" data-wit-teaser aria-labelledby="home-breaks-title">
  <div class="wrap home-breaks__grid">
    <div class="home-breaks__text" data-reveal>
      <p class="eyebrow">${LABEL}</p>
      <h2 class="h2" id="home-breaks-title">When India<br><em>travels.</em></h2>
      <p class="lede">The long weekends, festival breaks and school holidays coming up, and the places that suit each one.</p>
      <p><a class="link" data-wit-teaser-link href="${PAGE}">See every break <span class="arrow">&rarr;</span></a></p>
    </div>
    <div class="home-breaks__carousel" data-reveal style="--i:1" data-wit-carousel role="group" aria-roledescription="carousel" aria-label="Upcoming breaks">
      <ul class="wit-track" data-wit-track>
        ${rows.map((brk) => breakCardHtml(esc, brk, today)).join('\n        ')}
      </ul>
      <div class="wit-nav" data-wit-nav hidden>
        <button class="wit-nav__btn" type="button" data-wit-prev aria-label="Previous breaks" disabled><span aria-hidden="true">&larr;</span></button>
        <button class="wit-nav__btn" type="button" data-wit-next aria-label="Next breaks"><span aria-hidden="true">&rarr;</span></button>
      </div>
    </div>
  </div>
</section>
${dataScript()}`;
}

module.exports = { PAGE, LABEL, whenIndiaTravelsBody, homeTeaser, clientData, topicFor };
