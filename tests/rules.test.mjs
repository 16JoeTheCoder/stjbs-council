// Firestore rules tests. Run: npm run test:rules (VS Code terminal, repo root). Needs Java 11+.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const T = '2026-27';
let env;
const people = {
  advisor: 'ariel@stjbs.sch.id', president: 'pres@stjbs.sch.id', officer: 'off@stjbs.sch.id',
  lead: 'lead@stjbs.sch.id', teacher: 'teach@stjbs.sch.id', vp: 'vp@stjbs.sch.id',
};
const as = (email, verified = true) =>
  env.authenticatedContext(email.split('@')[0], { email, email_verified: verified }).firestore();
const item = (o) => ({
  termId: T, parentId: null, ancestors: [], leadUids: [], leadUid: null, kind: 'task', title: 't', notes: '', link: '',
  assigneeUids: [], createdByUid: people.advisor, status: 'todo', blocked: false, dueDate: '2026-11-01',
  archived: false, isDeal: false, createdAt: 1, ...o,
});

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-council', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'settings/current'), { termId: T, termName: T });
    for (const [role, email] of Object.entries(people))
      await setDoc(doc(db, 'members', email), { name: role, role: role === 'lead' ? 'officer' : role, active: true, termId: T });
    await setDoc(doc(db, 'items/p'), item({ kind: 'project', title: 'Carnival' }));
    await setDoc(doc(db, 'items/drinks'), item({ kind: 'team', parentId: 'p', ancestors: ['p'], leadUid: people.lead, leadUids: [people.lead] }));
    await setDoc(doc(db, 'items/food'), item({ kind: 'team', parentId: 'p', ancestors: ['p'] }));
    await setDoc(doc(db, 'items/t1'), item({ parentId: 'drinks', ancestors: ['p', 'drinks'], leadUids: [people.lead], assigneeUids: [people.officer] }));
    await setDoc(doc(db, 'items/t2'), item({ parentId: 'food', ancestors: ['p', 'food'] }));
  });
});

