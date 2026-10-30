// Firestore rules tests. Run: npm run test:rules (VS Code terminal, repo root). Needs Java 11+.
// Writes use the same SDK calls as src/actions.js (serverTimestamp, arrayUnion, exact key sets).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, collection, query, where,
  serverTimestamp, arrayUnion, arrayRemove, Timestamp,
} from 'firebase/firestore';

const T = '2026-27';
let env;
const people = {
  advisor: 'ariel@stjbs.sch.id', president: 'pres@stjbs.sch.id', officer: 'off@stjbs.sch.id',
  lead: 'lead@stjbs.sch.id', teacher: 'teach@stjbs.sch.id', vp: 'vp@stjbs.sch.id', treasurer: 'tres@stjbs.sch.id',
};
const as = (email, verified = true) =>
  env.authenticatedContext(email.split('@')[0], { email, email_verified: verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const touch = { touchedAt: serverTimestamp() };
// Seeded items are legacy documents: no touchedAt, public or publicBlurb, like production data before this change.
const item = (o) => ({
  termId: T, parentId: null, ancestors: [], leadUids: [], leadUid: null, kind: 'task', title: 't', notes: '', link: '',
  assigneeUids: [], createdByUid: people.advisor, status: 'todo', blocked: false, dueDate: '2026-11-01',
  archived: false, isDeal: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdAt: 1, ...o,
});
const event = (o) => ({
  termId: T, title: 'Meeting', type: 'meeting', date: '2026-11-02', start: '15:30', end: '16:30', location: 'Room 2', notes: '',
  public: false, createdByUid: people.officer, archived: false, createdAt: 1, ...o,
});
const ann = (o) => ({
  termId: T, title: 'Hello', body: 'Body', audience: 'members', startDate: '2026-10-29', endDate: '2026-11-05',
  createdByUid: people.president, archived: false, createdAt: 1, ...o,
});
const tpl = (o) => ({ name: 'Proposal', kind: 'Doc', url: 'https://docs.google.com/document/d/abc/edit', version: 1, archived: false, createdAt: 1, ...o });
const sub = (o) => ({ type: 'new-template', name: 'Budget sheet', url: 'https://docs.google.com/spreadsheets/d/x/edit', note: '', byUid: people.officer, status: 'pending', archived: false, createdAt: 1, ...o });

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
      await setDoc(doc(db, 'members', email), { name: role, role: role === 'lead' ? 'officer' : role, active: true, termId: T, section: '', reportsTo: null });
    await setDoc(doc(db, 'items/p'), item({ kind: 'project', title: 'Carnival' }));
    await setDoc(doc(db, 'items/drinks'), item({ kind: 'team', parentId: 'p', ancestors: ['p'], leadUid: people.lead, leadUids: [people.lead] }));
    await setDoc(doc(db, 'items/food'), item({ kind: 'team', parentId: 'p', ancestors: ['p'] }));
    await setDoc(doc(db, 'items/t1'), item({ parentId: 'drinks', ancestors: ['p', 'drinks'], leadUids: [people.lead], assigneeUids: [people.officer] }));
    await setDoc(doc(db, 'items/t2'), item({ parentId: 'food', ancestors: ['p', 'food'] }));
    await setDoc(doc(db, 'events/e1'), event({}));
    await setDoc(doc(db, 'events/pub'), event({ public: true, createdByUid: people.treasurer }));
    await setDoc(doc(db, 'ideas/i1'), { termId: T, text: 'Movie night', authorUid: people.lead, voters: [people.lead], archived: false, createdAt: 1 });
    await setDoc(doc(db, 'docTemplates/d1'), tpl({}));
    await setDoc(doc(db, 'submissions/s1'), sub({}));
  });
});

// ---- Existing behaviour

