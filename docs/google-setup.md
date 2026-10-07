# Google Gmail and Calendar connections

Friday's server integration uses Google's OAuth 2.0 web-server flow. It requests one read-only scope at a time: `gmail.readonly` for travel confirmation emails or `calendar.events.readonly` for calendar events. Gmail connection triggers an initial booking discovery pass. Later syncs are user initiated. Gmail discovery scans up to three pages of 100 messages matching confirmation-focused terms, without filtering by the email's sent date. Records retain the source message link, sender, evidence excerpt, and the email's sent date separately from travel dates. Clear labelled travel dates and supported schema.org reservation data can produce a fixed start/end; missing years, ambiguous numeric dates, conflicting dates, or an unclear lodging checkout produce `dateStatus: "needs-clarification"` and are not treated as confirmed dates. The parser does not infer a year. Cancelled messages and promotional matches without booking confirmation are skipped. By default, explicit travel dates must be future or potentially ongoing; `includePast: true` on a Gmail sync opts into older travel dates. The scan reports its count and whether the three-page bound was reached. Calendar sync imports up to 100 upcoming primary-calendar events. Friday does not send mail or edit events.

## Google Cloud setup

1. Create or select a Google Cloud project, enable the Gmail API and Google Calendar API, and configure the OAuth consent screen for the intended audience.
2. Create an OAuth client ID of type **Web application**.
3. Add this exact authorized redirect URI, replacing the origin with the deployed Friday origin:

   `https://your-friday-domain.example/api/integrations/google/callback`

   For local development with the example environment, register `http://localhost:4871/api/integrations/google/callback`.
4. Configure the server environment:

   ```dotenv
   GOOGLE_CLIENT_ID=your-web-client-id
   GOOGLE_CLIENT_SECRET=your-web-client-secret
   GOOGLE_TOKEN_KEY=64-hexadecimal-characters
   APP_ORIGIN=https://your-friday-domain.example
   ```

Generate the token encryption key with a cryptographically secure random generator, for example `openssl rand -hex 32`. Keep all three credentials on the server. Do not put them in browser code, commits, logs, or support screenshots. The token key must be the same across restarts and application instances because Google refresh tokens are encrypted with AES-256-GCM before they are stored. Back it up in the same secret manager as the database; losing it requires users to reconnect Google.

## Server route contract

The application passes its authenticated user's ID and SQLite database to `createGoogleIntegration` from `server/google.mjs`, then forwards matching requests to its handler:

- `GET /api/integrations/google/status` returns whether server credentials are configured and this signed-in user's connected services.
- `POST /api/integrations/google/start` with `{ "kind": "gmail" }` or `{ "kind": "calendar" }` returns an authorization URL for a user-initiated redirect.
- Google returns to `GET /api/integrations/google/callback`; the handler checks the one-use owner-bound state, validates the requested scope, exchanges the code, encrypts the refresh token, and returns a redirect to the app. A Gmail callback runs the initial scan and uses a fixed `google=sync-failed` status in the app redirect if discovery fails; the connection remains available for retry.
- `POST /api/integrations/google/sync` with `{ "kind": "gmail" | "calendar", "tripId": "optional-owned-trip-id", "includePast": true }` reads provider data and writes imported booking records to the current user's private records. `includePast` applies only to Gmail. Dedupe remains scoped by owner, provider, and external message/event ID.
- `POST /api/integrations/google/disconnect` with `{ "kind": "gmail" | "calendar" }` removes this user's stored connection.

Every route requires the Friday session. Callback state is hashed at rest, expires after ten minutes, is bound to the initiating owner, and is consumed before exchanging the authorization code. The PKCE verifier is encrypted at rest. Access tokens are obtained server-side when syncing; refresh tokens are encrypted at rest and resealed if Google rotates them. Each connection stores only the single read-only scope it needs. Provider errors are mapped to generic user-facing messages rather than returned verbatim.

Gmail date extraction is intentionally conservative, not a full email parser. It recognizes explicitly labelled ISO dates, unambiguous numeric dates, common `DD Month YYYY` / `Month DD, YYYY` forms, and supported structured Reservation dates. Ambiguous dates remain private clarification candidates. Each Gmail run is bounded to 300 messages; a reached bound means the user may need another sync, and it does not imply that the full mailbox was searched.

Google's web-server OAuth guide describes the authorization-code and offline refresh-token flow and requires checking `state` on callback. Gmail's messages list supports query filtering and requires `gmail.readonly` for message reading; Calendar's events list supports the `calendar.events.readonly` scope. See [Google OAuth for web-server applications](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), and [Calendar events.list](https://developers.google.com/calendar/api/v3/reference/events/list).
