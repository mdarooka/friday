/* Hexclave Data Vault client and a trip store built on it. Node built-ins only (no SDK): the REST calls below are what
   @hexclave/js 1.0.123 sends for getDataVaultStore(id).setValue / getValue.

   Where the REST details come from (@hexclave/js 1.0.123 depends on @hexclave/shared 1.0.123; paths are inside the
   published packages, `src/`):
   - @hexclave/js  lib/hexclave-app/apps/implementations/server-app-impl.ts  _createServerDataVaultStore (~line 1283 set,
     ~line 214 get): the store requires a string `secret`, and both calls go through the server interface.
   - @hexclave/shared  interface/server-interface.ts  getDataVaultStoreValue (~line 1128) and setDataVaultStoreValue (~1153):
       POST {base}/api/v1/data-vault/stores/{storeId}/get   body {"hashed_key": <string>}
            -> JSON {"encrypted_value": <string>}; a missing key is the known error DATA_VAULT_STORE_HASHED_KEY_DOES_NOT_EXIST
       POST {base}/api/v1/data-vault/stores/{storeId}/set   body {"hashed_key": <string>, "encrypted_value": <string>}
     Both send content-type: application/json. There is no list, delete or conditional write endpoint.
   - server-interface.ts sendServerRequest (~line 56) adds  x-hexclave-secret-server-key: <secret server key>.
   - interface/client-interface.ts sendClientRequestInner (~line 627) builds the URL as getBaseUrl() + "/api/v1" + path and
     adds X-Hexclave-Project-Id, X-Hexclave-Access-Type ("server") and X-Hexclave-Override-Error-Status: true. With that
     last header the API answers errors with HTTP 200 and the real status in x-hexclave-actual-status; a known error also
     carries x-hexclave-known-error: <CODE> and a JSON body {code,...} (_preprocessResponse/_processResponse, ~line 820).
     The legacy x-stack-* header names are still accepted by the backend according to the SDK comments; this client sends
     the x-hexclave-* names the current SDK sends.
   - Default base URL: lib/hexclave-app/apps/implementations/common.ts  defaultBaseUrl = "https://api.hexclave.com".
   - The vault "secret" is NOT sent. helpers/vault/client-side.ts (+ utils/crypto.tsx) uses it client side: the key is
     hashed (PBKDF2-SHA256, 100k iterations, then one more PBKDF2 round keyed by purpose + secret) so the server cannot
     read key names, and the value is AES-256-GCM encrypted with an HKDF key derived from secret + key. hashKey /
     encryptValue / decryptValue below are a byte-compatible port using node:crypto, including the "stack-*" purpose tags
     that the SDK deliberately never renamed. tests/hexclave-vault.test.mjs checks them against a WebCrypto port of the
     SDK source.
   Not verifiable from here (Hexclave's hosts are blocked in the build container): a live call. The store itself
   (HEXCLAVE_VAULT_STORE) must already exist in the project (dashboard, Data Vault app), otherwise the API answers
   DATA_VAULT_STORE_DOES_NOT_EXIST, which this client reports as a typed error. */
import { pbkdf2, hkdfSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);
const HASH_PURPOSE = 'stack-data-vault-client-side-encryption-key-hash';
const SECRET_PURPOSE = 'stack-data-vault-client-side-encryption-value-encryption-key-hash';
const VALUE_PURPOSE = 'stack-data-vault-client-side-encryption-value-encryption-value-encryption';
const b64 = bytes => Buffer.from(bytes).toString('base64');

/** Thrown for every vault failure. Messages are safe to log: they never contain keys, secrets, values or response bodies. */
export class VaultError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'VaultError';
    this.code = code;   // config | auth | store-missing | http | network | timeout | decrypt | corrupt | conflict
    if (status !== undefined) this.httpStatus = status;
  }
}

