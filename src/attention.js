import { useEffect } from "preact/hooks";
import {
  and,
  collection,
  doc,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { S, fail, set, subscribe } from "./store.js";
import { isAdmin } from "./model.js";
import { isoDay } from "./time.js";
import { subscribeEventRequests } from "./event-actions.js";
import { deriveAttention } from "./attention-model.js";

// Mount once in the authenticated app shell. Read markers belong to the recipient; source documents decide audiences.
export function useAttention(allowed = true) {
  const uid = S.me?.id,
    termId = S.term?.termId,
    admin = isAdmin(),
    enabled = allowed && S.phase === "ready";
  useEffect(() => {
    set({
      attention: [],
      attentionUnread: 0,
      attentionReady: false,
      attentionError: "",
    });
    if (!enabled || !uid || !termId) return;
    let alive = true,
      requests = [],
      meetings = [],
      invitations = [],
      reads = {},
      lastEvents = S.events,
      lastItems = S.items,
      lastDay = S.day;
    const ready = new Set();
    const rebuild = () => {
      if (!alive) return;
      const attention = deriveAttention({
        uid,
        admin,
        requests,
        meetings,
        reads,
        events: [
          ...new Map(
            [...S.events, ...invitations].map((e) => [e.id, e]),
          ).values(),
        ],
        items: S.items,
        today: isoDay(),
      });
      set({
        attention,
        attentionUnread: attention.filter((x) => !x.read).length,
        attentionReady: ready.size === 4,
      });
    };
    const lost = (e) =>
      alive &&
      set({
        attentionError: `Some updates did not load (${e.code || "connection error"}). Reload to reconnect.`,
      });
    const stops = [
      onSnapshot(
        query(
          collection(db, "events"),
          where("termId", "==", termId),
          where("participantUids", "array-contains", uid),
          orderBy("updatedAt", "desc"),
          limit(50),
        ),
        (s) => {
          invitations = s.docs.map((d) => ({ id: d.id, ...d.data() }));
          ready.add("invitations");
          rebuild();
        },
        lost,
      ),
      subscribeEventRequests(
        termId,
        uid,
        admin,
        (rows) => {
          requests = rows;
          ready.add("requests");
          rebuild();
        },
        lost,
      ),
      onSnapshot(
        query(
          collection(db, "attentionReads", uid, "items"),
          where("termId", "==", termId),
        ),
        (s) => {
          reads = Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
          ready.add("reads");
          rebuild();
        },
        lost,
      ),
      onSnapshot(
        query(
          collection(db, "meetings"),
          admin ? where("termId", "==", termId) : and(
            where("termId", "==", termId),
            or(
              where("participantUids", "array-contains", uid),
              where("hostUid", "==", uid),
              where("chairUid", "==", uid),
              where("minutesUid", "==", uid),
              where("minutesBackupUid", "==", uid),
              where("cohostUids", "array-contains", uid),
            ),
          ),
          orderBy("date", "desc"),
          limit(50),
        ),
        (s) => {
          meetings = s.docs.map((d) => ({ id: d.id, ...d.data() }));
          ready.add("meetings");
          rebuild();
        },
        lost,
      ),
      subscribe(() => {
        if (
          S.events !== lastEvents ||
          S.items !== lastItems ||
          S.day !== lastDay
        ) {
          lastEvents = S.events;
          lastItems = S.items;
          lastDay = S.day;
          rebuild();
        }
      }),
    ];
    return () => {
      alive = false;
      stops.forEach((f) => f());
    };
  }, [uid, termId, admin, enabled]);
  return S.attention || [];
}
export async function markAttentionRead(entry) {
  if (!S.me || entry.read) return;
  try {
    await setDoc(doc(db, "attentionReads", S.me.id, "items", entry.id), {
      termId: S.term.termId,
      uid: S.me.id,
      sourceId: entry.sourceId,
      revision: entry.revision,
      updatedAt: Date.now(),
    });
  } catch (e) {
    fail(e);
  }
}
