'use strict';
/* Ladakh destination for the Friday planner. Sample data: ratings and review counts are plausible, not live. */

// place(name, kind, label, rating, reviews, price, area, [lng, lat], blurb, scene, tone)
const place = (name, kind, label, rating, reviews, price, area, at, blurb, scene, tone) =>
  ({ name, kind, label, rating, reviews, price, area, at, blurb, scene, tone });

const places = {
  /* Leh */
  'leh-palace': place('Leh Palace', 'sight', 'Historical Landmark', 4.5, 9412, null, 'leh', [77.586, 34.165],
    'Nine-storey royal palace above the old town. Go early, when the light is soft and the rooftops are quiet.', 'peaks', 'sand'),
  'shanti-stupa': place('Shanti Stupa', 'sight', 'Tourist Attraction', 4.6, 14230, null, 'leh', [77.567, 34.181],
    'A white-domed peace stupa above Leh. Sunset is the gentle way to see the valley from above.', 'peaks', 'ice'),
  'namgyal-tsemo': place('Namgyal Tsemo Monastery', 'sight', 'Monastery', 4.5, 2860, null, 'leh', [77.578, 34.169],
    'A small red gompa on the ridge behind the palace, with a wide view over Leh and the Indus valley.', 'peaks', 'ember'),
  'leh-main-bazaar': place('Leh Main Bazaar', 'market', 'Market', 4.3, 5175, null, 'leh', [77.584, 34.165],
    'A wide, walkable street of pashmina, apricots and prayer flags. Easy on the lungs and good for slow browsing.', 'city', 'rose'),
  'hall-of-fame': place('Hall of Fame Museum', 'museum', 'Museum', 4.6, 6980, null, 'leh', [77.56, 34.13],
    'The army-run museum on Ladakh, Siachen and the region\'s history. Covered, calm and useful on a rest afternoon.', 'city', 'slate'),
  'spituk-monastery': place('Spituk Monastery', 'sight', 'Monastery', 4.4, 1950, null, 'leh', [77.503, 34.127],
    'A hilltop gompa near the airport with a huge protector deity hall and long views along the Indus.', 'peaks', 'plum'),
  /* Indus valley (east of Leh) */
  'shey-palace': place('Shey Palace and Monastery', 'sight', 'Historical Landmark', 4.4, 3120, null, 'indus', [77.629, 34.076],
    'The former summer capital of Ladakh\'s kings, with a great gilded Buddha and a quiet ruined fort above.', 'peaks', 'sand'),
  'thiksey-monastery': place('Thiksey Monastery', 'sight', 'Monastery', 4.7, 7290, null, 'indus', [77.667, 34.058],
    'A twelve-storey gompa that looks like a small Potala. Morning prayers at about 7am are worth the early start.', 'peaks', 'ember'),
  'hemis-monastery': place('Hemis Monastery', 'sight', 'Monastery', 4.6, 4380, null, 'indus', [77.705, 33.911],
    'Ladakh\'s largest and richest monastery, tucked into a side valley. The museum holds fine thangkas.', 'peaks', 'jade'),
  'stok-palace': place('Stok Palace Museum', 'museum', 'Museum', 4.3, 1470, null, 'indus', [77.56, 34.0],
    'The royal family\'s home, with a small museum of crowns, coins and thangkas. A quiet half-day across the Indus.', 'terraces', 'sand'),
  /* Sham valley (west of Leh) */
  'magnetic-hill': place('Magnetic Hill', 'nature', 'Tourist Attraction', 4.0, 6410, null, 'sham', [77.39, 34.17],
    'A short stop on the Srinagar road where cars seem to roll uphill. Best treated as a fun pause on the way west.', 'canyon', 'sand'),
  'sangam-viewpoint': place('Indus and Zanskar Confluence', 'nature', 'Scenic Viewpoint', 4.7, 5240, null, 'sham', [77.34, 34.19],
    'Where the green Zanskar meets the milky-grey Indus below Nimmu. Rafting starts nearby in summer.', 'canyon', 'cobalt'),
  'alchi-monastery': place('Alchi Monastery', 'sight', 'Monastery', 4.7, 2190, null, 'sham', [77.17, 34.22],
    'An eleventh-century monastery with some of the region\'s oldest wall paintings. It sits low, so it is easy on the body.', 'peaks', 'moss'),
  'lamayuru-monastery': place('Lamayuru Monastery', 'sight', 'Monastery', 4.7, 3310, null, 'sham', [76.79, 34.29],
    'A gompa above a moonscape of eroded lakebed hills. Long drive, so make it the anchor of the day.', 'canyon', 'plum'),
  /* Nubra */
  'khardung-la': place('Khardung La', 'nature', 'Mountain Pass', 4.4, 8760, null, 'nubra', [77.604, 34.278],
    'A 5,359 m pass on the road to Nubra. Stay no longer than twenty minutes at the top and keep sipping water.', 'peaks', 'ice'),
  'diskit-monastery': place('Diskit Monastery', 'sight', 'Monastery', 4.6, 3670, null, 'nubra', [77.56, 34.54],
    'Nubra\'s oldest gompa, with a 32 m Maitreya Buddha looking down the Shyok valley.', 'peaks', 'ember'),
  'hunder-dunes': place('Hunder Sand Dunes', 'nature', 'Tourist Attraction', 4.4, 4520, null, 'nubra', [77.47, 34.58],
    'A cold-desert dune field with double-humped Bactrian camels and snow peaks behind. Golden at sunset.', 'dunes', 'sand'),
  'samstanling-monastery': place('Samstanling Monastery', 'sight', 'Monastery', 4.5, 1240, null, 'nubra', [77.55, 34.68],
    'A working monastery at Sumur in the upper Nubra valley, with a calm courtyard and views across the fields.', 'peaks', 'jade'),
  'panamik-hot-springs': place('Panamik Hot Springs', 'wellness', 'Hot Springs', 4.1, 980, null, 'nubra', [77.55, 34.78],
    'Sulphur springs at the northern end of the valley. A warm soak after a long drive.', 'terraces', 'jade'),
  'turtuk-village': place('Turtuk Village', 'neighborhood', 'Village', 4.7, 1820, null, 'nubra', [76.83, 34.85],
    'A Balti village of apricot orchards and stone lanes at the far end of the Shyok. It needs its own day.', 'terraces', 'moss'),
  /* Pangong */
  'pangong-tso': place('Pangong Tso', 'nature', 'Lake', 4.8, 12640, null, 'pangong', [78.66, 33.73],
    'A long salt lake that turns from turquoise to deep blue and violet through the day. Bring warm layers.', 'isles', 'cobalt'),
  /* Tso Moriri and Changthang */
  'tso-moriri': place('Tso Moriri', 'nature', 'Lake', 4.7, 2140, null, 'tsomoriri', [78.31, 32.9],
    'A high, quiet lake at about 4,500 m, ringed by grassland where kiang and marmots graze.', 'isles', 'ice'),
  'korzok-monastery': place('Korzok Monastery', 'sight', 'Monastery', 4.4, 420, null, 'tsomoriri', [78.31, 32.93],
    'A small gompa on the shore of Tso Moriri, in one of the highest settlements in the region.', 'peaks', 'slate'),
  'tso-kar': place('Tso Kar', 'nature', 'Lake', 4.5, 610, null, 'tsomoriri', [77.99, 33.3],
    'A white-rimmed salt lake on the high plateau. Good for birds and for a long silence.', 'arctic', 'ice'),
  /* Food and cafes */
  'tibetan-kitchen': place('The Tibetan Kitchen', 'food', 'Restaurant', 4.5, 2210, null, 'leh', [77.582, 34.164],
    'Warm, honest Tibetan food: thukpa, momos and butter tea. A dependable first-night dinner.', 'city', 'ember'),
  'gesmo-restaurant': place('Gesmo Restaurant', 'food', 'Restaurant', 4.2, 1890, null, 'leh', [77.583, 34.166],
    'A long-running Leh restaurant with a wide menu and a garden. Comfortable when you want something familiar.', 'city', 'sand'),
  'bon-appetit-leh': place('Bon Appetit', 'food', 'Restaurant', 4.4, 1240, null, 'leh', [77.584, 34.163],
    'Ladakhi and continental dishes in a quiet upstairs room. Ask for the local barley dishes.', 'city', 'jade'),
  'summer-harvest': place('Summer Harvest', 'food', 'Restaurant', 4.3, 1520, null, 'leh', [77.584, 34.165],
    'Ladakhi, Tibetan and Indian dishes, served without fuss near the bazaar.', 'city', 'rose'),
  'german-bakery-leh': place('German Bakery', 'food', 'Bakery', 4.1, 3380, null, 'leh', [77.583, 34.167],
    'Apple pie, sea buckthorn juice and strong coffee in the middle of the bazaar. A good breakfast stop.', 'city', 'sand'),
  /* Cafes and rooftops (Leh has little nightlife) */
  'lalas-art-cafe': place('Lala\'s Art Cafe', 'nightlife', 'Cafe', 4.5, 1060, null, 'leh', [77.582, 34.163],
    'A courtyard cafe in a converted old house. Good tea, soft light and a place to write postcards.', 'city', 'plum'),
  'amdo-cafe': place('Amdo Cafe', 'nightlife', 'Rooftop Cafe', 4.3, 780, null, 'leh', [77.584, 34.164],
    'A rooftop above the bazaar for a slow evening with a view of the palace.', 'city', 'rose'),
  'open-hand-cafe': place('The Open Hand Cafe', 'nightlife', 'Cafe', 4.4, 940, null, 'leh', [77.583, 34.164],
    'A relaxed cafe and bookshop for evening soup and a quiet hour. Everyone is in bed early in Leh.', 'city', 'jade'),
  /* Stays (price per night, INR) */
  'grand-dragon-ladakh': place('The Grand Dragon Ladakh', 'stay', 'Hotel', 4.6, 3120, 15000, 'leh', [77.577, 34.153],
    'A comfortable hotel with heated rooms and an oxygen-friendly reputation. A solid first base in Leh.', 'peaks', 'slate'),
  'chamba-camp-thiksey': place('Chamba Camp Thiksey', 'stay', 'Luxury Tent Camp', 4.8, 610, 42000, 'indus', [77.663, 34.055],
    'Furnished tents on the Indus plain with a view of Thiksey. Quiet and well run.', 'terraces', 'sand'),
  'ladakh-sarai': place('Ladakh Sarai', 'stay', 'Boutique Hotel', 4.6, 740, 18000, 'indus', [77.636, 34.06],
    'Wooden cottages and yurts among apricot trees, a short drive from Thiksey and Shey.', 'terraces', 'moss'),
  'stok-palace-heritage': place('Stok Palace Heritage Hotel', 'stay', 'Heritage Hotel', 4.4, 380, 14000, 'indus', [77.561, 34.002],
    'A room in the royal family\'s palace across the Indus. A calm alternative to the town.', 'peaks', 'plum'),
  'zostel-leh': place('Zostel Leh', 'stay', 'Hostel', 4.3, 2450, 1500, 'leh', [77.575, 34.155],
    'A friendly hostel with a sunny courtyard and a good place to meet other travellers.', 'city', 'jade'),
  'chamba-camp-diskit': place('Chamba Camp Diskit', 'stay', 'Luxury Tent Camp', 4.7, 420, 38000, 'nubra', [77.557, 34.54],
    'Tents with heaters in a Nubra orchard, close to Diskit monastery.', 'dunes', 'sand'),
  'pangong-camp': place('The Ultimate Travelling Camp, Pangong', 'stay', 'Luxury Tent Camp', 4.5, 560, 22000, 'pangong', [78.64, 33.72],
    'A camp a few steps from the lake shore. Nights are very cold, so expect heaters and hot water bottles.', 'isles', 'cobalt'),
  'tso-moriri-camp': place('Tso Moriri Lakeside Camp', 'stay', 'Tent Camp', 4.2, 210, 9000, 'tsomoriri', [78.3, 32.93],
    'A simple camp beside the lake at 4,500 m. Book only after you have spent several nights lower down.', 'isles', 'ice')
};

