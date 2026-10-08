// Link-preview (Open Graph / Twitter) tags that depend on the request: a catalogue destination for
// trip.html?destination=<id>, and a shared itinerary for ?share=<token>. The static pages carry sensible defaults; the server
// swaps these in per request so a link pasted into WhatsApp shows a destination-specific title and card.
//
// Privacy: a shared-trip preview is built only from fields the share payload already exposes to anyone holding the link
// (title, destination, dates, stop count). No owner, conversation, booking or place-photo data reaches the tags.
import { createRequire } from 'node:module';

const cards = createRequire(import.meta.url)('../build/social-cards.js');

const clean = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
export const attr = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const absolute = (origin, path) => new URL(path, origin).href;
const cardAbsolute = (key, origin) => cards.cardUrl(key, String(origin).replace(/\/+$/, ''));
/** The site-wide card, for shared trips with no destination card of their own. */
export const siteCardUrl = (origin) => `${String(origin).replace(/\/+$/, '')}/${cards.SITE_CARD_FILE}?v=${cards.SITE_CARD_VERSION}`;

/** Meta for the planner opened on a catalogue destination (?destination=goa). Unknown ids → null (keep the defaults). */
export function destinationMeta(rawId, origin) {
  const id = cards.normalizeDestinationId(rawId);
  if (!id) return null;
  const d = cards.DESTINATION_CARDS[id];
  return {
    title: `Plan a trip to ${d.name} · Friday`,
    description: `${d.tagline} Tell Friday what you have in mind and start a ${d.name} itinerary.`,
    url: absolute(origin, `/trip.html?destination=${id}`),
    image: cardAbsolute(id, origin),
    alt: `Friday: plan a trip to ${d.name}`,
  };
}

/** Meta for a shared itinerary, from the already-sanitized share payload. */
export function shareMeta(data, { origin, token, pagePath = '/trip.html' }) {
  const title = clean(data && data.title, 90) || 'A journey';
  const destination = clean(data && data.destination, 120);
  const days = Array.isArray(data && data.days) ? data.days : [];
  const stops = days.reduce((n, day) => n + (day && Array.isArray(day.items) ? day.items.length : 0), 0);
  const start = clean(data && data.startDate, 10), end = clean(data && data.endDate, 10);
  const dateText = start ? (end && end !== start ? `${start}–${end}` : start) : '';
  const parts = [destination, dateText, stops ? `${stops} ${stops === 1 ? 'stop' : 'stops'}` : ''].filter(Boolean);
  const id = (data && typeof data.destId === 'string' && cards.normalizeDestinationId(data.destId)) || cards.matchDestinationText(`${destination} ${title}`);
  return {
    title: `${title} · a Friday itinerary`,
    description: (parts.length ? parts.join(' · ') + '. ' : '') + 'Shared with you on Friday.',
    url: absolute(origin, `${pagePath}?share=${token}`),
    image: id ? cardAbsolute(id, origin) : null,
    alt: id ? `Friday itinerary: ${cards.DESTINATION_CARDS[id].name}` : 'A Friday itinerary',
    cardId: id,
  };
}

/** Replace the page's title, description and og:/twitter: tags with `meta` (image falls back to `fallbackImage`). */
export function injectSocialMeta(html, meta, fallbackImage) {
  const image = meta.image || fallbackImage;
  const tags = [
    ['meta', 'property', 'og:title', meta.title], ['meta', 'property', 'og:description', meta.description],
    ['meta', 'property', 'og:type', 'website'], ['meta', 'property', 'og:url', meta.url],
    ['meta', 'property', 'og:image', image],
    ...(meta.image ? [['meta', 'property', 'og:image:width', '1200'], ['meta', 'property', 'og:image:height', '630']] : []),
    ['meta', 'property', 'og:image:alt', meta.alt],
    ['meta', 'name', 'twitter:card', 'summary_large_image'], ['meta', 'name', 'twitter:title', meta.title],
    ['meta', 'name', 'twitter:description', meta.description], ['meta', 'name', 'twitter:image', image],
  ].filter((t) => t[3]).map(([, kind, key, value]) => `<meta ${kind}="${key}" content="${attr(value)}">`).join('\n');
  const stripped = html
    .replace(/<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\s*/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${attr(meta.description)}">`);
  return stripped.replace('</head>', () => `${tags}\n</head>`);
}
