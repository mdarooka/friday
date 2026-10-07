# Friday booking-aware planning and quotes

Friday's authenticated workflow uses owner-scoped saved records and the published site catalog. It does not book travel or provide a live price or availability claim. Villas come from published team inventory; packages and compositions come from `build/data.js`.

## Reel to itinerary

Signed-in travelers can start **Plan from a reel** from the planner or saved social links. They provide a public reel URL, the exact place shown, its city and country, trip length, traveler count, and (optionally) a start date, pace, and caption. Friday checks the supplied post and researches candidate stops. Each itinerary stop carries its source URL and provenance so the traveler can inspect the evidence. Friday does not infer the exact venue from an ambiguous post: it asks the traveler to confirm the exact place and destination, and if the public reel cannot be read confidently it offers a clearly labeled plan based on the confirmed place. That fallback is never presented as verified reel content.

Reel itineraries are free planning drafts: they contain no cost estimates, fares, quotes, or availability claims. The traveler can review the sourced stops and caveats, edit day notes and instructions, remove stops, or reorder them. Changes must be saved before handoff. A quote request requires an explicit review confirmation; it freezes the exact draft version into an immutable owner-scoped handoff and quote-queue record. Friday's team then reviews it and prepares a separate human quote. The customer-facing handoff reports the recorded request and notification state; it does not claim that an email was delivered or that a quote is ready.

AI provider credentials are required for reel research. If research is unavailable, generation fails safely with a retry message; the customer may still save the reel link and note through the existing social import flow. `QUOTE_ADMIN_EMAILS` controls access to the human quote queue, and `FRIDAY_ENQUIRY_EMAIL` is the server-side recipient for Friday team notifications. Neither setting is exposed in the site UI. Email delivery requires Hexclave Emails configuration described below. Browser drafts already present are left untouched and are not migrated.

The first booking context is limited to future or ongoing records. A booking can anchor the conversation only when its actual travel date has explicit provenance (`dateStatus: "confirmed"`, `dateProvenance: "booking-date"`, or `dateSource: "extractor"`). Legacy Gmail imports use the email timestamp for sorting and do not qualify as travel dates. Friday asks the traveler to select a booking and separately confirm exact travel dates. The user can set `scope: "all"` to include past bookings.

Friday asks for destination, exact start and end dates, traveler count, a budget or an explicit flexible-budget answer, and selected listing IDs before saving a draft. The optional AI editor can remove published sample segments by catalog index. It cannot create listings, prices, supplier commitments, dates, or inclusions. Other requested changes stay labeled as customization requests for the travel designer.

## Customer API

- `POST /api/friday/plan` accepts `{tripId?, message, scope?, answers?, draftId?, draftVersion?}` and returns `{text, questions, listings, draft?}`. Sign-in is required. `answers` may include `destination`, `startDate`, `endDate`, numeric `travelers`, `budget` or `flexibleBudget: true`, explicit `listingIds`, explicit `bookingIds`, and `instructions`. When Friday asks a package edit clarification that cannot be represented safely, the traveler can choose human review by sending `designerReview: true`; Friday preserves the request and sample for the team without applying a change. The complete destination, dates, travelers, budget choice, and listing selection are still required before draft handoff.
- `GET /api/friday/drafts` lists only the signed-in owner's drafts.
- `POST /api/friday/handoffs` accepts `{draftId, version, confirmed: true}`. The response contains the immutable reviewed snapshot. Repeating the same handoff returns the existing queue item.
- `GET /api/friday/handoffs` lists the signed-in owner's handoffs.
- `GET /api/friday/status` returns `{quoteAdmin, emailConfigured}` for the signed-in user.

Browser drafts are not imported or changed by this workflow.

Reel API details are deliberately separate from the package planner:

