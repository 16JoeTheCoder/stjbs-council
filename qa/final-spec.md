# Final spec-conformance (JOB A)

Source: `qa/PROMPT.md` (owner amendments win; deviations in `docs/plan.md` sections 1 and 2 are not findings). Evidence is file or command at HEAD `67ba9bf`. I did not run `npm run demo` (another checker owns it), so UI behaviour rests on code, the earlier m1 to m4 reports, `qa/tests/m3-ui.test.mjs` (29 of 29 per its commit) and the committed screenshots.

Commands run here: `npm run check` prints `ok fiatlux check clean` and `ok public page is Firebase-free (2 chunks)`; `npx vite build` has no warnings; rules tests on the alternate ports (`qa/firebase.sec.json`): `tests/rules.test.mjs` 45 of 45 pass.

App code size: `src/**/*.js,*.jsx` is **3 356 lines** (216 KB), in 31 files; `src/app.css` 205 lines. Ceiling is 10 000 (owner amendment): DONE.

## Totals

About 100 lines checked. **DONE 88, PARTIAL 11, MISSING 1.** No blocker, no major.
The one MISSING is the Finish deliverable `docs/PR.md` (see Finish). Everything the earlier reports marked MISSING is closed (table "Earlier spec findings").

## Keep list

| Line | Status | Evidence |
|---|---|---|
| Week tasks and filters (All, Mine, Due soon, Overdue, Blocked, Done, Hide done) | DONE | `routes/home.jsx` AllTasks (`#/tasks`), "Hide done" present |
| Project tree, drill-down, breadcrumbs | DONE | `routes/projects.jsx` Crumbs, `#/p/:id` |
| Subteams, leads, `leadUids` propagation | DONE | rules `leadsOk`; tests "lead change propagates in one batch" |
| Task editing with assignee-only limits | DONE | rules items update `hasOnly`; test "assignee can mark done but not change due date" |
| Deals (stage bar, pledged and received IDR, table) | DONE | `projects.jsx` StageBar, deal table lines ~150-160 |
| Weekly check-in, Friday 23:59 Jakarta | DONE | `routes/home.jsx` Checkin, `time.js` week() |
| Meeting swimlane view | DONE | `routes/meeting.jsx` |
| Comments, notifications, unread bell | DONE | `ui.jsx` Comments, `app.jsx:73-90` |
| Activity feed | DONE | `routes/feed.jsx`, bell "See all activity" |
| People list, org chart, team chart | DONE | `routes/people.jsx`, `routes/views.jsx` |
| Timeline, workload table, weekly snapshots | DONE | `views.jsx`, `routes/workload.jsx`, rules `stats` |
| Digest builder with WhatsApp share | DONE | `routes/digest.jsx:38` |
| Project templates (JSON import, export, AI prompt) | DONE | `routes/templates.jsx` |
| Roster admin, close term with forced backup | DONE | `routes/admin.jsx:64-80` |
| Install-app button and iPhone instructions | DONE | `routes/settings.jsx`, `auth.jsx` |
| Light and dark themes | DONE | theme script in both HTML heads, light screenshots |
| `npm run demo`, `npm run test:rules` | DONE | `package.json`; rules 45 of 45 |

## Delete or replace

