'use strict';
/*
 * data.js — every word on the site, in one place.
 * Friday travel planning, stays and example itineraries.
 */

const brand = {
  name: 'Friday',
  tagline: 'Your Friday travel designer.',
  line: 'Friday is your travel designer.',
  experience: '22 years of travel design experience.',
  parentName: 'Kusum Travels',
  affiliation: 'A Kusum Travels brand',
  email: 'manavdarooka1@gmail.com',
  location: 'Bombay',
};

/* ------------------------------------------------------------------- the ten */

const compositions = [
  {
    num: '01',
    slug: 'art-and-architecture',
    title: 'Art & Architecture',
    kicker: 'Rooms that hold the light',
    scene: 'city',
    tone: 'slate',
    lede: 'A journey built around buildings — and around the twenty minutes of the day when each of them is at its best.',
    essay: [
      'Most itineraries treat architecture as a stop. We treat it as a schedule. A Barragán courtyard is a different building at nine in the morning than it is at four in the afternoon; the Pantheon oculus draws its column of light across a specific slab of floor at a specific hour; Chandigarh’s concrete only softens when the sun is low enough to rake it. We build the day backwards from those moments.',
      'That means we book the hours nobody else asks for. Before-opening access at a museum so a Rothko room is yours and empty. A private view of a house-museum on its closing day, when the custodian has time to talk. An architect who trained under the person who drew the thing, walking you through it at dusk.',
      'We do not attempt completeness. Ten buildings seen properly is a better week than forty seen from a coach window.',
    ],
    practice: [
      { t: 'Access before hours', d: 'Museum openings arranged an hour early, so the first room you enter is silent.' },
      { t: 'The right guide', d: 'Practising architects, conservators and curators — not licensed generalists.' },
      { t: 'Light-led timing', d: 'Each visit slotted to the hour the building was designed for.' },
      { t: 'Studio visits', d: 'Working ateliers and private collections, opened by introduction.' },
      { t: 'Somewhere to sit', d: 'A long lunch inside the day, not squeezed between two appointments.' },
    ],
    regions: [
      { p: 'Mexico City & Guadalajara', d: 'Barragán, Goeritz, and the colour that came after' },
      { p: 'Kyoto & Naoshima', d: 'Temple carpentry against Ando’s concrete' },
      { p: 'Puglia & Rome', d: 'Baroque theatre, then the trulli that predate all of it' },
      { p: 'Chandigarh & Ahmedabad', d: 'Corbusier and Kahn in the Indian sun' },
      { p: 'Porto & the Douro', d: 'Siza, Souto de Moura, and whitewash' },
      { p: 'Marrakech & the Atlas', d: 'Riad geometry, rammed earth, Majorelle blue' },
    ],
    quote: { t: 'A building is a machine for a particular hour. We book that hour.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Two appointments a day' }, { k: 'Length', v: '8–14 days' }, { k: 'Season', v: 'Shoulder months, low sun' }],
  },
  {
    num: '02',
    slug: 'silence-and-solitude',
    title: 'Silence & Solitude',
    kicker: 'The luxury of no one else',
    scene: 'arctic',
    tone: 'ice',
    lede: 'Journeys designed around absence — of noise, of schedule, of other people. The hardest thing to buy and the thing most worth designing for.',
    essay: [
      'Solitude is a logistical achievement. It requires knowing which valley empties at four o’clock, which island has one house on it, which stretch of desert has no flight path overhead. It requires arriving on a Tuesday. It requires, sometimes, buying out the whole thing.',
      'We keep a working register of places where the silence is real and measurable — a fjord-head cabin in Greenland reachable only by boat, a fire-lookout in the Cascades, a single tent on a salt pan two hundred kilometres from a bulb. We check them. We know which ones have generators that hum.',
      'These are not survival trips. The bed is exceptional. The wine list travels with you. What is stripped away is company, not comfort.',
    ],
    practice: [
      { t: 'Sole occupancy', d: 'Lodges and islands taken whole, for however few of you there are.' },
      { t: 'Verified quiet', d: 'We visit before you do, and note what makes noise at 3am.' },
      { t: 'No fixed hours', d: 'No set dinner sitting, no morning call, no group.' },
      { t: 'A cook, not a restaurant', d: 'One kitchen, one table, produce from within an hour’s reach.' },
      { t: 'Reachable, quietly', d: 'A satellite line held open in the background, never in the foreground.' },
    ],
    regions: [
      { p: 'Scoresby Sund, Greenland', d: 'The largest fjord system on earth, and almost nobody in it' },
      { p: 'Ladakh in winter', d: 'Frozen river, monastery guesthouses, minus thirty' },
      { p: 'The Kimberley', d: 'A coastline with no road to it' },
      { p: 'Lofoten, off-season', d: 'Fishermen’s cabins after the last cruise ship has gone' },
      { p: 'Salar de Uyuni', d: 'Mirror, horizon, nothing between them' },
      { p: 'Knoydart, Scotland', d: 'A peninsula with no road in and one pub' },
    ],
    quote: { t: 'A slower itinerary can leave room for quiet.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Deliberately undecided' }, { k: 'Length', v: '6–12 days' }, { k: 'Season', v: 'The month everyone leaves' }],
  },
  {
    num: '03',
    slug: 'the-table',
    title: 'The Table',
    kicker: 'Food, wine, and the people behind both',
    scene: 'terraces',
    tone: 'moss',
    lede: 'Less a restaurant list than a set of introductions: to a grower, a fermenter, a cellar master, and the meal that follows from knowing them.',
    essay: [
      'Anyone can hold a table at a three-star. We are more interested in the Tuesday afternoon before it — in the boat coming in, in the cheese room, in the winemaker who will pour you something not yet on any list because you asked a good question.',
      'So our food journeys run in two registers. There is the formal register: the tasting menu, booked properly, seated where the chef can see you. And there is the working register: the harvest, the market at five, the smokehouse, the still. The second makes the first mean something.',
      'We build around a season, not a city. Truffle is a fortnight. Kaiseki’s bamboo shoot is a fortnight. Sherry’s velo blooms and falls. We tell you when to come, and sometimes that answer is next year.',
    ],
    practice: [
      { t: 'Tables that are not open', d: 'Chef’s counters, private rooms, and the second sitting that never lists.' },
      { t: 'At the source', d: 'Vineyards, salt pans, oyster beds and distilleries, with whoever runs them.' },
      { t: 'Cellars', d: 'Verticals opened in the cellar they were laid down in.' },
      { t: 'Hands in it', d: 'A morning of pasta, pintxos or masa — taught properly, not performed.' },
      { t: 'Timed to the season', d: 'We will move your dates two weeks to catch the thing itself.' },
    ],
    regions: [
      { p: 'Piedmont in November', d: 'White truffle, Barolo, fog in the vines' },
      { p: 'Jerez & Sanlúcar', d: 'Flor, solera, and lunch that runs to five' },
      { p: 'San Sebastián & Rioja', d: 'Counters, cider houses, and a cellar under a village' },
      { p: 'Kyoto in spring', d: 'Kaiseki when the bamboo shoot is three days old' },
      { p: 'Oaxaca', d: 'Mezcal palenques, market moles, comal smoke' },
      { p: 'Périgord & Bordeaux', d: 'Black truffle, right bank, a private vertical' },
    ],
    quote: { t: 'A great meal is a relationship you were invited into. We do the introductions.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'One anchor meal a day' }, { k: 'Length', v: '7–12 days' }, { k: 'Season', v: 'Dictated by harvest' }],
  },
  {
    num: '04',
    slug: 'living-cultures',
    title: 'Living Cultures',
    kicker: 'Encounter without extraction',
    scene: 'dunes',
    tone: 'ember',
    lede: 'Time spent with communities on their terms — arranged slowly, paid properly, and never staged.',
    essay: [
      'This is the strand we are most careful with. The travel industry has a long and unattractive history of turning people into scenery, and a photograph taken in ten minutes is usually evidence of a bad arrangement rather than a good one.',
      'When an itinerary includes a community visit, timing and access should be discussed with local hosts before plans are made. The trip plan can change to respect local schedules.',
      'What you get in exchange for that patience is the real thing: a festival you were invited to rather than sold, a workshop where you are handed a tool, an evening where the conversation is two-way because an interpreter who lives there is doing the work.',
    ],
    practice: [
      { t: 'Invitation, not itinerary', d: 'Visits proposed by the community and scheduled by them.' },
      { t: 'Local context', d: 'Confirm timing and access with local hosts before planning a visit.' },
      { t: 'Real interpretation', d: 'Interpreters from the place, briefed on both directions of the conversation.' },
      { t: 'Camera etiquette', d: 'A clear brief on what may be photographed, agreed in advance.' },
      { t: 'Long relationships', d: 'We return to the same hosts, year after year, or not at all.' },
    ],
    regions: [
      { p: 'Omo Valley, Ethiopia', d: 'Market days, on invitation, with long-standing hosts' },
      { p: 'Kutch, Gujarat', d: 'Rabari embroidery, Ajrakh printing, salt-desert nights' },
      { p: 'Sumba, Indonesia', d: 'Ikat weaving and the Pasola, when it is held' },
      { p: 'Nagaland', d: 'Villages beyond the Hornbill Festival crowd' },
      { p: 'Bhutan’s eastern valleys', d: 'Tsechu dances in a courtyard with no other visitors' },
      { p: 'Wakhan Corridor', d: 'Pamiri households at the end of the road' },
    ],
    quote: { t: 'If a visit only works when it is unannounced, it is not a visit. It is an intrusion.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Slow, by necessity' }, { k: 'Length', v: '10–18 days' }, { k: 'Lead time', v: 'Six months, often more' }],
  },
  {
    num: '05',
    slug: 'coasts-and-isles',
    title: 'Coasts & Private Isles',
    kicker: 'Water as an argument for staying put',
    scene: 'isles',
    tone: 'cobalt',
    lede: 'Whole islands, headland houses and the kind of coast where the only timetable is the tide.',
    essay: [
      'The beach holiday has been badly served. It is usually sold as a resort with sand attached, and the sand is the least interesting part. What makes a coast worth a fortnight is the geometry of it — a bay that turns green at four, a swimming rock reachable only at low water, a headland that takes the wind off the terrace.',
      'We choose for that geometry first and the building second. Sometimes the answer is a private island with a staff of nine. Sometimes it is a fisherman’s house with a very good cook and a boat.',
      'And we design the days so there are some. A skipper who knows where the octopus are. A free-diving instructor for the one morning you want to try. Then nothing, for three days, on purpose.',
    ],
    practice: [
      { t: 'Whole islands', d: 'Private isles and headland estates taken in full, staffed.' },
      { t: 'A boat, always', d: 'Skipper and tender on call, not booked by the hour.' },
      { t: 'The right water', d: 'Chosen for temperature, clarity and swell in your actual month.' },
      { t: 'Sea to table', d: 'Whatever came up that morning, cooked simply, at your hour.' },
      { t: 'Nothing scheduled', d: 'At least three days with no plan in them at all.' },
    ],
    regions: [
      { p: 'The Cyclades, September', d: 'After the meltemi, before the shutters close' },
      { p: 'Îles d’Hyères', d: 'Porquerolles pines and a very quiet north shore' },
      { p: 'Zanzibar’s east coast', d: 'Dhow sailing and a house on stilts' },
      { p: 'The Grenadines', d: 'A private cay and a shallow-draught boat' },
      { p: 'Raja Ampat', d: 'The clearest water we know, and almost no one in it' },
      { p: 'Vestmannaeyjar', d: 'North Atlantic cold-water swimming, for the brave' },
    ],
    quote: { t: 'The best coastal week has three empty days in the middle. We put them there deliberately.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Tidal' }, { k: 'Length', v: '7–16 days' }, { k: 'Season', v: 'The fortnight after high season' }],
  },
  {
    num: '06',
    slug: 'cold-light',
    title: 'Cold Light',
    kicker: 'Snow, ice, and the low winter sun',
    scene: 'aurora',
    tone: 'indigo',
    lede: 'Ski, ice and polar journeys, designed for the quality of the light as much as the quality of the snow.',
    essay: [
      'Winter at high latitude does something to light that no other season manages: it holds the sun at a low angle for hours, so the blue hour lasts until lunch and everything is rendered in long shadow. Skiers know this instinctively. We build itineraries around it.',
      'On the ski side that means guided off-piste with a guide who has skied that aspect for twenty years, a hut on the far side of a col, and a town you actually want to be in at six. We are not interested in the biggest lift-served vertical. We are interested in the run that faces the right way at the right hour.',
      'On the polar side it means small ships and smaller landings, aurora forecast properly rather than promised, and enough days in the region that weather can take one of them without ruining the trip.',
    ],
    practice: [
      { t: 'Guides, not instructors', d: 'Mountain guides who ski the aspect, read the snowpack and know the hut keeper.' },
      { t: 'Ski-in chalets', d: 'Staffed houses with a boot room that works and a masseur who comes to you.' },
      { t: 'Weather margin', d: 'Spare days built in, so a storm costs you nothing.' },
      { t: 'Aurora, honestly', d: 'Latitude, moon phase and cloud statistics — not a promise.' },
      { t: 'Heli and hut', d: 'Where it is legal and sensible, and only there.' },
    ],
    regions: [
      { p: 'Hokkaido, January', d: 'Dry snow, birch trees, onsen afterwards' },
      { p: 'Lyngen Alps', d: 'Ski-touring to the sea, from a boat' },
      { p: 'Engadin & Zermatt', d: 'Long shadows, longer lunches' },
      { p: 'Svalbard', d: 'Blue hour that lasts all day' },
      { p: 'South Georgia & the Peninsula', d: 'The one that ruins other journeys' },
      { p: 'Finnish Lapland', d: 'Glass roof, frozen lake, no light pollution' },
    ],
    quote: { t: 'Cold is not a hardship if the room you return to has been thought about.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Weather-led' }, { k: 'Length', v: '7–20 days' }, { k: 'Season', v: 'December to March; polar by hemisphere' }],
  },
  {
    num: '07',
    slug: 'cloth-and-craft',
    title: 'Cloth & Craft',
    kicker: 'The workshop, not the shop',
    scene: 'forest',
    tone: 'plum',
    lede: 'Journeys through making — indigo vats, looms, kilns, lacquer rooms — with the people who have spent thirty years at them.',
    essay: [
      'A textile is a document. It records a dye plant that grows in one valley, a loom width set by the doorway of a house, a motif that marks a marriage. Read that way, a workshop is a better museum than most museums.',
      'We arrange time inside working ateliers — a full day, not a demonstration. You will be given something to do badly. You will ruin a piece of cloth. Then you will understand why the good one costs what it costs.',
      'If you are interested in local craft, include time to learn about the maker and their work. Any visit or purchase should be arranged directly with the host.',
    ],
    practice: [
      { t: 'A day at the bench', d: 'Working ateliers, full days, hands in the dye.' },
      { t: 'Masters, by name', d: 'Living-treasure craftspeople, arranged by long introduction.' },
      { t: 'Time to explore', d: 'Leave room to learn about the craft and the place it comes from.' },
      { t: 'Provenance in writing', d: 'A note on maker, material and method for each acquisition.' },
      { t: 'Getting it home', d: 'Crating, export paperwork and insured freight handled.' },
    ],
    regions: [
      { p: 'Kanazawa & Kyoto', d: 'Kintsugi, urushi lacquer, Nishijin weaving' },
      { p: 'Kutch & Bhuj', d: 'Bandhani, Ajrakh, and the last of the Rogan painters' },
      { p: 'Oaxaca & Teotitlán', d: 'Cochineal, backstrap looms, black clay' },
      { p: 'Fez & the Middle Atlas', d: 'Tanneries, zellige, cedar carving' },
      { p: 'Kutaisi & Tbilisi', d: 'Enamel, felt, and qvevri clay' },
      { p: 'West Bengal & Bihar', d: 'Jamdani muslin, Madhubani, kantha' },
    ],
    quote: { t: 'Spend a day failing at something and you will never look at the good version the same way.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'One workshop a day' }, { k: 'Length', v: '9–14 days' }, { k: 'Planning note', v: 'Arrange visits with local hosts' }],
  },
  {
    num: '08',
    slug: 'slow-rail',
    title: 'Slow Rail',
    kicker: 'Arriving at the speed of the country',
    scene: 'canyon',
    tone: 'sand',
    lede: 'Journeys where the train is the point — private carriages, working branch lines, and windows that do the work of a museum.',
    essay: [
      'Flying between two cities teaches you nothing about what lies between them. A train does, at a speed the eye can actually use. We build journeys where rail is the spine and everything hangs off it.',
      'That covers a broad range. At one end: a private carriage coupled to a scheduled service, with your own cook and a car meeting you at three stations along the way. At the other: second class on a metre-gauge line in the hills, because it is the correct way to see that particular valley and no upgrade would improve it.',
      'We handle the unglamorous part — the platform your carriage will actually be on, the twelve-minute connection, the bags moving separately so you never carry them.',
    ],
    practice: [
      { t: 'Private carriages', d: 'Historic saloons coupled to scheduled services, staffed and provisioned.' },
      { t: 'The right side', d: 'Seats booked on the side the view is on. It matters more than the class.' },
      { t: 'Bags ahead', d: 'Luggage moves by road; you travel with a day bag.' },
      { t: 'Off the line', d: 'A car and driver waiting at intermediate stations for a day inland.' },
      { t: 'Branch lines', d: 'The unlisted narrow-gauge runs that no operator sells.' },
    ],
    regions: [
      { p: 'Kalka–Shimla & the Nilgiris', d: 'Narrow gauge, hill stations, tea' },
      { p: 'Switzerland, end to end', d: 'Rhaetian viaducts and a private saloon' },
      { p: 'Kyushu & the San’in coast', d: 'Local lines, hot springs, sea on the left' },
      { p: 'Norway: Bergen & Flåm', d: 'Plateau snow into fjord in ninety minutes' },
      { p: 'Andalusia & the Algarve', d: 'Slow south, olive light' },
      { p: 'The Rockies, west-facing', d: 'Two days, one window' },
    ],
    quote: { t: 'Book the correct side of the train. Almost nothing else about the journey matters as much.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Measured in windows' }, { k: 'Length', v: '8–16 days' }, { k: 'Season', v: 'Clear-air months' }],
  },
  {
    num: '09',
    slug: 'residences',
    title: 'Residences',
    kicker: 'A house, a staff, and a month of your life',
    scene: 'peaks',
    tone: 'rose',
    lede: 'Private houses taken whole — chosen for their rooms and their view, staffed and provisioned as though they were yours.',
    essay: [
      'There is a category of house that is never listed: a farmhouse above a lake that belongs to a family in the city, a hill fort with eleven rooms, a modernist villa whose owner will let it out to the right person and not otherwise. Finding those is most of the job.',
      'We look for one thing above all: whether the house has a good room to sit in at the end of the day. Pools photograph well and matter less than people expect. A terrace facing the correct way matters more.',
      'Then we staff it. A cook whose food you will remember, a house manager who is invisible until needed, a driver who knows the roads. And we brief them properly — how you take your coffee, when you want to be left alone, which day the children have a birthday.',
    ],
    practice: [
      { t: 'Unlisted houses', d: 'Private homes released by introduction, not on any platform.' },
      { t: 'Staffed properly', d: 'Cook, house manager, housekeeping and driver, briefed before you land.' },
      { t: 'Provisioned', d: 'Cellar, larder and flowers arranged to your notes before arrival.' },
      { t: 'The room test', d: 'We sit in the house at six in the evening before we recommend it.' },
      { t: 'Children, actually', d: 'Cots, a second cook, and someone whose whole job is the six-year-old.' },
    ],
    regions: [
      { p: 'Umbria & the Val d’Orcia', d: 'Stone farmhouses, long tables, cypress' },
      { p: 'Rajasthan', d: 'Family forts and step-well courtyards' },
      { p: 'The Luberon', d: 'Bastides, plane trees, market on Sunday' },
      { p: 'Mallorca’s Tramuntana', d: 'Terraced olive, sea two valleys away' },
      { p: 'The Cape Winelands', d: 'Cape Dutch gables and a working cellar' },
      { p: 'Hokkaido & Karuizawa', d: 'Timber houses in birch, snow to the eaves' },
    ],
    quote: { t: 'We judge a house by the room you end up in at six o’clock, not the one in the photographs.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Yours entirely' }, { k: 'Length', v: '10 days to a season' }, { k: 'Party', v: '4 to 26' }],
  },
  {
    num: '10',
    slug: 'under-sail',
    title: 'Under Sail',
    kicker: 'Coastlines read from the water',
    scene: 'sea',
    tone: 'jade',
    lede: 'Classic yachts, working schooners and small expedition ships — routed for anchorages rather than ports.',
    essay: [
      'A coast looks entirely different from half a mile offshore. Villages that are choked at midday are empty at seven in the morning if you arrive by tender. Ruins that have a queue have nobody at all if you come to the seaward side.',
      'So we route by anchorage. We work with skippers who will change the plan at breakfast because the wind has gone round, and we build the shore days to survive that — a lunch that can move, a guide who is flexible, no ticket with a time on it.',
      'The boats range from an eighty-year-old wooden ketch with six berths to a small ice-class ship with a submersible. The common requirement is a crew who are good company and a cook who is better than the marina.',
    ],
    practice: [
      { t: 'Routed by anchorage', d: 'The plan follows the bays, not the marinas.' },
      { t: 'Skippers with judgement', d: 'Crew empowered to move the whole day for better weather.' },
      { t: 'Shore days that flex', d: 'Guides and lunches booked to be moveable.' },
      { t: 'Proper boats', d: 'Classic sail, working schooners, and ice-class where the ice requires it.' },
      { t: 'Everything on board', d: 'Tenders, dive gear, foils and kites, matched to the crew who can teach them.' },
    ],
    regions: [
      { p: 'The Dodecanese', d: 'Meltemi sailing and empty morning harbours' },
      { p: 'Dalmatia', d: 'Stone islands, one restaurant each' },
      { p: 'The Sea of Cortez', d: 'Whale sharks, desert islands, no one' },
      { p: 'The Cyclades under sail', d: 'A wooden ketch and a following wind' },
      { p: 'Svalbard & East Greenland', d: 'Ice-class, small, and properly guided' },
      { p: 'Komodo & the Banda Sea', d: 'A phinisi, and reefs with nothing on them' },
    ],
    quote: { t: 'The right anchorage at seven in the morning beats any hotel on that coast.', a: 'Friday travel idea' },
    facts: [{ k: 'Pace', v: 'Wind-led' }, { k: 'Length', v: '7–18 days' }, { k: 'Season', v: 'By basin' }],
  },
];

