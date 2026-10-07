# Friday feature and integration status

This inventory separates implemented behavior from service connections that still require credentials.

| Area | Current status | Requirements or limits |
| --- | --- | --- |
| Accounts and private data | Implemented with Hexclave configured | Hexclave verifies each API session; local travel records are mapped by Hexclave user ID and every read/write is scoped to that owner. Local browser drafts are left untouched. A legacy Friday account links only after the user proves its existing password. |
| Post-signup location | Implemented | The app asks for a home city, then suggests nearby airports. The user can remove airports and save the selection. |
| Travel records | Implemented | Journeys, places, lists, bookings, memories, alerts, profile details, and enquiries persist in SQLite. |
| Journey archive and restore | Implemented | Archive status is stored on the owner's journey record and can be changed back at any time. |
| Read-only trip links | Implemented | The owner explicitly creates a link; it expires after 30 days and can be revoked. Anyone holding a live link can view the sanitized destination and itinerary, plus a collapsible read-only map of stops that have coordinates (numbered per day, filter by day, tap a pin to jump to the stop; no provider or key, omitted when no stop has coordinates). |
| AI travel research | Implemented when configured | Claude or Perplexity credentials and a model are required. Deep is the default mode. |
| Google place search and detail | Implemented when configured | Authenticated lookup routes require a server-side Google Places API key; results carry Google Maps attribution. Place photos use signed, short-lived server routes. See `docs/google-places.md`. |
| Research places and itineraries | Implemented when configured | Suggested places persist with the response; itinerary changes remain a draft until applied. |
| Airport coverage | Partial | Suggestions use a curated list of 34 metro areas. Unknown cities do not receive guessed airports. |
| Gmail and Calendar | Implemented when configured | Read-only OAuth connection and user-initiated imports require Google credentials; imports are owner-scoped and deduplicated. `/api/capabilities` indicates server setup, while `/api/integrations/google/status` reports this user's connections. Setup is in `docs/google-setup.md`. |
| Fare watches | On-demand advisory implemented; supplier polling pending | `/api/alerts/check` returns a cited AI research advisory with a checked-at time. It does not verify live inventory, match a threshold, run in the background, or send a notification. Supplier pricing feeds are still needed for true fare alerts. |
| Social extraction | Implemented when AI credentials are configured | Supports allowlisted HTTPS social post URLs and requires matching citations for the exact post. Suggestions are returned to the app and are saved only after user action. |
| Newsletter delivery | Confirmation implemented when Hexclave Emails is configured | Signups persist locally and receive a transactional confirmation when `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY` are configured. Newsletter campaigns are not implemented. |
| Commission and quote email delivery | Implemented when Hexclave Emails is configured | Commission enquiries persist locally; the submitter receives a receipt, and the team receives a notification when `FRIDAY_ENQUIRY_EMAIL` is configured. Reviewed travel quotes are sent by authorized staff through the quote queue. Email uses the Hexclave outbox and requires `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY`; accepted or uncertain sends are not automatically retried. |
| Email verification and password reset | Implemented with Hexclave configured | Hexclave sends verification and password-reset messages. Unverified or otherwise restricted users cannot access private planner records. Real delivery requires a configured Hexclave email server and the project’s verification requirement. |

## Automatic pre-departure briefings

Friday can send the existing T-7 pre-departure briefing automatically each day at 09:00 Asia/Kolkata (03:30 UTC). Set `FRIDAY_BRIEFING_AUTOSEND` to `off`, `dry-run` (default when unset), or `live`. Dry-run sends nothing and records what would be sent in `briefing_runs` and `briefing_run_items` (no addresses or email bodies). `live` is held back, running as a dry-run, until three distinct dry-run days have completed. Each trip and departure date is sent at most once (`briefing-auto:<tripId>:<departureDate>`), and trips an admin already briefed are skipped. Auto links carry `src=auto` and admin sends `src=admin`. Admins see recent runs under Trip Briefings and can trigger a dry run with `POST /api/admin/briefings/run-now?dry=1`.

Because production can scale to zero and sleep through 09:00, also point an external scheduler (a Hexclave scheduled workflow, a GitHub Actions cron, or cron-job.org) at `POST /api/cron/briefings` at 03:30 UTC with `Authorization: Bearer <FRIDAY_CRON_SECRET>`. The endpoint needs no session or Origin, uses the configured mode, and is idempotent per day (repeat calls return `skipped: already_ran`).
`FRIDAY_CRON_SECRET` must be at least 32 characters; when unset or shorter the endpoint returns 404. The in-process timer remains as a fallback.