test('non-member denied', async () => {
  await assertFails(getDoc(doc(as('stranger@stjbs.sch.id'), 'items/t1')));
});
test('unverified email denied', async () => {
  await assertFails(getDoc(doc(as(people.officer, false), 'items/t1')));
  await assertSucceeds(getDoc(doc(as(people.officer), 'items/t1')));
});
test('member cannot create a root project; exec can', async () => {
  await assertFails(setDoc(doc(as(people.officer), 'items/x'), item({ kind: 'project', createdByUid: people.officer, ...touch })));
  await assertSucceeds(setDoc(doc(as(people.president), 'items/x'), item({ kind: 'project', createdByUid: people.president, ...touch })));
});
test('assignee can mark done but not change due date or assignees', async () => {
  const db = as(people.officer);
  await assertSucceeds(updateDoc(doc(db, 'items/t1'), { status: 'done', completedAt: 5, updatedAt: 5, ...touch }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { dueDate: '2027-01-01', ...touch }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { assigneeUids: [], ...touch }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { pledgedIdr: 5, ...touch }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { isDeal: true, ...touch }));
});
test('lead can assign inside their subtree but not outside', async () => {
  const db = as(people.lead);
  await assertSucceeds(updateDoc(doc(db, 'items/t1'), { assigneeUids: [people.vp], ...touch }));
  await assertFails(updateDoc(doc(db, 'items/t2'), { assigneeUids: [people.vp], ...touch }));
  await assertSucceeds(setDoc(doc(db, 'items/n'), item({ parentId: 'drinks', ancestors: ['p', 'drinks'], leadUids: [people.lead], createdByUid: people.lead, ...touch })));
  await assertFails(setDoc(doc(db, 'items/m'), item({ parentId: 'food', ancestors: ['p', 'food'], createdByUid: people.lead, ...touch })));
});
test('leadUids cannot be forged', async () => {
  await assertFails(updateDoc(doc(as(people.lead), 'items/t1'), { leadUids: [people.lead, people.officer], ...touch }));
  await assertFails(setDoc(doc(as(people.lead), 'items/q'), item({ parentId: 'drinks', ancestors: ['p', 'drinks'], leadUids: [], createdByUid: people.lead, ...touch })));
});
test('lead change propagates in one batch', async () => {
  const db = as(people.president), b = writeBatch(db);
  b.update(doc(db, 'items/drinks'), { leadUid: people.vp, leadUids: [people.vp], ...touch });
  b.update(doc(db, 'items/t1'), { leadUids: [people.vp], ...touch });
  await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(as(people.president), 'items/food'), { leadUid: people.vp, leadUids: [people.lead], ...touch }));
});
test('teacher can comment but not edit tasks', async () => {
  const db = as(people.teacher);
  await assertSucceeds(setDoc(doc(db, 'comments/c1'), { termId: T, itemId: 't1', authorUid: people.teacher, text: 'Good', createdAt: 1 }));
  await assertFails(updateDoc(doc(db, 'items/t1'), { status: 'done', ...touch }));
  await assertFails(setDoc(doc(db, 'comments/c2'), { termId: T, itemId: 't1', authorUid: people.teacher, text: 'x'.repeat(501), createdAt: 1 }));
  await assertFails(deleteDoc(doc(as(people.officer), 'comments/c1')));
  await assertSucceeds(deleteDoc(doc(db, 'comments/c1')));
});
test('nothing else can be deleted', async () => {
  await assertFails(deleteDoc(doc(as(people.advisor), 'items/t1')));
  for (const path of ['events/e1', 'ideas/i1', 'docTemplates/d1', 'submissions/s1'])
    await assertFails(deleteDoc(doc(as(people.advisor), path)));
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
  const n = { termId: T, toUid: people.officer, fromUid: people.lead, type: 'mention', itemId: 't1', text: '', read: false, createdAt: 1 };
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
test('naming yourself lead does not grant create rights (G1-01)', async () => {
  const db = as(people.officer);
  await assertFails(setDoc(doc(db, 'items/x1'), item({ kind: 'team', parentId: 'food', ancestors: ['p', 'food'], leadUid: people.officer, leadUids: [people.officer], createdByUid: people.officer, ...touch })));
  await assertFails(setDoc(doc(db, 'items/x2'), item({ kind: 'team', parentId: 'p', ancestors: ['p'], leadUid: people.officer, leadUids: [people.officer], createdByUid: people.officer, ...touch })));
});
test('field values are validated (G1-10)', async () => {
  await assertFails(updateDoc(doc(as(people.officer), 'items/t1'), { status: 'hacked', ...touch }));
  await assertFails(setDoc(doc(as(people.president), 'members/z@stjbs.sch.id'), { name: 'Z', role: 'superuser', active: true, termId: T }));
  await assertFails(updateDoc(doc(as(people.lead), 'items/t1'), { pledgedIdr: -5, ...touch }));
  await assertFails(updateDoc(doc(as(people.lead), 'items/t1'), { notes: 'x'.repeat(2001), ...touch }));
});

// ---- Roster (roles table)

test('roster: school domain only; officers cannot add members', async () => {
  const m = { name: 'X', role: 'officer', active: true, termId: T, section: '', reportsTo: null };
  await assertFails(setDoc(doc(as(people.president), 'members/x@gmail.com'), m));
  await assertSucceeds(setDoc(doc(as(people.president), 'members/new@stjbs.sch.id'), m));
  await assertFails(setDoc(doc(as(people.officer), 'members/new2@stjbs.sch.id'), m));
});
test('roster: president adds only non-admin roles', async () => {
  const m = (role) => ({ name: 'X', role, active: true, termId: T, section: '', reportsTo: null });
  for (const role of ['officer', 'treasurer', 'secretary', 'teacher'])
    await assertSucceeds(setDoc(doc(as(people.president), `members/${role}2@stjbs.sch.id`), m(role)));
  for (const role of ['vp', 'president', 'advisor'])
    await assertFails(setDoc(doc(as(people.president), `members/${role}3@stjbs.sch.id`), m(role)));
});
test('roster: president edits name, section and reports-to only', async () => {
  const db = as(people.president), ref = doc(db, `members/${people.officer}`);
  await assertSucceeds(setDoc(ref, { name: 'Off', initials: 'O', section: 'Sec 1', reportsTo: people.vp, termId: T, updatedAt: 2 }, { merge: true }));
  await assertSucceeds(updateDoc(doc(db, `members/${people.vp}`), { name: 'Kevin', termId: T }));
  await assertFails(updateDoc(ref, { role: 'treasurer' }));
  await assertFails(updateDoc(ref, { active: false }));
  await assertFails(updateDoc(doc(db, `members/${people.advisor}`), { name: 'Mr. Ariel', termId: T }));
});
test('roster: vp changes any role and active flag except the advisor and their own', async () => {
  const db = as(people.vp);
  await assertSucceeds(updateDoc(doc(db, `members/${people.president}`), { role: 'officer', termId: T }));
  await assertSucceeds(updateDoc(doc(db, `members/${people.officer}`), { active: false, termId: T }));
  await assertSucceeds(updateDoc(doc(db, `members/${people.treasurer}`), { role: 'president', termId: T }));
  await assertFails(updateDoc(doc(db, `members/${people.lead}`), { role: 'advisor', termId: T }));
  await assertFails(updateDoc(doc(db, `members/${people.advisor}`), { active: false, termId: T }));
  await assertFails(updateDoc(doc(db, `members/${people.advisor}`), { name: 'A', termId: T }));
  await assertFails(updateDoc(doc(db, `members/${people.vp}`), { role: 'president', termId: T }));
  await assertSucceeds(setDoc(doc(db, 'members/new@stjbs.sch.id'), { name: 'N', role: 'president', active: true, termId: T }));
  await assertFails(setDoc(doc(db, 'members/new2@stjbs.sch.id'), { name: 'N', role: 'advisor', active: true, termId: T }));
});
test('roster: only the advisor assigns advisor; nobody changes their own role or active flag (G1-11)', async () => {
  await assertSucceeds(updateDoc(doc(as(people.advisor), `members/${people.officer}`), { role: 'advisor', termId: T }));
  await assertSucceeds(updateDoc(doc(as(people.advisor), `members/${people.lead}`), { active: false, termId: T }));
  await assertFails(getDoc(doc(as(people.lead), 'items/t1')));
  await assertFails(updateDoc(doc(as(people.advisor), `members/${people.advisor}`), { role: 'officer', termId: T }));
  await assertSucceeds(updateDoc(doc(as(people.advisor), `members/${people.advisor}`), { name: 'Mr. Ariel', termId: T }));
  await assertFails(updateDoc(doc(as(people.officer), `members/${people.officer}`), { role: 'president', termId: T }));
});

// ---- Items: touchedAt, public fields

test('item writes must stamp the server time', async () => {
  await assertFails(updateDoc(doc(as(people.lead), 'items/t1'), { title: 'x' }));
  await assertFails(updateDoc(doc(as(people.lead), 'items/t1'), { title: 'x', touchedAt: Timestamp.fromMillis(1) }));
  await assertSucceeds(updateDoc(doc(as(people.lead), 'items/t1'), { title: 'x', ...touch }));
});
test('legacy items without the new fields stay editable (L1-27)', async () => {
  await assertSucceeds(updateDoc(doc(as(people.officer), 'items/t1'), { status: 'doing', updatedAt: 3, ...touch }));
  await assertSucceeds(updateDoc(doc(as(people.president), 'items/p'), { title: 'Carnival 2026', ...touch }));
  await assertSucceeds(updateDoc(doc(as(people.lead), 'items/drinks'), { notes: 'n', ...touch }));
});
test('only advisor, president and vp set public and publicBlurb, on root projects only', async () => {
  await assertFails(updateDoc(doc(as(people.treasurer), 'items/p'), { public: true, ...touch }));
  await assertFails(updateDoc(doc(as(people.lead), 'items/drinks'), { publicBlurb: 'x', ...touch }));
  await assertFails(updateDoc(doc(as(people.vp), 'items/drinks'), { public: true, ...touch }));
  await assertFails(updateDoc(doc(as(people.vp), 'items/p'), { publicBlurb: 'x'.repeat(141), ...touch }));
  await assertSucceeds(updateDoc(doc(as(people.vp), 'items/p'), { public: true, publicBlurb: 'Our biggest event', ...touch }));
  await assertFails(setDoc(doc(as(people.treasurer), 'items/r'), item({ kind: 'project', createdByUid: people.treasurer, public: true, ...touch })));
  await assertSucceeds(setDoc(doc(as(people.treasurer), 'items/r2'), item({ kind: 'project', createdByUid: people.treasurer, public: false, ...touch })));
  await assertSucceeds(setDoc(doc(as(people.president), 'items/r3'), item({ kind: 'project', createdByUid: people.president, public: true, ...touch })));
});
test('a public project can be retitled only by an admin (L1-11)', async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'items/p'), { public: true, leadUids: [], leadUid: null }));
  await assertFails(updateDoc(doc(as(people.treasurer), 'items/p'), { title: 'My name here', ...touch }));
  await assertSucceeds(updateDoc(doc(as(people.treasurer), 'items/p'), { notes: 'fine', ...touch }));
  await assertSucceeds(updateDoc(doc(as(people.president), 'items/p'), { title: 'Carnival 2026', ...touch }));
});

