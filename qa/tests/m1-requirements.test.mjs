// Independent M1 rules tests, written from qa/PROMPT.md and docs/plan.md sections 1 and 4 only.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where,
  serverTimestamp, arrayUnion, arrayRemove, Timestamp,
} from 'firebase/firestore';

const D = '@stjbs.sch.id';
const T = '2026-27';
const OLD = '2025-26';
let env;

const FULL = { blocked: false, blockedReason: '', blockedOnUid: null, notes: '', link: '', startDate: null, dueDate: null, isDeal: false, dealStage: null, pledgedIdr: 0, receivedIdr: 0, completedAt: null, assignedAt: null, leadUid: null };
const roster = {
  ariel: 'advisor', nadia: 'president', kevin: 'vp', sarah: 'treasurer',
  dimas: 'secretary', michael: 'officer', alya: 'officer', budi: 'teacher',
};
const em = (n) => n + D;
const memberDoc = (name, role, extra = {}) => ({
  name, initials: name.slice(0, 2).toUpperCase(), role, section: 'Events', reportsTo: null,
  active: true, termId: T, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...extra,
});
const as = (n) => env.authenticatedContext(em(n), { email: em(n), email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'settings/current'), { termId: T, termName: T, startDate: '2026-10-26' });
    for (const [n, r] of Object.entries(roster)) await setDoc(doc(db, 'members', em(n)), memberDoc(n, r));
    await setDoc(doc(db, 'members', em('ghost')), memberDoc('ghost', 'officer', { active: false }));
    await setDoc(doc(db, 'items/p1'), {
      ...FULL, termId: T, kind: 'project', parentId: null, ancestors: [], title: 'Carnival', status: 'todo', archived: false,
      leadUid: em('michael'), leadUids: [em('michael')], assigneeUids: [], createdByUid: em('nadia'),
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'items/c1'), {
      ...FULL, termId: T, kind: 'task', parentId: 'p1', ancestors: ['p1'], title: 'Booths', status: 'todo', archived: false,
      leadUid: null, leadUids: [em('michael')], assigneeUids: [em('alya')], createdByUid: em('nadia'),
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'items/pub1'), {
      ...FULL, termId: T, kind: 'project', parentId: null, ancestors: [], title: 'Public project', status: 'doing', archived: false,
      leadUid: em('michael'), leadUids: [em('michael')], assigneeUids: [], createdByUid: em('nadia'),
      createdAt: Timestamp.now(), public: true, publicBlurb: 'Hello',
    });
    await setDoc(doc(db, 'events/e1'), ev({ createdByUid: em('michael') }));
    await setDoc(doc(db, 'events/epub'), ev({ createdByUid: em('michael'), public: true, title: 'Open day' }));
    await setDoc(doc(db, 'ideas/i1'), idea({ authorUid: em('michael'), voters: [em('michael')] }));
    await setDoc(doc(db, 'docTemplates/d1'), tpl());
    await setDoc(doc(db, 'submissions/s1'), sub({ byUid: em('michael') }));
    await setDoc(doc(db, 'public/feed'), { json: '{}', hash: 'h0', updatedAt: 1 });
    await setDoc(doc(db, 'announcements/a1'), ann());
    await setDoc(doc(db, 'comments/cm1'), { itemId: 'p1', authorUid: em('michael'), text: 'hi', termId: T, createdAt: Timestamp.now() });
  });
}

const ev = (o = {}) => ({
  title: 'Assembly', type: 'meeting', date: '2026-11-02', start: '09:00', end: '10:00',
  location: 'Hall', notes: '', public: false, createdByUid: em('michael'), archived: false,
  termId: T, createdAt: serverTimestamp(), ...o,
});
const ann = (o = {}) => ({
  title: 'Bake sale', body: 'Friday', audience: 'everyone', startDate: '2026-11-01', endDate: '2026-11-05',
  createdByUid: em('nadia'), archived: false, termId: T, createdAt: serverTimestamp(), ...o,
});
const idea = (o = {}) => ({
  text: 'More plants', authorUid: em('michael'), voters: [em('michael')], archived: false,
  termId: T, createdAt: serverTimestamp(), ...o,
});
const tpl = (o = {}) => ({
  name: 'Budget sheet', kind: 'sheet', url: 'https://docs.google.com/spreadsheets/d/abc/edit', version: 1,
  archived: false, createdAt: serverTimestamp(), ...o,
});
const sub = (o = {}) => ({
  type: 'new-template', name: 'Poster', url: 'https://docs.google.com/document/d/abc/edit', note: '',
  byUid: em('michael'), status: 'pending', archived: false, createdAt: Date.now(), ...o,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-council',
    firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(seed);

const ok = assertSucceeds, no = assertFails;
const admins = ['ariel', 'nadia', 'kevin'];
const nonAdminWriters = ['sarah', 'dimas', 'michael'];

// ---------- Baseline access ----------
test('baseline: non-member, unverified, inactive and signed-out cannot read announcements', async () => {
  await no(getDoc(doc(anon(), 'announcements/a1')));
  await no(getDoc(doc(env.authenticatedContext('x' + D, { email: 'x' + D, email_verified: true }).firestore(), 'announcements/a1')));
  await no(getDoc(doc(env.authenticatedContext(em('michael'), { email: em('michael'), email_verified: false }).firestore(), 'announcements/a1')));
  await no(getDoc(doc(as('ghost'), 'announcements/a1')));
});
test('baseline: every active role reads new collections (teacher included)', async () => {
  for (const n of Object.keys(roster)) {
    for (const p of ['announcements/a1', 'events/e1', 'ideas/i1', 'docTemplates/d1'])
      await ok(getDoc(doc(as(n), p)));
  }
});
test('baseline: active member can read cache/{termId} (when present)', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'cache', T), { json: '[]', at: Timestamp.now(), count: 0, updatedAt: Date.now() }));
  await ok(getDoc(doc(as('budi'), 'cache', T)));
  await no(getDoc(doc(anon(), 'cache', T)));
});

