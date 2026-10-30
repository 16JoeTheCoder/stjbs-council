# M1 spec-conformance: rules, data model, roles, rules tests, touchedAt, roster UI

Checker: independent, read-only. Inputs: `qa/PROMPT.md` (owner amendments first), `docs/plan.md` section 4 and 5, `firestore.rules`, `firestore.indexes.json`, `tests/rules.test.mjs`, `src/actions.js`, `src/model.js`, `src/store.js`, `src/routes/admin.jsx`, `src/routes/projects.jsx`, `src/routes/templates.jsx`. Commit under test: `8ed7036` (HEAD has two later QA-only commits).

**What I did not do.** I did not run `npm run test:rules` or open the app: an `npm run demo` was running (`pgrep -f "firebase emulators"` returned three pids) and the alt-port log left by another checker (`qa/tests/m1-run.log`) shows a port collision. Every status below comes from reading the rules and code. "Tests exist" means a test is written, not that it passes. Nobody has shown me a green run of the 40 tests.

Status key: DONE, PARTIAL, MISSING. "Later" marks a line that is not an M1 deliverable in plan section 9; it is listed so nobody mistakes it for finished.

## Tally

| | DONE | PARTIAL | MISSING | Not verified |
|---|---|---|---|---|
| M1 lines (S-01 to S-78, less the two "later" lines) | 65 | 7 | 3 | 1 (S-66, the suite was not run) |
| Later milestones (S-27, S-32, S-79 to S-84), not counted | | | 8 | |

**Blockers: 0. Majors: 0.** The three M1 MISSING lines are S-53 (Close term backup omits every new collection), S-62 (no stale-term test) and S-63 (no legacy `public: false` test). All are minors. I would fix S-53 before M2 because it is a named prompt line, although plan section 3 files it under the admin work.

## A. Roles table (PROMPT "Roles (exact)" plus owner amendments)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| S-01 | advisor can do everything | DONE | Every `isAdmin()`/`isBoss()` branch includes advisor: `firestore.rules:15-16`; members update `:43` (advisor has no extra condition besides the self rule). |
| S-02 | advisor is the only one who sets `settings/current` | DONE | `firestore.rules:122-125` (`allow write: if active() && isAdvisor()`); test `tests/rules.test.mjs:114-117`. |
| S-03 | only the advisor assigns or removes the advisor role | DONE | Create: `:39`. Update: VP `:44` (old and new role both not advisor), president `:45` (old role not advisor and `hasOnly` excludes `role`). Tests `:181`, `:186`, `:189`. |
| S-04 | vp: admin view | DONE | `src/routes/admin.jsx:106` gate is `isAdmin()` (advisor, president, vp); `src/model.js:8`; stats read `rules:132`. |
| S-05 | vp: add members | DONE | `rules:36-40` (`isAdmin()`, domain, active true, role in list). Test `:185`. |
| S-06 | vp: change any member's role and active flag | DONE | `rules:44`. Test `:176-180`. UI `admin.jsx:20`. |
| S-07 | vp: except the advisor's and their own | DONE | Advisor: `:44`. Own: `:42`. Tests `:181-184`. UI `rosterPowers` `:20` (`!self && target !== 'advisor'`). |
| S-08 | vp: never assign "advisor" | DONE | `:39` (create) and `:44` (update). Tests `:181`, `:186`. UI list drops advisor, `admin.jsx:20`. |
| S-09 | vp: announcements, publishing, approvals | DONE | `isAdmin()` on announcements `:145,147`, `public/feed` `:232`, submissions update `:225`, docTemplates `:207,209`. (The publish and approval screens are M2 to M5.) |
| S-10 | president: admin view | DONE | Same gate as S-04. |
| S-11 | president: add members only with non-admin roles (officer, treasurer, secretary, teacher) | DONE | `rules:40`. Tests `:161-167`. UI `PRESIDENT_ROLES` `admin.jsx:13`, `:21`. |
| S-12 | president: edit name, section, reports-to | DONE | `rules:45-46`. Test `:168-175`. |
| S-13 | president: cannot change anyone's role or active flag | DONE | `rules:46` `hasOnly`. Tests `:172-173`. UI hides Deactivate (`active: false`) and disables Role on edit, `admin.jsx:21,51`. |
| S-14 | president: cannot create a VP, president or advisor | DONE | `rules:40`. Test `:165-166`. |
| S-15 | president: announcements, publishing, approvals | DONE | Same `isAdmin()` lines as S-09. |
| S-16 | owner amendment: president may edit name, section, reports-to of everyone except the advisor | DONE | `rules:45` (`resource.data.role != 'advisor'`); no other target exclusion. Test `:171` (VP doc), `:174` (advisor denied). UI `admin.jsx:21` (`edit: target !== 'advisor'`). |
| S-17 | rule trap: president update is exactly `hasOnly(['name','section','reportsTo','initials','termId','updatedAt'])` | DONE | `rules:46`, identical list. |
| S-18 | treasurer, secretary: same as today, no admin view | DONE | Not in `isAdmin()`; templates `:119`, digest `:128` still `isBoss()`; stats `:132` admin only. UI `admin.jsx:106`. |
| S-19 | officer: same as today | DONE | No officer branch changed except the new `touchedAt` and `public` checks. Tests `:72`, `:75-82`. |
| S-20 | teacher: read and comment only | PARTIAL | New and changed rules all exclude teachers (events `:161,164`, rsvps `:173`, ideas `:191,196`, submissions `:216`, items `:78,85,86`; admin-only rules exclude them by construction). Gap, unchanged from before: `checkins` create/update (`:101`) has no `notTeacher()`, so a teacher can write a check-in document through the SDK. See L2-09. |
| S-21 | keep "no one changes their own role or active flag" | DONE | `rules:42`. Tests `:184`, `:192`, `:194`. |
| S-22 | Close term visible to the advisor only | DONE | `admin.jsx:121` (`advisor && <CloseTerm/>`); rule `:124`. |
| S-23 | update `firestore.rules`, the Admin UI and `tests/rules.test.mjs` to match | DONE | All three changed in `8ed7036`. |
| S-24 | owner amendment: VP demoting or deactivating the president is intended | DONE | Rule `:44` has no president exclusion. Test `:178`. |

