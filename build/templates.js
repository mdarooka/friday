'use strict';

const { plate } = require('./art');
const D = require('./data');

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { siteOrigin, publicUrl } = require('./site-metadata');
const SITE_ORIGIN = siteOrigin();
const SOCIAL_IMAGE = publicUrl('assets/images/friday-social.jpg', SITE_ORIGIN);

/* The <head> font links, shared with the planner page (build/trip.js). */
const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">`;

/* The "Plan a trip" pill in the header. The header text is paper on the dark hero and ink once it
   turns solid (or on light-head pages), so the pill flips with it: a paper pill on the hero, an ink
   pill on paper. It reuses .btn--solid, which reads its colours from --fg / --bg. */
const PLAN_CTA_CSS = `.nav__cta{--fg:var(--paper);--bg:var(--ink);margin-left:clamp(.4rem,1vw,1rem)}
.head.is-solid .nav__cta,.head.is-light .nav__cta{--fg:var(--ink);--bg:var(--paper)}
.hero__cta{--bg:var(--ink);--accent:var(--ochre);flex:none;margin-right:auto}`;

/* ------------------------------------------------------------- fragments */

const eyebrow = (t, mod = '') => `<p class="eyebrow ${mod}">${t}</p>`;

/** A generated print, framed. */
function Plate(seed, opts = {}) {
  const cls = ['plate'];
  if (opts.ratio) cls.push(`plate--ratio-${opts.ratio}`);
  if (opts.arch) cls.push(opts.arch === 'deep' ? 'plate--arch-deep' : 'plate--arch');
  if (opts.fill) cls.push('plate--fill');
  if (opts.class) cls.push(opts.class);
  const ratioMap = { p: 'portrait', l: 'landscape', s: 'square', w: 'panorama', t: 'portrait' };
  return `<div class="${cls.join(' ')}">${plate(seed, {
    scene: opts.scene, tone: opts.tone, ratio: opts.svgRatio || ratioMap[opts.ratio] || 'portrait',
  })}</div>`;
}

/** Section header: hairline, eyebrow + note on the left, statement on the right. */
function SecHead({ eyebrow: eb, note, title, link, cta }) {
  return `<div class="sec-head" data-reveal>
      <div class="sec-head__aside">
        ${eyebrow(eb)}
        ${note ? `<p class="card__d" style="margin:0">${note}</p>` : ''}
        ${link ? `<p style="margin:.6rem 0 0"><a class="link" href="${link}">${cta || 'View all'} <span class="arrow">&rarr;</span></a></p>` : ''}
      </div>
      <h2 class="h2">${title}</h2>
    </div>`;
}

const facts = (list) => `<dl class="facts" data-reveal>${list
  .map((f) => `<div class="fact"><dt>${f.k}</dt><dd>${f.v}</dd></div>`).join('')}</dl>`;

const practice = (list) => `<div class="practice" data-reveal>${list
  .map((p) => `<div class="practice__i"><h3 class="practice__t">${p.t}</h3><p class="practice__d">${p.d}</p></div>`).join('')}</div>`;

const places = (list) => `<div class="places" data-reveal>${list
  .map((p) => `<div class="place"><p class="place__p" style="margin:0">${p.p}</p><p class="place__d" style="margin:0">${p.d}</p></div>`).join('')}</div>`;

const quote = (q, wide) => `<blockquote class="quote ${wide ? 'quote--wide' : ''}" data-reveal>
    <p class="quote__t">&ldquo;${q.t}&rdquo;</p>
    <p class="quote__a">${q.a}</p>
  </blockquote>`;

/* Alliance monograms — drawn, not photographed. */
const GLYPH = {
  circle:   '<circle cx="22" cy="22" r="15" fill="none" stroke="currentColor"/><circle cx="22" cy="22" r="4" fill="currentColor"/>',
  square:   '<rect x="7" y="7" width="30" height="30" fill="none" stroke="currentColor"/><path d="M7 22h30M22 7v30" stroke="currentColor"/>',
  cross:    '<path d="M22 5v34M5 22h34" stroke="currentColor"/><circle cx="22" cy="22" r="7" fill="none" stroke="currentColor"/>',
  triangle: '<path d="M22 6 38 36H6Z" fill="none" stroke="currentColor"/><path d="M22 18 30 32H14Z" fill="currentColor" opacity=".5"/>',
  arch:     '<path d="M8 38V21a14 14 0 0 1 28 0v17" fill="none" stroke="currentColor"/><path d="M16 38V22a6 6 0 0 1 12 0v16" fill="none" stroke="currentColor" opacity=".55"/>',
  bar:      '<path d="M8 34h6V14H8zM19 34h6V6h-6zM30 34h6V22h-6z" fill="none" stroke="currentColor"/>',
};
const glyph = (k) => `<svg class="mark-glyph" viewBox="0 0 44 44" aria-hidden="true" fill="none" stroke-width="1"><g>${GLYPH[k] || GLYPH.circle}</g></svg>`;

