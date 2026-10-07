import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';
import { PREQUOTE_ITEMS } from '../server/prequote-checklist.mjs';

const callback = { name: 'Traveler Jane', phone: '9876543210', bestTime: 'morning', entryPoint: 'planner' };

test('pre-quote checklist has five provisional items and saves with the creation token', async t => {
  const { request } = await startApp(t, { env: { AUTH_PROVIDER: 'local', QUOTE_ADMIN_EMAILS: 'quoteadmin@example.com' }, hexclaveAuth: { configured: false, currentUser: async () => null } });
  assert.equal(PREQUOTE_ITEMS.length, 5);
  assert.equal((await request('/api/callbacks/checklist-items')).result.items.length, 5);
  const admin = await signUp(request, 'QuoteAdmin');
  const made = await request('/api/callbacks', 'POST', callback);
  assert.equal(made.status, 201);
  assert.ok(made.result.checklistToken);
  const url = `/api/callbacks/${made.result.id}/checklist`;
  const answers = { dates: { text: 'Dec 12-19' }, travellers: { done: true }, bogus: { text: 'x' }, budget: { text: '' } };
  assert.equal((await request(url, 'PUT', { checklistToken: 'wrong', answers })).status, 403);
  assert.equal((await request(url, 'PUT', { answers })).status, 403);
  const saved = await request(url, 'PUT', { checklistToken: made.result.checklistToken, answers });
  assert.equal(saved.status, 200);
  assert.deepEqual([saved.result.done, saved.result.total], [2, 5]);
  assert.equal(saved.result.answers.bogus, undefined);
  const queue = await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie });
  const row = queue.result.quotes.find(q => q.id === made.result.id);
  assert.deepEqual([row.checklist.done, row.checklist.total], [2, 5]);
  assert.equal(row.checklist.answers.dates.text, 'Dec 12-19');
});

test('a callback made while signed in only accepts checklist edits from that user', async t => {
  const { request } = await startApp(t, { env: { AUTH_PROVIDER: 'local' }, hexclaveAuth: { configured: false, currentUser: async () => null } });
  const owner = await signUp(request, 'Owner');
  const other = await signUp(request, 'Other');
  const made = await request('/api/callbacks', 'POST', callback, { cookie: owner.cookie });
  const url = `/api/callbacks/${made.result.id}/checklist`;
  const body = { checklistToken: made.result.checklistToken, answers: { dates: { text: 'soon' } } };
  assert.equal((await request(url, 'PUT', body, { cookie: other.cookie })).status, 403);
  assert.equal((await request(url, 'PUT', body)).status, 403);
  assert.equal((await request(url, 'PUT', body, { cookie: owner.cookie })).status, 200);
});