## B. Data model (PROMPT "New features (data model and rules)")

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| S-25 | term-scoped collections carry `termId` and pass `termOk()`: announcements, events, rsvps, ideas | DONE | announcements `:145,147`, events `:161,164`, rsvps `:173`, ideas `:191,195`. |
| S-26 | cross-term collections have no term filter: `docTemplates`, `submissions`, `public/feed` | DONE | `tplOk` `:201` and submissions keys `:217` contain no `termId`; no `termOk()` anywhere in `:200-236`. Tests create them without `termId` (`:35-36`, `:350`). |
| S-27 | queries filtered by term (term-scoped) and unfiltered (cross-term) | MISSING (later) | No listeners exist yet: `src/store.js` is unchanged. Planned for M2 and M4. |
| S-28 | all new documents carry `createdAt` and `archived: false` instead of deletes | PARTIAL | `archived == false` is forced on create for announcements `:146`, events `:162`, rsvps `:177`, ideas `:194`, docTemplates `:208`, submissions `:224`. `createdAt` is only required on submissions (`:224`); the other five accept a document without it (they only list it in `hasOnly`). No client writer exists yet. |
| S-29 | nothing new can be deleted | DONE | No `delete` allow in `:136-246`. Test `:109-113`. |
| S-30 | announcements fields: title 1 to 80, body max 2 000, audience enum, start/end `YYYY-MM-DD`, end not before start, createdByUid, archived | DONE | `annOk` `:138-142`; create `:145-146`. Test `:228-238`. Caveat: `day()` is a shape check, so `2026-13-45` passes (minor, L2-10). |
| S-31 | announcements read: active members; write: advisor, president, VP | DONE | `:144-148`. Tests `:230-232`. |
| S-32 | announcements audience wording and display rules (3 max, banner/cards, sheet) | MISSING (later) | UI only, M3 to M5. |
| S-33 | events fields and create rule: any active non-teacher, `public == false` unless admin | DONE | `eventOk` `:151-158`; `:161-163`. Tests `:242-249`. |
| S-34 | events update: creator or exec and advisor; `public` changes only by advisor, president, VP | DONE | `:164-167`. Tests `:250-261`. Plan extras also present: title and location of a public event are admin-only `:168` (L1-11). |
| S-35 | rsvps `{eventId}_{email}`, own document only, `uid == me()`, not teachers | DONE | `:171-179` (`id == eventId + '_' + me()`). Tests `:262-272`. |
| S-36 | rsvps readable by active members; filter by eventId | DONE | `:172`; test `:271`. |
| S-37 | ideas: text 1 to 140, author is me, voters `[me]`, active non-teacher create | DONE | `:191-194`. Test `:276-282`. |
| S-38 | ideas update: only `voters`, only adding or removing yourself, as a set check and a size check | DONE | `voteOk` `:182-188` has both: `size() == o.size() +/- 1` and `difference(...).size() == 1` containing `me()` and the reverse difference empty, plus no duplicates. |
| S-39 | `[me, me, me]` cannot inflate votes, and it is tested | DONE | Duplicate check `:183`. Tests `:286-287` (duplicates, and `[lead, officer, vp, vp, vp]`). |
| S-40 | ideas archive by advisor, president, VP | DONE | `:197`. Test `:294-297`. |
| S-41 | docTemplates fields; url must start with the two Google hosts; version number; write by advisor, president, VP | DONE | `tplOk` `:200-204`, `google()` `:27-31` (stricter than "starts with", declared in plan section 4), create `:207-208`, update `:209-210`. Tests `:301-311`. |
| S-42 | submissions create: active non-teacher as themselves; `pending`, or `filed` for archive | DONE | `:216-224`. Tests `:315-324`. |
| S-43 | submissions read: author and admins only; archive files admin and author only | DONE | `:215`. Tests `:325-332` (document, unfiltered query, `byUid` query). |
| S-44 | submissions update: only advisor, president, VP and only `status` | DONE | `:225-226`. Tests `:333-338`. |
| S-45 | submissions: `targetId` for edits, `projectId` for archive | PARTIAL | `template-edit` requires a string `targetId` `:222`. `archive` does not require `projectId` (`:221` only checks it is a string if present). Minor. |
| S-46 | approving a new template creates a `docTemplates` doc, approving an edit updates url and increments version, in one batch | PARTIAL | Rules allow both halves for admins. Only the edit batch is tested (`:339-344`); the new-template batch (submission status update plus `docTemplates` create) has no test. The batch itself is client code, later. |
| S-47 | `public/feed`: readable by anyone; write by advisor, president, VP; size limited | DONE | `:230-236`; `get` only, no `list`. Tests `:348-358`. |
| S-48 | owner amendment: feed has no `updatedByUid` | DONE | `keys().hasOnly(['json','hash','updatedAt'])` `:233`; test `:355`. |
| S-49 | items: optional `public` (bool) and `publicBlurb` (max 140) on root projects | DONE | `valid()` `:70`; create `:79-80`; update `:83`. |
| S-50 | only advisor, president or VP may set or change them, on create and update, with an explicit check; assignee limits stay | DONE | Create `:79-80`, update `:83`. `public`/`publicBlurb` are not in the assignee whitelist `:87`. Tests `:209-218`. |
| S-51 | production data keeps working: new fields read with `get(key, default)` | DONE | `:70`, `:79-80`, `:83-84`, `:95`. Test `:204-208` updates legacy items with no new fields. |
| S-52 | every new create or update rule also requires `role() != 'teacher'` | DONE | See S-20 for the line list. Teacher tests: events `:245`, rsvps `:269`, ideas `:281,292`, submissions `:323`. |
| S-53 | add every new collection to the Close term backup download | MISSING | `admin.jsx:70` lists `members, items, comments, checkins, activity, templates` only. No announcements, events, rsvps, ideas, docTemplates, submissions, `public/feed` or `cache`. Plan section 3 (`admin.jsx` row) promises it. Trap for whoever adds it: `getDocs(collection(db, 'public'))` is denied (`list` is closed on purpose), so `public/feed` needs `getDoc`. See L2-01. |
| S-54 | `touchedAt` on every item write | DONE | `actions.js:11` (`touch()`); `createItem :37`, `updateItem :47`, `changeLead :83` (both patches), `createTree :102`, `archiveItem :112` (archive and Undo). Grep: no other file writes `items` (only `store.js:42` reads). |
| S-55 | `touchedAt == request.time` enforced on item create and update; whitelisted for assignees | DONE | `:73,76,81,87`. Tests `:199-203`, `:77`. |
| S-56 | comments: optional `mentionUids`, max 10 | DONE | `:95`. Test `:370-374`. |
| S-57 | `cache/{termId}` item snapshot rule | DONE | `:239-246` (admins, current term id, key whitelist, size, `at` not in the future, `count` int). Tests `:359-368`. (Plan section 4, beyond the prompt.) |
| S-58 | `valid()` size limits on notes, link, blockedReason | DONE | `:67-69`. UI limits are lower (notes 1 000 `projects.jsx:178`, blockedReason 200 `:172`), so legacy items stay editable. The link field has no `maxLength` (`:179`); a link over 2 000 characters gets a generic "did not save" (L2-11). |

