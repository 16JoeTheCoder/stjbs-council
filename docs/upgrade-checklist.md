# Council communication upgrade: acceptance record

This checklist records the requested scope. A working build alone does not verify a requirement. Status distinguishes implemented code from observed verification. The final evidence is in [upgrade verification](upgrade-verification.md). No production deployment, migration, Google authorization, notification, or permissions change is authorized in this implementation run.

## Implementation and verification checklist

| Requirement | Implementation status | Verification evidence |
|---|---|---|
| Preserve projects, tasks, check-ins, ideas, resources, document templates, member/term management and public protection | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Admin event/meeting templates: name, description, type, archive/availability, bounded required/optional fields | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Template venue/time/duration, audience, instructions, agenda/minutes defaults and configuration history | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Admin-only approval policy; meetings require approval by default; ordinary blank events immediate | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Term → template → permitted edit precedence; actual roster-backed responsibilities and backups | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Set as default; explicit previewed bulk updates of existing schedules | Implemented; not every UI branch exercised | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Executive, JC and SEC groups with admin mappings where titles missing; no invented real titles | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Group union → subdivision intersection → additions/exclusions; deduplicated selection summary/list | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Saved invitees frozen; later membership changes show a reviewable difference | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Draft/awaiting/scheduled/changes requested/declined/withdrawn/cancelled lifecycle | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Admin edit/save/approve directly; exact revision approvals, duplicate and stale approval prevention | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Material edits require reapproval; minor edits auditable; recoverable archive history | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Pending absent from confirmed calendar and public feed | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Ordinary member own event edit/archive; admins all; secretary/treasurer no override | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Month/week/agenda; phone agenda; overlaps, genuine all-day and evening times | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Conflict warnings, chronological Next up, accessible date navigation, bounded dates/cursor history/deep links | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Loading failures distinguished from empty results | Implemented; not every UI branch exercised | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Persistent meeting hub with schedule, invitees, RSVP, actual attendance, responsibilities, agenda, projects/tasks, contributions and minutes | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Attributed agenda suggestions accepted/deferred; dated Done/Next/Blocked/check-in reuse | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Role/context-specific actions and substitute host/minutes operation | Implemented; not every UI branch exercised | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Room display: no shell, overlays, private reasons/drafts; large adjustable type; extended/mirrored workflow | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Host agenda/reorder/defer/queue/progress/local timer and atomic explicit co-host handoff | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Follow live/browse independently/return to live; stable focus and retained typed contributions | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Attendance → agenda → individual updates → complete prioritized project task review → recap → close | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Scoped temporary task editing enforced by rules, revoked at close/handoff; changes linked to meeting/topic | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Structured MoM: planned/actual time, venue, chair/editor, attendance/designation/follow-up, discussion/outcome/presenter, actions, deferred/next meeting, review/publish/version | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Sensitive absence reasons in separately authorized documents | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| One official editor, CAS revision and explicit handoff; safe conflict/draft recovery | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Close separate from publishing; draft → review → publication; retained correction versions | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| User-initiated real Google Docs boundary, separate verified account, minimal scopes, destination/result/retry/current-version UX | Configuration-dependent | Unit/API boundary checks plus external school OAuth setup/manual smoke required |
| PDF/print and editable document fallback usable without Google | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Granular Firestore push; necessary listeners reused/disposed; no polling, typing/cursor/presence/per-second writes | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Immediate explicit saves; bounded continuous minutes autosave and blur/manual save | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Pending vs server confirmed; offline/reconnect/closure/host races cannot overwrite newer session | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Repeated normal online action-to-remote-render samples ≤5 seconds | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Persistent trusted/deduplicated deep-linked notices for approvals/changes/invites/responsibilities/actions/minutes | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| WhatsApp copy summary with meeting deep link; no pretend email/push | Implemented; not every UI branch exercised | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Backward-compatible legacy calendar/project meeting routes and safe explicit conversion | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Optional schemas, indexes, safe fixtures, bounded payloads/URLs/cross-term reads/writes | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Idempotent dry-run migration and deployment/rollback guidance | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Whole-system Fiat Lux navigation/forms/feedback/mobile/accessibility improvements | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Existing check/build/design/rules + targeted regression and multi-client tests | Implemented; core/model/rules verification | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |
| Independent Terra low security/concurrency and user-flow/regression/sync reviews | Reviewed; findings fixed and regression checked | See [final evidence](upgrade-verification.md); browser coverage is representative, not exhaustive. |

## Decisions and assumptions

- Repository `src/time.js` explicitly uses Asia/Jakarta (UTC+7, no daylight saving). Scheduling retains that convention.
- The current demo roster has advisor, president, VP, treasurer, secretary, officer and teacher authorization roles, with section labels. No authoritative six-title JC/SEC mapping was supplied. Organizational mapping must be admin configured; it must never grant authorization roles.
- MoM defaults supplied in the request are editable suggestions. They do not create recurrence or establish Kimberly as a roster identity.
- Google OAuth client configuration is external setup. Existing Firebase council identity must remain unchanged.
- Local development and emulators are authorized by the detailed implementation request. Final source must be published to GitHub for review. Deployment remains unauthorized.
- Impeccable context launcher was attempted once from the repository root but is absent. Existing Fiat Lux documentation and the skill's Operate/craft guidance provide the design context.

## Verification log

Final check results, measured samples, known configuration needs and observed browser coverage: [upgrade verification](upgrade-verification.md).
