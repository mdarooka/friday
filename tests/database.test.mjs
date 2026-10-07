import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabaseConfig, connectWithRetry, openDatabase } from '../server/db.mjs';
import { openStore, createUser, createHexclaveIdentity, findUserByEmail, findUserByHexclaveId } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';

const hostSettings = { DATABASE_HOST: 'db.internal', DATABASE_PORT: '5432', DATABASE_USER: 'friday', DATABASE_PASSWORD: 'pw', DATABASE_NAME: 'friday' };

test('production refuses to start without PostgreSQL settings and never falls back to PGlite', async () => {
  assert.throws(() => resolveDatabaseConfig({ NODE_ENV: 'production' }), /PostgreSQL is not configured/);
  assert.throws(() => openDatabase({ env: { NODE_ENV: 'production' } }), /DATABASE_URL, or DATABASE_HOST/);
  assert.throws(() => createApp({ origin: 'https://friday.example', env: { NODE_ENV: 'production', APP_ORIGIN: 'https://friday.example' } }), /PostgreSQL is not configured/);
  // Outside production the same environment is local development on PGlite under .data/.
  assert.deepEqual(resolveDatabaseConfig({}, { dataDir: '/tmp/x' }), { kind: 'pglite', dataDir: '/tmp/x', description: '/tmp/x' });
  assert.equal(resolveDatabaseConfig({ NODE_ENV: 'production' }, { memory: true }).kind, 'pglite', 'only an explicit programmatic memory request (tests) gets PGlite in production');
});

test('connection settings come from DATABASE_HOST/PORT/USER/PASSWORD/NAME or from DATABASE_URL', () => {
  const fromParts = resolveDatabaseConfig({ NODE_ENV: 'production', ...hostSettings });
  assert.equal(fromParts.kind, 'postgres');
  assert.deepEqual(fromParts.poolConfig, { host: 'db.internal', port: 5432, user: 'friday', password: 'pw', database: 'friday' });
  assert.equal(JSON.stringify(fromParts).includes('pw"'), true, 'the password reaches the pool');
  assert.equal(fromParts.description.includes('pw'), false, 'but never the description used in logs');
  assert.equal(resolveDatabaseConfig({ ...hostSettings, DATABASE_PORT: '' }).poolConfig.port, 5432, 'the default port');
  assert.equal(resolveDatabaseConfig({ ...hostSettings, DATABASE_PORT: '6543' }).poolConfig.port, 6543);
  const fromUrl = resolveDatabaseConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@host:5432/db' });
  assert.deepEqual(fromUrl.poolConfig, { connectionString: 'postgres://u:p@host:5432/db' });
  assert.equal(fromUrl.description, 'DATABASE_URL');
  assert.equal(resolveDatabaseConfig({ ...hostSettings, DATABASE_URL: 'postgres://u:p@other/db' }).poolConfig.connectionString, 'postgres://u:p@other/db', 'DATABASE_URL wins');
  assert.throws(() => resolveDatabaseConfig({ DATABASE_HOST: 'db.internal', DATABASE_USER: 'friday' }), /DATABASE_PASSWORD, DATABASE_NAME are missing/);
  assert.throws(() => resolveDatabaseConfig({ ...hostSettings, DATABASE_PORT: 'abc' }), /DATABASE_PORT/);
});

test('connection retries back off exponentially, stay bounded, and give up after the limit', async () => {
  const delays = [];
  const sleep = async ms => { delays.push(ms); };
  let attempts = 0;
  const result = await connectWithRetry(async n => { attempts = n; if (n < 4) throw new Error('starting up'); return 'connected'; }, { sleep });
  assert.equal(result, 'connected');
  assert.equal(attempts, 4);
  assert.deepEqual(delays, [500, 1000, 2000]);

  delays.length = 0;
  let tries = 0;
  await assert.rejects(connectWithRetry(async () => { tries++; throw new Error('ECONNREFUSED'); }, { sleep }), error => {
    assert.match(error.message, /Could not connect to PostgreSQL after \d+ attempts/);
    assert.match(error.message, /ECONNREFUSED/);
    assert.equal(error.cause.message, 'ECONNREFUSED');
    return true;
  });
  assert.equal(tries, delays.length + 1);
  assert.ok(delays.every(ms => ms <= 8000), 'each wait is capped');
  const total = delays.reduce((a, b) => a + b, 0);
  assert.ok(total <= 60_000 && total >= 50_000, `about a minute of waiting in total, got ${total} ms`);

  // The same limit with real (tiny) timers: it really stops.
  let real = 0;
  await assert.rejects(connectWithRetry(async () => { real++; throw new Error('down'); }, { baseDelayMs: 1, maxDelayMs: 2, totalMs: 10 }), /Could not connect/);
  assert.ok(real >= 2 && real <= 12);
});

