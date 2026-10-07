import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.mjs';
import { openStore, createUser, insertRecord } from '../server/store.mjs';
import { startApp, signUp, origin } from './helpers.mjs';
import { createFakeVault, fakeKeys } from './fake-vault.mjs';
import { createVaultClient, createVaultTripStore, VaultError, hashKey, encryptValue, decryptValue } from '../server/storage/hexclave-vault.mjs';
import { resolveTripStorage } from '../server/storage/index.mjs';
import { copyTrips } from '../server/tools/copy-trips-to-hexclave.mjs';
import { createGoogleIntegration } from '../server/google.mjs';

const secrets = [fakeKeys.HEXCLAVE_SECRET_SERVER_KEY, fakeKeys.HEXCLAVE_VAULT_SECRET];
const clientFor = (fake, extra = {}) => createVaultClient({ projectId: fakeKeys.HEXCLAVE_PROJECT_ID, secretServerKey: fakeKeys.HEXCLAVE_SECRET_SERVER_KEY, secret: fakeKeys.HEXCLAVE_VAULT_SECRET, store: fakeKeys.HEXCLAVE_VAULT_STORE, fetch: fake.fetch, retryDelayMs: 1, ...extra });
const noSecrets = (text, label) => { for (const s of secrets) assert.equal(String(text).includes(s), false, `${label} leaks a secret`); };

async function startVaultApp(t, { fake = createFakeVault(), env = {}, ...options } = {}) {
  const logs = [];
  const errors = [], realError = console.error;
  console.error = (...a) => { errors.push(a.join(' ')); };
  t.after(() => { console.error = realError; });
  const app = await startApp(t, { env: { ...env, TRIP_STORAGE: 'hexclave', ...fakeKeys }, vaultFetch: fake.fetch, log: m => logs.push(m), ...options });
  return { ...app, fake, logs, errors, vault: clientFor(fake) };
}
const trip = (title = 'Kyoto') => ({ title, destination: 'Japan', startDate: '2026-11-01', endDate: '2026-11-03', days: [] });

/* ---- crypto: byte compatibility with the SDK's WebCrypto implementation (ported from @hexclave/shared helpers/vault + utils/crypto) ---- */
const ref = (() => {
  const enc = new TextEncoder(), b64 = u => Buffer.from(u).toString('base64');
  const iterated = async (purpose, extra, value, iterations) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(JSON.stringify(['stack-crypto-helper-iterated-hash', purpose, '', b64(enc.encode(extra))])), iterations, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', typeof value === 'string' ? enc.encode(value) : value, 'PBKDF2', false, ['deriveBits']), 256));
  const derived = (secret, key) => iterated('stack-data-vault-client-side-encryption-value-encryption-key-hash', secret, key, 100000);
  const sym = async (secret, salt) => crypto.subtle.deriveKey({ name: 'HKDF', salt, hash: 'SHA-256', info: enc.encode(JSON.stringify(['stack-crypto-helper-derived-symmetric-key', 'stack-data-vault-client-side-encryption-value-encryption-value-encryption', 'binary-key', b64(salt)])) }, await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return {
    hashKey: async (secret, key) => b64(await iterated('stack-data-vault-client-side-encryption-key-hash', secret, await derived(secret, key), 1)),
    async encrypt(secret, key, value) { const iv = crypto.getRandomValues(new Uint8Array(12)), salt = crypto.getRandomValues(new Uint8Array(16)); const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sym(await derived(secret, key), salt), enc.encode(value))); return b64(new Uint8Array([1, 0, ...salt, ...iv, ...c])); },
    async decrypt(secret, key, value) { const raw = new Uint8Array(Buffer.from(value, 'base64')); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(18, 30) }, await sym(await derived(secret, key), raw.slice(2, 18)), raw.slice(30))); },
    derived
  };
})();

