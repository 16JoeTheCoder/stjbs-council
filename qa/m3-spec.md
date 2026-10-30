# M3 spec conformance

Checker: spec-conformance, Job A. Source: `qa/PROMPT.md` ("Delete or replace", "Navigation", "Screens": Home, Projects, Committees, Ideas, Search, Sign-in) and `design/fiatlux/DESIGN.md`. Evidence is from the code at commit `fc41332` plus `npm run check` (prints `ok`). I did not run the demo. Page-length numbers come from the alpha tester's screenshots in `qa/screens-m3/`.

Counts: **DONE 63, PARTIAL 10, MISSING 0, LATER 6 table rows (plus the unbuilt screens listed below).** No blocker, no major. 12 minor findings (F1 to F12) at the end.

Not built yet (LATER, per the brief): Calendar, Resources, admin Overview, Announcements, Public site and Approvals screens, comment mentions and Make task, icons, README, seed polish, screenshots, Lighthouse.

## Delete or replace

| # | Line | Status | Evidence |
|---|---|---|---|
| D1 | `design/builtbyjosef/` deleted | DONE | folder absent; `git show --stat fc41332` lists every file removed |
| D2 | builtbyjosef block gone from `CLAUDE.md` | DONE | `CLAUDE.md:1-9` is a short council block |
| D3 | `scripts/jy-check.sh` deleted | DONE | `scripts/` holds only `check-site-bundle.mjs`, `make-icons.cjs`, `seed-emulator.mjs` |
| D4 | signature on the About page removed | DONE | `src/routes/settings.jsx:43-47` has text and version only; `about.jsx` deleted |
| D5 | no `jy-` class | DONE | no match in `src`, `app`, `index.html`, `public`; `design-check.sh:16` enforces it |
| D6 | `designsystem/` moved to `design/fiatlux/`, old folder gone | DONE | `ls designsystem` fails |
| D7 | imported once, tokens then components | DONE | `src/main.jsx:2-3` |
| D8 | `src/app.css` small, tokens only, `fl-` prefix | PARTIAL | 181 lines, all `fl-`. Raw px radii at `app.css:46,117,132`, `!important` at `:42,53,55,60`, and the stage gradient tokens used at `:67,69` (F6) |
| D9 | the six kept-feature components built in `app.css`, one form each | DONE | timeline `:127-135`, swimlanes `:137-141`, org chart `:143-148`, deal stage bar `:114-118`, filter chips with counts `:95-102` + `ui.jsx:113`, breadcrumbs `:104-108`, `fl-scroll` `:120-125` |
| D10 | no inline styles copied from `preview.html` | DONE | only data-driven `width` and `left` remain: `ui.jsx:23`, `shared.jsx:123`, `projects.jsx:57`, `views.jsx:34-44`. `views.jsx:39` indent could be a class (F11) |
| D11 | `design-check.sh` wired to `npm run check` | DONE | `package.json` check script; run prints `ok fiatlux check clean` and `ok public page is Firebase-free` |
| D12 | `CLAUDE.md` rewritten: follow DESIGN.md, check + test:rules, Firebase kept, where to run, build only when told | DONE | `CLAUDE.md:3-9` |
| D13 | theme colour `#0A0A0C` | DONE | `index.html:17`, `app/index.html:8` |
| D14 | icons and favicon regenerated from the crest | LATER | `public/icons/` still old |
| D15 | `docs/brief.md` updated | LATER | still names builtbyjosef (`docs/brief.md:3,17,19,32`) |
| D16 | no builtbyjosef trace anywhere else | PARTIAL | `scripts/make-icons.cjs:4` reads `design/builtbyjosef/logos/tab-icon-dark.svg`, which no longer exists, so the script is broken. `design-check.sh` scans `src app index.html public` only, so it cannot see `scripts/` (F1). README traces are LATER (`README.md:5,26,79,80`) |

## Navigation

