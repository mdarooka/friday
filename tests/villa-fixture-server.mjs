/* Disposable, clearly synthetic demo for a browser QA session. Uses a temp SQLite file and fake Google/AI providers. */
import { mkdtemp, rm } from 'node:fs/promises';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { openStore, closeStore, createUser, findUserByEmail, insertVilla } from '../server/store.mjs';

const dir = await mkdtemp(path.join(os.tmpdir(), 'friday-villa-qa-'));
const dbPath = path.join(dir, 'villa-demo.sqlite');
const email = 'villa-admin@example.test';
const password = 'Friday-Villa-QA-Only-2026';
const salt = randomBytes(16).toString('hex');
const db = openStore(dbPath);
createUser(db, { id: randomUUID(), email, name: 'QA Villa Admin', password: `${salt}:${scryptSync(password, salt, 64).toString('hex')}` });
const owner = findUserByEmail(db, email);
const created = new Date().toISOString();
const villaData = {
  name: 'QA Villa · Synthetic Demo', description: 'A fixture-only stay used for browser QA. This is not a real property.', city: 'Alibaug', address: 'Synthetic demo coordinates',
  lat: 18.641, lng: 72.872, googleMapsUrl: 'https://maps.google.com/?q=Synthetic+Villa', googlePlaceId: 'ChIJsyntheticVilla',
  bedrooms: 3, maxGuests: 6, amenities: ['Fixture pool', 'Fixture garden'], status: 'published', nearby: [
    { id: 'fixture-beach', name: 'QA Beach · Synthetic', description: 'Fixture-only host-curated beach.', lat: 18.644, lng: 72.875, category: 'things-to-do', mapsUrl: 'https://maps.google.com/?q=QA+Beach' },
    { id: 'fixture-cafe', name: 'QA Cafe · Synthetic', description: 'Fixture-only host-curated cafe.', lat: 18.643, lng: 72.873, category: 'cafes', mapsUrl: 'https://maps.google.com/?q=QA+Cafe' },
    { id: 'fixture-table', name: 'QA Table · Synthetic', description: 'Fixture-only host-curated restaurant.', lat: 18.642, lng: 72.874, category: 'restaurants', mapsUrl: 'https://maps.google.com/?q=QA+Table' },
  ],
};
insertVilla(db, { id: '12345678-1234-4abc-8abc-123456789abc', ownerId: owner.id, status: 'published', data: JSON.stringify(villaData), created, updated: created });
closeStore(db);

const fixturePlace = (id, title, lat, lng) => ({ id, googlePlaceId: id, title, address: `${title} · QA fixture`, url: `https://maps.google.com/?q=${encodeURIComponent(title)}`, sourceUrl: `https://maps.google.com/?q=${encodeURIComponent(title)}`, location: { latitude: lat, longitude: lng }, rating: 4.8 });
const demoPlaces = Object.assign(async () => null, {
  searchNearby: async ({ category, lat, lng }) => {
    const [id, title] = category === 'cafes' ? ['ChIJqaCafe1001', 'QA Cafe · Synthetic'] : category === 'restaurants' ? ['ChIJqaTable1001', 'QA Table · Synthetic'] : ['ChIJqaBeach1001', 'QA Beach · Synthetic'];
    const delta = category === 'cafes' ? 0.002 : category === 'restaurants' ? 0.003 : 0.004;
    return { status: 200, data: { places: [fixturePlace(id, title, lat + delta, lng + delta)] } };
  },
  getDetails: async id => ({ status: 200, data: { place: fixturePlace(id, 'QA Selected Place · Synthetic', 18.644, 72.875) } }),
});
const demoResearch = async ({ prompt }) => {
  const requestedDays = Number(prompt.match(/Create a (\d+)-day/)?.[1] || 3);
  const ids = [...prompt.matchAll(/\{"id":"(ChIJ[a-zA-Z0-9_-]+)","name"/g)].map(match => match[1]);
  return { text: JSON.stringify({ days: Array.from({ length: requestedDays }, (_, index) => ({ stops: ids[index] ? [ids[index]] : [] })) }) };
};
const server = createApp({
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dbPath,
  env: { ITINERARY_PROVIDER: 'local', AUTH_REQUIRED: 'false', VILLA_ADMIN_EMAILS: email, GOOGLE_PLACES_API_KEY: 'fixture-only-key', ANTHROPIC_API_KEY: 'fixture-only-key', AI_MODEL: 'fixture-only-model' },
  places: demoPlaces, ai: { apiKey: 'fixture-only-key', model: 'fixture-only-model', provider: 'claude' }, villaResearch: demoResearch,
});
const port = Number(process.env.VILLA_FIXTURE_PORT || 4873);
server.listen(port, '127.0.0.1', () => console.log(`Synthetic villa QA: http://localhost:${port}/villa.html?id=12345678-1234-4abc-8abc-123456789abc | sign-in ${email} / ${password} | temporary DB ${dbPath}`));
let cleaning = false;
async function stop() { if (cleaning) return; cleaning = true; await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop().then(() => process.exit(0)); });