## Friends' reactions and comments on shared plans

Friends who open a read-only share link can react to each stop (Yes, Love it, Not sure; one reaction per stop, tapping again removes it) and leave short plain-text comments (up to 280 characters), with an optional display name and no account. This is not co-editing: the plan itself stays read-only. Viewers are anonymous: the browser keeps a random id in `localStorage` and the server stores only a per-trip hash of it.

- Feedback is stored in `trip_feedback`, keyed to the owner and trip (not the link token), so it survives link rotation. Writes are accepted only through a currently valid, unexpired link; the owner and trip are resolved from the share row. Deleting the trip deletes its feedback.
- A stop is identified by `d<day>s<index>-<hash of its normalised title>`. A renamed or moved stop gets a new key; comments left on the old key are then shown to the owner only, under "Stops no longer in the plan".
- Endpoints: `GET/POST /api/shared/:token/feedback`, `DELETE /api/shared/:token/feedback/:id` (viewer header `X-Friday-Viewer`); owner side `GET /api/trips/:id/feedback`, `POST` (hide or show, `{hidden}`) and `DELETE /api/trips/:id/feedback/:commentId`. The owner sees it in the Share menu under "Friends' feedback".
- Caps: 50 comments per viewer per trip, 1000 items per trip. Rate limits (provisional, pending production data; see `server/feedback.mjs`): 20 writes/min/IP, 60 writes/min/link.

## Guide feedback ("Was this useful?")

Public guides carry a small prompt: Yes / Not really, then an optional note of up to 280 characters. No account is needed. Add it to any guide with one line in its build source: `${guideFeedback('<slug>')}` (from `build/guide-feedback.js`; the slug is lowercase letters, digits and hyphens). It currently appears on the Kerala guide.

- Storage: `guide_feedback` (slug, vote, note, created, updated), one row per viewer per guide. The browser keeps a random id in `localStorage` and the server stores only a per-guide SHA-256 hash of it. Changing the vote updates the row; the note is kept only if the vote is unchanged and no new note is sent.
- Endpoint: `POST /api/guide-feedback` with `{slug, vote: "yes"|"no", note?}` and header `X-Friday-Viewer`. Same-origin JSON only; 10 writes/min/IP (provisional); at most 50 distinct guide slugs are accepted.
- Weekly digest to the team inbox (`FRIDAY_ENQUIRY_EMAIL`), Mondays 09:00 Asia/Kolkata (03:30 UTC): per-guide yes/no counts and recent notes for the past 7 days. A guide with fewer than 20 votes is labelled "too few responses to read much into yet". Weeks with no votes send nothing. `FRIDAY_GUIDE_DIGEST` is `off`, `dry-run` (default when unset) or `live`; live falls back to dry-run if email or the team inbox is not configured. Runs are logged in `guide_digest_runs`, once per week. For scale-to-zero hosts, `POST /api/cron/guide-feedback-digest` with `Authorization: Bearer <FRIDAY_CRON_SECRET>` (same secret as the briefing cron) triggers it idempotently.
- Analytics: `guide_feedback_voted` and `guide_feedback_note` go through `FridayAnalytics` when it is loaded. Not shown in the admin console yet.

## Morning quote-queue digest and pre-quote checklist

A daily 09:30 IST email lists open callbacks and pending quote requests for the designer (`FRIDAY_QUOTE_DIGEST=off|dry-run|live`, default dry-run). After "Call me back", customers can optionally answer a five-item checklist (provisional wording, edit `PREQUOTE_ITEMS`), shown in the admin quote queue and the digest. See `docs/friday-workflow.md`.

## Booking confidence strip

Each booking row in the planner shows where it came from (Imported, Added by you, or Verified by your designer) and an "Ask designer about this" link that opens the existing Call me back form with the booking as its topic (stored in `callback_requests.topic`, shown in the admin queue).

- Provenance is derived from existing fields (`source` / `externalId` mean Imported). Verification is stored server-side as `data.verification = { verifiedAt, verifiedBy }` on the booking record.
- `POST /api/admin/bookings/:id/verify` with `{ verified: boolean }` is limited to explicitly configured quote or general admins, and only reaches bookings the traveller attached to a quote request. Owner writes never set it; it clears if the booking's title, dates, reference or type change.
- Admins mark bookings from the quote drawer in the admin console (Quote Delivery tab).
