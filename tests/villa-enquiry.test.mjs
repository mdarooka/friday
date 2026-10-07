import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';

test('villa quote enquiries and callbacks carry the published villa into the Quotes queue', async t => {
  const { request, db } = await startApp(t, {
    env: { AUTH_PROVIDER: 'local', AUTH_REQUIRED: 'true', VILLA_ADMIN_EMAILS: 'admin@example.com', QUOTE_ADMIN_EMAILS: 'admin@example.com' },
  });
  const admin = await signUp(request, 'Admin');
  const created = await request('/api/admin/villas', 'POST', { villa: {
    name: 'Palm Courtyard', city: 'Alibaug', maxGuests: 6, status: 'published',
  } }, { cookie: admin.cookie });
  assert.equal(created.status, 201);
  const villaId = created.result.villa.id;

  const enquiry = await request('/api/commissions', 'POST', {
    name: 'Traveler Jane', email: 'jane@example.com', shape: 'Villa: Palm Courtyard · Alibaug · Sleeps up to 6 guests', composition: ['Villa stay'], villaId,
  });
  assert.equal(enquiry.status, 201);
  const queue = await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie });
  const quote = queue.result.quotes.find(item => item.id === enquiry.result.id);
  assert.equal(quote.kind, 'villa_enquiry');
  assert.deepEqual(quote.villa, { id: villaId, name: 'Palm Courtyard', city: 'Alibaug', guests: 6 });
  assert.equal(quote.customerEmail, 'jane@example.com');
  const savedEnquiry = JSON.parse((await db.one('SELECT data FROM enquiries WHERE id=$1', [enquiry.result.id])).data);
  assert.equal(savedEnquiry.from, 'villa');
  assert.equal(savedEnquiry.villaId, villaId);
  assert.equal(savedEnquiry.villa.id, villaId);

  const callback = await request('/api/callbacks', 'POST', {
    name: 'Traveler Jane', phone: '+91 98765-43210', bestTime: 'afternoon', entryPoint: 'contact', villaId,
  });
  assert.equal(callback.status, 201);
  const withCallback = await request('/api/admin/quotes', 'GET', undefined, { cookie: admin.cookie });
  const call = withCallback.result.quotes.find(item => item.id === callback.result.id);
  assert.equal(call.kind, 'callback');
  assert.equal(call.villaName, 'Palm Courtyard');
  assert.equal(call.villaCity, 'Alibaug');
  assert.equal(call.villaGuests, 6);
  assert.equal(call.from, 'villa');
  assert.equal(call.entryPoint, 'villa');
  const savedCallback = await db.one('SELECT villa_id, entry_point, "from" FROM callback_requests WHERE id=$1', [callback.result.id]);
  assert.equal(savedCallback.villa_id, villaId);
  assert.equal(savedCallback.entry_point, 'villa');
  assert.equal(savedCallback.from, 'villa');
});

test('contact quote anchor and mobile villa enquiry button are present in the generated sources', async t => {
  const { request } = await startApp(t);
  const contact = await request('/contact.html');
  assert.match(contact.result, /id="quote" data-commission/);
  const villas = await request('/assets/js/villas.js');
  assert.match(villas.result, /Ask Friday about this villa/);
  assert.match(villas.result, /contact\.html\?'.*#quote/);
  const styles = await request('/assets/css/villas.css');
  assert.match(styles.result, /villa-enquiry-cta \{ flex-basis: 100%; justify-content: center; \}/);
});
