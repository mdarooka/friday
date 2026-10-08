#!/usr/bin/env node
/* Weekly restore check for the nightly database backup (.github/workflows/backup-restore-check.yml, README → Nightly
   database backup). The checks are pure so tests can run them; the workflow feeds them the GitHub API listing, the
   restored table counts and the restore's exit code. Each subcommand writes a short section to the job summary and
   exits 1 when something is wrong, which fails the job and so sends GitHub's failure notice.

   node scripts/backup-restore-check.mjs freshness <artifacts.json>
   node scripts/backup-restore-check.mjs tables
   node scripts/backup-restore-check.mjs verify <counts.tsv> <restore-exit-code> <restore-seconds> */
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ARTIFACT_NAME = 'friday-db-backup';
export const MAX_AGE_HOURS = 36;
// Tables the app creates at startup (server/store.mjs). A restored database without one is wrong.
export const REQUIRED_TABLES = ['users', 'sessions', 'records', 'enquiries', 'email_outbox', 'villas'];
// Tables that must hold rows in a live database. Keep this to tables that are never legitimately empty.
export const NONEMPTY_TABLES = ['users'];

const hours = ms => Math.round(ms / 360000) / 10;

/* The newest unexpired nightly artifact from GET /repos/{repo}/actions/artifacts, or null. */
export function newestArtifact(artifacts) {
  return (artifacts ?? [])
    .filter(a => a?.name === ARTIFACT_NAME && !a.expired && a.workflow_run?.id && Number.isFinite(Date.parse(a.created_at)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

export function checkFreshness(artifact, { now = Date.now(), maxAgeHours = MAX_AGE_HOURS } = {}) {
  if (!artifact) {
    return { ok: false, artifact: null, ageHours: null, message: `No unexpired ${ARTIFACT_NAME} artifact exists, so the nightly backup has not produced one in its 30-day window.` };
  }
  const ageHours = hours(now - Date.parse(artifact.created_at));
  const ok = ageHours <= maxAgeHours;
  return {
    ok,
    artifact: { id: artifact.id, runId: artifact.workflow_run.id, createdAt: artifact.created_at },
    ageHours,
    message: ok
      ? `Latest backup is ${ageHours} hours old (limit ${maxAgeHours}).`
      : `Latest backup is ${ageHours} hours old, past the ${maxAgeHours}-hour limit. The nightly backup has stopped running or failing silently.`
  };
}

/* "table<TAB>count" lines from the workflow's count loop; a table that is absent is written as "missing". */
export function parseCounts(text) {
  const counts = {};
  for (const line of String(text).split('\n')) {
    const [name, value, ...rest] = line.replace(/\r$/, '').split('\t');
    if (!name || value === undefined || rest.length) continue;
    counts[name] = value === 'missing' ? null : /^\d+$/.test(value) ? Number(value) : NaN;
  }
  return counts;
}

export function checkRestore(counts, { required = REQUIRED_TABLES, nonEmpty = NONEMPTY_TABLES } = {}) {
  const problems = [];
  for (const table of required) {
    if (!(table in counts) || counts[table] === null) problems.push(`table ${table} is missing`);
    else if (!Number.isInteger(counts[table])) problems.push(`table ${table} could not be counted`);
    else if (nonEmpty.includes(table) && counts[table] === 0) problems.push(`table ${table} has no rows`);
  }
  return { ok: problems.length === 0, problems };
}

function writeSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  else console.log(markdown);
}

function writeOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}

function runFreshness(file) {
  const { artifacts = [] } = JSON.parse(readFileSync(file, 'utf8'));
  const result = checkFreshness(newestArtifact(artifacts));
  writeSummary(`### Backup freshness\n\n${result.ok ? 'OK' : 'FAILED'}: ${result.message}`);
  if (result.ok) writeOutputs({ run_id: result.artifact.runId, artifact_id: result.artifact.id });
  return result.ok ? 0 : 1;
}

function runVerify(file, restoreExit, restoreSeconds) {
  const counts = parseCounts(readFileSync(file, 'utf8'));
  const result = checkRestore(counts);
  const problems = [...result.problems];
  if (Number(restoreExit) !== 0) problems.unshift(`pg_restore exited with code ${restoreExit} (its log is in the restore step above)`);
  const ok = problems.length === 0;
  const rows = Object.entries(counts).map(([t, c]) => `| ${t} | ${c === null ? 'missing' : c} |`);
  writeSummary([
    '### Restore test',
    '',
    `${ok ? 'OK' : 'FAILED'}: the backup restored into a scratch PostgreSQL 17 in ${restoreSeconds} seconds.`,
    '',
    '| Table | Rows |',
    '| --- | --- |',
    ...rows,
    ...(ok ? [] : ['', 'Problems:', ...problems.map(p => `- ${p}`)])
  ].join('\n'));
  return ok ? 0 : 1;
}

async function main(argv) {
  const [command, ...args] = argv;
  if (command === 'freshness') return runFreshness(args[0]);
  if (command === 'tables') {
    console.log([...REQUIRED_TABLES, ...NONEMPTY_TABLES.filter(t => !REQUIRED_TABLES.includes(t))].join('\n'));
    return 0;
  }
  if (command === 'verify') return runVerify(args[0], args[1] ?? '1', args[2] ?? 'unknown');
  console.error('usage: backup-restore-check.mjs freshness <artifacts.json> | tables | verify <counts.tsv> <exit> <seconds>');
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