test('key hashing and value encryption are byte-compatible with the Hexclave SDK', async () => {
  const secret = 'a secret with ünïcode', key = 'trip:0b1f-ü';
  assert.equal(await hashKey(secret, key), await ref.hashKey(secret, key));
  const derived = Buffer.from(await ref.derived(secret, key));
  const value = JSON.stringify({ title: 'Kyoto ✈', n: 1 });
  assert.equal(await ref.decrypt(secret, key, encryptValue(derived, value)), value, 'SDK decrypts what we encrypt');
  assert.equal(decryptValue(derived, await ref.encrypt(secret, key, value)), value, 'we decrypt what the SDK encrypts');
  assert.throws(() => decryptValue(Buffer.alloc(32, 7), encryptValue(derived, value)), VaultError);
});

/* ---- client ---- */
test('the client sends the documented requests and the vault only sees hashed keys and ciphertext', async () => {
  const fake = createFakeVault(), vault = clientFor(fake);
  assert.equal(await vault.get('trip:abc'), null, 'a missing key reads as null');
  await vault.set('trip:abc', '{"private":"Kyoto plan"}');
  assert.equal(await vault.get('trip:abc'), '{"private":"Kyoto plan"}');
  const set = fake.requests.find(r => r.url.endsWith('/set'));
  assert.equal(set.url, 'https://api.hexclave.com/api/v1/data-vault/stores/friday-trips/set');
  assert.equal(set.method, 'POST');
  assert.equal(set.headers['x-hexclave-project-id'], 'proj-test-1');
  assert.equal(set.headers['x-hexclave-access-type'], 'server');
  assert.equal(set.headers['x-hexclave-secret-server-key'], fakeKeys.HEXCLAVE_SECRET_SERVER_KEY);
  assert.deepEqual(Object.keys(set.body).sort(), ['encrypted_value', 'hashed_key']);
  const wire = JSON.stringify(fake.requests.map(r => r.body)) + [...fake.data.values()].join('');
  assert.equal(wire.includes('trip:abc'), false); assert.equal(wire.includes('Kyoto'), false); noSecrets(wire, 'wire bodies');
});
test('typed errors: wrong secret, missing store, bad key, outage, network, timeout; retry once on 5xx; no secrets in messages', async () => {
  const fake = createFakeVault();
  await clientFor(fake).set('k', 'v');
  const caught = async p => { try { await p; } catch (e) { return e; } assert.fail('expected an error'); };
  const messages = [];
  const check = e => { assert.ok(e instanceof VaultError); messages.push(e.message, String(e.stack), JSON.stringify(e)); return e; };
  assert.throws(() => createVaultClient({ projectId: 'p', secretServerKey: 'x', secret: '', fetch: fake.fetch }), e => e instanceof VaultError && e.code === 'config');
  assert.equal(await clientFor(fake, { secret: 'a different secret' }).get('k'), null, 'another secret addresses other keys');
  // a ciphertext written under another secret, planted at our hashed key: decrypt fails with a typed error
  const other = clientFor(fake, { secret: 'a different secret' }); await other.set('k2', 'v2');
  const foreign = [...fake.data.values()].at(-1);
  fake.data.set(`friday-trips\n${await hashKey(fakeKeys.HEXCLAVE_VAULT_SECRET, 'k2')}`, foreign);
  let e = check(await caught(clientFor(fake).get('k2'))); assert.equal(e.code, 'decrypt');
  e = check(await caught(clientFor(fake, { store: 'nope' }).get('k'))); assert.equal(e.code, 'store-missing');
  e = check(await caught(clientFor(fake, { secretServerKey: 'wrong-key-value' }).get('k'))); assert.equal(e.code, 'auth');
  fake.failures.push({ status: 503 }); assert.equal(await clientFor(fake).get('k'), 'v', 'one 5xx is retried');
  fake.failures.push({ status: 500 }, { status: 502 }); e = check(await caught(clientFor(fake).get('k'))); assert.equal(e.code, 'http'); assert.equal(e.httpStatus, 502);
  fake.failures.push({ network: true }); e = check(await caught(clientFor(fake).get('k'))); assert.equal(e.code, 'network');
  fake.failures.push({ hang: true }); e = check(await caught(clientFor(fake, { timeoutMs: 20 }).get('k'))); assert.equal(e.code, 'timeout');
  const before = fake.requests.length; fake.failures.push({ status: 400 }); await caught(clientFor(fake).get('k')); assert.equal(fake.requests.length, before + 1, '4xx is not retried');
  noSecrets(messages.join('\n'), 'error output');
});

