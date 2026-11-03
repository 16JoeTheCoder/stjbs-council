import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  increment,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { S } from "./store.js";
import { assertRevision, publishedRecord } from "./meeting-model.js";
const ref = (id, ...path) => doc(db, "meetings", id, ...path);
const now = () => Date.now();
function notice(tx, id, type, revision, targetUid = null) {
  tx.set(ref(id, "notices", `${type}-${revision}`), {
    termId: S.term.termId,
    type,
    revision,
    targetUid,
    createdAt: now(),
    actorUid: S.me.id,
    href: `#/meeting-hub/${id}`,
  });
}
export async function initializeMeeting(event) {
  if (event.requestState && event.requestState !== "scheduled")
    throw new Error("Schedule the approved meeting first.");
  const id = event.id;
  await runTransaction(db, async (tx) => {
    const r = ref(id),
      old = await tx.get(r);
    if (old.exists()) return;
    const participants = event.participantUids || [];
    const defaults =
      event.meetingDefaults || event.configSnapshot?.defaults || {};
    const resolved = (uid) =>
      S.members.some((m) => m.active && m.id === uid) ? uid : null;
    const secretary =
      resolved(defaults.minutesUid) ||
      S.members.find((m) => m.active && m.role === "secretary")?.id ||
      S.me.id;
    tx.set(r, {
      termId: S.term.termId,
      eventId: id,
      createdByUid: S.me.id,
      createdAt: now(),
      title: event.title,
      date: event.date,
      startTime: event.start || event.startTime || "15:00",
      endTime: event.end || event.endTime || "16:00",
      venue: event.location || event.place || event.venue || "",
      participantUids: participants,
      projectIds: event.itemId ? [event.itemId] : [],
      chairUid: resolved(defaults.chairUid) || S.me.id,
      hostUid: S.me.id,
      cohostUids: (defaults.cohostUids || [])
        .filter((uid) => resolved(uid))
        .slice(0, 10),
      minutesUid: secretary,
      minutesBackupUid: resolved(defaults.minutesBackupUid),
      revision: 1,
      status: "prepared",
      minutesStatus: "draft",
      publishedVersion: 0,
      minutesReviewRevision: 1,
      actualStart: null,
      actualEnd: null,
    });
    tx.set(ref(id, "session", "control"), {
      termId: S.term.termId,
      revision: 1,
      hostUid: S.me.id,
      phase: "attendance",
      activeTopicId: null,
      presenterUid: null,
      queue: [],
      timerStartedAt: null,
      timerDuration: 0,
      updatedAt: now(),
      sessionId: crypto.randomUUID(),
    });
    tx.set(ref(id, "minutes", "draft"), {
      termId: S.term.termId,
      revision: 1,
      editorUid: secretary,
      status: "draft",
      summary: defaults.minutes || "",
      decisions: "",
      actions: [],
      closing: "Meeting closed at",
      nextMeeting: "",
      preparedBy: secretary,
      reviewedBy: "",
      publishedVersion: 0,
      updatedAt: now(),
    });
    if (defaults.agenda)
      tx.set(ref(id, "agenda", "default"), {
        termId: S.term.termId,
        title: String(defaults.agenda).slice(0, 120),
        presenterUid: resolved(defaults.chairUid),
        duration: Math.min(180, defaults.duration || 10),
        order: 0,
        status: "queued",
        projectIds: [],
        taskIds: [],
        confirmedOutcome: "",
        confirmedDecisions: "",
      });
  });
  return id;
}
export async function changeMeeting(meeting, patch) {
  await runTransaction(db, async (tx) => {
    const r = ref(meeting.id),
      d = await tx.get(r);
    assertRevision(d.data()?.revision, meeting.revision);
    tx.update(r, { ...patch, revision: meeting.revision + 1 });
  });
}
export async function controlMeeting(meeting, session, patch) {
  await runTransaction(db, async (tx) => {
    const mr = ref(meeting.id),
      sr = ref(meeting.id, "session", "control");
    const [m, s] = await Promise.all([tx.get(mr), tx.get(sr)]);
    assertRevision(s.data()?.revision, session.revision);
    if (m.data()?.status === "closed")
      throw new Error(
        "This meeting is closed. Your draft remains on this device.",
      );
    tx.update(sr, {
      ...patch,
      revision: session.revision + 1,
      updatedAt: now(),
    });
  });
}
export async function lifecycle(meeting, session, status) {
  await runTransaction(db, async (tx) => {
    const mr = ref(meeting.id),
      sr = ref(meeting.id, "session", "control");
    const [m, s] = await Promise.all([tx.get(mr), tx.get(sr)]);
    assertRevision(m.data()?.revision, meeting.revision);
    assertRevision(s.data()?.revision, session.revision);
    tx.update(mr, {
      status,
      revision: meeting.revision + 1,
      ...(status === "live" ? { actualStart: now() } : { actualEnd: now() }),
    });
    tx.update(sr, {
      revision: session.revision + 1,
      updatedAt: now(),
      timerStartedAt: null,
    });
    notice(
      tx,
      meeting.id,
      status === "live" ? "started" : "closed",
      meeting.revision + 1,
    );
  });
}
export async function handoff(meeting, session, uid, type = "host") {
  if (!S.members.some((m) => m.id === uid && m.active && m.role !== "teacher"))
    throw new Error("Choose an active council member with editing access.");
  if (type === "host" && uid !== S.me.id && !meeting.cohostUids.includes(uid))
    throw new Error("Choose a designated cohost for host handoff.");
  await runTransaction(db, async (tx) => {
    const mr = ref(meeting.id),
      sr = ref(meeting.id, "session", "control"),
      dr = ref(meeting.id, "minutes", "draft");
    const [m, s] = await Promise.all([tx.get(mr), tx.get(sr)]);
    assertRevision(m.data()?.revision, meeting.revision);
    assertRevision(s.data()?.revision, session.revision);
    if (m.data().status === "closed") throw new Error("Meeting closed.");
    tx.update(mr, {
      [type === "host" ? "hostUid" : "minutesUid"]: uid,
      revision: meeting.revision + 1,
    });
    if (type === "host")
      tx.update(sr, {
        hostUid: uid,
        revision: session.revision + 1,
        updatedAt: now(),
      });
    else
      tx.update(dr, {
        editorUid: uid,
        revision: increment(1),
        updatedAt: now(),
      });
    notice(tx, meeting.id, "handoff", meeting.revision + 1, uid);
  });
}
export async function saveMinutes(meetingId, draft, patch) {
  await runTransaction(db, async (tx) => {
    const mr = ref(meetingId),
      r = ref(meetingId, "minutes", "draft");
    const [m, d] = await Promise.all([tx.get(mr), tx.get(r)]);
    assertRevision(d.data()?.revision, draft.revision);
    if (
      m.data()?.status === "closed" &&
      d.data()?.status === "published" &&
      patch.status !== "draft"
    )
      throw new Error(
        "Published minutes are locked. Start a correction version.",
      );
    tx.update(r, { ...patch, revision: draft.revision + 1, updatedAt: now() });
    if (patch.status)
      tx.update(mr, {
        minutesStatus: patch.status,
        publishedVersion: draft.publishedVersion,
        minutesReviewRevision: draft.revision + 1,
        revision: m.data().revision + 1,
      });
  });
}
export async function publishMinutes(meeting, draft, agenda, attendance) {
  const record = publishedRecord(meeting, draft, agenda, attendance, S.members),
    version = record.publishedVersion;
  await runTransaction(db, async (tx) => {
    const r = ref(meeting.id, "minutes", "draft"),
      mr = ref(meeting.id);
    const [d, m] = await Promise.all([tx.get(r), tx.get(mr)]);
    assertRevision(d.data()?.revision, draft.revision);
    if (d.data().status !== "review")
      throw new Error("Send these minutes for review first.");
    tx.update(r, {
      status: "published",
      reviewedBy: S.me.id,
      publishedVersion: version,
      revision: draft.revision + 1,
      updatedAt: now(),
    });
    tx.update(mr, {
      minutesStatus: "published",
      publishedVersion: version,
      minutesReviewRevision: draft.revision + 1,
      revision: m.data().revision + 1,
    });
    tx.set(ref(meeting.id,'versions',String(version),'sections','agenda-0'),{entries:record.agenda.slice(0,6)});
    tx.set(ref(meeting.id,'versions',String(version),'sections','agenda-1'),{entries:record.agenda.slice(6,12)});
    tx.set(ref(meeting.id, "versions", String(version)), {
      termId: meeting.termId,
      revision: version,
      draftRevision: draft.revision + 1,
      publishedAt: record.publishedAt,
      publishedByUid: S.me.id,
      record: { ...record, reviewedBy: S.me.id },
    });
    notice(tx, meeting.id, "published", version);
  });
}
export async function addTopic(meetingId, data) {
  if (data.order >= 12)
    throw new Error(
      "This meeting already has 12 agenda topics. Combine related topics or defer work to another meeting.",
    );
  const r = doc(collection(db, "meetings", meetingId, "agenda"));
  await runTransaction(db, async (tx) => {
    tx.set(r, {
      termId: S.term.termId,
      title: data.title,
      presenterUid: data.presenterUid || null,
      duration: data.duration || 5,
      order: data.order || 0,
      status: "queued",
      projectIds: [],
      taskIds: [],
      confirmedOutcome: "",
      confirmedDecisions: "",
      references: [],
    });
  });
  return r.id;
}
export async function updateTopic(meetingId, topic, patch) {
  await runTransaction(db, async (tx) => {
    const r = ref(meetingId, "agenda", topic.id);
    const current = await tx.get(r);
    for (const key of Object.keys(patch)) {
      if (
        topic[key] !== undefined &&
        JSON.stringify(current.data()?.[key]) !== JSON.stringify(topic[key])
      )
        throw new Error(
          "This topic changed elsewhere. Your draft is retained.",
        );
    }
    tx.update(r, patch);
  });
}
export async function contribute(meetingId, data) {
  const r = doc(collection(db, "meetings", meetingId, "contributions"));
  await runTransaction(db, async (tx) => {
    tx.set(r, {
      termId: S.term.termId,
      authorUid: S.me.id,
      topicId: data.topicId || null,
      type: data.type,
      text: data.text,
      createdAt: now(),
      status: "submitted",
    });
  });
}
export async function attendance(meetingId, uid, status) {
  await runTransaction(db, async (tx) =>
    tx.set(ref(meetingId, "attendance", uid), {
      termId: S.term.termId,
      uid,
      status,
    }),
  );
}
export async function resolveContribution(meetingId, id, status) {
  await runTransaction(db, async (tx) => {
    const r = ref(meetingId, "contributions", id);
    await tx.get(r);
    tx.update(r, { status });
  });
}
export async function saveSensitive(meetingId, uid, data) {
  await runTransaction(db, async (tx) =>
    tx.set(ref(meetingId, "sensitive", uid), {
      termId: S.term.termId,
      uid,
      ...data,
    }),
  );
}
export async function captureMeetingAction(meeting, draft, data) {
  if (draft.actions.length >= 10)
    throw new Error(
      "Use at most 10 captured actions in a minutes version. Additional tasks remain available in the linked project.",
    );
  const parent = S.items.find((x) => x.id === data.projectId);
  if (!parent || !meeting.projectIds.includes(parent.id))
    throw new Error("Choose a project explicitly allowed for this meeting.");
  const r = doc(collection(db, "items")),
    at = now();
  await runTransaction(db, async (tx) => {
    const mr = ref(meeting.id),
      dr = ref(meeting.id, "minutes", "draft");
    const [m, d] = await Promise.all([tx.get(mr), tx.get(dr)]);
    assertRevision(d.data()?.revision, draft.revision);
    if (m.data().status !== "live")
      throw new Error("Task capture is available during the live meeting.");
    const action = {
      text: data.text,
      ownerUid: data.ownerUid || null,
      dueDate: data.dueDate || null,
      status: "todo",
      taskId: r.id,
    };
    tx.set(r, {
      termId: meeting.termId,
      parentId: parent.id,
      ancestors: [...parent.ancestors, parent.id],
      leadUids: parent.leadUids || [],
      leadUid: null,
      kind: "task",
      title: data.text,
      notes: "",
      link: "",
      assigneeUids: data.ownerUid ? [data.ownerUid] : [],
      createdByUid: S.me.id,
      status: "todo",
      blocked: false,
      blockedReason: "",
      blockedOnUid: null,
      startDate: null,
      dueDate: data.dueDate || null,
      assignedAt: data.ownerUid ? at : null,
      completedAt: null,
      archived: false,
      isDeal: false,
      dealStage: "Lead",
      pledgedIdr: 0,
      receivedIdr: 0,
      createdAt: at,
      updatedAt: at,
      touchedAt: serverTimestamp(),
      meetingId: meeting.id,
    });
    tx.update(dr, {
      actions: [...draft.actions, action],
      revision: draft.revision + 1,
      updatedAt: at,
    });
    notice(tx, meeting.id, "action", draft.revision + 1, data.ownerUid || null);
  });
}

export async function saveTopicMinutes(meetingId, topicId, current, patch) {
  await runTransaction(db, async (tx) => {
    const r = ref(meetingId, "topicMinutes", topicId),
      snapshot = await tx.get(r);
    assertRevision(snapshot.data()?.revision || 0, current?.revision || 0);
    tx.set(r, {
      termId: S.term.termId,
      revision: (current?.revision || 0) + 1,
      discussion: current?.discussion || "",
      outcome: current?.outcome || "",
      ...patch,
      updatedAt: now(),
    });
  });
}

export async function markMeetingRead(meeting, revision) {
  await setDoc(doc(db, "meetingReads", `${meeting.id}_${S.me.id}`), {
    termId: meeting.termId,
    uid: S.me.id,
    meetingId: meeting.id,
    revision,
    updatedAt: now(),
  });
}