| Line | Status | Evidence |
|---|---|---|
| `design/builtbyjosef/`, `scripts/jy-check.sh` gone | DONE | `ls` confirms neither exists |
| No `jy-` class, no signature on About | DONE | grep of `src app index.html` empty; only `design-check.sh`, DESIGN.md, docs name the retired brand (as a ban) |
| `designsystem/` moved to `design/fiatlux`, imported once per entry | DONE | `designsystem/` absent; `design/fiatlux/` present |
| `src/app.css` small, tokens only, `fl-` prefix | PARTIAL | 205 lines, all `fl-`. Raw `border-radius` px at `app.css:46,117,132`, 6 `!important`, stage-gradient tokens on the sign-in panel (m3-spec F6). Not in BACKLOG |
| Specific components in `app.css` (timeline, swimlane, org chart, stage bar, chips, crumbs, `fl-scroll`) | DONE | `fl-tl`, `fl-stagebar`, `fl-scroll` in `app.css:116-132`; 7 files use `fl-scroll` |
| `design/fiatlux/design-check.sh` wired to `npm run check`, prints ok | DONE | run here |
| CLAUDE.md rewritten as short council block | DONE | file read |
| Icons regenerated from `crest.png`, `#0A0A0C` | DONE | `scripts/make-icons.cjs:1-8` now reads `design/fiatlux/img/crest.png` (m3 F1 closed); manifest theme `#0A0A0C` |
| `docs/brief.md` no longer contradicts the prompt | DONE | `brief.md:11` now says 10 000-line ceiling; the stale "Only the advisor deactivates" line is gone (m4 D6 closed) |

## Architecture

| Line | Status | Evidence |
|---|---|---|
| Two entry points: `/` public, `/app/` dashboard | DONE | `index.html`, `app/index.html`, `dist/index.html`, `dist/app/index.html` |
| Public page has no Firebase SDK | DONE | `scripts/check-site-bundle.mjs` ok (2 chunks, `site-*.js`, `shared-*.js`) |
| No Hosting rewrites; `/assets/**` cache header kept | DONE | `firebase.json` has headers only |
| `/#/week` redirects to `/app/#/week` before render | DONE | inline `location.replace` in `index.html` head (also redirects standalone installs) |
| Manifest only in `app/index.html`, `"id": "/"`, scope `/app/` | DONE | `public/manifest.webmanifest` |
| Theme script copied into `app/index.html` | DONE | present |
| Hero images imported through Vite (hashed) | DONE | `dist/assets/building-*.webp`, `campus-*.webp` |
| Public site reads `public/feed` over REST, emulator URL under `VITE_EMULATORS`, localStorage fallback, "Updated earlier", static page if none | DONE | `site.jsx:24-35`, FEED_URL |
| Page re-filters by Jakarta today; "Last change N min ago" | DONE | `feed.js feedToday`, `ago` |
| "Publish now" button on Public site admin screen | DONE | `admin-views.jsx` PublicSite, `publish(true)` |
| Auto-publish on open and every 10 min, hash compare, skipped while `S.error` or not loaded, one `public/feed` listener in admin sessions only | DONE | `publish.js startAdminJobs`, `canPublish()` |
| Payload whitelist: projects, events, announcements; no names, emails, initials, comments, check-ins, task titles | DONE | `feed.js feedPayload` is explicit per field; rules keys `hasOnly(['json','hash','updatedAt'])` |
| `public/feed` rules and 200 000 size limit | DONE | `firestore.rules` public/feed block; test "public feed" |
| No Cloud Storage | DONE | no storage import; rules accept Google links only |
| Read budget: bounded new listeners (events -7/+60 d, announcements `endDate >= today`, templates); Ideas only on Home laptop and Ideas route; RSVPs only with sheet open; submissions and archive only in admin; no cross-collection counts; new listeners outside `loaded()`; day-scoped restart | DONE | `queries.js`, `store.js` (m2-spec R-lines DONE); item snapshot `cache/{term}` per plan section 6 |
| Read-budget arithmetic in plan, indexes listed and in `firestore.indexes.json` | DONE | plan sections 5 and 6; indexes file has 6 composite indexes (activity, items, events, announcements, ideas, submissions) |
| Multi-tab persistent cache cleared on explicit sign-out | DONE | `firebase.js` `persistentMultipleTabManager`; `clearIndexedDbPersistence` in store |
| Firebase config untouched except the allowed cache exception | PARTIAL | `src/firebase.js` also gained a "Missing Firebase config" guard for production builds without a key (lines 6-9). Beyond the allowed exception and not in plan section 1 or 2. Harmless (shows a message instead of a broken app) but record it. `.env.*`, `firebase.json` emulator and Firestore sections unchanged; `.firebaserc` was committed by the owner |

