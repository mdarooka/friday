import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { startApp } from './helpers.mjs';
import * as gf from '../server/guide-feedback.mjs';
import { guideFeedback } from '../build/guide-feedback.js';

const V1 = 'viewer-one-abcdefghij', V2 = 'viewer-two-abcdefghij';
const vote = (app, data, viewer = V1) => app.request('/api/guide-feedback', 'POST', data, { headers: viewer ? { 'X-Friday-Viewer': viewer } : {} });
const memdb = () => { const db = new DatabaseSync(':memory:'); gf.ensureGuideFeedbackTables(db); return db; };

test('votes are anonymous, deduped per viewer per guide, and updatable', async t => {
  const app = await startApp(t);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes' })).status, 200);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'no', note: 'Needs a map' })).result.updated, true);
  await vote(app, { slug: 'kerala', vote: 'yes' }, V2);
  await vote(app, { slug: 'kyoto', vote: 'yes' });
  const db = new DatabaseSync(app.dbPath);
  const rows = db.prepare('SELECT slug,vote,note,viewer_hash FROM guide_feedback ORDER BY slug,vote').all();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.filter(r => r.slug === 'kerala').map(r => [r.vote, r.note]), [['no', 'Needs a map'], ['yes', '']]);
  assert.ok(rows.every(r => /^[a-f0-9]{64}$/.test(r.viewer_hash) && !r.viewer_hash.includes('viewer')));
  assert.notEqual(rows[0].viewer_hash, rows.find(r => r.slug === 'kyoto').viewer_hash);   // per-guide hash
  // same vote again without a note keeps the note
  await vote(app, { slug: 'kerala', vote: 'no' });
  assert.equal(db.prepare("SELECT note FROM guide_feedback WHERE slug='kerala' AND vote='no'").get().note, 'Needs a map');
  db.close();
});

test('validation: slug, vote, viewer id, note length, plain text', async t => {
  const app = await startApp(t);
  assert.equal((await vote(app, { slug: 'Bad Slug!', vote: 'yes' })).status, 422);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'maybe' })).status, 422);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes' }, null)).status, 400);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes' }, 'short')).status, 400);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes', note: 'x'.repeat(281) })).status, 422);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes', note: 5 })).status, 422);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes', note: 'x'.repeat(280) })).status, 200);
  assert.equal((await app.request('/api/guide-feedback', 'GET')).status, 405);
  assert.equal((await vote(app, { slug: 'kerala', vote: 'yes' }, V1)).status, 200);
  assert.equal((await app.request('/api/guide-feedback', 'POST', { slug: 'kerala', vote: 'yes' }, { headers: { Origin: 'https://evil.example', 'X-Friday-Viewer': V1 } })).status, 403);
});

test('endpoint is rate limited per IP', async t => {
  const app = await startApp(t);
  let last;
  for (let i = 0; i < gf.GUIDE_VOTES_PER_IP_PER_MIN + 1; i++) last = await vote(app, { slug: 'kerala', vote: 'yes' });
  assert.equal(last.status, 429);
});

test('weekly summary counts the last 7 days and labels low volume', () => {
  const db = memdb(), now = new Date('2026-10-12T04:00:00Z');
  const add = (slug, n, v, when, note = '') => { for (let i = 0; i < n; i++) gf.recordVote(db, { slug, viewerId: `${slug}${v}${when.getTime()}${i}`.padEnd(20, 'x').slice(0, 30), vote: v, note, now: when }); };
  add('kerala', 15, 'yes', new Date('2026-10-10T00:00:00Z'));
  add('kerala', 8, 'no', new Date('2026-10-11T00:00:00Z'), 'Too long');
  add('kyoto', 2, 'yes', new Date('2026-10-11T00:00:00Z'));
  add('kyoto', 1, 'no', new Date('2026-09-01T00:00:00Z'), 'old');   // outside the window
  const s = gf.weeklySummary(db, now);
  const kerala = s.guides.find(g => g.slug === 'kerala'), kyoto = s.guides.find(g => g.slug === 'kyoto');
  assert.deepEqual([kerala.yes, kerala.no, kerala.lowVolume], [15, 8, false]);
  assert.deepEqual([kyoto.yes, kyoto.no, kyoto.lowVolume], [2, 0, true]);
  assert.equal(kerala.notes[0].text, 'Too long');
  assert.ok(!JSON.stringify(s).includes('viewer_hash'));
  const mail = gf.digestEmail(s);
  assert.match(mail.text, /Kyoto: 2 yes, 0 not really/);
  assert.match(mail.text, /too few responses to read much into yet/);
  assert.equal((mail.text.match(/too few responses/g) || []).length, 1);   // only Kyoto is labelled
  const hostile = gf.digestEmail({ ...s, guides: [{ ...kyoto, notes: [{ vote: 'no', text: '<script>x</script>', updated: '' }] }] });
  assert.ok(!hostile.html.includes('<script>'));
});

