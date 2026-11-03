// Firestore rules tests. Run: npm run test:rules (VS Code terminal, repo root). Needs Java 11+.
// Writes use the same SDK calls as src/actions.js (serverTimestamp, arrayUnion, exact key sets).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { makeProposal } from '../src/event-model.js';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc as sdkSetDoc, getDoc, getDocs, updateDoc as sdkUpdateDoc, deleteDoc, writeBatch as sdkWriteBatch, collection, query, where,
  serverTimestamp, arrayUnion, arrayRemove, Timestamp,
} from 'firebase/firestore';

// Requests carry an immutable, separately validated proposal for each workflow revision.
// These SDK helpers stage both writes atomically, as event-actions.js does; raw SDK writes test bypass denial below.
const requestPath = (ref) => /^eventRequests\/[^/]+$/.test(ref.path);
function writeBatch(db) {
  const batch = sdkWriteBatch(db), requests=[];
  const api = {set(ref,data,...options) {batch.set(ref,data,...options);if(requestPath(ref))requests.push({ref,data,create:true});if(/^meetings\/[^/]+\/versions\/[^/]+$/.test(ref.path)){batch.set(doc(db,ref.path,'sections','agenda-0'),{entries:data.record.agenda.slice(0,6)});batch.set(doc(db,ref.path,'sections','agenda-1'),{entries:data.record.agenda.slice(6)});}if(ref.path==='settings/eventDefaults')batch.set(doc(db,ref.path,'versions',data.termId+'_'+data.version),data);return api;},
    update(ref,data) {batch.update(ref,data);if(requestPath(ref))requests.push({ref,data});return api;},
    delete(ref) {batch.delete(ref);return api;},
    async commit() {for(const {ref,data,create} of requests){const proposal=data.proposal || (await getDoc(ref)).data().proposal;batch.set(doc(db,ref.path,'proposals',String(data.revision)),proposal);}return batch.commit();}};
  return api;
}
function setDoc(ref,data,...options) {if(!requestPath(ref) && ref.path!=='settings/eventDefaults')return sdkSetDoc(ref,data,...options);const b=writeBatch(ref.firestore);b.set(ref,data,...options);return b.commit();}
async function updateDoc(ref,data) {if(ref.path==='settings/eventDefaults'){const previous=(await getDoc(ref)).data();return setDoc(ref,{...previous,...data});}if(!requestPath(ref))return sdkUpdateDoc(ref,data);const b=writeBatch(ref.firestore);b.update(ref,data);return b.commit();}

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
  env = await initializeTestEnvironment({ projectId: 'demo-council-rules-upgrade', firestore: { rules: readFileSync(process.env.FIRESTORE_RULES_FILE || 'firestore.rules', 'utf8') } });
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

