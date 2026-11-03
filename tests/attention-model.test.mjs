import test from "node:test";
import assert from "node:assert/strict";
import { deriveAttention } from "../src/attention-model.js";
const base = { uid: "member", today: "2026-11-03" };
const proposal = {
  title: "Council",
  date: "2026-11-05",
  start: "15:00",
  end: "16:00",
};
test("trusted request audience and decisions include only self or admins reviewing awaiting requests", () => {
  const requests = [
    {
      id: "own",
      createdByUid: "member",
      state: "changes-requested",
      revision: 3,
      proposal,
      reviewNote: "Change venue",
    },
    {
      id: "other",
      createdByUid: "another",
      state: "awaiting",
      revision: 1,
      proposal,
    },
  ];
  const own = deriveAttention({ ...base, requests });
  assert.equal(own.length, 1);
  assert.equal(own[0].action, true);
  assert.equal(own[0].detail, "Change venue");
  assert.equal(deriveAttention({ ...base, admin: true, requests }).length, 2);
});
test("frozen invited audience sees schedule revisions and cancellations, other members do not", () => {
  const event = {
    id: "e",
    ...proposal,
    revision: 2,
    participantUids: ["member"],
  };
  const before = deriveAttention({
    ...base,
    events: [event],
    reads: { event_e: { revision: 1 } },
  });
  assert.equal(before[0].read, false);
  assert.equal(
    deriveAttention({ ...base, uid: "other", events: [event] }).length,
    0,
  );
  assert.match(
    deriveAttention({ ...base, events: [{ ...event, archived: true }] })[0]
      .title,
    /cancelled/,
  );
});
test("stable identities deduplicate snapshots and persisted revision markers survive device reload", () => {
  const event = {
    id: "e",
    ...proposal,
    revision: 2,
    participantUids: ["member"],
  };
  const entries = deriveAttention({
    ...base,
    events: [event, event],
    reads: { event_e: { revision: 2 } },
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].read, true);
});
test("responsibilities, live sessions, published records, admin reviews and assigned actions derive safely", () => {
  const meeting = {
    id: "m",
    title: "Council",
    date: proposal.date,
    startTime: "15:00",
    participantUids: ["member"],
    chairUid: "member",
    revision: 4,
    status: "live",
    publishedVersion: 2,
    minutesStatus: "review",
    minutesReviewRevision: 4,
  };
  const entries = deriveAttention({
    ...base,
    meetings: [meeting],
    items: [
      {
        id: "task",
        meetingId: "m",
        title: "Book room",
        assigneeUids: ["member"],
        status: "todo",
        updatedAt: 123,
      },
    ],
  });
  assert.deepEqual(
    new Set(entries.map((e) => e.kind)),
    new Set(["responsibility", "meeting", "minutes", "action"]),
  );
  assert.equal(
    deriveAttention({ ...base, admin: true, meetings: [meeting] }).some(
      (e) => e.kind === "review",
    ),
    true,
  );
  assert.equal(
    deriveAttention({ ...base, uid: "other", meetings: [meeting] }).length,
    0,
  );
});
