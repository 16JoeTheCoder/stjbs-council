// Attention is derived only from persisted sources the signed-in member can read.
export function deriveAttention({
  uid,
  admin = false,
  requests = [],
  events = [],
  meetings = [],
  items = [],
  reads = {},
  today,
}) {
  const result = new Map();
  const add = (entry) => {
    const old = result.get(entry.id);
    if (!old || old.revision < entry.revision)
      result.set(entry.id, {
        ...entry,
        read: (reads[entry.id]?.revision || 0) >= entry.revision,
      });
  };
  for (const request of requests) {
    const mine = request.createdByUid === uid;
    if (!mine && !(admin && request.state === "awaiting")) continue;
    const labels = {
      draft: "Finish your event request",
      awaiting: mine ? "Event request awaiting review" : "Review event request",
      scheduled: "Event request approved",
      "changes-requested": "Changes requested",
      declined: "Event request declined",
      withdrawn: "Event request withdrawn",
      cancelled: "Event cancelled",
    };
    add({
      id: `request_${request.id}`,
      sourceId: `request:${request.id}`,
      revision: request.revision || 1,
      kind: "request",
      title: `${labels[request.state] || "Event request updated"}: ${request.proposal.title}`,
      detail:
        request.reviewNote ||
        `${request.proposal.date} · ${request.proposal.start} to ${request.proposal.end}`,
      href: `#/calendar?d=${request.proposal.date}&request=${request.id}`,
      action:
        (["draft", "changes-requested"].includes(request.state) && mine) ||
        (request.state === "awaiting" && admin),
      at: request.updatedAt || request.createdAt || 0,
    });
  }
  for (const event of events) {
    if (event.date < today || !event.participantUids?.includes(uid)) continue;
    add({
      id: `event_${event.id}`,
      sourceId: `event:${event.id}`,
      revision: event.revision || 1,
      kind: "invitation",
      title: `${event.archived ? "Invitation cancelled" : "Invited"}: ${event.title}`,
      detail: `${event.date} · ${event.allDay ? "All day" : `${event.start} to ${event.end}`}${event.location ? ` · ${event.location}` : ""}`,
      href: event.archived
        ? `#/calendar?d=${event.date}`
        : `#/calendar?d=${event.date}&e=${event.id}`,
      action: false,
      at: event.updatedAt || event.createdAt || 0,
    });
  }
  for (const meeting of meetings) {
    const roles = [
      ["hostUid", "Host"],
      ["chairUid", "Chair"],
      ["minutesUid", "Minute taker"],
      ["minutesBackupUid", "Backup minute taker"],
    ]
      .filter(([field]) => meeting[field] === uid)
      .map(([, label]) => label);
    if (meeting.cohostUids?.includes(uid)) roles.push("Cohost");
    const relevant =
      admin || meeting.participantUids?.includes(uid) || roles.length;
    if (!relevant) continue;
    const href = `#/meeting-hub/${meeting.id}`;
    if (
      roles.length &&
      (meeting.status !== "closed" ||
        (meeting.minutesUid === uid && meeting.minutesStatus !== "published"))
    )
      add({
        id: `responsibility_${meeting.id}`,
        sourceId: `meeting:${meeting.id}`,
        revision: meeting.revision || 1,
        kind: "responsibility",
        title: `${roles.join(", ")}: ${meeting.title}`,
        detail: `${meeting.date} · ${meeting.startTime} · ${meeting.status}`,
        href,
        action: true,
        at: meeting.actualStart || meeting.createdAt || 0,
      });
    if (meeting.status === "live" || meeting.status === "closed")
      add({
        id: `meeting_${meeting.id}`,
        sourceId: `meeting:${meeting.id}`,
        revision: meeting.revision || 1,
        kind: "meeting",
        title: `${meeting.status === "live" ? "Meeting is live" : "Meeting ended"}: ${meeting.title}`,
        detail:
          meeting.status === "live"
            ? "Open the shared room for the current phase and agenda."
            : "Open the hub for the recap and published record.",
        href,
        action: meeting.status === "live",
        at: meeting.actualEnd || meeting.actualStart || meeting.createdAt || 0,
      });
    const version =
      meeting.publishedVersion > 0
        ? {
            revision: meeting.publishedVersion,
            publishedAt:
              meeting.minutesPublishedAt ||
              meeting.actualEnd ||
              meeting.createdAt,
          }
        : null;
    if (version)
      add({
        id: `published_${meeting.id}`,
        sourceId: `minutes:${meeting.id}`,
        revision: version.revision,
        kind: "minutes",
        title: `Published minutes: ${meeting.title}`,
        detail: `Version ${version.revision}. Read the confirmed decisions and actions.`,
        href,
        action: false,
        at: version.publishedAt || 0,
      });
    const draft =
      meeting.minutesStatus === "review"
        ? {
            status: "review",
            revision: meeting.minutesReviewRevision || meeting.revision || 1,
            updatedAt:
              meeting.minutesReviewAt || meeting.actualEnd || meeting.createdAt,
          }
        : null;
    if (admin && draft?.status === "review")
      add({
        id: `review_${meeting.id}`,
        sourceId: `minutes-review:${meeting.id}`,
        revision: draft.revision,
        kind: "review",
        title: `Review minutes: ${meeting.title}`,
        detail: "The minute taker has submitted the record for review.",
        href,
        action: true,
        at: draft.updatedAt || 0,
      });
  }
  for (const item of items)
    if (
      item.meetingId &&
      !item.archived &&
      item.status !== "done" &&
      item.assigneeUids?.includes(uid)
    ) {
      add({
        id: `action_${item.id}`,
        sourceId: `action:${item.id}`,
        revision: Math.max(1, item.updatedAt || item.createdAt || 1),
        kind: "action",
        title: `Meeting action: ${item.title}`,
        detail: item.dueDate
          ? `Due ${item.dueDate}${item.blocked ? " · Blocked" : ""}`
          : "No due date set.",
        href: `#/p/${item.id}`,
        action: true,
        at: item.updatedAt || item.createdAt || 0,
      });
    }
  return [...result.values()]
    .sort(
      (a, b) =>
        Number(b.action) - Number(a.action) ||
        b.at - a.at ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 150);
}
