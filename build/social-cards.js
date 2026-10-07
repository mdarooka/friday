'use strict';
/*
 * social-cards.js — the per-destination / per-guide Open Graph cards (assets/images/og/*.jpg, 1200×630).
 * Shared by the static build (build/templates.js, build/trip.js), the card renderer (build/tools/og-cards.js)
 * and the server (server/social-meta.mjs), so the catalogue of cards lives in exactly one place.
 *
 * CARD_VERSION is appended to every image URL as ?v=N. WhatsApp and Facebook cache link previews hard, so bump it
 * whenever a card is redrawn and the new image is picked up for links that have not been scraped yet.
 */
const CARD_VERSION = 1;
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/* The keys are catalogue destination ids (build/trip-data) or "<id>-guide" for a guide page. */
const DESTINATION_CARDS = {
  goa: { name: 'Goa', scene: 'sea', tone: 'ember', tagline: 'Beaches, Portuguese lanes and long lunches.' },
  kerala: { name: 'Kerala', scene: 'isles', tone: 'jade', tagline: 'Backwaters, hill stations and slow rail.' },
  rajasthan: { name: 'Rajasthan', scene: 'dunes', tone: 'sand', tagline: 'Palaces, desert camps and the long way round.' },
  ladakh: { name: 'Ladakh', scene: 'peaks', tone: 'slate', tagline: 'High passes, monasteries and thin air.' },
  srilanka: { name: 'Sri Lanka', scene: 'terraces', tone: 'moss', tagline: 'Tea hills, the southern coast and train windows.' },
  kyoto: { name: 'Kyoto', scene: 'forest', tone: 'ember', tagline: 'Temples, tea houses and autumn light.' },
};
const GUIDES = {
  kerala: { headline: 'A slower way through Kerala.', description: 'Itineraries, Munnar and the backwaters, from Kochi to the coast.' },
  kyoto: { headline: 'Kyoto, one slow day at a time.', description: 'Temples, tea houses and quiet streets, with a plan to start from.' },
};

const cardKeys = () => [...Object.keys(DESTINATION_CARDS), ...Object.keys(GUIDES).map((id) => `${id}-guide`)];
const cardFile = (key) => `assets/images/og/${key}.jpg`;
const hasCard = (key) => Object.prototype.hasOwnProperty.call(DESTINATION_CARDS, String(key).replace(/-guide$/, '')) &&
  (!/-guide$/.test(key) || Object.prototype.hasOwnProperty.call(GUIDES, key.replace(/-guide$/, '')));

/** Absolute, cache-busted URL of a card. `origin` is e.g. https://fridaytravel.vercel.app (no trailing slash needed). */
function cardUrl(key, origin) {
  if (!hasCard(key)) return null;
  const base = origin ? String(origin).replace(/\/+$/, '') + '/' : '';
  return `${base}${cardFile(key)}?v=${CARD_VERSION}`;
}

/** A user-supplied ?destination= value → a catalogue id, or null. Tolerates case and surrounding whitespace only. */
function normalizeDestinationId(raw) {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(id) && !/-guide$/.test(id) && Object.prototype.hasOwnProperty.call(DESTINATION_CARDS, id) ? id : null;
}

/** Free text ("Japan", "Kerala backwaters", "Goa") → a catalogue id using each destination's own `match` words. */
function matchDestinationText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  let catalogue = {};
  try { catalogue = require('./trip-data').DESTINATIONS || {}; } catch (_) { /* fall back to names below */ }
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  for (const id of Object.keys(DESTINATION_CARDS)) {
    const list = new Set([id, DESTINATION_CARDS[id].name.toLowerCase(), ...((catalogue[id] && catalogue[id].match) || [])].map((w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean));
    for (const word of list) if (words.includes(` ${word} `)) return id;
  }
  return null;
}

module.exports = {
  CARD_VERSION, CARD_WIDTH, CARD_HEIGHT, DESTINATION_CARDS, GUIDES,
  cardKeys, cardFile, hasCard, cardUrl, normalizeDestinationId, matchDestinationText,
};
