// Seeds the local emulators with a demo council. Dev only; never touches the real project.
// Run (VS Code terminal, repo root): npm run demo   Every demo password is "council123".
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { isoDay, weekId } from '../src/time.js';

const P = 'demo-council', T = '2026-27', D = 'stjbs.sch.id', day = 86400e3, now = Date.now();
const iso = (n) => new Date(now + 7 * 3600e3 + n * day).toISOString().slice(0, 10);
const people = [
  ['ariel', 'Ariel Santoso', 'advisor', 'Advisor', null], ['nadia', 'Nadia Putri', 'president', 'Exec', 'ariel'],
  ['kevin', 'Kevin Wijaya', 'vp', 'Exec', 'nadia'], ['sarah', 'Sarah Lim', 'treasurer', 'Exec', 'nadia'], ['dimas', 'Dimas Pratama', 'secretary', 'Exec', 'nadia'],
  ['michael', 'Michael Tan', 'officer', 'Events, sec 4 to JC', 'kevin'], ['alya', 'Alya Rahman', 'officer', 'Events, sec 1 to 3', 'kevin'],
  ['bryan', 'Bryan Hartono', 'officer', 'Sports, sec 4 to JC', 'kevin'], ['clara', 'Clara Gunawan', 'officer', 'Arts, sec 1 to 3', 'kevin'],
  ['raka', 'Raka Siregar', 'officer', 'Welfare, sec 4 to JC', 'dimas'], ['budi', 'Budi Halim', 'teacher', 'Teacher', null],
];
const email = (k) => `${k}@${D}`;

for (const [k, name] of people) {
  const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${P}/accounts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ email: email(k), password: 'council123', displayName: name, emailVerified: true }),
  });
  if (!r.ok && !(await r.text()).includes('EXISTS')) throw new Error(`auth seed failed for ${k}`);
}

const env = await initializeTestEnvironment({ projectId: P, firestore: { host: '127.0.0.1', port: 8080 } });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore(), put = (path, data) => setDoc(doc(db, path), { termId: T, createdAt: now, ...data });
  await put('settings/current', { termId: T, termName: T, startDate: '2026-08-03', startWeekId: '2026-W32' });
  for (const [k, name, role, section, boss] of people)
    await put(`members/${email(k)}`, { name, initials: name.split(' ').map((p) => p[0]).join(''), role, section, reportsTo: boss && email(boss), active: true });
  const base = { notes: '', link: '', assigneeUids: [], createdByUid: email('nadia'), status: 'todo', blocked: false, blockedReason: '', blockedOnUid: null,
    startDate: null, dueDate: null, assignedAt: null, completedAt: null, archived: false, isDeal: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, leadUid: null };
  await put('items/carnival', { ...base, kind: 'project', title: 'STJBS Carnival', parentId: null, ancestors: [], leadUids: [], dueDate: iso(40), startDate: iso(-30) });
  const teams = [['drinks', 'Drinks', 'michael'], ['food', 'Food', 'alya'], ['games', 'Games', 'bryan'], ['stage', 'Stage', 'clara'], ['sponsors', 'Sponsors', 'sarah']];
  for (const [id, title, lead] of teams)
    await put(`items/${id}`, { ...base, kind: 'team', title, parentId: 'carnival', ancestors: ['carnival'], leadUid: email(lead), leadUids: [email(lead)], dueDate: iso(35) });
  const tasks = [
    ['drinks', 'Secure Pocari Sweat booth contract', ['michael', 'alya', 'raka'], 2, { isDeal: true, dealStage: 'Negotiating', pledgedIdr: 15000000, blocked: true, blockedReason: 'Waiting on Pocari reply', blockedOnUid: email('sarah') }],
    ['drinks', 'Order 400 cups', ['raka'], -2, {}], ['drinks', 'Price list for drinks stall', ['michael'], 6, { status: 'done', completedAt: now - day }],
    ['food', 'Confirm three food vendors', ['alya'], 9, {}], ['food', 'Hygiene briefing for vendors', ['dimas'], 20, {}],
    ['games', 'Book inflatable castle', ['bryan'], 1, {}], ['games', 'Write game rules cards', ['clara', 'bryan'], 12, { status: 'doing' }],
    ['stage', 'Sound system quote', ['clara'], -1, {}], ['stage', 'Run sheet for performances', ['kevin'], 14, {}],
    ['sponsors', 'Bank sponsorship pitch', ['sarah', 'nadia'], 5, { isDeal: true, dealStage: 'Contacted' }], ['sponsors', 'Thank-you letters', ['dimas'], 30, { status: 'done', completedAt: now - 3 * day }],
  ];
  let i = 0;
  for (const [team, title, who, due, extra] of tasks) {
    const lead = teams.find((t) => t[0] === team)[2];
    await put(`items/t${i++}`, { ...base, kind: 'task', title, parentId: team, ancestors: ['carnival', team], leadUids: [email(lead)], assigneeUids: who.map(email), dueDate: iso(due), assignedAt: now, ...extra });
  }
  const w = (n) => weekId(isoDay(now + n * 7 * day));
  for (const [k, blocked, weeks] of [['michael', 'Waiting on Pocari reply', [0, -1]], ['alya', '', [0, -1]], ['raka', '', [-1]], ['kevin', '', [0, -1]], ['nadia', '', [0, -1]]])
    for (const n of weeks) await put(`checkins/${T}_${w(n)}_${email(k)}`, { weekId: w(n), uid: email(k), done: 'Price list done', doing: 'Follow up with partner', blocked: n === 0 ? blocked : '' });
  await put('activity/a1', { actorUid: email('michael'), type: 'completed', itemId: 't2', text: 'completed "Price list for drinks stall"', createdAt: now - day });
  await put('activity/a2', { actorUid: email('nadia'), type: 'created', itemId: 'carnival', text: 'added "STJBS Carnival"', createdAt: now - 5 * day });
  await put(`notifications/${email('raka')}/items/n1`, { toUid: email('raka'), fromUid: email('michael'), type: 'comment', itemId: 't0', text: 'commented on "Secure Pocari Sweat booth contract": can you call them Monday', read: false });
});
await env.cleanup();
console.log('ok demo council seeded; sign in as raka@stjbs.sch.id / council123 (or nadia, ariel, michael ...)');
