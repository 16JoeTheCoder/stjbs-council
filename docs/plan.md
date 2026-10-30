# Fiat Lux redesign: plan (M0, revision 2)

Branch `fiatlux-redesign`, based on `origin/claude/sharp-dijkstra-mitf3s`. That is this session's branch plus one commit (8e63dd9) that adds `designsystem/`. The design system was not on the session branch itself; every file the prompt names is present on the base commit.

Revision 2 adds Josef's decisions (section 1), the read-quota fix he approved (section 6), and fixes for every blocker and major from the M0 checks (`qa/m0-spec-conformance.md`, `docs/qa/logic-check.md` pass 1). Finding IDs (F = spec check, L1 = logic check) are cited where each fix lands.

## 1. Owner decisions (29 Oct 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | `public/feed.updatedByUid` would publish a student admin's email (the whole document is world-readable). | **Dropped.** The feed holds only `json`, `hash` and `updatedAt`. Who published goes into `activity` ("published the public site"), which only members can read. |
| Q2 | The VP outranks the president on the roster (can demote or deactivate them). | **Intended.** Josef wants it for setup and handover. Built exactly as the roles table says. The advisor can always repair it, and no one changes their own role or active flag. |
| Q3 | Persistent cache: re-reads are avoided only within about 30 minutes, and data stays on shared computers. | **Do it.** `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. The explicit Sign out button signs out first, then `terminate` and `clearIndexedDbPersistence` inside `try/catch`, then reloads whatever happened. The clear fails if another tab is open, so sign-out must never wait on it (L1-34). The README notes that a session ending by token expiry leaves the cache, so on shared computers members should use Sign out. The automatic no-roster sign-out does **not** clear or reload, so the "not on the roster" message survives (L1-07). |
| Q4 | May the president edit the name, section and reports-to of a VP, a president or the advisor? | **Yes, for everyone except the advisor's document.** |
| Q5 | Read quota is over the free 50 000 a day. Pay for Blaze? | **No paid plan** (hard to get approved). Fix the reads instead with **one snapshot document** (section 6), plus two small cuts (lazy activity, no separate unread query) and a clear "free daily limit used up" message. |
| Q6 | Drop iPhone support to save reads? | **No.** The 30-minute re-read rule hits every platform. Dropping iOS removes people, not reads per person. |
| Q7 | The prompt's 3 500-line app-code target. | **Removed.** The ceiling is now 10 000 lines. Build as rich as needed, as long as it stays lean and unbreakable. |

## 2. Contradictions and weak spots in the prompt (resolved)

1. **Calendar month view versus the bounded listener.** The listener stays at −7 to +60 days. A page turn outside that window runs one `getDocs` for the visible range (about 10 to 30 reads), dropped on leaving the page. Month and year boundaries are tested in `/qa/tests`.
2. **"Top first" ideas cannot be queried.** Firestore cannot order by array length. Query the 20 newest and sort by votes on the client, so "Top ideas" means the top of the 20 newest.
3. **"Make a copy"** works only for `docs.google.com/{document|spreadsheets|presentation}/d/ID`. Drive file and folder links get "Open".
4. **DESIGN.md says "copy `img/` to `public/img/`".** The prompt wins: images are imported through Vite and hashed under `/assets/`.
5. **Old-link redirect** (L1-04). The public page head runs `location.replace('/app/' + location.hash)` when the hash starts with `#/` **or** the page runs as an installed app (`matchMedia('(display-mode: standalone)').matches || navigator.standalone`). An iOS home-screen icon saved at `/` with no hash therefore still opens the dashboard. Public anchors (`#live`, `#events`, `#about`, `#join`) never redirect in a normal browser tab.
6. **"Unpublished public changes"** on admin Overview will usually be empty, because opening the dashboard auto-publishes. It stays as a failure signal: the hash still differs, or the last write failed.
7. **Public events are limited to the listener window.** Events more than 60 days out are published once they come into range.
8. **`.firebaserc` uses the alias `build`, not `default`.** The README tells Josef to run `npx firebase use build` once (VS Code terminal, repo root). `.firebaserc` itself is untouched.
9. **The public feed is a new unauthenticated read.** Rule-denied requests are, as I understand billing, also charged one read, so this is not a materially new drain. No rate limit is possible without Functions. Noted, not built.
10. **XSS on the public site.** The public page renders with Preact, which escapes text by default. Shared views live in `src/shared.jsx`, which imports **no Firebase code**. That module includes `Sheet` (L1-09), and `ui.jsx` imports `Sheet` from it, never the other way round. M2 adds a build check that fails if the public entry's chunks contain `firebase`.
11. **Lighthouse.** If mobile Performance is under 90, add one 800 px `building.webp` made with headless Chromium's `canvas.toBlob('image/webp')`, served with `srcset`.
12. **Repo weight.** About 48 screenshots in `docs/qa/screens/` as JPEG at quality 70, 1× scale, under about 4 MB in total.
13. **Checker cost.** At M1 the alpha tester covers only the roster flows; M1 changes no other UI.
14. **Manifest `id`** (F13). Today's manifest has no `id`. Chrome derives the identity from `start_url` `/#/week`, which becomes `/` once the fragment is dropped. Writing `"id": "/"` therefore keeps the same identity. The prompt's "keeps" is wrong in wording only.
15. **Pipeline stage of existing projects** (L1-15). Every production root project has `status: 'todo'`, so all of them start in Planning, and the first publish would say so. The rule stays as the prompt maps it (todo, doing, done). The PR tells Josef to move the real projects once, in Pipeline, before the first publish. No migration.
16. **Digest access** (L1-12). Today every role can view and copy the digest. The `#/digest` route stays open to every member (view and copy; editing is still exec). Only the links (Projects action, More sheet, admin rail) are limited to exec and admins, as the prompt says. Nothing is lost.
17. **Activity on Projects** (F9). Today's Projects page has an activity sidebar. It goes, because the prompt moves the feed to the bell's "See all activity" page. That also makes activity lazy (section 6).
18. **Old docs mention builtbyjosef** (F12). `docs/qa/code-check.md`, `design-check.md` and `lessons.md` are the historical audit trail and are kept as they are. `design-check.sh` scans `src app index.html public` only. Every other trace goes.
19. **Public site theme** (L1-16). It follows the stored `council-theme` (default dark), because gate 4 requires a light screenshot and DESIGN.md says every screen must work in light. Stage surfaces (hero) stay dark in both themes.

