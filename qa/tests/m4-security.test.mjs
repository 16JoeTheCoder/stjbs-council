// M4 security probes: the exact writes src/actions.js makes for events, RSVPs, submissions, announcements, approvals and
// mentions (they must succeed), plus what a hostile client could add. Tests named FINDING assert the behaviour we WANT;
// a failure is the finding. Run (VS Code terminal, repo root):
//   npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m4-security.test.mjs"
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDocs, collection, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import { feedPayload } from '../../src/feed.js';

const T = '2026-27';
let env;
const P = { advisor: 'ariel@stjbs.sch.id', president: 'pres@stjbs.sch.id', vp: 'vp@stjbs.sch.id', treasurer: 'tres@stjbs.sch.id',
  officer: 'off@stjbs.sch.id', other: 'other@stjbs.sch.id', teacher: 'teach@stjbs.sch.id',
  // Emails with an underscore, to probe the rsvp id scheme eventId + '_' + email.
  xy: 'x_y@stjbs.sch.id', y: 'y@stjbs.sch.id' };
const as = (e) => env.authenticatedContext(e.split('@')[0], { email: e, email_verified: true }).firestore();
const now = () => Date.now();

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-council', firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, 'settings/current'), { termId: T });
    for (const [k, e] of Object.entries(P)) await setDoc(doc(d, 'members', e), { role: ['other', 'xy', 'y'].includes(k) ? 'officer' : k, active: true, name: k, termId: T });
    await setDoc(doc(d, 'events/e1'), { termId: T, title: 'Meeting', type: 'meeting', date: '2026-11-02', start: '15:30', end: '16:30', location: '', notes: '', public: false, itemId: null, createdByUid: P.officer, archived: false, createdAt: 1 });
    await setDoc(doc(d, 'events/pub'), { termId: T, title: 'Open house', type: 'other', date: '2026-11-09', start: '09:00', end: '12:00', location: 'Hall', notes: '', public: true, itemId: null, createdByUid: P.treasurer, archived: false, createdAt: 1 });
    await setDoc(doc(d, 'docTemplates/d1'), { name: 'Budget', kind: 'Sheet', url: 'https://docs.google.com/spreadsheets/d/old/edit', version: 1, archived: false, createdAt: 1 });
    await setDoc(doc(d, 'submissions/s1'), { type: 'new-template', name: 'Rota', url: 'https://docs.google.com/spreadsheets/d/rota/edit', note: '', byUid: P.officer, status: 'pending', archived: false, createdAt: 1 });
    await setDoc(doc(d, 'submissions/s2'), { type: 'template-edit', name: 'Budget v2', url: 'https://docs.google.com/spreadsheets/d/old/edit', targetId: 'd1', note: '', byUid: P.officer, status: 'pending', archived: false, createdAt: 2 });
    await setDoc(doc(d, 'items/p'), { termId: T, parentId: null, ancestors: [], leadUids: [], leadUid: null, kind: 'project', title: 'Carnival', status: 'todo', blocked: false, archived: false, isDeal: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdByUid: P.advisor });
  });
});

// ---- The client's own write shapes (src/actions.js) must be accepted

test('saveEvent: create (officer, public false) and edit shapes are accepted', async () => {
  const body = { title: 'Booth', type: 'project', date: '2026-11-03', start: '15:00', end: '16:00', location: '', notes: 'x', public: false, itemId: null, updatedAt: now() };
  await assertSucceeds(setDoc(doc(as(P.officer), 'events/n1'), { ...body, termId: T, createdByUid: P.officer, archived: false, createdAt: now() }));
  await assertSucceeds(updateDoc(doc(as(P.officer), 'events/n1'), { ...body, title: 'Booth 2' }));
  await assertSucceeds(updateDoc(doc(as(P.vp), 'events/n1'), { ...body, public: true }));
});
test('submitResource shapes: new-template, template-edit and archive (no projectId when blank)', async () => {
  const base = { byUid: P.officer, archived: false, createdAt: now(), note: '' };
  const db = as(P.officer);
  await assertSucceeds(setDoc(doc(db, 'submissions/a'), { ...base, type: 'new-template', name: 'N', url: 'https://docs.google.com/document/d/abc/edit', status: 'pending' }));
  await assertSucceeds(setDoc(doc(db, 'submissions/b'), { ...base, type: 'template-edit', name: 'N', url: 'https://docs.google.com/document/d/abc/edit', status: 'pending', targetId: 'd1' }));
  await assertSucceeds(setDoc(doc(db, 'submissions/c'), { ...base, type: 'archive', name: 'N', url: 'https://drive.google.com/file/d/abc/view', status: 'filed', projectId: 'p' }));
  await assertSucceeds(setDoc(doc(db, 'submissions/d'), { ...base, type: 'archive', name: 'N', url: 'https://drive.google.com/drive/folders/abc', status: 'filed' }));
});
test('saveAnnouncement and decide shapes are accepted', async () => {
  const a = { title: 'T', body: '', audience: 'everyone', startDate: '2026-10-30', endDate: '2026-11-05' };
  await assertSucceeds(setDoc(doc(as(P.president), 'announcements/a1'), { ...a, termId: T, createdByUid: P.president, archived: false, createdAt: now() }));
  await assertSucceeds(updateDoc(doc(as(P.president), 'announcements/a1'), { ...a, audience: 'members', updatedAt: now() }));
  const db = as(P.vp), b = writeBatch(db);
  b.update(doc(db, 'submissions/s1'), { status: 'approved' });
  b.set(doc(db, 'docTemplates/new'), { name: 'Rota', kind: 'Sheet', url: 'https://docs.google.com/spreadsheets/d/rota/edit', version: 1, archived: false, createdAt: now() });
  await assertSucceeds(b.commit());
});