/* ---- trip store ---- */
test('trip store: layout, index maintenance, tombstones, version check, isolation, serialized writes', async () => {
  const fake = createFakeVault(), vault = clientFor(fake), trips = createVaultTripStore({ vault });
  const at = n => `2026-01-0${n}T00:00:00.000Z`;
  await trips.insert({ id: 't1', userId: 'alice', data: '{"title":"One"}', updated: at(1) });
  await trips.insert({ id: 't2', userId: 'alice', data: '{"title":"Two"}', updated: at(2) });
  await trips.insert({ id: 'b1', userId: 'bob', data: '{"title":"Bob"}', updated: at(3) });
  assert.deepEqual(JSON.parse(await vault.get('user:alice:trips')), ['t1', 't2']);
  assert.deepEqual(JSON.parse(await vault.get('user:bob:trips')), ['b1']);
  assert.deepEqual(JSON.parse(await vault.get('trip:t1')), { id: 't1', userId: 'alice', data: '{"title":"One"}', version: 1, updated: at(1) });
  assert.deepEqual((await trips.list('alice')).map(r => r.id), ['t2', 't1'], 'newest first');
  assert.deepEqual(await trips.list('nobody'), []);
  await assert.rejects(trips.insert({ id: 't1', userId: 'bob', data: '{}', updated: at(1) }), VaultError, 'an id is never reused');
  // isolation
  assert.equal(await trips.find('t1', 'bob'), undefined); assert.equal(await trips.findId('t1', 'bob'), undefined);
  assert.equal(await trips.updateIfVersion({ id: 't1', userId: 'bob', data: '{"title":"x"}', updated: at(4), version: 1 }), 0);
  assert.equal(await trips.overwrite({ id: 't1', userId: 'bob', data: '{}', updated: at(4) }), 0);
  assert.equal(await trips.delete('t1', 'bob'), 0);
  assert.equal((await trips.find('t1', 'alice')).data, '{"title":"One"}');
  // versions
  assert.equal(await trips.updateIfVersion({ id: 't1', userId: 'alice', data: '{"title":"One b"}', updated: at(4), version: 1 }), 1);
  assert.equal(await trips.updateIfVersion({ id: 't1', userId: 'alice', data: '{"title":"stale"}', updated: at(5), version: 1 }), 0, 'stale version');
  assert.equal((await trips.find('t1', 'alice')).version, 2);
  assert.equal(await trips.overwrite({ id: 't1', userId: 'alice', data: '{"title":"One c"}', updated: at(5) }), 1);
  assert.equal((await trips.find('t1', 'alice')).version, 3);
  // concurrent edits from the same version: exactly one wins
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => trips.updateIfVersion({ id: 't2', userId: 'alice', data: `{"title":"w${i}"}`, updated: at(6), version: 1 })));
  assert.equal(results.filter(Boolean).length, 1); assert.equal((await trips.find('t2', 'alice')).version, 2);
  // concurrent inserts keep the index complete
  await Promise.all(['c1', 'c2', 'c3', 'c4'].map((id, i) => trips.insert({ id, userId: 'carol', data: '{"title":"c"}', updated: at(i + 1) })));
  assert.deepEqual(JSON.parse(await vault.get('user:carol:trips')).sort(), ['c1', 'c2', 'c3', 'c4']);
  // tombstone
  assert.equal(await trips.delete('t1', 'alice'), 1);
  assert.deepEqual(JSON.parse(await vault.get('user:alice:trips')), ['t2']);
  const tomb = JSON.parse(await vault.get('trip:t1'));
  assert.equal(tomb.deleted, true); assert.equal(tomb.data, null); assert.equal(tomb.userId, 'alice'); assert.equal(tomb.version, 4);
  assert.equal(await trips.find('t1', 'alice'), undefined); assert.equal(await trips.delete('t1', 'alice'), 0);
  assert.equal(await trips.updateIfVersion({ id: 't1', userId: 'alice', data: '{}', updated: at(7), version: 4 }), 0);
  await assert.rejects(trips.insert({ id: 't1', userId: 'alice', data: '{}', updated: at(7) }), VaultError, 'a tombstone also blocks reuse');
  assert.deepEqual((await trips.list('alice')).map(r => r.id), ['t2']);
  // an index entry whose record is gone or foreign is skipped, not an error
  await vault.set('user:alice:trips', JSON.stringify(['t2', 'ghost', 'b1']));
  assert.deepEqual((await trips.list('alice')).map(r => r.id), ['t2']);
});

