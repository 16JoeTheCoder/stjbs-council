// M1 security probes. Each test asserts the SECURE expectation; a failing test is a demonstrated hole.
// Run (repo root, Ubuntu/WSL or VS Code terminal):
//   npx firebase emulators:exec --config qa/firebase.alt.json --only firestore --project demo-council "node --test qa/tests/m1-security.test.mjs"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';

const T = '2026-27';
let env;
const P = {
  advisor: 'ariel@stjbs.sch.id', president: 'pres@stjbs.sch.id', vp: 'vp@stjbs.sch.id', treasurer: 'tres@stjbs.sch.id',
  officer: 'off@stjbs.sch.id', lead: 'lead@stjbs.sch.id', teacher: 'teach@stjbs.sch.id', other: 'other@stjbs.sch.id',
  victim: 'y_x@stjbs.sch.id', attacker: 'x@stjbs.sch.id',
};
const as = (email, verified = true) => env.authenticatedContext(email.split('@')[0], { email, email_verified: verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const touch = { touchedAt: serverTimestamp() };
const item = (o) => ({
  termId: T, parentId: null, ancestors: [], leadUids: [], leadUid: null, kind: 'task', title: 't', notes: '', link: '', assigneeUids: [],
  createdByUid: P.advisor, status: 'todo', blocked: false, dueDate: '2026-11-01', archived: false, isDeal: false, dealStage: 'Lead',
  pledgedIdr: 0, receivedIdr: 0, createdAt: 1, ...o,
});
const event = (o) => ({ termId: T, title: 'Meeting', type: 'meeting', date: '2026-11-02', start: '15:30', end: '16:30', location: 'Room 2', notes: '', public: false, createdByUid: P.officer, archived: false, createdAt: 1, ...o });
const tpl = (o) => ({ name: 'Proposal', kind: 'Doc', url: 'https://docs.google.com/document/d/abc/edit', version: 1, archived: false, createdAt: 1, ...o });
const sub = (o) => ({ type: 'new-template', name: 'Budget', url: 'https://docs.google.com/spreadsheets/d/x/edit', note: '', byUid: P.officer, status: 'pending', archived: false, createdAt: 1, ...o });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-council', firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'settings/current'), { termId: T, termName: T });
    for (const [role, email] of Object.entries(P))
      await setDoc(doc(db, 'members', email), { name: role, role: ['lead', 'other', 'victim', 'attacker'].includes(role) ? 'officer' : role, active: true, termId: T, section: '', reportsTo: null });
    await setDoc(doc(db, 'items/rootLead'), item({ kind: 'project', title: 'Led root', leadUid: P.lead, leadUids: [P.lead], assigneeUids: [P.officer] }));
    await setDoc(doc(db, 'items/pubRoot'), item({ kind: 'project', title: 'Carnival', public: true, publicBlurb: 'Come', leadUid: P.lead, leadUids: [P.lead], assigneeUids: [P.officer] }));
    await setDoc(doc(db, 'items/child'), item({ kind: 'team', parentId: 'pubRoot', ancestors: ['pubRoot'], leadUids: [P.lead], assigneeUids: [P.officer] }));
    await setDoc(doc(db, 'events/pub'), event({ public: true, createdByUid: P.treasurer }));
    await setDoc(doc(db, 'events/e1'), event({}));
    await setDoc(doc(db, 'ideas/i1'), { termId: T, text: 'Movie', authorUid: P.lead, voters: [P.lead, P.other], archived: false, createdAt: 1 });
    await setDoc(doc(db, 'docTemplates/d1'), tpl({}));
    await setDoc(doc(db, 'submissions/s1'), sub({}));
    await setDoc(doc(db, 'submissions/s2'), sub({ byUid: P.other }));
    await setDoc(doc(db, 'public/feed'), { json: '{}', hash: 'h', updatedAt: 1 });
    await setDoc(doc(db, 'cache', T), { json: '[]', at: new Date(), count: 0, updatedAt: 1 });
    await setDoc(doc(db, `notifications/${P.other}/items/n1`), { toUid: P.other, fromUid: P.lead, read: false, text: 'x', termId: T });
    await setDoc(doc(db, 'comments/c1'), { termId: T, authorUid: P.other, text: 'hi', itemId: 'child' });
    await setDoc(doc(db, 'stats/s'), { termId: T });
  });
});