## 3. Keep / change / delete, every file

| File | Action | What |
|---|---|---|
| `.env.example`, `.env.emulator`, `.firebaserc` | keep | Untouched (rule 2). |
| `.gitignore` | keep | Already ignores `.env*.local`, `dist`, `*-debug.log`. `/qa` stays tracked; Vite never bundles it. |
| `CLAUDE.md` | rewrite | Short council block: follow `design/fiatlux/DESIGN.md`; run `npm run check` and `npm run test:rules`; keep Firebase config; say where commands run; build only when told to. |
| `README.md` | change | Architecture, roles, decisions (no Functions, no Storage, no Blaze, the snapshot, the publish model), first-deploy order (section 5), `firebase use build`, where to run each command, "nothing new in the Firebase console except deploying rules, indexes and hosting". |
| `firebase.json` | keep | No rewrites. Hosting serves `dist/app/index.html` at `/app/`; `/assets/**` header stays. Checked in M2 with the Hosting emulator. |
| `firestore.rules` | change | Section 4. |
| `firestore.indexes.json` | change | Section 5. |
| `index.html` | rewrite | Public page: inline redirect (2.5), theme script, imports `/src/site.jsx`. |
| `app/index.html` | new | Dashboard shell from today's `index.html`; manifest link; theme script; theme colour `#0A0A0C`; imports `/src/main.jsx`. |
| `vite.config.js` | change | `build.rollupOptions.input = { site: 'index.html', app: 'app/index.html' }`. |
| `package.json` and lock | change | `check` runs `bash design/fiatlux/design-check.sh && node scripts/check-site-bundle.mjs`. Dev dependencies: `playwright` 1.63.0 (matches the preinstalled Chromium) and `lighthouse`. |
| `scripts/check-site-bundle.mjs` | new | After a build, fails if any chunk loaded by `dist/index.html` contains `firebase` (L1-09). About 15 lines. |
| `design/builtbyjosef/` | delete | In M3, after a grep shows no `jy-` class left (F1). |
| `designsystem/` | move | `git mv designsystem design/fiatlux` (M3). |
| `scripts/jy-check.sh` | delete | Replaced by `design/fiatlux/design-check.sh`. |
| `scripts/make-icons.cjs` | change | Crest centred on `#0A0A0C` at 192, 512 and 180 px; maskable 512 with about 20 % safe padding; `favicon-48.png`. |
| `scripts/seed-emulator.mjs` | change | Announcements (2 active, 1 expired); events this week and next (one evening event); RSVPs; 5 ideas; 6 doc templates; 3 pending submissions plus 1 filed archive; one public root project with a blurb; projects in each pipeline stage; the item snapshot (some items without `touchedAt`, so the legacy path is exercised); `public/feed`. The feed and cache documents are written with exactly the keys the rules allow: no `termId` or `createdAt` (L1-36). |
| `public/manifest.webmanifest` | change | `"id": "/"`, `scope: "/app/"`, `start_url: "/app/#/week"`, colours `#0A0A0C`. |
| `public/favicon.svg` | delete | Replaced by the generated PNG. |
| `public/icons/*` | regenerate | From `crest.png`. |
| `src/main.jsx` | change | Imports `tokens.css`, `components.css`, `app.css` once (F11). |
| `src/site.jsx` | new | Public page. Imports the same three CSS files. REST fetch with `?key=VITE_FB_API_KEY` (harmless, public; removes the unregistered-caller risk, L1-03). With `VITE_EMULATORS === '1'` it uses `http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/public/feed` (F22). Parses `stringValue`, `integerValue` and `timestampValue`. `localStorage` fallback with an "Updated earlier" note. Jakarta re-filter. "Last change n min ago", clamped to "just now" for future times (L1-22). |
| `src/shared.jsx` | new | Firebase-free: `Sheet`, `Announcements`, `PublicProject`, `Icon`, Jakarta date and feed-filter helpers, the string hash. |
| `src/firebase.js` | change (allowed) | `initializeFirestore` as in Q3. Nothing else. |
| `src/store.js` | change | Item snapshot plus delta (section 6). Optional listeners with their own error state (section 6.3). Day-rollover restart in the existing 60 s interval. Activity loaded only on `#/activity`. Unread count taken from the loaded notifications. Quota message. Sign-out helper (Q3). |
| `src/model.js` | change | `isAdmin`, admin-view flag, section grouping, search index, payload builder (section 6.5). `roleLinks` goes. |
| `src/actions.js` | change | Every item write adds `touchedAt: serverTimestamp()`. New writes for announcements, events, RSVPs, ideas (`arrayUnion`/`arrayRemove`), doc templates, submissions (approve batch), feed, snapshot, mentions, Make task. New collections use direct `setDoc`/`updateDoc` with exact key sets, never `putDoc`, because `putDoc` adds `termId` and merges (L1-06). |
| `src/time.js` | change | `fmtDay` ("Thu 29 Oct"; year only when it is not this year), Jakarta hour, month grid. |
| `src/ui.jsx` | change | `fl-` classes, Lucide icons, Comments with @mention autocomplete and Make task. |
| `src/app.jsx` | rewrite | Shell (section 7). |
| `src/app.css` | rewrite | `fl-` only, tokens only: timeline bars, swimlanes, org chart, deal stage bar, filter chips, breadcrumbs, `fl-scroll`, split sign-in, public-site bits. Classes instead of `preview.html` inline styles. |
| `src/routes/my-week.jsx` | rewrite as `home.jsx` | Home (section 8) plus the All my tasks page. |
| `src/routes/meeting.jsx` | restyle | Check-in form and swimlanes; behaviour unchanged. |
| `src/routes/projects.jsx` | change | Progress and Pipeline, Public switch, Digest action, "Start from template". Drill-down, task form and deals unchanged. |
| `src/routes/views.jsx` | restyle | Timeline, team chart, export. |
| `src/routes/people.jsx` | rewrite as `committees.jsx` | Sections as chip groups with a status word (L1-13), org chart, team chart, person page. |
| `src/routes/feed.jsx` | restyle | `#/activity`: For you plus Activity. |
| `src/routes/digest.jsx`, `templates.jsx`, `workload.jsx` | restyle | Logic unchanged. |
| `src/routes/admin.jsx` | change | Roster under the new rules (section 4). Close term (advisor only) backs up every new collection, the snapshot and the feed. |
| `src/routes/admin-views.jsx` | new | Overview, Announcements, Public site, Approvals and archive. |
| `src/routes/calendar.jsx`, `resources.jsx`, `ideas.jsx`, `settings.jsx` | new | Screens in section 8. |
| `src/routes/auth.jsx` | restyle | Split layout; logic unchanged. |
| `src/routes/about.jsx` | delete | Merged into `settings.jsx`. The signature goes. |
| `tests/rules.test.mjs` | change | Section 4. |
| `docs/brief.md` | change | Fiat Lux design section; search, handover archive and doc templates move into scope. |
| `docs/plan.md` | new | This file. |
| `docs/qa/*.md` | keep | Audit trail. New: `logic-check.md`, `screens/`. |
| `qa/` | new | Checker reports, `tests/`, `BACKLOG.md`, `PROMPT.md`. |

