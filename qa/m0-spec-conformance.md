# M0 spec-conformance: docs/plan.md versus qa/PROMPT.md

Checker: independent, no knowledge of how the plan was written. Plan reviewed: `docs/plan.md` (190 lines, commit 365adc7). Existing code read only to verify the plan's factual claims. No project file was edited.

Status key: DONE = addressed concretely. PARTIAL = mentioned but vague, incomplete or deviating (a declared deviation is marked "declared deviation"). MISSING = not addressed.

## (a) Requirement table

### Keep list

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| K1 | My week tasks and filters (All, Mine, Due soon, Overdue, Blocked, Done, Hide done) | DONE | Plan section 3 keep-mapping: "My week filters -> All my tasks page"; `home.jsx` row; route `#/tasks` |
| K2 | Project tree, drill-down, breadcrumbs | DONE | Section 3 `projects.jsx`: "drill-down, task form and deals unchanged"; route `#/p/{id}` |
| K3 | Subteams and leads with `leadUids` propagation | DONE | Section 3 keep-mapping; section 9 "Lead-change batches (G1-09) ... unchanged"; items rule left unchanged |
| K4 | Task editing with assignee-only field limits | DONE | Section 4 `items` row says "assignee limits stay" via the PROMPT; update cell adds only the public check; existing rule firestore.rules:63-66 untouched |
| K5 | Deals (stage bar, pledged and received IDR, deal table) | DONE | Section 3 `projects.jsx` "deals unchanged"; `app.css` row lists "deal stage bar" |
| K6 | Weekly check-in (done, doing, blocked, due Friday 23:59 Jakarta) | DONE | Section 3 `meeting.jsx` "Check-in form ... behaviour unchanged"; route `#/checkin`; Home panel |
| K7 | Meeting swimlane view | DONE | `meeting.jsx` restyle; route `#/meeting/{id}`; `app.css` "swimlanes" |
| K8 | Comments | DONE | `ui.jsx` row "Comments with @mention autocomplete" |
| K9 | In-app notifications and unread bell | DONE | `app.jsx` row "bell"; route `#/activity` |
| K10 | Activity feed | DONE (see F9) | `feed.jsx` restyle, route `#/activity` alias `#/feed`; made lazy (section 6) |
| K11 | People list, org chart, team chart | DONE | `committees.jsx` row: "Sections as chip groups, org chart, team chart (choose a project), person page" |
| K12 | Timeline | DONE | `views.jsx` restyle; `app.css` "timeline bars" |
| K13 | Workload table and weekly snapshots | DONE | `workload.jsx` -> `#/admin/workload`; section 6 counts the Workload `getDocs` |
| K14 | Digest builder with WhatsApp share | DONE | `digest.jsx` "Unchanged logic"; route `#/digest` and `#/admin/digest` |
| K15 | Project templates (JSON import, export, AI prompt) | DONE | `templates.jsx` "rendered inside Resources for exec" |
| K16 | Roster admin | DONE | `admin.jsx` row |
| K17 | Close term with forced backup | DONE | `admin.jsx` "close term (backup adds every new collection)" |
| K18 | Install-app button and iPhone instructions | DONE | Keep-mapping: "sign-in plus Settings" |
| K19 | Light and dark themes | DONE | Keep-mapping "Themes -> Settings"; `settings.jsx` row |
| K20 | Emulator demo (`npm run demo`) | DONE | `seed-emulator.mjs` row; keep-mapping "unchanged" |
| K21 | Rules tests (`npm run test:rules`) | DONE | `tests/rules.test.mjs` row, section 4 test list |