| # | Line | Status | Evidence |
|---|---|---|---|
| N1 | Laptop rail: crest lockup "Student Council / St. Johannes Berchmans" | DONE | `app.jsx:157` |
| N2 | Rail nav Home, Calendar, Projects, Committees, Resources | PARTIAL | entries exist (`app.jsx:46`). Home, Projects, Committees work. Calendar and Resources have no route in `ROUTES` (`app.jsx:41-44`) and open "Page not found" (LATER, but the links are live) |
| N3 | Photo card at the bottom of the rail | DONE | `app.jsx:160` |
| N4 | Top bar: search left; bell with unread dot and count; avatar menu | PARTIAL | search, avatar and bell count are there (`app.jsx:164-166`, `:74`). The bell shows a count only, no dot (F9) |
| N5 | Phone: no rail; top bar crest, bell, avatar; search on its own row | DONE | `components.css:56,87`; `app.jsx:164-166` |
| N6 | Phone tab bar: Home, Calendar, Projects, Ideas, More; active tile solid red | DONE | `app.jsx:49,171-174`; `components.css:97`. The Calendar tile is dead until M4 (LATER) |
| N7 | More sheet: Committees, Resources, Digest for exec | DONE | `app.jsx:120-124`. Resources target is LATER |
| N8 | Admin sections also in More | DONE | `app.jsx:125-129` |
| N9 | Avatar menu: My profile, Settings, Switch to admin view (advisor, president, VP only), Sign out | DONE | `app.jsx:102-106`, gate `isAdmin()` |
| N10 | Settings: theme, install app, About with version | DONE | `settings.jsx:36-47` |
| N11 | My week to Home; People to Committees; meeting, timeline, team chart, deals inside Projects | DONE | `ROUTES` `app.jsx:42`, `projects.jsx:119,131,142` |
| N12 | Feed becomes the bell's "See all activity" | DONE | `app.jsx:86` |
| N13 | Check-in reached from Home | DONE | `home.jsx:73` |
| N14 | Digest action on Projects for exec | DONE | `projects.jsx:80` |
| N15 | Project templates inside Resources for exec | LATER | today a "Start from template" button on Projects (`projects.jsx:81`) and a More link (`app.jsx:124`) |
| N16 | Admin view: red badge, own rail, "Switch to member view", choice remembered, `#/admin/...` routes | DONE | `app.jsx:149-150,158-159`, `localStorage` key `council-view` |
| N17 | Admin Overview, Announcements, Public site, Approvals | LATER | four of seven rail entries open "Page not found" (`app.jsx:35,38`). `#/admin` with no id renders Members while Overview is lit (F7) |
| N18 | Admin link list on phone Overview | LATER | |

## Screens: Home

