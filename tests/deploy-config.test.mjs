import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/* Evaluates hexclave.deploy.ts with stand-in helpers and pins the parts of the public service that the Vercel proxy and
   sign-in depend on, plus the private PostgreSQL service. */
const { deploy } = await import('../hexclave.deploy.ts');
const config = deploy({
  isDev: false,
  secret: (key, fallback) => ({ secret: key, fallback }),
  service: id => ({ hostname: () => ({ service: id, output: 'hostname' }), url: port => ({ service: id, output: 'url', port }) }),
  hexclave: { projectId: 'project', secretServerKey: 'server-key', apiUrl: 'u', jwksUrl: 'j', publishableClientKey: 'p' }
});

test('the public web service keeps its id, visibility, origin and proxy trust', () => {
  assert.deepEqual(Object.keys(config.services).sort(), ['database', 'web']);
  const web = config.services.web;
  assert.equal(web.public, true, 'vercel.json proxies to the public URL of the service named web');
  assert.equal(web.type, 'server');
  assert.deepEqual(web.ports, { 3000: { protocol: 'http' } });
  assert.equal(web.env.APP_ORIGIN, 'https://fridaytravel.vercel.app');
  assert.equal(web.env.TRUST_PROXY, '1');
  assert.equal(web.env.APP_ORIGIN_ALIASES, 'https://p-81-we-5b6199efcb56de4167-c098b2d7396b0066.deploy.built-with-hexclave.com', 'the direct Deploy origin stays trusted for writes');
  assert.equal(web.env.APP_ORIGIN_ALIASES.includes('peach'), false);
  assert.equal(web.env.APP_ORIGIN_ALIASES.includes('vercel.app'), false);
  assert.equal(web.env.HEXCLAVE_INTERNAL_HOST, 'hxc-p-81-we-5b6199efcb56de4167.fly.dev');
  assert.match(web.env.FRIDAY_PROXY_SECRET_SHA256, /^[0-9a-f]{64}$/, 'only the hash of the Vercel proxy secret lives in the repo');
  assert.equal(web.env.AUTH_PROVIDER, 'hexclave');
  assert.equal(web.env.NODE_ENV, 'production');
  assert.equal(web.minInstances, 0);
});

test('the web service keeps no data on its own disk and reaches PostgreSQL through DATABASE_*', () => {
  const web = config.services.web;
  assert.equal(web.persistentVolumes, undefined);
  for (const name of Object.keys(web.env)) assert.equal(/^DATABASE_(PATH|BACKUP)/.test(name), false, name);
  assert.deepEqual(web.env.DATABASE_HOST, { service: 'database', output: 'hostname' });
  assert.equal(web.env.DATABASE_PORT, '5432');
  assert.equal(web.env.DATABASE_USER, 'friday');
  assert.equal(web.env.DATABASE_NAME, 'friday');
  assert.deepEqual(web.env.DATABASE_PASSWORD, { secret: 'POSTGRES_PASSWORD', fallback: undefined });
});

test('the database service is private, scales to zero and keeps PostgreSQL on its own volume', async () => {
  const database = config.services.database;
  assert.equal(database.type, 'server');
  assert.notEqual(database.public, true);
  assert.deepEqual(database.ports, { 5432: { protocol: 'tcp' } });
  assert.equal(database.rootDirectory, './database');
  assert.equal(database.dockerfilePath, 'Dockerfile');
  assert.equal(database.minInstances, 0);
  assert.deepEqual(database.persistentVolumes, { pgdata: { path: '/data', sizeGb: 1 } });
  assert.ok(Object.keys(database.persistentVolumes).every(id => /^[a-z0-9_]+$/.test(id)));
  assert.deepEqual(database.env, { POSTGRES_PASSWORD: { secret: 'POSTGRES_PASSWORD', fallback: undefined }, POSTGRES_USER: 'friday', POSTGRES_DB: 'friday' });
  const dockerfile = await readFile(new URL('../database/Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /^FROM postgres:17-alpine$/m);
  assert.match(dockerfile, /RUN mkdir -p \/data && chown postgres:postgres \/data/);
  assert.match(dockerfile, /^ENV PGDATA=\/data\/postgres$/m);
  assert.match(dockerfile.trim().split('\n').at(-1), /^USER postgres$/);
});