// ---------- members / roles
test('members: president cannot change role or active, create admin roles, or touch the advisor', async () => {
  const d = as(P.president);
  await assertFails(updateDoc(doc(d, 'members', P.officer), { role: 'vp', termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.officer), { active: false, termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.advisor), { name: 'x', termId: T }));
  for (const r of ['vp', 'president', 'advisor'])
    await assertFails(setDoc(doc(d, 'members', `new${r}@stjbs.sch.id`), { name: 'n', role: r, active: true, termId: T }));
  await assertSucceeds(setDoc(doc(d, 'members', 'new@stjbs.sch.id'), { name: 'n', role: 'officer', active: true, termId: T }));
  await assertSucceeds(updateDoc(doc(d, 'members', P.officer), { name: 'Renamed', section: 's', reportsTo: null, initials: 'R', termId: T, updatedAt: 1 }));
});
test('members: president cannot smuggle role via role->same value rewrite of active key removal', async () => {
  const d = as(P.president);
  const { deleteField } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(d, 'members', P.officer), { active: deleteField(), termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.officer), { email: 'x', termId: T }));
});
test('members: VP cannot touch or assign advisor, cannot change own role/active', async () => {
  const d = as(P.vp);
  await assertFails(updateDoc(doc(d, 'members', P.advisor), { active: false, termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.advisor), { name: 'z', termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.officer), { role: 'advisor', termId: T }));
  await assertFails(setDoc(doc(d, 'members', 'adv2@stjbs.sch.id'), { name: 'n', role: 'advisor', active: true, termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.vp), { role: 'president', termId: T }));
  await assertFails(updateDoc(doc(d, 'members', P.vp), { active: false, termId: T }));
  await assertSucceeds(updateDoc(doc(d, 'members', P.president), { role: 'officer', termId: T }));
});
test('members: nobody but admins writes; advisor cannot change own role; no deletes', async () => {
  await assertFails(updateDoc(doc(as(P.officer), 'members', P.officer), { role: 'advisor', termId: T }));
  await assertFails(updateDoc(doc(as(P.treasurer), 'members', P.treasurer), { name: 'x', termId: T }));
  await assertFails(updateDoc(doc(as(P.advisor), 'members', P.advisor), { role: 'officer', termId: T }));
  await assertFails(deleteDoc(doc(as(P.advisor), 'members', P.officer)));
  await assertFails(setDoc(doc(as(P.advisor), 'members', 'Upper@stjbs.sch.id'), { name: 'n', role: 'officer', active: true, termId: T }));
  await assertFails(setDoc(doc(as(P.advisor), 'members', 'a@gmail.com'), { name: 'n', role: 'officer', active: true, termId: T }));
});
test('auth: unverified email and inactive members read nothing', async () => {
  const u = as(P.advisor, false);
  for (const p of ['members/' + P.officer, 'items/pubRoot', 'settings/current', 'cache/' + T, 'submissions/s1', 'ideas/i1', 'events/e1'])
    await assertFails(getDoc(doc(u, p)));
  await assertFails(setDoc(doc(u, 'public/feed'), { json: '{}', hash: 'h', updatedAt: 2 }));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'members', P.officer), { active: false }));
  await assertFails(getDoc(doc(as(P.officer), 'items/pubRoot')));
  await assertFails(getDoc(doc(env.authenticatedContext('anon').firestore(), 'items/pubRoot')));
  await assertFails(getDoc(doc(anon(), 'members/' + P.officer)));
});

