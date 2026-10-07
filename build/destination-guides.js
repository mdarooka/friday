'use strict';

/**
 * Public destination guide pages. Each entry is rendered by generate.js from its
 * trip-data catalog (areas + places). Keep FAQ copy editorial and free of live prices.
 */
const GUIDES = [
  {
    id: 'kerala',
    file: 'kerala-guide.html',
    footerLabel: 'Kerala guide',
    title: 'Kerala Travel Guide: Itineraries, Munnar & Backwaters',
    description: 'Plan a Kerala trip around the time you have, from Kochi and Munnar to Alleppey backwaters and the coast. Browse Friday’s curated places.',
    areaOrder: ['kochi', 'munnar', 'thekkady', 'alleppey', 'kumarakom', 'varkala', 'kovalam'],
    hero: {
      eyebrow: 'A Friday field guide',
      title: 'A slower way<br>through Kerala.',
      lede: 'A practical starting point for a Kerala trip: choose a pace, pair the hills with the backwaters or coast, and leave room for the transfers between them.',
      seed: 'kerala-guide-backwaters',
      scene: 'isles',
      tone: 'jade',
    },
    days: {
      eyebrow: 'How many days do you need in Kerala?',
      title: 'Start with the days you have.',
      body: 'Friday’s Kerala planner uses three starting points: a 4–5 day escape, an unhurried week, or a longer two-week loop. They are prompts, not fixed packages. For a shorter trip, choose a smaller part of the state rather than trying to join every coast, hill and backwater stop.',
    },
    season: {
      eyebrow: 'When is the best time to visit Kerala?',
      title: 'Match the season to the trip.',
      body: 'Kerala Tourism describes November to February as pleasant, and notes that the monsoon brings heavy rain in some periods. Its guidance also varies by activity and region: its backwater advice points to October–February for houseboat cruises. Check current weather and local operating guidance before booking; this guide does not confirm live conditions.',
      linkHref: 'https://www.keralatourism.org/faq/20-things-to-know-before-you-visit-kerala',
      linkLabel: 'Read Kerala Tourism’s seasonal advice',
    },
    placesIntro: 'These are places from Friday’s hand-researched destination catalogue. Pick a few around the experience you want; check routes and opening details for your own dates.',
    placesTitle: 'Which places fit<br>one Kerala trip?',
    compare: {
      eyebrow: 'Backwaters',
      title: 'Is Alleppey or Kumarakom better for a houseboat?',
      body: 'There is no single best choice for every route. Friday’s catalogue lists a houseboat cruise in Alleppey (Alappuzha) and a sunset cruise on Vembanad Lake in Kumarakom; it does not say one is better. If an overnight stay matters, confirm availability, route, operator rules and current prices directly—these sample listings are not live booking details.',
      linkHref: 'https://www.keralatourism.org/destination/alappuzha-beach/60/',
      linkLabel: 'Kerala Tourism’s Alappuzha guide',
    },
    budget: {
      eyebrow: 'Budget',
      title: 'What does a Kerala trip cost?',
      body: 'This catalogue does not provide a current, trip-wide cost. Your total depends on dates, group size, route, stays and boat choices; Friday’s sample place data is not a live quote. Share your dates and what matters to you before making a budget or booking decision.',
      linkHref: 'https://www.keralatourism.org/faq/20-things-to-know-before-you-visit-kerala',
      linkLabel: 'Kerala Tourism’s travel basics',
    },
    cta: {
      title: 'Make Kerala<br>your own route.',
      lede: 'Start with the places that interest you, then shape the pace and dates with Friday.',
      plannerLabel: 'Plan your Kerala trip',
    },
  },
  {
    id: 'goa',
    file: 'goa-guide.html',
    footerLabel: 'Goa guide',
    title: 'Goa Travel Guide: Beaches, Panjim & Old Goa',
    description: 'Plan a Goa trip around the time you have, from Fontainhas and Old Goa to the north coast and quieter southern beaches. Browse Friday’s curated places.',
    areaOrder: ['panaji', 'oldgoa', 'calangute', 'anjuna', 'vagator', 'arambol', 'colva'],
    hero: {
      eyebrow: 'A Friday field guide',
      title: 'A slower way<br>along the coast.',
      lede: 'A practical starting point for a Goa trip: choose a base, leave room for one short outing a day, and decide whether heritage, beach quiet or tables matter most.',
      seed: 'goa-guide-coast',
      scene: 'sea',
      tone: 'ember',
    },
    days: {
      eyebrow: 'How many days do you need in Goa?',
      title: 'Start with the days you have.',
      body: 'Friday’s Goa planner uses three starting points: a short coastal escape, an unhurried week, or a longer stay with room to wander. They are prompts, not fixed packages. For fewer days, pick one stretch of coast rather than trying to join north, south and inland stops in one loop.',
    },
    season: {
      eyebrow: 'When is the best time to visit Goa?',
      title: 'Match the season to the trip.',
      body: 'Official tourism guidance and climate normals point to the dry winter months as the most comfortable stretch for beaches and open-air dining; monsoon periods bring heavy rain and many beach shacks close. Festival weeks and the Christmas–New Year stretch are busier and often more expensive. Check current weather and local operating guidance before booking; this guide does not confirm live conditions.',
      linkHref: 'https://goa-tourism.gov.in/',
      linkLabel: 'Read Goa Tourism’s official guidance',
    },
    placesIntro: 'These are places from Friday’s hand-researched destination catalogue. Pick a few around the experience you want; check routes and opening details for your own dates.',
    placesTitle: 'Which places fit<br>one Goa trip?',
    compare: {
      eyebrow: 'Bases',
      title: 'North Goa or South Goa for a first stay?',
      body: 'There is no single best choice for every trip. Friday’s catalogue clusters lively north-coast beaches around Calangute, Anjuna and Vagator, quieter sands toward Colva and Benaulim, and heritage walks in Panjim and Old Goa. If beach access and short drives matter most, choose one coastal base; save Old Goa and Fontainhas for a focused half-day. Confirm current shack seasons, transfers and prices directly—these sample listings are not live booking details.',
      linkHref: 'https://whc.unesco.org/en/list/234/',
      linkLabel: 'UNESCO: Churches and Convents of Goa',
    },
    budget: {
      eyebrow: 'Budget',
      title: 'What does a Goa trip cost?',
      body: 'This catalogue does not provide a current, trip-wide cost. Your total depends on dates, group size, base, stays and how often you eat out; Friday’s sample place data is not a live quote. Share your dates and what matters to you before making a budget or booking decision.',
      linkHref: 'https://goa-tourism.gov.in/',
      linkLabel: 'Goa Tourism’s travel basics',
    },
    cta: {
      title: 'Make Goa<br>your own route.',
      lede: 'Start with the places that interest you, then shape the pace and dates with Friday.',
      plannerLabel: 'Plan your Goa trip',
    },
  },
  {
    id: 'rajasthan',
    file: 'rajasthan-guide.html',
    footerLabel: 'Rajasthan guide',
    title: 'Rajasthan Travel Guide: Jaipur, Jodhpur, Jaisalmer & Udaipur',
    description: 'Plan a Rajasthan trip around the time you have, from Jaipur’s forts to desert nights in Jaisalmer and the lakes of Udaipur. Browse Friday’s curated places.',
    areaOrder: ['jaipur', 'ranthambore', 'pushkar', 'jodhpur', 'jaisalmer', 'udaipur'],
    hero: {
      eyebrow: 'A Friday field guide',
      title: 'A slower way<br>through Rajasthan.',
      lede: 'A practical starting point for a Rajasthan trip: choose a loop, keep long drives to every other day, and leave room for morning forts and quiet afternoons.',
      seed: 'rajasthan-guide-forts',
      scene: 'dunes',
      tone: 'sand',
    },
    days: {
      eyebrow: 'How many days do you need in Rajasthan?',
      title: 'Start with the days you have.',
      body: 'Friday’s Rajasthan planner uses three starting points: a short palace circuit, an unhurried week, or a longer desert-and-lakes loop. They are prompts, not fixed packages. For fewer days, choose two or three cities rather than trying to join Jaipur, Jodhpur, Jaisalmer, Udaipur and a tiger reserve in one pass.',
    },
    season: {
      eyebrow: 'When is the best time to visit Rajasthan?',
      title: 'Match the season to the trip.',
      body: 'Rajasthan Tourism and climate normals point to the cooler, drier months from roughly November to March for forts, bazaars and desert nights. Summers are hot across the plains, and monsoon periods change how comfortable long drives feel. Festival weeks can raise demand for hotels and safaris. Check current weather and local operating guidance before booking; this guide does not confirm live conditions.',
      linkHref: 'https://tourism.rajasthan.gov.in/',
      linkLabel: 'Read Rajasthan Tourism’s official guidance',
    },
    placesIntro: 'These are places from Friday’s hand-researched destination catalogue. Pick a few around the experience you want; check routes and opening details for your own dates.',
    placesTitle: 'Which places fit<br>one Rajasthan trip?',
    compare: {
      eyebrow: 'The loop',
      title: 'Should you add Ranthambore to a first Rajasthan route?',
      body: 'There is no single best choice for every itinerary. Friday’s catalogue includes Jaipur, Pushkar, Jodhpur, Jaisalmer and Udaipur as a classic loop, with Ranthambore as a wildlife add-on when you have the nights for it. Safari zones need advance booking and sit off the main desert–lakes path. Confirm permits, zone rules and current prices directly—these sample listings are not live booking details.',
      linkHref: 'https://tourism.rajasthan.gov.in/',
      linkLabel: 'Rajasthan Tourism’s places to visit',
    },
    budget: {
      eyebrow: 'Budget',
      title: 'What does a Rajasthan trip cost?',
      body: 'This catalogue does not provide a current, trip-wide cost. Your total depends on dates, group size, route, heritage stays and safari choices; Friday’s sample place data is not a live quote. Share your dates and what matters to you before making a budget or booking decision.',
      linkHref: 'https://tourism.rajasthan.gov.in/',
      linkLabel: 'Rajasthan Tourism’s travel basics',
    },
    cta: {
      title: 'Make Rajasthan<br>your own route.',
      lede: 'Start with the places that interest you, then shape the pace and dates with Friday.',
      plannerLabel: 'Plan your Rajasthan trip',
    },
  },
];

