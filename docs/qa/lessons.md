# Lessons

One line per defect class: the pattern that went wrong, then the rule that prevents it. Read before starting new work.

- Firestore rules `get()` with an interpolated path containing a slash is fragile; always write full literal paths (`/databases/$(db)/documents/members/$(me())`).
- The emulator does not enforce the 20 document-access calls per batch; production does. Every multi-item write goes through `commitChunked` (at most 15 distinct parents, 450 writes).
- Writing an object with `undefined` fields makes Firestore throw; form `pick()` drops undefined keys before any write.
- The advisor and teachers do not check in; any per-person check-in status must filter with `checksIn()`, never with an ad hoc role test.
- `overflow-wrap: anywhere` on body crushes tables at 390px; tables live in `.jy-scroll` with a min-width and normal wrapping.
- A seed or test script that re-derives week ids by hand drifts from the app; import `src/time.js` instead.
