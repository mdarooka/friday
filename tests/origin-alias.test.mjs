import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.mjs';
import { createApp } from '../server/app.mjs';

test('production CSRF accepts canonical and explicitly configured deployment origins only', async (t) => {
  const { request } = await startApp(t, {
    origin: 'https://fridaytravel.vercel.app',
    env: {
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://fridaytravel.vercel.app',
      APP_ORIGIN_ALIASES: 'https://friday-deploy.example',
    },
  });
  const account = (name) => ({ name, email: `${name}@example.com`, password: 'long test password 123' });
  assert.equal((await request('/api/auth/signup', 'POST', account('Canonical'), { headers: { Origin: 'https://fridaytravel.vercel.app' } })).status, 200);
  assert.equal((await request('/api/auth/signup', 'POST', account('Deployment'), { headers: { Origin: 'https://friday-deploy.example' } })).status, 200);
  assert.equal((await request('/api/auth/signup', 'POST', account('Attacker'), { headers: { Origin: 'https://attacker.example' } })).status, 403);
});

test('trusted production origins must be exact bare origins', async () => {
  assert.throws(() => {
    createApp({ memory: true, env: { NODE_ENV: 'production', APP_ORIGIN: 'https://fridaytravel.vercel.app', APP_ORIGIN_ALIASES: 'https://trusted.example/path' } });
  }, /bare origins/);
});
