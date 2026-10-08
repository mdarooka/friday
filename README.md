# Friday

Friday is a travel design website with a private travel planning app. The public pages remain static generated HTML; sign-in, saved planning records, and AI research run through the Node server.

## Run locally

Use Node.js 24 or newer. Copy `.env.example` to `.env`, optionally configure an AI provider, then run:

```sh
npm run dev
```

Open <http://localhost:4871>. `npm start` starts the same application for deployment. Locally the app uses PGlite, an in-process PostgreSQL, stored under `.data/pglite` (never served publicly; delete it to reset). In production the app needs a real PostgreSQL server: set `DATABASE_URL`, or `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` and `DATABASE_NAME`. With `NODE_ENV=production` and none of these set, the server refuses to start rather than falling back to PGlite. The first connection retries with a bounded backoff (about 60 s) because a scaled-to-zero database may be waking up. Serve the app behind HTTPS and set `APP_ORIGIN` to its exact public origin. Set `HOST` and `PORT` for the hosting environment.

## Production deployment

Hexclave provides Friday's sign-in and transactional email. Friday can run on Hexclave Deploy as a Node server, with all application data in a PostgreSQL server that runs as a separate private service; this is separate from the Hexclave project configuration in `hexclave.config.ts`.

### Hexclave Deploy

`hexclave.deploy.ts` defines two services. `web` is the public server built from the repository's Dockerfile; it listens on port 3000, runs as the non-root `node` user and keeps **no data on its own disk**. `database` is a private PostgreSQL 17 server built from `database/Dockerfile`, reachable only from services in the same project over TCP port 5432 (`minInstances: 0`, so it scales to zero and wakes on the first connection). Its data directory is `/data/postgres` on a 1 GB persistent volume (`pgdata`; disks can be grown later but never shrunk). `web` finds it through `DATABASE_HOST` (the `database` service hostname), `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME` and `DATABASE_PASSWORD`.