test('events: ordinary events are private; meetings require admin scheduling', async () => {
  const ordinary=makeProposal({settings:null,template:null,edits:{title:'Ordinary',type:'other',date:'2026-11-02',start:'15:30',end:'16:30',location:'Hall',notes:'',public:false,itemId:null,participantSelection:{groupIds:[],sections:[],includeUids:[],excludeUids:[]}},members:[],groups:[]});
  await assertSucceeds(setDoc(doc(as(people.officer), 'events/e2'), event({...ordinary,revision:1,requestId:null})));
  await assertFails(setDoc(doc(as(people.officer),'events/forged-default-role'),event({...ordinary,configSnapshot:{...ordinary.configSnapshot,defaults:{...ordinary.configSnapshot.defaults,minutesUid:people.officer}}})));
  await assertFails(setDoc(doc(as(people.officer), 'events/e3'), event({ public: true })));
  await assertFails(setDoc(doc(as(people.teacher), 'events/e4'), event({ createdByUid: people.teacher })));
  await assertSucceeds(setDoc(doc(as(people.vp), 'events/e5'), event({ createdByUid: people.vp, public: true })));
  await assertFails(setDoc(doc(as(people.officer), 'events/e6'), event({ start: '16:00', end: '15:00' })));
  await assertFails(setDoc(doc(as(people.officer), 'events/e7'), event({ date: '2/11/2026' })));
});
test('events: creator or exec edits; public flag and public text only by admins', async () => {
  await assertSucceeds(updateDoc(doc(as(people.officer), 'events/e1'), { location: 'Hall' }));
  await assertFails(updateDoc(doc(as(people.lead), 'events/e1'), { location: 'Hall' }));
  await assertFails(updateDoc(doc(as(people.treasurer), 'events/e1'), { location: 'Hall 2' }));
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

test('comments, notifications and activity need a numeric createdAt and bounded text (M3-S1)', async () => {
  const db = as(people.teacher);
  await assertFails(setDoc(doc(db, 'comments/bad1'), { termId: T, itemId: 't1', authorUid: people.teacher, text: 'x' }));
  await assertFails(setDoc(doc(db, 'comments/bad2'), { termId: T, itemId: 't1', authorUid: people.teacher, text: 'x', createdAt: 'soon' }));
  await assertFails(setDoc(doc(db, `notifications/${people.officer}/items/bad`), { termId: T, toUid: people.officer, fromUid: people.teacher, type: 'comment', itemId: 't1', text: 'x', read: false }));
  await assertFails(setDoc(doc(db, 'activity/bad'), { termId: T, actorUid: people.teacher, type: 'x', text: 'x'.repeat(301), createdAt: 1 }));
});
test('member fields are typed so a bad section cannot break screens', async () => {
  await assertFails(updateDoc(doc(as(people.president), `members/${people.officer}`), { section: { evil: true }, termId: T }));
  await assertFails(updateDoc(doc(as(people.president), `members/${people.officer}`), { name: '', termId: T }));
  await assertSucceeds(updateDoc(doc(as(people.president), `members/${people.officer}`), { section: 'Welfare', termId: T }));
});

test('teachers and the advisor do not write check-ins; new documents need a numeric createdAt', async () => {
  const c = (who) => ({ termId: T, weekId: '2026-W44', uid: who, done: 'x', doing: '', blocked: '' });
  await assertFails(setDoc(doc(as(people.teacher), `checkins/${T}_2026-W44_${people.teacher}`), c(people.teacher)));
  await assertFails(setDoc(doc(as(people.advisor), `checkins/${T}_2026-W44_${people.advisor}`), c(people.advisor)));
  await assertFails(setDoc(doc(as(people.officer), 'events/nodate'), { ...event({}), createdAt: 'now' }));
  await assertFails(setDoc(doc(as(people.vp), 'announcements/nodate'), { ...ann({ createdByUid: people.vp }), createdAt: null }));
});

// ---- Bulk roster: the app writes these as one batch each (src/actions.js bulkAddMembers and bulkDeactivate).
const bulkMember = (role, extra = {}) => ({ name: 'N', initials: 'N', role, section: 'Sec 3', reportsTo: null, active: true, createdAt: 1, termId: T, updatedAt: 1, ...extra });
test('bulk add: one batch of many members works for advisor and vp, president only for allowed roles, officers never', async () => {
  const mk = (who, roleFor, tag) => { const db = as(who), b = writeBatch(db); for (let i = 0; i < 40; i++) b.set(doc(db, `members/${tag}${i}@stjbs.sch.id`), bulkMember(roleFor(i))); return b; };
  await assertSucceeds(mk(people.advisor, (i) => (i % 2 ? 'president' : 'officer'), 'adv').commit());
  await assertSucceeds(mk(people.vp, (i) => (i % 2 ? 'vp' : 'secretary'), 'vp').commit());
  await assertSucceeds(mk(people.president, () => 'officer', 'pr').commit());
  await assertFails(mk(people.president, (i) => (i === 7 ? 'vp' : 'officer'), 'badpr-').commit()); // one bad row refuses the whole batch
  await assertFails(mk(people.vp, (i) => (i === 3 ? 'advisor' : 'officer'), 'badvp-').commit());
  await assertFails(mk(people.officer, () => 'officer', 'of').commit());
  await env.withSecurityRulesDisabled(async (ctx) => {
    assert.equal((await getDoc(doc(ctx.firestore(), 'members/badpr-0@stjbs.sch.id'))).exists(), false);
    assert.equal((await getDoc(doc(ctx.firestore(), 'members/pr0@stjbs.sch.id'))).exists(), true);
  });
});

test('bulk deactivate: advisor and vp batch-deactivate, never an advisor for a vp, never yourself, never as president or officer', async () => {
  const off = (db, ids) => { const b = writeBatch(db); for (const id of ids) b.update(doc(db, `members/${id}`), { active: false, termId: T, updatedAt: 1 }); return b; };
  const ids = [people.officer, people.lead, people.teacher];
  await assertFails(off(as(people.president), ids).commit());
  await assertFails(off(as(people.officer), ids).commit());
  await assertFails(off(as(people.vp), [people.officer, people.advisor]).commit());
  await assertFails(off(as(people.vp), [people.officer, people.vp]).commit());
  await assertSucceeds(off(as(people.vp), ids).commit());
  await assertSucceeds(off(as(people.advisor), [people.vp, people.treasurer, people.president]).commit());
});

// ---- Meeting/event upgrade: actor boundaries, private partitions, exact revisions and live grants.
const meetingData = (o = {}) => ({termId:T,eventId:'e1',createdByUid:people.president,createdAt:1,title:'Council',date:'2026-11-02',startTime:'15:30',endTime:'16:30',venue:'Hall',participantUids:[people.officer,people.lead],projectIds:['p'],chairUid:people.president,hostUid:people.lead,cohostUids:[],minutesUid:people.officer,minutesBackupUid:null,revision:1,status:'prepared',actualStart:null,actualEnd:null,...o});
const sessionData = (o = {}) => ({termId:T,revision:1,hostUid:people.lead,phase:'attendance',activeTopicId:null,presenterUid:null,queue:[],timerStartedAt:null,timerDuration:0,updatedAt:1,sessionId:'session-1',...o});
const minutesData = (o = {}) => ({termId:T,revision:1,editorUid:people.officer,status:'draft',summary:'',decisions:'',actions:[],closing:'',nextMeeting:'',preparedBy:people.officer,reviewedBy:'',publishedVersion:0,updatedAt:1,...o});
const selection = {groupIds:[],sections:[],includeUids:[],excludeUids:[]};
const snapshot = (approval = 'required') => ({settingsVersion:0,templateId:null,templateVersion:0,approval});
const proposalData = (o = {}) => ({title:'Council',type:'meeting',date:'2026-11-02',start:'15:30',end:'16:30',location:'Hall',notes:'',public:false,itemId:null,participantSelection:selection,participantUids:[people.officer],configSnapshot:snapshot(),...o});
const requestData = (o = {}) => ({termId:T,createdByUid:people.officer,state:'awaiting',revision:1,proposal:proposalData(),eventId:null,reviewedByUid:null,reviewNote:'',createdAt:1,updatedAt:1,replacesEventId:null,baseEventRevision:null,...o});
async function seedMeeting(o = {}) {await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'meetings/m'),meetingData(o));await setDoc(doc(db,'meetings/m/session/control'),sessionData());await setDoc(doc(db,'meetings/m/minutes/draft'),minutesData());});}

