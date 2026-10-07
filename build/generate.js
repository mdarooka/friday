'use strict';

const fs = require('fs');
const path = require('path');
const T = require('./templates');
const D = require('./data');
const { Plate, SecHead, eyebrow, facts, practice, places, quote, glyph, layout, PageHero, Closer, Catalogue } = T;
const { partnerBody } = require('./partner');
const Villas = require('./villas');
const Admin = require('./admin');
const { siteOrigin, sitemapXml, robotsTxt } = require('./site-metadata');
const PUBLIC_ORIGIN = siteOrigin();

const OUT = path.join(__dirname, '..');
const write = (file, html) => {
  fs.writeFileSync(path.join(OUT, file), html);
  return file;
};
const written = [];
const legacyPage = /^(?:ethos|method|designers|alliances|compositions|wild|drive|salon|field-notes|commission)\.html$|^(?:composition-|departure-|note-).+\.html$/;
const page = (file, opts) => {
  if (legacyPage.test(file)) return;
  const privatePage = file === 'admin.html' || file === 'admin-villas.html';
  const extraScripts = [...(privatePage ? [] : ['assets/js/guide-analytics.js']), ...(opts.extraScripts || [])];
  written.push(write(file, layout({ ...opts, extraScripts })));
};

/* ========================================================== 1. Home */

const home = `
<section class="hero">
  <div class="hero__bg">${Plate('hero-friday-vii', { fill: true, scene: 'peaks', tone: 'ember', svgRatio: 'panorama' })}</div>
  <div class="hero__scrim"></div>
  <div class="hero__in wrap">
    <p class="eyebrow" style="color:rgba(244,241,234,.7);margin-bottom:1.6rem">${D.brand.affiliation} &middot; ${D.brand.experience}</p>
    <h1 class="hero__title">
      <span class="hero__line" style="--i:0"><span>Friday,</span></span>
      <span class="hero__line hero__line--indent hero__line--fit" style="--i:1"><span><em>your travel designer.</em></span></span>
    </h1>
    <div class="hero__meta">
      <p class="hero__note">Plan a trip with Friday&rsquo;s AI, explore villa stays and nearby places, or start with a sample journey.</p>
      <a class="btn btn--solid hero__cta" href="trip.html">Plan a trip with Friday <span class="arrow">&rarr;</span></a>
      <a class="scrollcue" href="#offerings"><i></i> Explore</a>
    </div>
  </div>
</section>

<section class="section" id="offerings">
  <div class="wrap" id="discover-title">
    <div class="home-offerings-head">
      ${eyebrow('Travel, your way')}
      <p>Start with a place, an itinerary idea, or a blank page.</p>
    </div>
    <div class="grid" style="margin-top:clamp(1.5rem,3vw,2.5rem)">
      <article class="c-4 c-md-12" data-reveal>
        <a class="card" href="villas.html" data-cursor="Explore"><div class="card__plate offering-art"><img src="assets/illustrations/friday-villas.svg" width="1200" height="760" alt="Illustration of a villa among green terraces" loading="lazy" decoding="async"></div>
          <p class="eyebrow eyebrow--accent">Villas</p><h3 class="card__t">Stay somewhere<br>with a sense of place.</h3>
          <p class="card__d">Explore published homes, see where they sit, and ask Friday for nearby places to visit.</p>
        </a>
      </article>
      <article class="c-4 c-md-12" data-reveal style="--i:1">
        <a class="card" href="departures.html" data-cursor="Explore"><div class="card__plate offering-art"><img src="assets/illustrations/friday-package-parcel.svg" width="1200" height="760" alt="Illustration of a traditional paper-wrapped travel parcel" loading="lazy" decoding="async"></div>
          <p class="eyebrow eyebrow--accent">Packages</p><h3 class="card__t">Begin with a sample<br>journey.</h3>
          <p class="card__d">Use Friday&rsquo;s example itineraries as inspiration. Ask Friday about current dates, pricing and availability.</p>
        </a>
      </article>
      <article class="c-4 c-md-12" data-reveal style="--i:2">
        <a class="card" href="trip.html" data-cursor="Plan"><div class="card__plate offering-art"><img src="assets/illustrations/friday-folded-itinerary-map.svg" width="1200" height="760" alt="Illustration of an open folded map with an itinerary route and selected stops" loading="lazy" decoding="async"></div>
          <p class="eyebrow eyebrow--accent">Friday AI</p><h3 class="card__t">Shape a trip<br>around you.</h3>
          <p class="card__d">Share a destination and the way you want to travel. Friday helps draft and refine your plan.</p>
        </a>
      </article>
    </div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    <div class="home-trip-intro" data-reveal>
      ${eyebrow('Your trip, together')}
      <h2 class="h2">From first idea<br>to the details.</h2>
      <p class="home-trip-intro__note">Keep a working plan and its details in one place.</p>
    </div>
    <div class="grid home-trip-columns">
      <div class="c-6 c-md-12 prose home-trip-col" data-reveal>
        <p class="eyebrow">My trips</p>
        <p>Use Friday&rsquo;s planner to draft an itinerary, save places you are considering, and keep booking details with your trip.</p>
        <p style="margin-top:1.2rem"><a class="link" href="trip.html#/">Open my trips <span class="arrow">&rarr;</span></a></p>
      </div>
      <div class="c-6 c-md-12 prose home-trip-col" data-reveal style="--i:1">
        <p class="eyebrow">Bookings</p>
        <p>Have a reservation already? Add its details to your trip so your plans are easy to find together.</p>
        <p style="margin-top:1.2rem"><a class="link" href="trip.html#/bookings">View bookings <span class="arrow">&rarr;</span></a></p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tight home-about-feature">
  <div class="wrap">
    <div class="grid home-about-feature__grid">
      <div class="c-6 c-md-12 home-about-feature__art" data-reveal>
        <img src="assets/illustrations/friday-weekend-world.svg" width="1200" height="750" alt="An open terracotta travel case unfolds into a tiny coastal world, with a winding route and paper plane" loading="lazy" decoding="async">
      </div>
      <div class="c-6 c-md-12 home-about-feature__copy" data-reveal style="--i:1">
        ${eyebrow('A Kusum Travels brand')}
        <h2 class="h2">22 years of experience.<br><em>A fresh way to travel.</em></h2>
        <p class="lede">Friday is a travel designer from Bombay. With 22 years of travel experience behind it, Friday brings a thoughtful perspective to finding a starting point, following what interests you, and shaping a journey that feels like yours.</p>
        <p style="margin-top:1.6rem"><a class="link" href="about.html">Meet Friday <span class="arrow">&rarr;</span></a></p>
      </div>
    </div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap grid" style="align-items:center">
    <div class="c-5 c-md-12"><p class="closer__mark" data-reveal>Friday</p></div>
    <div class="c-6 s-7 c-md-12">
      ${eyebrow('Start planning')}
      <h2 class="h2" style="margin-top:1rem" data-reveal>Tell us what<br>you&rsquo;re imagining.</h2>
      <p class="lede" style="margin-top:1.3rem" data-reveal>Start with Friday&rsquo;s AI planner or send a note about the trip you have in mind.</p>
      <p style="margin-top:2rem" data-reveal><a class="btn" href="trip.html">Plan a trip <span class="arrow">&rarr;</span></a> <a class="link" style="margin-left:1rem" href="contact.html">Contact Friday <span class="arrow">&rarr;</span></a></p>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap grid" style="align-items:center">
    <div class="c-5 c-md-12">
      ${eyebrow('Field notes by email')}
      <h2 class="h3" style="margin-top:.8rem">A note from Friday, now and then.</h2>
      <p class="card__d">Occasional travel ideas and studio notes. Unsubscribe from marketing emails at any time.</p>
    </div>
    <div class="c-6 s-7 c-md-12">
      <form data-subscribe novalidate>
        <label class="field__label" for="newsletter-email">Email address</label>
        <div class="subscribe">
          <input class="field__input" id="newsletter-email" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
          <button type="submit">Subscribe <span class="arrow">&rarr;</span></button>
        </div>
        <label class="field__label" style="display:flex;gap:.65rem;align-items:flex-start;margin-top:.9rem;font-weight:400">
          <input name="consent" type="checkbox" value="true" required style="margin-top:.25rem">
          <span>I agree to receive occasional marketing emails from Friday.</span>
        </label>
      </form>
      <p data-subscribe-note role="status" hidden>Thanks for subscribing. Check your inbox for confirmation.</p>
    </div>
  </div>
</section>
`;

