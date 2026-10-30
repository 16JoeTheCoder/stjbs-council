# M2 security review

Reviewer: security checker. Scope: commit bf31f48 (M2). Tests: `qa/tests/m2-security.test.mjs` (log `qa/tests/m2-security-run.log`, 8 pass, 6 fail; each failure is a demonstrated gap, listed below). Run from the repo root in an Ubuntu/WSL or VS Code terminal:

    npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m2-security.test.mjs"

Verdict: no blocker. The public payload is clean, the public bundle is Firebase-free, no secrets are committed, and non-admins cannot write the feed or the cache. Three majors concern availability and data left on shared computers.

## Findings

### M2-S1 major: anyone with the public API key can exhaust the shared free read quota
`firestore.rules` `match /public/feed { allow get: if true }` plus the key that `src/site.jsx` puts in the URL (`?key=VITE_FB_API_KEY`, visible in the page source). A script can GET the feed 50 000 times in minutes. The plan (section 6) puts the whole council on the free 50 000 reads a day, so this locks every member out with the "free daily limit used up" message until 14:00 or 15:00 Jakarta. The 5-minute `localStorage` reuse in `loadFeed` only helps honest browsers. Cost to the attacker: zero, no account.
Fix options (no paid plan needed): restrict the API key to HTTP referrers (stops casual abuse, not a determined caller); watch the usage console in the first week; accept and document the residual risk. A hosting-cached copy of the feed would remove it but needs Functions or a deploy per publish, which the owner ruled out.

### M2-S2 major: a bad cache document bricks the dashboard for everyone, admins included, with no automatic recovery
`src/store.js` `startItems`: `JSON.parse(cache.json)` and `cache.at.toMillis()` are outside the `try`, there is no shape check, and the snapshot callback does `base.map(...)`. The rules (`cache/{termId}`) only check types and size, so any admin write of `json: "not json"` or `{"a":1}` is accepted (tests 10). `startItems` then throws, `S.ready.items` never becomes true, and the app stays on the loading screen. Admin jobs that would repair the cache (`refreshCache`) need `loaded()`, so no admin can fix it from the UI; someone must edit the document in the console. The same applies to a buggy client write or a document truncated by a size mismatch.
Fix: wrap parse and shape check (array, each element has string `id`, `termId === termId`, `kind`) in the existing `try`; on any failure fall back to `allItems(termId)`. Also drop cached items whose `termId` differs.

### M2-S3 major: Sign out can silently leave the cached council data on a shared computer; automatic sign-outs never wipe
`signOutHere` (src/store.js:145): `clearIndexedDbPersistence` rejects when another tab has the app open (declared in plan Q3), and the catch swallows it with no message, then reloads, so the member believes the data is gone. It remains in IndexedDB (members with names and roles, every item with notes and links, check-ins, notifications). Not wiped at all: token or session end (`onAuthStateChanged(null)`), the no-roster sign-out, the verify-screen sign-out (`auth.jsx:103`), and simply closing the tab (Firebase Auth persists the login indefinitely, so the next person opens `/app/` already signed in; there is no idle timeout). Plan Q3 promised a README note for the expiry case; `README.md:69` still says "Firestore data is never cached by us", which is now false, and no shared-computer advice exists.
Fix: tell the user when the wipe failed ("Close the other council tabs, then sign out again"), try again on next load (flag in `localStorage`, retry `clearIndexedDbPersistence` before `initializeFirestore` runs), fix the README line, and consider wiping on the `onAuthStateChanged(null)` path after a previous signed-in session.