// ---------- Roles: roster ----------
const newMember = (name, role, extra = {}) => memberDoc(name, role, extra);
test('roster: advisor creates any role incl. vp and advisor', async () => {
  await ok(setDoc(doc(as('ariel'), 'members', em('n1')), newMember('n1', 'vp')));
  await ok(setDoc(doc(as('ariel'), 'members', em('n2')), newMember('n2', 'advisor')));
});
test('roster: vp creates non-advisor roles incl. president; never advisor', async () => {
  await ok(setDoc(doc(as('kevin'), 'members', em('n1')), newMember('n1', 'president')));
  await ok(setDoc(doc(as('kevin'), 'members', em('n3')), newMember('n3', 'vp')));
  await no(setDoc(doc(as('kevin'), 'members', em('n2')), newMember('n2', 'advisor')));
});
test('roster: president creates only officer/treasurer/secretary/teacher', async () => {
  for (const r of ['officer', 'treasurer', 'secretary', 'teacher'])
    await ok(setDoc(doc(as('nadia'), 'members', em('x' + r)), newMember('x' + r, r)));
  for (const r of ['vp', 'president', 'advisor'])
    await no(setDoc(doc(as('nadia'), 'members', em('y' + r)), newMember('y' + r, r)));
});
test('roster: treasurer, secretary, officer, teacher cannot create members', async () => {
  for (const n of ['sarah', 'dimas', 'michael', 'budi'])
    await no(setDoc(doc(as(n), 'members', em('z' + n)), newMember('z' + n, 'officer')));
});
test('roster: member email must end with school domain', async () => {
  await no(setDoc(doc(as('ariel'), 'members', 'bad@gmail.com'), newMember('bad', 'officer')));
});
test('roster: vp changes president role and active flag', async () => {
  await ok(updateDoc(doc(as('kevin'), 'members', em('nadia')), { role: 'officer', updatedAt: serverTimestamp() }));
  await ok(updateDoc(doc(as('kevin'), 'members', em('nadia')), { active: false, updatedAt: serverTimestamp() }));
});
test('roster: vp changes an officer role and active flag', async () => {
  await ok(updateDoc(doc(as('kevin'), 'members', em('michael')), { role: 'treasurer', updatedAt: serverTimestamp() }));
  await ok(updateDoc(doc(as('kevin'), 'members', em('alya')), { active: false, updatedAt: serverTimestamp() }));
});
test('roster: vp cannot touch advisor or assign advisor', async () => {
  await no(updateDoc(doc(as('kevin'), 'members', em('ariel')), { role: 'officer', updatedAt: serverTimestamp() }));
  await no(updateDoc(doc(as('kevin'), 'members', em('ariel')), { active: false, updatedAt: serverTimestamp() }));
  await no(updateDoc(doc(as('kevin'), 'members', em('michael')), { role: 'advisor', updatedAt: serverTimestamp() }));
});
test('roster: vp cannot change own role or active flag', async () => {
  await no(updateDoc(doc(as('kevin'), 'members', em('kevin')), { role: 'officer', updatedAt: serverTimestamp() }));
  await no(updateDoc(doc(as('kevin'), 'members', em('kevin')), { active: false, updatedAt: serverTimestamp() }));
});
test('roster: advisor changes roles and active of others, but not own', async () => {
  await ok(updateDoc(doc(as('ariel'), 'members', em('michael')), { role: 'vp', updatedAt: serverTimestamp() }));
  await ok(updateDoc(doc(as('ariel'), 'members', em('kevin')), { active: false, updatedAt: serverTimestamp() }));
  await no(updateDoc(doc(as('ariel'), 'members', em('ariel')), { role: 'officer', updatedAt: serverTimestamp() }));
  await no(updateDoc(doc(as('ariel'), 'members', em('ariel')), { active: false, updatedAt: serverTimestamp() }));
});
test('roster: president edits name, section, reportsTo with initials/termId/updatedAt (putDoc shape)', async () => {
  await ok(updateDoc(doc(as('nadia'), 'members', em('michael')), {
    name: 'Mike', section: 'Media', reportsTo: em('sarah'), initials: 'MI', termId: T, updatedAt: serverTimestamp(),
  }));
});
test('roster: president may edit name of vp and of president (self), not advisor', async () => {
  const f = { name: 'New', initials: 'NE', termId: T, updatedAt: serverTimestamp() };
  await ok(updateDoc(doc(as('nadia'), 'members', em('kevin')), f));
  await no(updateDoc(doc(as('nadia'), 'members', em('ariel')), f));
});
test('roster: president cannot change role or active flag of anyone', async () => {
  for (const n of ['michael', 'kevin', 'budi']) {
    await no(updateDoc(doc(as('nadia'), 'members', em(n)), { role: 'treasurer', updatedAt: serverTimestamp() }));
    await no(updateDoc(doc(as('nadia'), 'members', em(n)), { active: false, updatedAt: serverTimestamp() }));
  }
  await no(updateDoc(doc(as('nadia'), 'members', em('michael')), { name: 'x', role: 'vp', updatedAt: serverTimestamp() }));
  await no(updateDoc(doc(as('nadia'), 'members', em('nadia')), { role: 'advisor', updatedAt: serverTimestamp() }));
});
test('roster: officer, treasurer, secretary, teacher cannot update members', async () => {
  for (const n of ['michael', 'sarah', 'dimas', 'budi'])
    await no(updateDoc(doc(as(n), 'members', em('alya')), { name: 'Hacked', updatedAt: serverTimestamp() }));
});

