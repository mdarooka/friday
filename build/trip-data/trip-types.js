'use strict';
/*
 * Shared tuning data for the itinerary generator (assets/js/trip-generator.js).
 *
 * Everything the generator decides by taste lives here, not in code and not per destination:
 *   profiles   kind weights for a style of trip (a place scores weight[kind] x a rating factor)
 *   labels     which profile each destination's trip-type label uses (the clarify.types options)
 *   pace       stops per day
 *   timeOfDay  when in the day each kind of place suits, used to order a day's stops
 *   phrases    slot phrasing appended to a place's own blurb to make the note
 *   tuning     scoring knobs
 *
 * A destination can override any of it with `tripTypes` in its own file:
 *   tripTypes: { 'My label': 'beach' }                       (use a shared profile)
 *   tripTypes: { 'My label': { profile: 'beach', weights: { food: 2 } } }   (tweak one)
 * This file must stay plain JSON-able data: it is embedded in the generated assets/js/trip-data.js.
 */

const profiles = {
  beach: {
    match: ['beach', 'coast', 'backwater', 'island', 'sea'],
    weights: { beach: 3, food: 1.6, nature: 1.3, wellness: 1.1, neighborhood: 1, sight: 0.9, market: 0.7, nightlife: 0.3, church: 0.3, museum: 0.2 }
  },
  'food-night': {
    match: ['nightlife', 'night'],
    weights: { food: 3, nightlife: 2.2, market: 1.8, neighborhood: 1.2, beach: 0.8, sight: 0.8, nature: 0.5, church: 0.3, museum: 0.3, wellness: 0.2 }
  },
  'food-markets': {
    match: ['food', 'market', 'bazaar', 'eat', 'table'],
    weights: { food: 3, market: 2.8, neighborhood: 1.6, sight: 1.2, museum: 0.7, nature: 0.5, church: 0.5, beach: 0.4, nightlife: 0.5, wellness: 0.2 }
  },
  heritage: {
    match: ['heritage', 'history', 'palace', 'fort', 'temple'],
    weights: { sight: 3, church: 2.4, museum: 2, neighborhood: 1.6, market: 1.4, food: 1.3, nature: 1, beach: 0.2, nightlife: 0.2, wellness: 0.3 }
  },
  culture: {
    match: ['culture', 'monaster', 'garden', 'art', 'craft'],
    weights: { sight: 3, church: 2.6, museum: 2.4, neighborhood: 1.8, nature: 1.6, market: 1.2, food: 1.2, beach: 0.3, nightlife: 0.2, wellness: 0.4 }
  },
  nature: {
    match: ['nature', 'wildlife', 'landscape', 'lake', 'hill', 'tea', 'adventure', 'autumn', 'leaves', 'outdoors'],
    weights: { nature: 3, sight: 1.6, beach: 0.9, food: 1, neighborhood: 0.7, wellness: 0.6, market: 0.4, museum: 0.3, church: 0.3, nightlife: 0.1 }
  },
  wellness: {
    match: ['wellness', 'ayurveda', 'yoga', 'spa', 'retreat'],
    weights: { wellness: 3, nature: 1.6, beach: 1.5, food: 1.3, neighborhood: 1, sight: 0.5, market: 0.4, museum: 0.3, church: 0.3, nightlife: 0.05 }
  },
  slow: {
    match: ['slow', 'luxury', 'relaxed', 'downtime', 'quiet'],
    // a gentle trip that also holds the far high areas back longer where a destination has any
    acclimatisationAfterDay: 5,
    weights: { wellness: 2.2, food: 2, nature: 1.6, sight: 1.4, neighborhood: 1.4, market: 1, museum: 0.8, beach: 1, church: 0.6, nightlife: 0.1 }
  },
  balanced: {
    match: [],
    weights: { sight: 1.6, food: 1.6, nature: 1.4, museum: 1, market: 1.2, neighborhood: 1.1, church: 0.9, beach: 1, wellness: 0.6, nightlife: 0.4 }
  }
};

const labels = {
  // Goa
  'Beach downtime': 'beach',
  'Beach downtime & coastal quiet': 'beach',
  'Food and nightlife': 'food-night',
  'Tables, shacks & evening culture': 'food-night',
  'Culture and nature': 'culture',
  'Churches, rivers & living heritage': 'culture',
  'Wellness retreat': 'wellness',
  'Ayurveda & wellness retreats': 'wellness',
  // Kerala
  'Backwaters and beaches': 'beach',
  'Backwaters, lagoons & quiet beaches': 'beach',
  'Tea hills and wildlife': 'nature',
  'Tea estates, mist & wildlife': 'nature',
  'Food and heritage': 'food-markets',
  'Spice tables & colonial heritage': 'food-markets',
  'Ayurveda and wellness': 'wellness',
  'Ayurveda, yoga & wellness sanctuaries': 'wellness',
  // Rajasthan
  'Palaces and forts': 'heritage',
  'Palaces, forts & royal residences': 'heritage',
  'Desert and wildlife': 'nature',
  'Desert dunes & wildlife reserves': 'nature',
  'Bazaars and food': 'food-markets',
  'Old bazaars, textiles & royal thalis': 'food-markets',
  'Slow luxury': 'slow',
  'Slow heritage luxury & palace retreats': 'slow',
  // Ladakh
  'Monasteries and culture': 'culture',
  'Ancient monasteries & living Buddhist culture': 'culture',
  'High-altitude adventure': 'nature',
  'High passes, valleys & mountain trails': 'nature',
  'Lakes and landscapes': 'nature',
  'High-altitude lakes & silent plains': 'nature',
  'Slow acclimatised trip': 'slow',
  'Slow acclimatised retreat & mountain quiet': 'slow',
  // Sri Lanka
  'Coast and beaches': 'beach',
  'Southern coastline & palm-fringed bays': 'beach',
  'Culture and heritage': 'heritage',
  'Ancient kingdoms & Buddhist sanctuaries': 'heritage',
  'Hills, tea and trains': 'nature',
  'Tea estates, misty ridges & highland rail': 'nature',
  'Wildlife and nature': 'nature',
  'National parks & wild leopard country': 'nature',
  // Kyoto
  'Temples and gardens': 'culture',
  'Zen temples, rock gardens & quiet paths': 'culture',
  'Food and markets': 'food-markets',
  'Kaiseki tables, soba & Nishiki market': 'food-markets',
  'Autumn leaves': 'nature',
  'Momiji autumn foliage & moss gardens': 'nature',
  'Slow tea and craft': 'slow',
  'Slow tea ceremonies & artisanal craft': 'slow'
};