### Delete or replace

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| D1 | Delete `design/builtbyjosef/` | DONE | Section 3 row "delete / Whole folder" |
| D2 | Remove builtbyjosef block from `CLAUDE.md`; rewrite to short council block | DONE | `CLAUDE.md` row lists all five required elements |
| D3 | Delete `scripts/jy-check.sh` | DONE | Section 3 row |
| D4 | Remove signature on About page | DONE | `about.jsx` delete: "The builtbyjosef signature goes" |
| D5 | Remove every `jy-` class | PARTIAL | No row or milestone owns the sweep. About 340 `jy-` lines across src (`grep -c`: projects 54, ui 43, templates 33, auth 25, meeting 24, admin 23 ...). Only `npm run check` would catch it (see F1) |
| D6 | `git mv designsystem design/fiatlux`, folder `designsystem/` gone | DONE | Section 3 row "move"; M3 scope |
| D7 | Import `tokens.css` then `components.css` once in the entry | PARTIAL | Only `src/main.jsx` row. `src/site.jsx` and `app/index.html` CSS import not stated (F11) |
| D8 | App CSS in small `src/app.css`, tokens only, `fl-` prefix | DONE | `app.css` row "`fl-` only, tokens only" |
| D9 | Build in app.css: timeline bars, swimlanes, org chart, deal stage bar, filter chips with counts, breadcrumbs, `fl-scroll` | DONE | `app.css` row lists all seven |
| D10 | `preview.html` inline styles replaced by classes | MISSING | Not mentioned anywhere in the plan |
| D11 | `design/fiatlux/design-check.sh` wired to `npm run check` | DONE | `scripts/jy-check.sh` and `package.json` rows. File already exists at designsystem/design-check.sh |
| D12 | Regenerate icons and favicon from `crest.png`, crest centred on `#0A0A0C`, maskable with safe padding | DONE | `make-icons.cjs` row (192, 512, 180, maskable 512 with about 20 % padding, favicon-48) |
| D13 | Theme colour `#0A0A0C` | DONE | `app/index.html` and manifest rows |
| D14 | Update `docs/brief.md` design and scope sections | DONE | `docs/brief.md` row |
| D15 | Remove "every trace" of builtbyjosef | PARTIAL | `docs/qa/*.md` is "keep" although it mentions builtbyjosef (`grep -l`: code-check.md, design-check.md, lessons.md); `README.md`, `package.json` are covered. See F12 |

### Architecture

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| A1 | One repo, two Vite entry points (`/` public, `/app/` dashboard) | DONE | `index.html`, `app/index.html`, `vite.config.js` rows |
| A2 | Public site: no sign-in, no Firebase SDK | DONE | `shared.jsx` "Firebase-free"; section 2 item 10. "Its own tiny script" becomes Preact, declared in section 2 item 10 |
| A3 | Hosting serves both, keep `/assets/**` header | DONE | `firebase.json` row: keep; to be verified at M2 with hosting emulator |
| A4 | No Hosting rewrites | DONE | `firebase.json` row "No rewrites needed" |
| A5 | Old link `/#/week` -> `/app/#/week` via inline `location.replace` in public head | DONE | `index.html` row; section 2 item 5 refines to hashes starting `#/` |
| A6 | Manifest linked only from `app/index.html`, `"id": "/"`, scope `/app/`, theme script copied | DONE | `app/index.html` and manifest rows. Note: today's manifest has no `id` field (public/manifest.webmanifest), so the PROMPT's "keeps" is slightly wrong and the plan does not say so (F13) |
| A7 | Hero images imported through Vite, not `public/img/` | PARTIAL | Section 2 item 4 only. No file row says where the images are imported (`home.jsx`, `site.jsx`, `auth.jsx`) |
| A8 | Public site reads `public/feed` by REST (projectId from env; emulator URL when `VITE_EMULATORS === '1'`), `JSON.parse` of `json` | PARTIAL | `site.jsx` row says "REST fetch". Env project id and emulator URL not stated |
| A9 | On fetch failure show `localStorage` copy with "Updated earlier"; else static page without live section | PARTIAL | `site.jsx` row says "`localStorage` fallback". "Updated earlier" note and no-copy case not stated |
| A10 | Admins see "Publish now" on Public site admin screen | PARTIAL | `admin-views.jsx` row lists "Public site"; button, preview card, switches, last-published time not described |
| A11 | Auto-publish when admin opens the dashboard and every 10 minutes; write only if hash differs | PARTIAL | `model.js` "payload builder plus hash (crypto.subtle)"; section 2 item 6 assumes "opening the dashboard auto-publishes". The 10-minute timer and the hash comparison against the stored `hash` are not stated |
| A12 | Skip auto-publish while `S.error` is set or `loaded()` is false | MISSING | No mention (F3) |
| A13 | One `public/feed` listener, admin sessions only | DONE | `store.js` row "`public/feed` for admins only"; section 6 "1" read |
| A14 | Payload built from store with explicit field whitelist for three types (public root projects, public events from today, everyone announcements with `endDate >= today`) | MISSING | No whitelist, no field list, no filter rules anywhere in the plan (F2). Only section 2 item 7 mentions the event window |
| A15 | Public page re-filters by Jakarta today; shows "Last change n min ago" | DONE | `site.jsx` row "Jakarta re-filter, 'Last change n min ago'" |
| A16 | Never put names, emails, initials, comments, check-ins or task titles in payload; reviewers confirm | PARTIAL | Q1 covers the document-level `updatedByUid` leak (good catch). No payload-leak plan; free-text titles of public items are not discussed (F8) |
| A17 | `public/feed` rule: anyone reads; advisor, president, VP write; `json.size() > 200000` rejected; fields json, hash, updatedAt, updatedByUid | PARTIAL | Section 4 feed row matches except `updatedByUid` dropped. Declared deviation (Q1), well argued |
| A18 | No Cloud Storage, no Functions; Google links only | DONE | README row "no Functions, no Storage"; `submissions` rule `google(u)` |