// ---------- settings ----------
test('settings/current: only advisor writes termId', async () => {
  await ok(updateDoc(doc(as('ariel'), 'settings/current'), { termId: '2027-28' }));
  for (const n of ['nadia', 'kevin', 'sarah', 'michael', 'budi'])
    await no(updateDoc(doc(as(n), 'settings/current'), { termId: '2027-28' }));
});

// ---------- announcements ----------
test('announcements: admin create ok; others fail (incl. exec non-admin, teacher)', async () => {
  for (const n of admins) await ok(setDoc(doc(as(n), 'announcements', 'n_' + n), ann({ createdByUid: em(n) })));
  for (const n of [...nonAdminWriters, 'budi'])
    await no(setDoc(doc(as(n), 'announcements', 'n_' + n), ann({ createdByUid: em(n) })));
});
test('announcements: audience must be everyone or members', async () => {
  await ok(setDoc(doc(as('nadia'), 'announcements/m'), ann({ audience: 'members' })));
  await no(setDoc(doc(as('nadia'), 'announcements/w'), ann({ audience: 'world' })));
});
test('announcements: title 1..80, body <= 2000', async () => {
  await no(setDoc(doc(as('nadia'), 'announcements/t0'), ann({ title: '' })));
  await ok(setDoc(doc(as('nadia'), 'announcements/t80'), ann({ title: 'a'.repeat(80) })));
  await no(setDoc(doc(as('nadia'), 'announcements/t81'), ann({ title: 'a'.repeat(81) })));
  await ok(setDoc(doc(as('nadia'), 'announcements/b2000'), ann({ body: 'a'.repeat(2000) })));
  await no(setDoc(doc(as('nadia'), 'announcements/b2001'), ann({ body: 'a'.repeat(2001) })));
});
test('announcements: dates YYYY-MM-DD and end not before start', async () => {
  await ok(setDoc(doc(as('nadia'), 'announcements/same'), ann({ startDate: '2026-11-05', endDate: '2026-11-05' })));
  await no(setDoc(doc(as('nadia'), 'announcements/rev'), ann({ startDate: '2026-11-05', endDate: '2026-11-04' })));
  await no(setDoc(doc(as('nadia'), 'announcements/fmt'), ann({ startDate: '5 Nov', endDate: '2026-11-06' })));
});
test('announcements: createdByUid must be me, archived false on create, termId current', async () => {
  await no(setDoc(doc(as('nadia'), 'announcements/f1'), ann({ createdByUid: em('kevin') })));
  await no(setDoc(doc(as('nadia'), 'announcements/f2'), ann({ archived: true })));
  await no(setDoc(doc(as('nadia'), 'announcements/f3'), ann({ termId: OLD })));
});
test('announcements: admin can archive; officer cannot update', async () => {
  await ok(updateDoc(doc(as('kevin'), 'announcements/a1'), { archived: true }));
  await no(updateDoc(doc(as('michael'), 'announcements/a1'), { archived: true }));
  await no(updateDoc(doc(as('sarah'), 'announcements/a1'), { title: 'x' }));
});
test('announcements: no deletes', async () => {
  const { deleteDoc } = await import('firebase/firestore');
  for (const n of ['ariel', 'nadia', 'kevin']) await no(deleteDoc(doc(as(n), 'announcements/a1')));
});

