import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startApp, signUp } from './helpers.mjs';

const sha = x => createHash('sha256').update(x).digest('hex');
const V1 = 'viewer-one-abcdefghij', V2 = 'viewer-two-abcdefghij';
const vh = viewer => ({ 'X-Friday-Viewer': viewer });

async function setup(t, env = {}) {
  const app = await startApp(t, { env });
  const owner = await signUp(app.request, 'FbOwner'), other = await signUp(app.request, 'FbOther');
  const trip = (await app.request('/api/trips', 'POST', { data: { title: 'Kyoto', destination: 'Japan', startDate: '2026-11-01', endDate: '2026-11-03', days: [{ title: 'Temple', date: '2026-11-01', items: [{ title: 'Garden' }, { title: 'Tea house' }] }] } }, { cookie: owner.cookie })).result.record;
  const share = async () => new URL((await app.request(`/api/trips/${trip.id}/share`, 'POST', {}, { cookie: owner.cookie })).result.share.url, 'http://x').searchParams.get('share');
  const token = await share();
  const feedback = (tok = token, viewer = V1) => app.request(`/api/shared/${tok}/feedback`, 'GET', undefined, { headers: viewer ? vh(viewer) : {} });
  const stops = async () => (await feedback()).result.stops;
  const post = (data, tok = token, viewer = V1) => app.request(`/api/shared/${tok}/feedback`, 'POST', data, { headers: vh(viewer) });
  return { ...app, owner, other, trip, token, share, feedback, stops, post };
}

test('viewers react and comment through a valid link; one reaction per viewer per stop', async t => {
  const s = await setup(t), [garden, tea] = await s.stops();
  assert.match(garden.key, /^d0s0-[a-f0-9]{8}$/);
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'love' })).status, 200);
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'yes' })).result.mine, 'yes');   // replaces
  await s.post({ kind: 'reaction', stopKey: garden.key, value: 'love' }, s.token, V2);
  let fb = (await s.feedback()).result;
  assert.deepEqual(fb.reactions[garden.key], { yes: 1, love: 1 });
  assert.equal(fb.mine[garden.key], 'yes');
  assert.equal((await s.feedback(s.token, V2)).result.mine[garden.key], 'love');
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'yes' })).result.mine, '');   // toggle off
  assert.equal((await s.feedback()).result.reactions[garden.key].yes, undefined);
  assert.equal((await s.post({ kind: 'reaction', stopKey: tea.key, value: 'shrug' })).status, 422);
  const c = await s.post({ kind: 'comment', stopKey: tea.key, value: 'Go early', name: 'Asha' });
  assert.equal(c.status, 201);
  fb = (await s.feedback()).result;
  assert.equal(fb.comments[0].text, 'Go early'); assert.equal(fb.comments[0].name, 'Asha'); assert.equal(fb.comments[0].mine, true);
  assert.equal((await s.feedback(s.token, V2)).result.comments[0].mine, false);
  assert.equal(JSON.stringify(fb).includes(sha(V1)), false);
  assert.equal(JSON.stringify(fb).includes(V1), false);
  assert.equal((await s.app?.request?.call) , undefined);
  // viewer can delete only own comment
  assert.equal((await s.request(`/api/shared/${s.token}/feedback/${c.result.comment.id}`, 'DELETE', {}, { headers: vh(V2) })).status, 404);
  assert.equal((await s.request(`/api/shared/${s.token}/feedback/${c.result.comment.id}`, 'DELETE', {}, { headers: vh(V1) })).status, 200);
  assert.equal((await s.feedback()).result.comments.length, 0);
});

test('feedback needs a live link, a real stop, and a JSON same-origin POST', async t => {
  const s = await setup(t), [garden] = await s.stops();
  assert.equal((await s.post({ kind: 'reaction', stopKey: 'd9s9-00000000', value: 'yes' })).status, 422);
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'yes' }, 'f'.repeat(64))).status, 404);
  assert.equal((await s.request(`/api/shared/${s.token}/feedback`, 'POST', { kind: 'reaction', stopKey: garden.key, value: 'yes' }, { headers: { ...vh(V1), Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await s.request(`/api/shared/${s.token}/feedback`, 'POST', undefined, { headers: { ...vh(V1), 'Content-Type': 'text/plain', Origin: 'http://localhost:4871' }, raw: 'x' })).status, 415);
  assert.equal((await s.request(`/api/shared/${s.token}/feedback`, 'POST', { kind: 'reaction', stopKey: garden.key, value: 'yes' })).status, 400);   // no viewer id
  const db = new DatabaseSync(s.dbPath);   // expired
  db.prepare('UPDATE shares SET expires=0').run(); db.close();
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'yes' })).status, 404);
  assert.equal((await s.feedback()).status, 404);
  const fresh = await s.share();   // re-share for the same trip, then revoke
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'yes' }, fresh)).status, 200);
  await s.request(`/api/trips/${s.trip.id}/share`, 'DELETE', {}, { cookie: s.owner.cookie });
  assert.equal((await s.post({ kind: 'reaction', stopKey: garden.key, value: 'yes' }, fresh)).status, 404);
});

