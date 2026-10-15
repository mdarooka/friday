'use strict';
/* Public guides for catalogues that already exist. Copy stays inside those catalogues.
 * Sample place data is not live inventory. Kyoto stays out of the new-trip list. */

const sampleIntro = 'These are places from Friday’s hand-researched destination catalogue. Ratings and review counts in that catalogue are sample data, not live figures. A designer confirms what can be held.';

const EXTRA_GUIDES = [
  {
    id: 'srilanka',
    file: 'srilanka-guide.html',
    footerLabel: 'Sri Lanka guide',
    title: 'Sri Lanka Travel Guide: Coast, Hills and the Cultural Triangle',
    description: 'Plan a Sri Lanka trip from the catalogue: Galle and the south coast, Kandy and the tea hills, Sigiriya, and the east when the season suits. Sample data, not a live quote.',
    areaOrder: ['colombo', 'galle', 'mirissa', 'kandy', 'nuwara-eliya', 'ella', 'sigiriya', 'yala', 'trincomalee', 'arugam-bay'],
    hero: {
      eyebrow: 'A Friday field guide',
      title: 'Coast, hills,<br>one island.',
      lede: 'A starting point from Friday’s Sri Lanka catalogue. Roads are slower than the map suggests, so a good trip picks two or three bases. Sample catalogue, not live inventory.',
      seed: 'srilanka-guide',
      scene: 'terraces',
      tone: 'moss',
    },
    days: {
      eyebrow: 'How many days do you need in Sri Lanka?',
      title: 'Start with the days you have.',
      body: 'Friday’s Sri Lanka planner offers three lengths: an unhurried week, a ten-day loop, or about fourteen days. They are prompts, not packages. The catalogue keeps most days to one area, with a long drive on the days you change base.',
    },
    season: {
      eyebrow: 'When is the best time to visit Sri Lanka?',
      title: 'The two coasts do not peak together.',
      body: 'The catalogue says the island has two monsoons, so the coast and the hills are not at their best at the same time. The south-west coast is generally best from December to March, and the east coast from about April to September. Whale watching off Mirissa is described as generally best from November to April. Elephant gatherings at the Minneriya reservoir are a dry-season note, about July to October. This guide does not confirm live weather.',
    },
    placesIntro: sampleIntro,
    placesTitle: 'Which places fit<br>one Sri Lanka trip?',
    compare: {
      eyebrow: 'Bases',
      title: 'South coast, hills, or the Cultural Triangle?',
      body: 'The catalogue does not rank them. Galle Fort is a walkable Dutch fort for late afternoon. The tea hills sit at Nuwara Eliya and Ella. Sigiriya anchors the Cultural Triangle. A short trip chooses one of those, not all three. Sample listings are not live booking details.',
    },
    budget: {
      eyebrow: 'Budget',
      title: 'What does a Sri Lanka trip cost?',
      body: 'This catalogue does not provide a current, trip-wide cost. Sample place data is not a live quote. Share dates and pace before anyone prices the trip.',
    },
    areaNotes: {
      colombo: 'A first or last night: Gangaramaya beside Beira Lake, the National Museum, and Galle Face Green at sunset.',
      galle: 'The fort’s ramparts, a lighthouse on the southern tip, and the beaches at Hikkaduwa and Unawatuna.',
      mirissa: 'A morning boat for blue whales and dolphins, described as generally best from November to April.',
      kandy: 'The Temple of the Sacred Tooth Relic, beside Kandy Lake. The catalogue suggests the evening ritual, and modest clothing.',
      'nuwara-eliya': 'Tea country. The catalogue treats it as a highland base, not a day trip from the beach.',
      ella: 'A hill base of its own, with the slow roads the planner warns about between bases.',
      sigiriya: 'Sigiriya Rock, climbed at opening time, and Minneriya, where elephants gather in the dry season, about July to October.',
      yala: 'Udawalawe is open grassland the catalogue associates with elephants. Yala is the best-known park for leopards, and the note there is a crowd of jeeps at dawn.',
      trincomalee: 'The east coast, which the catalogue puts at its better months from about April to September.',
      'arugam-bay': 'A surf bay on the south-east. The catalogue puts that season at roughly May to September.',
    },
    getting: {
      eyebrow: 'Getting there and around',
      title: 'Short on the map, slow on the road.',
      body: [
        'The catalogue’s planning note is that distances look short and the roads are slow and winding, so a change of base is the long drive of the day.',
        'Pick the coast that matches the month. The south-west is the December to March side; the east is about April to September.',
      ],
    },
    routes: {
      eyebrow: 'Sample route shapes',
      title: 'How the planner’s lengths can be laid out.',
      intro: 'These follow the catalogue’s three lengths. They are shapes, not bookings.',
      items: [
        { label: 'About 7 days', title: 'One coast', body: 'A week on the south-west in the dry months: Colombo if you need a first night, then Galle and Mirissa. Leave the hills for a longer trip.' },
        { label: 'About 10 days', title: 'Coast and one hill base', body: 'South coast, then one of Kandy, Nuwara Eliya or Ella. Do not try to add Sigiriya in the same ten days unless you are happy with the drives.' },
        { label: 'About 14 days', title: 'Two or three bases', body: 'South or east coast, the hills, and the Cultural Triangle, with a day for each move. The east-coast months and the south-west months are not the same.' },
      ],
    },
    faq: {
      eyebrow: 'Quick answers',
      title: 'Questions the catalogue already answers.',
      items: [
        { q: 'Can I see the whole island in a week?', a: 'The catalogue says no. Roads are slow, and a good trip picks two or three bases.' },
        { q: 'When is the south coast easier?', a: 'December to March, in the catalogue’s monsoon note. The east coast is the other half of the year.' },
        { q: 'Is whale watching a sure thing?', a: 'No. The Mirissa boat is described as generally best from November to April. It is not a confirmed departure.' },
        { q: 'Are the prices in the catalogue live?', a: 'No. Ratings, review counts and any sample figures are not a quote. A designer confirms what can be held.' },
      ],
    },
    cta: {
      title: 'Make Sri Lanka<br>your own route.',
      lede: 'Start from the catalogue, then shape dates and pace with Friday. A designer confirms rooms and drives.',
      plannerLabel: 'Plan your Sri Lanka trip',
    },
  },
  {
    id: 'kyoto',
    file: 'kyoto-guide.html',
    footerLabel: 'Kyoto guide',
    title: 'Kyoto in Autumn: Temples, One Neighbourhood a Day',
    description: 'An autumn starting point from Friday’s Kyoto catalogue: foliage from mid-November, one area a day, and no live bookings. Kyoto is not in the new-trip list; a designer plans it with you.',
    plannerHref: 'trip.html?from_guide=kyoto#/new',
    areaOrder: ['higashiyama', 'gion', 'central', 'arashiyama', 'northwest', 'n-higashiyama', 'fushimi', 'ohara-kurama', 'uji'],
    hero: {
      eyebrow: 'A Friday field guide',
      title: 'Autumn, one<br>neighbourhood a day.',
      lede: 'From Friday’s Kyoto catalogue. Autumn colour generally peaks from mid-November to early December. This is sample catalogue data, not a live plan. Kyoto is not offered as a new trip in the planner; ask a designer.',
      seed: 'kyoto-guide',
      scene: 'forest',
      tone: 'ember',
    },
    days: {
      eyebrow: 'How many days do you need in Kyoto in autumn?',
      title: 'One area a day.',
      body: 'The catalogue keeps each day to one area, because the sights are spread out and buses are slow when the temples are busy. The lengths it offers are about five days, a week, or ten days. They are prompts. Famous temples go first thing in the morning.',
    },
    season: {
      eyebrow: 'When do the maples turn?',
      title: 'Mid-November into early December.',
      body: 'The catalogue says autumn colour generally peaks from mid-November to early December, a little earlier in the northern hills and later in the centre. Weekends are crowded. Kiyomizu-dera has an autumn evening opening. Kodai-ji’s evening illumination is popular. Nijo Castle’s garden is at its best in mid-November. Tenryu-ji’s maples turn in mid-to-late November. Kitano Tenmangu turns from late November. This guide does not confirm this year’s forecast.',
      linkHref: 'https://kyoto.travel',
      linkLabel: 'Kyoto City Official Travel Guide',
    },
    placesIntro: sampleIntro + ' Stays are left off this page so a sample hotel rate is not read as a price.',
    placesTitle: 'Which neighbourhood<br>for which day?',
    compare: {
      eyebrow: 'Autumn bases',
      title: 'Higashiyama or Arashiyama for the maples?',
      body: 'The catalogue does not choose for you. Southern Higashiyama has Kiyomizu-dera’s wooden stage over the maples. Arashiyama’s Tenryu-ji turns in mid-to-late November. Northern Higashiyama has Eikan-do, which the catalogue calls Kyoto’s best autumn temple, with a night opening, and Nanzen-ji, whose maples turn late in November. Pick one neighbourhood a day.',
    },
    budget: {
      eyebrow: 'Budget',
      title: 'What does an autumn week cost?',
      body: 'The catalogue does not give a trip-wide cost. It does say the best kaiseki and ryokan dinners book out weeks ahead in November. Sample figures are not a quote.',
    },
    areaNotes: {
      higashiyama: 'Kiyomizu-dera’s stage over the maples, with an autumn evening opening. Sannenzaka and Ninenzaka lead down from it. Kodai-ji’s evening illumination is popular.',
      gion: 'Hanamikoji’s wooden machiya, Yasaka Shrine lit after dark, and Pontocho beside the river. Be quiet if you see a maiko.',
      central: 'Nishiki Market before the crowds, and Nijo Castle, whose garden the catalogue puts at its best in mid-November.',
      arashiyama: 'Tenryu-ji’s pond garden, with maples in mid-to-late November. The bamboo grove is the same day’s walk, not a second base.',
      northwest: 'Kinkaku-ji at opening time. Kitano Tenmangu’s maples turn from late November. Ryoan-ji is the rock garden, sat on the veranda.',
      'n-higashiyama': 'Ginkaku-ji and the Philosopher’s Path. Eikan-do has a night opening in autumn. Nanzen-ji’s maples turn late in November.',
      fushimi: 'Fushimi Inari’s gates, early or at dusk. Tofuku-ji is the catalogue’s most famous autumn temple, with maples under the Tsutenkyo bridge. Arrive at opening time.',
      'ohara-kurama': 'The northern hills. Sanzen-in’s moss garden is described as soft autumn colour, understated rather than a peak-week crush.',
      uji: 'Tea country south of the city. Byodo-in’s phoenix hall is the catalogue’s reason to make the trip.',
    },
    getting: {
      eyebrow: 'Getting around',
      title: 'Walk a neighbourhood. Do not cross the city twice.',
      body: [
        'The catalogue’s rule is one area a day. Buses are slow at busy times, and the famous temples are busiest from mid-morning.',
        'If your month is earlier or later than the mid-November to early-December peak, the catalogue says to shift the order rather than assume every temple is at its colour.',
      ],
    },
    routes: {
      eyebrow: 'Sample route shapes',
      title: 'Autumn, without collecting every temple.',
      intro: 'Shapes from the catalogue’s lengths. Not bookings, and not a promise of this year’s foliage dates.',
      items: [
        { label: 'About 5 days', title: 'East bank only', body: 'Southern Higashiyama, Gion, and Northern Higashiyama. Kiyomizu at opening or for the evening opening. Leave Arashiyama and Fushimi if the days are short.' },
        { label: 'About 7 days', title: 'Add the west and the river', body: 'The east-bank days, then Arashiyama for Tenryu-ji, and a morning at Fushimi Inari. Central Kyoto, including Nijo’s mid-November garden, fits one day.' },
        { label: 'About 10 days', title: 'Hills and Uji', body: 'The week above, plus the north-west (Kinkaku-ji at opening, Kitano Tenmangu if you are here late in November), a day toward Ohara, and Uji for tea.' },
      ],
    },
    faq: {
      eyebrow: 'Quick answers',
      title: 'Questions the catalogue already answers.',
      items: [
        { q: 'Can I start a Kyoto trip in the planner?', a: 'Not as a preset. Kyoto stays off the new-trip list so older saved trips still open, and a new plan does not pretend the city is bookable from the menu. Use Call me back or a quote, or open a blank plan and tell the designer.' },
        { q: 'When should I book the important meals?', a: 'The catalogue says the best kaiseki and ryokan dinners book out weeks ahead in November. Markets and casual soba or udon are the easier meals.' },
        { q: 'Which temple for late November?', a: 'Kitano Tenmangu from late November, and Nanzen-ji late in the month. Tenryu-ji is mid-to-late November. The peak for the famous gardens is still described as mid-November to early December.' },
        { q: 'Is this live availability?', a: 'No. The catalogue is sample data. A designer confirms what can be held.' },
      ],
    },
    cta: {
      title: 'Ask a designer<br>about Kyoto.',
      lede: 'Kyoto is not in the new-trip list. The button opens a blank plan. A quote or a call is how a designer takes the autumn dates.',
      plannerLabel: 'Open a blank plan',
    },
  },
  {
    id: 'ladakh',
    file: 'ladakh-guide.html',
    footerLabel: 'Ladakh guide',
    title: 'Ladakh Travel Guide: Leh First, High Valleys After',
    description: 'Plan Ladakh from the catalogue: a quiet first day in Leh at about 3,500 m, and Nubra, Pangong and Tso Moriri only after day three. Sample data, not a live permit or camp.',
    areaOrder: ['leh', 'indus', 'sham', 'nubra', 'pangong', 'tsomoriri'],
    hero: {
      eyebrow: 'A Friday field guide',
      title: 'Leh first.<br>The high lakes later.',
      lede: 'From Friday’s Ladakh catalogue. Leh is the arrival area, at about 3,500 m, and the first day is a rest. Nubra, Pangong and Tso Moriri wait until after day three. Sample catalogue, not live inventory.',
      seed: 'ladakh-guide',
      scene: 'peaks',
      tone: 'slate',
    },
    days: {
      eyebrow: 'How many days do you need in Ladakh?',
      title: 'Give the altitude the first days.',
      body: 'The catalogue’s lengths are about five days, an unhurried week, or about ten days. Five is described as the point where the rhythm can settle. Day one has no sightseeing on purpose. The high passes and Pangong come after at least three nights in Leh.',
    },
    season: {
      eyebrow: 'When are the roads open?',
      title: 'About June to mid-September.',
      body: 'The catalogue says Ladakh’s roads are generally open from about June to mid-September. Outside that window the route has to change. July and August are when Nubra and Pangong camps are scarce. This guide does not confirm this year’s road status.',
      linkHref: 'https://leh.nic.in',
      linkLabel: 'Leh district: tourist information and permits',
    },
    placesIntro: sampleIntro,
    placesTitle: 'Where the catalogue<br>sends you, and when.',
    compare: {
      eyebrow: 'Valleys',
      title: 'Indus and Sham first, or the high lakes?',
      body: 'The high areas in the catalogue are Nubra, Pangong and Tso Moriri, and they wait until after day three. Before that, Leh, the Indus gompas and Sham (Alchi sits low, which the catalogue calls easy on the body). Pangong is a long salt lake; Tso Moriri is described at about 4,500 m. Do not open with either.',
    },
    budget: {
      eyebrow: 'Budget',
      title: 'What does a Ladakh trip cost?',
      body: 'The catalogue does not give a trip-wide cost, and it cannot reserve camps, permits or drivers. Sample data is not a quote. A designer confirms what can be held.',
    },
    areaNotes: {
      leh: 'The arrival area. Leh Palace above the old town, Shanti Stupa for sunset, the Main Bazaar for a slow walk. The first day stays here, at about 3,500 m.',
      indus: 'Shey, Thiksey (morning prayers at about 7am), Hemis in a side valley, and Stok across the river. Still the acclimatising days, not a pass.',
      sham: 'Alchi’s eleventh-century paintings, low enough to be easy on the body. Lamayuru is the long drive, so it anchors the day. The Indus–Zanskar confluence is a pause, not a destination of its own.',
      nubra: 'A high area, after day three. Khardung La is 5,359 m: the catalogue says stay no longer than twenty minutes at the top. Diskit’s Maitreya looks down the Shyok. Hunder is the dune field. Turtuk needs its own day.',
      pangong: 'A high area, after at least three nights in Leh. The lake turns from turquoise to deep blue through the day. Bring warm layers.',
      tsomoriri: 'A high area, about 4,500 m, after day three. Korzok is a small gompa on the shore. Tso Kar is the white-rimmed salt lake on the way.',
    },
    getting: {
      eyebrow: 'Acclimatisation',
      title: 'The first three nights decide the rest.',
      body: [
        'Leh is the arrival area. Day one is a rest, with gentle stops only. The catalogue puts Leh at about 3,500 m.',
        'Nubra, Pangong and Tso Moriri are the high areas, and they wait until after day three. A lakes trip is written as three nights around Leh before Pangong.',
      ],
    },
    practical: {
      eyebrow: 'On the road',
      title: 'Passes, permits, camps.',
      items: [
        'Khardung La is listed at 5,359 m. Stay no longer than twenty minutes at the top, and keep sipping water.',
        'The catalogue says it cannot reserve or pay. Camps, permits and drivers need the provider, not this page.',
        'Nubra and Pangong nights are marked as camps in the planner, and July and August are when rooms are scarce.',
        'Roads are generally open from about June to mid-September. Outside that, change the dates or the route.',
      ],
    },
    routes: {
      eyebrow: 'Sample route shapes',
      title: 'How the lengths sit with the altitude.',
      intro: 'Shapes from the catalogue. The high valleys do not move forward to fill an empty day.',
      items: [
        { label: 'About 5 days', title: 'Leh, Indus, Sham', body: 'A rest day in Leh, then Thiksey, Hemis and Shey, then Alchi or Lamayuru. No Nubra and no Pangong. Five days is the gentle start, not a lake trip.' },
        { label: 'About 7 days', title: 'One high valley', body: 'Three nights around Leh, Indus and Sham, then one of Nubra or Pangong, not both. Come back to Leh before you fly.' },
        { label: 'About 10 days', title: 'Valleys, then the lakes', body: 'The week above, plus the second high area only after the third night in Leh. Tso Moriri is the quieter, higher lake, at about 4,500 m, and it needs the same wait.' },
      ],
    },
    faq: {
      eyebrow: 'Quick answers',
      title: 'Questions the catalogue already answers.',
      items: [
        { q: 'Can I go to Pangong on day two?', a: 'No. The catalogue holds Pangong until after at least three nights in Leh. Nubra and Tso Moriri use the same rule.' },
        { q: 'How high is Leh?', a: 'About 3,500 m, which is why day one has no sightseeing.' },
        { q: 'When should I go?', a: 'Roads are generally open from about June to mid-September. The catalogue does not treat that as a guarantee for a given week.' },
        { q: 'Are camps and permits confirmed here?', a: 'No. This is sample catalogue data. A designer confirms what can be held.' },
      ],
    },
    cta: {
      title: 'Make Ladakh<br>your own route.',
      lede: 'Start in Leh. A designer confirms roads, permits and camps before anything is held.',
      plannerLabel: 'Plan your Ladakh trip',
    },
  },
];

module.exports = { EXTRA_GUIDES };
