# Friday Planner — build spec

> **Implementation note (2026-10-01):** This document records the original Claude planner prototype and design intent; its browser-only storage, scripted-reply, sample-data, preview-reset, and removed-mode details below are historical. The current app lives in `trip.html`, is authenticated and owner-scoped through `assets/js/trip-backend.js`, and runs real research jobs when a provider is configured. Research plans are drafts until reviewed and applied. Google integrations are opt-in; place ratings, hours, reviews, and photos are shown only from sourced place details. Update this note if the implementation contract changes.

The Friday site (repo root, generated from `build/`) is the **landing page**. This spec adds the
**main product**, a trip planner at `trip.html`. It copies the **layout and interactions** of
stardrift.ai/trip exactly and restyles them in Friday's design language. The site's pages are static. The planner is a browser
app that also works with a small Node server (`server/`): the assistant's replies are scripted, but
the day-by-day plans are **generated** from each destination's place catalog (see "Itinerary
generator and server" below), by the server when it is there and by the same code in the browser
when it is not. Trips are stored in the browser. Everything that looks clickable must do something.

Reference screenshots (read them all with the Read tool before you start):
`/tmp/claude-0/-home-user-travel/eb7d9934-889a-5f4e-b3d4-4f9ca5e3ed68/images/1.jpg` … `13.jpg`

| # | What it shows |
| --- | --- |
| 1 | Trip view. Chat on the left: user bubble, then a **clarifier card** asking which months, as a month-tile grid. Map top right. "Trip Overview" tab: Bookings empty state and Saved. |
| 2 | Clarifier: Q1 answered (collapsed, with ✓ and a bold answer). Q2 is multi-select numbered options ("Select all that apply"). Q3 pending, shown as a grey dot. |
| 3 | The last question shows "Submit answers ⌘↵". |
| 4 | Second clarifier with a **date-range calendar** (Dec 25 to 28). Plan tab with area header, items and thumbnails. Map markers. |
| 5 | Submitted-answers summary. Assistant prose, **tool lines** (monospace ✱), bold names, feedback icons, suggestion chips. Plan tab: "updated your plan" banner with Undo, area chips, day header (Fri / Dec 25 / Panjim), items with rating. Price pill on the map. |
| 6 | Workspace **Home**: sidebar, Upcoming trip card and booking card, "Continue exploring" carousel, Recent conversations. |
| 7 | **Bookings** page, empty state. |
| 8 | **Saved** page: search, round + button, empty state with "Import a post" and "New list". |
| 9 | **Notifications** page. |
| 10–12 | Profile/account page. **Only** the "Travel preferences" and "Memory" parts carry over, into a local Preferences page. See Removed. |
| 13 | **New trip** screen (`#/new`): logo mark, "Where are you headed?", a large prompt box, and a row of tilted photo cards with monospace captions. |

## Update: no modes

The Fast/Deep choice was removed. The planner has **one behaviour**, which is the former Deep one:
- **First plans:** a research card (labelled "Research"), then a report, then the plan.
- **Follow-ups:** a short research step comes before the reply.
- **Composer:** no mode control on either the trip view or the New trip screen.

Where later sections still mention "Fast", "Deep" or `trip.mode`, they describe the original design and no longer apply.

## Hard rules

- `AGENTS.md`: *"Friday is a travel design website with an authenticated travel planning app."*
  No login, no account, no email or avatar, no subscription or "Upgrade to Pro", no Gmail or Google
  Calendar connect, no "connected apps", no email-notification toggles, no collaborator invites.
- No build tools, frameworks or npm dependencies, in the browser or on the server (the server uses
  Node built-ins only). Use plain ES2020 **classic scripts** (not ES modules)
  loaded with `defer`, so `file://` keeps working. The only network requests are the Google Fonts link, the live map (OpenFreeMap tiles), Photon geocoding and, when served by `server/`, the planner's own `/api/` calls. There are no photos, and nothing is loaded from CDNs: MapLibre is bundled in `assets/vendor/`.
- Root `.html` files are generated. Edit `build/` and run `node build/generate.js`. `assets/` files are
  hand-written and not generated, except the two files named below as generated.
- Brand: "Stardrift" becomes **"Friday"** everywhere ("Let Friday decide", "Friday updated your plan.").
  No star logo. The logo is the Friday serif **text wordmark**: same style as `.wordmark__name` in
  `assets/css/friday.css`, Cormorant Garamond 500, letter-spacing -.03em.
- A small honest note sits under the composer, `font-size:.6875rem`, muted: *"Preview — replies are
  scripted; plans are generated from sample place data."*
- Wrap every `localStorage` read and write in try/catch. The app must work when storage is unavailable.
- Respect `prefers-reduced-motion`. At 390px wide there must be no horizontal page scroll.

## Friday design language (apply everywhere)

Load `assets/css/friday.css` first (its reset, tokens, `.plate` and `.btn`), then the planner CSS.
Use its tokens rather than raw colours:

- Surfaces: `--paper #F4F1EA` (main), `--paper-2 #EDE8DD` (sidebar, panel headers, tab bar),
  `--paper-3 #E3DCCD` (hover, selected tint). Ink `--ink #15140F`. Text `--fg-soft #4A473D`, muted
  `--fg-mute #7E7869`. Hairlines `--rule rgba(21,20,15,.16)` and `--rule-soft rgba(21,20,15,.08)`.
- The accent is `--ochre #B0552D`. Use it the way Stardrift uses blue: selected option border and text,
  place-name links, the clarifier's top progress bar, "Set it up" style links, the active-tab
  underline. Use it sparingly, never as large fills.
