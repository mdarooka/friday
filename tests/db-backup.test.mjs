import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.mjs';

test('db-backup endpoint needs a long secret and a matching bearer token, and only dumps PostgreSQL', async t => {
  const secret = 'b'.repeat(40);
  assert.equal((await (await startApp(t)).request('/api/cron/db-backup', 'GET')).status, 404);
  assert.equal((await (await startApp(t, { env: { FRIDAY_BACKUP_SECRET: 'short' } })).request('/api/cron/db-backup', 'GET')).status, 404);
  const app = await startApp(t, { env: { FRIDAY_BACKUP_SECRET: secret, FRIDAY_CRON_SECRET: 'c'.repeat(40) } });
  const call = token => app.request('/api/cron/db-backup', 'GET', undefined, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  assert.equal((await call()).status, 401);
  assert.equal((await call('x'.repeat(40))).status, 401);
  assert.equal((await call('c'.repeat(40))).status, 401);   // the cron secret does not open backups
  assert.equal((await call(secret)).status, 503);           // in-memory PGlite
});