### Read budget

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| B1 | Cold-open estimate by source | DONE | Section 6 table. Recomputed: 30+400+52+60+3 = 545 existing; plus 26 new listeners; plus 21 admin or laptop-only; about 592. Plan says "about 590". Correct |
| B2 | Events listener -7 to +60 days | DONE | Section 5 row; section 6 "15" reads. Month-view overflow via `getDocs` is a declared resolution (section 2 item 1) |
| B3 | Announcements `endDate >= today` | DONE | Section 5 row |
| B4 | Document templates listener | DONE | Section 5 and 6 |
| B5 | Ideas only on laptop Home and Ideas route, limit 20 | DONE | Section 5 row (limit 20), section 6 "laptop Home only". Top-ranking deviation declared (section 2 item 2, "top of the 20 newest") |
| B6 | RSVPs only when an event sheet is open | DONE | Section 5 row; calendar.jsx row |
| B7 | Submissions and archive only inside admin view | DONE | Section 5 admin-view row |
| B8 | No count across a collection not already loaded (e.g. comment counts) | MISSING | Not stated; nothing in the plan violates it |
| B9 | New listeners stay out of `loaded()` | MISSING | Not stated in `store.js` row or anywhere (F5) |
| B10 | Day-scoped listeners restart on Jakarta date change in the existing 60 s interval | DONE | `store.js` row "The day-rollover restart goes in the existing 60 s interval" |
| B11 | Arithmetic: reads per cold open x opens per day x 30 members, incl. Workload `getDocs` | DONE | Recomputed: 590 x 3 x 30 = 53 100 (ok). Workload 26 x 20 + 20 = 540, x3 = 1 620 (plan 1 600 ok). Extras 1 600+600+500+300 = 3 000, total 56 100 (plan "about 56 000" ok). Cache saving one third of 53 100 = 17 700 (plan "about 17 000"), leaving 38 400 to 39 100 (plan "about 39 000" ok). Opens per day = 3 and "a third within 30 minutes" are invented assumptions, disclosed |
| B12 | Persistent cache only if arithmetic exceeds 30 000; exact one-liner | PARTIAL | Declared deviation (Q3): adds `persistentMultipleTabManager`, terminate plus `clearIndexedDbPersistence` on sign-out. Where the sign-out code lives is not in any file row (F10) |
| B13 | List every new query with composite index; add to `firestore.indexes.json`; flag in PR | DONE | Section 5. Indexes (termId, archived, date), (termId, archived, endDate), (termId, archived, createdAt desc) are correct for the queries. Existing activity index matches `firestore.indexes.json` exactly |

### Roles

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Advisor everything; only one who sets `settings/current` and assigns or removes advisor | DONE | Section 4 members row "advisor any"; settings unchanged (firestore.rules:101) |
| R2 | VP: add members, change any role and active flag except advisor's and own, never assign advisor | PARTIAL | Section 4: create "vp any role except advisor", update "neither the old nor the new role is advisor". Today's VP rule forbids `active` changes (rules:34); the plan never says that restriction is removed (F7). Q2 flags the VP/president hierarchy (declared) |
| R3 | President: add only officer, treasurer, secretary, teacher; edit name, section, reports-to; no role or active change; cannot create VP, president, advisor | DONE | Section 4 members row |
| R4 | President update uses `changed().hasOnly(['name','section','reportsTo','initials','termId','updatedAt'])` | DONE | Section 4 members update cell, exact list |
| R5 | Treasurer, secretary, officer, teacher unchanged | DONE | No change to those paths |
| R6 | Close term visible to advisor only | PARTIAL | `admin.jsx` row says "plus close term" without stating advisor-only (F7) |
| R7 | Update rules, Admin UI, tests; keep "no one changes own role or active flag" | DONE | Section 4 members row, section 3 `admin.jsx`, roster test matrix |
| R8 | Factual claim: today the president can change roles and only the advisor deactivates | DONE | Verified: rules:28-30 president may change roles except advisor; rules:30 and :34 forbid `active`; admin.jsx:108 shows Deactivate for advisor only |

