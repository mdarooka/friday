import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* One small async database interface over two interchangeable PostgreSQL backends:
     - node-postgres (pg.Pool) when connection settings are present (DATABASE_URL, or DATABASE_HOST/PORT/USER/PASSWORD/NAME);
     - PGlite (in-process Postgres) otherwise: in memory for tests, or a directory under .data/ for local development.
   NODE_ENV=production without Postgres settings refuses to start: production never silently falls back to PGlite.

   Interface: query(text, params) -> { rows, rowCount }, one(), all(), script(multiStatementText), transaction(async tx => ...),
   close(). A handle is returned synchronously; every call waits for the (retried) connection and schema setup.
   Inside transaction(), use only `tx`: PGlite has one connection, so a query on the outer handle would wait for the transaction. */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_PGLITE_DIR = path.join(root, '.data/pglite');
const INT8 = 20;
const toNumber = value => (value == null ? value : Number(value));   // BIGINT columns hold epoch milliseconds and counts: plain numbers

/* Returns { kind: 'postgres', poolConfig, description } or { kind: 'pglite', dataDir } (dataDir undefined = in memory).
   `memory: true` is an explicit programmatic request (tests) and is never derived from the environment. */
export function resolveDatabaseConfig(env = process.env, { memory = false, dataDir } = {}) {
  if (memory) return { kind: 'pglite', dataDir: undefined, description: 'memory' };
  const value = name => String(env[name] ?? '').trim();
  const url = value('DATABASE_URL');
  if (url) return { kind: 'postgres', poolConfig: { connectionString: url }, description: 'DATABASE_URL' };
  const host = value('DATABASE_HOST');
  if (host) {
    const parts = { user: value('DATABASE_USER'), password: String(env.DATABASE_PASSWORD ?? ''), database: value('DATABASE_NAME') };
    const missing = [['DATABASE_USER', parts.user], ['DATABASE_PASSWORD', parts.password], ['DATABASE_NAME', parts.database]].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw new Error(`DATABASE_HOST is set but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} missing. Set DATABASE_URL, or all of DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD and DATABASE_NAME.`);
    const port = value('DATABASE_PORT') ? Number(value('DATABASE_PORT')) : 5432;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DATABASE_PORT must be a TCP port number.');
    return { kind: 'postgres', poolConfig: { host, port, ...parts }, description: `${host}:${port}/${parts.database}` };
  }
  if (value('NODE_ENV') === 'production') {
    throw new Error('PostgreSQL is not configured. In production set DATABASE_URL, or DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD and DATABASE_NAME. The in-process PGlite database is only for tests and local development.');
  }
  const directory = dataDir || DEFAULT_PGLITE_DIR;
  return { kind: 'pglite', dataDir: directory, description: directory };
}

const rowHelpers = query => ({
  one: async (text, params) => (await query(text, params)).rows[0],
  all: async (text, params) => (await query(text, params)).rows
});

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* Calls connect() until it succeeds. Delays double from baseDelayMs up to maxDelayMs; gives up once the next wait would push the
   total waiting time past totalMs (default about 60 s, since the database service scales to zero and may be cold-starting). */
export async function connectWithRetry(connect, { baseDelayMs = 500, maxDelayMs = 8000, totalMs = 60_000, sleep = defaultSleep, onRetry = () => {} } = {}) {
  let waited = 0, attempt = 0;
  for (;;) {
    attempt += 1;
    try { return await connect(attempt); }
    catch (error) {
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      if (waited + delay > totalMs) {
        throw new Error(`Could not connect to PostgreSQL after ${attempt} attempts over ${Math.round(waited / 1000)} s: ${error?.message || error}`, { cause: error });
      }
      onRetry({ attempt, delay, error });
      await sleep(delay);
      waited += delay;
    }
  }
}

/* A connected backend exposes query(text, params), script(text), transaction(fn), close(). */
async function connectPostgres(config) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ ...config.poolConfig, max: 10, connectionTimeoutMillis: 10_000, types: { getTypeParser: (oid, format) => oid === INT8 ? toNumber : pg.types.getTypeParser(oid, format) } });
  pool.on('error', error => console.error(`[friday] PostgreSQL pool error: ${error.message}`));
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end().catch(() => {}); throw error; }
  const run = (target, text, params) => target.query(text, params).then(r => ({ rows: r.rows, rowCount: r.rowCount ?? 0 }));
  return {
    query: (text, params) => run(pool, text, params),
    script: text => pool.query(text).then(() => undefined),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (text, params) => run(client, text, params), script: text => client.query(text).then(() => undefined) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end()
  };
}

