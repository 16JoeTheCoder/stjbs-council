# Fiat Lux redesign: plan (M0)

Branch `fiatlux-redesign`, based on `origin/claude/sharp-dijkstra-mitf3s` (this session's branch plus one commit, 8e63dd9, that adds `designsystem/`). The design system was not on the session branch itself; every file the prompt names is present on the base commit.

## 1. Decisions that need Josef before M1

| # | Question | My recommendation (default if no answer) |
|---|---|---|
| Q1 | The spec gives `public/feed` an `updatedByUid` field and makes the document readable by anyone. That field is the email of a student admin, published to the internet. It contradicts "never put names or emails in the payload": the payload rule covers `json`, but the whole document is public. | Drop `updatedByUid`. The rule allows only `json`, `hash` and `updatedAt`. Accountability goes into `activity` ("published the public site"), which only members can read. |
| Q2 | With the roles table as written, the VP outranks the president on the roster. The VP can demote or deactivate the president and create presidents. The president cannot touch the VP. Two VPs can demote each other. You are the VP, so this asks you to confirm your own powers. | Build it exactly as written. The advisor can always repair it, and no one changes their own role or active flag. Confirm this is intended. |
| Q3 | `persistentLocalCache()` stops re-reads only if the app reopens **within about 30 minutes**. Firestore charges a full re-read for a listener that resumes after 30 minutes away. It also leaves council data (check-ins, names) in IndexedDB on shared school computers after sign-out. | Switch anyway (the budget below is over 30 000), using `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` so a second laptop tab still works. On sign-out, call `terminate` and `clearIndexedDbPersistence`, then reload. Both are deviations from the exact one-liner, so I am asking. |
| Q4 | May the president edit the name, section and reports-to of a VP, another president or the advisor? | Yes for everyone except the advisor's document. This matches today's rule. |

## 2. Contradictions and weak spots in the prompt (resolved unless listed above)

1. **Calendar month view versus the bounded listener.** The events listener covers −7 to +60 days, but Month view lets people page to any month. **Resolution:** the listener stays as specified. When the visible range leaves that window, the Calendar runs one `getDocs` for the visible range (about 10 to 30 reads per page turn) and drops it when you leave the page. Month and year boundaries are tested in `/qa/tests`.
2. **"Top first" ideas cannot be queried.** Firestore cannot order by array length, and the spec stores only `voters`. **Resolution:** query the 20 newest and sort by votes on the client. "Top ideas" means top of the 20 newest. A true all-time ranking would need a stored `voteCount` checked by the rules; I am leaving that out.
3. **"Make a copy" works only for Docs, Sheets and Slides URLs** (`docs.google.com/{document|spreadsheets|presentation}/d/ID/copy`). A `drive.google.com/file/...` link has no `/copy`. **Resolution:** show "Make a copy" for Docs URLs and "Open" for Drive URLs.
4. **DESIGN.md says "copy `img/` to `public/img/`"; the prompt says import images through Vite.** The prompt wins: hashed assets get the `/assets/**` cache header.
5. **The old-link redirect must not catch public anchors.** The public site uses `#live`, `#events` and `#join`. **Resolution:** redirect only when `location.hash` starts with `#/`.
6. **"Unpublished public changes" will almost always be empty for an admin,** because opening the dashboard auto-publishes. It is kept as a cheap failure signal: it shows when a write was refused or the hash still differs.
7. **Public events are limited to the listener window.** Events more than 60 days out are not in the store, so they are not published until they come into range.
8. **`.firebaserc` binds the project under the alias `build`, not `default`.** `npm run deploy` (`firebase deploy`) only works on a machine where `firebase use build` was run once. I may not touch it, so the README will say to run `npx firebase use build` once (VS Code terminal in the repo root).
9. **The public feed is a new unauthenticated read.** As I understand Firestore billing, a request the rules deny is also billed as one read, so the dashboard's quota could already be drained by anyone with the project id. The feed adds no real new exposure. Without Functions there is no cheap rate limit. Noted as a risk, not built.
10. **Hand-rendered HTML on the public site is an XSS risk** (announcement bodies, blurbs and event locations are typed by members). **Resolution:** render the public page with Preact (an existing runtime dependency, about 4 kB gzip), which escapes by default. Shared view components (announcements, public project card) live in a module that imports no Firebase code, so Home and the public page use the same component.
11. **Lighthouse risk.** `building.webp` is 1600 × 898 and 173 kB, and it is the mobile LCP image. If Performance comes in under 90, I will add one 800 px copy generated with headless Chromium's `canvas.toBlob('image/webp')` (no new tool) and serve it with `srcset`.
12. **Repo weight.** About 48 screenshots in `docs/qa/screens/` add to git history permanently. They will be JPEG at quality 70, 1× scale, under about 4 MB in total.
13. **Checker cost.** Running 4 checkers on 6 milestones for up to 3 rounds could mean 70 or more subagent runs. M1 has no new UI except the roster form, so its alpha tester covers only the roster flows (sign in as each admin role and try every role or active change).

## 3. Keep / change / delete, every file

| File | Action | What |
|---|---|---|
| `.env.example`, `.env.emulator`, `.firebaserc` | keep | Untouched (rule 2). |
| `.gitignore` | keep | Already ignores `.env*.local`, `dist`, `*-debug.log`. `/qa` stays tracked; Vite never bundles it. |
| `CLAUDE.md` | rewrite | Short council block: follow `design/fiatlux/DESIGN.md`, run `npm run check` and `npm run test:rules`, keep the Firebase config, say where commands run, build only when told to. |
| `README.md` | change | Architecture (two entry points, feed, publish model), roles, decisions (no Functions, no Storage), where to run each command, `firebase use build`. |
| `firebase.json` | keep | No rewrites needed: Hosting serves `dist/app/index.html` at `/app/`, and `/app` redirects to `/app/`. The `/assets/**` header stays. I will check this with `firebase emulators:start --only hosting` at M2. |
| `firestore.rules` | change | Section 4. |
| `firestore.indexes.json` | change | Section 5. |
| `index.html` | rewrite | Public site: inline `#/` redirect in the head, theme forced dark, `<script type=module src=/src/site.jsx>`. |
| `app/index.html` | new | Dashboard shell (from today's `index.html`), manifest link, theme script, theme colour `#0A0A0C`. |
| `vite.config.js` | change | `build.rollupOptions.input = { site: 'index.html', app: 'app/index.html' }`. |
| `package.json` / lock | change | `check` runs `bash design/fiatlux/design-check.sh`. Dev dependencies `playwright` (pinned to 1.63.0 so it uses the preinstalled Chromium in `/opt/pw-browsers`) and `lighthouse`. |
| `design/builtbyjosef/` | delete | Whole folder. |
| `designsystem/` | move | `git mv designsystem design/fiatlux`. |
| `scripts/jy-check.sh` | delete | Replaced by `design/fiatlux/design-check.sh`. |
| `scripts/make-icons.cjs` | change | Crest centred on `#0A0A0C` at 192, 512 and 180 px, maskable 512 with about 20 % safe padding, `favicon-48.png`. |
| `scripts/seed-emulator.mjs` | change | Announcements (2 active, 1 expired), events this week and next (one evening event), RSVPs, 5 ideas, 6 doc templates, 3 pending submissions plus 1 filed archive, a public project, and a seeded `public/feed`. |
| `public/manifest.webmanifest` | change | `"id": "/"`, `scope: "/app/"`, `start_url: "/app/#/week"`, colours `#0A0A0C`. |
| `public/favicon.svg` | delete | Replaced by the generated `public/icons/favicon-48.png`. |
| `public/icons/*` | regenerate | From `crest.png`. |
| `src/main.jsx` | change | Imports `tokens.css`, then `components.css`, then `app.css`. |
| `src/site.jsx` | new | Public page (about 120 lines): REST fetch of `public/feed`, `localStorage` fallback, Jakarta re-filter, "Last change n min ago". |
| `src/shared.jsx` | new | Firebase-free shared views: `Announcements` (0, 1 or 2 to 3 forms, sheet), `PublicProject`, icons, Jakarta date and feed filter helpers. |
| `src/firebase.js` | change (allowed exception) | `initializeFirestore` with a persistent cache (Q3). Nothing else. |
| `src/store.js` | change | New listeners (events, announcements, docTemplates, `public/feed` for admins only). The day-rollover restart goes in the existing 60 s interval. Activity becomes lazy (section 6). |
| `src/model.js` | change | `isAdmin`, admin-view flag, section grouping, search index, payload builder plus hash (`crypto.subtle`). `roleLinks` goes. |
| `src/actions.js` | change | Writes for announcements, events, RSVPs, ideas, doc templates, submissions with approve batches, publish, mentions, "Make task". |
| `src/time.js` | change | `fmtDay` ("Thu 29 Oct", year only when it is not this year), Jakarta hour for the greeting, month grid helper. |
| `src/ui.jsx` | change | `fl-` classes, Lucide icon set, `Sheet` (focus trap, Esc, return focus), Comments with @mention autocomplete and "Make task". |
| `src/app.jsx` | rewrite | Shell: rail, top bar, bell, avatar menu, search, phone tab bar, More sheet, admin view toggle, routes. |
| `src/app.css` | rewrite | `fl-` only, tokens only: timeline bars, swimlanes, org chart, deal stage bar, filter chips, breadcrumbs, `fl-scroll`, split sign-in, public-site bits. |
| `src/routes/my-week.jsx` | rewrite as `home.jsx` | Home, plus the "All my tasks" page holding the FilterBar. |
| `src/routes/meeting.jsx` | restyle | Check-in form and swimlanes; behaviour unchanged. |
| `src/routes/projects.jsx` | change | Progress and Pipeline views, Public switch, Digest action; drill-down, task form and deals unchanged. |
| `src/routes/views.jsx` | restyle | Timeline, team chart, export. |
| `src/routes/people.jsx` | rewrite as `committees.jsx` | Sections as chip groups, org chart, team chart (choose a project), person page. |
| `src/routes/feed.jsx` | restyle | The "See all activity" page (For you plus Activity). |
| `src/routes/digest.jsx` | restyle | Unchanged logic. |
| `src/routes/templates.jsx` | restyle | Project templates, rendered inside Resources for exec. |
| `src/routes/workload.jsx` | restyle | Becomes `#/admin/workload`. |
| `src/routes/admin.jsx` | change | Roster (new role rules) plus close term (backup adds every new collection). |
| `src/routes/admin-views.jsx` | new | Overview, Announcements, Public site, Approvals and archive. |
| `src/routes/calendar.jsx` | new | Week and month views, all-day row, project due markers, Upcoming, featured card, event sheet with RSVP and WhatsApp, add and edit event. |
| `src/routes/resources.jsx` | new | Doc templates, Suggest an edit, Share something, My submissions, project templates for exec. |
| `src/routes/ideas.jsx` | new | Board, Pin idea, vote, archive for admins. |
| `src/routes/auth.jsx` | restyle | Split layout; logic unchanged. |
| `src/routes/about.jsx` | delete | Merged into `settings.jsx` (theme, install app, About and version). The builtbyjosef signature goes. |
| `src/routes/settings.jsx` | new | See above. |
| `tests/rules.test.mjs` | change | Roster tests updated, new tests per collection (section 4). |
| `docs/brief.md` | change | Design section points to Fiat Lux; search, handover archive and document templates move into scope. |
| `docs/qa/*.md` | keep | Audit trail. New: `logic-check.md`, `screens/`. |
| `qa/` | new | Checker reports, `tests/`, `BACKLOG.md`, `PROMPT.md`. |

**No existing feature is dropped.** Keep-list mapping: My week filters → "All my tasks" page. Tree, breadcrumbs, leads, task form, deals → Projects drill-down. Check-in → Home panel plus `#/checkin`. Meeting view → Projects. Comments and bell → shell. Activity feed → `#/activity`. People, org chart, team chart → Committees. Timeline → Projects. Workload and snapshots → admin. Digest → admin, Projects action, More sheet. Project templates → Resources. Roster and close term → admin. Install and iPhone help → sign-in plus Settings. Themes → Settings. Demo and rules tests → unchanged.

## 4. New collections and rules

Helpers: `isAdmin() = role() in ['advisor','president','vp']`, `day(d)` matches `^\d{4}-\d{2}-\d{2}$`, `hhmm(t)` matches `^([01]\d|2[0-3]):[0-5]\d$`, `google(u)` = string up to 500 characters matching `^https://(docs|drive)\.google\.com/\S*$`. Every new create and update requires `role() != 'teacher'` (all admin roles already exclude teachers). Nothing new can be deleted.

| Path | Read | Create | Update |
|---|---|---|---|
| `announcements/{id}` (term) | active | isAdmin, `termOk`, `createdByUid == me`, `archived == false`, title 1 to 80, body up to 2 000, audience in [everyone, members], `day(start)`, `day(end)`, `end >= start` | isAdmin, same validation, `createdByUid` and `createdAt` unchanged |
| `events/{id}` (term) | active | not teacher, `termOk`, `createdByUid == me`, `archived == false`, title 1 to 80, type in 4, `day(date)`, `hhmm` start and end, `end >= start`, location up to 120, notes up to 1 000, `public == false \|\| isAdmin` | not teacher, (creator or isBoss), `!changed().hasAny(['public']) \|\| isAdmin`, same validation |
| `rsvps/{eventId}_{email}` (term) | active | not teacher, `termOk`, `uid == me`, `id == eventId + '_' + me()`, status in [going, not], event exists | same as create |
| `ideas/{id}` (term) | active | not teacher, `termOk`, `authorUid == me`, `voters == [me()]`, text 1 to 140, `archived == false` | (a) not teacher, `hasOnly(['voters'])`, size ±1, `newSet − oldSet == {me}` (add) or `oldSet − newSet == {me}` (remove), the other difference empty, and no duplicates (`n.toSet().size() == n.size()`), so `[me, me, me]` fails. (b) isAdmin, `hasOnly(['archived','updatedAt'])`. |
| `docTemplates/{id}` (cross-term) | active | isAdmin, name 1 to 80, kind up to 40, `google(url)`, version int ≥ 1, archived bool | same |
| `submissions/{id}` (cross-term) | author or isAdmin (single-doc and query) | not teacher, `byUid == me`, type in 3, `google(url)`, name 1 to 80, note up to 500, status `filed` if archive else `pending` | isAdmin, `hasOnly(['status','updatedAt'])`, status in 4 |
| `public/feed` | `if true` | isAdmin, `keys().hasOnly(['json','hash','updatedAt'])`, `json is string && json.size() <= 200000` | same |
| `items` (changed) | unchanged | plus: if `public` or `publicBlurb` is present, then isAdmin, root only, bool and up to 140 | plus: `!changed().hasAny(['public','publicBlurb']) \|\| (isAdmin && root && valid)` |
| `members` (changed) | unchanged | advisor any role; vp any role except advisor; president only officer, treasurer, secretary or teacher | advisor any; vp: neither the old nor the new role is advisor; president: target is not advisor and `changed().hasOnly(['name','section','reportsTo','initials','termId','updatedAt'])`; nobody changes their own role or active flag |

Every new document carries `createdAt` and `archived: false`. RSVPs and submissions carry it even though status covers their life cycle. The exception is `public/feed`, a single document that is overwritten in place. Close term backup adds `announcements`, `events`, `rsvps`, `ideas`, `docTemplates`, `submissions`, `public`.

**Rules tests to add:** roster matrix (VP changes president's role ok, VP touches advisor fails, VP assigns advisor fails, president changes role or active fails, president edits name ok, president creates VP fails, self-change fails). Announcements by an officer fail. Events with `public: true` by an officer fail. A treasurer editing their own event's `public` fails. RSVP with a forged id or uid fails. Ideas: double vote, `[me, me, me]`, removing someone else and archiving as an officer all fail. Doc template with a non-Google URL fails. A submission read by another officer (doc and unfiltered query) fails; a status update by the author fails. Feed: write by a treasurer fails, oversized fails, extra key fails, unauthenticated read ok. Items: a lead setting `public` fails, an admin setting it on a non-root fails.

## 5. Queries and indexes

| Query | Composite index |
|---|---|
| events: `termId ==`, `archived == false`, `date >=`, `date <=`, `orderBy date` (listener and off-window getDocs) | `events (termId ASC, archived ASC, date ASC)` |
| announcements: `termId ==`, `archived == false`, `endDate >= today` | `announcements (termId ASC, archived ASC, endDate ASC)` |
| ideas: `termId ==`, `archived == false`, `orderBy createdAt desc`, `limit 20` | `ideas (termId ASC, archived ASC, createdAt DESC)` |
| docTemplates: `archived == false` | none (single field) |
| rsvps: `eventId ==` | none |
| submissions, member view: `byUid ==` (sorted on the client) | none |
| submissions, admin view: `orderBy createdAt desc`, `limit 100` | none |
| existing: activity `(termId, createdAt desc)` | kept |

The emulator does not enforce indexes, so the first production load is the real test. This is flagged in the PR as the one thing no checker can verify.

## 6. Read budget

Assumptions (mid-term): 30 members, 400 live items, 26 people who check in, notifications 50 plus the unread query.

| Per cold open | Reads |
|---|---|
| members | 30 |
| items (term, not archived) | 400 |
| check-ins (this and last week) | 52 |
| notifications list plus unread query | 60 |
| settings ×2, own member doc | 3 |
| activity (latest 50), **made lazy**: loaded only on `#/activity` and the Projects sidebar | 0 (was 50) |
| new: events window, announcements, doc templates | 15 + 3 + 8 |
| new: ideas (laptop Home only), `public/feed` (admins only) | 20, 1 |
| **Total** | **about 590** (was about 600 before the new features and lazy activity) |

Daily: 590 × 3 opens × 30 members = **53 100**. Add Workload (`getDocs` over the term's check-ins: 26 × 20 weeks = 520, plus 20 stats docs; 3 visits a day ≈ 1 600), RSVP sheets (about 30 × 20 ≈ 600), public site (about 1 per visit, call it 500) and calendar page turns (about 300). That gives **about 56 000 a day, over the 50 000 free quota**. So the persistent cache switch applies (Q3). Assuming a third of opens fall within 30 minutes of the previous one, it saves about 17 000, leaving **about 39 000**.

Three things the bare arithmetic hides:
- **Opens, not usage, cost reads.** An open tab costs only deltas. iOS kills home-screen apps in the background, so every iPhone open is a cold open. An iPhone-heavy council is the worst case.
- **Items grow all year** (done tasks are not archived). At 800 items a cold open is about 1 000 reads and the day is about 90 000 without the cache. The lever if that happens is to close finished projects into the archive. Not built now; it goes in the backlog with numbers.
- **The quota resets at midnight Pacific time, which is 15:00 Jakarta (14:00 during US daylight time).** A school day (07:00 to 15:00) shares a window with the previous evening, including Friday's 23:59 check-in rush. If reads run out, they run out mid-afternoon, just before the quota resets.

Writes stay far below the free 20 000 a day. Auto-publish writes only when the hash changes, which is about once a day plus once per change to a public item.

## 7. Route map (hash routes under `/app/`; old names kept as aliases)

| Route | Screen | Notes |
|---|---|---|
| `#/week` | Home | `start_url` target, so it stays. |
| `#/tasks` | All my tasks (FilterBar) | |
| `#/checkin` | Check-in form | |
| `#/calendar?d=YYYY-MM-DD&v=week\|month&e=id` | Calendar plus event sheet | |
| `#/projects?view=progress\|pipeline` | Projects | |
| `#/p/{id}?view=cards\|timeline\|team` | Drill-down, task page | unchanged |
| `#/meeting/{id}` | Meeting swimlanes | unchanged |
| `#/committees` (alias `#/people`) | Committees | |
| `#/people/{email}` | Person page (My profile) | unchanged links |
| `#/resources` | Resources | |
| `#/templates` | Project templates (exec) | unchanged |
| `#/ideas` | Idea board | |
| `#/activity` (alias `#/feed`) | See all activity | |
| `#/digest` | Digest (exec) | |
| `#/settings` (alias `#/about`) | Theme, install, About and version | |
| `#/admin` | Admin Overview (advisor, president, VP) | |
| `#/admin/announcements`, `/members`, `/workload`, `/public`, `/approvals`, `/digest` | Admin sections | `#/workload` and old `#/admin` still resolve |

A wrong role on `#/admin/...` gets a "Not for you" page; the rules stop the data anyway. Search is a popover on laptop and a full-screen sheet on phone, not a route. The public site at `/` uses the anchors `#live`, `#events`, `#about` and `#join`.

## 8. Milestones and checks

| M | Scope | Checks |
|---|---|---|
| M0 | This plan | spec-conformance (plan), logic reviewer pass 1 |
| M1 | Rules, indexes, roster rules plus roster UI, rules tests, data model helpers in `model.js` | all four (alpha limited to roster flows), logic reviewer pass 2 |
| M2 | Two entry points, `site.jsx`, `shared.jsx`, publish flow, store listeners, persistent cache, lazy activity, Hosting check | all four |
| M3 | `git mv` design system, delete builtbyjosef, `app.css`, shell, nav, sign-in, Home, search, Settings | all four |
| M4 | Calendar, Projects (progress, pipeline, public), Committees, Resources, Ideas, mentions, Make task, WhatsApp shares | all four |
| M5 | Admin views, seed, icons, README, brief, CLAUDE.md, screenshots, Lighthouse, final pass | all four plus logic reviewer pass 3 |

Line budget: today about 1 700 lines of app code. Estimated additions are about 1 600 (calendar 250, admin views 300, shell 150, Home 150, resources 150, search 120, public site and shared 200, ideas 80, store and actions 200). That totals about 3 300, under 3 500. If it runs over, I will cut polish, not features.

## 9. Risks

- **Biggest risk:** the read quota (section 6). Exhausting it fails every read for every member until 15:00 Jakarta, with no warning on Spark.
- Production indexes are untested until the first deploy.
- Lead-change batches (G1-09) and the 20-access-call batch limit are unchanged. New batches (approve a submission: one status update plus one doc template) stay well under it.