/* ---- the app on the vault ---- */
test('vault mode: trips CRUD through the API, 409 on stale versions, isolation, nothing in SQLite records', async t => {
  const { request, fake, dbPath, vault } = await startVaultApp(t);
  const a = await signUp(request, 'A'), b = await signUp(request, 'B');
  const created = await request('/api/trips', 'POST', { data: trip() }, { cookie: a.cookie });
  assert.equal(created.status, 201); assert.equal(created.result.record.version, 1); assert.equal(created.result.record.kind, 'trips');
  const id = created.result.record.id;
  assert.equal((await request('/api/trips', 'GET', undefined, { cookie: a.cookie })).result.records.length, 1);
  assert.equal((await request('/api/trips', 'GET', undefined, { cookie: b.cookie })).result.records.length, 0);
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await request('/api/trips/' + id, method, method === 'PUT' ? { data: trip('Hijack'), version: 1 } : undefined, { cookie: b.cookie })).status, 404, method);
  const updated = await request('/api/trips/' + id, 'PUT', { data: trip('Kyoto 2'), version: 1 }, { cookie: a.cookie });
  assert.equal(updated.status, 200); assert.equal(updated.result.record.version, 2); assert.equal(updated.result.record.data.title, 'Kyoto 2');
  const stale = await request('/api/trips/' + id, 'PUT', { data: trip('Stale'), version: 1 }, { cookie: a.cookie });
  assert.equal(stale.status, 409); assert.match(stale.result.error, /changed in another window/);
  assert.equal((await request('/api/trips/' + id, 'PUT', { data: trip('x') }, { cookie: a.cookie })).status, 422);
  assert.equal((await request('/api/trips/' + id, 'GET', undefined, { cookie: a.cookie })).result.record.data.title, 'Kyoto 2');
  // other kinds stay in SQLite
  assert.equal((await request('/api/places', 'POST', { data: { title: 'Garden' } }, { cookie: a.cookie })).status, 201);
  const db = new DatabaseSync(dbPath);
  assert.deepEqual(db.prepare('SELECT kind,count(*) AS n FROM records GROUP BY kind').all().map(r => ({ ...r })), [{ kind: 'places', n: 1 }]);
  db.close();
  assert.equal(fake.size, 2, "one trip record and one index in the vault");
  // delete: tombstone, index, 404 afterwards
  assert.equal((await request('/api/trips/' + id, 'DELETE', undefined, { cookie: a.cookie })).status, 200);
  assert.equal(JSON.parse(await vault.get('trip:' + id)).deleted, true);
  assert.deepEqual(JSON.parse(await vault.get(`user:${a.result.user.id}:trips`)), []);
  assert.equal((await request('/api/trips/' + id, 'GET', undefined, { cookie: a.cookie })).status, 404);
  assert.equal((await request('/api/trips', 'GET', undefined, { cookie: a.cookie })).result.records.length, 0);
});

