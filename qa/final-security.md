# Final security review (JOB B)

HEAD `67ba9bf`, branch `fiatlux-redesign`. Emulator only, alternate ports (`qa/firebase.sec.json`). I read `firestore.rules` end to end, `src/publish.js`, `src/feed.js`, `src/site.jsx`, `src/actions.js` (decide), `src/firebase.js`, and grepped all of `src`, `scripts`, git history and `dist`.

**Result: 0 blockers, 0 majors.** Minors and accepted risks below.

## Rules, collection by collection

| Collection | Verdict |
|---|---|
| `members` | Read: active members. Create: advisor, president, VP; school domain, lowercase id, `active == true`, role in the list; president only officer/treasurer/secretary/teacher; only advisor creates advisor. Update: advisor any; VP not touching the advisor and never assigning advisor; president only the six listed keys and never on the advisor; nobody changes own role or active flag. No delete. Matches the Roles table. VP demoting the president is intended (owner amendment) |
| `items` | Create needs `touchedAt == request.time`, `createdByUid == me`, valid shape, `leadsOk` against `getAfter` of the parent (leadUids cannot be forged), root only for bosses, subtree only for leads of the parent. `public` and `publicBlurb` only by advisor, president, VP and only on roots; a lead cannot add even `public: false` to a legacy item; a public project can be retitled only by an admin. Assignees limited to a `hasOnly` list. Teachers cannot write |
| `comments` | Author is me, text 500, numeric `createdAt`, at most 10 mentions; delete own only, no update |
| `checkins` | Own id `term_week_me`, own uid. Teachers can still write (unchanged from before) |
| `activity`, `notifications/{uid}/items` | Author or sender is me; text 300; own inbox read, mark-read and delete only. Any member may post into any inbox (needed for comment notices), text bounded |
| `templates`, `settings/*`, `stats` | Boss writes; `settings/current` advisor only; `stats` admin only |
| `announcements` | Admin write, key whitelist, dates and length checked, `createdByUid == me`; active members read |
| `events` | Non-teacher create, `public == false` unless admin. Update by creator or boss; `public` and the published text (title, type, date, start, end, location) change only by an admin |
| `rsvps` | Own id `eventId_me`, `uid == me`, key whitelist, event must exist, non-teacher |
| `ideas` | Create as me with `voters == [me]`; vote via `voteOk` (set size plus count, no duplicates, exactly the caller added or removed); `[me,me,me]` fails; only admins archive |
| `docTemplates` | Admin only; `google()` allows only `docs.google.com` document types and `drive.google.com` file/folder links, plain characters only, no dot-segments or encoded dots, slashes or backslashes, so no look-alike hosts and no `docs.google.com/url?` redirector |
| `submissions` | Create as me with the Google rule, status forced (`pending` or `filed`); read only if `byUid == me` or admin (queries must filter); update admin and `status` only |
| `public/feed` | `get` is public, `list` is not. Write: admin, keys exactly `json`, `hash`, `updatedAt` (no `updatedByUid`), json under 200 000 |
| `cache/{termId}` | Members read; admin writes the current term only; `at` not in the future, size under 700 000 |
| anything else | default deny |

## Public surfaces

- **`public/feed` contents:** `feedPayload` (`src/feed.js`) copies named fields only: project title, stage, percent, counts, blurb, updatedAt; event title, type, date, times, location; announcement title, body, dates, for `audience === 'everyone'`. No names, emails, initials, comments, check-ins, task titles or uids. Public flags can only be set or changed by admins (rules), so a student cannot publish their own text. The seeded feed was checked for the same.
- **Site bundle:** `node scripts/check-site-bundle.mjs` passes (2 chunks, no Firebase SDK). The only Google reference in `dist/assets/site-*.js` is the REST URL built from `VITE_FB_PROJECT_ID`. No key, no `AIza`, no private key in `dist`.
- **Rendering:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `document.write` anywhere in `src`. Feed text and the `localStorage` copy are rendered as Preact text. Feed JSON that is malformed falls back to the static page (try/catch in `site.jsx`).

## Forging, XSS, links, secrets

