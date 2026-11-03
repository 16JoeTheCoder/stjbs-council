// Pure meeting logic. Authentication roles and organisational audiences are separate.
export const MEETING_PHASES = [
  "attendance",
  "agenda",
  "updates",
  "tasks",
  "recap",
];
export const ATTENDANCE = ["present", "late", "absent", "excused"];
export function taskReview(items, projectIds, today) {
  const seen = new Set();
  return items
    .filter(
      (t) =>
        t.kind === "task" &&
        !t.archived &&
        (projectIds.includes(t.id) ||
          t.ancestors?.some((id) => projectIds.includes(id))),
    )
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .sort((a, b) => {
      const rank = (t) =>
        t.status === "done"
          ? 0
          : t.blocked
            ? 4
            : t.dueDate && t.dueDate < today
              ? 3
              : 1;
      return (
        rank(b) - rank(a) ||
        (b.updatedAt || 0) - (a.updatedAt || 0) ||
        a.title.localeCompare(b.title)
      );
    });
}
export function participantDiff(frozen, current) {
  const before = new Set(frozen),
    after = new Set(current);
  return {
    added: [...after].filter((id) => !before.has(id)),
    removed: [...before].filter((id) => !after.has(id)),
  };
}
export function canControl(meeting, uid) {
  return meeting?.hostUid === uid;
}
export function publishedRecord(
  meeting,
  draft,
  agenda,
  attendance,
  members,
  at = Date.now(),
) {
  const names = new Map(members.map((m) => [m.id, m.name]));
  return {
    id: meeting.id,
    termId: meeting.termId,
    status: "published",
    revision: draft.publishedVersion + 1,
    publishedVersion: draft.publishedVersion + 1,
    publishedAt: at,
    name: meeting.title,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    actualStart: meeting.actualStart,
    actualEnd: meeting.actualEnd,
    venue: meeting.venue,
    chairUid: meeting.chairUid,
    chairName: names.get(meeting.chairUid) || meeting.chairUid,
    minutesTakerName: names.get(draft.editorUid) || draft.editorUid,
    editorUid: draft.editorUid,
    attendance: Object.fromEntries(
      (meeting.participantUids || attendance.map((x) => x.uid)).map((uid) => [
        uid,
        attendance.find((x) => x.uid === uid)?.status || "absent",
      ]),
    ),
    agenda: agenda.map(
      ({ id, title, presenterUid, duration, discussion, outcome, status }) => ({
        id,
        title,
        presenterUid,
        duration,
        discussion: discussion || "",
        outcome: outcome || "",
        presenterName: names.get(presenterUid) || presenterUid || "",
        status,
      }),
    ),
    summary: draft.summary,
    decisions: draft.decisions,
    actions: draft.actions,
    closing: draft.closing,
    nextMeeting: draft.nextMeeting,
    preparedBy: draft.preparedBy,
    reviewedBy: draft.reviewedBy,
  };
}
export function assertRevision(actual, expected) {
  if (actual !== expected)
    throw new Error(
      "This record changed in another tab. Your draft is retained; reload the saved version before trying again.",
    );
}
export const draftKey = (meetingId, uid, field) =>
  `council-meeting-draft:${uid}:${meetingId}:${field}`;
