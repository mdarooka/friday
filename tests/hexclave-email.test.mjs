import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createHexclaveEmailService } from '../server/hexclave/email.mjs';
import * as store from '../server/store.mjs';
import { openStore } from '../server/store.mjs';
import { startApp, signUp } from './helpers.mjs';

const config = { HEXCLAVE_PROJECT_ID: 'project-test', HEXCLAVE_SECRET_SERVER_KEY: 'server-secret-test' };

test('Hexclave email service stores the outbox before send and never repeats a sent message', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  let sends = 0;
  const email = createHexclaveEmailService({ db, store, env: config, fetch: async (url, options) => {
    sends++;
    assert.equal(url, 'https://api.hexclave.com/api/v1/emails/send-email');
    assert.equal((await db.one('SELECT status FROM email_outbox WHERE dedupe_key=$1', ['test:receipt'])).status, 'sending');
    assert.equal(options.headers['X-Hexclave-Secret-Server-Key'], config.HEXCLAVE_SECRET_SERVER_KEY);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.emails, ['traveler@example.com']);
    assert.equal(body.notification_category_name, 'Transactional');
    assert.match(body.html, /Friday/);
    return new Response(null, { status: 202 });
  }});
  const first = await email.send({ dedupeKey: 'test:receipt', kind: 'receipt', to: 'traveler@example.com', subject: 'Friday', html: '<p>Friday</p>' });
  const repeated = await email.send({ dedupeKey: 'test:receipt', kind: 'receipt', to: 'traveler@example.com', subject: 'Friday', html: '<p>Friday</p>' });
  assert.equal(first.status, 'provider_accepted');
  assert.equal(repeated.status, 'provider_accepted');
  assert.equal(sends, 1);
});

test('ambiguous Hexclave delivery is stored as unknown and is not blindly retried', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  let sends = 0;
  const email = createHexclaveEmailService({ db, store, env: config, fetch: async () => { sends++; throw new Error('socket closed after write'); } });
  const input = { dedupeKey: 'test:unknown', kind: 'quote', to: 'traveler@example.com', subject: 'Quote', html: '<pre>Reviewed text</pre>' };
  assert.equal((await email.send(input)).status, 'delivery_unknown');
  assert.equal((await email.send(input)).status, 'delivery_unknown');
  assert.equal(sends, 1);
});

test('explicit drain rehydrates blocked messages after configuration and concurrent drains claim only once', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  const pending = createHexclaveEmailService({ db, store, env: {} });
  await pending.send({ dedupeKey: 'test:blocked', kind: 'receipt', to: 'traveler@example.com', subject: 'Friday', html: '<p>Saved</p>' });
  pending.enquiryNotification({ id: 'commission-1', data: { name: 'Avery', email: 'avery@example.com', shape: 'A quiet week in Sicily' } });
  assert.equal((await store.getEmailOutboxByKey(db, 'test:blocked')).status, 'blocked');

  let sends = 0;
  const configured = createHexclaveEmailService({ db, store, env: { ...config, FRIDAY_ENQUIRY_EMAIL: 'studio@example.com' }, fetch: async () => {
    sends++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return new Response(null, { status: 202 });
  }});
  const [first, second] = await Promise.all([configured.drainPending(), configured.drainPending()]);
  assert.equal(sends, 2);
  assert.equal((await store.getEmailOutboxByKey(db, 'test:blocked')).status, 'provider_accepted');
  assert.equal((await store.getEmailOutboxByKey(db, 'test:blocked')).recipient, 'traveler@example.com');
  assert.equal((await store.getEmailOutboxByKey(db, 'commission:commission-1:notification')).recipient, 'studio@example.com');
  assert.match(JSON.parse((await store.getEmailOutboxByKey(db, 'commission:commission-1:notification')).content).text, /A quiet week in Sicily/);
  assert.equal(first.accepted + second.accepted, 2);
  assert.equal((await configured.drainPending()).selected, 0);
});

test('newsletter storage records consent and never turns commission enquiries into subscribers', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  const consentAt = new Date().toISOString();
  await store.upsertNewsletterSubscriber(db, { email: 'reader@example.com', consentAt, source: 'website', created: consentAt });
  assert.equal((await store.getNewsletterSubscriber(db, 'reader@example.com')).status, 'subscribed');
  assert.equal((await store.getNewsletterSubscriber(db, 'reader@example.com')).consent_at, consentAt);
  assert.equal(await store.getNewsletterSubscriber(db, 'traveler@example.com'), undefined);
  assert.equal(await store.unsubscribeNewsletterSubscriber(db, 'reader@example.com'), 1);
  assert.equal((await store.getNewsletterSubscriber(db, 'reader@example.com')).status, 'unsubscribed');
  assert.equal(await store.unsubscribeNewsletterSubscriber(db, 'reader@example.com'), 0);
});