## Roles table

| Role | Status | Evidence |
|---|---|---|
| advisor: everything, only one to set `settings/current` and assign advisor | DONE | rules `settings/current`, members create/update `isAdvisor()` |
| vp: add members, change role and active except advisor's and own, never assign advisor | DONE | members update rule; test "roster: vp changes any role..." |
| president: add only officer, treasurer, secretary, teacher; `hasOnly(name, section, reportsTo, initials, termId, updatedAt)`; no role/active change; cannot touch advisor | DONE | rules `members`; tests "president adds only non-admin roles", "edits name, section and reports-to only" |
| No one changes own role or active flag | DONE | `!(email == me() && changed().hasAny(['role','active']))`; test G1-11 |
| treasurer, secretary as before, no admin view | DONE | `isBoss()`; `isAdmin()` gates admin routes (`app.jsx:39-42`) |
| teacher read and comment only | PARTIAL | every new write excludes teachers, but `checkins` create/update has no `notTeacher()` (unchanged from before; BACKLOG M1) |
| Close term advisor only | DONE | `admin.jsx` gated by advisor |

## Navigation

| Line | Status | Evidence |
|---|---|---|
| Laptop rail: crest lockup, Home, Calendar, Projects, Committees, Resources, photo card | DONE | `app.jsx:168-176` |
| Top bar: search left; bell with unread dot **and count**; avatar menu | PARTIAL | count badge only, no dot (m3 F9; `app.jsx:73-77`). Not in BACKLOG |
| Phone: no rail, five tiles Home, Calendar, Projects, Ideas, More; active tile red; search on its own row | DONE | `app.jsx:187-191`, m3-ui tests |
| More sheet: Committees, Resources, Digest for exec; admin sections on More in admin view | DONE | `app.jsx:117-135` |
| Phone admin Overview link list at top | DONE | `admin-views.jsx:41` |
| Avatar menu: My profile, Settings (theme, install, About with version), Switch to admin view (3 roles only), Sign out | DONE | `app.jsx:100-115`, `settings.jsx` |
| Where screens went (My week to Home, People to Committees, Feed to bell, Digest action on Projects, project templates in Resources for exec) | DONE | `ROUTES` in `app.jsx:44-47`, `projects.jsx:80` |
| Admin view: badge, own rail, "Switch to member view", remembered in `localStorage`, `#/admin/...` | DONE | `ADMIN_NAV`, `adminView` state |
| Admin Overview: needs-attention list, no stat cards (announcements ending in 3 days, pending submissions, missing check-ins with "Copy reminder", unpublished changes, who has admin) | DONE | `admin-views.jsx` Overview |
| Admin sections: Announcements, Members and roles, Check-ins and workload, Public site, Approvals and archive, Digest | DONE | `ADMIN_PAGES` |
| Popovers (bell, avatar, search) trap focus and arrow-navigate; tap targets 44 px | PARTIAL | Esc and focus return work; no trap or arrows; inline `fl-link` rows and `fl-vote`/`fl-seg` under 44 px (m3 F4, F5). Not in BACKLOG |

## Screens

