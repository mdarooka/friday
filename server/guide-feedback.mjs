import { createHash } from 'node:crypto';
import { cleanText, validViewerId } from './feedback.mjs';
/* Anonymous "Was this useful?" votes on public guides, plus a weekly team digest.
   Privacy mirrors server/feedback.mjs: the browser keeps a random id in localStorage and only a per-guide hash is stored. */

/* PROVISIONAL limits: chosen without production data. */
export const GUIDE_VOTES_PER_IP_PER_MIN = 10;
export const MAX_NOTE_CHARS = 280;
export const MAX_GUIDES = 50;                    // distinct slugs accepted, so junk slugs cannot grow the table without bound
export const VOTES = Object.freeze(['yes', 'no']);
export const LOW_VOLUME_VOTES = 20;              // fewer votes than this in a week: label the result as too thin to read
export const DIGEST_RUN_HOUR_UTC = 3, DIGEST_RUN_MINUTE_UTC = 30;   // Monday 09:00 Asia/Kolkata (UTC+05:30)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEEK_MS = 7 * 86400000;

export const validSlug = v => typeof v === 'string' && v.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
export const guideViewerHash = (slug, viewerId) => createHash('sha256').update(`guide-viewer:${slug}:${viewerId}`).digest('hex');
export { validViewerId };

const failWith = (status, message) => { throw Object.assign(new Error(message), { status }); };

/* One vote per viewer per guide. Re-voting updates it; the note is kept only if the vote is unchanged and none is sent. */
export async function recordVote(db, { slug, viewerId, vote, note, now = new Date() }) {
  if (!validSlug(slug)) failWith(422, 'This guide could not be found.');
  if (!validViewerId(viewerId)) failWith(400, 'A viewer id is required.');
  if (!VOTES.includes(vote)) failWith(422, 'Choose Yes or Not really.');
  let clean = null;
  if (note !== undefined && note !== null && note !== '') {
    if (typeof note !== 'string') failWith(422, 'Notes are plain text.');
    clean = cleanText(note, MAX_NOTE_CHARS + 1, { multiline: true });
    if (clean.length > MAX_NOTE_CHARS) failWith(422, `Notes can be up to ${MAX_NOTE_CHARS} characters.`);
  }
  const vHash = guideViewerHash(slug, viewerId), iso = now.toISOString();
  const existing = await db.one('SELECT vote,note FROM guide_feedback WHERE slug=$1 AND viewer_hash=$2', [slug, vHash]);
  if (existing) {
    const keep = clean === null && existing.vote === vote ? existing.note : (clean ?? '');
    await db.query('UPDATE guide_feedback SET vote=$1,note=$2,updated=$3 WHERE slug=$4 AND viewer_hash=$5', [vote, keep, iso, slug, vHash]);
    return { vote, updated: true };
  }
  if (!await db.one('SELECT 1 AS x FROM guide_feedback WHERE slug=$1 LIMIT 1', [slug]) && (await db.one('SELECT count(DISTINCT slug) AS n FROM guide_feedback')).n >= MAX_GUIDES) failWith(422, 'This guide could not be found.');
  // Two simultaneous first votes from one viewer collapse into one row; the later one updates it.
  const inserted = (await db.query('INSERT INTO guide_feedback(slug,viewer_hash,vote,note,created,updated) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(slug,viewer_hash) DO NOTHING', [slug, vHash, vote, clean ?? '', iso, iso])).rowCount === 1;
  if (!inserted) await db.query('UPDATE guide_feedback SET vote=$1,note=$2,updated=$3 WHERE slug=$4 AND viewer_hash=$5', [vote, clean ?? '', iso, slug, vHash]);
  return { vote, updated: !inserted };
}

