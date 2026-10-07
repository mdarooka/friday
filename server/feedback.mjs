import { createHash } from 'node:crypto';
/* Friends' reactions and comments on a shared plan. Feedback belongs to (owner, trip), not to a share token, so it survives
   link rotation; writes are only accepted through a currently valid share link. */

/* PROVISIONAL limits: chosen without production data. Tune here once real traffic is known. */
export const FEEDBACK_WRITES_PER_IP_PER_MIN = 20;
export const FEEDBACK_WRITES_PER_TOKEN_PER_MIN = 60;
export const FEEDBACK_READS_PER_IP_PER_MIN = 120;
export const FEEDBACK_OWNER_WRITES_PER_MIN = 60;
export const MAX_COMMENTS_PER_VIEWER_PER_TRIP = 50;
export const MAX_ITEMS_PER_TRIP = 1000;   // reactions + comments, hidden ones included
export const MAX_COMMENT_CHARS = 280;
export const MAX_NAME_CHARS = 40;
export const REACTIONS = Object.freeze(['yes', 'love', 'unsure']);   // "Yes", "Love it", "Not sure"

const sha = value => createHash('sha256').update(value).digest('hex');
const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* Strip control characters (including newlines for names), collapse nothing else. Plain text only; the client renders with textContent. */
const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;   // keeps \t and \n
const LINE_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
export function cleanText(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(multiline ? CONTROLS : LINE_CONTROLS, '').trim().slice(0, max);
}

/* Stable stop identity from the shared trip payload: day index, stop index, and a hash of the normalised stop title.
   Trip items carry no id in the shared payload, so a stop that is renamed or moved gets a new key (its old feedback
   then no longer matches any stop and is only visible to the owner as "removed stop"). */
export function stopList(tripData) {
  const stops = [];
  const days = Array.isArray(tripData?.days) ? tripData.days : [];
  days.forEach((day, d) => {
    const items = Array.isArray(day?.items) ? day.items : [];
    items.forEach((item, s) => {
      const title = typeof item?.title === 'string' ? item.title.slice(0, 200) : '';
      stops.push({ key: `d${d}s${s}-${sha(normalize(title)).slice(0, 8)}`, day: d, item: s, title });
    });
  });
  return stops;
}

/* Viewer ids are random client values; only a per-trip hash is stored and it is never returned. */
export const viewerHash = (ownerId, tripId, viewerId) => sha(`viewer:${ownerId}:${tripId}:${viewerId}`);
export const validViewerId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);

/* ---- storage (PostgreSQL; trip_feedback is created in store.mjs createSchema) ---- */
const failWith = (status, message) => { throw Object.assign(new Error(message), { status }); };

export const feedbackRows = (db, ownerId, tripId) => db.all('SELECT id,stop_key,viewer_hash,viewer_name,kind,value,created,hidden FROM trip_feedback WHERE owner_id=$1 AND trip_id=$2 ORDER BY created,id', [ownerId, tripId]);
export const deleteTripFeedback = async (db, tripId, ownerId) => { await db.query('DELETE FROM trip_feedback WHERE trip_id=$1 AND owner_id=$2', [tripId, ownerId]); };

/* Writers for one (owner, trip) are serialised with a transaction-scoped advisory lock, so the per-trip caps hold under concurrency. */
const lockTrip = (tx, ownerId, tripId) => tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`trip_feedback:${ownerId}:${tripId}`]);

