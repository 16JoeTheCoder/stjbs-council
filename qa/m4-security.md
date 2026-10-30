# M4 security review (Job B)

Scope: every new write path in `src/actions.js` and the new screens, against `firestore.rules`. Emulator only, alternate ports (`qa/firebase.sec.json`).
Tests: `qa/tests/m4-security.test.mjs`, output in `qa/tests/m4-security-run.log`. 16 tests: 9 pass (client write shapes accepted, hostile writes refused, feed whitelist), 7 fail by design. Each failing test is named `FINDING` and asserts the behaviour we want. `tests/rules.test.mjs`: 45 of 45 pass.
Run it (VS Code terminal, repo root):
`npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m4-security.test.mjs"`

**Result: blockers 0, majors 0, minors 10.** Nothing found lets a non-admin publish, approve, read others' submissions, or put member-only text on the public site.

## What was checked and held

| Question | Answer | Evidence |
|---|---|---|
| Does the client send exactly what the rules accept? | Yes for events (create, edit), RSVPs, submissions (all three types, blank `projectId` omitted), announcements, approvals and mention comments | `actions.js:160-210`, tests 1 to 3 |
| Event `public` flag by a non-admin | Refused on create, update, omission and un-publishing a public event | `firestore.rules:171,175`, test 7 |
| Event public text by a non-admin | Title, type, date, time and location of a public event are admin-only; only notes and project link stay open, and neither is published | `firestore.rules:176`, `feed.js:22` |
| RSVP forging | Another member's id or uid, a missing event, a teacher: all refused. One real gap with `_` emails, see M4-S4 | `firestore.rules:181-186`, test 8 |
| Submission reads by non-authors | Refused for the pending query, the archive query and a `byUid` query for someone else; admins pass both admin queries | `firestore.rules:223`, test 6; admin queries `admin-views.jsx:23,208` |
| Can a non-admin approve? | No. Status change and template create are both admin-only, the author included | `firestore.rules:215,233`, test 4 |
| Can approval create a template with a non-Google url? | No. A submission cannot hold one (`google()` at create), and `docTemplates` re-checks on create and update, so the batch fails | `firestore.rules:28-33,209-210,227`, test 5 |
| Make task permissions | The button shows only when `canManage(parent)` (`ui.jsx:157,191`), which matches `manages()` for the new task (`firestore.rules:65-67`). The write is the ordinary item create, so the rules decide | `ui.jsx:186` |
| Announcement audience leak into the public feed | None. `publish()` fetches all audiences, `feedPayload` keeps only `audience === 'everyone'` and four fields; the hash that decides "unpublished" uses the same function. Unit test feeds members-only text, a private event, notes and a creator email and finds none in the JSON | `publish.js:22-23,38-44`, `feed.js:16-26`, test 16 |
| XSS through event notes, announcement bodies, submission names, urls | All rendered as JSX text (`calendar.jsx:110`, `shared.jsx:78,94`, `resources.jsx:96`, `admin-views.jsx:221-241`), no `dangerouslySetInnerHTML` anywhere. Hrefs are either `wa.me` with `encodeURIComponent`, hash routes, or stored urls that the rules limit to `https://docs.google.com/...` and `https://drive.google.com/...` (no dot-segments, no `/url` redirector, no `@` host trick). `target=_blank` carries `rel="noopener noreferrer"` | `firestore.rules:28-33`, `rules.test.mjs:302` |
| Secrets, new files | No keys or tokens in the new files; `.env*` stay ignored | `.gitignore:3-9` |

## Findings

