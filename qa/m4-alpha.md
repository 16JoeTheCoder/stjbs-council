# M4 alpha test report

Tester: first-time user, headless Chromium (Playwright) against `npm run demo`, 2026-10-30 (Fri, Jakarta afternoon). Roles driven: raka, michael, sarah, nadia, kevin, ariel, budi at 1440x900 and 390x844. Scripts `qa/m4a.cjs` to `qa/m4o.cjs` (helper `qa/m4lib.cjs`), screenshots `qa/screens-m4/` (the main ones viewed). Demo stopped at the end.
Console: no `pageerror`, no failed requests except aborted Firestore Write channels on page close. No horizontal overflow at 390 on Calendar (week, month, sheet, form), Resources, Ideas, admin Overview and all admin sections.

## Part 1: earlier findings

| # | Finding | Status | Evidence |
|---|---|---|---|
| a | Bell popover clipped at 390 | FIXED | popover box x=16 to 374 (`qa/screens-m4/raka-bell-390.png`) |
| b | Stray close-search X on phone | FIXED | `.fl-search__close` computed `display:none`, 0x0 while closed (`raka-home-390.png`) |
| c | "N running" counted done projects | FIXED | seed says "All projects. 2 running." (Welcome week is Done) (`raka-projects-390.png`) |
| d | Member pages still show admin rail after switch to admin view | FIXED | with admin preference, `#/projects` and `#/calendar` render the member rail with no badge; the admin rail returns on cold open of `#/week` (lands on `#/admin`, the remembered choice) |

## Summary of new findings

| # | Severity | Title |
|---|---|---|
| 1 | major | "Make task" creates a task that never shows in the assignee's Needs you |
| 2 | major | An event added in a month outside the loaded window does not appear after saving |
| 3 | minor | All-day row chips carry no day, so evening events on different days look the same |
| 4 | minor | Week grid on phone shows about 2.5 days and clips event text |
| 5 | minor | 30-minute chips in the week grid truncate title and hide the time |
| 6 | minor | Featured card "Next up" is the next public event, not the next event |
| 7 | minor | A typed `@Name` that was not picked from the list is neither highlighted nor notified |
| 8 | minor | Approve or reject sends the submitter no notification |
| 9 | minor | Double-click on a vote ends as "voted" (race) |
| 10 | minor | No toast for RSVP, vote, pin idea |
| 11 | minor | Admin Overview on phone has no "Admin view" marker |

No blockers.

## Findings

### 1. major: Make task is not in Needs you
Steps: michael (lead of Drinks) opens `#/p/t1`, comment `@Raka book the cup supplier today` (pick Raka from the list), press Make task on that comment, change nothing but the title, Add task. Then sign in as raka and open Home.
Expected: the task lands in raka's Needs you (spec "Also", Comment to task).
Actual: raka gets the "assigned" notification and the task is in "All my tasks", but Home "Needs you" lists only "Secure Pocari Sweat booth contract" and "Order 400 cups". The prefilled form has no due date, and Needs you shows only tasks due this week plus blocked ones. Home still says "2 tasks this week".
Evidence: `qa/m4h.cjs` and `qa/m4i.cjs` output; `qa/screens-m4/raka-home-needsyou-1440.png`.

### 2. major: new event outside the loaded window is invisible after saving
Steps: kevin, `#/calendar?v=month&d=2027-03-10`, Add event "March event" dated 2027-03-10, Add event.
Expected: it shows in March 2027.
Actual: toast "Added" but the month grid is empty (the one-off read for out-of-window ranges ran before the write; no listener). Events saved in Dec and Jan appear only because I then navigated to them. The same applies to editing or archiving an event in a far month.
Evidence: `qa/m4d.cjs` ("Mar month after add (should show): []"), `src/routes/calendar.jsx` `useEvents` (`getDocs`, deps `[from, to, outside]`).

### 3. minor: all-day row has no day
Next week (Mon 2 to Sun 8 Nov): the chip "Carnival night 18:00 to 21:00" sits at the left of the row above Mon, though it is on Sun 8 Nov. Project due markers ("Due: Canteen survey") behave the same. The chip shows time only, no date. Evidence: `raka-cal-nextweek-1440.png`, `kevin-cal-evening-1440.png`.

### 4. minor: phone week grid
At 390 px the grid scrolls sideways and shows Mon, Tue and half of Wed; "Last week's debrief 15:30 to" is cut. Month view is usable. Evidence: `raka-cal-week-390.png`.

### 5. minor: short chips
"Sponsor call with the bank" (10:00 to 10:30) in a 1440 week shows "Sponsor call with" only, time hidden. Opening it works. Evidence: `raka-cal-nextweek-1440.png`.