- **Id forging:** RSVP id and uid, check-in id, idea voters, notification `fromUid`/`toUid`, submission `byUid`, comment `authorUid`, activity `actorUid` and item `createdByUid` are all tied to `me()` and tested (`tests/rules.test.mjs`, 45 pass). Remaining collisions need an underscore in a school email (accepted below).
- **Links:** template and submission links go through `googleUrl()` in the UI and `google()` in the rules; non-matching links render without `href`. External links use `rel="noopener noreferrer"`; WhatsApp links are `https://wa.me/?text=` with `encodeURIComponent`. Task `link` accepts any `http(s)` URL (`safeUrl`, `model.js:83`): `javascript:` and `data:` are refused, so no script execution; it is shown only to signed-in members (accepted, as before the redesign).
- **Secrets:** `.env`, `.env.local`, `.env*.local` and `.env.production` are git-ignored; only `.env.example` (empty values) and `.env.emulator` (`VITE_EMULATORS=1`) are tracked. `git log --all -p -G` over the whole history for `AIza…`, private keys, `client_secret`, `ghp_` tokens: no hit outside the `qa/` and `docs/` report text. No debug logs tracked. The demo password `council123` is emulator-only.
- **`src/firebase.js`:** the persistent multi-tab cache is the permitted exception. The extra "Missing Firebase config" production guard is not a security issue but is outside the allowed change; noted in `qa/final-spec.md`.
- **Sign-in:** roster-gated by `active()` (verified email, member exists and active); rate limiting stays with Firebase Authentication and is not bypassed (no custom auth code).

## Earlier intentional failures, re-run today

Run: `tests/rules.test.mjs` **45 of 45 pass**. `qa/tests/m1-requirements.test.mjs` and the `*security*` files were run as-is.

| File | Result | Open items |
|---|---|---|
| `m1-security` | 24 of 30 | #9 creator of a public event can still **archive** it (date, time and type were fixed); #10 a lead can archive a public project; #12 check-in id underscore collision; #14 teacher can write a check-in. #15 and #17 fail only because the test writes lack the numeric `createdAt` that M3 added to the rules (stale test data, not a hole) |
| `m2-security` | 8 of 14 | #8, #9 feed accepts any JSON shape or an email inside it (admin-only writer); #10 to #12 `cache` accepts a non-array json, an `at` that does not match the content, and a future `updatedAt` (admin-only writer); #14 an announcement is published before its start date (the prompt asks for future starts to be included) |
| `m3-security` | 20 of 21 | #15 notification `itemId` and `type` unrestricted (text is capped at 300) |
| `m4-security` | 9 of 16 | M4-S1 to S4 (roster check on notification recipients, notification type, `mentionUids` shape, RSVP id collision), S5 (re-approve a decided submission), S7 (admins may set any status), and #14 (the rule still wants `version + 1` for an unchanged url; the client avoids it, `actions.js:decide`) |

Fixed since the first reports (no longer failing): public event date/time/type edits by non-admins, the loose Google-link regex, member field typing, `createdAt` type checks, the damaged-snapshot crash (`486699a`), the cache wipe on sign-out.

## Findings

All **minor**. Each is either an admin-only writer, a collision that needs an underscore in a school email, or already accepted in `qa/BACKLOG.md`.

1. **Minor, open, in BACKLOG:** lead can archive a public project, creator can archive a public event; it leaves the website at the next publish.
2. **Minor, open, in BACKLOG:** check-in id and RSVP id collisions with `_` in an email; teacher check-in write; unbounded notification type/itemId; notification recipients not checked against the roster.
3. **Minor, open, partly in BACKLOG (M4-S1 to S4, S7):** a decided submission can be re-approved or set to any status by an admin (S5, S7). Admin-only.
4. **Minor, open, not in BACKLOG (defence in depth):** `public/feed` and `cache` accept any well-formed string from an admin. A compromised admin account could publish arbitrary text on the public site or poison the item snapshot; the clients guard the parse (try/catch), and no code path renders HTML. Rules cannot validate JSON content, so this is accepted by design.
5. **Accepted risk (in BACKLOG, M2-S1):** anonymous reads of `public/feed` use the shared free quota; no way to rate-limit without Functions.
6. **Accepted risk (in BACKLOG, M2-S3):** the sign-out cache wipe cannot run while another tab holds the database.