const iteratedHash = (purpose, extra, value, iterations) => pbkdf2Async(value, JSON.stringify(['stack-crypto-helper-iterated-hash', purpose, '', b64(Buffer.from(extra, 'utf8'))]), iterations, 32, 'sha256');
const derivedKey = (secret, key) => iteratedHash(SECRET_PURPOSE, secret, Buffer.from(key, 'utf8'), 100_000);
export const hashKey = async (secret, key, derived) => b64(await iteratedHash(HASH_PURPOSE, secret, derived || await derivedKey(secret, key), 1));
export function encryptValue(derived, value) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const aesKey = Buffer.from(hkdfSync('sha256', derived, salt, JSON.stringify(['stack-crypto-helper-derived-symmetric-key', VALUE_PURPOSE, 'binary-key', b64(salt)]), 32));
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return b64(Buffer.concat([Buffer.from([1, 0]), salt, iv, body]));
}
export function decryptValue(derived, encrypted) {
  try {
    const raw = Buffer.from(encrypted, 'base64');
    if (raw.length < 2 + 16 + 12 + 16 || raw[0] !== 1 || raw[1] !== 0) throw new Error('format');
    const salt = raw.subarray(2, 18), iv = raw.subarray(18, 30), body = raw.subarray(30);
    const aesKey = Buffer.from(hkdfSync('sha256', derived, salt, JSON.stringify(['stack-crypto-helper-derived-symmetric-key', VALUE_PURPOSE, 'binary-key', b64(salt)]), 32));
    const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]).toString('utf8');
  } catch { throw new VaultError('decrypt', 'A Data Vault value could not be decrypted. Check that HEXCLAVE_VAULT_SECRET is the secret the data was written with.'); }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createVaultClient({ projectId, secretServerKey, secret, store = 'friday-trips', baseUrl = 'https://api.hexclave.com', fetch: fetcher = globalThis.fetch, timeoutMs = 10_000, retryDelayMs = 200 } = {}) {
  if (!projectId || !secretServerKey || !secret) throw new VaultError('config', 'The Hexclave vault client needs a project id, a secret server key and a vault secret.');
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(store)) throw new VaultError('config', 'HEXCLAVE_VAULT_STORE may only contain letters, digits, dot, dash and underscore.');
  let origin;
  try { origin = new URL(baseUrl); if (!['https:', 'http:'].includes(origin.protocol)) throw new Error(); } catch { throw new VaultError('config', 'HEXCLAVE_API_URL must be an http(s) URL.'); }
  const apiBase = `${origin.origin}${origin.pathname.replace(/\/+$/, '')}/api/v1/data-vault/stores/${encodeURIComponent(store)}`;
  const derivedCache = new Map();   // key name -> Promise<derived key>; PBKDF2 is the expensive step, so each key pays it once
  const derive = key => {
    let p = derivedCache.get(key);
    if (!p) { if (derivedCache.size >= 5000) derivedCache.delete(derivedCache.keys().next().value); p = derivedKey(secret, key); derivedCache.set(key, p); p.catch(() => derivedCache.delete(key)); }
    return p;
  };
  const headers = { 'content-type': 'application/json', 'x-hexclave-project-id': projectId, 'x-hexclave-access-type': 'server', 'x-hexclave-secret-server-key': secretServerKey, 'x-hexclave-override-error-status': 'true' };

  /* One POST. Resolves { status, knownError, body }; throws VaultError for network and timeout. */
  async function post(action, payload) {
    let res;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);   // not AbortSignal.timeout: its timer is unref'd
    try { res = await fetcher(`${apiBase}/${action}`, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal, redirect: 'error' }); }
    catch (e) {
      clearTimeout(timer);
      if (controller.signal.aborted) throw new VaultError('timeout', `Hexclave Data Vault ${action} timed out after ${timeoutMs} ms.`);
      throw new VaultError('network', `Hexclave Data Vault ${action} could not reach the API.`);
    }
    const status = Number(res.headers.get('x-hexclave-actual-status') ?? res.headers.get('x-stack-actual-status') ?? res.status);
    const knownError = res.headers.get('x-hexclave-known-error') ?? res.headers.get('x-stack-known-error') ?? null;
    let body = null;
    try { body = await res.json(); } catch { /* an error page, or an empty body */ }
    clearTimeout(timer);
    return { status, knownError, body };
  }
  async function send(action, payload) {
    let result = await post(action, payload);
    if (result.status >= 500 && !result.knownError) { await wait(retryDelayMs); result = await post(action, payload); }   // one retry on 5xx
    return result;
  }
  const fail = (action, { status, knownError }) => {
    if (knownError === 'DATA_VAULT_STORE_DOES_NOT_EXIST') return new VaultError('store-missing', `Hexclave Data Vault store "${store}" does not exist. Create it in the Hexclave dashboard or change HEXCLAVE_VAULT_STORE.`, { status });
    if (status === 401 || status === 403) return new VaultError('auth', `Hexclave rejected the project id or secret server key (HTTP ${status}${knownError ? `, ${knownError}` : ''}).`, { status });
    return new VaultError('http', `Hexclave Data Vault ${action} failed (HTTP ${status}${knownError ? `, ${knownError}` : ''}).`, { status });
  };
  return {
    store,
    /** The stored string, or null when the key does not exist. */
    async get(key) {
      const derived = await derive(key);
      const result = await send('get', { hashed_key: await hashKey(secret, key, derived) });
      if (result.knownError === 'DATA_VAULT_STORE_HASHED_KEY_DOES_NOT_EXIST') return null;
      if (result.status < 200 || result.status >= 300 || result.knownError) throw fail('get', result);
      if (typeof result.body?.encrypted_value !== 'string') throw new VaultError('http', 'Hexclave Data Vault get returned an unexpected response.', { status: result.status });
      return decryptValue(derived, result.body.encrypted_value);
    },
    async set(key, value) {
      if (typeof value !== 'string') throw new TypeError('Vault values are strings.');
      const derived = await derive(key);
      const result = await send('set', { hashed_key: await hashKey(secret, key, derived), encrypted_value: encryptValue(derived, value) });
      if (result.status < 200 || result.status >= 300 || result.knownError) throw fail('set', result);
    }
  };
}