page('index.html', { title: 'Your travel designer', description: 'Friday is an AI travel designer from Bombay. Explore villas and sample packages, or shape a trip with Friday.', body: home });

/* ======================================================== Kerala guide */

const KERALA = require('./trip-data/kerala');
const guideAreaOrder = ['kochi', 'munnar', 'thekkady', 'alleppey', 'kumarakom', 'varkala', 'kovalam'];
const guideAreas = guideAreaOrder.map((id) => {
  const area = KERALA.areas.find((item) => item.id === id);
  const stops = Object.values(KERALA.places).filter((place) => place.area === id && place.kind !== 'stay').slice(0, 3);
  return `<article class="c-4 c-md-12" data-reveal><div class="prose"><p class="eyebrow eyebrow--accent">${T.esc(area.name)}</p><h3 class="h3">${T.esc(area.town)}</h3><ul>${stops.map((place) => `<li><strong>${T.esc(place.name)}</strong>${place.blurb ? ` — ${T.esc(place.blurb)}` : ''}</li>`).join('')}</ul></div></article>`;
}).join('');
const keralaGuide = `
${PageHero({
  eyebrow: 'A Friday field guide',
  title: 'A slower way<br>through Kerala.',
  lede: 'A practical starting point for a Kerala trip: choose a pace, pair the hills with the backwaters or coast, and leave room for the transfers between them.',
  seed: 'kerala-guide-backwaters', scene: 'isles', tone: 'jade',
})}
<section class="section section--tight"><div class="wrap">
  <div class="grid" style="align-items:start">
    <article class="c-6 c-md-12 prose" data-reveal>
      <p class="eyebrow">How many days do you need in Kerala?</p>
      <h2 class="h2">Start with the days you have.</h2>
      <p>Friday’s Kerala planner uses three starting points: a 4–5 day escape, an unhurried week, or a longer two-week loop. They are prompts, not fixed packages. For a shorter trip, choose a smaller part of the state rather than trying to join every coast, hill and backwater stop.</p>
    </article>
    <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
      <p class="eyebrow">When is the best time to visit Kerala?</p>
      <h2 class="h2">Match the season to the trip.</h2>
      <p>Kerala Tourism describes November to February as pleasant, and notes that the monsoon brings heavy rain in some periods. Its guidance also varies by activity and region: its backwater advice points to October–February for houseboat cruises. Check current weather and local operating guidance before booking; this guide does not confirm live conditions.</p>
      <p><a class="link" href="https://www.keralatourism.org/faq/20-things-to-know-before-you-visit-kerala" target="_blank" rel="noopener noreferrer">Read Kerala Tourism’s seasonal advice <span class="arrow">&rarr;</span></a></p>
    </article>
  </div>
</div></section>
<section class="section inverse"><div class="wrap">
  <p class="eyebrow">Where to go</p>
  <h2 class="h2">Which places fit<br>one Kerala trip?</h2>
  <p class="lede" style="max-width:42em;margin-top:1rem">These are places from Friday’s hand-researched destination catalogue. Pick a few around the experience you want; check routes and opening details for your own dates.</p>
  <div class="grid" style="margin-top:2rem">${guideAreas}</div>
</div></section>
<section class="section"><div class="wrap grid" style="align-items:start">
  <article class="c-6 c-md-12 prose" data-reveal>
    <p class="eyebrow">Backwaters</p>
    <h2 class="h2">Is Alleppey or Kumarakom better for a houseboat?</h2>
    <p>There is no single best choice for every route. Friday’s catalogue lists a houseboat cruise in Alleppey (Alappuzha) and a sunset cruise on Vembanad Lake in Kumarakom; it does not say one is better. If an overnight stay matters, confirm availability, route, operator rules and current prices directly—these sample listings are not live booking details.</p>
    <p><a class="link" href="https://www.keralatourism.org/destination/alappuzha-beach/60/" target="_blank" rel="noopener noreferrer">Kerala Tourism’s Alappuzha guide <span class="arrow">&rarr;</span></a></p>
  </article>
  <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
    <p class="eyebrow">Budget</p>
    <h2 class="h2">What does a Kerala trip cost?</h2>
    <p>This catalogue does not provide a current, trip-wide cost. Your total depends on dates, group size, route, stays and boat choices; Friday’s sample place data is not a live quote. Share your dates and what matters to you before making a budget or booking decision.</p>
    <p><a class="link" href="https://www.keralatourism.org/faq/20-things-to-know-before-you-visit-kerala" target="_blank" rel="noopener noreferrer">Kerala Tourism’s travel basics <span class="arrow">&rarr;</span></a></p>
  </article>
</div></section>
<section class="section inverse"><div class="wrap grid" style="align-items:center">
  <div class="c-7 c-md-12"><p class="eyebrow">Take the next step</p><h2 class="h2">Make Kerala<br>your own route.</h2><p class="lede" style="margin-top:1rem">Start with the places that interest you, then shape the pace and dates with Friday.</p></div>
  <div class="c-5 c-md-12" style="display:grid;gap:1rem"><a class="btn" data-guide-cta="planner" href="trip.html?destination=kerala&amp;from_guide=kerala#/new">Plan your Kerala trip <span class="arrow">&rarr;</span></a><a class="link" data-guide-cta="quote" href="contact.html?quote_path=guide&amp;destination=kerala">Ask Friday about a quote <span class="arrow">&rarr;</span></a></div>
</div></section>`;
page('kerala-guide.html', {
  title: 'Kerala Travel Guide: Itineraries, Munnar & Backwaters',
  description: 'Plan a Kerala trip around the time you have, from Kochi and Munnar to Alleppey backwaters and the coast. Browse Friday’s curated places.',
  body: keralaGuide, canonical: 'kerala-guide.html',
});

page('partner.html', { title: 'List your villa', description: 'Introduce your villa to Friday for consideration in its collection of considered places to stay.', body: partnerBody(), active: 'partner.html', lightHead: true, extraStyles: ['assets/css/partner.css'], extraScripts: ['assets/js/partner.js'] });

if (Villas.villasBody && Villas.villaBody && Villas.adminVillasBody) {
  page('villas.html', { title: 'Friday Villas', description: 'Considered villas and places to stay, chosen with care.', body: Villas.villasBody(), active: 'villas.html', lightHead: true, extraStyles: ['assets/css/villas.css'], extraScripts: ['assets/js/villas.js'] });
  page('villa.html', { title: 'A Friday Villa', description: 'Explore a place to stay with Friday.', body: Villas.villaBody(), active: 'villas.html', lightHead: true, extraStyles: ['assets/css/villas.css'], extraScripts: ['assets/js/villas.js'] });
  page('admin-villas.html', { title: 'Villa submissions', description: 'Review villa owner introductions.', body: Villas.adminVillasBody(), lightHead: true, extraStyles: ['assets/css/villas.css'], extraScripts: ['assets/js/villas.js'] });
}

if (Admin && Admin.adminBody) {
  page('admin.html', { title: 'Operations Console', description: 'Friday team operations console for villas, quotes, and AI review.', body: Admin.adminBody(), lightHead: true, extraStyles: ['assets/css/villas.css', 'assets/css/admin.css'], extraScripts: ['assets/js/admin-auth.js', 'assets/js/admin.js'] });
}