### 6. minor: "Next up"
On Fri 30 Oct the Upcoming list starts with today's "Council weekly meeting" but the card says "Next up · Sat 7 Nov, Open house tour" (first public event). Code: `featured = upcoming.find(e => e.public) || upcoming[0]`. Evidence: `raka-cal-week-1440.png`.

### 7. minor: typed mention
Typing `@Raka` without choosing from the list posts plain text (no `fl-mention`, no mention notification, only the ordinary comment notice). Enter or Tab picks the first match, so it is easy to avoid, but the help line does not say that picking is required.

### 8. minor: no notice on decision
raka's bell shows nothing after nadia approved his template edit and rejected a submission; the status shows only in My submissions (Approved, Rejected).

### 9. minor: vote race
Double-click on an unvoted idea: count goes 2 to 3 and stays voted after reload (expected net no change). No data corruption (still one vote).

### 10. minor: silent actions
RSVP, vote and Pin idea give no toast; only the control state changes.

### 11. minor: phone admin marker
On a phone, admin Overview shows the title and link list but no "Admin view" badge (only the laptop rail has it).

## Verified working

- **Calendar:** week grid 06:00 to 17:00 labels with events on the right day and time; Carnival night (18:00 to 21:00) and an added 18:30 event are in the all-day row; Canteen survey due marker appears in week of 23 Nov, Carnival due in December month. Week and Month, previous, Today, next. Month boundaries Oct to Nov to Dec to Jan 2027 to Feb, leading and trailing days dimmed, Dec 2026 and Jan 2027 correct (Jan starts Fri 1). Week 28 Dec to 3 Jan crosses the year, label reads "Mon 28 Dec to Sun 3 Jan 2027", next week "Mon 4 Jan 2027 to Sun 10 Jan 2027". Upcoming shows 5, dates read "Fri 30 Oct". Featured card present.
- **Event sheet:** Going 3 and Can't go 1 (seed); Going gives 4 and 0; Can't go gives 3 and 1; second Going click does not double count; names listed ("Going: Alya, Kevin, Michael"); persists on reload; teacher buttons disabled; sheet closes with Esc and URL clears. Share to WhatsApp link text: title, "Fri 30 Oct, 15:30 to 16:30", place, link, encoded.
- **Add, edit, archive:** blank title ("Add a title, then save."), end before start, blank end refused; 200-character title cut to 80; `<b>`, `<script>`, quotes, emoji stored and shown as text; creator sees Edit and Archive and both work; non-creator officer (raka on kevin's event, michael) sees neither; teacher has no Add event; officer has no public switch; vp and president have it; nadia edited a public event and unpublished and republished it.
- **Resources:** Make a copy opens `.../copy` (target `_blank`, `noopener noreferrer`) for Docs, Sheets and Slides; the Drive folder shows Open with the folder URL; Suggest an edit refuses `https://evil.example.com`, `http://docs.google.com`, `docs.google.com.evil.com`, `javascript:`; blank name refused; archive file filed with project; names capped at 80; My submissions statuses Pending, Filed, Approved, Rejected, persist on reload; budi sees no Share, no Suggest, no My submissions; sarah and ariel see Project templates.
- **Comments:** `@Ra` lists Raka, Enter picks, `@Raka` highlighted; mention notification "Michael mentioned you on ..." in raka's bell; a non-picked name offers no list for unknown names; Make task only for michael, not for raka (assignee) or budi (teacher); prefill title from the comment without "@", parent Drinks, assignee Raka; "assigned" notification delivered.
- **Ideas:** pin (140 cap, counter), vote and unvote update counts, persists; teacher read-only (no form, votes disabled); kevin sees Archive and archives; raka sees none.
- **Admin:** kevin and nadia Overview lists 5 missing check-ins (Bryan, Clara, Dimas, Raka, Sarah; matches seed) with Copy reminder (clipboard text names them) and a WhatsApp link with the same text, pending submissions, announcement ending Mon 2 Nov, who has admin (Ariel, Kevin, Nadia). Announcements: blank, end before start (new and edit) refused, audience default is Members only, everyone-audience wording correct, edit and archive work, appears on Home (3 max) and, after publish, on the public site; archived one leaves. Public site: switch, blurb (140 cap, text only), preview, Publish now toast, last published; unpublishing Welcome week removes it from the public page. Approvals: new template appears in Resources, edit approval takes Budget sheet to Version 2 with the new URL, reject works, archive list shows filed files, Add a template refuses non-Google. Phone: Overview link list and the More sheet both reach all 7 admin sections without overflow. raka, sarah and budi get "Not for you" on `#/admin` and every `#/admin/*`.
- **Numbers and dates:** Carnival percent 17% (2 of 12) after the added task, matches Public preview; Workload rows match seed (Alya 2 open, 1 blocked); dates read "Thu 29 Oct" style throughout.