/* -------------------------------------------------------------- the head */

function Header(active) {
  const currentAttr = (href) => (active === href ? ' aria-current="page"' : '');
  const topLink = (href, label, extra = '') => `<a class="nav__link${extra}" href="${href}"${currentAttr(href)}>${label}</a>`;

  return `
<header class="head" data-head>
  <div class="head__in">
    <a class="wordmark" href="index.html" aria-label="${esc(D.brand.name)} — home">
      <span class="wordmark__name">${esc(D.brand.name)}</span>
    </a>

    <nav class="nav" aria-label="Primary">
      ${topLink('villas.html', 'Villas')}
      ${topLink('departures.html', 'Packages')}
      ${topLink('about.html', 'About Friday')}
      ${topLink('help.html', 'Help &amp; contact')}
      <a class="nav__link" href="trip.html" data-nav-auth>Sign in</a>
      <a class="btn btn--sm btn--solid nav__cta" href="trip.html"${currentAttr('trip.html')}>Plan a trip</a>
    </nav>

    <button class="burger" aria-expanded="false" aria-controls="site-menu">
      <span class="burger__txt">Menu</span>
      <span class="burger__bars" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
  </div>
</header>

<div class="menu" id="site-menu">
  <div class="wrap">
    <div class="menu__grid">
      <div class="menu__col">
        <p class="menu__h">Explore</p>
        <a class="menu__link" href="villas.html"${currentAttr('villas.html')}>Villas</a>
        <a class="menu__link" href="departures.html"${currentAttr('departures.html')}>Packages</a>
      </div>
      <div class="menu__col">
        <p class="menu__h">Your trip</p>
        <a class="menu__link" href="trip.html"${currentAttr('trip.html')}>Plan a trip</a>
        <a class="menu__link menu__link--sm" href="trip.html#/"${active === 'trip.html' ? ' aria-current="page"' : ''}>My trips</a>
        <a class="menu__link menu__link--sm" href="trip.html#/bookings">Bookings</a>
        <a class="menu__link menu__link--sm" href="trip.html" data-menu-auth>Sign in</a>
      </div>
      <div class="menu__col">
        <p class="menu__h">Help</p>
        <a class="menu__link" href="help.html"${currentAttr('help.html')}>Help &amp; FAQs</a>
        <a class="menu__link menu__link--sm" href="contact.html"${currentAttr('contact.html')}>Contact Friday</a>
      </div>
      <div class="menu__col">
        <p class="menu__h">Friday</p>
        <a class="menu__link" href="about.html"${currentAttr('about.html')}>About Friday</a>
        <p class="menu__h" style="margin-top:2.2rem">For villa owners</p>
        <a class="menu__link menu__link--sm" href="partner.html"${currentAttr('partner.html')}>List your villa</a>
      </div>
    </div>
  </div>
</div>`;
}

/* ------------------------------------------------------------ the footer */

function Footer() {
  const col = (h, items) => `<div class="foot__col">
      <p class="foot__h">${h}</p>
      <ul class="foot__list">${items.map((i) => `<li><a href="${i.href}">${i.label}</a></li>`).join('')}</ul>
    </div>`;

  return `
<footer class="foot inverse">
  <div class="wrap">
    <div class="foot__grid">
      ${col('Explore', [
        { label: 'Villas', href: 'villas.html' },
        { label: 'Packages', href: 'departures.html' },
        { label: 'Kerala guide', href: 'kerala-guide.html' },
        { label: 'Plan a trip', href: 'trip.html' },
      ])}
      ${col('Your trip', [
        { label: 'My trips', href: 'trip.html#/' },
        { label: 'Bookings', href: 'trip.html#/bookings' },
        { label: 'Sign in', href: 'trip.html' },
      ])}
      ${col('Help', [
        { label: 'Help & FAQs', href: 'help.html' },
        { label: 'Contact Friday', href: 'contact.html' },
      ])}
      ${col('Friday', [
        { label: 'About Friday', href: 'about.html' },
        { label: 'Privacy policy', href: 'privacy.html' },
        { label: 'Terms of use', href: 'terms.html' },
      ])}
      ${col('For villa owners', [{ label: 'List your villa', href: 'partner.html' }])}
    </div>

    <div class="foot__bar">
      <span>&copy; <span data-year>2026</span> ${D.brand.name}</span>
      <span>${D.brand.location}</span>
    </div>
  </div>
</footer>`;
}

/* ------------------------------------------------------------ the shell */

