# stjbs-council build brief

Build the STJBS student council dashboard end to end: data model, Firestore security rules, interface, installable phone-and-laptop packaging. Three standards: (1) the Firestore security rules are the real permission layer; hidden buttons are cosmetic. (2) Lean code: rich features, minimal lines. (3) The Fiat Lux design system (`design/fiatlux/DESIGN.md`) is the only visual language.

## 1. What this is
St. Johannes Berchmans School (STJBS), Jakarta. The council has four exec board members (president, VP, treasurer, secretary), 14 officers (seven sections, two officers each), and a few teachers including the advisor, Mr. Ariel. Fewer than 30 members. The site is one place to collaborate on projects (first: the STJBS carnival), see progress and timelines, and run weekly check-ins and meetings. Projects split into subteams, each with a lead who acts like an admin inside that subtree only. The council uses WhatsApp and Google Chat; the dashboard feeds them through an editable digest. No chat inside the dashboard. The one habit that decides success: every member opens it once a week to check in, in under 60 seconds.

## 2. Stack and code rules
- Vite and Preact (plain JavaScript), Firebase Auth (email and password), Firestore, Firebase Hosting. Hash routing.
- No UI kit, CSS framework, chart library or date library. Fonts self-hosted from the design system; no Google Fonts CDN, analytics or third-party scripts.
- About 2 000 lines of app code, excluding CSS, rules and tests. Units in names, kebab-case files, PascalCase components.
- Time zone Asia/Jakarta (UTC+7). Weeks start Monday (ISO week ids like `2026-W44`). Dates display as `2026-10-26`. Currency IDR as `15 000 000 IDR` with thin-space thousands.
- No secrets in the repo; web config in `.env.local`, documented in the README.
- Data minimisation: store only name, school email, role, section, `reportsTo` and work content.

## 3. Design
`design/fiatlux/DESIGN.md` (Fiat Lux: dark first, Berchmans red, school photography) is the standard and overrides this brief. Import `design/fiatlux/tokens.css` then `components.css` once per entry. App additions live in `src/app.css`, tokens only, `fl-` prefix, one fixed form each (timeline bars, meeting swimlanes, org chart, deal stage bar, filter chips with counts, breadcrumbs, `fl-scroll`). Run `npm run check` and fix every `x`. The retired builtbyjosef brand appears nowhere in the app.

Key rules from DESIGN.md: red is the light (primary button, active nav, red panels, progress), at most two red-filled surfaces per screen, status is colour plus shape plus word, Plus Jakarta Sans with JetBrains Mono for times and numbers, weights 200 to 800 as listed, the length budget (Home within about 1.5 laptop screens and 5 phone screens, lists capped at 5 rows, no stat rows on Home), 44px tap targets, both themes, Lucide icons inline. Dates on screen read "Thu 29 Oct"; data keeps ISO dates.

Navigation: left rail on laptop (Home, Calendar, Projects, Committees, Resources), floating five-tile tab bar on phone (Home, Calendar, Projects, Ideas, More). Admin view (advisor, president, VP) has its own rail. The public site at `/` uses the same system.

## 4. Access, roles and security
Email and password sign-in only. Flow: create account, verification email, verified, roster check. Password reset, resend-verification button, and the message "Your email isn't on the council roster. Ask the president to add it." for verified non-members, who are then signed out.

