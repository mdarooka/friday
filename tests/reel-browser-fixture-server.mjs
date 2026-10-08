/* Synthetic browser acceptance fixture for the reel-to-itinerary flow.
 * Loopback only, disposable in-memory PGlite, deterministic research, and no email credentials.
 * Use a reel URL containing `/unavailable` to exercise the confirmation fallback.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';

const dir = await mkdtemp(path.join(os.tmpdir(), 'friday-reel-qa-'));
const sourceUrl = 'https://fixture.example/sources/kyoto';

const researchLink = async ({ url, note }) => {
  if (new URL(url).pathname.includes('/unavailable')) {
    throw Object.assign(new Error('Synthetic fixture: the public reel is unavailable.'), { status: 503 });
  }
  return {
    url,
    extracted: true,
    title: 'Synthetic Kyoto reel',
    summary: 'Fixture-only public post identifies the fictional QA Garden in Kyoto.',
    places: [{ title: 'QA Garden · Synthetic', description: 'A fictional fixture landmark.', sourceUrl }],
    sources: [{ title: 'Synthetic travel research source', url: sourceUrl }],
    note,
  };
};

const research = async ({ prompt }) => {
  const count = Number(prompt.match(/EXACTLY (\d+) days/i)?.[1] || 3);
  const place = prompt.match(/exact anchor name “([^”]+)”/i)?.[1] || 'QA Garden · Synthetic';
  return {
    text: 'Synthetic, price-free itinerary for browser acceptance only.',
    sources: [{ title: 'Synthetic travel research source', url: sourceUrl }],
    days: Array.from({ length: count }, (_, index) => ({
      title: `Fixture day ${index + 1}`,
      date: '',
      notes: 'A fictional day used to preview edits and source citations.',
      items: [{ title: index === 0 ? place : `QA Kyoto stop ${index + 1} · Synthetic`, description: 'Synthetic fixture stop; confirm current details before travel.', sourceUrl }],
    })),
    questions: [],
    places: [],
  };
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = createApp({
  root,
  memory: true,
  origin: 'http://localhost:4876',
  env: {
    APP_ORIGIN: 'http://localhost:4876',
    AUTH_PROVIDER: 'local',
    AUTH_REQUIRED: 'false',
    AI_PROVIDER: 'claude',
    AI_MODEL: 'fixture-only-model',
    ANTHROPIC_API_KEY: 'fixture-only-key',
  },
  ai: { provider: 'claude', apiKey: 'fixture-only-key', model: 'fixture-only-model' },
  researchLink,
  reelResearch: research,
  reelInterpret: async (text) => ({fields: {
    ...(text.includes('Garden')?{placeName:'QA Garden · Synthetic',destination:'Kyoto, Japan'}:{}),
    ...(text.includes('3 days')?{days:3,travelers:2}:{}),
    ...(text.includes('2027-04-01')?{startDate:'2027-04-01'}:{})
  },edit:/slower|relaxed/.test(text)}),
  log: () => {},
});

server.listen(4876, '127.0.0.1', () => {
  console.log(`Synthetic reel acceptance fixture: http://127.0.0.1:4876/app.html`);
  console.log('Database: in-memory PGlite, discarded on exit.');
  console.log('Reel URL containing /unavailable triggers the explicit unverified-reel confirmation path.');
  console.log('No production database, credentials, external research, or email delivery is used.');
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop().then(() => process.exit(0)); });
