# M3 security review

Checker: security reviewer, Job B. Scope: the M3 shell, search, Home, Settings, sign-in, Ideas, Committees, Projects (Progress, Pipeline, public switch), and the sign-out path, read against `firestore.rules`. Evidence is code and rules tests only; I did not drive the browser.

Tests: `qa/tests/m3-security.test.mjs`, run with `npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m3-security.test.mjs"` (Ubuntu/WSL or VS Code terminal, repo root). Log: `qa/tests/m3-security-run.log`. Result: 21 tests, 17 pass, 4 fail. The 4 failures are deliberate: each asserts the secure outcome and fails because the hole exists.

Counts: **1 major, 0 blocker, 5 minor.** Everything else I checked holds.

## Findings

### M3-S1 (major) Any member can crash the app or a page for other members with a malformed `createdAt`

- **Steps (rules level, tests 18 to 20):** as any active member, including a teacher, write one of: a comment on an item with no `createdAt` or `createdAt: "x"`; a notification to another member with `createdAt: "x"`; an activity entry with `createdAt: "x"`.
- **Expected:** the rules refuse a value the UI cannot render.
- **Actual:** all three writes succeed. `comments` (`firestore.rules:93-99`), `notifications` (`:112-117`) and `activity` (`:107-110`) never type `createdAt`.
- **Why it breaks:** `stamp()` (`src/time.js:6`) throws `RangeError: Invalid time value` for a missing, string or object value (checked in node). It is called without a guard at `src/ui.jsx:156` (item page comments), `src/app.jsx:81` (bell list) and `src/routes/feed.jsx:11` (activity page). There is no error boundary anywhere in `src` (grep: no `componentDidCatch`, `useErrorBoundary`). The throw happens during render, so the view goes blank for every reader; the recipient's bell crashes each time they open it, and only the comment author can delete the poison comment, so nobody else can clear it.
- **Impact:** one hostile or buggy client can break an item page for the whole council, or lock a chosen member out of the bell, with no UI way to recover. Needs only a roster account.
- **Fix:** in `firestore.rules` require `createdAt is number` (and `text is string`, `itemId is string`) on comments, notifications and activity; make `stamp` return an empty string on a bad value; add one error boundary at the top of `App` so a bad document degrades to a message.

### M3-S2 (minor) A president can store a non-string `section`, which breaks search and Committees for everyone

- **Test 21.** `members` update for the president (`firestore.rules:47-48`) checks the key set only. `section: 5` is accepted. `search.jsx:15` calls `.toLowerCase()` on `m.section` and `people.jsx:111` groups by it; either throws. Same shape for `name`, `initials` and `reportsTo` (create at `:38-42` types nothing but `role` and `active`).
- Needs an admin role, so minor. Fix: add `is string` checks for name, section, initials and `reportsTo` (string or null).

### M3-S3 (minor) Notifications are unbounded (known, test 15)

Any member, teacher included, can send any member a notification with a 50 000-character `text`, any `type` and any `itemId` (`firestore.rules:115-116` only fixes `fromUid`, `toUid` and `read`). Rendering is safe: Preact escapes `x.text`, and `itemId` only lands in a hash route (`app.jsx:80`, `feed.jsx:11`), so there is no XSS or navigation off site. It remains a spam and layout-stretch vector, and it is already in the backlog (M1 security). Cap `text` at 200 and require `itemId` to be a string of at most 40 characters.

### M3-S4 (minor) Search opens a template URL without a client-side scheme check

`search.jsx:50` calls `window.open(r.href, '_blank', 'noopener,noreferrer')` and `:78` also sets the raw `d.url` as an anchor `href` (the click is intercepted, but a middle click or "open in new tab" uses the raw href, without `noopener`). `noopener,noreferrer` is present on the programmatic path, which is correct. The rules allow only Google Docs and Drive links (`firestore.rules:28-33`, `:204`), and `docTemplates` writes are admin-only, so the data is trusted today. Defence in depth: pass `d.url` through `safeUrl` (`model.js:83`) and a host check before it reaches `href` or `window.open`.

### M3-S5 (minor) The sign-out wipe is partial