## C. Rules tests (PROMPT "Add rules tests for every new collection and for the new roster permissions")

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| S-59 | old tests kept and updated for the roster change | DONE | Original 18 test names are all still present; the two roster tests were rewritten (`:155-195`). `git show 7746932:tests/rules.test.mjs` for the baseline. |
| S-60 | tests for each new collection | DONE | announcements `:228`, events `:242,250`, rsvps `:262`, ideas `:276,283,294`, docTemplates `:301`, submissions `:315,325,333,339`, feed `:348`, cache `:359`, comments `:370`, items `:199-224`. |
| S-61 | tests for the new roster permissions | DONE | `:155-195`: president adds/edits, VP matrix, advisor-only advisor, self-change. |
| S-62 | negative term test for term-scoped collections | MISSING | Only `activity` (`:119`) and `cache` (`:365`) test a wrong `termId`. No test that announcements, events, rsvps or ideas with a stale `termId` are refused, or that docTemplates and submissions still work after a term change. |
| S-63 | plan list: legacy item, `public: false` added to a legacy item by a lead (L1-38) | MISSING | No such test. The rule denies it (non-admin touching `public`), which differs from what L1-38 asked for; see L2-04. |
| S-64 | plan list: "removing another voter" | PARTIAL | `:290` sets `voters: [lead]` while the stored value is already `[lead]`, which is a no-op, not a removal. The rule would refuse a real removal (`o - n` would not contain the caller), but nothing proves it. |
| S-65 | tests use the same write shapes as the client (header line 2) | PARTIAL | True for `serverTimestamp()`, `arrayUnion`, `arrayRemove`, the `putDoc` merge shape on members (`:170`). For the new collections no client writer exists yet, so the documents are hand-built; the header comment overstates this until M2 to M4 add the actions. |
| S-66 | the suite passes | not verified | Not run here (see top). The commit message says 40 tests; I count 40 `test(` blocks, 178 assertions. |