| Line | Status | Evidence |
|---|---|---|
| Home: hero `campus-sunset.webp`, Jakarta greeting with first name, one-line summary | DONE | `home.jsx` |
| Home: announcements only if active; Needs you (max 5, incl. blocked on you); today's agenda (max 5); check-in red panel only while missing; My projects up to 3 with `fl-steps` max 5 then "+n"; mission card laptop only; top ideas (3, "Open idea board") laptop only; no stat row; filters moved to "All my tasks" | DONE | `home.jsx` |
| Home length budget 1.5 laptop screens | PARTIAL | about 1.95 screens in the worst case (BACKLOG M3) |
| Mission card hidden when a single banner and the check-in panel both show | PARTIAL | intentional DESIGN rule 4 (BACKLOG M4 A3) |
| Mission card messages, cycled by arrow, no auto-rotation | DONE | `home.jsx` "Ad maiorem Dei gloriam." |
| Calendar: week 06:00-18:00 and month views, prev/Today/next, Add event, evening chips in all-day row, root due dates as markers | DONE | `calendar.jsx` |
| Calendar: Upcoming (5), featured card with `campus-sunset.webp`, event sheet with RSVP counts and WhatsApp share | DONE | `calendar.jsx:100-125` |
| Month and year boundaries, Asia/Jakarta, tested | PARTIAL | m4 ran Dec 2026 to Jan 2027 and 29 Feb 2028 by hand (all correct); `tests/rules.test.mjs` has date cases but no committed calendar unit test |
| Overlapping events in the week grid | PARTIAL | they overlap (BACKLOG M4 A4) |
| Projects: Progress default with steps, percent, next due; Pipeline columns with Move; drill-down, timeline, team chart, meeting view, deals intact; Public switch for admins | DONE | `projects.jsx:16-90` |
| Committees: sections as person chips, org chart and team chart | DONE | `people.jsx` |
| Resources: templates with Make a copy (`/edit` to `/copy`), Suggest an edit, Share something, My submissions with status, exec see project templates | DONE | `resources.jsx` |
| Ideas: board `fl-note`, Pin idea 140, vote/unvote, admin archive | DONE | `ideas.jsx` |
| Search: client-side only over projects, tasks, people, events, announcements, templates; grouped; `/`, arrows, Enter, Esc; full-screen sheet on phone | DONE | `search.jsx` (templates filtered by `googleUrl`) |
| Sign-in: split layout, `campus-sky.webp`, crest, "Lead. Serve. Build.", existing form and flows, roster-gated | DONE | `routes/auth.jsx` |
| Public site: top bar with anchors and red Dashboard button; tall hero `building.webp` with the two buttons; announcements; Live with `fl-live` dot; Coming up; mission strip; footer with How to join; only Live needs the feed | DONE | `site.jsx` |

## Data model and "Also"

| Line | Status | Evidence |
|---|---|---|
| `announcements` fields, limits, audience wording, dates, display rules (max 3, hidden/banner/cards, sheet) | DONE | rules `annOk`; `feed.js activeAnnouncements`; picker text "Everyone (also shown on the public website)" |
| `events` fields; create with `public == false` unless admin; `public` and published text only by admin | DONE | rules `events`; test "events: creator or exec edits..." |
| `rsvps/{eventId}_{email}` | DONE | rules; id collision for emails with `_` accepted (BACKLOG M4) |
| `ideas`, vote rule with set and size checks, `[me,me,me]` refused | DONE | `voteOk`; tests "ideas: vote and unvote only yourself, once" |
| `docTemplates` Google URL only, version, instant admin write | DONE | `google()` and `tplOk` |
| `submissions` read by author or admin, status-only admin update, approval in one batch, client sends `version` unchanged when url equal | DONE | rules; `actions.js decide()` (m4 S6 closed client-side) |
| `public/feed` json, hash, updatedAt; **no `updatedByUid`** (owner amendment) | DONE | rules `hasOnly(['json','hash','updatedAt'])` |
| `items.public`, `publicBlurb` settable only by advisor, president, VP; root only; lead cannot add even `false` | DONE | rules; tests L2-04 |
| `createdAt` and `archived: false` on every new document | PARTIAL | `archived == false` forced everywhere; `createdAt` is type-checked only on submissions (BACKLOG M1) |
| Term-scoped vs cross-term collections; `Close term` backup includes all new ones | DONE | `admin.jsx:68-72` lists announcements, events, rsvps, ideas, docTemplates, submissions, cache, `public/feed` (m1 S-53 closed) |
| Teachers: new create/update rules exclude them | DONE | rules |
| Comment to task: Make task, prefill, parent rules, due date this week so it lands in Needs you, "assigned" notification, falls back to author | DONE | `ui.jsx:175-185` (m4 A1 and A2 closed) |
| @mentions with autocomplete, `fl-mention`, `mention` notification | DONE | `ui.jsx`, `actions.js` |
| Share to WhatsApp for events, tasks, check-in reminder | DONE | `calendar.jsx:122`, `projects.jsx:180`, `admin-views.jsx:46` |

