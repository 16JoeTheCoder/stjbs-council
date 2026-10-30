# Build prompt: STJBS Student Council portal, Fiat Lux redesign

(Verbatim copy of the owner's build prompt, kept here so checker agents can read the requirements. Source of truth for every QA report in `/qa`.)

**Owner amendments (29 Oct 2026). These override the text below; see `docs/plan.md` section 1:**
- The ~3 500-line target in ground rule 5 is replaced by a 10 000-line ceiling. Build as rich as needed, as long as it stays lean and unbreakable.
- `public/feed` has no `updatedByUid` field (it would publish a student's email).
- The VP demoting or deactivating the president is intended.
- No paid Firebase plan; the read quota is handled by the item snapshot document (plan section 6).
- The persistent cache uses the multi-tab manager and is cleared on explicit sign-out.
- The president may edit the name, section and reports-to of everyone except the advisor.

You are a senior product engineer and interface designer taking over a working codebase. You write lean, boring, correct code and produce interfaces that look expensive. You treat the Firestore security rules as the real permission layer, you never break data that already exists in production, and you know when to stop adding things. The owner, Josef Yang (Vice President of the council), maintains this alone between school and exams, so **low maintenance beats clever** every time.

## The job in one paragraph

The repo `stjbs-council` (this session's checkout) is a working Vite + Preact + Firebase dashboard for the St. Johannes Berchmans School student council. Redesign it to the **Fiat Lux** design system (dark SaaS, Berchmans red, school photography), add a **public site** and the **new features** below, and remove every trace of the old **builtbyjosef** design system. Keep every existing feature working, keep the Firebase setup exactly as configured, and keep the code small.

## Environment: this is a cloud session

- You run in a private Linux workspace. Already verified here: Java 21, `npm ci`, `npm run test:rules` (18 of 18 pass) and headless Chromium via Playwright all work. Run `npm ci` again if `node_modules` is missing.
- Network access is an allowlist (npm, pip, GitHub). If any request to another site is refused, do not retry with another command: say so plainly and continue with what you have. Nothing in this job needs the open internet.
- Background processes can be stopped a few minutes after a reply ends. Start the Firebase emulator and the dev server at the beginning of each check run, and stop them at the end. Never rely on one left running between turns.
- For Lighthouse, use the Chromium that Playwright installed (set `CHROME_PATH` to it) instead of downloading another browser.
- Node here is v22 and one Firebase package warns it wants 24. Do not change Node pins or upgrade Firebase packages. Do not fix `npm audit` findings. Write both into `/qa/BACKLOG.md` and the PR as notes for Josef.
- The design system is in the repo at **`designsystem/`** (no spaces; contains `DESIGN.md`, `tokens.css`, `components.css`, `preview.html`, `reference/` and the images). Your first action is to confirm those files exist and report any that are missing. If something essential is missing, stop and say so.
- Work on branch `fiatlux-redesign`, created from the branch this session is on. Push the branch to origin after every milestone so the work is backed up. Open the pull request with the GitHub tools if you have them; otherwise write the full PR text to `docs/PR.md` and say so.

## Ground rules

1. **Read first, then plan, then build.** Before writing code, read every file in `src/`, `firestore.rules`, `tests/`, `scripts/`, `README.md`, `docs/brief.md`, `docs/qa/*.md`, `firebase.json`, `index.html`, `vite.config.js`, `public/manifest.webmanifest`, and the design system (`designsystem/DESIGN.md` first, then `tokens.css`, `components.css`, `preview.html`, the images in `reference/`).
2. **Do not touch the Firebase configuration:** `src/firebase.js` (one allowed exception: if your read-budget arithmetic exceeds 30 000 reads a day, switch `getFirestore` to `initializeFirestore(app, { localCache: persistentLocalCache() })` so reopening the app does not re-read everything), `.env.example`, `.env.emulator`, `firebase.json` emulator and Firestore sections, `.firebaserc` and the project binding, the email-and-password sign-in flow with email verification. You may add Hosting configuration for the two entry points and new Firestore rules and indexes.
3. **Production data must keep working.** Never rename or remove an existing collection or field. New fields are optional and every reader treats a missing value as the default (`public` missing means false, and so on). No migration scripts.
4. **No new runtime dependencies.** Preact and Firebase only. No UI kit, CSS framework, chart, date or icon library (inline Lucide SVG). The public site must not load the Firebase SDK at all (see Architecture). Dev dependencies for testing (Playwright, Lighthouse) are allowed.
5. **Lean.** Target: app code (excluding CSS, rules, tests) stays under about 3 500 lines. Reuse `store.js`, `model.js`, `actions.js`, `time.js` patterns. One component per idea, no wrappers around wrappers, no dead code, no commented-out code. Skip anything that costs a lot of effort or tokens without substantially improving the product; know when to stop.
6. **Small commits** with clear messages on `fiatlux-redesign`.
7. When you tell Josef to run anything (README, PR text), say exactly where: "VS Code terminal in the repo root", "Firebase console in the browser".
8. **Never use real or production data in any test.** All testing runs against the Firebase emulator (`npm run demo`) with the seed script and test accounts only. Never point any checker at the production Firebase project.

## Quality control: milestones and checkers (required)

Build in milestones. Do not wait until the end to check your work. After each milestone, run the checks below using subagents, and do not start the next milestone until blockers and major issues from the current one are fixed.

**Milestones:**

- **M0:** plan (`docs/plan.md`).
- **M1:** rules, data model, roles and the new rules tests.
- **M2:** architecture: two entry points, public site, publish flow, read-budget work.
- **M3:** design system import, app shell, navigation, sign-in, Home, search.
- **M4:** Calendar, Projects, Committees, Resources, Ideas, comment features, share features.
- **M5:** admin view, seed data, icons, README, final polish.

Merge or split milestones only if the plan justifies it. Keep the total to six or fewer to control cost.

**Checker rules.** All checker subagents use model **sonnet** and start with no knowledge of how the code was built, which is the point. They never edit project source files. They may only write inside the folder `/qa` at the repo root (the logic reviewer's `docs/qa/logic-check.md` is the single exception). Each writes its findings to its own file in `/qa` and returns a short summary to you. Every finding has a severity (blocker, major or minor), exact steps to reproduce, expected versus actual, and evidence (screenshot path, command output, file and line). Add `/qa` to the PR but never to the production build.

**After every milestone, run these four checks in parallel where possible:**

1. **Alpha tester.** Acts as a first-time user who has never seen the code. Starts the app itself with `npm run demo` (emulator, seeded data, test accounts), using headless Chromium via Playwright. Drives the app in the browser, takes screenshots and looks at them. Covers everything built so far: the roster-gated email-and-password sign-in, verification and reset flows, wrong passwords, sign out, empty states, every core action for each role (create, edit, archive, search, filter, move, RSVP, vote, submit, publish), and checks that numbers, percentages, counts and dates match the data entered. Tries blank, invalid, very long and special-character input. Refreshes mid-flow, uses back, and opens `#/admin/...` routes and `/app/` while signed out or as the wrong role. Repeats the main flows at 390 px. Watches for console errors, failed network requests, missing loading and empty states, broken layout, confusing errors and dead buttons. If no browser works, says so clearly and falls back to HTTP-level tests; it never silently skips UI testing.
2. **Spec-conformance checker.** Breaks this prompt's requirements (Keep list, Delete/replace list, Architecture, Roles table, Navigation, Screens, data model table, Quality gates) into individual lines. Marks each DONE, PARTIAL or MISSING with evidence from the code and the running app. Pays special attention to quiet shortcuts: placeholder data, hardcoded values, UI that does nothing, TODOs, and anything simplified without being reported. Reports the full table.
3. **Security reviewer.** Checks authorization on every route and every Firestore rule: can any role read or write something it should not, can one user change another user's data by altering an ID (RSVP ids, submission queries, member documents), does the vote rule resist `[me, me, me]`, can anyone but advisor, president or VP set `public` or `publicBlurb`, can a president change roles, does the public feed or any other public surface leak a student's name, email, initials, comment, check-in or task title. Checks for exposed secrets in code, config, logs and the built bundle, that `.env` files are git-ignored, input validation, XSS in user-provided text and links (docTemplates and submissions URLs must be restricted to the Google domains), and unsafe link handling. Login rate limiting is handled by Firebase Authentication; verify it is not bypassed rather than rebuilding it. Reports only what it can demonstrate or point to in code.
4. **Independent test writer.** Sees only this prompt and the running app, not the implementation. Writes tests from the requirements alone, puts them in `/qa/tests`, runs them against the emulator, and reports which fail. Rules-level behaviour goes into the existing `npm run test:rules` suite only after you review it; the independent tests stay in `/qa/tests`.

**The logic reviewer (a fifth, separate subagent, no access to your reasoning, only to the repo, the design system and this prompt).** Its job is to find contradictions, permission holes and things that will break, not to praise. It runs at three fixed points, and its findings go to `docs/qa/logic-check.md` (severity, location, what is wrong, what to do). Keep the file as the audit trail:

1. **After the plan (M0):** does the keep/change/delete map lose any existing feature? Does any request in this prompt contradict another, the existing rules or production data? Is anything over-built for a 30-person council?
2. **After the rules and data model (M1):** can any role read or write something it should not? Can the public feed leak a student's name or email? Do roles match the table below exactly? Will any screen exceed the read budget?
3. **Before finishing (M5):** walk every screen as each role (officer, treasurer, president, VP, advisor, teacher, signed-out visitor) at 390 px and 1440 px in both themes. Anything confusing, too long, unreachable, broken or useless?

**Fix loop.** After the checks, read every report in `/qa` and `docs/qa/logic-check.md`. Fix every blocker and major issue. Then spawn fresh sonnet checkers to re-run only the failed flows. Repeat for at most **3 rounds per milestone**. Minor issues are not fixed immediately: collect them in `/qa/BACKLOG.md`. Do not chase cosmetic polish; stop when the milestone's requirements are met and no blockers or majors remain. If a checker and this prompt disagree on something that cannot be fixed safely, stop and write the question in the PR instead of guessing.

**Final pass.** When all milestones are done, run one full pass of all four checks plus the logic reviewer's third pass over the whole app, fix what is needed, then write the final summary in the PR: what was built, which requirements are DONE, PARTIAL or MISSING, what the checkers found and what you fixed, what remains in the backlog, and anything you could not test and why. Be honest. Do not say something works unless a checker or a test confirmed it.

## Step 0 (M0): plan, then stop

Write `docs/plan.md` (short): a keep / change / delete table for every file, the new collections and rules, the route map, the milestone list, the read-budget arithmetic, and anything in this prompt you think is wrong. Run the checks that apply to a plan (spec-conformance on the plan, logic reviewer pass 1) and fix blockers and majors. Commit and push the plan, then **stop and show me `docs/plan.md` and the logic reviewer's pass 1 findings. Wait for my go-ahead before starting M1.**

## Keep (every one of these must still work afterwards)

My week tasks and filters (All, Mine, Due soon, Overdue, Blocked, Done, Hide done), project tree with drill-down and breadcrumbs, subteams and leads with `leadUids` propagation, task editing with the assignee-only field limits, deals (stage bar, pledged and received IDR, deal table), weekly check-in (done, doing, blocked, due Friday 23:59 Asia/Jakarta), meeting swimlane view, comments, in-app notifications and the unread bell, activity feed, people list and org chart and team chart, timeline, workload table and weekly snapshots, digest builder with WhatsApp share, project templates (JSON import, export, AI prompt), roster admin, close term with forced backup, install-app button and iPhone instructions, light and dark themes, emulator demo (`npm run demo`) and rules tests (`npm run test:rules`).

## Delete or replace

- `design/builtbyjosef/` (whole folder), the builtbyjosef block in `CLAUDE.md`, `scripts/jy-check.sh`, the signature on the About page, every `jy-` class.
- Replace with: `git mv designsystem design/fiatlux` (so the folder `designsystem/` no longer exists afterwards), imported once in the entry (`tokens.css` then `components.css`). App-specific CSS goes in a small `src/app.css` using tokens only and the `fl-` prefix. The design system has no components for the kept features below; build each in `src/app.css` from the nearest existing component, one fixed form each: timeline bars, meeting swimlanes, org chart, deal stage bar, filter chips with counts, breadcrumbs, and a horizontally scrolling table wrapper (`fl-scroll`). `preview.html` uses a few inline styles for brevity; use classes instead. Replace `scripts/jy-check.sh` with `design/fiatlux/design-check.sh` and wire it to `npm run check`.
- Rewrite `CLAUDE.md` to a short council block: follow `design/fiatlux/DESIGN.md`, run `npm run check` and `npm run test:rules` before finishing, keep Firebase config, say where commands run, build only when told to.
- App icons and favicon: regenerate from `design/fiatlux/img/crest.png` (update `scripts/make-icons.cjs`: crest centred on `#0A0A0C`, maskable version with safe padding). Theme colour `#0A0A0C`.
- `docs/brief.md`: update the design and scope sections so they no longer contradict this prompt (search, handover archive and document templates are now in scope).

## Architecture: one database, two front ends

- **One repo, one Firebase project, one deploy, two Vite entry points.**
  - `/` is the **public site** (`index.html`, its own tiny script). No sign-in, no Firebase SDK.
  - `/app/` is the **dashboard** (`app/index.html`, the existing Preact app, hash routing as now).
  - Configure Vite multi-page build and Firebase Hosting so both are served; keep the `/assets/**` cache header.
  - **No Hosting rewrites.** Firebase serves `dist/app/index.html` at `/app/` by itself; a catch-all rewrite would send `/app/*` to the public page.
  - Backward compatibility: anyone opening an old link like `/#/week` must land on `/app/#/week`. Do it with an inline `location.replace` in the public page head, before anything renders.
  - The manifest is linked only from `app/index.html`, keeps `"id": "/"` so existing installs keep their identity and are not duplicated, and uses scope `/app/`. Copy the inline theme script into `app/index.html`.
  - Import hero images through Vite (so they get hashed names and the `/assets/**` cache header) instead of serving them from `public/img/`.
- **The public site reads one document**, `public/feed`, through the Firestore REST endpoint (`GET https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/public/feed`, project id from the Vite env; when `VITE_EMULATORS === '1'` use `http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/public/feed` so the demo shows the live section). The document holds a single string field `json` (the whole payload, `JSON.parse` it) plus `updatedAt`. One read per visit, no SDK, no listeners. If the fetch fails, show the last copy from `localStorage` and a quiet "Updated earlier" note; if there is none, show the static page without the live section.
- **Publishing without Cloud Functions** (Functions need the paid Blaze plan; stay on the free Spark plan):
  - Admins (advisor, president, VP) see a "Publish now" button on the Public site admin screen.
  - Auto-publish: when an admin role (advisor, president, VP, in either view) opens the dashboard and then every 10 minutes while it stays open, rebuild the payload and write it only if its hash differs from the `hash` field stored in `public/feed`. Skip entirely while `S.error` is set or `loaded()` is false, so a client with dead listeners never overwrites newer data. Read `public/feed` with one listener in admin sessions only.
  - The payload is built from data already in the store, with an explicit field whitelist per type:
    - **Public-flagged root projects:** title, stage, percent done, done and total task counts, `publicBlurb`, updatedAt.
    - **Public events from today on:** title, type, date, start, end, location.
    - **Announcements with audience "everyone" and `endDate >= today`**, future starts included: title, body, startDate, endDate.
  - The public page re-filters by Jakarta today when it renders, so expired items disappear and future announcements appear on their start day even if nobody republishes. It shows "Last change 3 min ago" (the feed's `updatedAt`), not "Updated".
  - **Never put names, emails, initials, comments, check-ins or task titles in the payload.** The security reviewer and logic reviewer must both confirm this.
  - Rules: `public/feed` is readable by anyone and writable only by advisor, president and VP; reject `json.size() > 200000` (characters, well under the 1 MiB document limit).
- **No Cloud Storage** (new buckets need Blaze). Files are always Google Drive or Docs links.
- **Read budget** (free tier is 50 000 reads a day, and on Spark reads simply fail after that):
  - A cold open already costs about 500 to 700 reads (term items, members, check-ins, activity, notifications, settings), and an installed app reloads on every open.
  - New listeners are small and bounded:
    - events from 7 days ago to 60 days ahead;
    - announcements with `endDate >= today`;
    - document templates.
  - Ideas load only on laptop Home and the Ideas route (limit 20, newest or top first).
  - RSVPs load only when an event sheet is open.
  - Submissions and the archive load only inside the admin view.
  - No feature may need a count across a collection that is not already loaded (for example comment counts per project; leave them out).
  - New listeners stay out of `loaded()`, so one failing query cannot block the app.
  - Day-scoped listeners (announcements, today's agenda) restart when the Jakarta date changes, inside the existing 60-second interval in `store.js`.
  - Put the arithmetic in the plan: reads per cold open × opens per day × 30 members, including the Workload `getDocs` over the term's check-ins.
  - **Indexes:** list every new query with its composite index in the plan and add them to `firestore.indexes.json`. The emulator does not enforce indexes, so production is the first real test; flag this in the PR as the one thing no checker can verify.

## Roles (exact)

| Role | Can |
|---|---|
| advisor (Mr Ariel) | Everything. The only one who sets `settings/current` and assigns or removes the advisor role. |
| vp | Admin view. Add members. **Change any member's role and active flag, except the advisor's and their own**, and never assign "advisor". Announcements, publishing, approvals. |
| president | Admin view. Add members **only with non-admin roles** (officer, treasurer, secretary, teacher), and edit name, section and reports-to. **Cannot change anyone's role or active flag**, and cannot create a VP, president or advisor. Announcements, publishing, approvals. |
| treasurer, secretary | Same as today (exec: create root projects, digest, project templates). No admin view. |
| officer | Same as today. |
| teacher | Read and comment only, as today. |

This changes the current roster rules (today the president can change roles and only the advisor deactivates). Rule trap: the president's update must use `changed().hasOnly(['name', 'section', 'reportsTo', 'initials', 'termId', 'updatedAt'])`, because `putDoc` and `MemberForm` always send `initials`, `termId` and `updatedAt`. Close term stays visible to the advisor only, as now. Update `firestore.rules`, the Admin UI and `tests/rules.test.mjs` to match, and keep "no one changes their own role or active flag".

## Navigation

- **Laptop (900 px and up):** left rail with the crest lockup ("Student Council", "St. Johannes Berchmans"), nav **Home, Calendar, Projects, Committees, Resources**, and the photo card at the bottom. Top bar: "Search anything" on the left; on the right the notification bell (unread dot plus count) and the avatar menu.
- **Phone:** no rail. The top bar keeps the crest, bell and avatar, with search on its own row. A floating bottom bar has five icon tiles: **Home, Calendar, Projects, Ideas, More**, with the active tile solid red. Copy `reference/phone-tabbar.png` and `preview.html`. **More** opens a sheet with Committees, Resources and (for exec) Digest, so no destination exists only on laptop. In admin view on a phone, the admin sections appear as a link list at the top of the admin Overview, and the More tile lists them too.
- **Avatar menu:**
  - My profile (person page).
  - Settings: theme, install app, About with the version number.
  - "Switch to admin view" (advisor, president, VP only).
  - Sign out.
- **Where today's screens go:**
  - My week becomes Home.
  - People becomes Committees: people grouped by section, with the org chart and team chart inside.
  - The meeting view, timeline, team chart and deals stay inside Projects.
  - The Feed becomes the bell's "See all activity" page.
  - The check-in form is reached from Home.
  - Digest and project templates stay where exec can reach them: a "Digest" action on Projects, and project templates inside Resources for exec.
- **Admin view:** same shell, red "Admin view" badge under the crest, its own rail, and "Switch to member view" in the avatar menu. The choice is remembered in `localStorage`. Routes live under `#/admin/...`. Rail:
  - **Overview:** a needs-attention list only, no stat cards:
    - announcements ending within 3 days;
    - pending submissions;
    - members missing this week's check-in, with a "Copy reminder" button that copies a WhatsApp-ready text naming them;
    - unpublished public changes;
    - who has admin (from the members already loaded).
  - **Announcements**.
  - **Members and roles:** the existing roster plus close term.
  - **Check-ins and workload:** the existing Workload screen.
  - **Public site:** per-project public switches, a preview card, "Publish now" and the last published time.
  - **Approvals and archive**.
  - **Digest**.

## Screens

Follow DESIGN.md exactly, including the **length budget**: Home fits in about 1.5 laptop screens and 5 phone screens, lists cap at 5 rows with a "see all" link, and there are no stat rows on Home. `preview.html` is the reference composition for Home; match it.

- **Home:**
  - Hero: `campus-sunset.webp`, "Good afternoon, **Josef.**" by Jakarta time (use the signed-in member's first name), and one line ("3 tasks this week · check-in closes Friday").
  - Announcements, only if any are active.
  - Needs you: tasks due this week plus "Blocked on you", max 5.
  - Today's agenda: today's events only, max 5 (tasks already live in Needs you).
  - Check-in red panel, only while this week's check-in is missing.
  - My projects: up to 3, each with its subteam steps (`fl-steps` shows at most 5, then "+n").
  - Mission card (laptop only).
  - Top ideas (laptop only): 3 notes and "Open idea board".
  - Phone order is in DESIGN.md.
  - The task filter bar moves to an "All my tasks" page linked from Needs you.
- **Calendar:**
  - Week view (06:00 to 18:00 grid) and Month view, previous, Today and next, and "Add event". Events outside 06:00 to 18:00 (an evening carnival) show as chips in an all-day row above the grid.
  - Root project due dates also show as all-day markers.
  - Below the grid: an Upcoming list (5) and the next featured event card (`campus-sunset.webp`).
  - Event detail opens in a sheet with RSVP (Going / Can't go, with counts) and "Share to WhatsApp".
  - No bugs at month and year boundaries, and all dates in Asia/Jakarta: test this.
- **Projects:**
  - **Progress** (default): one card per root project, with its subteams as steps (done when every task in the subteam is done, at most 5 shown then "+n"), percent and the next due task.
  - **Pipeline:** root projects in Planning (todo), In progress (doing) and Done (done) columns, with a "Move" control for managers.
  - The existing drill-down, timeline, team chart, meeting view and deals stay intact.
  - Admins see a "Public" switch on root project cards.
- **Committees:** sections as groups of person chips, tapping opens the person page, plus the existing org chart and team chart.
- **Resources:** document templates with "Make a copy", "Suggest an edit" and "Share something" (a new template or an archive file, both as Google links), and "My submissions" with status. Exec also see project templates here.
- **Ideas:** the idea board (`fl-note`), "Pin idea" (140 characters), and vote or unvote. Admins can archive an idea.
- **Search:**
  - Client-side only, over data already loaded: projects and tasks, people, events, announcements, templates. No extra reads.
  - Results are grouped, keyboard friendly (`/` focuses search, arrows move, Enter opens, Esc closes).
  - On phone it opens as a full-screen sheet.
- **Sign-in:** split layout. Left is a stage panel with `campus-sky.webp`, the crest and "Lead. Serve. Build."; right is the existing email and password form, verification, reset, install help and roster message. Keep the logic. Access stays roster-gated; there is no open sign-up.
- **Public site** (`/`, `fl-` classes, dark, works on phones):
  - Top bar: crest, Home, Events, Projects and About anchors, and a red "Dashboard" button linking to `/app/`.
  - Hero `fl-hero--tall` with `building.webp`: "**Lead.** Serve. Build.", "Explore our work" (scrolls to Live) and "Join us" (scrolls to a short How to join section in the footer: talk to any officer).
  - Announcements, same component as Home, everyone-audience only.
  - "What we are working on now" with an `fl-live` dot and "Updated 3 min ago": the public project cards.
  - Coming up: public events.
  - A mission strip and a footer.
  - Only the Live section depends on the feed.

## New features (data model and rules)

All new documents carry `createdAt` and `archived: false` instead of deletes. **Term-scoped** (carry `termId`, pass `termOk()`, filtered by term): announcements, events, RSVPs, ideas. **Cross-term** (no term filter, they must survive Close term): `docTemplates`, `submissions` (the handover archive), `public/feed`. Add every new collection to the Close term backup download. Teachers stay read and comment only: every new create or update rule below also requires `role() != 'teacher'` unless it says otherwise.

| Collection | Fields | Rules |
|---|---|---|
| `announcements/{id}` | title (1 to 80), body (max 2 000), audience `everyone` or `members`, startDate, endDate (`YYYY-MM-DD`, end not before start), createdByUid, archived | Read: active members. Write: advisor, president, VP. The audience picker reads "Everyone (also shown on the public website)" and "Members only". Shown while start ≤ today ≤ end (Jakarta), newest first, max 3 on a page. 0 = section hidden, 1 = wide banner, 2 to 3 = cards; click opens the `fl-sheet`. |
| `events/{id}` | title, type `meeting` / `project` / `committee` / `other`, date, start, end, location, notes, public (bool), itemId (optional), createdByUid, archived | Read: active. Create: any active non-teacher, with `public == false` unless the writer is advisor, president or VP. Update or archive: creator or exec and advisor, but **`public` may only change when the writer is advisor, president or VP**. |
| `rsvps/{eventId}_{email}` | eventId, uid, status `going` / `not` | Read: active members (query `where('eventId', '==', id)` when the event sheet opens; counts computed client-side). Create and update: own document only, `id == eventId + '_' + me()` and `uid == me()`, not teachers. |
| `ideas/{id}` | text (1 to 140), authorUid, voters (array of emails), archived | Read: active. Create: active non-teacher, author is me, voters `[me]`. Update: only `voters`, and only adding or removing yourself. Write it as both a set check and a size check (`voters.size() == resource.data.voters.size() ± 1` and the set difference is exactly `[me()]`), so `[me, me, me]` cannot inflate votes; test it. Archive by advisor, president, VP. |
| `docTemplates/{id}` | name, kind, url (must start with `https://docs.google.com/` or `https://drive.google.com/`), version (number), archived | Read: active. Write: advisor, president, VP (instant). "Make a copy" turns `/edit...` into `/copy`. |
| `submissions/{id}` | type `new-template` / `template-edit` / `archive`, name, url (Google link), targetId (for edits), projectId (for archive), note, byUid, status `pending` / `approved` / `rejected` / `filed` | Create: any active non-teacher as themselves, status `pending` (`filed` for archive). Read: the author and advisor, president, VP (the member's "My submissions" query must filter `where('byUid', '==', me)` or the rule refuses it). Update: only advisor, president, VP and only `status`. Approving a new template creates a `docTemplates` doc; approving an edit updates the url and increments the version, in the same batch. Archive files are readable by admins (and the author) only. |
| `public/feed` | json (string), hash, updatedAt, updatedByUid | Read: anyone. Write: advisor, president, VP, size limited. |
| `items` | add optional `public` (bool) and `publicBlurb` (max 140) on root projects | **Only advisor, president or VP may set or change them**, on create and update. Today's rule lets any lead in `leadUids` change any field, so add an explicit check; assignee limits stay. |

Also:

- **Comment to task:** on any comment, people who can manage the item get "Make task". It opens the existing task form prefilled (title from the comment, parent = the item, or the item's parent when the item is itself a task, because tasks are leaves; assignee = the mentioned person or the comment author). The task lands in that person's Needs you and they get the existing "assigned" notification. Nothing else pops up.
- **@mentions in comments:** `@Firstname` autocompletes from the roster, is highlighted with `fl-mention`, and sends a `mention` notification.
- **Share to WhatsApp:** events, tasks and the check-in reminder use `https://wa.me/?text=` with encoded text, like the digest.
- **Mission card:** messages "Ad maiorem Dei gloriam.", "Small steps create big change." and "Lead. Serve. Build.", cycled by the arrow button, with no auto-rotation.

Add rules tests for every new collection and for the new roster permissions. Extend `scripts/seed-emulator.mjs` with demo announcements (2 active, 1 expired), events this week and next, RSVPs, 5 ideas, 6 document templates, 3 pending submissions, and a public feed, so `npm run demo` shows every screen populated. This seed is also the test database for every checker.

## Quality gates (all must pass before the PR)

1. `npm run build` passes with no warnings beyond the existing Firestore chunk-size note.
2. `npm run test:rules` passes, with the old tests (updated for the roster change) and the new ones.
3. `npm run check` (`design/fiatlux/design-check.sh`) prints `ok`.
4. Playwright screenshots (add `playwright` and `lighthouse` as devDependencies; `make-icons.cjs` already needs Playwright) of every member screen, every admin screen, sign-in and the public site:
   - Sizes and themes: 1440 × 900 and 390 × 844 in dark; light theme only for Home, sign-in and the public site.
   - Source: run against `npm run demo`.
   - Output: `docs/qa/screens/`, compressed.
   - Look at every one yourself and fix what looks wrong: overflow, clipped text, empty states, contrast, anything longer than the length budget.
5. Lighthouse on the public site (mobile): Performance 90 or more, Accessibility 95 or more. The dashboard must still be installable as an app (manifest scope `/app/`, `start_url` `/app/#/week`).
6. The final QC pass (all four checkers plus the logic reviewer's third pass) has no open blocker or major findings, and `/qa/BACKLOG.md` holds the remaining minors.
7. README updated:
   - New architecture.
   - What Josef sets up once: nothing new in the Firebase console except deploying rules, indexes and hosting.
   - Decisions: no Functions, no Storage, publish model, roles.
   - Where to run each command.

## Finish

Push `fiatlux-redesign` and open the PR (or write `docs/PR.md`) with: what changed, what was deleted, the read-budget estimate, the screenshots, the test output, `docs/qa/logic-check.md`, the `/qa` reports and backlog, the Node 22 versus 24 and `npm audit` notes, the final honest summary (DONE / PARTIAL / MISSING table, what was fixed, what could not be tested and why), and any question you could not answer safely. Do not merge or deploy; Josef deploys with `npm run deploy` from the VS Code terminal in the repo root after reviewing.