/* ======================================================================================================================
   Trip store on the vault. Same row shape and semantics as the SQLite functions in ../store.mjs for kind 'trips'
   ({id,user_id,kind,data,version,updated}, `data` a JSON string), so the routes do not change.
   Layout:  trip:<id>            -> JSON {id,userId,data,version,updated,deleted?}
            user:<userId>:trips  -> JSON array of trip ids (the only way to list: the vault has no listing)
   Delete writes a tombstone ({deleted:true, data:null}) and removes the id from the index.
   The vault has no atomic operations, so all writes for a user run one at a time through an in-process promise chain and
   re-read the record before writing. That keeps the version check honest inside one server process. Several server
   processes sharing one vault can lose concurrent edits (last write wins); run a single instance.
   ====================================================================================================================== */
const tripKey = id => `trip:${id}`;
const indexKey = userId => `user:${userId}:trips`;
const toRow = rec => ({ id: rec.id, user_id: rec.userId, kind: 'trips', data: rec.data, version: rec.version, updated: rec.updated });

export function createVaultTripStore({ vault, concurrency = 8 }) {
  const tails = new Map();
  const serialized = (userId, task) => {
    const run = (tails.get(userId) || Promise.resolve()).then(task);
    const tail = run.catch(() => {});
    tails.set(userId, tail);
    tail.then(() => { if (tails.get(userId) === tail) tails.delete(userId); });
    return run;
  };
  const parse = (raw, what) => { try { return JSON.parse(raw); } catch { throw new VaultError('corrupt', `A Data Vault ${what} is not valid JSON.`); } };
  const readRecord = async id => { const raw = await vault.get(tripKey(id)); return raw === null ? null : parse(raw, 'trip record'); };
  /* A live record owned by this user, or null (other owners' and deleted records look the same as missing ones). */
  const readOwned = async (id, userId) => { const rec = await readRecord(id); return rec && !rec.deleted && rec.userId === userId ? rec : null; };
  const readIndex = async userId => { const raw = await vault.get(indexKey(userId)); const ids = raw === null ? [] : parse(raw, 'trip index'); if (!Array.isArray(ids)) throw new VaultError('corrupt', 'A Data Vault trip index is not a list.'); return ids; };
  const writeRecord = rec => vault.set(tripKey(rec.id), JSON.stringify(rec));
  const writeIndex = (userId, ids) => vault.set(indexKey(userId), JSON.stringify(ids));

  return {
    async find(id, userId) { const rec = await readOwned(id, userId); return rec ? toRow(rec) : undefined; },
    async findId(id, userId) { const rec = await readOwned(id, userId); return rec ? { id: rec.id } : undefined; },
    async list(userId) {
      const ids = await readIndex(userId), rows = new Array(ids.length);
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
        while (next < ids.length) { const i = next++; const rec = await readOwned(ids[i], userId); rows[i] = rec ? toRow(rec) : null; }
      }));
      return rows.filter(Boolean).sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));   // newest first, like ORDER BY updated DESC
    },
    /** Optional `version` lets the one-time copy tool keep the SQLite version. */
    insert({ id, userId, data, updated, version = 1 }) {
      return serialized(userId, async () => {
        if (await readRecord(id)) throw new VaultError('conflict', 'A trip with this id already exists.');
        await writeRecord({ id, userId, data, version, updated });
        const ids = await readIndex(userId);
        if (!ids.includes(id)) await writeIndex(userId, [...ids, id]);
      });
    },
    /** Optimistic update: 1 when written, 0 when the record is missing or its version moved on. */
    updateIfVersion({ id, userId, data, updated, version }) {
      return serialized(userId, async () => {
        const rec = await readOwned(id, userId);
        if (!rec || rec.version !== version) return 0;
        await writeRecord({ ...rec, data, version: rec.version + 1, updated });
        return 1;
      });
    },
    /** Unconditional write (research results), bumping the version. 0 when the trip no longer exists. */
    overwrite({ id, userId, data, updated }) {
      return serialized(userId, async () => {
        const rec = await readOwned(id, userId);
        if (!rec) return 0;
        await writeRecord({ ...rec, data, version: rec.version + 1, updated });
        return 1;
      });
    },
    delete(id, userId) {
      return serialized(userId, async () => {
        const rec = await readOwned(id, userId);
        if (!rec) return 0;
        await writeRecord({ id, userId, data: null, version: rec.version + 1, updated: new Date().toISOString(), deleted: true });
        const ids = await readIndex(userId);
        if (ids.includes(id)) await writeIndex(userId, ids.filter(x => x !== id));
        return 1;
      });
    },
    // The vault API has no physical-delete operation. During account erasure, clear each payload and unlink its tombstone
    // from the owner so the retained anti-reuse marker no longer carries the deleted account id.
    deleteOwner(userId) {
      return serialized(userId, async () => {
        const ids = await readIndex(userId);
        for (const id of ids) {
          const rec = await readRecord(id);
          if (rec && rec.userId === userId) await writeRecord({ id, userId: 'deleted', data: null, version: rec.version + 1, updated: new Date().toISOString(), deleted: true });
        }
        await writeIndex(userId, []);
        return ids.length;
      });
    }
  };
}
