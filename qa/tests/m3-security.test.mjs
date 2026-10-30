// M3 security probes: the writes the new Projects, Ideas and shell code make, plus what a hostile client could add.
// Run (Ubuntu/WSL or VS Code terminal, repo root):
//   npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m3-security.test.mjs"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDocs, collection, query, where, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';

const T = '2026-27';
let env;
const P = { advisor: 'ariel@stjbs.sch.id', president: 'pres@stjbs.sch.id', vp: 'vp@stjbs.sch.id', treasurer: 'tres@stjbs.sch.id',
  secretary: 'sec@stjbs.sch.id', officer: 'off@stjbs.sch.id', teacher: 'teach@stjbs.sch.id', lead: 'lead@stjbs.sch.id', other: 'other@stjbs.sch.id' };
const as = (e) => env.authenticatedContext(e.split('@')[0], { email: e, email_verified: true }).firestore();
const item = (o) => ({
  termId: T, parentId: null, ancestors: [], leadUids: [], leadUid: null, kind: 'project', title: 'Carnival', notes: '', link: '',
  assigneeUids: [], createdByUid: P.advisor, status: 'todo', blocked: false, dueDate: '2026-11-01', archived: false, isDeal: false,
  dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdAt: 1, ...o,
});
// Same patch shape as updateItem in src/actions.js.
const patch = (p) => ({ ...p, updatedAt: Date.now(), touchedAt: serverTimestamp() });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-council', firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, 'settings/current'), { termId: T });
    for (const [k, e] of Object.entries(P)) await setDoc(doc(d, 'members', e), { role: ['lead', 'other'].includes(k) ? 'officer' : k, active: true, name: k, termId: T });
    await setDoc(doc(d, 'items/p'), item({ leadUids: [P.lead], leadUid: P.lead }));
    await setDoc(doc(d, 'items/team'), item({ kind: 'team', parentId: 'p', ancestors: ['p'], leadUids: [P.lead, P.other], leadUid: P.other }));
    await setDoc(doc(d, 'items/t'), item({ kind: 'task', parentId: 'p', ancestors: ['p'], leadUids: [P.lead], assigneeUids: [P.officer] }));
    await setDoc(doc(d, 'ideas/i1'), { termId: T, text: 'Movie night', authorUid: P.lead, voters: [P.lead], archived: false, createdAt: 1 });
  });
});

// ---- Pipeline "Move" (updateItem on a root project with { status })
test('Pipeline move: advisor, president, treasurer and the root lead succeed', async () => {
  for (const who of ['advisor', 'president', 'treasurer', 'lead']) await assertSucceeds(updateDoc(doc(as(P[who]), 'items/p'), patch({ status: 'doing' })));
});
test('Pipeline move: plain officer, teacher and a subteam-only lead are refused', async () => {
  for (const who of ['officer', 'teacher', 'other']) await assertFails(updateDoc(doc(as(P[who]), 'items/p'), patch({ status: 'doing' })));
});
test('Pipeline move: an invalid status value is refused', async () => {
  await assertFails(updateDoc(doc(as(P.advisor), 'items/p'), patch({ status: 'archived-ish' })));
});