// ---------- public flags on items and events
test('items: only admin sets public/publicBlurb or retitles public roots', async () => {
  for (const who of ['lead', 'officer', 'treasurer', 'teacher']) {
    const d = as(P[who]);
    await assertFails(updateDoc(doc(d, 'items/rootLead'), { public: true, ...touch }));
    await assertFails(updateDoc(doc(d, 'items/rootLead'), { publicBlurb: 'hi', ...touch }));
    await assertFails(updateDoc(doc(d, 'items/pubRoot'), { publicBlurb: 'changed', ...touch }));
    await assertFails(updateDoc(doc(d, 'items/pubRoot'), { public: false, ...touch }));
    await assertFails(updateDoc(doc(d, 'items/pubRoot'), { title: 'Hacked', ...touch }));
  }
  await assertFails(setDoc(doc(as(P.treasurer), 'items/new1'), item({ kind: 'project', title: 'n', public: true, publicBlurb: 'x', createdByUid: P.treasurer, leadUid: null, ...touch })));
  await assertFails(setDoc(doc(as(P.president), 'items/new2'), item({ kind: 'team', parentId: 'pubRoot', ancestors: ['pubRoot'], leadUids: [P.lead], title: 'n', public: true, createdByUid: P.president, ...touch })));
  await assertFails(updateDoc(doc(as(P.president), 'items/child'), { public: true, ...touch }));
  await assertSucceeds(updateDoc(doc(as(P.president), 'items/pubRoot'), { publicBlurb: 'ok', ...touch }));
  await assertSucceeds(updateDoc(doc(as(P.vp), 'items/pubRoot'), { title: 'Renamed', ...touch }));
});
test('items: assignee cannot set public or retitle', async () => {
  const d = as(P.officer);
  await assertFails(updateDoc(doc(d, 'items/pubRoot'), { public: false, ...touch }));
  await assertFails(updateDoc(doc(d, 'items/pubRoot'), { title: 'x', ...touch }));
  await assertSucceeds(updateDoc(doc(d, 'items/pubRoot'), { status: 'doing', ...touch }));
});
test('events: only admin changes public or retitles/relocates a public event', async () => {
  const t = as(P.treasurer);
  await assertFails(updateDoc(doc(t, 'events/pub'), { title: 'x' }));
  await assertFails(updateDoc(doc(t, 'events/pub'), { location: 'x' }));
  await assertFails(updateDoc(doc(t, 'events/e1'), { public: true }));
  await assertFails(setDoc(doc(as(P.officer), 'events/n'), event({ public: true })));
});
test('events: GAP creator of a public event can change its date, time or type without admin (these are published)', async () => {
  const t = as(P.treasurer);
  await assertFails(updateDoc(doc(t, 'events/pub'), { date: '2030-01-01' }));
  await assertFails(updateDoc(doc(t, 'events/pub'), { start: '00:00', end: '23:59' }));
  await assertFails(updateDoc(doc(t, 'events/pub'), { archived: true }));
});
test('items: GAP lead can archive a public project (disappears from website)', async () => {
  await assertFails(updateDoc(doc(as(P.lead), 'items/pubRoot'), { archived: true, ...touch }));
});