async function digestSetup({ configured = true, inbox = 'team@example.com' } = {}) {
  const db = memdb(), sent = [], now = new Date('2026-10-12T03:30:00Z');   // a Monday
  gf.recordVote(db, { slug: 'kerala', viewerId: V1, vote: 'yes', now: new Date('2026-10-11T00:00:00Z') });
  const emailService = { configured, async send(m) { sent.push(m); return { status: 'provider_accepted' }; } };
  const run = (mode, extra = {}) => gf.runGuideDigest({ db, emailService, inbox, now, mode, ...extra });
  return { db, sent, run, now };
}

test('digest: dry-run sends nothing, runs once per week; live sends once', async () => {
  const { sent, run } = await digestSetup();
  assert.equal((await run('dry-run')).outcome, 'would_send');
  assert.equal((await run('dry-run')).skipped, 'already_ran');
  assert.equal(sent.length, 0);
  const live = await run('live');
  assert.equal(live.outcome, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'team@example.com');
  assert.equal(sent[0].dedupeKey, 'guide-digest:2026-10-12');
  assert.equal((await run('live')).skipped, 'already_ran');
  assert.equal(sent.length, 1);
});

test('digest: live falls back to dry-run without email or inbox; off does nothing; empty weeks are not sent', async () => {
  const a = await digestSetup({ configured: false });
  assert.deepEqual([(await a.run('live')).mode, a.sent.length], ['dry-run', 0]);
  const b = await digestSetup({ inbox: '' });
  assert.match((await b.run('live')).note, /no_team_inbox/);
  assert.equal((await b.run('off')).skipped, 'off');
  const c = await digestSetup();
  const quiet = await c.run('live', { now: new Date('2026-11-02T03:30:00Z') });
  assert.equal(quiet.outcome, 'no_votes');
  assert.equal(c.sent.length, 0);
  assert.equal(gf.guideDigestMode({}), 'dry-run');
  assert.equal(gf.guideDigestMode({ FRIDAY_GUIDE_DIGEST: 'LIVE' }), 'live');
  assert.equal(gf.guideDigestMode({ FRIDAY_GUIDE_DIGEST: 'off' }), 'off');
});

test('schedule is Monday 09:00 IST (03:30 UTC)', () => {
  assert.equal(gf.nextDigestRunAt(new Date('2026-10-07T00:00:00Z')).toISOString(), '2026-10-12T03:30:00.000Z');   // Wednesday
  assert.equal(gf.nextDigestRunAt(new Date('2026-10-12T03:29:59Z')).toISOString(), '2026-10-12T03:30:00.000Z');
  assert.equal(gf.nextDigestRunAt(new Date('2026-10-12T03:30:00Z')).toISOString(), '2026-10-19T03:30:00.000Z');
  assert.equal(gf.nextDigestRunAt(new Date('2026-10-18T23:00:00Z')).toISOString(), '2026-10-19T03:30:00.000Z');   // Sunday
  assert.equal(gf.pastThisWeeksDigestRun(new Date('2026-10-12T03:29:00Z')), false);
  assert.equal(gf.pastThisWeeksDigestRun(new Date('2026-10-14T00:00:00Z')), true);
});

test('digest cron endpoint needs a long secret and a matching bearer token', async t => {
  const secret = 'd'.repeat(40);
  assert.equal((await (await startApp(t)).request('/api/cron/guide-feedback-digest', 'POST')).status, 404);
  const app = await startApp(t, { env: { FRIDAY_CRON_SECRET: secret } });
  const call = token => app.request('/api/cron/guide-feedback-digest', 'POST', undefined, { headers: { Origin: '', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
  assert.equal((await call()).status, 401);
  assert.equal((await call(secret)).status, 200);
  assert.equal((await call(secret)).result.skipped, 'already_ran');
});

test('snippet is reusable and the Kerala guide includes it', async () => {
  const html = guideFeedback('kyoto');
  assert.match(html, /data-guide-feedback="kyoto"/);
  assert.match(html, /maxlength="280"/);
  assert.throws(() => guideFeedback('Bad Slug'));
  const { readFile } = await import('node:fs/promises');
  assert.match(await readFile(new URL('../kerala-guide.html', import.meta.url), 'utf8'), /data-guide-feedback="kerala"/);
});
