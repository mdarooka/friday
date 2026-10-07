// Local-only browser acceptance fixture. Never imported by production startup.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';

const host = '127.0.0.1';
const port = Number(process.env.FRIDAY_FIXTURE_PORT || 4873);
const origin = `http://${host}:${port}`;
const email = 'preview@example.test';
const password = 'Preview Friday Test 2026!';
const directory = await mkdtemp(path.join(os.tmpdir(), 'friday-browser-fixture-'));
let stopping = false;

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixtureResearch = async (input, _config, progress) => {
  for (const stage of ['Reading your brief', 'Checking Kyoto sources', 'Building a test itinerary']) {
    progress(`TEST FIXTURE · ${stage}`);
    await pause(1400);
  }
  return {
    text: 'TEST FIXTURE RESULT — deterministic sample for checking review and apply. This is not live travel research.',
    sources: [{ title: 'TEST FIXTURE · Kyoto City Official Tourism', url: 'https://kyoto.travel/en/' }],
    places: [{ title: 'TEST FIXTURE · Philosopher’s Path', city: 'Kyoto', category: 'Walk', description: 'A fixture-only sample stop. No live place data or photographs are supplied.', url: 'https://kyoto.travel/en/see-and-do/philosophers-path.html', sourceUrl: 'https://kyoto.travel/en/' }],
    days: [{ title: 'TEST FIXTURE · East Kyoto', date: '', notes: 'Sample itinerary for review; adjust before applying.', items: [{ title: 'TEST FIXTURE · Philosopher’s Path', time: '09:30', notes: 'Fixture entry with no claimed live hours, rating, or photo.', address: '', url: 'https://kyoto.travel/en/see-and-do/philosophers-path.html', sourceUrl: 'https://kyoto.travel/en/' }] }],
    questions: ['TEST FIXTURE · Which neighborhood would you like to explore next?'],
  };
};

const server = createApp({
  dbPath: path.join(directory, 'fixture.sqlite'),
  origin,
  ai: { provider: 'claude', apiKey: 'fixture-only', model: 'fixture-only', deepModel: 'fixture-only' },
  research: fixtureResearch,
});

async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}

server.listen(port, host, async () => {
  try {
    const response = await fetch(`${origin}/api/auth/signup`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Preview Traveler', email, password }),
    });
    if (!response.ok) throw new Error(`Fixture account setup failed (${response.status}).`);
    console.log(`Friday browser test fixture: ${origin}/app.html`);
    console.log(`Sign in: ${email} / ${password}`);
    console.log('Deep research is deterministic and labeled TEST FIXTURE; no production AI or photo data is used.');
  } catch (error) {
    console.error(error.message);
    await stop();
    process.exitCode = 1;
  }
});

process.on('SIGINT', () => { void stop().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void stop().then(() => process.exit(0)); });
