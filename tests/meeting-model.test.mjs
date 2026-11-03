import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRevision,
  participantDiff,
  taskReview,
  publishedRecord,
  canControl,
} from "../src/meeting-model.js";
test("scope tasks prioritized and deduplicated while retaining completed review history", () => {
  const tasks = [
    {
      id: "a",
      kind: "task",
      ancestors: ["p"],
      title: "ordinary",
      status: "todo",
    },
    {
      id: "b",
      kind: "task",
      ancestors: ["p"],
      title: "blocked",
      status: "todo",
      blocked: true,
    },
    {
      id: "b",
      kind: "task",
      ancestors: ["p"],
      title: "blocked",
      status: "todo",
      blocked: true,
    },
    { id: "c", kind: "task", ancestors: ["q"], title: "other" },
  ];
  assert.deepEqual(
    taskReview(tasks, ["p"], "2026-11-03").map((t) => t.id),
    ["b", "a"],
  );
});
test("stale revisions reject and participant membership diff explicit", () => {
  assert.throws(() => assertRevision(4, 3), /draft is retained/);
  assertRevision(4, 4);
  assert.deepEqual(participantDiff(["a", "b"], ["b", "c"]), {
    added: ["c"],
    removed: ["a"],
  });
});
test("published snapshot omits sensitive absence data and increments immutable version", () => {
  const meeting = {
      id: "m",
      termId: "t",
      title: "Council",
      date: "2026-11-03",
      startTime: "15:00",
      endTime: "16:00",
      actualStart: 1,
      actualEnd: 2,
      venue: "Assembly",
      chairUid: "a",
    },
    draft = {
      publishedVersion: 2,
      editorUid: "b",
      summary: "Summary",
      decisions: "Decision",
      actions: [],
      closing: "Meeting closed at 16:00",
      nextMeeting: "",
      preparedBy: "b",
      reviewedBy: "a",
    };
  const record = publishedRecord(
    meeting,
    draft,
    [],
    [{ uid: "a", status: "excused", reason: "private medical detail" }],
    [{ id: "a", name: "Ariel" }],
    100,
  );
  assert.equal(record.publishedVersion, 3);
  assert.equal(record.attendance.a, "excused");
  assert.equal(JSON.stringify(record).includes("medical"), false);
  assert.equal(draft.publishedVersion, 2);
});
test("only the assigned host controls the shared room after explicit handoff", () => {
  const meeting = { hostUid: "a", cohostUids: ["b"] };
  assert.equal(canControl(meeting, "a"), true);
  assert.equal(canControl(meeting, "b"), false);
  assert.equal(canControl(meeting, "c"), false);
  assert.equal(canControl(meeting, "c", true), false);
});
