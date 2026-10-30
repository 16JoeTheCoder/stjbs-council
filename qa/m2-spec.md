# M2 spec conformance

Evidence is file:line at commit bf31f48. DONE / PARTIAL / MISSING / LATER (belongs to M3+ per docs/plan.md section 9, not a gap). Checked live: `npx vite build`, `node scripts/check-site-bundle.mjs` (ok, 2 chunks), Hosting emulator (qa/firebase.host.json).

## Architecture

| # | Requirement | Status | Evidence |
|---|---|---|---|
| A1 | Two Vite entry points, `/` public and `/app/` dashboard | DONE | vite.config.js:8; dist/index.html and dist/app/index.html built |
| A2 | Public page: no sign-in, no Firebase SDK | DONE | src/site.jsx imports only shared.jsx, feed.js, time.js; check-site-bundle.mjs passes; qa test greps for "firebase" in every reachable chunk |
| A3 | Hosting serves both, `/assets/**` cache header kept | DONE | firebase.json:6-19. Hosting emulator: `/` 200 public, `/app/` 200 dashboard, `/app` 301, manifest 200 |
| A4 | No Hosting rewrites | DONE | firebase.json has no `rewrites` |
| A5 | Old `/#/week` lands on `/app/#/week` via inline `location.replace` in head | DONE | index.html:8-12 (also installed-app case, plan 2.5) |
| A6 | Manifest linked only from app/index.html, `"id": "/"`, scope `/app/`, start_url `/app/#/week` | DONE | app/index.html:9; public/manifest.webmanifest; index.html has no manifest link |
| A7 | Theme script copied into app/index.html | DONE | app/index.html:17-20 |
| A8 | Theme colour `#0A0A0C` in manifest and both heads | DONE | manifest, index.html:16, app/index.html:7 |
| A9 | Hero images imported through Vite, not `public/img/` | DONE | site.jsx:7-8 import from design/fiatlux/img; no public/img |
| A10 | Public site reads `public/feed` over REST, project id from env | DONE | site.jsx:14-17 (adds `?key=`, a declared deviation, plan 3) |
| A11 | Emulator URL when `VITE_EMULATORS === '1'` | DONE | site.jsx:15 |
| A12 | Parse `json` string and `updatedAt` | DONE | site.jsx:23,31-33 |
| A13 | One read per visit, no listeners | DONE | site.jsx:31. A 5-minute localStorage reuse (site.jsx:26-30) lowers it further; not in the spec, harmless |
| A14 | Fetch fails: last copy from localStorage plus quiet "Updated earlier" | DONE | site.jsx:38-40,74 |
| A15 | No copy: static page without live section | DONE | site.jsx:78-80 |
| A16 | Admin "Publish now" button on Public site admin screen | PARTIAL | `publish(true)` exists (publish.js:33) but no button or screen anywhere (grep). Plan puts admin screens in M5: LATER, but nothing can force a publish until then |
| A17 | Auto-publish on open, then every 10 min, admin roles in either view | DONE | publish.js:85-92; app.jsx:37-38 |
| A18 | Write only if hash differs from stored `hash` | DONE | publish.js:34 (local pre-check), :45 (fresh check) |
| A19 | Skip while `S.error` or not `loaded()` | DONE | publish.js:29 |
| A20 | One `public/feed` listener, admin sessions only | DONE | store.js:128-129 |
| A21 | Payload whitelist: projects (title, stage, pct, done, total, blurb, updatedAt) | DONE | feed.js:19, publish.js:16-20 |
| A22 | Payload whitelist: public events from today (title, type, date, start, end, location) | DONE | feed.js:20-22 |
| A23 | Payload whitelist: everyone announcements, `endDate >= today`, future starts (title, body, startDate, endDate) | DONE | feed.js:23-24 |
| A24 | Public page re-filters by Jakarta today | DONE | feed.js:28-32; site.jsx:49 |
| A25 | Shows "Last change n min ago" | DONE | site.jsx:74, feed.js:41 |
| A26 | No names, emails, initials, comments, check-ins, task titles | DONE | whitelist in feed.js; qa tests confirm no leak. Activity text "published the public site" goes to member-only `activity`, not the feed |
| A27 | Rules: feed readable by anyone, writable by admins only, json <= 200000 | DONE | firestore.rules:232-238 (`get` only, no list) |
| A28 | No Cloud Storage | DONE | no storage import anywhere |
| A29 | "Updated 3 min ago" label with `fl-live` dot | DONE | site.jsx:74 |