// ---------- events ----------
test('events: active non-teacher creates with public false', async () => {
  for (const n of ['sarah', 'dimas', 'michael', 'nadia', 'kevin', 'ariel'])
    await ok(setDoc(doc(as(n), 'events', 'e_' + n), ev({ createdByUid: em(n) })));
});
test('events: teacher cannot create', async () => {
  await no(setDoc(doc(as('budi'), 'events/eb'), ev({ createdByUid: em('budi') })));
});
test('events: public true on create only for advisor, president, vp', async () => {
  for (const n of admins) await ok(setDoc(doc(as(n), 'events', 'p_' + n), ev({ createdByUid: em(n), public: true })));
  for (const n of nonAdminWriters) await no(setDoc(doc(as(n), 'events', 'p_' + n), ev({ createdByUid: em(n), public: true })));
});
test('events: createdByUid must be me; term must be current; archived false', async () => {
  await no(setDoc(doc(as('michael'), 'events/f1'), ev({ createdByUid: em('alya') })));
  await no(setDoc(doc(as('michael'), 'events/f2'), ev({ termId: OLD })));
  await no(setDoc(doc(as('michael'), 'events/f3'), ev({ archived: true })));
});
test('events: type must be meeting/project/committee/other', async () => {
  for (const t of ['meeting', 'project', 'committee', 'other']) await ok(setDoc(doc(as('michael'), 'events', 't_' + t), ev({ type: t })));
  await no(setDoc(doc(as('michael'), 'events/tx'), ev({ type: 'party' })));
});
test('events: bad date or time rejected', async () => {
  await no(setDoc(doc(as('michael'), 'events/x1'), ev({ date: '2/11/2026' })));
  await no(setDoc(doc(as('michael'), 'events/x2'), ev({ start: '25:00' })));
  await no(setDoc(doc(as('michael'), 'events/x3'), ev({ start: '10:00', end: '09:00' })));
});
test('events: creator updates own; other officer cannot; exec and advisor can', async () => {
  await ok(updateDoc(doc(as('michael'), 'events/e1'), { title: 'New', notes: 'n' }));
  await no(updateDoc(doc(as('alya'), 'events/e1'), { title: 'Hijack' }));
  await ok(updateDoc(doc(as('sarah'), 'events/e1'), { title: 'By treasurer' }));
  await ok(updateDoc(doc(as('ariel'), 'events/e1'), { title: 'By advisor' }));
});
test('events: creator archives own event', async () => {
  await ok(updateDoc(doc(as('michael'), 'events/e1'), { archived: true }));
});
test('events: teacher cannot update even if somehow listed', async () => {
  await no(updateDoc(doc(as('budi'), 'events/e1'), { title: 'x' }));
});
test('events: public may change only by advisor, president, vp', async () => {
  await no(updateDoc(doc(as('michael'), 'events/e1'), { public: true }));
  await no(updateDoc(doc(as('sarah'), 'events/e1'), { public: true }));
  for (const n of admins) await ok(updateDoc(doc(as(n), 'events/e1'), { public: true }));
});
test('events: creator cannot flip a public event private; admin can', async () => {
  await no(updateDoc(doc(as('michael'), 'events/epub'), { public: false }));
  await ok(updateDoc(doc(as('nadia'), 'events/epub'), { public: false }));
});
test('events: creator retitling public event fails, admin ok (plan L1-11)', async () => {
  await no(updateDoc(doc(as('michael'), 'events/epub'), { title: 'Defaced' }));
  await no(updateDoc(doc(as('michael'), 'events/epub'), { location: 'Elsewhere' }));
  await ok(updateDoc(doc(as('kevin'), 'events/epub'), { title: 'Renamed' }));
});

// ---------- rsvps ----------
const rs = (n, o = {}) => ({ eventId: 'e1', uid: em(n), status: 'going', archived: false, termId: T, createdAt: serverTimestamp(), ...o });
test('rsvps: own going / not ok for every non-teacher role', async () => {
  for (const n of ['ariel', 'nadia', 'kevin', 'sarah', 'dimas', 'michael'])
    await ok(setDoc(doc(as(n), 'rsvps', 'e1_' + em(n)), rs(n)));
  await ok(setDoc(doc(as('alya'), 'rsvps', 'e1_' + em('alya')), rs('alya', { status: 'not' })));
});
test('rsvps: teacher cannot RSVP', async () => {
  await no(setDoc(doc(as('budi'), 'rsvps', 'e1_' + em('budi')), rs('budi')));
});
test('rsvps: forged id or uid fails', async () => {
  await no(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('alya')), rs('alya')));
  await no(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('alya')), rs('michael')));
  await no(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('michael')), rs('alya')));
  await no(setDoc(doc(as('michael'), 'rsvps', 'other_' + em('michael')), rs('michael')));
});
test('rsvps: status must be going or not; update own ok, others not', async () => {
  await no(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('michael')), rs('michael', { status: 'maybe' })));
  await ok(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('michael')), rs('michael')));
  await ok(updateDoc(doc(as('michael'), 'rsvps', 'e1_' + em('michael')), { status: 'not' }));
  await no(updateDoc(doc(as('alya'), 'rsvps', 'e1_' + em('michael')), { status: 'not' }));
});
test('rsvps: all active members can read; wrong term write fails', async () => {
  await ok(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('michael')), rs('michael')));
  await ok(getDocs(query(collection(as('budi'), 'rsvps'), where('eventId', '==', 'e1'))));
  await no(setDoc(doc(as('alya'), 'rsvps', 'e1_' + em('alya')), rs('alya', { termId: OLD })));
});

