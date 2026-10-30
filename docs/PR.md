# Fiat Lux redesign: public site, new features, read-quota fix

**Do not merge or deploy until you have reviewed it.** Deploy from the VS Code terminal in the repo root, in the order under "First deploy" below.

## What this is

The council dashboard has been rebuilt on the Fiat Lux design system. It now has:

- **A public website** at `/`.
- **The members' dashboard**, which moves to `/app/`. Old `/#/...` links and installed icons still land there.
- **New features:** announcements, a calendar with RSVPs, an idea board, document templates with suggestions and approvals, a handover archive, search, @mentions with "Make task", and an admin view.
- **A fix for the free read quota:** an item snapshot document, so you stay on the free Spark plan.

Everything that existed before still works. The checkers found **no open blockers or majors** in the final pass.

## Your decisions recorded in `docs/plan.md` section 1

- **Public feed:** it has no `updatedByUid`, so no email is published.
- **Roster:** the VP may demote or deactivate the president.
- **Device cache:** the persistent multi-tab cache is cleared on Sign out.
- **President's edits:** the president edits everyone except the advisor.
- **Plan:** no paid plan.
- **iPhone:** stays supported.
- **Code size:** a 10 000-line ceiling.

## What changed

- **Two sites, one deploy.**
  - `index.html` with `src/site.jsx` is the public site. It uses Preact and **no Firebase SDK**; `npm run check` fails the build if the SDK ever reaches it.
  - `app/index.html` is the dashboard.
  - The manifest keeps `"id": "/"`, with scope `/app/` and `start_url` `/app/#/week`. Chromium reports no installability errors.
- **Publishing without Cloud Functions.**
  - Admin sessions rebuild `public/feed` on open and every 10 minutes, and "Publish now" forces it. A write happens only when the content changed, and only after a fresh read from the server.
  - The payload is a fixed field list. It holds no names, emails, comments, check-ins or task titles; three checkers confirmed this.
  - Once something is public, only an admin can change its title, place or time.
- **Read budget.**
  - `cache/{term}` holds every live item in one document, so a cold open reads it plus only the items changed since. That is about 210 reads instead of about 590.
  - Data is also cached on the device.
  - Activity, ideas, RSVPs and submissions load only where they are shown.
  - The estimate is about 28 000 reads a day, against the free 50 000. The arithmetic is in `docs/plan.md` section 6.
- **Rules** (`firestore.rules`, 46 tests).
  - **Roles table** enforced exactly as specified.
  - **New collections:** announcements, events, rsvps, ideas, docTemplates, submissions, public/feed and cache.
  - **Item protections:**
    - `touchedAt` is stamped by the server on every item write;
    - only admins set `public` and `publicBlurb`;
    - the vote rule resists `[me, me, me]`;
    - links must be Google Docs or Drive URLs, and the redirector and `..` tricks are refused;
    - `createdAt` and member fields are typed.

  Fields that old documents lack are read with `get(key, default)`, so production data stays editable.
- **Screens.**
  - **Shell:** rail, phone tab bar with a More sheet, search (`/`, arrow keys, Enter, Esc; full screen on phone), the bell with a dot and count, and the avatar menu with a switch to the admin view.
  - **Home:** matches `preview.html`, with the greeting by Jakarta time.
  - **Member screens:** All my tasks, Calendar (week grid 06:00 to 18:00, month view, evening events in the all-day row, project due dates, Upcoming, the event sheet with RSVP and WhatsApp), Projects (Progress, Pipeline, Public switch), Committees, Resources, Ideas, Settings.
  - **Admin:** Overview, Announcements, Members and roles, Workload, Public site, Approvals and archive, Digest.
  - **Sign-in:** split layout.
  - **Comments:** @mentions, and "Make task" for people who manage the item.
- **Seed** (`npm run demo`):
  - announcements: 2 active, 1 expired;
  - events this week and next, including an evening one, with RSVPs;
  - 5 ideas and 6 document templates;
  - 3 pending submissions and 1 filed archive file;
  - projects in each pipeline stage;
  - the snapshot and the feed.

## What was deleted

- `design/builtbyjosef/` and `scripts/jy-check.sh`.
- The About signature (it became Settings).
- Every `jy-` class, `public/favicon.svg`, and the builtbyjosef block in `CLAUDE.md` (rewritten).
- `designsystem/` was moved with `git mv` to `design/fiatlux/`.

## First deploy (VS Code terminal, repo root)

1. Once per computer, select the project (it is registered under the name `build`):

   ```bash
   npx firebase use build
   ```

2. Deploy the indexes:

   ```bash
   npx firebase deploy --only firestore:indexes
   ```

3. Wait until every index shows **Enabled**, in the Firebase console in the browser, under Firestore, Indexes.
4. Deploy everything else:

   ```bash
   npm run deploy
   ```

5. Open the dashboard once as an admin. That builds the first snapshot and the feed.
6. In Projects, Pipeline, move the real projects to the right column; they all start in Planning. Switch on Public for the ones visitors should see and give each a blurb.

## Gates