test('vault mode: shares for a vault trip work, expire, and are removed with the trip', async t => {
  const { request, dbPath } = await startVaultApp(t);
  const a = await signUp(request, 'A'), b = await signUp(request, 'B');
  const id = (await request('/api/trips', 'POST', { data: trip() }, { cookie: a.cookie })).result.record.id;
  assert.equal((await request(`/api/trips/${id}/share`, 'POST', {}, { cookie: b.cookie })).status, 404, 'only the owner can share');
  const share = await request(`/api/trips/${id}/share`, 'POST', {}, { cookie: a.cookie });
  assert.equal(share.status, 201);
  const token = new URL(share.result.share.url, 'http://x').searchParams.get('share');
  const shared = await request('/api/shared/' + token);
  assert.equal(shared.status, 200); assert.equal(shared.result.trip.title, 'Kyoto');
  const hashed = createHash('sha256').update(token).digest('hex');
  let db = new DatabaseSync(dbPath); db.prepare('UPDATE shares SET expires=0 WHERE token_hash=?').run(hashed); db.close();
  assert.equal((await request('/api/shared/' + token)).status, 404, 'expired');
  const again = await request(`/api/trips/${id}/share`, 'POST', {}, { cookie: a.cookie });
  const token2 = new URL(again.result.share.url, 'http://x').searchParams.get('share');
  assert.equal((await request('/api/shared/' + token2)).status, 200);
  assert.equal((await request(`/api/trips/${id}`, 'DELETE', undefined, { cookie: a.cookie })).status, 200);
  assert.equal((await request('/api/shared/' + token2)).status, 404, 'a deleted trip is no longer shared');
  db = new DatabaseSync(dbPath); assert.equal(db.prepare('SELECT count(*) AS n FROM shares').get().n, 0, 'share rows are deleted with the trip'); db.close();
});

test('vault mode: research updates the vault trip and Google imports validate trips through the store', async t => {
  const { request, fake } = await startVaultApp(t, { ai: { apiKey: 'k', model: 'm' }, research: async () => ({ text: 'Plan', sources: [], places: [], days: [{ title: 'Gardens', items: [] }], questions: [] }) });
  const a = await signUp(request, 'A');
  const id = (await request('/api/trips', 'POST', { data: trip() }, { cookie: a.cookie })).result.record.id;
  const started = await request('/api/research', 'POST', { prompt: 'Kyoto', tripId: id }, { cookie: a.cookie });
  assert.equal(started.status, 202);
  let job; for (let i = 0; i < 100; i++) { job = (await request('/api/research/' + started.result.job.id, 'GET', undefined, { cookie: a.cookie })).result.job; if (job.status !== 'running') break; await new Promise(r => setTimeout(r, 10)); }
  assert.equal(job.status, 'completed');
  const saved = (await request('/api/trips/' + id, 'GET', undefined, { cookie: a.cookie })).result.record;
  assert.equal(saved.data.researchDraft.days[0].title, 'Gardens'); assert.equal(saved.version, 2);
  assert.ok(fake.size > 0);
  // Google: the trip check goes through the injected store function, not SQL
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users(id TEXT PRIMARY KEY);'); const g = createGoogleIntegration({ db, origin, clientId: 'c', clientSecret: 's', encryptionKey: 'ab'.repeat(32), findTripId: async (userId, tripId) => (userId === 'alice' && tripId === 'vault-trip' ? { id: tripId } : undefined), fetch: async () => { throw new Error('no network'); } });
  const missing = await g({ path: '/api/integrations/google/sync', method: 'POST', body: { kind: 'gmail', tripId: 'nope' }, user: { id: 'alice' }, url: new URL(origin + '/api/integrations/google/sync') });
  assert.equal(missing.status, 404);
});

test('vault mode: an outage is a generic 503 with nothing sensitive, and SQLite-only features keep working', async t => {
  const { request, fake, logs, errors } = await startVaultApp(t);
  const a = await signUp(request, 'A');
  fake.failures.push({ status: 500 }, { status: 500 });
  const down = await request('/api/trips', 'GET', undefined, { cookie: a.cookie });
  assert.equal(down.status, 503); assert.equal(down.result.error, 'Trip storage is temporarily unavailable. Please try again.');
  assert.equal((await request('/api/places', 'GET', undefined, { cookie: a.cookie })).status, 200);
  assert.equal((await request('/api/trips', 'GET', undefined, { cookie: a.cookie })).status, 200, 'recovers');
  fake.failures.push({ network: true }, { network: true });
  assert.equal((await request('/api/trips', 'POST', { data: trip() }, { cookie: a.cookie })).status, 503);
  noSecrets(JSON.stringify(down.result) + logs.join('\n') + errors.join('\n'), 'logs and responses');
  assert.ok(errors.some(e => /trip storage failed: http/.test(e)), 'failures are logged with their code');
  assert.ok(logs.includes('trip storage: hexclave'));
});

