import { backup, DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(root, '.data/friday.sqlite'));
const backupDirectory = path.resolve(process.env.DATABASE_BACKUP_DIR || path.join(root, 'backups'));
process.umask(0o077);

async function assertNoSidecars(file, purpose) {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = await lstat(`${file}${suffix}`).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (sidecar) throw new Error(`${purpose} has a SQLite ${suffix.slice(1)} sidecar. Stop Friday and checkpoint/close the database before continuing.`);
  }
}

function integrityCheck(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const result = db.prepare('PRAGMA integrity_check').get();
    if (result?.integrity_check !== 'ok') throw new Error('The SQLite file did not pass integrity_check.');
  } finally {
    db.close();
  }
}

export async function restoreDatabase({ source, target = databasePath, directory = backupDirectory, apply = false, now = new Date() } = {}) {
  if (!source) throw new Error('Pass a backup path.');
  const sourcePath = path.resolve(source);
  const targetPath = path.resolve(target);
  const allowedDirectory = path.resolve(directory);
  if (!sourcePath.startsWith(`${allowedDirectory}${path.sep}`)) throw new Error('Restore source must be inside DATABASE_BACKUP_DIR.');
  if (sourcePath === targetPath) throw new Error('Restore source and live database must be different files.');
  const sourceStat = await lstat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error('Restore source must be a regular SQLite file, not a symlink.');
  const [canonicalSource, canonicalDirectory] = await Promise.all([realpath(sourcePath), realpath(allowedDirectory)]);
  if (!canonicalSource.startsWith(`${canonicalDirectory}${path.sep}`)) throw new Error('Restore source resolves outside DATABASE_BACKUP_DIR.');
  await assertNoSidecars(sourcePath, 'Restore source');
  integrityCheck(sourcePath);
  if (!apply) return { applied: false, source: sourcePath, target: targetPath };

  await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  const targetStat = await lstat(targetPath).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (targetStat && (!targetStat.isFile() || targetStat.isSymbolicLink())) throw new Error('Live database target must be a regular file, not a symlink.');
  await assertNoSidecars(targetPath, 'Live database');
  const stamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const staged = `${targetPath}.restore-${process.pid}.tmp`;
  const safetyCopy = targetStat ? `${targetPath}.pre-restore-${stamp}-${randomUUID()}` : null;
  if (await lstat(staged).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))) throw new Error('A restore staging file already exists. Remove it after checking why the last restore stopped.');

  try {
    const sourceDb = new DatabaseSync(sourcePath, { readOnly: true });
    try {
      await backup(sourceDb, staged);
    } finally {
      sourceDb.close();
    }
    await chmod(staged, 0o600);
    integrityCheck(staged);
  } catch (error) {
    await unlink(staged).catch(() => {});
    throw error;
  }

  try {
    if (safetyCopy) {
      const currentDb = new DatabaseSync(targetPath, { readOnly: true });
      try {
        await backup(currentDb, safetyCopy);
      } finally {
        currentDb.close();
      }
      await chmod(safetyCopy, 0o600);
      integrityCheck(safetyCopy);
    }
    await rename(staged, targetPath);
    await chmod(targetPath, 0o600);
  } catch (error) {
    await unlink(staged).catch(() => {});
    throw error;
  }
  return { applied: true, source: sourcePath, target: targetPath, safetyCopy };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter(arg => arg !== '--apply');
  const apply = process.argv.includes('--apply');
  restoreDatabase({ source: args[0], apply })
    .then(result => {
      if (result.applied) {
        console.log(`Restore applied from ${result.source} to ${result.target}.`);
        if (result.safetyCopy) console.log(`Previous database saved at ${result.safetyCopy}.`);
      } else {
        console.log(`Restore preview passed integrity_check: ${result.source} -> ${result.target}`);
        console.log('Stop Friday and pass --apply to replace the live database.');
      }
    })
    .catch(error => {
      console.error(`SQLite restore failed: ${error.message}`);
      process.exitCode = 1;
    });
}
