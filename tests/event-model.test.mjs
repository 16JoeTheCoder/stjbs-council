import test from "node:test";
import assert from "node:assert/strict";
import {
  remainingEvents,
  calendarLanes,
  previewEventDefaults,
  nextThursday,
  suggestedMeetingDefaults,
  assertRevision,
  emptySelection,
  eventDefaults,
  makeProposal,
  requestTransition,
  resolveParticipants,
  validateProposal,
} from "../src/event-model.js";
const members = [
  { id: "a", active: true, section: "Arts" },
  { id: "b", active: true, section: "Arts" },
  { id: "c", active: true, section: "Sports" },
  { id: "d", active: false, section: "Arts" },
];
test("group union is intersected with sections before individual additions and exclusions", () => {
  const s = {
    groupIds: ["g"],
    sections: ["Arts"],
    includeUids: ["c", "d", "missing", "a"],
    excludeUids: ["b"],
  };
  assert.deepEqual(
    resolveParticipants(s, members, [{ id: "g", memberUids: ["b", "c", "d"] }]),
    ["a", "c"],
  );
  assert.deepEqual(resolveParticipants(emptySelection(), members), []);
  assert.deepEqual(
    resolveParticipants({ groupIds: ["g"], sections: ["Arts"] }, members, [
      { id: "g", memberUids: ["b", "c"] },
    ]),
    ["b"],
  );
});
test("type defaults and term, template, event precedence are explicit", () => {
  assert.equal(
    eventDefaults(null, null, { type: "meeting" }).approval,
    "required",
  );
  assert.equal(eventDefaults().approval, "immediate");
  assert.equal(
    eventDefaults(null, null, { type: "meeting" }).location,
    "Assembly Room, third floor",
  );
  assert.equal(
    eventDefaults({ defaults: { location: "Hall" } }, null, { type: "meeting" })
      .approval,
    "required",
  );
  const settings = {
    defaults: { location: "Hall", approval: "required", title: "Term" },
  };
  const template = { defaults: { title: "Template", location: "Library" } };
  assert.equal(
    eventDefaults(settings, template, { title: "Edited" }).title,
    "Edited",
  );
  assert.equal(eventDefaults(settings, template).location, "Library");
  assert.equal(eventDefaults(settings, template).approval, "required");
});
test("proposal snapshots versions and invitations independently of later group edits", () => {
  const groups = [{ id: "g", memberUids: ["a"] }];
  const p = makeProposal({
    settings: { version: 2 },
    template: { id: "t", version: 3 },
    edits: {
      title: "Review",
      date: "2026-11-03",
      participantSelection: { groupIds: ["g"] },
    },
    members,
    groups,
  });
  groups[0].memberUids.push("b");
  assert.deepEqual(p.participantUids, ["a"]);
  assert.deepEqual(p.configSnapshot, {
    settingsVersion: 2,
    templateId: "t",
    templateVersion: 3,
    templateName: "",
    approval: "immediate",
    defaults: eventDefaults(),
  });
  assert.deepEqual(
    makeProposal({
      edits: { title: "Edit", date: "2026-11-03" },
      members,
      groups,
      frozenParticipants: ["a"],
    }).participantUids,
    ["a"],
  );
});
test("workflow restricts review, permits resubmission, and ends terminal requests", () => {
  assert.equal(requestTransition("draft", "awaiting"), true);
  assert.equal(requestTransition("changes-requested", "awaiting"), true);
  assert.equal(requestTransition("awaiting", "scheduled"), false);
  assert.equal(requestTransition("awaiting", "scheduled", true), true);
  assert.equal(requestTransition("awaiting", "changes-requested", true), true);
  assert.equal(requestTransition("awaiting", "withdrawn"), true);
  assert.equal(requestTransition("scheduled", "cancelled"), true);
  for (const s of ["declined", "withdrawn", "cancelled"])
    assert.equal(requestTransition(s, "scheduled", true), false);
});
test("compare-and-swap accepts legacy zero only and rejects stale revisions", () => {
  assert.doesNotThrow(() => assertRevision(undefined, 0));
  assert.doesNotThrow(() => assertRevision(2, 2));
  assert.throws(() => assertRevision(3, 2), /another device/);
});
test("validation rejects invalid calendar days, zero duration and malformed times", () => {
  const p = {
    title: "Meeting",
    type: "meeting",
    date: "2026-11-03",
    start: "15:30",
    end: "16:30",
  };
  assert.equal(validateProposal(p), "");
  for (const patch of [
    { date: "2026-02-30" },
    { end: "15:30" },
    { start: "24:00" },
    { title: " " },
  ])
    assert.ok(validateProposal({ ...p, ...patch }));
});

