# Friday

Friday is a travel design website with a private travel planning app. The public pages remain static generated HTML; sign-in, saved planning records, and AI research run through the Node server.

## Run locally

Use Node.js 24 or newer. Copy `.env.example` to `.env`, optionally configure an AI provider, then run:

```sh
npm run dev
```

Open <http://localhost:4871>. `npm start` starts the same application for deployment. Keep `.data/` on persistent storage: it contains the SQLite database and must not be served publicly. Set `DATABASE_PATH` to a durable file path when deploying. Serve the app behind HTTPS and set `APP_ORIGIN` to its exact public origin. Set `HOST` and `PORT` for the hosting environment.

## Production deployment

Hexclave provides Friday's sign-in and transactional email. Friday can run on Hexclave Deploy as a Node server, with SQLite on a persistent disk; this is separate from the Hexclave project configuration in `hexclave.config.ts`.

### Hexclave Deploy

`hexclave.deploy.ts` defines one public server built from the repository's Dockerfile. It listens on port 3000 and mounts one 1 GB persistent disk at `/data` (disks can be grown later but never shrunk); SQLite lives at `/data/app/friday.sqlite`. The container runs as the non-root `node` user, creates the database and backup subdirectories under that mount, and runs the daily SQLite backup loop in the same process. Seven verified snapshots are retained at `/data/backups` on the same disk. These snapshots are a recovery aid, not an off-site backup: the disk is not replicated and can be lost with its host.

Before the first deploy:

1. Turn on the Deploy app in the Hexclave dashboard. The service uses `minInstances: 0`, so it suspends when idle (keeping its disk) and resumes on the next request; an always-running server (`minInstances: 1`) needs a paid plan. Do not push `hexclave.config.ts` as part of this step.
2. `APP_ORIGIN`, `FRIDAY_ENQUIRY_EMAIL`, and `QUOTE_ADMIN_EMAILS` are set directly in `hexclave.deploy.ts`; update them there when the domain or inbox changes. Under Project Settings → Secrets, the optional `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, `GOOGLE_PLACES_API_KEY`, and `OPENAI_API_KEY` default to empty and keep those integrations off until configured. For Gmail/Calendar, set the Google client ID, client secret, and a 64-character hexadecimal `GOOGLE_TOKEN_KEY` together. Deploy supplies `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY` itself; without a valid enquiry inbox, enquiries are saved but the team notification is not sent.
Vercel (`vercel.json`, project `friday-travel`) is only a reverse proxy: it serves `https://fridaytravel.vercel.app` by rewriting every path to the Hexclave Deploy origin, so all data stays on the persistent server. `APP_ORIGIN` is the public proxy origin, because browsers send `Origin: https://fridaytravel.vercel.app` on API writes. `APP_ORIGIN_ALIASES` explicitly lists the direct Deploy origin for browser sessions opened on that host; the server accepts only those exact configured origins for writes and never trusts arbitrary request hosts.
3. To move to your own domain, attach and verify it on the public `web` service and set its exact HTTPS origin as `APP_ORIGIN` in `hexclave.deploy.ts`.
4. From the repository root, run `npx @hexclave/cli@latest deploy --cloud-project-id 38c9a741-73e3-4e6a-9c1b-6438f1239457`.

The Deploy app is in alpha, and its service region is not confirmed here (it may not be in India). Pick an encrypted, access-controlled off-site backup destination and retention period before treating snapshots as a durable backup; Friday does not choose or upload to a storage provider. Disk size can only be grown, not reduced.

After the first deployment, write a test record, restart and redeploy the service, and confirm that the record remains. Create a snapshot, preview it with `server/tools/restore-database.mjs`, and test an actual restore before storing important data. The public `/api/health` endpoint is available, and the Dockerfile includes a health check for it.

### Self-managed Docker deployment

For a separate Linux Docker host, copy `.env.example` to `.env`, choose `APP_DOMAIN`, set `APP_ORIGIN` to its exact HTTPS origin, and configure the required secrets. The Compose file runs Caddy for HTTPS, mounts persistent Docker volumes for the database and backups, and runs a separate daily backup service. On a public host, point DNS at the host and allow inbound ports 80 and 443. Keep `.env`, the database, and backup files out of public storage.

