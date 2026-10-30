// One store for the session: auth phase, the live listeners and derived indexes.
// Core listeners (settings, members, items, check-ins, notifications) block the app until loaded and raise the global
// error banner. Optional ones (events, announcements, templates, feed) keep their own error in S.fail and never block.
import { useEffect, useReducer } from 'preact/hooks';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Timestamp, clearIndexedDbPersistence, collection, doc, getDoc, limit, onSnapshot, orderBy, query, terminate, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { isoDay, week } from './time.js';
import { announcementsQuery, eventsQuery } from './queries.js';

export const S = {
  phase: 'loading', user: null, me: null, term: null, digest: null, members: [], items: [], checkins: [], notes: [],
  events: [], announcements: [], docTemplates: [], feed: null, cacheInfo: null, cacheFull: false, publishError: '',
  ready: {}, fail: {}, cached: {}, weekId: null, day: null, toast: '', error: '', undo: null,
};
const subs = new Set();
export function set(patch) { Object.assign(S, patch); subs.forEach((f) => f()); }
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }
export function useStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => subscribe(force), []);
  return S;
}
let toastTimer;
export function toast(msg, undo = null) {
  set({ toast: msg, undo });
  clearTimeout(toastTimer);
  if (!undo) toastTimer = setTimeout(() => set({ toast: '', undo: null }), 4000); // an undo stays until used or dismissed
}
export const fail = (e) => toast(e.code === 'permission-denied'
  ? 'That did not save: your role is not allowed to make this change.'
  : e.code === 'resource-exhausted' ? quotaText() : `That did not save (${e.code || e.message}). Check your connection and try again.`);

export const memberName = (email) => S.members.find((m) => m.id === email)?.name || email || 'Unknown';
export const unreadCount = () => S.notes.filter((n) => !n.read).length;

// The free plan's daily reads reset at midnight Pacific time, which is mid-afternoon in Jakarta.
function quotaText() {
  const la = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const left = 86400e3 - ((la.getHours() * 60 + la.getMinutes()) * 60 + la.getSeconds()) * 1e3;
  const at = new Date(Date.now() + left).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  return `The council's free daily limit is used up. It resets at ${at} Jakarta time.`;
}

let stops = [], termStops = [], dayStops = [], gen = 0;
const stopAll = (list) => { list.forEach((f) => f()); list.length = 0; };
const lost = (e) => set({ error: e.code === 'resource-exhausted' ? quotaText() : `Live updates stopped (${e.code}). Reload the page.` });
const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
// One shape for items from the snapshot document and from listeners: touchedAt as milliseconds.
export const itemRow = (d) => {
  const x = { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) };
  x.touchedAt = x.touchedAt?.toMillis ? x.touchedAt.toMillis() : x.touchedAt ?? null;
  return x;
};
const meta = { includeMetadataChanges: true }; // also fires when a cached result is confirmed by the server
function listen(list, q, key, map = rows, optional = false) {
  list.push(onSnapshot(q, meta, (s) => set({
    [key]: map(s), ready: { ...S.ready, [key]: true }, cached: { ...S.cached, [key]: s.metadata.fromCache },
    ...(optional && S.fail[key] ? { fail: { ...S.fail, [key]: '' } } : {}),
  }), (e) => (optional && e.code !== 'resource-exhausted' ? set({ fail: { ...S.fail, [key]: e.code || 'error' } }) : lost(e))));
}
// True once the data every screen depends on has arrived, so no form starts from an empty copy.
export const loaded = () => S.ready.items && S.ready.checkins && S.ready.members;

// Items: one read for the term's snapshot document, then only the items changed since it was built.
// Without a snapshot (first deploy, new term) or if the change query fails, fall back to every item.
const allItems = (termId) => listen(termStops, query(collection(db, 'items'), where('termId', '==', termId), where('archived', '==', false)),
  'items', (s) => s.docs.map(itemRow));
