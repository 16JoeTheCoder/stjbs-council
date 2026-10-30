# M3 alpha test report

Tester: first-time user, headless Chromium (Playwright) against `npm run demo` (emulators, seeded data), 2026-10-30 (Jakarta 08:xx).
Roles driven: raka, sarah, kevin, nadia, ariel, budi, plus michael and clara for lead and check-in cases. Sizes: 1440x900 and 390x844, dark; light for Home and sign-in.
Scripts: `qa/m3a.cjs` to `qa/m3s.cjs`, helper `qa/m3lib.cjs`. Screenshots: `qa/screens-m3/` (about 170, all main ones viewed).
Calendar, Resources, admin Overview/Announcements/Public site/Approvals, @mentions and "Make task" are out of scope; links to them show "Not here. Page not found" and nothing crashes.

Console: no `pageerror`, no failed requests other than the expected 400s from wrong-password sign-ins (auth emulator) and one aborted Firestore Listen channel on sign-out.

## Summary

| # | Severity | Title |
|---|---|---|
| 1 | major | Bell popover is clipped off the left edge on phone |
| 2 | major | Stray "X" (close search) button shows under the search box on every phone screen |
| 3 | major | "All projects. N running." counts finished projects |
| 4 | major | Admin view preference turns every member page into admin chrome |
| 5 | minor | Home is about 1.95 laptop screens (budget 1.5) |
| 6 | minor | Blank check-in submits and counts as checked in |
| 7 | minor | Teacher and advisor can submit a check-in by URL |
| 8 | minor | Blank sign-in email says "not valid" rather than "type your email" |
| 9 | minor | No confirmation toast for Public switch, Pipeline Move, pin idea, vote |
| 10 | minor | Sheet opened from search returns focus to body |
| 11 | minor | Light sign-in is unreachable for a signed-out user |
| 12 | minor | Rail photo caption sits on the photo with weak contrast |
| 13 | minor | Roster on phone hides Edit and Deactivate off-screen |
| 14 | minor | Digest route open to teacher |

No blockers.

## Findings

### 1. major: bell popover clipped on phone
Steps: sign in as raka at 390x844, tap the bell.
Expected: popover fully inside the viewport.
Actual: popover box is x=-36, width 358. Left 36 px is cut off: "FOR YOU" reads "R YOU", the avatar chip and the icon of "See all activity" are clipped, and the "Mark all as read" row is partly hidden.
Evidence: `qa/screens-m3/raka-bell-390.png`; measured by `qa/m3d.cjs` ("pop box").

### 2. major: stray close button on phone
Steps: any screen at 390 px (Home, Tasks, Projects, roster).
Expected: search row shows only the search field while search is closed.
Actual: a square "X" (`.fl-search__close`) shows on its own row under "Search anything" with search closed. Tapping it does nothing visible. Cause: `src/app.css` line 60 forces `.fl-search__close { display: inline-grid !important; }` for every phone state, not only `.is-open`.
Evidence: `qa/screens-m3/raka-week-390.png`, `kevin-projects-390.png`, `raka-tasks-390.png`.

### 3. major: "running" count includes done projects
Steps: any role, open Projects. Seed has Welcome week (status done, 100%), Canteen survey and STJBS Carnival.
Expected: "2 running" (or a different word); the page says "3 running".
Actual: `src/routes/projects.jsx` line 79 uses `roots.length`. After nadia adds a project it says "4 running" while the Pipeline shows one in Done.
Evidence: `qa/screens-m3/nadia-projects-1440.png`, `kevin-projects-390.png`.

### 4. major: admin view preference overrides member routes
Steps: kevin avatar menu, Switch to admin view. Then open `#/week`, `#/projects`, or reload on `#/week`.
Expected: member pages in the member shell (the rail has no way back to Home from admin view except the avatar menu), or a clear return path.
Actual: `adminView = isAdmin() && (route.name === 'admin' || view === 'admin')`, so Home, Projects, search results, bell links and "Go to Home" all render with the admin rail and the "Admin view" badge, and there is no Home link in that rail. After reload the app opens `#/week` in admin chrome. Switch to member view works (verified, remembered after reload).
Evidence: `qa/m3o.cjs` output "member route while admin view: badge 1 rail [Overview, ...]".

### 5. minor: Home too long on laptop
Raka 1440x900: page height 1768 px (1.96 screens). Kevin/nadia 1491 px (1.66). Budget is about 1.5. The top ideas panel and mission card account for the excess. Phone is fine (about 2.0 to 2.2 screens against 5). Evidence: `raka-week-1440.png`.