// ---------- ID forging
test('rsvps: forged ids/uids fail', async () => {
  const o = as(P.officer);
  const mk = (id, uid) => setDoc(doc(o, 'rsvps', id), { termId: T, eventId: 'e1', uid, status: 'going', archived: false, createdAt: 1, updatedAt: 1 });
  await assertFails(mk('e1_' + P.other, P.other));
  await assertFails(mk('e1_' + P.other, P.officer));
  await assertFails(mk('e1_' + P.officer, P.other));
  await assertFails(setDoc(doc(o, 'rsvps', 'nope_' + P.officer), { termId: T, eventId: 'nope', uid: P.officer, status: 'going', archived: false, createdAt: 1, updatedAt: 1 }));
  await assertFails(setDoc(doc(as(P.teacher), 'rsvps', 'e1_' + P.teacher), { termId: T, eventId: 'e1', uid: P.teacher, status: 'going', archived: false, createdAt: 1, updatedAt: 1 }));
  await assertSucceeds(mk('e1_' + P.officer, P.officer));
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'rsvps/e1_' + P.other), { termId: T, eventId: 'e1', uid: P.other, status: 'going', archived: false }));
  await assertFails(updateDoc(doc(o, 'rsvps', 'e1_' + P.other), { status: 'not' }));
});
test('checkins: id forging via underscore in weekId (collides with an email that has an underscore)', async () => {
  // victim doc id: T_W45_y_x@...   attacker x@... writes weekId "W45_y" -> same id
  const id = `${T}_W45_${P.victim}`;
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'checkins', id), { termId: T, weekId: 'W45', uid: P.victim, done: 'real', doing: '', blocked: '' }));
  await assertFails(setDoc(doc(as(P.attacker), 'checkins', id), { termId: T, weekId: 'W45_y', uid: P.attacker, done: 'FORGED', doing: '', blocked: '' }));
});
test('checkins: cannot write another user, wrong id', async () => {
  const o = as(P.officer);
  await assertFails(setDoc(doc(o, 'checkins', `${T}_W1_${P.other}`), { termId: T, weekId: 'W1', uid: P.other }));
  await assertFails(setDoc(doc(o, 'checkins', `${T}_W1_${P.officer}`), { termId: T, weekId: 'W1', uid: P.other }));
});
test('checkins: teacher is read-only (prompt: teachers read and comment only)', async () => {
  await assertFails(setDoc(doc(as(P.teacher), 'checkins', `${T}_W1_${P.teacher}`), { termId: T, weekId: 'W1', uid: P.teacher }));
});
test('notifications: cannot read, mark, delete or impersonate in another inbox', async () => {
  const o = as(P.officer);
  await assertFails(getDoc(doc(o, `notifications/${P.other}/items/n1`)));
  await assertFails(getDocs(collection(o, `notifications/${P.other}/items`)));
  await assertFails(updateDoc(doc(o, `notifications/${P.other}/items/n1`), { read: true }));
  await assertFails(deleteDoc(doc(o, `notifications/${P.other}/items/n1`)));
  await assertFails(setDoc(doc(o, `notifications/${P.other}/items/f`), { termId: T, toUid: P.other, fromUid: P.lead, read: false, text: 'x' }));
  await assertFails(setDoc(doc(o, `notifications/${P.other}/items/f2`), { termId: T, toUid: P.lead, fromUid: P.officer, read: false, text: 'x' }));
  await assertSucceeds(setDoc(doc(o, `notifications/${P.other}/items/ok`), { termId: T, toUid: P.other, fromUid: P.officer, read: false, text: 'x', createdAt: Date.now() }));
});
test('notifications: GAP teacher (read/comment only) and anyone can write arbitrary, unbounded payloads into any member inbox', async () => {
  await assertFails(setDoc(doc(as(P.teacher), `notifications/${P.other}/items/t`), { termId: T, toUid: P.other, fromUid: P.teacher, read: false, text: 'x' }));
  await assertFails(setDoc(doc(as(P.officer), `notifications/${P.other}/items/big`), { termId: T, toUid: P.other, fromUid: P.officer, read: false, text: 'x'.repeat(100000), link: 'javascript:alert(1)' }));
});
test('comments/activity: cannot forge author, edit or delete others', async () => {
  const o = as(P.officer);
  await assertFails(setDoc(doc(o, 'comments/f'), { termId: T, authorUid: P.other, text: 'x' }));
  await assertFails(deleteDoc(doc(o, 'comments/c1')));
  await assertFails(updateDoc(doc(o, 'comments/c1'), { text: 'x' }));
  await assertFails(setDoc(doc(o, 'activity/a'), { termId: T, actorUid: P.other }));
  await assertSucceeds(setDoc(doc(o, 'activity/a2'), { termId: T, actorUid: P.officer, text: 'x', createdAt: Date.now() }));
  await assertFails(updateDoc(doc(o, 'activity/a2'), { actorUid: P.other }));
});