// ---- Announcements

test('announcements: admins write, members read, teachers and officers cannot write', async () => {
  await assertSucceeds(setDoc(doc(as(people.president), 'announcements/a1'), ann({})));
  await assertSucceeds(getDoc(doc(as(people.teacher), 'announcements/a1')));
  await assertFails(setDoc(doc(as(people.officer), 'announcements/a2'), ann({ createdByUid: people.officer })));
  await assertFails(setDoc(doc(as(people.treasurer), 'announcements/a3'), ann({ createdByUid: people.treasurer })));
  await assertFails(setDoc(doc(as(people.vp), 'announcements/a4'), ann({ createdByUid: people.vp, endDate: '2026-10-01' })));
  await assertFails(setDoc(doc(as(people.vp), 'announcements/a5'), ann({ createdByUid: people.vp, audience: 'public' })));
  await assertFails(setDoc(doc(as(people.vp), 'announcements/a6'), ann({ createdByUid: people.vp, title: 'x'.repeat(81) })));
  await assertSucceeds(updateDoc(doc(as(people.vp), 'announcements/a1'), { archived: true, updatedAt: 2 }));
  await assertFails(updateDoc(doc(as(people.vp), 'announcements/a1'), { createdByUid: people.vp }));
});

// ---- Events and RSVPs

