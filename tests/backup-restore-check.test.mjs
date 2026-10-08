import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { newestArtifact, checkFreshness, parseCounts, checkRestore, MAX_AGE_HOURS } from '../scripts/backup-restore-check.mjs';

const run = promisify(execFile);
const script = new URL('../scripts/backup-restore-check.mjs', import.meta.url).pathname;
const now = Date.parse('2026-10-12T06:00:00Z');
const artifact = (id, createdAt, extra = {}) => ({ id, name: 'friday-db-backup', created_at: createdAt, expired: false, workflow_run: { id: id * 10 }, ...extra });

test('picks the newest unexpired nightly artifact and ignores others', () => {
  const list = [
    artifact(1, '2026-10-10T20:40:00Z'),
    artifact(2, '2026-10-11T20:41:00Z', { expired: true }),
    artifact(3, '2026-10-11T20:40:00Z'),
    artifact(4, '2026-10-12T01:00:00Z', { name: 'other' }),
    artifact(5, 'not a date')
  ];
  assert.equal(newestArtifact(list).id, 3);
  assert.equal(newestArtifact([]), null);
  assert.equal(newestArtifact(undefined), null);
});

test('a backup under 36 hours old is fresh; older or missing is a failure', () => {
  assert.equal(MAX_AGE_HOURS, 36);
  const fresh = checkFreshness(artifact(3, '2026-10-11T20:40:00Z'), { now });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.ageHours, 9.3);
  assert.deepEqual(fresh.artifact, { id: 3, runId: 30, createdAt: '2026-10-11T20:40:00Z' });
  const stale = checkFreshness(artifact(3, '2026-10-10T12:00:00Z'), { now });
  assert.equal(stale.ok, false);
  assert.match(stale.message, /past the 36-hour limit/);
  const missing = checkFreshness(null, { now });
  assert.equal(missing.ok, false);
  assert.equal(missing.artifact, null);
});

test('parses the count lines and flags missing, empty and uncountable tables', () => {
  const counts = parseCounts('users\t3\nsessions\t0\nvillas\tmissing\nrecords\tabc\n\n');
  assert.deepEqual(counts, { users: 3, sessions: 0, villas: null, records: NaN });
  const ok = parseCounts('users\t3\nsessions\t0\nrecords\t0\nenquiries\t2\nemail_outbox\t0\nvillas\t1\n');
  assert.deepEqual(checkRestore(ok), { ok: true, problems: [] });
  const bad = checkRestore(counts);
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.includes('table villas is missing'));
  assert.ok(bad.problems.includes('table records could not be counted'));
  assert.ok(bad.problems.includes('table enquiries is missing'));
  assert.ok(!bad.problems.includes('table sessions has no rows'), 'only users must have rows');
  assert.deepEqual(checkRestore(parseCounts('users\t0\nsessions\t0\nrecords\t0\nenquiries\t0\nemail_outbox\t0\nvillas\t0')).problems, ['table users has no rows']);
});

test('the command line writes the summary and fails on a stale backup or a failed restore', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'backup-check-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const summary = path.join(dir, 'summary.md');
  const output = path.join(dir, 'output.txt');
  const env = { ...process.env, GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output };
  const fresh = path.join(dir, 'fresh.json');
  await writeFile(fresh, JSON.stringify({ artifacts: [artifact(7, new Date(Date.now() - 3 * 3600e3).toISOString())] }));
  await run('node', [script, 'freshness', fresh], { env });
  assert.match(await readFile(output, 'utf8'), /run_id=70/);
  const stale = path.join(dir, 'stale.json');
  await writeFile(stale, JSON.stringify({ artifacts: [artifact(8, new Date(Date.now() - 50 * 3600e3).toISOString())] }));
  await assert.rejects(run('node', [script, 'freshness', stale], { env }), err => err.code === 1);
  const counts = path.join(dir, 'counts.tsv');
  await writeFile(counts, 'users\t4\nsessions\t1\nrecords\t9\nenquiries\t0\nemail_outbox\t0\nvillas\t2\n');
  await run('node', [script, 'verify', counts, '0', '12'], { env });
  await assert.rejects(run('node', [script, 'verify', counts, '1', '12'], { env }), err => err.code === 1);
  const text = await readFile(summary, 'utf8');
  assert.match(text, /Backup freshness[\s\S]*FAILED: No unexpired|FAILED: Latest backup/);
  assert.match(text, /OK: the backup restored into a scratch PostgreSQL 17 in 12 seconds/);
  assert.match(text, /pg_restore exited with code 1/);
  const { stdout } = await run('node', [script, 'tables']);
  assert.match(stdout, /^users$/m);
});
