# Gate 2: design and accessibility check

Checked on 2026-10-26 (app clock 2026-10-27 Asia/Jakarta), Chromium via Playwright. Scratch scripts and screenshots are in `/tmp/claude-0/gate2/`.

## Commands and scripts run

- `bash scripts/jy-check.sh`: pass ("ok builtbyjosef check clean").
- `npx firebase emulators:start --only auth,firestore --project demo-council`: pass ("All emulators ready").
- `node scripts/seed-emulator.mjs`: pass.
- `npx vite --mode emulator --port 5173 --host 127.0.0.1`: pass.
- `sweep.cjs` (every route, both themes, 390 and 1280 px, raka/nadia/ariel/michael, 84 views; computed-style audit plus full-page screenshots): ran. Weights only 300/400/500/700: pass. Families only Space Grotesk and JetBrains Mono: fail (G2-14). Durations only 140/240/400 ms, no loops: pass. At most one orange point at rest: pass on every route at rest (see G2-11 for the form-open state). Orange area at most 1.99 %: pass. No horizontal page scroll at 390: pass. One h1 per route: pass. Unlabelled controls: none. Unnamed progress bars: none. Text contrast: pass except disabled buttons (G2-23). Marks: progress track fails (G2-13).
- `misc.cjs` (login, Create account and Reset password modes, error state; About lockup per theme; theme persists across reload; signature only on About): ran. Lockup swaps on toggle and the theme survives a reload: pass. No signature on other routes: pass. Error wiring: fail (G2-06).
- `kb.cjs`, `kb2.cjs`, `kb3.cjs` (keyboard only: sign in, skip link, check-in, tick a task, Hide done, comments, Show all, Update task, theme toggle, bell, tab order, focus obscured, reduced motion, long title as nadia at 390 and 320): ran. Sign-in, check-in, skip link, Show all, theme and bell work by keyboard. Fails: G2-01, G2-02, G2-03, G2-21.
- `reflow.cjs` (320 px and 1280 px at 200 % zoom, 640 CSS px, 13 routes): no horizontal scroll: pass. Functions lost: fail (G2-04).
- `chart.cjs` (seeded two extra `stats` snapshots in the emulator so the Workload chart renders): fail (G2-09).
- `cbx.cjs` (native checkbox border sampled from pixels): pass (4.8:1 dark, 4.5:1 light).
- `npx vite build --mode emulator --outDir /tmp/claude-0/gate2/dist` and `npx vite preview --mode emulator --port 4173`: pass. `document.fonts`: Space Grotesk 300/400/500/700 and JetBrains Mono 400/500 load (Mono 700 is never used). CDP `Page.getAppManifest`: no errors. `getInstallabilityErrors`: none. Icons 192/512/maskable 512/180 are served with the right pixel sizes; the maskable content sits inside the safe zone.
- All background processes were stopped at the end (vite on 5173 and 4173, the Firestore and Auth emulators). The emulator appended to `firestore-debug.log` in the repo root, which already existed.

## Findings

### G2-01 · blocker · Focus and scroll jump to the h1 whenever the headline's live data changes
- Location: `src/ui.jsx:43` (`Title` effect with deps `[title, light, bold]`). Headlines built from live data: `src/routes/my-week.jsx:18` (open-task count), `src/routes/projects.jsx:47` (percentage done), `projects.jsx:15`, `people.jsx:30`. All viewports and both themes.
- What is wrong: on My week (raka and michael, 390 px), ticking a "Due this week" checkbox with Space moves focus from the checkbox to the h1 and sets `scrollY` from 400 to 0. Measured: same h1 node, no remount, `activeElement` becomes H1. On `#/p/drinks` with Hide done on, ticking a task does the same. Any snapshot from another member that changes the count or percentage has the same effect, so focus can also be pulled out of a comment or task form while the user is typing. Unverified: a remote change was not simulated, but it follows from the same effect deps.
- Expected: focus moves to the h1 only on a route change. After a tick, focus stays on the checkbox, or on the next row if the row disappears.
- Root cause: the focus effect is keyed on headline text rather than on the route. Key it on the route, for example run it once per mount, since the page already remounts per route.

