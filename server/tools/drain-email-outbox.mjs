import * as store from '../store.mjs';
import { openStore } from '../store.mjs';
import { createHexclaveEmailService } from '../hexclave/email.mjs';

const sendPending = process.argv.includes('--send-pending');
// PostgreSQL via DATABASE_URL or DATABASE_HOST/PORT/USER/PASSWORD/NAME; PGlite under .data/ locally; refuses to run in production without Postgres.
const db = openStore({ env: process.env });

try {
  const pending = await store.listPendingEmailOutbox(db);
  if (!sendPending) {
    process.stdout.write(JSON.stringify({ mode: 'dry-run', database: db.description, pending: pending.length }) + '\n');
    process.stdout.write('Pass --send-pending to explicitly deliver queued or blocked messages.\n');
  } else {
    const email = createHexclaveEmailService({ db, store, env: process.env });
    if (!email.configured) throw new Error('Set HEXCLAVE_PROJECT_ID and HEXCLAVE_SECRET_SERVER_KEY before draining the email outbox.');
    // A request interrupted after claim may already have reached Hexclave. It must stay unknown.
    await store.markInterruptedEmailSendsUnknown(db);
    const result = await email.drainPending();
    process.stdout.write(JSON.stringify({ mode: 'sent', ...result }) + '\n');
  }
} catch (error) {
  process.stderr.write(`${error.message || 'Email outbox operation failed.'}\n`);
  process.exitCode = 1;
} finally {
  await store.closeStore(db);
}
