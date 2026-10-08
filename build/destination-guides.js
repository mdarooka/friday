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
    areaOrder: ['panaji', 'oldgoa', 'calangute', 'anjuna', 'vagator', 'oxel', 'arambol', 'colva', 'ponda'],
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
      linkHref: 'https://goa-tourism.com/',
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
      linkHref: 'https://goa-tourism.com/',
      linkLabel: 'Goa Tourism’s travel basics',
    },
    areaNotes: {
      panaji: 'For heritage walking: the Fontainhas lanes, the main-square church, markets and river views.',
      oldgoa: 'For the UNESCO-listed churches and a quiet museum morning, set apart from the beach coast.',
      calangute: 'For first visits: wide beaches, many tables and short drives, from busy Baga to calmer Candolim.',
      anjuna: 'For cafés, village lanes and markets, with a food-led, more relaxed feel.',
      vagator: 'For red cliffs, a hilltop fort and clifftop sunsets.',
      oxel: 'For quieter northern sand, riverside villages and winter turtle nesting at Morjim.',
      arambol: 'For the far north: a long headland beach, craft stalls and yoga retreats.',
      colva: 'For long beach days and a slower, more spacious pace in the south.',
      ponda: 'For an inland half-day of temples, a spice-plantation walk and a restored mosque.',
    },
    getting: {
      eyebrow: 'Getting there and around',
      title: 'Choose a coast, then keep the transfers short.',
      body: [
        'Dabolim airport sits in Goa on the Mormugao side, as a civil enclave within a naval air base; the Airports Authority of India lists Vasco-da-Gama as its nearest railway station. Friday’s research notes also refer to Mopa as a second Goa airport, serving the north. Which suits you depends on where you are staying, so check both before booking flights.',
        'Friday’s sample planning data suggests roughly 25–30 minutes by road between the Candolim–Calangute strip and Panjim, 35–40 minutes from Anjuna–Assagao, and 45–55 minutes from Colva–Benaulim. These are indicative: coastal traffic slows quickly in high season, so allow extra time and confirm transfers with your driver or hotel.',
      ],
      linkHref: 'https://www.aai.aero/en/airports/goa',
      linkLabel: 'Airports Authority of India: Goa airport',
    },
    practical: {
      eyebrow: 'Practicalities and etiquette',
      title: 'Small things that make the days easier.',
      items: [
        'Dress modestly at temples, as the catalogue notes for Shri Mangueshi Temple in Ponda, and be equally considerate at the churches of Old Goa.',
        'Markets keep their own days: the catalogue lists Anjuna’s flea market on Wednesdays, the Friday bazaar at Mapusa and Ingo’s Night Bazaar on Saturday evenings in Arpora. Check current timings before planning around them.',
        'Morjim is described as a quiet beach where Olive Ridley turtles nest in winter, so take extra care on the sand there.',
        'Beach shacks are reported to open from October to May. Confirm what is open on your dates, especially outside the dry months.',
        'Popular tables such as Bomras suit booking ahead; Friday cannot make reservations for you.',
      ],
      linkHref: 'https://www.goa.gov.in/know-goa/what-to-see/',
      linkLabel: 'Goa government: what to see',
    },
    routes: {
      eyebrow: 'Sample route shapes',
      title: 'How the planner’s trip lengths can be laid out.',
      intro: 'These mirror the planner’s three lengths. They are starting shapes, not itineraries or bookings; move the days around to suit your dates and pace.',
      items: [
        { label: 'About 4 days', title: 'One stretch of coast', body: 'Base on a single beach area, such as Candolim–Calangute or Anjuna–Assagao. Give one day to Panjim and Old Goa, with Old Goa in the morning and Fontainhas in the late afternoon, and leave the rest for sand, a long lunch and one evening out.' },
        { label: 'About 7 days', title: 'North coast plus heritage', body: 'Spend most nights on the north coast, then add Panjim and Old Goa, a Vagator and Chapora Fort sunset, and an inland half-day at Ponda. Or split the week: four nights north and three in Colva–Benaulim for a quieter finish.' },
        { label: 'About 14 days', title: 'North, south and slow days', body: 'Move base once or twice: Arambol or Oxel in the far north, a village base in Anjuna–Assagao, then the quieter southern beaches. Keep a spare day or two for yoga, markets and doing very little.' },
      ],
    },
    faq: {
      eyebrow: 'Quick answers',
      title: 'Questions we hear about Goa.',
      items: [
        { q: 'Which airport should I fly into?', a: 'Dabolim is the long-standing Goa airport, with Mopa referred to in Friday’s notes as a second airport in the north. Compare transfer times to your base before choosing, and confirm flight options directly.' },
        { q: 'Can I see north and south Goa in a few days?', a: 'You can, but it is a lot of road for a short stay. With fewer than a week, one coastal base plus a day in Panjim and Old Goa is usually calmer.' },
        { q: 'How long do Old Goa and Fontainhas take?', a: 'Friday’s planning notes suggest Old Goa for a morning and Fontainhas for a late-afternoon walk, which fits comfortably into one day from Panjim.' },
        { q: 'Is Goa worth visiting in the monsoon?', a: 'It is quieter and greener, but heavy rain and closed beach shacks change the trip. Check current weather and operating guidance, as this guide does not confirm live conditions.' },
      ],
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
    areaNotes: {
      jaipur: 'For the Pink City and Amber: forts, palaces, an observatory and bazaars, best started early.',
      ranthambore: 'For a tiger-reserve add-on, with a ruined fort inside the park; safari zones need booking ahead.',
      pushkar: 'For a calm lake of ghats, a short temple-and-bazaar stop, and Ajmer’s dargah nearby.',
      jodhpur: 'For Mehrangarh, the blue lanes below it and stepwells and bazaars in the old city.',
      jaisalmer: 'For a living golden fort, desert dunes and big night skies, the furthest point on the loop.',
      udaipur: 'For lakes, palaces and slower days; Kumbhalgarh and Ranakpur make good outings.',
    },
    getting: {
      eyebrow: 'Getting there and around',
      title: 'Fly in, then link the cities by road or rail.',
      body: [
        'Rajasthan Tourism lists Sanganer International Airport in Jaipur as a main gateway, with Jodhpur and Udaipur (Dabok) airports handling domestic flights, and Jaisalmer, Kishangarh (Ajmer) and Bikaner airports also operating. It names Jaipur and Kota as the main rail hubs, and highway NH-8 as linking Ajmer, Jaipur, Udaipur and Chittorgarh. Confirm current flights and timetables before booking.',
        'Friday’s sample planning table suggests about 5.5–6.5 hours by road from Jaipur to Jodhpur, 6–7 hours from Jaipur to Udaipur and 9–10 hours from Jaipur to Jaisalmer, with Jodhpur to Jaisalmer around five hours. These are indicative only; traffic, roadworks and stops change them, so plan one long drive every other day at most.',
      ],
      linkHref: 'https://www.tourism.rajasthan.gov.in/content/rajasthan-tourism/en/plan/how-to-get-there.html',
      linkLabel: 'Rajasthan Tourism: how to get there',
    },
    practical: {
      eyebrow: 'Practicalities and etiquette',
      title: 'Small things that make the days easier.',
      items: [
        'Start forts and temples early: the catalogue suggests going at opening for Amber Fort and early for Brahma Temple in Pushkar, and using an audio guide at Mehrangarh and Jantar Mantar.',
        'Dress modestly at religious sites, as the catalogue notes for Ranakpur Jain Temple, and cover your head at Ajmer Sharif Dargah.',
        'Desert nights are cold in winter, so pack layers; Rajasthan Tourism describes winter days as sunny and nights as chilly.',
        'Safari zones at Ranthambore need booking well in advance, and Friday cannot make reservations for you.',
        'Festival weeks such as Pushkar’s fair and the Jaisalmer Desert Festival can raise demand for hotels, so check dates before fixing the route.',
      ],
      linkHref: 'https://www.tourism.rajasthan.gov.in/content/rajasthan-tourism/en/plan/best-time-to-visit.html',
      linkLabel: 'Rajasthan Tourism: best time to visit',
    },
    routes: {
      eyebrow: 'Sample route shapes',
      title: 'How the planner’s trip lengths can be laid out.',
      intro: 'These mirror the planner’s three lengths. They are starting shapes, not itineraries or bookings; check road times for your own dates.',
      items: [
        { label: 'About 5 days', title: 'Two cities, no rush', body: 'Pair Jaipur (2–3 nights) with either Jodhpur or Pushkar, or fly to Udaipur for lakes and palaces on their own. Keep to one long transfer in total.' },
        { label: 'About 7 days', title: 'A classic circuit', body: 'Jaipur, then Jodhpur, then Udaipur, with 2–3 nights in the larger cities and 1–2 in Jodhpur. Add Pushkar as a short stop only if the road time suits you.' },
        { label: 'About 14 days', title: 'Desert and lakes loop', body: 'Jaipur, Pushkar, Jodhpur, Jaisalmer (about two nights) and Udaipur, with Ranthambore as an optional wildlife add-on and Kumbhalgarh or Ranakpur as outings from Udaipur. Alternate long drives with easy days.' },
      ],
    },
    faq: {
      eyebrow: 'Quick answers',
      title: 'Questions we hear about Rajasthan.',
      items: [
        { q: 'Which city should I fly into?', a: 'Jaipur has the main international airport, per Rajasthan Tourism, and works well for a loop that ends in Udaipur. Check one-way flight and rail options for your dates.' },
        { q: 'Is Rajasthan too hot to visit?', a: 'Summer can be very hot, and Rajasthan Tourism says temperatures can rise as high as 48°C, with the Thar Desert area the harshest. It also describes winter as the best season, with mostly 10–30°C temperatures.' },
        { q: 'How many cities can I fit into a week?', a: 'Three is a comfortable ceiling. Jaisalmer sits far from the others, so leave it for a trip of ten days or more.' },
        { q: 'Does Ranthambore fit a first trip?', a: 'Only if you have the nights. It sits off the main desert-and-lakes path, and safari zones should be booked in advance.' },
      ],
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
    const note = (guide.areaNotes || {})[id];
    return `<article class="c-4 c-md-12" data-reveal><div class="prose"><p class="eyebrow eyebrow--accent">${esc(area.name)}</p><h3 class="h3">${esc(area.town)}</h3>${note ? `<p>${esc(note)}</p>` : ''}<ul>${stops.map((place) => `<li><strong>${esc(place.name)}</strong>${place.blurb ? ` — ${esc(place.blurb)}` : ''}</li>`).join('')}</ul></div></article>`;
  }).join('');
}

