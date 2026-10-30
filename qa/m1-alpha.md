# M1 alpha test (roster, sign-in, item writes)

Run: 30 Oct 2026, headless Chromium (Playwright) against `npm run demo` (emulator only). Scripts: `qa/m1*.cjs`. Screenshots: `qa/screens-m1/`.
Verdict: **no blockers, no majors.** Every allowed action saved and survived a reload; every forbidden action was either not offered or failed with a message.

## Findings

### Minor 1: permission error says "check your connection"
- Steps: sign in as nadia, #/admin, Add member, email `ariel@stjbs.sch.id` (or `kevin@`, `clara@`), role Teacher, Save member.
- Expected: a message saying the president may not change this member.
- Actual: toast "That did not save (permission-denied). Check your connection and try again." The form stays open. Same text for kevin adding `ariel@`. The write was correctly refused (rows unchanged after reload).
- Evidence: `screens-m1/33-nadia-denied.png`.
- Note: "Add member" accepts an existing email, so it is an edit path. For nadia it is denied (good); for kevin/ariel it silently overwrites that member (name, role).

### Minor 2: deactivated member sees "not on the roster"
- Steps: ariel deactivates bryan; sign in as bryan.
- Expected: a message that the account is deactivated.
- Actual: sign-in is blocked (correct), but the banner reads "Your email isn't on the council roster. Ask the president to add it." (misleading; the president cannot reactivate).
- Evidence: `screens-m1/22-bryan-blocked.png`.

### Minor 3: roster actions hidden off-screen at 390 px
- Steps: kevin, 390 px wide, #/admin.
- Expected: Edit and Deactivate visible or an obvious scroll cue.
- Actual: only Name, Email and Role show; Section, Reports to, Status and the actions column need a sideways scroll with no cue. No page-level overflow. Edit worked once reached.
- Evidence: `screens-m1/62-m-roster.png`.

### Minor 4: no toast on "Save changes" for a task
- Steps: michael, task in Drinks, Update task, change title, Save changes.
- Actual: saved (verified after reload) but no confirmation toast; other writes toast.

## Results against scope

### 1. Sign-in
| Check | Result |
|---|---|
| Wrong password | "Email or password is wrong. Check both, or reset your password." Only console noise is the expected 400. |
| Sign in / out | Works for all 7 roles tried. |
| Signed-out visit to #/admin | Shows the sign-in page, no roster data. |

### 2. Roster (screenshots `10-roster-*.png`, `20-*` to `34-*`)
| Role | Checked | Result |
|---|---|---|
| ariel | Add member with every role including Advisor (zed saved, shown after reload); edit bryan role and reports-to (saved); deactivate and reactivate bryan (saved); own role select disabled; no Deactivate on own row | pass |
| kevin | Role list has no Advisor; added a treasurer; changed raka to secretary (saved); own role disabled and no Deactivate on own row; ariel row has no buttons; can edit or deactivate nadia (intended) | pass |
| nadia | Add roles only Officer, Treasurer, Secretary, Teacher; added teacher; edited clara section and reports-to (saved after reload); role select disabled; no Deactivate buttons; ariel row has no buttons; edited own name | pass |
| sarah, raka, budi | No Admin link; direct #/admin shows "Not for you." | pass |
| Person list and Reports-to | Names shown in the table and in the Reports-to select after saves | pass |
| Deactivated member | bryan could not sign in (see Minor 2); reactivation restored access | pass |
| New member sign-up | zed/hiro "Create account" accepted and reached the verify-email step (verification link not testable) | pass |

### 3. Item writes
Pass, no "That did not save" toast, no console errors:
- michael unticks and re-ticks "Price list for drinks stall" (reload confirms both states).
- michael adds a task in Drinks (plain, and with dates, two assignees, notes with HTML characters, link). Notes render as text.
- michael renames a task, archives it, uses Undo (restored).
- nadia creates the project "QA Sports Day", archives it, uses Undo.
- alya (assignee) ticks the task done.

### 4. 390 px
Sign-in, wrong password, roster (edit, add), week tick/untick, add task, archive and Undo all work. No horizontal page overflow on roster, week or Drinks.

### Console and network
Only expected noise: HTTP 400 on wrong password and aborted Firestore Listen/Write channels on page change.

## Process note (not a product bug)
Another checker's `pkill -f "firebase emulators"` / `vite` stopped my demo twice mid-run and left an orphan Firestore on 8080 ("port taken"). Running checkers in parallel against the single demo is unreliable; the state was reseeded each time. Findings above come from runs on a clean seed.
