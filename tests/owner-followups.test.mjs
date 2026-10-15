import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareBriefing } from '../server/briefing.mjs';
import { startApp, signUp } from './helpers.mjs';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('prepareBriefing reads a planner trip from plan.days, destId and prefs.dates', () => {
  const briefing = prepareBriefing({
    tripId: '11111111-1111-4111-8111-111111111111',
    tripData: {
      title: 'Goa Beach Vacation',
      destId: 'goa',
      prefs: { dates: { start: '2026-12-01', end: '2026-12-04' } },
      plan: { stay: 'panjim-inn', days: [{ town: 'Panaji', date: '2026-12-01', items: [{ place: 'fontainhas', note: 'Walk the lanes' }, { place: 'not-a-real-place' }] }] },
    },
    origin: 'https://friday.example',
  });
  assert.equal(briefing.destination, 'Goa');
  assert.equal(briefing.departureDate, '2026-12-01');
  assert.equal(briefing.endDate, '2026-12-04');
  assert.equal(briefing.days[0].title, 'Panaji');
  assert.equal(briefing.days[0].items[0].title, 'Fontainhas (quarter)');
  assert.equal(briefing.days[0].items[0].notes, 'Walk the lanes');
  assert.equal(briefing.days[0].items[1].title, 'not-a-real-place');
  assert.equal(briefing.stay.name, 'Panjim Inn');
});

test('an empty saved days list still falls through to the planner plan', () => {
  const briefing = prepareBriefing({
    tripId: '11111111-1111-4111-8111-111111111111',
    tripData: { title: 'Goa', destId: 'goa', days: [], plan: { days: [{ title: 'Old Goa', items: [{ title: 'Basilica of Bom Jesus' }] }] } },
    origin: 'https://friday.example',
  });
  assert.equal(briefing.days[0].items[0].title, 'Basilica of Bom Jesus');
});