/* -------------------------------------------------------------- the two arms */

const houses = [
  {
    slug: 'wild',
    title: 'Friday Wild',
    kicker: 'The wildlife arm',
    scene: 'dunes',
    tone: 'ember',
    lede: 'Wildlife journeys designed around a single animal, a single season, and the person who knows both.',
    body: [
      'Friday Wild exists because general safari planning produces general results. A week in a well-known reserve will show you a great deal and teach you very little. We would rather build a journey around one question — where the super-tuskers move in February, why the Kalahari lions hunt at a different hour, what the Sundarbans tide does to a tiger’s range — and let the answer organise everything else.',
      'That question determines the guide, and the guide determines the trip. We work with a short list of people: researchers who have followed the same population for a decade, trackers whose families have worked the ground for three generations, photographers who know exactly where the vehicle must be at 6:04am. They are not always available. When they are not, we tell you, and we suggest another month.',
      'Everything else follows from that: a private vehicle so you never share a sighting decision, permits held early, camps chosen for position rather than thread count — though the thread count is, in fact, fine.',
    ],
    pillars: [
      { t: 'One animal, one question', d: 'Each journey is organised around a specific population and a specific behaviour.' },
      { t: 'The guide first', d: 'We book the person, then build the dates around when they are free.' },
      { t: 'Private vehicle, always', d: 'No shared sightings, no compromise on how long you stay.' },
      { t: 'Photographic by default', d: 'Bean bags, beanbag rails, low angles, and a driver who understands light.' },
      { t: 'Conservation, verifiably', d: 'A fixed contribution per journey, to a named project, with the receipt.' },
    ],
    strands: [
      { p: 'Tsavo & Amboseli', d: 'Super-tuskers, and the last big-ivory bulls' },
      { p: 'The Kalahari', d: 'Black-maned lion, brown hyena, and a lot of sky' },
      { p: 'Ranthambore & Kanha', d: 'Tiger, on foot where the buffer permits' },
      { p: 'Pantanal', d: 'Jaguar from the water, at the right river level' },
      { p: 'Bwindi & Volcanoes', d: 'Habituated gorilla groups, permits held twelve months out' },
      { p: 'South Georgia', d: 'Four hundred thousand king penguins and no words for it' },
    ],
    stat: [],
  },
  {
    slug: 'drive',
    title: 'Friday Drive',
    kicker: 'The road arm',
    scene: 'canyon',
    tone: 'sand',
    lede: 'Driving journeys for people who care what they are driving — routed for the road surface, the corner sequence, and where you stop for lunch.',
    body: [
      'A driving route is a piece of design. It has rhythm — a technical section, then something open, then a village where the coffee is good. It has a correct direction: most great roads are better one way than the other. And it has a correct hour, because a pass that is spectacular at seven is a queue at eleven.',
      'Friday Drive plans at that level of detail. We drive the routes ourselves, in the season you will drive them, and we keep notes on surface, camber, resurfacing works and where the police sit. We book hotels with garages, not car parks.',
      'The cars are chosen with the same care — a manual air-cooled 911 for a week in the Dolomites, a restored Defender for the Highlands, an EV where the charging map genuinely supports it. If you would rather bring your own, we will arrange the transporter.',
    ],
    pillars: [
      { t: 'Driven, not mapped', d: 'Every route driven by us in season, with notes on surface and traffic.' },
      { t: 'The correct direction', d: 'Routes run the way the road works best, and at the hour it is empty.' },
      { t: 'Cars chosen properly', d: 'Air-cooled, restored, or electric — matched to the road, not the brochure.' },
      { t: 'Garages, not car parks', d: 'Hotels vetted for secure, covered, accessible parking.' },
      { t: 'A car behind you', d: 'Optional support vehicle carrying luggage, spares and a mechanic.' },
    ],
    strands: [
      { p: 'The Dolomites', d: 'Sella Ronda before eight, Gardena at dusk' },
      { p: 'Scotland’s north-west', d: 'Applecross, Assynt, single track and passing places' },
      { p: 'The Alentejo & Serra da Estrela', d: 'Empty tarmac, cork oak, nobody' },
      { p: 'Spiti & Ladakh', d: 'High passes, real altitude, a mechanic in the second car' },
      { p: 'Hokkaido', d: 'Cape roads and volcanic switchbacks' },
      { p: 'The Cape & the Karoo', d: 'Swartberg, Prince Albert, dust' },
    ],
    stat: [],
  },
];