test('events: any non-teacher creates private events; only admins make them public', async () => {
  await assertSucceeds(setDoc(doc(as(people.officer), 'events/e2'), event({})));
  await assertFails(setDoc(doc(as(people.officer), 'events/e3'), event({ public: true })));
  await assertFails(setDoc(doc(as(people.teacher), 'events/e4'), event({ createdByUid: people.teacher })));
  await assertSucceeds(setDoc(doc(as(people.vp), 'events/e5'), event({ createdByUid: people.vp, public: true })));
  await assertFails(setDoc(doc(as(people.officer), 'events/e6'), event({ start: '16:00', end: '15:00' })));
  await assertFails(setDoc(doc(as(people.officer), 'events/e7'), event({ date: '2/11/2026' })));
});
test('events: creator or exec edits; public flag and public text only by admins', async () => {
  await assertSucceeds(updateDoc(doc(as(people.officer), 'events/e1'), { location: 'Hall' }));
  await assertFails(updateDoc(doc(as(people.lead), 'events/e1'), { location: 'Hall' }));
  await assertSucceeds(updateDoc(doc(as(people.treasurer), 'events/e1'), { location: 'Hall 2' }));
  await assertFails(updateDoc(doc(as(people.officer), 'events/e1'), { public: true }));
  await assertSucceeds(updateDoc(doc(as(people.vp), 'events/e1'), { public: true }));
  await assertFails(updateDoc(doc(as(people.treasurer), 'events/pub'), { title: 'Name of a student' }));
  await assertFails(updateDoc(doc(as(people.treasurer), 'events/pub'), { date: '2026-12-01' }));
  await assertFails(updateDoc(doc(as(people.treasurer), 'events/pub'), { public: false }));
  await assertSucceeds(updateDoc(doc(as(people.treasurer), 'events/pub'), { notes: 'internal' }));
  await assertSucceeds(updateDoc(doc(as(people.president), 'events/pub'), { title: 'Carnival night' }));
  await assertFails(updateDoc(doc(as(people.officer), 'events/e1'), { createdByUid: people.lead }));
});
test('rsvps: own document only, id and uid cannot be forged', async () => {
  const r = (uid, status = 'going') => ({ termId: T, eventId: 'e1', uid, status, archived: false, createdAt: 1 });
  await assertSucceeds(setDoc(doc(as(people.officer), `rsvps/e1_${people.officer}`), r(people.officer)));
  await assertSucceeds(setDoc(doc(as(people.officer), `rsvps/e1_${people.officer}`), r(people.officer, 'not')));
  await assertFails(setDoc(doc(as(people.officer), `rsvps/e1_${people.lead}`), r(people.lead)));
  await assertFails(setDoc(doc(as(people.officer), `rsvps/e1_${people.lead}`), r(people.officer)));
  await assertFails(setDoc(doc(as(people.officer), `rsvps/e1_${people.officer}`), r(people.officer, 'maybe')));
  await assertFails(setDoc(doc(as(people.teacher), `rsvps/e1_${people.teacher}`), r(people.teacher)));
  await assertFails(setDoc(doc(as(people.officer), `rsvps/nope_${people.officer}`), { ...r(people.officer), eventId: 'nope' }));
  await assertSucceeds(getDocs(query(collection(as(people.lead), 'rsvps'), where('eventId', '==', 'e1'))));
});