### Navigation

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| N1 | Laptop rail: crest lockup, Home/Calendar/Projects/Committees/Resources, photo card | PARTIAL | `app.jsx` row says "rail" only. Photo card missing, nav items implicit in route table |
| N2 | Top bar: "Search anything" left; bell with unread dot plus count; avatar menu | PARTIAL | `app.jsx` row "top bar, bell, avatar menu, search". Dot plus count not stated |
| N3 | Phone: no rail, top bar crest/bell/avatar, search on own row | PARTIAL | Only "phone tab bar" |
| N4 | Floating bottom bar: Home, Calendar, Projects, Ideas, More; active tile red | PARTIAL | Named only as "phone tab bar"; tiles not listed |
| N5 | More sheet: Committees, Resources, Digest for exec | PARTIAL | `app.jsx` "More sheet"; contents only implied by keep-mapping "Digest -> More sheet" |
| N6 | Admin on phone: admin sections as link list at top of Overview, and in More | MISSING | Not mentioned (F4) |
| N7 | Avatar menu: My profile, Settings, Switch to admin view (admins only), Sign out | PARTIAL | Only `settings.jsx` content is described |
| N8 | Admin choice remembered in `localStorage` | PARTIAL | `model.js` "admin-view flag"; storage not stated |
| N9 | Where today's screens go (Home, Committees, Projects sub-views, Feed -> bell, check-in from Home, Digest action, templates in Resources) | DONE | Section 3 keep-mapping and section 7 route map |
| N10 | Admin shell: red "Admin view" badge, own rail, "Switch to member view", `#/admin/...` routes | PARTIAL | Routes yes (section 7); badge and switch not described |
| N11 | Admin Overview: needs-attention list only (announcements ending in 3 days, pending submissions, members missing check-in with "Copy reminder", unpublished changes, who has admin) | MISSING | `admin-views.jsx` row says only "Overview"; section 2 item 6 discusses "unpublished public changes" (F4) |
| N12 | Admin sections: Announcements, Members and roles, Check-ins and workload, Public site, Approvals and archive, Digest | DONE | Section 7 route rows for `#/admin/...` |
| N13 | Public site admin screen: per-project switches, preview card, Publish now, last published time | PARTIAL | Row names the screen only (see A10) |

