import { briefingEmail, prepareBriefing } from './briefing.mjs';

export const REQUIRED_DRY_RUN_DAYS = 3;
export const RUN_HOUR_UTC = 3, RUN_MINUTE_UTC = 30;   // 09:00 Asia/Kolkata (UTC+05:30, no DST)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function briefingAutosendMode(env = process.env) {
  const value = String(env.FRIDAY_BRIEFING_AUTOSEND ?? '').trim().toLowerCase();
  return value === 'off' || value === 'live' ? value : 'dry-run';
}

/** The next 03:30 UTC (09:00 IST) strictly after `now`. */
export function nextBriefingRunAt(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_HOUR_UTC, RUN_MINUTE_UTC));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
export const msUntilNextBriefingRun = (now = new Date()) => nextBriefingRunAt(now).getTime() - now.getTime();
export const pastTodaysBriefingRun = (now = new Date()) => now.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_HOUR_UTC, RUN_MINUTE_UTC);

export async function runBriefingSweep({ db, store, trips, emailService, origin, now = new Date(), mode = 'dry-run', manual = false, log = () => {} }) {
  if (mode === 'off') return { skipped: 'off' };
  const runDate = now.toISOString().slice(0, 10);
  let effective = 'dry-run', note = '';
  if (mode === 'live') {
    if (await store.countCompletedBriefingDryRunDays(db) < REQUIRED_DRY_RUN_DAYS) note = 'live_gated_until_3_dry_run_days';
    else if (!emailService?.configured) note = 'live_email_not_configured';
    else effective = 'live';
  }
  if (note) log(`Automatic briefings: live mode held back (${note}); running as dry-run.`);
  const started = new Date().toISOString();
  if (!await store.startBriefingRun(db, { runDate, mode: effective, requestedMode: mode, started, note, replace: manual && effective === 'dry-run' })) return { skipped: 'already_ran', runDate, mode: effective };
  const counts = { selected: 0, would_send: 0, sent: 0, skipped_already_sent: 0, skipped_no_email: 0, failed: 0 };
  const record = async (item, outcome) => { counts[outcome]++; await store.insertBriefingRunItem(db, { runDate, mode: effective, tripId: item.tripId, userId: item.userId, departureDate: item.departureDate, daysBefore: item.daysBefore, outcome, created: new Date().toISOString() }); };
  try {
    for (const owner of await store.listTripOwners(db)) {
      const bookingRows = await store.listRecords(db, owner.id, 'bookings');
      for (const row of await trips.list(owner.id)) {
        let tripData;
        try { tripData = JSON.parse(row.data); } catch { continue; }
        if (tripData.archived || tripData.claudeState?.archived) continue;
        const briefing = prepareBriefing({ tripId: row.id, tripData, bookingRows, recipient: owner.email, origin, now, source: 'auto' });
        if (!briefing.eligible) continue;
        counts.selected++;
        const item = { tripId: row.id, userId: owner.id, departureDate: briefing.departureDate, daysBefore: briefing.daysBeforeDeparture };
        if (!EMAIL.test(briefing.recipient)) { await record(item, 'skipped_no_email'); continue; }
        const dedupeKey = `briefing-auto:${row.id}:${briefing.departureDate}`;
        if (await store.getEmailOutboxByKey(db, dedupeKey) || await store.hasAcceptedAdminBriefing(db, row.id)) { await record(item, 'skipped_already_sent'); continue; }
        if (effective !== 'live') { await record(item, 'would_send'); continue; }
        try {
          const sent = await briefingEmail({ dedupeKey, briefing, emailService });
          await record(item, sent?.status === 'provider_accepted' ? 'sent' : 'failed');
        } catch (error) { log(`Automatic briefing failed for trip ${row.id}: ${error.message}`); await record(item, 'failed'); }
      }
    }
  } finally {
    await store.finishBriefingRun(db, { runDate, mode: effective, finished: new Date().toISOString(), counts });
  }
  return { runDate, mode: effective, requestedMode: mode, note, ...counts };
}

/** Daily loop: catches up once on start if today's 09:00 IST has passed, then re-arms an unref'd timer. */
export function startBriefingLoop({ sweep, log = console.log, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, stopped = false;
  const run = async () => {
    try { const result = await sweep(now()); log(`Automatic briefings: ${JSON.stringify(result)}`); }
    catch (error) { console.error(`[friday] Automatic briefing sweep failed: ${error.message}`); }
  };
  const arm = () => {
    if (stopped) return;
    timer = setTimer(async () => { await run(); arm(); }, msUntilNextBriefingRun(now()));
    timer?.unref?.();
  };
  if (pastTodaysBriefingRun(now())) run().finally(arm); else arm();
  return { stop() { stopped = true; clearTimer(timer); } };
}
