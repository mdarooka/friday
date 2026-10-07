import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { backupDatabase } from '../server/tools/backup-database.mjs';
import { restoreDatabase } from '../server/tools/restore-database.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'friday-db-backup-'));
  const database = path.join(root, 'live.sqlite');
  const backups = path.join(root, 'backups');
  return { root, database, backups, close: () => rm(root, { recursive: true, force: true }) };
}

function writeDb(file, value, { wal = false } = {}) {
  const db = new DatabaseSync(file);
  if (wal) db.exec('PRAGMA journal_mode=WAL');
  db.exec('CREATE TABLE IF NOT EXISTS records (value TEXT NOT NULL)');
  db.prepare('INSERT INTO records(value) VALUES(?)').run(value);
  return db;
}

function values(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return db.prepare('SELECT value FROM records ORDER BY rowid').all().map(row => row.value); }
  finally { db.close(); }
}

test('online backup includes committed rows in a live WAL database and creates private verified files', async () => {
  const f = await fixture();
  try {
    const live = writeDb(f.database, 'committed-in-wal', { wal: true });
    const result = await backupDatabase({ source: f.database, directory: f.backups });
    assert.deepEqual(values(result), ['committed-in-wal']);
    assert.equal((await stat(result)).mode & 0o777, 0o600);
    assert.equal((await stat(f.backups)).mode & 0o777, 0o700);
    live.close();
  } finally { await f.close(); }
});

test('online backups keep only the configured number of dated snapshots', async () => {
  const f = await fixture();
  try {
    const live = writeDb(f.database, 'keep-me');
    live.close();
    const snapshots = [];
    for (let day = 1; day <= 3; day++) {
      snapshots.push(await backupDatabase({
        source: f.database,
        directory: f.backups,
        now: new Date(`2026-10-0${day}T00:00:00.000Z`),
        retentionCount: 2,
      }));
    }
    assert.deepEqual((await readdir(f.backups)).sort(), snapshots.slice(1).map(file => path.basename(file)).sort());
  } finally { await f.close(); }
});

test('restore preview validates a backup without changing the live database', async () => {
  const f = await fixture();
  try {
    const live = writeDb(f.database, 'keep-me');
    live.close();
    const source = path.join(f.backups, 'candidate.sqlite');
    await mkdir(f.backups, { recursive: true });
    const candidate = writeDb(source, 'restore-me');
    candidate.close();
    const before = await readFile(f.database);
    const preview = await restoreDatabase({ source, target: f.database, directory: f.backups });
    assert.equal(preview.applied, false);
    assert.deepEqual(values(f.database), ['keep-me']);
    assert.deepEqual(await readFile(f.database), before);
  } finally { await f.close(); }
});

test('restore rejects corrupt backup files', async () => {
  const f = await fixture();
  try {
    await mkdir(f.backups, { recursive: true });
    const broken = path.join(f.backups, 'broken.sqlite');
    await writeFile(broken, 'not a SQLite database');
    await assert.rejects(restoreDatabase({ source: broken, target: f.database, directory: f.backups }), /SQLite|file is not a database/i);
  } finally { await f.close(); }
});

test('restore refuses a WAL or shared-memory sidecar beside the live database', async () => {
  const f = await fixture();
  try {
    const target = writeDb(f.database, 'keep-me');
    target.close();
    await mkdir(f.backups, { recursive: true });
    const source = path.join(f.backups, 'candidate.sqlite');
    const candidate = writeDb(source, 'restore-me');
    candidate.close();
    await writeFile(`${f.database}-wal`, 'stale wal');
    await assert.rejects(restoreDatabase({ source, target: f.database, directory: f.backups, apply: true }), /sidecar/i);
    assert.deepEqual(values(f.database), ['keep-me']);
  } finally { await f.close(); }
});

test('restore applies a verified snapshot and preserves the prior database in a SQLite safety copy', async () => {
  const f = await fixture();
  try {
    const target = writeDb(f.database, 'before');
    target.close();
    await (await import('node:fs/promises')).mkdir(f.backups, { recursive: true });
    const source = path.join(f.backups, 'candidate.sqlite');
    const candidate = writeDb(source, 'after');
    candidate.close();
    const result = await restoreDatabase({ source, target: f.database, directory: f.backups, apply: true });
    assert.equal(result.applied, true);
    assert.deepEqual(values(f.database), ['after']);
    assert.deepEqual(values(result.safetyCopy), ['before']);
    assert.equal((await stat(result.safetyCopy)).mode & 0o777, 0o600);
  } finally { await f.close(); }
});

test('restore rejects backup symlinks and paths resolving outside its directory', async () => {
  const f = await fixture();
  try {
    await mkdir(f.backups, { recursive: true });
    const outside = path.join(f.root, 'outside.sqlite');
    const db = writeDb(outside, 'outside');
    db.close();
    const link = path.join(f.backups, 'outside-link.sqlite');
    await symlink(outside, link);
    await assert.rejects(restoreDatabase({ source: link, target: f.database, directory: f.backups }), /regular SQLite file|symlink/i);
    await assert.rejects(restoreDatabase({ source: outside, target: f.database, directory: f.backups }), /inside DATABASE_BACKUP_DIR/i);
  } finally { await f.close(); }
});
