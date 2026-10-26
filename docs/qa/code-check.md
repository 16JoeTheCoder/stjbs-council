# Gate 1: code functionality check

Checked 2026-10-26 against the working tree. Findings only.

## Commands run

- `npx vite build` (repo root): pass, 48 modules, one 657 kB JS chunk (under the configured 700 kB warning limit).
- `npm run test:rules`: pass, 15 of 15.
- Attack tests, `npx firebase emulators:exec --only firestore --project demo-council "node --test /tmp/claude-0/gate1/attack.test.mjs"`: 36 tests, 29 pass, 7 fail (A01, A02, A17, A18, A26, A33, A35, described below).
- Time helpers, `node -e "import('./src/time.js')..."` (ISO weeks 2015-W53, 2020-W53, 2026-W53, 2027-W01, 2025-W01 from 2024-12-30; Jakarta midnight edge; `TZ=America/Los_Angeles`; thin-space IDR): pass, no defects.
- App on emulators (`firebase emulators:start --only auth,firestore`, `node scripts/seed-emulator.mjs`, `vite --mode emulator`) driven by Playwright (`/tmp/claude-0/gate1/crawl.cjs`, `flow1.cjs` to `flow10.cjs`): 19 routes x 5 users x 390/1280 px. Signed-in routes logged no console errors or warnings. Every request went to 127.0.0.1 (5173, 9099 and 8080). Failures are listed below.
- `grep dangerouslySetInnerHTML|innerHTML src`: 0 hits. `git ls-files`: no `.env.local`, only `.env.example` and `.env.emulator` (`VITE_EMULATORS=1`).
- All background processes stopped at the end.

## Blockers

### G1-01 blocker: any officer can create items anywhere by naming themselves lead
- Location: `firestore.rules:37-39` (`manages`), used by `firestore.rules:44`.
- What is wrong: `manages(d)` accepts `me() in d.leadUids`, where `d` is the new document. On create, any active non-teacher can set `leadUid` to their own email. `leadsOk` then requires `leadUids == parent.leadUids + [leadUid]`, which already contains them, so the create passes under any parent. They become lead of the new node. From there they can add tasks, assign anyone (which sends `assigned` notifications), and inflate project rollups and meeting lanes in subtrees they have no rights to.
- Expected: create inside a subtree needs advisor, exec, or a lead of the parent or an ancestor (`me() in parentAfter(d).leadUids`). The new item's own `leadUid` must not count.
- Root cause: `|| me() in d.leadUids` in `manages`. It is correct for update (where `resource.data` is used, line 47) but wrong for create.
- Repro: attack tests A01 and A02. As `off@` (officer, leads nothing), `setDoc(items/x1, {parentId:'food', ancestors:['p','food'], leadUid: off, leadUids:[off], createdByUid: off, ...})` succeeds. The same works for a new subteam directly under the root project.

### G1-02 blocker: reloading or deep-linking the check-in form wipes the existing check-in on submit
- Location: `src/routes/meeting.jsx:9-10` (`Checkin`). The cause is in `src/store.js:30-41`.
- What is wrong: the form copies `S.checkins` into `useState` once, at mount. After a reload on `#/checkin` (or opening a shared or installed-app link), the check-in listener has not delivered yet. The fields stay empty for good, and `Submit check-in` overwrites the saved answers with blanks.
- Expected: the form shows the saved answers, or waits for check-ins before rendering, and never overwrites with empty values it did not load.
- Root cause: the check-in listener starts only after `settings/current` arrives (`startTerm`), and `phase: 'ready'` does not wait for it. The initial state is never synced.
- Repro (`flow3.cjs`): as michael, in-app navigation to `#/checkin` shows "Price list done / Follow up with partner / Waiting on Pocari reply". Reload the page: all three fields are empty, still empty after 1.5 s. Click `Submit check-in`, and Firestore `checkins/2026-27_2026-W44_michael@...` becomes `{done:"",doing:"",blocked:""}`.

## Majors

### G1-03 major: the app keeps showing last week's check-ins after Monday 00:00 Jakarta until reload
- Location: `src/store.js:32-34` (`const w = week()` captured when the listener starts) and `src/store.js:41` (restarts only when the term changes).
- What is wrong: the check-ins listener stays on the week ids from when it started. If the app is left open across Sunday to Monday (normal for an installed PWA), new check-ins are written under the new week id but never received. My week keeps the banner "Check-in due Friday ..." after a successful submit. Meeting "x of 18", People statuses and the digest's blocked lines are wrong until reload.
- Expected: listeners follow the current week, for example by restarting when `week().id` changes.
- Repro (`flow9.cjs`, Playwright clock): sign in as raka at 2026-11-01 23:57 Jakarta and fast-forward 5 min. Submit a check-in for Week 45: the toast says "Check-in saved." and the banner still shows "Check-in due Friday 2026-11-06 23:59". After a reload the banner is gone.

