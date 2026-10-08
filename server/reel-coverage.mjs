import { createRequire } from 'node:module';
import { haversineKm } from './airports.mjs';
const { ORDER, DESTINATIONS } = createRequire(import.meta.url)('../build/trip-data');
const GENERIC = new Set(['japan','desert','backwater','houseboat','thar']);
const norm = v => String(v||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
export const covered = ORDER.map(id => {
  const d = DESTINATIONS[id], at = (Array.isArray(d.areas)?d.areas:Object.values(d.areas||{})).map(a=>a.at).filter(Boolean);
  const words = String(d.match||'').split(',').map(norm).filter(w=>w&&!GENERIC.has(w));
  return {id,name:d.name,lat:mean(at.map(p=>p[1])),lon:mean(at.map(p=>p[0])),pattern:new RegExp(`(?:^| )(?:${words.map(esc).join('|')})(?: |$)`)};
});
const byId = id => covered.find(c => c.id === id) || null;
const keywordMatch = text => { const n = norm(text); return n ? covered.find(c => c.pattern.test(n)) || null : null; };
const pub = c => ({id:c.id,name:c.name});
export function createReelCoverage({ lookup }) {
  const cache = new Map();
  const geocode = async (destination) => {
    const parts = String(destination).split(',').map(s=>s.trim()).filter(Boolean), later = parts.slice(1).map(norm);
    for (const query of [...new Set([parts[0], destination].filter(Boolean))]) {
      const places = (await lookup(query).catch(()=>[])) || [];
      if (!places.length) continue;
      return places.find(p => later.some(l => l && (l===norm(p.country)||l===norm(p.countryCode)))) || places[0];
    }
    return null;
  };
  async function compute(destination) {
    const direct = keywordMatch(destination);
    if (direct) return {covered:pub(direct)};
    const place = await geocode(destination);
    if (!place) return {alternatives:[],unknown:true};
    const near = keywordMatch(`${place.region||''}, ${place.country||''}`);
    if (near) return {covered:pub(near)};
    const alternatives = covered.map(c=>({id:c.id,name:c.name,km:Math.round(haversineKm(place.lat,place.lon,c.lat,c.lon))})).sort((a,b)=>a.km-b.km).slice(0,2);
    return {alternatives};
  }
  async function resolve(destination) {
    const key = norm(destination);
    if (cache.has(key)) return cache.get(key);
    const result = await compute(destination);
    if (!result.unknown) cache.set(key, result);   // a failed geocode is retried next time
    return result;
  }
  return {resolve,covered:covered.map(pub),byId:id=>{const c=byId(id);return c&&pub(c);}};
}