## Rules tests and seed

| Line | Status | Evidence |
|---|---|---|
| Old tests updated for roster change plus tests for every new collection and roster permissions, `[me,me,me]`, stale term, legacy `public` | DONE | `tests/rules.test.mjs` 45 tests, run: 45 pass |
| Seed: 2 active and 1 expired announcement | DONE | `seed-emulator.mjs:74-80` |
| Seed: events this week and next, RSVPs, 5 ideas, 6 templates, 3 pending submissions, public feed | DONE | seed lines 83-125 (7 events, 4 RSVPs, 6 templates, sub1-3 pending plus one filed archive) |

## Quality gates

| Gate | Status | Evidence |
|---|---|---|
| 1 `npm run build` without warnings | DONE | `npx vite build` clean |
| 2 `npm run test:rules` | DONE | 45 of 45 (run on alternate ports) |
| 3 `npm run check` prints ok | DONE | run here |
| 4 screenshots in `docs/qa/screens/` (1440x900 and 390x844 dark; light for Home, sign-in, public) | DONE | 66 JPEGs, 4.3 MB: every member route, 7 admin screens, sign-in and public site in both themes at both sizes, Home light at both sizes. I did not view them all; m3/m4 alpha reports did |
| 5 Lighthouse on public site, Performance 90+, Accessibility 95+; installable | DONE | `docs/qa/lighthouse.md`: 94 and 100 (mobile); manifest scope `/app/`, start_url `/app/#/week`. Measured with no live feed (preview build) |
| 6 final QC with no open blocker or major; BACKLOG holds minors | PARTIAL | this pass finds none open; several minors from m3 spec (F4 to F6, F8 to F11) are not yet in `qa/BACKLOG.md` |
| 7 README: architecture, once-only setup, decisions, where commands run | DONE | `README.md` 156 lines: Architecture, Roles, "What Josef sets up once" (rules, indexes, hosting order), Decisions (no Functions, no Storage, publish model), VS Code terminal and console locations |

## Earlier spec findings now closed

m1: S-53 backup (closed), S-62 stale-term test (closed, test at `rules.test.mjs:381`), S-63 legacy-public test (closed, `:389`), S-79 seed, S-80 to S-84 (all built). m2: A16 Publish now (built). m3: F1 make-icons, F3 `stamp()` (now "Fri 30 Oct, 09:15"), F7 admin route highlight, N2 Calendar and Resources routes (exist). m4: A1 and A2 (fixed), D6 brief (fixed), M4-S6 (fixed in client).
Still open and in BACKLOG: m1 S-28, m2 R14/R18 and P1, m3 F2, m4 A3, A4, X3 side cases.
Still open and **not** in BACKLOG: m3 F4, F5, F6, F9, F10 (Public switch is a bare checkbox with "Public"), F11 (inline `paddingLeft`, `views.jsx:39`), F12 first half ("Checked in for W44", `home.jsx:80`), m4 S5 (re-approving a decided submission). All minor.

## Finish and quiet shortcuts

| Line | Status | Evidence |
|---|---|---|
| PR text (`docs/PR.md`) or the PR itself, with DONE/PARTIAL/MISSING table, read-budget, notes | MISSING | `docs/PR.md` does not exist; no PR link in the repo. This report can feed it |
| TODO, placeholder data, dead buttons | DONE | grep of `src` for TODO, FIXME, HACK, lorem: none (two `placeholder=` attributes only); no commented-out code found in the files read |
