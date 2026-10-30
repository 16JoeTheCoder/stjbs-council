# M1 independent rules tests

File: `qa/tests/m1-requirements.test.mjs` (log: `qa/tests/m1-run.log`). Written from `qa/PROMPT.md` and `docs/plan.md` sections 1 and 4 only.

Run (Ubuntu/WSL or VS Code terminal, repo root):
`npx firebase emulators:exec --config qa/firebase.alt.json --only firestore --project demo-council "node --test qa/tests/m1-requirements.test.mjs"`

Result: 84 tests, 72 pass, 0 fail, 12 skipped (items).

## Coverage
Roster roles table (advisor, vp, president, others; create, role, active, self-change, advisor protection, president `hasOnly` shape), settings/current, announcements, events (including `public` and public retitle), rsvps, ideas (arrayUnion/arrayRemove, `[me,me,me]`), docTemplates (URL allow-list, version), submissions (author/admin reads, unfiltered query, status-only update, approval batch), public/feed (get by anyone, no list, whitelist, 200000 limit), cache/{termId}, comments `mentionUids`, teachers read and comment only, term scoping (closed term, cross-term collections).

## Findings

### F1 (not verifiable, 12 skipped tests): item write tests
All `items:` tests (touchedAt, public, publicBlurb, legacy items, child creation) are `test.skip`. The requirements do not give the item document shape. Every shape built from the brief.md data model is refused for every role, including advisor. The same happens against the pre-M1 rules (commit 659a2d4), so this is a gap in my test data, not shown to be an M1 bug. The emulator reports only `evaluation error ... false for 'update'`. These twelve cases still need verifying by someone who knows the real item shape, for example by driving `actions.js` writes.

### F2 (minor, inconsistency, not a requirement breach)
- `submissions.createdAt` and `cache.updatedAt` must be a number (`Date.now()`); `serverTimestamp()` or `Timestamp` is refused. `events`, `ideas`, `announcements` and `docTemplates` accept `serverTimestamp()` for `createdAt`. Expected per PROMPT.md: only "carry `createdAt`", type unstated. Make sure `actions.js` writes numbers for these two.
