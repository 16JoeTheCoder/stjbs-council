# Known issues

Minor findings left open on purpose, one line each with the reason.

- G1-09: if a lead change spanning several batches is interrupted, untouched descendants keep stale `leadUids` and their updates are refused until the lead change is saved again. Rare (needs more than 15 subteams under one node and a dropped connection mid-save); saving the lead again repairs it.
- G1-12: the rules accept check-ins for past weeks. Enforcing "until the week ends" in rules needs server-side week math; the UI only ever writes the current week, and the only effect is a slightly higher Workload check-in count for someone who forges a backfill.
