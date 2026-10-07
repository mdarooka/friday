'use strict';
// Kerala: backwaters, hills and coast. Sample data for Friday's scripted planner preview.
const P = (name, kind, label, rating, reviews, price, area, at, blurb, scene, tone) =>
  ({ name, kind, label, rating, reviews, price, area, at, blurb, scene, tone });

module.exports = {
  id: 'kerala',
  name: 'Kerala',
  tripTitle: 'Kerala Backwaters Journey',
  threadTitle: 'Plan Kerala Trip',
  match: ['kerala', 'kochi', 'cochin', 'munnar', 'alleppey', 'alappuzha', 'kumarakom', 'thekkady', 'varkala', 'kovalam', 'trivandrum', 'thiruvananthapuram', 'backwater', 'houseboat'],
  currency: '₹',
  region: 'Central Kerala',
  scene: 'isles',
  tone: 'jade',
  card: { caption: 'Kerala', scene: 'isles', tone: 'jade' },
  prompt: 'Plan a trip to Kerala',

  map: {
    bounds: [75.95, 8.30, 77.35, 10.30],
    land: [
      // Mainland: north coast, Kochi harbour, the eastern shore of Vembanad Lake, the south coast and all the hills inland
      [
        [77.80, 10.70], [75.98, 10.70], [75.985, 10.60], [76.020, 10.500], [76.055, 10.400], [76.090, 10.340], [76.123, 10.300],
        [76.150, 10.250], [76.165, 10.210], [76.175, 10.180], [76.185, 10.150], [76.195, 10.120], [76.215, 10.070], [76.230, 10.020],
        [76.232, 9.990], [76.245, 9.981], [76.262, 9.982], [76.275, 9.983], [76.282, 9.975], [76.281, 9.960], [76.283, 9.945],
        [76.290, 9.938], [76.305, 9.935], [76.325, 9.905], [76.350, 9.870], [76.375, 9.820], [76.395, 9.760], [76.410, 9.700],
        [76.418, 9.650], [76.422, 9.620], [76.420, 9.580], [76.415, 9.540], [76.405, 9.500], [76.400, 9.450], [76.405, 9.400],
        [76.420, 9.350], [76.440, 9.300], [76.450, 9.250], [76.455, 9.200], [76.458, 9.150], [76.440, 9.120], [76.480, 9.050],
        [76.530, 8.960], [76.570, 8.900], [76.585, 8.885], [76.620, 8.850], [76.660, 8.790], [76.700, 8.735], [76.730, 8.700],
        [76.760, 8.660], [76.800, 8.610], [76.850, 8.560], [76.890, 8.510], [76.915, 8.475], [76.950, 8.430], [76.975, 8.400],
        [76.990, 8.375], [77.010, 8.350], [77.050, 8.320], [77.100, 8.290], [77.150, 8.200], [77.80, 8.20]
      ],
      // The long coastal strip between the Arabian Sea and the backwaters (Fort Kochi to Kayamkulam)
      [
        [76.236, 9.968], [76.240, 9.972], [76.250, 9.972], [76.262, 9.962], [76.268, 9.940], [76.280, 9.900], [76.295, 9.850],
        [76.310, 9.800], [76.320, 9.750], [76.330, 9.700], [76.335, 9.650], [76.335, 9.600], [76.338, 9.560], [76.343, 9.520],
        [76.341, 9.490], [76.345, 9.450], [76.360, 9.390], [76.385, 9.320], [76.410, 9.250], [76.437, 9.190], [76.470, 9.140],
        [76.475, 9.090], [76.440, 9.120], [76.415, 9.170], [76.395, 9.230], [76.370, 9.310], [76.340, 9.400], [76.325, 9.450],
        [76.312, 9.500], [76.303, 9.550], [76.298, 9.600], [76.295, 9.650], [76.290, 9.700], [76.280, 9.740], [76.268, 9.780],
        [76.257, 9.830], [76.250, 9.880], [76.243, 9.930]
      ]
    ],
    water: [
      [[77.15, 9.58], [77.10, 9.75], [76.97, 9.85], [76.85, 9.95], [76.75, 10.10], [76.60, 10.16], [76.45, 10.15], [76.35, 10.11], [76.27, 10.16], [76.20, 10.22], [76.178, 10.185]],   // Periyar
      [[77.00, 9.40], [76.85, 9.35], [76.70, 9.35], [76.55, 9.38], [76.45, 9.40], [76.41, 9.40]],                                              // Pamba
      [[76.85, 9.65], [76.70, 9.65], [76.55, 9.60], [76.43, 9.625]],                                                                           // Meenachil
      [[76.65, 9.90], [76.55, 9.85], [76.45, 9.78], [76.40, 9.76]],                                                                            // Muvattupuzha
      [[76.455, 9.150], [76.500, 9.050], [76.540, 8.980], [76.600, 8.950], [76.590, 8.900], [76.575, 8.890]],                                  // backwater route to Ashtamudi
      [[76.395, 9.700], [76.385, 9.650], [76.380, 9.600], [76.370, 9.560]],                                                                    // Thanneermukkom channels
      [[77.14, 9.56], [77.17, 9.57], [77.19, 9.60], [77.16, 9.615], [77.14, 9.59], [77.14, 9.56]]                                               // Periyar Lake
    ],
    parks: [
      [[77.06, 9.40], [77.30, 9.35], [77.35, 9.62], [77.20, 9.66], [77.08, 9.58]],
      [[77.00, 10.12], [77.12, 10.12], [77.13, 10.25], [77.02, 10.27], [76.98, 10.18]],
      [[77.15, 10.30], [77.35, 10.30], [77.35, 10.45], [77.15, 10.40]],
      [[77.12, 8.50], [77.20, 8.50], [77.22, 8.62], [77.12, 8.62]]
    ],
    roads: [
      { ref: '66', path: [[76.19, 10.23], [76.21, 10.12], [76.26, 10.00], [76.29, 9.97], [76.31, 9.93], [76.275, 9.86], [76.30, 9.75], [76.31, 9.68], [76.32, 9.60], [76.326, 9.50], [76.35, 9.40], [76.38, 9.30], [76.418, 9.20], [76.47, 9.12], [76.55, 9.00], [76.60, 8.89], [76.70, 8.78], [76.82, 8.68], [76.93, 8.53], [76.97, 8.44]] },
      { ref: '85', path: [[76.30, 10.00], [76.45, 10.05], [76.63, 10.06], [76.80, 10.04], [76.96, 10.01], [77.06, 10.09], [77.20, 10.13]] },
      { ref: '183', path: [[76.60, 8.89], [76.55, 9.10], [76.52, 9.35], [76.52, 9.59], [76.65, 9.55], [76.80, 9.53], [76.98, 9.55], [77.16, 9.60]] }
    ],
    labels: [
      { t: 'Arabian Sea', at: [76.03, 9.30], kind: 'region' },
      { t: 'Vembanad Lake', at: [76.36, 9.78], kind: 'region' },
      { t: 'Western Ghats', at: [77.24, 9.90], kind: 'region' },
      { t: 'Kochi', at: [76.30, 10.02], kind: 'town' },
      { t: 'Alappuzha', at: [76.36, 9.475], kind: 'town' },
      { t: 'Kottayam', at: [76.53, 9.585], kind: 'town' },
      { t: 'Munnar', at: [77.075, 10.075], kind: 'town' },
      { t: 'Thekkady', at: [77.18, 9.62], kind: 'town' },
      { t: 'Kollam', at: [76.61, 8.87], kind: 'town' },
      { t: 'Varkala', at: [76.73, 8.75], kind: 'town' },
      { t: 'Thiruvananthapuram', at: [76.97, 8.53], kind: 'town' },
      { t: 'Kovalam', at: [77.00, 8.42], kind: 'town' },
      { t: 'Periyar Tiger Reserve', at: [77.18, 9.47], kind: 'park' },
      { t: 'Eravikulam', at: [77.05, 10.21], kind: 'park' }
    ]
  },

  areas: [
    { id: 'kochi', name: 'Kochi', town: 'Fort Kochi', alt: 'Fort Kochi', at: [76.262, 9.970] },
    { id: 'munnar', name: 'Munnar', town: 'Munnar', alt: 'Tea hills', at: [77.060, 10.089] },
    { id: 'thekkady', name: 'Thekkady', town: 'Thekkady', alt: 'Periyar', at: [77.160, 9.600] },
    { id: 'kumarakom', name: 'Kumarakom', town: 'Kumarakom', alt: 'Vembanad Lake', at: [76.430, 9.618] },
    { id: 'alleppey', name: 'Alleppey', town: 'Alleppey', alt: 'Alappuzha', at: [76.335, 9.498] },
    { id: 'varkala', name: 'Varkala', town: 'Varkala', alt: 'Cliff beaches', at: [76.706, 8.734] },
    { id: 'kovalam', name: 'Kovalam', town: 'Kovalam', alt: 'Thiruvananthapuram', at: [76.960, 8.450] }
  ],

  places: {
    // Kochi
    'fort-kochi': P('Fort Kochi', 'neighborhood', 'Neighborhood', null, null, null, 'kochi', [76.245, 9.9655], 'A walkable colonial quarter of Portuguese, Dutch and British houses, galleries and cafés.', 'city', 'sand'),
    'chinese-fishing-nets': P('Chinese Fishing Nets', 'sight', 'Tourist Attraction', 4.3, 21000, null, 'kochi', [76.2415, 9.9685], 'Cantilevered fishing nets along the shore; best at low tide and at sunset.', 'sea', 'ember'),
    'st-francis-church': P("St. Francis Church", 'church', 'Historical Landmark', 4.3, 7400, null, 'kochi', [76.2425, 9.964], "One of India's oldest European churches, where Vasco da Gama was first buried.", 'city', 'ice'),
    'santa-cruz-basilica': P('Santa Cruz Basilica', 'church', 'Historical Landmark', 4.5, 9200, null, 'kochi', [76.2438, 9.9652], 'A pale-pink Gothic basilica with a painted ceiling.', 'city', 'rose'),
    'mattancherry-palace': P('Mattancherry Palace (Dutch Palace)', 'museum', 'Museum', 4.2, 6400, null, 'kochi', [76.259, 9.958], 'Portuguese-built royal palace with rare Kerala murals inside.', 'city', 'plum'),
    'jew-town-spice-market': P('Jew Town Spice Market', 'market', 'Market', 4.2, 5100, null, 'kochi', [76.258, 9.9565], 'Warehouses of ginger, pepper and cardamom beside the Paradesi Synagogue.', 'city', 'sand'),
    'kashi-art-cafe': P('Kashi Art Café', 'food', 'Cafe', 4.4, 5900, null, 'kochi', [76.244, 9.9645], 'A small gallery café with good coffee and cake in Fort Kochi.', 'city', 'jade'),
    'kayees-rahmathulla-cafe': P('Kayees Rahmathulla Café', 'food', 'Restaurant', 4.5, 4800, null, 'kochi', [76.2585, 9.9575], "Mattancherry's famous biryani; go at lunch before it sells out.", 'city', 'ember'),
    'kathakali-centre': P('Kerala Kathakali Centre', 'sight', 'Performance Theatre', 4.4, 2900, null, 'kochi', [76.2425, 9.962], 'Watch the make-up before the show, then a short Kathakali performance.', 'aurora', 'plum'),
    'kerala-folklore-museum': P('Kerala Folklore Museum', 'museum', 'Museum', 4.3, 1400, null, 'kochi', [76.298, 9.942], 'A private museum in a temple-style building with masks, murals and puppets.', 'city', 'slate'),
    'marine-drive-kochi': P('Marine Drive Walkway', 'sight', 'Tourist Attraction', 4.4, 12800, null, 'kochi', [76.285, 9.976], "Kochi's waterfront promenade; walk it in late afternoon.", 'sea', 'indigo'),
    'brunton-boatyard': P('Brunton Boatyard', 'stay', 'Hotel', 4.6, 1500, 21000, 'kochi', [76.2445, 9.967], 'A heritage harbour hotel in Fort Kochi with a quiet waterfront terrace.', 'sea', 'cobalt'),
    'old-harbour-hotel': P('Old Harbour Hotel', 'stay', 'Boutique Hotel', 4.5, 1120, 12500, 'kochi', [76.2438, 9.963], 'A restored Dutch bungalow with a courtyard pool, in the middle of Fort Kochi.', 'city', 'plum'),
    // Munnar
    'kanan-devan-tea-museum': P('Kanan Devan Tea Museum', 'museum', 'Museum', 4.3, 6100, null, 'munnar', [77.070, 10.087], 'The story of Munnar tea, with old machinery and a tasting.', 'terraces', 'moss'),
    'eravikulam-national-park': P('Eravikulam National Park', 'nature', 'National Park', 4.5, 11000, null, 'munnar', [77.05, 10.165], 'Grassy hills with Nilgiri tahr; book the entry slot ahead.', 'peaks', 'jade'),
    'mattupetty-dam': P('Mattupetty Dam', 'nature', 'Tourist Attraction', 4.2, 12200, null, 'munnar', [77.124, 10.106], 'A high-altitude lake with a tea-lined shore.', 'peaks', 'ice'),
    'top-station': P('Top Station', 'sight', 'Viewpoint', 4.3, 9600, null, 'munnar', [77.225, 10.126], 'The highest point on the Munnar road, with far views over Tamil Nadu.', 'peaks', 'slate'),
    'kolukkumalai-tea-estate': P('Kolukkumalai Tea Estate', 'nature', 'Tea Estate', 4.6, 8200, null, 'munnar', [77.21, 10.06], "One of the world's highest tea estates; go for sunrise.", 'terraces', 'moss'),
    'attukad-waterfalls': P('Attukad Waterfalls', 'nature', 'Tourist Attraction', 4.3, 3800, null, 'munnar', [77.033, 10.047], 'A short walk to a waterfall in a valley of tea.', 'forest', 'jade'),
    'rapsy-restaurant': P('Rapsy Restaurant', 'food', 'Restaurant', 4.2, 5300, null, 'munnar', [77.06, 10.089], 'A long-running Munnar favourite for Kerala parotta and beef fry.', 'city', 'ember'),
    'windermere-estate': P('Windermere Estate', 'stay', 'Hotel', 4.6, 1600, 16000, 'munnar', [77.07, 10.06], 'A cardamom-estate retreat with broad views across the valley.', 'terraces', 'moss'),
    // Thekkady
    'periyar-boat-ride': P('Periyar Lake Boat Ride', 'nature', 'Tourist Attraction', 4.4, 14900, null, 'thekkady', [77.15, 9.575], 'A slow boat trip on the lake; go at the first departure for the best chance of wildlife.', 'forest', 'jade'),
    'abrahams-spice-garden': P("Abraham's Spice Garden", 'nature', 'Spice Plantation', 4.4, 3800, null, 'thekkady', [77.169, 9.604], 'A guided walk past pepper vines, cardamom and vanilla.', 'forest', 'moss'),
    'kadathanadan-kalari': P('Kadathanadan Kalari Centre', 'sight', 'Performance Theatre', 4.5, 6100, null, 'thekkady', [77.169, 9.601], 'An evening demonstration of Kalaripayattu, the martial art of Kerala.', 'aurora', 'ember'),
    'kumily-spice-market': P('Kumily Spice Market', 'market', 'Market', 4.0, 2100, null, 'thekkady', [77.174, 9.605], 'Cardamom, pepper, tea and cinnamon sold from the main street.', 'city', 'sand'),
    'spice-village': P('Spice Village', 'stay', 'Hotel', 4.5, 1500, 17500, 'thekkady', [77.16, 9.606], 'Thatched cottages set in gardens beside the Periyar reserve.', 'forest', 'moss'),
    // Alleppey
    'alleppey-backwater-cruise': P('Alleppey Backwater Houseboat Cruise', 'nature', 'Tourist Attraction', 4.5, 9700, null, 'alleppey', [76.335, 9.493], 'A slow day on a kettuvallam, gliding past paddy fields and villages.', 'isles', 'jade'),
    'alappuzha-beach': P('Alappuzha Beach', 'beach', 'Beach', 4.2, 9300, null, 'alleppey', [76.3195, 9.499], 'A broad beach with an old pier; come at sunset.', 'sea', 'sand'),
    'marari-beach': P('Marari Beach', 'beach', 'Beach', 4.5, 3200, null, 'alleppey', [76.304, 9.601], 'A quiet fishing-village beach with almost no crowds.', 'sea', 'ice'),
    'alleppey-lighthouse': P('Alleppey Lighthouse', 'sight', 'Historical Landmark', 4.2, 5600, null, 'alleppey', [76.319, 9.4885], 'Climb the 1862 lighthouse for a view of the coast and the canals.', 'sea', 'ember'),
    'harbour-restaurant': P('Harbour Restaurant', 'food', 'Restaurant', 4.1, 3800, null, 'alleppey', [76.334, 9.490], 'Kerala fish curry and karimeen beside the canal.', 'city', 'sand'),
    'marari-beach-resort': P('Marari Beach Resort', 'stay', 'Hotel', 4.6, 1500, 26000, 'alleppey', [76.306, 9.606], 'Villa-style cottages among coconut palms, a few steps from the sand.', 'sea', 'jade'),
    // Kumarakom
    'kumarakom-bird-sanctuary': P('Kumarakom Bird Sanctuary', 'nature', 'Bird Sanctuary', 4.2, 6100, null, 'kumarakom', [76.429, 9.621], 'Wetlands where herons, egrets and migratory ducks gather; go early.', 'forest', 'moss'),
    'kumarakom-sunset-cruise': P('Vembanad Lake Sunset Cruise', 'nature', 'Tourist Attraction', 4.5, 2100, null, 'kumarakom', [76.428, 9.618], 'A small boat on the lake at golden hour, with a stop at a toddy shop.', 'isles', 'indigo'),
    'ayurveda-spa-kumarakom': P('Ayurveda Spa, Kumarakom Lake Resort', 'wellness', 'Ayurveda Spa', 4.6, 900, null, 'kumarakom', [76.431, 9.614], 'A traditional treatment beside the water, with a physician consult.', 'forest', 'jade'),
    'kumarakom-lake-resort': P('Kumarakom Lake Resort', 'stay', 'Hotel', 4.6, 2400, 24000, 'kumarakom', [76.430, 9.615], 'Heritage-style villas set on the shore of Vembanad Lake.', 'isles', 'cobalt'),
    // Varkala
    'varkala-cliff': P('Varkala Cliff', 'sight', 'Tourist Attraction', 4.5, 15600, null, 'varkala', [76.7065, 8.7365], 'A rare red cliff above the sea, lined with cafés and views.', 'sea', 'ember'),
    'papanasam-beach': P('Papanasam Beach', 'beach', 'Beach', 4.4, 9800, null, 'varkala', [76.709, 8.73], 'A sacred beach at the base of the cliff; go early for the calm water.', 'sea', 'sand'),
    'janardhana-swamy-temple': P('Janardhana Swamy Temple', 'sight', 'Hindu Temple', 4.4, 3900, null, 'varkala', [76.715, 8.734], 'A 2,000-year-old Vishnu temple near the beach.', 'city', 'ice'),
    'clafouti-beach-cafe': P('Clafouti Beach Café', 'food', 'Cafe', 4.3, 2700, null, 'varkala', [76.7075, 8.7385], 'Cliff-top café for fresh bread, seafood and breakfast.', 'sea', 'rose'),
    'cafe-del-mar-varkala': P('Café del Mar Varkala', 'nightlife', 'Bar', 4.2, 3100, null, 'varkala', [76.706, 8.732], 'A relaxed clifftop place for sunset drinks and live music.', 'aurora', 'plum'),
    'villa-jacaranda': P('Villa Jacaranda', 'stay', 'Boutique Hotel', 4.6, 780, 8800, 'varkala', [76.7095, 8.7375], 'A small guesthouse a short walk from the cliff path.', 'forest', 'jade'),
    // Kovalam and Thiruvananthapuram
    'kovalam-beach': P('Lighthouse Beach, Kovalam', 'beach', 'Beach', 4.4, 18500, null, 'kovalam', [76.981, 8.399], "Kovalam's most popular crescent, with calm swimming water.", 'sea', 'cobalt'),
    'vizhinjam-lighthouse': P('Vizhinjam Lighthouse', 'sight', 'Historical Landmark', 4.3, 8900, null, 'kovalam', [76.989, 8.384], 'A striped lighthouse on the headland; climb for a view of the coast.', 'sea', 'ember'),
    'shanghumugham-beach': P('Shanghumugham Beach', 'beach', 'Beach', 4.4, 8600, null, 'kovalam', [76.921, 8.478], 'A city beach near the airport, best at sunset.', 'sea', 'sand'),
    'padmanabhaswamy-temple': P('Padmanabhaswamy Temple', 'sight', 'Hindu Temple', 4.7, 42000, null, 'kovalam', [76.944, 8.483], 'A grand temple that non-Hindus can view only from outside; dress modestly.', 'city', 'ice'),
    'napier-museum': P('Napier Museum', 'museum', 'Museum', 4.2, 3400, null, 'kovalam', [76.955, 8.509], 'An Indo-Saracenic gallery of bronzes and carved wood.', 'city', 'rose'),
    'chalai-market': P('Chalai Market', 'market', 'Market', 4.0, 2400, null, 'kovalam', [76.942, 8.482], 'A busy old bazaar for spices, banana chips and kasavu sarees.', 'city', 'sand'),
    'somatheeram-ayurveda': P('Somatheeram Ayurveda Village', 'wellness', 'Ayurveda Resort', 4.6, 3300, null, 'kovalam', [77.005, 8.362], 'A cliffside Ayurvedic resort with seven- and fourteen-day programmes.', 'forest', 'moss'),
    'leela-kovalam': P('The Leela Kovalam', 'stay', 'Hotel', 4.5, 4300, 32000, 'kovalam', [76.993, 8.382], 'A cliff-top resort with terraces over the Arabian Sea.', 'sea', 'jade')
  },

  clarify: {
    types: { q: 'How should we shape your time in Kerala?', options: ['Backwaters, lagoons & quiet beaches', 'Tea estates, mist & wildlife', 'Spice tables & colonial heritage', 'Ayurveda, yoga & wellness sanctuaries'] },
    duration: { q: 'How many days would you like to dedicate to Kerala?', options: [{ label: 'A considered escape (4–5 days)', days: 5 }, { label: 'An unhurried week (~7 days)', days: 7 }, { label: 'A grand southern loop (~14 days)', days: 14 }] },
    dates: { q: 'Select your travel dates for Kerala so I can check backwater retreats and coastal availability.' },
    base: { q: 'For this {type} journey, which sanctuary should anchor your stay?', options: ['Heritage courtyard in Fort Kochi', 'Lakeside sanctuary on the backwaters', 'Cliffside coastal retreat in Varkala'] }
  },

  stays: {
    query: 'boutique hotels in Kerala India',
    found: 23,
    ids: ['old-harbour-hotel', 'brunton-boatyard', 'windermere-estate', 'spice-village', 'marari-beach-resort', 'kumarakom-lake-resort', 'villa-jacaranda', 'leela-kovalam'],
    byBase: {
      'Heritage quarter in Fort Kochi': 'old-harbour-hotel',
      'Heritage courtyard in Fort Kochi': 'old-harbour-hotel',
      'Lakeside resort on the backwaters': 'kumarakom-lake-resort',
      'Lakeside sanctuary on the backwaters': 'kumarakom-lake-resort',
      'Cliff-top beach town in Varkala': 'villa-jacaranda',
      'Cliffside coastal retreat in Varkala': 'villa-jacaranda'
    }
  },

  extras: {
    food: ['kashi-art-cafe', 'kayees-rahmathulla-cafe', 'harbour-restaurant', 'clafouti-beach-cafe', 'rapsy-restaurant'],
    nightlife: ['kathakali-centre', 'cafe-del-mar-varkala', 'kadathanadan-kalari'],
    relaxedDrop: 1
  },

  suggestions: ['Curate backwater dining & coastal tables', 'Add sunset kathakali or tea tastings', 'Pace the days more leisurely'],

  replies: {
    planIntro: {
      'Backwaters and beaches': "I'll build this around slow water days, with Fort Kochi at the start and quiet beaches at the end, keeping each transfer short.",
      'Backwaters, lagoons & quiet beaches': "I'll compose this around gentle waterways and quiet shores: morning canoe glides, shaded backwater verandahs, and secluded sands.",
      'Tea hills and wildlife': "I'll pair the tea hills of Munnar with Periyar and a lakeside rest, keeping the mountain drives to one a day.",
      'Tea estates, mist & wildlife': "I'll thread together high tea plantations, forest mist, and quiet lake sanctuaries, pacing drives so afternoons remain open.",
      'Food and heritage': "I'll thread Kerala's kitchens through the heritage quarters, with one long meal and one landmark a day.",
      'Spice tables & colonial heritage': "I'll pair spice-warehouse courtyards with coastal Malabar tables, lingering over slow lunches and storied architecture.",
      'Ayurveda and wellness': "I'll keep the days unhurried, with a treatment in the middle of each day and short, gentle outings around it.",
      'Ayurveda, yoga & wellness sanctuaries': "I'll shape a restorative rhythm around traditional Ayurvedic therapies, silent backwater dawns, and grounding meals."
    },
    planDone: "Here's a {days}-day Kerala plan for {month}, with each day built around one area so the road time stays short.\n\nI kept the pace relaxed, with **two or three stops a day** and time for a long lunch in between. Tell me your dates and I'll add a hotel and a few places to eat that fit the route.",
    staysIntro: "I'll pick a characterful base that suits the route and keeps the drives short, then add a few good places to eat so the days are not overpacked.",
    staysDone: 'Your Kerala plan is now dated **{range}**.\n\nI added **{stay}** as a comfortable base, plus two restaurant stops that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. The rest of the plan stays intentionally relaxed, with road time kept sensible between areas.',
    reserve: "I can't make reservations or book from this planner. Use the itinerary to contact houseboats, drivers and transfer providers directly, and confirm current prices and availability before you book.",
    relaxed: "I've lightened each day by removing the busiest stop, leaving generous room for a long lunch, quiet verandahs, and restful afternoons.",
    food: 'I curated exceptional regional tables along your route, focusing on coastal seafood, Appam breakfasts, and spice-scented backwater lunches.',
    nightlife: 'I added twilight cultural performances and cliffside tea verandahs, positioned close to your base for effortless evenings.',
    fallback: 'I can curate backwater sanctuaries, add celebrated local tables, or soften the itinerary pace. Tell me how you’d like to adjust it.'
  },

  deep: {
    steps: ['Reading the brief', 'Searching sources', 'Comparing bases and seasons', 'Checking availability', 'Writing the plan'],
    sources: [
      { title: 'Kerala Tourism: destinations and seasons', domain: 'keralatourism.org', note: 'Official guide to regions, seasons and festivals.' },
      { title: 'Kerala travel guide', domain: 'lonelyplanet.com', note: 'Overview of the backwaters, hill stations and coast.' },
      { title: 'Best backwater stays in Kerala', domain: 'cntraveller.in', note: 'Editor picks in Kumarakom and Alleppey.' },
      { title: 'Things to do in Munnar', domain: 'tripadvisor.in', note: 'Traveller-reviewed tea estates and viewpoints.' },
      { title: 'Climate of Kerala: monthly normals', domain: 'mausam.imd.gov.in', note: 'January temperatures and rainfall.' },
      { title: 'Houseboat rules on Vembanad Lake', domain: 'thehindu.com', note: 'Licensing and how many boats are allowed on the lake.' },
      { title: 'Fort Kochi walking guide', domain: 'roughguides.com', note: 'A route through the old quarter and Mattancherry.' },
      { title: 'Periyar Tiger Reserve: visitor information', domain: 'periyartigerreserve.org', note: 'Boat timings, permits and seasons.' },
      { title: "Eravikulam National Park: online booking", domain: 'eravikulamnationalpark.in', note: 'Entry slots and visitor limits.' },
      { title: "Kerala's food, region by region", domain: 'theculturetrip.com', note: 'Dishes to try in Kochi, Alleppey and Trivandrum.' },
      { title: 'Ayurveda in Kerala: choosing a centre', domain: 'ayush.gov.in', note: 'Accreditation and what a first treatment involves.' },
      { title: 'Kerala hotel rates by season', domain: 'booking.com', note: 'Nightly rates from December to February.' }
    ],
    lines: [
      'Read keralatourism.org — seasons and festivals, Jan',
      'Read mausam.imd.gov.in — January climate normals for Kerala',
      'Searched "best base for backwaters and beaches in Kerala"',
      'Read lonelyplanet.com — Kerala by region',
      'Read cntraveller.in — backwater stays, Kumarakom to Alleppey',
      'Compared drive times from Kochi to Munnar, Thekkady and Alleppey',
      'Read periyartigerreserve.org — boat timings and permits',
      'Checked booking.com — January rates in Fort Kochi and Kumarakom',
      'Read roughguides.com — Fort Kochi walking route',
      'Drafted a relaxed day-by-day plan with short transfers'
    ],
    report: {
      title: 'Kerala in January: how to combine the backwaters, the hills and the coast',
      summary: 'January is the driest and most comfortable month in Kerala, making it the best time for backwater cruises and hill drives [1][5]. Fly into Kochi, then choose between the tea hills, the lake and the southern beaches rather than trying all three in one short trip [2][7].',
      sections: [
        { h: 'When to go', body: 'From December to February the weather is dry and the days are warm but pleasant [5]. It is also peak season, so book houseboats and hill stays several weeks ahead [12]. The hills are cool, with January nights in Munnar around 10°C [1].' },
        { h: 'Where to base yourself', body: 'Fort Kochi is the natural first stop, with walkable heritage and good food [7]. For backwaters, choose Kumarakom for quiet lake resorts or Alleppey for the classic houseboat route [3][6]. Varkala and Kovalam suit the last few days on the coast [2].' },
        { h: 'How to pace it', body: 'Roads are slower than distances suggest. Kochi to Munnar takes about four hours, and Munnar to Thekkady about four more [4][8]. Keep to one long drive every second day and book the Eravikulam and Periyar slots ahead [8][9].' },
        { h: 'Eating and wellness', body: 'Try karimeen, appam and Malabar biryani, and plan meals around the lake and the market rather than the hotel [10]. If you want Ayurveda, choose a centre with a physician consult, and allow three to five days for it to be worthwhile [11].' }
      ],
      table: {
        caption: 'Choosing a base',
        cols: ['Base', 'Feel', 'Best for', 'Water or beach', 'Drive from Kochi'],
        rows: [
          ['Fort Kochi', 'Heritage, walkable', 'Food, galleries, first nights', 'Harbour', '—'],
          ['Munnar', 'Cool, green, quiet', 'Tea walks and wildlife', 'None', '3.5–4.5 h'],
          ['Alleppey and Kumarakom', 'Slow, watery', 'Houseboats, birds, Ayurveda', 'Backwaters', '1.5–2.5 h'],
          ['Varkala', 'Relaxed, cliff-side', 'Beach days and yoga', 'Cliff beaches', '4–4.5 h']
        ]
      }
    }
  }
};