const T_MON = 'Ancient monasteries & living Buddhist culture';
const T_ADV = 'High passes, valleys & mountain trails';
const T_LAK = 'High-altitude lakes & silent plains';
const T_SLO = 'Slow acclimatised retreat & mountain quiet';

module.exports = {
  id: 'ladakh',
  name: 'Ladakh',
  tripTitle: 'Ladakh High Passes',
  threadTitle: 'Plan Ladakh Trip',
  match: ['ladakh', 'leh', 'nubra', 'pangong', 'khardung', 'zanskar', 'tso moriri', 'thiksey', 'hemis', 'lamayuru', 'diskit', 'turtuk'],
  currency: '₹',
  region: 'Leh and the Indus valley',
  scene: 'peaks',
  tone: 'slate',
  card: { caption: 'Ladakh', scene: 'peaks', tone: 'ice' },
  prompt: 'Plan a trip to Ladakh',

  map: {
    bounds: [76.6, 32.75, 79.1, 35.0],
    land: [[[76.5, 32.7], [79.2, 32.7], [79.2, 35.1], [76.5, 35.1], [76.5, 32.7]]],
    water: [
      // Indus, from the Changthang plateau north-west through Leh
      [[79.0, 32.85], [78.7, 33.15], [78.4, 33.3], [78.25, 33.4], [78.0, 33.55], [77.85, 33.78], [77.75, 33.92], [77.66, 34.03], [77.55, 34.1], [77.45, 34.13], [77.34, 34.17], [77.2, 34.24], [77.05, 34.3], [76.88, 34.33], [76.72, 34.38]],
      // Zanskar river to the Indus at Nimmu
      [[76.9, 33.47], [77.0, 33.65], [77.15, 33.85], [77.25, 34.0], [77.33, 34.17]],
      // Shyok through Nubra to Turtuk
      [[78.1, 34.2], [77.95, 34.35], [77.75, 34.45], [77.6, 34.52], [77.45, 34.62], [77.3, 34.7], [77.1, 34.75], [76.9, 34.82], [76.8, 34.85]],
      // Nubra river from the north
      [[77.6, 34.98], [77.55, 34.78], [77.55, 34.68], [77.5, 34.6]],
      // Lakes, drawn as centre lines: Pangong Tso, Tso Moriri, Tso Kar
      [[78.42, 33.83], [78.55, 33.78], [78.7, 33.74], [78.85, 33.72], [79.0, 33.74]],
      [[78.3, 32.98], [78.32, 32.9], [78.33, 32.83]],
      [[77.98, 33.35], [78.02, 33.28]]
    ],
    parks: [
      [[77.15, 33.78], [77.45, 33.85], [77.65, 33.75], [77.75, 33.55], [77.55, 33.35], [77.25, 33.4], [77.1, 33.6]],
      [[78.0, 32.8], [78.6, 32.85], [78.7, 33.4], [78.3, 33.6], [78.0, 33.5]]
    ],
    roads: [
      { ref: 'NH1', path: [[77.58, 34.16], [77.34, 34.19], [77.2, 34.24], [77.05, 34.3], [76.88, 34.32], [76.79, 34.29], [76.62, 34.34]] },
      { ref: 'NH3', path: [[77.58, 34.16], [77.7, 34.0], [77.82, 33.83], [77.9, 33.7], [77.85, 33.45], [77.7, 33.1], [77.6, 32.85]] },
      { ref: 'KL', path: [[77.58, 34.17], [77.6, 34.28], [77.6, 34.4], [77.58, 34.5], [77.56, 34.54], [77.47, 34.58]] },
      { ref: 'PT', path: [[77.58, 34.16], [77.75, 34.1], [77.93, 34.04], [78.2, 34.04], [78.45, 33.8], [78.64, 33.72]] },
      { ref: 'TM', path: [[77.82, 33.83], [78.05, 33.55], [78.28, 33.36], [78.3, 33.1], [78.31, 32.93]] }
    ],
    labels: [
      { t: 'Leh', at: [77.58, 34.14], kind: 'town' },
      { t: 'Nimmu', at: [77.33, 34.2], kind: 'town' },
      { t: 'Lamayuru', at: [76.79, 34.31], kind: 'town' },
      { t: 'Diskit', at: [77.56, 34.56], kind: 'town' },
      { t: 'Turtuk', at: [76.9, 34.87], kind: 'town' },
      { t: 'Spangmik', at: [78.66, 33.68], kind: 'town' },
      { t: 'Korzok', at: [78.42, 32.93], kind: 'town' },
      { t: 'NUBRA', at: [77.35, 34.88], kind: 'region' },
      { t: 'ZANSKAR', at: [76.95, 33.35], kind: 'region' },
      { t: 'CHANGTHANG', at: [78.55, 33.2], kind: 'region' },
      { t: 'SHAM', at: [77.05, 34.13], kind: 'region' },
      { t: 'Hemis National Park', at: [77.4, 33.62], kind: 'park' },
      { t: 'Pangong Tso', at: [78.75, 33.85], kind: 'park' }
    ]
  },

  areas: [
    { id: 'leh', name: 'Leh', town: 'Leh', alt: 'Leh town', at: [77.58, 34.16] },
    { id: 'indus', name: 'Indus Valley', town: 'Indus Valley', alt: 'Thiksey and Hemis', at: [77.66, 34.05] },
    { id: 'sham', name: 'Sham Valley', town: 'Sham Valley', alt: 'Alchi and Lamayuru', at: [77.17, 34.22] },
    { id: 'nubra', name: 'Nubra Valley', town: 'Nubra Valley', alt: 'Diskit and Hunder', at: [77.56, 34.54] },
    { id: 'pangong', name: 'Pangong Tso', town: 'Pangong Tso', alt: 'Spangmik', at: [78.66, 33.73] },
    { id: 'tsomoriri', name: 'Tso Moriri', town: 'Tso Moriri', alt: 'Changthang', at: [78.31, 32.93] }
  ],

  places,

  // High-altitude rule the generator applies: day 1 is a rest day in the arrival area with gentle
  // stops only, and the far high areas wait until `afterDay` (a trip type can ask for longer).
  acclimatisation: {
    arrivalArea: 'leh',
    highAreas: ['nubra', 'pangong', 'tsomoriri'],
    afterDay: 3,
    gentleKinds: ['food', 'market', 'neighborhood', 'wellness'],
    arrivalStops: 3
  },

  clarify: {
    types: { q: 'How should we shape your journey into Ladakh?', options: [T_MON, T_ADV, T_LAK, T_SLO] },
    duration: {
      q: 'How many days would you give to Ladakh? The altitude calls for a deliberate start—five days or more allows the rhythm to settle.',
      options: [
        { label: 'A gentle start (~5 days)', days: 5 },
        { label: 'An unhurried week (~7 days)', days: 7 },
        { label: 'A high valley immersion (~10 days)', days: 10 }
      ]
    },
    dates: { q: 'Select your travel dates for Ladakh so I can check seasonal road status and boutique camp availability.' },
    base: {
      q: 'For this {type} journey, which sanctuary should anchor your stay?',
      options: ['Leh old town, close to cafes and the bazaar', 'A quiet Indus valley village sanctuary', 'Tented camps in Nubra and by the lake']
    }
  },

  stays: {
    query: 'camps and boutique hotels in Ladakh India',
    found: 14,
    ids: ['grand-dragon-ladakh', 'ladakh-sarai', 'chamba-camp-thiksey', 'stok-palace-heritage', 'chamba-camp-diskit', 'pangong-camp', 'tso-moriri-camp', 'zostel-leh'],
    byBase: {
      'Leh town, close to cafes and the bazaar': 'grand-dragon-ladakh',
      'Leh old town, close to cafes and the bazaar': 'grand-dragon-ladakh',
      'A quiet Indus valley village stay': 'ladakh-sarai',
      'A quiet Indus valley village sanctuary': 'ladakh-sarai',
      'Tented camps in Nubra and by the lake': 'chamba-camp-thiksey'
    }
  },

  extras: {
    food: ['tibetan-kitchen', 'gesmo-restaurant', 'bon-appetit-leh', 'summer-harvest', 'german-bakery-leh'],
    nightlife: ['lalas-art-cafe', 'amdo-cafe', 'open-hand-cafe'],
    relaxedDrop: 1
  },

  suggestions: ['Find quiet monastery cafes & Old Town bakeries', 'Curate warm Himalayan dining near my base', 'Allow more time to acclimatise & wander'],

  replies: {
    planIntro: {
      [T_MON]: "I'll start with a peaceful rest day in Leh, then compose your route around the great gompas of the Indus and Sham valleys.",
      'Monasteries and culture': "I'll start with a peaceful rest day in Leh, then compose your route around the great gompas of the Indus and Sham valleys.",
      [T_ADV]: "I'll dedicate day 1 to acclimatisation, then ascend gradually through the Indus valley before crossing Khardung La.",
      'High-altitude adventure': "I'll dedicate day 1 to acclimatisation, then ascend gradually through the Indus valley before crossing Khardung La.",
      [T_LAK]: "I'll ensure three nights around Leh first, bringing you up to Pangong Tso only once your body has settled into the altitude.",
      'Lakes and landscapes': "I'll ensure three nights around Leh first, bringing you up to Pangong Tso only once your body has settled into the altitude.",
      [T_SLO]: "I'll spend the first days close to Leh, adding the high passes only once you have had time to acclimatise and wander unhurried.",
      'Slow acclimatised trip': "I'll spend the first days close to Leh, adding the high passes only once you have had time to acclimatise and wander unhurried."
    },
    planDone: 'Here is your **{days}-day** Ladakh plan for {month}. Day 1 has no sightseeing, on purpose: Leh sits at about 3,500 m, and a quiet first day is the best protection for the rest of the trip.\n\nThe high passes and Pangong only come after at least three nights in Leh. Ladakh\'s roads are generally open from about June to mid-September, so if {month} falls outside that window, tell me and I will adjust the dates or the route.',
    staysIntro: 'I\'ll base you in Leh for the first nights so you can acclimatise, then add a camp where the route heads out to the valleys and lakes, plus a few good cafes.',
    staysDone: 'Your Ladakh plan is now dated **{range}**.\n\nI added **{stay}** as your Leh base, plus two meals that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. Nubra and Pangong nights are marked as camps. Book them early in July and August, when rooms are scarce.',
    reserve: 'I can\'t reserve or pay for anything in this planner. Camps, permits and drivers may need advance planning; contact the relevant providers directly to check requirements, prices and availability.',
    relaxed: 'I\'ve removed the busiest stop from each day. Ladakh rewards a slower pace, and with less driving you will have more energy at altitude.',
    food: 'I curated comforting Himalayan tables near your stay in Leh. Warm skyu, steaming thukpa, and apricot desserts suited for high desert evenings.',
    nightlife: 'Leh\'s evenings are quiet and contemplative. I added lantern-lit cafes and rooftop tea terraces for tranquil dusk views.',
    fallback: 'I can help you plan Ladakh: adjust days, add a monastery, cafe or camp, or reorder the route. Remember that acclimatisation shapes everything here. What would you like to change?'
  },

  deep: {
    steps: ['Reading the brief', 'Searching sources', 'Comparing routes and acclimatisation', 'Checking road and permit notes', 'Writing the plan'],
    sources: [
      { title: 'Leh district: tourist information and permits', domain: 'leh.nic.in', note: 'Official district notes on permits and inner-line areas' },
      { title: 'Ladakh: destination overview', domain: 'incredibleindia.gov.in', note: 'National tourism overview of the region' },
      { title: 'Leh and Ladakh travel guide', domain: 'lonelyplanet.com', note: 'Route ideas and seasonal notes for the main valleys' },
      { title: 'Ladakh travel guide', domain: 'roughguides.com', note: 'Monastery descriptions and pacing suggestions' },
      { title: 'A first-timer\'s guide to Ladakh', domain: 'cntraveller.in', note: 'Where to stay and how to sequence the days' },
      { title: 'Ladakh', domain: 'en.wikivoyage.org', note: 'Distances, altitudes and road connections' },
      { title: 'Traveler\'s health: high-altitude travel and altitude sickness', domain: 'wwwnc.cdc.gov', note: 'Acclimatisation principles and symptoms to watch for' },
      { title: 'Regional weather outlook for Leh', domain: 'mausam.imd.gov.in', note: 'Typical temperatures and monthly conditions' },
      { title: 'Road status and pass opening notes', domain: 'bro.gov.in', note: 'Border Roads Organisation updates on Manali-Leh and Srinagar-Leh' },
      { title: 'How to plan a trip to Ladakh', domain: 'thehindu.com', note: 'Practical notes from recent travellers' },
      { title: 'Things to do in Leh: traveller reviews', domain: 'tripadvisor.in', note: 'Review patterns for monasteries and cafes' },
      { title: 'Photographing Ladakh\'s lakes and passes', domain: 'nationalgeographic.com', note: 'Lake colours and best times of day' }
    ],
    lines: [
      'Read leh.nic.in: permit requirements for Nubra and Pangong',
      'Searched "Ladakh acclimatisation itinerary first three days"',
      'Read wwwnc.cdc.gov: altitude sickness and gradual ascent',
      'Compared Leh at 3,500 m with Nubra at about 3,100 m',
      'Read bro.gov.in: pass opening and closing notes',
      'Read lonelyplanet.com: Sham valley day trips from Leh',
      'Searched "Pangong Tso best time to visit"',
      'Checked mausam.imd.gov.in: daytime and night temperatures',
      'Read cntraveller.in: camps in Nubra and Pangong',
      'Compared four candidate bases and their drive times'
    ],
    report: {
      title: 'Ladakh in summer: how to sequence the valleys and lakes',
      summary: 'Ladakh is best in the warmer months, from about June to mid-September, when the roads are open [8][9]. Most of its magic sits above 3,000 m, so the shape of the trip matters more than the number of sights: start with a quiet day in Leh, then add height gradually [1][7].',
      sections: [
        { h: 'When to go', body: 'The passes are generally open in the summer months. Days are sunny and nights are cold, and the road status is worth checking before you fix a route [8][9]. Outside that window, the high roads may be shut and many camps close [3][9]. If your dates fall in the shoulder months, Leh and the lower valleys are still worth a visit, but Pangong and Tso Moriri may not be reachable.' },
        { h: 'Acclimatising properly', body: 'Leh sits at about 3,500 m. The usual advice is to spend the first day or two resting, drink plenty of water and avoid alcohol [7]. Keep the high passes and lakes for after at least three nights in the region [1][7]. Nubra is lower than Leh, so it is a good first step once you have crossed Khardung La. Pangong and Tso Moriri are higher, at about 4,250 m and 4,500 m, so plan them last.' },
        { h: 'How to sequence the days', body: 'Start with Leh and its monasteries: the palace, Thiksey and Shey [3][4]. Add the Sham valley for Alchi and Lamayuru [4][6]. Then head to Nubra over Khardung La, and finish at Pangong or Tso Moriri if you have time [3][5][12]. Keep long drives to one a day, and allow a buffer day in case of weather or road closures [9].' },
        { h: 'Permits and practicalities', body: 'Nubra, Pangong and the Changthang lakes need permits for some visitors, which local operators generally arrange in Leh [1][2]. Bring warm layers, sun protection and a refillable bottle. Camps are simple, so expect heaters and hot water, but not luxury [5][11].' }
      ],
      table: {
        caption: 'Choosing a base',
        cols: ['Base', 'Feel', 'Best for', 'Altitude', 'Drive from Leh'],
        rows: [
          ['Leh town', 'Lively, walkable, cafes', 'First nights and monasteries', 'About 3,500 m', 'Local'],
          ['Indus valley village', 'Quiet, orchards', 'Thiksey and Hemis', 'About 3,300 m', '30 to 60 minutes'],
          ['Nubra Valley', 'Warm days, dunes, apricots', 'Diskit, Hunder and Turtuk', 'About 3,100 m', '5 to 6 hours'],
          ['Pangong Tso', 'Remote, high, cold nights', 'Lake views and stargazing', 'About 4,250 m', '5 to 6 hours']
        ]
      }
    }
  }
};
