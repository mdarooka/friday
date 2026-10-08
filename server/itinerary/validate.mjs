/* Input validation for POST /api/itineraries. Returns { error } or { value }. */
import { generator, getDestination, matchDestination, freeformDestination, cleanPlaceName, TRIP_TYPES } from './catalog.mjs';

export const PACES = ['relaxed', 'normal', 'full'];
export const MAX_DAYS = 21;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

export function parseItineraryRequest(body, { freeform = false } = {}) {
  if (!isObj(body)) return { status: 400, error: 'Body must be a JSON object' };
  if (typeof body.destination !== 'string' || !body.destination) return { status: 400, error: '"destination" must be a destination id' };
  let dest = getDestination(body.destination) || (freeform ? matchDestination(body.destination) : null);
  if (!dest && freeform) {
    // Friday plans anywhere: a place that is not in the catalog is planned freely (OpenAI only), not refused.
    const name = cleanPlaceName(body.destination);
    if (!name) return { status: 400, error: '"destination" must be a place name of 2 to 80 characters' };
    dest = freeformDestination(name);
  }
  if (!dest) return { status: 404, error: 'Unknown destination "' + body.destination.slice(0, 40) + '"' };

  const menu = generator.typeLabels(dest);
  let types = body.types;
  if (types === undefined) types = dest.freeform ? ['Considered & relaxed'] : menu.slice(0, 1);
  if (!Array.isArray(types) || !types.length || types.length > 4) return { status: 400, error: '"types" must be 1 to 4 trip types' };
  for (const t of types) {
    if (dest.freeform) { if (typeof t !== 'string' || !t.trim() || t.length > 60) return { status: 400, error: 'Each trip type must be short text of up to 60 characters' }; continue; }
    if (typeof t !== 'string' || (!menu.includes(t) && !TRIP_TYPES.labels[t])) return { status: 400, error: 'Unknown trip type; choose from: ' + menu.join(', ') };
  }
  types = Array.from(new Set(types));

  const days = body.days;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { status: 400, error: '"days" must be a whole number from 1 to ' + MAX_DAYS };

  let dates = null;
  if (body.dates !== undefined && body.dates !== null) {
    if (!isObj(body.dates) || !generator.validIso(body.dates.start)) return { status: 400, error: '"dates.start" must be a date as YYYY-MM-DD' };
    dates = { start: body.dates.start };
  }

  let pace = 'normal';
  if (body.pace !== undefined) {
    if (!PACES.includes(body.pace)) return { status: 400, error: '"pace" must be one of ' + PACES.join(', ') };
    pace = body.pace;
  }

  let base = null;
  if (body.base !== undefined && body.base !== null) {
    if (typeof body.base !== 'string' || body.base.length > 120) return { status: 400, error: '"base" must be text of up to 120 characters' };
    base = body.base.trim() || null;
  }

  return { dest, value: { destination: dest.freeform ? dest.name : dest.id, types, days, dates, pace, base, ...(dest.freeform ? { freeform: true } : {}) } };
}
