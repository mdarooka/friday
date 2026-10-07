import * as defaultStore from './store.mjs';
import { PREQUOTE_ITEMS, getChecklist } from './prequote-checklist.mjs';

export const REQUIRED_DRY_RUN_DAYS = 3;
export const RUN_HOUR_UTC = 4, RUN_MINUTE_UTC = 0;   // 09:30 Asia/Kolkata (UTC+05:30, no DST)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 86400000;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function quoteDigestMode(env = process.env) {
  const value = String(env.FRIDAY_QUOTE_DIGEST ?? '').trim().toLowerCase();
  return value === 'off' || value === 'live' ? value : 'dry-run';
}
/** One designer: QUOTE_DIGEST_EMAIL, else the first QUOTE_ADMIN_EMAILS entry, else FRIDAY_ENQUIRY_EMAIL. */
export function digestRecipient(env = process.env) {
  const candidates = [env.QUOTE_DIGEST_EMAIL, String(env.QUOTE_ADMIN_EMAILS || '').split(',')[0], env.FRIDAY_ENQUIRY_EMAIL];
  for (const c of candidates) { const v = String(c || '').trim().toLowerCase(); if (EMAIL.test(v)) return v; }
  return '';
}

export function nextQuoteDigestRunAt(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_HOUR_UTC, RUN_MINUTE_UTC));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
export const msUntilNextQuoteDigest = (now = new Date()) => nextQuoteDigestRunAt(now).getTime() - now.getTime();
export const pastTodaysQuoteDigest = (now = new Date()) => now.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_HOUR_UTC, RUN_MINUTE_UTC);

const ageLabel = (created, now) => {
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(created)) / DAY));
  return days === 0 ? 'waiting since today' : days === 1 ? 'waiting 1 day' : `waiting ${days} days`;
};

/** Open callbacks (status not done) plus pending quote requests, oldest first. */
export function collectQueue({ db, store = defaultStore, now = new Date() }) {
  const items = [];
  for (const row of store.listCallbackRequests(db)) {
    if (row.status === 'done') continue;
    const checklist = getChecklist(db, row.id);
    items.push({ kind: 'callback', created: row.created, name: row.name, phone: row.phone, entryPoint: row.entry_point, bestTime: row.best_time, checklist: `${checklist.done}/${checklist.total}` });
  }
  for (const row of store.listFridayQuotes(db)) {
    if (row.status !== 'pending') continue;
    let snap = {}; try { snap = JSON.parse(row.snapshot) || {}; } catch { /* keep empty */ }
    items.push({ kind: 'quote', created: row.created, name: row.customer_email, destination: snap.destination || '', entryPoint: snap.kind === 'reel' ? 'reel itinerary' : 'package', travelers: snap.travelers });
  }
  items.sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  return items.map(i => ({ ...i, age: ageLabel(i.created, now) }));
}

export function buildDigest({ items, origin, now = new Date() }) {
  const link = `${String(origin || '').replace(/\/$/, '')}/admin.html#quotes`;
  const line = i => i.kind === 'callback'
    ? `• Callback: ${i.name}, ${i.phone} · ${i.age} · from ${i.entryPoint} · best time ${i.bestTime} · checklist ${i.checklist} complete`
    : `• Quote request: ${i.name}${i.destination ? ` · ${i.destination}` : ''}${i.travelers ? ` · ${i.travelers} travellers` : ''} · ${i.age} · ${i.entryPoint}`;
  const row = i => `<li>${esc(line(i).slice(2))}</li>`;
  const subject = `Friday quote queue: ${items.length} open (${now.toISOString().slice(0, 10)})`;
  const text = `Good morning.\n\n${items.length} open item${items.length === 1 ? '' : 's'}, oldest first:\n\n${items.map(line).join('\n')}\n\nOpen the quote queue: ${link}\n\nFriday`;
  const html = `<p>Good morning.</p><p>${items.length} open item${items.length === 1 ? '' : 's'}, oldest first:</p><ul>${items.map(row).join('')}</ul><p><a href="${esc(link)}">Open the quote queue</a></p><p>Friday</p>`;
  return { subject, text, html, link };
}

