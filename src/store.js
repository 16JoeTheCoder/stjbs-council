// One store for the session: auth phase, the live listeners and derived indexes.
import { useEffect, useReducer } from 'preact/hooks';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { week } from './time.js';

export const S = {
  phase: 'loading', user: null, me: null, term: null, digest: null,
  members: [], items: [], checkins: [], notes: [], activity: [], toast: '', error: '',
};
const subs = new Set();
export function set(patch) { Object.assign(S, patch); subs.forEach((f) => f()); }
export function useStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => { subs.add(force); return () => subs.delete(force); }, []);
  return S;
}
let toastTimer;
export function toast(msg) { set({ toast: msg }); clearTimeout(toastTimer); toastTimer = setTimeout(() => set({ toast: '' }), 4000); }
export const fail = (e) => toast(`That did not save (${e.code || e.message}). Check your connection and try again.`);

export const memberName = (email) => S.members.find((m) => m.id === email)?.name || email || 'Unknown';

let stops = [], termStops = [];
const stopAll = (list) => { list.forEach((f) => f()); list.length = 0; };
const listen = (list, q, key, map = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))) =>
  list.push(onSnapshot(q, (s) => set({ [key]: map(s) }), (e) => set({ error: `Live updates stopped (${e.code}). Reload the page.` })));

function startTerm(termId) {
  stopAll(termStops);
  const w = week();
  listen(termStops, query(collection(db, 'items'), where('termId', '==', termId), where('archived', '==', false)), 'items');
  listen(termStops, query(collection(db, 'checkins'), where('termId', '==', termId), where('weekId', 'in', [w.id, w.lastId])), 'checkins');
  listen(termStops, query(collection(db, 'activity'), where('termId', '==', termId), orderBy('createdAt', 'desc'), limit(50)), 'activity');
}

function start(email) {
  stops.push(onSnapshot(doc(db, 'settings/current'), (s) => {
    const term = s.data() || false;
    if (term?.termId !== S.term?.termId && term) startTerm(term.termId);
    set({ term });
  }));
  stops.push(onSnapshot(doc(db, 'settings/digest'), (s) => set({ digest: s.data() || null })));
  listen(stops, collection(db, 'members'), 'members');
  listen(stops, query(collection(db, 'notifications', email, 'items'), orderBy('createdAt', 'desc'), limit(50)), 'notes');
  stops.push(onSnapshot(doc(db, 'members', email), (s) => {
    const me = s.exists() && { id: s.id, ...s.data() };
    if (me?.active) set({ me, phase: 'ready' }); else { set({ phase: 'no-roster' }); signOut(auth); }
  }, () => { set({ phase: 'no-roster' }); signOut(auth); }));
}

export function boot(user) {
  stopAll(stops); stopAll(termStops);
  if (!user) return set({ user: null, me: null, term: null, items: [], error: '', phase: S.phase === 'no-roster' ? 'no-roster' : 'signed-out' });
  if (!user.emailVerified) return set({ user, phase: 'verify' });
  set({ user, phase: 'loading' });
  start(user.email.toLowerCase());
}
onAuthStateChanged(auth, boot);
