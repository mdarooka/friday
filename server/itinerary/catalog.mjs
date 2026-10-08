/* The destination catalog: build/trip-data, read as it is (places with kind, area, rating, coordinates, blurb;
   areas with coordinates). Both modules are CommonJS/UMD, shared with the browser, so they load via createRequire. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const data = require('../../build/trip-data');
export const generator = require('../../assets/js/trip-generator.js');

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function getDestination(id) {
  return typeof id === 'string' && has(data.DESTINATIONS, id) ? data.DESTINATIONS[id] : null;
}

/** A destination outside the catalog. Friday plans anywhere; the catalog only enriches the six it knows. The places and
    areas are filled in from the model's own plan (see providers/openai.mjs), never from this object. */
export function freeformDestination(name) {
  return { id: 'freeform', name, freeform: true, areas: [], places: {}, clarify: { types: { options: [] } } };
}

/** A traveller's free text ("coorg", " Hampi ") as a place name: control characters out, 2 to 80 characters, or null. */
export function cleanPlaceName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name.length >= 2 && name.length <= 80 ? name : null;
}

/** The catalog destination a free-text value names (by id or by name), or null. */
export function matchDestination(raw) {
  const text = cleanPlaceName(raw);
  if (!text) return null;
  const key = text.toLowerCase();
  const direct = getDestination(key);
  if (direct) return direct;
  const id = data.ORDER.find((x) => String(data.DESTINATIONS[x].name).toLowerCase() === key);
  return id ? data.DESTINATIONS[id] : null;
}

function durations(d) {
  const opts = (d.clarify && d.clarify.duration && d.clarify.duration.options) || [];
  return opts.map((o) => ({ label: o.label, days: o.days }));
}

export function listDestinations() {
  return data.ORDER.map((id) => {
    const d = data.DESTINATIONS[id];
    return { id, name: d.name, tripTypes: generator.typeLabels(d), durations: durations(d) };
  });
}

/** What a client needs to plan against: no map geometry and no scripted chat copy. */
export function catalogOf(d) {
  return {
    id: d.id, name: d.name, region: d.region || null, currency: d.currency || null,
    tripTypes: generator.typeLabels(d), durations: durations(d),
    areas: d.areas, places: d.places,
    stays: { ids: (d.stays && d.stays.ids) || [], byBase: (d.stays && d.stays.byBase) || {} },
    acclimatisation: d.acclimatisation || null
  };
}

export const TRIP_TYPES = data.TRIP_TYPES;
