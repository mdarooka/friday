import { createApp } from '../server/app.mjs';
import { vaultModeOptions } from './fake-vault.mjs';

export const origin = 'http://localhost:4871';

/**
 * Start the app on a random port with a in-memory PostgreSQL (PGlite) database, one per app. `env` replaces process.env for the app, so tests never depend on
 * the machine's configuration. Returns { base, request, server, db }; cleanup is registered on `t`.
 */
export async function startApp(t, { env = {}, ...options } = {}) {
  options = { airportFetch: async () => { throw new Error('geocoder disabled in tests'); }, ...options };
  const server = createApp({ memory: true, origin, env: { ITINERARY_PROVIDER: 'local', ...env }, ...options, ...vaultModeOptions({ ...options, env: { ITINERARY_PROVIDER: 'local', ...env } }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); });
  /* JSON request; POSTs carry the app's own Origin unless `headers.Origin` says otherwise. */
  const request = async (url, method = 'GET', data, { cookie = '', headers = {}, raw } = {}) => {
    const post = method !== 'GET' && method !== 'HEAD';
    const res = await fetch(base + url, {
      method, redirect: 'manual',
      headers: { ...(post ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: raw !== undefined ? raw : data !== undefined ? JSON.stringify(data) : undefined
    });
    const type = res.headers.get('content-type') || '';
    const result = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, result, headers: res.headers, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  };
  return { base, request, server, db: server.db };
}

export async function signUp(request, name = 'A', extra = {}) {
  const res = await request('/api/auth/signup', 'POST', { name, email: `${name}@example.com`, password: 'long test password 123' }, extra);
  if (res.status !== 200) throw new Error('signup failed ' + res.status);
  return res;
}