### G2-02 · major · Focus is lost to `<body>` when a button is swapped for a form, and after posting
- Location: `src/ui.jsx:144` (Add comment), `ui.jsx:145` (Post comment), `src/routes/projects.jsx:16` (New project), `projects.jsx:59-61` (Add task, Add subteam, Edit), `projects.jsx:113` (Update task), `src/routes/meeting.jsx:39` (lane Add task), `src/routes/admin.jsx:96-97` (Add member).
- What is wrong: measured with `document.activeElement === BODY` after Enter on Add comment, after Post comment, after Update task, and after Add task (nadia, `#/p/drinks`). The trigger is removed, the new form gets no focus, and nothing is announced. "Add comment" has `aria-expanded="false"` but never reaches `true`, because the button is destroyed instead.
- Expected: focus moves to the first field of the opened form. Cancel or Save returns focus to the trigger. After posting, focus stays in the comment field.
- Root cause: conditional rendering replaces the trigger, and nothing manages focus.

### G2-03 · major · Focused controls end up hidden under the fixed tab bar and the sticky header (WCAG 2.4.11)
- Location: `src/app.css:16` (sticky header, about 61 px), `app.css:28` (fixed tab bar, 72 px). There is no `scroll-padding` on `html`. 390 px, both themes.
- What is wrong: tabbing forward on `#/checkin`, "Submit check-in" and "Cancel" are focused while fully behind the tab bar. On `#/p/carnival`, 9 of 60 forward Tab stops land under the tab bar (Food and Stage cards, checkboxes, task links). 4 of 40 Shift+Tab stops land under the header (Sponsors card, Drinks card, task link).
- Expected: a focused element is never covered. Add `html { scroll-padding-top: <header height>; scroll-padding-bottom: calc(72px + env(safe-area-inset-bottom)); }`.

### G2-04 · major · Workload, Admin and Templates cannot be reached below 900 px, which includes 200 % zoom on a laptop (WCAG 1.4.10)
- Location: `src/app.jsx:209` (the extra links render only in `.jy-topnav`), `src/app.css:19` and `app.css:37` (the top nav shows only at 900 px and wider).
- What is wrong: measured at 320 px and at 1280 px with 200 % zoom (640 CSS px), signed in as nadia, across 13 routes. No visible link to `#/workload` or `#/admin` exists anywhere. `#/templates` appears only as "Start from template" on Projects, and `#/digest` only on the meeting view. A president on a phone, or anyone zoomed in, cannot open Workload or Admin.
- Expected: the same functions are reachable at every width. For example, add a "More" entry or list the role links on the profile page.

### G2-05 · major · Touch targets under 44 × 44 px on core controls
- Location and measurements:
  - Task title links: 24 px tall on every task list (`src/app.css:119`, `.jy-task__title`). This is the main tap target on My week, project pages, the meeting view, People and person pages.
  - Small buttons: 32 px tall (`design/builtbyjosef/bundle.css:20`, `.jy-btn--s`). Affects Mark as read (110×32), the lane Add task (304×32), Done adding, Open task and Open template.
  - Brand link: 26 px tall (`app.css:17`).
  - Check-in Cancel link: 49×24 (`meeting.jsx:31`).
  - Lane heading links: 23 px (`meeting.jsx:87`).
  - Timeline row names: 24 px (`app.css:156`).
  - Team chart headings: 24 px (`views.jsx:61`).
  - Deal and Workload table links: 17 px (`projects.jsx:83`, `workload.jsx:68`).
  - "Cards" view link: 41 px wide.
- What is wrong: DESIGN.md and the brief require 44 px. Inline links inside sentences were excluded from this list.
- Expected: min-height 44 px, either on the link or by making the whole row or cell the hit area. The design system's own `.jy-btn--s` breaks the rule. Flag it upstream, or do not use it in the app.

