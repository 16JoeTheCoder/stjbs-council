# Meetings and calendar operations

## Identity and workflow

The app keeps the existing Firebase email/password identity and roster gate. Advisor, president and VP are administrators. Organizational participant groups do not change those permissions. Host, cohost, chair and minutes responsibilities belong to one meeting; they do not change a person's permanent role.

Use Calendar → Add event, choose a template, confirm details and actual people, then publish or send a request. Meetings require approval unless an administrator deliberately changes the applicable policy. Requests remain separate from confirmed events. An administrator reviews the request revision and schedules it atomically. Changing a scheduled approval-backed event creates a replacement request; its accepted version stays in the calendar until approval.

Use the scheduled meeting's **Open meeting hub** link. The hub connects preparation, agenda, member contributions, a live session, task review and minutes. Assign substitutes before the meeting. Open presentation in a separate window on the whiteboard and leave controls on the laptop. Contributions and private minutes are not presentation content. Browser connection, RSVP and actual attendance are distinct.

Ending the live session does not publish minutes. The assigned editor sends the draft for review; an administrator publishes a version. Corrections create another published version. Google export is an external configuration step; print/PDF and the editable Word-compatible HTML download remain available without it. See [Google setup](google-meeting-export.md).

## Synchronization and cost model

Verified against the official [Firestore pricing documentation](https://firebase.google.com/docs/firestore/pricing) and [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) on 2026-11-03. Spark has limited no-cost usage; this implementation does not require Functions, Storage, Realtime Database, billing, or a server framework. Firestore listeners incur document reads on initial results and changes; rules can add dependent document reads. Reconnects can incur new-query costs. Development counters are application instrumentation, not Firebase billing metrics.

The following is an **estimate**, not measured billing. It counts incremental meeting traffic, excluding the existing shared dashboard roster/items/check-ins/calendar subscriptions, index-entry reads, metadata-only local events, and variable rule reads. Assume two topics, two published versions, five notices, and all N participants have submitted a contribution and an attendance record. The full hub listens to meeting (1), session (1), agenda (2), contributions (N), attendance (N), versions (2), notices (5). One official editor and one reviewer additionally listen to a draft (1) and private topic sections (2). A room-only window listens to meeting/session/agenda (4 documents), without contributions, attendance, drafts or notices.

| Incremental operation | 25-device meeting | 50-device meeting |
|---|---:|---:|
| Cold full-hub result documents, `(11 + 2N) × N + 6` | 1,531 reads | 5,556 reads |
| One extra room-only window | 4 reads | 4 reads |
| One session-control change visible on all N hubs + room | 26 reads, 1 write | 51 reads, 1 write |
| One contribution visible on all N hubs | 25 reads, 1 write | 50 reads, 1 write |
| One private minutes autosave to editor and reviewer | 2 reads, 1 write | 2 reads, 1 write |
| 60 minutes continuous draft typing, upper-bound one flush/1.9 seconds | about 3,790 reads, 1,895 writes | about 3,790 reads, 1,895 writes |
| One shared notice delivered to N hubs | 25 reads, 1 write | 50 reads, 1 write |
| All users mark their notice read once | 25 writes | 50 writes |
| Full cold reconnect of all hubs | up to another 1,531 result reads | up to another 5,556 result reads |

Empty queries have a minimum read charge, so early-session counts differ from the nonempty scenario. New agenda, attendance, publication and notice writes add their own document reads for each subscribed recipient; task changes use the existing authoritative shared task listener and must be added separately. Minute field flushes and distinct private topic sections can create separate writes: the continuous-edit estimate assumes one active field. A device disconnected longer than the documented persistence threshold may reload initial results; without persistence, reconnects can charge a new query each time.

Rule-dependent reads are additional: roster activation, current term, parent meeting, settings/template, and atomic counterpart documents are consulted where needed. A conservative planning allowance is 2–6 dependent reads per relevant listener evaluation and 2–8 per transactional mutation, plus transaction retries. This is not an authoritative upper bound: dependent-document caching, which branches execute, and rule reevaluation make actual counts workload-specific. Use the Firebase console's usage data during the first real school meeting. Never multiply SDK event counters directly into a claimed invoice.

No latency guarantee applies while offline, suspended, quota-exhausted or disconnected. The target is saved-action to other foreground online clients within five seconds under normal network conditions. Local emulator timings validate application behavior only; a controlled school-network smoke test is still needed before any production claim. See the verification record in [upgrade checklist](upgrade-checklist.md).

## Data boundaries and release order

New schemas are additive: event requests/templates/participant groups, event defaults, meetings with granular session/agenda/private topic minutes/contributions/attendance/sensitive records/published versions/notices, and per-user read state. Existing project/task documents remain authoritative. Sensitive reasons never belong in public feeds, room data, exported public minutes or shared cache documents.

Validation is split across immutable companion documents so normal submissions fit Firestore's rule evaluation budget. Each request revision writes its exact proposal companion atomically; term-default versions retain immutable history. Publication writes the exact agenda chunks with the version. These add one write per request revision and two writes per publication, rather than per-member notification fan-out. Supported bounds are four custom form fields, twelve agenda topics and ten captured actions; the complete scoped task review is separate. Attendance versions store stable roster UID → status mappings, supporting fifty-person meetings without copying private reasons. Display/export names resolve through the authorized roster; old versions retain the same UIDs and statuses, and a later roster name correction can change the displayed name.

No production migration is performed by this task. Existing calendar/project meeting links remain the source records; prepare a hub explicitly rather than inventing historical minutes or approvals. The local fixture scripts target only `demo-council` on loopback emulator addresses. Running them twice overwrites their deterministic demo IDs; they are not production migration tools.

After separate release authorization: back up the existing rules/index configuration, deploy additive indexes first and wait for Enabled, then compatible rules and hosting. Review template/default/group settings with the advisor before inviting real users. Keep the prior source commit and configuration backup for rollback. Do not roll back to rules that allow bypassing new approval policy while new records remain writable; prefer reverting UI while retaining protective schema-aware rules. Never remove production fields or collections to roll back.

The release remains blocked until the acceptance checklist and open review findings accurately identify what has and has not been verified. No deployment command has been run.