/* -------------------------------------------------------------- departures */

const departures = [
  {
    slug: 'super-tuskers', title: 'Tsavo & Amboseli Wildlife Journey', kicker: 'Friday Wild', scene: 'dunes', tone: 'ember', sample: true,
    dates: '', length: 'Illustrative 10-day itinerary', party: '', band: '',
    lede: 'A sample wildlife journey through Tsavo and Amboseli. No departure, guide, permit or accommodation is confirmed.',
    body: ['This example route pairs wildlife viewing with time in the surrounding landscape. It is a starting point for a personal trip plan, not a confirmed package.', 'Dates, park access, guides, transport and stays would need to be checked for the dates you choose.'],
    itinerary: [
      { d: 'Days 1–2', t: 'Arrive in Nairobi', x: 'An arrival day and onward travel toward Tsavo, subject to route and flight availability.' },
      { d: 'Days 3–5', t: 'Tsavo', x: 'A few days for wildlife viewing, with activities shaped around current park access.' },
      { d: 'Day 6', t: 'Landscape day', x: 'Time to explore the wider region or rest between drives.' },
      { d: 'Days 7–9', t: 'Amboseli', x: 'Continue toward Amboseli for wildlife viewing and open time.' },
      { d: 'Day 10', t: 'Return', x: 'Travel back toward Nairobi for onward connections.' },
    ],
    includes: [], note: 'Sample itinerary concept only. Dates, pricing, inclusions and availability are not confirmed.',
  },
  {
    slug: 'dolomites-manual', title: 'Driving the Dolomites', kicker: 'Friday Drive', scene: 'peaks', tone: 'slate', sample: true,
    dates: '', length: 'Illustrative 8-day itinerary', party: '', band: '',
    lede: 'A sample road journey through the Dolomites, with time for mountain routes, villages and rest stops.',
    body: ['This example itinerary follows a loop through the Dolomites and nearby lakes. It is a planning idea, not a confirmed departure.', 'Vehicle, road access, stays, route conditions and costs depend on dates and would need checking before a trip is booked.'],
    itinerary: [
      { d: 'Day 1', t: 'Arrive in Verona', x: 'Collect a vehicle or arrange onward transport, subject to availability.' },
      { d: 'Days 2–3', t: 'Mountain passes', x: 'Explore a selection of routes and nearby villages.' },
      { d: 'Day 4', t: 'A slower day', x: 'Leave time for a walk, a long lunch or an open afternoon.' },
      { d: 'Days 5–6', t: 'Cortina and the eastern Dolomites', x: 'Continue through the region, adapting the route to conditions.' },
      { d: 'Days 7–8', t: 'Return toward the lakes', x: 'Finish the route and arrange onward travel.' },
    ],
    includes: [], note: 'Sample itinerary concept only. Dates, pricing, inclusions and availability are not confirmed.',
  },
  {
    slug: 'luxor-eclipse', title: 'Upper Egypt Eclipse Journey', kicker: 'Friday Packages', scene: 'city', tone: 'ember', sample: true,
    dates: '', length: 'Illustrative 9-day itinerary', party: '', band: '',
    lede: 'A sample journey idea combining an eclipse viewing plan with time in Luxor and along the Nile.',
    body: ['This example route uses an eclipse as a reason to plan time in Upper Egypt. It is not a bookable departure, and no viewing site or access has been confirmed.', 'The eclipse date, visibility, travel logistics, local access and accommodation should all be checked against the traveler’s dates before making a plan.'],
    itinerary: [
      { d: 'Days 1–2', t: 'Cairo', x: 'Arrive and allow time to settle in or visit a museum.' },
      { d: 'Days 3–4', t: 'Luxor', x: 'Explore the east bank and leave time to adjust to the heat and schedule.' },
      { d: 'Day 5', t: 'Eclipse day concept', x: 'Choose a suitable viewing location after access, weather and safety conditions are confirmed.' },
      { d: 'Days 6–8', t: 'Nile journey concept', x: 'Consider a southbound river journey if vessels and routes are available.' },
      { d: 'Day 9', t: 'Departure', x: 'Arrange onward travel after confirming the itinerary.' },
    ],
    includes: [], note: 'Sample itinerary concept only. Dates, pricing, inclusions and availability are not confirmed.',
  },
];

