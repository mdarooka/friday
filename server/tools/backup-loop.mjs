import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupDatabase } from './backup-database.mjs';

export async function runBackupLoop({ intervalSeconds = process.env.DATABASE_BACKUP_INTERVAL_SECONDS || '86400', runBackup = backupDatabase, log = console.log, sleep = delay } = {}) {
  const seconds = Number(intervalSeconds);
  if (!Number.isSafeInteger(seconds) || seconds < 60) throw new Error('DATABASE_BACKUP_INTERVAL_SECONDS must be an integer of at least 60.');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    while (!controller.signal.aborted) {
      try {
        const file = await runBackup();
        log(`Scheduled SQLite backup completed: ${file}`);
      } catch (error) {
        console.error(`Scheduled SQLite backup failed: ${error.message}`);
      }
      if (!controller.signal.aborted) {
        try { await sleep(seconds * 1000, undefined, { signal: controller.signal }); }
        catch (error) { if (error.name !== 'AbortError') throw error; }
      }
    }
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBackupLoop().catch(error => {
    console.error(`SQLite backup scheduler failed: ${error.message}`);
    process.exitCode = 1;
  });
}