### G2-06 · major · Form errors are attached to the wrong field or to none, and invalid fields are not flagged
- Location: `src/routes/auth.jsx:48-54`, `src/routes/projects.jsx:183`, `src/routes/admin.jsx:34-35`.
- What is wrong:
  - On sign-in with an invalid email, "That email address is not valid. Use your school email." shows under the password field. The password gets the red error border, and only the password has `aria-describedby="auth-error"`. The email input has neither. Measured: `email:null`, `password:auth-error`.
  - In Reset password mode the password field is gone, so the error is tied to nothing.
  - ItemForm errors ("Add a title, then save.", "The link must start with http:// or https://.") are tied to no input.
  - In MemberForm, "Add a name, then save." is tied only to the email field.
  - No field ever gets `aria-invalid`.
- Expected: each error is tied with `aria-describedby` to the field it is about, that field gets `aria-invalid="true"` and the `jy-field--error` style, and focus moves to it.

### G2-07 · major · Timeline dates are only available on hover
- Location: `src/routes/views.jsx:40-41`.
- What is wrong: each bar is an `<i>` that carries its start and due dates only in a `title` attribute. Measured: `title: '2026-10-26 to 2026-11-30'`, no role, no aria-label. The axis is `aria-hidden`. Screen-reader and keyboard users get a list of names with no schedule, and touch users get nothing.
- Expected: dates are available as text, for example visually hidden text in the row ("2026-10-26 to 2026-11-30") or a visible mono date.

### G2-08 · major · Timeline bars for overdue tasks spill into the name column
- Location: `src/routes/views.jsx:25-26` and `views.jsx:35`. `#/p/carnival?view=timeline`, both viewports.
- What is wrong: the axis start `from` is derived from start dates only, but a bar starts at the due date when that comes first. Overdue tasks get a negative left offset. Measured: "Order 400 cups" `left: -4.76%` (bar at x = 261 px, track at x = 304 px) and "Sound system quote" `left: -2.38%`. The bars draw over the label column (visible in `shots/raka_-p-carnival-view-timeline_390_dark.png`). These overdue tasks are exactly the ones a meeting needs to see.
- Expected: `from` includes every plotted start (`s`), or bars are clamped to the track.

### G2-09 · major · Workload chart text renders at 5.6 px on a phone
- Location: `src/routes/workload.jsx:29-30` (an SVG with `viewBox` 600 wide and `width="100%"`), `bundle.css:84` (12 px in viewBox units). The `<figure>` keeps the UA's 40 px side margins.
- What is wrong: measured at 390 px dark, the scale is 0.46, so the axis labels, the week ids and the "Open" series label render at 5.6 px, against a 12 px minimum on screen. At 1280 px the same text renders at 21 px and the line at 3.5 px.
- Expected: text stays between 12 px and about 13 px at every width. Use a fixed pixel height, or render the labels in HTML. Reset the figure margin.

### G2-10 · major · Undo toast disappears after 10 s and sits last in the tab order (WCAG 2.2.1)
- Location: `src/store.js:23` (10 000 ms timer), `src/actions.js:113` (Archive with Undo), `src/app.jsx:219` (the toast is the last element in the DOM).
- What is wrong: after Archive, the route changes and focus goes to the new h1. A keyboard user must tab through the whole page, past the tab bar, to reach Undo before it vanishes. Nothing pauses the timer on focus or hover. Partly unverified: verified from code, the archive flow was not run.
- Expected: the undo toast stays until it is dismissed, or the timer pauses while the toast has focus. Better, move focus to Undo, or offer undo from the parent page.