function renderDestinationGuide(guide, catalog, { PageHero, esc }) {
  const id = guide.id;
  const areas = renderGuideAreas(guide, catalog, esc);
  const link = (item) => item.linkHref
    ? `<p><a class="link" href="${esc(item.linkHref)}" target="_blank" rel="noopener noreferrer">${esc(item.linkLabel)} <span class="arrow">&rarr;</span></a></p>`
    : '';

  const paras = (list) => (list || []).map((text) => `<p>${esc(text)}</p>`).join('');
  const gettingSection = guide.getting || guide.practical ? `<section class="section section--tight"><div class="wrap grid" style="align-items:start">
  ${guide.getting ? `<article class="c-6 c-md-12 prose" data-reveal>
    <p class="eyebrow">${esc(guide.getting.eyebrow)}</p>
    <h2 class="h2">${guide.getting.title}</h2>
    ${paras(guide.getting.body)}
    ${link(guide.getting)}
  </article>` : ''}
  ${guide.practical ? `<article class="c-6 c-md-12 prose" data-reveal style="--i:1">
    <p class="eyebrow">${esc(guide.practical.eyebrow)}</p>
    <h2 class="h2">${guide.practical.title}</h2>
    <ul>${guide.practical.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
    ${link(guide.practical)}
  </article>` : ''}
</div></section>` : '';
  const routesSection = guide.routes ? `<section class="section inverse"><div class="wrap">
  <p class="eyebrow">${esc(guide.routes.eyebrow)}</p>
  <h2 class="h2">${guide.routes.title}</h2>
  <p class="lede" style="max-width:42em;margin-top:1rem">${esc(guide.routes.intro)}</p>
  <div class="grid" style="margin-top:2rem">${guide.routes.items.map((item) => `<article class="c-4 c-md-12" data-reveal><div class="prose"><p class="eyebrow eyebrow--accent">${esc(item.label)}</p><h3 class="h3">${esc(item.title)}</h3><p>${esc(item.body)}</p></div></article>`).join('')}</div>
</div></section>` : '';
  const faqSection = guide.faq ? `<section class="section section--tight"><div class="wrap">
  <p class="eyebrow">${esc(guide.faq.eyebrow)}</p>
  <h2 class="h2">${guide.faq.title}</h2>
  <div class="grid" style="margin-top:2rem;align-items:start">${guide.faq.items.map((item, i) => `<article class="c-6 c-md-12 prose" data-reveal style="--i:${i % 2}"><h3 class="h3">${esc(item.q)}</h3><p>${esc(item.a)}</p></article>`).join('')}</div>
</div></section>` : '';

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
${gettingSection}
${routesSection}
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
${faqSection}
<section class="section inverse"><div class="wrap grid" style="align-items:center">
  <div class="c-7 c-md-12"><p class="eyebrow">Take the next step</p><h2 class="h2">${guide.cta.title}</h2><p class="lede" style="margin-top:1rem">${guide.cta.lede}</p></div>
  <div class="c-5 c-md-12" style="display:grid;gap:1rem"><a class="btn" data-guide-cta="planner" data-guide-destination="${esc(id)}" href="trip.html?destination=${esc(id)}&amp;from_guide=${esc(id)}#/new">${esc(guide.cta.plannerLabel)} <span class="arrow">&rarr;</span></a><a class="link" data-guide-cta="quote" data-guide-destination="${esc(id)}" href="contact.html?quote_path=guide&amp;destination=${esc(id)}">Ask Friday about a quote <span class="arrow">&rarr;</span></a><a class="link" data-guide-cta="callback" data-guide-destination="${esc(id)}" href="contact.html?topic=${encodeURIComponent(catalog.name)}#callback-title">Talk to a designer <span class="arrow">&rarr;</span></a></div>
</div></section>`;
}

module.exports = {
  GUIDES,
  guideById,
  guideFiles,
  guideFooterLinks,
  renderDestinationGuide,
};
