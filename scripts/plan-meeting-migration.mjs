// Offline, idempotent inspection only. This script never initializes Firebase or writes data.
// Usage: node scripts/plan-meeting-migration.mjs /absolute/path/to/council-backup.json
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function planMeetingMigration(backup) {
  const events = Array.isArray(backup.events)
    ? backup.events
    : Object.entries(backup.events || {}).map(([id, data]) => ({
        id,
        ...data,
      }));
  const meetings = Array.isArray(backup.meetings)
    ? backup.meetings
    : Object.entries(backup.meetings || {}).map(([id, data]) => ({
        id,
        ...data,
      }));
  const hubs = new Set(meetings.map((m) => m.eventId || m.id));
  return {
    dryRun: true,
    writesPerformed: 0,
    destructiveChanges: 0,
    eventsInspected: events.length,
    revisionBackfill: events
      .filter((e) => e.revision === undefined)
      .map((e) => ({
        id: e.id,
        expectedRevision: null,
        optionalPatch: { revision: 1 },
        reason: "Preserve every existing field and identity.",
      })),
    legacyMeetingCandidates: events
      .filter((e) => e.type === "meeting" && !hubs.has(e.id) && !e.archived)
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        action: "Explicit administrator conversion required",
        approval: "Keep legacy approval unspecified",
        invitees:
          "Preview and explicitly choose frozen invitations; never infer consent from roster membership",
      })),
    alreadyPrepared: meetings.length,
    instructions:
      "No migration is required to read legacy events. Review this plan against a fresh backup. New hubs are created explicitly by an administrator in Calendar; rerunning preparation keeps the existing hub. Never mark a legacy meeting approved or overwrite existing schedules from term defaults.",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2]) {
    console.error(
      "Pass the path to a local council JSON backup. Dry-run only; no Firebase connection.",
    );
    process.exitCode = 1;
  } else {
    const backup = JSON.parse(await readFile(process.argv[2], "utf8"));
    console.log(JSON.stringify(planMeetingMigration(backup), null, 2));
  }
}
