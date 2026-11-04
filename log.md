# Work log: UI/UX upgrade and council organisation release

Running log for this release (parts 1 and 2). Newest notes at the bottom of each section.

## Baseline (start)
- `npm run check` ok, `npm run test:rules` 72 pass / 0 fail.
- Critique score 19/40. Calendar inline form, native multi-selects, `failed-precondition` on For you.

## Plan, file by file
Data and rules
- `src/org.js` (new): roles with descriptions, year levels, positions, departments and committees helpers, derived `reportsTo`, rank lookups.
- `src/store.js`: one listener each for `departments` and `committees` (termId), optional, non-blocking.
- `src/model.js`: `member` role, names.
- `firestore.rules`: `member` role; member `departmentId`/`position`; `departments`; `committees`; selection keys `departmentIds`, `ranks`, `teamIds`; event `endDate` for multi-day.
- `firestore.indexes.json`: events invitations index, meetings indexes (For you fix).
- `tests/rules.test.mjs`: tests for every new path.
- `scripts/migrate-departments.mjs` (new), `scripts/seed-emulator.mjs` (demo data).

Calendar (part 1 section 1, with part 2 editor)
- `src/routes/calendar.jsx`: rebuilt. Viewport frame, toolbar, Week grid with lanes, all-day row grid, Month, Agenda, right rail, shortcuts, quick create.
- `src/routes/event-editor.jsx` (new): split-screen editor with live preview, templates markers, duplicate, repeat weekly.
- `src/pickers.jsx` (new): date picker, time field, participant picker (by department, by rank, special committee, search).
- `src/event-model.js`: new selection keys, resolver over departments, committees and ranks, `endDate`.

Event settings (part 1 section 2)
- `src/routes/event-settings.jsx`: three tabs, plain sentences, row layout fixes, apply-defaults as confirm step.

App-wide (part 1 section 3)
- `src/attention.js` / `src/routes/attention.jsx`: plain errors with Retry; loading or error, not both.
- `src/app.jsx`: nav (Ideas, Check-in, Admin entry), `#/home` route with redirects, avatar menu.
- `src/routes/admin.jsx`: members management screen (part 2 replaces part 1 table work).
- `src/routes/people.jsx`: Committees tab, three views (part 2).
- `src/routes/home.jsx`, `projects.jsx`, `admin-views.jsx`, `workload.jsx`, `digest.jsx`, `ideas.jsx`, `views.jsx`, `app.css`: small fixes.
- `src/routes/department.jsx` (new): My department page; first-run checklist on Home.

## Done
- Data: `org-model.js` (pure), `org.js`, `org-actions.js`; departments and committees listeners; `member` role; rules for departments, committees, member positions, lead edits, new selection keys, `endDate`.
- Calendar rebuilt: frame, week grid with lanes and widening, all-day grid row, Month, Agenda, rail, shortcuts, quick create, event sheet with RSVP tally and Duplicate.
- Split-screen event editor with live preview, clash warning, template markers, weekly repeat; participant picker (department, rank, committee, search chips).
- Event settings tabs; plain errors app-wide; For you Retry and indexes.
- Members and roles management (filters, sort, sticky header, bulk preview, undo, quick add, CSV with department and position).
- Committees: general committee, special committees, org charts; My department; first-run checklist.
- Home, Projects, Public site, Workload, Digest, Ideas and small fixes.
- Seed data: 28 people, 6 departments, Carnival committee (Finance, Tenant stall, Reach and registration, Stage crew with no leader), overlapping events, 15-minute and 4-hour events, evening event, all-day and multi-day events, three deadlines on one day, a pending request.
- `scripts/migrate-departments.mjs`, tested twice on the emulator.
- `npm run check` ok; `npm run test:rules` 83 pass; `npm run test:models` pass.

## Next
- QA run done: approvals over the rules budget (fixed, tested), Back link kept the old view (fixed), repeat link wording (fixed), wide org charts clipped on the left (fixed). Nine of ten journeys passed cleanly.

## Open issues
- None blocking. See decision.md 9 (multi-day window) and 17 (rules budget).