// ---------- ideas ----------
test('ideas: create with voters [me]; text 1..140; author me', async () => {
  await ok(setDoc(doc(as('alya'), 'ideas/n1'), idea({ authorUid: em('alya'), voters: [em('alya')] })));
  await ok(setDoc(doc(as('sarah'), 'ideas/n2'), idea({ authorUid: em('sarah'), voters: [em('sarah')], text: 'a'.repeat(140) })));
  await no(setDoc(doc(as('alya'), 'ideas/n3'), idea({ authorUid: em('alya'), voters: [em('alya')], text: 'a'.repeat(141) })));
  await no(setDoc(doc(as('alya'), 'ideas/n4'), idea({ authorUid: em('alya'), voters: [em('alya')], text: '' })));
  await no(setDoc(doc(as('alya'), 'ideas/n5'), idea({ authorUid: em('michael'), voters: [em('alya')] })));
});
test('ideas: create with inflated or foreign voters fails; teacher cannot create', async () => {
  await no(setDoc(doc(as('alya'), 'ideas/v1'), idea({ authorUid: em('alya'), voters: [] })));
  await no(setDoc(doc(as('alya'), 'ideas/v2'), idea({ authorUid: em('alya'), voters: [em('michael')] })));
  await no(setDoc(doc(as('alya'), 'ideas/v3'), idea({ authorUid: em('alya'), voters: [em('alya'), em('alya'), em('alya')] })));
  await no(setDoc(doc(as('budi'), 'ideas/v4'), idea({ authorUid: em('budi'), voters: [em('budi')] })));
});
test('ideas: vote and unvote with arrayUnion/arrayRemove', async () => {
  await ok(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: arrayUnion(em('alya')) }));
  await ok(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: arrayRemove(em('alya')) }));
});
test('ideas: [me, me, me] and double vote cannot inflate', async () => {
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: [em('michael'), em('alya'), em('alya'), em('alya')] }));
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: [em('michael'), em('alya'), em('alya')] }));
  await no(updateDoc(doc(as('michael'), 'ideas/i1'), { voters: [em('michael'), em('michael'), em('michael')] }));
});
test('ideas: cannot vote for or remove someone else; cannot add two at once', async () => {
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: arrayUnion(em('sarah')) }));
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: arrayRemove(em('michael')) }));
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: arrayUnion(em('alya'), em('sarah')) }));
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: [] }));
});
test('ideas: teacher cannot vote; vote update cannot touch other fields', async () => {
  await no(updateDoc(doc(as('budi'), 'ideas/i1'), { voters: arrayUnion(em('budi')) }));
  await no(updateDoc(doc(as('alya'), 'ideas/i1'), { voters: arrayUnion(em('alya')), text: 'changed' }));
  await no(updateDoc(doc(as('michael'), 'ideas/i1'), { text: 'edited by author' }));
});
test('ideas: archive by advisor, president, vp only', async () => {
  for (const n of admins) {
    await seed();
    await ok(updateDoc(doc(as(n), 'ideas/i1'), { archived: true }));
  }
  await no(updateDoc(doc(as('michael'), 'ideas/i1'), { archived: true }));
  await no(updateDoc(doc(as('sarah'), 'ideas/i1'), { archived: true }));
});

// ---------- docTemplates ----------
test('docTemplates: admin create/update; others fail; all read', async () => {
  for (const n of admins) await ok(setDoc(doc(as(n), 'docTemplates', 't_' + n), tpl()));
  for (const n of [...nonAdminWriters, 'budi']) await no(setDoc(doc(as(n), 'docTemplates', 't_' + n), tpl()));
  await ok(updateDoc(doc(as('kevin'), 'docTemplates/d1'), { name: 'Renamed' }));
  await no(updateDoc(doc(as('sarah'), 'docTemplates/d1'), { name: 'Renamed' }));
});
test('docTemplates: Google URLs accepted, others rejected', async () => {
  await ok(setDoc(doc(as('nadia'), 'docTemplates/u1'), tpl({ url: 'https://docs.google.com/document/d/x/edit' })));
  await ok(setDoc(doc(as('nadia'), 'docTemplates/u2'), tpl({ url: 'https://drive.google.com/file/d/x/view' })));
  for (const [i, u] of ['http://docs.google.com/document/d/x', 'https://evil.com/', 'https://docs.google.com.evil.com/document/d/x',
    'https://docs.google.com/url?q=https://evil.com', 'javascript:alert(1)', 'https://example.com/https://docs.google.com/'].entries())
    await no(setDoc(doc(as('nadia'), 'docTemplates', 'bad' + i), tpl({ url: u })));
});
test('docTemplates: version starts at 1; url change must increment version', async () => {
  await no(setDoc(doc(as('nadia'), 'docTemplates/v5'), tpl({ version: 5 })));
  const u = 'https://docs.google.com/document/d/new/edit';
  await no(updateDoc(doc(as('nadia'), 'docTemplates/d1'), { url: u }));
  await no(updateDoc(doc(as('nadia'), 'docTemplates/d1'), { url: u, version: 1 }));
  await ok(updateDoc(doc(as('nadia'), 'docTemplates/d1'), { url: u, version: 2 }));
});
test('docTemplates: cross-term (no termId needed, survives close term)', async () => {
  await ok(setDoc(doc(as('ariel'), 'docTemplates/ct'), tpl()));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'settings/current'), { termId: '2027-28' }));
  await ok(getDoc(doc(as('michael'), 'docTemplates/ct')));
  await ok(setDoc(doc(as('ariel'), 'docTemplates/ct2'), tpl()));
});

