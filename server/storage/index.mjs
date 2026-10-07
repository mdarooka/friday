/* Trip storage selection. TRIP_STORAGE=sqlite (default) keeps trips in the SQLite `records` table; TRIP_STORAGE=hexclave
   keeps only kind 'trips' in a Hexclave Data Vault store. Users, sessions, other record kinds, jobs, shares, itineraries
   and Google tokens always stay in SQLite. The returned object is async and has the same shape for both backends. */
import * as store from '../store.mjs';
import { createVaultClient, createVaultTripStore, VaultError } from './hexclave-vault.mjs';

export { VaultError };

/** Reads and validates the environment. Throws at startup (never at request time) when hexclave is selected but not configured. */
export function resolveTripStorage(env = process.env) {
  const mode = (env.TRIP_STORAGE || 'sqlite').trim().toLowerCase();
  if (mode === 'sqlite') return { mode };
  if (mode !== 'hexclave') throw new Error(`TRIP_STORAGE must be "sqlite" or "hexclave" (got "${String(env.TRIP_STORAGE).slice(0, 40)}").`);
  const required = ['HEXCLAVE_PROJECT_ID', 'HEXCLAVE_SECRET_SERVER_KEY', 'HEXCLAVE_VAULT_SECRET'];
  const missing = required.filter(name => !(env[name] || '').trim());
  if (missing.length) throw new Error(`TRIP_STORAGE=hexclave needs ${missing.join(', ')} to be set (Hexclave dashboard, Project Keys). Set them, or unset TRIP_STORAGE to keep trips in SQLite.`);
  return {
    mode,
    vault: { projectId: env.HEXCLAVE_PROJECT_ID.trim(), secretServerKey: env.HEXCLAVE_SECRET_SERVER_KEY.trim(), secret: env.HEXCLAVE_VAULT_SECRET, store: (env.HEXCLAVE_VAULT_STORE || '').trim() || 'friday-trips', baseUrl: (env.HEXCLAVE_API_URL || '').trim() || undefined }
  };
}

/* The SQLite implementation: thin async wrappers over the named functions in ../store.mjs. */
function sqliteTripStore(db) {
  return {
    mode: 'sqlite',
    find: async (id, userId) => await store.findRecord(db, id, userId, 'trips'),
    findId: async (id, userId) => await store.findTripId(db, id, userId),
    list: async userId => await store.listRecords(db, userId, 'trips'),
    insert: async ({ id, userId, data, updated }) => { await store.insertRecord(db, { id, userId, kind: 'trips', data, updated }); },
    updateIfVersion: async ({ id, userId, data, updated, version }) => await store.updateRecordIfVersion(db, { id, userId, kind: 'trips', data, updated, version }),
    overwrite: async ({ id, userId, data, updated }) => (await store.overwriteRecord(db, { id, userId, data, updated })).changes,
    delete: async (id, userId) => (await store.deleteRecord(db, id, userId, 'trips')).changes,
    /* A shared link's trip: { trip_id, expires, data } or undefined. */
    findShare: async tokenHash => await store.findShare(db, tokenHash)
  };
}

function vaultTripStore(db, vault) {
  const trips = createVaultTripStore({ vault });
  return {
    ...trips,
    mode: 'hexclave',
    // The share row lives in SQLite; the trip it points at lives in the vault and is looked up under the share's owner.
    async findShare(tokenHash) {
      const share = await store.findShareLink(db, tokenHash);
      if (!share) return undefined;
      const trip = await trips.find(share.trip_id, share.user_id);
      return trip ? { trip_id: share.trip_id, expires: share.expires, data: trip.data } : undefined;
    }
  };
}

/** `config` is resolveTripStorage(env); `vault` replaces the REST client (tests). */
export function createTripStore({ db, config, fetch, vault }) {
  if (config.mode !== 'hexclave') return sqliteTripStore(db);
  return vaultTripStore(db, vault || createVaultClient({ ...config.vault, fetch }));
}