test('meetings: only admins initialize bounded documents; batch initializes the assigned secretary', async()=>{
  await assertFails(setDoc(doc(as(people.officer),'meetings/m'),meetingData({createdByUid:people.officer})));
  const db=as(people.president), b=writeBatch(db);b.set(doc(db,'meetings/m'),meetingData());b.set(doc(db,'meetings/m/session/control'),sessionData());b.set(doc(db,'meetings/m/minutes/draft'),minutesData());await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(db,'meetings/m'),{revision:2,attendanceReasons:'secret'}));
  await assertFails(updateDoc(doc(db,'meetings/m'),{revision:4,title:'Stale'}));
  await assertSucceeds(updateDoc(doc(db,'meetings/m'),{revision:2,chairUid:people.vp}));
});
test('meetings: signed out, unverified, inactive, unknown and uninvited teacher reads are denied', async()=>{
  await seedMeeting();await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'members/inactive@stjbs.sch.id'),{role:'officer',active:false}));
  for(const db of [anon(),as(people.officer,false),as('inactive@stjbs.sch.id'),as('unknown@stjbs.sch.id')])await assertFails(getDoc(doc(db,'meetings/m')));
  await assertFails(getDoc(doc(as(people.teacher),'meetings/m')));
});
test('meeting session: only current host/cohost/admin controls, revision CAS and lifecycle are enforced',async()=>{
  await seedMeeting();
  await assertFails(updateDoc(doc(as(people.officer),'meetings/m/session/control'),{phase:'agenda',revision:2}));
  await assertFails(updateDoc(doc(as(people.teacher),'meetings/m/session/control'),{phase:'agenda',revision:2}));
  await assertSucceeds(updateDoc(doc(as(people.lead),'meetings/m/session/control'),{phase:'agenda',revision:2}));
  await assertFails(updateDoc(doc(as(people.lead),'meetings/m/session/control'),{phase:'updates',revision:2}));
  await assertSucceeds(updateDoc(doc(as(people.lead),'meetings/m'),{status:'live',actualStart:2,revision:2}));
  await assertFails(updateDoc(doc(as(people.lead),'meetings/m'),{status:'prepared',revision:3}));
  await assertSucceeds(updateDoc(doc(as(people.lead),'meetings/m'),{status:'closed',actualEnd:3,revision:3}));
  await assertFails(updateDoc(doc(as(people.lead),'meetings/m/session/control'),{phase:'recap',revision:3}));
});
test('meeting sensitive attendance never leaks to teacher, participant, host, or collection-group read',async()=>{
  await seedMeeting();const data={termId:T,uid:people.officer,reason:'Private',followup:'Contact home',designation:'Officer'};
  await assertSucceeds(setDoc(doc(as(people.officer),`meetings/m/sensitive/${people.officer}`),data));
  for(const uid of [people.teacher,people.lead,people.treasurer])await assertFails(getDoc(doc(as(uid),`meetings/m/sensitive/${people.officer}`)));
  await assertSucceeds(getDoc(doc(as(people.president),`meetings/m/sensitive/${people.officer}`)));
  await assertFails(setDoc(doc(as(people.officer),'meetings/m/attendance/'+people.officer),{termId:T,uid:people.officer,status:'present',reason:'Private'}));
});
test('meeting contributions: teacher may submit bounded text, never mutate session or another author',async()=>{
  await seedMeeting({participantUids:[people.officer,people.lead,people.teacher]});const data={termId:T,authorUid:people.teacher,topicId:null,type:'suggestion',text:'Consider another date',createdAt:1,status:'submitted'};
  await assertSucceeds(setDoc(doc(as(people.teacher),'meetings/m/contributions/a'),data));
  await assertFails(setDoc(doc(as(people.teacher),'meetings/m/contributions/b'),{...data,authorUid:people.lead}));
  await assertFails(updateDoc(doc(as(people.teacher),'meetings/m/contributions/a'),{status:'accepted'}));
  await assertSucceeds(updateDoc(doc(as(people.lead),'meetings/m/contributions/a'),{status:'accepted'}));
});
test('temporary minutes grant: prepared and out-of-scope denied; live scoped edit allowed; handoff and close revoke',async()=>{
  await seedMeeting();const update={title:'Captured action',meetingId:'m',...touch};
  await assertFails(updateDoc(doc(as(people.officer),'items/t2'),update));
  await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'meetings/m'),{status:'live',actualStart:2});await setDoc(doc(ctx.firestore(),'items/outsider'),item({parentId:'q',ancestors:['q']}));});
  await assertSucceeds(updateDoc(doc(as(people.officer),'items/t2'),update));
  await assertFails(updateDoc(doc(as(people.officer),'items/outsider'),update));
  await assertFails(updateDoc(doc(as(people.officer),'items/t2'),{...update,pledgedIdr:90}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'meetings/m'),{minutesUid:people.lead}));
  await assertFails(updateDoc(doc(as(people.officer),'items/t2'),{...update,title:'Old editor'}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'meetings/m'),{minutesUid:people.officer,status:'closed'}));
  await assertFails(updateDoc(doc(as(people.officer),'items/t2'),{...update,title:'Closed'}));
});
test('minutes: current editor only, strict revision and atomic admin publication',async()=>{
  await seedMeeting();
  await assertFails(updateDoc(doc(as(people.lead),'meetings/m/minutes/draft'),{summary:'Host cannot overwrite',revision:2}));
  await assertFails(updateDoc(doc(as(people.officer),'meetings/m/minutes/draft'),{summary:'Stale',revision:3}));
  await assertSucceeds(updateDoc(doc(as(people.officer),'meetings/m/minutes/draft'),{summary:'Summary',status:'review',revision:2}));
  await assertFails(updateDoc(doc(as(people.officer),'meetings/m/minutes/draft'),{status:'published',publishedVersion:1,revision:3}));
  await assertFails(updateDoc(doc(as(people.president),'meetings/m/minutes/draft'),{status:'published',publishedVersion:1,revision:3}));
  const db=as(people.president),b=writeBatch(db);b.update(doc(db,'meetings/m/minutes/draft'),{status:'published',publishedVersion:1,revision:3,reviewedBy:people.president});
  b.set(doc(db,'meetings/m/versions/1'),{termId:T,revision:1,draftRevision:3,publishedAt:5,publishedByUid:people.president,record:{id:'m',termId:T,status:'published',revision:1,publishedVersion:1,publishedAt:5,name:'Council',date:'2026-11-02',startTime:'15:30',endTime:'16:30',actualStart:null,actualEnd:null,venue:'Hall',chairUid:people.president,editorUid:people.officer,attendance:{},agenda:[],summary:'Summary',decisions:'',actions:[],closing:'',nextMeeting:'',preparedBy:people.officer,reviewedBy:people.president}});
  await assertSucceeds(b.commit());await assertFails(updateDoc(doc(db,'meetings/m/versions/1'),{publishedAt:6}));
});
test('event policies: admins only, bounded defaults and exact version CAS',async()=>{
  const data={termId:T,version:1,defaults:{approval:'required'},updatedAt:1,updatedByUid:people.president};
  await assertFails(setDoc(doc(as(people.treasurer),'settings/eventDefaults'),{...data,updatedByUid:people.treasurer}));
  await assertSucceeds(setDoc(doc(as(people.president),'settings/eventDefaults'),data));
  await assertFails(updateDoc(doc(as(people.president),'settings/eventDefaults'),{version:3}));
  await assertSucceeds(updateDoc(doc(as(people.president),'settings/eventDefaults'),{version:2,defaults:{approval:'immediate'}}));
  await assertFails(updateDoc(doc(as(people.president),'settings/eventDefaults'),{version:3,defaults:{approval:'immediate',secret:'no'}}));
});
test('approval requests: owner privacy, forged immediate bypass denied, review cannot schedule without matching event',async()=>{
  await assertSucceeds(setDoc(doc(as(people.officer),'eventRequests/r'),requestData()));
  await assertFails(getDoc(doc(as(people.lead),'eventRequests/r')));
  await assertSucceeds(getDoc(doc(as(people.president),'eventRequests/r')));
  await assertFails(getDocs(collection(as(people.officer),'eventRequests')));
  await assertSucceeds(getDocs(query(collection(as(people.officer),'eventRequests'),where('createdByUid','==',people.officer))));
  await assertFails(setDoc(doc(as(people.officer),'events/bypass'),event({...proposalData({configSnapshot:snapshot('immediate')}),revision:1,requestId:null})));
  await assertFails(updateDoc(doc(as(people.officer),'eventRequests/r'),{state:'scheduled',eventId:'r',revision:2}));
  await assertFails(updateDoc(doc(as(people.president),'eventRequests/r'),{state:'scheduled',eventId:'r',reviewedByUid:people.president,revision:2}));
});
test('approval atomically creates exact proposal, stale changes cannot overwrite approved event',async()=>{
  await assertSucceeds(setDoc(doc(as(people.officer),'eventRequests/r'),requestData()));
  const db=as(people.president),b=writeBatch(db);b.update(doc(db,'eventRequests/r'),{state:'scheduled',eventId:'r',reviewedByUid:people.president,revision:2});
  b.set(doc(db,'events/r'),event({...proposalData(),revision:1,requestId:'r'}));await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(as(people.officer),'events/r'),{title:'Bypass review',revision:2}));
  await assertFails(updateDoc(doc(as(people.officer),'eventRequests/r'),{state:'awaiting',revision:3}));
});
test('private topic minutes: reader partition, sole editor, bounded CAS, parent term anchored',async()=>{
  await seedMeeting();const data={termId:T,revision:1,discussion:'Private deliberation',outcome:'Draft decision',updatedAt:1};
  await assertSucceeds(setDoc(doc(as(people.officer),'meetings/m/topicMinutes/a'),data));
  for(const who of [people.lead,people.teacher,people.treasurer])await assertFails(getDoc(doc(as(who),'meetings/m/topicMinutes/a')));
  await assertSucceeds(getDoc(doc(as(people.president),'meetings/m/topicMinutes/a')));
  await assertFails(updateDoc(doc(as(people.president),'meetings/m/topicMinutes/a'),{discussion:'Admin overwrite',revision:2}));
  await assertFails(updateDoc(doc(as(people.officer),'meetings/m/topicMinutes/a'),{discussion:'Stale',revision:3}));
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'meetings/m'),{termId:'old'}));
  await assertFails(updateDoc(doc(as(people.officer),'meetings/m/topicMinutes/a'),{discussion:'Old term',revision:2}));
});
test('host and minutes handoff require atomic scoped revision update; old authority expires',async()=>{
  await seedMeeting({status:'live',actualStart:2,cohostUids:[people.officer]});const db=as(people.lead);
  await assertFails(updateDoc(doc(db,'meetings/m'),{hostUid:people.officer,revision:2}));
  const b=writeBatch(db);b.update(doc(db,'meetings/m'),{hostUid:people.officer,revision:2});b.update(doc(db,'meetings/m/session/control'),{hostUid:people.officer,revision:2});await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(db,'meetings/m/session/control'),{phase:'tasks',revision:3}));
  await assertSucceeds(updateDoc(doc(as(people.officer),'meetings/m/session/control'),{phase:'tasks',revision:3}));
});
test('notices are canonical lifecycle events; own read state cannot forge another account',async()=>{
  await seedMeeting();const db=as(people.lead),data={termId:T,type:'started',revision:2,targetUid:null,createdAt:2,actorUid:people.lead,href:'#/meeting-hub/m'};
  await assertFails(setDoc(doc(db,'meetings/m/notices/started-2'),data));
  const b=writeBatch(db);b.update(doc(db,'meetings/m'),{status:'live',actualStart:2,revision:2});b.set(doc(db,'meetings/m/notices/started-2'),data);await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(as(people.officer),'meetings/m/notices/started-2')));
  await assertFails(getDoc(doc(as(people.teacher),'meetings/m/notices/started-2')));
  const read={termId:T,uid:people.officer,meetingId:'m',revision:2,updatedAt:2};
  await assertSucceeds(setDoc(doc(as(people.officer),`meetingReads/m_${people.officer}`),read));
  await assertFails(setDoc(doc(as(people.lead),`meetingReads/m_${people.officer}`),read));
});
test('full template snapshots and custom fields stay within rules budget and archive exact immutable versions',async()=>{
  const {makeProposal}=await import('../src/event-model.js');
  const template={id:'meeting',name:'Working meeting',description:'Council planning',type:'meeting',available:true,version:1,archived:false,createdAt:1,updatedAt:1,createdByUid:people.president,
    defaults:{title:'Council',type:'meeting',start:'15:00',end:'16:00',location:'Assembly Room',notes:'',itemId:null,approval:'required',participantSelection:selection,duration:60,instructions:'Read agenda',agenda:'Reports',minutes:'Summary',chairUid:people.president,minutesUid:people.officer,minutesBackupUid:null,cohostUids:[],customFields:Array.from({length:4},(_,i)=>({id:'purpose'+i,label:'Purpose '+i,type:'text',required:true,options:[]}))}};
  const {id,...body}=template,db=as(people.president),b=writeBatch(db);b.set(doc(db,'eventTemplates',id),body);b.set(doc(db,'eventTemplates',id,'versions','1'),body);await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(db,'eventTemplates',id,'versions','1'),{name:'Rewritten history'}));
  const proposal=makeProposal({template,edits:{title:'Council',date:'2026-11-02',customValues:Object.fromEntries(Array.from({length:4},(_,i)=>['purpose'+i,'Plan service day']))},members:[{id:people.officer,active:true,role:'officer'}],groups:[]});
  await assertSucceeds(setDoc(doc(as(people.officer),'eventRequests/full'),requestData({proposal})));
  await assertFails(setDoc(doc(as(people.officer),'eventRequests/stale'),requestData({proposal:{...proposal,configSnapshot:{...proposal.configSnapshot,templateVersion:0}}})));
});
test('requested events reject purpose or policy edits, revision removal, and unaudited admin overwrite',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'events/approved'),event({...proposalData(),revision:1,requestId:'r'}));await setDoc(doc(ctx.firestore(),'eventRequests/r'),requestData({state:'scheduled',eventId:'approved',revision:2}));});
  await assertFails(updateDoc(doc(as(people.officer),'events/approved'),{notes:'Changed purpose',revision:2}));
  await assertFails(updateDoc(doc(as(people.officer),'events/approved'),{configSnapshot:snapshot('immediate'),revision:2}));
  await assertFails(setDoc(doc(as(people.officer),'events/approved'),event({...proposalData(),requestId:'r'})));
  await assertFails(updateDoc(doc(as(people.president),'events/approved'),{notes:'Admin edited purpose',revision:2}));
  const db=as(people.president),b=writeBatch(db);b.update(doc(db,'events/approved'),{notes:'Admin edited purpose',revision:2});b.set(doc(db,'activity/event_approved_2'),{termId:T,actorUid:people.president,type:'event',itemId:'approved',text:'Updated event',createdAt:2});await assertSucceeds(b.commit());
});
test('publication supports fifty attendees and rejects a hidden private field in the last row',async()=>{
  const attendees=Array.from({length:50},(_,i)=>({uid:`member${i}@stjbs.sch.id`,name:`Member ${i}`,status:'present'}));await seedMeeting({participantUids:attendees.map(x=>x.uid)});
  const record={id:'m',termId:T,status:'published',revision:1,publishedVersion:1,publishedAt:5,name:'Council',date:'2026-11-02',startTime:'15:30',endTime:'16:30',actualStart:null,actualEnd:null,venue:'Hall',chairUid:people.president,editorUid:people.officer,attendance:Object.fromEntries(attendees.map(x=>[x.uid,x.status])),agenda:Array.from({length:12},(_,i)=>({id:'topic'+i,title:'Topic '+i,presenterUid:null,duration:5,discussion:'Summary',outcome:'Agreed',status:'done'})),summary:'',decisions:'',actions:Array.from({length:10},(_,i)=>({text:'Action '+i,ownerUid:people.officer,dueDate:'2026-11-02',status:'todo',taskId:null})),closing:'',nextMeeting:'',preparedBy:people.officer,reviewedBy:people.president};
  for(let i=0;i<record.actions.length;i++)await assertSucceeds(updateDoc(doc(as(people.officer),'meetings/m/minutes/draft'),{actions:record.actions.slice(0,i+1),revision:i+2}));
  await assertSucceeds(updateDoc(doc(as(people.officer),'meetings/m/minutes/draft'),{status:'review',revision:12}));
  const publish=(r)=>{const db=as(people.president),b=writeBatch(db);b.update(doc(db,'meetings/m/minutes/draft'),{status:'published',publishedVersion:1,revision:13,reviewedBy:people.president});b.set(doc(db,'meetings/m/versions/1'),{termId:T,revision:1,draftRevision:13,publishedAt:5,publishedByUid:people.president,record:r});return b.commit();};
  await assertFails(publish({...record,attendance:attendees.map((x,i)=>i===49?{...x,reason:'PRIVATE'}:x)}));
  await assertFails(publish({...record,attendance:{...record.attendance,[attendees[49].uid]:{status:'absent',reason:'PRIVATE'}}}));
  await assertSucceeds(publish(record));
});

test('request companions are mandatory, exact, immutable and owner-scoped',async()=>{
  const db=as(people.officer),r=requestData();
  await assertFails(sdkSetDoc(doc(db,'eventRequests/no-companion'),r));
  const b=sdkWriteBatch(db);b.set(doc(db,'eventRequests/mismatched'),r);b.set(doc(db,'eventRequests/mismatched/proposals/1'),proposalData({title:'Forged'}));await assertFails(b.commit());
  await assertSucceeds(setDoc(doc(db,'eventRequests/canonical'),r));
  await assertFails(sdkUpdateDoc(doc(db,'eventRequests/canonical/proposals/1'),{title:'Rewritten history'}));
  await assertFails(deleteDoc(doc(db,'eventRequests/canonical/proposals/1')));
  await assertFails(getDoc(doc(as(people.lead),'eventRequests/canonical/proposals/1')));
});