- `POST /api/friday/reels` accepts `{url, placeName, destination, days, startDate?, travelers, pace, caption?, destinationConfirmed: true, allowUnverifiedReel?: true}`. It returns `{draft, evidence}` only after every requested day has at least one stop with a citation matching a returned research source, the exact confirmed place appears as a stop, and the result contains no price information. An unreadable or mismatched reel returns `{needsConfirmation, evidence, questions}` without saving; only a second request with `allowUnverifiedReel: true` may proceed, and its source status is labeled `user_attested_only`.
- `PATCH /api/friday/reels/:id` saves edits using the current `version`. It accepts existing day/stop IDs, notes, instructions, traveler count, and start date. The server only permits reordering/removing the generated days and stops; newly requested places must first be researched and verified.
- `GET /api/friday/drafts` includes reel drafts for their owner. `POST /api/friday/handoffs` accepts `{draftId, version, confirmed: true}` and queues an immutable snapshot of the reviewed reel draft. This reel handoff does not require a budget or package listing. The same handoff endpoint also serves the older package workflow described above.

For a deterministic local browser walkthrough, run `node tests/reel-browser-fixture-server.mjs` and open `http://127.0.0.1:4876/app.html`. Use the synthetic place **QA Garden · Synthetic** in **Kyoto, Japan**. The fixture uses a temporary database and synthetic sources; a reel URL whose path contains `/unavailable` exercises the explicit confirmation path. It has no mail credentials and cannot send email.

## Human quote queue

Set `QUOTE_ADMIN_EMAILS` to the normalized email addresses of authorized staff. `GET /api/admin/quotes` returns the queue only to those accounts. `POST /api/admin/quotes/:id/preview` accepts `{amount, currency, details}` and returns the exact `{to, subject, text, previewHash}`. Send that reviewed preview with the same quote fields and `previewHash` to `POST /api/admin/quotes/:id/send`.

Configure `HEXCLAVE_PROJECT_ID` and the server-only `HEXCLAVE_SECRET_SERVER_KEY` to enable delivery through Hexclave Emails. The server records the quote and queues the email in its durable outbox before sending. A successful provider response is labeled `provider_accepted`; it does not claim mailbox delivery. If the result is uncertain, the request becomes `delivery_unknown` and is never automatically retried. Reconcile the provider request before taking further action.

## Morning quote-queue digest

`server/quote-digest.mjs` emails the designer a daily digest at 09:30 Asia/Kolkata (04:00 UTC) listing open callbacks (status not `done`) and pending quote requests, oldest first, with age, entry point, best time to call, pre-quote checklist progress ("checklist 3/5 complete") and a link to the admin quote queue. It is skipped when nothing is open. Recipient: `QUOTE_DIGEST_EMAIL`, else the first `QUOTE_ADMIN_EMAILS` entry, else `FRIDAY_ENQUIRY_EMAIL`. `FRIDAY_QUOTE_DIGEST` is `off`, `dry-run` (default) or `live`; live is held back until three completed dry-run days and while email or a recipient is missing. One run row per day (`quote_digest_runs`: counts and outcome only, no addresses, phones or bodies) plus outbox key `quote-digest:<date>` keep it once-per-day. Staff-only email includes phone numbers; they are never logged. Hosts that scale to zero can `POST /api/cron/quote-digest` with `Authorization: Bearer $FRIDAY_CRON_SECRET`.

## Pre-quote checklist

After "Call me back" succeeds (planner modal or contact page), `assets/js/trip-prequote.js` offers an optional five-item checklist. The items are provisional and live in one constant, `PREQUOTE_ITEMS` in `server/prequote-checklist.mjs`; replace them with questions from real stalled quotes. `POST /api/callbacks` now also returns a one-time `checklistToken`; `PUT /api/callbacks/:id/checklist` with `{checklistToken, answers: {itemId: {done, text}}}` saves answers (token required, plus the same signed-in user if the callback was made signed in). `GET /api/callbacks/checklist-items` lists the items. `GET /api/admin/quotes` adds `checklist {items, answers, done, total}` to callback rows. The callback is never blocked on it.
