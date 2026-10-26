# Lessons

One line per defect class: the pattern that went wrong, then the rule that prevents it. Read before starting new work.

- Firestore rules `get()` with an interpolated path containing a slash is fragile; always write full literal paths (`/databases/$(db)/documents/members/$(me())`).
- The emulator does not enforce the 20 document-access calls per batch; production does. Every multi-item write goes through `commitChunked` (at most 15 distinct parents, 450 writes).
- Writing an object with `undefined` fields makes Firestore throw; form `pick()` drops undefined keys before any write.
- The advisor and teachers do not check in; any per-person check-in status must filter with `checksIn()`, never with an ad hoc role test.
- `overflow-wrap: anywhere` on body crushes tables at 390px; tables live in `.jy-scroll` with a min-width and normal wrapping.
- A seed or test script that re-derives week ids by hand drifts from the app; import `src/time.js` instead.
- A rule that accepts "I am in the new document's leadUids" lets anyone self-appoint; create rights come only from the parent's state (`parentAfter`), never from fields the writer supplies.
- Forms that copy store data into state at mount start empty after a reload; the app renders routes only after `loaded()` (items, check-ins, members) is true.
- Week-scoped listeners captured at start go stale at Monday 00:00 in an open PWA; anything keyed by week restarts when `week().id` changes.
- Derived timestamps (`completedAt`) change only on a real transition, never because a form re-sent an unchanged field.
- Optional dates in settings (`startWeekId`) must be derivable from what the README bootstrap creates; derive, do not require.
- Totals are counted over distinct entities, never by summing per-person counts.
- Destructive actions (archive) confirm with the blast radius and offer undo.
- Rules validate enums and number ranges, not only who writes.
- Every listener, including single-document ones, has an error callback.
- Absolutely positioned helpers (`.jy-sr`) escape non-positioned scroll boxes; `.jy-scroll` is `position: relative`.
- Every write path goes through an awaited try/catch so synchronous SDK throws reach `fail()`.