export function ensureDigestTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS quote_digest_runs(run_date TEXT NOT NULL,mode TEXT NOT NULL,requested_mode TEXT NOT NULL,started TEXT NOT NULL,finished TEXT,note TEXT NOT NULL DEFAULT '',callbacks INTEGER NOT NULL DEFAULT 0,quotes INTEGER NOT NULL DEFAULT 0,outcome TEXT NOT NULL DEFAULT '',PRIMARY KEY(run_date,mode));`);
}
export const listDigestRuns = (db, limit = 14) => { ensureDigestTables(db); return db.prepare('SELECT * FROM quote_digest_runs ORDER BY run_date DESC,started DESC LIMIT ?').all(Math.min(Math.max(Number(limit) || 14, 1), 60)); };

export async function runQuoteDigest({ db, store = defaultStore, emailService, origin, recipient, now = new Date(), mode = 'dry-run', manual = false, log = () => {} }) {
  if (mode === 'off') return { skipped: 'off' };
  ensureDigestTables(db);
  const runDate = now.toISOString().slice(0, 10);
  let effective = 'dry-run', note = '';
  if (mode === 'live') {
    const dryDays = db.prepare("SELECT COUNT(DISTINCT run_date) AS n FROM quote_digest_runs WHERE mode='dry-run' AND finished IS NOT NULL").get().n;
    if (dryDays < REQUIRED_DRY_RUN_DAYS) note = 'live_gated_until_3_dry_run_days';
    else if (!emailService?.configured) note = 'live_email_not_configured';
    else if (!EMAIL.test(recipient || '')) note = 'live_no_recipient';
    else effective = 'live';
  }
  if (note) log(`Quote digest: live mode held back (${note}); running as dry-run.`);
  if (manual && effective === 'dry-run') db.prepare("DELETE FROM quote_digest_runs WHERE run_date=? AND mode='dry-run'").run(runDate);
  const started = new Date().toISOString();
  if (db.prepare('INSERT OR IGNORE INTO quote_digest_runs(run_date,mode,requested_mode,started,note) VALUES(?,?,?,?,?)').run(runDate, effective, mode, started, note).changes !== 1) return { skipped: 'already_ran', runDate, mode: effective };
  const items = collectQueue({ db, store, now });
  const callbacks = items.filter(i => i.kind === 'callback').length, quotes = items.length - callbacks;
  let outcome = 'skipped_empty';
  try {
    if (items.length) {
      if (effective !== 'live') outcome = 'would_send';
      else {
        try {
          const digest = buildDigest({ items, origin, now });
          const sent = await emailService.send({ dedupeKey: `quote-digest:${runDate}`, kind: 'quote_queue_digest', to: recipient, subject: digest.subject, text: digest.text, html: digest.html });
          outcome = sent?.status === 'provider_accepted' ? 'sent' : 'failed';
        } catch (error) { log(`Quote digest failed: ${error.message}`); outcome = 'failed'; }
      }
    }
  } finally {
    db.prepare('UPDATE quote_digest_runs SET finished=?,callbacks=?,quotes=?,outcome=? WHERE run_date=? AND mode=?').run(new Date().toISOString(), callbacks, quotes, outcome, runDate, effective);
  }
  return { runDate, mode: effective, requestedMode: mode, note, callbacks, quotes, outcome };
}

/** Daily loop: catches up once on start if today's 09:30 IST has passed, then re-arms an unref'd timer. */
export function startQuoteDigestLoop({ sweep, log = console.log, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, stopped = false;
  const run = async () => {
    try { const result = await sweep(now()); log(`Quote digest: ${JSON.stringify(result)}`); }
    catch (error) { console.error(`[friday] Quote digest failed: ${error.message}`); }
  };
  const arm = () => {
    if (stopped) return;
    timer = setTimer(async () => { await run(); arm(); }, msUntilNextQuoteDigest(now()));
    timer?.unref?.();
  };
  if (pastTodaysQuoteDigest(now())) run().finally(arm); else arm();
  return { stop() { stopped = true; clearTimer(timer); } };
}
export { PREQUOTE_ITEMS };
