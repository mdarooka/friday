import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as store from '../server/store.mjs';
import { runQuoteDigest, nextQuoteDigestRunAt, quoteDigestMode, digestRecipient, collectQueue } from '../server/quote-digest.mjs';
import { issueChecklist, saveChecklist } from '../server/prequote-checklist.mjs';

async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'friday-digest-'));
  const db = store.openStore(path.join(dir, 'db.sqlite'));
  t.after(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
  const sent = [];
  const emailService = { configured: true, async send(m) { sent.push(m); return { status: 'provider_accepted' }; } };
  const now = new Date('2026-10-07T04:00:00Z');
  const run = (mode, offset = 0, extra = {}) => runQuoteDigest({ db, store, emailService, origin: 'https://friday.example', recipient: 'designer@example.com', now: new Date(now.getTime() + offset * 86400000), mode, ...extra });
  const addCallback = (id, daysAgo, status = 'new') => store.createCallbackRequest(db, { id, name: 'Asha', phone: '+919876543210', bestTime: 'evening', entryPoint: 'planner', status, created: new Date(now.getTime() - daysAgo * 86400000).toISOString() });
  return { db, sent, run, addCallback, now };
}

test('schedule is 04:00 UTC (09:30 IST), mode defaults to dry-run, recipient prefers first admin', () => {
  assert.equal(nextQuoteDigestRunAt(new Date('2026-10-07T03:59:00Z')).toISOString(), '2026-10-07T04:00:00.000Z');
  assert.equal(nextQuoteDigestRunAt(new Date('2026-10-07T04:00:00Z')).toISOString(), '2026-10-08T04:00:00.000Z');
  assert.equal(quoteDigestMode({}), 'dry-run');
  assert.equal(quoteDigestMode({ FRIDAY_QUOTE_DIGEST: 'LIVE' }), 'live');
  assert.equal(digestRecipient({ QUOTE_ADMIN_EMAILS: 'Boss@Example.com, b@example.com', FRIDAY_ENQUIRY_EMAIL: 'x@example.com' }), 'boss@example.com');
  assert.equal(digestRecipient({ FRIDAY_ENQUIRY_EMAIL: 'x@example.com' }), 'x@example.com');
  assert.equal(digestRecipient({}), '');
});

test('empty queue is skipped; done callbacks are excluded; oldest first with age', async t => {
  const { db, run, addCallback, now } = await setup(t);
  assert.equal((await run('dry-run')).outcome, 'skipped_empty');
  addCallback('c-new', 1); addCallback('c-old', 3); addCallback('c-done', 5, 'done');
  const items = collectQueue({ db, store, now });
  assert.deepEqual(items.map(i => i.age), ['waiting 3 days', 'waiting 1 day']);
  assert.equal(items[0].checklist, '0/5');
});

test('dry-run sends nothing, once per day, and logs no addresses or phones', async t => {
  const { db, sent, run, addCallback } = await setup(t);
  addCallback('c1', 2);
  const first = await run('dry-run');
  assert.equal(first.outcome, 'would_send');
  assert.equal(sent.length, 0);
  assert.equal((await run('dry-run')).skipped, 'already_ran');
  const logged = JSON.stringify(db.prepare('SELECT * FROM quote_digest_runs').all());
  assert.ok(!logged.includes('designer@example.com') && !logged.includes('9876543210'));
});

test('live is gated until 3 dry-run days, then sends one digest with phone, checklist and link', async t => {
  const { db, sent, run, addCallback } = await setup(t);
  addCallback('c1', 2);
  const token = issueChecklist(db, { callbackId: 'c1' });
  saveChecklist(db, { callbackId: 'c1', editToken: token, answers: { dates: { text: '12-19 Dec' }, budget: { done: true }, passport: { text: 'Indian' } } });
  const gated = await run('live', 0);
  assert.equal(gated.mode, 'dry-run'); assert.equal(gated.note, 'live_gated_until_3_dry_run_days'); assert.equal(sent.length, 0);
  await run('dry-run', 1); await run('dry-run', 2);
  const live = await run('live', 3);
  assert.equal(live.mode, 'live'); assert.equal(live.outcome, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'designer@example.com');
  assert.match(sent[0].text, /\+919876543210/);
  assert.match(sent[0].text, /waiting 5 days/);
  assert.match(sent[0].text, /checklist 3\/5 complete/);
  assert.match(sent[0].text, /https:\/\/friday\.example\/admin\.html#quotes/);
  assert.equal((await run('live', 3)).skipped, 'already_ran');
  assert.equal(sent.length, 1);
});

test('off mode does nothing', async t => {
  const { run } = await setup(t);
  assert.deepEqual(await run('off'), { skipped: 'off' });
});

test('callback status endpoint: auth, 404/422, and done callbacks leave the digest', async t => {
  const { startApp, signUp } = await import('./helpers.mjs');
  const open = await startApp(t, { env: { AUTH_PROVIDER: 'local' }, hexclaveAuth: { configured: false, currentUser: async () => null } });
  const anyone = await signUp(open.request, 'Anyone');
  const id = '11111111-1111-4111-8111-111111111111';
  const post = (ctx, who, body, cbId = id) => ctx.request(`/api/admin/callbacks/${cbId}/status`, 'POST', body, who ? { cookie: who.cookie } : undefined);
  assert.equal((await post(open, null, { status: 'done' })).status, 401);
  assert.equal((await post(open, anyone, { status: 'done' })).status, 403);   // no configured admins: signed-in user is not enough

  const ctx = await startApp(t, { env: { AUTH_PROVIDER: 'local', QUOTE_ADMIN_EMAILS: 'staff@example.com' }, hexclaveAuth: { configured: false, currentUser: async () => null } });
  const staff = await signUp(ctx.request, 'Staff');
  const other = await signUp(ctx.request, 'Other');
  const made = await ctx.request('/api/callbacks', 'POST', { name: 'Traveler', phone: '9876543210', bestTime: 'morning', entryPoint: 'contact' });
  assert.equal(made.status, 201);
  const cid = made.result.id;
  assert.equal((await post(ctx, other, { status: 'done' }, cid)).status, 403);
  assert.equal((await post(ctx, staff, { status: 'bogus' }, cid)).status, 422);
  assert.equal((await post(ctx, staff, { status: 'done' }, '22222222-2222-4222-8222-222222222222')).status, 404);
  const db = new DatabaseSync(ctx.dbPath);
  const store2 = await import('../server/store.mjs');
  assert.equal(collectQueue({ db, store: store2, now: new Date() }).length, 1);
  assert.equal((await post(ctx, staff, { status: 'done' }, cid)).status, 200);
  assert.equal(collectQueue({ db, store: store2, now: new Date() }).length, 0);
  const list = await ctx.request('/api/admin/quotes', 'GET', undefined, { cookie: staff.cookie });
  assert.equal(list.result.quotes.find(q => q.id === cid).status, 'done');
  assert.equal((await post(ctx, staff, { status: 'open' }, cid)).status, 200);
  assert.equal(collectQueue({ db, store: store2, now: new Date() }).length, 1);
  db.close();
});