### 6. minor: blank check-in accepted
Steps: raka, `#/checkin`, press Submit with all three boxes empty.
Expected: a prompt to answer at least one.
Actual: "Check-in saved." Home then says "Checked in for W44" and the red panel disappears.

### 7. minor: teacher and advisor can check in by URL
Steps: budi or ariel, open `#/checkin`, type, Submit. Actual: "Check-in saved." Home never links to it for them (`checksIn` excludes both), so only the URL reaches it.

### 8. minor: blank email message
Steps: sign-in, press Sign in with both fields empty. Actual: "That email address is not valid. Use your school email." Expected: ask to type the email.

### 9. minor: silent actions
Public switch (kevin), Pipeline Move (nadia), pin idea and vote (raka) change the data but show no toast, unlike add project, archive, check-in. The only feedback is the control state.

### 10. minor: focus after search sheet
Steps: "/", type "Carnival volunteer", Enter (announcement sheet opens), Esc. Focus lands on `BODY`; DESIGN.md says focus returns.

### 11. minor: light sign-in
The theme defaults to dark and is stored only after sign-in (Settings), so a signed-out visitor never sees the light sign-in unless the browser already has `council-theme=light`. Light layout itself is fine (`signin-light-1440b.png`).

### 12. minor: rail photo caption
"Together for a stronger community" is white text laid over the photo bottom-left (`raka-week-1440.png`); readable in dark, weak against the bright building. Automated check cannot score text on images.

### 13. minor: phone roster
Members table scrolls sideways inside its panel; Edit and Deactivate are in the last column, off-screen at 390 px until the user scrolls (`kevin-admin-members-390.png`).

### 14. minor: digest for teacher
budi opens `#/digest` and sees the full digest with Copy and WhatsApp (including check-in text); there is no link to it for him. Read-only, so low risk.

## Verified working

- Sign-in: wrong password, bad email, unknown email, reset message ("If ... has an account, a reset link is on its way"), sign out from avatar menu, sign back in, reload keeps session, signed-out visit to `#/admin/members` shows sign-in then, after sign-in as raka, "Not for you. Admin".
- Shell: every rail link and tab; More sheet entries (Committees, Resources, All activity, Settings, plus Project templates and Admin for exec/admin) all navigate and close; bell opens, shows unread count, "Mark all as read" clears (persists after reload), "See all activity" opens `#/activity`, Esc and outside click close; avatar menu has profile, Settings, Sign out, plus the view switch for kevin/nadia/ariel only (sarah, raka do not see it); "/" focuses search, ArrowDown and Enter open a hit, Esc closes and clears, `<script>` is harmless, no-match message; phone search fills the screen with a working close button.
- Home: greeting uses first name and Jakarta time (04:59Z morning, 05:00Z afternoon, 11:00Z evening, 17:01Z Saturday morning); Needs you max 5 with All my tasks link; Today's agenda; check-in panel shows only while missing (raka, clara yes; michael no, and none after raka checked in); My projects shows subteam steps; mission arrow cycles three messages and never auto-rotates (laptop only); top ideas laptop only; announcements 0 = hidden, 1 = wide banner, 2 to 3 = cards, 4 active shows 3; sheet opens and Esc closes; one banner plus due check-in hides the mission card (clara); phone order hero, check-in, announcements, Needs you, agenda, projects.
- Numbers: Carnival 2 of 11 = 18%, after a tick 3 of 11 = 27%, after adding a task 2 of 12 = 17%; Drinks and Home counts follow; filter chip counts equal list rows for All 15, Mine 4, Due soon 1, Overdue 2, Blocked 1, Done 4; digest done/overdue/blocked/deals match the seed; Home "2 tasks this week" equals Needs you rows.
- Actions: tick and untick; michael (Drinks lead) adds a task (blank title, 80-char cap, reversed dates, `javascript:` link, `<b>` and emoji all handled, shown as text); assignee edit shows only status, blocked, notes, link and deal fields; archive then Undo restores; nadia adds a project and moves it in Pipeline (persists after reload); kevin toggles Public (persists); sarah, raka, michael, budi see no Public switch; budi has no Move selects and no pin or vote (vote disabled); ideas: blank and spaces disabled, 140 cap, `<script>`/emoji/CJK shown as text, vote and unvote, admin Archive.
- Roster: kevin cannot change ariel or himself (role/deactivate), can change others; nadia can edit name and section only (role select disabled), cannot edit ariel, cannot deactivate, add roles limited to officer/treasurer/secretary/teacher; Close term is advisor only.
- Digest copy matches the preview and the WhatsApp link decodes to the same text with `noopener noreferrer`.
- Refresh mid-flow and browser back/forward behave; unknown project and person show "Not found" pages; wrong-role admin routes show "Not for you".
