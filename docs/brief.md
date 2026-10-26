# stjbs-council build brief

Build the STJBS student council dashboard end to end: data model, Firestore security rules, interface, installable phone-and-laptop packaging. Three standards: (1) the Firestore security rules are the real permission layer; hidden buttons are cosmetic. (2) Lean code: rich features, minimal lines. (3) The builtbyjosef design system (`design/builtbyjosef/DESIGN.md`) is the only visual language.

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
`design/builtbyjosef/DESIGN.md` is the standard and overrides this brief except for the signature placement. Import `design/builtbyjosef/index.css` once. Fonts must resolve in the production build. `var(--token)` for every colour, space, radius, duration and font; no raw hex outside token files and `manifest.webmanifest`. Components the system lacks (person chip, progress bar, deal step bar, task row, bottom tab bar, top nav link, filter chip, task card) live in `src/app.css`, tokens only, `jy-` prefix, one fixed form each. Run `bash scripts/jy-check.sh` and fix every `x`.

Rules: calm app, no flare in the working UI, heat only as state, one orange point per view. Weights 300, 400, 500, 700 only. Sentence case, verb-first buttons, no emoji, no exclamation marks, errors say what happened and what to do in one line. Light-phrase plus bold-phrase headlines. 8px grid with 4px half step. At most two radii per view (10 and 4); pill only for toggles. Flat, hairlines, the one hard shadow only on hover. Motion uses the five durations, runs once, honours `prefers-reduced-motion`. Touch targets 44px, visible focus ring, text 4.5:1 and marks 3:1 in both themes. Status is shape plus word plus colour via `jy-badge`. Icons Lucide, 2px stroke, inline SVG.

Themes: dark by default; light/dark toggle stored in `localStorage`, applied via `data-theme`. Both themes checked on every screen.

Approved mock-up decisions:
- Progress: flat determinate bar, 6px, track `--line`, fill `--inverse`. Never rings or spinners.
- People: 28px squares with initials, radius 4, JetBrains Mono 500 12px. A subteam lead's square is filled (`--inverse`, `--on-inverse` text). Signed-in user's header chip is 40px. No photos.
- The one orange point is the screen's primary action: `Start check-in` on My week, `Add task` in the meeting view, `Submit check-in` on the check-in form. A project header may carry one stat with the orange cap (Done percentage); other stats use a `--line-strong` cap. Selected nav and active states are ink, not orange. A panel cap sweeping orange on hover is allowed.
- Stat form: cap fragment, uppercase label, light 44px numeral, bold unit.
- Phone (390px): 72px bottom tab bar with four tabs (My week, Projects, People, Feed), active tab marked by a 28 x 6 ink cap. Laptop: top nav with the same links plus Workload, Templates and Admin for roles that may see them. Drill-down cards in a responsive grid, activity in a sunken well beside it.
- Swimlane meeting view: lanes 304px wide in a horizontally scrolling row. Lane header panel (name, lead, bar, "7 of 12 tasks") and task cards (title, badge, chips, due date in mono). Below 1100px a one-line notice that the meeting view is built for a wide screen.
- Hero headlines on My week and project pages use the light-plus-bold pair ("Your week. Four tasks.").

Branding: the builtbyjosef signature appears only on the About page: `tab-lockup-dark`/`tab-lockup-light` per theme, the version number and "Built by Josef Yang". Nowhere else. App icons from `tab-icon-dark`/`tab-icon-light`; favicon a mono variant. Icons 192, 512, maskable 512, 180 apple-touch.

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
- **Deal pipeline**: only deal tasks show stage and amounts. Four-segment bar with "Stage 3 of 4", "Pledged 15 000 000 IDR · received 0 IDR". A project page with deals shows a `jy-table` of them.
- **Digest**: template in `settings/digest` with `{week}`, `{done}`, `{overdue}`, `{blocked}`, `{deals}` and section toggles; exec and advisor edit with live preview. Plain text with `*bold*`. `Copy digest` and `Open in WhatsApp` (`wa.me` with encoded text). Sensible default.
- **Templates**: import and export one JSON schema; never parse PDFs. Paste or upload, validate with specific errors (max 300 items, depth max 4, unique keys, valid parents), preview as a tree, edit (rename, change offsetDays, add or remove a node), save, export. Start a project from a template with an event date; due = event date + offsetDays; null offset = no due date. Any project exportable. A help panel with `Copy prompt` containing the AI prompt.
- **Timeline**: per project, one row per subteam or task, CSS bar from startDate (or createdAt) to dueDate, today marker in ink, week axis.
- **People, team chart, org chart**: People list doubles as filter rail. Team chart: subteams as columns, lead chip filled. Org chart from `reportsTo`. Tapping a chip shows that person's tasks.
- **Activity feed**: latest 50, newest first, chip + sentence + mono timestamp; sunken well beside the project grid on laptop; Feed tab on phone.
- **Workload** (advisor, president, vp): `jy-table` per member: open, overdue, blocked, done this term, done last 7 days, check-ins submitted out of weeks elapsed. Saves a weekly snapshot to `stats/{termId}_{weekId}` if missing; small `jy-chart` line of total open tasks. Be accurate: live numbers come from readable tasks; only snapshots are protected.
- **Close term** (advisor): forces a full JSON backup download (members, items, comments, check-ins, activity) plus a CSV of items; confirm locked until the download happened; type the new term name. Only changes `settings/current.termId`; reversible.
- **Admin**: roster management for advisor and president; close term for the advisor.
- **PWA**: manifest (name "STJBS Council", short name "Council", standalone, start at My week, dark surface colours), icons, iOS meta tags, `beforeinstallprompt` "Install app" button; iPhone instructions (Safari, Share, Add to Home Screen) on the login page. No offline caching.
- **About**: signature, version, "Built by Josef Yang".

## 7. Out of scope
Chat, push or email notifications, reminders, offline caching, file uploads, profile photos, service-hours logging, run sheet, handover archive, budget tracker, attendance, search box, AI inside the product, moving tasks between parents.

## 11. Quality gates
Gate 1 (code functionality) writes `docs/qa/code-check.md`; Gate 2 (design and accessibility) writes `docs/qa/design-check.md`. Findings only, each with severity (blocker, major, minor), location (`file:line` or route and viewport), what is wrong, expected behaviour, root cause when known. Group findings sharing a cause. Max 40 findings. Checkers never modify product code. The mistakes log is `docs/qa/lessons.md`.