// ---- Ideas

test('ideas: create as yourself with only your own vote', async () => {
  const i = (o) => ({ termId: T, text: 'Open mic', authorUid: people.officer, voters: [people.officer], archived: false, createdAt: 1, ...o });
  await assertSucceeds(setDoc(doc(as(people.officer), 'ideas/i2'), i({})));
  await assertFails(setDoc(doc(as(people.officer), 'ideas/i3'), i({ voters: [people.officer, people.lead] })));
  await assertFails(setDoc(doc(as(people.officer), 'ideas/i4'), i({ text: 'x'.repeat(141) })));
  await assertFails(setDoc(doc(as(people.teacher), 'ideas/i5'), i({ authorUid: people.teacher, voters: [people.teacher] })));
});
test('ideas: vote and unvote only yourself, once', async () => {
  const ref = (who) => doc(as(who), 'ideas/i1');
  await assertSucceeds(updateDoc(ref(people.officer), { voters: arrayUnion(people.officer) }));
  await assertFails(updateDoc(ref(people.officer), { voters: [people.lead, people.officer, people.officer] }));
  await assertFails(updateDoc(ref(people.vp), { voters: [people.lead, people.officer, people.vp, people.vp, people.vp] }));
  await assertFails(updateDoc(ref(people.vp), { voters: [people.officer, people.vp] }));
  await assertFails(updateDoc(ref(people.vp), { voters: [people.lead, people.officer, people.president] }));
  await assertFails(updateDoc(ref(people.vp), { voters: [people.officer] }));
  await assertSucceeds(updateDoc(ref(people.officer), { voters: arrayRemove(people.officer) }));
  await assertFails(updateDoc(ref(people.teacher), { voters: arrayUnion(people.teacher) }));
});
test('ideas: only admins archive', async () => {
  await assertFails(updateDoc(doc(as(people.lead), 'ideas/i1'), { archived: true, updatedAt: 2 }));
  await assertSucceeds(updateDoc(doc(as(people.president), 'ideas/i1'), { archived: true, updatedAt: 2 }));
});