test('trip storage configuration: sqlite by default, hexclave needs its keys at startup, secrets stay out of messages', async t => {
  assert.deepEqual(resolveTripStorage({}), { mode: 'sqlite' });
  assert.deepEqual(resolveTripStorage({ TRIP_STORAGE: 'sqlite', ...fakeKeys }), { mode: 'sqlite' }, 'keys alone do not switch storage on');
  const cfg = resolveTripStorage({ TRIP_STORAGE: 'hexclave', HEXCLAVE_PROJECT_ID: 'p', HEXCLAVE_SECRET_SERVER_KEY: 's', HEXCLAVE_VAULT_SECRET: 'v' });
  assert.equal(cfg.vault.store, 'friday-trips');
  assert.throws(() => resolveTripStorage({ TRIP_STORAGE: 'hexclave' }), /HEXCLAVE_PROJECT_ID, HEXCLAVE_SECRET_SERVER_KEY, HEXCLAVE_VAULT_SECRET/);
  assert.throws(() => resolveTripStorage({ TRIP_STORAGE: 'hexclave', HEXCLAVE_PROJECT_ID: 'p', HEXCLAVE_SECRET_SERVER_KEY: 'ssk-SECRET-1' }), e => /HEXCLAVE_VAULT_SECRET to be set/.test(e.message) && !/HEXCLAVE_PROJECT_ID/.test(e.message) && !e.message.includes('ssk-SECRET-1'));
  assert.throws(() => resolveTripStorage({ TRIP_STORAGE: 'postgres' }), /TRIP_STORAGE must be/);
  for (const missing of Object.keys(fakeKeys).filter(k => k !== 'HEXCLAVE_VAULT_STORE')) {
    const env = { TRIP_STORAGE: 'hexclave', ...fakeKeys, [missing]: '' };
    assert.throws(() => createApp({ dbPath: ':memory:', origin, env }), e => e.message.includes(missing) && secrets.every(s => !e.message.includes(s)), missing);
  }
  assert.throws(() => createApp({ dbPath: ':memory:', origin, env: { TRIP_STORAGE: 'hexclave', ...fakeKeys, HEXCLAVE_VAULT_STORE: 'bad/store' }, vaultFetch: createFakeVault().fetch }), /HEXCLAVE_VAULT_STORE/);
  // keys without TRIP_STORAGE: trips stay in SQLite and the vault is never called
  const fake = createFakeVault();
  const { request, dbPath } = await startApp(t, { env: { ...fakeKeys }, vaultFetch: fake.fetch });
  const a = await signUp(request, 'A');
  assert.equal((await request('/api/trips', 'POST', { data: trip() }, { cookie: a.cookie })).status, 201);
  assert.equal(fake.requests.length, 0);
  const db = new DatabaseSync(dbPath); assert.equal(db.prepare("SELECT count(*) AS n FROM records WHERE kind='trips'").get().n, 1); db.close();
});

