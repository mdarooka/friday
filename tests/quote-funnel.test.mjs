import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';
import { recordFunnelEvent } from '../server/store.mjs';

const answer = {
  destination: 'Kenya', startDate: '2026-11-01', endDate: '2026-11-10', travelers: 2, budget: '4200 USD',
  listingIds: ['departure:super-tuskers'], bookingIds: [], instructions: 'A slow morning.',
};

function utcMonday(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return day.toISOString().slice(0, 10);
}

test('quote funnel events are stored in Friday and the staff tile counts the week and the 30-hour reply rate', async t => {
  const { request, db } = await startApp(t, {
    env: { AUTH_PROVIDER: 'local', AUTH_REQUIRED: 'true', QUOTE_ADMIN_EMAILS: 'admin@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
  });
  const customer = await signUp(request, 'Ada');
  const other = await signUp(request, 'Other');
  const admin = await signUp(request, 'Admin');

  const enquiry = await request('/api/commissions', 'POST', { name: 'Ada Lovelace', email: 'ada@example.com', composition: ['Sample package'], message: 'A quiet week' }, { cookie: customer.cookie });
  assert.equal(enquiry.status, 201);
  const callback = await request('/api/callbacks', 'POST', { name: 'Ada Lovelace', phone: '9876543210', bestTime: 'morning', entryPoint: 'contact' }, { cookie: customer.cookie });
  assert.equal(callback.status, 201);
  const trip = await request('/api/trips', 'POST', { data: { title: 'Kenya', destination: 'Kenya', days: [] } }, { cookie: customer.cookie });
  assert.equal(trip.status, 201);

  const planned = await request('/api/friday/plan', 'POST', { message: 'Plan a Kenya trip', answers: answer, tripId: trip.result.record.id }, { cookie: customer.cookie });
  assert.equal(planned.status, 200);
  const draft = planned.result.draft;
  const handoff = await request('/api/friday/handoffs', 'POST', { draftId: draft.id, version: draft.version, confirmed: true }, { cookie: customer.cookie });
  assert.equal(handoff.status, 201);
  const repeated = await request('/api/friday/handoffs', 'POST', { draftId: draft.id, version: draft.version, confirmed: true }, { cookie: customer.cookie });
  assert.equal(repeated.result.handoff.id, handoff.result.handoff.id);

  const queue = await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(queue.status, 200);
  const quote = queue.result.quotes.find(row => row.customerEmail === 'ada@example.com' && row.snapshot);
  assert.equal(quote.customerName, 'Ada');
  assert.equal((await request('/api/admin/quotes', 'GET', undefined, { cookie: other.cookie })).status, 403);
  assert.equal((await request(`/api/admin/quotes/${quote.id}/draft-click`, 'POST', {}, { cookie: other.cookie })).status, 403);

  const openStats = queue.result.quoteStats;
  assert.equal(openStats.currentWeek.week, utcMonday());
  assert.ok(openStats.currentWeek.quotes >= 2);
  assert.equal(openStats.weeks.length, 8);
  assert.equal(openStats.repliedWithin30Hours.percent, null);

  await request(`/api/admin/quotes/${quote.id}/draft-click`, 'POST', {}, { cookie: admin.cookie });
  await request(`/api/admin/quotes/${quote.id}/draft-click`, 'POST', {}, { cookie: admin.cookie });
  const reply = await request(`/api/admin/quotes/${quote.id}/replied`, 'POST', {}, { cookie: admin.cookie });
  assert.equal(reply.status, 200);
  await request(`/api/admin/quotes/${quote.id}/replied`, 'POST', {}, { cookie: admin.cookie });

  const counts = await db.all('SELECT event_type, count(*) AS n FROM funnel_events GROUP BY event_type ORDER BY event_type');
  const n = Object.fromEntries(counts.map(row => [row.event_type, Number(row.n)]));
  assert.equal(n.quote_requested, 2);
  assert.equal(n.quote_replied, 1);
  assert.equal(n.callback_requested, 1);
  assert.equal(n.trip_started, 1);
  assert.equal(n.draft_reply_clicked, 2);
  await recordFunnelEvent(db, { eventType: 'callback_requested', subjectId: callback.result.id, ownerId: customer.result.user.id, data: { entryPoint: 'contact' } });
  assert.equal(Number((await db.one('SELECT count(*) AS n FROM funnel_events WHERE event_type=$1 AND subject_id=$2', ['callback_requested', callback.result.id])).n), 1);

  const rows = await db.all('SELECT event_type, data FROM funnel_events');
  for (const row of rows) {
    const data = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
    assert.equal(data.includes('@'), false, row.event_type);
    assert.equal(data.toLowerCase().includes('ada'), false, row.event_type);
    assert.equal(data.includes('9876'), false, row.event_type);
  }
  const packageEvent = rows.find(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return row.event_type === 'quote_requested' && data.path === 'package';
  });
  assert.ok(packageEvent);

  const lateId = '11111111-1111-4111-8111-111111111111';
  const youngId = '22222222-2222-4222-8222-222222222222';
  const ago = hours => new Date(Date.now() - hours * 3600000).toISOString();
  await recordFunnelEvent(db, { eventType: 'quote_requested', subjectId: lateId, ownerId: customer.result.user.id, data: { kind: 'friday_quote', path: 'planner' }, created: ago(40) });
  await recordFunnelEvent(db, { eventType: 'quote_replied', subjectId: lateId, ownerId: customer.result.user.id, data: { kind: 'friday_quote', hoursWaited: 40 }, created: ago(0) });
  await recordFunnelEvent(db, { eventType: 'quote_requested', subjectId: youngId, ownerId: customer.result.user.id, data: { kind: 'friday_quote', path: 'planner' }, created: ago(1) });

  const stats = (await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie })).result.quoteStats;
  assert.equal(stats.repliedWithin30Hours.considered, 2);
  assert.equal(stats.repliedWithin30Hours.within, 1);
  assert.equal(stats.repliedWithin30Hours.percent, 50);
});
