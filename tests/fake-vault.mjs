/* An in-memory stand-in for the Hexclave Data Vault REST API (the two endpoints in server/storage/hexclave-vault.mjs),
   used as the `fetch` of the vault client. It checks the same things the real API does: path, method, headers, body
   shape. It only ever sees hashed keys and encrypted values, like the real service. */
export const fakeKeys = { HEXCLAVE_PROJECT_ID: 'proj-test-1', HEXCLAVE_SECRET_SERVER_KEY: 'ssk_test_SECRET_server_key', HEXCLAVE_VAULT_SECRET: 'vault-secret-SECRET-value', HEXCLAVE_VAULT_STORE: 'friday-trips' };

export function createFakeVault({ keys = fakeKeys, stores = [keys.HEXCLAVE_VAULT_STORE] } = {}) {
  const data = new Map();   // `${store}\n${hashed_key}` -> encrypted_value
  const requests = [];
  const failures = [];      // queued behaviours for upcoming requests: { status } | { network: true } | { hang: true }
  const reply = (status, body, known) => {
    // X-Hexclave-Override-Error-Status: errors come back as 200 with the real status in a header.
    const headers = { 'content-type': 'application/json' };
    if (known) headers['x-hexclave-known-error'] = known;
    if (status >= 400) { headers['x-hexclave-actual-status'] = String(status); return new Response(JSON.stringify(body), { status: 200, headers }); }
    return new Response(JSON.stringify(body), { status, headers });
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url), h = new Headers(init.headers);
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url: String(url), method: init.method, headers: Object.fromEntries(h), body });
    const next = failures.shift();
    if (next?.network) throw new TypeError('fetch failed');
    if (next?.hang) return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    if (next?.status) return reply(next.status, { error: 'boom' });
    const m = u.pathname.match(/^\/api\/v1\/data-vault\/stores\/([^/]+)\/(get|set)$/);
    if (!m || init.method !== 'POST') return reply(404, { error: 'no route' });
    if (h.get('x-hexclave-project-id') !== keys.HEXCLAVE_PROJECT_ID || h.get('x-hexclave-secret-server-key') !== keys.HEXCLAVE_SECRET_SERVER_KEY || h.get('x-hexclave-access-type') !== 'server') return reply(401, { code: 'X' });
    if (h.get('content-type') !== 'application/json') return reply(400, { error: 'content-type' });
    const store = decodeURIComponent(m[1]);
    if (!stores.includes(store)) return reply(400, { code: 'DATA_VAULT_STORE_DOES_NOT_EXIST', store_id: store }, 'DATA_VAULT_STORE_DOES_NOT_EXIST');
    if (typeof body?.hashed_key !== 'string') return reply(400, { error: 'hashed_key' });
    const id = `${store}\n${body.hashed_key}`;
    if (m[2] === 'get') {
      if (!data.has(id)) return reply(400, { code: 'DATA_VAULT_STORE_HASHED_KEY_DOES_NOT_EXIST', store_id: store, hashed_key: body.hashed_key }, 'DATA_VAULT_STORE_HASHED_KEY_DOES_NOT_EXIST');
      return reply(200, { encrypted_value: data.get(id) });
    }
    if (typeof body.encrypted_value !== 'string') return reply(400, { error: 'encrypted_value' });
    data.set(id, body.encrypted_value);
    return reply(200, {});
  };
  return { fetch, requests, failures, data, get size() { return data.size; } };
}

/* When FRIDAY_TEST_TRIP_STORAGE=hexclave every app a test starts keeps its trips in a fresh fake vault, so the whole
   suite doubles as the vault-mode suite (npm run test:hexclave). Otherwise this adds nothing. */
export function vaultModeOptions(options = {}) {
  if (process.env.FRIDAY_TEST_TRIP_STORAGE !== 'hexclave') return {};
  if (options.vaultFetch || Object.keys(options.env || {}).some(k => k === 'TRIP_STORAGE' || k.startsWith('HEXCLAVE_'))) return {};   // the test configures storage itself
  const fake = createFakeVault();
  return { env: { ...(options.env || process.env), TRIP_STORAGE: 'hexclave', ...fakeKeys }, vaultFetch: fake.fetch, fakeVault: fake };
}