## Read budget

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Events listener -7 to +60 days | DONE | queries.js:6-9 |
| R2 | Announcements `endDate >= today` | DONE | queries.js:10-11 |
| R3 | Document templates listener | DONE | store.js:122 |
| R4 | Ideas only on laptop Home and Ideas route (limit 20) | LATER | M4; no ideas code yet |
| R5 | RSVPs only when an event sheet is open | LATER | M4 |
| R6 | Submissions and archive only in admin view | LATER | M5 |
| R7 | No count queries over unloaded collections | DONE | none present |
| R8 | New listeners out of `loaded()`, own error state | DONE | store.js:63 (loaded is items, checkins, members); store.js:56-61 `optional` writes `S.fail[key]` |
| R9 | Day-scoped listeners restart on Jakarta date change inside the 60 s interval | DONE | store.js:89-95,106-110 |
| R10 | Read arithmetic in the plan | DONE | docs/plan.md section 6.4 |
| R11 | Indexes listed and in firestore.indexes.json | DONE | firestore.indexes.json: items, events, announcements, ideas, submissions, cache/public overrides |
| R12 | Persistent multi-tab cache; cleared on explicit sign-out only | DONE | firebase.js:16; store.js:145-149; auto no-roster sign-out does not reload (store.js:126) |
| R13 | Item snapshot document plus delta, fallback to full listener | DONE | store.js:67-87 |
| R14 | Snapshot JSON leaves out empty default fields | PARTIAL | publish.js:74-75 stringifies the full row. Plan 6.2 promised the trim; only costs size (minor) |
| R15 | Activity loaded only on `#/activity`; unread from loaded 50 | DONE | feed.jsx:17 own listener; store.js:35, app.jsx:35 "50+" |
| R16 | Quota message with Jakarta reset time | DONE | store.js:38-43 |
| R17 | Snapshot rebuild: fresh server read, 6 h retry, 24 h on full, delta > 50, stale 24 h, bulk | DONE | publish.js:60-83, actions.js:73 |
| R18 | Rebuild trigger counts stale items the same way on the fallback path | PARTIAL | when the delta query fails and the full listener takes over, `cacheInfo.delta` stays 0 (store.js:75,81-86), so only the 24 h age triggers a rebuild. Minor |

## Publishing detail (plan 6.5)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| P1 | Skip unless events, announcements, feed ready, no fail, all from server | PARTIAL | publish.js:29 checks cached for items, events, announcements but not `S.cached.feed`. Harmless, because publish re-reads the feed from the server (publish.js:42). Minor |
| P2 | Fresh server re-read of public roots, events, announcements, feed before writing | DONE | publish.js:38-43 |
| P3 | Skip write if fresh hash equals stored; "Publish now" bypasses | DONE | publish.js:45 |
| P4 | Activity "published the public site" | DONE | publish.js:48 |
| P5 | Task counts from store only | DONE | publish.js:15-19. A root absent from the store would publish 0 of 0 (accepted in plan) |
| P6 | Publish error shown to admins ("unpublished changes / last error") | LATER | state `publishError` set (publish.js:50,53); Overview is M5. Cache errors reuse the same field (publish.js:82), which will muddy that message (minor) |

## Public site screen

| # | Requirement | Status | Evidence |
|---|---|---|---|
| S1 | Top bar: crest, Home, Events, Projects, About, red Dashboard button to `/app/` | DONE | site.jsx:55-62 |
| S2 | `fl-hero--tall` with building.webp, "Lead. Serve. Build.", Explore our work to Live, Join us to join section | DONE | site.jsx:65-75; `#join` in footer site.jsx:100 |
| S3 | Announcements, same component as Home, everyone only | DONE | shared.jsx `Announcements`; site.jsx:77. Home will reuse it in M3 |
| S4 | "What we are working on now" with public project cards | DONE | site.jsx:79-88, shared.jsx `PublicProject` |
| S5 | Coming up: public events | DONE | site.jsx:90-100 |
| S6 | Mission strip and footer | DONE | `Mission` shared.jsx; site.jsx:102,107-113 |
| S7 | Only the Live section depends on the feed | PARTIAL | Announcements and Coming up also read the feed, which the prompt's own bullets require (announcements on the public page). Static copy renders without it |
| S8 | Mission messages cycle by arrow, no auto-rotation | DONE | shared.jsx Mission |
| S9 | Works on phones, light theme | LATER | needs screenshots (M5); not checked here |

## Later, not missing

- Design restyle of the dashboard: src/main.jsx:2 still imports `design/builtbyjosef`, `jy-` classes remain, `design/builtbyjosef/` and `jy-check.sh` still exist (M3).
- `npm run check` still runs `bash scripts/jy-check.sh` (package.json:12) and does not run `check-site-bundle.mjs`; the script's own comment says it does. The plan assigns the wiring to M3. Until then the bundle check is run by hand only (minor).
- `public/favicon.svg` and old icons remain (M3). Playwright and Lighthouse devDependencies absent (M5). Shell, Calendar, Ideas, RSVPs, admin screens, seed additions (M3 to M5).

## Blockers and majors

None blocking. One flagged as major-by-timing only: no way to trigger "Publish now" (A16) until the M5 admin screen. Everything else is minor.

## Quiet shortcuts looked for

- No TODO or FIXME in src. No placeholder data in site.jsx or the feed path.
- `?key=` on the REST call, the 5-minute public-side reuse and the store-only task counts are not shortcuts but are not in the prompt text; all three are in docs/plan.md or harmless.
