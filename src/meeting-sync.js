import { useEffect, useRef, useState } from "preact/hooks";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { S } from "./store.js";
import { draftKey } from "./meeting-model.js";
function instrument(kind, key) {
  if (!import.meta.env.DEV) return;
  const metrics = (globalThis.__COUNCIL_MEETING_SYNC__ ||= {
    activeListeners: 0,
    snapshots: 0,
    events: [],
  });
  if (kind === "subscribe") metrics.activeListeners++;
  if (kind === "unsubscribe") metrics.activeListeners--;
  if (kind === "snapshot") metrics.snapshots++;
  metrics.events.push({ kind, key, at: performance.now() });
  if (metrics.events.length > 200) metrics.events.shift();
}
export function useMeeting(id, room = false) {
  const [data, setData] = useState({
    meeting: null,
    session: null,
    draft: null,
    agenda: [],
    contributions: [],
    attendance: [],
    versions: [],
    ready: false,
    error: "",
    pending: false,
    cached: true,
  });
  useEffect(() => {
    setData({
      meeting: null,
      session: null,
      draft: null,
      agenda: [],
      contributions: [],
      attendance: [],
      versions: [],
      ready: false,
      error: "",
      pending: false,
      cached: true,
    });
    if (!id) return;
    let draftStop = null,
      topicMinutesStop = null,
      noticeStop = null,
      rsvpStop = null;
    let alive = true;
    const errors = {},
      pendingFlags = {},
      cacheFlags = {},
      childStops = [];
    const update = (key, s, one = false) => {
      errors[key] = "";
      pendingFlags[key] = s.metadata.hasPendingWrites;
      cacheFlags[key] = s.metadata.fromCache;
      instrument("snapshot", key);
      if (key === "meeting" && s.exists()) {
        const m = s.data();
        startChildren();
        if (!room && !rsvpStop)
          rsvpStop = watch(
            "rsvps",
            query(
              collection(db, "rsvps"),
              where("termId", "==", m.termId),
              where("eventId", "==", m.eventId),
              limit(200),
            ),
          );
        const canReadNotices =
          !room &&
          (["advisor", "president", "vp"].includes(S.me.role) ||
            m.participantUids.includes(S.me.id));
        if (canReadNotices && !noticeStop)
          noticeStop = watch(
            "notices",
            query(
              collection(db, "meetings", id, "notices"),
              orderBy("createdAt", "desc"),
              limit(50),
            ),
          );
        if (!canReadNotices && noticeStop) {
          noticeStop();
          noticeStop = null;
        }
        const allowed =
          !room &&
          (["advisor", "president", "vp"].includes(S.me.role) ||
            m.minutesUid === S.me.id);
        if (allowed && !draftStop) {
          topicMinutesStop = watch(
            "topicMinutes",
            collection(db, "meetings", id, "topicMinutes"),
          );
          draftStop = watch(
            "draft",
            doc(db, "meetings", id, "minutes", "draft"),
            true,
          );
        }
        if (!allowed && draftStop) {
          draftStop();
          topicMinutesStop?.();
          topicMinutesStop = null;
          draftStop = null;
          setData((old) => ({ ...old, draft: null, topicMinutes: [] }));
        }
      }
      return setData((old) => ({
        ...old,
        [key]: one
          ? s.exists()
            ? { id: s.id, ...s.data() }
            : null
          : s.docs.map((d) => ({ id: d.id, ...d.data() })),
        ...(key === "meeting" ? { ready: true } : {}),
        pending: Object.values(pendingFlags).some(Boolean),
        cached: Object.values(cacheFlags).some(Boolean),
        error: Object.values(errors).filter(Boolean).join("; "),
      }));
    };
    const error = (key, e) => {
      errors[key] = `${key}: ${e.code || e.message}`;
      setData((old) => ({
        ...old,
        error: Object.values(errors).filter(Boolean).join("; "),
        ready: true,
      }));
    };
    const watch = (key, path, one = false) => {
      instrument("subscribe", key);
      let active = true;
      const stop = onSnapshot(
        path,
        { includeMetadataChanges: true },
        (s) => active && update(key, s, one),
        (e) => active && error(key, e),
      );
      return () => {
        if (!active) return;
        active = false;
        instrument("unsubscribe", key);
        stop();
        delete errors[key];
        delete pendingFlags[key];
        delete cacheFlags[key];
        if (alive)
          setData((old) => ({
            ...old,
            pending: Object.values(pendingFlags).some(Boolean),
            cached: Object.values(cacheFlags).some(Boolean),
            error: Object.values(errors).filter(Boolean).join("; "),
          }));
      };
    };
    function startChildren() {
      if (childStops.length) return;
      childStops.push(
        ...[
          watch("session", doc(db, "meetings", id, "session", "control"), true),
          watch(
            "agenda",
            query(
              collection(db, "meetings", id, "agenda"),
              orderBy("order"),
              limit(100),
            ),
          ),
          ...(!room
            ? [
                watch(
                  "contributions",
                  query(
                    collection(db, "meetings", id, "contributions"),
                    orderBy("createdAt"),
                    limit(200),
                  ),
                ),
                watch(
                  "attendance",
                  collection(db, "meetings", id, "attendance"),
                ),
                watch(
                  "versions",
                  query(
                    collection(db, "meetings", id, "versions"),
                    orderBy("revision", "desc"),
                    limit(10),
                  ),
                ),
              ]
            : []),
        ],
      );
    }
    const stops = [watch("meeting", doc(db, "meetings", id), true)];
    // A draft is only read by authenticated council viewers of this meeting, not the public site.
    // Draft listener is attached only after the meeting confirms editor/admin authorization.
    return () => {
      alive = false;
      stops.forEach((stop) => stop());
      childStops.forEach((stop) => stop());
      draftStop?.();
      topicMinutesStop?.();
      noticeStop?.();
      rsvpStop?.();
    };
  }, [id, room]);
  return data;
}
// A local buffer is independent of remote topic navigation. Dirty text is never reset by snapshots.
export function useMeetingBuffer(
  id,
  field,
  remote,
  save,
  autosave = true,
  contextToken = null,
) {
  const key = draftKey(id, S.me.id, field);
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? remote ?? "";
    } catch {
      return remote ?? "";
    }
  });
  const [status, setStatus] = useState("Saved"),
    [conflict, setConflict] = useState(false);
  const dirty = useRef(false),
    saving = useRef(false),
    generation = useRef(0),
    base = useRef(remote),
    latest = useRef({ remote, save, value });
  const initialized = useRef(false),
    context = useRef(contextToken);
  useEffect(() => {
    if (context.current !== contextToken && dirty.current) {
      setConflict(true);
      setStatus(
        "Meeting lifecycle or editing responsibility changed. Review your retained draft before saving.",
      );
    }
    context.current = contextToken;
  }, [contextToken]);
  if (!initialized.current) {
    initialized.current = true;
    try {
      dirty.current = localStorage.getItem(key) !== null;
    } catch {}
  }
  latest.current = { remote, save, value };
  useEffect(() => {
    if (!dirty.current) {
      setValue(remote ?? "");
      base.current = remote;
    } else if (remote !== base.current && remote !== latest.current.value) {
      setConflict(true);
      setStatus(
        "Saved version changed. Compare it with your retained local draft.",
      );
    }
  }, [remote]);
  const edit = (value) => {
    if (!dirty.current) base.current = latest.current.remote;
    dirty.current = true;
    generation.current++;
    setValue(value);
    setStatus("Unsaved on this device");
    try {
      localStorage.setItem(key, value);
    } catch {}
  };
  const flush = async () => {
    if (!dirty.current || saving.current || conflict) return;
    if (
      latest.current.remote !== base.current &&
      latest.current.remote !== latest.current.value
    ) {
      setConflict(true);
      setStatus("Saved version changed. Review before saving.");
      return;
    }
    saving.current = true;
    const at = generation.current,
      submitted = latest.current.value;
    setStatus("Saving…");
    try {
      await latest.current.save(submitted);
      setConflict(false);
      base.current = submitted;
      if (at === generation.current) {
        dirty.current = false;
        setStatus("Saved");
        try {
          localStorage.removeItem(key);
        } catch {}
      } else setStatus("Unsaved on this device");
    } catch (e) {
      setStatus(`${e.message} Local draft retained.`);
      setConflict(true);
    } finally {
      saving.current = false;
    }
  };
  const reload = () => {
    dirty.current = false;
    base.current = latest.current.remote;
    setValue(latest.current.remote ?? "");
    setConflict(false);
    setStatus("Loaded saved version");
    try {
      localStorage.removeItem(key);
    } catch {}
  };
  const keep = () => {
    base.current = latest.current.remote;
    setConflict(false);
    setStatus(
      "Local draft selected. Save to replace the reviewed saved version.",
    );
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (!autosave || !dirty.current) return;
    const timer = setTimeout(() => flushRef.current(), 1200);
    return () => clearTimeout(timer);
  }, [value, autosave]);
  useEffect(() => {
    if (!autosave) return;
    const timer = setInterval(() => flushRef.current(), 1900);
    return () => clearInterval(timer);
  }, [key, autosave]);
  return {
    value,
    edit,
    flush,
    status,
    conflict,
    serverValue: remote ?? "",
    reload,
    keep,
  };
}
