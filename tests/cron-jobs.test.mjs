import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { presentedCronSecret } from '../server/cron-auth.mjs';
import { cronSecretProblem, diagnoseCronResponse, shouldRetryStatus, runCronCall } from '../scripts/cron-call.mjs';
import { alertBody, notifyFailure, resolveAlert, runUrl } from '../scripts/workflow-alert.mjs';

const run = promisify(execFile);
const cronCall = new URL('../scripts/cron-call.mjs', import.meta.url).pathname;
const secret = 's'.repeat(40);

test('the cron header is what the route reads, and Authorization is the fallback', () => {
  assert.equal(presentedCronSecret({ 'x-friday-cron-secret': '  from-header  ', authorization: 'Bearer from-auth' }), 'from-header');
  assert.equal(presentedCronSecret({ authorization: 'Bearer from-auth' }), 'from-auth');
  assert.equal(presentedCronSecret({ authorization: 'Basic no' }), '');
  assert.equal(presentedCronSecret({}), '');
});

test('a missing or short GitHub secret is explained before any request', () => {
  assert.match(cronSecretProblem('', 'FRIDAY_CRON_SECRET'), /is not set/);
  assert.match(cronSecretProblem('short', 'FRIDAY_BACKUP_SECRET'), /shorter than 32/);
  assert.equal(cronSecretProblem(secret, 'FRIDAY_BACKUP_SECRET'), '');
});

test('cron responses distinguish a hidden route, a missing route, and a bad secret', () => {
  const hidden = diagnoseCronResponse({ status: 404, body: '{"error":"Not found."}', expect: 'pgdump', secretName: 'FRIDAY_BACKUP_SECRET' });
  assert.equal(hidden.ok, false);
  assert.match(hidden.message, /Hexclave web service/);
  assert.match(hidden.message, /not a Vercel environment variable|Vercel environment variable does not/);
  const missing = diagnoseCronResponse({ status: 401, body: '{"error":"Please sign in."}', expect: 'json', secretName: 'FRIDAY_CRON_SECRET' });
  assert.match(missing.message, /not in the server/);
  const rejected = diagnoseCronResponse({ status: 401, body: '{"error":"Unauthorized."}', expect: 'json', secretName: 'FRIDAY_CRON_SECRET' });
  assert.match(rejected.message, /does not match/);
  const dump = diagnoseCronResponse({ status: 200, body: Buffer.from('PGDMP rest'), expect: 'pgdump', secretName: 'FRIDAY_BACKUP_SECRET' });
  assert.equal(dump.ok, true);
  const notDump = diagnoseCronResponse({ status: 200, body: Buffer.from('hello'), expect: 'pgdump', secretName: 'FRIDAY_BACKUP_SECRET' });
  assert.match(notDump.message, /not a pg_dump/);
  const failedJob = diagnoseCronResponse({ status: 200, body: '{"outcome":"failed"}', expect: 'json', secretName: 'FRIDAY_CRON_SECRET' });
  assert.equal(failedJob.ok, false);
  const dry = diagnoseCronResponse({ status: 200, body: '{"outcome":"skipped_empty"}', expect: 'json', secretName: 'FRIDAY_CRON_SECRET' });
  assert.equal(dry.ok, true);
  assert.equal(shouldRetryStatus(503, '{"error":"Backups need a PostgreSQL database."}'), false);
  assert.equal(shouldRetryStatus(503, '<html>unavailable</html>'), true);
  assert.equal(shouldRetryStatus(404, '{"error":"Not found."}'), false);
});

test('the caller retries a cold gateway and then keeps the dump', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return { status: 502, ok: false, arrayBuffer: async () => Buffer.from('bad gateway') };
    return { status: 200, ok: true, arrayBuffer: async () => Buffer.from('PGDMP-bytes') };
  };
  const result = await runCronCall({
    url: 'https://example.test/api/cron/db-backup', method: 'GET', secret, secretName: 'FRIDAY_BACKUP_SECRET', expect: 'pgdump', retries: 1, retryDelayMs: 0, timeoutMs: 1000
  }, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  assert.equal(result.body.toString(), 'PGDMP-bytes');
});