test('non-member denied', async () => {
  await assertFails(getDoc(doc(as('stranger@stjbs.sch.id'), 'items/t1')));
});
test('unverified email denied', async () => {
  await assertFails(getDoc(doc(as(people.officer, false), 'items/t1')));
  await assertSucceeds(getDoc(doc(as(people.officer), 'items/t1')));
});
test('member cannot create a root project; exec can', async () => {
  await assertFails(setDoc(doc(as(people.officer), 'items/x'), item({ kind: 'project', createdByUid: people.officer })));
  await assertSucceeds(setDoc(doc(as(people.president), 'items/x'), item({ kind: 'project', createdByUid: people.president })));
});
test('assignee can mark done but not change due date or assignees', async () => {
  const db = as(people.officer);
  await assertSucceeds(updateDoc(doc(db, 'items/t1'), { status: 'done', completedAt: 5 }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { dueDate: '2027-01-01' }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { assigneeUids: [] }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { pledgedIdr: 5 }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { isDeal: true }));
});
test('lead can assign inside their subtree but not outside', async () => {
  const db = as(people.lead);
  await assertSucceeds(updateDoc(doc(db, 'items/t1'), { assigneeUids: [people.vp] }));
  await assertFails(updateDoc(doc(db, 'items/t2'), { assigneeUids: [people.vp] }));
  await assertSucceeds(setDoc(doc(db, 'items/n'), item({ parentId: 'drinks', ancestors: ['p', 'drinks'], leadUids: [people.lead], createdByUid: people.lead })));
  await assertFails(setDoc(doc(db, 'items/m'), item({ parentId: 'food', ancestors: ['p', 'food'], createdByUid: people.lead })));
});
test('leadUids cannot be forged', async () => {
  await assertFails(updateDoc(doc(as(people.lead), 'items/t1'), { leadUids: [people.lead, people.officer] }));
  await assertFails(setDoc(doc(as(people.lead), 'items/q'), item({ parentId: 'drinks', ancestors: ['p', 'drinks'], leadUids: [], createdByUid: people.lead })));
});
test('lead change propagates in one batch', async () => {
  const db = as(people.president), b = writeBatch(db);
  b.update(doc(db, 'items/drinks'), { leadUid: people.vp, leadUids: [people.vp] });
  b.update(doc(db, 'items/t1'), { leadUids: [people.vp] });
  await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(as(people.president), 'items/food'), { leadUid: people.vp, leadUids: [people.lead] }));
});
test('teacher can comment but not edit tasks', async () => {
  const db = as(people.teacher);
  await assertSucceeds(setDoc(doc(db, 'comments/c1'), { termId: T, itemId: 't1', authorUid: people.teacher, text: 'Good', createdAt: 1 }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { status: 'done' }));
  await assertFails(setDoc(doc(db, 'comments/c2'), { termId: T, itemId: 't1', authorUid: people.teacher, text: 'x'.repeat(501), createdAt: 1 }));
  await assertFails(deleteDoc(doc(as(people.officer), 'comments/c1')));
  await assertSucceeds(deleteDoc(doc(db, 'comments/c1')));
});
test('nothing else can be deleted', async () => {
  await assertFails(deleteDoc(doc(as(people.advisor), 'items/t1')));
});
test('president cannot write settings/current; advisor can', async () => {
  await assertFails(setDoc(doc(as(people.president), 'settings/current'), { termId: 'x' }));
  await assertSucceeds(setDoc(doc(as(people.advisor), 'settings/current'), { termId: '2027-28', termName: '2027-28' }));
});
test('writes must carry the current termId', async () => {
  await assertFails(setDoc(doc(as(people.officer), 'activity/a'), { termId: 'old', actorUid: people.officer, type: 'x', text: '', createdAt: 1 }));
  await assertSucceeds(setDoc(doc(as(people.officer), 'activity/a'), { termId: T, actorUid: people.officer, type: 'x', text: '', createdAt: 1 }));
  await assertFails(setDoc(doc(as(people.officer), 'activity/b'), { termId: T, actorUid: people.vp, type: 'x', text: '', createdAt: 1 }));
});
test('stats readable only by advisor, president and vp', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'stats/s'), { termId: T }));
  for (const who of [people.advisor, people.president, people.vp]) await assertSucceeds(getDoc(doc(as(who), 'stats/s')));
  await assertFails(getDoc(doc(as(people.officer), 'stats/s')));
});
test('notifications readable only by their owner, sent only as yourself', async () => {
  const n = { termId: T, toUid: people.officer, fromUid: people.lead, type: 'comment', itemId: 't1', text: '', read: false, createdAt: 1 };
  await assertSucceeds(setDoc(doc(as(people.lead), `notifications/${people.officer}/items/n1`), n));
  await assertFails(setDoc(doc(as(people.vp), `notifications/${people.officer}/items/n2`), n));
  await assertSucceeds(getDoc(doc(as(people.officer), `notifications/${people.officer}/items/n1`)));
  await assertFails(getDoc(doc(as(people.lead), `notifications/${people.officer}/items/n1`)));
  await assertSucceeds(updateDoc(doc(as(people.officer), `notifications/${people.officer}/items/n1`), { read: true }));
});
test('check-ins: own document only', async () => {
  const c = { termId: T, weekId: '2026-W44', uid: people.officer, done: '', doing: '', blocked: '' };
  await assertSucceeds(setDoc(doc(as(people.officer), `checkins/${T}_2026-W44_${people.officer}`), c));
  await assertFails(setDoc(doc(as(people.vp), `checkins/${T}_2026-W44_${people.officer}`), c));
});
test('roster: non-school domain rejected, only advisor deactivates or makes advisors', async () => {
  const m = { name: 'X', role: 'officer', active: true, termId: T, section: '', reportsTo: null };
  await assertFails(setDoc(doc(as(people.president), 'members/x@gmail.com'), m));
  await assertSucceeds(setDoc(doc(as(people.president), 'members/new@stjbs.sch.id'), m));
  await assertFails(setDoc(doc(as(people.officer), 'members/new2@stjbs.sch.id'), m));
  await assertFails(updateDoc(doc(as(people.president), `members/${people.officer}`), { active: false }));
  await assertFails(updateDoc(doc(as(people.president), `members/${people.officer}`), { role: 'advisor' }));
  await assertSucceeds(updateDoc(doc(as(people.advisor), `members/${people.officer}`), { active: false }));
  await assertFails(getDoc(doc(as(people.officer), 'items/t1')));
});
