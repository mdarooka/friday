import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from '../store.mjs';
import { openStore } from '../store.mjs';
import { createHexclaveEmailService } from '../hexclave/email.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sendPending = process.argv.includes('--send-pending');
const dbPath = process.env.EMAIL_OUTBOX_DATABASE_PATH || process.env.DATABASE_PATH || path.join(root, '.data/friday.sqlite');
const db = openStore(dbPath);

try {
  const pending = store.listPendingEmailOutbox(db);
  if (!sendPending) {
    process.stdout.write(JSON.stringify({ mode: 'dry-run', database: path.basename(dbPath), pending: pending.length }) + '\n');
    process.stdout.write('Pass --send-pending to explicitly deliver queued or blocked messages.\n');
  } else {
    const email = createHexclaveEmailService({ db, store, env: process.env });
    if (!email.configured) throw new Error('Set HEXCLAVE_PROJECT_ID and HEXCLAVE_SECRET_SERVER_KEY before draining the email outbox.');
    // A request interrupted after claim may already have reached Hexclave. It must stay unknown.
    store.markInterruptedEmailSendsUnknown(db);
    const result = await email.drainPending();
    process.stdout.write(JSON.stringify({ mode: 'sent', ...result }) + '\n');
  }
} catch (error) {
  process.stderr.write(`${error.message || 'Email outbox operation failed.'}\n`);
  process.exitCode = 1;
} finally {
  store.closeStore(db);
}
