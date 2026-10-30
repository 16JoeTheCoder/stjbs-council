# M1 security review

Reviewer: security checker. Scope: `firestore.rules`, `src/actions.js`, `src/routes/admin.jsx`, secrets, auth flow.
Evidence: `qa/tests/m1-security.test.mjs` (30 tests). Run from the repo root in the Ubuntu/WSL or VS Code terminal:

    npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m1-security.test.mjs"

`qa/firebase.alt.json` fails in this sandbox (no IPv6, emulator hub cannot bind), so `qa/firebase.sec.json` is the same ports (8180, 9199) with `host: 127.0.0.1`. The demo was never started.
Each test asserts the secure outcome. 23 pass (the rule holds). 7 fail: each failure is a demonstrated hole, listed below.

Summary: no blockers. 2 majors. 5 minors.

## Major

### M-1 `google()` accepts `..` path traversal, which re-opens the `docs.google.com/url?q=` redirector
- Where: `firestore.rules` lines 27-31 (`google()`), used by `docTemplates` (line 202) and `submissions` (line 219).
- Steps: as any officer, `setDoc(submissions/x, {type:'new-template', name:'a', url:'https://docs.google.com/document/../url?q=https://evil.com', note:'', byUid:me, status:'pending', archived:false, createdAt:1})`. The same URL is accepted on `docTemplates` by an admin.
- Expected: refused, like the plain `https://docs.google.com/url?q=...` form (that one is refused).
- Actual: accepted (test 20, `redirector2`). Browsers normalise `/document/../url?q=` to `https://docs.google.com/url?q=https://evil.com`. The `[^ ]*` tail lets any path through.
- Impact: any member can plant a redirector link in a submission. An admin approving it publishes it to the Resources page.
- Fix: forbid dot segments and encoded dots after the prefix, e.g. add `&& !u.matches('.*(/[.]{1,2}(/|$)|%2[eE]|%2[fF]|%5[cC]).*')`. Also reject control characters (see m-5).
- Host-level bypasses all hold: userinfo `@` (three forms), backslash, uppercase host and scheme, trailing dot, ports 443 and 8443, `http:`, `%2E` and `%40` in the host, look-alike hosts, `javascript:`, `data:`, space, 501 characters, other Google hosts (test 20 covers 26 vectors, only `redirector2` got through).

