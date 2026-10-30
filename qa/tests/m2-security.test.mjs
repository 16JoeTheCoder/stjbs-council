// M2 security probes for public/feed and cache/{termId}. A test that asserts the SECURE expectation and fails is a demonstrated hole.
// Run (Ubuntu/WSL or VS Code terminal, repo root):
//   npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/m2-security.test.mjs"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, Timestamp } from 'firebase/firestore';
import { feedPayload } from '../../src/feed.js';

const T = '2026-27', OLD = '2025-26';
let env;
const P = { advisor: 'ariel@stjbs.sch.id', president: 'pres@stjbs.sch.id', vp: 'vp@stjbs.sch.id', treasurer: 'tres@stjbs.sch.id',
  secretary: 'sec@stjbs.sch.id', officer: 'off@stjbs.sch.id', teacher: 'teach@stjbs.sch.id', lead: 'lead@stjbs.sch.id' };
const as = (email, verified = true) => env.authenticatedContext(email.split('@')[0], { email, email_verified: verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const feed = (o = {}) => ({ json: '{"v":1}', hash: 'abc', updatedAt: Date.now(), ...o });
const cache = (o = {}) => ({ json: '[]', at: Timestamp.fromMillis(Date.now() - 1000), count: 0, updatedAt: Date.now(), ...o });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-council', firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, 'settings/current'), { termId: T });
    for (const [k, role] of Object.entries(P)) await setDoc(doc(d, 'members', P[k]), { role: k === 'lead' ? 'officer' : k, active: true, name: k, termId: T });
    await setDoc(doc(d, 'public/feed'), feed());
    await setDoc(doc(d, `cache/${T}`), cache());
    await setDoc(doc(d, 'items/a'), { termId: T, archived: false, title: 'x', touchedAt: Timestamp.now() });
  });
});

// ---- Who can read and write the feed and the cache
test('anonymous visitor can get the feed (intended) but cannot list public/', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'public/feed')));
  await assertFails(getDocs(collection(anon(), 'public')));
});
test('anonymous visitor cannot read the cache, items, members or anything else', async () => {
  for (const p of [`cache/${T}`, 'items/a', `members/${P.officer}`, 'settings/current', 'public/other'])
    await assertFails(getDoc(doc(anon(), p)));
});
test('no non-admin role (or unverified admin) can write the feed or the cache', async () => {
  for (const r of ['treasurer', 'secretary', 'officer', 'teacher', 'lead']) {
    await assertFails(setDoc(doc(as(P[r]), 'public/feed'), feed()));
    await assertFails(setDoc(doc(as(P[r]), `cache/${T}`), cache()));
  }
  await assertFails(setDoc(doc(as(P.president, false), 'public/feed'), feed()));
  await assertFails(setDoc(doc(anon(), 'public/feed'), feed()));
  await assertFails(setDoc(doc(anon(), `cache/${T}`), cache()));
});
test('nobody can delete the feed or the cache', async () => {
  for (const r of ['advisor', 'president', 'vp']) {
    await assertFails(deleteDoc(doc(as(P[r]), 'public/feed')));
    await assertFails(deleteDoc(doc(as(P[r]), `cache/${T}`)));
  }
});
test('admin cannot add extra keys (an updatedByUid would leak an email) or write another public document', async () => {
  await assertFails(setDoc(doc(as(P.vp), 'public/feed'), feed({ updatedByUid: P.vp })));
  await assertFails(setDoc(doc(as(P.vp), 'public/other'), feed()));
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ extra: 1 })));
});
test('admin cannot write a cache for a past term or a future "at"', async () => {
  await assertFails(setDoc(doc(as(P.vp), `cache/${OLD}`), cache()));
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ at: Timestamp.fromMillis(Date.now() + 86400e3) })));
});
test('admin feed and cache size caps hold', async () => {
  await assertFails(setDoc(doc(as(P.vp), 'public/feed'), feed({ json: 'x'.repeat(200001) })));
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ json: 'x'.repeat(700001) })));
  await assertSucceeds(setDoc(doc(as(P.vp), 'public/feed'), feed({ json: 'x'.repeat(200000) })));
});

