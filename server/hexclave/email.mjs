const API_URL = 'https://api.hexclave.com/api/v1/emails/send-email';
const validAddress = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

/**
 * Hexclave email delivery with a durable, at-most-once outbox.
 * Hexclave does not document an idempotency key for arbitrary-address REST sends, so a
 * request whose result is uncertain is kept in delivery_unknown and is never retried here.
 */
export function createHexclaveEmailService({ db, store, env = process.env, fetch: fetcher = fetch }) {
  const configured = !!(env.HEXCLAVE_PROJECT_ID && env.HEXCLAVE_SECRET_SERVER_KEY);

  async function deliver(row, includeBlocked = false) {
    if (!configured) return row;
    const dedupeKey = row.dedupe_key;
    const attemptedAt = new Date().toISOString();
    if (!store.claimEmailOutbox(db, dedupeKey, attemptedAt, includeBlocked)) return store.getEmailOutboxByKey(db, dedupeKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const content = JSON.parse(row.content);
      const response = await fetcher(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Hexclave-Access-Type': 'server',
          'X-Hexclave-Project-Id': env.HEXCLAVE_PROJECT_ID,
          'X-Hexclave-Secret-Server-Key': env.HEXCLAVE_SECRET_SERVER_KEY,
        },
        body: JSON.stringify({
          emails: [row.recipient],
          subject: row.subject,
          html: content.html,
          notification_category_name: 'Transactional',
        }),
      });
      if (!response.ok) throw new Error(`Hexclave email endpoint returned ${response.status}`);
      store.setEmailOutboxStatus(db, dedupeKey, 'provider_accepted', new Date().toISOString());
    } catch {
      // Even a timeout or provider error may follow acceptance. Never retry automatically.
      store.setEmailOutboxStatus(db, dedupeKey, 'delivery_unknown', new Date().toISOString());
    } finally { clearTimeout(timeout); }
    return store.getEmailOutboxByKey(db, dedupeKey);
  }

  async function send({ dedupeKey, kind, to, subject, html, text = '' }) {
    if (!dedupeKey || !kind || !to || !subject || !html) throw new TypeError('A dedupe key, recipient, subject and body are required.');
    const now = new Date().toISOString();
    const record = store.createEmailOutbox(db, {
      id: dedupeKey,
      dedupeKey,
      kind,
      recipient: to,
      subject,
      content: JSON.stringify({ html, text }),
      status: configured ? 'queued' : 'blocked',
      created: now,
      updated: now,
    });
    const row = store.getEmailOutboxByKey(db, dedupeKey);
    if (record.changes === 0 || !configured) return row;
    return deliver(row);
  }

  function queueUnaddressed({ dedupeKey, kind, subject, html, text = '' }) {
    const now = new Date().toISOString();
    store.createEmailOutbox(db, { id: dedupeKey, dedupeKey, kind, recipient: '', subject, content: JSON.stringify({ html, text }), status: 'blocked', created: now, updated: now });
    return store.getEmailOutboxByKey(db, dedupeKey);
  }

  async function drainPending({ limit = 100 } = {}) {
    if (!configured) throw new Error('Hexclave email delivery is not configured.');
    const rows = store.listPendingEmailOutbox(db, limit);
    const results = await Promise.all(rows.map(row => {
      if (row.kind === 'commission_notification' && !row.recipient) {
        const recipient = String(env.FRIDAY_ENQUIRY_EMAIL || '').trim().toLowerCase();
        if (!validAddress(recipient)) return row;
        store.setEmailOutboxRecipient(db, row.dedupe_key, recipient, new Date().toISOString());
        row = store.getEmailOutboxByKey(db, row.dedupe_key);
      }
      if (!validAddress(row.recipient)) return row;
      return deliver(row, true);
    }));
    return {
      selected: rows.length,
      accepted: results.filter(row => row?.status === 'provider_accepted').length,
      unknown: results.filter(row => row?.status === 'delivery_unknown').length,
      pending: results.filter(row => row && ['queued','blocked','sending'].includes(row.status)).length,
    };
  }

  return {
    configured,
    send,
    drainPending,
    enquiryReceipt({ id, name, email }) {
      const firstName = escapeHtml(String(name || '').trim().split(/\s+/)[0] || '');
      return send({
        dedupeKey: `commission:${id}:receipt`,
        kind: 'commission_receipt',
        to: email,
        subject: 'Friday has received your travel enquiry',
        text: 'Thank you for your enquiry. Friday has received it and the team will be in touch.',
        html: `<p>Hello${firstName ? ` ${firstName}` : ''},</p><p>Thank you for writing to Friday. We have received your travel enquiry and the team will be in touch.</p>`,
      });
    },
    enquiryNotification({ id, inbox, data }) {
      const lines = Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n');
      const content = `<h1>New Friday travel enquiry</h1><pre>${escapeHtml(lines)}</pre>`;
      if (!validAddress(inbox)) return queueUnaddressed({ dedupeKey: `commission:${id}:notification`, kind: 'commission_notification', subject: 'New Friday travel enquiry', text: lines, html: content });
      return send({
        dedupeKey: `commission:${id}:notification`,
        kind: 'commission_notification',
        to: inbox,
        subject: 'New Friday travel enquiry',
        text: lines,
        html: content,
      });
    },
    subscriptionConfirmation({ id, email }) {
      return send({
        dedupeKey: `subscription:${id}:confirmation`,
        kind: 'subscription_confirmation',
        to: email,
        subject: 'You’re on Friday’s list',
        text: 'Thanks for choosing to receive occasional marketing notes from Friday. We have saved your signup and consent.',
        html: '<p>Thanks for choosing to receive occasional marketing notes from Friday. We have saved your signup and consent.</p>',
      });
    },
    quote({ id, to, subject, text }) {
      return send({
        dedupeKey: `friday-quote:${id}`,
        kind: 'friday_quote',
        to,
        subject,
        text,
        // Keep the reviewed quote body verbatim, including line breaks and punctuation.
        html: `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(text)}</pre>`,
      });
    },
  };
}
