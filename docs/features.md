# Friday feature and integration status

This inventory separates implemented behavior from service connections that still require credentials.

| Area | Current status | Requirements or limits |
| --- | --- | --- |
| Accounts and private data | Implemented with Hexclave configured | Hexclave verifies each API session; local travel records are mapped by Hexclave user ID and every read/write is scoped to that owner. Local browser drafts are left untouched. A legacy Friday account links only after the user proves its existing password. |
| Post-signup location | Implemented | The app asks for a home city, then suggests nearby airports. The user can remove airports and save the selection. |
| Travel records | Implemented | Journeys, places, lists, bookings, memories, alerts, profile details, and enquiries persist in SQLite. |
| Journey archive and restore | Implemented | Archive status is stored on the owner's journey record and can be changed back at any time. |
| Read-only trip links | Implemented | The owner explicitly creates a link; it expires after 30 days and can be revoked. Anyone holding a live link can view the sanitized destination and itinerary. |
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