async function connectPglite(config) {
  const { PGlite } = await import('@electric-sql/pglite');
  if (config.dataDir) mkdirSync(path.dirname(config.dataDir), { recursive: true, mode: 0o700 });
  const options = { parsers: { [INT8]: toNumber } };
  // loadDataDir is only honoured by the single-argument form of the constructor.
  const lite = config.loadDataDir ? new PGlite({ ...options, loadDataDir: config.loadDataDir }) : new PGlite(config.dataDir, options);
  await lite.waitReady;
  const run = (target, text, params) => target.query(text, params).then(r => ({ rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }));
  return {
    query: (text, params) => run(lite, text, params),
    script: text => lite.exec(text).then(() => undefined),
    dump: () => lite.dumpDataDir('none'),
    transaction: fn => lite.transaction(tx => fn({ query: (text, params) => run(tx, text, params), script: text => tx.exec(text).then(() => undefined) })),
    close: () => lite.close()
  };
}

/* In-memory PGlite instances (tests) would each pay for initdb and the schema. The first one per `memoryTemplate` key builds the
   schema once and snapshots the data directory; later instances start from that snapshot (about 6x faster). */
const memoryTemplates = new Map();
function memoryTemplate(key, init) {
  if (!memoryTemplates.has(key)) {
    memoryTemplates.set(key, (async () => {
      const seed = withHelpers(await connectPglite({ dataDir: undefined }));
      await seed.transaction(tx => init(tx));
      await seed.script('CHECKPOINT');
      const snapshot = await seed.dump();
      await seed.close();
      return snapshot;
    })());
    memoryTemplates.get(key).catch(() => memoryTemplates.delete(key));
  }
  return memoryTemplates.get(key);
}

const withHelpers = base => ({
  ...base,
  ...rowHelpers(base.query),
  transaction: fn => base.transaction(tx => fn({ ...tx, ...rowHelpers(tx.query) }))
});

/* Opens a database. `init(tx)` (optional) runs once after connecting, e.g. to create the schema. `connect`, `sleep` and `retry`
   let tests inject a fake connection. Throws synchronously when the configuration is invalid (e.g. production without
   Postgres settings); otherwise returns at once and connects in the background. */
export function openDatabase({ env = process.env, memory = false, memoryTemplate: templateKey, dataDir, init, connect, sleep, retry = {}, log = message => console.error(message) } = {}) {
  const config = resolveDatabaseConfig(env, { memory, dataDir });
  const open = connect || (() => config.kind === 'postgres' ? connectPostgres(config) : connectPglite(config));
  let closed = false;
  const ready = (async () => {
    if (memory && !connect && init && templateKey) {
      return withHelpers(await connectPglite({ dataDir: undefined, loadDataDir: await memoryTemplate(templateKey, init) }));
    }
    const backend = withHelpers(await connectWithRetry(() => open(config), {
      sleep, ...retry,
      onRetry: ({ attempt, delay, error }) => log(`[friday] waiting for PostgreSQL (attempt ${attempt}, retrying in ${delay} ms): ${error.message}`)
    }));
    if (init) {
      /* The advisory lock serialises schema creation when several instances start at once. */
      await backend.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(727274)');
        await init(tx);
      });
    }
    return backend;
  })();
  ready.catch(() => {});   // callers observe the failure through their own awaits
  const call = name => async (...args) => {
    const backend = await ready;
    if (closed) throw new Error('The database is closed.');
    return backend[name](...args);
  };
  return {
    kind: config.kind,
    description: config.description,
    ready: ready.then(() => undefined),
    query: call('query'), one: call('one'), all: call('all'), script: call('script'), transaction: call('transaction'),
    async close() {
      if (closed) return;
      closed = true;
      const backend = await ready.catch(() => null);
      if (backend) await backend.close();
    }
  };
}
