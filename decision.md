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

---

# Framework update: tasks and budgets backbone (November 2026)

The one rule for everything below: **lowest friction**. A decision that adds a tap, a field or a screen needs a reason; a default beats a choice. Numbering restarts with an F so these do not collide with the list above.

## Why the last version failed, in one line

Home opened on a request people had already chosen to ignore (the check-in). The new Home shows only things with an action behind them, biggest first.

## Data model (written before any code)

All new data lives in **four new collections**. Nothing existing is renamed or removed (project rule), so a rollback is just the old build.

| Collection | One document is | Fields |
|---|---|---|
| `tasks` | one task | `termId`, `title` (1 to 120), `ownerUid` (one owner), `assignerUid`, `dueDate` (`YYYY-MM-DD` or null), `status` (`todo`, `doing`, `blocked`, `done`), `blockedReason` (one line, required while blocked, else `''`), `waitingOnUid` (optional), `budgetId` (optional), `assignedAt`, `doneAt`, `createdAt`, `updatedAt`, `legacyItemId` (only on migrated tasks) |
| `budgets` | one event's pot | `termId`, `name`, `amountIdr`, `active`, `createdByUid`, `createdAt`, `updatedAt` |
| `purchases` | one purchase request, kept forever | `termId`, `budgetId`, `requesterUid`, `item`, `specs` (optional), `qty`, `unitIdr`, `totalIdr`, `photoIds` (1 to 3), `status` (`pending`, `approved`, `rejected`, `bought`, `paid`, `vetoed`), then as it moves: `approverUid`, `decidedAt`, `paidIdr`, `changeNote`, `receiptPhotoId`, `batchId`, `boughtAt`, `paidByUid`, `paidAt`, `vetoUid`, `vetoReason`, `vetoAt` |
| `photos` | one compressed photo | `termId`, `ownerUid`, `purchaseId`, `kind` (`item` or `receipt`), `data` (base64 JPEG), `createdAt`, `deleteAfter` (null until the request closes) |

- **F1. Tasks get their own flat collection instead of reusing `items`.** The old `items` tree (project, subteam, task) needs a parent and a lead chain for every write, and its rules already sit near Firestore's 1000-expression limit. "Type a task, tap Add" cannot work inside it without loosening those rules for everything. A flat task has one owner and one assigner and its rules fit in twenty lines. Rejected: adding "loose tasks" as root `items` (they would show up as projects on the public site and in the cache snapshot).
- **F2. A budget is the event.** "Each event has one budget pot" is modelled as one `budgets` document named after the event, not a link to a calendar event. Linking would add a picker and a failure case (event deleted) for no gain.
- **F3. Remaining is computed, never stored.** Remaining = amount, minus approved requests at their requested total, minus bought and paid requests at the amount actually paid. Pending requests do not reduce it; they show as a count. A stored running total would drift the first time two people write at once.
- **F4. Photos live in Firestore, not Cloud Storage.** Cloud Storage now needs the paid Blaze plan. Each photo is shrunk in the browser (longest side 1280 px, JPEG, quality stepped down until it is under about 300 kB) and saved as its own document, so lists never download photos; a photo is read only when someone opens the request. Rejected: thumbnails (a second copy to keep in step), an external image host (student receipts on a third party).
- **F5. Photo clean-up runs in the app, not on a server.** Scheduled functions need the paid plan. When a batch is marked paid (or a request is rejected or vetoed) each photo gets `deleteAfter` = now + 14 days. Once a day per device, any signed-in member's app deletes up to 20 expired photos; the rules allow deleting a photo only after its `deleteAfter` has passed. If nobody opens the app, nothing is deleted, and nothing is lost by that. The text record (`purchases`) is never deleted.
- **F6. Reimbursement batches are a label, not a document.** A request joins batch `2026-11-1` (bought on the 1st to 15th) or `2026-11-2` (16th to month end) when the receipt is uploaded. "Mark batch paid" sets every bought request in it to paid in one write. Undo within the toast puts them back. No batch document means nothing to keep in step.
- **F7. Flagged = paid differs from requested by more than 10 %.** Shown in the treasurer view until the batch is paid. The request keeps both numbers and an optional one-line "what changed".

## Roles (enforced in `firestore.rules`; hidden buttons are cosmetic)

The brief's six roles map onto the roles already stored, so no member document changes:

| Brief | Stored `role` | New powers |
|---|---|---|
| Teacher (Mr Ariel) | `advisor` | Sees everything. Can veto any purchase at any stage; a veto needs a reason and stays on the record (`vetoUid`, `vetoReason`, `vetoAt`). |
| Admin | `advisor`, `president`, `vp` | Unchanged (members, announcements). Can create budgets. |
| Treasurer | `treasurer` (two people hold it) | Approves or rejects pending requests that are **not their own**, creates budgets, marks batches paid. |
| Executive | `president`, `vp`, `treasurer`, `secretary` | Assign a task to anyone, edit any task, see overdue per person. |
| Officer | `officer`, or a department's JC or Sec officer | Assign a task to themselves or to people in **their own department** (the "subteam"). |
| Member | `member` | Add tasks for themselves. |

