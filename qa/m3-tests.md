# M3 and M4 UI tests

File: `qa/tests/m3-ui.test.mjs` (Playwright, `node --test qa/tests/m3-ui.test.mjs`, demo running). Run log: `qa/tests/m3-run.log`. Screenshots: `qa/screens-m3/`.

## M3 (navigation, Home, Search, Sign-in, Projects, Committees, Ideas, public site)
Result: all pass (22 tests, on the final run). No real failures.

Early failures were test faults, fixed: avatar locator, phone tiles carry `aria-label` rather than text, check-in and ideas selectors, search focus (the test clicked a button first).

Notes (not defects):
- Sign-in shows a "Create account" button. A non-roster email is refused, so access is still roster-gated; the test checks that refusal.
- Demo state persists between runs: the check-in test picks any member who is still missing a check-in, and the ideas test adds one idea per run.

## M4 (Calendar, Resources, admin)
Result: all pass (7 tests): Calendar week grid from 06:00, previous / Today / next, Month view, Dec-to-Jan year rollover, event sheet Going / Can't go counts (switching moves one count by exactly one and restores), Resources Make a copy (Docs links rewritten to /copy), Share something refusing non-Google links, admin Overview Copy reminder, admin routes and the officer kept out.

Not covered: @mentions and "Make task" in comments, Add event form submission, Publish now.