### Screens

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| S1 | Home content: hero with Jakarta greeting and first name, announcements, Needs you (5), Today's agenda (5), check-in red panel, My projects (3, `fl-steps` max 5), mission card, top ideas | PARTIAL | `home.jsx` row: "Home, plus the All my tasks page". Only the greeting hour (time.js row) and ideas read are specified. No section list |
| S2 | Length budget (1.5 laptop screens, 5 phone screens, 5-row cap with "see all") | MISSING | Not mentioned |
| S3 | Announcements component: 0/1/2-3 forms, max 3, click opens `fl-sheet` | DONE | `shared.jsx` row "Announcements (0, 1 or 2 to 3 forms, sheet)" |
| S4 | Task filter bar moves to "All my tasks" | DONE | `home.jsx` row, route `#/tasks` |
| S5 | Calendar: week 06:00-18:00 grid, month view, prev/Today/next, Add event; events outside hours as all-day chips | PARTIAL | `calendar.jsx` row: week and month, all-day row, add and edit. The 06:00-18:00 grid and the chip rule not stated |
| S6 | Calendar: root project due dates as all-day markers; Upcoming (5); featured event card; event sheet with RSVP counts and WhatsApp | DONE | `calendar.jsx` row |
| S7 | Month and year boundaries, Jakarta dates tested | DONE | Section 2 item 1 "tested in /qa/tests"; `time.js` "month grid helper" |
| S8 | Projects Progress (steps, percent, next due) and Pipeline (3 columns, Move for managers) | PARTIAL | `projects.jsx` row "Progress and Pipeline views"; columns, step rule and Move control not stated |
| S9 | Drill-down, timeline, team chart, meeting view, deals stay intact | DONE | Section 3 rows |
| S10 | Admin "Public" switch on root project cards | DONE | `projects.jsx` row "Public switch" |
| S11 | Committees: sections as person chips, org chart and team chart | DONE | `committees.jsx` row |
| S12 | Resources: Make a copy, Suggest an edit, Share something, My submissions, exec project templates | PARTIAL | `resources.jsx` row complete. "Make a copy" limited to Docs URLs, "Open" for Drive: declared deviation (section 2 item 3) |
| S13 | Ideas: board (`fl-note`), Pin idea 140, vote/unvote, admin archive | DONE | `ideas.jsx` row; ideas rules |
| S14 | Search: client-side over projects, tasks, people, events, announcements, templates; grouped; `/`, arrows, Enter, Esc; phone full-screen sheet | PARTIAL | `model.js` "search index"; section 7 "popover on laptop and full-screen sheet on phone". Indexed types and keyboard behaviour not stated |
| S15 | Sign-in split layout with campus-sky stage panel, crest, "Lead. Serve. Build."; logic kept; roster-gated | DONE | `auth.jsx` row "Split layout; logic unchanged" |
| S16 | Public site: top bar anchors and red Dashboard button, tall hero with two CTAs, announcements, live section with `fl-live` dot, Coming up, mission strip, footer, How to join | PARTIAL | `site.jsx` row (about 120 lines) and anchors `#live #events #about #join` only. Sections, hero and strip not described |

### New features: data model and rules

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| M1 | Term-scoped (announcements, events, RSVPs, ideas) versus cross-term (docTemplates, submissions, public/feed) | DONE | Section 4 table labels each |
| M2 | Every new doc carries `createdAt` and `archived: false` | PARTIAL | Section 4 closing paragraph; `public/feed` exempt (declared deviation, sensible) |
| M3 | Every new collection added to Close term backup | DONE | Section 4: "announcements, events, rsvps, ideas, docTemplates, submissions, public". Verified existing list admin.jsx:59 has six collections |
| M4 | Every new create or update also requires `role() != 'teacher'` | DONE | Section 4 "Helpers" paragraph |
| M5 | `announcements` rules (title 1-80, body 2000, audience, dates, end >= start, admin write, active read) | DONE | Section 4 row matches PROMPT. Update cell "same validation" is ambiguous about `archived` (F14) |
| M6 | Announcement display: start <= today <= end, newest first, audience picker label | PARTIAL | `shared.jsx` covers display. "Newest first" and the exact label "Everyone (also shown on the public website)" not in plan |
| M7 | `events` rules (create any non-teacher, `public` only by admin on create and update, update by creator or exec) | DONE | Section 4 row. `isBoss` = advisor, president, VP, treasurer, secretary equals "exec and advisor". Update cell lacks explicit `termOk()` and `createdByUid` unchanged (F14) |
| M8 | `rsvps/{eventId}_{email}` rules | DONE | Section 4 row matches (`uid == me`, id check, not teacher); adds "event exists" |
| M9 | `ideas` rules incl. `[me,me,me]` resistance, test it | DONE | Section 4 row: set differences, size +-1, and a duplicate check (stricter than PROMPT); test list includes `[me, me, me]` |
| M10 | `docTemplates` rules, URL must start with Google domains | DONE | Section 4 `google(u)` regex matches both prefixes |
| M11 | "Make a copy" turns `/edit...` into `/copy` | PARTIAL | Section 2 item 3 refines to Docs, Sheets, Slides only (declared deviation) |
| M12 | `submissions` rules (create as self, status pending/filed; read author or admin; update admins only `status`) | DONE | Section 4 row. Update allows `status` plus `updatedAt` (minor widening, F14) |
| M13 | Approving creates `docTemplates` doc or bumps url and version in the same batch | DONE | `actions.js` row "submissions with approve batches"; section 9 |
| M14 | "My submissions" query filtered by `byUid` | DONE | Section 5 row |
| M15 | `items` `public` and `publicBlurb` admin-only on create and update, explicit check against leads | DONE | Section 4 `items` row (adds "root only") |
| M16 | Comment to task (Make task, prefill, parent rule, assignee, notification) | PARTIAL | `ui.jsx` and `actions.js` rows mention "Make task" only; prefill and parent-for-task rule absent |
| M17 | @mentions: autocomplete from roster, `fl-mention`, `mention` notification | PARTIAL | `ui.jsx` "@mention autocomplete", `actions.js` "mentions". `fl-mention` and notification type not stated |
| M18 | Share to WhatsApp for events, tasks, check-in reminder | PARTIAL | M4 row "WhatsApp shares" and event sheet; tasks and check-in reminder not named |
| M19 | Mission card with three messages, arrow cycling, no auto-rotation | MISSING | "Mission card" appears nowhere in the plan (F6) |
| M20 | Rules tests for every new collection and the roster | DONE | Section 4 "Rules tests to add". Mostly negative cases; positive cases implied (F14) |
| M21 | Seed: 2 active + 1 expired announcements, events this and next week, RSVPs, 5 ideas, 6 templates, 3 pending submissions, public feed | DONE | `seed-emulator.mjs` row, a superset |