// ---- Hostile clients

test('a non-admin cannot approve, create a template, or change a submission', async () => {
  const db = as(P.treasurer), b = writeBatch(db);
  b.update(doc(db, 'submissions/s1'), { status: 'approved' });
  b.set(doc(db, 'docTemplates/new'), { name: 'Rota', kind: 'Sheet', url: 'https://docs.google.com/spreadsheets/d/rota/edit', version: 1, archived: false, createdAt: now() });
  await assertFails(b.commit());
  await assertFails(updateDoc(doc(as(P.officer), 'submissions/s1'), { status: 'approved' })); // the author too
  await assertFails(setDoc(doc(as(P.treasurer), 'docTemplates/x'), { name: 'x', kind: 'Doc', url: 'https://docs.google.com/document/d/a', version: 1, archived: false, createdAt: 1 }));
});
test('an admin cannot create or retarget a template with a non-Google url', async () => {
  const db = as(P.vp);
  await assertFails(setDoc(doc(db, 'docTemplates/e'), { name: 'e', kind: 'Doc', url: 'https://evil.example/https://docs.google.com/document/d/a', version: 1, archived: false, createdAt: 1 }));
  await assertFails(updateDoc(doc(db, 'docTemplates/d1'), { url: 'https://evil.example/', version: 2, updatedAt: 1 }));
  // a submission can never hold one either, so approval has nothing bad to copy
  await assertFails(setDoc(doc(as(P.officer), 'submissions/bad'), { type: 'new-template', name: 'x', url: 'javascript:alert(1)', note: '', byUid: P.officer, status: 'pending', archived: false, createdAt: 1 }));
  await assertFails(setDoc(doc(as(P.officer), 'submissions/bad2'), { type: 'archive', name: 'x', url: 'https://docs.google.com/url?q=https://evil.example', note: '', byUid: P.officer, status: 'filed', archived: false, createdAt: 1 }));
});
test('submission reads: non-authors are refused on every query shape the admin views use', async () => {
  const lead = as(P.other);
  await assertFails(getDocs(query(collection(lead, 'submissions'), where('status', '==', 'pending'))));
  await assertFails(getDocs(query(collection(lead, 'submissions'), where('type', '==', 'archive'), orderBy('createdAt', 'desc'), limit(50))));
  await assertFails(getDocs(query(collection(lead, 'submissions'), where('byUid', '==', P.officer))));
  await assertSucceeds(getDocs(query(collection(as(P.vp), 'submissions'), where('status', '==', 'pending'))));
  await assertSucceeds(getDocs(query(collection(as(P.vp), 'submissions'), where('type', '==', 'archive'), orderBy('createdAt', 'desc'), limit(50))));
});
test('event public flag and public text: a creator cannot publish or rewrite what is public', async () => {
  const body = { title: 'Meeting', type: 'meeting', date: '2026-11-02', start: '15:30', end: '16:30', location: '', notes: '', itemId: null, updatedAt: now() };
  await assertFails(updateDoc(doc(as(P.officer), 'events/e1'), { ...body, public: true }));
  await assertFails(setDoc(doc(as(P.officer), 'events/n2'), { ...body, termId: T, createdByUid: P.officer, archived: false, createdAt: 1, public: true }));
  await assertFails(updateDoc(doc(as(P.treasurer), 'events/pub'), { location: 'My home address' }));
  await assertFails(updateDoc(doc(as(P.treasurer), 'events/pub'), { public: false }));
  const { public: _omit, ...noFlag } = { ...body, termId: T, createdByUid: P.officer, archived: false, createdAt: 1 };
  await assertFails(setDoc(doc(as(P.officer), 'events/n3'), noFlag)); // no public field at all
});
test('rsvp forging: someone else\'s id or uid, a missing event, a teacher', async () => {
  const r = (uid) => ({ termId: T, eventId: 'e1', uid, status: 'going', archived: false, createdAt: 1, updatedAt: 1 });
  await assertSucceeds(setDoc(doc(as(P.officer), `rsvps/e1_${P.officer}`), r(P.officer)));
  await assertFails(setDoc(doc(as(P.other), `rsvps/e1_${P.officer}`), r(P.officer)));
  await assertFails(setDoc(doc(as(P.other), `rsvps/e1_${P.officer}`), r(P.other)));
  await assertFails(setDoc(doc(as(P.teacher), `rsvps/e1_${P.teacher}`), r(P.teacher)));
});

// ---- Findings (desired behaviour; a failure is the finding)