/* One reaction per viewer per stop: the same value again removes it, a different value replaces it. Returns the viewer's reaction or ''. */
export const setReaction = (db, { id, ownerId, tripId, stopKey, vHash, name, value, created }) => db.transaction(async tx => {
  await lockTrip(tx, ownerId, tripId);
  const existing = await tx.one("SELECT id,value FROM trip_feedback WHERE owner_id=$1 AND trip_id=$2 AND stop_key=$3 AND viewer_hash=$4 AND kind='reaction'", [ownerId, tripId, stopKey, vHash]);
  if (existing && existing.value === value) { await tx.query('DELETE FROM trip_feedback WHERE id=$1', [existing.id]); return ''; }
  if (existing) { await tx.query('UPDATE trip_feedback SET value=$1,viewer_name=$2,created=$3 WHERE id=$4', [value, name, created, existing.id]); return value; }
  if ((await tx.one('SELECT count(*) AS n FROM trip_feedback WHERE owner_id=$1 AND trip_id=$2', [ownerId, tripId])).n >= MAX_ITEMS_PER_TRIP) failWith(429, 'This plan has reached its limit for friend feedback.');
  await tx.query("INSERT INTO trip_feedback(id,owner_id,trip_id,stop_key,viewer_hash,viewer_name,kind,value,created) VALUES($1,$2,$3,$4,$5,$6,'reaction',$7,$8)", [id, ownerId, tripId, stopKey, vHash, name, value, created]);
  return value;
});

export const addComment = (db, { id, ownerId, tripId, stopKey, vHash, name, value, created }) => db.transaction(async tx => {
  await lockTrip(tx, ownerId, tripId);
  if ((await tx.one('SELECT count(*) AS n FROM trip_feedback WHERE owner_id=$1 AND trip_id=$2', [ownerId, tripId])).n >= MAX_ITEMS_PER_TRIP) failWith(429, 'This plan has reached its limit for friend feedback.');
  if ((await tx.one("SELECT count(*) AS n FROM trip_feedback WHERE owner_id=$1 AND trip_id=$2 AND viewer_hash=$3 AND kind='comment'", [ownerId, tripId, vHash])).n >= MAX_COMMENTS_PER_VIEWER_PER_TRIP) failWith(429, 'You have reached the comment limit for this plan.');
  await tx.query("INSERT INTO trip_feedback(id,owner_id,trip_id,stop_key,viewer_hash,viewer_name,kind,value,created) VALUES($1,$2,$3,$4,$5,$6,'comment',$7,$8)", [id, ownerId, tripId, stopKey, vHash, name, value, created]);
});

export const deleteViewerComment = async (db, { id, ownerId, tripId, vHash }) => (await db.query("DELETE FROM trip_feedback WHERE id=$1 AND owner_id=$2 AND trip_id=$3 AND viewer_hash=$4 AND kind='comment'", [id, ownerId, tripId, vHash])).rowCount;
export const setCommentHidden = async (db, { id, ownerId, tripId, hidden }) => (await db.query("UPDATE trip_feedback SET hidden=$1 WHERE id=$2 AND owner_id=$3 AND trip_id=$4 AND kind='comment'", [hidden ? 1 : 0, id, ownerId, tripId])).rowCount;
export const deleteComment = async (db, { id, ownerId, tripId }) => (await db.query("DELETE FROM trip_feedback WHERE id=$1 AND owner_id=$2 AND trip_id=$3 AND kind='comment'", [id, ownerId, tripId])).rowCount;

/* Public/owner views. Viewer hashes never leave the server; `mine` is computed against the caller's hash. */
export function summarize(rows, stops, { vHash = '', owner = false } = {}) {
  const live = new Set(stops.map(s => s.key));
  const reactions = {}, mine = {}, comments = [];
  for (const row of rows) {
    if (row.kind === 'reaction') {
      if (!live.has(row.stop_key)) continue;
      (reactions[row.stop_key] ||= {})[row.value] = (reactions[row.stop_key][row.value] || 0) + 1;
      if (vHash && row.viewer_hash === vHash) mine[row.stop_key] = row.value;
    } else if (owner || (!row.hidden && live.has(row.stop_key))) {
      const entry = { id: row.id, stopKey: row.stop_key, name: row.viewer_name, text: row.value, created: row.created, mine: Boolean(vHash && row.viewer_hash === vHash) };
      if (owner) { entry.hidden = Boolean(row.hidden); entry.removedStop = !live.has(row.stop_key); }
      comments.push(entry);
    }
  }
  return { stops: stops.map(s => ({ key: s.key, day: s.day, item: s.item, title: s.title })), reactions, mine, comments };
}