### Quality gates and README

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| Q1 | `npm run build` with no warnings beyond the chunk note | MISSING | Not mentioned. Two entries make a separate Firebase-free public chunk likely; still unstated |
| Q2 | `npm run test:rules` passes (old tests updated, new added) | DONE | `tests/rules.test.mjs` row |
| Q3 | `npm run check` prints `ok` | DONE | `package.json` row. Note design-check.sh ignores `docs/` and `README.md`, so D15 leftovers would not be caught |
| Q4 | Playwright screenshots: sizes, themes, source, output folder, compressed | PARTIAL | Section 2 item 12 (JPEG q70, under 4 MB) and `package.json` row. Sizes, themes and the screen list not stated |
| Q5 | Lighthouse mobile Perf >= 90, A11y >= 95; installable (`/app/`, `start_url /app/#/week`) | DONE | Section 2 item 11, manifest row |
| Q6 | Final QC pass, BACKLOG for minors | DONE | M5 row, `qa/` row |
| Q7 | README: architecture, one-time setup, decisions, where to run each command | PARTIAL | `README.md` row lists most; "nothing new in the Firebase console except deploying rules, indexes and hosting" not stated. `firebase use build` note is a good addition |

### Step 0 and ground rules

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| P1 | Keep/change/delete table for EVERY file | DONE | `git ls-files` (98 files) compared against section 3: every tracked file is covered, including `package-lock.json` ("package.json / lock"), `designsystem/` (as a folder move), `public/icons/*`, `qa/`. Only `docs/plan.md` itself is not listed (trivial) |
| P2 | New collections and rules | DONE | Section 4 |
| P3 | Route map | DONE | Section 7 |
| P4 | Milestone list (<= 6) | PARTIAL | Section 8 has six milestones matching PROMPT. Restyle of existing routes is not assigned to any milestone (F1) |
| P5 | Read-budget arithmetic | DONE | See B11 |
| P6 | Things the prompt gets wrong | DONE | Section 2 lists 13; most are real (month view window, ideas ranking, `.firebaserc` alias `build`, `/copy` links, quota reset time). Missed: manifest has no `id`, announcement archive wording, free-text titles in public payload |
| P7 | Lean: app code under about 3 500 lines | PARTIAL | Section 8: about 1 700 today, +1 600, about 3 300. Actual non-CSS app code is 1 629 lines (1 808 with app.css). The addition list omits Projects Progress/Pipeline, Committees, Settings, mentions, Make task, mission card and the admin.jsx changes (F15) |
| P8 | Production data: new fields optional, missing = default, no migration | PARTIAL | Section 4 rules use "if present"; no sentence on reader defaults |
| P9 | No new runtime dependencies | DONE | `package.json` row dev-only; Preact already present |
| P10 | Do not touch Firebase config except allowed exception | PARTIAL | `firebase.js` change is a declared deviation (Q3) |
| P11 | Small commits; push after each milestone | MISSING | Not stated (minor) |
| P12 | Checker routine per milestone and logic reviewer passes | DONE | Section 8 "Checks" column |

## Tally

DONE 93, PARTIAL 40, MISSING 11 (144 lines). Blockers 0, majors 6 (F1 to F6), minors 11 (F7 to F17).

## (b) Findings

### Blockers

None. No statement in the plan would, if followed literally, violate a requirement or break production data. The gaps below are omissions that let the build drift.