test('opening an existing database in vault mode drops the shares foreign key once and keeps share rows', async t => {
  const file = `${(await import('node:os')).tmpdir()}/friday-fk-${process.pid}-${Date.now()}.sqlite`;
  t.after(async () => { for (const s of ['', '-wal', '-shm']) await (await import('node:fs/promises')).rm(file + s, { force: true }); });
  let db = openStore(file);   // classic schema, with the foreign key
  createUser(db, { id: 'u1', email: 'u@x.co', name: 'U', password: 'p' });
  insertRecord(db, { id: 'tr1', userId: 'u1', kind: 'trips', data: '{"title":"T"}', updated: 'x' });
  db.prepare('INSERT INTO shares VALUES(?,?,?,?,?)').run('h1', 'u1', 'tr1', 9e15, 'x');
  assert.throws(() => db.prepare('INSERT INTO shares VALUES(?,?,?,?,?)').run('h2', 'u1', 'in-vault', 9e15, 'x'), /FOREIGN KEY/);
  db.close();
  for (let i = 0; i < 2; i++) {   // twice: the rebuild is idempotent
    db = openStore(file, { tripsInVault: true });
    assert.equal(db.prepare('SELECT count(*) AS n FROM shares').get().n, 1);
    db.close();
  }
  db = openStore(file, { tripsInVault: true });
  db.prepare('INSERT INTO shares VALUES(?,?,?,?,?)').run('h2', 'u1', 'in-vault', 9e15, 'x');
  assert.equal(db.prepare("SELECT count(*) AS n FROM pragma_foreign_key_list('shares') WHERE \"table\"='records'").get().n, 0);
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='shares_trip_owner'").get());
  db.close();
});

/* ---- one-time copy tool ---- */
test('copy tool: dry run writes nothing, --apply copies once, keeps ids/versions/owners, never touches SQLite', async () => {
  const db = openStore(':memory:');
  createUser(db, { id: 'u1', email: 'u1@x.co', name: 'U1', password: 'p' }); createUser(db, { id: 'u2', email: 'u2@x.co', name: 'U2', password: 'p' });
  insertRecord(db, { id: 'a1', userId: 'u1', kind: 'trips', data: '{"title":"A1"}', updated: '2026-01-01T00:00:00.000Z' });
  insertRecord(db, { id: 'a2', userId: 'u1', kind: 'trips', data: '{"title":"A2"}', updated: '2026-01-02T00:00:00.000Z' });
  insertRecord(db, { id: 'b1', userId: 'u2', kind: 'trips', data: '{"title":"B1"}', updated: '2026-01-03T00:00:00.000Z' });
  insertRecord(db, { id: 'p1', userId: 'u1', kind: 'places', data: '{"title":"Place"}', updated: '2026-01-04T00:00:00.000Z' });
  db.prepare("UPDATE records SET version=5 WHERE id='a1'").run();
  const before = JSON.stringify(db.prepare('SELECT * FROM records ORDER BY id').all());
  const fake = createFakeVault(), vaultTrips = createVaultTripStore({ vault: clientFor(fake) });
  assert.deepEqual(await copyTrips({ db, vaultTrips }), { found: 3, copied: 0, wouldCopy: 3, alreadyInVault: 0, failed: 0 });
  assert.equal(fake.requests.some(r => r.url.endsWith('/set')), false, 'dry run does not write');
  assert.deepEqual(await copyTrips({ db, vaultTrips, apply: true }), { found: 3, copied: 3, wouldCopy: 0, alreadyInVault: 0, failed: 0 });
  assert.deepEqual(await copyTrips({ db, vaultTrips, apply: true }), { found: 3, copied: 0, wouldCopy: 0, alreadyInVault: 3, failed: 0 }, 'safe to re-run');
  const a1 = await vaultTrips.find('a1', 'u1');
  assert.deepEqual({ ...a1 }, { id: 'a1', user_id: 'u1', kind: 'trips', data: '{"title":"A1"}', version: 5, updated: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual((await vaultTrips.list('u1')).map(r => r.id), ['a2', 'a1']); assert.deepEqual((await vaultTrips.list('u2')).map(r => r.id), ['b1']);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM records ORDER BY id').all()), before, 'SQLite is untouched');
  fake.failures.push({ network: true }, { network: true }, { network: true });
  const failed = await copyTrips({ db, vaultTrips: createVaultTripStore({ vault: clientFor(createFakeVault(), { fetch: async () => { throw new TypeError('x'); } }) }), apply: true });
  assert.equal(failed.failed, 3); db.close();
});