function layout({ title, description, body, active, lightHead, canonical, extraStyles = [], extraScripts = [] }) {
  const canonicalHref = canonical ? publicUrl(canonical, SITE_ORIGIN) : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} &middot; ${esc(D.brand.name)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#F4F1EA">
<meta property="og:title" content="${esc(title)} · ${esc(D.brand.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${esc(SOCIAL_IMAGE)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A coastal travel scene with Friday’s thoughtful journeys message">
<meta name="twitter:card" content="summary_large_image">
${canonicalHref ? `<link rel="canonical" href="${esc(canonicalHref)}">\n<meta property="og:url" content="${esc(canonicalHref)}">` : ''}
${FONT_LINKS}
<link rel="stylesheet" href="assets/css/friday.css">
${extraStyles.map((href) => `<link rel="stylesheet" href="${esc(href)}">`).join('\n')}
<style>${PLAN_CTA_CSS}</style>
</head>
<body${lightHead ? ' data-light-head' : ''}>
<a class="skip" href="#main">Skip to content</a>
${Header(active)}
<main id="main">
${body}
</main>
${Footer()}
<script src="assets/js/quote-analytics.js"></script>
<script src="assets/js/friday.js"></script>
${extraScripts.map((src) => `<script src="${esc(src)}"></script>`).join('\n')}
</body>
</html>`;
}

/* ------------------------------------------------------- shared sections */

/** Interior page masthead. */
function PageHero({ eyebrow: eb, title, lede, meta, seed, scene, tone, seedReveal = 'mask' }) {
  return `<section class="phero wrap">
    <div class="phero__grid">
      <div class="phero__title">
        ${eyebrow(eb)}
        <h1 class="h1" style="margin-top:1.1rem" data-reveal>${title}</h1>
        ${lede ? `<p class="lede" style="margin-top:1.6rem" data-reveal>${lede}</p>` : ''}
      </div>
      <div class="phero__side">
        ${meta ? `<div class="stack stack--sm" data-reveal>${meta.map((m) => `<div><p class="eyebrow">${m.k}</p><p style="margin:.25rem 0 0;font-family:var(--serif);font-size:1.2rem">${m.v}</p></div>`).join('')}</div>` : ''}
      </div>
    </div>
    ${seed ? `<div class="phero__art" style="margin-top:clamp(2.4rem,5vw,4.5rem)"${seedReveal ? ` data-reveal="${esc(seedReveal)}"` : ''}>${Plate(seed, { ratio: 'w', scene, tone, svgRatio: 'panorama' })}</div>` : ''}
  </section>`;
}

/** Closing call — appears at the foot of every interior page. */
function Closer({ title, text, cta = 'Contact Friday', href = 'contact.html', seed = 'closer', scene = 'peaks', tone = 'slate' }) {
  return `<section class="section inverse">
    <div class="wrap">
      <div class="grid" style="align-items:center">
        <div class="c-5 c-md-12">
          <p class="closer__mark" data-reveal>${esc(D.brand.name)}</p>
        </div>
        <div class="c-6 s-7 c-md-12">
          ${eyebrow('Next')}
          <h2 class="h2" style="margin-top:1rem" data-reveal>${title}</h2>
          <p class="lede" style="margin-top:1.4rem" data-reveal>${text}</p>
          <p style="margin-top:2.2rem" data-reveal><a class="btn" href="${href}">${cta} <span class="arrow">&rarr;</span></a></p>
        </div>
      </div>
    </div>
  </section>`;
}

/** The ten, as a catalogue with a sticky preview plate. */
function Catalogue(items, { previewClass = '' } = {}) {
  return `<div class="catalogue" data-catalogue>
    <div class="cat-list" data-reveal>
      ${items.map((c) => `<a class="cat-row" href="composition-${c.slug}.html" data-title="${esc(c.title)}" data-num="${c.num}">
        <span class="num">${c.num}</span>
        <span>
          <span class="cat-row__t">${c.title}</span>
          <span class="cat-row__k">${c.kicker}</span>
        </span>
        <span class="cat-row__go">Open</span>
      </a>`).join('')}
    </div>
    <div class="cat-preview ${previewClass}">
      <div class="cat-preview__stack">
        ${items.map((c) => `<div class="cat-preview__item">${Plate(`cat-${c.slug}`, { scene: c.scene, tone: c.tone, arch: true, fill: false, class: '' })}</div>`).join('')}
      </div>
      <div class="cat-preview__cap">
        <span data-cap-title></span><span data-cap-num></span>
      </div>
    </div>
  </div>`;
}

module.exports = {
  FONT_LINKS, esc, eyebrow, Plate, SecHead, facts, practice, places, quote, glyph,
  layout, PageHero, Closer, Catalogue, D,
};