### Major

**F1. major. Plan section 8 (M3) and section 3 (`routes/*` restyle rows). Deleting the old design system at M3 leaves most screens unstyled until M4 or M5.**
- Expected: each milestone leaves the app working so the four checkers can test it (PROMPT: "do not start the next milestone until blockers and majors are fixed").
- Actual: M3 does `git mv`, deletes `design/builtbyjosef/` (which supplies every `jy-` class) and rewrites only shell, sign-in, Home, search and Settings. Restyles of `meeting`, `views`, `feed`, `digest`, `templates`, `workload`, `admin` and `projects` have no milestone (M4 lists Projects only; Admin is M5). Today about 340 `jy-` lines live in those files.
- Evidence: `grep -c "jy-"` per file (projects.jsx 54, ui.jsx 43, templates.jsx 33, meeting.jsx 24, admin.jsx 23 ...); plan section 8 rows M3 to M5.
- Fix: assign every restyle to a milestone, or keep `design/builtbyjosef/` until the last `jy-` class is gone (delete at M5), or restyle shared `ui.jsx` classes in M3.

**F2. major. Plan section 3 (`admin-views.jsx`, `site.jsx`) and PROMPT "Publishing": payload whitelist is not planned.**
- Expected: the plan shows the exact fields per public type (projects: title, stage, percent, done/total counts, publicBlurb, updatedAt; events: title, type, date, start, end, location; announcements: title, body, startDate, endDate) and the filters (public flag, from today, audience everyone, `endDate >= today`), because the security and logic reviewers must confirm no name, email, initials, comment, check-in or task title leaks.
- Actual: absent. Only "payload builder plus hash" (`model.js` row) and the Q1 discussion of `updatedByUid`.
- Evidence: grep of plan for "whitelist", "title", "payload": no field list.

**F3. major. Plan section 3 `store.js` / `model.js` and section 2 item 6: auto-publish guards are missing.**
- Expected: skip while `S.error` is set or `loaded()` is false; publish on open and every 10 minutes; compare against the stored `hash`.
- Actual: plan says "opening the dashboard auto-publishes" and mentions a hash, but never the guards or the 10-minute timer. Without the guard a client with dead listeners or an unloaded store would publish an empty payload and blank the public Live section.
- Evidence: plan lines 21, 59; PROMPT line 95.

**F4. major. Plan section 3 (`app.jsx`, `admin-views.jsx`): navigation and admin Overview content absent.**
- Expected: concrete list of rail items and photo card, bell dot plus count, avatar menu entries (My profile, Settings, Switch to admin view, Sign out), phone tab tiles and More sheet contents, admin phone link list on Overview, Overview needs-attention items with "Copy reminder", Public site screen (switches, preview, Publish now, last published).
- Actual: single-line mentions ("rail, top bar, bell, avatar menu, search, phone tab bar, More sheet"). The Overview row says only "Overview".
- Evidence: plan lines 61, 74; PROMPT lines 134-160. Rows N1-N8, N10, N11, N13 above.

**F5. major. Plan section 3 `store.js`: new listeners and `loaded()`.**
- Expected: PROMPT requires "New listeners stay out of `loaded()`, so one failing query cannot block the app". The `lost` handler (store.js:31) sets a global `S.error` for any listener failure, which is the same flag that blocks auto-publish and shows a banner. A missing production index (the one thing no checker can verify) would therefore set `S.error` for every member.
- Actual: plan does not mention `loaded()` or how new-listener failures are isolated, even though it flags indexes as untestable.
- Evidence: src/store.js:31-36; plan section 5 last paragraph.

**F6. major. Mission card and Home composition missing from the plan.**
- Expected: Home sections, length budget (1.5 laptop, 5 phone screens, 5-row caps), mission card with three messages and button cycling.
- Actual: "mission" appears only as the public "mission strip" nowhere; `home.jsx` row has no section list; the length budget is not mentioned.
- Evidence: plan line 55 (`my-week.jsx` row); rows S1, S2, M19.

### Minor

**F7. minor. Roles: VP active flag and Close term visibility not stated** (plan section 4 members row, section 3 `admin.jsx`). Today's VP rule forbids `active` changes (firestore.rules:34); PROMPT now allows it. Plan should say the restriction is removed, and that Close term stays advisor-only.