/* Per-guide yes/no counts and recent notes for votes last touched in the 7 days before `now`. Never returns viewer hashes. */
export async function weeklySummary(db, now = new Date(), { maxNotes = 8 } = {}) {
  const since = new Date(now.getTime() - WEEK_MS).toISOString(), until = now.toISOString();
  const rows = await db.all('SELECT slug,vote,note,updated FROM guide_feedback WHERE updated>$1 AND updated<=$2 ORDER BY updated DESC', [since, until]);
  const guides = new Map();
  for (const r of rows) {
    const g = guides.get(r.slug) || { slug: r.slug, yes: 0, no: 0, total: 0, notes: [] };
    g[r.vote]++; g.total++;
    if (r.note && g.notes.length < maxNotes) g.notes.push({ vote: r.vote, text: r.note, updated: r.updated });
    guides.set(r.slug, g);
  }
  const list = [...guides.values()].sort((a, b) => a.slug.localeCompare(b.slug)).map(g => ({ ...g, lowVolume: g.total < LOW_VOLUME_VOTES }));
  return { since, until, total: rows.length, guides: list };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const titleOf = slug => slug.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
const LOW_LABEL = `too few responses to read much into yet (fewer than ${LOW_VOLUME_VOTES})`;

export function digestEmail(summary, { origin = '' } = {}) {
  const day = iso => iso.slice(0, 10);
  const subject = `Friday guide feedback: ${summary.total} response${summary.total === 1 ? '' : 's'} (${day(summary.since)} to ${day(summary.until)})`;
  const textLines = [`Guide feedback for ${day(summary.since)} to ${day(summary.until)}`, ''];
  const htmlParts = [`<h2 style="font-family:Georgia,serif;font-weight:400">Guide feedback</h2><p>${esc(day(summary.since))} to ${esc(day(summary.until))}</p>`];
  for (const g of summary.guides) {
    const head = `${titleOf(g.slug)}: ${g.yes} yes, ${g.no} not really (${g.total} total)`;
    textLines.push(head); if (g.lowVolume) textLines.push(`  Low volume: ${LOW_LABEL}.`);
    htmlParts.push(`<h3 style="margin-bottom:4px">${esc(titleOf(g.slug))}</h3><p style="margin:0">${g.yes} yes, ${g.no} not really (${g.total} total)</p>${g.lowVolume ? `<p style="margin:4px 0;color:#8a6d3b"><em>Low volume: ${esc(LOW_LABEL)}.</em></p>` : ''}`);
    if (g.notes.length) {
      textLines.push('  Recent notes:'); g.notes.forEach(n => textLines.push(`  - [${n.vote === 'yes' ? 'yes' : 'not really'}] ${n.text.replace(/\s+/g, ' ')}`));
      htmlParts.push(`<ul>${g.notes.map(n => `<li>[${n.vote === 'yes' ? 'yes' : 'not really'}] ${esc(n.text)}</li>`).join('')}</ul>`);
    }
    textLines.push('');
  }
  if (origin) textLines.push(origin);
  return { subject, text: textLines.join('\n').trim(), html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#15140F">${htmlParts.join('')}</div>` };
}

export function guideDigestMode(env = process.env) {
  const v = String(env.FRIDAY_GUIDE_DIGEST ?? '').trim().toLowerCase();
  return v === 'off' || v === 'live' ? v : 'dry-run';
}

/* The next Monday 03:30 UTC (09:00 IST) strictly after `now`. */
export function nextDigestRunAt(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DIGEST_RUN_HOUR_UTC, DIGEST_RUN_MINUTE_UTC));
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7));   // forward to Monday (0 days if already Monday)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}
export const msUntilNextDigestRun = (now = new Date()) => nextDigestRunAt(now).getTime() - now.getTime();
/* True when this week's Monday run time has already passed (for catch-up on start). */
export function pastThisWeeksDigestRun(now = new Date()) {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DIGEST_RUN_HOUR_UTC, DIGEST_RUN_MINUTE_UTC));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return now.getTime() >= monday.getTime();
}
const mondayOf = now => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

/* One run per week (keyed on that week's Monday) and mode. Live sends to the team inbox only if email is configured; otherwise it runs as a dry-run. */
export async function runGuideDigest({ db, emailService, inbox = '', origin = '', now = new Date(), mode = 'dry-run', manual = false, log = () => {} }) {
  if (mode === 'off') return { skipped: 'off' };
  const runDate = mondayOf(now);
  let effective = 'dry-run', note = '';
  if (mode === 'live') {
    if (!emailService?.configured) note = 'live_email_not_configured';
    else if (!EMAIL.test(inbox)) note = 'live_no_team_inbox';
    else effective = 'live';
  }
  if (note) log(`Guide feedback digest: live mode held back (${note}); running as dry-run.`);
  if (manual && effective === 'dry-run') await db.query("DELETE FROM guide_digest_runs WHERE run_date=$1 AND mode='dry-run'", [runDate]);
  const started = new Date().toISOString();
  if ((await db.query('INSERT INTO guide_digest_runs(run_date,mode,requested_mode,started,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [runDate, effective, mode, started, note])).rowCount !== 1) return { skipped: 'already_ran', runDate, mode: effective };
  let outcome = 'failed', summary = { total: 0 };
  try {
    summary = await weeklySummary(db, now);
    if (!summary.total) outcome = 'no_votes';
    else if (effective !== 'live') { outcome = 'would_send'; log(`Guide feedback digest (dry-run): ${digestEmail(summary, { origin }).subject}`); }
    else {
      const mail = digestEmail(summary, { origin });
      const sent = await emailService.send({ dedupeKey: `guide-digest:${runDate}`, kind: 'guide_feedback_digest', to: inbox.trim().toLowerCase(), subject: mail.subject, text: mail.text, html: mail.html });
      outcome = sent?.status === 'provider_accepted' ? 'sent' : 'failed';
    }
  } catch (error) { log(`Guide feedback digest failed: ${error.message}`); }
  finally { await db.query('UPDATE guide_digest_runs SET finished=$1,votes=$2,outcome=$3 WHERE run_date=$4 AND mode=$5', [new Date().toISOString(), summary.total, outcome, runDate, effective]); }
  return { runDate, mode: effective, requestedMode: mode, note, votes: summary.total, outcome };
}

/** Weekly loop: catches up once on start if this week's Monday run time has passed, then re-arms an unref'd timer. */
export function startGuideDigestLoop({ sweep, log = console.log, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, stopped = false;
  const run = async () => {
    try { log(`Guide feedback digest: ${JSON.stringify(await sweep(now()))}`); }
    catch (error) { console.error(`[friday] Guide feedback digest failed: ${error.message}`); }
  };
  const arm = () => {
    if (stopped) return;
    timer = setTimer(async () => { await run(); arm(); }, msUntilNextDigestRun(now()));
    timer?.unref?.();
  };
  if (pastThisWeeksDigestRun(now())) run().finally(arm); else arm();
  return { stop() { stopped = true; clearTimer(timer); } };
}