| ID | Sev | Finding | Reproduce and evidence | Fix |
|---|---|---|---|---|
| M4-S1 | minor | Any member can write a notification into any mailbox, including addresses that are not on the roster. Mentions did not widen it (the client sends only roster ids), but a hostile client can spam. Already accepted in `qa/BACKLOG.md` (M1), repeated because mentions now rely on it. | Test 9: officer writes `notifications/stranger@gmail.com/items/n1`, rules accept (`firestore.rules:120-122`). | `exists(members/$(uid))` in the create rule, one extra read per notification. Or accept and keep it in the backlog. |
| M4-S2 | minor | `type` of a notification is free text, so a member can write "urgent-from-advisor". The bell shows the sender's first name before the text, so the sender is not spoofable. | Test 10. | `type in ['comment','assigned','blocked-on-you','mention','published']`. |
| M4-S3 | minor | `mentionUids` on a comment accepts any list of up to 10 values (numbers, objects, non-members). Screens ignore bad ids (`ui.jsx:142,181` filter through the roster), so no crash or notification. | Test 11. | Rules cannot loop over a list; check `size() == 0 || mentionUids[0] is string` as a partial guard, or accept and note it. |
| M4-S4 | minor | RSVP id collision. The id is `eventId + '_' + email` and both parts may contain `_`. Member `y@` creates an event with id `e1_x` and writes `rsvps/e1_x_y@...`, which is the id of `x_y@`'s reply to `e1`. The update path does not check `resource.data.uid`, so the reply is overwritten. Needs school emails with `_` and a crafted event id. | Test 12 (rules accept the overwrite). | On update add `resource.data.uid == me()`, and on create `!exists(rsvps/$(id))`-style guard or `request.resource.data.eventId.matches('^[A-Za-z0-9]+$')`. |
| M4-S5 | minor | Double approval creates a duplicate template. `changed().hasOnly(['status'])` is true when nothing changes, so a second `approved` write passes; `decide()` has no busy state. Double click or two admins at once. | Test 13; `admin-views.jsx:225`, `actions.js:196-200`, `firestore.rules:233`. | Rule: `resource.data.status == 'pending'` on update. Client: disable buttons while `decide` runs. |
| M4-S6 | minor | Approving a template edit whose url equals the current url is refused. `decide()` sends `version + 1`; the rule wants `version + 1` only when `url` changed (`firestore.rules:218`). The admin sees "That did not save: your role is not allowed". Functional, not a hole. | Test 14. | Send `version` unchanged when `sub.url === t.url`, or reject such submissions at create. |
| M4-S7 | minor | Admins can move any submission to any status, including an `archive` file from `filed` to `approved` or a decided one back to `pending`. Admin-only, so low risk. | Test 15 (`firestore.rules:233-234`). | Allow `pending` to `approved` or `rejected` only. This also fixes M4-S5. |
| M4-S8 | minor | Announcement changed from Everyone to Members only (or archived) stays on the public site until some admin session republishes. The saving admin's own session does it within 10 minutes only if the dashboard stays open. | Trace: `actions.js:182-190` has no publish; `publish.js:86-91` is timer-driven; README says "within 10 minutes while an admin has the app open". | Call `publish()` after `saveAnnouncement` and `archiveAnnouncement`, and after un-publishing an event or project. |
| M4-S9 | minor | Stored urls are rendered without the client `googleUrl()` test in Resources and the admin views, so protection rests on the rules alone (search does re-check, `search.jsx:24`). Defence in depth only; the rules hold. | `resources.jsx:82,96`, `admin-views.jsx:221,232,240`. | Wrap with `googleUrl(x.url) ? x.url : '#'`. |
| M4-S10 | minor | `createdAt` is untyped on ideas, events, rsvps and announcements, and a member can pin unlimited ideas, so a spammer or a future `createdAt` can push others out of the 20-idea board. Council-internal only. | `firestore.rules:146-206`; `ideas.jsx:13`. | `createdAt is number` in each rule; cap pins per author per day only if it happens. |

## Traces asked for

- **Approval batch** (`actions.js:196-207`): `b.update(submission, {status})` plus, for `new-template`, `b.set(docTemplates/new, {name, kind, url, version:1, archived:false, createdAt})`, for `template-edit`, `b.update(docTemplates/id, {url, version, updatedAt})`. Keys match `tplOk` (`rules:209`). All writes need `isAdmin()`.
- **Public feed path:** `startAdminJobs` (`publish.js:86`) to `publish` (`:33`) to server reads of items (`public == true`), `eventsQuery`, `announcementsQuery` to `feedJson` to `feedPayload` whitelist (`feed.js:16`). `canPublish` stops it for non-admins, cached data and listener errors (`publish.js:29-30`). Rules allow only admins and `keys().hasOnly(['json','hash','updatedAt'])` (`rules:238-244`).
- **Public events beyond 60 days** are not published, because the event query is the 7-back, 60-ahead window (`queries.js:7-10`). Documented as the window; not a leak.