### G1-04 major: any edit to a done task resets `completedAt` to now
- Location: `src/routes/projects.jsx:138-139` (the form always includes `status`) together with `src/actions.js:46` (`if (patch.status) p.completedAt = ... now()`).
- What is wrong: saving any change to a done task (notes, link, blocked) sets `completedAt` to the moment of the edit, even when the status did not change. The digest "Done this week", personStatus "n done", Workload "Done, last 7 days" and the activity verb all treat old work as just completed.
- Expected: `completedAt` changes only when `status` actually moves into or out of `done`.
- Repro (`flow1.cjs` then `flow2.cjs`): as raka, mark `t1` done, giving `completedAt` 1793033136881. Then `Update task`, change only the notes and save: `completedAt` becomes 1793033153883.

### G1-05 major: "missed last week's check-in" never triggers in a term bootstrapped as the README says
- Location: `src/model.js:65` (`missedLast` requires `S.term.startWeekId`) and `README.md` step 5 (bootstraps `termId`, `termName`, `startDate` only).
- What is wrong: only Close term writes `startWeekId` (`src/routes/admin.jsx:69`). The seed script sets it by hand (`scripts/seed-emulator.mjs:235`), so the demo hides the gap. In production's first term, `missedLast` is always false. The spec's "bad if ... last week missed" status, and its red badge in People and the meeting, never appear.
- Expected: derive the start week from `startDate` (`weekId(monday(startDate))`), or list `startWeekId` in the README bootstrap.
- Repro: code path above. Remove `startWeekId` from the seed's `settings/current` and raka (no W44 check-in) shows "No check-in" (warn) instead of "Missed check-in" (bad).

### G1-06 major: the check-in banner and `Start check-in` show for the advisor and teachers (recurrence of the lessons.md `checksIn()` class)
- Location: `src/routes/my-week.jsx:19-27`.
- What is wrong: the banner shows whenever no check-in exists for the current user, whatever their role. The advisor and teachers do not check in (`checksIn`, `src/model.js:73`), yet their home screen's one orange action asks them to.
- Expected: show the banner only when `checksIn(S.me)`.
- Repro (`probe1.cjs`): sign in as ariel (advisor) or budi (teacher): `.jy-banner` is present on My week.

### G1-07 major: the Workload "open tasks" snapshot overcounts and leaves some tasks out
- Location: `src/routes/workload.jsx:53` (`totalOpen: r.reduce((a, x) => a + x.open, 0)`).
- What is wrong: `totalOpen` sums per-member open counts, so a task with three assignees counts three times. Unassigned tasks, and tasks assigned only to the advisor or teachers (filtered by `checksIn`), count zero. The chart labelled "Open tasks (count) per week" plots that number.
- Expected: count of distinct open tasks in the term (spec: "small jy-chart line of total open tasks", "Be accurate").
- Repro: freshly seeded data has 9 open tasks, but the snapshot `stats/2026-27_2026-W44` saved `totalOpen: 13` (checked with `/tmp/claude-0/gate1/db.mjs stats`).

### G1-08 major: Archive has no confirmation and no way back in the UI
- Location: `src/routes/projects.jsx:187` and `src/actions.js:105-110`.
- What is wrong: one click on `Archive team` / `Archive project` archives the whole subtree immediately. No dialog or typed confirmation appears, and no unarchive control exists anywhere. A mis-tap removes a project and all its tasks from every screen, and only console work can bring it back.
- Expected: a confirm step naming how many items will be archived, and an undo (for example a toast action or an archived list for leads and exec).
- Repro (`flow7.cjs`): as nadia on `#/p/stage`, click `Edit subteam`, then `Archive team`. No dialog appears (0 dialogs), the toast says "Archived "Stage"." and carnival drops from 11 to 9 tasks. `#/p/t7` then reads "This item is gone".

## Minors

