import { useEffect, useState } from "preact/hooks";
import {
  collection,
  documentId,
  getDocs,
  startAfter,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { S, fail, toast } from "./store.js";
import { isAdmin } from "./model.js";
import {
  assertRevision,
  makeProposal,
  previewEventDefaults,
  requestTransition,
  validateProposal,
} from "./event-model.js";

// A shared request stream keeps the global attention surface and Calendar on one listener.
const requestStreams = new Map();
export function subscribeEventRequests(termId, uid, admin, receive, error) {
  const key = `${termId}:${uid}:${admin}`;
  let stream = requestStreams.get(key);
  if (!stream) {
    stream = { subscribers: new Set(), rows: null, error: null };
    requestStreams.set(key, stream);
    stream.stop = onSnapshot(
      query(
        collection(db, "eventRequests"),
        where("termId", "==", termId),
        ...(!admin ? [where("createdByUid", "==", uid)] : []),
        orderBy("updatedAt", "desc"),
        orderBy(documentId(), "desc"),
        limit(50),
      ),
      (s) => {
        stream.rows = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        stream.error = null;
        for (const sub of stream.subscribers) sub.receive(stream.rows);
      },
      (e) => {
        stream.error = e;
        for (const sub of stream.subscribers) sub.error(e);
      },
    );
  }
  const sub = { receive, error };
  stream.subscribers.add(sub);
  if (stream.rows) receive(stream.rows);
  if (stream.error) error(stream.error);
  return () => {
    stream.subscribers.delete(sub);
    if (!stream.subscribers.size) {
      stream.stop();
      requestStreams.delete(key);
    }
  };
}
export function useEventPolicy() {
  const [data, setData] = useState({
    settings: null,
    templates: [],
    groups: [],
    requests: [],
    ready: false,
    error: "",
  });
  const termId = S.term?.termId,
    uid = S.me?.id,
    admin = isAdmin();
  useEffect(() => {
    if (!termId || !uid) return;
    let alive = true;
    const loaded = new Set();
    setData({
      settings: null,
      templates: [],
      groups: [],
      requests: [],
      ready: false,
      error: "",
    });
    const receive = (key, value) => {
      loaded.add(key);
      if (alive)
        setData((v) => ({ ...v, [key]: value, ready: loaded.size === 4 }));
    };
    const error = (e) =>
      alive &&
      setData((v) => ({
        ...v,
        error: `Event settings did not load (${e.code}). Reload to try again.`,
      }));
    const stops = [
      onSnapshot(
        doc(db, "settings/eventDefaults"),
        (d) =>
          receive(
            "settings",
            d.exists() && d.data().termId === termId ? d.data() : null,
          ),
        error,
      ),
      onSnapshot(
        query(collection(db, "eventTemplates"), where("archived", "==", false)),
        (s) =>
          receive(
            "templates",
            s.docs.map((d) => ({ id: d.id, ...d.data() })),
          ),
        error,
      ),
      onSnapshot(
        query(
          collection(db, "eventParticipantGroups"),
          where("termId", "==", termId),
          where("archived", "==", false),
        ),
        (s) =>
          receive(
            "groups",
            s.docs.map((d) => ({ id: d.id, ...d.data() })),
          ),
        error,
      ),
      subscribeEventRequests(
        termId,
        uid,
        admin,
        (requests) => receive("requests", requests),
        error,
      ),
    ];
    return () => {
      alive = false;
      stops.forEach((s) => s());
    };
  }, [termId, uid, admin]);
  return data;
}
async function attempt(fn, message) {
  try {
    await runTransaction(db, fn);
    toast(message);
    return true;
  } catch (e) {
    fail(e);
    return false;
  }
}
const checkWriter = () => {
  if (!S.me || S.me.role === "teacher")
    throw new Error("Your role cannot change events.");
};
const checkAdmin = () => {
  if (!isAdmin()) throw new Error("Only an admin can change event settings.");
};
const reference = (path) => doc(collection(db, path));
async function currentProposal(
  tx,
  data,
  templateId,
  frozenParticipants,
  snapshot,
) {
  if (snapshot) {
    // Immutable history supplies definitions. The copied defaults are display metadata.
    const historicalSettings =
      snapshot.settingsVersion > 0
        ? await tx.get(
            doc(
              db,
              "settings",
              "eventDefaults",
              "versions",
              `${S.term.termId}_${snapshot.settingsVersion}`,
            ),
          )
        : null;
    const historicalTemplate =
      snapshot.templateId && snapshot.templateVersion > 0
        ? await tx.get(
            doc(
              db,
              "eventTemplates",
              snapshot.templateId,
              "versions",
              String(snapshot.templateVersion),
            ),
          )
        : null;
    const canonicalSettings = historicalSettings?.exists()
      ? historicalSettings.data()
      : {
          version: snapshot.settingsVersion,
          defaults: { approval: snapshot.approval },
        };
    const canonicalTemplate = historicalTemplate?.exists()
      ? { id: snapshot.templateId, ...historicalTemplate.data() }
      : null;
    const groupRows = [];
    for (const id of data.participantSelection?.groupIds || []) {
      const g = await tx.get(doc(db, "eventParticipantGroups", id));
      if (g.exists() && g.data().termId === S.term.termId)
        groupRows.push({ id, ...g.data() });
    }
    const proposal = makeProposal({
      settings: canonicalSettings,
      template: canonicalTemplate,
      edits: { ...data, approval: snapshot.approval },
      members: S.members,
      groups: groupRows,
      frozenParticipants,
    });
    proposal.configSnapshot = snapshot;
    const error = validateProposal(proposal);
    if (error) throw new Error(error);
    return proposal;
  }
  const settingsDoc = await tx.get(doc(db, "settings/eventDefaults"));
  const templateDoc = templateId
    ? await tx.get(doc(db, "eventTemplates", templateId))
    : null;
  const settings =
    settingsDoc.exists() && settingsDoc.data().termId === S.term.termId
      ? settingsDoc.data()
      : null;
  if (
    templateId &&
    (!templateDoc.exists() ||
      templateDoc.data().archived ||
      templateDoc.data().available === false)
  )
    throw new Error(
      "This template is no longer available. Choose another template.",
    );
  const template = templateDoc?.exists()
    ? { id: templateDoc.id, ...templateDoc.data() }
    : null;
  // Read group configuration transactionally; use the subscribed roster snapshot to avoid a roster refetch on every edit.
  const groupIds =
    data.participantSelection?.groupIds ||
    template?.defaults?.participantSelection?.groupIds ||
    settings?.defaults?.participantSelection?.groupIds ||
    [];
  const groups = [];
  for (const id of groupIds) {
    const g = await tx.get(doc(db, "eventParticipantGroups", id));
    if (g.exists() && g.data().termId === S.term.termId)
      groups.push({ id, ...g.data() });
  }
  const members = S.members;
  const proposal = makeProposal({
    settings,
    template,
    edits: data,
    members,
    groups,
    frozenParticipants,
  });
  const error = validateProposal(proposal);
  if (error) throw new Error(error);
  return proposal;
}
function requestVersion(tx, ref, revision, proposal, at) {
  tx.set(
    doc(db, "eventRequests", ref.id, "proposals", String(revision)),
    proposal,
  );
}
export function saveEventProposal({
  event = null,
  request = null,
  data,
  templateId = null,
  draft = false,
  participantsChanged = true,
}) {
  const requestRef = request
    ? doc(db, "eventRequests", request.id)
    : reference("eventRequests");
  const eventRef = event ? doc(db, "events", event.id) : reference("events");
  return attempt(
    async (tx) => {
      checkWriter();
      const existing = request ? await tx.get(requestRef) : null;
      const old = event ? await tx.get(eventRef) : null;
      if (request) {
        if (!existing.exists())
          throw new Error("This request no longer exists.");
        assertRevision(existing.data().revision, request.revision);
        if (
          (!isAdmin() && existing.data().createdByUid !== S.me.id) ||
          !(
            isAdmin()
              ? ["draft", "awaiting", "changes-requested"]
              : ["draft", "changes-requested"]
          ).includes(existing.data().state)
        )
          throw new Error("Only your draft or returned request can be edited.");
      }
      if (event) {
        if (!old.exists()) throw new Error("This event no longer exists.");
        assertRevision(old.data().revision, event.revision);
      }
      const proposal = await currentProposal(
        tx,
        data,
        templateId,
        !participantsChanged
          ? event?.participantUids || request?.proposal?.participantUids
          : undefined,
        request?.proposal?.configSnapshot || event?.configSnapshot,
      );
      if (request && isAdmin() && !draft) {
        const reviewed = existing.data(),
          approvedRef = doc(
            db,
            "events",
            reviewed.replacesEventId || request.id,
          ),
          approvedSnapshot = await tx.get(approvedRef),
          prior = approvedSnapshot.exists() ? approvedSnapshot.data() : null;
        if (reviewed.replacesEventId) {
          if (!prior || prior.archived)
            throw new Error("The existing event was cancelled or removed.");
          assertRevision(prior.revision, reviewed.baseEventRevision);
        } else if (prior)
          throw new Error("This request already has a scheduled event.");
        const at = Date.now(),
          revision = (prior?.revision || 0) + 1;
        tx.set(
          approvedRef,
          {
            ...proposal,
            termId: reviewed.termId,
            createdByUid: prior?.createdByUid || reviewed.createdByUid,
            archived: false,
            requestId: request.id,
            revision,
            createdAt: prior?.createdAt || at,
            updatedAt: at,
          },
          { merge: true },
        );
        tx.update(requestRef, {
          proposal,
          state: "scheduled",
          revision: reviewed.revision + 1,
          eventId: approvedRef.id,
          reviewedByUid: S.me.id,
          reviewNote: reviewed.reviewNote || "",
          updatedAt: at,
        });
        requestVersion(tx, requestRef, reviewed.revision + 1, proposal, at);
        tx.set(doc(db, "activity", `event_${approvedRef.id}_${revision}`), {
          termId: S.term.termId,
          actorUid: S.me.id,
          type: "event",
          itemId: approvedRef.id,
          text: `edited, approved and scheduled event: ${proposal.title}`,
          createdAt: at,
        });
        return;
      }
      const at = Date.now(),
        needsApproval =
          !isAdmin() &&
          (proposal.configSnapshot.approval === "required" ||
            (event && proposal.type === "meeting" && event.type !== "meeting") ||
            !!event?.requestId);
      if (draft || needsApproval || request) {
        tx.set(requestRef, {
          termId: S.term.termId,
          createdByUid: request?.createdByUid || S.me.id,
          state: draft ? "draft" : "awaiting",
          revision: (request?.revision || 0) + 1,
          proposal,
          eventId: null,
          replacesEventId: event?.id || request?.replacesEventId || null,
          baseEventRevision: event
            ? event.revision || 0
            : (request?.baseEventRevision ?? null),
          reviewedByUid: request?.reviewedByUid || null,
          reviewNote: request?.reviewNote || "",
          createdAt: request?.createdAt || at,
          updatedAt: at,
        });
        requestVersion(
          tx,
          requestRef,
          (request?.revision || 0) + 1,
          proposal,
          at,
        );
      } else {
        tx.set(
          eventRef,
          {
            ...proposal,
            termId: S.term.termId,
            createdByUid: event?.createdByUid || S.me.id,
            archived: false,
            requestId: event?.requestId || null,
            revision: (event?.revision || 0) + 1,
            createdAt: event?.createdAt || at,
            updatedAt: at,
          },
          { merge: true },
        );
        tx.set(
          doc(
            db,
            "activity",
            `event_${eventRef.id}_${(event?.revision || 0) + 1}`,
          ),
          {
            termId: S.term.termId,
            actorUid: S.me.id,
            type: "event",
            itemId: eventRef.id,
            text: `${event ? "updated" : "scheduled"} event: ${proposal.title}`,
            createdAt: at,
          },
        );
      }
    },
    draft
      ? "Draft saved."
      : "Event saved. Events requiring approval appear in Requests.",
  );
}
export function transitionEventRequest(request, next, reason = "") {
  const ref = doc(db, "eventRequests", request.id);
  return attempt(
    async (tx) => {
      checkWriter();
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("This request no longer exists.");
      const r = snap.data();
      assertRevision(r.revision, request.revision);
      if (!requestTransition(r.state, next, isAdmin()))
        throw new Error(
          "This request has already changed. Open its latest version.",
        );
      const reviewing = ["scheduled", "changes-requested", "declined"].includes(
        next,
      );
      if (reviewing && !isAdmin())
        throw new Error("Only an admin can review requests.");
      if (!reviewing && r.createdByUid !== S.me.id && !isAdmin())
        throw new Error("Only the requester can make this change.");
      if (["changes-requested", "declined"].includes(next) && !reason.trim())
        throw new Error("Add a reason so the requester knows what to change.");
      let eventRef = null,
        event = null;
      if (next === "scheduled") {
        eventRef = doc(db, "events", r.replacesEventId || request.id);
        const d = await tx.get(eventRef);
        event = d.exists() ? d.data() : null;
        if (r.replacesEventId) {
          if (!event) throw new Error("The original event no longer exists.");
          assertRevision(event.revision, r.baseEventRevision);
          if (event.archived)
            throw new Error(
              "The original event was cancelled. Create a new request.",
            );
        } else if (event)
          throw new Error("An event is already linked to this request.");
      }
      if (next === "cancelled") {
        eventRef = doc(db, "events", r.eventId);
        const d = await tx.get(eventRef);
        event = d.exists() ? d.data() : null;
        if (!event || event.requestId !== request.id || event.archived)
          throw new Error(
            "This event was replaced or already cancelled. Open its latest request.",
          );
      }
      const at = Date.now();
      if (next === "scheduled")
        tx.set(
          eventRef,
          {
            ...r.proposal,
            termId: r.termId,
            createdByUid: event?.createdByUid || r.createdByUid,
            archived: false,
            requestId: request.id,
            revision: (event?.revision || 0) + 1,
            createdAt: event?.createdAt || at,
            updatedAt: at,
          },
          { merge: true },
        );
      if (next === "cancelled" && event)
        tx.update(eventRef, {
          archived: true,
          revision: (event.revision || 0) + 1,
          updatedAt: at,
        });
      tx.update(ref, {
        state: next,
        revision: r.revision + 1,
        eventId: next === "scheduled" ? eventRef.id : r.eventId,
        reviewedByUid: reviewing ? S.me.id : r.reviewedByUid,
        reviewNote: reason.trim().slice(0, 1000),
        updatedAt: at,
      });
      requestVersion(tx, ref, r.revision + 1, r.proposal, at);
      tx.set(reference("activity"), {
        termId: S.term.termId,
        actorUid: S.me.id,
        type: "event",
        itemId: eventRef?.id || null,
        text: `${next.replaceAll("-", " ")} event request: ${r.proposal.title}`,
        createdAt: at,
      });
    },
    next === "scheduled"
      ? "Event approved and scheduled."
      : `Request ${next.replaceAll("-", " ")}.`,
  );
}
export function saveEventConfiguration(kind, old, data) {
  const path = {
    settings: "settings",
    template: "eventTemplates",
    group: "eventParticipantGroups",
  }[kind];
  const ref =
    kind === "settings"
      ? doc(db, path, "eventDefaults")
      : old
        ? doc(db, path, old.id)
        : reference(path);
  return attempt(async (tx) => {
    checkAdmin();
    const d = await tx.get(ref);
    const currentVersion = d.exists() ? d.data().version : 0;
    if (!(
      kind === "settings" &&
      d.exists() &&
      d.data().termId !== S.term.termId &&
      !old
    ))
      assertRevision(currentVersion, old?.version || 0);
    if (
      kind === "template" &&
      (!data.description?.trim() || !data.name?.trim())
    )
      throw new Error("Add a template name and description.");
    if ((data.defaults?.customFields || []).length > 4)
      throw new Error("Use at most 4 custom fields.");
    const ids = new Set();
    for (const f of data.defaults?.customFields || []) {
      if (
        !/^[a-zA-Z0-9_-]{1,60}$/.test(f.id) ||
        ids.has(f.id) ||
        !f.label?.trim() ||
        f.label.length > 80 ||
        !["text", "textarea", "select", "checkbox"].includes(f.type) ||
        (f.options || []).length > 20
      )
        throw new Error("Check custom field IDs, labels and options.");
      ids.add(f.id);
    }
    const at = Date.now(),
      body = {
        ...data,
        version: currentVersion + 1,
        updatedAt: at,
        ...(kind === "settings"
          ? { termId: S.term.termId, updatedByUid: S.me.id }
          : {
              createdByUid: old?.createdByUid || S.me.id,
              createdAt: old?.createdAt || at,
              archived: !!data.archived,
            }),
        ...(kind === "group" ? { termId: S.term.termId } : {}),
      };
    tx.set(ref, body);
    if (kind === "settings")
      tx.set(
        doc(
          db,
          "settings",
          "eventDefaults",
          "versions",
          `${body.termId}_${body.version}`,
        ),
        body,
      );
    if (kind === "template")
      tx.set(
        doc(db, "eventTemplates", ref.id, "versions", String(body.version)),
        body,
      );
  }, "Event settings saved. Existing invitations stay unchanged.");
}

// Explicit admin migration. All selected event revisions/config versions are checked before any write.
export function applyEventDefaults(events, policy, replaceInvitations = false) {
  return attempt(async (tx) => {
    checkAdmin();
    if (!events.length || events.length > 10)
      throw new Error("Select between 1 and 10 events.");
    const settingsDoc = await tx.get(doc(db, "settings/eventDefaults"));
    const settings =
      settingsDoc.exists() && settingsDoc.data().termId === S.term.termId
        ? settingsDoc.data()
        : null;
    assertRevision(settings?.version, policy.settings?.version);
    const results = [];
    for (const event of events) {
      const ref = doc(db, "events", event.id),
        snap = await tx.get(ref);
      if (!snap.exists() || snap.data().archived)
        throw new Error("An event was cancelled. Refresh the preview.");
      assertRevision(snap.data().revision, event.revision);
      const templateId = event.configSnapshot?.templateId,
        templateDoc = templateId
          ? await tx.get(doc(db, "eventTemplates", templateId))
          : null;
      const template = templateDoc?.exists()
        ? { id: templateDoc.id, ...templateDoc.data() }
        : null;
      const previewTemplate = policy.templates.find((t) => t.id === templateId);
      assertRevision(template?.version, previewTemplate?.version);
      if (template && (template.archived || template.available === false))
        throw new Error("A template is unavailable. Refresh the preview.");
      const groups = [];
      if (replaceInvitations)
        for (const id of template?.defaults?.participantSelection?.groupIds ||
          settings?.defaults?.participantSelection?.groupIds ||
          []) {
          const d = await tx.get(doc(db, "eventParticipantGroups", id));
          if (d.exists() && d.data().termId === S.term.termId) {
            const group = { id, ...d.data() };
            assertRevision(
              group.version,
              policy.groups.find((g) => g.id === id)?.version,
            );
            groups.push(group);
          }
        }
      const preview = previewEventDefaults(
        event,
        settings,
        template,
        replaceInvitations,
        S.members,
        groups,
      );
      if (preview.error) throw new Error(`${event.title}: ${preview.error}`);
      results.push({ ref, event, proposal: preview.proposal });
    }
    const at = Date.now();
    for (const { ref, event, proposal } of results) {
      const revision = (event.revision || 0) + 1;
      tx.set(ref, { ...proposal, revision, updatedAt: at }, { merge: true });
      tx.set(doc(db, "activity", `event_${ref.id}_${revision}`), {
        termId: S.term.termId,
        actorUid: S.me.id,
        type: "event",
        itemId: ref.id,
        text: `explicitly applied event defaults: ${event.title}`,
        createdAt: at,
      });
    }
  }, "Selected events updated from the reviewed defaults.");
}

export async function loadEventRequestHistory(after) {
  const snapshot = await getDocs(
    query(
      collection(db, "eventRequests"),
      where("termId", "==", S.term.termId),
      ...(!isAdmin() ? [where("createdByUid", "==", S.me.id)] : []),
      orderBy("updatedAt", "desc"),
      orderBy(documentId(), "desc"),
      ...(after ? [startAfter(after.updatedAt, after.id)] : []),
      limit(25),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function archiveEventRecord(event, archived = true) {
  return attempt(
    async (tx) => {
      checkWriter();
      const ref = doc(db, "events", event.id),
        snapshot = await tx.get(ref);
      if (!snapshot.exists()) throw new Error("This event no longer exists.");
      const current = snapshot.data();
      assertRevision(current.revision, event.revision);
      if (!isAdmin() && current.createdByUid !== S.me.id)
        throw new Error(
          "Only the event owner or an administrator can archive or restore it.",
        );
      if (!isAdmin() && current.requestId && !archived)
        throw new Error(
          "Ask an administrator to restore an approved meeting or submit a new request.",
        );
      const revision = (current.revision || 0) + 1,
        at = Date.now();
      tx.update(ref, { archived, revision, updatedAt: at });
      tx.set(doc(db, "activity", `event_${event.id}_${revision}`), {
        termId: S.term.termId,
        actorUid: S.me.id,
        type: "event",
        itemId: event.id,
        text: `${archived ? "archived" : "restored"} event: ${current.title}`,
        createdAt: at,
      });
    },
    archived ? "Event archived." : "Event restored.",
  );
}
