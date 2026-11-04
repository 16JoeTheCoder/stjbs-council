import { committeeKeyMembers, deptMembers, rankMembers } from "./org-model.js";
// Pure event policy. Configuration is copied into each proposal; invitations are resolved once.
export const EVENT_TYPES = [
  ["meeting", "Meeting"],
  ["project", "Project"],
  ["committee", "Committee"],
  ["other", "Other"],
];
export const REQUEST_STATES = [
  "draft",
  "awaiting",
  "scheduled",
  "changes-requested",
  "declined",
  "withdrawn",
  "cancelled",
];
// The selection is stored as rules, not frozen lists, so someone who joins a department later is invited.
// Legacy keys are always present; the newer keys are written only when used, so old documents keep their shape.
const LEGACY = ["groupIds", "sections", "includeUids", "excludeUids"];
export const RULE_KEYS = ["departmentIds", "ranks", "teamIds"];
export const emptySelection = () => ({
  groupIds: [],
  sections: [],
  includeUids: [],
  excludeUids: [],
});
const unique = (a = []) => [...new Set(a)].sort();
export function normalizeSelection(s = {}) {
  const out = Object.fromEntries(LEGACY.map((k) => [k, unique(s?.[k] || [])]));
  for (const k of RULE_KEYS) if (s?.[k]?.length) out[k] = unique(s[k]);
  return out;
}
// org: { departments, committees } for the newer keys. Legacy rule kept: sections narrow the group union.
export function resolveParticipants(selection, members, groups = [], org = {}) {
  const s = normalizeSelection(selection),
    active = members.filter((m) => m.active);
  const selected = new Set();
  for (const g of groups)
    if (!g.archived && g.available !== false && s.groupIds.includes(g.id))
      for (const uid of g.memberUids || []) selected.add(uid);
  const base = active.filter(
    (m) =>
      (!s.groupIds.length || selected.has(m.id)) &&
      (!s.sections.length || s.sections.includes(m.section)) &&
      (s.groupIds.length || s.sections.length),
  );
  const resolved = new Set([...base.map((m) => m.id), ...s.includeUids]);
  const depts = org.departments || [];
  for (const id of s.departmentIds || []) {
    const d = depts.find((x) => x.id === id);
    if (d && d.active !== false) for (const uid of deptMembers(d)) resolved.add(uid);
  }
  for (const r of s.ranks || []) for (const uid of rankMembers(r, members, depts)) resolved.add(uid);
  for (const key of s.teamIds || []) for (const uid of committeeKeyMembers(key, org.committees || [])) resolved.add(uid);
  return active
    .filter((m) => resolved.has(m.id) && !s.excludeUids.includes(m.id))
    .map((m) => m.id)
    .sort();
}
export function eventDefaults(settings = null, template = null, edits = {}) {
  const type =
    edits.type ||
    template?.defaults?.type ||
    settings?.defaults?.type ||
    "other";
  return {
    title: "",
    type,
    start: "15:30",
    end: "16:30",
    location: "",
    notes: "",
    itemId: null,
    approval: type === "meeting" ? "required" : "immediate",
    participantSelection: emptySelection(),
    ...(type === "meeting"
      ? {
          start: "15:00",
          end: "16:00",
          duration: 60,
          location: "Assembly Room, third floor",
        }
      : {}),
    ...(settings?.defaults || {}),
    ...(template?.defaults || {}),
    ...edits,
    participantSelection: normalizeSelection(
      edits.participantSelection ||
        template?.defaults?.participantSelection ||
        settings?.defaults?.participantSelection,
    ),
  };
}
export function suggestedMeetingDefaults(members = []) {
  const active = members.filter((m) => m.active);
  const byFirst = (name) =>
    active.find((m) => m.name?.trim().split(/\s+/)[0].toLowerCase() === name)
      ?.id || null;
  return {
    ...eventDefaults(null, null, { type: "meeting" }),
    chairUid: byFirst("ariel"),
    minutesUid:
      byFirst("kimberly") ||
      active.find((m) => m.role === "secretary")?.id ||
      null,
    minutesBackupUid: null,
    cohostUids: [],
    agenda: "",
    minutes: "",
    instructions: "",
    customFields: [],
  };
}
export function nextThursday(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((4 - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}
const copy = (value) => JSON.parse(JSON.stringify(value));
export function makeProposal({
  settings,
  template,
  edits,
  members,
  groups,
  frozenParticipants,
  org,
}) {
  const d = eventDefaults(settings, template, edits);
  return {
    title: d.title.trim().slice(0, 80),
    type: d.type,
    date: d.date,
    ...(d.allDay && d.endDate && d.endDate > d.date ? { endDate: d.endDate } : {}),
    start: d.start,
    end: d.end,
    allDay: !!d.allDay,
    location: d.location.trim().slice(0, 120),
    notes: d.notes.slice(0, 1000),
    public: !!d.public,
    itemId: d.itemId || null,
    participantSelection: d.participantSelection,
    participantUids:
      frozenParticipants ||
      resolveParticipants(d.participantSelection, members, groups, org),
    customValues: copy(d.customValues || {}),
    meetingDefaults: Object.fromEntries(
      [
        "agenda",
        "minutes",
        "instructions",
        "chairUid",
        "minutesUid",
        "minutesBackupUid",
        "cohostUids",
        "duration",
      ]
        .filter((k) => d[k] !== undefined)
        .map((k) => [k, copy(d[k])]),
    ),
    configSnapshot: {
      settingsVersion: settings?.version || 0,
      templateId: template?.id || null,
      templateVersion: template?.version || 0,
      templateName: template?.name || "",
      approval: d.approval,
      defaults: copy(eventDefaults(settings, template, { type: d.type })),
    },
  };
}
export function validateProposal(p) {
  if((p.configSnapshot?.defaults?.customFields||[]).length>4)return "Use at most 4 custom fields.";
  if (!p.title?.trim()) return "Add an event title.";
  if (!EVENT_TYPES.some(([t]) => t === p.type)) return "Choose an event type.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(p.date || "") ||
    Number.isNaN(Date.parse(`${p.date}T00:00:00Z`)) ||
    new Date(`${p.date}T00:00:00Z`).toISOString().slice(0, 10) !== p.date
  )
    return "Choose a valid date.";
  if (
    ![p.start, p.end].every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || "")) ||
    p.end <= p.start
  )
    return "The end time must be after the start time.";
  for (const field of p.configSnapshot?.defaults?.customFields || []) {
    const value = p.customValues?.[field.id];
    if (
      field.required &&
      (field.type === "checkbox" ? value !== true : !String(value || "").trim())
    )
      return `Complete “${field.label}”.`;
    if (field.type === "select" && value && !field.options?.includes(value))
      return `Choose a valid value for “${field.label}”.`;
    if (typeof value === "string" && value.length > 1000)
      return `Shorten “${field.label}” to 1000 characters.`;
  }
  return "";
}
export function requestTransition(state, next, admin = false) {
  if (
    admin &&
    state === "awaiting" &&
    ["scheduled", "changes-requested", "declined"].includes(next)
  )
    return true;
  if (
    ["draft", "changes-requested"].includes(state) &&
    ["draft", "awaiting"].includes(next)
  )
    return true;
  if (
    ["draft", "awaiting", "changes-requested"].includes(state) &&
    next === "withdrawn"
  )
    return true;
  return state === "scheduled" && next === "cancelled";
}
export function assertRevision(actual, expected) {
  if ((actual || 0) !== (expected || 0))
    throw new Error(
      "This event changed on another device. Close this form and open the latest version.",
    );
}

