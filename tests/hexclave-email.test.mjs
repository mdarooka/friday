import test from 'node:test';
import assert from 'node:assert/strict';
import { createHexclaveEmailService } from '../server/hexclave/email.mjs';
import * as store from '../server/store.mjs';
import { openStore } from '../server/store.mjs';
import { startApp } from './helpers.mjs';

const config = { HEXCLAVE_PROJECT_ID: 'project-test', HEXCLAVE_SECRET_SERVER_KEY: 'server-secret-test' };

test('Hexclave email service stores the outbox before send and never repeats a sent message', async t => {
  const db = openStore(':memory:');
  t.after(() => db.close());
  let sends = 0;
  const email = createHexclaveEmailService({ db, store, env: config, fetch: async (url, options) => {
    sends++;
    assert.equal(url, 'https://api.hexclave.com/api/v1/emails/send-email');
    assert.equal(db.prepare('SELECT status FROM email_outbox WHERE dedupe_key=?').get('test:receipt').status, 'sending');
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
  const db = openStore(':memory:');
  t.after(() => db.close());
  let sends = 0;
  const email = createHexclaveEmailService({ db, store, env: config, fetch: async () => { sends++; throw new Error('socket closed after write'); } });
  const input = { dedupeKey: 'test:unknown', kind: 'quote', to: 'traveler@example.com', subject: 'Quote', html: '<pre>Reviewed text</pre>' };
  assert.equal((await email.send(input)).status, 'delivery_unknown');
  assert.equal((await email.send(input)).status, 'delivery_unknown');
  assert.equal(sends, 1);
});

test('explicit drain rehydrates blocked messages after configuration and concurrent drains claim only once', async t => {
  const db = openStore(':memory:');
  t.after(() => db.close());
  const pending = createHexclaveEmailService({ db, store, env: {} });
  await pending.send({ dedupeKey: 'test:blocked', kind: 'receipt', to: 'traveler@example.com', subject: 'Friday', html: '<p>Saved</p>' });
  pending.enquiryNotification({ id: 'commission-1', data: { name: 'Avery', email: 'avery@example.com', shape: 'A quiet week in Sicily' } });
  assert.equal(store.getEmailOutboxByKey(db, 'test:blocked').status, 'blocked');

  let sends = 0;
  const configured = createHexclaveEmailService({ db, store, env: { ...config, FRIDAY_ENQUIRY_EMAIL: 'studio@example.com' }, fetch: async () => {
    sends++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return new Response(null, { status: 202 });
  }});
  const [first, second] = await Promise.all([configured.drainPending(), configured.drainPending()]);
  assert.equal(sends, 2);
  assert.equal(store.getEmailOutboxByKey(db, 'test:blocked').status, 'provider_accepted');
  assert.equal(store.getEmailOutboxByKey(db, 'test:blocked').recipient, 'traveler@example.com');
  assert.equal(store.getEmailOutboxByKey(db, 'commission:commission-1:notification').recipient, 'studio@example.com');
  assert.match(JSON.parse(store.getEmailOutboxByKey(db, 'commission:commission-1:notification').content).text, /A quiet week in Sicily/);
  assert.equal(first.accepted + second.accepted, 2);
  assert.equal((await configured.drainPending()).selected, 0);
});

test('newsletter storage records consent and never turns commission enquiries into subscribers', t => {
  const db = openStore(':memory:');
  t.after(() => db.close());
  const consentAt = new Date().toISOString();
  store.upsertNewsletterSubscriber(db, { email: 'reader@example.com', consentAt, source: 'website', created: consentAt });
  assert.equal(store.getNewsletterSubscriber(db, 'reader@example.com').status, 'subscribed');
  assert.equal(store.getNewsletterSubscriber(db, 'reader@example.com').consent_at, consentAt);
  assert.equal(store.getNewsletterSubscriber(db, 'traveler@example.com'), undefined);
});

test('commission and newsletter routes call Hexclave only after saving valid submissions', async t => {
  const sends = [];
  const { request } = await startApp(t, {
    env: { ...config, AUTH_PROVIDER: 'local', FRIDAY_ENQUIRY_EMAIL: 'studio@example.com' },
    hexclaveAuth: { configured: false, currentUser: async () => null },
    emailFetch: async (url, options) => {
      sends.push({ url, body: JSON.parse(options.body) });
      return new Response(null, { status: 202 });
    },
  });
  const commission = await request('/api/commissions', 'POST', { name: 'Avery Traveler', email: 'avery@example.com', shape: 'A quiet week in Sicily' });
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
});
