# M4 spec-conformance (Job A)

Checker: independent, read-only on source. Requirements: `qa/PROMPT.md` (owner amendments win). Evidence is `file:line` in the working tree on 30 Oct 2026.
Gates run here: `npm run check` printed two `ok` lines; `npx vite build` has no warnings; `tests/rules.test.mjs` on the alternate ports: 45 of 45 pass. App code is 3 347 lines (ceiling 10 000). The demo was not started (instruction), so "DONE" means read in code plus the rules and unit tests, not seen in a browser.

**Totals: 65 lines. DONE 57, PARTIAL 7, MISSING 1. Blockers 0, majors 1 (A1), minors 8.**

## Screens: Calendar

| # | Requirement | Status | Evidence |
|---|---|---|---|
| C1 | Week view, 06:00 to 18:00 grid | DONE | `src/routes/calendar.jsx:44-71` (12 hour rows, 30-minute cells at :61-64) |
| C2 | Month view | DONE | `calendar.jsx:73-96` (Monday-first, pads to whole weeks) |
| C3 | Previous, Today, next | DONE | `calendar.jsx:178,191-193` (Today clears `d` and `e`) |
| C4 | "Add event" (non-teachers) | DONE | `calendar.jsx:183`, form `:129-167`, action `actions.js:160-168` |
| C5 | Events outside 06:00 to 18:00 as chips in an all-day row | DONE | `calendar.jsx:21,46,50` (`inGrid` tests both start and end, so 18:00 to 21:00 goes up) |
| C6 | Root project due dates as all-day markers | DONE | `calendar.jsx:37,42,50` (week), `:77,89` (month) |
| C7 | Upcoming list (5) and next featured event card with `campus-sunset.webp` | DONE | `calendar.jsx:176-177,200-217`. Quiet choice: the card prefers the next public event over the next event (`:177`). |
| C8 | Event sheet with RSVP (Going / Can't go, counts) and Share to WhatsApp | DONE | `calendar.jsx:98-125` (counts from the `eventId` query `:100`) |
| C9 | No bugs at month and year boundaries, Jakarta dates; "test this" | PARTIAL | Logic is plain string arithmetic (`src/time.js:35-42`). I ran Dec 2026 to Jan 2027, 29 Feb 2028, 31 Jan and 31 Mar: grids, prev/next and week ids are correct (`2026-W53` for 2027-01-01). No committed test covers it (A5). |
| C10 | Several events at one time are all readable | PARTIAL | Week grid places every event at its start row and column with no lane logic (`calendar.jsx:60-66`), so two simultaneous events overlap. The seed has none. (A4) |

## Screens: Resources and Ideas

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Document templates with "Make a copy" (`/edit` becomes `/copy`) | DONE | `resources.jsx:73-89`, `model.js:90` (Docs, Sheets, Slides, Drawings; Drive files and folders say "Open") |
| R2 | "Suggest an edit" | DONE | `resources.jsx:83`, `ShareForm target` `:24-62` creates a `template-edit` with `targetId` |
| R3 | "Share something": new template or archive file, both Google links | DONE | `resources.jsx:43-47,31`, `actions.js:174-179` (client `googleUrl` mirrors the rule) |
| R4 | "My submissions" with status | DONE | `resources.jsx:17-22,90-100` (filters `byUid == me`, so the rule accepts it) |
| R5 | Exec also see project templates | DONE | `resources.jsx:102-106` (a panel linking to `#/templates`, not the list itself) |
| I1 | Idea board with `fl-note` | DONE | `ideas.jsx:22-37,74` |
| I2 | "Pin idea", 140 characters | DONE | `ideas.jsx:63-68` (`maxLength`, counter), `actions.js:150-153`, `firestore.rules:201` |
| I3 | Vote and unvote | DONE | `ideas.jsx:31-32`, `actions.js:154-155`, rule `firestore.rules:190-196` |
| I4 | Admins archive an idea | DONE | `ideas.jsx:30`, `actions.js:156-157`, `firestore.rules:205` |
| I5 | Laptop Home "Top ideas": 3 notes and "Open idea board" | DONE | `home.jsx:116`, `ideas.jsx:39-47` (top 3 of the 20 newest, stated in the file header) |

## New-features table

| # | Requirement | Status | Evidence |
|---|---|---|---|
| T-A1 | announcements: fields, read active, write advisor/president/VP, term-scoped | DONE | `firestore.rules:146-157`; tests `tests/rules.test.mjs:228` |
| T-A2 | Audience picker text "Everyone (also shown on the public website)" / "Members only" | DONE | `admin-views.jsx:105-106` |
| T-A3 | Shown while start ≤ today ≤ end, newest first, max 3; 0 hidden, 1 banner, 2 to 3 cards; click opens the sheet | DONE | `feed.js:9-11`, `shared.jsx:83-102`, `home.jsx:61,86` |
| T-E1 | events: fields, create by any active non-teacher with `public == false` unless admin | DONE | `firestore.rules:159-171` |
| T-E2 | events: update by creator or exec/advisor; `public` only by admin (plus public text locked) | DONE | `firestore.rules:172-176`; client `calendar.jsx:134,141-142`; tests `rules.test.mjs:250` and `qa/tests/m4-security.test.mjs` |
| T-R1 | rsvps: own document only, `id == eventId_me`, `uid == me`, not teachers | PARTIAL | `firestore.rules:179-187` and client `actions.js:170-171` match. The id scheme collides for emails with `_` (M4-S4, minor). |
| T-I1 | ideas: create with `[me]`; vote adds or removes only you; `[me,me,me]` fails; admin archive | DONE | `firestore.rules:190-206`; tests `rules.test.mjs:277-300` |
| T-T1 | docTemplates: Google-only url, version, admin writes instantly | DONE | `firestore.rules:208-219`; `admin-views.jsx:185-204`, `actions.js:208-210`; tests `rules.test.mjs:302` |
| T-S1 | submissions create: active non-teacher as self; `pending` (`filed` for archive) | DONE | `firestore.rules:224-232`; `actions.js:174-179` |
| T-S2 | submissions read: author and admins; member query filters `byUid` | DONE | `firestore.rules:223`; `resources.jsx:19`; admin queries `admin-views.jsx:23,208` |
| T-S3 | submissions update: only admins, only `status` | DONE | `firestore.rules:233-234` |
| T-S4 | Approving a new template creates it, approving an edit bumps the version and url, in one batch | PARTIAL | `actions.js:196-207` is one batch each. Two defects: an edit whose url equals the current url is refused by the rules (`firestore.rules:218` vs `actions.js:204`, M4-S6), and Approve has no in-flight guard so a double click or second admin creates a duplicate template (`admin-views.jsx:225`, M4-S5). |
| T-F1 | `public/feed`: json, hash, updatedAt, size limit, anyone reads, admins write | DONE | `firestore.rules:238-244` (no `updatedByUid`, per amendment) |
| T-X1 | Every new collection in the Close term backup | DONE | `admin.jsx:41-47` (announcements, events, rsvps, ideas, docTemplates, submissions, cache, public feed) |
| T-X2 | Rules tests for every new collection | DONE | `tests/rules.test.mjs:228-375` |
| T-X3 | Seed: 2 active and 1 expired announcement, events this week and next, RSVPs, 5 ideas, 6 templates, 3 pending submissions, public feed | DONE | `scripts/seed-emulator.mjs:74-125` |

## "Also"

| # | Requirement | Status | Evidence |
|---|---|---|---|
| X1 | Comment to task: managers get "Make task"; existing task form opens prefilled; parent = the item, or its parent when the item is a task | DONE | `ui.jsx:157,180-181,186,191`; `projects.jsx:198-202` (`prefill`) |
| X2 | The task lands in the assignee's **Needs you** | MISSING | The prefill has no due date (`ui.jsx:180-181`) and Needs you lists only tasks with `dueDate <= week end` (`home.jsx:20`). A made task never shows there; the assignee gets only the bell notice. **A1, major.** |
| X3 | Assignee = the mentioned person or the comment author; "assigned" notification, nothing else | PARTIAL | Notification and silence are right (`actions.js:43`, toast only). If the mentioned person is inactive or a teacher the list becomes empty instead of falling back to the author (`ui.jsx:181`). (A2) |
| X4 | `@Firstname` autocompletes from the roster | DONE | `ui.jsx:136-139,158-168,200-202` (duplicates get a last initial) |
| X5 | Mention highlighted with `fl-mention`, sends a `mention` notification | DONE | `ui.jsx:141-146`, `design/fiatlux/components.css:288`, `actions.js:131`. Only names picked from the list notify (stated at `ui.jsx:135`). |
| X6 | Share to WhatsApp: events | DONE | `calendar.jsx:103,120` |
| X7 | Share to WhatsApp: tasks | DONE | `projects.jsx:175,180` |
| X8 | Share to WhatsApp: the check-in reminder | DONE | `admin-views.jsx:34,45-46` (plus Copy reminder `:37,45`) |
| X9 | Mission card: three messages, cycled by the arrow, no auto-rotation | DONE | `shared.jsx:104-116` |
| X10 | Mission card on laptop Home only | PARTIAL | `home.jsx:113` adds `fl-desk-only`, but also drops the card on laptop when exactly one announcement shows and the check-in panel is up. Unreported. (A3) |

## Navigation: admin view bullets

| # | Requirement | Status | Evidence |
|---|---|---|---|
| N1 | Overview: needs-attention list only; announcements ending within 3 days, pending submissions, members missing the check-in with Copy reminder, unpublished changes, who has admin | DONE | `admin-views.jsx:30-79` (no stat cards; adds "item cache full") |
| N2 | Announcements | DONE | `admin-views.jsx:83-139` |
| N3 | Members and roles incl. close term | DONE | `admin.jsx`, route `app.jsx:38,50` |
| N4 | Check-ins and workload | DONE | `app.jsx:38,51` |
| N5 | Public site: per-project switches, preview card, Publish now, last published time | DONE | `admin-views.jsx:153-181` |
| N6 | Approvals and archive | DONE | `admin-views.jsx:206-246` |
| N7 | Digest | DONE | `app.jsx:38,51` |
| N8 | Red "Admin view" badge, own rail, "Switch to member view", choice remembered in `localStorage` | DONE | `app.jsx:96-114,150-166,174-175` |
| N9 | Phone: admin sections as a link list on Overview and in More | DONE | `admin-views.jsx:41`, `app.jsx:128-131`, `app.css:201-202` |

## Delete or replace

| # | Requirement | Status | Evidence |
|---|---|---|---|
| D1 | App icons regenerated from `crest.png` on `#0A0A0C` | DONE | `scripts/make-icons.cjs:5-14`; I opened `public/icons/icon-192.png` and `icon-maskable-512.png` (crest centred) and read the corner pixel of all five: `(10,10,12)` |
| D2 | Maskable version with safe padding | DONE | `make-icons.cjs:7` (crest at 64 % of the canvas) |
| D3 | Favicon from the crest, linked | DONE | `public/icons/favicon-48.png`, `index.html:18`, `app/index.html:10` |
| D4 | Theme colour `#0A0A0C` | DONE | `public/manifest.webmanifest`, `index.html:17`, `app/index.html:8` |
| D5 | `docs/brief.md` design and scope sections no longer contradict the prompt | DONE | `docs/brief.md:16-21` (design), `:75-78` (scope, search, archive and templates now in scope) |
| D6 | The rest of `docs/brief.md` does not contradict the prompt | PARTIAL | Stale lines: `:11` "About 2 000 lines" (ceiling is 10 000); `:12` dates as `2026-10-26` (DESIGN says "Thu 29 Oct"); `:35` "advisor and president add or edit. Only the advisor deactivates" (roles table says otherwise); `:62` bell opens a list "at the top of the Feed"; `:70` backup lists only five collections; `:71` roster for advisor and president; `:73` About "signature ... Built by Josef Yang" (prompt: delete the signature); `:49` notification types omit `mention`; `:55,:57` `--ink` tokens of the retired system. (A6) |

## README requirements (Quality gate 7)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| G7a | New architecture | DONE | `README.md:54-72` |
| G7b | What Josef sets up once: nothing new in the console except rules, indexes, hosting | DONE | `README.md:89-117`. Note A7: the first-time Firebase setup was cut and replaced by "see the history" (`:117`). |
| G7c | Decisions: no Functions, no Storage, publish model, roles | DONE | `README.md:59-64,72,74-87,119-127` |
| G7d | Where each command runs | DONE | `README.md:12,40,91,105`; `npm run check` output matches "two `ok` lines" |

## Still LATER (not findings)

- Gate 4 screenshots: `docs/qa/screens/` does not exist yet (only `qa/screens-m3` and `qa/screens-m4`). Needed: every member, admin, sign-in and public screen, 1440 and 390 dark, light for Home, sign-in, public.
- Gate 5 Lighthouse: run 1 is recorded in `docs/qa/lighthouse.md` (Performance 94, Accessibility 100); repeat on the final build.
- Gate 6 final QC pass with all four checkers and logic reviewer pass 3; `qa/BACKLOG.md` will need the minors below.
- Final summary and PR text: `docs/PR.md` does not exist.
- Production indexes (`firestore.indexes.json`) cannot be proved by the emulator. I checked each new query against it (events, announcements, ideas, submissions archive) and all four are present.

## Findings

| ID | Sev | What | Steps and evidence |
|---|---|---|---|
| A1 | major | "Make task" does not land the task in the assignee's Needs you. | As a lead, open any task, comment, press Make task, save with no due date. Expected: it appears in the assignee's Needs you (PROMPT "Also"). Actual: `home.jsx:20` requires a due date within this week; `ui.jsx:180-181` prefills none. Fix: prefill `dueDate` as this Friday (`week().due`) or let Needs you include undated tasks assigned in the last 7 days (`assignedAt`). |
| A2 | minor | Make task assignee is empty when the mentioned person is inactive or a teacher. | `ui.jsx:181` filters after choosing the first mention. Fall back to the author. |
| A3 | minor | Mission card disappears on laptop in one state. | `home.jsx:113`. Unreported length-budget trade. Say so in DESIGN or keep the card. |
| A4 | minor | Overlapping events in the week grid sit on top of each other. | Add two events 15:30 to 16:30 on one day; `calendar.jsx:63`. |
| A5 | minor | No committed test for the month and year boundaries the prompt asked to test. | My ad hoc run passed; add `time` cases to `tests/` or `qa/tests/`. |
| A6 | minor | `docs/brief.md` still contradicts the prompt in the lines listed under D6. | Edit those lines. |
| A7 | minor | README no longer carries first-time Firebase setup (`README.md:117`). | Restore the short list or link a file in the repo, not git history. |
| A8 | minor | Approving a template edit with the same url fails. | See M4-S6 in `qa/m4-security.md`. |
| A9 | minor | Approve and Reject have no busy guard, so a double click duplicates a template. | See M4-S5. |