const pace = {
  default: 'normal',
  relaxed: { stops: 2 },
  normal: { stops: 3 },
  full: { stops: 4 }
};

// 0 is first thing in the morning, 1 is late night. Stops in a day are ordered by this.
const timeOfDay = {
  kinds: {
    wellness: 0.2, nature: 0.22, sight: 0.25, market: 0.3, church: 0.35, museum: 0.42,
    food: 0.55, neighborhood: 0.6, beach: 0.68, nightlife: 0.95
  },
  defaultKind: 0.5,
  // a second food stop in one day is dinner rather than lunch
  dinner: 0.87,
  // upper bound (exclusive) of each slot, in order; the last one takes the rest
  slots: [
    { key: 'morning', below: 0.4 },
    { key: 'midday', below: 0.62 },
    { key: 'afternoon', below: 0.8 },
    { key: 'evening', below: 2 }
  ]
};

// Slot phrasing. `default` applies to any kind; a kind key overrides it for that kind.
const phrases = {
  morning: {
    default: ['Go early, before the crowds and the heat.', 'A good first stop, while the light is soft.', 'Start here, when it is quiet.'],
    nature: ['Best early, when the air is cool and the place is still.', 'Go first thing for the calmest hour.'],
    wellness: ['Book the morning slot and leave the hour afterwards free.', 'An early start here sets the tone for the day.'],
    market: ['Go early for the best browsing and the fewest crowds.', 'Mornings are when it is busiest and at its best.']
  },
  midday: {
    default: ['Take it slowly through the middle of the day.', 'A comfortable stop while the sun is high.'],
    food: ['Make this a long, unhurried lunch.', 'A slow lunch, with time to rest afterwards.', 'Plan lunch here and let the afternoon stay open.'],
    museum: ['A good cool, covered stop for the hottest hours.'],
    beach: ['Spend a long stretch here; bring shade.']
  },
  afternoon: {
    default: ['Come in the late afternoon, once the heat has eased.', 'Leave time to linger here as the light softens.'],
    beach: ['Come for the last hours of light.', 'A long afternoon here, with the evening left open.'],
    neighborhood: ['Wander in the late afternoon and stop for a coffee.', 'Best on foot, with no fixed plan.'],
    sight: ['Late afternoon is kinder on the legs and on the light.']
  },
  evening: {
    default: ['A gentle way to close the day.', 'Stay until the light fades.'],
    food: ['Book an early dinner and keep the night easy.', 'A table here makes a fine end to the day.'],
    nightlife: ['For a late night only; arrive after ten and sort the ride back in advance.', 'Keep this optional, and keep a ride booked.'],
    beach: ['A sunset stop, with nothing planned afterwards.']
  },
  // the first day at altitude: rest, water, nothing strenuous
  rest: {
    default: ['Keep it easy on your first day at altitude: drink water and stop if you feel light-headed.', 'No exertion today; your body needs the time.'],
    food: ['An early, light meal. Skip alcohol tonight and sleep well.', 'Rest and a warm drink, nothing more.']
  },
  // when every place has been used and the plan has to come back to one
  revisit: ['Come back with fresh eyes. ', 'A slower second pass. ', 'Keep this one unhurried. ', 'A quieter angle on it. ']
};

const tuning = {
  unknownKindWeight: 0.3,
  // a place's score is weight x (ratingFloor .. ratingCeil) by rating; unrated places sit in the middle
  ratingFloor: 0.8,
  ratingCeil: 1.2,
  ratingLow: 3.5,
  ratingHigh: 5,
  // each stop of the same kind already in a day multiplies the next one's score by this
  diversity: 0.55,
  maxPerKind: { nightlife: 1, food: 2 },
  // score lost per degree of distance from the previous day's area, and per earlier day in the same area
  distance: 1.5,
  areaRepeat: 0.6,
  stay: { note: 'Check in and settle in', nearFirstDay: 0.3 },
  maxDays: 21
};

module.exports = { profiles, labels, pace, timeOfDay, phrases, tuning };