Roles: `advisor`, `president`, `vp`, `treasurer`, `secretary`, `officer`, `teacher`. Exec = president, vp, treasurer, secretary. Enforced in `firestore.rules`:
- Every read and write: signed in, `email_verified` true, `members/{email}` exists with `active == true`. Members keyed by lowercased school email; a member can only be created if the email ends with `@stjbs.sch.id`.
- Read: active members read items, comments, check-ins, activity, members, templates. Notifications readable only by their owner. Weekly workload stats readable only by advisor, president, vp.
- Create a root project: advisor and exec.
- Edit, add, assign, archive inside a subtree: advisor, exec, or a lead of an ancestor or the item itself, via a denormalised `leadUids` array; lead changes batch-update descendants.
- An assignee may edit only `status`, `blocked`, `blockedReason`, `blockedOnUid`, `notes`, `link`, and on deal tasks the deal stage and amounts. Not title, due date, assignees, parent or the deal toggle.
- Deal toggle: advisor, exec, or a subtree lead.
- Comments: any active member including teachers; authors delete only their own. No other deletes except own comments and own notifications; everything else archived.
- Check-ins: own document only, id `{termId}_{weekId}_{uid}`.
- Roster: advisor and president add or edit. Only the advisor deactivates or assigns `advisor`.
- `settings/current` (termId): advisor only. `settings/digest`: exec and advisor. Templates: exec and advisor write, all read.
- `activity` create-only with `actorUid == me`. `notifications/{uid}/items/{id}` created by any active member if `fromUid == me`; only the owner reads, marks read or deletes.
- Every data write carries the current `termId`.

(Implementation decision: every `*Uid` field stores the lowercased school email, not the Firebase uid, so tasks can be assigned before first sign-in. See README.)

## 5. Data model
All documents carry `termId`, `createdAt`, and where relevant `updatedAt`.
- `members/{email}`: name, initials, role, section, reportsTo, active.
- `items/{id}`: projects, subteams and tasks: parentId, ancestors, leadUids, leadUid, title, notes, link (one URL), assigneeUids, createdByUid, status (todo/doing/done), blocked, blockedReason, blockedOnUid, startDate, dueDate, assignedAt, completedAt, archived, isDeal, dealStage (Lead, Contacted, Negotiating, Signed), pledgedIdr, receivedIdr. Progress rolls up from leaf tasks (done over total), computed on the client.
- `comments/{id}`: itemId, authorUid, text (max 500), createdAt.
- `checkins/{termId}_{weekId}_{uid}`: done, doing, blocked.
- `activity/{id}`: actorUid, type, itemId, text, createdAt, written in the same batch as the change.
- `notifications/{uid}/items/{id}`: toUid, fromUid, type (comment, assigned, blocked-on-you), itemId, text, read, createdAt.
- `templates/{id}`, `settings/current` (termId, termName), `settings/digest` (template, sections), `stats/{termId}_{weekId}`.
Derived task state precedence: done (ok "Done"), blocked (bad "Blocked"), overdue (bad "Overdue"), due within 3 days (warn "Due soon"), else (ok "On track").
Cheap reads: one listener each for the term's items, members and current-week check-ins, plus own notifications and the latest 50 activity entries. Comments fetched only when a task's comment section is opened.

