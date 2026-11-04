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
(updated as work lands)

## Next
(updated as work lands)

## Open issues
(updated as work lands)