// ---------- submissions ----------
test('submissions: non-teacher creates own pending; archive is filed', async () => {
  for (const n of ['michael', 'sarah', 'dimas', 'nadia', 'kevin', 'ariel'])
    await ok(setDoc(doc(as(n), 'submissions', 's_' + n), sub({ byUid: em(n) })));
  await ok(setDoc(doc(as('alya'), 'submissions/arch'), sub({ byUid: em('alya'), type: 'archive', status: 'filed', projectId: 'p1' })));
  await ok(setDoc(doc(as('alya'), 'submissions/edit'), sub({ byUid: em('alya'), type: 'template-edit', targetId: 'd1' })));
});
test('submissions: teacher, forged author, wrong status, bad URL, bad type fail', async () => {
  await no(setDoc(doc(as('budi'), 'submissions/x'), sub({ byUid: em('budi') })));
  await no(setDoc(doc(as('alya'), 'submissions/x'), sub({ byUid: em('michael') })));
  await no(setDoc(doc(as('alya'), 'submissions/x'), sub({ byUid: em('alya'), status: 'approved' })));
  await no(setDoc(doc(as('alya'), 'submissions/x'), sub({ byUid: em('alya'), type: 'archive', status: 'pending' })));
  await no(setDoc(doc(as('alya'), 'submissions/x'), sub({ byUid: em('alya'), url: 'https://evil.com/x' })));
  await no(setDoc(doc(as('alya'), 'submissions/x'), sub({ byUid: em('alya'), url: 'https://docs.google.com.evil.com/document/d/1' })));
  await no(setDoc(doc(as('alya'), 'submissions/x'), sub({ byUid: em('alya'), type: 'other' })));
});
test('submissions: read only by author and admins (document)', async () => {
  for (const n of ['michael', 'ariel', 'nadia', 'kevin']) await ok(getDoc(doc(as(n), 'submissions/s1')));
  for (const n of ['alya', 'sarah', 'dimas', 'budi']) await no(getDoc(doc(as(n), 'submissions/s1')));
});
test('submissions: unfiltered query fails for member, byUid-filtered query ok, admin may list all', async () => {
  await no(getDocs(collection(as('michael'), 'submissions')));
  await ok(getDocs(query(collection(as('michael'), 'submissions'), where('byUid', '==', em('michael')))));
  await no(getDocs(query(collection(as('alya'), 'submissions'), where('byUid', '==', em('michael')))));
  await ok(getDocs(collection(as('nadia'), 'submissions')));
  await ok(getDocs(query(collection(as('kevin'), 'submissions'), where('status', '==', 'pending'))));
});
test('submissions: archive files readable by admins and author only', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'submissions/arc'), sub({ byUid: em('michael'), type: 'archive', status: 'filed' })));
  await ok(getDoc(doc(as('ariel'), 'submissions/arc')));
  await ok(getDoc(doc(as('michael'), 'submissions/arc')));
  await no(getDoc(doc(as('sarah'), 'submissions/arc')));
});
test('submissions: admin updates only status; author and others cannot', async () => {
  for (const n of admins) await ok(updateDoc(doc(as(n), 'submissions/s1'), { status: 'approved' }));
  await ok(updateDoc(doc(as('ariel'), 'submissions/s1'), { status: 'rejected' }));
  await no(updateDoc(doc(as('ariel'), 'submissions/s1'), { status: 'bogus' }));
  await no(updateDoc(doc(as('ariel'), 'submissions/s1'), { status: 'approved', url: 'https://docs.google.com/document/d/zz' }));
  await no(updateDoc(doc(as('ariel'), 'submissions/s1'), { status: 'approved', byUid: em('ariel') }));
  await no(updateDoc(doc(as('michael'), 'submissions/s1'), { status: 'approved' }));
  await no(updateDoc(doc(as('sarah'), 'submissions/s1'), { status: 'approved' }));
});
test('submissions: approval batch (status + new template) works for admin', async () => {
  const { writeBatch } = await import('firebase/firestore');
  const db = as('nadia');
  const b = writeBatch(db);
  b.update(doc(db, 'submissions/s1'), { status: 'approved' });
  b.set(doc(db, 'docTemplates/fromsub'), tpl({ name: 'Poster' }));
  await ok(b.commit());
});

// ---------- public/feed ----------
const feed = (o = {}) => ({ json: '{"a":1}', hash: 'h1', updatedAt: Date.now(), ...o });
test('feed: anyone can get, nobody unauthenticated can list', async () => {
  await ok(getDoc(doc(anon(), 'public/feed')));
  await ok(getDoc(doc(as('michael'), 'public/feed')));
  await no(getDocs(collection(anon(), 'public')));
});
test('feed: advisor, president, vp write; others fail', async () => {
  for (const n of admins) await ok(setDoc(doc(as(n), 'public/feed'), feed()));
  for (const n of [...nonAdminWriters, 'budi']) await no(setDoc(doc(as(n), 'public/feed'), feed()));
  await no(setDoc(doc(anon(), 'public/feed'), feed()));
});
test('feed: whitelist json, hash, updatedAt only (no updatedByUid, no extras)', async () => {
  await no(setDoc(doc(as('nadia'), 'public/feed'), feed({ updatedByUid: em('nadia') })));
  await no(setDoc(doc(as('nadia'), 'public/feed'), feed({ extra: 1 })));
  await no(setDoc(doc(as('nadia'), 'public/feed'), { json: '{}', hash: 'h' , updatedAt: 1, termId: T }));
  await no(updateDoc(doc(as('nadia'), 'public/feed'), { updatedByUid: em('nadia') }));
});
test('feed: json <= 200000 characters, must be a string', async () => {
  await ok(setDoc(doc(as('nadia'), 'public/feed'), feed({ json: 'x'.repeat(200000) })));
  await no(setDoc(doc(as('nadia'), 'public/feed'), feed({ json: 'x'.repeat(200001) })));
  await no(setDoc(doc(as('nadia'), 'public/feed'), feed({ json: { a: 1 } })));
});
test('feed: update by admin ok, by officer fails', async () => {
  await ok(updateDoc(doc(as('kevin'), 'public/feed'), { json: '{"b":2}', hash: 'h2', updatedAt: Date.now() }));
  await no(updateDoc(doc(as('michael'), 'public/feed'), { json: '{"b":2}', hash: 'h2', updatedAt: Date.now() }));
});