## 6. Features
- **My week** (home): bold check-in banner while this week's check-in is missing (ink-bordered panel, due day, "Three answers. Under a minute.", accent `Start check-in`); my tasks due this week with checkboxes; "Blocked on you" with `Open task`; the filter bar below.
- **Task filters**: shared bar on My week, project pages and meeting view. Single-select chips with counts in mono: All, Mine, Due soon, Overdue, Blocked, Done. Person and team filters are list-based (People and Teams lists). `Hide done` toggle becomes `Show done (7)`; view-only, persisted per screen in localStorage. My week defaults to Mine; others All.
- **Highlighting**: mine = 2px `--ink` border, 6px ink cap, title `--ink` 500. Not mine = `--line` border, `--ink-muted` text, no cap, no hover lift. Parents count as mine if any descendant task is mine and show "2 yours". Quiet text keeps 4.5:1.
- **Task tree and drill-down**: Projects home is cards (name, state badge, optional "Deal" tag, "7 of 12 tasks", bar, due date, member chips) with a breadcrumb. Cards open children; tasks as rows. A lead sees edit controls for their subtree only.
- **Weekly check-in**: done, doing, blocked; one document per member per week; editable until the week ends; due Friday 23:59 Asia/Jakarta. Status: bad if blocked text non-empty or last week missed; warn if anything overdue or this week not in; ok otherwise. Summary lines from counts and the person's own words in quotes: `Michael: 2 done, 1 overdue. Blocked: "waiting on Pocari reply"`.
- **Meeting view**: one lane per subteam; agenda strip with blocked items first (blocked tasks plus quoted blocked check-in text), then overdue. `Add task` inline in a lane. Check-in count ("14 of 18") in the header.
- **Comments**: hidden behind `Add comment` when none; latest two plus `Show all (n)`; expanded shows full thread. Posting writes comment, activity and notifications in one batch.
- **Notifications** (in-app only): recipients are the task's assignees, creator and subteam lead, minus the author, plus anyone newly assigned and anyone in `blockedOnUid`. Bell shows unread count as text; opens a "For you" list at the top of the Feed.
- **Deal pipeline**: only deal tasks show stage and amounts. Four-segment bar with "Stage 3 of 4", "Pledged 15 000 000 IDR · received 0 IDR". A project page with deals shows a `fl-table` of them.
- **Digest**: template in `settings/digest` with `{week}`, `{done}`, `{overdue}`, `{blocked}`, `{deals}` and section toggles; exec and advisor edit with live preview. Plain text with `*bold*`. `Copy digest` and `Open in WhatsApp` (`wa.me` with encoded text). Sensible default.
- **Templates**: import and export one JSON schema; never parse PDFs. Paste or upload, validate with specific errors (max 300 items, depth max 4, unique keys, valid parents), preview as a tree, edit (rename, change offsetDays, add or remove a node), save, export. Start a project from a template with an event date; due = event date + offsetDays; null offset = no due date. Any project exportable. A help panel with `Copy prompt` containing the AI prompt.
- **Timeline**: per project, one row per subteam or task, CSS bar from startDate (or createdAt) to dueDate, today marker in ink, week axis.
- **People, team chart, org chart**: People list doubles as filter rail. Team chart: subteams as columns, lead chip filled. Org chart from `reportsTo`. Tapping a chip shows that person's tasks.
- **Activity feed**: latest 50, newest first, chip + sentence + mono timestamp; sunken well beside the project grid on laptop; Feed tab on phone.
- **Workload** (advisor, president, vp): `fl-table` per member: open, overdue, blocked, done this term, done last 7 days, check-ins submitted out of weeks elapsed. Saves a weekly snapshot to `stats/{termId}_{weekId}` if missing; small `fl-chart` line of total open tasks. Be accurate: live numbers come from readable tasks; only snapshots are protected.
- **Close term** (advisor): forces a full JSON backup download (members, items, comments, check-ins, activity) plus a CSV of items; confirm locked until the download happened; type the new term name. Only changes `settings/current.termId`; reversible.
- **Admin**: roster management for advisor and president; close term for the advisor.
- **PWA**: manifest (name "STJBS Council", short name "Council", standalone, start at My week, dark surface colours), icons, iOS meta tags, `beforeinstallprompt` "Install app" button; iPhone instructions (Safari, Share, Add to Home Screen) on the login page. No offline caching.
- **About**: signature, version, "Built by Josef Yang".

## 7. Out of scope
Chat, push or email notifications, reminders beyond the copyable check-in reminder, offline mode beyond Firestore's device cache, file uploads (files are Google Docs or Drive links), profile photos, service-hours logging, run sheet, budget tracker, attendance, AI inside the product, moving tasks between parents, Cloud Functions and the paid Blaze plan.

In scope since the Fiat Lux release: the public site, search over loaded data, announcements, the calendar with RSVPs, the idea board, document templates with suggestions and approvals, and the handover archive.

## 11. Quality gates
Gate 1 (code functionality) writes `docs/qa/code-check.md`; Gate 2 (design and accessibility) writes `docs/qa/design-check.md`. Findings only, each with severity (blocker, major, minor), location (`file:line` or route and viewport), what is wrong, expected behaviour, root cause when known. Group findings sharing a cause. Max 40 findings. Checkers never modify product code. The mistakes log is `docs/qa/lessons.md`.