// ---------- ideas
test('ideas: vote rule resists inflation, swapping and removing others', async () => {
  const o = as(P.officer), r = (v) => updateDoc(doc(o, 'ideas/i1'), { voters: v });
  await assertFails(r([P.lead, P.other, P.officer, P.officer, P.officer]));
  await assertFails(r([P.lead, P.other, P.officer, P.officer]));
  await assertFails(r([P.lead, P.officer]));                // swap other out, me in
  await assertFails(r([P.lead]));                           // remove other
  await assertFails(r([P.lead, P.other, 'x@stjbs.sch.id'])); // add someone else
  await assertFails(r([P.lead, P.other, P.officer, 'x@stjbs.sch.id']));
  await assertFails(r([P.officer]));                        // replace all
  await assertFails(r([]));
  await assertFails(r([P.lead, P.other, P.officer.toUpperCase()]));
  await assertFails(r('x'));
  await assertFails(updateDoc(doc(o, 'ideas/i1'), { voters: [P.lead, P.other, P.officer], text: 'edited' }));
  await assertFails(updateDoc(doc(o, 'ideas/i1'), { authorUid: P.officer }));
  await assertFails(updateDoc(doc(as(P.teacher), 'ideas/i1'), { voters: arrayUnion(P.teacher) }));
  await assertFails(updateDoc(doc(as(P.lead), 'ideas/i1'), { voters: [P.lead, P.other, P.lead] }));
  await assertFails(updateDoc(doc(as(P.lead), 'ideas/i1'), { voters: arrayRemove(P.other) }));
  await assertFails(updateDoc(doc(o, 'ideas/i1'), { archived: true }));
  await assertSucceeds(r([P.lead, P.other, P.officer]));
  await assertSucceeds(updateDoc(doc(o, 'ideas/i1'), { voters: arrayRemove(P.officer) }));
  await assertSucceeds(updateDoc(doc(as(P.lead), 'ideas/i1'), { voters: arrayRemove(P.lead) }));
});
test('ideas: create must be voters=[me], author=me', async () => {
  const o = as(P.officer), base = { termId: T, text: 't', authorUid: P.officer, voters: [P.officer], archived: false, createdAt: 1 };
  await assertFails(setDoc(doc(o, 'ideas/n1'), { ...base, voters: [P.officer, P.officer, P.officer] }));
  await assertFails(setDoc(doc(o, 'ideas/n2'), { ...base, voters: [P.other] }));
  await assertFails(setDoc(doc(o, 'ideas/n3'), { ...base, authorUid: P.other }));
  await assertFails(setDoc(doc(o, 'ideas/n4'), { ...base, extra: 1 }));
  await assertSucceeds(setDoc(doc(o, 'ideas/n5'), base));
});

