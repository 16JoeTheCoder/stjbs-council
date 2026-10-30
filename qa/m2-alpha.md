# M2 alpha test (public site, publishing, dashboard)

Method: `npm run demo`, headless Chromium (Playwright), emulator only. Scripts `qa/m2a.cjs` to `qa/m2f.cjs`, screenshots in `qa/screens-m2/`. The old dashboard styling was not judged.

Result: no blockers, no majors, 2 minors.

## Passed
- Public site at 1440 and 390 px: hero "Lead. Serve. Build.", "Explore our work" lands on `#live`, "Join us" on `#join` (How to join), top-bar anchors Events/Projects/About work, red Dashboard goes to `/app/`. No horizontal overflow, no console errors.
- Announcements show only the everyone-audience, active one (ann1); the members-only and expired ones are absent. "What we are working on now" has a live dot and "Last change 3 min ago". Coming up lists only the 2 public events from today.
- Privacy: no member names, emails or initials in the page text or in the feed REST response (json holds titles, counts, blurbs, dates only). Screenshot `pub-d-full.png`.
- Keyboard: Tab order is skip link, brand, nav, Dashboard, hero buttons, announcement, mission arrow, footer link. The announcement sheet opens with Enter, focus stays inside the dialog, Esc closes it and focus returns to the card (`pub-d-sheet.png`).
- Light theme (`council-theme=light`) renders correctly at both widths (`pub-d-light-full.png`, `pub-m-light.png`).
- Old links: `/#/week` -> `/app/#/week`, `/#/p/carnival` -> `/app/#/p/carnival`; `/#live` stays; `/#/` -> `/app/#/`.
- Publishing: raka (officer) ticked a carnival task, feed unchanged. michael ticked another, feed still unchanged (no admin open). kevin (vp) signed in and within 8 s the feed went from 18% (2/11) to 36% (4/11). A fresh context showed 36% "Last change just now" (`pub-after-publish.png`). nadia opening afterwards did not rewrite it (same hash and updatedAt).
- Offline: with the feed blocked and `fetchedAt=0`, the page shows the last copy with "Updated earlier". With no copy, or with a 404, the static parts render without breakage at 390 px (`pub-offline-copy.png`, `pub-offline-nocopy.png`).
- Dashboard as raka at 1280 and 390 px: Home loads, bell shows 1 unread, projects load, ticking a task toggles it, Sign out on the profile page returns to sign-in, signing back in works. `#/admin` as raka shows "Not for you". Signed-out deep link to `/app/#/p/carnival` shows sign-in.

## Minor findings
1. Offline with no copy, the "What we are working on now" and "Coming up" headings still show with filler text ("Our current projects appear here. Check back soon." and "No public events are scheduled yet."). The requirement says static parts without the live section; "No public events" is also untrue during an outage. Repro: block `**/documents/public/feed*`, open `/` in a fresh context. Evidence: `screens-m2/pub-offline-nocopy.png`, `src/site.jsx` `#live` and `#events` sections.
2. On sign out the console shows two aborted Firestore `Write/channel` and `Listen/channel` requests (listener teardown; noise only). Evidence: `m2f.cjs` output.

## Not tested
- The "Publish now" button and Public site admin screen (not in the old UI yet). Only auto-publish was exercised.
