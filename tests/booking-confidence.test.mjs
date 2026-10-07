import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { startApp, signUp } from './helpers.mjs';

const env = { AUTH_PROVIDER: 'local', QUOTE_ADMIN_EMAILS: 'staff@example.com' };
const noHexclave = { hexclaveAuth: { configured: false, currentUser: async () => null } };

async function setup(t, extraEnv = {}) {
  const { request, dbPath } = await startApp(t, { env: { ...env, ...extraEnv }, ...noHexclave });
  const owner = await signUp(request, 'Owner');
  const staff = await signUp(request, 'Staff');
  const stranger = await signUp(request, 'Stranger');
  const booking = (await request('/api/bookings', 'POST', { data: { title: 'Hotel Aman', start: '2026-12-01', end: '2026-12-05', source: 'gmail' } }, { cookie: owner.cookie })).result.record;
  return { request, dbPath, owner, staff, stranger, booking };
}
function attachToQuote(dbPath, bookingId) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys=OFF');
  db.prepare('INSERT INTO friday_quotes(id,handoff_id,owner_id,customer_email,snapshot,status,created) VALUES(?,?,?,?,?,?,?)')
    .run('11111111-1111-4111-8111-111111111111', 'h1', 'u1', 'owner@example.com', JSON.stringify({ selectedBookings: [{ id: bookingId, title: 'Hotel Aman' }] }), 'pending', new Date().toISOString());
  db.close();
}
const verify = (ctx, who, id, verified = true) => ctx.request(`/api/admin/bookings/${id}/verify`, 'POST', { verified }, { cookie: who.cookie });

test('only quote admins can verify, and only bookings attached to a quote request', async t => {
  const ctx = await setup(t);
  assert.equal((await ctx.request(`/api/admin/bookings/${ctx.booking.id}/verify`, 'POST', { verified: true })).status, 401);
  assert.equal((await verify(ctx, ctx.owner, ctx.booking.id)).status, 403);        // the owner cannot self-verify
  assert.equal((await verify(ctx, ctx.stranger, ctx.booking.id)).status, 403);
  assert.equal((await verify(ctx, ctx.staff, ctx.booking.id)).status, 404);        // not shared with Friday via a quote
  attachToQuote(ctx.dbPath, ctx.booking.id);
  assert.equal((await verify(ctx, ctx.staff, ctx.booking.id, 'yes')).status, 422);
  const ok = await verify(ctx, ctx.staff, ctx.booking.id);
  assert.equal(ok.status, 200);
  assert.equal(ok.result.booking.verification.verifiedBy, 'staff@example.com');
  assert.ok(ok.result.booking.verification.verifiedAt);
  assert.equal((await verify(ctx, ctx.staff, '99999999-9999-4999-8999-999999999999')).status, 404);
});

test('verification is visible to the owner only and cannot be set or forged by the owner', async t => {
  const ctx = await setup(t);
  attachToQuote(ctx.dbPath, ctx.booking.id);
  await verify(ctx, ctx.staff, ctx.booking.id);
  const seen = await ctx.request(`/api/bookings/${ctx.booking.id}`, 'GET', undefined, { cookie: ctx.owner.cookie });
  assert.equal(seen.result.record.data.verification.verifiedBy, 'staff@example.com');
  assert.equal((await ctx.request(`/api/bookings/${ctx.booking.id}`, 'GET', undefined, { cookie: ctx.stranger.cookie })).status, 404);
  // Owner edits that keep the key facts keep the stamp; client-supplied verification is ignored; changing facts clears it.
  const same = await ctx.request(`/api/bookings/${ctx.booking.id}`, 'PUT', { data: { title: 'Hotel Aman', start: '2026-12-01', end: '2026-12-05', source: 'gmail', verification: { verifiedAt: 'x', verifiedBy: 'me' } }, version: seen.result.record.version }, { cookie: ctx.owner.cookie });
  assert.equal(same.result.record.data.verification.verifiedBy, 'staff@example.com');
  const changed = await ctx.request(`/api/bookings/${ctx.booking.id}`, 'PUT', { data: { title: 'Hotel Aman', start: '2026-12-02', end: '2026-12-05' }, version: same.result.record.version }, { cookie: ctx.owner.cookie });
  assert.equal(changed.result.record.data.verification, undefined);
  const forged = await ctx.request('/api/bookings', 'POST', { data: { title: 'Fake', verification: { verifiedAt: '2026-01-01T00:00:00Z', verifiedBy: 'staff@example.com' } } }, { cookie: ctx.owner.cookie });
  assert.equal(forged.result.record.data.verification, undefined);
});

test('staff can clear a verification; no configured admins means no one can verify', async t => {
  const ctx = await setup(t);
  attachToQuote(ctx.dbPath, ctx.booking.id);
  await verify(ctx, ctx.staff, ctx.booking.id);
  const cleared = await verify(ctx, ctx.staff, ctx.booking.id, false);
  assert.equal(cleared.result.booking.verification, null);
  const open = await setup(t, { QUOTE_ADMIN_EMAILS: '' });
  attachToQuote(open.dbPath, open.booking.id);
  assert.equal((await verify(open, open.owner, open.booking.id)).status, 403);
});

test('callback requests carry an optional booking topic to the admin queue', async t => {
  const ctx = await setup(t);
  const made = await ctx.request('/api/callbacks', 'POST', { name: 'Owner', phone: '9876543210', bestTime: 'morning', entryPoint: 'planner', topic: 'Booking: Hotel Aman' });
  assert.equal(made.status, 201);
  const list = await ctx.request('/api/admin/quotes', 'GET', undefined, { cookie: ctx.staff.cookie });
  assert.equal(list.result.quotes.find(q => q.id === made.result.id).topic, 'Booking: Hotel Aman');
});