// ---------- cache/{termId} ----------
const cache = (o = {}) => ({ json: '[]', at: Timestamp.now(), count: 0, updatedAt: Date.now(), ...o });
test('cache: admin writes for current term; officer/teacher cannot', async () => {
  for (const n of admins) await ok(setDoc(doc(as(n), 'cache', T), cache()));
  for (const n of [...nonAdminWriters, 'budi']) await no(setDoc(doc(as(n), 'cache', T), cache()));
});
test('cache: wrong term id, extra key, oversize json, future at fail', async () => {
  await no(setDoc(doc(as('nadia'), 'cache', OLD), cache()));
  await no(setDoc(doc(as('nadia'), 'cache', T), cache({ extra: 1 })));
  await ok(setDoc(doc(as('nadia'), 'cache', T), cache({ json: 'x'.repeat(700000) })));
  await no(setDoc(doc(as('nadia'), 'cache', T), cache({ json: 'x'.repeat(700001) })));
  await no(setDoc(doc(as('nadia'), 'cache', T), cache({ at: Timestamp.fromMillis(Date.now() + 3600e3) })));
});

// ---------- items: touchedAt, public, publicBlurb ----------
// SKIPPED: the item document shape is not specified in the requirements. Every shape tried
// (full brief.md data-model field set) is refused even by the pre-M1 rules (commit 659a2d4), so these
// cannot be validated independently. See qa/m1-tests.md.
const T_ = () => serverTimestamp();
test.skip('items: update by lead requires touchedAt == server time', async () => {
  await ok(updateDoc(doc(as('michael'), 'items/c1'), { title: 'Booths 2', touchedAt: T_() }));
  await no(updateDoc(doc(as('michael'), 'items/c1'), { title: 'Booths 3' }));
  await no(updateDoc(doc(as('michael'), 'items/c1'), { title: 'Booths 3', touchedAt: Timestamp.fromMillis(1) }));
  await no(updateDoc(doc(as('michael'), 'items/c1'), { title: 'Booths 3', touchedAt: Timestamp.fromMillis(Date.now() + 86400e3) }));
});
test.skip('items: assignee status change with touchedAt ok, without fails; limits stay', async () => {
  await ok(updateDoc(doc(as('alya'), 'items/c1'), { status: 'doing', touchedAt: T_() }));
  await no(updateDoc(doc(as('alya'), 'items/c1'), { status: 'done' }));
  await no(updateDoc(doc(as('alya'), 'items/c1'), { title: 'mine now', touchedAt: T_() }));
});
test.skip('items: legacy item without public/publicBlurb/touchedAt still updatable by lead, boss, assignee', async () => {
  await ok(updateDoc(doc(as('michael'), 'items/c1'), { notes: 'a', touchedAt: T_() }));
  await ok(updateDoc(doc(as('sarah'), 'items/c1'), { notes: 'b', touchedAt: T_() }));
  await ok(updateDoc(doc(as('alya'), 'items/c1'), { notes: 'c', touchedAt: T_() }));
  await ok(updateDoc(doc(as('nadia'), 'items/p1'), { notes: 'd', touchedAt: T_() }));
});
test.skip('items: creating a root project needs touchedAt (exec/advisor)', async () => {
  const base = { ...FULL, termId: T, kind: 'project', parentId: null, ancestors: [], title: 'New', status: 'todo', archived: false, leadUid: null, leadUids: [], assigneeUids: [], createdByUid: em('sarah'), createdAt: serverTimestamp() };
  await ok(setDoc(doc(as('sarah'), 'items/new1'), { ...base, touchedAt: T_() }));
  await no(setDoc(doc(as('sarah'), 'items/new2'), base));
});
test.skip('items: only advisor, president, vp may set public / publicBlurb on a root project', async () => {
  for (const n of admins) {
    await seed();
    await ok(updateDoc(doc(as(n), 'items/p1'), { public: true, publicBlurb: 'Come along', touchedAt: T_() }));
  }
  for (const n of ['michael', 'sarah', 'dimas', 'alya', 'budi']) {
    await no(updateDoc(doc(as(n), 'items/p1'), { public: true, touchedAt: T_() }));
    await no(updateDoc(doc(as(n), 'items/p1'), { publicBlurb: 'x', touchedAt: T_() }));
  }
});
test.skip('items: lead cannot unset or change public or blurb on a public project', async () => {
  await no(updateDoc(doc(as('michael'), 'items/pub1'), { public: false, touchedAt: T_() }));
  await no(updateDoc(doc(as('michael'), 'items/pub1'), { publicBlurb: 'defaced', touchedAt: T_() }));
  await no(updateDoc(doc(as('sarah'), 'items/pub1'), { public: false, touchedAt: T_() }));
  await ok(updateDoc(doc(as('kevin'), 'items/pub1'), { public: false, touchedAt: T_() }));
});
test.skip('items: lead retitling a public project fails (plan L1-11), admin ok', async () => {
  await no(updateDoc(doc(as('michael'), 'items/pub1'), { title: 'Defaced', touchedAt: T_() }));
  await ok(updateDoc(doc(as('nadia'), 'items/pub1'), { title: 'Renamed', touchedAt: T_() }));
});
test.skip('items: publicBlurb max 140 characters', async () => {
  await ok(updateDoc(doc(as('nadia'), 'items/p1'), { public: true, publicBlurb: 'a'.repeat(140), touchedAt: T_() }));
  await no(updateDoc(doc(as('nadia'), 'items/p1'), { public: true, publicBlurb: 'a'.repeat(141), touchedAt: T_() }));
});
test.skip('items: public only on root projects (admin cannot set on child)', async () => {
  await no(updateDoc(doc(as('nadia'), 'items/c1'), { public: true, touchedAt: T_() }));
});
test.skip('items: member creating a child with public true fails', async () => {
  const child = { ...FULL, termId: T, kind: 'task', parentId: 'p1', ancestors: ['p1'], title: 'Sub', status: 'todo', archived: false, leadUid: null, leadUids: [em('michael')], assigneeUids: [], createdByUid: em('michael'), createdAt: serverTimestamp(), touchedAt: T_() };
  await ok(setDoc(doc(as('michael'), 'items/ch1'), child));
  await no(setDoc(doc(as('michael'), 'items/ch2'), { ...child, public: true }));
  await no(setDoc(doc(as('michael'), 'items/ch3'), { ...child, publicBlurb: 'x' }));
});
test.skip('items: root create with public true only by admin', async () => {
  const base = { ...FULL, termId: T, kind: 'project', parentId: null, ancestors: [], title: 'New', status: 'todo', archived: false, leadUid: null, leadUids: [], assigneeUids: [], createdAt: serverTimestamp(), touchedAt: T_(), public: true, publicBlurb: 'hi' };
  await ok(setDoc(doc(as('nadia'), 'items/r1'), { ...base, createdByUid: em('nadia') }));
  await no(setDoc(doc(as('sarah'), 'items/r2'), { ...base, createdByUid: em('sarah') }));
});
test.skip('items: teacher cannot write items', async () => {
  await no(updateDoc(doc(as('budi'), 'items/c1'), { notes: 'x', touchedAt: T_() }));
});