- Primary buttons (Stardrift's black buttons: "New trip", "Next", "Submit answers", "+ Add", send) are
  **ink-filled pills** (`border-radius:999px`, `--ink` background, `--paper` text, Inter 400 at 13–14px,
  sentence case). Secondary buttons ("Let Friday decide", "Import a post") are hairline-bordered pills
  on a transparent background. The Share button is ink-filled too (Stardrift's is blue).
- Cards and inputs have 3px radius, a 1px `--rule` border and no shadow. Popovers and menus get
  `box-shadow: 0 12px 32px -12px rgba(21,20,15,.25)` on a `--paper` background.
- Type:
  - **Cormorant Garamond** (`var(--serif)`, weight 500) for display: page titles ("Upcoming", "Saved",
    "Notifications", "Preferences"), the trip title in the top bar, panel section heads ("Bookings",
    "Saved"), day dates ("Dec 25", "Day 3"), place names on cards, and the empty-thread greeting.
  - **Inter** (`var(--sans)`, weight 300–500) for all UI and body text.
  - Small uppercase labels (0.6875rem, `letter-spacing:.245em`, `--fg-mute`) for weekday "FRI",
    "SELECT ALL THAT APPLY", "TRIPS", the "IN 12 WEEKS" pill, and the "BETA" badge.
- Icons: inline SVG line icons, 1.5px stroke, `currentColor`, 16–18px, round caps. `FridayTrip.util.icon(name)`
  provides them.
- Images: **no photos**. Every thumbnail, card image and trip cover is a generated risograph plate:
  `<div class="plate plate--ratio-s">${FridayTrip.plate(seed,{scene,tone,ratio:'square'})}</div>`. The
  `.plate` CSS in friday.css adds grain.
- Day colours cycle through the art palettes' `mid` tones:
  `['#B25C33','#5B7C60','#4E5578','#A9814D','#8A4B6B','#3E6E8E','#6B7A3A']`. They are exposed as
  `FridayTrip.util.dayColor(i)`.

## Files and ownership

| File | Owner | Purpose |
| --- | --- | --- |
| `build/trip-data/index.js` | **Data A** | CommonJS `module.exports = { DESTINATIONS, ORDER, TRIP_TYPES }`. It requires every `build/trip-data/<id>.js` in ORDER that exists (guard with `fs.existsSync` so a missing file never breaks the build) |
| `build/trip-data/goa.js`, `kerala.js`, `rajasthan.js` | **Data A** | One destination per file: `module.exports = { …destination }` |
| `build/trip-data/ladakh.js`, `srilanka.js`, `kyoto.js` | **Data B** | One destination per file |
| `build/trip-data/trip-types.js` | **Generator** | Shared tuning data for the itinerary generator: trip-type profiles, pace, time of day, slot phrasing |
| `assets/js/trip-generator.js` | **Generator** | The itinerary generator. A UMD classic script: `require()` in Node, `FridayTrip.generate` in the browser |
| `server/` | **Server** | The Node server (`server/app.mjs`): static site, accounts, JSON API, research, and the itinerary API (`server/itinerary/`) with its providers and the SQLite store (`server/store.mjs`) |
| `tests/` | **Server** | `node:test` suites (`tests/*.test.mjs`), run with `npm test` |
| `build/trip.js` | **Shell** | `tripPage()` returns the full `trip.html` document. `tripScripts()` returns `{ 'assets/js/trip-data.js': src, 'assets/js/trip-art.js': src }` |
| `build/generate.js`, `build/templates.js` | **Shell** | Write `trip.html` and the two generated JS files. Add landing-page CTAs |
| `assets/css/trip.css`, `assets/js/trip-app.js` | **Shell** | Core: store, router, util, ui, sidebar, and Home/Bookings/Saved/Notifications/Preferences pages |
| `assets/css/trip-workspace.css`, `assets/js/trip-workspace.js` | **Workspace** | Trip view: top bar, split panes, thread header, composer, right panel (tabs, overview, plan), activity drawer |
| `assets/css/trip-map.css`, `assets/js/trip-map.js` | **Map** | The SVG map |
| `assets/css/trip-chat.css`, `assets/js/trip-chat.js` | **Chat** | The conversation engine and every in-thread block |

Never edit a file you do not own. If you need something from another module, use the contract
below. If the contract is truly missing something, add a **guarded** fallback on your side
(`if (FridayTrip.map && FridayTrip.map.focus) …`) and mention it in your report.

Load order in `trip.html` (all `defer`): `trip-data.js`, `trip-art.js`, `trip-generator.js`,
`trip-app.js`, `trip-map.js`, `trip-chat.js`, `trip-workspace.js`. CSS order: friday.css, trip.css, trip-workspace.css,
trip-map.css, trip-chat.css. `trip-app.js` boots on `DOMContentLoaded`, which fires after every
deferred script has run. Every module does `window.FridayTrip = window.FridayTrip || {}` and attaches
to it.

## Page skeleton (Shell writes it into trip.html)

```html
<body class="fx">
<div class="fx-app" data-app>
  <aside class="fx-side" data-side> … sidebar (Shell renders) … </aside>
  <main class="fx-main" data-main>
    <section class="fx-page" data-page="home"></section>
    <section class="fx-page" data-page="new"></section>
    <section class="fx-page" data-page="bookings"></section>
    <section class="fx-page" data-page="saved"></section>
    <section class="fx-page" data-page="notifications"></section>
    <section class="fx-page" data-page="preferences"></section>
    <section class="fx-page fx-page--trip" data-page="trip"><div data-trip-root></div></section>
  </main>
</div>
<div data-layer></div>   <!-- toasts, modals, menus, popovers (FridayTrip.ui) -->
</body>
```

Only the active page is visible (`hidden` on the others). The app fills the viewport
(`height:100dvh`). Pages scroll inside `.fx-main`. The trip page does not scroll as a whole: its panes
scroll.

## Routing (hash-based, owned by Shell)

`#/` home · `#/bookings` · `#/saved` · `#/notifications` · `#/preferences` · `#/trip/<tripId>` ·
`#/new` (the New-trip screen; the trip is created only on submit).
Visiting `#/trip/<unknown>` redirects to `#/`.

## Global contract: `window.FridayTrip`

### Provided by generated files
- `FridayTrip.DESTINATIONS`, `FridayTrip.ORDER` and `FridayTrip.TRIP_TYPES` from `trip-data.js`, a JSON copy of `require('./trip-data')`, which is `build/trip-data/index.js`.
- `FridayTrip.generate(dest, opts)` and `FridayTrip.generator` from `trip-generator.js` (hand-written, not generated; see "Itinerary generator and server").
- `FridayTrip.plate(seed, {scene, tone, ratio})` from `trip-art.js`, which wraps `build/art.js` so it
  runs in the browser.

### Provided by Shell (`trip-app.js`)
```
FridayTrip.util = {
  esc(s), uid(prefix) → 'p_x7k2…', clamp(n,a,b),
  today() → 'YYYY-MM-DD' (local), addDays(iso,n), diffDays(aIso,bIso),
  fmtDay(iso) → {weekday:'Fri', date:'Dec 25', long:'Friday, December 25'},
  fmtRange(startIso,endIso) → 'Dec 25 – 28, 2026' (or 'Dec 30, 2026 – Jan 2, 2027'),
  monthLabel({y,m}) → 'December 2026', weeksUntil(iso) → 12,
  timeAgo(isoDateTime) → '7h', money(n, currency) → '₹18,500' / '$220',
  md(text) → HTML (escape first; then support **bold**, *italic*, [text](url), line breaks, and '- ' lists),
  icon(name, size=16) → '<svg …>' — at least: home, bell, plus, ticket, globe, pin, bed, fork,
    glass, waves, leaf, columns, spa, bag, landmark, search, x, check, chevron-down, chevron-up,
    chevron-left, chevron-right, arrow-right, arrow-up, share, users, dots, sidebar, sparkle, undo,
    history, copy, thumb-up, thumb-down, mic, image, send-plane, navigation, calendar, mail, trash,
    edit, grip, stop, printer, link, map, list, star, clock, compass, layers
  dayColor(i)
}
FridayTrip.dest(destId) → destination | null
FridayTrip.place(destId, placeId) → {id, ...place} | null
FridayTrip.store = {
  get() → root state (live object; mutate only inside update),
  trip(id = current) → trip | null,
  update(fn) → runs fn(state), sets trip.updatedAt if fn touched a trip, persists, emits 'change',
  on(evt, fn) → unsubscribe fn, emit(evt, payload),
  reset() → clears storage and reloads to '#/'
}
  events: 'change' | 'route' {name,id} | 'plan' {tripId} | 'map:focus' {placeId} | 'map:fit' |
          'plan:highlight' {placeId|null} | 'chat:busy' {busy} | 'tab' {tripId, tab}
FridayTrip.router = { go(hash), current() → {name, id} }
FridayTrip.ui = {
  toast(text), modal({title, body, actions:[{label, primary?, onClick(close)}], onOpen(el)}) → close,
  menu(anchorEl, items:[{label, icon?, danger?, onClick} | 'sep']) (closes on outside click / Esc),
  confirm(text, {okLabel}) → Promise<boolean>, prompt(title, {value, placeholder}) → Promise<string|null>
}
FridayTrip.trips = { create({destId=null}={}) → trip, open(id), remove(id), rename(id, title), duplicate(id) }
FridayTrip.plan = {
  apply(tripId, plan, {summary, changes}) → pushes the previous plan to trip.versions (max 20), sets the plan,
      sets trip.banner = {text:'Friday updated your plan.', at}, sets trip.activeTab = 'plan',
      logs activity, emits 'plan' and 'map:fit'.
  undo(tripId) → restores the latest version and clears the banner.
  restore(tripId, versionIndex)
  addItem(tripId, dayIndex|null, placeId, note='') → appends to that day (or the last day, or creates
      Day 1 when there is no plan) and logs "You added X"
  removeItem(tripId, itemId), moveItem(tripId, itemId, toDayIndex, toIndex),
  addDay(tripId), removeDay(tripId, dayIndex), moveDay(tripId, from, to)
}
FridayTrip.saved = { has(destId, placeId), toggle(destId, placeId) → toasts "Saved"/"Removed" }
FridayTrip.bookings = { add(b), remove(id), forTrip(tripId) }
FridayTrip.log(tripId, text, who='Friday')
```

### Root state (persisted in `localStorage['friday.planner.v1']`)
```
{
  v: 1,
  trips: [trip], currentTripId: null,
  prefs: { homeCity: 'Bombay', airports: ['BOM'], airlines: '', hotels: '', hotelBudget: '', business: '', other: '' },
  memory: [ {id, at, text} ],
  saved: [ {id, destId, placeId, listId: null, at} ], lists: [ {id, name} ], imports: [ {id, url, note, at} ],
  bookings: [ {id, tripId, type:'hotel'|'flight'|'reservation'|'other', name, start, end, ref, price, currency, destId, placeId} ],
  notifications: [ {id, kind:'home-city', text:'Add your home city and airports', at, done:false} ],
  dismissed: { prefsCard: false, studioCard: false },
  sideCollapsed: false
}
trip = {
  id, destId: null, title: 'New trip', createdAt, updatedAt,
  mode: 'fast',                                   // 'fast' | 'deep' (composer dropdown)
  prefs: { month: null /*{y,m}*/, types: [], days: null, dates: null /*{start,end}*/, base: null },
  plan: null | { days: [ { id, area /*area id*/, town, date /*iso|null*/, items: [ {id, place /*place id*/, note} ] } ], stay: null /*place id*/ },
  versions: [ {at, summary, plan} ], banner: null | {text, at},
  tabs: [ {id, name, notes} ], activeTab: 'overview',   // 'overview' | 'plan' | custom tab id
  activity: [ {at, who, text} ],
  threads: [ {id, title: 'New conversation', createdAt, messages: [] } ], activeThreadId,
  mapCollapsed: false
}
```
Messages are opaque to everyone except Chat. They must be plain JSON.

### Provided by Map (`trip-map.js`)
```
FridayTrip.map = { mount(el), render(trip), focus(placeId, {open=true}), fit(), resize() }
```

### Provided by Chat (`trip-chat.js`)
```
FridayTrip.chat = { mount(el), render(trip), send({text, mode, attachments}), stop(), busy, newThread() }
```

### Provided by Workspace (`trip-workspace.js`)
```
FridayTrip.workspace = { mount(rootEl), open(tripId), setComposer(text), focusComposer() }
```
Shell calls `workspace.mount(document.querySelector('[data-trip-root]'))` once at boot, and
`workspace.open(id)` whenever the route is `trip`. Workspace calls `map.mount` and `chat.mount` on its
own elements, then re-renders on store `'change'` (rendering must be idempotent).

## Destination data (`build/trip-data/*.js`)

```
DESTINATIONS = {
  goa: {
    id: 'goa', name: 'Goa', tripTitle: 'Goa Beach Vacation', threadTitle: 'Plan Goa Trip',
    match: ['goa','panaji','panjim','calangute','anjuna','vagator','candolim','baga','margao'],
    currency: '₹', region: 'North Goa', scene: 'sea', tone: 'ember',          // trip cover plate
    map: {
      bounds: [west, south, east, north],                                        // lng/lat
      land: [ [[lng,lat], …], … ],        // closed polygons of land. Everything else is sea
      water: [ [[lng,lat], …] ],          // polylines for rivers and estuaries (drawn as thick water strokes)
      parks: [ [[lng,lat], …] ],          // polygons for parks and forests
      roads: [ { ref: '66', path: [[lng,lat], …] } ],
      labels: [ { t: 'Mapusa', at: [lng,lat], kind: 'town'|'region'|'park' } ]
    },
    areas: [ { id: 'panaji', name: 'Panaji', town: 'Panjim', alt: 'Panjim', at: [lng,lat] }, … ],   // `town` is the name a day in that area shows
    places: {
      'black-sheep-bistro': { name: 'The Black Sheep Bistro', kind: 'food', label: 'Bistro', rating: 4.6, reviews: 8164,
                              price: null, area: 'panaji', at: [lng,lat], blurb: 'one line', scene: 'city', tone: 'rose' },
      'hyatt-centric-candolim': { …, kind: 'stay', label: 'Hotel', price: 18500 /* per night */, … },
      …
    },
    clarify: {
      types:    { q: 'What kind of Goa trip should I build?', options: ['Beach downtime','Food and nightlife','Culture and nature','Wellness retreat'] },
      duration: { q: 'How long would you like to go for?', options: [ {label:'Weekend (3-4 days)', days:4}, {label:'~1 week', days:7}, {label:'~2 weeks', days:14} ] },
      dates:    { q: 'Pick the four dates for your Goa stay so I can check live hotel availability.' },  // "four" is replaced with the day count
      base:     { q: 'For this {type} plan, what kind of base should I prioritize?', options: ['Beach strip, close to the action','Quiet boutique village','Heritage quarter in Panjim'] }
    },
    // There is no `itineraries` field. Plans are generated from `places` and `areas`.
    // Optional: tripTypes: { 'Beach downtime': 'beach' | { profile: 'beach', weights: { food: 2 } } }  (override the shared table)
    // Optional: acclimatisation: { arrivalArea, highAreas: [areaIds], afterDay, gentleKinds: [kinds], arrivalStops }  (Ladakh)
    stays: { query: 'boutique hotels in North Goa India', found: 19, ids: [ 6–8 stay place ids ], byBase: { 'Beach strip, close to the action': 'hyatt-centric-candolim', … } },
    extras: { food: [placeIds], nightlife: [placeIds], relaxedDrop: 1 },
    suggestions: ['Find local food spots near my hotel','Search for nightlife and bars','Make my plan more relaxed'],
    replies: {
      planIntro: 'short sentence said before the tool lines of the first plan, per trip type (object keyed by type)',
      planDone: 'paragraph after the plan, may use **bold** and {days}, {month}',
      staysIntro: "I'll use a stylish North Goa base near the beach-and-nightlife stretch, then add a few well-placed Goan dining stops without overpacking your days.",
      staysDone: 'Your Goa plan is now dated **{range}**.\n\nI added **{stay}** as a centrally located base, plus two restaurant stops that fit the route: **{food1}** in {food1Area} and **{food2}** in {food2Area}. The rest of the plan remains intentionally relaxed, with driving kept sensible between areas.',
      reserve: 'answer to "can you reserve/book for me?" pointing to the studio, with a link: [commission the studio](commission.html)',
      relaxed: '…', food: '…', nightlife: '…', fallback: '…'
    },
    deep: {
      steps: [ 'Reading the brief', 'Searching sources', 'Comparing bases and seasons', 'Checking availability', 'Writing the plan' ],
      sources: [ { title, domain, note } ×12 ],            // plausible, real domains (goa-tourism.gov.in, lonelyplanet.com, cntraveller.in, …)
      lines: [ 'tool-line strings streamed during research, e.g. "Read goa-tourism.gov.in — festival calendar, Dec"' ×10 ],
      report: {
        title: 'Goa in December: where to base yourself and how to pace it',
        summary: 'two to three sentences with [1] style citations',
        sections: [ { h: 'When to go', body: 'paragraph(s) with [n] citations' }, … 4 sections ],
        table: { caption: 'Choosing a base', cols: ['Base','Feel','Best for','Beach','Drive to Panjim'], rows: [[…] ×4] }
      }
    }
  },
  kerala: {…}, rajasthan: {…}, ladakh: {…}, srilanka: {…}, kyoto: {…}     // same shape
}
ORDER = ['goa','kerala','rajasthan','ladakh','srilanka','kyoto']
```

Goa must be the richest destination, with at least 36 places across every kind. Every other
destination needs at least 24 places. Each destination also has `card: { caption: 'Goa', scene, tone }` for
its New-trip photo card, and `prompt: 'Plan a trip to Goa'`. Currency: `₹` for the Indian
destinations, `$` for Sri Lanka, `¥` for Kyoto. `kind` is one of `food` · `stay` · `sight` · `beach` · `nightlife` ·
`nature` · `museum` · `neighborhood` · `wellness` · `market` · `church`. Place labels follow Stardrift's
wording ("Neighborhood", "Bistro", "Beach", "Historical Landmark", "Tourist Attraction", "Island",
"Hotel", "Boutique Hotel", "Restaurant", "Bar"). Use real, well-known places with accurate
coordinates. Ratings and review counts are plausible sample values. Scenes come from
`peaks,dunes,sea,terraces,forest,arctic,canyon,isles,city,aurora` and tones from
`ember,indigo,jade,sand,rose,slate,cobalt,moss,plum,ice`.

## Screen specs

### Sidebar (Shell). Screens 6–9. Width 300px, `--paper-2`, hairline right border.
- Top row: Friday text wordmark (1.7rem, links to `index.html`, the landing page) and a sidebar-toggle
  icon button. The toggle collapses the sidebar to nothing (`state.sideCollapsed`). When collapsed, a
  small floating toggle button stays at the top left of `.fx-main`. On the trip route the sidebar
  starts collapsed on screens under 1280px wide.
- A segmented group in a `--paper-3` rounded box: Home icon button (`#/`), Bell icon button
  (`#/notifications`, with a small ochre dot while any notification is undone), and the ink pill
  "+ New trip" (`#/new`). The active route's icon button gets a `--paper` background.
- Nav rows: ticket icon "Bookings" (`#/bookings`), globe icon "Saved Places" with a "Beta" badge
  (ochre text, hairline ochre border, uppercase label style). Active row: `--paper-3` background.
- Hairline, then dismissible cards (× buttons persist `dismissed.*`):
  1. Replaces the Gmail card. Pen icon, "Rather have it designed?", muted "The studio can take a plan
     from here and arrange every detail." Ochre link "Commission Friday" → `commission.html`.
  2. Bell icon, "Tell us how you like to travel—airlines, hotel style, budget—and we'll tailor every
     recommendation to match." Ochre link "Set it up" → `#/preferences`.
- Hairline, then the "TRIPS" label and the list of trips, newest `updatedAt` first: title, plus a date
  range (or "No dates yet") in muted text. Click opens `#/trip/id`; the current trip is highlighted.
  Hovering a row shows a dots button with a menu: Rename, Duplicate, Delete (confirm).
- Pinned at the bottom: a bordered pill button with a house icon, "Bombay · BOM" (from `prefs`),
  linking to `#/preferences`. **Not** an account or email.
- Under 900px: the sidebar becomes an off-canvas drawer with a scrim. A top-left burger in
  `.fx-main` opens it.

### Home (Shell). Screen 6. Content column max 1300px, padding clamp(24px,5vw,72px).
- **No trips yet:** render the **New trip** screen (below) in place of Home.
- **With trips:**
  - "Upcoming" (serif h1). A trip cover card (the plate fills the card; a gradient scrim; title in
    serif; date range; a pill "IN 12 WEEKS" in uppercase label style) for the soonest dated trip, or
    the most recent one. Clicking opens the trip. Beside it, the first hotel booking or plan stay: a
    card with a plate thumbnail, the name, "₹55,500 for 3 nights" (price × nights) and dates at the
    right. If there is none, a quiet dashed card "No stay booked yet — ask Friday to add hotels"
    opens the trip.
  - Hairline. "Continue exploring {area of the stay, or the first plan area}": a horizontal carousel
    of place cards (square plate, serif name, muted label) with prev/next circular buttons that
    scroll by one card width and disable at the ends. Clicking a card opens a place modal (plate,
    name, label, rating, blurb, "Save" toggle, "Add to {trip title}", which calls `plan.addItem` then
    navigates to the trip).
  - Hairline. "Recent" plus "View all →", which toggles the full list. Rows: a speech-bubble icon,
    the thread title and a muted time-ago, the trip title below. Click opens that trip with that
    thread active.

### New trip (Shell). Screen 13. Route `#/new`, and Home when there are no trips.
- A vertically centred column. The Friday **mark** stands in for the star logo: a serif "F" in a 64px
  ink circle with a small ochre dot. Below it, serif "Where are you headed?" (clamp 2rem–2.8rem).
- **Prompt box** (max 820px): it looks like the trip-view composer (textarea placeholder "Plan a trip to
  Goa for two…", image button, "Fast ⌄" mode menu, mic, round send) but larger. While focused it gets
  an ochre border and a soft **ochre focus ring**, `box-shadow: 0 0 0 4px rgba(176,85,45,.14)`, in
  place of Stardrift's light blue. Shell builds and styles this instance itself, using class names
  prefixed `fx-prompt`.
- **Photo cards**, one per `ORDER` destination, in a row that wraps (and scrolls horizontally on
  mobile). Each is a ~175px square **plate** (`FridayTrip.plate('card-'+id, dest.card)`) with a 12px
  radius and a soft shadow. They are tilted alternately between −2° and +2°, and on hover they lift
  with `translateY(-6px) rotate(0)`. Caption below in `ui-monospace` 14px (`card.caption`). Clicking
  a card fills the prompt with `dest.prompt` and submits it.
- **Submit:** call `FridayTrip.trips.create()` (with no destId), set `trip.mode` from the menu, run
  `router.go('#/trip/'+id)`, then call `FridayTrip.chat.send({text, mode, attachments})`. The trip
  is created only on submit: visiting `#/new` and leaving creates nothing.

### Bookings (Shell). Screen 7.
Serif title "Bookings" and an ink pill "+ Add booking" at the right. The list is grouped by trip.
Each row: type icon, name, dates, ref, price, and a delete button. Empty state, centred: a large
line-art suitcase SVG in ink and ochre (draw it, no image file), serif "No bookings found", muted
"Add flights, hotels and reservations by hand and they will appear on your trips.", and an ink pill
"Add a booking". The add form is a modal: type (segmented), name, trip (select), start, end, ref,
price. It validates and saves.

### Saved (Shell). Screen 8.
Serif title "Saved", a search input ("Search names, cities, or categories") that filters live, and a
round ink "+" button at the right with a menu: New list, Import a post. Lists appear as filter chips
("All" plus each list). Saved places show as a grid of cards (plate, name, label, destination), each
with a menu: Move to list, Remove, and "Add to trip…" (a submenu of trips with the same destId).
Imports appear as link cards. Empty state: a faint serif "F" mark, "Nothing yet.", "Save places
from the map and plan, or keep links from TikTok or Instagram.", and buttons "Import a post" (modal
with URL + note; a URL is required) and "New list" (prompt).

### Notifications (Shell). Screen 9.
Serif title. Rows: pin icon in an ochre-tinted circle, bold text, and time-ago at the right; below
that an ink button "Set home city", which opens a modal (city + airports as comma-separated IATA
codes, uppercased). Saving marks the notification done: the row shows "✓ Done" and the bell dot
clears. When a plan is applied, also push `"Friday updated {trip title}"` notifications with
"Open trip" buttons.

### Preferences (Shell). Replaces the profile (screens 10–12). No account fields.
Two columns. Left: serif "Your preferences", a house icon with the city, a plane icon with an IATA
chip, and an "Edit" button that opens the home-city modal. Right: "Travel preferences" card with an
"Edit" button that switches every row to inputs, then "Save" or "Cancel". Rows: Airlines, Hotels,
Hotel budget, Business travel, Other preferences; empty ones read "Not set". Then "Friday memory",
showing `memory` items (Chat adds one line per submitted clarifier, e.g. "Likes food and nightlife
trips"), each with a delete ×. Empty: "No memories yet. Start chatting to build your travel
profile!". Then a "Reset preview data" text button (confirm, then `store.reset()`).

### Trip view (Workspace). Screens 1–5. **Copy this layout exactly.**
- **Top bar** (56px, `--paper-2`, hairline bottom): when the sidebar is collapsed, a sidebar-toggle
  icon; the Friday wordmark (small, 1.5rem, links to `#/`); a hairline vertical divider; the trip
  title in serif 1.35rem. Click the title to rename it inline (Enter saves, Esc cancels). Right side:
  - **Share** (ink pill with share icon): a popover with a read-only link field (the current URL) and
    "Copy link" (clipboard, then a toast), plus "Print itinerary" (`window.print()`; add print CSS
    that shows only the plan).
  - **Activity** (users icon + "Activity"): a right-side drawer (360px) listing `trip.activity`,
    newest first, with who, text and time-ago.
  - **Dots** menu: Rename trip, Duplicate trip, New conversation, Reset map view, Delete trip.
  - No avatar.
- **Split:** left pane 50% (min 380px), a 1px draggable divider (drag to resize between 30% and 70%;
  persisted), right pane the rest.
- **Left pane:** a thread header row: thread title (click opens a menu of the trip's threads, with
  checkmarks, to switch between them) and a "+" square icon button at the right with a hairline left
  border (as in the screenshot), which calls `chat.newThread()`. Below it the scrollable thread
  `[data-thread]` (Chat renders into it). Then the **composer**, pinned at the bottom with a margin of
  16–24px: a rounded (16px) card with a hairline border and a white-ish `#FBF9F4` background. It
  holds an auto-growing textarea (placeholder "Send a message", max 8 rows). Bottom row: an image
  icon button at the left (opens a file input for images; selected files show as removable thumbnail
  chips above the textarea using object URLs, and they are sent as `attachments: [{name}]`). At the
  right: a **mode dropdown** button "Fast ⌄" that opens a menu with two options, each with a title,
  a muted description and a check on the active one:
  - **Fast**: "Quick answers and edits to your plan"
  - **Deep research**: "Reads widely, compares sources, then plans. Takes longer."

  It persists `trip.mode`. Next come a mic button (uses `webkitSpeechRecognition`/`SpeechRecognition`
  when available and appends the transcript. It pulses ochre while listening; when unsupported, a
  toast says "Voice input isn't supported in this browser") and a round send button: `--paper-3` and
  disabled when empty, ink when there is text; it turns into a **stop** square while
  `FridayTrip.chat.busy`. Enter sends and Shift+Enter adds a newline. The preview note goes under the
  composer.
- **Right pane,** top to bottom:
  1. The **map** `[data-map]`, height 38vh (min 240px). A chevron button at the bottom right
     collapses it to 0 and flips the chevron (`trip.mapCollapsed`). A small tab stays so it can be
     re-expanded.
  2. The **tab bar** (`--paper-2`, hairline bottom). Tabs: "Trip Overview", "Plan" (only when a plan
     exists), and custom tabs. The active tab has a `--paper` background and joins the content below,
     as in the screenshot. A "+" adds a custom tab (prompt for a name) that holds a notes textarea
     (autosaved); its tab gets a close × with confirm. At the right: a **history** icon (shown when
     versions exist) whose popover lists versions (summary + time-ago, "Restore") and "+ Add" (ink
     small pill), which opens the **Add item** modal: a search box over the destination's places,
     each result showing a mini plate, name and label, a day select, and an "Add" button, which
     calls `plan.addItem`.
  3. **Trip Overview** panel: "Bookings" (serif), a card listing the trip's bookings, or an empty
     state (mail icon in a `--paper-3` circle, "No bookings yet", "Flights and hotels you book will
     show up here.", and a hairline pill "Add a booking" in place of Connect Gmail, which opens the
     Shell's booking modal. Expose it as `FridayTrip.bookings.openForm(tripId)` if Shell provides it;
     otherwise it navigates to `#/bookings`). Then "Saved" (serif), a list of saved places for this
     destination (mini plate, name, label, and "Add to plan"), or "No items yet." in a hairline box.
     If the trip has a stay, also show a "Stay" row with price × nights.
  4. **Plan** panel:
     - The **banner** when `trip.banner` exists: a pale green tint `#E6EFE3` with a jade border and
       `#2F4C3C` text, a sparkle icon, "Friday updated your plan.", "↶ Undo" (calls `plan.undo`) and
       × (clears the banner).
     - **Area chips**: unique areas in plan order. Click scrolls to that area group.
     - For each run of consecutive days sharing an area, an **area header** row (`--paper-2`): pin
       icon + area name; a bed icon button when the plan stay is in that area (click calls
       `map.focus(stay)`); a collapse chevron.
     - **Day block**: a 3px left border in `dayColor(i)`. The header shows the uppercase weekday
       ("FRI"), the serif date "Dec 25" (or "Day 1" with no dates) and the muted town. At the right: a
       navigation icon (calls `map.focus` on the day's first place and fits the day's places) and a
       dots menu (Move up, Move down, Add item, Delete day).
     - **Items**: indented to align under the day title (as in the screenshot). The place name is an
       ochre link (click calls `map.focus(placeId)`); below it a muted label line "Bistro · ★ 4.6
       (8,164)" (stays show "Hotel · ₹18,500/night"); then the note; and a 110px square plate
       thumbnail at the right with a 3px radius. Hairline separators. Hover shows a grip handle for
       native drag-and-drop reordering, within and across days (`plan.moveItem`), and a dots menu
       (Save/Unsave, Move to day ▸, Remove). Hovering an item emits `plan:highlight`, and `map:focus`
       events scroll to and flash the matching item.
     - "+ Add item" hairline pill per day: an inline search input with a dropdown of the
       destination's places (not already in the plan). Choosing one adds it to that day.
     - "+ Add day" at the end.
  - **Empty trip** (no destination yet): the right pane shows a neutral map with no basemap (a paper
    field with a faint graticule and "Your map fills in as you plan" in serif italic), and the
    Overview panel.
- **Under 900px:** the sidebar is a drawer; the top bar keeps the title plus a Share icon and dots; a
  segmented control "Chat | Map & plan" under the top bar switches panes. The divider is hidden. The
  composer stays visible.

### Map (Map). Screens 1, 4, 5. **A live map, not a fixed one.**
- **Status: the live map is approved but deferred.** The MapLibre work in progress is in commit `fcc095e`. The current build uses the offline hand-drawn SVG map, restored from commit `67875f3`, which covers the six curated destinations. The rest of this section describes the approved live map, not what ships today.
- MapLibre GL JS is vendored at `assets/vendor/maplibre/` and lazy-loaded by `trip-map.js`. The tiles are OpenFreeMap vector tiles (no key), recoloured at runtime into Friday's riso palette. Attribution to OpenFreeMap and OpenStreetMap must stay visible.
- The map follows whatever destination the trip is about:
  - A curated destination fits `dest.map.bounds`, or the plan's places when there is a plan.
  - Any other destination is geocoded from `trip.destName` with Photon (komoot) and cached.
  - Plan items may carry their own `at: [lng,lat]`.
- The markers, stay price pill, dashed day routes, popover, layers toggle and Friday-styled controls are as in the screenshots. When the network is unavailable it falls back to a local paper-coloured style, so the markers still work.
- The data's `map.land/water/parks/roads/labels` fields are no longer used. Only `bounds` is read.

### Chat (Chat). Screens 1–5. The heart of the product.
Render `trip.threads[active].messages` into `[data-thread]`. The blocks:

- **Empty thread:** the serif greeting "Where to next?" (or "What should we change?" when a plan
  exists), a muted line, and 3 suggestion chips (sparkle icon) built from the destinations or the
  current plan.
- **User message:** a right-aligned bubble, `--paper-3` background, 12px radius, max 80%, 15px text,
  and attachment chips when there are any.
- **Assistant message:** full-width prose (15.5px, line-height 1.6, rendered with `util.md`). Blocks
  in order: text / tools / clarifier / research / report / suggestions. After a completed assistant
  turn, a row of icon buttons: copy (copies the text, then "Copied" toast), thumb up and thumb down
  (toggle filled, toast "Thanks for the feedback").
- **"Thinking…":** a muted shimmer line while waiting. Stream text word by word (about 18ms per
  word) and tool lines one by one (250–600ms apart). `stop()` halts streaming and marks the turn
  "Stopped". Scroll to the bottom as content arrives, unless the user has scrolled up.
- **Tool lines** (screen 5): `ui-monospace` 13px `--fg-mute`, with a ✱ glyph. Expandable ones have a
  chevron ›, and clicking one shows the details below it. For example, "Found 19 hotels in boutique
  hotels in North Goa India ›" expands a list of the stays with price/night and rating. "Updated
  todo list ›" expands a checklist. "Updated plan with 12 changes" is not expandable.
- **Clarifier card** (screens 1–4): a card with a 3px ochre top bar (the progress bar shows answered
  / total as an ochre fill on a `--rule-soft` track), a hairline border and a `#FBF9F4` background.
  The questions are stacked and separated by hairlines:
  - The **active** question shows an ochre dot and 16px text, then its input.
  - An **answered** question shows an ochre ✓, muted question text and the **bold** answer.
    Clicking it reopens it.
  - A **pending** question shows a grey dot and muted text.
  - Input types:
    1. **Month tiles:** "Any" plus the next 8 months starting with the current one. Each tile is
       "Sep" over "2026", about 90×96px, with a hairline border and 3px radius. Selected: ochre border
       plus a `--paper-3` fill. Single select.
    2. **Numbered options:** rows with a number box and a label. "Select all that apply" in the label
       style when multi. Selected rows get an ochre border, ochre text and a `#F6E9E1` tint. Number
       keys 1–9 toggle options while the card has focus.
    3. **Date range calendar:** a month header with ‹ › buttons, S M T W T F S, days outside the
       month muted, and a selected start and end as ink squares with paper text; the days between get
       a `--paper-3` tint. Clicking the start then the end selects a range; a third click restarts.
       Pre-fill the answered month and the requested length.
    4. Every input ends with a "Type something else…" free-text input; typing into it counts as the
       answer.
  - Buttons, right-aligned: "Let Friday decide" (hairline pill; picks a sensible default and records
    "You decide") and "Next →" (ink; disabled until answered). The last question instead shows
    "Submit answers ⌘↵" (ink, with the kbd glyphs in a lighter inner box). ⌘/Ctrl+Enter submits.
  - After submit the card collapses into the **summary** (screen 5): a bullet per question with the
    muted question and **bold** answer, then "✓ Submitted" in jade.
- **Research block** (Deep mode, in place of Fast's plain tool lines): a bordered card.
  - Header: sparkle icon, "Deep research", muted "· Goa, December 2026", and at the right an elapsed
    timer (0:14) and a collapse chevron.
  - A 2px ochre progress bar.
  - A vertical stepper of `deep.steps`: done steps get ✓, the active one a spinning ochre ring,
    pending ones a grey dot. Under the active step, the monospace tool lines stream in (from
    `deep.lines`, with sources), plus a row of up to 8 source "favicons" (circles with the domain's
    first letter, in dayColors) and "Reading 12 sources".
  - The whole run takes about 12–16s (sped up ×4 under reduced motion). When it finishes, the card
    collapses to "Researched 12 sources · 5 steps · 0:14 ›" (click to re-expand).
- **Report block** (Deep only, after research): serif h2 title, a summary paragraph, sections (serif
  h3 + body), and a comparison table (hairline rows, label-style header). `[n]` citations are
  rendered as small ochre superscript buttons; clicking one scrolls to and flashes the matching
  source. Then a "Sources" numbered list (title, muted domain, note) and a small hairline pill "Copy
  report".
- **Suggestions:** hairline pill chips with sparkle icons, wrapping. Clicking one sends it.

#### Conversation script (keyword routing on the lowercased message)
1. **Destination detection:** any `match` word of a destination. When the trip has no destId yet:
   set `destId`, `title = tripTitle` (unless renamed), the thread title = `threadTitle`, then emit
   'map:fit'. When the message names a different destination than the current trip's, reply that
   this trip is for {current}, with a suggestion chip "Start a new trip for {other}" that creates it.
2. **First planning request** (a destination and no plan yet, or "plan"/"trip"/"itinerary"): the
   clarifier with month, types (multi) and duration. On submit, save `trip.prefs`, add memory lines,
   then:
   - **Fast:** a "Thinking…" line (0.8s), the text `planIntro[type]`, tool lines
     ("Updated todo list ›", "Searched {n} places in {region} ›", "Created plan with {k} stops",
     "Updated todo list ›"), then `plan.apply` with days from the itinerary generator for the chosen
     types (day by day across several types; with a month but no exact dates, date = null and the
     header shows "Day n"), then `planDone`, feedback and
     suggestions.
   - **Deep:** the research block, then the report block, then `plan.apply` with a richer plan (4
     items a day, stays included), then a short text and suggestions.
3. **"hotel", "stay", "restaurant", "where to sleep":** the clarifier with dates (a range calendar
   in the chosen month, length = min(days, 14)) and base. On submit: set `prefs.dates`, date every
   day, and pick the stay (`stays.pick`, or one matching the base). The screen-5 sequence follows:
   `staysIntro`, the tool lines "Updated todo list ›", "Found {found} hotels in {query} ›"
   (expandable list), "Updated plan with {n} changes" (n = changed items), "Updated todo list ›",
   then `plan.apply` (the stay becomes the first item of day 1 with the note "Check in and settle
   in", plus two `extras.food` places added to fitting days), then `staysDone`, feedback and
   suggestions. Do not create bookings: only the user adds bookings.
4. "relax"/"slower"/"less": drop the `relaxedDrop` weakest items per day (keep ≥2) → plan.apply +
   `replies.relaxed`.
5. "food"/"eat"/"restaurant near"/"local food": add 2–3 `extras.food` places near the stay →
   `replies.food`.
6. "nightlife"/"bar"/"club"/"party": add `extras.nightlife` places to the evenings → `replies.nightlife`.
7. "reserve"/"book"/"booking"/"buy": `replies.reserve` (Friday's designers handle reservations; link
   to commission.html). No plan change.
8. "day {n}" + "remove"/"swap": a best-effort edit with a reply. Otherwise use `replies.fallback`
   plus suggestions.
9. No destination anywhere: "Where would you like to go? In this preview I can plan **Goa**,
   **Kerala**, **Rajasthan**, **Ladakh**, **Sri Lanka** and **Kyoto**.", with one chip per destination.

Every applied plan change goes through `FridayTrip.plan.apply`, so the Undo banner, history,
activity and map all update. Everything a turn produces is saved in the message JSON so it
re-renders identically after a reload, with no re-streaming: persist a finished flag. A reload in
the middle of a stream marks that turn "Stopped". Deep mode behaves the same for follow-ups (steps 3–6)
but runs a short research block (3 steps, about 6s) before the reply.

## Landing integration (Shell)
- `build/templates.js` Header: add an ink **"Plan a trip"** pill (`btn btn--sm btn--solid`) linking to
  `trip.html`, placed before "Commission" in `.nav`. In the mobile `.menu` "Begin" column, add a link
  "Plan a trip" above "Commission a journey".
- Home hero (`build/generate.js`, in `.hero__meta` next to the note): a `btn btn--solid` "Plan a trip
  with Friday →" linking to `trip.html`. It must be visible on the dark hero (use paper text on ink,
  or the inverse styles already used there).
- `trip.html` `<title>`: "Plan a trip · Friday". Description: "Friday's trip planner: a conversation
  on the left, a living plan and map on the right."
- Update README: the page count, a "Planner" section describing the files, and the scripted-preview
  note.

## Itinerary generator and server

Itineraries are **generated from the place catalog**, not scripted per destination. The
destination files hold places (kind, area, rating, coordinates, blurb) and areas (coordinates and a
`town` label); nothing in them lists a day.

### The generator (`assets/js/trip-generator.js`)

`generate(dest, opts)` returns `{ days: [{ id, area, town, date, items: [{ id, place, note }] }], stay }`,
the plan shape the rest of the UI already stores. `opts`: `types` (trip-type labels from
`clarify.types.options`), `days` (1 to 21), `pace` (`relaxed` 2 stops a day, `normal` 3, `full` 4),
`dates: { start }` or null, `base` (a `clarify.base` label), `stay` (`false` for none, or a stay id),
`travel` (an item put first on day 1), `uid(prefix)` for ids (default: deterministic counters).

- **Scoring:** a place scores `weight[kind]` from the trip type's profile, times a rating factor.
  Profiles, the label-to-profile map, pace, time of day and slot phrasing are all in
  `build/trip-data/trip-types.js` (in the browser: `FridayTrip.TRIP_TYPES`). A destination may
  override a label with `tripTypes`.
- **One area a day:** each day takes the area whose best unvisited places score highest, nudged toward
  the previous day's area. If an area has fewer places left than the day needs, the day fills from
  the nearest areas by coordinates. A place is not used twice until the catalog is exhausted.
- **Order:** stops are sorted by when their kind suits the day (sights, nature and markets in the
  morning, food at midday, a second food stop at dinner, nightlife last).
- **Notes:** the place's blurb plus a slot phrase from the table. Nothing is written per day.
- **Acclimatisation:** a destination with an `acclimatisation` rule (Ladakh) starts with a gentle
  rest day in the arrival area and keeps the high areas for day 4 onwards (day 6 for the slow trip type).
- **Stay:** `pickStay(dest, base)`: the `stays.byBase` match, else the best word match, else the
  best-rated stay (a small bonus for the first day's area; never a high camp in an acclimatising
  destination).
- **Deterministic:** the seed is the destination, types, days and pace. The same inputs give the same plan.

`trip-chat.js` `buildPlan` calls it locally and synchronously: that is the offline fallback.

### The server (`server/`)

`npm start` (and `npm run dev`) runs `server/app.mjs` on `PORT` (default 4871): the static site
(only generated pages and `assets/`; dotfiles, `node_modules`, `server/` and `tests/` are never served; paths
that resolve outside the repo are refused) plus the JSON API. Node built-ins only. Config is read from the
environment (`node --env-file-if-exists=.env`, see `.env.example`). The itinerary routes below need no
account; the research and account routes are described in the README.

| Route | |
| --- | --- |
| `GET /api/health` | Public. `{ ok, itineraryProvider, knowledge: { sources, chars } }` |
| `GET /api/destinations` | `{ destinations: [{ id, name, tripTypes, durations }] }` |
| `GET /api/destinations/:id` | The catalog: areas, places, trip types, durations, stays, acclimatisation. 404 if unknown |
| `POST /api/itineraries` | Body `{ destination, types?, days, dates?: { start }, pace?, base? }`. 201 `{ id, provider, plan, fallbackReason? }`. 400 on bad input, 404 on unknown destination, 413 over the body limit (64 KB) |
| `GET /api/itineraries/:id` | The saved record `{ id, createdAt, request, provider, plan, fallbackReason? }`. 404 if unknown |

**Providers** (`server/itinerary/providers/`, not to be confused with `AI_PROVIDER`, which selects the Claude or Perplexity research provider in `server/providers/`): `ITINERARY_PROVIDER` is `local` or `openai`; unset means openai
when a credential is configured, else local.

- `local` wraps the shared generator. No network, no credentials.
- `openai` calls the Chat Completions API with `fetch` and a JSON-schema response format. The model
  is given only place ids, names, kinds and areas (no blurbs, ratings or coordinates) and asked to
  choose and order places and write short notes. Every returned id is checked against the catalog;
  unknown ids, hotels and repeats are dropped. On any error, timeout (`OPENAI_TIMEOUT_MS`, 30 s), or
  a response that cannot make the requested number of days, the server uses `local` and answers
  `provider: 'local'` with a `fallbackReason`. The key is never logged or returned.
- Credentials come from a separate source, `server/itinerary/providers/openai-auth.mjs`, chosen by `OPENAI_AUTH`
  (default `api-key`, reading `OPENAI_API_KEY`). A source implements `getAuth() -> { baseUrl, headers } | null`.
  There is no sign-in flow.

**Storage:** itineraries live in the SQLite `itineraries` table (`user_id` is the signed-in owner, or null for
a signed-out visitor), read and written through `saveItinerary` and `getItinerary` in `server/store.mjs`.
`GET /api/itineraries/:id` returns a record to anyone who holds its unguessable id.

Environment: `PORT`, `HOST`, `DATABASE_PATH`, `ITINERARY_PROVIDER`, `OPENAI_AUTH`, `OPENAI_API_KEY`, `OPENAI_MODEL`
(default `gpt-5-mini`), `OPENAI_BASE_URL`, `OPENAI_TIMEOUT_MS`, `KNOWLEDGE`, `KNOWLEDGE_DIR`, `KNOWLEDGE_MAX_CHARS`, `KNOWLEDGE_SECTIONS`.

### House knowledge

The OpenAI provider can be given a travel company's planning skill file and reference notes (prompt
text only, no fine-tuning). Put `SKILL.md` and `references/*.md` in the knowledge folder
(`KNOWLEDGE_DIR`, default `server/knowledge/kusum`, relative to the repo root). They are read once at
startup and appended to the provider's system prompt after a fixed preamble that tells the model to
use them as planning principles only (no prices, quotes, bookings or supplier contact; diet and
culture only when the traveler stated them; sample lessons are history, not templates).

- **Included:** from `SKILL.md` (front matter removed) only the `## ` sections named in the allowlist
  (default: Procedure, Pitfalls, Sightseeing specificity, Indian traveler knowledge, Sample evidence;
  override with `KNOWLEDGE_SECTIONS`, a comma list); every `references/*.md` file, sorted by name.
- **Excluded:** all other `SKILL.md` sections (delivery documents and logos, supplier portals, browser
  sessions, email, calls, supplier confirmation, quote verification), and any line mentioning a local
  path (`/Users/`, `Downloads/`, `C:\`).
- **Redaction:** honorific plus name (`Mr. X Y`, `Mrs X`, `Dr X`...) becomes `[client]`; `.pdf` and
  `.docx` file names become `[sample file]`.
- **Size:** `KNOWLEDGE_MAX_CHARS` (default 60000). Over the cap, SKILL sections go in first, then
  references in order; what does not fit is left out.
- **Off / missing:** `KNOWLEDGE=off` disables it; a missing or empty folder is fine. The server logs
  `knowledge: N files, M chars` or `knowledge: none` (never the contents), and `GET /api/health`
  reports `knowledge: { sources, chars }`.

Only the OpenAI provider uses it; the local generator is unaffected.

### The planner uses it when it is there

When the page is served over http(s) and `GET api/health` answers, the first plan is requested with
`POST api/itineraries` (started as soon as the clarifier is submitted, so it is ready when the
research block finishes). The response's places are checked against the catalog, given fresh ids, and
the flight item is put back on top. On `file://`, with no server, on a timeout, or on any error,
the same plan is built in the browser by the generator. The trip itself is saved only in
`localStorage`; the saved server-side itinerary is a record of what was generated.

### Use your ChatGPT plan

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

Code: `assets/js/trip-chatgpt.js` (browser module, UMD so tests load it in Node), `server/itinerary/chatgpt.mjs` (config), `build/trip.js` (callback page), tests in `tests/chatgpt.test.mjs`.

Tests: `npm test` (`tests/generator.test.mjs`, `tests/itineraries.test.mjs`, `tests/openai.test.mjs`, `tests/knowledge.test.mjs`, and the account, hardening and integration suites).

## Trip storage in Hexclave

Optional, off by default. Planner trips (the `records` rows of kind `trips`, i.e. what `/api/trips` reads and writes) can be
kept in a [Hexclave](https://hexclave.com) Data Vault instead of SQLite. This is an owner decision and covers the Data Vault
only: there is no Hexclave sign-in and no other Hexclave app. Sign-in stays Friday's own accounts.

**What is stored where**

| Data | Where |
| --- | --- |
| Users, sessions, profiles, password hashes | SQLite |
| Places, lists, bookings, memories, alerts, imports | SQLite |
| Research jobs, share links (token hash, owner, trip id, expiry), itineraries, Google tokens | SQLite |
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