// Split overlapping events into lanes within each connected overlap interval.
export function calendarLanes(events) {
  const output = [];
  for (const day of [...new Set(events.map((e) => e.date))]) {
    const ordered = events
      .filter((e) => e.date === day)
      .sort(
        (a, b) =>
          a.start.localeCompare(b.start) ||
          a.end.localeCompare(b.end) ||
          a.id.localeCompare(b.id),
      );
    let cluster = [],
      ends = [],
      clusterEnd = "";
    const flush = () => {
      for (const item of cluster)
        output.push({
          ...item.event,
          calendarLane: item.lane,
          calendarLanes: ends.length,
        });
      cluster = [];
      ends = [];
    };
    for (const event of ordered) {
      if (cluster.length && event.start >= clusterEnd) flush();
      let lane = ends.findIndex((end) => end <= event.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = event.end;
      cluster.push({ event, lane });
      clusterEnd =
        cluster.length === 1
          ? event.end
          : event.end > clusterEnd
            ? event.end
            : clusterEnd;
    }
    flush();
  }
  return output;
}

export function previewEventDefaults(
  event,
  settings,
  template,
  replaceInvitations = false,
  members = [],
  groups = [],
) {
  const defaults = eventDefaults(settings, template, {
    type: template?.defaults?.type || event.type,
  });
  const edits = {
    ...event,
    start: defaults.start,
    end: defaults.end,
    location: defaults.location,
    notes: defaults.notes,
    ...Object.fromEntries(
      [
        "agenda",
        "minutes",
        "instructions",
        "chairUid",
        "minutesUid",
        "minutesBackupUid",
        "cohostUids",
        "duration",
      ]
        .filter((k) => defaults[k] !== undefined)
        .map((k) => [k, defaults[k]]),
    ),
    participantSelection: replaceInvitations
      ? defaults.participantSelection
      : event.participantSelection || emptySelection(),
  };
  const proposal = makeProposal({
    settings,
    template,
    edits,
    members,
    groups,
    frozenParticipants: replaceInvitations
      ? undefined
      : event.participantUids || [],
  });
  return {
    proposal,
    error: validateProposal(proposal),
    changes: ["start", "end", "location", "notes"]
      .filter((k) => (event[k] || "") !== (proposal[k] || ""))
      .map((k) => ({
        field: k,
        before: event[k] || "",
        after: proposal[k] || "",
      })),
    added: proposal.participantUids.filter(
      (uid) => !event.participantUids?.includes(uid),
    ),
    removed: (event.participantUids || []).filter(
      (uid) => !proposal.participantUids.includes(uid),
    ),
  };
}

export function remainingEvents(events, day, localTime) {
  return events
    .filter(
      (e) =>
        !e.archived &&
        e.date >= day &&
        (e.date > day || e.allDay || e.end > localTime),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) ||
        a.start.localeCompare(b.start),
    );
}