test('one click turns a planner trip into a quote and opens the designer view', async (t) => {
  const { request } = await startApp(t, {
    env: { AUTH_PROVIDER: 'local', AUTH_REQUIRED: 'true', QUOTE_ADMIN_EMAILS: 'quoteadmin@example.com', VILLA_ADMIN_EMAILS: 'quoteadmin@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
  });
  const admin = await signUp(request, 'QuoteAdmin');
  const traveler = await signUp(request, 'Traveler');
  const other = await signUp(request, 'Other');
  const created = await request('/api/trips', 'POST', { data: {
    title: 'Goa Beach Vacation',
    destId: 'goa',
    prefs: { dates: { start: '2026-12-01', end: '2026-12-04' }, travelers: 2 },
    plan: { stay: 'panjim-inn', days: [{ town: 'Panaji', date: '2026-12-01', items: [{ place: 'fontainhas', note: 'Walk the lanes' }] }] },
    messages: [{ role: 'user', text: 'SECRET_CHAT_LINE' }],
  } }, { cookie: traveler.cookie });
  assert.equal(created.status, 201);
  const tripId = created.result.record.id;
  const empty = await request('/api/trips', 'POST', { data: { title: 'Untitled' } }, { cookie: traveler.cookie });
  assert.equal((await request(`/api/trips/${tripId}/quote`, 'POST', {})).status, 401);
  assert.equal((await request(`/api/trips/${empty.result.record.id}/quote`, 'POST', {}, { cookie: traveler.cookie })).status, 422);
  assert.equal((await request(`/api/trips/${tripId}/quote`, 'POST', {}, { cookie: other.cookie })).status, 404);

  const first = await request(`/api/trips/${tripId}/quote`, 'POST', { days: [{ title: 'Ignored client day' }] }, { cookie: traveler.cookie });
  assert.equal(first.status, 201);
  assert.equal(first.result.already, false);
  assert.match(first.result.replyBy.text, /^Your designer replies by /);
  const snap = first.result.quote.snapshot;
  assert.equal(snap.kind, 'planner_trip');
  assert.equal(snap.tripId, tripId);
  assert.equal(snap.destination, 'Goa');
  assert.equal(snap.travelers, 2);
  assert.equal(snap.flexibleBudget, true);
  assert.match(snap.instructions, /Nothing is held/);
  assert.equal(snap.days[0].items[0].title, 'Fontainhas (quarter)');
  assert.equal(snap.stay.name, 'Panjim Inn');
  assert.equal(snap.messages, undefined);
  assert.doesNotMatch(JSON.stringify(snap), /SECRET_CHAT_LINE|Ignored client day/);

  const again = await request(`/api/trips/${tripId}/quote`, 'POST', {}, { cookie: traveler.cookie });
  assert.equal(again.status, 200);
  assert.equal(again.result.already, true);
  assert.equal(again.result.quote.id, first.result.quote.id);

  const view = await request(`/api/admin/trips/${tripId}`, 'GET', undefined, { cookie: admin.cookie });
  assert.equal(view.status, 200);
  assert.equal(view.result.trip.destination, 'Goa');
  assert.equal(view.result.trip.startDate, '2026-12-01');
  assert.equal(view.result.trip.days[0].items[0].title, 'Fontainhas (quarter)');
  assert.equal(view.result.trip.stay.name, 'Panjim Inn');
  assert.doesNotMatch(JSON.stringify(view.result), /SECRET_CHAT_LINE/);

  const preview = await request(`/api/admin/quotes/${first.result.quote.id}/preview`, 'POST', {
    amount: 1200, currency: 'INR', details: 'A designer confirms availability.',
  }, { cookie: admin.cookie });
  assert.equal(preview.status, 200);
  assert.match(preview.result.preview.text, /Fontainhas \(quarter\)/);
  assert.match(preview.result.preview.text, /Panaji/);
  assert.doesNotMatch(preview.result.preview.text, /SECRET_CHAT_LINE/);
});

test('served sitemap hides villa pages while none are published, and the file on disk keeps them', async (t) => {
  const onDisk = await read('sitemap.xml');
  assert.match(onDisk, /villas\.html/);
  const { request } = await startApp(t, {
    env: { AUTH_PROVIDER: 'local', AUTH_REQUIRED: 'true', VILLA_ADMIN_EMAILS: 'quoteadmin@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
  });
  const empty = await request('/sitemap.xml');
  assert.equal(empty.status, 200);
  assert.doesNotMatch(empty.result, /villas\.html/);
  assert.doesNotMatch(empty.result, /\/villa\.html/);
  assert.match(empty.result, /<urlset/);
  const admin = await signUp(request, 'QuoteAdmin');
  const created = await request('/api/admin/villas', 'POST', { villa: { name: 'Palm Courtyard', city: 'Alibaug', maxGuests: 6, status: 'published' } }, { cookie: admin.cookie });
  assert.equal(created.status, 201);
  const listed = await request('/sitemap.xml');
  assert.match(listed.result, /villas\.html/);
});

test('designer calls stay on the existing callback, and empty villas hide in the client', async () => {
  const guide = await read('goa-guide.html');
  const weekend = await read('mumbai-quiet-weekend.html');
  const about = await read('about.html');
  assert.match(guide, /data-guide-cta="callback"[^>]*>Talk to a designer/);
  assert.match(weekend, /contact\.html\?from=mumbai-quiet-weekend&amp;quote_path=guide&amp;destination=mumbai-quiet-weekend#quote/);
  assert.match(weekend, /Ask Friday to plan this weekend/);
  for (const html of [guide, weekend, about]) assert.doesNotMatch(html, /data-talk-bar/);
  const siteCss = await read('assets/css/friday.css');
  const plannerCss = await read('assets/css/trip.css');
  const friday = await read('assets/js/friday.js');
  const workspace = await read('assets/js/trip-workspace.js');
  const integrations = await read('assets/js/trip-integrations.js');
  assert.match(siteCss, /\.nav__link\s*\{[^}]*letter-spacing:\s*\.21em/);
  assert.doesNotMatch(siteCss, /\.talk-bar\s*\{/);
  assert.doesNotMatch(plannerCss, /\.fx-talk-chip/);
  assert.doesNotMatch(plannerCss, /\.fx-planner-contact\s*\{[^}]*position:\s*fixed/);
  assert.match(integrations, /Talk to your designer/);
  assert.doesNotMatch(integrations, /fx-talk-chip/);
  assert.match(friday, /\/api\/villas/);
  assert.match(friday, /a\[href="villas\.html"\], a\[href="\/villas\.html"\]/);
  assert.match(friday, /data\.villas\.length/);
  assert.match(workspace, /data-ws="quote"/);
  assert.match(workspace, /Ask for a quote/);
});
