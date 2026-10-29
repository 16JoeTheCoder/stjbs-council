# M0 spec-conformance re-check (fix-loop round 1): docs/plan.md revision 2

Checker: independent re-check against `qa/PROMPT.md`. Baseline: `qa/m0-spec-conformance.md` (F1 to F17, revision 1). Owner decisions Q1 to Q6 (plan section 1) are treated as declared deviations. No project file was edited.

## (a) Status of F1 to F17

| ID | Sev | Status | Evidence (revision 2) |
|---|---|---|---|
| F1 | major | RESOLVED | Section 3 `design/builtbyjosef/`: "delete ... In M3, after a grep shows no `jy-` class left". Section 9 M3: "a mechanical `jy-` to `fl-` pass over every remaining route so nothing is unstyled; then delete builtbyjosef". M4 adds "full restyle of the remaining routes". |
| F2 | major | RESOLVED | Section 6.5 "What": projects `title, stage, pct, done, total, blurb, updatedAt`; events `title, type, date, start, end, location`; announcements `title, body, startDate, endDate`; filters (public, not archived, `date >= today`, audience everyone, `endDate >= today`). "There are no names, emails, initials, comments, check-ins, task titles or uids." Matches the prompt's three whitelists. |
| F3 | major | RESOLVED | Section 6.5 "When": admin sessions only, "on open and then on a 10-minute interval. It skips unless ... `loaded()` is true and `S.error` is empty". "Write": write only "If the hash differs from `public/feed.hash`"; extra guards for server-origin snapshots. |
| F4 | major | RESOLVED | Section 7: rail with photo card; bell "red dot plus count"; avatar menu (My profile, Settings, Switch to admin view, Sign out); phone tab bar five tiles and More sheet; admin badge, rail, `council-view` in `localStorage`; phone link list on Overview; Overview needs-attention items incl. "Copy reminder"; Public site screen with switches, preview card, "Publish now", "Last published". |
| F5 | major | RESOLVED | Section 6.3: optional listeners "record their own error in `S.fail[key]` ... never part of `loaded()` and never set `S.error`"; core listeners enumerated. |
| F6 | major | RESOLVED | Section 8: full Home composition for laptop and phone, mission card ("three messages, arrow cycles, dots, no auto-rotation", hidden by DESIGN.md rule 4), "Length budget: no stat rows, lists capped at 5, ... about 1.5 laptop screens and 5 phone screens". Matches DESIGN.md Home order lines 61-62. |
| F7 | minor | RESOLVED | Section 4 members row: VP "may change `active` (today's ban is removed, F7)"; section 3 `admin.jsx`: "Close term (advisor only)". |
| F8 | minor | RESOLVED | Section 4 events and items rows: if `public == true`, title and location changes need isAdmin (L1-11); section 6.5 "Text admins do not review". Stronger than the prompt, but defensible. |
| F9 | minor | RESOLVED | Section 2 item 17 declares the removal of the Projects activity sidebar and lazy activity; section 6.2 "Activity loads only on `#/activity`". |
| F10 | minor | RESOLVED | Q3 and section 3 `store.js`: "Sign-out helper (Q3)"; automatic no-roster sign-out does not clear or reload. |
| F11 | minor | RESOLVED | Section 3 `src/main.jsx` and `src/site.jsx`: both import `tokens.css`, `components.css`, `app.css`; `app/index.html` loads `main.jsx`. |
| F12 | minor | RESOLVED | Section 2 item 18 states `docs/qa/*.md` are the historical audit trail and `design-check.sh` scans `src app index.html public`. Stated as the exception to "every trace". |
| F13 | minor | RESOLVED | Section 2 item 14: "Today's manifest has no `id` ... `"id": "/"` therefore keeps the same identity". |
| F14 | minor | PARTIAL | Fixed: archive path (`archived is bool`), `termOk` and immutable `termId`/`createdByUid`/`createdAt`, `active()` on every write, items create with `public: false` allowed, feed `hash is string`, positive tests listed. Left: submissions update is `hasOnly(['status','updatedAt'])`; the prompt says "only `status`" (harmless widening, not acknowledged). |
| F15 | minor | RESOLVED | Section 9: "today 1 629 lines ... realistic estimate ... about 3 600 to 4 000. If it runs over 3 500, polish goes first ... Then I report the real count." Honest and ordered cut list. |
| F16 | minor | RESOLVED | Section 6.4: rule `get()` calls 1 500, admin submissions 120, write amplification 4 000 added; total recomputed. Arithmetic re-verified: cold open 30+26+52+50+3+26+20+1 = 208 (plan "about 210"); 210 x 3 x 30 = 18 900; sum of daily lines = 27 520 (plan "about 27 500"). Section 10 no longer cites a "20 access call" figure wrongly. |
| F17 | minor | PARTIAL | Fixed: preview.html inline styles (`app.css` row), "Updated earlier" (`site.jsx` row), commits and push per milestone (section 9), README console sentence (`README.md` row), `docs/plan.md` row. Still absent: build-warning gate (Q1), no cross-collection counts (B8), emulator REST URL for `VITE_EMULATORS === '1'`, announcement audience label, screenshot sizes and themes. See F20 to F23. |