test('FINDING M4-S1: a member can post a notification to an address that is not on the roster', async () => {
  const db = as(P.officer);
  await assertFails(setDoc(doc(db, 'notifications/stranger@gmail.com/items/n1'), { termId: T, toUid: 'stranger@gmail.com', fromUid: P.officer, type: 'mention', itemId: 'p', text: 'hi', read: false, createdAt: now() }));
});
test('FINDING M4-S2: notification type is not restricted to the known types', async () => {
  const db = as(P.officer);
  await assertFails(setDoc(doc(db, `notifications/${P.president}/items/n2`), { termId: T, toUid: P.president, fromUid: P.officer, type: 'urgent-from-advisor', itemId: 'p', text: 'x', read: false, createdAt: now() }));
});
test('FINDING M4-S3: a comment\'s mentionUids must be member emails (strings), not arbitrary values', async () => {
  const db = as(P.officer), c = (m) => ({ termId: T, itemId: 'p', authorUid: P.officer, text: 'hi', mentionUids: m, createdAt: now() });
  await assertFails(setDoc(doc(db, 'comments/c1'), c([{ a: 1 }, 7])));
  await assertFails(setDoc(doc(db, 'comments/c2'), c(['stranger@gmail.com'])));
});
test('FINDING M4-S4: rsvp id collision lets one member overwrite another member\'s reply when emails contain "_"', async () => {
  // x_y@... replies to event e1 -> id "e1_x_y@stjbs.sch.id". y@... creates an event whose id is "e1_x" and writes the same
  // document id as its own reply (eventId "e1_x" + "_" + y@...), taking it over.
  await assertSucceeds(setDoc(doc(as(P.xy), `rsvps/e1_${P.xy}`), { termId: T, eventId: 'e1', uid: P.xy, status: 'going', archived: false, createdAt: 1, updatedAt: 1 }));
  await assertSucceeds(setDoc(doc(as(P.y), 'events/e1_x'), { termId: T, title: 'x', type: 'other', date: '2026-11-02', start: '10:00', end: '11:00', location: '', notes: '', public: false, itemId: null, createdByUid: P.y, archived: false, createdAt: 1 }));
  await assertFails(setDoc(doc(as(P.y), `rsvps/e1_x_${P.y}`), { termId: T, eventId: 'e1_x', uid: P.y, status: 'not', archived: false, createdAt: 1, updatedAt: 1 }));
});
test('FINDING M4-S5: approving an already-decided submission again is refused (no duplicate template)', async () => {
  const db = as(P.vp);
  const approve = (tid) => { const b = writeBatch(db); b.update(doc(db, 'submissions/s1'), { status: 'approved' }); b.set(doc(db, `docTemplates/${tid}`), { name: 'Rota', kind: 'Sheet', url: 'https://docs.google.com/spreadsheets/d/rota/edit', version: 1, archived: false, createdAt: now() }); return b.commit(); };
  await assertSucceeds(approve('t1'));
  await assertFails(approve('t2')); // a double click or a second admin
});
test('FINDING M4-S6: approving a template edit whose url equals the current one must work', async () => {
  const db = as(P.vp), b = writeBatch(db);
  b.update(doc(db, 'submissions/s2'), { status: 'approved' });
  b.update(doc(db, 'docTemplates/d1'), { url: 'https://docs.google.com/spreadsheets/d/old/edit', version: 2, updatedAt: now() }); // what decide() sends
  await assertSucceeds(b.commit());
});
test('FINDING M4-S7: an admin can move an archive file or a decided submission to any status', async () => {
  await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'submissions/f1'), { type: 'archive', name: 'r', url: 'https://drive.google.com/file/d/a/view', note: '', byUid: P.officer, status: 'filed', archived: false, createdAt: 1 }));
  await assertFails(updateDoc(doc(as(P.vp), 'submissions/f1'), { status: 'approved' }));
});

// ---- The public feed never carries members-only text or private events

test('feedPayload: members-only announcements, private events and extra fields stay out', () => {
  const day = '2026-10-30';
  const out = feedPayload({ day, projects: [], events: [
      { title: 'Public', type: 'other', date: '2026-11-02', start: '09:00', end: '10:00', location: 'Hall', public: true, notes: 'SECRET NOTE', createdByUid: 'a@b.c', archived: false },
      { title: 'Private', type: 'meeting', date: '2026-11-02', start: '09:00', end: '10:00', location: 'Room', public: false, archived: false }],
    announcements: [
      { title: 'Everyone', body: 'ok', audience: 'everyone', startDate: day, endDate: day, createdByUid: 'a@b.c', archived: false },
      { title: 'Members', body: 'MEMBERS ONLY', audience: 'members', startDate: day, endDate: day, archived: false }] });
  const json = JSON.stringify(out);
  assert.ok(!json.includes('MEMBERS ONLY') && !json.includes('Private') && !json.includes('SECRET NOTE') && !json.includes('a@b.c'));
  assert.deepEqual(Object.keys(out.events[0]), ['title', 'type', 'date', 'start', 'end', 'location']);
  assert.deepEqual(Object.keys(out.announcements[0]), ['title', 'body', 'startDate', 'endDate']);
});