/* ------------------------------------------------------------------- studio */

const method = [
  { n: '01', t: 'Choose a place', d: 'Start with a destination, villa or sample itinerary that interests you.' },
  { n: '02', t: 'Shape your trip', d: 'Add dates, preferences and activities to build a personal plan.' },
  { n: '03', t: 'Review the details', d: 'Check sources, locations and travel details as you refine the plan.' },
  { n: '04', t: 'Make changes', d: 'Adjust the pace, add places and keep the parts that suit you.' },
  { n: '05', t: 'Save your plan', d: 'Keep your itinerary in Friday and continue updating it as your trip takes shape.' },
];

const principles = [
  { t: 'Start with your interests.', d: 'Build a trip around the places, stays and activities you want to explore.' },
  { t: 'Keep the plan editable.', d: 'Review suggestions and change the itinerary as your plans develop.' },
  { t: 'Check the details.', d: 'Confirm dates, access, prices and availability before making reservations.' },
];

const team = [];
const alliances = [];
const testimonials = [];

const salon = {
  lede: '', body: [], kinds: [], upcoming: [],
};

const fieldNotes = [
  {
    slug: 'kerala-short-trip',
    title: 'A shorter Kerala trip can still have a shape',
    place: 'Kerala',
    dek: 'A useful way to choose what belongs in the days you have.',
    scene: 'isles', tone: 'jade', destination: 'kerala',
    body: [
      'Friday’s Kerala guide offers three starting points: a 4–5 day escape, an unhurried week, or a longer two-week loop. They are prompts, not fixed packages.',
      'For fewer days, the guide suggests choosing a smaller part of the state instead of trying to join every coast, hill and backwater stop. The route is yours to shape around dates and pace.'
    ],
    sources: [{ label: 'Friday’s Kerala guide', href: 'kerala-guide.html' }]
  },
  {
    slug: 'kerala-two-waterways',
    title: 'Two different ways onto Kerala’s water',
    place: 'Alleppey & Kumarakom',
    dek: 'The catalogue lists a houseboat cruise in one place and a sunset cruise in the other; it does not rank them.',
    scene: 'isles', tone: 'indigo', destination: 'kerala',
    body: [
      'Friday’s catalogue lists a backwater houseboat cruise in Alleppey (Alappuzha) and a sunset cruise on Vembanad Lake in Kumarakom. They are distinct starting points, not a verdict on which is better.',
      'The guide does not confirm current routes, availability or prices. Check those details for your dates before making a booking.'
    ],
    sources: [{ label: 'Friday’s Kerala guide', href: 'kerala-guide.html' }, { label: 'Kerala Tourism’s Alappuzha guide', href: 'https://www.keralatourism.org/destination/alappuzha-beach/60/' }]
  },
  {
    slug: 'kerala-season-and-water',
    title: 'Let the season follow the Kerala trip',
    place: 'Kerala',
    dek: 'Season guidance changes with the activity, so check the detail that matters to your plan.',
    scene: 'forest', tone: 'moss', destination: 'kerala',
    body: [
      'Kerala Tourism describes November to February as pleasant and points to October–February for backwater houseboat cruises. Those are different pieces of seasonal guidance for different parts of a trip.',
      'Use them as a starting point, then check current weather and local operating guidance before you book. Friday’s guide does not confirm live conditions.'
    ],
    sources: [{ label: 'Kerala Tourism travel basics', href: 'https://www.keralatourism.org/faq/20-things-to-know-before-you-visit-kerala' }, { label: 'Friday’s Kerala guide', href: 'kerala-guide.html' }]
  }
];

const nav = [
  {
    label: 'About Friday', href: 'ethos.html', children: [
      { label: 'Our Ethos', href: 'ethos.html' },
      { label: 'The Method', href: 'method.html' },
      { label: 'The Designers', href: 'designers.html' },
      { label: 'Alliances', href: 'alliances.html' },
    ],
  },
  {
    label: 'Compositions', href: 'compositions.html',
    children: compositions.map((c) => ({ label: c.title, href: `composition-${c.slug}.html`, num: c.num })),
  },
  { label: 'Friday Wild', href: 'wild.html' },
  { label: 'Friday Drive', href: 'drive.html' },
  {
    label: 'Departures', href: 'departures.html',
    children: departures.map((d) => ({ label: d.title, href: `departure-${d.slug}.html` })),
  },
  { label: 'The Salon', href: 'salon.html' },
  { label: 'Field Notes', href: 'field-notes.html' },
];

module.exports = {
  brand, nav, compositions, houses, departures, method,
  principles, team, alliances, testimonials, salon, fieldNotes,
};
