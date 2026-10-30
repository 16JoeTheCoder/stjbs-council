# Backlog

Minor findings and notes for Josef, not fixed immediately. One line each: ID, what, why it waits.

## Notes for Josef (environment)

- **Node 22 vs 24.** `npm ci` warns that `@firebase/storage-compat@0.4.6` wants Node ≥ 24.12.0. This repo runs on Node 22.22.0. Not changed here (out of scope by instruction). When convenient, pin Node 24 (`.nvmrc` plus `engines`) and use it locally and in the cloud environment.
- **npm audit.** 11 vulnerabilities (6 moderate, 5 high), all in dependencies. Not fixed here by instruction. Review with `npm audit` (VS Code terminal, repo root) before the next dependency update.

## M0 (plan) minors

- L1-12 to L1-25, L1-29 to L1-36 (`docs/qa/logic-check.md`): folded into plan revision 2 or 3 where cheap. The rest are tracked by the M1 to M5 checks.
- F17, F20, F23 (`qa/m0-spec-recheck.md`): small spec lines. Named in the plan; verified at the milestone that builds them.
- L1-37 (major, fixed in plan revision 4) and L1-38 (minor, fixed): the last two M0 findings. The fixes were not re-checked by a separate agent because the three-round limit was reached. Logic reviewer pass 2 at M1 covers them against the real rules and code.

## M1 minors

- **Security (`qa/m1-security.md`):**
  - Check-in ids can collide if a roster email contains `_` and a term id is crafted to match. This needs a hostile admin; the ids stay unique for real school emails.
  - Notifications have no size or key limit, and teachers can send them. That is needed for teachers' comment notifications; the text is truncated client-side.
  - A lead can archive a public project. It simply disappears from the public site at the next publish, which is harmless.
  - Anonymous `public/feed` reads count against the shared free quota. This is an accepted risk (plan section 2.9), partly reduced by the 5-minute reuse window on the public page.
- **Spec and logic (`qa/m1-spec.md`, `docs/qa/logic-check.md` pass 2):**
  - L2-01 to L2-15 are all minor.
  - The teacher check-in rule is unchanged from before.
  - `createdAt` is only type-checked on submissions.
  - Archive submissions do not require `projectId`.
  - Workload reads grow late in the term (L2-02).
  - L1-37's retry limits are built in M2 (`src/publish.js`).
- **Alpha (`qa/m1-alpha.md`):**
  - A deactivated member sees the "not on the roster" wording.
  - Roster actions sit off-screen at 390 px with no scroll cue (the redesign's `fl-scroll` handles this in M3).
  - Saving a task edit shows no toast.
  - Fixed now: Add member overwrote an existing member, and permission-denied said "check your connection".
- **Tests (`qa/m1-tests.md`):** 12 independent item tests are skipped because the requirements do not give the item document shape. Item behaviour is covered by `tests/rules.test.mjs`.

## M2 minors and accepted risks

- **M2-S1 (security, accepted risk):** anonymous reads of `public/feed` count against the shared free quota. Without Cloud Functions nothing can rate-limit them. Mitigated by the public page's 5-minute reuse window; requests the rules deny already cost reads today (plan section 2.9).
- **M2-S3 (security, documented):** the cache wipe on Sign out cannot run while another tab holds the database, and sessions that end without Sign out (token expiry, the automatic no-roster sign-out) leave the cache on the device. The README tells members on shared computers to use Sign out and close the other tabs (L1-34).
- **Alpha:** two aborted Firestore channel requests are logged on sign out. This is SDK noise.
- **Spec:** the snapshot JSON keeps empty default fields (plan 6.2 said they would be dropped). That is simpler, and the size check still guards the limit. "Publish now" arrives with the admin screens in M5.
