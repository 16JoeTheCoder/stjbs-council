# Decisions for Josef

Every design or technical decision made during this release, in plain language: what, why, and what was rejected.

## Ground rules

1. **Fiat Lux wins over the general brand note.** A personal note on this machine names a different palette (ink, paper, orange). The project's `CLAUDE.md` and `design/fiatlux/DESIGN.md` are the rule book for this repo, so every colour here is a Fiat Lux token. Rejected: mixing the two palettes.
2. **Part 2 wins where it conflicts with part 1.** The event editor is built once, as the split-screen editor from part 2, not first as the side sheet from part 1. The participant picker is built once, as part 2's card picker, and it also keeps part 1's search box, kind labels, struck excluded chips with undo and the live count.
3. **No new runtime dependencies.** Date picker, time field, combobox and drag-to-create are written by hand, small. A date library would add more code than it removes.

## Calendar

4. **One scroll box for the week.** The day header, the all-day row and the time gutter are sticky inside one scrolling box, so they always line up. Rejected: separate scrolling panes kept in sync by script, which drift on trackpads.
5. **Busy days get wider columns.** With 24 px per 15 minutes and the right rail open, a day column is about 110 px on a laptop. Four overlapping events in that width are unreadable, so a day's column widens with its number of side-by-side lanes (each lane at least 52 px). If the week then no longer fits, the grid scrolls sideways inside its box, never the page. Rejected: overlapping cascades, which hide titles.
6. **Deadlines are project and team due dates.** Tasks are too many to show; root projects and their teams show as dashed "Due" chips, the same look in Week and Month.
7. **The empty-week hint floats over the grid** instead of replacing it, so people can still click a time to add an event.
8. **Requests live in the rail, review happens in a sheet.** The half-width Upcoming panel and the sunset hero are gone from this page.
9. **Multi-day events** use a new optional `endDate` field, only on all-day events. The events query still filters on the first day, so an event that started more than 7 days before today's window is not shown in the live window; a page turn reads its range and finds it. Acceptable for exam weeks and trips.
10. **Repeat weekly fits the data model**, so it is built: it creates up to 26 separate events, one per week, each through the normal save (so approvals and invitations work the same). It is offered only for new, timed events. No series document exists, so changing one repeat never changes the others; the editor says so.
11. **Quick create uses the default template's policy.** If that makes the event need approval, the popover says so and the button reads "Send request" before anyone clicks.

## Event editor

12. **The editor is a full-screen overlay, not a route**, so the calendar stays where you left it. Esc and Close ask before discarding unsaved changes.
13. **Template markers compare values.** A field shows "From template" while it still equals the template's value, and "Reset to template" once you change it. Rejected: tracking a separate "touched" flag per field, which lies after a manual edit back to the same value.
14. **Clash warnings use only events already loaded**, so they cost no reads. They count invitees who are already invited to an overlapping event.

## Participants

15. **The selection stays rules, not lists.** New optional keys on the participant selection: `departmentIds`, `ranks` (`teacher`, `exec`, `jc`, `sec`, `general`) and `teamIds` (`committeeId:teamId`, plus `committeeId:*` for the whole committee, `:chair` and `:leads`). The four old keys are always written; the new ones only when used, so old documents keep their exact shape. Invitations are still frozen into `participantUids` when an event is saved, as before.
16. **Executive board includes the advisor** in the picker and as a rank, because board meetings include him.
17. **Rules budget.** Firestore allows 1000 expressions per request, and the event rules were already close. The new selection keys are checked by size only (not uniqueness) to stay inside it; a test proves a member can save an event that uses every new key. The QA run then found that approving a member's meeting request went over the limit; the fix was to drop the size checks on the new keys (the key list itself is still fixed) and to check `endDate` on the event only, since an approved event must equal its request anyway. Tests cover both cases.

## Organisation data

18. **Department documents are the source of truth.** Member documents carry `departmentId`, `position` and `reportsTo` as mirrors, rewritten in the same batch whenever a department changes, so older screens that read `reportsTo` keep working.
19. **The `member` role has exactly the officer's rights.** No reason to narrow them was found: everything an officer can do is ordinary council work. Rules already treat any non-teacher the same, so `member` needed only to be added to the role list.
20. **Department leads.** A JC or Sec officer may add a person who has no department to their own department, or remove one of their general members. They cannot move people between departments, promote anyone or touch roles. Moves between departments stay with the president and vice president, and the picker asks first, naming both departments.
21. **Closed committees can be reopened by an admin.** "Read-only and archived, never deleted" is enforced by the rules; reopening is the one change allowed, so a mistaken close is not permanent.
22. **Positions for the board and teachers.** The migration gives students the position "member"; the advisor, the board and teachers get no position, because they sit above or outside departments.
23. **The migration signs in as the advisor**, with the client SDK and email and password, so the rules check every write. Rejected: a service-account key, which would be a new secret to keep safe and would bypass the rules. The signed-in advisor's own position is left alone, because nobody may change their own position.
24. **First-run checklist is remembered on the device.** Members cannot write their own member document (rules), so "dismissed" is stored in the browser. On a new device it can show once more until dismissed.
25. **The old JC6, SEC6 and Executive4 groups stay** as participant groups for old events, renamed in the UI to "JC officers", "Sec officers" and "Executive board". New events should invite departments and ranks instead.

## App-wide

26. **Raw error codes never reach the screen.** One function turns every error into a plain sentence; "failed-precondition" (a missing index) reads "This list is still being set up on the server. Try again in a few minutes."
27. **For you needed composite indexes** for its invitation query (events by term, `participantUids`, newest first) and for its meeting queries (term plus each role field, by date). They are in `firestore.indexes.json`; production needs them deployed.
28. **Home's route is `#/home`.** `#/week` and the empty hash still open Home, so old links and saved icons keep working.
29. **Members and roles uses one bulk flow** (preview, apply, 10-second undo) instead of the older Bulk remove screen with its typed confirmation; Deactivate on one row asks in a dialog that names the person.
30. **The rail photo card hides below 860 px of window height**, so it never overlaps the navigation.
31. **The migration also runs as the vice president.** The advisor's password is not available to Josef, who builds and releases everything. The rules already let a VP edit every member except the advisor, so the script accepts role advisor or vp and, for a VP, leaves the advisor's own record out and says so. Rejected: hard-coding Josef's email in `firestore.rules` (a permanent bypass), and a service-account key (decision 23).
