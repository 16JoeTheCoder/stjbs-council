# Backlog

Minor findings and notes for Josef, not fixed immediately. One line each: ID, what, why it waits.

## Notes for Josef (environment)

- **Node 22 vs 24.** `npm ci` warns that `@firebase/storage-compat@0.4.6` wants Node ≥ 24.12.0. This repo runs on Node 22.22.0. Not changed here (out of scope by instruction). When convenient, pin Node 24 (`.nvmrc` plus `engines`) and use it locally and in the cloud environment.
- **npm audit.** 11 vulnerabilities (6 moderate, 5 high), all in dependencies. Not fixed here by instruction. Review with `npm audit` (VS Code terminal, repo root) before the next dependency update.

## M0 (plan) minors

- L1-12 to L1-25, L1-29 to L1-36 (`docs/qa/logic-check.md`): folded into plan revision 2 or 3 where cheap. The rest are tracked by the M1 to M5 checks.
- F17, F20, F23 (`qa/m0-spec-recheck.md`): small spec lines. Named in the plan; verified at the milestone that builds them.