**The database disk is a single volume on a single machine. It is not replicated and it is not a backup; a host failure can lose it.** A nightly encrypted off-site backup runs from GitHub Actions (see [Nightly database backup](#nightly-database-backup)); it is inactive until its secrets are set.

**One-time secret:** set the `POSTGRES_PASSWORD` project secret in the Hexclave dashboard (Project Settings → Secrets) before the first deploy. Both services read it; the deploy has no default for it.

**Migration note:** this change removes the persistent volume `friday_data` from `web`. Removing a volume detaches the disk without deleting it, so the old disk (and its SQLite file) is kept and **keeps billing until you delete it in the dashboard**. Nothing is migrated automatically: the new PostgreSQL database starts empty.

Before the first deploy:

1. Turn on the Deploy app in the Hexclave dashboard and set the `POSTGRES_PASSWORD` secret (see above). Both services use `minInstances: 0`, so they suspend when idle (the database keeps its disk) and resume on the next request; an always-running server (`minInstances: 1`) needs a paid plan. Do not push `hexclave.config.ts` as part of this step.
2. `APP_ORIGIN`, `FRIDAY_ENQUIRY_EMAIL`, and `QUOTE_ADMIN_EMAILS` are set directly in `hexclave.deploy.ts`; update them there when the domain or inbox changes. Set the optional `FRIDAY_WHATSAPP_NUMBER` secret under Project Settings → Secrets to Friday’s international WhatsApp number (country code and number, for example `+919876543210`). The planner exposes only a validated public phone number for its click-to-chat link; leave it empty to hide that option. The optional `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, and `GOOGLE_PLACES_API_KEY` default to empty and keep those integrations off until configured. For Gmail/Calendar, set the Google client ID, client secret, and a 64-character hexadecimal `GOOGLE_TOKEN_KEY` together. Deploy supplies `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY` itself; without a valid enquiry inbox, enquiries are saved but the team notification is not sent.
Vercel (`vercel.json`, project `friday-travel`) is only a reverse proxy: it serves `https://fridaytravel.vercel.app` by rewriting every path to the Hexclave Deploy origin, so all data stays in the project's PostgreSQL service. `APP_ORIGIN` is the public proxy origin, because browsers send `Origin: https://fridaytravel.vercel.app` on API writes. `APP_ORIGIN_ALIASES` explicitly lists the direct Deploy origin for browser sessions opened on that host; the server accepts only those exact configured origins for writes and never trusts arbitrary request hosts.
`https://fridaytravel.vercel.app` is Friday's canonical public origin. The Vercel proxy redirects other project hosts to it; the server also redirects direct Deploy page requests while retaining its internal API access. Public pages have canonical metadata and private pages are excluded from indexing.
3. To move to your own domain, attach and verify it on the public `web` service, set its exact HTTPS origin as `APP_ORIGIN` in `hexclave.deploy.ts`, and update `build/site-metadata.js` and `vercel.json`.
4. From the repository root, run `npx @hexclave/cli@latest deploy --cloud-project-id 38c9a741-73e3-4e6a-9c1b-6438f1239457`.

The Deploy app is in alpha, and its service region is not confirmed here (it may not be in India). Backups go to 30-day GitHub Actions artifacts, encrypted before upload (see below); copy them elsewhere if you need longer retention. Disk size can only be grown, not reduced.

After the first deployment, write a test record, restart and redeploy the service, and confirm that the record remains. Take a `pg_dump` and test restoring it into a scratch database before storing important data. The public `/api/health` endpoint is available, and the Dockerfile includes a health check for it.

### Nightly database backup

Hexclave Deploy has no cron, so `.github/workflows/db-backup.yml` runs daily at 02:00 IST. It calls `GET /api/cron/db-backup` on `https://fridaytravel.vercel.app` (the web image bundles the PostgreSQL 17 `pg_dump`), encrypts the dump with AES-256 on the runner, and uploads only the `.dump.enc` file as an artifact kept for 30 days. The repository is public, so nothing but ciphertext is ever stored or logged.

One-time setup:

1. Generate two values with `openssl rand -base64 48`.
2. Set the first as `FRIDAY_BACKUP_SECRET` both as a Hexclave project secret and as a GitHub Actions secret.
3. Set the second as `BACKUP_PASSPHRASE` only as a GitHub Actions secret, and keep a copy offline. If it is lost, backups cannot be read.
4. Redeploy Hexclave so the new image and secret go live.

No backups are taken until the secrets are set and the new image is deployed. Run one by hand from Actions → Nightly database backup → Run workflow. GitHub disables scheduled workflows after 60 days without repository activity, so check the Actions tab occasionally.

Restore (needs a PostgreSQL 17 client):

```sh
gh run download <run-id> -n friday-db-backup
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in friday-YYYY-MM-DD.dump.enc -out friday.dump
pg_restore --clean --if-exists --no-owner -d <database-url> friday.dump
```

Restore into a scratch database first, and delete `friday.dump` afterwards because it is unencrypted.

#### Weekly restore check

`.github/workflows/backup-restore-check.yml` runs every Monday at 06:00 UTC (and on Run workflow). It checks that the newest nightly backup is less than 36 hours old, downloads and decrypts it, restores it into a scratch PostgreSQL 17 container, counts rows in the core tables (`users` must not be empty), and writes the timing and counts to the run's summary. The scratch container is removed afterwards.

It fails, and so emails the person who last changed the schedule (GitHub's failure notice), when the backup is missing or stale, the decrypt fails, or the restore or a table check fails. The nightly backup fails the same way. For a faster alert, set `BACKUP_ALERT_WEBHOOK_URL` (optional) to an incoming-webhook URL from Slack, Discord or any service that accepts a JSON POST with `text` or `content`; both workflows post to it on failure and skip it when it is unset.

Secrets used by the two workflows (Settings → Secrets and variables → Actions):

- `FRIDAY_BACKUP_SECRET` and `BACKUP_PASSPHRASE`: the nightly backup needs both; the restore check needs `BACKUP_PASSPHRASE`.
- `BACKUP_ALERT_WEBHOOK_URL`: optional.

**First manual restore test (do this once, before you rely on backups):**

1. Make sure a nightly backup exists: Actions → Nightly database backup → Run workflow, and wait for it to pass.
2. Actions → Weekly backup restore check → Run workflow. Open the run; the summary shows "Restore test: OK" with the row counts. If it says FAILED, the summary lists what is wrong.
3. To restore by hand (for example into a database you control), use the commands in the section above with `BACKUP_PASSPHRASE` set in your shell, and never into the live database.

The check itself is `scripts/backup-restore-check.mjs`, covered by `tests/backup-restore-check.test.mjs`. Its table list is `REQUIRED_TABLES` in that file; update it when the schema changes.

### Self-managed Docker deployment

For a separate Linux Docker host, copy `.env.example` to `.env`, choose `APP_DOMAIN`, set `APP_ORIGIN` to its exact HTTPS origin, and configure the required secrets. The Compose file runs Caddy for HTTPS, runs a `postgres` service with a named Docker volume (`friday-postgres`) and points the app at it. Set `POSTGRES_PASSWORD` in `.env` first; Compose refuses to start without it. On a public host, point DNS at the host and allow inbound ports 80 and 443. Keep `.env` and database dumps out of public storage.

Start the Compose deployment from the repository root:

```sh
docker compose -f deploy/compose.yml up -d --build
```

`npm run dev` runs the Hexclave CLI wrapper, which supplies local project keys to the development server. Hexclave's shared mail server is for development; configure a production email sender in the project before launch.

Create a database dump while Friday is running (the Docker volume alone is not an off-site backup; encrypt the dump and move it to a separate, access-controlled destination with a retention schedule):

```sh
docker compose -f deploy/compose.yml exec -T postgres pg_dump -U friday -d friday --format=custom > friday-$(date +%F).dump
```

Restore a dump into the running database with `pg_restore` (stop `friday` first, and restore into an empty database or use `--clean --if-exists`):

```sh
docker compose -f deploy/compose.yml stop friday
docker compose -f deploy/compose.yml exec -T postgres pg_restore -U friday -d friday --clean --if-exists < friday-DATE.dump
docker compose -f deploy/compose.yml up -d friday
```

The production host and DNS name still need to be selected before a live deployment can be completed. Team notification recipients are configured only through server environment variables and are never shown on the site.

## AI research configuration

Deep is the default research mode. All user-facing research, reel import and itinerary generation use the Claude API (Anthropic); Set the server-only `ANTHROPIC_API_KEY`; `AI_MODEL` defaults to `claude-sonnet-5-5`. Optionally set `AI_DEEP_MODEL` (a stronger model for Deep research) and `AI_EFFORT` (`low`, `medium`, `high`, `xhigh` or `max`). Web search uses Claude's own `web_search` tool. Without the key, research and reel import are unavailable (the planner hides reel paste) and existing saved itineraries remain accessible.

## Feature status

| Feature | Status |
| --- | --- |
| Accounts, sign-in, owner-scoped records, saved journeys, places, lists, bookings, memories, alerts, profile and airport selections | Implemented locally |
| Research chat, Deep research jobs and proposed itinerary drafts | Implemented when AI provider credentials are configured |
| Google Places search, detail and attributed photos | Implemented when `GOOGLE_PLACES_API_KEY` is configured |
| Public villa discovery, team-owned listings, owner submissions and nearby planning | Implemented; Google nearby results require Places API credentials, AI curation uses the configured research provider when available |
| Curated nearby-airport suggestions | Implemented for 34 metro areas; users can remove suggested airports |
| Archive and restore journeys | Implemented as an account-owned journey setting |
| Read-only journey links | Implemented on explicit request; links expire after 30 days and can be revoked |
| Commission enquiries and newsletter signup | Stored in PostgreSQL; confirmation/notification emails use Hexclave when configured; newsletter campaigns are not implemented |
| Gmail and Calendar read-only imports | Implemented when Google OAuth credentials are configured; user initiates each connection and sync |
| Booking-aware Friday drafts and human quote queue | Implemented; owner-scoped booking context, published catalog listings, versioned handoffs and allowlisted team quotes (`docs/friday-workflow.md`) |
| Live fare polling | Not implemented |
| Social-post extraction | Implemented when AI provider credentials are configured; it verifies cited public post content and waits for the user to save suggestions |
| Reel to itinerary and human quote request | Implemented for signed-in travelers when AI research is configured; asks them to confirm the exact place, cites researched stops, keeps drafts price-free and editable, then freezes reviewed drafts for the team quote queue (`docs/friday-workflow.md`) |
| Email verification and password reset | Provided by Hexclave when the project and production email sender are configured |

Research responses may cite sources and suggest places and itinerary days. The user reviews and applies itinerary drafts; saved records remain scoped to their account. The airport catalogue is curated and is not a global airport database.

## Villas

Villa inventory is team-managed. Signed-in accounts whose normalized email appears in `VILLA_ADMIN_EMAILS` can create and edit only their own villa records; an empty value grants no admin access. Public visitors can browse published listings and submit a property for review. Submission contact details remain private in the villa admin inbox. `POST /api/villas/:id/plan` returns an unpersisted proposal grounded in live nearby Google Places results when configured, or the villa's host-curated nearby list otherwise. AI can order only verified candidate IDs; if the configured research provider is unavailable or returns an invalid plan, the API reports a local grounded outline. It never invents drive times or bookings.

`GET /api/villas/:id/nearby` accepts `radius` (100–50000 metres) and `category` (`things-to-do`, `restaurants`, or `cafes`). Google results are fetched live and returned without caching; curated host entries are used when Google Places is not configured and only when their stored coordinates are within the requested radius. `GET /api/villas/:id/places/:placeId` refreshes details for a selected Google Place ID, only for a published villa and a place within 50 km. Keep live Google content transient in planner trips: persist a selected Google Place ID reference, and rehydrate details from this route when needed.

Public owner intake is `POST /api/villa-submissions` with `{ contactName, email, phone?, villaName, city, address?, mapsUrl?, lat?, lng?, bedrooms?, maxGuests?, description?, website?, photosUrl?, consent: true, websiteTrap? }`; the server rate-limits intake, discards honeypot hits, and never echoes contact details. Admin inventory is `GET/POST /api/admin/villas`, `GET/PATCH/DELETE /api/admin/villas/:id`; the team submission inbox is `GET /api/admin/villa-submissions` and status changes use `PATCH /api/admin/villa-submissions/:id` with `{ status: "new" | "reviewed" | "rejected" }`.

**Pending owner setup:** choose the Friday admin account email, then set `VILLA_ADMIN_EMAILS` to that address (or a comma-separated list). No admin account or allowlist email is preconfigured.

## Itinerary generation

The planner asks the server for its plan. That is separate from the AI research above: Claude with web search powers research chat and Deep research jobs, while `ITINERARY_PROVIDER` chooses how the planner's first plan is generated.

| Route | |
| --- | --- |
| `GET /api/health` | Public. `{ ok, itineraryProvider, knowledge: { sources, chars } }` |
| `GET /api/destinations`, `GET /api/destinations/:id` | The six curated destinations and their catalogs |
| `POST /api/itineraries` | Sign-in required unless the isolated loopback development bypass is active. `{ destination, types, days, dates?, pace?, base? }` generates and saves a plan: `{ id, provider, plan }` (400 on bad input, 404 unknown destination). |
| `GET /api/itineraries/:id` | Sign-in required and returns the itinerary only to its owner (404 for another owner's id). Explicit trip-share links remain the public viewing path. |

These routes require authentication in production and normal server mode; the isolated loopback development bypass uses its development owner. Generated itineraries are stored with the authenticated owner's id, and prompt/generation activity is audited to that owner. POST requests also use the usual same-origin check and a rate limit. The explicit trip-share flow is the public viewing path. On `file://`, without the server, or on any failure, the browser builds the plan with the same generator (`assets/js/trip-generator.js`). When a signed-in visitor's server has no research provider configured, the planner's own conversation (clarifier cards, then the plan) answers instead of Deep research, and its plan comes from `POST /api/itineraries`; with a research provider, Deep research answers as before.

Providers: `local` is the deterministic generator. `claude` asks Claude to choose and order places from the catalog (it is sent only ids, names, kinds and areas), validates every id against the catalog, and falls back to `local` on any error or timeout, reporting `provider: "local"` and a `fallbackReason` (the API key is redacted from both). Unset, `ITINERARY_PROVIDER` is `claude` when `ANTHROPIC_API_KEY` is set and `local` otherwise.

| Variable | Meaning |
| --- | --- |
| `ITINERARY_PROVIDER` | `local` or `claude` (default `claude` when `ANTHROPIC_API_KEY` is set, otherwise `local`) |
| `ANTHROPIC_API_KEY`, `ITINERARY_MODEL` (falls back to `AI_MODEL`), `ITINERARY_TIMEOUT_MS` | The claude provider (timeout default 30000 ms) |
| `KNOWLEDGE`, `KNOWLEDGE_DIR`, `KNOWLEDGE_MAX_CHARS`, `KNOWLEDGE_SECTIONS` | House knowledge for the claude provider |

### House knowledge

The Claude provider can be given a travel company's planning skill file and reference notes (prompt text only, no fine-tuning). Put `SKILL.md` and `references/*.md` in the knowledge folder (`KNOWLEDGE_DIR`, default `server/knowledge/kusum`, relative to the repo root). They are read once at startup and appended to the provider's system prompt after a fixed preamble that tells the model to use them as planning principles only (no prices, quotes, bookings or supplier contact; diet and culture only when the traveler stated them; sample lessons are history, not templates).

- **Included:** from `SKILL.md` (front matter removed) only the `## ` sections named in the allowlist (default: Procedure, Pitfalls, Sightseeing specificity, Indian traveler knowledge, Sample evidence; override with `KNOWLEDGE_SECTIONS`, a comma list); every `references/*.md` file, sorted by name.
- **Excluded:** all other `SKILL.md` sections, and any line mentioning a local path (`/Users/`, `Downloads/`, `C:\`).
- **Redaction:** honorific plus name (`Mr. X Y`, `Dr X`) becomes `[client]`; `.pdf` and `.docx` file names become `[sample file]`.
- **Size:** `KNOWLEDGE_MAX_CHARS` (default 60000). Over the cap, SKILL sections go in first, then references in order; what does not fit is left out.
- **Off / missing:** `KNOWLEDGE=off` disables it; a missing or empty folder is fine. The server logs `knowledge: N files, M chars` or `knowledge: none` (never the contents), and `GET /api/health` reports the same counts.

Only the Claude provider uses it; the local generator is unaffected.

## Deployment settings

- `NODE_ENV=production` requires `APP_ORIGIN` (the exact public origin, `https://fridaytravel.vercel.app`) and the server refuses to start without it. Set optional `APP_ORIGIN_ALIASES` to a comma-separated list of exact internal origins, such as the direct Hexclave Deploy URL. Preview hosts are not aliases. In development, `APP_ORIGIN` is not required and a request whose `Origin` matches its `Host` (127.0.0.1, a LAN address, a dev proxy) is accepted as well; production accepts only configured origins. In production, a request whose visitor host is not `APP_ORIGIN` permanently redirects to it, except `/api/` on an alias host.
- `SEARCH_INDEXING` defaults to `off` (including when unset): Friday sends `X-Robots-Tag: noindex, nofollow` on responses, adds a noindex meta tag to pages, and serves `robots.txt` with `Disallow: /`. Set it to `on` to let search engines index public pages; planner, staff, account and shared-trip pages remain noindex. Open Graph titles and images continue to be served in either mode. For Hexclave Deploy, change `SEARCH_INDEXING` in `hexclave.deploy.ts` and redeploy; for local or self-managed hosting, set it in the server environment. This repository change does not change the live Hexclave setting.
- `TRUST_PROXY=1` makes rate limits use the right-most `X-Forwarded-For` hop. Set it only behind a reverse proxy that appends the client address, never when the app is reachable directly. Sign-in is also throttled per email.
- Saved Google photo links are re-signed each time a record is read, so they do not expire in storage; a shared trip's photos load through `/api/shared/:token/photo/...`.
- Errors the server did not expect are written to stderr (`console.error`), without request bodies or keys.
- `npm test` runs `node --test tests/*.test.mjs`; `npm run test:hexclave` runs the same suite with trips on a fake Hexclave vault.

## Scheduled jobs

The host scales to zero, so in-process timers are unreliable. `.github/workflows/scheduled-jobs.yml` wakes the service and calls `POST /api/cron/briefings` (daily 03:30 UTC / 09:00 IST), `/api/cron/quote-digest` (daily 04:00 UTC) and `/api/cron/guide-feedback-digest` (Mondays 03:30 UTC). Each returns a JSON summary and is idempotent per day or week, so retries and manual runs never double-send. The job can also be started from the Actions tab (workflow_dispatch).

The owner must set the same secret in two places:

1. `FRIDAY_CRON_SECRET` (32+ characters) in the Hexclave project secrets. Unset or shorter, the cron routes return 404.
2. `FRIDAY_CRON_SECRET` as a GitHub repository secret (Settings, Secrets and variables, Actions) with the identical value. The workflow fails early if it is missing.

## Rebuild the public pages

Edit `build/` sources and regenerate root HTML files with:

```sh
npm run build
```

`build/data.js` contains public copy and content, `build/templates.js` contains page structures, and `build/generate.js` writes generated HTML. Avoid editing root HTML pages directly. Canonicals, the sitemap, robots, and social URLs use `PUBLIC_SITE_ORIGIN` or `APP_ORIGIN` when one is set, and otherwise `https://fridaytravel.vercel.app`. A Vercel preview hostname is never used. The homepage canonical is `/`. The server rewrites those URLs to the live `APP_ORIGIN` when it serves them.

## Trip storage in Hexclave

Optional, off by default. Planner trips (the `records` rows of kind `trips`, i.e. what `/api/trips` reads and writes) can be
kept in a [Hexclave](https://hexclave.com) Data Vault instead of PostgreSQL. This setting only chooses the trip-data store;
Hexclave authentication and email integrations work independently of whether trips use PostgreSQL or the Data Vault.

**What is stored where**

| Data | Where |
| --- | --- |
| Users, sessions, profiles, password hashes | PostgreSQL |
| Places, lists, bookings, memories, alerts, imports | PostgreSQL |
| Research jobs, share links (token hash, owner, trip id, expiry), itineraries, Google tokens | PostgreSQL |
| AI chat messages, research requests, provider responses and failures | PostgreSQL, scoped to the signed-in owner and conversation id |
| Planner trips, with `TRIP_STORAGE=hexclave` | Hexclave Data Vault (nothing in the PostgreSQL `records` table) |

In the vault each trip is `trip:<id>` holding JSON `{id,userId,data,version,updated,deleted?}` (`data` is the trip JSON as a
string), and each owner has `user:<userId>:trips`, a JSON array of trip ids. Deleting a trip writes a tombstone
(`deleted:true`, `data:null`) and removes the id from the index. Keys are hashed and values are AES-GCM encrypted in the Friday
server with `HEXCLAVE_VAULT_SECRET` before they leave it, so Hexclave never sees trip contents or key names. Every read checks
that the stored `userId` is the signed-in owner. Routes, responses, versions and 409 conflicts behave exactly as with PostgreSQL.

**Settings** (see `.env.example`)

- `TRIP_STORAGE=sqlite|hexclave`, default `sqlite` (the legacy name for "trips stay in the application database", which is now PostgreSQL). With `hexclave` the server refuses to start unless the three keys below are set.
- `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY`: Hexclave dashboard, Project Keys. The secret server key is server-only.
- `HEXCLAVE_VAULT_SECRET`: the value-encryption secret, any long random string you generate (for example `openssl rand -base64 32`).
  Keep a copy somewhere safe: losing it makes every stored trip unreadable, and changing it hides the existing ones.
- `HEXCLAVE_VAULT_STORE`, default `friday-trips`: the name of a Data Vault store. Create it in the dashboard first; a missing store is reported as an error.
- `HEXCLAVE_API_URL`, default `https://api.hexclave.com`.
- The code talks to the REST API with `fetch` (no SDK). The calls and where they come from are documented at the top of
  `server/storage/hexclave-vault.mjs`.

**Limits to know about**

- The vault is a key-value store: no listing, searching, deleting or compare-and-set. Listing a user's trips reads the index and then each trip (a few requests per page load); a trip can only be found by id. Deleted trips remain as tombstones.
- Write safety is per server process: writes for one user run one at a time and the record is re-read before each write, so version checks and 409s work. **Run a single server instance.** Several instances sharing one vault can lose concurrent edits (last write wins), because the vault cannot make "check version then write" atomic. An interrupted write between a trip record and its index entry leaves a trip that is not listed (and not visible anywhere) until it is written again.
- Share links stay in PostgreSQL and look the trip up in the vault. Deleting a trip also deletes its share rows. Trips that only exist in PostgreSQL are not shared or listed in vault mode, so copy them first (below).
- If Hexclave is unreachable, trip routes answer `503 Trip storage is temporarily unavailable`; everything else keeps working. Timeouts are 10 seconds and a 5xx is retried once.
- Secrets are never logged or included in error messages.

**Run locally**

```sh
# .env
TRIP_STORAGE=hexclave
HEXCLAVE_PROJECT_ID=...
HEXCLAVE_SECRET_SERVER_KEY=...
HEXCLAVE_VAULT_SECRET=...
npm run dev
```

**Copy existing trips (optional, once)**: `node --env-file-if-exists=.env server/tools/copy-trips-to-hexclave.mjs` is a dry run that
reports how many PostgreSQL trips are missing from the vault; add `--apply` to write them. Stop the server first. It keeps ids,
owners, versions and times, skips trips already in the vault, never overwrites, and never deletes from or changes PostgreSQL.
To go back to the database, unset `TRIP_STORAGE`: trips created while on the vault are not copied back.

**Tests**: `npm test` runs everything against PostgreSQL plus `tests/hexclave-vault.test.mjs` (REST client, SDK crypto
compatibility, index and tombstones, isolation, conflicts, startup checks, copy tool) using an in-memory fake of the vault API
(`tests/fake-vault.mjs`). `npm run test:hexclave` runs the whole suite with `TRIP_STORAGE=hexclave` against that fake.
Nothing in the tests calls Hexclave.

## Storage and account notes

Application records and AI conversation reviews remain in PostgreSQL and are scoped to the verified Hexclave user. Set `AI_REVIEW_ADMIN_EMAILS` to a comma-separated list of team account emails to enable the authenticated `GET /api/admin/ai-conversations` review endpoint; it supports `ownerId`, `conversationId`, `limit`, and the returned `nextBefore` cursor. New chat entries are saved before an answer starts, then updated with the answer or failure. Existing browser drafts are never backfilled. Keep the database private, persistent, and backed up. Hexclave handles sign-in, email verification, password recovery, and account sessions.

Email delivery uses the Hexclave Emails app and needs `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY`. Set `FRIDAY_ENQUIRY_EMAIL` for owner notifications. Set optional `FRIDAY_WHATSAPP_NUMBER` to the designer’s international WhatsApp number; it is exposed only as a validated public click-to-chat number and the link stays hidden when unset. After a deployment, use `npm run emails:drain` to inspect the queued/blocked count; it does not send. Add `-- --send-pending` to explicitly send pending/blocked messages. Accepted or delivery-unknown messages are never retried. `EMAIL_OUTBOX_DATABASE_PATH` may point the operator command at the same database file used by the running service; by default it follows `DATABASE_PATH` (or `.data/friday.sqlite`).

## Temporary local planning

Set `AUTH_REQUIRED=false` in `.env` and restart to open the local app without sign-in, including the villa admin workspace. The bypass is active only outside production when `HOST` and `APP_ORIGIN` (if set) resolve to loopback; otherwise sign-in remains required. Local mode uses a stable development owner in `.data/friday-local-dev.sqlite`, isolated from `.data/friday.sqlite` and any existing private records or owner submissions. Trips continue to use this browser's `friday.planner.guest.v1` storage; existing browser drafts are untouched and never migrated. Set `AUTH_REQUIRED=true` and restart to restore normal authenticated, owner-scoped access. Production always requires sign-in.

Trip chat requires the Friday server so each new question and answer can be committed to PostgreSQL before the response starts. Opening the planner as a static `file://` preview keeps the screens available, but chat will report that review storage is unavailable and will not send an unrecorded request.