function guideById(id) {
  return GUIDES.find((guide) => guide.id === id) || null;
}

function guideFiles() {
  return GUIDES.map((guide) => guide.file);
}

function guideFooterLinks() {
  return GUIDES.map((guide) => ({ label: guide.footerLabel, href: guide.file }));
}

function renderGuideAreas(guide, catalog, esc) {
  return guide.areaOrder.map((id) => {
    const area = catalog.areas.find((item) => item.id === id);
    if (!area) return '';
    const stops = Object.values(catalog.places).filter((place) => place.area === id && place.kind !== 'stay').slice(0, 3);
    return `<article class="c-4 c-md-12" data-reveal><div class="prose"><p class="eyebrow eyebrow--accent">${esc(area.name)}</p><h3 class="h3">${esc(area.town)}</h3><ul>${stops.map((place) => `<li><strong>${esc(place.name)}</strong>${place.blurb ? ` — ${esc(place.blurb)}` : ''}</li>`).join('')}</ul></div></article>`;
  }).join('');
}

function renderDestinationGuide(guide, catalog, { PageHero, esc }) {
  const id = guide.id;
  const areas = renderGuideAreas(guide, catalog, esc);
  const link = (item) => item.linkHref
    ? `<p><a class="link" href="${esc(item.linkHref)}" target="_blank" rel="noopener noreferrer">${esc(item.linkLabel)} <span class="arrow">&rarr;</span></a></p>`
    : '';

  return `
${PageHero(guide.hero)}
<section class="section section--tight"><div class="wrap">
  <div class="grid" style="align-items:start">
    <article class="c-6 c-md-12 prose" data-reveal>
      <p class="eyebrow">${esc(guide.days.eyebrow)}</p>
      <h2 class="h2">${guide.days.title}</h2>
      <p>${guide.days.body}</p>
    </article>
    <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
      <p class="eyebrow">${esc(guide.season.eyebrow)}</p>
      <h2 class="h2">${guide.season.title}</h2>
      <p>${guide.season.body}</p>
      ${link(guide.season)}
    </article>
  </div>
</div></section>
<section class="section inverse"><div class="wrap">
  <p class="eyebrow">Where to go</p>
  <h2 class="h2">${guide.placesTitle}</h2>
  <p class="lede" style="max-width:42em;margin-top:1rem">${guide.placesIntro}</p>
  <div class="grid" style="margin-top:2rem">${areas}</div>
</div></section>
<section class="section"><div class="wrap grid" style="align-items:start">
  <article class="c-6 c-md-12 prose" data-reveal>
    <p class="eyebrow">${esc(guide.compare.eyebrow)}</p>
    <h2 class="h2">${guide.compare.title}</h2>
    <p>${guide.compare.body}</p>
    ${link(guide.compare)}
  </article>
  <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
    <p class="eyebrow">${esc(guide.budget.eyebrow)}</p>
    <h2 class="h2">${guide.budget.title}</h2>
    <p>${guide.budget.body}</p>
    ${link(guide.budget)}
  </article>
</div></section>
<section class="section inverse"><div class="wrap grid" style="align-items:center">
  <div class="c-7 c-md-12"><p class="eyebrow">Take the next step</p><h2 class="h2">${guide.cta.title}</h2><p class="lede" style="margin-top:1rem">${guide.cta.lede}</p></div>
  <div class="c-5 c-md-12" style="display:grid;gap:1rem"><a class="btn" data-guide-cta="planner" data-guide-destination="${esc(id)}" href="trip.html?destination=${esc(id)}&amp;from_guide=${esc(id)}#/new">${esc(guide.cta.plannerLabel)} <span class="arrow">&rarr;</span></a><a class="link" data-guide-cta="quote" data-guide-destination="${esc(id)}" href="contact.html?quote_path=guide&amp;destination=${esc(id)}">Ask Friday about a quote <span class="arrow">&rarr;</span></a></div>
</div></section>`;
}

module.exports = {
  GUIDES,
  guideById,
  guideFiles,
  guideFooterLinks,
  renderDestinationGuide,
};