// ---- Content limits: the rules cannot tell a valid payload from garbage or from PII. These assert the secure expectation.
test('HOLE (defence in depth): feed rejects a json string that is not the payload shape', async () => {
  await assertFails(setDoc(doc(as(P.vp), 'public/feed'), feed({ json: 'not json at all' })));
});
test('HOLE (defence in depth): feed rejects an email address inside json', async () => {
  const json = JSON.stringify({ v: 1, projects: [], events: [], announcements: [{ title: 'x', body: 'ask raka@stjbs.sch.id', startDate: '2026-01-01', endDate: '2027-01-01' }] });
  await assertFails(setDoc(doc(as(P.vp), 'public/feed'), feed({ json })));
});
test('HOLE: cache json that is not an array of items is rejected (clients JSON.parse it with no try/catch and no shape check)', async () => {
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ json: 'not json' })));
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ json: '{"a":1}' })));
});
test('HOLE: cache count/at must match the json (a forged "at" = now hides every later-but-pre-"at" change)', async () => {
  // json is empty yet count says 5 and at is "now": members see no items and the delta query starts at now - 60 s.
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ json: '[]', count: 5 })));
});
test('HOLE: cache updatedAt in the future freezes refresh (clients refresh when now - updatedAt > 24 h)', async () => {
  await assertFails(setDoc(doc(as(P.vp), `cache/${T}`), cache({ updatedAt: Date.now() + 365 * 86400e3 })));
});

// ---- The payload builder itself
test('feedPayload emits only whitelisted keys, drops members-only and archived rows, ignores extra fields', () => {
  const day = '2026-10-30';
  const out = feedPayload({ day,
    projects: [{ title: 'P', stage: 'Planning', pct: 1, done: 1, total: 2, blurb: 'b', updatedAt: 1, leadUid: P.officer, notes: 'n', assigneeUids: [P.officer] }],
    events: [{ title: 'E', type: 'meeting', date: day, start: '10:00', end: '11:00', location: 'L', notes: 'secret', createdByUid: P.officer, itemId: 'i', public: true, archived: false },
      { title: 'Private', type: 'meeting', date: day, start: '10:00', end: '11:00', location: '', public: false, archived: false }],
    announcements: [{ title: 'A', body: 'B', startDate: day, endDate: day, audience: 'everyone', archived: false, createdByUid: P.president, termId: T },
      { title: 'Mem', body: 'B', startDate: day, endDate: day, audience: 'members', archived: false }] });
  const s = JSON.stringify(out);
  for (const bad of [P.officer, P.president, 'secret', 'Private', 'Mem', 'leadUid', 'createdByUid', 'assigneeUids', 'itemId', 'termId', 'notes']) if (s.includes(bad)) throw new Error(`payload leaks ${bad}: ${s}`);
  const keys = (o) => Object.keys(o).sort().join();
  if (keys(out.projects[0]) !== 'blurb,done,pct,stage,title,total,updatedAt') throw new Error('project keys');
  if (keys(out.events[0]) !== 'date,end,location,start,title,type') throw new Error('event keys');
  if (keys(out.announcements[0]) !== 'body,endDate,startDate,title') throw new Error('announcement keys');
});
test('MINOR: feedPayload publishes an announcement before its start date (readable by anyone via REST)', () => {
  const out = feedPayload({ day: '2026-10-30', projects: [], events: [], announcements: [{ title: 'Embargoed', body: 'x', startDate: '2026-12-01', endDate: '2026-12-05', audience: 'everyone', archived: false }] });
  if (out.announcements.some((a) => a.title === 'Embargoed')) throw new Error('future announcement is already in the public JSON');
});