**Small features that must survive the rewrite** (L1-23, named so they are tested):
- Undo toast after archive.
- Error banner.
- Skip link, focus on the h1, and `document.title` per route.
- Comments: "Show all (n)", "Delete comment", latest two.
- Hide done / "Show done (n)".
- Person and team filter rail.
- Filter saved per screen (the All my tasks page reuses `council-filter-week`, L1-14).
- Org-chart loop guard.
- Deal table totals.
- Project actions: "Start from template", "Export as template", "Meeting view", and the lead select with propagation.
- Archive confirm with blast radius.
- Check-in "edit until Sunday" plus a Home link after check-in (L1-05).
- Late check-in wording.
- Install button and iPhone text.
- No-roster message.
- Resend verification.

## 4. Rules

Helpers: `isAdmin() = role() in ['advisor','president','vp']`. `day(d)` matches `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`. `hhmm(t)` matches `^([01][0-9]|2[0-3]):[0-5][0-9]$`. No backslashes (L1-17).

`google(u)` is a string of at most 500 characters matching `^https://docs[.]google[.]com/(document|spreadsheets|presentation|forms|drawings)/[^ ]*$` or `^https://drive[.]google[.]com/(file/|drive/|open[?]|uc[?])[^ ]*$`. This rejects `docs.google.com.evil.com` and the `docs.google.com/url?q=` open redirector. It is narrower than the prompt's "starts with", a declared deviation for safety (F18).

