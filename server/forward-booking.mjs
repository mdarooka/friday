import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import * as store from './store.mjs';
import { extractBooking, htmlToText, jsonLdObjects } from './booking-extraction.mjs';

/* Forwarded booking emails. An inbound mail provider POSTs each message; the unguessable token in the recipient finds the owner
   and trip, and the existing paste reader (extractBooking) does the reading. Nothing here sends or publishes anything. */

const TOKEN = /^[a-f0-9]{32}$/;

/** One unguessable token per owner and trip (128 random bits). */
export const newForwardToken = () => randomBytes(16).toString('hex');

/** `trip-<token>@<domain>`, or null while TRIP_INBOUND_DOMAIN is unset. */
export function forwardAddressFor(token, domain) {
  const host = String(domain || '').trim().replace(/^@/, '').toLowerCase();
  if (!host || !TOKEN.test(String(token || ''))) return null;
  return `trip-${token}@${host}`;
}

/** The token from a recipient: a string, "Name <address>", or a list of either. Null when none matches. */
export function forwardTokenFromRecipient(recipient) {
  const list = Array.isArray(recipient) ? recipient : [recipient];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    for (const m of item.matchAll(/(?:^|[\s<,;"'])trip-([a-f0-9]{32})@/gi)) return m[1].toLowerCase();
  }
  return null;
}

/** Constant-time comparison of the provider's header against the configured secret. An empty secret means disabled, so never matches. */
export function inboundSecretMatches(provided, expected) {
  if (typeof expected !== 'string' || !expected || typeof provided !== 'string' || !provided) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

const text = (value, max) => (typeof value === 'string' ? value : '').slice(0, max);

/**
 * Read one forwarded message and, if it is a confirmation, save it as a draft booking on the owner's trip.
 * Returns { status: 'saved' | 'duplicate' | 'skipped', skip? }. Cancellations, promotional mail and non-confirmations save nothing.
 */
export async function saveForwardedBooking({ db, ownerId, tripId, message = {}, today = new Date().toISOString().slice(0, 10) }) {
  const isHtml = !message.text && !!message.html;
  const raw = isHtml ? text(message.html, 60000) : text(message.text, 20000);
  const plain = isHtml ? htmlToText(raw) : raw;
  const subject = text(message.subject, 500).trim();
  const messageId = text(message.messageId, 500).trim()
    || 'sha256:' + createHash('sha256').update(`${subject}\n${text(message.date, 100)}\n${plain}`).digest('hex');
  const extracted = extractBooking({
    source: 'forwarded-email', subject: subject || (plain.split(/\r?\n/).map(l => l.trim()).find(Boolean) || '').slice(0, 200),
    from: text(message.from, 500), body: plain.slice(0, 12000), schema: isHtml ? jsonLdObjects(raw) : [],
    externalId: messageId, tripId, confirmationDate: text(message.date, 100), includePast: false, today,
  });
  if (extracted.skip) return { status: 'skipped', skip: extracted.skip };
  // Dates always need the traveller's check, so the pre-departure briefing ignores this until they confirm it.
  const data = { ...extracted.booking, source: 'forwarded-email', externalId: messageId, tripId, dateStatus: 'needs-clarification' };
  // Only this owner's bookings are compared, so another account forwarding the same message is unaffected.
  const rows = await store.listRecords(db, ownerId, 'bookings');
  if (rows.some(r => { try { const old = JSON.parse(r.data); return old.source === 'forwarded-email' && old.externalId === messageId && old.tripId === tripId; } catch { return false; } })) return { status: 'duplicate' };
  await store.insertRecord(db, { id: randomUUID(), userId: ownerId, kind: 'bookings', data: JSON.stringify(data), updated: new Date().toISOString() });
  return { status: 'saved' };
}
