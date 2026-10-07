'use strict';
// Goa: the richest destination. Sample data for Friday's scripted planner preview.
const P = (name, kind, label, rating, reviews, price, area, at, blurb, scene, tone) =>
  ({ name, kind, label, rating, reviews, price, area, at, blurb, scene, tone });

module.exports = {
  id: 'goa',
  name: 'Goa',
  tripTitle: 'Goa Beach Vacation',
  threadTitle: 'Plan Goa Trip',
  match: ['goa', 'panaji', 'panjim', 'calangute', 'anjuna', 'vagator', 'candolim', 'baga', 'margao', 'arambol', 'fontainhas', 'colva'],
  currency: '₹',
  region: 'North Goa',
  scene: 'sea',
  tone: 'ember',
  card: { caption: 'Goa', scene: 'sea', tone: 'ember' },
  prompt: 'Plan a trip to Goa',

  map: {
    bounds: [73.66, 15.15, 74.10, 15.74],
    land: [[
      [74.30, 15.95], [73.60, 15.95], [73.62, 15.86], [73.640, 15.815], [73.662, 15.770], [73.676, 15.742], [73.686, 15.729],
      [73.688, 15.724], [73.692, 15.710], [73.699, 15.696], [73.704, 15.686], [73.707, 15.672], [73.710, 15.658], [73.715, 15.650],
      [73.720, 15.643], [73.725, 15.636], [73.732, 15.629], [73.7365, 15.621], [73.738, 15.616],
      // Chapora estuary (north bank, then back along the south bank)
      [73.740, 15.615], [73.750, 15.6172], [73.765, 15.6212], [73.780, 15.6215], [73.795, 15.6165], [73.810, 15.6135], [73.815, 15.611],
      [73.796, 15.609], [73.780, 15.611], [73.765, 15.6118], [73.750, 15.610], [73.741, 15.6088], [73.735, 15.6075],
      [73.733, 15.604], [73.7325, 15.600], [73.7325, 15.590], [73.734, 15.580], [73.736, 15.572], [73.740, 15.565], [73.744, 15.560],
      [73.747, 15.556], [73.752, 15.550], [73.755, 15.545], [73.760, 15.535], [73.763, 15.525], [73.764, 15.515], [73.765, 15.506],
      [73.765, 15.500], [73.767, 15.492], [73.769, 15.488],
      // Mandovi estuary: north bank up to Old Goa and beyond, then back along the Panaji bank
      [73.776, 15.4885], [73.786, 15.493], [73.796, 15.499], [73.804, 15.501], [73.811, 15.503], [73.820, 15.507], [73.830, 15.511],
      [73.850, 15.515], [73.870, 15.519], [73.900, 15.523], [73.930, 15.527], [73.955, 15.533], [73.957, 15.530],
      [73.955, 15.523], [73.930, 15.517], [73.910, 15.511], [73.890, 15.508], [73.870, 15.506], [73.850, 15.504], [73.830, 15.501],
      [73.820, 15.499], [73.813, 15.494], [73.8095, 15.488], [73.8065, 15.482], [73.804, 15.470], [73.803, 15.460], [73.8005, 15.4555],
      // Zuari estuary and Mormugao harbour
      [73.814, 15.443], [73.840, 15.433], [73.870, 15.428], [73.900, 15.421], [73.920, 15.412], [73.940, 15.402], [73.945, 15.3985],
      [73.935, 15.396], [73.915, 15.406], [73.890, 15.413], [73.865, 15.418], [73.840, 15.420], [73.820, 15.415], [73.805, 15.413],
      [73.790, 15.4085],
      [73.796, 15.399], [73.808, 15.390], [73.823, 15.378], [73.833, 15.367], [73.850, 15.348], [73.865, 15.334], [73.880, 15.317],
      [73.895, 15.300], [73.903, 15.285], [73.910, 15.270], [73.920, 15.250], [73.927, 15.230], [73.933, 15.205], [73.940, 15.180],
      [73.948, 15.155], [73.950, 15.100], [74.30, 15.100]
    ]],
    water: [
      [[73.955, 15.531], [73.985, 15.545], [74.020, 15.580], [74.060, 15.615], [74.100, 15.650]],           // upper Mandovi
      [[73.815, 15.611], [73.850, 15.630], [73.900, 15.660], [73.950, 15.700], [74.000, 15.740]],            // upper Chapora
      [[73.688, 15.727], [73.720, 15.727], [73.760, 15.725], [73.800, 15.720], [73.850, 15.715]],            // Terekhol
      [[73.945, 15.3985], [73.970, 15.380], [74.000, 15.350], [74.050, 15.300], [74.100, 15.250]],           // upper Zuari
      [[73.903, 15.510], [73.905, 15.480], [73.915, 15.450], [73.928, 15.420], [73.937, 15.399]],            // Cumbarjua canal
      [[73.958, 15.148], [73.990, 15.170], [74.030, 15.200], [74.080, 15.230]],                              // Sal river
      [[73.802, 15.591], [73.815, 15.575], [73.830, 15.555], [73.840, 15.535], [73.850, 15.515]]             // Mapusa river
    ],
    parks: [
      [[73.865, 15.518], [73.895, 15.523], [73.900, 15.536], [73.870, 15.538], [73.860, 15.528]],            // Chorao (Salim Ali) mangroves
      [[74.030, 15.560], [74.100, 15.560], [74.100, 15.690], [74.040, 15.680], [74.020, 15.620]],            // Mhadei foothills
      [[74.040, 15.400], [74.100, 15.420], [74.100, 15.250], [74.050, 15.270]]                                // Mollem foothills
    ],
    roads: [
      { ref: '66', path: [[73.796, 15.725], [73.803, 15.670], [73.808, 15.625], [73.810, 15.591], [73.825, 15.535], [73.827, 15.507], [73.850, 15.470], [73.880, 15.440], [73.915, 15.415], [73.935, 15.370], [73.952, 15.300], [73.956, 15.270], [73.965, 15.200], [73.975, 15.150]] },
      { ref: '748', path: [[73.833, 15.492], [73.870, 15.475], [73.910, 15.455], [73.970, 15.435], [74.015, 15.420], [74.100, 15.395]] }
    ],
    labels: [
      { t: 'Arabian Sea', at: [73.700, 15.500], kind: 'region' },
      { t: 'North Goa', at: [73.900, 15.660], kind: 'region' },
      { t: 'South Goa', at: [74.000, 15.220], kind: 'region' },
      { t: 'Pernem', at: [73.797, 15.720], kind: 'town' },
      { t: 'Arambol', at: [73.735, 15.688], kind: 'town' },
      { t: 'Mapusa', at: [73.808, 15.595], kind: 'town' },
      { t: 'Anjuna', at: [73.756, 15.578], kind: 'town' },
      { t: 'Vagator', at: [73.757, 15.601], kind: 'town' },
      { t: 'Calangute', at: [73.788, 15.545], kind: 'town' },
      { t: 'Candolim', at: [73.790, 15.517], kind: 'town' },
      { t: 'Porvorim', at: [73.842, 15.528], kind: 'town' },
      { t: 'Panaji', at: [73.845, 15.485], kind: 'town' },
      { t: 'Old Goa', at: [73.930, 15.497], kind: 'town' },
      { t: 'Ponda', at: [74.015, 15.398], kind: 'town' },
      { t: 'Vasco da Gama', at: [73.842, 15.392], kind: 'town' },
      { t: 'Margao', at: [73.980, 15.270], kind: 'town' },
      { t: 'Colva', at: [73.940, 15.285], kind: 'town' },
      { t: 'Salim Ali Sanctuary', at: [73.884, 15.548], kind: 'park' },
      { t: 'Mhadei Foothills', at: [74.068, 15.625], kind: 'park' }
    ]
  },

  areas: [
    { id: 'panaji', name: 'Panaji', town: 'Panjim', alt: 'Panjim', at: [73.830, 15.493] },
    { id: 'oldgoa', name: 'Old Goa', town: 'Old Goa', alt: 'Velha Goa', at: [73.911, 15.501] },
    { id: 'calangute', name: 'Calangute', town: 'Candolim', alt: 'Candolim and Baga', at: [73.762, 15.541] },
    { id: 'anjuna', name: 'Anjuna', town: 'Anjuna', alt: 'Assagao', at: [73.744, 15.575] },
    { id: 'vagator', name: 'Vagator', town: 'Vagator', alt: 'Chapora', at: [73.739, 15.600] },
    { id: 'oxel', name: 'Oxel', town: 'Oxel', alt: 'Morjim and Siolim', at: [73.740, 15.628] },
    { id: 'arambol', name: 'Arambol', town: 'Arambol', alt: 'Mandrem', at: [73.710, 15.686] },
    { id: 'colva', name: 'Colva', town: 'Benaulim', alt: 'Benaulim', at: [73.911, 15.279] },
    { id: 'ponda', name: 'Ponda', town: 'Ponda', alt: 'Temple country', at: [74.000, 15.420] }
  ],

  places: {
    // Panaji
    'fontainhas': P('Fontainhas (quarter)', 'neighborhood', 'Neighborhood', null, null, null, 'panaji', [73.831, 15.4975], "Panjim's Latin Quarter: pastel Portuguese-era houses, tiled facades and narrow lanes made for walking.", 'city', 'rose'),
    'black-sheep-bistro': P('The Black Sheep Bistro', 'food', 'Bistro', 4.6, 8164, null, 'panaji', [73.829, 15.4955], 'Goan-forward plates and a thoughtful cocktail list in a relaxed Panjim dining room.', 'city', 'plum'),
    'cantare': P('Cantare', 'food', 'Restaurant', 4.4, 1930, null, 'panaji', [73.8265, 15.493], 'Contemporary Goan cooking with a strong seafood section and calm, unhurried service.', 'city', 'sand'),
    'hotel-venite': P('Hotel Venite', 'food', 'Restaurant', 4.2, 4120, null, 'panaji', [73.8305, 15.4968], 'Balcony tables above the Fontainhas lanes; order the prawn balchão and stay for the light.', 'city', 'ember'),
    'mums-kitchen': P("Mum's Kitchen", 'food', 'Restaurant', 4.3, 5210, null, 'panaji', [73.817, 15.489], 'Home-style Goan thali and fish curry rice, a short drive from the centre.', 'city', 'jade'),
    'panjim-market': P('Panjim Municipal Market', 'market', 'Market', 4.1, 6340, null, 'panaji', [73.833, 15.4935], 'Cashews, kokum, dried spices and the morning fish catch under one busy roof.', 'city', 'sand'),
    'church-immaculate-conception': P('Church of Our Lady of the Immaculate Conception', 'church', 'Church', 4.6, 12300, null, 'panaji', [73.830, 15.4985], "The whitewashed 1541 church and its zigzag stairway anchor Panjim's main square.", 'city', 'ice'),
    'goa-state-museum': P('Goa State Museum', 'museum', 'Museum', 4.2, 1980, null, 'panaji', [73.839, 15.493], 'A tidy introduction to Goan history, sculpture and Catholic and Hindu art.', 'city', 'slate'),
    'miramar-beach': P('Miramar Beach', 'beach', 'Beach', 4.0, 21400, null, 'panaji', [73.8085, 15.4815], "Panjim's city beach: best at sunset, with a walk along the promenade.", 'sea', 'rose'),
    'mandovi-cruise': P('Mandovi River Sunset Cruise', 'nature', 'Tourist Attraction', 4.2, 8900, null, 'panaji', [73.8285, 15.499], 'An easy evening on the water with folk music and a view of the Panjim skyline.', 'sea', 'indigo'),
    'panjim-inn': P('Panjim Inn', 'stay', 'Boutique Hotel', 4.4, 1750, 9800, 'panaji', [73.8315, 15.4972], 'A 19th-century Fontainhas mansion turned heritage hotel with a courtyard.', 'city', 'plum'),
    'vivenda-dos-palhacos': P('Vivenda dos Palhaços', 'stay', 'Boutique Hotel', 4.7, 410, 12500, 'panaji', [73.830, 15.4962], 'Six characterful rooms in a restored Portuguese house, a minute from the chapel square.', 'city', 'rose'),
    // Old Goa and the Mandovi
    'basilica-bom-jesus': P('Basilica of Bom Jesus', 'church', 'Historical Landmark', 4.6, 21800, null, 'oldgoa', [73.9114, 15.5009], 'UNESCO-listed baroque basilica that holds the remains of St Francis Xavier.', 'city', 'sand'),
    'se-cathedral': P('Sé Cathedral', 'church', 'Historical Landmark', 4.6, 9100, null, 'oldgoa', [73.9123, 15.5031], "One of Asia's largest churches, with the Golden Bell in its tower.", 'city', 'ice'),
    'archaeological-museum': P('Archaeological Museum and Portrait Gallery', 'museum', 'Museum', 4.2, 1600, null, 'oldgoa', [73.9105, 15.504], 'Cool galleries of sculpture and viceroy portraits, beside the basilica.', 'city', 'slate'),
    'reis-magos-fort': P('Reis Magos Fort', 'sight', 'Historical Landmark', 4.3, 6900, null, 'panaji', [73.8095, 15.507], 'A rust-red fort above the Mandovi mouth with a good view back to Panjim.', 'sea', 'ember'),
    'museum-of-goa': P('Museum of Goa', 'museum', 'Museum', 4.4, 1650, null, 'panaji', [73.812, 15.534], 'Contemporary Goan art in a striking building, with a garden café.', 'city', 'indigo'),
    'salim-ali-bird-sanctuary': P('Dr. Salim Ali Bird Sanctuary', 'nature', 'Bird Sanctuary', 4.0, 2200, null, 'panaji', [73.872, 15.525], 'Mangrove boardwalks on Chorao island; go early for kingfishers and herons.', 'forest', 'moss'),
    // Calangute, Candolim, Baga
    'baga-beach': P('Baga Beach', 'beach', 'Neighborhood', null, null, null, 'calangute', [73.7525, 15.5555], 'The liveliest strip of the north coast: shacks by day, music by night.', 'sea', 'rose'),
    'calangute-beach': P('Calangute Beach', 'beach', 'Beach', 4.2, 61200, null, 'calangute', [73.7585, 15.544], 'Long and busy, with easy loungers and water sports at the northern end.', 'sea', 'ember'),
    'candolim-beach': P('Candolim Beach', 'beach', 'Beach', 4.3, 9800, null, 'calangute', [73.766, 15.517], 'Calmer than Calangute, with wide sand and unhurried shacks.', 'sea', 'sand'),
    'fort-aguada': P('Fort Aguada', 'sight', 'Historical Landmark', 4.4, 32400, null, 'calangute', [73.7737, 15.4925], 'A 17th-century Portuguese fort and lighthouse with views over the Mandovi mouth.', 'sea', 'ember'),
    'hyatt-centric-candolim': P('Hyatt Centric Candolim Goa', 'stay', 'Hotel', 4.5, 3210, 18500, 'calangute', [73.767, 15.5155], 'A polished base minutes from Candolim beach, with a pool and easy access to both coasts.', 'sea', 'cobalt'),
    'taj-fort-aguada': P('Taj Fort Aguada Resort & Spa', 'stay', 'Hotel', 4.6, 5300, 32000, 'calangute', [73.7695, 15.4975], 'Terraced cottages down to the sea below the fort, with a quiet private beach.', 'sea', 'jade'),
    'jiva-spa': P('Jiva Spa at Taj Fort Aguada', 'wellness', 'Spa', 4.6, 780, null, 'calangute', [73.770, 15.4965], 'Ayurvedic massage and treatments in a garden pavilion above the sea.', 'forest', 'moss'),
    'bomras': P('Bomras', 'food', 'Restaurant', 4.5, 3950, null, 'calangute', [73.7665, 15.5205], "A small Burmese kitchen that feels like dinner at a friend's; book ahead.", 'city', 'plum'),
    'brittos': P("Britto's", 'food', 'Restaurant', 4.0, 12450, null, 'calangute', [73.7528, 15.5548], 'A Baga institution on the sand for grilled fish and cold beer.', 'sea', 'ember'),
    'titos-club': P("Tito's Club", 'nightlife', 'Nightclub', 4.0, 15700, null, 'calangute', [73.752, 15.554], "The name behind Baga's famous nightlife lane; it gets busy after ten.", 'aurora', 'plum'),
    'lpk-waterfront': P('LPK Waterfront', 'nightlife', 'Bar', 4.1, 6300, null, 'calangute', [73.788, 15.504], 'A riverside bar and club on the Nerul creek, popular for sunset drinks.', 'aurora', 'indigo'),
    'ingos-night-bazaar': P("Ingo's Night Bazaar", 'market', 'Night Market', 4.2, 14300, null, 'calangute', [73.764, 15.558], 'Stalls, live music and street food on Saturday evenings in Arpora.', 'city', 'ember'),
    // Anjuna and Assagao
    'artjuna': P('Artjuna', 'food', 'Cafe', 4.4, 6120, null, 'anjuna', [73.7455, 15.576], 'A leafy garden café in Anjuna known for its bowls, coffee and slow breakfasts.', 'forest', 'jade'),
    'anjuna-beach': P('Anjuna Beach', 'beach', 'Beach', 4.3, 15500, null, 'anjuna', [73.742, 15.574], 'Red laterite cliffs, sunset sessions and a relaxed shack scene.', 'sea', 'sand'),
    'anjuna-flea-market': P('Anjuna Flea Market', 'market', 'Flea Market', 4.1, 22300, null, 'anjuna', [73.7445, 15.581], 'The Wednesday flea market: textiles, jewellery and secondhand finds.', 'city', 'ember'),
    'curlies-anjuna': P('Curlies Beach Shack', 'nightlife', 'Beach Bar', 4.1, 6100, null, 'anjuna', [73.7405, 15.579], 'A long-running beach shack for sundowners and late trance nights.', 'aurora', 'rose'),
    'casa-anjuna': P('Casa Anjuna', 'stay', 'Boutique Hotel', 4.5, 890, 14500, 'anjuna', [73.748, 15.582], 'A quiet courtyard hotel a short walk from the beach and the cafés.', 'forest', 'jade'),
    'assagao': P('Assagao', 'neighborhood', 'Neighborhood', null, null, null, 'anjuna', [73.766, 15.596], 'Village lanes, red-tiled villas and some of the north coast’s best restaurants.', 'forest', 'moss'),
    'gunpowder': P('Gunpowder', 'food', 'Restaurant', 4.5, 4300, null, 'anjuna', [73.768, 15.595], 'South Indian and Goan cooking in a leafy courtyard in Assagao.', 'forest', 'sand'),
    'purple-valley-yoga': P('Purple Valley Yoga Retreat', 'wellness', 'Yoga Retreat', 4.6, 620, null, 'anjuna', [73.770, 15.603], 'Morning classes in a palm-shaded shala, with a slow village setting.', 'forest', 'moss'),
    'mapusa-market': P('Mapusa Friday Market', 'market', 'Market', 4.2, 7200, null, 'anjuna', [73.808, 15.591], 'Spices, pottery and fruit in the traditional Friday bazaar.', 'city', 'sand'),
    // Vagator
    'vagator-beach': P('Vagator Beach', 'beach', 'Beach', 4.2, 21800, null, 'vagator', [73.7385, 15.600], 'Dramatic red cliffs above a broad cove, quieter in the morning.', 'sea', 'rose'),
    'chapora-fort': P('Chapora Fort', 'sight', 'Historical Landmark', 4.3, 18100, null, 'vagator', [73.737, 15.606], 'A ruined hilltop fort with wide views over the coast and the Chapora estuary.', 'sea', 'ember'),
    'thalassa': P('Thalassa', 'food', 'Restaurant', 4.3, 15800, null, 'vagator', [73.7375, 15.5985], 'Greek dining on a clifftop terrace; go for a sunset table.', 'sea', 'cobalt'),
    'hilltop-vagator': P('Hilltop Vagator', 'nightlife', 'Open-air Club', 4.1, 3900, null, 'vagator', [73.744, 15.601], 'An open-air party spot on the ridge, more lively than most on Sunday.', 'aurora', 'plum'),
    // Oxel, Morjim, Siolim
    'morjim-beach': P('Morjim Beach', 'beach', 'Beach', 4.3, 4300, null, 'oxel', [73.7405, 15.6255], 'A wide, quiet beach where Olive Ridley turtles nest in winter.', 'sea', 'sand'),
    'la-plage': P('La Plage', 'food', 'Restaurant', 4.3, 2880, null, 'oxel', [73.729, 15.644], 'French-leaning beach dining at Ashvem with a barefoot, easy atmosphere.', 'sea', 'ice'),
    'siolim': P('Siolim', 'neighborhood', 'Neighborhood', null, null, null, 'oxel', [73.765, 15.629], 'A riverside village of old mansions and a quiet alternative to the coast.', 'forest', 'moss'),
    // Arambol
    'arambol-beach': P('Arambol Beach', 'beach', 'Beach', 4.3, 12700, null, 'arambol', [73.708, 15.688], 'Long headland beach with drum circles at sunset and craft stalls.', 'sea', 'jade'),
    'sweet-water-lake': P('Sweet Water Lake', 'nature', 'Tourist Attraction', 4.2, 900, null, 'arambol', [73.715, 15.6895], 'A small freshwater lake behind the beach, reached by a short forest walk.', 'forest', 'moss'),
    'ashiyana-yoga': P('Ashiyana Yoga Retreat', 'wellness', 'Yoga Retreat', 4.6, 540, null, 'arambol', [73.714, 15.664], 'A long-standing retreat on the Mandrem coast with daily yoga and Ayurvedic meals.', 'forest', 'jade'),
    // South Goa
    'colva-beach': P('Colva Beach', 'beach', 'Beach', 4.1, 11500, null, 'colva', [73.911, 15.279], 'A long, family-friendly beach with easy access and plenty of shacks.', 'sea', 'sand'),
    'benaulim-beach': P('Benaulim Beach', 'beach', 'Beach', 4.4, 6800, null, 'colva', [73.925, 15.25], 'A slower southern stretch with fishermen, palms and space to walk.', 'sea', 'ice'),
    'martins-corner': P("Martin's Corner", 'food', 'Restaurant', 4.3, 15400, null, 'colva', [73.907, 15.292], 'A South Goa favourite for crab xec xec and its Goan fish curry.', 'sea', 'ember'),
    'alila-diwa': P('Alila Diwa Goa', 'stay', 'Hotel', 4.6, 2100, 22500, 'colva', [73.908, 15.303], 'A calm resort set in paddy fields with a good spa, a short drive from the beach.', 'terraces', 'moss'),
    'taj-exotica': P('Taj Exotica Resort & Spa, Benaulim', 'stay', 'Hotel', 4.7, 3400, 38000, 'colva', [73.929, 15.244], 'Low-rise Mediterranean-style resort on a long, quiet beach.', 'sea', 'jade'),
    // Ponda
    'mangueshi-temple': P('Shri Mangueshi Temple', 'sight', 'Hindu Temple', 4.6, 14000, null, 'ponda', [73.977, 15.455], 'A serene 18th-century temple with a tall deepstambha; dress modestly.', 'city', 'ice'),
    'sahakari-spice-farm': P('Sahakari Spice Farm', 'nature', 'Tourist Attraction', 4.2, 9800, null, 'ponda', [74.0, 15.43], 'A guided walk through a spice plantation, ending with a Goan lunch on banana leaf.', 'forest', 'moss'),
    'safa-masjid': P('Safa Shahouri Masjid', 'sight', 'Historical Landmark', 4.4, 2100, null, 'ponda', [74.014, 15.402], 'A restored 16th-century mosque with a quiet garden and a water tank.', 'city', 'sand')
  },

  clarify: {
    types: { q: 'How should we shape your journey in Goa?', options: ['Beach downtime', 'Food and nightlife', 'Culture and nature', 'Wellness retreat'] },
    duration: { q: 'How many days would you like to give to Goa?', options: [{ label: 'A considered weekend (3–4 days)', days: 4 }, { label: 'An unhurried week (~7 days)', days: 7 }, { label: 'A fortnight by the sea (~14 days)', days: 14 }] },
    dates: { q: 'Select your travel dates for Goa so I can verify boutique stays and seasonal availability.' },
    base: { q: 'For this {type} journey, which quarter or sanctuary should anchor your stay?', options: ['Vibrant coastal stretch near Candolim', 'Quiet boutique enclave in Anjuna & Assagao', 'Historic Latin quarter in Panjim'] }
  },

  stays: {
    query: 'boutique hotels in North Goa India',
    found: 19,
    ids: ['hyatt-centric-candolim', 'taj-fort-aguada', 'casa-anjuna', 'panjim-inn', 'vivenda-dos-palhacos', 'alila-diwa', 'taj-exotica'],
    byBase: {
      'Beach strip, close to the action': 'hyatt-centric-candolim',
      'Vibrant coastal stretch near Candolim': 'hyatt-centric-candolim',
      'Quiet boutique village': 'casa-anjuna',
      'Quiet boutique enclave in Anjuna & Assagao': 'casa-anjuna',
      'Heritage quarter in Panjim': 'panjim-inn',
      'Historic Latin quarter in Panjim': 'panjim-inn'
    }
  },

  extras: {
    food: ['black-sheep-bistro', 'artjuna', 'hotel-venite', 'mums-kitchen', 'gunpowder', 'martins-corner'],
    nightlife: ['titos-club', 'hilltop-vagator', 'lpk-waterfront', 'curlies-anjuna'],
    relaxedDrop: 1
  },

  suggestions: ['Curate coastal tables & spice-scented lunches', 'Add sunset drinks & evening courtyards', 'Pace the days more leisurely'],

  replies: {
    planIntro: {
      'Beach downtime': "I'll build this around long, unhurried beach days, with one short outing each day and plenty of time by the water.",
      'Beach downtime & coastal quiet': "I'll shape this around unhurried coastal days: morning swims, time in shaded verandahs, and plenty of room to linger by the water.",
      'Food and nightlife': "I'll pair Goan tables and beach shacks with a few well-placed evenings out, spaced so each day still has room to breathe.",
      'Tables, shacks & evening culture': "I'll pair storied Goan tables and coastal shacks with twilight drinks, keeping the pacing unhurried and drives light.",
      'Culture and nature': 'I\'ll pair the Portuguese churches and the Mandovi with a few quiet nature stops, keeping the drives short.',
      'Churches, rivers & living heritage': "I'll weave together 16th-century chapels, the Mandovi estuary, and quiet village lanes, keeping drives measured and tranquil.",
      'Wellness retreat': "I'll keep the days slow: morning yoga or a spa, a simple lunch, and beaches that are quiet after lunch.",
      'Ayurveda & wellness retreats': "I'll design a restorative rhythm: sunrise yoga, Ayurvedic therapies, simple seasonal meals, and secluded beaches."
    },
    planDone: "Here's a {days}-day Goa plan for {month}, with each day anchored to one area so the driving stays short.\n\nI kept the pace relaxed, with **two or three stops a day** and time for a long lunch in between. Tell me about your dates and I'll add a hotel and a few restaurants that fit the route.",
    staysIntro: "I'll use a stylish North Goa base near the beach-and-nightlife stretch, then add a few well-placed Goan dining stops without overpacking your days.",
    staysDone: 'Your Goa plan is now dated **{range}**.\n\nI added **{stay}** as a centrally located base, plus two restaurant stops that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. The rest of the plan remains intentionally relaxed, with driving kept sensible between areas.',
    reserve: "I can't make reservations or book from this planner. Use the itinerary to contact restaurants, hotels and transfer providers directly, and confirm current prices and availability before you book.",
    relaxed: "I've lightened each day by removing the busiest stop, so there is more room for a long lunch, an afternoon rest, and unhurried wandering.",
    food: "I curated a selection of celebrated tables along your route, chosen for authentic regional craft and relaxed lunches rather than hurried stops.",
    nightlife: "I added a few evening spots for twilight drinks and coastal sundowners, keeping them close to your base so you have an easy return.",
    fallback: 'I can curate stays, add coastal tables, or soften the itinerary pace. Share what you’d like to adjust and I will refine the plan.'
  },

  deep: {
    steps: ['Reading the brief', 'Searching sources', 'Comparing bases and seasons', 'Checking availability', 'Writing the plan'],
    sources: [
      { title: 'Goa festivals and events calendar', domain: 'goa-tourism.gov.in', note: 'Official dates for Christmas, New Year and the Sunburn-season events.' },
      { title: 'Goa travel guide', domain: 'lonelyplanet.com', note: 'Area-by-area overview of the north and south coasts.' },
      { title: 'Where to stay in Goa: the best boutique hotels', domain: 'cntraveller.in', note: 'Editor picks in Candolim, Assagao and Panjim.' },
      { title: 'Things to do in North Goa', domain: 'tripadvisor.in', note: 'Traveller-reviewed attractions and restaurants.' },
      { title: 'Climate normals for Panaji', domain: 'mausam.imd.gov.in', note: 'December temperatures and rainfall.' },
      { title: 'How beach shack season works', domain: 'thehindu.com', note: 'Shack licensing and when they open and close.' },
      { title: 'Panjim and Fontainhas', domain: 'roughguides.com', note: 'Walking routes through the Latin Quarter.' },
      { title: 'Getting to Goa: Dabolim and Mopa airports', domain: 'timesofindia.indiatimes.com', note: 'Transfer times to the north and south coasts.' },
      { title: 'Churches and Convents of Goa', domain: 'whc.unesco.org', note: 'World Heritage listing for Old Goa.' },
      { title: "Goa's best restaurants beyond the shacks", domain: 'theculturetrip.com', note: 'Modern Goan kitchens in Panjim and Assagao.' },
      { title: 'Goa hotel prices by area and week', domain: 'booking.com', note: 'Nightly rates around Christmas and New Year.' },
      { title: 'A local guide to Goan food', domain: 'livemint.com', note: 'Dishes to order and where to find them.' }
    ],
    lines: [
      'Read goa-tourism.gov.in — festival calendar, Dec',
      'Read mausam.imd.gov.in — December climate normals for Panaji',
      'Searched "best base in North Goa for beach and food"',
      'Read lonelyplanet.com — Goa by area',
      'Read cntraveller.in — boutique hotels, Candolim to Assagao',
      'Compared drive times from Candolim, Anjuna and Panjim',
      'Read thehindu.com — beach shack season dates',
      'Checked booking.com — rates for the last week of December',
      'Read roughguides.com — Fontainhas walking route',
      'Drafted a relaxed day-by-day plan with short drives'
    ],
    report: {
      title: 'Goa in December: where to base yourself and how to pace it',
      summary: 'December is the best month for Goa, with dry, sunny days and shacks open along the north coast [1][5]. Base yourself in Candolim or Anjuna for beach access and restaurants, and reserve Panjim for a single day in the Latin Quarter [2][7].',
      sections: [
        { h: 'When to go', body: 'December falls in the dry season, with daytime highs around 31°C and almost no rain [5]. It is also the busiest month, with high prices for the week between Christmas and New Year [11]. If your dates are flexible, the first half of the month is calmer and cheaper [1][11].' },
        { h: 'Where to base yourself', body: 'The Candolim–Calangute strip is the easiest choice for a first visit, with wide beaches, many restaurants and short drives [2][4]. Anjuna and Assagao are quieter and food-led, with a good café scene [3][10]. Panjim suits a heritage-led stay but is a 30-minute drive from the northern beaches [7].' },
        { h: 'How to pace it', body: 'Keep to one area a day and no more than three stops, since traffic on the coast road slows quickly in season [8]. Save the churches of Old Goa for a morning and Fontainhas for a late afternoon [7][9].' },
        { h: 'Eating well', body: 'Beach shacks are open from October to May [6]. For Goan cooking that goes beyond fish thali, book restaurants in Panjim and Assagao a day or two ahead [10][12].' }
      ],
      table: {
        caption: 'Choosing a base',
        cols: ['Base', 'Feel', 'Best for', 'Beach', 'Drive to Panjim'],
        rows: [
          ['Candolim–Calangute', 'Lively, easy', 'First visits, families', 'Walk to the sand', '25–30 min'],
          ['Anjuna–Assagao', 'Relaxed, creative', 'Cafés, markets, nightlife', '5–10 min drive', '35–40 min'],
          ['Panjim (Fontainhas)', 'Heritage, walkable', 'Food and culture', 'None nearby', '—'],
          ['Colva–Benaulim', 'Quiet, spacious', 'Long beach days', 'Walk to the sand', '45–55 min']
        ]
      }
    }
  }
};
