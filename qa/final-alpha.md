# Final alpha test report

Tester: first-time user, headless Chromium (Playwright) against `npm run demo`, 2026-10-30. Roles: raka, michael, sarah, nadia, kevin, ariel, budi, signed out; 1440x900 and 390x844 (dark; light for Home, sign-in, public). Scripts `qa/fa.cjs` to `qa/fr.cjs` (helper `qa/flib.cjs`), screenshots `qa/screens-final/`. Demo stopped at the end.

Test-environment notes (not product findings): the first demo's Auth emulator died mid-run and the demo was restarted once (data reseeded). Some rows carrying an `mvupkjrm` suffix ("Cup supplier call", "QA public event") were not made by me; another tool appears to have written to the same emulator.

## Re-check of earlier majors

| Earlier major | Status | Evidence |
|---|---|---|
| Make task lands in assignee's Needs you | FIXED | michael made a task from an `@Raka` comment; the form carries due date 2026-10-30; raka's Home Needs you lists it as "Due soon" (`screens-final/raka-home-needsyou.png`) |
| Event saved in a month outside the loaded window | FIXED | kevin added an event in June 2027: shown immediately in month grid; edit and archive also update at once |
| Bell popover and search on phone | FIXED | popover x 16 to 374 at 390 px; search sheet lists grouped results (`phone-bell.png`, `phone-search.png`) |
| "N running" | FIXED | Projects says "2 running" with Welcome week done |
| Admin chrome only on #/admin routes | FIXED | after switching to admin view, `#/projects` shows the member rail; a reload keeps the member route; avatar menu offers the right switch per route |

## Findings

No blockers. No majors.

| # | Sev | Finding |
|---|---|---|
| 1 | minor | Reset password mode: an unknown or invalid email shows "Email or password is wrong. Check both, or create an account." (wrong wording for reset; stale error text carries over from the sign-in form). Steps: sign-in, enter `ghost@stjbs.sch.id`, Reset password, submit. |
| 2 | minor | Exporting a project that has an empty subteam writes it as a task; starting a project from that JSON shows "Photography" as a task with no date instead of a subteam (template schema has only teamTag). |
| 3 | minor | Typing immediately after picking an `@mention` with Enter can scramble the first characters (caret restored in a `setTimeout`, `src/ui.jsx:167`). Only seen with automated typing at 0 delay. |
| 4 | minor | "Start project from template" creates the project at once using the default event date (today); negative offsets then give a project that is overdue on day one. Set the date first. |
| 5 | minor | Carried over from m4 and still open: no toast on RSVP, vote, pin idea; no notification on approve/reject; all-day chips carry no day. |

## Verified working

- Public site: `/` at 1440 and 390, dark and light, no overflow, live section, announcements, events, anchors, Dashboard button. Old links `/#/week`, `/#/p/t1`, `/#/calendar` land on `/app/#/...`.
- Sign-in: wrong password, no-roster email, invalid email, reset sent message, signed-out `#/admin`, `#/p/t1` show sign-in. Sign out from avatar menu works; Back after sign-out stays on sign-in; refresh stays signed out.
- All 22 routes for all 7 roles at both sizes: no page errors, no overflow, no console errors beyond expected 400s on wrong credentials. raka, sarah, budi get "Not for you" on every `#/admin/*`, workload and templates (raka); unknown route gives "Page not found"; `#/people/zzz` "No such member". Digest is open to every member (declared deviation, plan item 16).
- Home (raka): hero, announcements, Needs you, agenda, check-in panel, projects with steps, mission card, top ideas, within length budget.
- All my tasks chips and counts match rows (All 16, Mine 2, Due soon 1, Overdue 2, Blocked 1, Done 2 in Carnival). Tick/untick moves percent 18 to 27 and back.
- Drill-down and breadcrumbs, Add task (blank refused, `javascript:` link refused, due before start refused, special characters stored as text, long titles cut), archive with Undo (restores), Add subteam, lead change ("Lead changed."), timeline, team chart, meeting view, deal edit page, task edit as assignee (limited fields: status, blocked, notes, link only), teacher read-only.
- Check-in submit and edit (500-character cap, escaped on the person page). Refresh mid-edit returns to the page.
- Committees, person page, Resources list, Ideas pin (140 cap, HTML shown as text) and vote/unvote, activity page, digest copy and WhatsApp link, project template export, bad-JSON and invalid-item errors, import and save, start from template.
- Admin: kevin and nadia Overview (3 missing check-ins, Copy reminder text names them, 3 submissions, who has admin), Announcements, Public site Publish now (toast; public page then showed "Last change just now" and the new numbers), Members and roles per the roles table (vp: no edit/deactivate for advisor or self; president: role select disabled, no Deactivate; advisor: all). Phone: More sheet lists every admin section with "Switch to member view".
- Settings: theme switch, About "Version 1.0.0". Close term (ariel only): Download backup produced `council-backup-2026-10-30.json` (members, items, comments, checkins, activity, templates, announcements, events, rsvps, ideas, docTemplates, submissions, cache, public, settings); the term-name field and confirm are disabled before the backup and the confirm enables only after it and a valid name. Not clicked.
- Calendar boundaries, RSVP and WhatsApp share were verified in m4 and the code path is unchanged; I re-checked add, edit and archive only.