### G2-11 · major · Two orange points when an add or edit form is open on a project page
- Location: `src/routes/projects.jsx:49` (the Done stat's orange cap) and `projects.jsx:185` (the `jy-btn` primary button, whose `::before` is an orange cap; `bundle.css:10`).
- What is wrong: at rest, project pages show only the Done cap (measured). Opening Add task, Add subteam or Edit project adds the "Add task", "Add subteam" or "Save changes" button with its own orange cap, which makes two orange points in one view. Unverified by measurement: read from code, because the form-open state was not swept.
- Expected: one orange point. Use the ghost form for the form's submit button on pages that already carry the Done cap, or drop the cap while the form is open.

### G2-12 · minor · The meeting view has no orange point and no accent "Add task"
- Location: `src/routes/meeting.jsx:39`. `#/meeting/carnival` as nadia.
- What is wrong: the brief's approved mock-up names `Add task` in the meeting view as that screen's orange point. Measured: 0 orange elements at rest. Every lane shows a ghost small button (304×32), and the accent appears only inside an opened form.
- Expected: one accent `Add task` per view, for example on the first lane or in the header, with the others ghost.

### G2-13 · minor · Progress bar track is nearly invisible
- Location: `src/app.css:88` (`.jy-bar` track `--line`).
- What is wrong: measured track-to-surface contrast is 1.29:1 in dark and 1.48:1 in light. A 0 % bar, and the length of any bar, cannot be judged. The fill against the track passes. The adjacent "x of y tasks" text keeps the information, so this is not a blocker.
- Expected: track border or fill at 3:1, for example `--line-strong` at 1 px, or give the track a hairline outline.

### G2-14 · minor · Digest preview uses the browser's generic monospace
- Location: `src/routes/digest.jsx:41` (`<pre class="jy-well jy-pre jy-digest">`). `.jy-digest` has no rule.
- What is wrong: measured computed `font-family: monospace` at 15 px. This is neither Space Grotesk nor JetBrains Mono, so it renders in DejaVu or Courier depending on the OS.
- Expected: `font-family: var(--font-mono)` (or sans) on the preview.

### G2-15 · minor · A third radius (2 px) and circles appear on project pages
- Location: `design/builtbyjosef/bundle.css:60` (`.jy-stat::before` uses `--radius-xs`, 2 px), `bundle.css:51` (badge ok dot, 50 %).
- What is wrong: project pages measure 10 px, 4 px and 2 px radii. The 2 px comes from the system's own stat component. The 50 % badge circle is the status shape, so it is acceptable.
- Expected: override the stat cap to 4 px in `app.css`, or record the system exception.

### G2-16 · minor · "Hide done" toggle announces the opposite of its state
- Location: `src/ui.jsx:102`.
- What is wrong: when pressed, the label changes to "Show done (1)" and `aria-pressed="true"` (measured). A screen reader hears "Show done, pressed", which reads as "done tasks are shown".
- Expected: either a stable label ("Hide done") with `aria-pressed`, or a label that changes with no `aria-pressed`.

### G2-17 · minor · Ticking a task gives no announcement
- Location: `src/actions.js:57` (`toggleDone` passes no toast message to `run`).
- What is wrong: a MutationObserver on the live region recorded no toast after a tick (it did record "Check-in saved."). Screen-reader users get no confirmation. Combined with G2-01, they also lose their place.
- Expected: a short live message, for example `Done: "Order 400 cups".`, with Undo.

### G2-18 · minor · Header slides under the iOS status bar in standalone mode
- Location: `index.html:14` (`black-translucent`) together with `index.html:5` (`viewport-fit=cover`), and `src/app.css:16` (the header has no `env(safe-area-inset-top)` padding).
- What is wrong: with a translucent status bar, page content starts at y = 0, so the brand, the bell and the theme toggle sit under the clock and the notch. Unverified: there is no iOS device here; the conclusion is from the code. The bottom tab bar does handle `safe-area-inset-bottom`.
- Expected: `padding-top: calc(var(--space-2) + env(safe-area-inset-top))` on `.jy-header`, or the `default` status bar style.

### G2-19 · minor · The current breadcrumb is not marked
- Location: `src/routes/projects.jsx:30`.
- What is wrong: the last crumb is a plain span with no `aria-current="page"` (measured from the outerHTML). At 390 px, the 44 px inline-flex crumb links also wrap the current title onto a widely spaced second line (`shots/raka_-p-t0_390_light.png`).
- Expected: `aria-current="page"` on the last crumb, and a normal line height for the wrapped text.

### G2-20 · minor · Feed document title breaks the pattern
- Location: `src/routes/feed.jsx:16` (no `title` prop).
- What is wrong: measured `document.title` is "What changed. Feed · Council". Every other route gives a short name ("Projects · Council", "Digest · Council").
- Expected: "Feed · Council".

### G2-21 · minor · Reduced motion still shifts mine cards on hover
- Location: `src/app.css:125` (`.jy-card.is-mine:hover { transform: translate(-2px,-2px) }`). The reduced-motion block in `bundle.css:96` neutralises only `.jy-btn` and `.jy-panel--link`.
- What is wrong: with `reducedMotion: 'reduce'`, all durations are 0 (pass), but the hover transform is still `matrix(1,0,0,1,-2,-2)` (measured), so the card jumps.
- Expected: add `.jy-card:hover { transform: none }` inside a `prefers-reduced-motion` block.

### G2-22 · minor · Buttons that are not verb-first
- Location: `src/ui.jsx:103` ("People and teams"), `src/routes/meeting.jsx:54` ("Done adding").
- Expected: "Filter by person or team" and "Close form" (or "Stop adding").

### G2-23 · minor · Disabled buttons are barely visible (exempt from WCAG, noted)
- Location: `bundle.css:22` (`opacity: .4`). `#/admin` as ariel, "Close term and start the new one".
- What is wrong: measured text contrast is 2.62:1 in light and 3.52:1 in dark, and the border is 1.59:1 in light and 1.73:1 in dark. The disabled Post comment and Save template buttons look the same. The locked state is explained only by the help text under the field.
- Expected: no change is required. Consider leaving the button enabled and explaining why when it is pressed, or using a clearer disabled style at about 3:1.

Not reported because they passed when measured: weights; motion durations and loops; orange count and area at rest; text, placeholder (5.6:1 or higher), badge-shape, tag, filter-chip, checkbox and focus-ring contrast (orange 2 px ring in dark, ink in light); no horizontal scroll at 390 and 320 px or at 200 % zoom; long titles wrap at 320 px; lang, landmarks, one h1 per route, labelled icon buttons, bell count in the accessible name, aria-current on the top nav and tab bar, `aria-expanded` on Show all; theme toggle persists; signature only on About and swapping per theme; fonts load in the production build; manifest, icons and iOS meta tags; loading uses step counters.

## Resolution (builder, after the report)

Fixed and re-verified with `/tmp/claude-0/verify2.cjs` and `verify3.cjs` (390 px, nadia and raka): G2-01 (after ticking with Space, focus stays on the checkbox and a live toast announces it), G2-02 (focus moves into the comment, task and member forms, stays in the comment field after posting, and returns to the trigger on Cancel), G2-03 (60 forward Tab stops on `#/p/carnival`: none covered except the skip link by design), G2-04 (the profile page lists Workload, Templates, Admin and Digest at every width), G2-05 (task titles, crumbs and brand 44 px; `jy-btn--s` raised to 44 px; lane, team-chart, timeline and table links 44 px), G2-06 (email and title errors carry `aria-invalid`, `aria-describedby` and focus), G2-07 (timeline dates as text), G2-08 (smallest bar offset 12 %, none negative), G2-09 (chart drawn at 600 px inside a scroll box, margin reset), G2-10 (undo toast stays until Undo or Dismiss; verified after 12 s), G2-11 (one orange point with the form open), G2-12 (one accent Add task in the meeting view). Minors fixed: G2-13, G2-14, G2-15 (stat cap 4 px), G2-16, G2-17, G2-18, G2-19, G2-20, G2-21, G2-22. Left open with reasons in `known-issues.md`: G2-15 (badge circle), G2-23.
