'use strict';
/* Kyoto destination for the Friday planner. Sample data: ratings, review counts and prices are plausible, not live. */

// place(name, kind, label, rating, reviews, price, area, [lng, lat], blurb, scene, tone)
const place = (name, kind, label, rating, reviews, price, area, at, blurb, scene, tone) =>
  ({ name, kind, label, rating, reviews, price, area, at, blurb, scene, tone });

const places = {
  /* Southern Higashiyama */
  'kiyomizu-dera': place('Kiyomizu-dera', 'sight', 'Historical Landmark', 4.6, 78450, null, 'higashiyama', [135.785, 34.995],
    'A hillside temple with a wooden stage over the maples. Go at opening time, or stay for the autumn evening opening.', 'forest', 'ember'),
  'sannenzaka-ninenzaka': place('Sannenzaka and Ninenzaka', 'neighborhood', 'Neighborhood', 4.5, 21830, null, 'higashiyama', [135.781, 34.998],
    'Two stone-paved lanes of tea houses and craft shops that lead down from Kiyomizu-dera. Best early or late.', 'city', 'rose'),
  'kodaiji': place('Kodai-ji', 'sight', 'Historical Landmark', 4.5, 14620, null, 'higashiyama', [135.781, 35.0],
    'A quiet Zen temple with a raked-gravel garden and bamboo grove. Its autumn evening illumination is popular.', 'forest', 'plum'),
  'kyoto-national-museum': place('Kyoto National Museum', 'museum', 'Museum', 4.4, 6710, null, 'higashiyama', [135.772, 34.99],
    'Japanese art and craft from the old capital, in a Meiji-era building. A good rainy-day stop.', 'city', 'slate'),
  'sanjusangendo': place('Sanjusangen-do', 'sight', 'Historical Landmark', 4.6, 19250, null, 'higashiyama', [135.772, 34.988],
    'A long wooden hall with a thousand gilded statues of Kannon. Quiet, awe-inspiring and dry when it rains.', 'city', 'sand'),
  'hyatt-regency-kyoto': place('Hyatt Regency Kyoto', 'stay', 'Hotel', 4.5, 5240, 38000, 'higashiyama', [135.771, 34.99],
    'A calm hotel across from Sanjusangen-do, with a spa and an easy walk to the museum and Kiyomizu-dera.', 'city', 'slate'),
  /* Gion */
  'hanamikoji-street': place('Hanamikoji Street', 'neighborhood', 'Neighborhood', 4.5, 24170, null, 'gion', [135.775, 35.0],
    'The main street of Gion, with wooden machiya and tea houses. Be quiet and respectful if you see a maiko.', 'city', 'rose'),
  'yasaka-shrine': place('Yasaka Shrine', 'sight', 'Historical Landmark', 4.5, 22380, null, 'gion', [135.779, 35.004],
    'A bright vermilion shrine at the east end of Shijo, lit up after dark and open all night.', 'city', 'ember'),
  'chion-in': place('Chion-in', 'sight', 'Historical Landmark', 4.5, 9840, null, 'gion', [135.784, 35.004],
    'A huge temple complex with a great gate and quiet gardens on the hill behind Maruyama Park.', 'forest', 'moss'),
  'kikunoi-honten': place('Kikunoi Honten', 'food', 'Kaiseki Restaurant', 4.7, 2860, null, 'gion', [135.78, 35.0],
    'A classic kaiseki house by Maruyama Park, with seasonal dishes. Book weeks ahead.', 'city', 'plum'),
  'pontocho-alley': place('Pontocho Alley', 'nightlife', 'Alley', 4.4, 18420, null, 'gion', [135.771, 35.005],
    'A narrow lantern-lit lane beside the Kamo river, full of small restaurants and bars.', 'city', 'plum'),
  'sowaka': place('Sowaka', 'stay', 'Boutique Hotel', 4.7, 1310, 60000, 'gion', [135.778, 35.002],
    'A quiet Gion hotel in a former teahouse, with a small garden and beautiful rooms.', 'city', 'sand'),
  /* Central Kyoto */
  'nishiki-market': place('Nishiki Market', 'market', 'Market', 4.4, 52810, null, 'central', [135.765, 35.005],
    'A five-block covered market of pickles, tofu, sweets and street snacks. Go at 10am, before the crowds.', 'city', 'rose'),
  'nijo-castle': place('Nijo Castle', 'sight', 'Historical Landmark', 4.5, 32570, null, 'central', [135.748, 35.014],
    'The shogun\'s Kyoto residence, with nightingale floors and painted screens. Its garden is at its best in mid-November.', 'city', 'sand'),
  'kyoto-imperial-palace': place('Kyoto Imperial Palace', 'sight', 'Historical Landmark', 4.4, 17240, null, 'central', [135.762, 35.025],
    'The old imperial residence, set inside a large gravel park. Entry is free, and you can walk the grounds at leisure.', 'forest', 'jade'),
  'ippodo-tea': place('Ippodo Tea Kyoto Main Shop', 'food', 'Tea House', 4.6, 4390, null, 'central', [135.759, 35.011],
    'A tea merchant since 1717, with a tearoom out the back. Order a bowl of matcha and a sweet.', 'city', 'moss'),
  'kyoto-manga-museum': place('Kyoto International Manga Museum', 'museum', 'Museum', 4.1, 5420, null, 'central', [135.759, 35.012],
    'A former school building holding hundreds of thousands of manga volumes. A relaxed rainy-day pause.', 'city', 'slate'),
  'honke-owariya': place('Honke Owariya', 'food', 'Soba Restaurant', 4.4, 3280, null, 'central', [135.758, 35.012],
    'A soba house with roots in the fifteenth century. Try the hot soba in a tiered box.', 'city', 'sand'),
  'kamo-river-walk': place('Kamo River Walk', 'nature', 'Riverside Path', 4.6, 9130, null, 'central', [135.771, 35.005],
    'A flat riverside path where Kyoto walks, jogs and sits on the bank at dusk.', 'city', 'jade'),
  'bar-k6': place('Bar K6', 'nightlife', 'Bar', 4.5, 1540, null, 'central', [135.771, 35.008],
    'A friendly bar on the river, with a long whisky list and a warm crowd. Open until late.', 'city', 'plum'),
  'rocking-chair-bar': place('Bar Rocking Chair', 'nightlife', 'Bar', 4.6, 890, null, 'central', [135.77, 35.006],
    'A quiet cocktail bar known for classic drinks and fresh fruit. Expect a small room and a seat charge.', 'city', 'rose'),
  'ritz-carlton-kyoto': place('The Ritz-Carlton Kyoto', 'stay', 'Luxury Hotel', 4.8, 3920, 110000, 'central', [135.771, 35.013],
    'A riverside hotel with a garden, spa and rooms overlooking the Kamo. Walk to Pontocho and Nijo.', 'city', 'sand'),
  'the-thousand-kyoto': place('The Thousand Kyoto', 'stay', 'Boutique Hotel', 4.5, 4180, 32000, 'central', [135.759, 34.987],
    'A stylish hotel a short walk from Kyoto Station, ideal for early trains and late arrivals.', 'city', 'slate'),
  /* Arashiyama */
  'arashiyama-bamboo-grove': place('Arashiyama Bamboo Grove', 'nature', 'Scenic Walk', 4.4, 61470, null, 'arashiyama', [135.671, 35.017],
    'A short path between tall bamboo stems. Go before 8am, when the light is soft and the path is quiet.', 'forest', 'moss'),
  'tenryuji': place('Tenryu-ji', 'sight', 'Historical Landmark', 4.6, 21390, null, 'arashiyama', [135.674, 35.016],
    'A Zen temple with a pond garden that has barely changed in seven centuries. Its maples turn in mid-to-late November.', 'forest', 'ember'),
  'togetsukyo-bridge': place('Togetsukyo Bridge', 'sight', 'Historical Landmark', 4.4, 26380, null, 'arashiyama', [135.677, 35.009],
    'A long wooden bridge over the Katsura river, with a hillside of maples behind it.', 'forest', 'jade'),
  'okochi-sanso': place('Okochi Sanso Villa', 'sight', 'Historic Garden', 4.6, 6210, null, 'arashiyama', [135.673, 35.021],
    'A hillside villa garden with a tea served at the top. A quieter finish after the bamboo.', 'forest', 'moss'),
  'yoshimura-arashiyama': place('Yoshimura Arashiyama', 'food', 'Soba Restaurant', 4.4, 6540, null, 'arashiyama', [135.678, 35.01],
    'A soba restaurant beside the bridge, with river views from the upstairs seats.', 'city', 'sand'),
  'hoshinoya-kyoto': place('Hoshinoya Kyoto', 'stay', 'Luxury Ryokan', 4.8, 1150, 130000, 'arashiyama', [135.66, 35.01],
    'A ryokan reached by boat up the Oi river, with quiet gardens and private dining.', 'forest', 'jade'),
  /* North-west */
  'kinkakuji': place('Kinkaku-ji', 'sight', 'Historical Landmark', 4.6, 89520, null, 'northwest', [135.729, 35.039],
    'The gold-leafed pavilion beside its mirror pond. It is crowded, so arrive at opening time.', 'city', 'sand'),
  'ryoanji': place('Ryoan-ji', 'sight', 'Historical Landmark', 4.5, 21780, null, 'northwest', [135.718, 35.034],
    'Home to Japan\'s best-known rock garden. Sit on the veranda and let the quiet arrive.', 'city', 'slate'),
  'kitano-tenmangu': place('Kitano Tenmangu', 'sight', 'Historical Landmark', 4.4, 11340, null, 'northwest', [135.735, 35.032],
    'A shrine with a plum grove and monthly market. Its maples turn from late November.', 'forest', 'ember'),
  'funaoka-onsen': place('Funaoka Onsen', 'wellness', 'Public Bath', 4.4, 2180, null, 'northwest', [135.745, 35.043],
    'A historic bathhouse with carved wood and a cypress bath. Plan to visit on a cold evening, and bring a small towel.', 'city', 'rose'),
  'aman-kyoto': place('Aman Kyoto', 'stay', 'Luxury Hotel', 4.9, 880, 200000, 'northwest', [135.735, 35.06],
    'A hidden retreat in a forest garden north of the city, with stone paths and mossy walls.', 'forest', 'moss'),
  /* Northern Higashiyama */
  'ginkakuji': place('Ginkaku-ji', 'sight', 'Historical Landmark', 4.5, 33620, null, 'n-higashiyama', [135.798, 35.027],
    'The Silver Pavilion and its moss garden, quiet and beautiful in autumn. Start here and walk south.', 'forest', 'slate'),
  'philosophers-path': place('Philosopher\'s Path', 'nature', 'Scenic Walk', 4.6, 27430, null, 'n-higashiyama', [135.795, 35.02],
    'A canal-side path lined with cherry and maple trees. Slow and pleasant, with little cafes along the way.', 'forest', 'ember'),
  'nanzenji': place('Nanzen-ji', 'sight', 'Historical Landmark', 4.6, 24860, null, 'n-higashiyama', [135.794, 35.011],
    'A grand Zen temple with a brick aqueduct in its grounds. Its maples turn late in November.', 'forest', 'jade'),
  'eikando': place('Eikan-do', 'sight', 'Historical Landmark', 4.6, 12150, null, 'n-higashiyama', [135.795, 35.014],
    'Known as Kyoto\'s best autumn temple, with maples around a pond. It has a night opening in autumn, so book ahead.', 'forest', 'ember'),
  'heian-jingu': place('Heian Shrine', 'sight', 'Historical Landmark', 4.5, 22930, null, 'n-higashiyama', [135.783, 35.016],
    'A large vermilion shrine with a wide garden and a big torii gate. Calm and open.', 'city', 'rose'),
  'omen-ginkakuji': place('Omen Ginkakuji', 'food', 'Udon Restaurant', 4.4, 2970, null, 'n-higashiyama', [135.797, 35.028],
    'A noodle house near Ginkaku-ji famous for udon with a dish of vegetables on the side.', 'city', 'sand'),
  'yoshida-sanso': place('Ryokan Yoshida Sanso', 'stay', 'Ryokan', 4.6, 630, 45000, 'n-higashiyama', [135.785, 35.03],
    'A small ryokan in a 1932 villa, close to Yoshida Hill and the Philosopher\'s Path.', 'forest', 'plum'),
  /* Fushimi and Daigo */
  'fushimi-inari': place('Fushimi Inari Taisha', 'sight', 'Historical Landmark', 4.7, 128450, null, 'fushimi', [135.78, 34.967],
    'Thousands of vermilion gates on a wooded mountain, open all day. Go in the early morning or at dusk.', 'forest', 'ember'),
  'tofukuji': place('Tofuku-ji', 'sight', 'Historical Landmark', 4.6, 19240, null, 'fushimi', [135.774, 34.977],
    'Kyoto\'s most famous autumn temple, with a sea of maples beneath the Tsutenkyo bridge. Arrive at opening time.', 'forest', 'ember'),
  'daigoji': place('Daigo-ji', 'sight', 'Historical Landmark', 4.6, 9630, null, 'fushimi', [135.82, 34.951],
    'A large temple complex in the hills east of the city, with a five-storey pagoda and a quiet garden.', 'forest', 'moss'),
  /* Ohara and Kurama */
  'sanzenin': place('Sanzen-in', 'sight', 'Historical Landmark', 4.6, 7180, null, 'ohara-kurama', [135.835, 35.12],
    'A moss-covered temple garden in the hills of Ohara. Its autumn colour is soft and understated.', 'forest', 'moss'),
  'kurama-dera': place('Kurama-dera', 'sight', 'Historical Landmark', 4.6, 9470, null, 'ohara-kurama', [135.77, 35.117],
    'A mountain temple reached by a forest trail. The hike to Kibune is best done in daylight.', 'forest', 'plum'),
  'kibune-shrine': place('Kibune Shrine', 'sight', 'Historical Landmark', 4.5, 6330, null, 'ohara-kurama', [135.764, 35.155],
    'A riverside shrine at the end of the Kurama trail, with lanterns along a stone stair.', 'forest', 'jade'),
  'kurama-onsen': place('Kurama Onsen', 'wellness', 'Hot Spring', 4.4, 3120, null, 'ohara-kurama', [135.771, 35.116],
    'An outdoor bath at the foot of the mountain, perfect after the Kurama hike.', 'forest', 'rose'),
  /* Uji */
  'byodoin': place('Byodo-in', 'sight', 'Historical Landmark', 4.6, 15630, null, 'uji', [135.807, 34.889],
    'The Phoenix Hall from 1053, shown on the ten-yen coin. Quiet in the morning.', 'city', 'ember'),
  'ujigami-shrine': place('Ujigami Shrine', 'sight', 'Historical Landmark', 4.3, 2180, null, 'uji', [135.81, 34.893],
    'Japan\'s oldest surviving shrine building, in a quiet wood across the river. Few visitors.', 'forest', 'moss'),
  'nakamura-tokichi': place('Nakamura Tokichi Honten', 'food', 'Tea House', 4.4, 6340, null, 'uji', [135.808, 34.889],
    'A matcha specialist since 1854, with soba, parfaits and sweets. Expect a queue at midday.', 'city', 'moss'),
  'kawai-kanjiro-house': place('Kawai Kanjiro\'s House', 'museum', 'Museum', 4.4, 1820, null, 'higashiyama', [135.775, 34.99],
    'The home and workshop of the potter Kanjiro Kawai. A quiet stop for people who like craft.', 'city', 'sand'),
  /* Added for Guide v1: gardens, craft and day-trip stops. Ratings and review counts are left empty rather than estimated. */
  'shisendo': place('Shisen-do', 'sight', 'Historic Garden', null, null, null, 'n-higashiyama', [135.798, 35.046],
    'A small hillside retreat built by a poet-scholar, with a raked-sand garden and the sound of a bamboo water-clapper. Quiet, and worth the detour north of Ginkaku-ji.', 'forest', 'moss'),
  'murin-an': place('Murin-an', 'sight', 'Historic Garden', null, null, null, 'n-higashiyama', [135.789, 35.011],
    'A Meiji-era garden beside Nanzen-ji, with a stream, lawns and the Higashiyama hills borrowed as a backdrop. A calm stop with a tea room.', 'forest', 'jade'),
  'shimogamo-shrine': place('Shimogamo Shrine', 'sight', 'Historical Landmark', null, null, null, 'central', [135.773, 35.039],
    'A World Heritage shrine reached through the Tadasu no Mori, an old woodland where the Kamo and Takano rivers meet. A gentle morning walk.', 'forest', 'moss'),
  'kamigamo-shrine': place('Kamigamo Shrine', 'sight', 'Historical Landmark', null, null, null, 'northwest', [135.753, 35.061],
    'One of Kyoto\'s oldest Shinto shrines, with wide lawns and a stream. Far fewer visitors than the big temples.', 'forest', 'sand'),
  'daitokuji': place('Daitoku-ji', 'sight', 'Historical Landmark', null, null, null, 'northwest', [135.745, 35.044],
    'A Zen temple complex of walled sub-temples and rock gardens. Open sub-temples change, so check which ones are admitting visitors on your dates.', 'forest', 'slate'),
  'ninnaji': place('Ninna-ji', 'sight', 'Historical Landmark', null, null, null, 'northwest', [135.713, 35.031],
    'A former imperial temple at the foot of the north-western hills, known for its late-blooming cherry trees in spring. Pair it with Ryoan-ji.', 'forest', 'rose'),
  'toji': place('To-ji', 'sight', 'Historical Landmark', null, null, null, 'central', [135.747, 34.981],
    'A temple with Japan\'s tallest wooden pagoda, close to Kyoto Station. It holds a monthly market on the 21st; confirm dates before you go.', 'city', 'ember'),
  'nishijin-textile-center': place('Nishijin Textile Center', 'museum', 'Craft Centre', null, null, null, 'central', [135.749, 35.031],
    'An introduction to Nishijin weaving, the silk-brocade craft of this district. Good for the crafts-minded and dry on a wet day.', 'city', 'plum'),
  'kyoto-railway-museum': place('Kyoto Railway Museum', 'museum', 'Museum', null, null, null, 'central', [135.744, 34.987],
    'A large museum of Japan\'s trains, a short walk from Kyoto Station. A good rainy-day option with children.', 'city', 'slate'),
  'gioji': place('Gio-ji', 'sight', 'Historical Landmark', null, null, null, 'arashiyama', [135.668, 35.029],
    'A small moss garden around a thatched hermitage, in the quieter Sagano hills behind the bamboo grove.', 'forest', 'moss'),
  'sagano-scenic-railway': place('Sagano Scenic Railway', 'sight', 'Scenic Railway', null, null, null, 'arashiyama', [135.675, 35.018],
    'A short open-sided train along the Hozu gorge. It runs seasonally and sells out in foliage season, so check the operating days.', 'forest', 'ember'),
  'iwatayama-monkey-park': place('Iwatayama Monkey Park', 'nature', 'Nature Park', null, null, null, 'arashiyama', [135.677, 35.009],
    'A short climb above the Katsura river to a viewpoint shared with free-roaming macaques. Keep your distance and follow the posted rules.', 'forest', 'jade'),
  'fushimi-sake-district': place('Fushimi Sake District', 'neighborhood', 'Neighborhood', null, null, null, 'fushimi', [135.762, 34.93],
    'Canals, willow-lined lanes and old sake breweries south of the city. A relaxed half-day after Fushimi Inari.', 'city', 'sand'),
};