| # | Line | Status | Evidence |
|---|---|---|---|
| H1 | Hero `campus-sunset.webp`, greeting by Jakarta hour, first name, one line | DONE | `home.jsx:17,75-82`, `jktHour` |
| H2 | Announcements only if any; 1 banner, 2 to 3 cards, click opens sheet | DONE | `shared.jsx:63-79`, `feed.js` `activeAnnouncements` |
| H3 | Needs you: due this week plus blocked on you, max 5, "All my tasks" link | DONE | `home.jsx:20-26,88-91` |
| H4 | Today's agenda: today's events only, max 5 | DONE | `home.jsx:94,95-102` |
| H5 | Check-in red panel only while this week's check-in is missing | DONE | `home.jsx:66-72`, `checksIn()` excludes advisor and teacher |
| H6 | My projects up to 3, steps at most 5 then "+n" | DONE | `home.jsx:28-32,34-44` |
| H7 | Mission card laptop only, three messages, arrow cycles, no auto-rotate | DONE | `shared.jsx:101-113`, `fl-desk-only` at `home.jsx:114` |
| H8 | Top ideas laptop only, 3 notes, "Open idea board" | DONE | `home.jsx:117`, `ideas.jsx:39-47`; ideas load only when wide, so no phone reads |
| H9 | Phone order: hero, check-in, announcements, needs you, agenda, projects | DONE | `home.jsx:86-93` plus the stacked `fl-split` |
| H10 | Laptop order: hero, announcements, split (needs, agenda | check-in, projects, mission), ideas | DONE | `home.jsx:86-117` |
| H11 | No stat rows on Home | DONE | none present |
| H12 | Task filter bar moved to "All my tasks" | DONE | `home.jsx:122-130`, route `tasks` |
| H13 | Length budget: about 1.5 laptop screens, 5 phone screens | DONE | `qa/screens-m3/ariel-week-1440.png` is 1440x1492 (1.66 of 900); `-390.png` is 390x1395 (1.65 of 844) |
| H14 | At most two red-filled surfaces; hide mission when one banner and check-in due | DONE | `home.jsx:119`. Worst case is banner plus check-in panel |
| H15 | Voice: dates "Thu 29 Oct", 24-hour times | PARTIAL | hero eyebrow reads "Friday 30 October" (`home.jsx:47`); see F2. Agenda times are 24 h (`home.jsx:97`) |

## Screens: Projects, Committees, Ideas

| # | Line | Status | Evidence |
|---|---|---|---|
| P1 | Progress default: one card per root, subteam steps, percent, next due task | DONE | `projects.jsx:29-42` |
| P2 | Pipeline: Planning / In progress / Done columns, "Move" for managers | DONE | `projects.jsx:44-72`, `canManage(r)` at `:59` |
| P3 | Drill-down, timeline, team chart, meeting view, deals intact | DONE | `projects.jsx:105-160`, `views.jsx`, `meeting.jsx` |
| P4 | Admins see a "Public" switch on root cards | DONE | `projects.jsx:19-27`, used at `:37,58,128`; word state is missing (F10) |
| P5 | Failed Pipeline move reverts the select | PARTIAL | `projects.jsx:61` has no revert (F8) |
| C1 | Sections as groups of person chips; tap opens person page | DONE | `people.jsx:86-88,116-123` |
| C2 | Org chart and team chart inside | DONE | `people.jsx:125-130` |
| I1 | Idea board `fl-note`, "Pin idea", 140 characters | DONE | `ideas.jsx:22-37,63-68` (`maxLength={140}`, counter) |
| I2 | Vote and unvote; teachers cannot | DONE | `ideas.jsx:31` (`disabled` for teacher), form hidden at `:62` |
| I3 | Admins can archive an idea | DONE | `ideas.jsx:30`, `isAdmin()` |

## Screens: Search and Sign-in

| # | Line | Status | Evidence |
|---|---|---|---|
| S1 | Client-side only, over data already loaded: projects and tasks, people, events, announcements, templates | DONE | `search.jsx:11-28`; no Firestore import |
| S2 | Grouped results | DONE | `search.jsx:75-85` |
| S3 | `/` focuses, arrows move, Enter opens, Esc closes | DONE | `search.jsx:35-39,54-60`. The active hit is not scrolled into view (minor, not logged) |
| S4 | Full-screen sheet on phone | DONE | `app.css:57-61` |
| S5 | Event and Resources targets work | LATER | event hits go to `#/calendar?d=..&e=..`, which is a dead route until M4 |
| L1 | Sign-in split: stage with `campus-sky.webp`, crest, "Lead. Serve. Build." | DONE | `auth.jsx:26-33`, `app.css:66-70` |
| L2 | Existing form, verification, reset, install help, roster message kept; no open sign-up | DONE | `auth.jsx:35-111`. "Create account" stays; the roster rules gate access, as before |

## DESIGN.md rules

