'use strict';
// Rajasthan: forts, palaces and desert. Sample data for Friday's scripted planner preview.
// Rajasthan is landlocked: the whole map is land, with lakes drawn as closed rings in `water`.
const P = (name, kind, label, rating, reviews, price, area, at, blurb, scene, tone) =>
  ({ name, kind, label, rating, reviews, price, area, at, blurb, scene, tone });

module.exports = {
  id: 'rajasthan',
  name: 'Rajasthan',
  tripTitle: 'Rajasthan Palaces Journey',
  threadTitle: 'Plan Rajasthan Trip',
  match: ['rajasthan', 'jaipur', 'udaipur', 'jodhpur', 'jaisalmer', 'pushkar', 'ranthambore', 'ajmer', 'thar', 'desert'],
  currency: '₹',
  region: 'Rajasthan',
  scene: 'dunes',
  tone: 'sand',
  card: { caption: 'Rajasthan', scene: 'dunes', tone: 'sand' },
  prompt: 'Plan a trip to Rajasthan',

  map: {
    bounds: [70.3, 23.9, 77.2, 27.6],
    land: [[[69.5, 23.3], [78.0, 23.3], [78.0, 28.5], [69.5, 28.5]]],
    water: [
      [[75.60, 24.70], [75.85, 25.18], [76.30, 25.55], [76.80, 25.95], [77.20, 26.30]],                                  // Chambal
      [[73.50, 25.20], [73.90, 25.50], [74.60, 25.90], [75.30, 26.10], [76.00, 26.05], [76.55, 26.02], [77.20, 26.12]], // Banas
      [[74.55, 26.40], [74.00, 26.20], [73.30, 26.00], [72.50, 25.80], [71.80, 25.20], [71.20, 24.60]],                 // Luni
      [[73.35, 24.80], [73.20, 24.50], [73.10, 24.20], [73.00, 23.90]],                                                 // Sabarmati headwaters
      // Lakes as closed rings
      [[73.674, 24.590], [73.680, 24.588], [73.6815, 24.580], [73.682, 24.570], [73.679, 24.562], [73.672, 24.561], [73.669, 24.568], [73.670, 24.582], [73.674, 24.590]],   // Lake Pichola
      [[73.665, 24.605], [73.678, 24.606], [73.686, 24.600], [73.683, 24.593], [73.672, 24.592], [73.664, 24.596], [73.665, 24.605]],                                       // Fateh Sagar
      [[74.546, 26.493], [74.554, 26.493], [74.557, 26.489], [74.554, 26.485], [74.547, 26.485], [74.544, 26.489], [74.546, 26.493]],                                       // Pushkar Lake
      [[70.904, 26.906], [70.912, 26.907], [70.916, 26.903], [70.912, 26.899], [70.905, 26.900], [70.904, 26.906]],                                                         // Gadisar
      [[75.837, 26.965], [75.856, 26.964], [75.860, 26.952], [75.851, 26.942], [75.839, 26.944], [75.833, 26.956], [75.837, 26.965]],                                       // Man Sagar
      [[74.606, 26.480], [74.620, 26.482], [74.626, 26.476], [74.620, 26.469], [74.608, 26.468], [74.604, 26.474], [74.606, 26.480]],                                       // Ana Sagar
      [[74.85, 26.95], [75.00, 26.99], [75.20, 26.98], [75.22, 26.94], [75.05, 26.88], [74.88, 26.89], [74.85, 26.95]],                                                      // Sambhar Salt Lake
      [[73.97, 24.31], [74.02, 24.30], [74.03, 24.26], [73.99, 24.24], [73.96, 24.27], [73.97, 24.31]],                                                                      // Jaisamand
      [[72.95, 26.29], [72.98, 26.29], [72.98, 26.27], [72.95, 26.27], [72.95, 26.29]]                                                                                       // Kaylana
    ],
    parks: [
      [[76.35, 25.95], [76.55, 25.95], [76.60, 26.10], [76.45, 26.15], [76.35, 26.05]],   // Ranthambore
      [[76.30, 27.20], [76.50, 27.20], [76.50, 27.45], [76.30, 27.40]],                   // Sariska
      [[70.30, 26.30], [71.20, 26.30], [71.30, 27.20], [70.30, 27.50]],                   // Desert National Park
      [[73.45, 25.05], [73.65, 25.05], [73.70, 25.30], [73.50, 25.35], [73.42, 25.20]],   // Kumbhalgarh
      [[72.65, 24.55], [72.80, 24.55], [72.80, 24.68], [72.65, 24.68]]                    // Mount Abu
    ],
    roads: [
      { ref: '48', path: [[76.60, 27.55], [76.15, 27.20], [75.79, 26.91], [75.20, 26.62], [74.64, 26.45], [74.25, 25.70], [73.95, 25.30], [73.71, 24.58]] },
      { ref: '62', path: [[74.64, 26.45], [74.25, 26.10], [73.60, 26.00], [73.32, 25.77], [73.02, 26.29]] },
      { ref: '125', path: [[73.02, 26.29], [72.20, 26.70], [71.50, 26.90], [70.92, 26.92]] },
      { ref: '11', path: [[75.79, 26.91], [75.60, 27.20], [75.15, 27.60]] }
    ],
    labels: [
      { t: 'Thar Desert', at: [71.20, 27.35], kind: 'region' },
      { t: 'Aravalli Range', at: [74.15, 25.45], kind: 'region' },
      { t: 'Mewar', at: [74.30, 24.30], kind: 'region' },
      { t: 'Marwar', at: [72.90, 26.75], kind: 'region' },
      { t: 'Jaipur', at: [75.86, 26.88], kind: 'town' },
      { t: 'Ajmer', at: [74.65, 26.42], kind: 'town' },
      { t: 'Pali', at: [73.34, 25.75], kind: 'town' },
      { t: 'Jodhpur', at: [73.06, 26.24], kind: 'town' },
      { t: 'Jaisalmer', at: [70.95, 26.86], kind: 'town' },
      { t: 'Udaipur', at: [73.74, 24.53], kind: 'town' },
      { t: 'Chittorgarh', at: [74.68, 24.85], kind: 'town' },
      { t: 'Kota', at: [75.88, 25.14], kind: 'town' },
      { t: 'Sawai Madhopur', at: [76.36, 25.99], kind: 'town' },
      { t: 'Ranthambore', at: [76.60, 26.15], kind: 'park' },
      { t: 'Sariska', at: [76.36, 27.32], kind: 'park' },
      { t: 'Desert National Park', at: [70.55, 27.05], kind: 'park' }
    ]
  },

  areas: [
    { id: 'jaipur', name: 'Jaipur', town: 'Jaipur', alt: 'The Pink City', at: [75.82, 26.92] },
    { id: 'ranthambore', name: 'Ranthambore', town: 'Ranthambore', alt: 'Sawai Madhopur', at: [76.48, 26.02] },
    { id: 'pushkar', name: 'Pushkar', town: 'Pushkar', alt: 'Ajmer', at: [74.55, 26.49] },
    { id: 'jodhpur', name: 'Jodhpur', town: 'Jodhpur', alt: 'The Blue City', at: [73.02, 26.29] },
    { id: 'jaisalmer', name: 'Jaisalmer', town: 'Jaisalmer', alt: 'The Golden City', at: [70.91, 26.91] },
    { id: 'udaipur', name: 'Udaipur', town: 'Udaipur', alt: 'City of Lakes', at: [73.68, 24.58] }
  ],

  places: {
    // Jaipur
    'amber-fort': P('Amber Fort', 'sight', 'Historical Landmark', 4.6, 88000, null, 'jaipur', [75.8513, 26.9855], 'A hilltop fort-palace in red sandstone and marble; go at opening to beat the crowds.', 'canyon', 'ember'),
    'panna-meena-ka-kund': P('Panna Meena ka Kund', 'sight', 'Historical Landmark', 4.4, 6100, null, 'jaipur', [75.856, 26.987], 'A geometric 16th-century stepwell below Amber, calm and photogenic.', 'city', 'sand'),
    'anokhi-museum': P('Anokhi Museum of Hand Printing', 'museum', 'Museum', 4.4, 2300, null, 'jaipur', [75.859, 26.985], 'A restored haveli with block-printing demonstrations; try it yourself.', 'city', 'rose'),
    'jal-mahal': P('Jal Mahal', 'sight', 'Historical Landmark', 4.3, 14000, null, 'jaipur', [75.846, 26.953], 'A palace that seems to float on Man Sagar lake; a short photo stop on the road to Amber.', 'city', 'indigo'),
    'city-palace-jaipur': P('City Palace, Jaipur', 'museum', 'Museum', 4.5, 42000, null, 'jaipur', [75.824, 26.9258], 'The royal residence with courtyards, textile galleries and armouries.', 'city', 'plum'),
    'jantar-mantar-jaipur': P('Jantar Mantar', 'sight', 'Historical Landmark', 4.5, 33000, null, 'jaipur', [75.8245, 26.9247], "An 18th-century observatory of giant stone instruments; use an audio guide.", 'city', 'slate'),
    'hawa-mahal': P('Hawa Mahal', 'sight', 'Historical Landmark', 4.4, 92000, null, 'jaipur', [75.8267, 26.9239], 'The pink honeycomb facade; see it from a café across the road in the morning.', 'city', 'rose'),
    'nahargarh-fort': P('Nahargarh Fort', 'sight', 'Historical Landmark', 4.4, 24000, null, 'jaipur', [75.815, 26.937], 'Ramparts above the city; a good place for sunset over the Pink City.', 'canyon', 'ember'),
    'johari-bazaar': P('Johari Bazaar', 'market', 'Market', 4.2, 8100, null, 'jaipur', [75.8265, 26.92], 'Jewellery, textiles and lac bangles in the old Pink City.', 'city', 'sand'),
    'albert-hall-museum': P('Albert Hall Museum', 'museum', 'Museum', 4.4, 21000, null, 'jaipur', [75.819, 26.912], "Rajasthan's oldest museum, in an Indo-Saracenic building that glows at night.", 'city', 'ice'),
    'pink-city': P('Pink City', 'neighborhood', 'Neighborhood', null, null, null, 'jaipur', [75.827, 26.925], "Jaipur's walled old town, laid out in 1727 and painted rose-pink.", 'city', 'rose'),
    'lmb-jaipur': P('Laxmi Misthan Bhandar (LMB)', 'food', 'Restaurant', 4.2, 22000, null, 'jaipur', [75.8285, 26.921], 'A century-old sweet shop and restaurant on Johari Bazaar; try the ghewar and thali.', 'city', 'ember'),
    'tapri-central': P('Tapri Central', 'food', 'Cafe', 4.3, 15400, null, 'jaipur', [75.806, 26.907], 'A relaxed rooftop for masala chai and snacks, away from the crowds.', 'city', 'jade'),
    'samode-haveli': P('Samode Haveli', 'stay', 'Boutique Hotel', 4.6, 1800, 14000, 'jaipur', [75.8265, 26.9285], 'A restored 19th-century haveli with painted halls and a pool, inside the old city.', 'city', 'plum'),
    'rambagh-palace': P('Rambagh Palace', 'stay', 'Hotel', 4.8, 5100, 55000, 'jaipur', [75.808, 26.899], 'The former maharaja’s residence, set in formal gardens.', 'city', 'rose'),
    // Ranthambore
    'ranthambore-national-park': P('Ranthambore National Park', 'nature', 'National Park', 4.5, 14000, null, 'ranthambore', [76.503, 26.0173], 'A tiger reserve with a ruined fort inside; book safari zones well ahead.', 'forest', 'moss'),
    'ranthambore-fort': P('Ranthambore Fort', 'sight', 'Historical Landmark', 4.4, 12000, null, 'ranthambore', [76.459, 26.018], 'A 10th-century hilltop fort inside the park, with views over the forest.', 'canyon', 'sand'),
    'jogi-mahal': P('Jogi Mahal', 'sight', 'Historical Landmark', 4.3, 1100, null, 'ranthambore', [76.462, 26.021], 'A former hunting lodge beside a lake in the park, with wildlife at dawn.', 'forest', 'jade'),
    'aman-i-khas': P('Aman-i-Khás', 'stay', 'Hotel', 4.8, 900, 70000, 'ranthambore', [76.478, 26.009], 'Ten luxurious tents beside the park, with naturalist-led safaris.', 'forest', 'moss'),
    // Pushkar and Ajmer
    'pushkar-lake': P('Pushkar Lake', 'nature', 'Tourist Attraction', 4.4, 26000, null, 'pushkar', [74.551, 26.489], 'A sacred lake ringed by 52 ghats; walk it at sunrise.', 'isles', 'cobalt'),
    'brahma-temple': P('Brahma Temple', 'sight', 'Hindu Temple', 4.6, 34000, null, 'pushkar', [74.559, 26.489], 'One of the few temples to Brahma in the world; go early to avoid queues.', 'city', 'sand'),
    'savitri-mata-temple': P('Savitri Mata Temple', 'sight', 'Hindu Temple', 4.6, 12000, null, 'pushkar', [74.548, 26.481], 'A hilltop temple; climb for sunrise or the ropeway for the view.', 'peaks', 'ember'),
    'pushkar-bazaar': P('Pushkar Bazaar', 'market', 'Market', 4.1, 7800, null, 'pushkar', [74.5595, 26.4915], 'Silver jewellery, block prints and camel-leather goods in a lively bazaar.', 'city', 'sand'),
    'sunset-cafe-pushkar': P('Sunset Café', 'food', 'Cafe', 4.2, 6100, null, 'pushkar', [74.558, 26.486], 'A rooftop overlooking the lake; go for lunch or an early sunset.', 'city', 'jade'),
    'ajmer-sharif-dargah': P('Ajmer Sharif Dargah', 'sight', 'Historical Landmark', 4.7, 60000, null, 'pushkar', [74.629, 26.456], "The shrine of Khwaja Moinuddin Chishti; cover your head and go at midday for shorter queues.", 'city', 'ice'),
    'inn-seventh-heaven': P('Inn Seventh Heaven', 'stay', 'Boutique Hotel', 4.6, 2600, 7500, 'pushkar', [74.5545, 26.4945], 'A courtyard haveli hotel in the heart of Pushkar.', 'city', 'sand'),
    // Jodhpur
    'mehrangarh-fort': P('Mehrangarh Fort', 'sight', 'Historical Landmark', 4.7, 66000, null, 'jodhpur', [73.0186, 26.298], 'A vast fort on a cliff above the blue city, with an excellent museum and audio guide.', 'canyon', 'indigo'),
    'jaswant-thada': P('Jaswant Thada', 'sight', 'Historical Landmark', 4.6, 21000, null, 'jodhpur', [73.018, 26.3015], 'A white marble cenotaph with a calm garden, close to the fort.', 'city', 'ice'),
    'sardar-market': P('Sardar Market and Clock Tower', 'market', 'Market', 4.3, 22000, null, 'jodhpur', [73.023, 26.296], 'A lively bazaar of spices, textiles and jootis around a Victorian clock tower.', 'city', 'ember'),
    'brahmpuri': P('Brahmpuri (Blue City)', 'neighborhood', 'Neighborhood', null, null, null, 'jodhpur', [73.017, 26.294], 'The indigo-washed lanes below the fort; walk them in the early morning.', 'city', 'cobalt'),
    'toorji-ka-jhalra': P('Toorji Ka Jhalra', 'sight', 'Historical Landmark', 4.5, 9800, null, 'jodhpur', [73.0225, 26.2935], 'A restored stepwell with sharp geometry, beside the cafés of the old city.', 'city', 'slate'),
    'mishrilal-makhaniya-lassi': P('Shri Mishrilal Hotel (Makhaniya Lassi)', 'food', 'Cafe', 4.5, 15000, null, 'jodhpur', [73.0235, 26.2955], "The famous saffron lassi stall by the clock tower; go mid-morning.", 'city', 'sand'),
    'rao-jodha-desert-park': P('Rao Jodha Desert Rock Park', 'nature', 'Rock Park', 4.5, 6900, null, 'jodhpur', [73.014, 26.2975], 'A restored volcanic-rock landscape beside the fort, with short walking trails.', 'canyon', 'moss'),
    'kaylana-lake': P('Kaylana Lake', 'nature', 'Lake', 4.1, 2100, null, 'jodhpur', [72.965, 26.28], 'A quiet reservoir west of the city; go at sunset.', 'isles', 'ice'),
    'pal-haveli': P('Pal Haveli', 'stay', 'Boutique Hotel', 4.5, 1400, 12000, 'jodhpur', [73.023, 26.2975], 'A restored haveli in the old city with a rooftop restaurant facing the fort.', 'city', 'cobalt'),
    'umaid-bhawan-palace': P('Umaid Bhawan Palace', 'stay', 'Hotel', 4.8, 9800, 60000, 'jodhpur', [73.047, 26.281], 'A working royal residence, a palace hotel and a museum in one Art Deco building.', 'city', 'sand'),
    // Jaisalmer
    'jaisalmer-fort': P('Jaisalmer Fort', 'sight', 'Historical Landmark', 4.6, 43000, null, 'jaisalmer', [70.913, 26.9124], 'A living golden fort, with houses and shops inside its walls; go at sunrise.', 'dunes', 'sand'),
    'patwon-ki-haveli': P('Patwon Ki Haveli', 'sight', 'Historical Landmark', 4.3, 7200, null, 'jaisalmer', [70.915, 26.917], 'A cluster of five ornate merchant havelis with carved balconies.', 'city', 'ember'),
    'gadisar-lake': P('Gadisar Lake', 'nature', 'Lake', 4.3, 8300, null, 'jaisalmer', [70.91, 26.904], 'A tranquil reservoir with chhatris and small temples; go at dawn.', 'isles', 'ice'),
    'bada-bagh': P('Bada Bagh', 'sight', 'Historical Landmark', 4.5, 5400, null, 'jaisalmer', [70.888, 26.962], 'A garden of royal cenotaphs; the best light is at sunset.', 'dunes', 'ember'),
    'kuldhara': P('Kuldhara Abandoned Village', 'sight', 'Historical Landmark', 4.2, 13100, null, 'jaisalmer', [70.803, 26.828], 'A ruined 13th-century village in the desert; walk it in the morning.', 'dunes', 'slate'),
    'sam-sand-dunes': P('Sam Sand Dunes', 'nature', 'Tourist Attraction', 4.4, 12200, null, 'jaisalmer', [70.514, 26.833], 'The largest dunes near the city; go for sunset and stay for the stars.', 'dunes', 'sand'),
    'desert-national-park': P('Desert National Park', 'nature', 'National Park', 4.3, 3200, null, 'jaisalmer', [70.65, 26.75], 'Scrub desert and grassland where you may spot chinkara and great Indian bustards.', 'dunes', 'moss'),
    'trio-restaurant': P('Trio Restaurant', 'food', 'Restaurant', 4.3, 5300, null, 'jaisalmer', [70.9135, 26.913], 'A music-filled courtyard restaurant in the fort, good for a long dinner.', 'city', 'plum'),
    'suryagarh': P('Suryagarh', 'stay', 'Hotel', 4.7, 2500, 42000, 'jaisalmer', [70.83, 26.865], 'A sandstone fortress hotel in the desert, with a spa and dune dinners.', 'dunes', 'ember'),
    // Udaipur
    'city-palace-udaipur': P('City Palace, Udaipur', 'museum', 'Museum', 4.6, 39000, null, 'udaipur', [73.6835, 24.5764], 'A complex of palaces beside Lake Pichola, with mirror halls and courtyards.', 'city', 'sand'),
    'lake-pichola': P('Lake Pichola Boat Ride', 'nature', 'Tourist Attraction', 4.6, 30000, null, 'udaipur', [73.681, 24.572], 'A boat ride past the island palaces at sunset.', 'isles', 'cobalt'),
    'jag-mandir': P('Jag Mandir', 'sight', 'Historical Landmark', 4.4, 5100, null, 'udaipur', [73.679, 24.566], 'A small island palace with a garden café; a boat ride from the City Palace.', 'isles', 'jade'),
    'jagdish-temple': P('Jagdish Temple', 'sight', 'Hindu Temple', 4.6, 21000, null, 'udaipur', [73.684, 24.58], 'A busy 17th-century Vishnu temple with a steep stairway.', 'city', 'ice'),
    'saheliyon-ki-bari': P('Saheliyon-ki-Bari', 'nature', 'Garden', 4.4, 15000, null, 'udaipur', [73.689, 24.598], 'A tranquil garden with fountains and lotus pools, made for royal women.', 'forest', 'moss'),
    'sajjangarh-monsoon-palace': P('Sajjangarh (Monsoon Palace)', 'sight', 'Historical Landmark', 4.4, 20000, null, 'udaipur', [73.654, 24.596], 'A hilltop palace above the lakes; go at sunset.', 'peaks', 'ember'),
    'bagore-ki-haveli': P('Bagore Ki Haveli', 'museum', 'Museum', 4.3, 10500, null, 'udaipur', [73.6825, 24.5795], 'A lakeside haveli with a museum and an evening dance show.', 'aurora', 'plum'),
    'ambrai-restaurant': P('Ambrai Restaurant', 'food', 'Restaurant', 4.4, 8400, null, 'udaipur', [73.6835, 24.583], 'A lakeside restaurant with views of the City Palace, best at dusk.', 'city', 'indigo'),
    'kumbhalgarh-fort': P('Kumbhalgarh Fort', 'sight', 'Historical Landmark', 4.6, 18000, null, 'udaipur', [73.587, 25.149], 'A mountain fortress with a wall said to be among the longest in the world.', 'peaks', 'sand'),
    'ranakpur-jain-temple': P('Ranakpur Jain Temple', 'sight', 'Historical Landmark', 4.7, 12000, null, 'udaipur', [73.47, 25.117], 'A marble temple with more than a thousand carved pillars; dress modestly.', 'city', 'ice'),
    'kumbhalgarh-wildlife-sanctuary': P('Kumbhalgarh Wildlife Sanctuary', 'nature', 'Wildlife Sanctuary', 4.3, 1900, null, 'udaipur', [73.56, 25.18], 'Aravalli forest with leopards, sloth bears and long walking trails.', 'forest', 'moss'),
    'taj-lake-palace': P('Taj Lake Palace', 'stay', 'Hotel', 4.8, 6000, 65000, 'udaipur', [73.6795, 24.5755], 'A white marble palace on an island in Lake Pichola, reached by boat.', 'isles', 'ice'),
    'oberoi-udaivilas': P('The Oberoi Udaivilas', 'stay', 'Hotel', 4.9, 4200, 62000, 'udaipur', [73.6685, 24.585], 'A palace-style resort with domes, courtyards and a lakeside pool.', 'isles', 'jade')
  },

  clarify: {
    types: { q: 'How should we shape your journey through Rajasthan?', options: ['Palaces, forts & royal residences', 'Desert dunes & wildlife reserves', 'Old bazaars, textiles & royal thalis', 'Slow heritage luxury & palace retreats'] },
    duration: { q: 'How many days would you like to spend in Rajasthan?', options: [{ label: 'A focused visit (4–5 days)', days: 5 }, { label: 'A classic circuit (~7 days)', days: 7 }, { label: 'A grand royal journey (~14 days)', days: 14 }] },
    dates: { q: 'Select your travel dates for Rajasthan so I can verify palace stay availability and seasonal comfort.' },
    base: { q: 'For this {type} journey, which historic base should anchor your stay?', options: ['Restored heritage haveli in Jaipur', 'Lakeside palace retreat in Udaipur', 'Desert stone sanctuary near Jaisalmer'] }
  },

  stays: {
    query: 'heritage hotels in Rajasthan India',
    found: 27,
    ids: ['samode-haveli', 'rambagh-palace', 'pal-haveli', 'umaid-bhawan-palace', 'suryagarh', 'taj-lake-palace', 'oberoi-udaivilas', 'aman-i-khas'],
    byBase: {
      'Heritage haveli in Jaipur': 'samode-haveli',
      'Restored heritage haveli in Jaipur': 'samode-haveli',
      'Lakeside palace in Udaipur': 'taj-lake-palace',
      'Lakeside palace retreat in Udaipur': 'taj-lake-palace',
      'Desert fort near Jaisalmer': 'suryagarh',
      'Desert stone sanctuary near Jaisalmer': 'suryagarh'
    }
  },

  extras: {
    food: ['lmb-jaipur', 'tapri-central', 'trio-restaurant', 'ambrai-restaurant', 'sunset-cafe-pushkar', 'mishrilal-makhaniya-lassi'],
    nightlife: ['bagore-ki-haveli', 'sam-sand-dunes', 'lake-pichola'],
    relaxedDrop: 1
  },

  suggestions: ['Curate royal thalis & heritage rooftop dining', 'Add dusk views from the palace terraces', 'Pace the days more leisurely'],

  replies: {
    planIntro: {
      'Palaces and forts': "I'll link the great forts and palaces in one loop, with a fort in the morning and a rest in the afternoon each day.",
      'Palaces, forts & royal residences': "I'll curate a stately passage through sandstone ramparts and cupolas, timed so fort visits catch the morning light before the heat.",
      'Desert and wildlife': "I'll pair the desert around Jaisalmer with a tiger reserve and a few quiet lakes, keeping each day to one main outing.",
      'Desert dunes & wildlife reserves': "I'll balance golden dunes and star-filled desert skies with quiet forest lakes and wildlife reserves, keeping journeys measured.",
      'Bazaars and food': "I'll build the days around markets, thalis and rooftops, with a landmark each day rather than a checklist.",
      'Old bazaars, textiles & royal thalis': "I'll center the days around spice alleys, block-print ateliers, and feast thalis, giving you time to wander unhurried.",
      'Slow luxury': "I'll keep this slow: fewer stops, long lunches, and palace hotels as the main event, with short hops between them.",
      'Slow heritage luxury & palace retreats': "I'll make palace sanctuaries the centerpiece: unhurried courtyard breakfasts, afternoon tea in colonnades, and minimal driving."
    },
    planDone: "Here's a {days}-day Rajasthan plan for {month}, built as one loop so there is no backtracking.\n\nI kept the pace relaxed, with **two or three stops a day** and time to rest in the afternoon heat. Tell me your dates and I'll add a hotel and a few places to eat along the route.",
    staysIntro: "I'll pick a characterful heritage base that keeps the drives short, then add a few good places to eat so the days do not feel overpacked.",
    staysDone: 'Your Rajasthan plan is now dated **{range}**.\n\nI added **{stay}** as a comfortable base, plus two dining stops that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. The rest of the plan stays intentionally relaxed, with long drives kept to one every other day.',
    reserve: "I can't make reservations or book from this planner. Use the itinerary to contact hotels, drivers and safari providers directly, and confirm current prices and availability before you book.",
    relaxed: "I've lightened each day by removing the busiest stop, which leaves more room for a long lunch and rest in the afternoon heat.",
    food: 'I curated celebrated royal tables and heritage cafes along your route, chosen for rich culinary lineage and unhurried lunches.',
    nightlife: 'I added dusk vantage points and lantern-lit haveli courtyards, placed close to your base for effortless evenings.',
    fallback: 'I can curate palace retreats, add storied dining tables, or soften the route pace. Share what you’d like to adjust.'
  },

  deep: {
    steps: ['Reading the brief', 'Searching sources', 'Comparing routes and seasons', 'Checking availability', 'Writing the plan'],
    sources: [
      { title: 'Rajasthan Tourism: places to visit', domain: 'tourism.rajasthan.gov.in', note: 'Official guide to forts, palaces and festivals.' },
      { title: 'Rajasthan travel guide', domain: 'lonelyplanet.com', note: 'City-by-city overview and route suggestions.' },
      { title: 'The best heritage hotels in Rajasthan', domain: 'cntraveller.in', note: 'Editor picks in Jaipur, Udaipur and Jaisalmer.' },
      { title: 'Things to do in Jaipur', domain: 'tripadvisor.in', note: 'Traveller-reviewed attractions and restaurants.' },
      { title: 'Climate of Rajasthan: monthly normals', domain: 'mausam.imd.gov.in', note: 'February temperatures and rainfall.' },
      { title: 'Book train tickets between Rajasthan cities', domain: 'irctc.co.in', note: 'Timetables for Jaipur, Jodhpur and Udaipur.' },
      { title: 'Hill Forts of Rajasthan', domain: 'whc.unesco.org', note: 'World Heritage listing for six major forts.' },
      { title: 'Ranthambore safari zones and booking', domain: 'rajasthanwildlife.in', note: 'Zones, timings and how far ahead to book.' },
      { title: 'Desert festival dates in Jaisalmer', domain: 'thehindu.com', note: 'When the Desert Festival runs and how it affects prices.' },
      { title: "Rajasthan's food, city by city", domain: 'theculturetrip.com', note: 'Dishes to try in Jaipur, Jodhpur and Udaipur.' },
      { title: 'Mehrangarh Fort visitor information', domain: 'mehrangarh.org', note: 'Timings, tickets and the audio guide.' },
      { title: 'Rajasthan hotel rates by season', domain: 'booking.com', note: 'Nightly rates from October to March.' }
    ],
    lines: [
      'Read tourism.rajasthan.gov.in — festival calendar, Feb',
      'Read mausam.imd.gov.in — February climate normals for Rajasthan',
      'Searched "best route through Rajasthan for a first visit"',
      'Read lonelyplanet.com — Rajasthan by city',
      'Read cntraveller.in — heritage hotels, Jaipur to Udaipur',
      'Compared drive times between Jaipur, Jodhpur, Jaisalmer and Udaipur',
      'Read rajasthanwildlife.in — Ranthambore zones and timings',
      'Checked booking.com — February rates in Jaipur and Udaipur',
      'Read mehrangarh.org — visitor information and audio guide',
      'Drafted a relaxed day-by-day plan with one long drive every other day'
    ],
    report: {
      title: 'Rajasthan in February: how to link Jaipur, Jodhpur, Jaisalmer and Udaipur',
      summary: 'February is one of the best months for Rajasthan, with cool days and clear skies for forts and dunes [1][5]. Follow a loop from Jaipur through Jodhpur and Jaisalmer to Udaipur, with one long drive every other day [2][6].',
      sections: [
        { h: 'When to go', body: 'From November to March the weather is dry and pleasant, with daytime highs of 24–28°C in February [5]. It is peak season, so book palace hotels and Ranthambore safaris well in advance [8][12]. Nights in the desert are cold, so pack layers [1].' },
        { h: 'The route', body: 'A loop from Jaipur to Jodhpur, Jaisalmer and Udaipur avoids backtracking [2]. Jaipur to Jodhpur takes about six hours by road, and Jodhpur to Jaisalmer around five [6]. Add Ranthambore only if you have a week or more, and book the safari zone first [8].' },
        { h: 'How to pace it', body: 'Start with forts in the morning, when it is cool and the crowds are thin, and take a long lunch and rest in the afternoon [4][11]. Save the desert for the middle of the trip and finish on the lakes of Udaipur [2][7].' },
        { h: 'Where to stay', body: 'Heritage hotels are the highlight: haveli stays in Jaipur, fort hotels in the desert and lakeside palaces in Udaipur [3]. The Jaisalmer Desert Festival can raise prices, so check dates before booking [9]. For food, seek out local thalis and sweets rather than hotel buffets [10].' }
      ],
      table: {
        caption: 'Choosing a base',
        cols: ['Base', 'Feel', 'Best for', 'Nights', 'Drive from Jaipur'],
        rows: [
          ['Jaipur', 'Busy, colourful', 'Forts, palaces and bazaars', '2–3', '—'],
          ['Jodhpur', 'Blue, dramatic', 'Mehrangarh and old lanes', '1–2', '5.5–6.5 h'],
          ['Jaisalmer', 'Golden, remote', 'Desert, dunes and stars', '2', '9–10 h'],
          ['Udaipur', 'Calm, lakeside', 'Palaces and slow days', '2–3', '6–7 h']
        ]
      }
    }
  }
};
