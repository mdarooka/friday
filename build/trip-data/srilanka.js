'use strict';
/* Sri Lanka destination for the Friday planner. Sample data: ratings and review counts are plausible, not live. */

// place(name, kind, label, rating, reviews, price, area, [lng, lat], blurb, scene, tone)
const place = (name, kind, label, rating, reviews, price, area, at, blurb, scene, tone) =>
  ({ name, kind, label, rating, reviews, price, area, at, blurb, scene, tone });

const places = {
  /* Colombo */
  'gangaramaya-temple': place('Gangaramaya Temple', 'sight', 'Buddhist Temple', 4.5, 21450, null, 'colombo', [79.858, 6.917],
    'A busy, eclectic temple beside Beira Lake, full of gifts, statues and a small museum. Go in the cool of the morning.', 'city', 'ember'),
  'national-museum-colombo': place('Colombo National Museum', 'museum', 'Museum', 4.3, 5210, null, 'colombo', [79.861, 6.91],
    'The island\'s main museum, with the Kandyan throne and fine masks. A good indoor hour.', 'city', 'slate'),
  'galle-face-green': place('Galle Face Green', 'sight', 'Tourist Attraction', 4.3, 30540, null, 'colombo', [79.845, 6.927],
    'A long ocean-front lawn where Colombo flies kites and eats isso vadai at sunset.', 'sea', 'ember'),
  'pettah-market': place('Pettah Market', 'market', 'Market', 4.1, 9860, null, 'colombo', [79.855, 6.936],
    'A dense grid of lanes selling spices, fabric and everything else. Go in the morning and keep your bag close.', 'city', 'rose'),
  'ministry-of-crab': place('Ministry of Crab', 'food', 'Restaurant', 4.5, 7430, null, 'colombo', [79.842, 6.934],
    'Sri Lankan crab, cooked in pepper or chilli, in the old Dutch Hospital. Book ahead.', 'city', 'ember'),
  'galle-face-verandah': place('The Verandah, Galle Face Hotel', 'nightlife', 'Bar', 4.4, 6120, null, 'colombo', [79.846, 6.925],
    'A colonial-era hotel terrace by the sea. A calm drink as the sun goes down.', 'sea', 'plum'),
  'cinnamon-grand-colombo': place('Cinnamon Grand Colombo', 'stay', 'Hotel', 4.5, 8840, 140, 'colombo', [79.848, 6.917],
    'A large, central hotel with a pool and many restaurants. A practical first or last night.', 'city', 'slate'),
  /* Galle and the south-west coast */
  'galle-fort': place('Galle Fort', 'sight', 'Historical Landmark', 4.7, 24310, null, 'galle', [80.217, 6.027],
    'A seventeenth-century Dutch fort with walkable ramparts, cafes and small galleries. Best in the late afternoon.', 'city', 'sand'),
  'galle-lighthouse': place('Galle Lighthouse', 'sight', 'Historical Landmark', 4.5, 6120, null, 'galle', [80.216, 6.024],
    'A white lighthouse on the fort\'s southern tip, with sea on three sides.', 'sea', 'cobalt'),
  'hikkaduwa-beach': place('Hikkaduwa Beach', 'beach', 'Beach', 4.2, 9340, null, 'galle', [80.1, 6.14],
    'A long surf and snorkelling beach with turtles near the shore. Busy but lively.', 'sea', 'jade'),
  'unawatuna-beach': place('Unawatuna Beach', 'beach', 'Beach', 4.4, 14820, null, 'galle', [80.25, 6.01],
    'A curved, sheltered bay just south-east of Galle with calm water and beachside shacks.', 'sea', 'sand'),
  'isle-of-gelato': place('Isle of Gelato', 'food', 'Ice Cream Shop', 4.6, 3210, null, 'galle', [80.217, 6.028],
    'Cool gelato with local flavours, such as coconut and jaggery. A break inside the fort.', 'city', 'rose'),
  'pedlars-inn-cafe': place('Pedlar\'s Inn Cafe', 'food', 'Cafe', 4.5, 2870, null, 'galle', [80.217, 6.026],
    'A relaxed cafe on the fort\'s main street. Try the rice and curry or a fresh juice.', 'city', 'moss'),
  'amangalla': place('Amangalla', 'stay', 'Luxury Hotel', 4.8, 1640, 650, 'galle', [80.218, 6.029],
    'A colonial-era hotel inside the fort, with deep verandahs and high ceilings.', 'city', 'sand'),
  'jetwing-lighthouse': place('Jetwing Lighthouse', 'stay', 'Hotel', 4.6, 5210, 180, 'galle', [80.203, 6.035],
    'A Geoffrey Bawa-designed hotel above the sea outside the fort, with a pool and long corridors.', 'sea', 'jade'),
  /* Mirissa and the deep south */
  'mirissa-beach': place('Mirissa Beach', 'beach', 'Beach', 4.5, 19870, null, 'mirissa', [80.459, 5.947],
    'A wide crescent of sand with palm trees and shacks. A good place to slow down.', 'sea', 'sand'),
  'coconut-tree-hill': place('Coconut Tree Hill', 'nature', 'Scenic Viewpoint', 4.4, 8430, null, 'mirissa', [80.466, 5.943],
    'A small headland of tall palms above the sea. Go early or at sunset and share it with fewer people.', 'sea', 'ember'),
  'whale-watching-mirissa': place('Mirissa Whale Watching', 'nature', 'Boat Tour', 4.2, 12760, null, 'mirissa', [80.455, 5.945],
    'A morning boat trip for blue whales and dolphins, generally best from November to April. Take a seasickness tablet.', 'sea', 'cobalt'),
  'weligama-beach': place('Weligama Bay', 'beach', 'Beach', 4.3, 7120, null, 'mirissa', [80.43, 5.97],
    'A wide, gentle bay for beginner surfing. Stilt fishermen are a little way along the coast.', 'sea', 'jade'),
  'dondra-head-lighthouse': place('Dondra Head Lighthouse', 'sight', 'Historical Landmark', 4.3, 1830, null, 'mirissa', [80.59, 5.92],
    'The southernmost point of the island, with a tall old lighthouse and quiet sea.', 'sea', 'slate'),
  'mirissa-beach-bars': place('Mirissa Beach Bars', 'nightlife', 'Bar', 4.2, 3480, null, 'mirissa', [80.458, 5.948],
    'A row of beachfront bars with fresh seafood, cold beer and candlelit tables.', 'sea', 'plum'),
  /* Kandy */
  'temple-of-the-tooth': place('Temple of the Sacred Tooth Relic', 'sight', 'Buddhist Temple', 4.6, 28100, null, 'kandy', [80.641, 7.294],
    'The island\'s most sacred Buddhist temple, beside Kandy Lake. Go for the evening ritual and wear modest clothing.', 'city', 'ember'),
  'peradeniya-gardens': place('Royal Botanic Gardens, Peradeniya', 'nature', 'Botanical Garden', 4.5, 13480, null, 'kandy', [80.596, 7.269],
    'A large botanical garden in a loop of the Mahaweli river, with orchids, spice trees and giant bamboo.', 'forest', 'moss'),
  'ceylon-tea-museum': place('Ceylon Tea Museum', 'museum', 'Museum', 4.3, 4560, null, 'kandy', [80.61, 7.28],
    'A tea factory turned museum on the hill above Kandy. See how tea is made, then taste it.', 'terraces', 'moss'),
  'balaji-dosai': place('Balaji Dosai', 'food', 'Restaurant', 4.4, 6210, null, 'kandy', [80.634, 7.293],
    'A simple, low-cost vegetarian place known for dosas and thalis.', 'city', 'sand'),
  'kandy-cultural-centre': place('Kandy Cultural Centre', 'nightlife', 'Cultural Show', 4.1, 5330, null, 'kandy', [80.638, 7.293],
    'An hour of Kandyan dance and drumming, ending with a fire-walking display. Touristy but well staged.', 'city', 'plum'),
  'mahaweli-reach-kandy': place('Mahaweli Reach Hotel', 'stay', 'Hotel', 4.3, 5140, 110, 'kandy', [80.65, 7.283],
    'A riverside hotel with a pool a short drive from the temple.', 'city', 'jade'),
  /* Nuwara Eliya and the tea hills */
  'nanu-oya-station': place('Nanu Oya Railway Station', 'sight', 'Train Station', 4.2, 3210, null, 'nuwara-eliya', [80.71, 6.94],
    'The station for Nuwara Eliya on the famous hill-country line. From here, take a tuk-tuk up the hill.', 'terraces', 'slate'),
  'lovers-leap-falls': place('Lover\'s Leap Falls', 'nature', 'Waterfall', 4.2, 3780, null, 'nuwara-eliya', [80.75, 6.96],
    'A slender waterfall reached by a walk through tea bushes. Easy and pretty in the morning.', 'forest', 'jade'),
  'pedro-tea-estate': place('Pedro Tea Estate', 'sight', 'Tea Estate', 4.3, 4890, null, 'nuwara-eliya', [80.79, 6.96],
    'A working tea estate with a small factory tour and a cup of fresh tea at the end.', 'terraces', 'moss'),
  'gregory-lake': place('Gregory Lake', 'nature', 'Lake', 4.2, 12120, null, 'nuwara-eliya', [80.774, 6.964],
    'A lake in the middle of town with paddle boats and a lakeside path. A nice pause in the cool air.', 'isles', 'jade'),
  'victoria-park-nuwara-eliya': place('Victoria Park', 'nature', 'Park', 4.3, 6870, null, 'nuwara-eliya', [80.766, 6.97],
    'A green, well-kept park with flower beds and birdlife. Good for a slow walk.', 'forest', 'moss'),
  'horton-plains-worlds-end': place('Horton Plains and World\'s End', 'nature', 'National Park', 4.6, 9430, null, 'nuwara-eliya', [80.8, 6.8],
    'A high, misty plateau with a 9 km loop to World\'s End. Start very early, before the clouds cover the view.', 'peaks', 'moss'),
  'grand-hotel-nuwara-eliya': place('The Grand Hotel', 'stay', 'Heritage Hotel', 4.4, 4620, 130, 'nuwara-eliya', [80.77, 6.97],
    'A Tudor-style hotel with log fires and afternoon tea. A pleasant, old-fashioned base for the hills.', 'terraces', 'plum'),
  /* Ella */
  'ella-railway-station': place('Ella Railway Station', 'sight', 'Train Station', 4.4, 5640, null, 'ella', [81.05, 6.87],
    'A small station on the Kandy to Badulla line. Riding the train from Nanu Oya is a highlight of the hills.', 'terraces', 'ember'),
  'nine-arch-bridge': place('Nine Arch Bridge', 'sight', 'Historical Landmark', 4.7, 26340, null, 'ella', [81.06, 6.877],
    'A stone viaduct in the jungle, built a century ago. Arrive before a train passes and keep your distance from the track.', 'forest', 'jade'),
  'little-adams-peak': place('Little Adam\'s Peak', 'nature', 'Hiking Trail', 4.6, 12580, null, 'ella', [81.05, 6.872],
    'An easy 45-minute climb through tea bushes to wide views. A good sunrise walk.', 'peaks', 'ember'),
  'ella-rock': place('Ella Rock', 'nature', 'Hiking Trail', 4.6, 7640, null, 'ella', [81.03, 6.85],
    'A more demanding half-day hike along the railway line. Start early and take water.', 'peaks', 'moss'),
  'ravana-falls': place('Ravana Falls', 'nature', 'Waterfall', 4.3, 10910, null, 'ella', [81.05, 6.84],
    'A wide waterfall beside the road to Wellawaya. A short stop on the way down from the hills.', 'forest', 'ice'),
  'matey-hut': place('Matey Hut', 'food', 'Restaurant', 4.5, 3640, null, 'ella', [81.047, 6.867],
    'A relaxed spot for rice and curry and fresh fruit juice. A friendly, easy lunch.', 'city', 'sand'),
  'cafe-chill-ella': place('Cafe Chill', 'nightlife', 'Bar', 4.2, 5190, null, 'ella', [81.047, 6.868],
    'A lively little bar and cafe on Ella\'s main road, for cocktails and music.', 'city', 'plum'),
  '98-acres-ella': place('98 Acres Resort and Spa', 'stay', 'Boutique Hotel', 4.7, 3890, 220, 'ella', [81.06, 6.89],
    'Cottages set in a tea estate below Little Adam\'s Peak, with views across the hills.', 'terraces', 'jade'),
  /* Cultural Triangle */
  'sigiriya-rock': place('Sigiriya Rock Fortress', 'sight', 'Historical Landmark', 4.7, 34520, null, 'sigiriya', [80.76, 7.957],
    'A fifth-century palace on a 200 m rock, with frescoes and mirror wall. Climb at opening time, before the heat.', 'canyon', 'ember'),
  'pidurangala-rock': place('Pidurangala Rock', 'nature', 'Hiking Trail', 4.6, 9240, null, 'sigiriya', [80.76, 7.97],
    'A cheaper, quieter climb with the best view of Sigiriya itself. Go for sunset.', 'peaks', 'rose'),
  'dambulla-cave-temple': place('Dambulla Cave Temple', 'sight', 'Buddhist Temple', 4.6, 12960, null, 'sigiriya', [80.65, 7.857],
    'Five caves with over a hundred Buddha images and painted ceilings. Take off your shoes and hat at the entrance.', 'canyon', 'sand'),
  'polonnaruwa': place('Polonnaruwa Ancient City', 'sight', 'Historical Landmark', 4.7, 11870, null, 'sigiriya', [81.0, 7.94],
    'A medieval capital of ruined palaces and temples. Hire a bike and cover it slowly in the morning.', 'canyon', 'sand'),
  'gal-vihara': place('Gal Vihara', 'sight', 'Historical Landmark', 4.7, 5320, null, 'sigiriya', [81.0, 7.96],
    'Four large Buddha figures carved from a single granite rock face. Quiet and moving.', 'canyon', 'slate'),
  'minneriya-national-park': place('Minneriya National Park', 'nature', 'National Park', 4.5, 6240, null, 'sigiriya', [80.9, 8.03],
    'Home to large gatherings of elephants at the reservoir in the dry season, about July to October. Go on a late-afternoon jeep safari.', 'forest', 'moss'),
  'anuradhapura-sri-maha-bodhi': place('Sri Maha Bodhi', 'sight', 'Buddhist Temple', 4.6, 6720, null, 'sigiriya', [80.4, 8.345],
    'A sacred fig tree grown from a cutting of the tree under which the Buddha reached enlightenment. Wear white if you can.', 'city', 'jade'),
  'ruwanwelisaya': place('Ruwanwelisaya', 'sight', 'Buddhist Stupa', 4.7, 5140, null, 'sigiriya', [80.395, 8.351],
    'A great white stupa in Anuradhapura, ringed by elephants carved in stone. Visit at dusk.', 'city', 'sand'),
  'mihintale': place('Mihintale', 'sight', 'Historical Landmark', 4.6, 4180, null, 'sigiriya', [80.5, 8.35],
    'The hill where Buddhism is said to have arrived in the island. A long climb up the steps.', 'peaks', 'ember'),
  'heritance-kandalama': place('Heritance Kandalama', 'stay', 'Hotel', 4.5, 9460, 200, 'sigiriya', [80.705, 7.872],
    'A Geoffrey Bawa hotel built into a cliff above a lake, near Dambulla and Sigiriya.', 'forest', 'moss'),
  /* Yala and the south-east */
  'udawalawe-national-park': place('Udawalawe National Park', 'nature', 'National Park', 4.5, 8820, null, 'yala', [80.9, 6.43],
    'Open grassland with a very high chance of seeing elephants. A good first safari, especially with children.', 'forest', 'sand'),
  'yala-national-park': place('Yala National Park', 'nature', 'National Park', 4.5, 21680, null, 'yala', [81.42, 6.37],
    'The island\'s best-known park for leopards, elephants and crocodiles. Go at dawn and be ready for a crowd of jeeps.', 'forest', 'ember'),
  'kataragama-temple': place('Kataragama Temple', 'sight', 'Hindu Temple', 4.4, 3210, null, 'yala', [81.33, 6.415],
    'A shared shrine for Hindus, Buddhists and Muslims. The evening puja is worth a short visit.', 'city', 'plum'),
  'cinnamon-wild-yala': place('Cinnamon Wild Yala', 'stay', 'Safari Lodge', 4.4, 1980, 240, 'yala', [81.38, 6.29],
    'A lodge on the edge of Yala, with a pool and evening safari drives.', 'forest', 'moss'),
  /* Trincomalee and the east */
  'koneswaram-temple': place('Koneswaram Temple', 'sight', 'Hindu Temple', 4.6, 6540, null, 'trincomalee', [81.24, 8.58],
    'A hilltop Shiva temple above the sea, with a statue of the god and sweeping bay views.', 'sea', 'ember'),
  'pigeon-island': place('Pigeon Island National Park', 'nature', 'Island', 4.4, 4820, null, 'trincomalee', [81.2, 8.72],
    'A small coral island with clear water and reef sharks near the shore. Best snorkelled in the calm months.', 'isles', 'cobalt'),
  'nilaveli-beach': place('Nilaveli Beach', 'beach', 'Beach', 4.5, 5760, null, 'trincomalee', [81.19, 8.7],
    'A long, quiet white-sand beach on the north-east coast, with calm water from about April to September.', 'sea', 'ice'),
  'arugam-bay-beach': place('Arugam Bay', 'beach', 'Beach', 4.4, 8230, null, 'arugam-bay', [81.83, 6.84],
    'A surf bay on the south-east coast. The season runs roughly from May to September.', 'sea', 'jade')
};

