import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startApp, signUp } from './helpers.mjs';
import { commitSha, buildTime, deployInfo, sameCommit, mainCommitSha, resetMainCommitCache } from '../server/deploy-info.mjs';
import { insertBackupRun, finishBackupRun } from '../server/store.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('deploy info keeps only a real commit SHA and an instant', () => {
  assert.equal(commitSha(' ABCDEF1234567890 '), 'abcdef1234567890');
  assert.equal(commitSha('not-a-sha'), null);
  assert.equal(commitSha('abc'), null);
  assert.equal(buildTime('2026-10-15T08:00:00Z'), '2026-10-15T08:00:00.000Z');
  assert.equal(buildTime('soon'), null);
  assert.deepEqual(deployInfo({ VERCEL_GIT_COMMIT_SHA: 'abc1234', VERCEL_GIT_COMMIT_TIMESTAMP: '2026-10-15T08:00:00.000Z' }), {
    commit: 'abc1234',
    builtAt: '2026-10-15T08:00:00.000Z',
  });
  assert.equal(sameCommit('abcdef1234567890', 'abcdef1'), true);
  assert.equal(sameCommit('abcdef1', '1111111'), false);
  assert.equal(sameCommit(null, 'abcdef1'), null);
});

test('main commit lookup uses a short timeout and caches a miss', async () => {
  resetMainCommitCache();
  let calls = 0;
  const sha = await mainCommitSha({
    timeoutMs: 50,
    fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ sha: '0123456789abcdef' }) }; },
  });
  assert.equal(sha, '0123456789abcdef');
  assert.equal(await mainCommitSha({ fetchImpl: async () => { calls++; return { ok: false }; } }), '0123456789abcdef');
  assert.equal(calls, 1);
  resetMainCommitCache();
  assert.equal(await mainCommitSha({ timeoutMs: 20, fetchImpl: async () => { throw new Error('offline'); } }), null);
});

test('admin status reports last good job runs and the deployed commit', async (t) => {
  const { request, db } = await startApp(t, {
    env: { AUTH_REQUIRED: 'true', ADMIN_EMAILS: 'ops@example.com', FRIDAY_COMMIT_SHA: 'abcdef1234567890', FRIDAY_BUILD_TIME: '2026-10-15T08:00:00Z' },
  });
  const admin = await signUp(request, 'ops');
  await insertBackupRun(db, { id: 'bak-1', started: '2026-10-14T19:45:00.000Z' });
  await finishBackupRun(db, { id: 'bak-1', finished: '2026-10-14T19:46:00.000Z', outcome: 'good' });
  await insertBackupRun(db, { id: 'bak-2', started: '2026-10-15T19:45:00.000Z' });
  await finishBackupRun(db, { id: 'bak-2', finished: '2026-10-15T19:46:00.000Z', outcome: 'failed' });
  await db.query('INSERT INTO briefing_runs(run_date,mode,requested_mode,started,finished,failed) VALUES($1,$2,$3,$4,$5,$6)', ['2026-10-14', 'live', 'live', '2026-10-14T02:45:00.000Z', '2026-10-14T02:46:00.000Z', 0]);
  await db.query('INSERT INTO briefing_runs(run_date,mode,requested_mode,started,finished,failed) VALUES($1,$2,$3,$4,$5,$6)', ['2026-10-15', 'live', 'live', '2026-10-15T02:45:00.000Z', '2026-10-15T02:46:00.000Z', 2]);
  await db.query('INSERT INTO quote_digest_runs(run_date,mode,requested_mode,started,finished,outcome) VALUES($1,$2,$3,$4,$5,$6)', ['2026-10-13', 'live', 'live', '2026-10-13T03:15:00.000Z', '2026-10-13T03:16:00.000Z', 'failed']);
  await db.query('INSERT INTO quote_digest_runs(run_date,mode,requested_mode,started,finished,outcome) VALUES($1,$2,$3,$4,$5,$6)', ['2026-10-14', 'dry-run', 'live', '2026-10-14T03:15:00.000Z', '2026-10-14T03:16:00.000Z', 'would_send']);
  await db.query('INSERT INTO guide_digest_runs(run_date,mode,requested_mode,started,finished,outcome) VALUES($1,$2,$3,$4,$5,$6)', ['2026-10-12', 'live', 'live', '2026-10-12T02:45:00.000Z', '2026-10-12T02:46:00.000Z', 'sent']);

  const status = await request('/api/admin/status', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(status.status, 200);
  assert.equal(status.result.deploy.commit, 'abcdef1234567890');
  assert.equal(status.result.deploy.builtAt, '2026-10-15T08:00:00.000Z');
  assert.equal(status.result.deploy.main, null);
  assert.equal(status.result.jobs.backup.finished, '2026-10-14T19:46:00.000Z');
  assert.equal(status.result.jobs.briefings.finished, '2026-10-14T02:46:00.000Z');
  assert.equal(status.result.jobs.briefings.mode, 'live');
  assert.equal(status.result.jobs.quoteDigest.finished, '2026-10-14T03:16:00.000Z');
  assert.equal(status.result.jobs.quoteDigest.outcome, 'would_send');
  assert.equal(status.result.jobs.guideDigest.finished, '2026-10-12T02:46:00.000Z');

  const visitor = await signUp(request, 'visitor');
  const hidden = await request('/api/admin/status', 'GET', undefined, { cookie: visitor.cookie });
  assert.equal(hidden.result.jobs, null);
  assert.equal(hidden.result.deploy.commit, 'abcdef1234567890');
});

test('public pages link home to / and lead the header with guides', async () => {
  for (const file of ['index.html', 'about.html', 'villas.html', 'contact.html', '404.html', 'salon.html', 'trip.html']) {
    const html = await read(file);
    assert.equal(html.includes('href="index.html"'), false, file);
    assert.equal(html.includes("href='index.html'"), false, file);
  }
  const home = await read('index.html');
  const nav = home.slice(home.indexOf('<nav class="nav"'), home.indexOf('</nav>'));
  assert.match(nav, /href="guides\.html"[^>]*>Guides</);
  assert.ok(nav.indexOf('href="guides.html"') < nav.indexOf('href="villas.html"'));
  assert.ok(nav.indexOf('href="when-india-travels.html"') < nav.indexOf('href="villas.html"'));
  const sitemap = await read('sitemap.xml');
  assert.equal(sitemap.includes('/villa.html'), false);
  const villas = await read('assets/js/villas.js');
  assert.match(villas, /Ask for a villa/);
  assert.match(villas, /entryPoint: 'villas'/);
  assert.match(villas, /mumbai-quiet-weekend\.html/);
  assert.match(villas, /contact\.html#callback-title/);
  const admin = await read('admin.html');
  assert.match(admin, /data-admin-ops/);
});
