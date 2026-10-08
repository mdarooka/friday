// Regenerates server/data/airports.json from OurAirports (public domain).
//   node build/tools/refresh-airports.mjs [path/to/airports.csv]   (downloads the CSV when no path is given)
// Keeps scheduled-service large/medium airports that have a 3-letter IATA code, as compact rows:
//   [iata, name, municipality, iso_country, lat, lon, 'L' | 'M']
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../server/data/airports.json');

/** RFC 4180 CSV parser: quoted fields may contain commas, doubled quotes and newlines. */
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function buildAirports(csv) {
  const [header, ...rows] = parseCsv(csv);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const seen = new Set(), list = [];
  for (const r of rows) {
    const type = r[col.type], iata = (r[col.iata_code] || '').toUpperCase();
    if (!['large_airport', 'medium_airport'].includes(type) || r[col.scheduled_service] !== 'yes' || !/^[A-Z]{3}$/.test(iata) || seen.has(iata)) continue;
    const lat = Number(r[col.latitude_deg]), lon = Number(r[col.longitude_deg]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    seen.add(iata);
    list.push([iata, r[col.name], r[col.municipality], r[col.iso_country], Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, type === 'large_airport' ? 'L' : 'M']);
  }
  return list.sort((a, b) => a[0].localeCompare(b[0]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  const csv = arg ? await readFile(arg, 'utf8') : await (async () => { const res = await fetch(SOURCE, { signal: AbortSignal.timeout(60000) }); if (!res.ok) throw new Error('Download failed: ' + res.status); return res.text(); })();
  const list = buildAirports(csv);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(list));
  console.log(`Wrote ${list.length} airports to ${path.relative(process.cwd(), out)}`);
}