// ---- Document templates

test('docTemplates: admins write Google links only; a new url bumps the version', async () => {
  await assertSucceeds(getDoc(doc(as(people.teacher), 'docTemplates/d1')));
  await assertFails(setDoc(doc(as(people.treasurer), 'docTemplates/d2'), tpl({})));
  for (const url of ['https://drive.google.com/file/d/abc/view', 'https://drive.google.com/drive/folders/abc_1-2',
    'https://docs.google.com/spreadsheets/d/abc/edit#gid=0', 'https://docs.google.com/presentation/d/abc/edit?usp=sharing'].entries())
    await assertSucceeds(setDoc(doc(as(people.vp), `docTemplates/ok${url[0]}`), tpl({ url: url[1] })));
  for (const url of ['https://docs.google.com.evil.com/document/d/x', 'https://docs.google.com/url?q=https://evil.example',
    'http://docs.google.com/document/d/x', 'javascript:alert(1)', 'https://evil.example/https://docs.google.com/document/',
    'https://docs.google.com/document/../url?q=https://evil.com', 'https://docs.google.com/document/d/%2e%2e/url?q=x',
    'https://docs.google.com/document/d/x\n', 'https://docs.google.com@evil.com/document/d/x', 'https://DOCS.google.com/document/d/x'])
    await assertFails(setDoc(doc(as(people.vp), 'docTemplates/d4'), tpl({ url })));
  await assertFails(updateDoc(doc(as(people.vp), 'docTemplates/d1'), { url: 'https://docs.google.com/document/d/new/edit' }));
  await assertSucceeds(updateDoc(doc(as(people.vp), 'docTemplates/d1'), { url: 'https://docs.google.com/document/d/new/edit', version: 2 }));
  await assertFails(updateDoc(doc(as(people.vp), 'docTemplates/d1'), { version: 9 }));
});

// ---- Submissions

test('submissions: create as yourself; pending, or filed for archive', async () => {
  await assertSucceeds(setDoc(doc(as(people.officer), 'submissions/s2'), sub({})));
  await assertSucceeds(setDoc(doc(as(people.officer), 'submissions/s3'), sub({ type: 'archive', status: 'filed', projectId: 'p' })));
  await assertFails(setDoc(doc(as(people.officer), 'submissions/s4'), sub({ status: 'approved' })));
  await assertFails(setDoc(doc(as(people.officer), 'submissions/s5'), sub({ byUid: people.lead })));
  await assertFails(setDoc(doc(as(people.officer), 'submissions/s6'), sub({ type: 'template-edit' })));
  await assertSucceeds(setDoc(doc(as(people.officer), 'submissions/s7'), sub({ type: 'template-edit', targetId: 'd1' })));
  await assertFails(setDoc(doc(as(people.officer), 'submissions/s8'), sub({ url: 'https://example.com/x' })));
  await assertFails(setDoc(doc(as(people.teacher), 'submissions/s9'), sub({ byUid: people.teacher })));
});
test('submissions: read by author and admins only; queries must filter by author', async () => {
  await assertSucceeds(getDoc(doc(as(people.officer), 'submissions/s1')));
  await assertFails(getDoc(doc(as(people.lead), 'submissions/s1')));
  await assertSucceeds(getDoc(doc(as(people.vp), 'submissions/s1')));
  await assertFails(getDocs(collection(as(people.lead), 'submissions')));
  await assertSucceeds(getDocs(query(collection(as(people.lead), 'submissions'), where('byUid', '==', people.lead))));
  await assertSucceeds(getDocs(collection(as(people.president), 'submissions')));
});
test('submissions: only admins change status, and nothing else', async () => {
  await assertFails(updateDoc(doc(as(people.officer), 'submissions/s1'), { status: 'approved' }));
  await assertSucceeds(updateDoc(doc(as(people.vp), 'submissions/s1'), { status: 'approved' }));
  await assertFails(updateDoc(doc(as(people.vp), 'submissions/s1'), { url: 'https://docs.google.com/document/d/z' }));
  await assertFails(updateDoc(doc(as(people.vp), 'submissions/s1'), { status: 'deleted' }));
});
test('approving a template edit updates the template in the same batch', async () => {
  const db = as(people.president), b = writeBatch(db);
  b.update(doc(db, 'submissions/s1'), { status: 'approved' });
  b.update(doc(db, 'docTemplates/d1'), { url: 'https://docs.google.com/spreadsheets/d/x/edit', version: 2, updatedAt: 2 });
  await assertSucceeds(b.commit());
});