// ---- Public switch (updateItem with { public })
test('Public switch: advisor, president and vp may set it on a root project', async () => {
  for (const who of ['advisor', 'president', 'vp']) await assertSucceeds(updateDoc(doc(as(P[who]), 'items/p'), patch({ public: true })));
});
test('Public switch: treasurer, secretary and the root lead cannot set it, nor publicBlurb', async () => {
  for (const who of ['treasurer', 'secretary', 'lead']) {
    await assertFails(updateDoc(doc(as(P[who]), 'items/p'), patch({ public: true })));
    await assertFails(updateDoc(doc(as(P[who]), 'items/p'), patch({ publicBlurb: 'hi' })));
  }
});
test('Public switch: an admin cannot flag a subteam or a task public', async () => {
  await assertFails(updateDoc(doc(as(P.advisor), 'items/team'), patch({ public: true })));
  await assertFails(updateDoc(doc(as(P.advisor), 'items/t'), patch({ public: true })));
});
test('Public switch: a lead cannot rename a project that is already public', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'items/p'), { public: true }));
  await assertFails(updateDoc(doc(as(P.lead), 'items/p'), patch({ title: 'Leaked name' })));
  await assertFails(updateDoc(doc(as(P.lead), 'items/p'), patch({ public: false })));
  await assertSucceeds(updateDoc(doc(as(P.lead), 'items/p'), patch({ notes: 'private notes are fine' })));
});
test('Public switch: a lead creating a child with public:true is refused; a root created public by a non-admin is refused', async () => {
  await assertFails(setDoc(doc(as(P.lead), 'items/new'), item({ kind: 'task', parentId: 'p', ancestors: ['p'], leadUids: [P.lead], public: true, touchedAt: serverTimestamp(), createdByUid: P.lead })));
  await assertFails(setDoc(doc(as(P.treasurer), 'items/newroot'), item({ public: true, touchedAt: serverTimestamp(), createdByUid: P.treasurer })));
});

// ---- Ideas
test('Idea vote: add and remove self once, as the Ideas screen does (arrayUnion / arrayRemove)', async () => {
  await assertSucceeds(updateDoc(doc(as(P.officer), 'ideas/i1'), { voters: arrayUnion(P.officer) }));
  await assertSucceeds(updateDoc(doc(as(P.officer), 'ideas/i1'), { voters: arrayRemove(P.officer) }));
});
test('Idea vote: voting for someone else, removing someone else and a teacher vote are refused', async () => {
  await assertFails(updateDoc(doc(as(P.officer), 'ideas/i1'), { voters: arrayUnion(P.other) }));
  await assertFails(updateDoc(doc(as(P.officer), 'ideas/i1'), { voters: arrayRemove(P.lead) }));
  await assertFails(updateDoc(doc(as(P.teacher), 'ideas/i1'), { voters: arrayUnion(P.teacher) }));
});
test('Idea archive: only advisor, president and vp; a plain officer, even the author, cannot', async () => {
  for (const who of ['officer', 'lead', 'treasurer', 'teacher']) await assertFails(updateDoc(doc(as(P[who]), 'ideas/i1'), { archived: true, updatedAt: Date.now() }));
  for (const who of ['advisor', 'president', 'vp']) await assertSucceeds(updateDoc(doc(as(P[who]), 'ideas/i1'), { archived: true, updatedAt: Date.now() }));
});
test('Idea edit: nobody can rewrite text or authorUid, admin included', async () => {
  for (const who of ['advisor', 'lead']) {
    await assertFails(updateDoc(doc(as(P[who]), 'ideas/i1'), { text: 'changed' }));
    await assertFails(updateDoc(doc(as(P[who]), 'ideas/i1'), { authorUid: P[who] }));
  }
});
test('Idea pin: teacher refused, a 141-character idea refused, voters other than [me] refused', async () => {
  const base = { termId: T, text: 'ok', authorUid: P.officer, voters: [P.officer], archived: false, createdAt: 1 };
  await assertSucceeds(setDoc(doc(as(P.officer), 'ideas/n1'), base));
  await assertFails(setDoc(doc(as(P.teacher), 'ideas/n2'), { ...base, authorUid: P.teacher, voters: [P.teacher] }));
  await assertFails(setDoc(doc(as(P.officer), 'ideas/n3'), { ...base, text: 'x'.repeat(141) }));
  await assertFails(setDoc(doc(as(P.officer), 'ideas/n4'), { ...base, voters: [P.officer, P.other] }));
});