| # | Rule | Status | Evidence |
|---|---|---|---|
| R1 | Five look rules: dark first, red is light, gradients only in allowed components, two red-filled max, status is colour + shape + word | PARTIAL | `design-check.sh` clean; no gradient written in JSX. `app.css:67,69` borrows the stage gradient tokens for the sign-in panel, which is not in the allowed list (F6) |
| R2 | Status colour + shape + word | DONE | `ui.jsx:26` uses `fl-badge`, shapes at `components.css:171-174`, words from `taskState` |
| R3 | Raw hex only in tokens and manifest | DONE | grep of `src` finds none; only the `<meta theme-color>` in the two HTML files |
| R4 | Fonts and weights | DONE | `design-check.sh` weight check passes |
| R5 | Voice: sentence case, verb-first buttons, no exclamation marks, no emoji | DONE | lint passes; buttons read "Start check-in", "Pin idea", "Copy digest" |
| R6 | Voice: dates "Thu 29 Oct" everywhere on screen | PARTIAL | `fmtDay` is right, but `stamp()` prints ISO `2026-10-30 09:15` in comments, the bell and activity (F3) |
| R7 | Money "15 000 000 IDR" | DONE | `time.js` `idr` |
| R8 | People by first name in lists, full name in profiles | DONE | `ideas.jsx:28`, `app.jsx:81`, `people.jsx:143` |
| R9 | Focus ring 2 px | DONE | `components.css:13` |
| R10 | Tap targets at least 44 px | PARTIAL | buttons, inputs, rows and nav use `--hit`. Inline `fl-link` text links (`home.jsx:91,93,95`) and the system's own `fl-vote` and `fl-seg` (36 px, `components.css:196,256`) fall short (F5) |
| R11 | Popovers and sheets trap and return focus, Esc closes | PARTIAL | `Sheet` does (`shared.jsx:46-62`). The bell, avatar menu and search popovers close on Esc and return focus but do not trap or arrow-navigate (`app.jsx:55-66`) (F4) |
| R12 | Length budget: lists cap at 5 rows with a link | DONE | see H3, H4, H6 |
| R13 | Reduced motion honoured | DONE | uses system tokens; app adds no animation |

## Minor findings

- **F1** `scripts/make-icons.cjs:4` still reads `design/builtbyjosef/logos/...`, which is deleted, so the script fails. `design-check.sh:5` does not scan `scripts/`. Expected: no builtbyjosef trace outside README and docs/brief.md. Fix in the icons milestone and add `scripts` to the lint paths.
- **F2** `home.jsx:47` prints "Friday 30 October". Expected "Fri 30 Oct" (DESIGN.md Voice).
- **F3** `time.js:6` `stamp()` is shown on screen at `ui.jsx:156`, `app.jsx:81`, `feed.jsx:11` as ISO. Expected "Fri 30 Oct, 09:15".
- **F4** Bell, avatar and search popovers (`app.jsx:55-66`, `search.jsx`) do not trap focus or support arrow keys; the avatar menu declares `role="menu"` without menu keyboard behaviour.
- **F5** Inline links in panel heads and the "n more" line are under 44 px high. `fl-vote` and `fl-seg` are 36 px in the design system itself.
- **F6** `app.css:46,117,132` raw radii, `!important` at `:42,53,55,60`, and `:67,69` use the stage gradient tokens on the sign-in panel.
- **F7** `#/admin` with no id renders Members and lights "Overview" (`app.jsx:38,52`).
- **F8** A refused Pipeline move leaves the select showing the new column (`projects.jsx:61`).
- **F9** Bell shows a count without the dot the brief asks for (`app.jsx:74`).
- **F10** The Public switch is a bare checkbox with the word "Public" and no on/off word or `role="switch"` (`projects.jsx:22-25`).
- **F11** `views.jsx:39` inline `paddingLeft` for tree depth; a depth class would match the "classes, not inline styles" rule.
- **F12** Home one-liner reads "Checked in for W44" (`home.jsx:80`); and the Projects title says "N running" while counting finished projects too (`projects.jsx:79`).