Every new create or update requires `active()` and `role() != 'teacher'`. On update, `termId`, `createdByUid` (or the author field) and `createdAt` never change (L1-19). Nothing new can be deleted. Every new document carries `createdAt` and `archived: false`, except `public/feed` and `cache/*`, which are single documents overwritten in place.

| Path | Read | Create | Update |
|---|---|---|---|
| `announcements/{id}` (term) | active | isAdmin; `termOk`; `createdByUid == me`; `archived == false`; title 1 to 80; body ≤ 2 000; audience in [everyone, members]; `day(startDate)`, `day(endDate)`, `endDate >= startDate` | isAdmin; same field checks except `archived is bool` (so archiving works, F14) |
| `events/{id}` (term) | active | `termOk`; `createdByUid == me`; `archived == false`; title 1 to 80; type in 4; `day(date)`; `hhmm` start and end with `end >= start`; location ≤ 120; notes ≤ 1 000; `public == false \|\| isAdmin`; `itemId` absent or string | `termOk`; creator or isBoss; same checks; `public` changes only if isAdmin; **if `resource.data.get('public', false) == true`, changing title or location requires isAdmin** (L1-11, L1-27) |
| `rsvps/{eventId}_{email}` (term) | active | `termOk`; `uid == me`; `id == eventId + '_' + me()`; status in [going, not]; event exists; `archived == false` | same as create |
| `ideas/{id}` (term) | active | `termOk`; `authorUid == me`; `voters == [me()]`; text 1 to 140; `archived == false` | `termOk` and either (a) `hasOnly(['voters'])` with the vote check below, or (b) isAdmin and `hasOnly(['archived','updatedAt'])` |
| `docTemplates/{id}` (cross-term) | active | isAdmin; name 1 to 80; kind ≤ 40; `google(url)`; `version == 1`; `archived == false` | isAdmin; same checks; if `url` changes then `version == resource.data.version + 1` |
| `submissions/{id}` (cross-term) | author or isAdmin (single document and queries) | `byUid == me`; type in [new-template, template-edit, archive]; `google(url)`; name 1 to 80; note ≤ 500; status `filed` for archive, else `pending`; `targetId` and `projectId` absent or string | isAdmin; `hasOnly(['status'])`, exactly as the prompt says (F14); status in 4. Written with `updateDoc`, not `putDoc` (L1-06). |
| `public/feed`, matched exactly with `allow get: if true` (no list, L1-18) | anyone | isAdmin; `keys().hasOnly(['json','hash','updatedAt'])`; `json is string && json.size() <= 200000`; `hash is string`; `updatedAt is number` | same |
| `cache/{termId}` (item snapshot, section 6) | active | isAdmin; `termId` equals `settings/current.termId`; `keys().hasOnly(['json','at','count','updatedAt'])`; `json is string && json.size() <= 700000`; `at is timestamp && at <= request.time` (L1-29); `count is int` | same |
| `items` (changed) | unchanged | adds: `touchedAt == request.time`; `public`/`publicBlurb` absent, or `public == false` and no blurb, unless isAdmin and `parentId == null`; blurb ≤ 140 (F14) | adds: `touchedAt == request.time`; if `changed().hasAny(['public','publicBlurb'])`, which covers adding a field a legacy item lacks (L1-38), then isAdmin and root; **if `resource.data.get('public', false) == true`, a title change requires isAdmin** (L1-11). Every read of a new field uses `.get(key, default)`, because legacy items lack `public`, `publicBlurb` and `touchedAt`, and a bare read would deny every update (L1-27). Assignee limits stay. `touchedAt` joins the assignee whitelist. |
| `comments` (changed) | unchanged | adds: optional `mentionUids` list, ≤ 10 (L1-10) | unchanged |
| `members` (changed) | unchanged | advisor: any role. VP: any role except advisor. President: only officer, treasurer, secretary or teacher. | Advisor: any. VP: neither the old nor the new role is advisor; may change `active` (today's ban is removed, F7). President: target not advisor and `changed().hasOnly(['name','section','reportsTo','initials','termId','updatedAt'])`. Nobody changes their own role or active flag. |

**Vote check:** `n = request.resource.data.voters`, `o = resource.data.voters`. Either `n.size() == o.size() + 1` with `n.toSet().difference(o.toSet()) == [me()].toSet()`, or `n.size() == o.size() - 1` with `o.toSet().difference(n.toSet()) == [me()].toSet()`. In both cases the other difference is empty and `n.toSet().size() == n.size()`. Votes are written with `arrayUnion`/`arrayRemove` (L1-19).

**`touchedAt` on items** is a new optional field, set to the server time by every write. Old documents without it remain valid and are carried by the snapshot. A copy of the old app left open on deploy day has its item writes refused until it reloads. With no service worker, the next open loads the new code. The PR says so.

**Rules tests**, positive and negative (F14):
- Roster: VP changes the president's role and `active` (ok). VP touches the advisor (fail). VP assigns advisor (fail). President changes role or active (fail). President edits a name (ok). President adds an officer (ok) or a VP (fail). Self-change (fail).
- Announcements: officer (fail); admin (ok); archive (ok).
- Events: officer with `public: true` (fail). Treasurer editing `public` on their own event (fail). Creator retitling a public event (fail); admin retitling it (ok).
- RSVPs: forged id or uid (fail); own (ok).
- Ideas: double vote (fail); `[me, me, me]` (fail); removing another voter (fail); arrayUnion and arrayRemove (ok); officer archiving (fail).
- Doc templates: evil-domain and redirector URLs (fail); version not increased with a URL change (fail).
- Submissions: read by another officer, both the document and an unfiltered query (fail); `byUid` query (ok); author status update (fail).
- Feed: treasurer write (fail); too large (fail); extra key (fail); unauthenticated get (ok); unauthenticated list (fail).
- Cache: officer write (fail); member read (ok).
- Items: lead setting `public` (fail); admin on a non-root (fail); missing or forged `touchedAt` (fail); lead retitling a public project (fail); assignee status change with `touchedAt` (ok).
- Comments: `mentionUids` over 10 (fail).
- Legacy item with no `public`, `publicBlurb` or `touchedAt`: lead, boss and assignee updates that add `touchedAt` (ok) (L1-27).
- Cache: `at` in the future (fail); wrong term id (fail).
- Write shapes: every test writes with the same SDK calls `actions.js` uses (`serverTimestamp()`, `arrayUnion`/`arrayRemove`, exact key sets), not hand-built objects (L1-36).

## 5. Queries, indexes and first deploy

| Query | Composite index |
|---|---|
| items delta: `termId ==`, `touchedAt >=` | `items (termId ASC, touchedAt ASC)` |
| events: `termId ==`, `archived == false`, `date` range, `orderBy date` | `events (termId, archived, date)` |
| announcements: `termId ==`, `archived == false`, `endDate >= today` | `announcements (termId, archived, endDate)` |
| ideas: `termId ==`, `archived == false`, `orderBy createdAt desc`, `limit 20` | `ideas (termId, archived, createdAt DESC)` |
| submissions pending (admin): `status == 'pending'` | none |
| submissions archive (admin): `type == 'archive'`, `orderBy createdAt desc`, `limit 50` (L1-21) | `submissions (type, createdAt DESC)` |
| submissions mine: `byUid ==` (sorted on the client) | none |
| docTemplates `archived == false`; rsvps `eventId ==`; public roots `termId ==`, `public == true` (publish re-read) | none (equality only) |
| `cache.json`, `public.json` | `fieldOverrides`: not indexed (L1-30) |
| existing: items `(termId, archived)` full listener (fallback); activity `(termId, createdAt desc)` | kept |

The emulator does not enforce indexes; production is the first real test (flagged in the PR). Hosting must not go live before the indexes are built (L1-08), so the README's **first-deploy order** is:
1. `npx firebase deploy --only firestore:indexes` (VS Code terminal, repo root). This ships indexes only, so old clients keep working under the old rules (L1-31).
2. Wait until every index shows "Enabled" (Firebase console in the browser, Firestore, Indexes).
3. `npm run deploy`. Rules and hosting go out together.
4. Open the dashboard once as an admin. That builds the first snapshot.

From then on, any copy of the old app still open has its item writes refused until it reloads.

## 6. Read budget and the snapshot fix

### 6.1 Before (prompt's arithmetic)

A cold open was about 590 reads:
- members 30
- items 400
- check-ins 52
- notifications plus unread 60
- settings and own member doc 3
- events, announcements and doc templates 26
- ideas 20 (laptop Home only)
- feed 1 (admins only)

590 reads × 3 opens × 30 members comes to about 53 000, plus extras, so **about 56 000 a day**, over the 50 000 free quota.

### 6.2 The fix: one snapshot document (approved)

- **Snapshot.** `cache/{termId}` holds every non-archived item of the term as one JSON string, plus `at`, the newest server `touchedAt` it includes. Reading it costs one read whatever its size. The 700 000-character limit is about 2 000 items, more than a year.
- **Cold open.**
  1. `getDoc(cache/{termId})`.
  2. If it exists, listen to `items where termId == T and touchedAt >= at − 60 s`. The 60-second margin covers writes whose request time precedes their commit. That listener also receives archived items, which are removed locally.
  3. If there is no snapshot (new term, first deploy) or the delta query fails, fall back to today's full listener.
  `ready.items` is set when the snapshot and the first delta snapshot have both arrived.
- **Rebuild, never from the store** (L1-26, L1-28). An admin session rebuilds on open and on the 10-minute tick when any of these holds:
  - no snapshot exists for the current term (first deploy, Close term, new term);
  - more than 50 store items have `touchedAt > at`, counted the same way on the snapshot path and the fallback path;
  - the snapshot is over 24 h old;
  - the admin's own session just made a bulk change (lead change, template tree, subtree archive).

  The rebuild runs a fresh `getDocsFromServer` of the full items query (about 400 reads, roughly once a day), so a stale or resumed phone can never write old data.

  **Bounded retries** (L1-37). Before any rebuild, `getDocFromServer(cache/{termId})` (1 read) confirms that the snapshot is really missing or old, rather than trusting the local copy. After every attempt, successful or not, that session waits 6 hours before trying again (kept in memory and in `localStorage` per term). A rebuild that would exceed the size cap is not attempted again for 24 hours. So a full cache, a denied write or a stale local `at` costs at most about 400 reads per admin every 6 hours, never on every tick.

  `at` is the largest `touchedAt` in that server result. If no item has one yet (first deploy), `at` is `Timestamp(0)`, and the delta then returns every touched item. `touchedAt` is stored as milliseconds in the JSON and rehydrated the same way, so snapshot and delta items have one shape (L1-32). Empty default fields are left out of the JSON to save space.
- **Size** (L1-30). An item is about 600 to 900 characters of JSON, so 700 000 characters holds about 800 to 1 100 items, not 2 000. That is still a full year at today's scale. `valid()` gains generous limits so one member cannot inflate it: notes ≤ 2 000, link ≤ 2 000, blockedReason ≤ 500. These are above every UI limit, so legacy documents stay editable. If a rebuild would exceed the limit, it is not written: admin Overview shows "Item cache is full: archive finished projects", and clients keep the last snapshot plus a growing delta. The `json` fields of `cache` and `public` are exempt from indexing (`fieldOverrides`).
- **Effect.** Items drop from 400 reads to about 1 plus the day's changes (10 to 30), and the cost no longer grows through the year.
- **Two small cuts.** Activity loads only on `#/activity` (−50). The unread count is taken from the 50 loaded notifications, so the bell shows "50+" past that (about −10, more for heavy users).
- **Quota message.** A listener error with `resource-exhausted` shows "The council's free daily limit is used up. It resets at 15:00 Jakarta time." The 15:00 is computed from the Pacific midnight reset. The page does not say "reload".

### 6.3 Listener isolation (F5, L1-08)

- **Core listeners** keep the global `S.error` banner: settings, members, own member doc, items (snapshot or delta, or the fallback), check-ins, notifications.
- **Optional listeners** each record their own error in `S.fail[key]` and show a quiet note in their own section. This covers events, announcements, doc templates, feed, ideas, activity, RSVPs and submissions. They are never part of `loaded()` and never set `S.error`.

### 6.4 After

| Per cold open | Reads |
|---|---|
| members | 30 |
| item snapshot plus delta | 1 + about 25 |
| check-ins (this and last week) | 52 |
| notifications (no separate unread query) | 50 |
| settings and own member doc | 3 |
| events, announcements, doc templates | 26 |
| ideas (laptop Home only) | 20 |
| feed (admins only) | 1 |
| **Total** | **about 210** |

Daily estimate:

| Source | Reads a day |
|---|---|
| Cold opens: 210 × 3 × 30 | 18 900 |
| Workload (3 visits × about 540) | 1 600 |
| RSVP sheets | 600 |
| Public site | 500 |
| Calendar page turns | 300 |
| Admin submissions (2 visits × about 60) | 120 |
| Write amplification: each edit costs one read per open client. Bulk actions (lead change, template tree) are the main risk: one 300-item change with 10 open clients is about 3 000 reads (L1-20, L1-35) | 4 000 |
| Snapshot rebuild (about once a day) plus fresh re-reads before real publishes | 500 |
| Rule `get()` calls on writes: about 500 writes × 3 (F16) | 1 500 |
| **Total** | **about 28 000 a day** |

The cache saves some of that on reopens within 30 minutes; the 30 000 trigger for the cache switch was crossed by the before-figure. The 3-opens-a-day figure is a guess. After launch, Josef checks the real number in the Firebase console in the browser (Firestore, Usage) during the first week.

Remaining facts:
- The quota resets at midnight Pacific time: 15:00 Jakarta, or 14:00 during US daylight time (until 1 Nov 2026).
- Writes stay far under the 20 000 a day free limit.

### 6.5 Publish flow and payload whitelist (F2, F3, L1-01, L1-02)

**When.** Admin sessions only (advisor, president, VP, in either view). It runs on open and then on a 10-minute interval. **It skips unless all of these hold:**
- `loaded()` is true and `S.error` is empty;
- `ready.events` and `ready.announcements` are true with no `S.fail` entry for either;
- the latest items, events, announcements and `public/feed` snapshots are all from the server (`metadata.fromCache == false`), which matters with the persistent cache.

**What.** The payload is built from store data with explicit field picks. Nothing else is copied.
- **Projects:** root items with `public === true` and not archived. Fields: `title`, `stage` (todo → "Planning", doing → "In progress", done → "Done"), `pct` (done over total leaf tasks, as on Home), `done`, `total`, `blurb` (`publicBlurb` or empty), `updatedAt`.
- **Events:** `public === true`, not archived, `date >= today` (Jakarta). Fields: `title`, `type`, `date`, `start`, `end`, `location`. No notes, item id or creator.
- **Announcements:** `audience === 'everyone'`, not archived, `endDate >= today`. Fields: `title`, `body`, `startDate`, `endDate`. No creator.

There are no names, emails, initials, comments, check-ins, task titles or uids.

**Write.**
1. Build the payload from the store. `json = JSON.stringify({ v: 1, projects, events, announcements })`, `hash` = FNV-1a of `json` (synchronous, L1-24).
2. If the hash equals the stored `public/feed.hash`, stop. This costs no reads.
3. Otherwise, **re-read every privacy-relevant set from the server** before writing (L1-26):
   - `getDocsFromServer` for public root items (`termId ==`, `public == true`, about 5 reads);
   - the events window (about 15 reads);
   - active announcements (about 3 reads);
   - `getDocFromServer(public/feed)` (1 read).
4. Rebuild the payload from those fresh sets, taking only task counts from the store. Counts are not private.
5. Write `{ json, hash, updatedAt: Date.now() }` only if the fresh hash still differs from the fresh feed hash. Log activity "published the public site".

A phone resumed after days in the background therefore cannot republish something another admin made private. "Publish now" runs steps 3 to 5 and ignores the hash. Cost: about 25 reads per real publish.

**Text admins do not review.** Titles and locations of public items are now admin-only (section 4), so nothing reaches the internet without an admin having flagged or edited it (L1-11).

## 7. Navigation (F4)

- **Laptop rail:** the crest lockup ("Student Council", "St. Johannes Berchmans"); Home, Calendar, Projects, Committees, Resources; the photo card (`building.webp`, "Together for a stronger community") at the bottom.
- **Top bar:** "Search anything" (`/` focuses it) on the left. On the right: the bell (red dot plus count, opening a popover with the latest notifications, "Mark all as read" and "See all activity"), then the avatar menu.
- **Avatar menu:** My profile (`#/people/{me}`); Settings (`#/settings`: theme, install app, About with the version); "Switch to admin view" (advisor, president, VP); Sign out.
- **Phone:** the top bar shows the crest, bell and avatar, with search on a second row. The floating tab bar has Home, Calendar, Projects, Ideas and More, with the active tile solid red. More is a sheet with Committees, Resources and, for exec and admins, Digest and Project templates.
- **Admin view:**
  - Same shell with a red "Admin view" badge under the crest, its own rail, and "Switch to member view" in the avatar menu. The choice is stored in `localStorage` as `council-view`.
  - Rail: Overview, Announcements, Members and roles, Check-ins and workload, Public site, Approvals and archive, Digest.
  - On phone, Overview starts with these sections as a link list, and the More sheet lists them too.
- **Overview, needs attention only (no stat cards):**
  - announcements ending within 3 days;
  - pending submissions (count, link);
  - members missing this week's check-in, using `checksIn()`, with "Copy reminder" (WhatsApp-ready text naming them by first name, `wa.me` share too);
  - unpublished public changes, or the last publish error;
  - who has admin;
  - a warning if the item snapshot is near its size limit.
- **Public site screen:**
  - a list of root projects, each with a Public switch and a blurb field (≤ 140);
  - a preview card rendered with the same `PublicProject` component;
  - "Publish now" and "Last published n min ago".
- **Route map** (hash routes under `/app/`; old names stay as aliases):
  - Home and tasks: `#/week` (Home, the `start_url` target), `#/tasks` (All my tasks), `#/checkin`.
  - Calendar: `#/calendar?d=YYYY-MM-DD&v=week|month&e=id`.
  - Projects: `#/projects?view=progress|pipeline`, `#/p/{id}?view=cards|timeline|team`, `#/meeting/{id}`.
  - People: `#/committees` (alias `#/people`), `#/people/{email}`.
  - Resources and ideas: `#/resources`, `#/templates`, `#/ideas`.
  - Shell pages: `#/activity` (alias `#/feed`), `#/digest`, `#/settings` (alias `#/about`).
  - Admin: `#/admin` plus `/announcements`, `/members`, `/workload`, `/public`, `/approvals`, `/digest`. The old `#/workload` stays as an alias.
  - Other roles on admin routes see "Not for you"; the rules stop the data anyway.
  - Search is a popover on laptop and a full-screen sheet on phone, not a route.

## 8. Screens (F6, L1-14)

- **Home, laptop** (matches `preview.html`):
  1. Hero: `campus-sunset.webp`, an eyebrow with the date, "Good morning/afternoon/evening," (light) and the first name (bold) by Jakarta hour, and one line ("3 tasks this week · check-in closes Friday", or "Checked in for W44 · Edit check-in" once done, L1-05).
  2. Announcements, only when active: 1 = banner, 2 to 3 = cards.
  3. `fl-split`, left column: **Needs you** (mine, not done, due on or before the week's end including overdue, plus "Blocked on you"; overdue first; max 5; "All my tasks"), then **Today's agenda** (today's events, max 5; "Calendar").
  4. `fl-split`, right column: the **check-in red panel** (only while missing; hidden for advisor and teachers), then **My projects** (up to 3 roots where I am an assignee or lead; percent plus `fl-steps` of subteams, at most 5 then "+n"), then the **mission card** (three messages, arrow cycles, dots, no auto-rotation; hidden when a single-announcement banner and the check-in panel both show, DESIGN.md rule 4).
  5. **Top ideas**: 3 notes plus "Open idea board".
- **Home, phone:** hero, check-in panel, announcements (swipe row), Needs you, Today's agenda, My projects.
- **Length budget:** no stat rows, lists capped at 5, Home at about 1.5 laptop screens and 5 phone screens; checked against screenshots.
- **All my tasks:** today's FilterBar (chips with counts, Hide done, person and team filters), default chip Mine, key `council-filter-week`.
- **Calendar, Projects, Committees, Resources, Ideas, Search, Sign-in, Public site:** as the prompt's Screens section. Details already decided are in sections 2, 4 and 6.
- **Mentions** (L1-10): typing `@` lists active members by first name, adding the last initial when two first names match. Picking one inserts `@Name` and adds that email to the comment's `mentionUids`. On post, only the uids whose `@Name` token is still in the text are kept (L1-33). `mention` notifications go only to `mentionUids`; no text parsing. `fl-mention` highlights tokens that match a picked name.
- **Announcements** (F23): shown while start ≤ today ≤ end (Jakarta), newest first, at most 3. The audience picker reads "Everyone (also shown on the public website)" and "Members only". Clicking one opens the `fl-sheet`.
- **Share to WhatsApp:** event sheet, task page and the Overview check-in reminder, all through `https://wa.me/?text=` with encoded text.
- **Make task:** opens the existing task form with the title from the comment (first 80 characters). The parent is the item, or the item's parent for a task. The assignee is the first `mentionUids` entry, else the comment author.

## 9. Milestones and checks

| M | Scope | Checks |
|---|---|---|
| M0 | This plan | spec-conformance, logic reviewer pass 1 (done; fixes in this revision; re-check of the fixed items) |
| M1 | Rules, indexes, `touchedAt` on every item write, roster rules plus roster UI, rules tests, `model.js` helpers | all four (alpha limited to the roster flows), logic reviewer pass 2 |
| M2 | Two entry points, `site.jsx`, `shared.jsx`, bundle check, publish flow, snapshot plus delta, listener isolation, persistent cache, lazy activity, quota message, Hosting check | all four |
| M3 | `git mv` the design system; `app.css`; shell, nav, sign-in, Home, search, Settings; a **mechanical `jy-` to `fl-` pass over every remaining route** so nothing is unstyled; then delete builtbyjosef (F1) | all four |
| M4 | Calendar, Projects (progress, pipeline, public), Committees, Resources, Ideas, mentions, Make task, WhatsApp shares, full restyle of the remaining routes | all four |
| M5 | Admin views, seed, icons, README, brief, CLAUDE.md, final pass. Gates: build with no new warnings; screenshots of every member screen, every admin screen, sign-in and the public site at 1440 × 900 and 390 × 844 in dark, plus light for Home, sign-in and the public site; Lighthouse mobile (F21) | all four plus logic reviewer pass 3 |

Every milestone ends with small commits and a push.

**Size** (Q7): there is no tight line budget, only a 10 000-line ceiling. The test is lean and unbreakable:
- one component per idea, no wrappers, no dead or commented-out code;
- every write path awaited and caught;
- every listener has an error path;
- every rule tested.

The final line count is reported in the PR.

## 10. Risks

- **Read quota.** It is now estimated at about 28 000 a day. The real usage is unknown until the first week; check it then.
- **Snapshot correctness.** A wrong `at` or a missed delta would show stale items. Mitigations: server `touchedAt` enforced by the rules, the 60-second margin, the full-listener fallback, and an emulator test that edits, archives and creates items after a snapshot.
- **Deploy-day writes from old open clients** are refused until they reload.
- **Production indexes** are untested until the first deploy (first-deploy order in section 5).
- **Lead-change batches** (G1-09) are unchanged. The new approve batch is one status update plus one doc template, well under the access-call limit.
