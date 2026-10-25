#!/usr/bin/env node
/* Calls one Friday cron route and says why it failed.

   The production routes are deployed. They answer 404 Not found when the
   matching Hexclave secret is unset or shorter than 32 characters, 401
   Unauthorized when the bearer does not match, and 401 Please sign in only
   when the running server does not have the route at all.

   node scripts/cron-call.mjs --url URL --method GET --secret-env NAME \
     --secret-name NAME --expect pgdump|json --out FILE --error-file FILE */
import { writeFileSync, appendFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const MIN_SECRET_LENGTH = 32;

export function cronSecretProblem(value, name) {
  const secret = String(value ?? '');
  if (!secret) return `The GitHub Actions secret ${name} is not set. Add it under Settings → Secrets and variables → Actions. It must be at least 32 characters and the same value as the Hexclave project secret of that name (Project Settings → Secrets). Then redeploy the Hexclave web service.`;
  if (secret.length < MIN_SECRET_LENGTH) return `The GitHub Actions secret ${name} is shorter than 32 characters. The server hides the cron route until the secret is at least that long. Set one longer value in both GitHub Actions and the Hexclave project secrets, then redeploy the web service.`;
  return '';
}

export function cronRequestHeaders(secret, method) {
  const headers = { Authorization: `Bearer ${secret}`, 'X-Friday-Cron-Secret': secret };
  if (String(method).toUpperCase() !== 'GET' && String(method).toUpperCase() !== 'HEAD') headers['Content-Type'] = 'application/json';
  return headers;
}

function jsonError(body) {
  const text = Buffer.isBuffer(body) ? body.subarray(0, 2000).toString('utf8') : String(body ?? '').slice(0, 2000);
  try {
    const parsed = JSON.parse(text);
    return typeof parsed?.error === 'string' ? parsed.error : '';
  } catch {
    return '';
  }
}

/* Gateway 502/504, and a 503 that is not the app refusing a non-Postgres database, are worth retrying while a scaled-to-zero host wakes up. */
export function shouldRetryStatus(status, body) {
  if (status === 502 || status === 504) return true;
  if (status !== 503) return false;
  const error = jsonError(body);
  return error !== 'Backups need a PostgreSQL database.' && error !== 'Backup failed.';
}

export function diagnoseCronResponse({ status, body, expect, secretName }) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''));
  if (expect === 'pgdump' && status === 200 && buf.subarray(0, 5).toString('utf8') === 'PGDMP') {
    return { ok: true, message: `Received a pg_dump archive (${buf.length} bytes).` };
  }
  const text = buf.subarray(0, 2000).toString('utf8');
  const error = jsonError(buf);
  if (status === 404 && error === 'Not found.') {
    return { ok: false, message: `Production returned 404 Not found. The cron route is deployed; it hides itself when ${secretName} on the Hexclave web service is unset or shorter than 32 characters. Set that project secret (Project Settings → Secrets) to the same value as the GitHub Actions secret and redeploy the web service. A Vercel environment variable does not reach the app: Vercel only proxies fridaytravel.vercel.app to Hexclave.` };
  }
  if (status === 401 && error === 'Please sign in.') {
    return { ok: false, message: 'Production returned 401 Please sign in, which means this cron route is not in the server that is running. Redeploy the Hexclave web service from the current repository.' };
  }
  if (status === 401 && error === 'Unauthorized.') {
    return { ok: false, message: `Production rejected the cron secret (401 Unauthorized). The GitHub Actions secret ${secretName} does not match the Hexclave web service. Set both to the same value of at least 32 characters and redeploy. The caller sends the secret as Authorization and as X-Friday-Cron-Secret, because the Vercel proxy can drop Authorization.` };
  }
  if (status === 503 && error === 'Backups need a PostgreSQL database.') {
    return { ok: false, message: 'The server is up but it is not connected to PostgreSQL, so it refused to make a backup.' };
  }
  if (status === 500) {
    return { ok: false, message: 'The server accepted the secret and the backup failed while it was running. See the Hexclave web service logs.' };
  }
  if (expect === 'pgdump' && status === 200) {
    return { ok: false, message: 'The response was not a pg_dump custom-format archive.' };
  }
  if (expect === 'json' && status >= 200 && status < 300) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    if (parsed && (parsed.outcome === 'failed' || (Number.isInteger(parsed.failed) && parsed.failed > 0))) {
      return { ok: false, message: `The cron job ran and reported a failure: ${text.slice(0, 500)}` };
    }
    return { ok: true, message: text.slice(0, 2000) || `HTTP ${status}` };
  }
  const snippet = text.replace(/\s+/g, ' ').slice(0, 180);
  return { ok: false, message: `Production returned HTTP ${status}${snippet ? `: ${snippet}` : ''}.` };
}

function writeSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}

async function callOnce(url, { method, headers, timeoutMs, fetchImpl }) {
  const res = await fetchImpl(url, { method, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
}

export async function runCronCall(options, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const name = options.secretName || options.secretEnv;
  const problem = cronSecretProblem(options.secret, name);
  if (problem) return { ok: false, message: problem };
  const headers = cronRequestHeaders(options.secret, options.method);
  let last = null, attempt = 0;
  const retries = Number.isFinite(options.retries) ? options.retries : 3;
  for (;;) {
    attempt += 1;
    try {
      last = await callOnce(options.url, { method: options.method, headers, timeoutMs: options.timeoutMs ?? 180000, fetchImpl });
    } catch (error) {
      last = { status: 0, body: Buffer.from(''), networkError: error?.name === 'TimeoutError' ? 'the request timed out' : 'the request did not reach the server' };
    }
    const retryable = last.networkError || shouldRetryStatus(last.status, last.body);
    if (!retryable || attempt > retries) break;
    await sleep(options.retryDelayMs ?? 20000);
  }
  if (last.networkError) return { ok: false, message: `Could not call ${options.url}: ${last.networkError}.` };
  const result = diagnoseCronResponse({ status: last.status, body: last.body, expect: options.expect, secretName: name });
  return { ...result, status: last.status, body: last.body };
}

function fail(message, errorFile) {
  console.error(`::error::${message.replace(/\s+/g, ' ')}`);
  writeSummary(`### Cron call\n\nFAILED: ${message}`);
  if (errorFile) writeFileSync(errorFile, message + '\n');
  process.exitCode = 1;
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      method: { type: 'string', default: 'POST' },
      'secret-env': { type: 'string' },
      'secret-name': { type: 'string' },
      expect: { type: 'string' },
      out: { type: 'string' },
      'error-file': { type: 'string' },
      retries: { type: 'string' },
      'timeout-ms': { type: 'string' },
      'retry-delay-ms': { type: 'string' }
    }
  });
  const secretEnv = values['secret-env'];
  if (!values.url || !secretEnv || !values.expect) {
    fail('cron-call needs --url, --secret-env and --expect.', values['error-file']);
    return;
  }
  if (values.expect === 'pgdump' && !values.out) {
    fail('cron-call --expect pgdump needs --out.', values['error-file']);
    return;
  }
  const result = await runCronCall({
    url: values.url,
    method: values.method || 'POST',
    secret: process.env[secretEnv] || '',
    secretEnv,
    secretName: values['secret-name'] || secretEnv,
    expect: values.expect,
    retries: values.retries === undefined ? undefined : Number(values.retries),
    timeoutMs: values['timeout-ms'] === undefined ? undefined : Number(values['timeout-ms']),
    retryDelayMs: values['retry-delay-ms'] === undefined ? undefined : Number(values['retry-delay-ms'])
  });
  if (!result.ok) {
    if (values.out) rmSync(values.out, { force: true });
    fail(result.message, values['error-file']);
    return;
  }
  if (values['error-file']) rmSync(values['error-file'], { force: true });
  if (values.expect === 'pgdump') {
    writeFileSync(values.out, result.body, { mode: 0o600 });
    writeSummary(`### Cron call\n\n${result.message}`);
    console.log(result.message);
    return;
  }
  writeSummary(`### Cron call\n\n${result.message}`);
  console.log(result.message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`::error::${error?.message || error}`);
    process.exit(1);
  });
}