**F8. minor. Free-text in public items.** After an admin flags a root project or event public, its creator or any lead can still edit the title (and event location) and the next admin auto-publish publishes it without review. `publicBlurb` and `public` are admin-only, titles are not (rules:61-63). Plan section 2 does not flag this.

**F9. minor. Lazy activity is a deviation not listed in section 2.** PROMPT lists activity in the cold-open cost; the plan sets it to 0 reads, but the Projects page sidebar (projects.jsx:20) shows `<Feed compact />`, one of the most visited screens. Real saving is lower; worst case adds 30 x 3 x 50 = 4 500 reads a day, giving about 43 500 (still under 50 000).

**F10. minor. Q3 sign-out cleanup has no home.** `terminate` plus `clearIndexedDbPersistence` and reload are not in any file row (`firebase.js` row says "Nothing else"; `store.js` row does not list it).

**F11. minor. `site.jsx` and `app/index.html` CSS imports** (tokens.css, components.css) are not stated; PROMPT says import "once in the entry".

**F12. minor. `docs/qa/*.md` and README text mention builtbyjosef** (`grep -l`: code-check.md, design-check.md, lessons.md). Plan keeps `docs/qa/*.md` and `design-check.sh` does not scan `docs/`. State that these are historical, or note the exception for "remove every trace".

**F13. minor. Manifest `id`.** PROMPT says the manifest "keeps `"id": "/"`", but public/manifest.webmanifest has no `id` field (identity is derived from the old `start_url`, which resolves to `/`). Plan adds `id` without noting the prompt's error.

**F14. minor. Rules table ambiguities** (section 4):
- `announcements` update: "same validation" would block archiving if it includes `archived == false`.
- `events` update: no explicit `termOk()` and no `createdByUid` / `createdAt` unchanged check.
- `submissions` update allows `status` plus `updatedAt`, PROMPT says only `status`.
- `ideas` update (a) and (b): no explicit `active()` and `termOk()`.
- `items` create: "if `public` or `publicBlurb` is present, then isAdmin" would reject a non-admin create that carries `public: false`. Allow `false`/absent for non-admins, as PROMPT says missing = false.
- `public/feed` write: `hash` type is not checked.
- Rules tests list is negative-heavy; add positives (VP changes active, president adds officer, admin creates announcement, member RSVP own).

**F15. minor. Line budget estimate.** "Today about 1 700" is 1 629 non-CSS lines (1 808 with CSS). The +1 600 list omits Projects Progress and Pipeline, Committees, Settings, mentions, Make task, mission card, admin.jsx changes; 3 300 is optimistic.

**F16. minor. Read-budget omissions.** Rule-evaluation `get()` calls (member, `settings/current`, `getAfter`) are billed as reads on every write and are not in the 56 000 arithmetic; the admin `submissions` listener (up to 100 reads) is not counted; opens per day (3) is an assumption. The 20-access-call wording in section 9 differs from the code's 15-parent chunk (actions.js:61).

**F17. minor. Missing small items:** preview.html inline styles (D10), build-warning gate (Q1), cross-collection counts (B8), "Updated earlier" note and emulator REST URL (A8, A9), small commits and push per milestone (P11), audience picker label (M6), "nothing new in the Firebase console" README sentence (Q7), `docs/plan.md` row in the file table.

### Existing-code claims verified

| Plan claim | Result |
|---|---|
| Today's president can change roles; only advisor deactivates | True (firestore.rules:25-35; admin.jsx:108) |
| `putDoc` sends termId and updatedAt; MemberForm sends initials | True (actions.js:138-139; admin.jsx:26). The plan does not state this itself; it relies on PROMPT's list |
| Existing indexes: activity `(termId, createdAt desc)` only | True (`firestore.indexes.json`) |
| Today's rule lets any lead change any item field | True (firestore.rules:63) |
| `.firebaserc` alias is `build`, not `default` | True |
| Workload `getDocs` over whole term check-ins | True (workload.jsx:48) |
| Check-ins listener covers two weeks (52 reads) | True (store.js:43) |
| App code about 1 700 lines | Slightly high: 1 629 non-CSS, 1 808 with CSS |
| Cold open about 600 | Consistent: 545 + 50 activity = 595 |
| Batch limit "20 access calls" | Code uses 15 distinct parents; wording only |
| Base commit 8e63dd9 adds `designsystem/` | True (git log) |
