# Known issues

Minor findings left open on purpose, one line each with the reason.

- G1-09: if a lead change spanning several batches is interrupted, untouched descendants keep stale `leadUids` and their updates are refused until the lead change is saved again. Rare (needs more than 15 subteams under one node and a dropped connection mid-save); saving the lead again repairs it.
- G1-12: the rules accept check-ins for past weeks. Enforcing "until the week ends" in rules needs server-side week math; the UI only ever writes the current week, and the only effect is a slightly higher Workload check-in count for someone who forges a backfill.
- G2-15 (part): the status badge's circle (50% radius) is the design system's ok shape, so it stays as the system defines it.
- G2-23: disabled buttons use the design system's `opacity: .4` (WCAG exempts disabled controls); the reason for the lock is always given as help text beside it.
- Emulator vs production: the 20-call batch limit and composite indexes are not enforced by the emulator. Writes are chunked defensively and the one composite index (activity) ships in `firestore.indexes.json`, but the first production deploy is the real test.