// ---------- Google URL restriction
const REJECT = {
  userinfo: 'https://docs.google.com@evil.com/document/d/x',
  userinfo2: 'https://evil.com@docs.google.com/document/d/x',
  userinfo3: 'https://docs.google.com:x@evil.com/document/d/x',
  backslash: 'https://docs.google.com\\@evil.com/document/d/x',
  backslash2: 'https://docs.google.com\\document/d/x',
  upperHost: 'https://DOCS.GOOGLE.COM/document/d/x',
  upperScheme: 'HTTPS://docs.google.com/document/d/x',
  trailingDot: 'https://docs.google.com./document/d/x',
  port: 'https://docs.google.com:443/document/d/x',
  port2: 'https://docs.google.com:8443/document/d/x',
  http: 'http://docs.google.com/document/d/x',
  encodedDot: 'https://docs%2Egoogle.com/document/d/x',
  encodedAt: 'https://docs.google.com%40evil.com/document/d/x',
  lookalike: 'https://docs.google.com.evil.com/document/d/x',
  lookalike2: 'https://docs-google.com/document/d/x',
  redirector: 'https://docs.google.com/url?q=https://evil.com',
  redirector2: 'https://docs.google.com/document/../url?q=https://evil.com',
  otherPath: 'https://docs.google.com/evil',
  js: 'javascript:alert(1)//https://docs.google.com/document/',
  data: 'data:text/html,https://docs.google.com/document/x',
  space: 'https://docs.google.com/document/d/x y',
  driveSub: 'https://drive.google.com.evil.com/file/d/x',
  driveRoot: 'https://drive.google.com/evil',
  googleapis: 'https://script.google.com/macros/s/x/exec',
  sites: 'https://sites.google.com/view/x',
  tooLong: 'https://docs.google.com/document/d/' + 'a'.repeat(500),
};
test('google(): host-level bypasses are rejected on docTemplates and submissions', async () => {
  const a = as(P.president), o = as(P.officer), bad = [];
  for (const [k, url] of Object.entries(REJECT)) {
    const t = await assertSucceeds(Promise.resolve(true)) && (await env.withSecurityRulesDisabled(async () => null), true);
    const ok1 = await setDoc(doc(a, 'docTemplates', 't_' + k), tpl({ url })).then(() => true, () => false);
    const ok2 = await setDoc(doc(o, 'submissions', 's_' + k), sub({ url })).then(() => true, () => false);
    if (ok1 || ok2) bad.push(`${k} docTemplates=${ok1} submissions=${ok2}: ${JSON.stringify(url)}`);
  }
  if (bad.length) throw new Error('ACCEPTED:\n' + bad.join('\n'));
});
test('google(): control characters (newline, tab, CR, NUL, unicode space) are rejected', async () => {
  const a = as(P.president), bad = [];
  const cases = { newline: 'https://docs.google.com/document/d/x\nhttps://evil.com', tab: 'https://docs.google.com/document/d/x\tfoo', cr: 'https://docs.google.com/document/d/x\rfoo',
    nul: 'https://docs.google.com/document/d/x\u0000', nbsp: 'https://docs.google.com/document/d/x y', rlo: 'https://docs.google.com/document/d/x‮abc', leadNl: '\nhttps://docs.google.com/document/d/x' };
  for (const [k, url] of Object.entries(cases)) if (await setDoc(doc(a, 'docTemplates', 'c_' + k), tpl({ url })).then(() => true, () => false)) bad.push(k);
  if (bad.length) throw new Error('ACCEPTED: ' + bad.join(', '));
});
test('google(): legitimate links are accepted', async () => {
  const a = as(P.president);
  for (const [i, url] of ['https://docs.google.com/document/d/abc/edit', 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0', 'https://drive.google.com/file/d/abc/view', 'https://drive.google.com/drive/folders/abc', 'https://drive.google.com/open?id=abc'].entries())
    await assertSucceeds(setDoc(doc(a, 'docTemplates', 'ok' + i), tpl({ url })));
});
test('docTemplates: officer/treasurer/teacher cannot write; version cannot be forced', async () => {
  for (const w of ['officer', 'treasurer', 'teacher']) {
    await assertFails(setDoc(doc(as(P[w]), 'docTemplates/n'), tpl({})));
    await assertFails(updateDoc(doc(as(P[w]), 'docTemplates/d1'), { name: 'x' }));
  }
  const a = as(P.vp);
  await assertFails(updateDoc(doc(a, 'docTemplates/d1'), { url: 'https://docs.google.com/document/d/new', version: 1 }));
  await assertFails(updateDoc(doc(a, 'docTemplates/d1'), { url: 'https://docs.google.com/document/d/new', version: 5 }));
  await assertFails(updateDoc(doc(a, 'docTemplates/d1'), { version: 9 }));
  await assertSucceeds(updateDoc(doc(a, 'docTemplates/d1'), { url: 'https://docs.google.com/document/d/new', version: 2 }));
});

// ---------- submissions
test('submissions: reads are author or admin only; updates admin status only', async () => {
  const o = as(P.officer);
  await assertFails(getDoc(doc(o, 'submissions/s2')));
  await assertFails(getDocs(collection(o, 'submissions')));
  await assertFails(getDocs(query(collection(o, 'submissions'), where('byUid', '==', P.other))));
  await assertFails(getDocs(query(collection(o, 'submissions'), where('status', '==', 'pending'))));
  await assertSucceeds(getDocs(query(collection(o, 'submissions'), where('byUid', '==', P.officer))));
  await assertSucceeds(getDoc(doc(as(P.president), 'submissions/s2')));
  await assertFails(updateDoc(doc(o, 'submissions/s1'), { status: 'approved' }));
  await assertFails(updateDoc(doc(as(P.treasurer), 'submissions/s1'), { status: 'approved' }));
  await assertFails(updateDoc(doc(as(P.president), 'submissions/s1'), { status: 'approved', byUid: P.other }));
  await assertFails(updateDoc(doc(as(P.president), 'submissions/s1'), { url: 'https://docs.google.com/document/d/z' }));
  await assertFails(deleteDoc(doc(as(P.advisor), 'submissions/s1')));
  await assertFails(setDoc(doc(o, 'submissions/x'), sub({ byUid: P.other })));
  await assertFails(setDoc(doc(o, 'submissions/x'), sub({ status: 'approved' })));
  await assertFails(setDoc(doc(o, 'submissions/x'), sub({ type: 'archive', status: 'pending' })));
  await assertFails(setDoc(doc(as(P.teacher), 'submissions/x'), sub({ byUid: P.teacher })));
  await assertFails(setDoc(doc(o, 'submissions/x'), sub({ type: 'template-edit' })));
});

// ---------- feed and cache
test('feed: world get only; no list; write admin only with exact keys; leaks nothing by rule shape', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'public/feed')));
  await assertFails(getDocs(collection(anon(), 'public')));
  await assertFails(setDoc(doc(anon(), 'public/feed'), { json: '{}', hash: 'h', updatedAt: 2 }));
  await assertFails(setDoc(doc(anon(), 'public/other'), { json: '{}' }));
  await assertFails(getDoc(doc(anon(), 'public/other')));
  for (const w of ['treasurer', 'officer', 'teacher']) await assertFails(setDoc(doc(as(P[w]), 'public/feed'), { json: '{}', hash: 'h', updatedAt: 2 }));
  await assertFails(setDoc(doc(as(P.vp), 'public/feed'), { json: '{}', hash: 'h', updatedAt: 2, updatedByUid: P.vp }));
  await assertFails(setDoc(doc(as(P.vp), 'public/feed'), { json: 'x'.repeat(200001), hash: 'h', updatedAt: 2 }));
  await assertFails(deleteDoc(doc(as(P.vp), 'public/feed')));
  await assertSucceeds(setDoc(doc(as(P.vp), 'public/feed'), { json: '{}', hash: 'h', updatedAt: 2 }));
  await assertFails(getDocs(collection(anon(), 'items')));
  await assertFails(getDoc(doc(anon(), 'events/pub')));
  await assertFails(getDoc(doc(anon(), 'announcements/a')));
});
test('feed: admin who is inactive or unverified cannot publish', async () => {
  await assertFails(setDoc(doc(as(P.vp, false), 'public/feed'), { json: '{}', hash: 'h', updatedAt: 2 }));
});
test('cache: non-admins cannot poison; admin shape checks', async () => {
  const good = { json: '[]', at: new Date(), count: 0, updatedAt: 1 };
  for (const w of ['officer', 'lead', 'treasurer', 'secretary', 'teacher']) {
    if (!P[w]) continue;
    await assertFails(setDoc(doc(as(P[w]), 'cache', T), good));
    await assertFails(updateDoc(doc(as(P[w]), 'cache', T), { json: '[{"evil":1}]' }));
    await assertFails(deleteDoc(doc(as(P[w]), 'cache', T)));
  }
  await assertFails(setDoc(doc(as(P.vp), 'cache', 'other-term'), good));
  await assertFails(setDoc(doc(as(P.vp), 'cache', T), { ...good, at: new Date(Date.now() + 86400000) }));
  await assertFails(setDoc(doc(as(P.vp), 'cache', T), { ...good, extra: 1 }));
  await assertFails(setDoc(doc(as(P.vp), 'cache', T), { ...good, json: 'x'.repeat(700001) }));
  await assertFails(deleteDoc(doc(as(P.vp), 'cache', T)));
  await assertSucceeds(setDoc(doc(as(P.vp), 'cache', T), good));
  await assertFails(getDoc(doc(anon(), 'cache', T)));
});