test('production newsletter links use fridaytravel.vercel.app when no origin is configured', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  let sent;
  const email = createHexclaveEmailService({
    db, store,
    env: { ...config, NODE_ENV: 'production', VERCEL_URL: 'friday-travel-peach.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'friday-travel-peach.vercel.app' },
    fetch: async (_url, options) => { sent = JSON.parse(options.body); return new Response(null, { status: 202 }); },
  });
  await email.subscriptionConfirmation({ id: 'signup-canonical', email: 'reader@example.com', consentAt: '2026-10-07T12:00:00.000Z' });
  assert.match(sent.html, /https:\/\/fridaytravel\.vercel\.app\/api\/newsletter\/unsubscribe\?token=/);
  assert.equal(JSON.stringify(sent).includes('peach'), false);
});

test('newsletter signup confirmation includes a verifiable self-serve unsubscribe link', async t => {
  const db = openStore({ memory: true });
  t.after(() => db.close());
  let sent;
  const email = createHexclaveEmailService({ db, store, env: { ...config, APP_ORIGIN: 'https://friday.example' }, fetch: async (_url, options) => { sent = JSON.parse(options.body); return new Response(null, { status: 202 }); } });
  const consentAt = '2026-10-07T12:00:00.000Z';
  await email.subscriptionConfirmation({ id: 'signup-1', email: 'Reader@Example.com', consentAt });
  assert.match(sent.html, /https:\/\/friday\.example\/api\/newsletter\/unsubscribe\?token=/);
  assert.match(sent.html, /Unsubscribe from Friday emails/);
  const token = /newsletter\/unsubscribe\?token=([^"&]+)/.exec(sent.html)?.[1];
  assert.ok(token);
  const [encodedEmail, encodedConsent, signature] = token.split('.');
  const address = Buffer.from(encodedEmail, 'base64url').toString();
  const consent = Buffer.from(encodedConsent, 'base64url').toString();
  assert.equal(address, 'reader@example.com');
  assert.equal(consent, consentAt);
  assert.equal(signature, createHmac('sha256', config.HEXCLAVE_SECRET_SERVER_KEY).update(`${address}\n${consent}`).digest('base64url'));
});

test('commission and newsletter routes call Hexclave only after saving valid submissions', async t => {
  const sends = [];
  const { request } = await startApp(t, {
    env: { ...config, APP_ORIGIN: 'http://localhost:4871', AUTH_PROVIDER: 'local', FRIDAY_ENQUIRY_EMAIL: 'studio@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
    emailFetch: async (url, options) => {
      sends.push({ url, body: JSON.parse(options.body) });
      return new Response(null, { status: 202 });
    },
  });
  const { cookie } = await signUp(request, 'Avery');
  const commission = await request('/api/commissions', 'POST', { name: 'Avery Traveler', email: 'avery@example.com', shape: 'A quiet week in Sicily' }, { cookie });
  assert.equal(commission.status, 201);
  assert.equal(commission.result.delivery.receipt, 'provider_accepted');
  assert.equal(commission.result.delivery.notification, 'provider_accepted');
  assert.equal(sends.length, 2);
  assert.ok(sends.some(x => x.body.emails[0] === 'avery@example.com'));
  assert.ok(sends.some(x => x.body.emails[0] === 'studio@example.com'));

  assert.equal((await request('/api/subscriptions', 'POST', { email: 'reader@example.com' })).status, 422);
  const subscription = await request('/api/subscriptions', 'POST', { email: 'reader@example.com', consent: true });
  assert.equal(subscription.status, 201);
  assert.equal(subscription.result.delivery, 'provider_accepted');
  assert.equal(sends.length, 3);
  const unsubscribeToken = /newsletter\/unsubscribe\?token=([^"&]+)/.exec(sends.find(x => x.body.emails[0] === 'reader@example.com').body.html)?.[1];
  assert.ok(unsubscribeToken);
  const landing = await request(`/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`);
  assert.equal(landing.status, 200);
  assert.match(landing.result, /Unsubscribe from Friday emails\?/);
  const unsubscribed = await request('/api/newsletter/unsubscribe', 'POST', { token: unsubscribeToken });
  assert.equal(unsubscribed.status, 200);
  assert.equal(unsubscribed.result.ok, true);
  assert.equal((await request('/api/newsletter/unsubscribe', 'POST', { token: unsubscribeToken })).status, 400);
  const resubscribed = await request('/api/subscriptions', 'POST', { email: 'reader@example.com', consent: true });
  assert.equal(resubscribed.status, 201);
  assert.equal((await request('/api/newsletter/unsubscribe', 'POST', { token: unsubscribeToken })).status, 400);
});