### M-2 Anyone can exhaust the free read quota with unauthenticated GETs of `public/feed`
- Where: `firestore.rules` line 231, `allow get: if true`.
- Steps: `curl https://firestore.googleapis.com/v1/projects/<id>/databases/(default)/documents/public/feed?key=<public web key>` in a loop, with no sign-in. Each GET is one billed read. The plan (section 6.4) budgets about 28 000 of the 50 000 reads a day, leaving about 22 000 of headroom for an attacker.
- Actual: on Spark, reads then fail for the whole council until the Pacific-midnight reset (the plan's own `resource-exhausted` message). No rule can rate-limit it.
- Not demonstrable in the emulator. It follows from rule line 231 plus the plan's quota figures. I did not search the plan text for this risk beyond a keyword grep; it was not found.
- Options for Josef: accept the risk and say so in the README; or serve the feed as a static JSON file from Hosting and use `public/feed` only as the write target; or add App Check on the REST read (not possible for plain REST).

## Minor

- m-1 Creator of a public event can change `date`, `start`, `end` or `type` (and archive it) without an admin (test 9). Rules protect only `title` and `location` (rule lines 167-168). These fields flow to the public site at the next auto-publish. The plan declares title and location only, so this is a gap against the plan's intent, not a regression. Fix: extend the `hasAny` list to `['title','location','date','start','end','type','archived']`.
- m-2 A lead of a public root project can archive it, change status or kind, or mark tasks done, which changes the public card (test 10). `public`, `publicBlurb` and `title` are protected as required. The publish builder (M2) must skip archived and non-project items. Fix in rules if wanted: add `archived` to the protected set when `public == true`.
- m-3 Check-in id collision, pre-existing (test 12). Id is `termId + '_' + weekId + '_' + me()` and `weekId` is unconstrained. An attacker `x@...` writing `weekId: 'W45_y'` gets the same id as `y_x@...`'s week-45 check-in, and overwrites it. This needs a roster email containing an underscore. Fix: require `request.resource.data.weekId.matches('^[0-9A-Za-z-]+$')` (confirm the real weekId format first). RSVP ids are safe because event ids are auto-ids with no underscore.
- m-4 Notifications and teachers (test 16). `notifications/{uid}/items` create has no key list and no size limit. Any member, a teacher included (read and comment only per the roles table), can send any member a 100 KB payload with arbitrary extra fields, unlimited times. `fromUid` cannot be forged and the UI renders `text` as text (no XSS found), but each victim re-reads all of it on every open. Fix: `hasOnly([...])`, `text.size() <= 200`, and `notTeacher()` unless teachers need to send comment mentions (they can comment, so decide). Related, pre-existing (test 14): teachers can write check-ins.
- m-5 `google()` accepts control characters (test 21): newline, tab, CR, NUL, no-break space and the right-to-left override all pass because `[^ ]` excludes only the ASCII space. Not a host bypass (the host is fixed by the prefix), but it breaks the "single clean URL" assumption. Fix: `[^ \\x00-\\x20\\x7f-\\x9f]*` or similar in both regexes.

## Checked and found secure (no finding)

- Roles (tests 1-4): president cannot change role or active, cannot create vp, president or advisor, cannot touch the advisor; can add officer, treasurer, secretary, teacher and edit name, section, reportsTo, initials. VP cannot touch or assign advisor, cannot change own role or active. Nobody changes their own role or active, advisor included. No member deletes. Uppercase and non-school ids refused. Deleting a key such as `active` counts as a change and is refused.
- Auth (test 5): unverified email, inactive member, signed-in-without-member and signed-out users read nothing and write nothing, including the feed.
- Public fields (tests 6-8): lead, officer, treasurer, teacher and assignee cannot set or change `public` or `publicBlurb`, cannot retitle a public root, cannot create a public item. Admin can; admin on a non-root cannot. Same for events (`public`, title, location).
- ID forging (tests 11, 13, 15, 17): RSVP id and uid forging, RSVP for a missing event, teacher RSVP, overwriting another's RSVP, another user's check-in, reading, marking or deleting another inbox, forging `fromUid` or `toUid`, forged comment or activity authors, editing or deleting others' comments.
- Ideas (tests 18-19): `[me, me, me]`, adding me twice, swapping someone out, removing another voter, adding someone else, replacing all, empty list, non-list, uppercase email, vote plus text edit, teacher vote, officer archive: all refused. Add and remove with `arrayUnion` and `arrayRemove` work.
- Submissions (test 24): other member's document, unfiltered list, list filtered by someone else's `byUid` and list filtered by status are refused; own `byUid` query works; author and treasurer cannot update status; admin can change `status` only; `byUid` forging, wrong initial status, archive type with `pending`, teacher create and `template-edit` without `targetId` are refused.
- DocTemplates (test 23): non-admin writes refused; version cannot be skipped, reused or bumped without a URL change.
- Feed (tests 25-26): anonymous `get` works, `list` of `/public` and any other `public/*` document is refused, anonymous or non-admin or unverified writes refused, extra key (`updatedByUid`) refused, 200 001 characters refused, delete refused. No other collection is world-readable.
- Cache (test 27): officer, lead, treasurer, secretary and teacher cannot create, update or delete `cache/{termId}`; admin with a wrong term, future `at`, extra key, oversize json or delete is refused. Only advisor, president or VP can write it, and a bad `json` payload from those three is not detectable by rules (an admin could hide or invent items in the snapshot, but cannot widen anyone's write rights).
- Misc (tests 28-30): settings, stats, templates, announcements, events and item gates by role; advisor cannot delete `settings/current`; teacher and non-lead officer item writes, forged or missing `touchedAt` and assignee list edits refused.

## Public feed leakage

The rules cap the document at `json`, `hash`, `updatedAt` (no `updatedByUid`) and 200 000 characters, but cannot inspect the JSON content. The payload builder does not exist yet (M2). M2 must be checked for the whitelist: no names, emails, initials, comments, check-ins, task titles. Also exclude archived items and non-`project` kinds (m-2) and `audience: 'members'` announcements.

## Secrets

- No keys in the working tree, git history (`git log --all -p -G"AIza|apiKey|BEGIN PRIVATE"`: no key values) or `dist` (grep for `AIza`, `private_key`, project id: none; only the fallback `demo-key`). Built with `npx vite build` into a scratch directory, not the repo `dist`.
- Tracked env files hold no secrets: `.env.example` has empty values, `.env.emulator` is `VITE_EMULATORS=1`. `.env.local` is git-ignored.
- Minor m-6: `.gitignore` lists `.env.local` and `.env*.local` only. A plain `.env` or `.env.production` (both read by Vite) would not be ignored. The Firebase web config is public by design, so low risk. Suggest adding `.env` and `.env.production`, plus `*service-account*.json`.
- `firebase-debug.log` and `firestore-debug.log` are ignored and not tracked. `qa/demo.log` is untracked and has not been inspected for secrets (demo only).

## Auth rate limiting and email verification

- No bypass found. `src/routes/auth.jsx` calls the plain Firebase SDK; there is no custom retry, no counter, no backend.
- Verification: `src/store.js` line 69 holds unverified users in `phase: 'verify'` and starts no listeners, and the rules independently require `email_verified == true` (test 5).
- Pre-existing, informational: the sign-up screen reveals whether an email already has an account (`auth/email-already-in-use`). Firebase's own enumeration protection does not hide that error for sign-up. The roster is not secret to members anyway.
- The `VITE_EMULATORS=1` switch connects to localhost only; it does not skip authentication.

## XSS and links

- Item `link` is rendered only through `safeUrl` (http or https), with `rel="noopener noreferrer"`. Notification, comment and title text is rendered as text; no `innerHTML` or `dangerouslySetInnerHTML` anywhere in `src`.
- `docTemplates` and `submissions` are not rendered yet (M4); re-check then, including `rel` and the `/edit` to `/copy` rewrite.
