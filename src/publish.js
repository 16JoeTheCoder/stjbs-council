// Admin-session jobs, no Cloud Functions needed: keep the public feed current and keep the item snapshot fresh.
// Both write only from fresh server reads, never from what a possibly stale phone has in memory.
import { Timestamp, collection, doc, getDocFromServer, getDocsFromServer, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, itemRow, loaded, set, subscribe } from './store.js';
import { isAdmin, progress, tree } from './model.js';
import { STAGE_WORD, feedPayload, hash } from './feed.js';
import { isoDay } from './time.js';
import { announcementsQuery, eventsQuery } from './queries.js';

const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));

// Root projects with the public flag, with counts from the store's task tree (counts are not personal).
function publicProjects(roots) {
  const { under } = tree();
  return roots.filter((r) => r.parentId == null && r.public === true && !r.archived).map((r) => {
    const p = progress(under(r.id));
    return { title: r.title, stage: STAGE_WORD[r.status] || 'Planning', pct: p.total ? Math.round((100 * p.done) / p.total) : 0,
      done: p.done, total: p.total, blurb: r.publicBlurb || '', updatedAt: r.updatedAt || 0 };
  });
}
export const feedJson = (roots, events, announcements, day = isoDay()) =>
  JSON.stringify(feedPayload({ projects: publicProjects(roots), events, announcements, day }));

// The store's own view of what the public site should show; used for the cheap "anything changed?" test.
export const localFeedHash = () => hash(feedJson(S.items, S.events, S.announcements));

// Safe to publish only when everything the payload reads has arrived from the server, without errors.
export const canPublish = () => isAdmin() && loaded() && !S.error && S.ready.events && S.ready.announcements && S.ready.feed
  && !S.fail.events && !S.fail.announcements && !S.fail.feed && !S.cached.items && !S.cached.events && !S.cached.announcements && !S.cached.feed;

let publishing = false;
export async function publish(force = false) {
  if (publishing || (!force && (!canPublish() || localFeedHash() === S.feed?.hash))) return false;
  publishing = true;
  try {
    const T = S.term.termId, day = isoDay();
    const [roots, events, anns, cur] = await Promise.all([
      getDocsFromServer(query(collection(db, 'items'), where('termId', '==', T), where('public', '==', true))),
      getDocsFromServer(eventsQuery(T, day)),
      getDocsFromServer(announcementsQuery(T, day)),
      getDocFromServer(doc(db, 'public', 'feed')),
    ]);
    const json = feedJson(rows(roots), rows(events), rows(anns), day), h = hash(json);
    if (!force && cur.exists() && cur.data().hash === h) return false;
    const b = writeBatch(db);
    b.set(doc(db, 'public', 'feed'), { json, hash: h, updatedAt: Date.now() });
    b.set(doc(collection(db, 'activity')), { termId: T, actorUid: S.me.id, type: 'published', itemId: null, text: 'published the public site', createdAt: Date.now() });
    await b.commit();
    set({ publishError: '' });
    return true;
  } catch (e) {
    set({ publishError: e.code || e.message });
    return false;
  } finally { publishing = false; }
}

// ---- Item snapshot: one document per term so a cold open reads 1 document instead of every item.

const CACHE_LIMIT = 700000, RETRY_MS = 6 * 3600e3, FULL_RETRY_MS = 24 * 3600e3, STALE_MS = 24 * 3600e3;
const tryKey = (T) => `council-cache-try-${T}`;
const lastTry = (T) => { try { return Number(localStorage.getItem(tryKey(T))) || 0; } catch { return 0; } };
const noteTry = (T, wait = 0) => { try { localStorage.setItem(tryKey(T), String(Date.now() + wait)); } catch {} };
export async function refreshCache(bulk = false) {
  const T = S.term?.termId;
  if (!T || !isAdmin() || !loaded() || S.error) return;
  const due = !S.cacheInfo || S.cacheInfo.delta > 50 || Date.now() - S.cacheInfo.updatedAt > STALE_MS || bulk;
  if (!due || (!bulk && Date.now() - lastTry(T) < RETRY_MS)) return; // a bulk change is a person's action, never a loop
  noteTry(T);
  try {
    const cur = await getDocFromServer(doc(db, 'cache', T));
    if (!bulk && cur.exists() && Date.now() - cur.data().updatedAt < STALE_MS && S.cacheInfo?.delta <= 50) return;
    const s = await getDocsFromServer(query(collection(db, 'items'), where('termId', '==', T), where('archived', '==', false)));
    const list = s.docs.map(itemRow);
    const json = JSON.stringify(list);
    if (json.length > CACHE_LIMIT) { noteTry(T, FULL_RETRY_MS - RETRY_MS); return set({ cacheFull: true }); }
    const at = Math.max(0, ...list.map((x) => x.touchedAt || 0));
    const b = writeBatch(db);
    b.set(doc(db, 'cache', T), { json, at: Timestamp.fromMillis(at), count: list.length, updatedAt: Date.now() });
    await b.commit();
    set({ cacheFull: false });
  } catch (e) { set({ publishError: e.code || e.message }); }
}

// Admin sessions: run once as soon as everything the jobs read has arrived from the server, then every 10 minutes.
export function startAdminJobs() {
  let first = true;
  const tick = () => { publish(); refreshCache(); };
  const unsub = subscribe(() => { if (first && canPublish()) { first = false; tick(); } });
  const timer = setInterval(tick, 10 * 60e3);
  return () => { unsub(); clearInterval(timer); };
}
