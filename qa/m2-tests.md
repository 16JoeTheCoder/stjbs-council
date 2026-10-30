# M2 independent tests (qa/tests/m2-feed.test.mjs)

Run: `node --test qa/tests/m2-feed.test.mjs` (any terminal, repo root; the build test runs `npx vite build` itself, about 1 s).

Result: 20 tests, 20 pass, 0 fail. The tests were written from qa/PROMPT.md and docs/plan.md 6.5 and `src/feed.js` signatures only; publish.js, store.js and site.jsx were not read first.

Covered:
- Whitelist: a project, event and announcement stuffed with names, emails, notes, uid, assigneeUids, createdByUid, leadUids and a task title. No value and no extra key survives; exact key sets asserted per type.
- Filters: events public, not archived, today or later (missing `public` excluded), sorted date then start; announcements everyone only, `endDate >= today`, future starts kept, archived out.
- Public re-filter (`feedToday`): expired events and announcements vanish, a future announcement appears on its start day, missing arrays tolerated.
- `activeAnnouncements`: inclusive window, archived out, newest first, max 3, createdAt tie-break, input not mutated.
- Jakarta: 23:30 UTC on 30 Oct is 31 Oct in Jakarta (default day); 16:59 UTC vs 17:00 UTC boundary.
- `hash`: deterministic, FNV-1a reference values, sensitive to change, ignores non-whitelisted input.
- `ago`: just now, minutes, hours, dated wording, every future timestamp reads "just now".
- `dateRange` including a year boundary.
- Build: dist/index.html and dist/app/index.html exist; manifest id "/", scope "/app/", start_url "/app/#/week", theme #0A0A0C; public page has no manifest link, has the location.replace redirect; every script reachable from the public page (including static imports) contains no "firebase" at all; the dashboard bundle does (sanity check on the scan).

Real failures: none.

Not covered here: the REST fetch and localStorage fallback in site.jsx (needs a browser), the publish write path (needs the emulator).