// ---- Public feed and item cache

test('public feed: anyone gets it, nobody lists, only admins write a small whitelisted document', async () => {
  const feed = { json: '{"v":1}', hash: 'abc', updatedAt: 1 };
  await assertSucceeds(setDoc(doc(as(people.vp), 'public/feed'), feed));
  await assertSucceeds(getDoc(doc(anon(), 'public/feed')));
  await assertFails(getDocs(collection(anon(), 'public')));
  await assertFails(setDoc(doc(as(people.treasurer), 'public/feed'), feed));
  await assertFails(setDoc(doc(anon(), 'public/feed'), feed));
  await assertFails(setDoc(doc(as(people.vp), 'public/feed'), { ...feed, updatedByUid: people.vp }));
  await assertFails(setDoc(doc(as(people.vp), 'public/feed'), { ...feed, json: 'x'.repeat(200001) }));
  await assertFails(setDoc(doc(as(people.vp), 'public/other'), feed));
});
test('item cache: members read, admins write the current term only, never a future at', async () => {
  const c = (o) => ({ json: '[]', at: Timestamp.fromMillis(0), count: 0, updatedAt: 1, ...o });
  await assertSucceeds(setDoc(doc(as(people.president), `cache/${T}`), c({})));
  await assertSucceeds(getDoc(doc(as(people.officer), `cache/${T}`)));
  await assertFails(getDoc(doc(anon(), `cache/${T}`)));
  await assertFails(setDoc(doc(as(people.lead), `cache/${T}`), c({})));
  await assertFails(setDoc(doc(as(people.president), 'cache/2019-20'), c({})));
  await assertFails(setDoc(doc(as(people.president), `cache/${T}`), c({ at: Timestamp.fromMillis(Date.now() + 864e5) })));
  await assertFails(setDoc(doc(as(people.president), `cache/${T}`), c({ termId: T })));
});

test('comments: at most 10 mentions', async () => {
  const c = (n) => ({ termId: T, itemId: 't1', authorUid: people.officer, text: 'hi', mentionUids: Array(n).fill(people.lead), createdAt: 1 });
  await assertSucceeds(setDoc(doc(as(people.officer), 'comments/m1'), c(2)));
  await assertFails(setDoc(doc(as(people.officer), 'comments/m2'), c(11)));
});

test('writes for an old term are refused in every term-scoped collection', async () => {
  const old = '2025-26';
  await assertFails(setDoc(doc(as(people.vp), 'announcements/o1'), ann({ termId: old, createdByUid: people.vp })));
  await assertFails(setDoc(doc(as(people.officer), 'events/o2'), event({ termId: old })));
  await assertFails(setDoc(doc(as(people.officer), 'ideas/o3'), { termId: old, text: 'x', authorUid: people.officer, voters: [people.officer], archived: false, createdAt: 1 }));
  await assertFails(setDoc(doc(as(people.officer), `rsvps/e1_${people.officer}`), { termId: old, eventId: 'e1', uid: people.officer, status: 'going', archived: false, createdAt: 1 }));
  await assertFails(setDoc(doc(as(people.president), 'items/o4'), item({ termId: old, kind: 'project', createdByUid: people.president, ...touch })));
});
test('a non-admin cannot add public fields to a legacy item, even false (L2-04)', async () => {
  await assertFails(updateDoc(doc(as(people.treasurer), 'items/p'), { public: false, ...touch }));
  await assertFails(updateDoc(doc(as(people.lead), 'items/drinks'), { publicBlurb: '', ...touch }));
  await assertSucceeds(updateDoc(doc(as(people.advisor), 'items/p'), { public: false, ...touch }));
});
test('approving a new template creates it in the same batch', async () => {
  const db = as(people.vp), b = writeBatch(db);
  b.update(doc(db, 'submissions/s1'), { status: 'approved' });
  b.set(doc(db, 'docTemplates/new1'), tpl({ name: 'Budget sheet', url: 'https://docs.google.com/spreadsheets/d/x/edit' }));
  await assertSucceeds(b.commit());
});