const about = `
${PageHero({
  eyebrow: 'About Friday',
  title: 'A travel designer<br>for the way you go.',
  lede: 'Friday is a travel designer from Bombay and a Kusum Travels brand, with 22 years of travel experience behind it. Begin with a villa, a sample journey, or an idea you want to shape into a trip.',
  meta: [{ k: 'Experience', v: D.brand.experience }, { k: 'Brand', v: D.brand.parentName }],
  seed: 'about-friday', scene: 'terraces', tone: 'moss', seedReveal: 'fade',
})}
<section class="section section--tight"><div class="wrap">
  <div class="about-intro" data-reveal>
    ${eyebrow('Ways to begin')}
    <h2 class="h2">Start with a place,<br>an idea or a blank page.</h2>
    <p class="lede">Choose the starting point that suits this trip. Friday can help you explore where to stay, find inspiration, and bring the details into one plan.</p>
  </div>
  <div class="grid about-paths" style="margin-top:clamp(2rem,4vw,3.2rem)">
    <article class="c-4 c-md-12 about-path" data-reveal>
      <p class="eyebrow eyebrow--accent">Villas</p>
      <h3 class="card__t">Stay close to a sense of place.</h3>
      <p class="card__d">Explore published villas with mapped locations and nearby places to help you imagine your time there.</p>
      <p><a class="link" href="villas.html">Explore villas <span class="arrow">&rarr;</span></a></p>
    </article>
    <article class="c-4 c-md-12 about-path" data-reveal style="--i:1">
      <p class="eyebrow eyebrow--accent">Packages</p>
      <h3 class="card__t">Begin with a sample journey.</h3>
      <p class="card__d">Use example itineraries as inspiration. Ask Friday to confirm current dates, pricing and availability.</p>
      <p><a class="link" href="departures.html">Explore packages <span class="arrow">&rarr;</span></a></p>
    </article>
    <article class="c-4 c-md-12 about-path" data-reveal style="--i:2">
      <p class="eyebrow eyebrow--accent">Friday AI</p>
      <h3 class="card__t">Shape the trip as you go.</h3>
      <p class="card__d">Draft an itinerary with Friday, save places you&rsquo;re considering, and keep booking details with your trip.</p>
      <p><a class="link" href="trip.html">Plan a trip <span class="arrow">&rarr;</span></a></p>
    </article>
  </div>
</div></section>
${Closer({ title: 'Let the first idea<br>lead somewhere.', text: 'Start planning with Friday, or <a class="link" href="contact.html">get in touch</a> about the trip you have in mind.', cta: 'Plan a trip', href: 'trip.html', seed: 'about-friday-close', scene: 'peaks', tone: 'ember' })}`;
page('about.html', { title: 'About Friday', description: 'Meet Friday, a travel designer from Bombay and a Kusum Travels brand.', body: about, active: 'about.html', lightHead: true });

const help = `
${PageHero({
  eyebrow: 'Help & contact',
  title: 'A little help<br>for the journey.',
  lede: 'Find your way around Friday, or contact us about a trip, a package or a villa.',
})}
<section class="section section--tight"><div class="wrap">
  <div class="help-list">
    <article class="help-item"><p class="eyebrow">01 &middot; Trip planning</p><h2 class="h3">What can I do with Friday?</h2><p>Draft a trip with Friday&rsquo;s AI planner, save places you are considering, and keep booking details with your trip.</p><a class="link" href="trip.html">Open the trip planner <span class="arrow">&rarr;</span></a></article>
    <article class="help-item"><p class="eyebrow">02 &middot; Bookings</p><h2 class="h3">Does Friday make reservations?</h2><p>The planner helps you organize your trip and record booking details you add. It does not purchase or confirm travel reservations.</p><a class="link" href="trip.html#/bookings">Go to bookings <span class="arrow">&rarr;</span></a></article>
    <article class="help-item"><p class="eyebrow">03 &middot; Packages</p><h2 class="h3">Are package dates and prices confirmed?</h2><p>Packages are sample journeys. Contact Friday to ask about current dates, pricing and availability.</p><a class="link" href="departures.html">Browse sample packages <span class="arrow">&rarr;</span></a></article>
    <article class="help-item"><p class="eyebrow">04 &middot; Villa owners</p><h2 class="h3">How do I introduce a villa?</h2><p>Send the property details and a Google Maps link. Friday reviews each introduction before any property is listed.</p><a class="link" href="partner.html">List your villa <span class="arrow">&rarr;</span></a></article>
    <article class="help-item"><p class="eyebrow">05 &middot; Contact</p><h2 class="h3">How can I reach Friday?</h2><p>Send a trip enquiry or write to the studio.</p><a class="link" href="contact.html">Contact Friday <span class="arrow">&rarr;</span></a><a class="link help-email" href="mailto:${D.brand.email}">${D.brand.email}</a></article>
  </div>
</div></section>`;
page('help.html', { title: 'Help & contact', description: 'Help with planning a trip, managing bookings, sample packages and villa submissions.', body: help, active: 'help.html', lightHead: true });

/* ========================================================== 2. Ethos */

