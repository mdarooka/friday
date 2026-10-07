'use strict';
/* Kyoto Guide v1. Modelled on the Kerala guide: official sources, catalogue places, planning guidance only. */

const { guideFeedback } = require('../guide-feedback');

const LINKS = {
  jntoKyoto: 'https://www.japan.travel/en/destinations/kansai/kyoto/',
  jntoNara: 'https://www.japan.travel/en/destinations/kansai/nara/',
  jntoGetting: 'https://www.japan.travel/en/plan/getting-around/',
  kyotoCity: 'https://kyoto.travel/en/',
  mofaVisa: 'https://www.mofa.go.jp/j_info/visit/visa/index.html',
  embassy: 'https://www.in.emb-japan.go.jp/',
  kix: 'https://www.kansai-airport.or.jp/en/',
  jrWest: 'https://www.westjr.co.jp/global/en/',
};
const ext = (href, label) => `<a class="link" href="${href}" target="_blank" rel="noopener noreferrer">${label} <span class="arrow">&rarr;</span></a>`;

function kyotoGuide({ PageHero, T, KYOTO }) {
  /* Every place named in the arcs must exist in the catalogue, so a rename fails the build instead of shipping a dead name. */
  const n = (id) => {
    const place = KYOTO.places[id];
    if (!place) throw new Error(`kyoto guide: unknown place "${id}"`);
    return `<strong>${T.esc(place.name)}</strong>`;
  };
  const list = (ids) => ids.map(n).join(', ');
  const day = (label, text) => `<li><strong>${label}:</strong> ${text}</li>`;

  const arc = (eyebrow, title, intro, days, note, i) => `
  <article class="c-4 c-md-12 prose" data-reveal style="--i:${i}">
    <p class="eyebrow eyebrow--accent">${eyebrow}</p>
    <h3 class="h3">${title}</h3>
    <p>${intro}</p>
    <ul>${days.join('')}</ul>
    <p>${note}</p>
  </article>`;

  const arcs = [
    arc('Arc one &middot; about 5 days', 'A classic first visit',
      'The famous sights, one district a day, with the busiest places at opening time. A good shape if this is your first time in Japan.',
      [
        day('Day 1', `Arrive and keep it light: the river and an early dinner. ${list(['kamo-river-walk', 'pontocho-alley'])}.`),
        day('Day 2', `Higashiyama on foot, starting early: ${list(['kiyomizu-dera', 'sannenzaka-ninenzaka', 'kodaiji', 'yasaka-shrine'])}, then ${n('hanamikoji-street')} at dusk.`),
        day('Day 3', `${n('fushimi-inari')} at first light, then ${list(['tofukuji', 'sanjusangendo'])} in the afternoon.`),
        day('Day 4', `Arashiyama before the day-trippers: ${list(['arashiyama-bamboo-grove', 'tenryuji', 'togetsukyo-bridge'])}.`),
        day('Day 5', `The north-west and the centre: ${list(['kinkakuji', 'ryoanji', 'nijo-castle', 'nishiki-market'])}, depending on your flight.`),
      ],
      'With a day fewer, drop the north-west; with a day more, add a slow morning at Ginkaku-ji and the Philosopher’s Path.', 0),
    arc('Arc two &middot; about 7 days', 'Slower: crafts, gardens and temples',
      'Fewer headline sights, more time in gardens, tea rooms and workshops. Base once or twice and let the days run to a walking pace.',
      [
        day('Day 1', `Northern Higashiyama: ${list(['ginkakuji', 'philosophers-path', 'murin-an', 'nanzenji'])}.`),
        day('Day 2', `Craft and Zen in the north-west: ${list(['nishijin-textile-center', 'daitokuji', 'kamigamo-shrine'])}.`),
        day('Day 3', `Tea and ceramics: ${list(['kawai-kanjiro-house', 'ippodo-tea', 'nishiki-market'])}.`),
        day('Day 4', `The Sagano side of Arashiyama: ${list(['gioji', 'okochi-sanso', 'tenryuji'])}.`),
        day('Day 5', `Out to the hills: ${list(['sanzenin', 'shisendo'])}, or the Kurama–Kibune trail if the weather is good and you are walking.`),
        day('Day 6', `Uji for tea: ${list(['byodoin', 'nakamura-tokichi'])}.`),
        day('Day 7', `A rest day. ${list(['funaoka-onsen', 'shimogamo-shrine'])}, and a long lunch.`),
      ],
      'This arc suits a ryokan or a quiet boutique stay. Ask early which sub-temples and workshops are open to visitors on your dates; some change or need booking.', 1),
    arc('Arc three &middot; about 6 days', 'Seasonal and day trips',
      'Built around when you travel, with day trips out of the city. Kyoto is generally busiest in cherry-blossom and autumn-foliage weeks, so book early.',
      [
        day('Spring', `Late March to early April is the usual blossom window, varying by year. ${list(['philosophers-path', 'ninnaji', 'heian-jingu'])}; check forecasts nearer the time.`),
        day('Autumn', `Mid-November to early December is the usual foliage window. ${list(['eikando', 'tofukuji', 'tenryuji'])}; some temples run evening openings that need advance tickets.`),
        day('Day trip', `Uji for tea and ${n('byodoin')}, or ${n('fushimi-sake-district')} after Fushimi Inari.`),
        day('Day trip', `${list(['kurama-dera', 'kibune-shrine', 'kurama-onsen'])}: a mountain trail and a hot spring, in daylight.`),
        day('Day trip', `Nara, about an hour from Kyoto by train: Todai-ji and the deer park. It sits outside Friday’s Kyoto planner map; see ${ext(LINKS.jntoNara, 'Japan National Tourism Organization on Nara')}`),
        day('Rainy day', `${list(['kyoto-national-museum', 'kyoto-railway-museum', 'kyoto-manga-museum'])}.`),
      ],
      'Use the seasonal days as a menu, not a sequence. Keep two or three days of this arc free for weather.', 2),
  ].join('');

  const stay = (area, kind, ids, text) => `
  <article class="c-4 c-md-12 prose" data-reveal>
    <p class="eyebrow eyebrow--accent">${area}</p>
    <h3 class="h3">${kind}</h3>
    <p>${text}</p>
    <p>From Friday’s catalogue: ${list(ids)}.</p>
  </article>`;
  const stays = [
    stay('Gion and Higashiyama', 'Walkable to the old temples', ['sowaka', 'hyatt-regency-kyoto'], 'Best for a first visit if you want to step out at 7am for Kiyomizu-dera and walk back for breakfast. Evenings are lively around Gion; lanes are narrow and taxis are slower at busy times.'),
    stay('Central Kyoto and the river', 'Restaurants, markets, easy transport', ['ritz-carlton-kyoto', 'the-thousand-kyoto'], 'The practical choice: subway and bus links, Nishiki Market and the Kamo river close by. The Thousand Kyoto is by Kyoto Station, which helps with early trains and late arrivals.'),
    stay('Arashiyama and the hills', 'Ryokan and quiet retreats', ['hoshinoya-kyoto', 'yoshida-sanso', 'aman-kyoto'], 'For a slow stay: a ryokan on the river, a small villa-ryokan near the Philosopher’s Path, or a retreat north of the city. Rooms with set dinners usually need dates confirmed well ahead.'),
  ].join('');

  return `
${PageHero({
    eyebrow: 'A Friday field guide',
    title: 'A slower way<br>through Kyoto.',
    lede: 'A starting point for a first or returning Kyoto trip from Bombay: three ways to shape the days, where to stay, and the practical things to check before you fly.',
    seed: 'kyoto-guide-temples', scene: 'forest', tone: 'ember',
  })}
<section class="section section--tight"><div class="wrap">
  <div class="grid" style="align-items:start">
    <article class="c-6 c-md-12 prose" data-reveal>
      <p class="eyebrow">A note on how this guide is made</p>
      <h2 class="h2">What Friday knows, and what it does not.</h2>
      <p>Friday knows India best. This Kyoto guide is built from official tourism and transport sources and from Friday’s place catalogue, and it is written as planning guidance. We have not stayed at the properties named here, and prices, opening days and journey times change. Where a detail matters, we point you to the source to confirm it.</p>
    </article>
    <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
      <p class="eyebrow">How many days do you need in Kyoto?</p>
      <h2 class="h2">Start with the days you have.</h2>
      <p>Friday’s Kyoto planner offers a considered stay of 3–4 days, an unhurried week, or ten days. Three or four days covers the main districts if you keep each day to one area. A week lets you add gardens, craft and a day trip or two. Kyoto’s sights are spread out, so fewer, better-chosen stops usually beat a long list.</p>
    </article>
  </div>
</div></section>
<section class="section inverse"><div class="wrap">
  <p class="eyebrow">Three arcs</p>
  <h2 class="h2">Which shape of<br>Kyoto trip suits you?</h2>
  <p class="lede" style="max-width:42em;margin-top:1rem">These are shapes to start a conversation, not bookings. Every place named is in Friday’s Kyoto catalogue; check opening days, tickets and routes for your own dates.</p>
  <div class="grid" style="margin-top:2rem">${arcs}</div>
</div></section>
<section class="section"><div class="wrap">
  <p class="eyebrow">Where to stay</p>
  <h2 class="h2">A shortlist by neighbourhood.</h2>
  <p class="lede" style="max-width:42em;margin-top:1rem">Choose the neighbourhood first, then the kind of stay. The properties below come from Friday’s catalogue, with no live rates or availability, and are starting points to check with each property.</p>
  <div class="grid" style="margin-top:2rem;align-items:start">${stays}</div>
  <div class="prose" style="margin-top:1.5rem" data-reveal>
    <p>Beyond named hotels, Kyoto offers ryokan (traditional inns, often with dinner and breakfast included), restored machiya townhouses and straightforward business hotels near the station. Ryokan and machiya rules vary on check-in times, meals and shoes indoors, so read the property’s terms before you book.</p>
  </div>
</div></section>
<section class="section"><div class="wrap grid" style="align-items:start">
  <article class="c-6 c-md-12 prose" data-reveal>
    <p class="eyebrow">From Bombay</p>
    <h2 class="h2">How do you fly there?</h2>
    <p>Kyoto has no airport of its own. Most visitors fly into Kansai International (KIX) or Osaka’s Itami (ITM), or into Tokyo and take the Shinkansen. At the time of writing we have not confirmed a nonstop flight from Mumbai to Kansai, so plan on one connection, commonly through a hub such as Tokyo, Hong Kong, Singapore or Bangkok. Some airlines also fly Mumbai to Tokyo; the Tokyo–Kyoto bullet train is generally around two to two and a half hours.</p>
    <p>Routes, airlines and timings change by season. Check the airlines’ own sites and ${ext(LINKS.kix, 'Kansai Airport’s access information')}</p>
  </article>
  <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
    <p class="eyebrow">Getting into Kyoto</p>
    <h2 class="h2">How do you get from KIX or Itami?</h2>
    <p>From Kansai International, the JR Haruka limited express runs to Kyoto Station and is generally quoted at about 70–80 minutes. Itami is nearer Osaka than Kyoto, so expect a bus or rail transfer; confirm the current route and time with the airport and your hotel. Taxis are possible but expensive over this distance.</p>
    <p>Within Kyoto, the subway, buses and walking cover most of the city, and buses can be slow at busy times, so cluster each day in one area.</p>
    <p>${ext(LINKS.jrWest, 'JR West: Haruka and rail passes')}&nbsp;&nbsp;${ext(LINKS.jntoGetting, 'Getting around Japan (JNTO)')}</p>
  </article>
</div></section>
<section class="section"><div class="wrap grid" style="align-items:start">
  <article class="c-6 c-md-12 prose" data-reveal>
    <p class="eyebrow">Visa</p>
    <h2 class="h2">Do Indian passport holders need a visa?</h2>
    <p>Indian passport holders generally need a visa to visit Japan and should apply before travelling. Japan’s Ministry of Foreign Affairs and the Embassy of Japan in India publish the current rules, including how to apply, the documents asked for and processing times. Japan has also introduced an e-Visa for tourism for Indian applicants; confirm on the official pages whether it applies to you. Allow plenty of time, and do not book non-refundable travel until you know your visa timeline.</p>
    <p>This is general guidance, not immigration advice, and rules change.</p>
    <p>${ext(LINKS.mofaVisa, 'Ministry of Foreign Affairs of Japan: visas')}&nbsp;&nbsp;${ext(LINKS.embassy, 'Embassy of Japan in India')}</p>
  </article>
  <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
    <p class="eyebrow">When to go</p>
    <h2 class="h2">What are the best seasons?</h2>
    <ul>
      <li><strong>Spring (late March to April):</strong> cherry blossom. Beautiful and busy; the exact weeks vary by year.</li>
      <li><strong>Autumn (mid-November to early December):</strong> maples and temple illuminations. Friday’s catalogue treats this as the peak colour window, and the most famous temples are crowded by mid-morning.</li>
      <li><strong>Early summer and summer:</strong> a rainy season and then hot, humid weather are typical. Fewer visitors, but plan indoor stops and early starts.</li>
      <li><strong>Winter:</strong> cold and often quieter. Good for gardens, hot springs and tables.</li>
    </ul>
    <p>Seasons shift from year to year, so check current forecasts and event dates before booking.</p>
    <p>${ext(LINKS.kyotoCity, 'Kyoto City Official Travel Guide')}&nbsp;&nbsp;${ext(LINKS.jntoKyoto, 'JNTO on Kyoto')}</p>
  </article>
</div></section>
<section class="section"><div class="wrap grid" style="align-items:start">
  <article class="c-6 c-md-12 prose" data-reveal>
    <p class="eyebrow">Before you go</p>
    <h2 class="h2">What should you pack and respect?</h2>
    <p>Many temples and shrines ask for quiet and have rules on photography. In Gion, be respectful of residents and any maiko you see, and follow the posted signs about private lanes. Comfortable walking shoes you can slip off easily help, since you remove shoes at many temples, ryokan and some restaurants.</p>
    <p>For vegetarian and Jain travellers: dashi stock often contains fish, so ask early and book restaurants that can accommodate you in advance. Friday can help you phrase the request.</p>
  </article>
  <article class="c-6 c-md-12 prose" data-reveal style="--i:1">
    <p class="eyebrow">Budget</p>
    <h2 class="h2">What does a Kyoto trip cost?</h2>
    <p>This guide does not give a trip-wide cost. Your total depends on season, flight routing, the kind of stay and how many set dinners you want. Friday’s sample place data is not a live quote. Share your dates and what matters to you before making a budget or booking decision.</p>
  </article>
</div></section>
${guideFeedback('kyoto')}
<section class="section inverse"><div class="wrap grid" style="align-items:center">
  <div class="c-7 c-md-12"><p class="eyebrow">Take the next step</p><h2 class="h2">Make Kyoto<br>your own route.</h2><p class="lede" style="margin-top:1rem">Start with the places that interest you, then shape the pace and dates with Friday.</p></div>
  <div class="c-5 c-md-12" style="display:grid;gap:1rem"><a class="btn" data-guide-cta="planner" href="trip.html?destination=kyoto&amp;from_guide=kyoto#/new">Plan your Kyoto trip <span class="arrow">&rarr;</span></a><a class="link" data-guide-cta="quote" href="contact.html?quote_path=guide&amp;destination=kyoto">Ask Friday about a quote <span class="arrow">&rarr;</span></a></div>
</div></section>`;
}

module.exports = { kyotoGuide };