const T_TEMP = 'Zen temples, rock gardens & quiet paths';
const T_FOOD = 'Kaiseki tables, soba & Nishiki market';
const T_LEAF = 'Momiji autumn foliage & moss gardens';
const T_TEA = 'Slow tea ceremonies & artisanal craft';

module.exports = {
  id: 'kyoto',
  name: 'Kyoto',
  tripTitle: 'Kyoto in Autumn',
  threadTitle: 'Plan Kyoto Trip',
  match: ['kyoto', 'gion', 'arashiyama', 'fushimi', 'kinkaku', 'kiyomizu', 'higashiyama', 'nishiki', 'pontocho', 'uji', 'japan'],
  currency: '¥',
  region: 'central Kyoto',
  scene: 'forest',
  tone: 'ember',
  card: { caption: 'Kyoto', scene: 'city', tone: 'plum' },
  prompt: 'Plan a trip to Kyoto',

  map: {
    bounds: [135.55, 34.86, 135.93, 35.19],
    land: [[[135.5, 34.8], [136.0, 34.8], [136.0, 35.25], [135.5, 35.25], [135.5, 34.8]]],
    water: [
      // Kamo river, north to south through the city
      [[135.76, 35.18], [135.76, 35.11], [135.765, 35.07], [135.77, 35.045], [135.772, 35.03], [135.77, 35.01], [135.77, 34.99], [135.755, 34.96], [135.735, 34.935], [135.72, 34.905]],
      // Takano river, joining the Kamo
      [[135.79, 35.1], [135.78, 35.06], [135.775, 35.035]],
      // Katsura river, past Arashiyama
      [[135.58, 35.03], [135.63, 35.03], [135.67, 35.01], [135.685, 34.99], [135.7, 34.96], [135.71, 34.93], [135.72, 34.9]],
      // Uji river
      [[135.9, 34.95], [135.86, 34.92], [135.82, 34.895], [135.79, 34.885], [135.71, 34.89]]
    ],
    parks: [
      [[135.756, 35.03], [135.77, 35.03], [135.77, 35.017], [135.756, 35.017]],
      [[135.79, 35.04], [135.83, 35.03], [135.84, 34.98], [135.8, 34.96], [135.785, 34.99]],
      [[135.65, 35.03], [135.68, 35.03], [135.68, 35.0], [135.65, 34.99]],
      [[135.72, 35.09], [135.8, 35.1], [135.8, 35.18], [135.72, 35.18]],
      [[135.77, 34.95], [135.79, 34.95], [135.79, 34.985], [135.77, 34.985]]
    ],
    roads: [
      { ref: '9', path: [[135.75, 35.01], [135.7, 35.012], [135.67, 35.02], [135.62, 35.03]] },
      { ref: '367', path: [[135.77, 35.03], [135.79, 35.07], [135.81, 35.1], [135.83, 35.125]] },
      { ref: '24', path: [[135.76, 34.97], [135.76, 34.93], [135.78, 34.9], [135.8, 34.89]] },
      { ref: '1', path: [[135.78, 35.0], [135.77, 34.98], [135.75, 34.96], [135.72, 34.92]] },
      { ref: '162', path: [[135.72, 35.035], [135.7, 35.08], [135.66, 35.13], [135.6, 35.18]] }
    ],
    labels: [
      { t: 'Kyoto', at: [135.75, 35.0], kind: 'town' },
      { t: 'Gion', at: [135.785, 35.008], kind: 'town' },
      { t: 'Arashiyama', at: [135.665, 35.025], kind: 'town' },
      { t: 'Fushimi', at: [135.76, 34.94], kind: 'town' },
      { t: 'Uji', at: [135.81, 34.875], kind: 'town' },
      { t: 'Ohara', at: [135.84, 35.135], kind: 'town' },
      { t: 'Kurama', at: [135.76, 35.135], kind: 'town' },
      { t: 'HIGASHIYAMA', at: [135.83, 34.99], kind: 'region' },
      { t: 'KITAYAMA', at: [135.7, 35.15], kind: 'region' },
      { t: 'KYOTO BASIN', at: [135.71, 34.94], kind: 'region' },
      { t: 'Imperial Park', at: [135.763, 35.033], kind: 'park' },
      { t: 'Sagano hills', at: [135.64, 35.005], kind: 'park' }
    ]
  },

  areas: [
    { id: 'higashiyama', name: 'Southern Higashiyama', town: 'Kiyomizu', alt: 'Kiyomizu', at: [135.78, 34.995] },
    { id: 'gion', name: 'Gion', town: 'Gion', alt: 'Gion and Maruyama', at: [135.776, 35.004] },
    { id: 'central', name: 'Central Kyoto', town: 'Central Kyoto', alt: 'Downtown', at: [135.76, 35.008] },
    { id: 'arashiyama', name: 'Arashiyama', town: 'Arashiyama', alt: 'Sagano', at: [135.675, 35.012] },
    { id: 'northwest', name: 'North-west Kyoto', town: 'Kinkaku-ji', alt: 'Kinkaku-ji', at: [135.73, 35.04] },
    { id: 'n-higashiyama', name: 'Northern Higashiyama', town: 'Philosopher\'s Path', alt: 'Philosopher\'s Path', at: [135.795, 35.02] },
    { id: 'fushimi', name: 'Fushimi', town: 'Fushimi', alt: 'Fushimi and Daigo', at: [135.775, 34.968] },
    { id: 'ohara-kurama', name: 'Ohara and Kurama', town: 'Kurama and Kibune', alt: 'Northern hills', at: [135.79, 35.13] },
    { id: 'uji', name: 'Uji', town: 'Uji', alt: 'Tea country', at: [135.807, 34.889] }
  ],

  places,

  clarify: {
    types: { q: 'How should we shape your time in Kyoto?', options: [T_TEMP, T_FOOD, T_LEAF, T_TEA] },
    duration: {
      q: 'How many days would you like to dedicate to Kyoto?',
      options: [
        { label: 'A considered stay (3–4 days)', days: 4 },
        { label: 'An unhurried week (~7 days)', days: 7 },
        { label: 'A ten-day cultural immersion (~10 days)', days: 10 }
      ]
    },
    dates: { q: 'Select your travel dates for Kyoto so I can verify ryokan availability and seasonal foliage timing.' },
    base: {
      q: 'For this {type} journey, which quarter or sanctuary should anchor your stay?',
      options: ['Historic Gion & Higashiyama, walkable to morning temples', 'Central Kamogawa riverfront & market quarters', 'Secluded Arashiyama ryokan on the wooded hills']
    }
  },

  stays: {
    query: 'boutique hotels and ryokan in Kyoto Japan',
    found: 27,
    ids: ['ritz-carlton-kyoto', 'sowaka', 'hoshinoya-kyoto', 'yoshida-sanso', 'the-thousand-kyoto', 'hyatt-regency-kyoto', 'aman-kyoto'],
    byBase: {
      'Gion and Higashiyama, walkable to temples': 'sowaka',
      'Historic Gion & Higashiyama, walkable to morning temples': 'sowaka',
      'Central Kyoto, near markets and the river': 'ritz-carlton-kyoto',
      'Central Kamogawa riverfront & market quarters': 'ritz-carlton-kyoto',
      'Quiet Arashiyama or a ryokan on the hills': 'hoshinoya-kyoto',
      'Secluded Arashiyama ryokan on the wooded hills': 'hoshinoya-kyoto'
    }
  },

  extras: {
    food: ['honke-owariya', 'omen-ginkakuji', 'yoshimura-arashiyama', 'nakamura-tokichi', 'kikunoi-honten'],
    nightlife: ['pontocho-alley', 'bar-k6', 'rocking-chair-bar'],
    relaxedDrop: 1
  },

  suggestions: ['Curate seasonal kaiseki & hidden soba counters', 'Add twilight temple walks & lantern-lit alleys', 'Pace the days more leisurely'],

  replies: {
    planIntro: {
      [T_TEMP]: "I'll curate your days around historic temple sanctuaries and quiet moss gardens, anchored by one quarter a day so the city unfolds at an unhurried walking pace.",
      'Temples and gardens': "I'll curate your days around historic temple sanctuaries and quiet moss gardens, anchored by one quarter a day so the city unfolds at an unhurried walking pace.",
      [T_FOOD]: "I'll pair morning market discoveries and quiet tea counters with celebrated soba and kaiseki tables, letting the culinary rhythm guide each day.",
      'Food and markets': "I'll pair morning market discoveries and quiet tea counters with celebrated soba and kaiseki tables, letting the culinary rhythm guide each day.",
      [T_LEAF]: "I'll track the seasonal maple colors from eastern foothills to temple gardens, timing visits to catch early morning light and illuminated twilight gardens.",
      'Autumn leaves': "I'll track the seasonal maple colors from eastern foothills to temple gardens, timing visits to catch early morning light and illuminated twilight gardens.",
      [T_TEA]: "I'll keep the journey contemplative and slow: artisanal ceramics studios, private tea pavilions, and quiet courtyard ryokan.",
      'Slow tea and craft': "I'll keep the journey contemplative and slow: artisanal ceramics studios, private tea pavilions, and quiet courtyard ryokan."
    },
    planDone: 'Here is your **{days}-day** Kyoto plan for {month}. I kept each day to one area, since Kyoto\'s sights are spread out and buses are slow at busy times.\n\nAutumn colour generally peaks from mid-November to early December, and the most famous temples are busiest then, so I have put them first thing in the morning. If {month} falls earlier or later in the season, tell me and I will shift the order.',
    staysIntro: 'I\'ll choose a walkable, calm base with easy access to the temples and the river, then add a couple of well-chosen local meals without overpacking your days.',
    staysDone: 'Your Kyoto plan is now dated **{range}**.\n\nI added **{stay}** as your base, plus two meals that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. The rest of the plan stays intentionally relaxed, with short hops between areas.',
    reserve: 'I can\'t reserve or pay for anything in this planner. Use the itinerary to contact restaurants and ryokan directly, and confirm current prices and availability before booking.',
    relaxed: 'I\'ve removed the busiest stop from each day. Kyoto\'s gardens and shrines reward unhurried stillness, giving you time to linger on wooden verandas.',
    food: 'I curated exceptional Kyoto tables near your stay and route—centuries-old soba houses, dashi masters, and tranquil machiya dining rooms.',
    nightlife: 'Kyoto evenings are intimate and quiet: lantern-lit canal walks, hidden cocktail salons, and riverfront verandas.',
    fallback: 'I can help you plan Kyoto: adjust days, add a temple, meal or onsen, or reorder the route. Tell me what you would like to change.'
  },

  deep: {
    steps: ['Reading the brief', 'Searching sources', 'Comparing bases and foliage timing', 'Checking availability', 'Writing the plan'],
    sources: [
      { title: 'Kyoto City Official Travel Guide', domain: 'kyoto.travel', note: 'Official sightseeing information and event calendar' },
      { title: 'Kyoto: destination overview', domain: 'japan.travel', note: 'National tourism board notes on the city and its areas' },
      { title: 'Kyoto travel guide', domain: 'lonelyplanet.com', note: 'Route ideas and area summaries' },
      { title: 'Kyoto: autumn leaves and where to see them', domain: 'japan-guide.com', note: 'Foliage forecast, timing and crowd notes' },
      { title: 'The best things to do in Kyoto', domain: 'timeout.com', note: 'Recent recommendations and new openings' },
      { title: 'How to spend a week in Kyoto', domain: 'cntraveller.com', note: 'Pacing and hotel picks' },
      { title: 'Kyoto', domain: 'en.wikivoyage.org', note: 'Districts, transport and practical notes' },
      { title: 'Things to do in Kyoto: traveller reviews', domain: 'tripadvisor.com', note: 'Review patterns for temples, food and stays' },
      { title: 'Autumn foliage forecast', domain: 'jma.go.jp', note: 'Japan Meteorological Agency notes on weather and seasons' },
      { title: 'Getting around Kyoto: trains and buses', domain: 'navitime.co.jp', note: 'Rail and bus timings between districts' },
      { title: 'Japan Rail Pass and regional passes', domain: 'japanrailpass.net', note: 'Pass options for trains from Osaka and Tokyo' },
      { title: 'A quiet autumn in Kyoto', domain: 'theguardian.com', note: 'First-hand notes on avoiding the crowds' }
    ],
    lines: [
      'Read kyoto.travel: autumn illumination calendar',
      'Searched "Kyoto autumn foliage peak dates by temple"',
      'Read japan-guide.com: crowd-avoidance notes for Tofuku-ji and Arashiyama',
      'Compared Gion, Central Kyoto and Arashiyama as bases',
      'Read navitime.co.jp: bus and rail times between districts',
      'Read cntraveller.com: ryokan and boutique hotels',
      'Searched "Eikan-do night opening booking"',
      'Read timeout.com: recent restaurant openings',
      'Checked jma.go.jp: typical November temperatures',
      'Compared four candidate bases and their walking distance to temples'
    ],
    report: {
      title: 'Kyoto in autumn: where to base yourself and how to pace it',
      summary: 'Kyoto\'s autumn colour generally peaks from mid-November to early December, and the best temples are packed at midday [1][4]. Choose a base that lets you reach the big sights at opening time, and keep each day to one area [3][7].',
      sections: [
        { h: 'When to go', body: 'Foliage usually reaches its best in the last two weeks of November, a little earlier in the northern hills and later in the city centre [4][9]. Temperatures are pleasant by day and cool by evening. Weekends are very crowded, so weekdays and early mornings are much better [4][12].' },
        { h: 'Choosing a base', body: 'Gion and Higashiyama are the most walkable for temples and evening lanes [3][6]. Central Kyoto is best for markets, restaurants and the river, with easy trains and buses [7][10]. Arashiyama is quiet after the day-trippers leave, though it is a little far from the rest [3][6].' },
        { h: 'Pacing the days', body: 'Keep each day to one area and start early: Tofuku-ji, Kiyomizu-dera and Arashiyama are busiest by mid-morning [4][12]. Evening illuminations at Eikan-do and Kodai-ji often need advance booking [1][4]. Buses are slow when it is busy, so trains and walking are usually faster [10].' },
        { h: 'Day trips and getting in', body: 'Uji (tea and the Phoenix Hall) and Fushimi are short train rides from the centre; Nara is a separate day trip that sits outside this planner\'s map [2][7]. Most visitors from India connect through a hub on the way to Kansai International (KIX) or Itami (ITM), then take the Haruka limited express to Kyoto Station, which is generally quoted at about 75 minutes [2][10]. Check schedules and fares with the airline and rail operator for your dates.' },
        { h: 'Food and reservations', body: 'The best kaiseki and ryokan dinners book out weeks ahead in November [1][5]. Markets and casual soba or udon shops are easier, but expect queues at lunchtime [5][8]. Ask your hotel to reserve the important meals, and keep one flexible evening [6].' }
      ],
      table: {
        caption: 'Choosing a base',
        cols: ['Base', 'Feel', 'Best for', 'Temples', 'To Kyoto Station'],
        rows: [
          ['Gion and Higashiyama', 'Old lanes, wood houses', 'Temples on foot, evening walks', 'Kiyomizu-dera and Kodai-ji nearby', 'Bus or taxi, 15 minutes'],
          ['Central Kyoto', 'Busy, practical, near the river', 'Markets, food and easy transport', 'Nijo Castle and the Palace', 'Subway, 10 minutes'],
          ['Arashiyama', 'Quiet, riverside, green', 'Bamboo, gardens and slow mornings', 'Tenryu-ji and Okochi Sanso', 'Train, 20 minutes'],
          ['Northern hills ryokan', 'Secluded, traditional', 'Quiet stays and gardens', 'Ginkaku-ji and Nanzen-ji', 'Bus or taxi, 25 minutes']
        ]
      }
    }
  }
};