## D. Indexes (plan section 5) and roster UI

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| S-67 | `items (termId, touchedAt)` | DONE | `firestore.indexes.json:5-6`. |
| S-68 | `events (termId, archived, date)` | DONE | `:7-8`. |
| S-69 | `announcements (termId, archived, endDate)` | DONE | `:9-10`. |
| S-70 | `ideas (termId, archived, createdAt desc)` | DONE | `:11-12`. |
| S-71 | `submissions (type, createdAt desc)` | DONE | `:13-14`. |
| S-72 | existing `activity (termId, createdAt desc)` kept | DONE | `:3-4`. (Plan also lists `items (termId, archived)` as "kept"; it never existed and equality-only queries do not need it.) |
| S-73 | `fieldOverrides` exempting `cache.json` and `public.json` | DONE | `:16-19`. |
| S-74 | the other planned queries need no composite index | DONE | Checked each: submissions `status ==`, `byUid ==`, docTemplates `archived ==`, rsvps `eventId ==`, public roots `termId ==, public ==` are equality-only. |
| S-75 | roster form sends only allowed fields for a president edit | DONE | `admin.jsx:37` sends `name, initials, section, reportsTo` and omits `role` when `can.role` is false; `putDoc` (`actions.js:141`) adds `termId` and `updatedAt`. That is exactly the `hasOnly` list. Deactivate is hidden for the president (`:21`, `:119`). Not exercised in a browser. |
| S-76 | roster UI matches the rules for VP and advisor | DONE | `rosterPowers :17-23` mirrors `rules:36-46`; self row gets no role or active control. |
| S-77 | model helper `isAdmin` | DONE | `src/model.js:8`. |
| S-78 | other `model.js` helpers listed under M1 in plan section 9 (admin-view flag, section grouping, search index, payload builder) | PARTIAL | Only `isAdmin` was added. The rest is not started. They are not needed by the rules; listing them as M1 in the plan is the mismatch. |

## E. Quiet shortcuts and open minors

- S-28/S-53: the backup omission and the `createdAt` gap (above).
- S-65: the tests' header comment claims the client's write shapes for collections that have no client yet.
- S-64: a test labelled as removal is a no-op.
- `MemberForm` (`admin.jsx:25-41`) never checks whether the typed email already exists. "Add member" on an existing address is a rules update: a VP can silently reset that person's role and `createdAt`; a president gets a generic "did not save".
- Rules accept titles of blank spaces (`text()` has no trim); the UI trims.
- Rules `archived` ideas still accept votes (L1-19 asked for this to stop; not done).
- Several rules lines in plan section 4 are enforced only by client code that does not exist yet (version bump on approve, publish payload); they are later milestones, not M1 gaps.

## F. Later milestones (not counted above)

| ID | Item | Status |
|---|---|---|
| S-79 | seed data for the new collections | MISSING (M5; `scripts/seed-emulator.mjs` unchanged) |
| S-80 | actions for new collections (`setDoc` with exact key sets, `arrayUnion`) | MISSING (M2 to M4) |
| S-81 | snapshot plus delta in `store.js`, optional listeners | MISSING (M2) |
| S-82 | publish flow | MISSING (M2) |
| S-83 | README first-deploy order | MISSING (M5) |
| S-84 | `jy-` to `fl-` in `admin.jsx` | MISSING (M3) |
