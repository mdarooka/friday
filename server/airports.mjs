// Airport lookup. The dataset (server/data/airports.json) comes from OurAirports (public domain) via
// build/tools/refresh-airports.mjs. Typed home cities are geocoded with Open-Meteo's free, keyless API;
// only the city text is ever sent. If geocoding is unavailable we fall back to the dataset's municipality names.
import { readFileSync } from 'node:fs';

export const IN_CITY_KM = 40, NEARBY_KM = 80, NEAREST_KM = 400, GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
// Query rewriting only: colloquial or former names the geocoder may not know.
const aliases = new Map(Object.entries({
  bombay: 'Mumbai', bangalore: 'Bengaluru', madras: 'Chennai', calcutta: 'Kolkata', nyc: 'New York', 'new york city': 'New York',
  sf: 'San Francisco', 'san fran': 'San Francisco', 'bay area': 'San Francisco', la: 'Los Angeles', 'l.a.': 'Los Angeles',
  'new delhi': 'Delhi', cochin: 'Kochi', trivandrum: 'Thiruvananthapuram', poona: 'Pune', gurgaon: 'Gurugram'
}));

let dataset;
export function airportData() {
  if (!dataset) dataset = JSON.parse(readFileSync(new URL('./data/airports.json', import.meta.url), 'utf8')).map(([code, name, city, country, lat, lon, kind]) => ({ code, name, city, country, lat, lon, large: kind === 'L' }));
  return dataset;
}
let byCode;
export function airportByCode(code) {
  if (!byCode) byCode = new Map(airportData().map(a => [a.code, a]));
  return byCode.get(String(code || '').toUpperCase());
}
export const isKnownAirport = code => /^[A-Z]{3}$/.test(String(code || '')) && !!airportByCode(code);

/** "mumbai" -> "Mumbai", "new-york" -> "New-York", "o'fallon" -> "O'Fallon"; input that already mixes cases ("McAllen") is kept. */
export function titleCaseCity(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  return s.split(' ').map(w => /[a-z][A-Z]/.test(w) ? w : w.toLowerCase().replace(/(^|[\-'’.(/])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())).join(' ');
}

const toRad = d => d * Math.PI / 180;
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
const publicAirport = (a, km) => ({ code: a.code, name: a.name, city: a.city, ...(km === undefined ? { country: a.country } : { km: Math.round(km) }) });

function airportsAround(lat, lon) {
  const withKm = airportData().map(a => ({ a, km: haversineKm(lat, lon, a.lat, a.lon) }));
  // Only a city with its own airport (within IN_CITY_KM) gets airports picked for it; the metro group then extends to NEARBY_KM.
  // Anywhere else the user is asked which airport they fly from, with the closest ones as suggestions.
  const near = withKm.some(x => x.km <= IN_CITY_KM) ? withKm.filter(x => x.km <= NEARBY_KM).sort((x, y) => (y.a.large - x.a.large) || (x.km - y.km)).slice(0, 5) : [];
  if (near.length) return { airports: near.map(x => publicAirport(x.a, x.km)), nearest: [], needsAirport: false };
  const nearest = withKm.filter(x => x.km <= NEAREST_KM).sort((x, y) => x.km - y.km).slice(0, 5);
  return { airports: [], nearest: nearest.map(x => publicAirport(x.a, x.km)), needsAirport: true };
}

export function createAirportLookup({ fetch: fetchImpl = globalThis.fetch, timeoutMs = 5000, cacheSize = 500 } = {}) {
  const cache = new Map();
  const remember = (key, value) => { cache.delete(key); cache.set(key, value); if (cache.size > cacheSize) cache.delete(cache.keys().next().value); return value; };

  async function geocode(name) {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Geocoder returned ' + res.status);
    const body = await res.json();
    return (Array.isArray(body.results) ? body.results : []).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.name);
  }

  function fromMunicipality(name) {
    const key = name.toLowerCase();
    const matches = airportData().filter(a => a.city && a.city.toLowerCase() === key);
    if (!matches.length) return [];
    const anchor = matches.find(a => a.large) || matches[0];
    return [{ city: anchor.city, region: '', country: '', countryCode: anchor.country, lat: anchor.lat, lon: anchor.lon, ...airportsAround(anchor.lat, anchor.lon) }];
  }

  /** Candidate places for a typed city, each with its metro airports (or `nearest` + needsAirport when the city has none). Never throws. */
  async function lookup(query) {
    const typed = String(query || '').trim().replace(/\s+/g, ' ');
    if (!typed) return [];
    const key = typed.toLowerCase();
    if (cache.has(key)) return remember(key, cache.get(key));
    const name = aliases.get(key) || typed;
    let places = [];
    try {
      const seen = new Set();
      for (const r of await geocode(name)) {
        const id = [r.name, r.admin1, r.country_code].join('|');
        if (seen.has(id)) continue;
        seen.add(id);
        places.push({ city: r.name, region: r.admin1 || '', country: r.country || '', countryCode: r.country_code || '', lat: r.latitude, lon: r.longitude, ...airportsAround(r.latitude, r.longitude) });
      }
    } catch { places = []; }
    if (!places.length) places = fromMunicipality(name);
    return remember(key, places);
  }

  /** Dataset search by IATA code, airport name or municipality, for manual picking. */
  function search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    for (const a of airportData()) {
      const code = a.code.toLowerCase(), city = (a.city || '').toLowerCase(), name = a.name.toLowerCase();
      const score = code === q ? 0 : city === q ? 1 : code.startsWith(q) ? 2 : city.startsWith(q) ? 3 : name.startsWith(q) ? 4 : city.includes(q) ? 5 : name.includes(q) ? 6 : -1;
      if (score >= 0) scored.push([score, !a.large, a]);
    }
    return scored.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2].code.localeCompare(y[2].code)).slice(0, 10).map(([, , a]) => publicAirport(a));
  }

  return { lookup, search };
}