Tally: RESOLVED 15, PARTIAL 2, OPEN 0.

## (b) New findings (revision 2)

No blockers. No majors. Revision 2 is conformant on every Keep, Delete, Architecture, Roles, Navigation and Screens line I rechecked; the new snapshot design (Q5) is an owner-approved declared deviation. The remaining issues are minors.

**F18. minor. Plan section 4 (`google(u)`): URL rule stricter than the prompt, not declared.**
- Expected (PROMPT data-model table): `url` "must start with `https://docs.google.com/` or `https://drive.google.com/`".
- Actual: docs links must match `/(document|spreadsheets|presentation|forms)/d/ID`; drive links only `file/d/`, `drive/folders/` or `open?`. Valid Google links such as `drive.google.com/drive/u/0/folders/ID`, `docs.google.com/document/u/0/d/ID` or `drive.google.com/folderview?id=` would be refused on templates and submissions. Section 2 item 3 discusses only "Make a copy".
- Evidence: plan section 4 line 115. The hardening (rejecting `docs.google.com.evil.com`) is sound; the narrowing should be declared, and the `/u/N/` forms allowed.

**F19. minor. Plan section 6.2 (snapshot rebuild): bootstrap trigger is undefined.**
- Expected: the read-budget fix works from the first deploy.
- Actual: rebuild runs "when the delta holds more than 50 items or the snapshot is over 24 h old". When no snapshot exists (first deploy, new term) neither condition is defined, and `at` ("maximum server `touchedAt` in the store") is undefined while no item has `touchedAt`, yet the rule needs `at is timestamp`. The app would stay on the full listener (about 590 reads) indefinitely.
- Evidence: plan lines 189-196, rule row `cache/{termId}`. Fix: state "no snapshot: admin writes one, `at` = write time minus margin or request time".

**F20. minor. Plan sections 6.4 and 6.2: delta read cost assumed at 25 per open.**
- Expected: arithmetic that matches the stated rebuild rule.
- Actual: the rebuild only fires above 50 changed items, so a delta can legitimately be up to about 50 per open (about 4 500 a day at 90 opens, not 2 250). Total stays under 50 000 but "about 27 500" is optimistic; also the 3 opens a day figure is still a guess (disclosed).
- Evidence: plan lines 195, 207-212.

**F21. minor. Plan sections 3 and 9: quality-gate details not planned (carry-over of F17).**
- Expected (PROMPT gates 1 and 4): `npm run build` has no warnings beyond the Firestore chunk note; screenshots at 1440 x 900 and 390 x 844 dark, light for Home, sign-in and public site, every member and admin screen.
- Actual: neither the build-warning gate nor the size and theme matrix appear; only JPEG quality and count (section 2 item 12).
- Evidence: grep of plan for "warning" matches only the snapshot size warning (line 273).

**F22. minor. Plan section 3 `site.jsx`: emulator branch of the feed URL missing.**
- Expected (PROMPT Architecture): when `VITE_EMULATORS === '1'` use `http://127.0.0.1:8080/v1/projects/demo-council/...` so the demo shows the live section.
- Actual: row mentions "REST fetch with `?key=VITE_FB_API_KEY`" only; the emulator URL (and that the key is not needed there) is unstated.
- Evidence: plan line 65.

**F23. minor. Small feature lines the plan does not name (carry-over of M6, M18, M19, B8).**
- Announcements: "newest first, max 3 on a page" and the picker labels "Everyone (also shown on the public website)" / "Members only" (PROMPT data-model table) are not stated; `shared.jsx` says only "0, 1 or 2 to 3 forms".
- Share to WhatsApp: events (calendar) and check-in reminder (Overview) are named; sharing a task is not.
- Mission card: the three message texts are not listed (DESIGN.md has them, so low risk).
- Read-budget rule "no feature may need a count across a collection that is not already loaded" (for example comment counts) is not stated.
- "Publish now": the plan says it "ignores the hash", but not whether it also honours the section 6.5 skip guards. It should (dead listeners must never publish).

## Notes for the owner (not findings)

- The persistent cache (Q3) is now justified by the before-figure (56 000) while the after-figure is 27 500, under the prompt's 30 000 trigger. This is an approved deviation; the plan says so honestly in section 6.4.
- Plan hardening beyond the prompt that is acknowledged and consistent: admin-only title edits on public items, `get`-only feed read, `mentionUids` list, `event exists` check on RSVPs.
