// One store for the session: auth phase, the live listeners and derived indexes.
import { useEffect, useReducer } from 'preact/hooks';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { week } from './time.js';

export const S = {
  phase: 'loading', user: null, me: null, term: null, digest: null,
  members: [], items: [], checkins: [], notes: [], activity: [], unread: 0, ready: {}, weekId: null, toast: '', error: '', undo: null,
};
const subs = new Set();
export function set(patch) { Object.assign(S, patch); subs.forEach((f) => f()); }
export function useStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => { subs.add(force); return () => subs.delete(force); }, []);
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
  : `That did not save (${e.code || e.message}). Check your connection and try again.`);

export const memberName = (email) => S.members.find((m) => m.id === email)?.name || email || 'Unknown';

let stops = [], termStops = [];
const stopAll = (list) => { list.forEach((f) => f()); list.length = 0; };
const lost = (e) => set({ error: `Live updates stopped (${e.code}). Reload the page.` });
const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
const listen = (list, q, key, map = rows) =>
  list.push(onSnapshot(q, (s) => set({ [key]: map(s), ready: { ...S.ready, [key]: true } }), lost));
// True once the data every screen depends on has arrived, so no form starts from an empty copy.
export const loaded = () => S.ready.items && S.ready.checkins && S.ready.members;

function startTerm(termId) {
  stopAll(termStops);
  const w = week();
  set({ weekId: w.id, ready: { ...S.ready, items: false, checkins: false } });
  listen(termStops, query(collection(db, 'items'), where('termId', '==', termId), where('archived', '==', false)), 'items');
  listen(termStops, query(collection(db, 'checkins'), where('termId', '==', termId), where('weekId', 'in', [w.id, w.lastId])), 'checkins');
  listen(termStops, query(collection(db, 'activity'), where('termId', '==', termId), orderBy('createdAt', 'desc'), limit(50)), 'activity');
}
// An installed app stays open across Monday 00:00 Jakarta; follow the new week.
setInterval(() => { if (S.term && S.weekId !== week().id) startTerm(S.term.termId); }, 60e3);

function start(email) {
  stops.push(onSnapshot(doc(db, 'settings/current'), (s) => {
    const term = s.data() || false;
    if (term?.termId !== S.term?.termId && term) startTerm(term.termId);
    set({ term });
  }, lost));
  stops.push(onSnapshot(doc(db, 'settings/digest'), (s) => set({ digest: s.data() || null }), lost));
  listen(stops, collection(db, 'members'), 'members');
  listen(stops, query(collection(db, 'notifications', email, 'items'), orderBy('createdAt', 'desc'), limit(50)), 'notes');
  listen(stops, query(collection(db, 'notifications', email, 'items'), where('read', '==', false), limit(100)), 'unread', (s) => s.size);
  stops.push(onSnapshot(doc(db, 'members', email), (s) => {
    const me = s.exists() && { id: s.id, ...s.data() };
    if (me?.active) set({ me, phase: 'ready' }); else { set({ phase: 'no-roster' }); signOut(auth); }
  }, () => { set({ phase: 'no-roster' }); signOut(auth); }));
}

export function boot(user) {
  stopAll(stops); stopAll(termStops);
  set({ ready: {}, error: '' });
  if (!user) return set({ user: null, me: null, term: null, items: [], phase: S.phase === 'no-roster' ? 'no-roster' : 'signed-out' });
  if (!user.emailVerified) return set({ user, phase: 'verify' });
  set({ user, phase: 'loading' });
  start(user.email.toLowerCase());
}
onAuthStateChanged(auth, boot);