test('openDatabase retries a fake connection and surfaces the failure on every call', async () => {
  const logs = [];
  let calls = 0;
  const flaky = openDatabase({ env: hostSettings, log: m => logs.push(m), retry: { baseDelayMs: 1, maxDelayMs: 2, totalMs: 1000 }, connect: async () => {
    if (++calls < 3) throw new Error('database is starting');
    return { query: async text => ({ rows: [{ text }], rowCount: 1 }), script: async () => {}, transaction: async fn => fn({ query: async () => ({ rows: [], rowCount: 0 }) }), close: async () => {} };
  } });
  assert.equal((await flaky.one('SELECT 1')).text, 'SELECT 1');
  assert.equal(calls, 3);
  assert.equal(logs.length, 2);
  assert.ok(logs.every(m => m.includes('database is starting') && !m.includes('pw')));
  await flaky.close();

  const down = openDatabase({ env: hostSettings, log: () => {}, retry: { baseDelayMs: 1, maxDelayMs: 1, totalMs: 3 }, connect: async () => { throw new Error('refused'); } });
  await assert.rejects(down.ready, /Could not connect to PostgreSQL/);
  await assert.rejects(down.query('SELECT 1'), /Could not connect to PostgreSQL/);
  await down.close();
});

test('PGlite backend: query shape, row counts, BIGINT numbers, and transactions that roll back', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  const inserted = await db.query('INSERT INTO sessions(hash,user_id,expires) SELECT $1,id,$2 FROM (SELECT $3::text AS id) u', ['h', 1.8e12, 'nobody']).catch(error => error);
  assert.match(inserted.message, /foreign key/i);
  await createUser(db, { id: 'u1', email: 'a@example.com', name: 'A', password: 'p' });
  const r = await db.query('INSERT INTO sessions(hash,user_id,expires) VALUES($1,$2,$3)', ['h1', 'u1', 1.8e12]);
  assert.deepEqual({ rows: r.rows, rowCount: r.rowCount }, { rows: [], rowCount: 1 });
  assert.equal((await db.one('SELECT expires FROM sessions WHERE hash=$1', ['h1'])).expires, 1.8e12);
  assert.equal(typeof (await db.one('SELECT count(*) AS n FROM users')).n, 'number');
  assert.equal((await db.query('UPDATE sessions SET expires=0 WHERE hash=$1', ['missing'])).rowCount, 0);
  assert.deepEqual(await db.all('SELECT id FROM users ORDER BY id'), [{ id: 'u1' }]);
  assert.equal(await db.one('SELECT id FROM users WHERE id=$1', ['none']), undefined);

  await assert.rejects(db.transaction(async tx => {
    await createUser(tx, { id: 'u2', email: 'b@example.com', name: 'B', password: 'p' });
    assert.equal((await tx.one('SELECT count(*) AS n FROM users')).n, 2, 'visible inside the transaction');
    throw new Error('abort');
  }), /abort/);
  assert.equal((await db.one('SELECT count(*) AS n FROM users')).n, 1, 'rolled back');
  assert.equal(await db.transaction(async tx => { await createUser(tx, { id: 'u3', email: 'c@example.com', name: 'C', password: 'p' }); return 'ok'; }), 'ok');
  assert.ok(await findUserByEmail(db, 'c@example.com'));
});

test('creating a Hexclave identity is atomic: a failing second insert leaves no orphan user', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  const identity = { hexclaveUserId: 'hx1', userId: 'u1', syntheticEmail: 's1@identity.friday.invalid', email: 'a@example.com', name: 'A', password: 'p', emailVerified: true, restricted: false, updated: 'now' };
  assert.equal((await createHexclaveIdentity(db, identity)).hexclave_email, 'a@example.com');
  // Same Hexclave id, new user: the identity insert fails after the user insert succeeded.
  await assert.rejects(createHexclaveIdentity(db, { ...identity, userId: 'u2', syntheticEmail: 's2@identity.friday.invalid' }));
  assert.equal((await db.one("SELECT count(*) AS n FROM users WHERE id='u2'")).n, 0);
  assert.equal((await findUserByHexclaveId(db, 'hx1')).id, 'u1');
});

test('the schema is idempotent: opening the same on-disk database twice keeps its rows', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const dir = await mkdtemp(path.join(tmpdir(), 'friday-pglite-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dataDir = path.join(dir, 'data');
  let db = openStore({ dataDir });
  await createUser(db, { id: 'u1', email: 'a@example.com', name: 'A', password: 'p' });
  await db.close();
  db = openStore({ dataDir });
  assert.equal((await findUserByEmail(db, 'a@example.com')).id, 'u1');
  await db.close();
});