| Gate | Result |
|---|---|
| 1 Build | Passes. The only note is the Firestore chunk size; the limit is raised to 800 kB because the offline cache adds code. |
| 2 Rules tests | `npm run test:rules`: **46 of 46 pass**. |
| 3 Design check | `npm run check`: `ok fiatlux check clean`, plus `ok public page is Firebase-free`. |
| 4 Screenshots | `docs/qa/screens/`: 66 JPEGs, 4.3 MB. Every member and admin screen, sign-in and the public site at 1440 × 900 and 390 × 844 in dark, plus light for Home, sign-in and the public site. Re-run with `node qa/screens.cjs` while the demo runs. |
| 5 Lighthouse (public site, mobile) | Performance **94**, Accessibility **100** (`docs/qa/lighthouse.md`). |
| 5b Installable | Chromium `getInstallabilityErrors` returns none. |
| 6 Final QC pass | All four checkers plus logic reviewer pass 3: **no open blockers or majors**. Minors are in `qa/BACKLOG.md`. |
| 7 README | Rewritten: architecture, roles, decisions, deploy order, where to run each command. |

## Test output (final pass)

| Suite | Pass | Fail | Notes |
|---|---|---|---|
| `tests/rules.test.mjs` | 46 | 0 | |
| `qa/tests/m1-requirements` (independent) | 72 | 0 | 12 item tests skipped: the prompt does not give the item shape. Covered by the main suite. |
| `qa/tests/m2-feed` (independent) | 20 | 0 | |
| `qa/tests/m3-ui` (independent, browser) | 29 | 0 | |
| `qa/tests/m5-gaps` (independent, browser) | 11 | 0 | Covers mentions, Make task, Add event and Publish now. |
| `qa/tests/*-security` | 64 | 17 | Every red test asserts a minor hardening point that is accepted in the backlog. None is a hole that lets a role do what it should not. |

## What the checkers found and what was fixed

- **M0 plan** (logic and spec checks): 1 blocker and 13 majors, all fixed in the plan before any code. The blocker was auto-publish blanking events when it ran before they loaded. The rest included stale phones republishing private items, legacy items becoming uneditable, the first snapshot never being built, and `@Name` being ambiguous.
- **M1 rules:** a Google-link bypass through `/document/../url?q=` (fixed); Add member overwriting an existing member (fixed).
- **M2 architecture:** a damaged snapshot document would hang the app (fixed); the public page showed filler text without a feed (fixed).
- **M3 shell:**
  - one bad `createdAt` could blank a page; fixed with typed rules, a tolerant formatter and an error boundary;
  - the phone bell popover was clipped (fixed);
  - a stray search close button showed on phone (fixed);
  - "running" counted finished projects (fixed);
  - admin chrome showed on member pages (fixed).
- **M4 features:** Make task never reached Needs you (fixed: it now gets a due date); events saved outside the loaded window did not appear (fixed); double approvals and same-link edits (fixed).
- **Final pass:** no blockers or majors. Small fixes: the bell dot, check-ins refused from teachers and the advisor, typed `createdAt`, a neutral password-reset message, and three wording and order fixes from logic pass 3.

Every report is in `qa/` and `docs/qa/logic-check.md`.

## DONE / PARTIAL / MISSING (final spec check, `qa/final-spec.md`)

- **About 100 requirement lines:** 88 DONE, 11 PARTIAL, 1 MISSING. The MISSING one was this PR text.
- **The PARTIAL items** are minor and logged in `qa/BACKLOG.md`:
  - laptop Home runs to 1.66 to 1.96 screens against the 1.5 budget;
  - popovers close on Esc but do not trap focus;
  - a few tap targets in dense rows are under 44 px;
  - overlapping calendar events overlap;
  - there is no committed calendar month/year boundary test (the independent UI tests cover December to January).
- **App code:** 3 356 lines, against the 10 000 ceiling.

## What could not be tested here, and why

- **Production indexes.** The emulator does not enforce composite indexes, so the first deploy is the first real test. The deploy order above handles the build time, and the item listener falls back if the change query fails.
- **The real Firestore REST read on the public site,** including the API key. It was tested against the emulator only.
- **Real daily read usage.** The 28 000 estimate assumes 3 opens a day per member. Check Firestore, Usage in the Firebase console during the first week.
- **Verification email delivery to school inboxes, iPhone home-screen install, and the cache wipe on real shared computers.** These need real devices and accounts.
- **The quota-exhausted message.** The emulator has no quota.

## Notes for Josef

- **Node 22 vs 24.** `@firebase/storage-compat` wants Node 24.12 or later; this repo runs on Node 22. The pins were not changed, by instruction.
- **npm audit.** It reports 11 vulnerabilities (6 moderate, 5 high) in dependencies. Not fixed, by instruction. Review them with `npm audit` (VS Code terminal, repo root).
- **Base branch.** This PR targets `claude/sharp-dijkstra-mitf3s` (the branch that added `designsystem/`), so the diff shows only this work. Retarget it to your main branch when you merge.

## Open questions

None blocking. One judgment call to confirm: laptop Home runs slightly over its length budget for officers with two announcements. The lists are already capped at 5, so the options are to drop the idea notes from Home or accept it.