const ethos = `
${PageHero({
  eyebrow: 'Friday &middot; i',
  title: 'We were tired of being<br>sold the same fortnight.',
  lede: 'Friday was founded in 2014 on a single structural decision: that we would be paid by the person travelling, and by no one else. Everything else about how we work follows from it.',
  meta: [{ k: 'Founded', v: '2014' }, { k: 'Studio', v: 'Bombay' }, { k: 'Commissions a year', v: 'Around forty' }],
  seed: 'ethos-hero', scene: 'city', tone: 'slate',
})}

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">${eyebrow('Our story')}</div>
      <div class="c-6 c-md-12 prose prose--drop" data-reveal>
        <p>The studio began as an argument. Its founder had spent four years as an architect and then several more watching well-travelled, well-resourced people come home from expensive journeys mildly disappointed — not because anything had gone wrong, but because nothing had been decided. They had been sold a sequence of the best-known things in a place, at the hours those things are busiest, by somebody paid a percentage on each one.</p>
        <p>The correction seemed obvious and turned out to be structural. A travel agency earns from suppliers, so its incentive is to book more and to book what pays. A design practice earns a fee for its judgement, so its incentive is to be right. Those are different businesses that happen to produce similar-looking documents.</p>
        <p>So we set up as the second one. We charge a design fee, agreed before any work begins. We accept nothing from hotels, guides, shops or ground operators. When a client buys a rug in Oaxaca, we make the introduction and step out of the room. It has cost us a considerable amount of money and it is the only reason our recommendations are worth anything.</p>
        <p>Eleven years on we are six people in two cities, taking on around forty commissions a year. We could take more. We have decided, repeatedly, not to.</p>
      </div>
      <div class="c-3 c-md-12" data-reveal>
        <div data-reveal="mask">${Plate('ethos-side', { ratio: 't', arch: 'deep', scene: 'terraces', tone: 'moss' })}</div>
        <p class="plate-cap"><span>The studio, Kala Ghoda</span><span>Bombay</span></p>
      </div>
    </div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    ${quote({ t: 'The most common revision we make to a first draft is to remove something.', a: 'The studio, on density' }, true)}
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Six principles', note: 'These are not aspirations. They are the constraints the studio actually runs under, and several of them cost us money.', title: 'What we will<br>and will not do.' })}
    <div class="steps" style="margin-top:clamp(2rem,4vw,3.4rem)">
      ${D.principles.map((p, i) => `<div class="step" data-reveal style="--i:${i % 3}">
        <span class="step__n">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="step__t">${p.t}</h3>
        <p class="step__d">${p.d}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <div class="grid" style="align-items:end">
      <div class="c-6 c-md-12" data-reveal="mask">${Plate('ethos-b', { ratio: 'l', scene: 'sea', tone: 'cobalt', svgRatio: 'landscape' })}</div>
      <div class="c-5 s-8 c-md-12">
        ${eyebrow('The count')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>Small on purpose.</h2>
        ${facts([
          { k: 'People in the studio', v: 'Six' },
          { k: 'Commissions a year', v: '~40' },
          { k: 'Correspondents on the ground', v: '211' },
          { k: 'Supplier commission accepted', v: 'None, ever' },
        ])}
      </div>
    </div>
  </div>
</section>

${Closer({
  title: 'If this sounds like<br>an argument you agree with.',
  text: 'Most of our commissions start with somebody describing a trip that was nearly right. That is a very good place to begin.',
  seed: 'closer-ethos', scene: 'peaks', tone: 'rose',
})}
`;
page('ethos.html', { title: 'Our Ethos', description: 'Why Friday charges a design fee and refuses supplier commission — and the six principles that follow from it.', body: ethos, active: 'ethos.html', lightHead: true });

/* ========================================================= 3. Method */

const method = `
${PageHero({
  eyebrow: 'Friday &middot; ii',
  title: 'Five stages, one fee,<br>and a named person<br>awake in your time zone.',
  lede: 'A commission is a piece of design work with a beginning, a drawing stage and a build. Here is exactly how it runs, what it costs, and what we will not do at each point.',
  meta: [{ k: 'First conversation', v: 'Free, 90 minutes' }, { k: 'Design fee', v: 'From £2,400' }, { k: 'Typical lead time', v: '3–9 months' }],
  seed: 'method-hero', scene: 'canyon', tone: 'sand',
})}

<section class="section">
  <div class="wrap">
    <div class="steps">
      ${D.method.map((m, i) => `<div class="step" data-reveal style="--i:${i % 3}">
        <span class="step__n">${m.n}</span>
        <h3 class="step__t">${m.t}</h3>
        <p class="step__d">${m.d}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <div class="grid" style="align-items:center">
      <div class="c-5 c-md-12" data-reveal="mask">${Plate('method-fee', { ratio: 'p', arch: true, scene: 'forest', tone: 'jade' })}</div>
      <div class="c-6 s-7 c-md-12">
        ${eyebrow('What it costs')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>An honest note<br>about the fee.</h2>
        <div class="prose" style="margin-top:1.6rem" data-reveal>
          <p>The design fee starts at £2,400 for a single journey and is agreed in writing before any work begins. Complex commissions — multi-country, multi-generation, a private departure built from nothing — are quoted individually.</p>
          <p>That fee is the entirety of what we earn. Hotels, guides, houses, boats and shops are billed to you at the rate we are given, which is frequently below the public one, and we pass the difference on rather than keeping it. On a substantial journey this usually means the fee is neutral or better.</p>
          <p>If we do not think we can improve on what you would arrange yourself, we say so at the first conversation and charge nothing.</p>
        </div>
        ${facts([
          { k: 'Design fee', v: 'From £2,400' },
          { k: 'Supplier commission', v: 'Declined' },
          { k: 'Rates passed on', v: 'In full' },
        ])}
      </div>
    </div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    ${SecHead({ eyebrow: 'While you travel', title: 'What "on a private<br>line" actually means.' })}
    ${practice([
      { t: 'One named designer', d: 'The person who drew the journey is the person who answers. Never a duty desk.' },
      { t: 'Your hours, not ours', d: 'Cover is rostered to your time zone for the length of the journey.' },
      { t: 'A day file', d: 'Every booking, contact and reference in one document, offline and on your phone.' },
      { t: 'Fixed before you notice', d: 'We are told about a delay before you are, and the next three things move themselves.' },
      { t: 'A debrief afterwards', d: 'Half an hour, honest, and written into the file for the next commission.' },
      { t: 'Nothing to reconcile', d: 'One statement at the end. No vouchers, no reclaiming, no surprises.' },
    ])}
  </div>
</section>

${Closer({
  title: 'The first conversation<br>costs nothing.',
  text: 'Ninety minutes, in the studio or on a call. We ask about the last journey that worked and the one that did not, and we propose nothing at all.',
  seed: 'closer-method', scene: 'isles', tone: 'cobalt',
})}
`;
page('method.html', { title: 'The Method', description: 'Five stages, one design fee, no supplier commission — how a commission at Friday actually runs.', body: method, active: 'method.html', lightHead: true });

/* ====================================================== 4. Designers */

const designers = `
${PageHero({
  eyebrow: 'Friday &middot; iii',
  title: 'Six people. Each one<br>did the work in the<br>field before the desk.',
  lede: 'A small studio is a deliberate constraint. It means the person who takes your first call is the person who draws the journey and answers the phone at four in the morning if a road closes.',
  meta: [{ k: 'Studio', v: 'Six designers' }, { k: 'City', v: 'Bombay' }, { k: 'Correspondents', v: '211, in 84 countries' }],
})}

<section class="section section--flush-top">
  <div class="wrap">
    <p class="plate-cap" style="border-top:1px solid var(--rule);padding-top:1rem;margin-bottom:clamp(1.8rem,3.5vw,3rem)" data-reveal>
      <span>In place of photographs, each of us keeps a plate</span><span>Drawn in the studio</span>
    </p>
    <div class="grid">
      ${D.team.map((p, i) => `<div class="c-4 c-md-6 c-sm-12" data-reveal style="--i:${i % 3}">
        <div data-reveal="mask">${Plate(`team-${p.name}`, { ratio: 't', arch: 'deep', tone: ['slate', 'jade', 'ember', 'ice', 'sand', 'plum'][i % 6] })}</div>
        <h2 class="h3" style="margin-top:1.2rem">${p.name}</h2>
        <p class="eyebrow eyebrow--accent" style="margin-top:.5rem">${p.role}</p>
        <p class="card__d" style="margin-top:.8rem">${p.line}</p>
        <p class="plate-cap" style="border-top:1px solid var(--rule-soft);padding-top:.7rem;margin-top:1rem"><span>Known for</span><span>${p.for}</span></p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    <div class="grid" style="align-items:center">
      <div class="c-6 c-md-12">
        ${eyebrow('Beyond the studio')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>Two hundred and eleven<br>people who walk the ground.</h2>
        <p class="lede" style="margin-top:1.4rem" data-reveal>Our correspondents are not staff and not suppliers. They are cooks, guides, curators, skippers, mechanics and hotel managers in eighty-four countries who check a thing for us because we have known them a long time and we pay them properly for the hour.</p>
        <p style="margin-top:2rem" data-reveal><a class="link" href="alliances.html">How the register works <span class="arrow">&rarr;</span></a></p>
      </div>
      <div class="c-5 s-8 c-md-12" data-reveal="mask">${Plate('designers-corr', { ratio: 'p', scene: 'terraces', tone: 'moss' })}</div>
    </div>
  </div>
</section>

${Closer({
  title: 'You will be working<br>with one of them.',
  text: 'Tell us the shape of what you have in mind and we will put you with whoever in the studio is right for it — not with whoever answered.',
  seed: 'closer-team', scene: 'city', tone: 'slate',
})}
`;
page('designers.html', { title: 'The Designers', description: 'Six designers in Bombay, and 211 correspondents in 84 countries who walk the ground.', body: designers, active: 'designers.html', lightHead: true });

/* ====================================================== 5. Alliances */

const alliances = `
${PageHero({
  eyebrow: 'Friday &middot; iv',
  title: 'The commitments<br>we can be held to.',
  lede: 'Affiliations are usually a wall of logos. We would rather publish the four or five arrangements that actually constrain how the studio behaves, and say who checks them.',
  meta: [{ k: 'Supplier commission', v: 'Declined, always' }, { k: 'Carbon', v: 'Removed at 1.6×' }, { k: 'Audit', v: 'External, annual' }],
  seed: 'alliances-hero', scene: 'arctic', tone: 'ice',
})}

<section class="section">
  <div class="wrap">
    <div class="marks">
      ${D.alliances.map((a, i) => `<div class="mark-i" data-reveal style="--i:${i % 3}">
        ${glyph(a.mark)}
        <div><p class="mark-i__n" style="margin:0">${a.name}</p><p class="mark-i__k">${a.kind}</p><p class="mark-i__d">${a.d}</p></div>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section inverse section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'The ledger', note: 'Published each March, with the auditor named. Figures below are for the year to 31 December 2025.', title: 'Numbers, rather<br>than intentions.' })}
    <div style="margin-top:clamp(2rem,4vw,3rem)">
      ${facts([
        { k: 'Commission accepted from suppliers', v: '£0' },
        { k: 'Passed to communities, no margin', v: '£214,600' },
        { k: 'Conservation contributions', v: '£186,400' },
        { k: 'Carbon removed', v: '1.6× measured' },
        { k: 'Commissions declined as ill-fitting', v: '17' },
        { k: 'Ground visits by the studio', v: '92 days' },
      ])}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="grid" style="align-items:center">
      <div class="c-5 c-md-12" data-reveal="mask">${Plate('alliances-b', { ratio: 'p', arch: true, scene: 'dunes', tone: 'ember' })}</div>
      <div class="c-6 s-7 c-md-12 prose">
        ${eyebrow('The one that matters most')}
        <h2 class="h2" style="margin:1rem 0 1.4rem" data-reveal>Communities set<br>their own terms.</h2>
        <p>Where a journey involves time with a community, the dates, the group size, the conditions and the fee are set by the hosts. We add nothing to that fee and we take nothing from it. Where a visit does not suit — a harvest, a mourning period, a year when they would rather not — we design something else and say why.</p>
        <p>Several of these relationships took years to arrive at a single afternoon. We think that is the correct amount of time.</p>
        <p style="margin-top:1.4rem"><a class="link" href="composition-living-cultures.html">Living Cultures <span class="arrow">&rarr;</span></a></p>
      </div>
    </div>
  </div>
</section>

${Closer({
  title: 'Ask us anything<br>about the ledger.',
  text: 'We publish it because it is checkable. If a figure here matters to how you choose a studio, put the question to us directly.',
  seed: 'closer-alliances', scene: 'sea', tone: 'jade',
})}
`;
page('alliances.html', { title: 'Alliances', description: 'Commission declined, communities paid without margin, carbon removed at 1.6× — the arrangements that constrain the studio, and who audits them.', body: alliances, active: 'alliances.html', lightHead: true });

/* =================================================== 6. Compositions */

const comps = `
${PageHero({
  eyebrow: 'Compositions',
  title: 'Ten dispositions,<br>not ten destinations.',
  lede: 'A composition is a way of building a journey — what it is organised around, what gets removed, and which hour of the day it is designed for. Most commissions borrow from two or three.',
  meta: [{ k: 'Compositions', v: 'Ten' }, { k: 'Typical blend', v: 'Two or three' }, { k: 'Places on file', v: '84 countries' }],
})}

<section class="section section--flush-top">
  <div class="wrap">
    ${Catalogue(D.compositions)}
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    ${SecHead({ eyebrow: 'The whole set', title: 'Every composition,<br>as a print.' })}
    <div class="grid" style="margin-top:clamp(2.2rem,4vw,3.4rem)">
      ${D.compositions.map((c, i) => `<div class="c-3 c-md-6 c-sm-12" data-reveal style="--i:${i % 4}">
        <a class="card" href="composition-${c.slug}.html" data-cursor="Open">
          <div class="card__plate" data-reveal="mask">${Plate(`grid-${c.slug}`, { ratio: 'p', scene: c.scene, tone: c.tone })}</div>
          <div class="card__meta"><span>${c.num}</span><span>&mdash;</span></div>
          <h3 class="card__t">${c.title}</h3>
          <p class="card__d">${c.kicker}</p>
        </a>
      </div>`).join('')}
    </div>
  </div>
</section>

${Closer({
  title: 'Most people arrive<br>with two of these in mind.',
  text: 'Tell us which two, and roughly when. The interesting design work usually happens where they overlap.',
  seed: 'closer-comps', scene: 'terraces', tone: 'moss',
})}
`;
page('compositions.html', { title: 'Compositions', description: 'Ten ways to compose a journey — art and architecture, silence, the table, living cultures, coasts, cold light, craft, rail, residences and sail.', body: comps, active: 'compositions.html', lightHead: true });

/* -------------------------------------------- composition detail ×10 */

D.compositions.forEach((c, idx) => {
  const others = D.compositions.filter((x) => x.slug !== c.slug).slice(0, 4);
  const body = `
${PageHero({
  eyebrow: `Composition ${c.num}`,
  title: c.title,
  lede: c.lede,
  meta: c.facts.map((f) => ({ k: f.k, v: f.v })),
  seed: `comp-hero-${c.slug}`, scene: c.scene, tone: c.tone,
})}

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">
        ${eyebrow(c.kicker)}
      </div>
      <div class="c-6 c-md-12 prose prose--drop" data-reveal>
        ${c.essay.map((p) => `<p>${p}</p>`).join('')}
      </div>
      <div class="c-3 c-md-12">
        <div data-reveal="mask">${Plate(`comp-side-${c.slug}`, { ratio: 't', arch: 'deep', scene: c.scene, tone: c.tone })}</div>
        <p class="plate-cap"><span>${c.title}</span><span>${c.num}</span></p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'In practice', note: 'What this composition actually changes about how the days are built.', title: 'The decisions<br>we make for you.' })}
    <div style="margin-top:clamp(1.8rem,3.5vw,2.8rem)">${practice(c.practice)}</div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    ${quote(c.quote, true)}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-5 c-md-12">
        ${eyebrow('Where it tends to lead')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>Ground we know<br>well enough to argue about.</h2>
        <p class="card__d" style="margin-top:1.2rem" data-reveal>This is not a menu. It is where this composition has taken us most often, and where the studio's own relationships are deepest.</p>
        <div style="margin-top:2rem" data-reveal="mask">${Plate(`comp-places-${c.slug}`, { ratio: 'l', scene: c.scene, tone: c.tone, svgRatio: 'landscape' })}</div>
      </div>
      <div class="c-6 s-7 c-md-12">
        ${places(c.regions)}
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Composes well with', title: 'The others.', link: 'compositions.html', cta: 'All ten' })}
    <div class="grid" style="margin-top:clamp(2rem,4vw,3rem)">
      ${others.map((o, i) => `<div class="c-3 c-md-6 c-sm-12" data-reveal style="--i:${i}">
        <a class="card" href="composition-${o.slug}.html" data-cursor="Open">
          <div class="card__plate" data-reveal="mask">${Plate(`rel-${c.slug}-${o.slug}`, { ratio: 'p', scene: o.scene, tone: o.tone })}</div>
          <div class="card__meta"><span>${o.num}</span><span>&mdash;</span></div>
          <h3 class="card__t">${o.title}</h3>
          <p class="card__d">${o.kicker}</p>
        </a>
      </div>`).join('')}
    </div>
  </div>
</section>

${Closer({
  title: `Commission a journey<br>built on ${c.title}.`,
  text: 'Tell us the month you have in mind and what you would like removed from it. We will tell you whether the month is right.',
  seed: `closer-${c.slug}`, scene: c.scene, tone: c.tone,
})}
`;
  page(`composition-${c.slug}.html`, {
    title: c.title,
    description: c.lede,
    body,
    active: `composition-${c.slug}.html`,
    lightHead: true,
  });
});

/* ================================================ 7. Wild & Drive */

D.houses.forEach((h) => {
  const dep = D.departures.find((d) => d.kicker === h.title);
  const body = `
${PageHero({
  eyebrow: h.kicker,
  title: h.title,
  lede: h.lede,
  meta: h.stat.map((s) => ({ k: s.k, v: s.v })),
  seed: `house-hero-${h.slug}`, scene: h.scene, tone: h.tone,
})}

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">${eyebrow('Why it exists')}</div>
      <div class="c-6 c-md-12 prose prose--drop" data-reveal>
        ${h.body.map((p) => `<p>${p}</p>`).join('')}
      </div>
      <div class="c-3 c-md-12" data-reveal="mask">${Plate(`house-side-${h.slug}`, { ratio: 't', arch: 'deep', scene: h.scene, tone: h.tone })}</div>
    </div>
  </div>
</section>

<section class="section inverse section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'How it is built', title: 'Five things we<br>will not compromise.' })}
    <div style="margin-top:clamp(1.8rem,3.5vw,2.8rem)">${practice(h.pillars)}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-5 c-md-12">
        ${eyebrow('The ground')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>Where ${h.title.split(' ')[1].toLowerCase()}<br>journeys tend to run.</h2>
        <div style="margin-top:2rem" data-reveal="mask">${Plate(`house-places-${h.slug}`, { ratio: 'l', scene: h.scene, tone: h.tone, svgRatio: 'landscape' })}</div>
      </div>
      <div class="c-6 s-7 c-md-12">${places(h.strands)}</div>
    </div>
  </div>
</section>

${dep ? `
<section class="section section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Open now', note: 'The rare occasion we open one of these to a small list rather than designing it privately.', title: 'A dated departure.', link: 'departures.html', cta: 'All departures' })}
    <div class="grid" style="margin-top:clamp(2rem,4vw,3rem);align-items:center">
      <div class="c-6 c-md-12" data-reveal="mask">
        <a href="departure-${dep.slug}.html" data-cursor="Read">${Plate(`house-dep-${dep.slug}`, { ratio: 'l', scene: dep.scene, tone: dep.tone, svgRatio: 'landscape' })}</a>
      </div>
      <div class="c-5 s-8 c-md-12">
        <p class="eyebrow eyebrow--accent">${dep.dates}</p>
        <h3 class="h2" style="margin-top:.8rem" data-reveal>${dep.title}</h3>
        <p class="lede" style="margin-top:1.2rem" data-reveal>${dep.lede}</p>
        ${facts([{ k: 'Length', v: dep.length }, { k: 'Party', v: dep.party }, { k: 'From', v: dep.band.replace(/^From /, '') }])}
        <p style="margin-top:1.8rem" data-reveal><a class="btn" href="departure-${dep.slug}.html">The full journey <span class="arrow">&rarr;</span></a></p>
      </div>
    </div>
  </div>
</section>` : ''}

${Closer({
  title: `Commission a<br>${h.title} journey.`,
  text: 'These are built around a person and a season before they are built around a place. Tell us the month you can travel and we will tell you what is possible in it.',
  seed: `closer-${h.slug}`, scene: h.scene, tone: h.tone,
})}
`;
  page(`${h.slug}.html`, { title: h.title, description: h.lede, body, active: `${h.slug}.html`, lightHead: true });
});

/* ==================================================== 8. Departures */

const depIndex = `
${PageHero({
  eyebrow: 'Sample packages',
  title: 'Journeys to<br>start with.',
  lede: 'Explore example itineraries as inspiration for your own plans. Dates, pricing, inclusions and availability are not confirmed; contact Friday for current details.',
})}

<section class="section section--flush-top">
  <div class="wrap">
    ${D.departures.map((d, i) => `
    <article class="grid" style="align-items:center;padding-block:clamp(2rem,5vw,4.5rem);border-top:1px solid var(--rule)">
      <div class="${i % 2 ? 'c-6 s-7' : 'c-6'} c-md-12" data-reveal="mask" style="order:${i % 2 ? 2 : 1}">
        ${Plate(`depidx-${d.slug}`, { ratio: 'l', scene: d.scene, tone: d.tone, svgRatio: 'landscape' })}
      </div>
      <div class="${i % 2 ? 'c-5' : 'c-5 s-8'} c-md-12" style="order:${i % 2 ? 1 : 2}">
        <p class="eyebrow eyebrow--accent">Sample itinerary</p>
        <h2 class="h2" style="margin-top:.9rem" data-reveal>${d.title}</h2>
        <p class="lede" style="margin-top:1.2rem" data-reveal>${d.lede}</p>
        <p class="card__d" style="margin-top:1rem" data-reveal>${d.note}</p>
        <p style="margin-top:1.4rem" data-reveal><a class="link" href="contact.html">Ask about this journey <span class="arrow">&rarr;</span></a></p>
      </div>
    </article>`).join('')}
  </div>
</section>

<section class="section inverse section--tight">
  <div class="wrap">
    <div class="grid" style="align-items:center">
      <div class="c-6 c-md-12">
        ${eyebrow('Plan with Friday')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>Make an idea<br>your own.</h2>
        <div class="prose" style="margin-top:1.4rem" data-reveal>
          <p>Use a sample route as a starting point, then open Friday&rsquo;s AI planner to shape an itinerary around your dates and interests.</p>
          <p>For current package details, ask Friday before making travel plans.</p>
        </div>
        <p style="margin-top:1.8rem"><a class="btn" href="trip.html">Plan a trip <span class="arrow">&rarr;</span></a></p>
      </div>
      <div class="c-5 s-8 c-md-12" data-reveal="mask">${Plate('dep-index-side', { ratio: 'p', arch: true, scene: 'aurora', tone: 'indigo' })}</div>
    </div>
  </div>
</section>
`;
page('departures.html', { title: 'Packages', description: 'Example itineraries from Friday. Dates, pricing, inclusions and availability are not confirmed.', body: depIndex, active: 'departures.html', lightHead: true });

/* --------------------------------------------- departure detail ×3 */

D.departures.forEach((d) => {
  const others = D.departures.filter((x) => x.slug !== d.slug);
  const body = `
${PageHero({
  eyebrow: `${d.kicker} &middot; ${d.dates}`,
  title: d.title,
  lede: d.lede,
  meta: [{ k: 'Length', v: d.length }, { k: 'Party', v: d.party }, { k: 'From', v: d.band.replace(/^From /, '') }],
  seed: `depd-hero-${d.slug}`, scene: d.scene, tone: d.tone,
})}

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">${eyebrow('The argument')}</div>
      <div class="c-6 c-md-12 prose prose--drop" data-reveal>
        ${d.body.map((p) => `<p>${p}</p>`).join('')}
      </div>
      <div class="c-3 c-md-12" data-reveal="mask">${Plate(`depd-side-${d.slug}`, { ratio: 't', arch: 'deep', scene: d.scene, tone: d.tone })}</div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Day by day', note: 'Deliberately underfilled. The empty afternoons are the design, not an omission.', title: 'The shape<br>of the journey.' })}
    <div class="steps" style="margin-top:clamp(2rem,4vw,3rem)">
      ${d.itinerary.map((it, i) => `<div class="step" data-reveal style="--i:${i % 3}">
        <span class="step__n" style="font-size:1rem;letter-spacing:.02em">${it.d}</span>
        <h3 class="step__t">${it.t}</h3>
        <p class="step__d">${it.x}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    <div class="grid">
      <div class="c-5 c-md-12">
        ${eyebrow('Included')}
        <h2 class="h2" style="margin-top:1rem" data-reveal>What the price<br>actually carries.</h2>
        <p class="card__d" style="margin-top:1.2rem" data-reveal>${d.note}</p>
        <p style="margin-top:2rem" data-reveal><a class="btn" href="commission.html">Ask about places <span class="arrow">&rarr;</span></a></p>
      </div>
      <div class="c-6 s-7 c-md-12">
        <div class="places" data-reveal>
          ${d.includes.map((x) => `<div class="place" style="grid-template-columns:2rem 1fr"><span class="num">&mdash;</span><p class="place__p" style="margin:0;font-size:1.15rem">${x}</p></div>`).join('')}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Also open', title: 'The other<br>departures.', link: 'departures.html', cta: 'All three' })}
    <div class="grid" style="margin-top:clamp(2rem,4vw,3rem)">
      ${others.map((o, i) => `<div class="c-6 c-md-12" data-reveal style="--i:${i}">
        <a class="card" href="departure-${o.slug}.html" data-cursor="Read">
          <div class="card__plate" data-reveal="mask">${Plate(`depd-rel-${d.slug}-${o.slug}`, { ratio: 'l', scene: o.scene, tone: o.tone, svgRatio: 'landscape' })}</div>
          <div class="card__meta"><span>${o.kicker}</span><span>${o.dates}</span></div>
          <h3 class="card__t">${o.title}</h3>
          <p class="card__d">${o.lede}</p>
        </a>
      </div>`).join('')}
    </div>
  </div>
</section>

${Closer({
  title: 'Places are held<br>on a first list.',
  text: 'Write to us and we will tell you honestly what remains, what the party looks like so far, and whether we think it suits you.',
  seed: `closer-dep-${d.slug}`, scene: d.scene, tone: d.tone,
})}
`;
  page(`departure-${d.slug}.html`, { title: d.title, description: d.lede, body, active: `departure-${d.slug}.html`, lightHead: true });
});

/* ========================================================= 9. Salon */

const salon = `
${PageHero({
  eyebrow: 'The Salon',
  title: 'A subject, a place,<br>and a table of fourteen.',
  lede: D.salon.lede,
  meta: [{ k: 'Table', v: 'Fourteen places' }, { k: 'Announced', v: 'Twice a year' }, { k: 'Private forums', v: 'By commission' }],
  seed: 'salon-hero', scene: 'forest', tone: 'plum',
})}

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">${eyebrow('Not a group tour')}</div>
      <div class="c-6 c-md-12 prose prose--drop" data-reveal>
        ${D.salon.body.map((p) => `<p>${p}</p>`).join('')}
      </div>
      <div class="c-3 c-md-12" data-reveal="mask">${Plate('salon-side', { ratio: 't', arch: 'deep', scene: 'terraces', tone: 'moss' })}</div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Four kinds', title: 'How a gathering<br>gets convened.' })}
    <div style="margin-top:clamp(1.8rem,3.5vw,2.8rem)">${practice(D.salon.kinds)}</div>
  </div>
</section>

<section class="section inverse">
  <div class="wrap">
    ${SecHead({ eyebrow: 'On the table', title: 'What is being<br>convened next.' })}
    <div class="grid" style="margin-top:clamp(2rem,4vw,3.2rem)">
      ${D.salon.upcoming.map((u, i) => `<div class="c-4 c-md-12" data-reveal style="--i:${i}">
        <div data-reveal="mask">${Plate(`salon-${i}`, { ratio: 'l', scene: ['dunes', 'terraces', 'sea'][i], tone: ['sand', 'ember', 'cobalt'][i], svgRatio: 'landscape' })}</div>
        <div class="card__meta" style="margin-top:1.1rem"><span>${u.when}</span><span>${u.places}</span></div>
        <h3 class="card__t">${u.t}</h3>
        <p class="card__d">${u.d}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    ${quote({ t: 'Fourteen is the largest number of people who can share one conversation.', a: 'Why the table is the size it is' }, true)}
  </div>
</section>

${Closer({
  title: 'Convene one<br>of your own.',
  text: 'Families, foundations and firms commission private forums on the same architecture: a closed guest list, a subject you set, and afternoons left deliberately empty.',
  seed: 'closer-salon', scene: 'forest', tone: 'plum',
})}
`;
page('salon.html', { title: 'The Salon', description: 'Small gatherings the studio convenes — a subject, a specialist, a table of fourteen — plus private forums for families, foundations and firms.', body: salon, active: 'salon.html', lightHead: true });

/* =================================================== 10. Field Notes */

const notesIndex = `
${PageHero({
  eyebrow: 'Field Notes',
  title: 'What we learnt<br>on the ground.',
  lede: 'Working notes from the studio. Published when there is something worth saying, which is not often — usually a small obsession, defended at length.',
  meta: [{ k: 'Published', v: 'When warranted' }, { k: 'Written by', v: 'Whoever was there' }],
})}

<section class="section section--flush-top">
  <div class="wrap">
    ${D.fieldNotes.map((n, i) => `
    <article class="grid" style="align-items:center;padding-block:clamp(2rem,5vw,4rem);border-top:1px solid var(--rule)">
      <div class="${i % 2 ? 'c-5 s-8' : 'c-5'} c-md-12" data-reveal="mask" style="order:${i % 2 ? 2 : 1}">
        <a href="note-${n.slug}.html" data-cursor="Read">${Plate(`ni-${n.slug}`, { ratio: 'l', scene: n.scene, tone: n.tone, svgRatio: 'landscape' })}</a>
      </div>
      <div class="${i % 2 ? 'c-6' : 'c-6 s-7'} c-md-12" style="order:${i % 2 ? 1 : 2}">
        <p class="eyebrow eyebrow--accent">${n.place} &middot; ${n.date}</p>
        <h2 class="h2" style="margin-top:.9rem" data-reveal><a href="note-${n.slug}.html" style="text-decoration:none">${n.title}</a></h2>
        <p class="lede" style="margin-top:1.1rem" data-reveal>${n.dek}</p>
        <p style="margin-top:1.6rem" data-reveal><a class="link" href="note-${n.slug}.html">Read the note <span class="arrow">&rarr;</span></a> &nbsp;&nbsp;<span class="eyebrow" style="display:inline">${n.author}</span></p>
      </div>
    </article>`).join('')}
  </div>
</section>

${Closer({
  title: 'Twice a year,<br>no more than that.',
  text: 'The studio letter goes out in spring and late autumn. It contains what we have learnt, what has changed on the ground, and occasionally a departure before it is published here.',
  cta: 'Write to the studio', seed: 'closer-notes', scene: 'arctic', tone: 'ice',
})}
`;
page('field-notes.html', { title: 'Field Notes', description: 'Working notes from the studio — out-of-hours permits, four years for a single afternoon, and the correct side of the train.', body: notesIndex, active: 'field-notes.html', lightHead: true });

/* --------------------------------------------------- note detail ×3 */

D.fieldNotes.forEach((n, idx) => {
  const next = D.fieldNotes[(idx + 1) % D.fieldNotes.length];
  const body = `
<article>
${PageHero({
  eyebrow: `${n.place} &middot; ${n.date}`,
  title: n.title,
  lede: n.dek,
  meta: [{ k: 'Written by', v: n.author }, { k: 'Filed under', v: 'Field note' }],
  seed: `nd-hero-${n.slug}`, scene: n.scene, tone: n.tone,
})}

<section class="section">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">
        ${eyebrow('The note')}
        <p class="card__d" style="margin-top:1rem">${n.author}<br>${n.place}<br>${n.date}</p>
      </div>
      <div class="c-6 c-md-12 prose prose--drop" data-reveal style="font-size:1.075rem;line-height:1.7">
        ${n.body.map((p) => `<p>${p}</p>`).join('')}
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap wrap--narrow">
    <figure class="figure" data-reveal="mask">
      ${Plate(`nd-fig-${n.slug}`, { ratio: 'w', scene: n.scene, tone: n.tone, svgRatio: 'panorama' })}
      <figcaption>${n.place}. Plates on this site are drawn in the studio rather than photographed — a habit from the founder’s first profession, and a small argument against the stock image.</figcaption>
    </figure>
  </div>
</section>
</article>

<section class="section inverse section--tight">
  <div class="wrap">
    ${SecHead({ eyebrow: 'Next note', title: next.title, link: 'field-notes.html', cta: 'All notes' })}
    <div class="grid" style="margin-top:clamp(2rem,4vw,3rem);align-items:center">
      <div class="c-6 c-md-12" data-reveal="mask">
        <a href="note-${next.slug}.html" data-cursor="Read">${Plate(`nd-next-${n.slug}`, { ratio: 'l', scene: next.scene, tone: next.tone, svgRatio: 'landscape' })}</a>
      </div>
      <div class="c-5 s-8 c-md-12">
        <p class="eyebrow eyebrow--accent">${next.place} &middot; ${next.date}</p>
        <p class="lede" style="margin-top:1rem" data-reveal>${next.dek}</p>
        <p style="margin-top:1.6rem" data-reveal><a class="link" href="note-${next.slug}.html">Read it <span class="arrow">&rarr;</span></a></p>
      </div>
    </div>
  </div>
</section>

${Closer({
  title: 'Commission the<br>version of this<br>that is yours.',
  text: 'Every note here started as a decision made for one client. Tell us the month and we will start making them for you.',
  seed: `closer-note-${n.slug}`, scene: n.scene, tone: n.tone,
})}
`;
  page(`note-${n.slug}.html`, { title: n.title, description: n.dek, body, active: 'field-notes.html', lightHead: true });
});

/* =================================================== 11. Commission */

const chip = (name, label) => `<label class="chip"><input type="checkbox" name="${name}" value="${T.esc(label)}">${label}</label>`;

const contact = `
${PageHero({
  eyebrow: 'Contact Friday',
  title: 'Tell us where<br>you&rsquo;d like to go.',
  lede: 'Share the destination, dates or kind of trip you have in mind. You can also start with Friday&rsquo;s AI planner.',
})}

<section class="section section--flush-top">
  <div class="wrap">
    <div class="grid">
      <div class="c-7 c-md-12">
        <form class="form" data-commission novalidate>
          <div class="grid" style="gap:2.1rem var(--gap)">
            <div class="c-6 c-sm-12 field">
              <label class="field__label" for="f-name">Your name</label>
              <input class="field__input" id="f-name" name="name" type="text" required autocomplete="name" placeholder="First and last">
            </div>
            <div class="c-6 c-sm-12 field">
              <label class="field__label" for="f-mail">Email</label>
              <input class="field__input" id="f-mail" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="c-6 c-sm-12 field">
              <label class="field__label" for="f-when">When are you thinking of travelling?</label>
              <input class="field__input" id="f-when" name="when" type="text" placeholder="A month, season or flexible">
            </div>
            <div class="c-6 c-sm-12 field">
              <label class="field__label" for="f-who">Who is travelling?</label>
              <select class="field__select" id="f-who" name="who">
                <option>Two of us</option>
                <option>A family</option>
                <option>Three generations</option>
                <option>A small group of friends</option>
                <option>On my own</option>
              </select>
            </div>
          </div>

          <div class="field">
            <span class="field__label">What would you like help with?</span>
            <div class="chips">
              ${chip('composition', 'Villa stay')}
              ${chip('composition', 'Sample package')}
              ${chip('composition', 'AI trip planning')}
              ${chip('composition', 'Something else')}
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="f-shape">Where would you like to go, or what are you imagining?</label>
            <textarea class="field__area" id="f-shape" name="shape" placeholder="A destination, a place to stay, a particular experience, or the first idea that came to mind."></textarea>
          </div>

          <div class="field">
            <label class="field__label" for="f-last">Anything else we should know?</label>
            <textarea class="field__area" id="f-last" name="last" placeholder="Optional details that could help us understand your trip."></textarea>
          </div>

          <div class="field">
            <label class="field__label" for="f-heard">How did you find Friday? <span style="color:var(--fg-mute)">Optional</span></label>
            <input class="field__input" id="f-heard" name="heard" type="text">
          </div>

          <div>
            <button class="btn btn--solid" type="submit">Send your enquiry <span class="arrow">&rarr;</span></button>
            <p style="margin-top:1.2rem;font-size:.8125rem;color:var(--fg-mute);max-width:34em">Your enquiry will be sent to Friday. You can also email <a class="link" href="mailto:${D.brand.email}">${D.brand.email}</a>.</p>
          </div>
        </form>

        <div class="form-sent" data-commission-sent>
          ${eyebrow('Received')}
          <h2 class="h2" style="margin:1rem 0 1.2rem">Thank you<span data-sent-name></span>.</h2>
          <p class="lede" style="margin-inline:auto" data-commission-delivery-note role="status">Your enquiry has been saved.</p>
          <p style="margin-top:2rem"><a class="link" href="trip.html#/">Open my trips <span class="arrow">&rarr;</span></a></p>
        </div>
      </div>

      <div class="c-4 s-9 c-md-12" style="align-self:start">
        <div style="position:sticky;top:calc(var(--head-h) + 2.5rem)">
          <div data-reveal="mask">${Plate('commission-side', { ratio: 't', arch: 'deep', scene: 'isles', tone: 'cobalt' })}</div>
          <div style="margin-top:1.8rem">${eyebrow('Start with Friday')}
            <p class="card__d">Plan a trip with the AI planner, browse villas, or explore a sample package.</p>
            <div style="margin-top:1rem;display:grid;gap:.65rem">
              <a class="link" href="trip.html">AI trip planner <span class="arrow">&rarr;</span></a>
              <a class="link" href="villas.html">Friday villas <span class="arrow">&rarr;</span></a>
              <a class="link" href="departures.html">Sample packages <span class="arrow">&rarr;</span></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

`;
page('contact.html', { title: 'Contact Friday', description: 'Contact Friday about planning a trip, a villa stay or a sample package.', body: contact, active: 'contact.html', lightHead: true });

/* ======================================================= 12. The planner */

const TRIP = require('./trip');
written.push(write('trip.html', TRIP.tripPage()));
written.push(write('chatgpt-callback.html', TRIP.chatgptCallbackPage()));
// app.html stays as a compatible entry point that forwards to the planner.
written.push(write('app.html', TRIP.appAliasPage()));

const tripScripts = TRIP.tripScripts();
const scriptsWritten = Object.keys(tripScripts).map((file) => {
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  return write(file, tripScripts[file]);
});

/* Old studio essays and journey catalogues remain as small, useful route aliases. */
const redirectPage = (file, target, label) => {
  const safeTarget = T.esc(target);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${safeTarget}"><link rel="canonical" href="${safeTarget}"><title>${label} · Friday</title><link rel="stylesheet" href="assets/css/friday.css"></head><body><main style="min-height:100vh;display:grid;place-items:center;padding:2rem;text-align:center"><div><a class="wordmark" href="index.html"><span class="wordmark__name">Friday</span></a><p style="margin-top:2rem">This page has moved.</p><p><a class="link" href="${safeTarget}">Continue to ${label} <span class="arrow">&rarr;</span></a></p></div></main><script>location.replace(${JSON.stringify(target)})</script></body></html>`;
  written.push(write(file, html));
};
[
  ['ethos.html', 'about.html', 'About Friday'],
  ['method.html', 'about.html', 'About Friday'],
  ['designers.html', 'about.html', 'About Friday'],
  ['alliances.html', 'about.html', 'About Friday'],
  ['compositions.html', 'departures.html', 'Packages'],
  ['wild.html', 'departures.html', 'Packages'],
  ['drive.html', 'departures.html', 'Packages'],
  ['salon.html', 'departures.html', 'Packages'],
  ['field-notes.html', 'about.html', 'About Friday'],
  ['commission.html', 'contact.html', 'Contact Friday'],
].forEach(([file, target, label]) => redirectPage(file, target, label));
D.compositions.forEach((item) => redirectPage(`composition-${item.slug}.html`, 'departures.html', 'Packages'));
D.departures.forEach((item) => redirectPage(`departure-${item.slug}.html`, 'departures.html', 'Packages'));
fs.readdirSync(OUT).filter((file) => /^note-.+\.html$/.test(file)).forEach((file) => redirectPage(file, 'about.html', 'About Friday'));

/* Search files only name public pages. Configure PUBLIC_SITE_ORIGIN for a stable production sitemap.
   APP_ORIGIN and Vercel's production URL are supported as fallbacks; no domain is guessed at build time. */
const sitemapPages = ['index.html', 'about.html', 'help.html', 'contact.html', 'partner.html', 'departures.html', 'villas.html', 'kerala-guide.html'].filter((file) => fs.existsSync(path.join(OUT, file)));
write('sitemap.xml', sitemapXml(sitemapPages, PUBLIC_ORIGIN));
write('robots.txt', robotsTxt(PUBLIC_ORIGIN));

/* ------------------------------------------------------------- report */

console.log(`Wrote ${written.length} pages:\n  ${written.join('\n  ')}\nWrote ${scriptsWritten.length} generated scripts:\n  ${scriptsWritten.join('\n  ')}`);
