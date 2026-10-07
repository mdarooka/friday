import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { briefingDaysBefore, prepareBriefing } from '../server/briefing.mjs';
import { signUp, startApp } from './helpers.mjs';

const tripId = '6c0c0b79-689a-47ab-a2da-2c0bba79ee7c';
const departure = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function sample({ dateStatus = 'confirmed', days = 7 } = {}) {
  const start = departure(days);
  return prepareBriefing({
    tripId,
    tripData: { title: 'A week in Kerala', destination: 'Kerala', startDate: start, endDate: departure(days + 5), stay: { name: 'Fort Kochi House', address: 'Kochi' }, days: [{ title: 'Fort Kochi', date: start, items: [{ title: 'Ferry', time: '09:30' }] }], openQuestions: ['Confirm airport pickup'] },
    bookingRows: [{ id: 'booking-1', data: JSON.stringify({ tripId, title: 'Kochi flight', start, end: departure(days + 1), dateStatus, source: 'google-gmail', ref: 'AB123' }) }, { id: 'calendar-1', data: JSON.stringify({ tripId, title: 'Airport pickup', start: start + 'T09:15:00+05:30', end: start + 'T10:00:00+05:30', source: 'google-calendar', location: 'Kochi airport' }) }],
    recipient: 'traveller@example.com', origin: 'https://friday.example', now: new Date(),
  });
}

test('briefing eligibility needs a linked confirmed date in the next seven days', () => {
  assert.equal(sample().eligible, true);
  assert.equal(sample({ dateStatus: 'needs-clarification' }).eligible, false);
  assert.equal(sample({ days: 8 }).eligible, false);
  assert.equal(sample({ days: -1 }).eligible, false);
  assert.equal(briefingDaysBefore('bad-date'), null);
});

test('briefing email renders trip dates, linked bookings, open questions, designer contact, and attributed trip link', () => {
  const briefing = sample();
  assert.match(briefing.subject, /A week in Kerala/);
  assert.match(briefing.text, /Kochi flight/);
  assert.match(briefing.text, /Confirm airport pickup/);
  assert.match(briefing.text, /contact\.html/);
  assert.match(briefing.text, /Fort Kochi House/);
  assert.match(briefing.text, /Ferry/);
  assert.match(briefing.text, /AB123/);
  assert.match(briefing.text, /Airport pickup · \d{4}-\d{2}-\d{2} 09:15/);
  assert.match(briefing.text, /30 hours/);
  assert.match(briefing.tripUrl, /trip-briefing\.html/);
  assert.match(briefing.tripUrl, /ref=briefing/);
  assert.match(briefing.tripUrl, /trip=6c0c0b79/);
  assert.match(briefing.html, /date marked confirmed/);
});

test('missing trip details stay empty instead of becoming invented bookings or plans', () => {
  const briefing = prepareBriefing({ tripId, tripData: { title: 'Trip without details' }, origin: 'https://friday.example' });
  assert.deepEqual(briefing.days, []);
  assert.equal(briefing.stay, null);
  assert.deepEqual(briefing.bookings, []);
  assert.match(briefing.text, /No day-by-day plan has been saved yet/);
  assert.match(briefing.text, /No bookings have been linked/);
});

test('briefing subject reflects the actual departure window through departure day', () => {
  assert.match(sample({ days: 0 }).subject, /^Your trip starts today:/);
  assert.match(sample({ days: 1 }).subject, /^Your trip starts tomorrow:/);
  for (let days = 2; days <= 6; days++) assert.match(sample({ days }).subject, new RegExp(`^${days} days to go:`));
  assert.match(sample({ days: 7 }).subject, /^A week to go:/);
});

test('staff can send an eligible trip briefing through the existing email service without real delivery in tests', async t => {
  const sent = [];
  const emailService = { configured: true, async send(message) { sent.push(message); return { status: 'provider_accepted' }; } };
  const { request } = await startApp(t, { env: { AUTH_REQUIRED: 'true', ADMIN_EMAILS: 'admin@example.com' }, emailService });
  const admin = await signUp(request, 'Admin');
  const traveler = await signUp(request, 'Traveler');
  const start = departure(7), end = departure(12);
  const createdTrip = await request('/api/trips', 'POST', { data: { title: 'Kerala trip', destination: 'Kerala', startDate: start, endDate: end } }, { cookie: traveler.cookie });
  assert.equal(createdTrip.status, 201);
  const id = createdTrip.result.record.id;
  const savedBooking = await request('/api/bookings', 'POST', { data: { title: 'Kochi flight', tripId: id, start, dateStatus: 'confirmed', source: 'google-gmail' } }, { cookie: traveler.cookie });
  assert.equal(savedBooking.status, 201);

  const outsider = await request('/api/admin/briefings', 'GET', undefined, { cookie: traveler.cookie });
  assert.equal(outsider.status, 403);
  const list = await request('/api/admin/briefings', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(list.status, 200);
  assert.equal(list.result.briefings.find(item => item.tripId === id).eligible, true);

  const response = await request(`/api/admin/briefings/${id}/send`, 'POST', { requestId: 'send-test-1' }, { cookie: admin.cookie });
  assert.equal(response.status, 200);
  assert.equal(response.result.daysBeforeDeparture, 7);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'traveler@example.com');
  assert.match(sent[0].text, /ref=briefing/);
});

test('private briefing view uses the shared content route and a built-in page-view path', async () => {
  const app = await readFile(new URL('../server/app.mjs', import.meta.url), 'utf8');
  const planner = await readFile(new URL('../assets/js/trip-app.js', import.meta.url), 'utf8');
  const view = await readFile(new URL('../assets/js/trip-briefing-view.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../trip-briefing.html', import.meta.url), 'utf8');
  const workspace = await readFile(new URL('../assets/js/trip-workspace.js', import.meta.url), 'utf8');
  assert.ok(app.includes('const tripBriefing=p.match'));
  assert.ok(planner.includes('trip-briefing'));
  assert.ok(workspace.includes('data-ws=\"briefing\"'));
  assert.ok(view.includes("track('$page-view', { path: '/trip-briefing.html' })"));
  assert.ok(!view.includes('briefing_opened'));
  assert.ok(page.includes('trip-briefing.css'));
  assert.ok(page.includes('trip-briefing-view.js'));
});

test('traveler briefing API returns only the owner’s trip content', async t => {
  const { request } = await startApp(t, { env: { AUTH_REQUIRED: 'true' } });
  const owner = await signUp(request, 'Owner');
  const other = await signUp(request, 'Other');
  const start = departure(7), end = departure(10);
  const created = await request('/api/trips', 'POST', { data: { title: 'Private Kerala trip', destination: 'Kerala', startDate: start, endDate: end, stay: { name: 'Saved house' }, days: [{ title: 'Kochi', date: start, items: [{ title: 'Fort walk' }] }] } }, { cookie: owner.cookie });
  const id = created.result.record.id;
  const unauthenticated = await request(`/api/trips/${id}/briefing`, 'GET');
  assert.equal(unauthenticated.status, 401);
  const privateToOther = await request(`/api/trips/${id}/briefing`, 'GET', undefined, { cookie: other.cookie });
  assert.equal(privateToOther.status, 404);
  const response = await request(`/api/trips/${id}/briefing`, 'GET', undefined, { cookie: owner.cookie });
  assert.equal(response.status, 200);
  assert.equal(response.result.briefing.title, 'Private Kerala trip');
  assert.equal(response.result.briefing.days[0].items[0].title, 'Fort walk');
  assert.equal(response.result.briefing.stay.name, 'Saved house');
  assert.equal('recipient' in response.result.briefing, false);
});