// ---- Notifications: what the bell renders (S.notes). Documented gap, not a regression.
test('Notification: fromUid cannot be forged', async () => {
  await assertFails(setDoc(doc(as(P.officer), `notifications/${P.other}/items/n1`), { termId: T, toUid: P.other, fromUid: P.advisor, type: 'comment', itemId: 'p', text: 'x', read: false, createdAt: 1 }));
});
test('GAP (minor): a notification accepts any text length, any itemId and any type from any member including a teacher', async () => {
  const n = { termId: T, toUid: P.other, fromUid: P.teacher, type: 'whatever', itemId: '../../x?y', text: 'z'.repeat(50000), read: false, createdAt: 1 };
  await assertSucceeds(setDoc(doc(as(P.teacher), `notifications/${P.other}/items/n2`), n));
});

// ---- Rosters, and teachers as read-only
test('Roster: president cannot change role, active, or touch the advisor; vp cannot touch the advisor or self', async () => {
  const pres = as(P.president), vp = as(P.vp);
  await assertFails(updateDoc(doc(pres, `members/${P.officer}`), { role: 'vp', termId: T, updatedAt: 1 }));
  await assertFails(updateDoc(doc(pres, `members/${P.officer}`), { active: false, termId: T, updatedAt: 1 }));
  await assertFails(updateDoc(doc(pres, `members/${P.advisor}`), { name: 'x', termId: T, updatedAt: 1 }));
  await assertSucceeds(updateDoc(doc(pres, `members/${P.officer}`), { name: 'New name', section: 'sec 2', reportsTo: null, initials: 'NN', termId: T, updatedAt: 1 }));
  await assertFails(updateDoc(doc(vp, `members/${P.advisor}`), { role: 'officer', termId: T }));
  await assertFails(updateDoc(doc(vp, `members/${P.vp}`), { role: 'advisor', termId: T }));
  await assertFails(updateDoc(doc(vp, `members/${P.officer}`), { role: 'advisor', termId: T }));
});
test('Teacher: cannot write items, events, rsvps, ideas, comments-free; can read items and ideas', async () => {
  const t = as(P.teacher);
  await assertSucceeds(getDocs(query(collection(t, 'ideas'), where('termId', '==', T))));
  await assertFails(updateDoc(doc(t, 'items/t'), patch({ status: 'done' })));
  await assertFails(setDoc(doc(t, 'events/e'), { termId: T, title: 'x', type: 'other', date: '2026-11-01', start: '10:00', end: '11:00', location: '', notes: '', public: false, createdByUid: P.teacher, archived: false, createdAt: 1 }));
});

// ---- Poison documents: the UI calls stamp(createdAt), which throws RangeError on a missing or non-numeric value,
// and the app has no error boundary. These assert the SECURE expectation; a failing test is a demonstrated hole.
test('HOLE: a comment without a numeric createdAt is refused (otherwise the item page crashes for everyone)', async () => {
  await assertFails(setDoc(doc(as(P.officer), 'comments/poison'), { termId: T, itemId: 'p', authorUid: P.officer, text: 'hi' }));
  await assertFails(setDoc(doc(as(P.officer), 'comments/poison2'), { termId: T, itemId: 'p', authorUid: P.officer, text: 'hi', createdAt: 'x' }));
});
test('HOLE: a notification with a non-numeric createdAt is refused (otherwise the recipient bell crashes the app)', async () => {
  await assertFails(setDoc(doc(as(P.officer), `notifications/${P.other}/items/poison`), { termId: T, toUid: P.other, fromUid: P.officer, type: 'comment', itemId: 'p', text: 'hi', read: false, createdAt: 'x' }));
});
test('HOLE: an activity entry with a non-numeric createdAt is refused (otherwise the activity page crashes for everyone)', async () => {
  await assertFails(setDoc(doc(as(P.officer), 'activity/poison'), { termId: T, actorUid: P.officer, text: 'hi', createdAt: 'x' }));
});
test('HOLE (admin-only): a president cannot store a non-string section (search and Committees call string methods on it)', async () => {
  await assertFails(updateDoc(doc(as(P.president), `members/${P.officer}`), { section: 5, termId: T, updatedAt: 1 }));
});
