/* Booking confidence: provenance + staff verification for a traveller's bookings.
   Verification lives at data.verification = { verifiedAt, verifiedBy } on the booking record. Customers can never set it:
   stripVerification() runs on every owner write, and only verifyBooking() (quote admins) writes it. */

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

/* Owner writes: drop any client-supplied verification, and keep the stored one only while the booking's key facts are unchanged. */
const FACTS = ['title', 'start', 'end', 'date', 'ref', 'reference', 'type'];
export function carryVerification(incoming, existing) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  delete incoming.verification;
  const prior = existing?.verification;
  if (prior && FACTS.every(k => (existing[k] ?? '') === (incoming[k] ?? ''))) incoming.verification = prior;
  return incoming;
}

export function verificationOf(data) {
  const v = data?.verification;
  return v && typeof v.verifiedAt === 'string' ? { verifiedAt: v.verifiedAt, verifiedBy: String(v.verifiedBy || '') } : null;
}

/* Admins may only reach a booking the traveller attached to a quote request (its id is in a quote snapshot). */
function bookingSharedWithFriday(store, db, bookingId) {
  return store.listFridayQuotes(db).some(q => {
    try { return (JSON.parse(q.snapshot).selectedBookings || []).some(b => b && b.id === bookingId); } catch { return false; }
  });
}

export function verifyBooking({ db, store, admin, allowed, bookingId, verified, now = new Date() }) {
  if (!admin) fail(401, 'Please sign in.');
  const email = String(admin.email || '').toLowerCase();
  if (!allowed || !allowed.has(email)) fail(403, 'Your account is not on the quote administration allowlist.');
  if (typeof verified !== 'boolean') fail(422, 'Say whether the booking is verified.');
  const row = db.prepare("SELECT * FROM records WHERE id=? AND kind='bookings'").get(bookingId);
  if (!row || !bookingSharedWithFriday(store, db, bookingId)) fail(404, 'This booking was not found in a quote request.');
  const data = JSON.parse(row.data);
  if (verified) data.verification = { verifiedAt: now.toISOString(), verifiedBy: email };
  else delete data.verification;
  const changed = store.updateRecordIfVersion(db, { id: row.id, userId: row.user_id, kind: 'bookings', data: JSON.stringify(data), updated: now.toISOString(), version: row.version });
  if (!changed) fail(409, 'This booking just changed. Reload and try again.');
  return { id: row.id, verification: verificationOf(data) };
}