### G1-09 minor: an interrupted lead change leaves descendants that nobody can edit, assignees included
- Location: `src/actions.js:60-69` (`commitChunked`, several non-atomic batches) and `src/actions.js:71-86`. Rules: `firestore.rules:45` (`leadsOk` on every update).
- What is wrong: when a lead change needs more than one batch (more than 15 distinct parents or 450 writes) and a later batch fails (offline, tab closed), the remaining descendants keep stale `leadUids`. Every later update to them, including an assignee ticking Done, fails `leadsOk` with a generic "That did not save" until someone repeats the lead change. Archived descendants are never rewritten either (they are not in `S.items`).
- Expected: a recovery path, such as retry or re-running the propagation on the next lead save, or an assignee path that does not depend on ancestor consistency.
- Repro: attack test A33. Update `drinks` lead without `t1`; the assignee's `updateDoc(items/t1, {status:'done'})` is denied.

### G1-10 minor: the rules do not validate field values
- Location: `firestore.rules:19-25` (member `role`) and `firestore.rules:48-50` (item `status`).
- What is wrong: the president can create a member with role `superuser`, and an assignee can set `status: 'hacked'`. Other fields have no type checks either (`blocked`, `pledgedIdr`, `dealStage`).
- Expected: `role in [...]`, `status in ['todo','doing','done']`, `dealStage in [...]`, numeric amounts of zero or more.
- Repro: attack tests A17 and A35 (both succeed).

