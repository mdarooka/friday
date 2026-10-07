import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../server/store.mjs';
import { runBriefingSweep, nextBriefingRunAt, msUntilNextBriefingRun, briefingAutosendMode } from '../server/briefing-scheduler.mjs';

const origin = 'https://friday.example';
const day = (base, n) => new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10);

async function setup(t, { days = 5, dateStatus = 'confirmed', email = 'traveller@example.com' } = {}) {
  const db = store.openStore({ memory: true });
  t.after(() => db.close());
  await store.createUser(db, { id: 'u1', email, name: 'T', password: 'x' });
  const base = new Date('2026-10-07T04:00:00Z');
  const tripId = '6c0c0b79-689a-47ab-a2da-2c0bba79ee7c', start = day(base, days);
  const rows = [{ id: tripId, data: JSON.stringify({ title: 'Kerala', startDate: start, endDate: day(base, days + 4) }) }];
  await store.insertRecord(db, { id: 'b1', userId: 'u1', kind: 'bookings', data: JSON.stringify({ tripId, title: 'Flight', start, dateStatus }), updated: base.toISOString() });
  const sent = [];
  const emailService = { configured: true, async send(m) { sent.push(m); const r = await store.createEmailOutbox(db, { id: m.dedupeKey, dedupeKey: m.dedupeKey, kind: m.kind, recipient: m.to, subject: m.subject, content: '{}', status: 'provider_accepted', created: base.toISOString(), updated: base.toISOString() }); return await store.getEmailOutboxByKey(db, m.dedupeKey); } };
  const sweep = (mode, offsetDays = 0, extra = {}) => runBriefingSweep({ db, store, trips: { list: async () => rows }, emailService, origin, now: new Date(base.getTime() + offsetDays * 86400000), mode, ...extra });
  return { db, sent, sweep, tripId, rows, base };
}

test('dry-run sends nothing and records would_send without recipient data', async t => {
  const { db, sent, sweep, tripId } = await setup(t);
  const result = await sweep('dry-run');
  assert.equal(result.would_send, 1);
  assert.equal(sent.length, 0);
  const items = await store.listBriefingRunItems(db);
  assert.deepEqual(items.map(i => [i.trip_id, i.outcome, i.days_before]), [[tripId, 'would_send', 5]]);
  assert.ok(!JSON.stringify(items).includes('traveller@example.com'));
  assert.equal((await sweep('dry-run')).skipped, 'already_ran');
  assert.equal((await store.listBriefingRunItems(db)).length, 1);
});

test('live is held back until three distinct dry-run days exist', async t => {
  const { sent, sweep, db } = await setup(t);
  const gated = await sweep('live');
  assert.equal(gated.mode, 'dry-run');
  assert.match(gated.note, /gated/);
  assert.equal(sent.length, 0);
  await sweep('dry-run', 1);
  assert.equal((await sweep('live', 1)).mode, 'dry-run');   // 2 dry days only
  assert.equal(sent.length, 0);
  await sweep('dry-run', 2);
  assert.equal(await store.countCompletedBriefingDryRunDays(db), 3);
  const live = await sweep('live', 2);
  assert.equal(live.mode, 'live');
  assert.equal(live.sent, 1);
  assert.equal(sent.length, 1);
});

test('live sends exactly once across sweeps and uses the auto-tagged link', async t => {
  const { sent, sweep } = await setup(t);
  for (const d of [0, 1, 2]) await sweep('dry-run', d);
  assert.equal((await sweep('live', 2)).sent, 1);
  assert.equal((await sweep('live', 3)).skipped_already_sent, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].dedupeKey, /^briefing-auto:6c0c0b79-689a-47ab-a2da-2c0bba79ee7c:2026-10-12$/);
  assert.match(sent[0].text, /ref=briefing&trip=6c0c0b79[^\s]*&src=auto/);
});

test('a trip an admin already briefed is skipped', async t => {
  const { sent, sweep, db, tripId, base } = await setup(t);
  for (const d of [0, 1, 2]) await sweep('dry-run', d);
  await store.createEmailOutbox(db, { id: 'a', dedupeKey: `briefing:${tripId}:req1`, kind: 'pre_departure_briefing', recipient: 'x@example.com', subject: 's', content: '{}', status: 'provider_accepted', created: base.toISOString(), updated: base.toISOString() });
  assert.equal((await sweep('live', 2)).skipped_already_sent, 1);
  assert.equal(sent.length, 0);
});

test('trips 8+ days out, unconfirmed bookings, and missing emails are not sent', async t => {
  const far = await setup(t, { days: 8 });
  assert.equal((await far.sweep('dry-run')).selected, 0);
  const unconfirmed = await setup(t, { dateStatus: 'needs-clarification' });
  assert.equal((await unconfirmed.sweep('dry-run')).selected, 0);
  const noEmail = await setup(t, { email: 'not-an-email' });
  assert.equal((await noEmail.sweep('dry-run')).skipped_no_email, 1);
});

test('off mode does nothing, and mode parsing defaults to dry-run', async t => {
  const { sweep, db } = await setup(t);
  assert.equal((await sweep('off')).skipped, 'off');
  assert.equal((await store.listBriefingRuns(db)).length, 0);
  assert.equal(briefingAutosendMode({}), 'dry-run');
  assert.equal(briefingAutosendMode({ FRIDAY_BRIEFING_AUTOSEND: 'LIVE' }), 'live');
  assert.equal(briefingAutosendMode({ FRIDAY_BRIEFING_AUTOSEND: 'bogus' }), 'dry-run');
  assert.equal(briefingAutosendMode({ FRIDAY_BRIEFING_AUTOSEND: 'off' }), 'off');
});

test('next run is 09:00 IST (03:30 UTC) around the boundary', () => {
  assert.equal(nextBriefingRunAt(new Date('2026-10-07T03:29:59Z')).toISOString(), '2026-10-07T03:30:00.000Z');
  assert.equal(nextBriefingRunAt(new Date('2026-10-07T03:30:00Z')).toISOString(), '2026-10-08T03:30:00.000Z');
  assert.equal(nextBriefingRunAt(new Date('2026-12-31T23:00:00Z')).toISOString(), '2027-01-01T03:30:00.000Z');
  assert.equal(msUntilNextBriefingRun(new Date('2026-10-07T03:29:00Z')), 60000);
});

test('cron endpoint is disabled without a secret, rejects bad tokens, and runs once per day', async t => {
  const { startApp } = await import('./helpers.mjs');
  const secret = 'c'.repeat(40);
  const off = await startApp(t, { env: { FRIDAY_BRIEFING_AUTOSEND: 'dry-run' } });
  assert.equal((await off.request('/api/cron/briefings', 'POST', undefined, { headers: { Authorization: 'Bearer ' + secret, Origin: '' } })).status, 404);
  const short = await startApp(t, { env: { FRIDAY_CRON_SECRET: 'short' } });
  assert.equal((await short.request('/api/cron/briefings', 'POST')).status, 404);
  const { request } = await startApp(t, { env: { FRIDAY_BRIEFING_AUTOSEND: 'dry-run', FRIDAY_CRON_SECRET: secret } });
  const call = (token, method = 'POST') => request('/api/cron/briefings', method, undefined, { headers: { Origin: '', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
  assert.equal((await call()).status, 401);
  assert.equal((await call('x'.repeat(40))).status, 401);
  assert.equal((await call(secret, 'GET')).status, 405);
  const first = await call(secret);
  assert.equal(first.status, 200);
  assert.ok(!first.result.skipped);
  const second = await call(secret);
  assert.equal(second.status, 200);
  assert.equal(second.result.skipped, 'already_ran');
});