// ---------- teachers: read and comment only ----------
test('teacher: reads items, events, announcements; comments; writes nothing else', async () => {
  const db = as('budi');
  await ok(getDoc(doc(db, 'items/p1')));
  await ok(getDoc(doc(db, 'events/e1')));
  await ok(getDoc(doc(db, 'announcements/a1')));
  await ok(setDoc(doc(db, 'comments/tc1'), { itemId: 'p1', authorUid: em('budi'), text: 'Nice', termId: T, createdAt: Date.now() }));
  await no(setDoc(doc(db, 'events/te'), ev({ createdByUid: em('budi') })));
  await no(setDoc(doc(db, 'ideas/ti'), idea({ authorUid: em('budi'), voters: [em('budi')] })));
  await no(setDoc(doc(db, 'rsvps', 'e1_' + em('budi')), rs('budi')));
  await no(setDoc(doc(db, 'submissions/ts'), sub({ byUid: em('budi') })));
  await no(updateDoc(doc(db, 'ideas/i1'), { voters: arrayUnion(em('budi')) }));
});

// ---------- comments mentionUids ----------
test('comments: optional mentionUids up to 10, 11 fails', async () => {
  const c = (o) => ({ itemId: 'p1', authorUid: em('michael'), text: 'hi @alya', termId: T, createdAt: Date.now(), ...o });
  await ok(setDoc(doc(as('michael'), 'comments/m1'), c({ mentionUids: [em('alya')] })));
  await ok(setDoc(doc(as('michael'), 'comments/m10'), c({ mentionUids: Array.from({ length: 10 }, (_, i) => `u${i}${D}`) })));
  await no(setDoc(doc(as('michael'), 'comments/m11'), c({ mentionUids: Array.from({ length: 11 }, (_, i) => `u${i}${D}`) })));
});

// ---------- term scoping ----------
test('term scoping: after close term, old-term writes to term-scoped collections fail', async () => {
  await ok(updateDoc(doc(as('ariel'), 'settings/current'), { termId: '2027-28' }));
  await no(setDoc(doc(as('nadia'), 'announcements/o1'), ann()));
  await no(setDoc(doc(as('michael'), 'events/o1'), ev()));
  await no(setDoc(doc(as('michael'), 'ideas/o1'), idea()));
  await no(setDoc(doc(as('michael'), 'rsvps', 'e1_' + em('michael')), rs('michael')));
  await ok(setDoc(doc(as('nadia'), 'announcements/n1'), ann({ termId: '2027-28' })));
  await ok(setDoc(doc(as('michael'), 'ideas/n1'), idea({ termId: '2027-28' })));
});
test('term scoping: cross-term collections need no termId and survive close term', async () => {
  await ok(updateDoc(doc(as('ariel'), 'settings/current'), { termId: '2027-28' }));
  await ok(setDoc(doc(as('michael'), 'submissions/t1'), sub()));
  await ok(setDoc(doc(as('nadia'), 'docTemplates/t1'), tpl()));
  await ok(setDoc(doc(as('nadia'), 'public/feed'), feed()));
  await ok(getDoc(doc(as('nadia'), 'submissions/s1')));
});
test('term scoping: cache id must equal the current term', async () => {
  await ok(updateDoc(doc(as('ariel'), 'settings/current'), { termId: '2027-28' }));
  await no(setDoc(doc(as('nadia'), 'cache', T), cache()));
  await ok(setDoc(doc(as('nadia'), 'cache', '2027-28'), cache()));
});