`store.js:147-151`: `signOut`, then `terminate(db)` and `clearIndexedDbPersistence(db)`, then reload. The order is right. Gaps:
- If another tab holds the database the wipe fails silently (`:149`), and the person sees a normal sign-out. This is accepted risk M2-S3; the missing part is any message.
- `localStorage` survives: `council-filter-*` stores a chosen member's email (`ui.jsx:99`, `person: m.id`), and `council-view` stays. Neither is cleared on sign-out. A school email left on a shared computer is a small privacy leak.
- The Verify screen signs out with plain `signOut(auth)` (`auth.jsx:81`); nothing council-related is cached before verification, so this is harmless.
- Fix: clear the `council-filter-*` keys inside `signOutHere`, and show a line when the wipe fails ("Close other council tabs, then sign out again").

### M3-S6 (minor) Task `link` accepts any http or https address

`safeUrl` (`model.js:83`) blocks `javascript:` and `data:`, and the links open with `rel="noopener noreferrer"` (`projects.jsx:186`). Rules only cap the length (`firestore.rules:70`). The brief restricts Google hosts for templates and submissions only, so this matches it; noted for completeness because a lead could post a look-alike login page in a task.

## Checked and holding

| Area | Result | Evidence |
|---|---|---|
| Admin view gating | UI `AdminRoute` refuses non-admins (`app.jsx:36-40`), the avatar switch needs `isAdmin()` (`:104`), and a stale `council-view` value falls back to member view for a non-admin (`:149`). Members roster, Workload and Templates re-check the role (`admin.jsx:49`, `workload.jsx:44,54`, `templates.jsx:96`). | code |
| Roster powers match the rules | `rosterPowers` (`admin.jsx:16-22`) mirrors `firestore.rules:38-48`: president edits name, section, reports-to only and creates only officer, treasurer, secretary, teacher; VP never touches the advisor or self; nobody changes their own role or active flag. | test 16 |
| Public switch | UI shows it only for admins on roots. Rules: advisor, president, VP succeed; treasurer, secretary and the root lead cannot set `public` or `publicBlurb`; no subteam or task can be public; a lead cannot rename or un-publish a public root; creating a public item as a non-admin fails. | tests 4 to 8 |
| Pipeline move | UI `canManage(r)` equals the rule (boss or root lead, not teacher). Advisor, president, treasurer, root lead succeed. Plain officer, teacher and a subteam-only lead are refused; an invalid status is refused. | tests 1 to 3 |
| Idea archive and votes | UI shows Archive to admins only. Rules: only advisor, president, VP archive; no one edits text or author; votes add or remove only yourself (`[me,me,me]`, someone else, or a teacher vote refused); a 141-character idea, a teacher pin and extra voters at creation are refused. | tests 9 to 13 |
| Teacher read-only | Ideas form hidden, vote disabled (`ideas.jsx:31,62`), `canManage` and `canWork` exclude teachers (`model.js:9-10`). Rules refuse teacher writes to items, events and ideas, and teachers can still read. | test 17 |
| Notification forgery | `fromUid` cannot be set to someone else. | test 14 |
| XSS | No `dangerouslySetInnerHTML` or `innerHTML` in `src`. Search labels, idea text, announcement title and body (`shared.jsx:35-43`), notification text and member names all render as Preact text. Hrefs built from data are hash routes (`#/p/${id}`, `#/people/${encodeURIComponent(id)}`) or `safeUrl`-checked. External anchors carry `rel="noopener noreferrer"` (`projects.jsx:180,186`, `digest.jsx:38`). |
| Search leakage | Runs only over data the signed-in member already has; no extra reads or writes. Members-only announcements are visible only to signed-in members. |
| Writes beyond the rules | The M3 UI sends keys the rules accept: `pinIdea` uses the exact create key set, `toggleVote` uses `arrayUnion` and `arrayRemove` of self, `archiveIdea` sends `archived` and `updatedAt` only, Pipeline and Public switch go through `updateItem` with `touchedAt`. No M3 call depends on a rule being loose. |
| Secrets | `.env`, `.env.local` and debug logs are git-ignored; `git ls-files` shows only `.env.emulator` and `.env.example`. |

## Notes

- The existing demo (ports 8080 and 9099) was left running; the tests use 8180 per `CHECKER.md`.
- The four failing tests are the proof for M3-S1 and M3-S2. After the rules are fixed they should pass with no change.