Start the Compose deployment from the repository root:

```sh
docker compose -f deploy/compose.yml up -d --build
```

`npm run dev` runs the Hexclave CLI wrapper, which supplies local project keys to the development server. Hexclave's shared mail server is for development; configure a production email sender in the project before launch.

Create a consistent online database snapshot while Friday is running:

```sh
docker compose -f deploy/compose.yml exec -T friday node server/tools/backup-database.mjs
```

This uses Node's SQLite online backup API and checks the resulting file. Scheduled snapshots are stored as plaintext SQLite files on the same Docker host. Protect that host's backup volume with disk encryption, and transfer snapshots to a separate encrypted, access-controlled destination with a retention schedule. The local Docker volume alone is not an off-site backup. Hexclave Data Vault is designed for encrypted key-value records and does not provide managed SQLite backups.

To inspect a candidate backup first, pass its path in the backup volume; the preview checks integrity and changes nothing:

```sh
docker compose -f deploy/compose.yml exec -T friday node server/tools/restore-database.mjs /app/backups/PUT-BACKUP-FILENAME-HERE.sqlite
```

For an actual restore, stop both services cleanly and run the restore in a one-off container against the same persistent volumes:

```sh
docker compose -f deploy/compose.yml stop friday friday-backup
docker compose -f deploy/compose.yml run --rm --no-deps friday node server/tools/restore-database.mjs /app/backups/PUT-BACKUP-FILENAME-HERE.sqlite --apply
docker compose -f deploy/compose.yml up -d friday friday-backup
```

The script refuses to proceed while SQLite `-wal` or `-shm` sidecars remain. It stages and validates the restored database, saves a SQLite-consistent `.pre-restore-*` copy of the current database, and atomically replaces the live file. Keep the safety copy until the restored service has been checked.

The production host and DNS name still need to be selected before a live deployment can be completed. Team notification recipients are configured only through server environment variables and are never shown on the site.

## AI research configuration

Deep is the default research mode. All user-facing research and reel itinerary generation uses OpenAI's Responses API with web search. Set server-only `OPENAI_API_KEY`; `OPENAI_RESEARCH_MODEL` defaults to `OPENAI_MODEL` or `gpt-5-mini`. Optionally set `OPENAI_DEEP_MODEL`. Legacy Claude and Perplexity environment variables do not select the production research provider. Without the OpenAI key, research is unavailable and existing saved itineraries remain accessible.

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
| Commission enquiries and newsletter signup | Stored in SQLite; confirmation/notification emails use Hexclave when configured; newsletter campaigns are not implemented |
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

The planner asks the server for its plan. That is separate from the AI research above: OpenAI Responses with web search powers research chat and Deep research jobs, while `ITINERARY_PROVIDER` chooses how the planner's first plan is generated.

