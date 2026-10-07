import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/* PROVISIONAL CONTENT. These five items are a first draft written without real data.
 * OWNER: replace them with items drawn from real stalled quotes (the questions you most often
 * had to chase before you could price a trip). This is the single source of truth: the server
 * validates against it, the planner modal fetches it from GET /api/callbacks/checklist-items,
 * and the admin queue and morning digest count completion against it. Keep ids stable; changing
 * an id orphans answers already saved under the old one. */
export const PREQUOTE_ITEMS = [
  { id: 'dates', label: 'Exact travel dates, or your flexibility window', placeholder: 'e.g. 12–19 Dec, or any week in December' },
  { id: 'travellers', label: 'Who is travelling, with ages of children', placeholder: 'e.g. 2 adults, 1 child (7)' },
  { id: 'budget', label: 'Budget band per person', placeholder: 'e.g. 80k–1.2L, excluding flights' },
  { id: 'musthaves', label: 'Must-haves and deal-breakers', placeholder: 'e.g. beach villa; no early starts' },
  { id: 'passport', label: 'Passport nationality and visa status', placeholder: 'e.g. Indian passport, no visa yet' },
];
const MAX_TEXT = 200;
const sha = value => createHash('sha256').update(value).digest('hex');

export function ensurePrequoteTable(db) {
  db.exec('CREATE TABLE IF NOT EXISTS callback_checklists(callback_id TEXT PRIMARY KEY,owner_id TEXT,token_hash TEXT NOT NULL,answers TEXT NOT NULL DEFAULT \'{}\',updated TEXT NOT NULL)');
}

/** Called when a callback is created. Returns the one-time edit token for the browser that created it. */
export function issueChecklist(db, { callbackId, ownerId = null, now = new Date().toISOString() }) {
  ensurePrequoteTable(db);
  const editToken = randomBytes(24).toString('base64url');
  db.prepare('INSERT OR REPLACE INTO callback_checklists(callback_id,owner_id,token_hash,answers,updated) VALUES(?,?,?,?,?)').run(callbackId, ownerId, sha(editToken), '{}', now);
  return editToken;
}

export function cleanAnswers(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const item of PREQUOTE_ITEMS) {
    const raw = input[item.id];
    if (!raw || typeof raw !== 'object') continue;
    const text = typeof raw.text === 'string' ? raw.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TEXT) : '';
    const done = raw.done === true || text !== '';
    if (done) out[item.id] = { done: true, text };
  }
  return out;
}

export const summarise = answers => ({ done: PREQUOTE_ITEMS.filter(i => answers?.[i.id]?.done).length, total: PREQUOTE_ITEMS.length });

/** Owner-scoped save: needs the creation token, and the same signed-in user when the callback was made signed in. */
export function saveChecklist(db, { callbackId, editToken, userId = null, answers, now = new Date().toISOString() }) {
  ensurePrequoteTable(db);
  const row = db.prepare('SELECT owner_id,token_hash FROM callback_checklists WHERE callback_id=?').get(String(callbackId));
  const given = Buffer.from(sha(String(editToken || ''))), want = row ? Buffer.from(row.token_hash) : null;
  if (!row || given.length !== want.length || !timingSafeEqual(given, want)) return null;
  if (row.owner_id && row.owner_id !== userId) return null;
  const clean = cleanAnswers(answers);
  db.prepare('UPDATE callback_checklists SET answers=?,updated=? WHERE callback_id=?').run(JSON.stringify(clean), now, String(callbackId));
  return { answers: clean, ...summarise(clean) };
}

export function getChecklist(db, callbackId) {
  ensurePrequoteTable(db);
  const row = db.prepare('SELECT answers,updated FROM callback_checklists WHERE callback_id=?').get(String(callbackId));
  let answers = {};
  try { answers = row ? cleanAnswers(JSON.parse(row.answers)) : {}; } catch { /* corrupt row counts as empty */ }
  return { answers, ...summarise(answers), updated: row?.updated || null };
}
