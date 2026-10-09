import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';

test('Admin console page and assets are served correctly', async t => {
  const { request } = await startApp(t);

  const htmlRes = await request('/admin.html');
  assert.equal(htmlRes.status, 200);
  assert.match(htmlRes.result, /data-admin-page="hub"/);
  assert.match(htmlRes.result, /Operations Console/);
  assert.match(htmlRes.result, /assets\/css\/admin\.css/);
  assert.match(htmlRes.result, /assets\/js\/admin-auth\.js/);
  assert.match(htmlRes.result, /assets\/js\/admin\.js/);

  const cssRes = await request('/assets/css/admin.css');
  assert.equal(cssRes.status, 200);
  assert.match(cssRes.result, /\.admin-tabs/);

  const jsRes = await request('/assets/js/admin.js');
  assert.equal(jsRes.status, 200);
  assert.match(jsRes.result, /FridayAdmin/);
  assert.match(jsRes.result, /var QUOTE_REPLY_SLA_HOURS = 30;/);
  assert.match(jsRes.result, /waitedMs > QUOTE_REPLY_SLA_HOURS \* 60 \* 60 \* 1000/);
  assert.match(jsRes.result, /Over ' \+ QUOTE_REPLY_SLA_HOURS \+ 'h/);

  const authJsRes = await request('/assets/js/admin-auth.js');
  assert.equal(authJsRes.status, 200);
  assert.match(authJsRes.result, /FridayAdmin/);
});

test('Admin status endpoint reports access, role capabilities, and email setup', async t => {
  const { request } = await startApp(t, {
    env: {
      AUTH_REQUIRED: 'true',
      ADMIN_EMAILS: 'generaladmin@example.com',
      VILLA_ADMIN_EMAILS: 'villaadmin@example.com',
      QUOTE_ADMIN_EMAILS: 'quoteadmin@example.com',
      AI_REVIEW_ADMIN_EMAILS: 'aiadmin@example.com'
    }
  });

  // Anonymous request fails 401
  assert.equal((await request('/api/admin/status')).status, 401);

  // General admin has full capabilities
  const general = await signUp(request, 'GeneralAdmin');
  const genStatus = await request('/api/admin/status', 'GET', undefined, { cookie: general.cookie });
  assert.equal(genStatus.status, 200);
  assert.equal(genStatus.result.access, true);
  assert.equal(genStatus.result.capabilities.villas, true);
  assert.equal(genStatus.result.capabilities.quotes, true);
  assert.equal(genStatus.result.capabilities.aiReview, true);

  // Villa admin has villa capability but not quote admin
  const villaAdm = await signUp(request, 'VillaAdmin');
  const vStatus = await request('/api/admin/status', 'GET', undefined, { cookie: villaAdm.cookie });
  assert.equal(vStatus.status, 200);
  assert.equal(vStatus.result.access, true);
  assert.equal(vStatus.result.capabilities.villas, true);
  assert.equal(vStatus.result.capabilities.quotes, false);

  // Normal user has no admin access
  const normalUser = await signUp(request, 'NormalUser');
  const normStatus = await request('/api/admin/status', 'GET', undefined, { cookie: normalUser.cookie });
  assert.equal(normStatus.status, 200);
  assert.equal(normStatus.result.access, false);
  assert.equal(normStatus.result.capabilities.villas, false);
  assert.equal(normStatus.result.capabilities.quotes, false);
  assert.equal(normStatus.result.capabilities.aiReview, false);
});

test('Admin comms endpoints (enquiries, subscribers, email outbox) require admin access and return records', async t => {
  const { request } = await startApp(t, {
    env: {
      AUTH_REQUIRED: 'true',
      ADMIN_EMAILS: 'admin@example.com'
    }
  });

  const admin = await signUp(request, 'Admin');
  const guest = await signUp(request, 'Guest');

  // Submit a commission enquiry and a newsletter subscription
  const enquiryRes = await request('/api/commissions', 'POST', {
    name: 'Traveler Jane',
    email: 'jane@example.com',
    shape: 'A quiet week in the Amalfi Coast'
  }, { cookie: guest.cookie });
  assert.equal(enquiryRes.status, 201);

  const subRes = await request('/api/subscriptions', 'POST', {
    email: 'subscriber@example.com',
    consent: true
  });
  assert.equal(subRes.status, 201);

  // Non-admin gets 403
  assert.equal((await request('/api/admin/enquiries', 'GET', undefined, { cookie: guest.cookie })).status, 403);
  assert.equal((await request('/api/admin/newsletter-subscribers', 'GET', undefined, { cookie: guest.cookie })).status, 403);
  assert.equal((await request('/api/admin/email-outbox', 'GET', undefined, { cookie: guest.cookie })).status, 403);

  // Admin gets records
  const enquiries = await request('/api/admin/enquiries', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(enquiries.status, 200);
  assert.ok(enquiries.result.enquiries.length >= 1);
  assert.equal(enquiries.result.enquiries[0].data.name, 'Traveler Jane');

  const subscribers = await request('/api/admin/newsletter-subscribers', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(subscribers.status, 200);
  assert.ok(subscribers.result.subscribers.some(s => s.email === 'subscriber@example.com'));

  const outbox = await request('/api/admin/email-outbox', 'GET', undefined, { cookie: admin.cookie });
  assert.equal(outbox.status, 200);
  assert.ok(Array.isArray(outbox.result.messages));
});

test('Unrestricted / development admin allows full access without configured email allowlists', async t => {
  const { request } = await startApp(t, {
    env: { AUTH_REQUIRED: 'true' }
  });

  const user = await signUp(request, 'DevAdmin');
  const status = await request('/api/admin/status', 'GET', undefined, { cookie: user.cookie });
  assert.equal(status.status, 200);
  assert.equal(status.result.access, true);
  assert.equal(status.result.capabilities.villas, true);
  assert.equal(status.result.capabilities.quotes, true);
  assert.equal(status.result.capabilities.aiReview, true);

  // Can access villas, quotes, AI review, and comms
  assert.equal((await request('/api/admin/villas', 'GET', undefined, { cookie: user.cookie })).status, 200);
  assert.equal((await request('/api/admin/quotes', 'GET', undefined, { cookie: user.cookie })).status, 200);
  assert.equal((await request('/api/admin/ai-conversations', 'GET', undefined, { cookie: user.cookie })).status, 200);
  assert.equal((await request('/api/admin/enquiries', 'GET', undefined, { cookie: user.cookie })).status, 200);
});
