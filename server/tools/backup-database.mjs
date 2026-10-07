import { backup, DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(root, '.data/friday.sqlite'));
const backupDirectory = path.resolve(process.env.DATABASE_BACKUP_DIR || path.join(root, 'backups'));
process.umask(0o077);

export async function backupDatabase({ source = databasePath, directory = backupDirectory, now = new Date(), retentionCount = process.env.DATABASE_BACKUP_RETENTION_COUNT || '7' } = {}) {
  const keep = Number(retentionCount);
  if (!Number.isSafeInteger(keep) || keep < 1) throw new Error('DATABASE_BACKUP_RETENTION_COUNT must be a positive integer.');
  const sourcePath = path.resolve(source);
  const targetDirectory = path.resolve(directory);
  if (sourcePath === targetDirectory || targetDirectory.startsWith(`${sourcePath}${path.sep}`)) {
    throw new Error('The backup directory must not be inside the live database file path.');
  }
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) throw new Error('DATABASE_PATH must point to a regular SQLite file.');

  await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
  await chmod(targetDirectory, 0o700);
  const stamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const destination = path.join(targetDirectory, `friday-${stamp}-${randomUUID()}.sqlite`);
  const db = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    const result = db.prepare('PRAGMA integrity_check').get();
    if (result?.integrity_check !== 'ok') throw new Error('The live SQLite database did not pass integrity_check.');
    await backup(db, destination);
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  } finally {
    db.close();
  }

  await chmod(destination, 0o600);
  const copied = new DatabaseSync(destination, { readOnly: true });
  try {
    const result = copied.prepare('PRAGMA integrity_check').get();
    if (result?.integrity_check !== 'ok') throw new Error('The new backup did not pass integrity_check.');
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  } finally {
    copied.close();
    await Promise.all([`${destination}-wal`, `${destination}-shm`].map(file => unlink(file).catch(() => {})));
  }

  const snapshots = (await readdir(targetDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /^friday-\d{4}-\d{2}-\d{2}T.+-[0-9a-f-]{36}\.sqlite$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
  for (const oldSnapshot of snapshots.slice(0, Math.max(0, snapshots.length - keep))) {
    const oldPath = path.join(targetDirectory, oldSnapshot);
    await unlink(oldPath);
    await Promise.all([`${oldPath}-wal`, `${oldPath}-shm`].map(file => unlink(file).catch(() => {})));
  }
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  backupDatabase()
    .then(file => console.log(`SQLite backup created and verified: ${file}`))
    .catch(error => {
      console.error(`SQLite backup failed: ${error.message}`);
      process.exitCode = 1;
    });
}
