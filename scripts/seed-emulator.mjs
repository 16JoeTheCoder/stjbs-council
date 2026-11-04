// Seeds the local emulators with a demo council. Dev only; never touches the real project.
// Run (VS Code terminal, repo root): npm run demo   Every demo password is "council123".
// Seeded items carry no touchedAt, like production items written before the snapshot change.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { addDays, isoDay, weekId } from '../src/time.js';
import { STAGE_WORD, feedPayload, hash } from '../src/feed.js';
import { makeProposal } from '../src/event-model.js';

const P = 'demo-council', T = '2026-27', D = 'stjbs.sch.id', day = 86400e3, now = Date.now(), today = isoDay(now);
const iso = (n) => addDays(today, n);
const people = [
  ['ariel', 'Ariel Santoso', 'advisor', 'Advisor', null], ['nadia', 'Nadia Putri', 'president', 'Exec', 'ariel'],
  ['kevin', 'Kevin Wijaya', 'vp', 'Exec', 'nadia'], ['sarah', 'Sarah Lim', 'treasurer', 'Exec', 'nadia'], ['dimas', 'Dimas Pratama', 'secretary', 'Exec', 'nadia'],
  ['michael', 'Michael Tan', 'officer', 'Events', 'kevin'], ['alya', 'Alya Rahman', 'officer', 'Events', 'kevin'],
  ['bryan', 'Bryan Hartono', 'officer', 'Sports', 'kevin'], ['clara', 'Clara Gunawan', 'officer', 'Arts', 'kevin'],
  ['raka', 'Raka Siregar', 'officer', 'Welfare', 'dimas'], ['budi', 'Budi Halim', 'teacher', 'Teachers', null],
  // General members (role "member"), section is the year level.
  ['josef', 'Josef Yang', 'member', 'JC 2', null], ['adelyn', 'Adelyn Liu', 'member', 'Sec 4', null], ['aaron', 'Aaron Kusuma', 'member', 'JC 1', null],
  ['carlos', 'Carlos Wibowo', 'member', 'Sec 3', null], ['kim', 'Kimberly Tanoto', 'member', 'Sec 4', null], ['kayra', 'Kayra Hasan', 'member', 'JC 1', null],
  ['earlene', 'Earlene Sutanto', 'member', 'Sec 2', null], ['cherrish', 'Cherrish Halim', 'member', 'Sec 3', null], ['farah', 'Farah Nasution', 'member', 'Sec 1', null],
  ['gilang', 'Gilang Saputra', 'member', 'JC 2', null], ['hana', 'Hana Wijaya', 'member', 'Sec 2', null], ['ivan', 'Ivan Setiadi', 'member', 'JC 1', null],
  ['jessica', 'Jessica Lim', 'member', 'Sec 1', null], ['lukas', 'Lukas Hartanto', 'member', 'Sec 3', null], ['maya', 'Maya Santika', 'member', 'JC 2', null],
  ['nico', 'Nico Pranata', 'member', 'Sec 2', null], ['olivia', 'Olivia Gunadi', 'member', 'Sec 1', null],
];
// Six standing departments: id, name, JC officer (head), Sec officer (second), general members. Olivia is unassigned.
const depts = [
  ['events', 'Events', 'michael', 'alya', ['josef', 'adelyn', 'farah']],
  ['sports', 'Sports', 'bryan', 'aaron', ['carlos', 'ivan']],
  ['arts', 'Arts and culture', 'clara', 'kim', ['cherrish', 'maya']],
  ['welfare', 'Welfare', 'raka', 'earlene', ['hana', 'jessica']],
  ['media', 'Media', 'kayra', null, ['nico', 'lukas']],
  ['academic', 'Academic', 'gilang', null, []],
];
const placeOfSeed = (k) => { for (const [id, , jc, sec, list] of depts) { if (k === jc) return [id, 'jc_officer', 'nadia']; if (k === sec) return [id, 'sec_officer', jc]; if (list.includes(k)) return [id, 'member', jc]; } return null; };
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
  const db = ctx.firestore();
  const raw = (path, data) => setDoc(doc(db, path), data);                      // cross-term documents: exact keys only
  const put = (path, data) => raw(path, { termId: T, createdAt: now, ...data }); // term-scoped documents
  await put('settings/current', { termId: T, termName: T, startDate: '2026-08-03', startWeekId: '2026-W32' });
  for (const [k, name, role, section, boss] of people) {
    const place = placeOfSeed(k), sec = ['Exec', 'Teachers', 'Advisor', 'Events', 'Sports', 'Arts', 'Welfare'].includes(section) ? ['JC 2', 'JC 1', 'Sec 4', 'Sec 3'][k.length % 4] : section;
    await put(`members/${email(k)}`, { name, initials: name.split(' ').map((p) => p[0]).join(''), role, section: role === 'teacher' || role === 'advisor' ? '' : sec,
      reportsTo: place ? email(place[2]) : boss && email(boss), active: true, ...(place ? { departmentId: place[0], position: place[1] } : {}) });
  }
  for (const [i, [id, name, jc, sec, list]] of depts.entries())
    await put(`departments/${id}`, { name, order: i, jcLeadUid: email(jc), secLeadUid: sec && email(sec), memberUids: list.map(email), active: true, updatedAt: now });
  // A special committee: its own teams, independent of departments. One team has no leader.
  await put('committees/carnival', { name: 'Carnival committee', startDate: iso(-20), endDate: iso(40), status: 'active', chairUids: [email('nadia')], createdByUid: email('nadia'), updatedAt: now, teams: [
    { id: 'finance', name: 'Finance team', leadUids: [email('josef')], memberUids: [email('michael'), email('adelyn')] },
    { id: 'tenants', name: 'Tenant stall team', leadUids: [email('aaron')], memberUids: [email('carlos'), email('kim')] },
    { id: 'reach', name: 'Reach and registration', leadUids: [email('kayra'), email('earlene')], memberUids: [email('cherrish')] },
    { id: 'stage', name: 'Stage crew', leadUids: [], memberUids: [email('bryan'), email('clara'), email('maya'), email('josef')] },
  ] });
  await put('committees/fest25', { name: 'Arts fest 2025', startDate: '2025-09-01', endDate: '2025-09-20', status: 'closed', chairUids: [], createdByUid: email('nadia'), updatedAt: now, teams: [
    { id: 'program', name: 'Programme', leadUids: [email('clara')], memberUids: [email('kim')] }] });

  // Projects: one in each pipeline stage; the carnival is public with a blurb.
  const items = [];
  const base = { notes: '', link: '', assigneeUids: [], createdByUid: email('nadia'), status: 'todo', blocked: false, blockedReason: '', blockedOnUid: null,
    startDate: null, dueDate: null, assignedAt: null, completedAt: null, archived: false, isDeal: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, leadUid: null };
  const add = (id, data) => items.push({ id, termId: T, createdAt: now, updatedAt: now, ...base, ...data });
  add('carnival', { kind: 'project', title: 'STJBS Carnival', status: 'doing', parentId: null, ancestors: [], leadUids: [], dueDate: iso(40), startDate: iso(-30),
    public: true, publicBlurb: 'Our biggest event of the year: games, food and music on the school field for families.' });
  const teams = [['drinks', 'Drinks', 'michael'], ['food', 'Food', 'alya'], ['games', 'Games', 'bryan'], ['stage', 'Stage', 'clara'], ['sponsors', 'Sponsors', 'sarah']];
  for (const [id, title, lead] of teams)
    add(id, { kind: 'team', title, parentId: 'carnival', ancestors: ['carnival'], leadUid: email(lead), leadUids: [email(lead)], dueDate: ['drinks', 'food', 'games'].includes(id) ? iso(2) : iso(35) }); // three deadlines on one day
  const tasks = [
    ['drinks', 'Secure Pocari Sweat booth contract', ['michael', 'alya', 'raka'], 2, { isDeal: true, dealStage: 'Negotiating', pledgedIdr: 15000000, blocked: true, blockedReason: 'Waiting on Pocari reply', blockedOnUid: email('sarah') }],
    ['drinks', 'Order 400 cups', ['raka'], -2, {}], ['drinks', 'Price list for drinks stall', ['michael'], 6, { status: 'done', completedAt: now - day }],
    ['food', 'Confirm three food vendors', ['alya'], 9, {}], ['food', 'Hygiene briefing for vendors', ['dimas'], 20, {}],
    ['games', 'Book inflatable castle', ['bryan'], 1, {}], ['games', 'Write game rules cards', ['clara', 'bryan'], 12, { status: 'doing' }],
    ['stage', 'Sound system quote', ['clara'], -1, {}], ['stage', 'Run sheet for performances', ['kevin'], 14, {}],
    ['sponsors', 'Bank sponsorship pitch', ['sarah', 'nadia'], 5, { isDeal: true, dealStage: 'Contacted' }], ['sponsors', 'Thank-you letters', ['dimas'], 30, { status: 'done', completedAt: now - 3 * day }],
  ];
  tasks.forEach(([team, title, who, due, extra], i) => {
    const lead = teams.find((t) => t[0] === team)[2];
    add(`t${i}`, { kind: 'task', title, parentId: team, ancestors: ['carnival', team], leadUids: [email(lead)], assigneeUids: who.map(email), dueDate: iso(due), assignedAt: now, ...extra });
  });
  add('survey', { kind: 'project', title: 'Canteen survey', parentId: null, ancestors: [], leadUid: email('raka'), leadUids: [email('raka')], dueDate: iso(25), createdByUid: email('dimas') });
  add('s1', { kind: 'task', title: 'Draft survey questions', parentId: 'survey', ancestors: ['survey'], leadUids: [email('raka')], assigneeUids: [email('raka')], dueDate: iso(4) });
  add('s2', { kind: 'task', title: 'Ask the canteen manager for a meeting', parentId: 'survey', ancestors: ['survey'], leadUids: [email('raka')], assigneeUids: [email('raka'), email('clara')], dueDate: iso(8) });
  add('welcome', { kind: 'project', title: 'Welcome week', status: 'done', parentId: null, ancestors: [], leadUids: [], dueDate: iso(-50), public: true, publicBlurb: 'New students met their buddies and toured the school.' });
  add('w1', { kind: 'task', title: 'Buddy list', parentId: 'welcome', ancestors: ['welcome'], leadUids: [], assigneeUids: [email('alya')], dueDate: iso(-55), status: 'done', completedAt: now - 55 * day });
  add('w2', { kind: 'task', title: 'Campus tour route', parentId: 'welcome', ancestors: ['welcome'], leadUids: [], assigneeUids: [email('bryan')], dueDate: iso(-52), status: 'done', completedAt: now - 52 * day });
  for (const { id, ...data } of items) await raw(`items/${id}`, data);

  const w = (n) => weekId(isoDay(now + n * 7 * day));
  for (const [k, blocked, weeks] of [['michael', 'Waiting on Pocari reply', [0, -1]], ['alya', '', [0, -1]], ['raka', '', [-1]], ['kevin', '', [0, -1]], ['nadia', '', [0, -1]]])
    for (const n of weeks) await put(`checkins/${T}_${w(n)}_${email(k)}`, { weekId: w(n), uid: email(k), done: 'Price list done', doing: 'Follow up with partner', blocked: n === 0 ? blocked : '' });
  await put('activity/a1', { actorUid: email('michael'), type: 'completed', itemId: 't2', text: 'completed "Price list for drinks stall"', createdAt: now - day });
  await put('activity/a2', { actorUid: email('nadia'), type: 'created', itemId: 'carnival', text: 'added "STJBS Carnival"', createdAt: now - 5 * day });
  await put(`notifications/${email('raka')}/items/n1`, { toUid: email('raka'), fromUid: email('michael'), type: 'comment', itemId: 't0', text: 'commented on "Secure Pocari Sweat booth contract": can you call them Monday', read: false });

  // Announcements: two active (one public), one expired.
  const anns = [
    ['ann1', 'Carnival volunteer sign-ups are open', 'We need 40 volunteers across booths, safety and clean-up.\nSign up with your section officer by Friday.', 'everyone', -2, 15],
    ['ann2', 'Weekly meeting moves to Friday', 'This week only, 15:30 in Meeting Room 2. Bring your check-in answers.', 'members', 0, 6],
    ['ann3', 'Exam timetable posted', 'The mid-term exam timetable is on the school site.', 'everyone', -20, -5],
  ].map(([id, title, body, audience, s, e]) => ({ id, title, body, audience, startDate: iso(s), endDate: iso(e), createdByUid: email('nadia'), archived: false }));
  for (const { id, ...a } of anns) await put(`announcements/${id}`, a);

  // Events this week and next; the carnival night runs past 18:00, so it shows in the all-day row.
  const events = [
    ['e1', 'Council weekly meeting', 'meeting', 0, '15:30', '16:30', 'Meeting Room 2', false, null],
    ['e2', 'Booth walk-through', 'project', 1, '16:30', '17:30', 'School field', false, 'carnival'],
    ['e3', 'Media committee sync', 'committee', 2, '17:00', '18:00', 'Online', false, null],
    ['e4', 'Sponsor call with the bank', 'project', 3, '10:00', '10:30', 'Office', false, 'carnival'],
    ['e5', 'Open house tour', 'other', 8, '09:00', '12:00', 'Main hall', true, null],
    ['e6', 'Carnival night', 'project', 9, '18:00', '21:00', 'School field', true, 'carnival'],
    ['e7', 'Last week’s debrief', 'meeting', -3, '15:30', '16:15', 'Meeting Room 2', false, null],
    ['e8', 'Football training', 'other', 0, '15:00', '17:00', 'School field', false, null],
    ['e9', 'Stand-up', 'committee', 0, '13:00', '13:15', 'Office', false, null],
    ['e10', 'Booth build day', 'project', 1, '09:00', '13:00', 'School field', false, 'carnival'],
    ['e11', 'Ticket design review', 'committee', 1, '10:00', '11:00', 'Art room', false, null],
    ['e12', 'Sponsor follow-up calls', 'project', 1, '10:30', '11:30', 'Office', false, 'carnival'],
    ['e13', 'Volunteer briefing', 'meeting', 1, '10:45', '11:15', 'Hall', false, null],
    ['e14', 'Parents evening briefing', 'other', 2, '18:30', '20:30', 'Main hall', false, null],
    ['e15', 'Sports day', 'other', 3, '00:00', '23:59', 'School field', true, null, { allDay: true }],
    ['e16', 'Mid-term exams', 'other', 7, '00:00', '23:59', 'Classrooms', false, null, { allDay: true, endDate: iso(11) }],
  ].map(([id, title, type, d, start, end, location, isPublic, itemId, extra = {}]) => ({
    id, title, type, date: iso(d), start, end, location, notes: id === 'e1' ? 'Bring your check-in answers. We decide the carnival stall map.' : '', public: isPublic, ...(itemId ? { itemId } : {}),
    createdByUid: email('kevin'), archived: false, updatedAt: now, allDay: false, ...extra,
    participantUids: { e1: ['nadia', 'kevin', 'sarah', 'dimas', 'michael', 'alya', 'raka', 'bryan', 'clara'], e8: ['bryan', 'aaron', 'carlos', 'ivan'], e13: ['michael', 'alya', 'josef'] }[id]?.map(email) || [] }));
  for (const { id, ...e } of events) await put(`events/${id}`, e);
  // A pending event request from a member, waiting for an admin.
  const proposal = makeProposal({ settings: null, template: null, members: [], groups: [], edits: { title: 'Carnival poster workshop', type: 'meeting', date: iso(5), start: '14:00', end: '15:30', location: 'Art room', notes: 'Two hours to finish the poster set.', public: false, itemId: 'carnival', participantSelection: { groupIds: [], sections: [], includeUids: [], excludeUids: [], teamIds: ['carnival:reach'] } }, frozenParticipants: [email('kayra'), email('earlene'), email('cherrish')] });
  await put('eventRequests/rq1', { createdByUid: email('michael'), state: 'awaiting', revision: 1, proposal, eventId: null, replacesEventId: null, baseEventRevision: null, reviewedByUid: null, reviewNote: '', updatedAt: now });
  await raw('eventRequests/rq1/proposals/1', proposal);
  for (const [k, status] of [['michael', 'going'], ['alya', 'going'], ['raka', 'not'], ['kevin', 'going']])
    await put(`rsvps/e1_${email(k)}`, { eventId: 'e1', uid: email(k), status, archived: false });

  const ideas = [['Movie night in the hall after exams', 'bryan', ['bryan', 'alya', 'raka', 'clara']], ['Healthier options at the canteen', 'raka', ['raka', 'nadia', 'kevin']],
    ['Open mic lunch on Fridays', 'clara', ['clara', 'michael']], ['More bike racks by the gate', 'michael', ['michael']], ['Quiet study room during exams', 'alya', ['alya', 'sarah', 'dimas', 'raka', 'bryan']]];
  for (const [i, [text, by, voters]] of ideas.entries())
    await put(`ideas/i${i + 1}`, { text, authorUid: email(by), voters: voters.map(email), archived: false, createdAt: now - i * 3600e3 });

  const templates = [['event-proposal', 'Event proposal', 'Doc', 'https://docs.google.com/document/d/1EventProposalTemplate/edit'],
    ['budget', 'Budget sheet', 'Sheet', 'https://docs.google.com/spreadsheets/d/1BudgetSheetTemplate/edit'],
    ['sponsor-letter', 'Sponsor letter', 'Doc', 'https://docs.google.com/document/d/1SponsorLetterTemplate/edit'],
    ['minutes', 'Meeting minutes', 'Doc', 'https://docs.google.com/document/d/1MeetingMinutesTemplate/edit'],
    ['pitch-deck', 'Pitch deck', 'Slides', 'https://docs.google.com/presentation/d/1PitchDeckTemplate/edit'],
    ['brand-kit', 'Logo and photo kit', 'Folder', 'https://drive.google.com/drive/folders/1BrandKitFolder']];
  for (const [id, name, kind, url] of templates) await raw(`docTemplates/${id}`, { name, kind, url, version: 1, archived: false, createdAt: now });

  const subs = [['sub1', 'new-template', 'Volunteer rota', 'https://docs.google.com/spreadsheets/d/1VolunteerRota/edit', 'michael', 'pending', {}],
    ['sub2', 'template-edit', 'Budget sheet with a contingency line', 'https://docs.google.com/spreadsheets/d/1BudgetSheetV2/edit', 'alya', 'pending', { targetId: 'budget' }],
    ['sub3', 'new-template', 'Permission slip', 'https://docs.google.com/document/d/1PermissionSlip/edit', 'raka', 'pending', {}],
    ['sub4', 'archive', 'Carnival 2025 final report', 'https://drive.google.com/file/d/1Carnival2025Report/view', 'sarah', 'filed', { projectId: 'carnival' }]];
  for (const [id, type, name, url, by, status, extra] of subs)
    await raw(`submissions/${id}`, { type, name, url, note: '', byUid: email(by), status, archived: false, createdAt: now, ...extra });

  // The item snapshot and public feed an admin session would have written, with exactly the keys the rules allow.
  await raw(`cache/${T}`, { json: JSON.stringify(items.map((x) => ({ ...x, touchedAt: null }))), at: Timestamp.fromMillis(0), count: items.length, updatedAt: now });
  const tasksUnder = (id) => items.filter((x) => x.kind === 'task' && (x.ancestors.includes(id) || x.id === id));
  const projects = items.filter((x) => !x.parentId && x.public).map((r) => {
    const list = tasksUnder(r.id), done = list.filter((t) => t.status === 'done').length;
    return { title: r.title, stage: STAGE_WORD[r.status], pct: list.length ? Math.round((100 * done) / list.length) : 0, done, total: list.length, blurb: r.publicBlurb, updatedAt: now };
  });
  const json = JSON.stringify(feedPayload({ projects, events, announcements: anns, day: today }));
  await raw('public/feed', { json, hash: hash(json), updatedAt: now - 3 * 60e3 });
});
await env.cleanup();
console.log('ok demo council seeded; sign in as raka@stjbs.sch.id / council123 (or nadia, kevin, ariel, michael ...)');