### G1-11 minor: the advisor can demote themselves and lock out advisor-only functions for good
- Location: `firestore.rules:23` (advisor may update any member, self included) and `src/routes/admin.jsx:35-36` (role select enabled on the advisor's own row).
- What is wrong: if the only advisor changes their own role, nobody can assign `advisor` again (the president may not), so Close term and `settings/current` become unreachable without console access.
- Expected: block self role changes for the advisor, or require another advisor to exist.
- Repro: attack test A18 succeeds.

### G1-12 minor: check-ins for past or future weeks are accepted
- Location: `firestore.rules:62-63`.
- What is wrong: a member can write `checkins/{term}_2026-W30_{me}` long after that week ended. Spec: "editable until the week ends". Backfilled documents raise the Workload "check-ins submitted out of weeks elapsed" number.
- Expected: unverified whether the rules should enforce this. At minimum, Workload should ignore check-ins whose `createdAt` falls after the week's end.
- Repro: attack test A26 succeeds.

### G1-13 minor: after Friday 23:59 the banner still says "due Friday" with no sign it is late
- Location: `src/routes/my-week.jsx:23` and `src/routes/meeting.jsx:26`.
- What is wrong: on Saturday and Sunday the banner reads "Check-in due Friday 2026-10-30 23:59" (a past date) in the same tone as before the deadline.
- Expected: wording for a missed deadline after `week().due` 23:59 Jakarta, for example "Check-in was due Friday ... Submit it now."
- Repro (`flow9.cjs`): at 2026-11-01 23:57 Jakarta the banner shows "CHECK-IN DUE FRIDAY 2026-10-30 23:59".

### G1-14 minor: the Admin page scrolls horizontally at 390 px
- Location: `src/routes/admin.jsx:96` (`<th><span class="jy-sr">Actions</span></th>`), route `#/admin`, 390 px.
- What is wrong: `.jy-sr` is absolutely positioned and `.jy-scroll` is `position: static`, so the span escapes the scroll box and widens the document to 649 px.
- Expected: no page-level horizontal scroll (brief section 3 phone layout).
- Root cause: confirmed. Removing the span brings `scrollWidth` back to 390. Fix with `position: relative` on `.jy-scroll`.
- Repro: `probe2.cjs`, as nadia or ariel.

### G1-15 minor: a verified non-member sign-in logs two uncaught console errors
- Location: `src/store.js:39` and `src/store.js:44` (`onSnapshot` on `settings/current` and `settings/digest` without an error callback).
- What is wrong: "Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]" is logged twice for every rejected sign-in, and again when a member is deactivated while signed in.
- Expected: no console errors; handle errors like the other listeners.
- Repro (`flow8.cjs`): sign in as a verified `stranger@stjbs.sch.id`.

### G1-16 minor: saving a template with nested arrays throws an uncaught error and shows no message
- Location: `src/actions.js:131` (`putDoc`: `setDoc` throws synchronously, outside `.catch`) and `src/routes/templates.jsx:25-48` (`validate` does not check `questions`).
- What is wrong: AI output such as `"questions": [["..."]]` passes validation. `Save template` then throws "Nested arrays are not supported" as a page error, with no toast and nothing saved.
- Expected: validate `questions` as an array of strings, and wrap `putDoc` so every failure reaches `fail()`.
- Repro (`flow10.cjs`).

### G1-17 minor: renaming the top node in the template editor has no effect
- Location: `src/routes/templates.jsx:80` (`title: root ? title : ...` with `title = t.templateName`).
- What is wrong: the root row's title input is editable, but the started project always takes `templateName`.
- Expected: the root title edit is used, or the field is not editable.
- Repro (`flow10.cjs`): rename the root to "Renamed root", then start: the project is titled "Q".

### G1-18 minor: a `null` entry in `items` gives a misleading root-count error
- Location: `src/routes/templates.jsx:39` (`it?.parentKey == null` is true for `null`).
- Repro (`flow6.cjs`): `items: [root, null]` gives "There must be exactly one top-level item ...; found 2."

### G1-19 minor: Export as template loses every date when the project has no due date
- Location: `src/routes/views.jsx:77` (`offsetDays: event && x.dueDate ? ... : null`).
- What is wrong: offsets are relative to the root's `dueDate`. Without one, every task exports with `offsetDays: null`. Empty subteams also export as leaves and re-import as tasks.
- Expected: tell the user to set the project due date first, or fall back to another anchor.
- Repro: code path above.

### G1-20 minor: double submits are not prevented on Save template, Archive and Save member
- Location: `src/routes/templates.jsx:101-104,139` (the id is chosen before the await and the button is never disabled), `src/routes/projects.jsx:187` and `src/routes/admin.jsx:41`.
- What is wrong: a double click on `Save template` for a new template writes two template documents with different ids. Archive writes duplicate activity entries.
- Expected: disable while busy, as Post comment and Submit check-in already do.
- Repro: code path above (not driven in a browser).

### G1-21 minor: the unread count and Mark all as read stop at 50
- Location: `src/store.js:46` (`limit(50)`), `src/app.jsx:41` and `src/routes/feed.jsx`.
- What is wrong: the unread badge counts only the 50 newest notifications, read or not, so older unread items are invisible and uncountable.
- Expected: count unread with a `where('read','==',false)` query (or say "50+").
- Repro: code path above.

### G1-22 minor: a failed comment load looks like an empty thread
- Location: `src/ui.jsx:125` (error callback `() => setList([])`).
- Expected: an error line that says what to do, for example "Comments did not load. Reload the page."

### G1-23 minor: the org chart drops members in a reportsTo cycle
- Location: `src/routes/people.jsx:19`.
- What is wrong: if A reports to B and B reports to A (both active), neither counts as a root, so both disappear from the org chart. The Admin form allows creating this.
- Repro: code path above.

### G1-24 minor: undoing Close term overwrites the old term's start
- Location: `src/routes/admin.jsx:69`.
- What is wrong: going back to the old term name (the documented undo) writes `startDate` and `startWeekId` as today. The restored term's Workload "weeks elapsed" and missed-check-in logic then restart from today.
- Expected: keep the previous term's start when its id is restored.

### G1-25 minor: documents written through `putDoc` have no `createdAt`
- Location: `src/actions.js:131`, used for members, templates, `settings/digest` and `settings/current`.
- Expected: spec section 5, "All documents carry termId, createdAt".

### G1-26 minor: comment notifications skip the person the task is blocked on
- Location: `src/actions.js:20` (`audience`).
- What is wrong: spec section 6 lists "anyone in `blockedOnUid`" among recipients, but a comment on a blocked task does not notify that person. Unverified as intended; the spec sentence is ambiguous.

### G1-27 minor: a production build without `.env.local` falls back to the demo config with no warning
- Location: `src/firebase.js:7-8` (`apiKey || 'demo-key'`, `projectId || 'demo-council'`).
- What is wrong: `npm run deploy` without `.env.local` deploys a site that talks to a non-existent project and fails at sign-in with an opaque error.
- Expected: fail the build, or show "Missing Firebase config" when `import.meta.env.PROD` and the variables are empty.

## Resolution (builder, after the report)

Fixed and re-verified: G1-01 (rules test plus attack A01/A02 now denied), G1-02 (flow3: fields keep saved answers after reload), G1-03 and G1-13 (flow9: banner says "was due" after Friday and clears after a Monday submit without reload), G1-04 (completedAt kept on non-status edits; digest no longer lists old work), G1-05 (start week derived from `startDate`), G1-06 (no banner for ariel or budi), G1-07 (snapshot `totalOpen` 9, the distinct open count), G1-08 (confirm names the item count; toast offers Undo, which restores the subtree). Minors fixed: G1-10, G1-11 (rules tests), G1-14 (probe2: scrollWidth 390), G1-15 (no console errors for a verified non-member), G1-16, G1-17, G1-18, G1-19, G1-20, G1-21, G1-22, G1-23, G1-24, G1-25, G1-26, G1-27. Attack suite: 34 of 36 pass; the two failures are G1-09 and G1-12, left open in `known-issues.md`.