// ---------- misc collections
test('settings/stats/templates/announcements/events: role gates', async () => {
  await assertFails(setDoc(doc(as(P.president), 'settings/current'), { termId: 'x' }));
  await assertFails(setDoc(doc(as(P.vp), 'settings/current'), { termId: 'x' }));
  await assertFails(setDoc(doc(as(P.officer), 'settings/digest'), { termId: T, text: 'x' }));
  await assertFails(setDoc(doc(as(P.officer), 'settings/evil'), { a: 1 }));
  await assertFails(getDoc(doc(as(P.treasurer), 'stats/s')));
  await assertFails(setDoc(doc(as(P.treasurer), 'stats/n'), { termId: T }));
  await assertFails(setDoc(doc(as(P.officer), 'templates/n'), { termId: T, name: 'x' }));
  await assertFails(setDoc(doc(as(P.teacher), 'templates/n'), { termId: T, name: 'x' }));
  const ann = { termId: T, title: 'h', body: 'b', audience: 'everyone', startDate: '2026-10-29', endDate: '2026-11-05', createdByUid: P.officer, archived: false, createdAt: 1 };
  await assertFails(setDoc(doc(as(P.officer), 'announcements/a'), ann));
  await assertFails(setDoc(doc(as(P.treasurer), 'announcements/a'), { ...ann, createdByUid: P.treasurer }));
  await assertFails(setDoc(doc(as(P.president), 'announcements/a'), { ...ann, createdByUid: P.president, extra: 1 }));
  await assertFails(setDoc(doc(as(P.president), 'announcements/a'), { ...ann, createdByUid: P.officer }));
  await assertFails(setDoc(doc(as(P.teacher), 'events/n'), event({ createdByUid: P.teacher })));
  await assertFails(setDoc(doc(as(P.officer), 'events/n'), event({ createdByUid: P.other })));
  await assertFails(updateDoc(doc(as(P.officer), 'events/pub'), { notes: 'x' }));
  await assertFails(updateDoc(doc(as(P.other), 'events/e1'), { notes: 'x' }));
  await assertFails(deleteDoc(doc(as(P.advisor), 'events/e1')));
});
test('settings: advisor cannot delete settings/current (would brick termOk for everyone)', async () => {
  await assertFails(deleteDoc(doc(as(P.advisor), 'settings/current')));
});
test('items: wrong term, teacher writes, non-lead officer writes', async () => {
  await assertFails(updateDoc(doc(as(P.teacher), 'items/child'), { notes: 'x', ...touch }));
  await assertFails(updateDoc(doc(as(P.other), 'items/child'), { notes: 'x', ...touch }));
  await assertFails(updateDoc(doc(as(P.lead), 'items/child'), { notes: 'x' }));
  await assertFails(updateDoc(doc(as(P.lead), 'items/child'), { notes: 'x', touchedAt: new Date(0) }));
  await assertFails(updateDoc(doc(as(P.officer), 'items/child'), { assigneeUids: [P.officer, P.other], ...touch }));
  await assertFails(deleteDoc(doc(as(P.advisor), 'items/child')));
});
