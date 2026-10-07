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
    tripData: { title: 'A week in Kerala', destination: 'Kerala', startDate: start, endDate: departure(days + 5), openQuestions: ['Confirm airport pickup'] },
    bookingRows: [{ id: 'booking-1', data: JSON.stringify({ tripId, title: 'Kochi flight', start, end: departure(days + 1), dateStatus, source: 'google-gmail' }) }],
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
  assert.match(briefing.tripUrl, /ref=briefing/);
  assert.match(briefing.tripUrl, /trip=6c0c0b79/);
  assert.match(briefing.html, /confirmed date/);
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

test('briefing event sender covers sent and opened events with trip and departure timing properties', async () => {
  const source = (await readFile(new URL('../assets/js/friday-analytics.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../assets/js/briefing-analytics.js', import.meta.url), 'utf8'));
  const admin = await readFile(new URL('../assets/js/admin.js', import.meta.url), 'utf8');
  const planner = await readFile(new URL('../assets/js/trip-app.js', import.meta.url), 'utf8');
  const adminPage = await readFile(new URL('../admin.html', import.meta.url), 'utf8');
  const tripPage = await readFile(new URL('../trip.html', import.meta.url), 'utf8');
  assert.match(adminPage, /data-panel="briefings"/);
  assert.match(tripPage, /briefing-analytics\.js/);
  assert.match(source, /briefing_sent/);
  assert.match(source, /briefing_opened/);
  assert.match(admin, /days_before_departure/);
  assert.match(planner, /trip_id: briefingTripId/);
});