test('the command explains a production 404 and writes the dump only when it is a backup', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cron-call-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createServer((req, res) => {
    if (req.url.endsWith('/dump')) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end('PGDMP-ok');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"Not found."}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const errorFile = path.join(dir, 'error.txt');
  const env = { ...process.env, FRIDAY_BACKUP_SECRET: secret };
  await assert.rejects(run('node', [cronCall, '--url', `${base}/api/cron/db-backup`, '--method', 'GET', '--secret-env', 'FRIDAY_BACKUP_SECRET', '--secret-name', 'FRIDAY_BACKUP_SECRET', '--expect', 'pgdump', '--out', path.join(dir, 'nope.dump'), '--error-file', errorFile, '--retries', '0', '--timeout-ms', '5000'], { env }), err => err.code === 1);
  assert.match(await readFile(errorFile, 'utf8'), /Hexclave web service/);
  const out = path.join(dir, 'friday.dump');
  await run('node', [cronCall, '--url', `${base}/dump`, '--method', 'GET', '--secret-env', 'FRIDAY_BACKUP_SECRET', '--expect', 'pgdump', '--out', out, '--retries', '0', '--timeout-ms', '5000'], { env });
  assert.equal(await readFile(out, 'utf8'), 'PGDMP-ok');
});

test('a failure opens one issue, the next failure comments, and success closes it', async () => {
  const issues = [];
  const request = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (method === 'GET' && url.includes('/issues?')) {
      return json(issues.filter(issue => issue.state === 'open'));
    }
    if (method === 'POST' && url.endsWith('/issues')) {
      const issue = { number: issues.length + 1, title: body.title, state: 'open', html_url: `https://github.com/acme/friday/issues/${issues.length + 1}` };
      issues.push(issue);
      return json(issue, 201);
    }
    const comment = url.match(/\/issues\/(\d+)\/comments$/);
    if (method === 'POST' && comment) return json({ id: 1 }, 201);
    const patch = url.match(/\/issues\/(\d+)$/);
    if (method === 'PATCH' && patch) {
      issues[Number(patch[1]) - 1].state = body.state;
      return json(issues[Number(patch[1]) - 1]);
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  const base = { title: 'Friday quote digest job is failing', detail: 'The GitHub secret is not set.', run: runUrl({ repo: 'acme/friday', runId: '9' }), repo: 'acme/friday', token: 'token', request };
  const first = await notifyFailure(base);
  assert.equal(first.notified, true);
  assert.equal(issues.length, 1);
  assert.match(alertBody({ detail: base.detail, run: base.run }), /actions\/runs\/9/);
  const second = await notifyFailure({ ...base, detail: 'Still failing.' });
  assert.equal(second.issueUrl, first.issueUrl);
  assert.equal(issues.length, 1);
  const closed = await resolveAlert({ title: base.title, run: base.run, repo: base.repo, token: base.token, request });
  assert.equal(closed.closed, true);
  assert.equal(issues[0].state, 'closed');
  const again = await resolveAlert({ title: base.title, run: base.run, repo: base.repo, token: base.token, request });
  assert.equal(again.closed, false);
});

test('the deploy config requires the cron secrets instead of defaulting them to empty', () => {
  const source = readFileSync(new URL('../hexclave.deploy.ts', import.meta.url), 'utf8');
  assert.match(source, /FRIDAY_CRON_SECRET: secret\("FRIDAY_CRON_SECRET"\)/);
  assert.match(source, /FRIDAY_BACKUP_SECRET: secret\("FRIDAY_BACKUP_SECRET"\)/);
  assert.doesNotMatch(source, /secret\("FRIDAY_CRON_SECRET",/);
  assert.doesNotMatch(source, /secret\("FRIDAY_BACKUP_SECRET",/);
});

test('a webhook still notifies when GitHub refuses to open an issue', async () => {
  const request = async (url) => {
    if (String(url).includes('api.github.com')) return json({ message: 'Resource not accessible' }, 403);
    return json({ ok: true });
  };
  const denied = await notifyFailure({ title: 't', detail: 'd', repo: 'acme/friday', token: 'token', request });
  assert.equal(denied.notified, false);
  assert.match(denied.warnings.join('\n'), /Workflow permissions/);
  const hooked = await notifyFailure({ title: 't', detail: 'd', repo: 'acme/friday', token: 'token', webhookUrl: 'https://hooks.example/alert', request });
  assert.equal(hooked.notified, true);
  assert.equal(hooked.issueUrl, '');
});

function json(data, status = 200) {
  return { status, ok: status < 400, text: async () => JSON.stringify(data), json: async () => data };
}
