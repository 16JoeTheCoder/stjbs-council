# Upgrade verification and handoff

Implemented in the existing Preact/Vite/Firebase architecture. No production deployment, data migration, billing change, real notification or Google authorization was performed.

## Actual checks

| Check | Final result |
|---|---|
| `npm run check` | Passed: Fiat Lux lint, build and public Firebase-free bundle check |
| `npm run test:models` (also included in `test:upgrade`) | 33 passed: 11 event, 4 meeting, 4 attention, 14 export |
| `npm run test:upgrade` | Passed: models plus 11 independent-client concurrency tests |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test tests/rules.test.mjs tests/bulk-roster.test.mjs` | 72 passed, 0 failed, final run 7.75 seconds |
| Browser full pass plus focused event recheck | 14 journeys passed across the two runs; 34 existing routes/deep links checked |
| Automated axe WCAG A/AA scans | No violations on desktop minutes, phone overview and room display; reduced motion enabled |
| Keyboard/focus/overflow observations | Skip navigation works; typing and focus survive host navigation; no horizontal page overflow at 390/1440/1920 widths |

`npm run test:rules` initially exposed the large action-list validation failure. After replacing whole-list revalidation with strict single-action appends, the same complete inner rules/roster suite was rerun against the already running emulator and all 72 cases passed. No failing test was removed or skipped. Earlier logs and browser results are intermediate evidence; [final results](qa/upgrade/final-results.json) reconcile the focused rerun explicitly.

## Observed journeys

A member published an unrestricted event; the server-confirmed invitee list matched the group union, section narrowing and manual exceptions. A meeting request stayed out of confirmed events until an administrator edited and scheduled the exact revision. An officer explicitly took over as host and operated without president/VP authority. A phone contribution reached the host while the room omitted unconfirmed content. Continuous minutes editing reached a second authorized view while retaining focus. Offline minutes and unsent phone text survived reconnect and host navigation. The assigned minutes taker captured a scoped task. Closing remained separate from review/publication; an editable document downloaded and the print document opened.

These are automated browser observations, not a human usability study. Not every control, theme combination, forced error or unusual network condition was exercised. Core paths were prioritized under the requested lean verification approach.

## Synchronization evidence

Five host phase changes rendered on independently authenticated phone and room browsers in 95–132 ms. Continuous minutes typing first rendered in the second authorized view in 1,931 ms. Across six local samples, maximum and p95 were 1,931 ms. These include browser-action overhead. They prove local emulator application behavior, not production network latency. Offline/background/quota-exhausted operation has no five-second promise. A school-network production smoke test remains required after separately authorized deployment.

## Independent review

GPT-6.1 Sol at medium effort implemented the upgrade. GPT-6.1 Terra at low effort independently reviewed security/concurrency and user-flow/regression/sync behavior. Their reports retain the intermediate findings. Confirmed issues were fixed: approval policy and type-conversion bypasses, owner/admin event scope, private draft/topic access, term/participant reads, atomic handoffs, exact publication records, nested private attendance fields, request resubmission/admin editing, calendar layout/order/error handling, and unsafe default drift. Final implementation checks include the 72-case rules suite and 11-client concurrency suite. No additional broad review round was run after the user's lean-work instruction.

## Configuration and release limits

- Google Docs requires the school's OAuth web client, consent/scopes and authorized origins. The real browser/API boundary and errors are tested with injected responses; actual school-account export was not run. [Exact setup and fallback details](google-meeting-export.md).
- JC/SEC organizational titles must be entered and mapped by an administrator; unknown real titles were not invented. Meeting defaults use roster-backed editable suggestions.
- Bounds: four custom fields, twelve agenda topics, ten captured actions. The complete scoped task review remains available separately. Published attendance stores stable UID/status mappings; displayed/exported names resolve from the authorized roster.
- Sensitive absence reasons, designation notes and follow-up remain in separately authorized records and are omitted from public exports/room data. Editable download is Word-compatible HTML, not a DOCX package. PDF uses the browser print workflow.
- Templates/defaults do not create recurrence. Existing schedules change only through explicit reviewable actions. The offline migration planner is dry-run-only; no production migration ran.

[Operations, cost estimates, deployment order and rollback](meeting-operations.md). [Acceptance checklist](upgrade-checklist.md).

## Representative captures

[Desktop dark](qa/upgrade/meeting-desktop-dark.jpg), [desktop light](qa/upgrade/meeting-desktop-light.jpg), [phone dark](qa/upgrade/meeting-phone-dark.jpg), [phone light](qa/upgrade/meeting-phone-light.jpg), [1920×1080 room display](qa/upgrade/meeting-presentation-dark.jpg).