const T_COAST = 'Southern coastline & palm-fringed bays';
const T_CULT = 'Ancient kingdoms & Buddhist sanctuaries';
const T_HILL = 'Tea estates, misty ridges & highland rail';
const T_WILD = 'National parks & wild leopard country';

module.exports = {
  id: 'srilanka',
  name: 'Sri Lanka',
  tripTitle: 'Sri Lanka Coast & Hills',
  threadTitle: 'Plan Sri Lanka Trip',
  match: ['sri lanka', 'srilanka', 'colombo', 'galle', 'kandy', 'ella', 'sigiriya', 'mirissa', 'unawatuna', 'nuwara eliya', 'yala', 'trincomalee', 'ceylon'],
  currency: '$',
  region: 'the south and the hill country',
  scene: 'terraces',
  tone: 'moss',
  card: { caption: 'Sri Lanka', scene: 'isles', tone: 'jade' },
  prompt: 'Plan a trip to Sri Lanka',

  map: {
    bounds: [79.4, 5.8, 82.0, 10.0],
    land: [[
      [80.23, 9.82], [80.04, 9.82], [79.89, 9.75], [79.93, 9.62], [80.2, 9.5], [79.99, 9.3], [79.79, 9.12], [79.72, 9.09],
      [79.85, 8.98], [79.93, 8.85], [79.92, 8.6], [79.78, 8.3], [79.72, 8.2], [79.83, 8.03], [79.8, 7.57], [79.83, 7.21],
      [79.84, 6.93], [79.93, 6.65], [79.99, 6.42], [80.06, 6.2], [80.1, 6.13], [80.17, 6.06], [80.2, 6.03], [80.215, 6.02], [80.25, 6.0], [80.33, 5.985], [80.43, 5.965], [80.46, 5.94], [80.55, 5.935], [80.6, 5.905], [80.8, 6.0],
      [81.12, 6.12], [81.31, 6.21], [81.4, 6.25], [81.55, 6.4], [81.7, 6.62], [81.87, 6.86], [81.86, 7.05], [81.83, 7.42], [81.7, 7.72],
      [81.53, 7.95], [81.35, 8.3], [81.3, 8.5], [81.2, 8.75], [81.03, 8.95], [80.97, 9.02], [80.82, 9.27], [80.62, 9.4],
      [80.37, 9.62], [80.3, 9.78], [80.23, 9.82]
    ]],
    water: [
      // Mahaweli, from Kandy north-east to Koddiyar bay
      [[80.65, 7.17], [80.66, 7.29], [80.85, 7.4], [80.92, 7.75], [81.05, 8.2], [81.2, 8.42]],
      // Kelani, from the hills to Colombo
      [[80.5, 6.85], [80.25, 6.95], [80.05, 6.95], [79.87, 6.97]],
      // Walawe
      [[80.65, 6.6], [80.85, 6.42], [81.0, 6.15]],
      // Parakrama Samudra, drawn as a centre line
      [[80.98, 7.9], [81.0, 7.96], [81.02, 8.0]]
    ],
    parks: [
      [[81.28, 6.22], [81.55, 6.4], [81.55, 6.55], [81.35, 6.55], [81.28, 6.4]],
      [[80.77, 6.78], [80.86, 6.78], [80.86, 6.84], [80.77, 6.84]],
      [[80.33, 6.38], [80.55, 6.38], [80.55, 6.44], [80.33, 6.44]],
      [[79.9, 8.3], [80.1, 8.3], [80.1, 8.55], [79.9, 8.55]],
      [[80.82, 6.35], [80.98, 6.35], [80.98, 6.48], [80.82, 6.48]]
    ],
    roads: [
      { ref: 'A1', path: [[79.86, 6.93], [80.06, 7.07], [80.35, 7.25], [80.63, 7.29]] },
      { ref: 'A2', path: [[79.86, 6.93], [79.95, 6.6], [80.0, 6.42], [80.22, 6.05], [80.55, 5.95], [80.8, 6.02], [81.12, 6.12]] },
      { ref: 'A9', path: [[80.63, 7.29], [80.62, 7.47], [80.65, 7.86], [80.55, 8.35], [80.5, 8.75], [80.4, 9.4], [80.0, 9.66]] },
      { ref: 'A5', path: [[80.63, 7.29], [80.7, 7.1], [80.77, 6.97]] },
      { ref: 'A6', path: [[80.75, 8.03], [80.95, 8.3], [81.22, 8.57]] }
    ],
    labels: [
      { t: 'Colombo', at: [79.87, 6.9], kind: 'town' },
      { t: 'Galle', at: [80.25, 6.06], kind: 'town' },
      { t: 'Mirissa', at: [80.46, 5.97], kind: 'town' },
      { t: 'Kandy', at: [80.66, 7.32], kind: 'town' },
      { t: 'Nuwara Eliya', at: [80.6, 6.99], kind: 'town' },
      { t: 'Ella', at: [81.13, 6.87], kind: 'town' },
      { t: 'Sigiriya', at: [80.82, 7.98], kind: 'town' },
      { t: 'Anuradhapura', at: [80.4, 8.4], kind: 'town' },
      { t: 'Trincomalee', at: [81.25, 8.53], kind: 'town' },
      { t: 'Jaffna', at: [80.02, 9.68], kind: 'town' },
      { t: 'Arugam Bay', at: [81.7, 6.8], kind: 'town' },
      { t: 'CENTRAL HIGHLANDS', at: [80.95, 7.25], kind: 'region' },
      { t: 'SOUTHERN COAST', at: [80.55, 6.15], kind: 'region' },
      { t: 'INDIAN OCEAN', at: [80.0, 5.9], kind: 'region' },
      { t: 'BAY OF BENGAL', at: [81.7, 8.9], kind: 'region' },
      { t: 'Yala', at: [81.45, 6.5], kind: 'park' },
      { t: 'Horton Plains', at: [80.82, 6.74], kind: 'park' },
      { t: 'Sinharaja', at: [80.44, 6.35], kind: 'park' },
      { t: 'Wilpattu', at: [80.0, 8.42], kind: 'park' }
    ]
  },

  areas: [
    { id: 'colombo', name: 'Colombo', town: 'Colombo', alt: 'Western Province', at: [79.86, 6.93] },
    { id: 'galle', name: 'Galle', town: 'Galle Fort', alt: 'Galle Fort and Unawatuna', at: [80.22, 6.03] },
    { id: 'mirissa', name: 'Mirissa', town: 'Mirissa', alt: 'Weligama and the south', at: [80.46, 5.95] },
    { id: 'kandy', name: 'Kandy', town: 'Kandy', alt: 'Hill capital', at: [80.63, 7.29] },
    { id: 'nuwara-eliya', name: 'Nuwara Eliya', town: 'Nuwara Eliya', alt: 'Tea country', at: [80.77, 6.97] },
    { id: 'ella', name: 'Ella', town: 'Ella', alt: 'Ella and Badulla', at: [81.05, 6.87] },
    { id: 'sigiriya', name: 'Cultural Triangle', town: 'Sigiriya', alt: 'Sigiriya and Anuradhapura', at: [80.76, 7.96] },
    { id: 'yala', name: 'Yala', town: 'Udawalawe and Yala', alt: 'Yala and Udawalawe', at: [81.3, 6.28] },
    { id: 'trincomalee', name: 'Trincomalee', town: 'Trincomalee', alt: 'East coast', at: [81.23, 8.57] },
    { id: 'arugam-bay', name: 'Arugam Bay', town: 'Arugam Bay', alt: 'Surf coast', at: [81.83, 6.84] }
  ],

  places,

  clarify: {
    types: { q: 'How should we shape your journey through Sri Lanka?', options: [T_COAST, T_CULT, T_HILL, T_WILD] },
    duration: {
      q: 'How many days would you dedicate to Sri Lanka?',
      options: [
        { label: 'An unhurried week (~7 days)', days: 7 },
        { label: 'A ten-day loop (~10 days)', days: 10 },
        { label: 'A grand island journey (~14 days)', days: 14 }
      ]
    },
    dates: { q: 'Select your travel dates for Sri Lanka so I can verify boutique estates and monsoon seasons.' },
    base: {
      q: 'For this {type} journey, which sanctuary should anchor your stay?',
      options: ['Historic ramparts of Galle Fort & the southern bays', 'High tea plantations & colonial planters bungalows', 'Forest lodges in the Cultural Triangle']
    }
  },

  stays: {
    query: 'boutique hotels in Sri Lanka',
    found: 22,
    ids: ['jetwing-lighthouse', 'amangalla', 'cinnamon-grand-colombo', 'mahaweli-reach-kandy', 'grand-hotel-nuwara-eliya', '98-acres-ella', 'heritance-kandalama', 'cinnamon-wild-yala'],
    byBase: {
      'Galle Fort and the south coast': 'amangalla',
      'Historic ramparts of Galle Fort & the southern bays': 'amangalla',
      'Tea estates in the hill country': 'grand-hotel-nuwara-eliya',
      'High tea plantations & colonial planters bungalows': 'grand-hotel-nuwara-eliya',
      'Heritage lodges in the Cultural Triangle': 'heritance-kandalama',
      'Forest lodges in the Cultural Triangle': 'heritance-kandalama'
    }
  },

  extras: {
    food: ['ministry-of-crab', 'pedlars-inn-cafe', 'isle-of-gelato', 'balaji-dosai', 'matey-hut'],
    nightlife: ['galle-face-verandah', 'mirissa-beach-bars', 'cafe-chill-ella', 'kandy-cultural-centre'],
    relaxedDrop: 1
  },

  suggestions: ['Curate coastal seafood & plantation dining', 'Add sunset tea verandahs & ocean sundowners', 'Pace the days more leisurely'],

  replies: {
    planIntro: {
      [T_COAST]: "I'll compose this around the south-west coast: a quiet opening in Colombo, then ambling along Galle Fort's ramparts, and unhurried days by palm-fringed bays.",
      'Coast and beaches': "I'll compose this around the south-west coast: a quiet opening in Colombo, then ambling along Galle Fort's ramparts, and unhurried days by palm-fringed bays.",
      [T_CULT]: "I'll trace the sacred arc between Kandy and the ancient stone citadels of the Cultural Triangle, concluding with a serene stay in Galle.",
      'Culture and heritage': "I'll trace the sacred arc between Kandy and the ancient stone citadels of the Cultural Triangle, concluding with a serene stay in Galle.",
      [T_HILL]: "I'll take you into tea country by slow rail, through cloud forests and high plantation bungalows, keeping mountain days deeply restful.",
      'Hills, tea and trains': "I'll take you into tea country by slow rail, through cloud forests and high plantation bungalows, keeping mountain days deeply restful.",
      [T_WILD]: "I'll weave wild leopard tracks and elephant sanctuaries with highland waterfalls, ending with unhurried coastal air.",
      'Wildlife and nature': "I'll weave wild leopard tracks and elephant sanctuaries with highland waterfalls, ending with unhurried coastal air."
    },
    planDone: 'Here is your **{days}-day** Sri Lanka plan for {month}. Distances look short on a map, but roads are slow and winding, so I kept most days to one main area with a long drive on the changeover days.\n\nThe island has two monsoons, so the coast and the hills are not at their best at the same time. The south-west coast is generally best from December to March, and the east coast from about April to September. If {month} is on the wet side for your route, tell me and I will adjust it.',
    staysIntro: 'I\'ll pick a comfortable base with good access to the coast and hills, then add a few well-placed local meals without overpacking your days.',
    staysDone: 'Your Sri Lanka plan is now dated **{range}**.\n\nI added **{stay}** as a central base, plus two meals that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. The rest of the plan stays intentionally relaxed, with drives kept sensible between areas.',
    reserve: 'I can\'t reserve or pay for anything in this planner. Use the itinerary to contact hotels, drivers, train operators and safari providers directly, and confirm current prices and availability before booking.',
    relaxed: 'I\'ve removed the busiest stop from each day. Sri Lankan roads are winding, and fewer stops grant generous time on the verandah or by the sea.',
    food: 'I curated celebrated coastal seafood kitchens, estate dining rooms, and authentic hopper breakfast spots along your route.',
    nightlife: 'Evenings in Sri Lanka are easy and quiet: colonial hotel verandahs, ocean sundowners on the ramparts, and lantern-lit bay cafes.',
    fallback: 'I can help you plan Sri Lanka: adjust days, add a beach, temple or safari, or reorder the route. Tell me what you would like to change.'
  },

  deep: {
    steps: ['Reading the brief', 'Searching sources', 'Comparing bases and monsoon seasons', 'Checking transport and availability', 'Writing the plan'],
    sources: [
      { title: 'Sri Lanka Tourism: plan your trip', domain: 'srilanka.travel', note: 'Official destination information and regional overviews' },
      { title: 'Sri Lanka travel guide', domain: 'lonelyplanet.com', note: 'Route ideas and seasonal notes for the coast and hills' },
      { title: 'Sri Lanka travel guide', domain: 'roughguides.com', note: 'Cultural sites and pacing suggestions' },
      { title: 'Sri Lanka', domain: 'en.wikivoyage.org', note: 'Distances, transport and regional differences' },
      { title: 'Where to go in Sri Lanka and when', domain: 'cntraveller.com', note: 'Seasons and bases compared' },
      { title: 'Things to do in Sri Lanka: traveller reviews', domain: 'tripadvisor.com', note: 'Review patterns for beaches, temples and safaris' },
      { title: 'Sri Lanka Railways: train services and reservations', domain: 'railway.gov.lk', note: 'Hill-country line timetables and seat reservations' },
      { title: 'Weather and climate outlook', domain: 'meteo.gov.lk', note: 'Monsoon patterns and rainfall by region' },
      { title: 'National parks and safaris', domain: 'dwc.gov.lk', note: 'Park information and visitor rules' },
      { title: 'Flying to Colombo', domain: 'srilankan.com', note: 'Flight connections into Colombo' },
      { title: 'The best time to visit Sri Lanka', domain: 'nationalgeographic.com', note: 'Wildlife seasons and coastal weather' },
      { title: 'A slower way through Sri Lanka', domain: 'theguardian.com', note: 'First-hand notes on pace and drive times' }
    ],
    lines: [
      'Read srilanka.travel: regional overview of the south and hill country',
      'Searched "Sri Lanka monsoon seasons coast vs hill country"',
      'Read meteo.gov.lk: rainfall by region and month',
      'Compared Galle, Mirissa and Ella as bases',
      'Read railway.gov.lk: Kandy to Ella reserved seats',
      'Read dwc.gov.lk: Yala, Udawalawe and Minneriya visitor notes',
      'Searched "Sigiriya and Polonnaruwa best time of day"',
      'Read lonelyplanet.com: driving times between Colombo, Kandy and Galle',
      'Read cntraveller.com: boutique hotels on the south coast',
      'Compared four candidate bases and their drive times'
    ],
    report: {
      title: 'Sri Lanka: how to pair the coast with the hills',
      summary: 'Sri Lanka packs beaches, ancient cities and tea country into a small island, but roads are slow, so a good trip picks two or three bases rather than trying to see everything [2][4]. The main planning question is the season: the two monsoons mean the south-west coast and the east coast peak at different times [1][8].',
      sections: [
        { h: 'When to go', body: 'The south-west coast and the hills are generally at their best from about December to March, while the east coast is better from roughly April to September [1][8]. Whale watching off Mirissa is generally best in the drier months, and elephant gatherings at Minneriya come in the dry season, about July to October [2][11]. Weather is not tidy, so build in flexibility.' },
        { h: 'Choosing a base', body: 'Galle Fort is a good first base for the south-west coast: walkable, safe and central for Unawatuna, Mirissa and Hikkaduwa [2][5]. The hill country is best from Kandy, Nuwara Eliya or Ella, connected by one of the world\'s great train rides [7]. The Cultural Triangle is best from Sigiriya or Dambulla, rather than as a day trip from Colombo [3][4].' },
        { h: 'Getting around', body: 'Distances look short but roads are winding and busy, and a 100 km drive can take three hours or more [4][12]. Trains are slower but scenic, and reserved seats on the Kandy to Ella line are worth booking in advance [7]. A car with a driver is the usual choice for the rest of the island [2][12].' },
        { h: 'Wildlife and permits', body: 'Yala is famous for leopards but can be crowded, while Udawalawe is easier for elephants and calmer in the morning [9][11]. Parks close for certain periods, so check before you plan around them [9]. Book jeeps through your hotel or a licensed operator, and go at dawn or late afternoon [6][9].' }
      ],
      table: {
        caption: 'Choosing a base',
        cols: ['Base', 'Feel', 'Best for', 'Beach', 'Drive from Colombo'],
        rows: [
          ['Galle Fort', 'Historic, walkable, calm', 'Culture and the south coast', 'Unawatuna nearby', '2 to 2.5 hours'],
          ['Mirissa', 'Relaxed beach town', 'Whales and beach days', 'Right on the sand', '3.5 to 4 hours'],
          ['Kandy and the hills', 'Green, cool, spiritual', 'Temples, tea and trains', 'None', '3 to 4 hours'],
          ['Sigiriya', 'Rural, ancient', 'Rock fortress and ruins', 'None', '4 to 5 hours']
        ]
      }
    }
  }
};