| Route | |
| --- | --- |
| `GET /api/health` | Public. `{ ok, itineraryProvider, knowledge: { sources, chars } }` |
| `GET /api/destinations`, `GET /api/destinations/:id` | The six curated destinations and their catalogs |
| `POST /api/itineraries` | Sign-in required unless the isolated loopback development bypass is active. `{ destination, types, days, dates?, pace?, base?, draft?, source? }` generates and saves a plan: `{ id, provider, plan }` (400 on bad input, 404 unknown destination). `draft` with `source: "chatgpt"` is a browser-made model draft, validated here (see Use your ChatGPT plan) |
| `POST /api/itineraries/prompt` | Same sign-in requirement; `{ instructions, input, schema, model }` for the browser-side ChatGPT call |
| `GET /api/itineraries/:id` | Sign-in required and returns the itinerary only to its owner (404 for another owner's id). Explicit trip-share links remain the public viewing path. |

These routes require authentication in production and normal server mode; the isolated loopback development bypass uses its development owner. Generated itineraries are stored with the authenticated owner's id, and prompt/generation activity is audited to that owner. POST requests also use the usual same-origin check and a rate limit. The explicit trip-share flow is the public viewing path. On `file://`, without the server, or on any failure, the browser builds the plan with the same generator (`assets/js/trip-generator.js`). When a signed-in visitor's server has no research provider configured, the planner's own conversation (clarifier cards, then the plan) answers instead of Deep research, and its plan comes from `POST /api/itineraries`; with a research provider, Deep research answers as before.

Providers: `local` is the deterministic generator. `openai` asks a model to choose and order places from the catalog (it is sent only ids, names, kinds and areas), validates every id against the catalog, and falls back to `local` on any error or timeout, reporting `provider: "local"` and a `fallbackReason` (the API key is redacted from both). Unset, `ITINERARY_PROVIDER` is `openai` when `OPENAI_API_KEY` is set and `local` otherwise.

| Variable | Meaning |
| --- | --- |
| `ITINERARY_PROVIDER` | `local` or `openai` |
| `OPENAI_AUTH` | Credential source, default `api-key` (reads `OPENAI_API_KEY`); another source can implement the same interface in `server/itinerary/providers/openai-auth.mjs` |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_TIMEOUT_MS` | The openai provider (model default `gpt-5-mini`, timeout 30000 ms) |
| `KNOWLEDGE`, `KNOWLEDGE_DIR`, `KNOWLEDGE_MAX_CHARS`, `KNOWLEDGE_SECTIONS` | House knowledge for the openai provider |

### House knowledge

The OpenAI provider can be given a travel company's planning skill file and reference notes (prompt text only, no fine-tuning). Put `SKILL.md` and `references/*.md` in the knowledge folder (`KNOWLEDGE_DIR`, default `server/knowledge/kusum`, relative to the repo root). They are read once at startup and appended to the provider's system prompt after a fixed preamble that tells the model to use them as planning principles only (no prices, quotes, bookings or supplier contact; diet and culture only when the traveler stated them; sample lessons are history, not templates).

- **Included:** from `SKILL.md` (front matter removed) only the `## ` sections named in the allowlist (default: Procedure, Pitfalls, Sightseeing specificity, Indian traveler knowledge, Sample evidence; override with `KNOWLEDGE_SECTIONS`, a comma list); every `references/*.md` file, sorted by name.
- **Excluded:** all other `SKILL.md` sections, and any line mentioning a local path (`/Users/`, `Downloads/`, `C:\`).
- **Redaction:** honorific plus name (`Mr. X Y`, `Dr X`) becomes `[client]`; `.pdf` and `.docx` file names become `[sample file]`.
- **Size:** `KNOWLEDGE_MAX_CHARS` (default 60000). Over the cap, SKILL sections go in first, then references in order; what does not fit is left out.
- **Off / missing:** `KNOWLEDGE=off` disables it; a missing or empty folder is fine. The server logs `knowledge: N files, M chars` or `knowledge: none` (never the contents), and `GET /api/health` reports the same counts.

Only the OpenAI provider uses it; the local generator is unaffected.

## Use your ChatGPT plan

Visitors can sign in with ChatGPT (OpenAI's "Sign in with ChatGPT", OAuth 2.0 Authorization Code + PKCE with OpenID Connect) and have trip planning run on their own ChatGPT plan, at no cost to us. The feature is fully built but **hidden until `SIWC_CLIENT_ID` is set**: without it, `GET /api/capabilities` reports `chatgpt: { enabled: false }` and the Preferences card does not render.

**How it works.** In Preferences, "Connect ChatGPT" opens the OpenAI sign-in in a popup (a full-page redirect if the popup is blocked). `chatgpt-callback.html` (generated, static, no secrets) hands the authorization code back to the planner, which checks `state`, exchanges the code (PKCE, no client secret) and refreshes tokens, all from the browser. When planning, the planner asks the server for the prompt (`POST /api/itineraries/prompt`, built by the same prompt builder and house knowledge as the openai provider), calls `https://api.openai.com/v1/responses` from the browser with the visitor's bearer token and a strict JSON schema, then posts the model's draft to `POST /api/itineraries` with `source: "chatgpt"`. The server validates it exactly like the openai provider (catalog ids only, no stays, no repeats, enough days), saves it and returns `provider: "chatgpt"`. An unusable draft falls back to the configured server provider with a `fallbackReason`; any browser-side failure falls back to the normal server path.

**Tokens stay in the browser, by design.** OpenAI's terms allow plan usage only for the signed-in user's own requests, from a runtime that user controls, with access and refresh tokens stored locally under the user's control, not on a server or any shared or managed environment. They are kept in this browser's `localStorage` (key `friday.chatgpt.v1`) and cleared by Disconnect. They are never sent to Friday's server, logged or synced; the server only sees the prompt request and the model's JSON draft. Do not add server-side token storage or use the plan for anything other than this app's own planning.

| Variable | Meaning |
| --- | --- |
| `SIWC_CLIENT_ID` | OpenAI-issued client id. Required to enable the feature. Public, not a secret |
| `SIWC_ISSUER` | Default `https://auth.openai.com`; endpoints come from `<issuer>/.well-known/openid-configuration` (fallback `/authorize`, `/oauth/token`) |
| `SIWC_SCOPES` | Default `openid profile email offline_access`. The scope that authorizes inference is not assumed here: take its exact name from the client configuration OpenAI issues and add it |
| `SIWC_MODEL` | Default `gpt-5-mini` |
| `SIWC_REDIRECT_PATH` | Default `/chatgpt-callback.html`; the redirect URI is `APP_ORIGIN` plus this path (the generated page is `chatgpt-callback.html`) |

**What the owner must do.**
1. Apply through OpenAI's Sign in with ChatGPT interest form for hosted/commercial apps (currently a limited trial) and obtain a client id.
2. Register the redirect URI `<APP_ORIGIN>/chatgpt-callback.html` for each environment (production, staging, local).
3. Set `SIWC_CLIENT_ID` (and `SIWC_SCOPES` as issued) and restart. The Preferences card then appears.

## Deployment settings

- `NODE_ENV=production` requires `APP_ORIGIN` (the exact public origin) and the server refuses to start without it. Set optional `APP_ORIGIN_ALIASES` to a comma-separated list of exact additional origins when a direct deployment host also serves the app. In development, `APP_ORIGIN` is not required and a request whose `Origin` matches its `Host` (127.0.0.1, a LAN address, a dev proxy) is accepted as well; production accepts only configured origins.
- `TRUST_PROXY=1` makes rate limits use the right-most `X-Forwarded-For` hop. Set it only behind a reverse proxy that appends the client address, never when the app is reachable directly. Sign-in is also throttled per email.
- Saved Google photo links are re-signed each time a record is read, so they do not expire in storage; a shared trip's photos load through `/api/shared/:token/photo/...`.
- Errors the server did not expect are written to stderr (`console.error`), without request bodies or keys.
- `npm test` runs `node --test tests/*.test.mjs`; `npm run test:hexclave` runs the same suite with trips on a fake Hexclave vault.

## Rebuild the public pages

Edit `build/` sources and regenerate root HTML files with:

```sh
npm run build
```

`build/data.js` contains public copy and content, `build/templates.js` contains page structures, and `build/generate.js` writes generated HTML. Avoid editing root HTML pages directly. The sitemap and canonical/social URLs use `PUBLIC_SITE_ORIGIN` when set, then `APP_ORIGIN`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL` or `VERCEL_URL`; the build falls back to Friday's canonical `https://fridaytravel.vercel.app` origin when none is configured. Set `PUBLIC_SITE_ORIGIN` to Friday's stable public HTTPS origin for production builds, especially when moving to a custom domain.

## Trip storage in Hexclave

Optional, off by default. Planner trips (the `records` rows of kind `trips`, i.e. what `/api/trips` reads and writes) can be
kept in a [Hexclave](https://hexclave.com) Data Vault instead of SQLite. This setting only chooses the trip-data store;
Hexclave authentication and email integrations work independently of whether trips use SQLite or the Data Vault.

**What is stored where**

| Data | Where |
| --- | --- |
| Users, sessions, profiles, password hashes | SQLite |
| Places, lists, bookings, memories, alerts, imports | SQLite |
| Research jobs, share links (token hash, owner, trip id, expiry), itineraries, Google tokens | SQLite |
| AI chat messages, research requests, provider responses and failures | SQLite, scoped to the signed-in owner and conversation id |
| Planner trips, with `TRIP_STORAGE=hexclave` | Hexclave Data Vault (nothing in the SQLite `records` table) |

In the vault each trip is `trip:<id>` holding JSON `{id,userId,data,version,updated,deleted?}` (`data` is the trip JSON as a
string), and each owner has `user:<userId>:trips`, a JSON array of trip ids. Deleting a trip writes a tombstone
(`deleted:true`, `data:null`) and removes the id from the index. Keys are hashed and values are AES-GCM encrypted in the Friday
server with `HEXCLAVE_VAULT_SECRET` before they leave it, so Hexclave never sees trip contents or key names. Every read checks
that the stored `userId` is the signed-in owner. Routes, responses, versions and 409 conflicts behave exactly as with SQLite.

**Settings** (see `.env.example`)

- `TRIP_STORAGE=sqlite|hexclave`, default `sqlite`. With `hexclave` the server refuses to start unless the three keys below are set.
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
- Share links stay in SQLite and look the trip up in the vault. Deleting a trip also deletes its share rows. Trips that only exist in SQLite are not shared or listed in vault mode, so copy them first (below).
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
reports how many SQLite trips are missing from the vault; add `--apply` to write them. Stop the server first. It keeps ids,
owners, versions and times, skips trips already in the vault, never overwrites, and never deletes from or changes SQLite.
To go back to SQLite, unset `TRIP_STORAGE`: trips created while on the vault are not copied back.

**Tests**: `npm test` runs everything against SQLite plus `tests/hexclave-vault.test.mjs` (REST client, SDK crypto
compatibility, index and tombstones, isolation, conflicts, startup checks, copy tool) using an in-memory fake of the vault API
(`tests/fake-vault.mjs`). `npm run test:hexclave` runs the whole suite with `TRIP_STORAGE=hexclave` against that fake.
Nothing in the tests calls Hexclave.

## Storage and account notes

Application records and AI conversation reviews remain in SQLite and are scoped to the verified Hexclave user. Set `AI_REVIEW_ADMIN_EMAILS` to a comma-separated list of team account emails to enable the authenticated `GET /api/admin/ai-conversations` review endpoint; it supports `ownerId`, `conversationId`, `limit`, and the returned `nextBefore` cursor. New chat entries are saved before an answer starts, then updated with the answer or failure. Existing browser drafts are never backfilled. Keep the database private, persistent, and backed up. Hexclave handles sign-in, email verification, password recovery, and account sessions.

Email delivery uses the Hexclave Emails app and needs `HEXCLAVE_PROJECT_ID` and `HEXCLAVE_SECRET_SERVER_KEY`. Set `FRIDAY_ENQUIRY_EMAIL` for owner notifications. After a deployment, use `npm run emails:drain` to inspect the queued/blocked count; it does not send. Add `-- --send-pending` to explicitly send pending/blocked messages. Accepted or delivery-unknown messages are never retried. `EMAIL_OUTBOX_DATABASE_PATH` may point the operator command at the same database file used by the running service; by default it follows `DATABASE_PATH` (or `.data/friday.sqlite`).

## Temporary local planning

Set `AUTH_REQUIRED=false` in `.env` and restart to open the local app without sign-in, including the villa admin workspace. The bypass is active only outside production when `HOST` and `APP_ORIGIN` (if set) resolve to loopback; otherwise sign-in remains required. Local mode uses a stable development owner in `.data/friday-local-dev.sqlite`, isolated from `.data/friday.sqlite` and any existing private records or owner submissions. Trips continue to use this browser's `friday.planner.guest.v1` storage; existing browser drafts are untouched and never migrated. Set `AUTH_REQUIRED=true` and restart to restore normal authenticated, owner-scoped access. Production always requires sign-in.

Trip chat requires the Friday server so each new question and answer can be committed to SQLite before the response starts. Opening the planner as a static `file://` preview keeps the screens available, but chat will report that review storage is unavailable and will not send an unrecorded request.