test('comments are plain text, length-limited and capped', async t => {
  const s = await setup(t), [garden] = await s.stops();
  const text = '<img src=x onerror=alert(1)>\u0000\u0007 hello';
  const ok = await s.post({ kind: 'comment', stopKey: garden.key, value: text, name: '  <b>Bo</b>\n\u0001  ' });
  assert.equal(ok.status, 201);
  assert.equal(ok.result.comment.text, '<img src=x onerror=alert(1)> hello');   // stored as text, controls stripped; the client uses textContent
  assert.equal(ok.result.comment.name, '<b>Bo</b>');
  assert.equal((await s.post({ kind: 'comment', stopKey: garden.key, value: 'x'.repeat(281) })).status, 422);
  assert.equal((await s.post({ kind: 'comment', stopKey: garden.key, value: 'x'.repeat(280) })).status, 201);
  assert.equal((await s.post({ kind: 'comment', stopKey: garden.key, value: ' \u0000 ' })).status, 422);
  assert.equal((await s.post({ kind: 'comment', stopKey: garden.key, value: 5 })).status, 422);
  const db = new DatabaseSync(s.dbPath);   // per-viewer cap: top up to 50 directly, then the API refuses
  const row = db.prepare("SELECT * FROM trip_feedback WHERE kind='comment' LIMIT 1").get();
  for (let i = 0; i < 48; i++) db.prepare("INSERT INTO trip_feedback(id,owner_id,trip_id,stop_key,viewer_hash,viewer_name,kind,value,created) VALUES(?,?,?,?,?,?,'comment','c',?)").run(`id-${i}`, row.owner_id, row.trip_id, row.stop_key, row.viewer_hash, '', row.created);
  db.close();
  assert.equal((await s.post({ kind: 'comment', stopKey: garden.key, value: 'one more' })).status, 429);
  assert.equal((await s.post({ kind: 'comment', stopKey: garden.key, value: 'other viewer fine' }, s.token, V2)).status, 201);
});

test('owner sees feedback and can hide or delete; others get 404; survives rotation; deleted with the trip', async t => {
  const s = await setup(t), [garden, tea] = await s.stops();
  await s.post({ kind: 'reaction', stopKey: garden.key, value: 'love' });
  const c = (await s.post({ kind: 'comment', stopKey: tea.key, value: 'Book ahead', name: 'Ravi' })).result.comment;
  const own = { cookie: s.owner.cookie };
  const seen = await s.request(`/api/trips/${s.trip.id}/feedback`, 'GET', undefined, own);
  assert.equal(seen.status, 200); assert.equal(seen.result.reactions[garden.key].love, 1); assert.equal(seen.result.comments[0].text, 'Book ahead');
  assert.equal(JSON.stringify(seen.result).includes(V1), false);
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback`, 'GET', undefined, { cookie: s.other.cookie })).status, 404);
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback`, 'GET')).status, 401);
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback/${c.id}`, 'POST', { hidden: true }, { cookie: s.other.cookie })).status, 404);
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback/${c.id}`, 'DELETE', {}, { cookie: s.other.cookie })).status, 404);
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback/${c.id}`, 'POST', { hidden: true }, own)).status, 200);
  assert.equal((await s.feedback()).result.comments.length, 0);   // hidden from viewers
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback`, 'GET', undefined, own)).result.comments[0].hidden, true);
  await s.request(`/api/trips/${s.trip.id}/feedback/${c.id}`, 'POST', { hidden: false }, own);
  // rotation: old link dies, feedback stays and is reachable through the new link
  const next = await s.share();
  assert.equal((await s.feedback(s.token)).status, 404);
  const rotated = (await s.feedback(next)).result;
  assert.equal(rotated.reactions[garden.key].love, 1); assert.equal(rotated.comments.length, 1);
  assert.equal((await s.request(`/api/trips/${s.trip.id}/feedback/${c.id}`, 'DELETE', {}, own)).status, 200);
  assert.equal((await s.feedback(next)).result.comments.length, 0);
  // trip deletion removes everything
  await s.post({ kind: 'comment', stopKey: tea.key, value: 'again' }, next);
  assert.equal((await s.request(`/api/trips/${s.trip.id}`, 'DELETE', {}, own)).status, 200);
  const db = new DatabaseSync(s.dbPath);
  assert.equal(db.prepare('SELECT count(*) AS n FROM trip_feedback').get().n, 0); db.close();
});

test('feedback writes are rate limited per IP', async t => {
  const s = await setup(t), [garden] = await s.stops();
  const results = [];
  for (let i = 0; i < 22; i++) results.push((await s.post({ kind: 'comment', stopKey: garden.key, value: `n${i}` }, s.token, `viewer-${String(i).padStart(2, '0')}-abcdefghij`)).status);
  assert.equal(results.filter(x => x === 201).length, 20);
  assert.equal(results.at(-1), 429);
});
