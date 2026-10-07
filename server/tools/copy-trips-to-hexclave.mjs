#!/usr/bin/env node
/* One-time copy of the planner trips in SQLite into the Hexclave Data Vault.
     node --env-file-if-exists=.env server/tools/copy-trips-to-hexclave.mjs            dry run: reads, writes nothing
     node --env-file-if-exists=.env server/tools/copy-trips-to-hexclave.mjs --apply    writes the missing trips
   Needs HEXCLAVE_PROJECT_ID, HEXCLAVE_SECRET_SERVER_KEY, HEXCLAVE_VAULT_SECRET (and optionally HEXCLAVE_VAULT_STORE,
   HEXCLAVE_API_URL, DATABASE_PATH). It never deletes or changes anything in SQLite, never overwrites a trip that is already in
   the vault, and is safe to run again. Stop the server first so no trip is edited while it copies. Trips keep their id,
   owner, version and updated time. It prints counts only, never trip contents or keys. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as store from '../store.mjs';
import { resolveTripStorage } from '../storage/index.mjs';
import { createVaultClient, createVaultTripStore } from '../storage/hexclave-vault.mjs';

export async function copyTrips({ db, vaultTrips, apply = false, log = () => {} }) {
  const summary = { found: 0, copied: 0, wouldCopy: 0, alreadyInVault: 0, failed: 0 };
  for (const row of store.listAllTrips(db)) {
    summary.found++;
    try {
      const existing = await vaultTrips.find(row.id, row.user_id);
      if (existing) { summary.alreadyInVault++; continue; }
      if (!apply) { summary.wouldCopy++; continue; }
      await vaultTrips.insert({ id: row.id, userId: row.user_id, data: row.data, version: row.version, updated: row.updated });
      summary.copied++;
    } catch (e) { summary.failed++; log(`trip ${row.id}: ${e?.code || 'error'}: ${String(e?.message || e).slice(0, 200)}`); }
  }
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes('--apply');
  try {
    const config = resolveTripStorage({ ...process.env, TRIP_STORAGE: 'hexclave' });
    const file = process.env.DATABASE_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.data/friday.sqlite');
    const db = new DatabaseSync(file, { readOnly: true });
    const summary = await copyTrips({ db, vaultTrips: createVaultTripStore({ vault: createVaultClient(config.vault) }), apply, log: m => console.error(m) });
    db.close();
    console.log(`${apply ? 'Applied' : 'Dry run (nothing written; pass --apply to write)'}: ${summary.found} trips in SQLite, ${summary.alreadyInVault} already in the vault, ${apply ? `${summary.copied} copied` : `${summary.wouldCopy} would be copied`}, ${summary.failed} failed.`);
    process.exitCode = summary.failed ? 1 : 0;
  } catch (e) { console.error(`copy failed: ${String(e?.message || e).slice(0, 300)}`); process.exitCode = 1; }
}