### M2-S4 minor: the rules cannot tell the feed payload from garbage or personal data
Tests 8, 9: an admin (or a buggy admin client) can store any string up to 200 000 characters in `public/feed.json`, including an email address, and it becomes world-readable. The rules cannot parse JSON, but a cheap guard is `!request.resource.data.json.matches('.*@.*')` (the council's emails are the only thing to keep out; announcement bodies that legitimately contain "@" are rare, and the admin can rephrase). The client builder itself is clean (see Payload trace).

### M2-S5 minor: cache `at`, `count`, `updatedAt` are trusted client values
Tests 11, 12. `at` is bounded above by `request.time` but a stale or malicious admin can set it to now with an old or empty `json`; members then see missing items and the delta query starts at `at - 60 s`. `updatedAt` in the future (any number) stops every client from refreshing (`Date.now() - updatedAt > STALE_MS` is never true) and `count` is never checked. Rules cannot validate content against `json`. Mitigation in client: ignore `updatedAt` greater than `Date.now()` and treat the snapshot as stale; take `at` from the parsed items (max `touchedAt`) instead of the field. Blast radius is limited to admins (advisor, president, VP), who can already edit any item.

### M2-S6 minor: announcements are published before their start date
Test 14. `feedPayload` keeps every `audience === 'everyone'` announcement with `endDate >= today`, including future ones, so an embargoed announcement is readable in the JSON by anyone who fetches the REST URL. Plan section 6 chooses this on purpose so the page shows it on its start day without a republish. Either accept and tell admins ("everyone" means public from the moment of publishing) or only include announcements starting within 1 day, republishing daily. Also unbounded count: 100 announcements of 2 000 characters exceed the 200 000 rule cap, publish then fails with permission-denied and the feed goes stale; cap to the 3 shown plus the next few.

### M2-S7 minor: a malformed feed can blank the public page
`src/site.jsx`: `e.type[0]` throws if an event has no `type`; `feed.projects` not an array throws in `.map`; there is no error boundary, so one bad write blanks the whole page (and a poisoned `localStorage` copy repeats it for 5 minutes). Admin-only cause. Guard with `String(e.type || 'other')`, `Array.isArray`, or catch around render.

### M2-S8 minor: no response security headers
`firebase.json` sets only `Cache-Control` for assets. No `Content-Security-Policy`, `X-Frame-Options` or `frame-ancestors` (the admin Publish and Add member buttons can be framed by another site for clickjacking), `X-Content-Type-Options`, `Referrer-Policy`. Suggested CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; img-src 'self' data:; frame-ancestors 'none'` (the inline theme script in both HTML files needs `'unsafe-inline'` or a hash).

### M2-S9 minor: publish and cache jobs use the term from a possibly cached `settings/current`
`publish()` uses `S.term.termId`; the check `canPublish()` does not look at whether `settings/current` came from the server. After Close term, an admin's device that opens with a cached old term and a quick reply from the server for old-term items could publish the old-term feed once before the new term arrives. The cache rule blocks the wrong-term cache write (test 6); the feed rule has no `termId`, so nothing blocks the feed. Low likelihood, self-heals on the next tick.

## Answers to the review questions

### Payload trace (nothing personal can enter by code)
`src/publish.js` `publicProjects` -> `src/feed.js` `feedPayload`, field by field:
- projects: `title`, `stage` (mapped word), `pct`, `done`, `total` (counts from the task tree, titles of tasks never read), `blurb` (`publicBlurb`, rules cap 140), `updatedAt`. Roots only, `public === true`, not archived. No lead, assignee, uid, notes or task title.
- events: `public === true`, not archived, `date >= today`; keys `title, type, date, start, end, location`. `notes`, `itemId`, `createdByUid` dropped (test 13).
- announcements: `audience === 'everyone'`, not archived; keys `title, body, startDate, endDate`.
- feed document: `json, hash, updatedAt` only (rules `hasOnly`; test 5). `activity` row says "published the public site" with `actorUid`; activity is members-only.
Remaining leak path is human, not code: free text typed into a public title, blurb, announcement body or event location (for example a name or number). The admin UI should say so next to the public switch. Also a root project with `isDeal` (sponsor deal) can be made public; its title would show.
Seed (`scripts/seed-emulator.mjs` 117-125) builds the feed with the real `feedPayload`: Carnival and Welcome week blurbs, one "everyone" announcement, two public events; members-only announcement, expired announcement and private events are absent. Compliant.

### XSS and redirects
- No `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in `src/` or `index.html`. Titles, blurbs, bodies and locations render as Preact text children; announcement body is split into `<p>` text nodes. All `href`s on the public page are constants (`#main`, `#events`, `/app/`); no data-driven href. `style={{ width: `${p.pct}%` }}` goes through CSSOM property assignment, so an injected string is ignored rather than parsed as extra declarations. Event `type` is used only as a lookup key and in text.
- Dashboard (not in M2 scope, checked in passing): `link` href goes through `safeUrl` (`^https?://`), `rel="noopener noreferrer"`. WhatsApp link uses `encodeURIComponent`. Good.
- `index.html` redirect: `location.replace('/app/' + location.hash)` only when the hash starts with `#/` or in standalone mode. The target always begins with `/app/#`, so it cannot become `//host` or `javascript:`; same-origin only. No open redirect.

### Bundle and key
`npx vite build && node scripts/check-site-bundle.mjs` prints `ok public page is Firebase-free (2 chunks)`. `dist/index.html` loads `site-*.js` and a modulepreload of `jsxRuntime.module-*.js`; I grepped both: zero matches for "firebase". The check's regexes (`FirebaseError|@firebase/|initializeApp|onSnapshot`) are sound for this build. The only config in the site chunk is `VITE_FB_PROJECT_ID` and `VITE_FB_API_KEY` inlined into the REST URL (a build without `.env.local` shows `undefined` in the URL, expected). No `authDomain` or `appId`. A Firebase web API key is a public identifier, not a secret; the rules are the protection. See M2-S1 for restricting it.

### Can a non-admin write the cache or feed?
No. Tests 3 and 4 cover treasurer, secretary, officer, teacher, an officer-level lead, an unverified admin and anonymous, for create/update and delete. Only advisor, president and VP write, with exact key sets, size caps, current term only, `at <= request.time`.

### Stale or malicious admin poisoning the snapshot
- Honest stale client: `refreshCache` and `publish` re-read from the server (`getDocsFromServer`), so old memory is not written. Two admins racing write whichever finished last, but `at` is the newest `touchedAt` in that read, so the delta query covers any gap; it self-heals. Items cannot be deleted (no delete rule), only archived, and archiving stamps `touchedAt`, so the delta removes them.
- Delta query scoping: `where termId == T` and `touchedAt >= at - 60 s` with `T` taken from `settings/current`; the cache document id is the term and the rule ties it to the current term. A cache for another term is never read. The cached `json` elements themselves are not checked for `termId` (M2-S2, M2-S5).
- Malicious or buggy admin: can hide or forge items for all members (M2-S5), or break loading (M2-S2). Limits today: current term only, 700 000 characters, `at` not in the future. Admins are already trusted to edit any item, so this is robustness more than privilege escalation.
- Quota cap check: a cache over `CACHE_LIMIT` (700 000 characters) sets `cacheFull` and falls back to all items, as designed.

### Sign-out wipe
See M2-S3. Not verified in a running browser (the demo is reserved); based on code and the SDK contract that `clearIndexedDbPersistence` fails when another tab holds the database.

### Secrets
None found. `.env.local`, `.env`, `.env.production` are gitignored and absent; tracked `.env.example` has empty values, `.env.emulator` only `VITE_EMULATORS=1`; `.firebaserc` holds the project id (public). `git log --all -S"AIza"` finds only the earlier QA report text; a scan of the 31 commits for private keys, client secrets and API keys finds nothing (demo password `council123` is emulator-only). `dist/` contains no key (built without one) and is gitignored. Ensure the real `.env.local` stays untracked before the first production build.