The old read-only `teacher` role (other teachers) stays read-only.

- **F8. Assumption to confirm: Mr Ariel's stored role is `advisor`, and Michael Wijaya and Brittany Yap both have role `treasurer`.** Set this once in Admin, Members and roles. Nothing is hard-coded to names or emails.
- **F9. "Own subteam" means same `departmentId`.** Departments are the only standing teams in the data.
- **F10. A treasurer may mark a batch paid even if it contains their own reimbursement.** The control the brief asks for is on approval (never your own). Blocking pay-out too would force the two treasurers to split every batch.
- **F11. The photo requirement is enforced by the rules**, not only the form: a purchase can be created only if its first photo document exists in the same write.

## Task behaviour

- **F12. Overdue grace.** A task whose due date was less than 48 hours after it was assigned does not show as overdue on the first day after its due date. Reassigning restarts the clock.
- **F13. Blocked replaces overdue.** A blocked task shows "Waiting on [name]: [reason]" and is never counted as overdue. The person defaults to whoever assigned the task.
- **F14. Done notifies the assigner; reopen is one tap** on the row in Tasks, "Given".
- **F15. One tap marks done, with Undo in the toast.** No swipe: a swipe is invisible, clashes with the browser's back gesture, and a 44 px checkbox is already one tap. Only veto and delete ask for confirmation.
- **F16. Writes are optimistic for free.** Firestore's offline cache shows a write at once and syncs behind it; a refused write rolls back with a plain-language toast.

## Screens

- **F17. Four tabs: Home, Tasks, Budgets, More.** Calendar, Projects, Ideas, Committees, Resources, meetings and Admin move under More. They still work; they are no longer the front door.
- **F18. One "+" button.** On Home and Tasks it adds a task (owner = me, no date). On Budgets it starts a purchase request, with the budget pre-filled when you are inside one.
- **F19. Red means overdue or flagged, nothing else.** The primary button, the active tab and the checkbox change from red to the ink colour across the whole app, by editing the design system once. This reverses rule 2 of the old `DESIGN.md`, which is updated. The sunburst pattern is deleted from the design system, not just hidden.
- **F20. Removed:** check-ins (screen, writes, the admin reminder, the "missed check-in" badges; old check-in documents stay in the database, read-only), the hero banner, the onboarding checklist, project percentages on Home, the sunburst card, the old Digest page (replaced by the WhatsApp summary).
- **F21. WhatsApp summary is one pure function** of tasks, budgets and purchases, sorted by fixed keys, so every role gets byte-identical text. It contains names and numbers only.

- **F22. Announcements, today's agenda and "My projects" left Home.** None has an action behind it. They are still on Calendar, Projects and the public site, under More.
- **F23. Approve and reject are one tap with Undo, like everything else.** The rules let the treasurer who decided take the decision back to pending; nobody else can. The same goes for "Mark batch paid" (Undo reopens it). Only veto and delete ask first.
- **F24. The phone top bar lost the search box and the crest.** Search only covers the old project tree, and it cost a full row on every screen. It is still on laptop.
- **F25. The "+" follows the tab.** One primary action per screen: on Budgets it requests a purchase, everywhere else it adds a task. Read-only teachers do not see it.
- **F26. The treasurer view is the top of the Budgets tab**, not a separate page: pending approvals, flagged, then each open batch with who to pay. The Teacher sees the same list, with Veto instead of Approve.
- **F27. Notifications reuse the existing bell.** Assigned, done, reopened, waiting on you, approved, rejected, vetoed, paid back. Each carries a `link`, an optional new field on the old notification documents.

## Migration of existing data

1. **Deploy rules first** (Firebase console is not needed; `npm run deploy` in the VS Code terminal in the repo root does hosting and rules together, only when Josef says so). New collections start empty; old ones are untouched.
2. **Old project tasks:** `node scripts/migrate-tasks.mjs` (VS Code terminal, repo root; signs in as the advisor or VP like the department migration) copies every open, unarchived task from `items` into `tasks` with id `item_<oldId>`, owner = first assignee (or the creator), same title and due date. Safe to run twice. Done tasks are not copied. The old Projects page keeps working from `items`.
3. **Check-ins:** nothing to migrate. The rules stop new writes; old documents remain.
4. **Roles:** confirm F8 in Admin.
5. **Budgets:** a treasurer creates the first budget in Budgets; there is no old budget data.