async function startItems(termId, my) {
  let cache = null;
  try { const d = await getDoc(doc(db, 'cache', termId)); if (d.exists()) cache = d.data(); } catch { /* fall back below */ }
  if (my !== gen) return;
  let base = null;
  try { base = JSON.parse(cache?.json); } catch { /* a damaged snapshot is ignored */ }
  if (!Array.isArray(base) || typeof cache.at?.toMillis !== 'function') { set({ cacheInfo: null }); return allItems(termId); }
  const at = cache.at.toMillis();
  set({ cacheInfo: { at, updatedAt: cache.updatedAt, delta: 0 } });
  const since = Timestamp.fromMillis(at - 60e3); // covers writes whose request time came just before their commit
  termStops.push(onSnapshot(query(collection(db, 'items'), where('termId', '==', termId), where('touchedAt', '>=', since)), meta, (s) => {
    const byId = new Map(base.map((x) => [x.id, x]));
    for (const d of s.docs) { const x = itemRow(d); if (x.archived) byId.delete(x.id); else byId.set(x.id, x); }
    set({ items: [...byId.values()], ready: { ...S.ready, items: true }, cached: { ...S.cached, items: s.metadata.fromCache },
      cacheInfo: { ...S.cacheInfo, delta: s.size } });
  }, (e) => {
    if (e.code === 'resource-exhausted') return lost(e);
    set({ fail: { ...S.fail, delta: e.code || 'error' } });
    if (my === gen) allItems(termId);
  }));
}

function startDay(termId) {
  stopAll(dayStops);
  const day = isoDay();
  set({ day, ready: { ...S.ready, events: false, announcements: false } });
  listen(dayStops, eventsQuery(termId, day), 'events', rows, true);
  listen(dayStops, announcementsQuery(termId, day), 'announcements', rows, true);
}

function startTerm(termId) {
  stopAll(termStops);
  const w = week(), my = ++gen;
  set({ weekId: w.id, ready: { ...S.ready, items: false, checkins: false } });
  startItems(termId, my);
  listen(termStops, query(collection(db, 'checkins'), where('termId', '==', termId), where('weekId', 'in', [w.id, w.lastId])), 'checkins');
  startDay(termId);
}
// An installed app stays open across midnight and Monday 00:00 Jakarta; follow the new day and week.
setInterval(() => {
  if (!S.term) return;
  if (S.weekId !== week().id) startTerm(S.term.termId);
  else if (S.day !== isoDay()) startDay(S.term.termId);
}, 60e3);

const isAdminRole = (r) => ['advisor', 'president', 'vp'].includes(r);
function start(email) {
  stops.push(onSnapshot(doc(db, 'settings/current'), (s) => {
    const term = s.data() || false;
    if (term?.termId !== S.term?.termId && term) startTerm(term.termId);
    set({ term });
  }, lost));
  stops.push(onSnapshot(doc(db, 'settings/digest'), (s) => set({ digest: s.data() || null }), lost));
  listen(stops, collection(db, 'members'), 'members');
  listen(stops, query(collection(db, 'notifications', email, 'items'), orderBy('createdAt', 'desc'), limit(50)), 'notes');
  listen(stops, query(collection(db, 'docTemplates'), where('archived', '==', false)), 'docTemplates', rows, true);
  let feedOn = false;
  stops.push(onSnapshot(doc(db, 'members', email), (s) => {
    const me = s.exists() && { id: s.id, ...s.data() };
    if (!me?.active) { set({ phase: 'no-roster' }); return signOut(auth); }
    set({ me, phase: 'ready' });
    // Only admin sessions read the feed document; they are the ones that publish it.
    if (isAdminRole(me.role) && !feedOn) { feedOn = true; listen(stops, doc(db, 'public', 'feed'), 'feed', (d) => d.data() || null, true); }
  }, () => { set({ phase: 'no-roster' }); signOut(auth); }));
}

export function boot(user) {
  stopAll(stops); stopAll(termStops); stopAll(dayStops);
  set({ ready: {}, fail: {}, cached: {}, error: '' });
  if (!user) return set({ user: null, me: null, term: null, items: [], phase: S.phase === 'no-roster' ? 'no-roster' : 'signed-out' });
  if (!user.emailVerified) return set({ user, phase: 'verify' });
  set({ user, phase: 'loading' });
  start(user.email.toLowerCase());
}
onAuthStateChanged(auth, boot);

// The Sign out button: also wipe this device's copy of council data (shared school computers). The wipe fails when
// another tab still has the app open, so it never blocks signing out.
export async function signOutHere() {
  await signOut(auth).catch(() => {});
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* another tab holds the cache */ }
  location.reload();
}
