# Final independent test run (Job A)

Run on 2026-10-30 after the final-pass commits (HEAD at 08:32 UTC). Rules-level suites ran on the alternate ports (`qa/firebase.sec.json`, 8180); UI suites ran against `npm run demo`, which I started myself after the alpha tester's demo stopped, and stopped again at the end.

## Result per suite

| Suite | Tests | Pass | Fail | Skipped | Notes |
|---|---|---|---|---|---|
| `tests/rules.test.mjs` (author's) | 46 | 46 | 0 | 0 | |
| `qa/tests/m1-requirements.test.mjs` | 84 | 72 | 0 | 12 | 12 skipped by design (item shape not in the requirements). Fixtures fixed, see below. |
| `qa/tests/m1-security.test.mjs` | 30 | 27 | 3 | 0 | 3 known accepted gaps |
| `qa/tests/m2-security.test.mjs` | 14 | 8 | 6 | 0 | 6 known "HOLE" tests |
| `qa/tests/m3-security.test.mjs` | 21 | 20 | 1 | 0 | 1 known gap |
| `qa/tests/m4-security.test.mjs` | 16 | 9 | 7 | 0 | 7 known "FINDING" tests |
| `qa/tests/m2-feed.test.mjs` | 20 | 20 | 0 | 0 | no emulator needed |
| `qa/tests/m3-ui.test.mjs` (demo) | 29 | 29 | 0 | 0 | includes the M4 UI tests |
| `qa/tests/m5-gaps.test.mjs` (new, demo) | 11 | 11 | 0 | 0 | the four gaps from `qa/m3-tests.md` |

## Real failures

None that block. Every remaining red test is a security test written to assert the wanted behaviour for a minor finding that is already recorded in `qa/BACKLOG.md` (M1, M2, M3, M4 sections) and was left open on purpose. They fail exactly as in the earlier run logs (`qa/tests/m2-security-run.log` 8/6, `m4-security-run.log` 9/7); m3-security improved from 17/4 to 20/1. Still-red list, so nothing is hidden:

- m1-security 9 (creator of a public event can still archive it; date and time are now admin-only), 10 (a lead can archive a public project), 12 (check-in id with an underscore email).
- m2-security 8 to 12 (the rules cannot check the content of `public/feed` or `cache` json), 14 (an announcement is in the public json before its start date; the public page hides it, a raw REST read shows it).
- m3-security 15 (notification text length and type).
- m4-security 9 to 15 (M4-S1 to M4-S7).

## Test faults found and fixed (not app defects)

The final-pass commits (`f967195`, and the M3 fix `9b83e6c`) made `createdAt` a required number on comments, activity, notifications, announcements, events, rsvps, ideas, docTemplates and submissions. Fixtures that sent `serverTimestamp()` or omitted it were refused: m1-requirements 80 and 81 first, then 22 more after the last commit; m1-security 15 and 17. I changed those fixtures to `Date.now()` (and added `text` plus `createdAt` to the activity and notification fixtures). All four files now behave as above. The app itself sends numbers, which the UI suites confirm.

An earlier run of the UI suites failed 39 of 40 because I started them before the demo had finished seeding. That was my timing, not the app; they pass on the re-run.

## New tests (`qa/tests/m5-gaps.test.mjs`)

Run: `node --test qa/tests/m5-gaps.test.mjs` (VS Code terminal, repo root, demo running). Every title is made unique per run, so reruns are safe.

- @mention: picking Raka from the list highlights `fl-mention`, Raka's bell gets a mention notice naming Michael, the author's bell does not, and a third member (Clara) gets none.
- Make task: the prefilled form carries the mentioned assignee, saving puts the task inside the "Needs you" panel on Raka's Home, and Raka gets an "assigned" notice. The button is absent for the teacher and for an assignee who does not manage the item. This was a major in the M4 alpha report and is fixed.
- Add event: submit shows the event at once, after a reload, and to another member; a far-away month (March 2027) shows it without navigating; a blank title keeps the form open; an officer is not offered the public checkbox.
- Publish now: an admin-created public event reaches the public site after Publish now; flipping a project public and publishing adds it, flipping back and publishing removes it; officer, treasurer and teacher have no button; the public page and its feed carry no `@stjbs.sch.id`.

Weak spot, said plainly: the last test only inspects what the browser receives, and the empty-title test only proves the form stays open. The leak question is better answered by `m2-feed.test.mjs` (payload whitelist) and by the REST read I did by hand against the demo (feed keys `v, projects, events, announcements`; no name or email; `list` on `public` is 403).