test("custom required fields validate against the saved definition", () => {
  const p = makeProposal({
    edits: { title: "Custom", date: "2026-11-03" },
    template: {
      defaults: {
        customFields: [
          {
            id: "purpose",
            label: "Purpose",
            type: "text",
            required: true,
            options: [],
          },
        ],
      },
    },
    members,
    groups: [],
  });
  assert.match(validateProposal(p), /Purpose/);
  p.customValues.purpose = "Plan sports day";
  assert.equal(validateProposal(p), "");
});

test("meeting suggestions use only actual roster identities and suggest Thursday without recurrence", () => {
  assert.equal(suggestedMeetingDefaults([]).chairUid, null);
  assert.equal(
    suggestedMeetingDefaults([
      { id: "actual@school", name: "Ariel Example", active: true },
    ]).chairUid,
    "actual@school",
  );
  assert.equal(nextThursday("2026-11-03"), "2026-11-05");
  assert.equal(nextThursday("2026-11-05"), "2026-11-05");
});
test("overlap lanes keep simultaneous events visible and reuse non-overlapping lanes", () => {
  const events = [
    { id: "a", date: "2026-11-03", start: "15:00", end: "16:00" },
    { id: "b", date: "2026-11-03", start: "15:30", end: "16:30" },
    { id: "c", date: "2026-11-03", start: "16:00", end: "17:00" },
    { id: "d", date: "2026-11-03", start: "18:00", end: "19:00" },
  ];
  const lanes = calendarLanes(events);
  assert.deepEqual(
    lanes.map((e) => [e.id, e.calendarLane, e.calendarLanes]),
    [
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
      ["d", 0, 1],
    ],
  );
});
test("bulk preview keeps date/title and invitations unless replacement explicitly selected", () => {
  const event = {
    id: "e",
    title: "Existing",
    type: "other",
    date: "2026-11-03",
    start: "15:00",
    end: "16:00",
    notes: "",
    location: "Old",
    participantUids: ["a"],
    participantSelection: { includeUids: ["a"] },
  };
  const settings = {
    version: 2,
    defaults: { location: "New", participantSelection: { includeUids: ["b"] } },
  };
  const preview = previewEventDefaults(
    event,
    settings,
    null,
    false,
    members,
    [],
  );
  assert.equal(preview.proposal.title, "Existing");
  assert.equal(preview.proposal.date, event.date);
  assert.deepEqual(preview.proposal.participantUids, ["a"]);
  assert.equal(
    preview.changes.find((c) => c.field === "location").after,
    "New",
  );
  const replacement = previewEventDefaults(
    event,
    settings,
    null,
    true,
    members,
    [],
  );
  assert.deepEqual(replacement.added, ["b"]);
  assert.deepEqual(replacement.removed, ["a"]);
});

test("Next up excludes ended same-day events and keeps ongoing, all-day and future events chronological", () => {
  const events = [
    { id: "past", date: "2026-11-02", start: "23:00", end: "23:59" },
    { id: "ended", date: "2026-11-03", start: "15:00", end: "16:00" },
    { id: "ongoing", date: "2026-11-03", start: "20:00", end: "21:00" },
    { id: "later", date: "2026-11-03", start: "21:00", end: "22:00" },
    {
      id: "allday",
      date: "2026-11-03",
      start: "00:00",
      end: "00:00",
      allDay: true,
    },
    { id: "tomorrow", date: "2026-11-04", start: "08:00", end: "09:00" },
  ];
  assert.deepEqual(
    remainingEvents(events, "2026-11-03", "20:30").map((e) => e.id),
    ["allday", "ongoing", "later", "tomorrow"],
  );
  assert.deepEqual(
    remainingEvents(events, "2026-11-03", "21:00").map((e) => e.id),
    ["allday", "later", "tomorrow"],
  );
});
