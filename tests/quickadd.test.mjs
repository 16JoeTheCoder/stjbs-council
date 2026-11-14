// Pure-logic tests for src/quickadd.js. Run: node tests/quickadd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, rankPeople, parseDate, dueLabel, preview } from '../src/quickadd.js';

const NOW = new Date('2026-11-13T13:00:00Z'); // Fri 13 Nov 2026 20:00 WIB
const mem = (id, name, o = {}) => ({ id, name, aliases: [], active: true, role: 'member', departmentId: 'd1', ...o });
const me = mem('me@x', 'Josef Yang');
const LONG = ['Zacharias Wirawan-Kusumaningrat', 'Bartholomeus Santoso-Hadiningrat', 'Yohanes Christianto-Prawirodirdjo', 'Xaverius Maharani-Suryaningsih', 'Wilhelmina Tjahjadi-Notoprajitno'];
const members = [
  me, mem('a1@x', 'Aaron'), mem('a2@x', 'Aaron Tan'), mem('b@x', 'Brittany Yap', { aliases: ['Brit'] }),
  mem('m@x', 'Michael Wijaya', { aliases: ['Mike'] }),
  ...Array.from({ length: 35 }, (_, i) => mem(`g${i}@x`, `${LONG[i % LONG.length].split(' ')[0]}${i} ${LONG[i % LONG.length].split(' ')[1]}`)),
];
const events = [{ id: 'eoy', name: 'End of Year Party' }, { id: 'c', name: 'Carnival' }];
const ctx = { now: NOW, me, members, events };
const P = (s, extra = {}) => parse(s, { ...ctx, ...extra });
const due = (s) => { const d = P(s).due; return d ? d.date + (d.time ? ' ' + d.time : '') : undefined; };

test('spec 1.6 table', () => {
  let r = P('Buy confetti @Brit fri #eoy');
  assert.equal(r.title, 'Buy confetti'); assert.equal(r.assignee.id, 'b@x'); assert.equal(r.due.date, '2026-11-13'); assert.equal(r.event.id, 'eoy');
  r = P('poster next fri @mike');
  assert.equal(r.title, 'poster'); assert.equal(r.assignee.id, 'm@x'); assert.equal(r.due.date, '2026-11-20'); assert.equal(r.event, undefined);
  r = P('call vendor tmr 3pm');
  assert.equal(r.title, 'call vendor'); assert.equal(r.assignee, undefined); assert.deepEqual([r.due.date, r.due.time], ['2026-11-14', '15:00']);
  r = P('sunday school snacks');
  assert.equal(r.title, 'sunday school snacks'); assert.equal(r.assignee, undefined); assert.equal(r.due, undefined);
  r = P('beli balon besok @aaron');
  assert.equal(r.title, 'beli balon'); assert.equal(r.assignee, undefined); assert.equal(r.due.date, '2026-11-14');
  assert.deepEqual(r.ambiguous.options.map((m) => m.id).sort(), ['a1@x', 'a2@x']);
  r = P('print flyers 2/12');
  assert.equal(r.title, 'print flyers'); assert.equal(r.due.date, '2026-12-02');
  r = P('rehearse 7pm');
  assert.equal(r.title, 'rehearse'); assert.deepEqual([r.due.date, r.due.time], ['2026-11-14', '19:00']);
  r = P('"due friday" banner text');
  assert.equal(r.title, '"due friday" banner text'); assert.equal(r.due, undefined);
  r = P('report in 2w p1');
  assert.equal(r.title, 'report'); assert.equal(r.due.date, '2026-11-27'); assert.equal(r.priority, 1);
  r = P('fix stage jam 3 sore');
  assert.equal(r.title, 'fix stage'); assert.deepEqual([r.due.date, r.due.time], ['2026-11-14', '15:00']);
});

test('relative words, English and Indonesian', () => {
  assert.equal(due('x today'), '2026-11-13');
  assert.equal(due('x hari ini'), '2026-11-13');
  assert.equal(due('x tmr'), '2026-11-14');
  assert.equal(due('x tomorrow'), '2026-11-14');
  assert.equal(due('x besok'), '2026-11-14');
  assert.equal(due('x lusa'), '2026-11-15');
  assert.equal(due('x tonight'), '2026-11-13 19:00');
});

test('Indonesian weekdays', () => {
  assert.equal(due('x senin'), '2026-11-16');
  assert.equal(due('x selasa'), '2026-11-17');
  assert.equal(due('x rabu'), '2026-11-18');
  assert.equal(due('x kamis'), '2026-11-19');
  assert.equal(due('x jumat'), '2026-11-13');
  assert.equal(due('x sabtu'), '2026-11-14');
  assert.equal(due('x minggu'), '2026-11-15');
});

test('weekdays: bare is next occurrence, today included; next X is the following week', () => {
  assert.equal(due('x fri'), '2026-11-13');
  assert.equal(due('x monday'), '2026-11-16');
  assert.equal(due('x next fri'), '2026-11-20');
  assert.equal(due('x next mon'), '2026-11-16');
  assert.equal(due('x next sun'), '2026-11-22');
});

test('week phrases', () => {
  assert.equal(due('x this week'), '2026-11-13');
  assert.equal(due('x next week'), '2026-11-16');
  assert.equal(due('x minggu depan'), '2026-11-16');
  assert.equal(due('x eow'), '2026-11-13');
  assert.equal(due('x end of week'), '2026-11-13');
  assert.equal(due('x weekend'), '2026-11-14');
  assert.equal(due('x senin depan'), '2026-11-16');
});

test('in N', () => {
  assert.equal(due('x in 3 days'), '2026-11-16');
  assert.equal(due('x in 3d'), '2026-11-16');
  assert.equal(due('x in 2 weeks'), '2026-11-27');
  assert.equal(due('x in 2w'), '2026-11-27');
  assert.equal(due('x dalam 2 hari'), '2026-11-15');
});

test('absolute dates', () => {
  assert.equal(due('x 15 nov'), '2026-11-15');
  assert.equal(due('x nov 15'), '2026-11-15');
  assert.equal(due('x 15/11'), '2026-11-15');
  assert.equal(due('x 15/11/2026'), '2026-11-15');
  assert.equal(due('x 15-11'), '2026-11-15');
  assert.equal(due('x 15th'), '2026-11-15');
  assert.equal(due('x 20 desember'), '2026-12-20');
  assert.equal(due('x 1 jan 2027'), '2027-01-01');
});

test('day-first numerics, never month-first', () => {
  assert.equal(due('x 3/4'), '2027-04-03'); // 3 April, already past this year so next year
});

test('past date without a year rolls to next year, without a warning', () => {
  const r = P('x 1 nov');
  assert.equal(r.due.date, '2027-11-01'); assert.deepEqual(r.warnings, []);
  assert.equal(due('x 12/11'), '2027-11-12');
  assert.equal(due('x 13 nov'), '2026-11-13'); // today is not past
});

test('times', () => {
  assert.equal(due('x 3pm'), '2026-11-14 15:00');
  assert.equal(due('x 3:30pm'), '2026-11-14 15:30');
  assert.equal(due('x 15:00'), '2026-11-14 15:00');
  assert.equal(due('x at 3'), '2026-11-14 15:00');
  assert.equal(due('x noon'), '2026-11-14 12:00');
  assert.equal(due('x midnight'), '2026-11-13 23:59'); // still ahead of 20:00 today
  assert.equal(due('x tomorrow morning'), '2026-11-14 07:00');
  assert.equal(due('x fri after school'), '2026-11-13 15:00');
  assert.equal(due('x tmr lunch'), '2026-11-14 12:00');
  assert.equal(due('x 9pm'), '2026-11-13 21:00'); // later today
  assert.equal(due('x 9pm').slice(0, 10), '2026-11-13');
});

test('Indonesian times: jam N, pagi, siang, sore, malam', () => {
  assert.equal(due('x besok jam 3'), '2026-11-14 15:00');
  assert.equal(due('x besok jam 9 pagi'), '2026-11-14 09:00');
  assert.equal(due('x besok jam 11 siang'), '2026-11-14 11:00');
  assert.equal(due('x besok jam 3 sore'), '2026-11-14 15:00');
  assert.equal(due('x besok jam 7 malam'), '2026-11-14 19:00');
  assert.equal(due('x besok pagi'), '2026-11-14 07:00');
  assert.equal(due('x besok siang'), '2026-11-14 12:00');
  assert.equal(due('x besok sore'), '2026-11-14 15:00');
  assert.equal(due('x besok malam'), '2026-11-14 19:00');
});

test('typos', () => {
  assert.equal(due('x tommorow'), '2026-11-14');
  assert.equal(due('x wensday'), '2026-11-18');
  assert.equal(P('x tommorow').title, 'x');
});

test('yesterday is accepted and flagged as past', () => {
  const r = P('x yesterday');
  assert.equal(r.due.date, '2026-11-12'); assert.equal(r.warnings.length, 1); assert.match(r.warnings[0], /past/i);
});

test('noun guards keep the title', () => {
  for (const s of ['sunday school snacks', 'call marching band', 'buy lunch for team', 'friday prayers schedule', 'the march of progress']) {
    const r = P(s); assert.equal(r.due, undefined, s); assert.equal(r.title, s);
  }
});

test('leading preposition leaves with the date', () => {
  const r = P('submit report by fri');
  assert.equal(r.title, 'submit report'); assert.equal(r.due.date, '2026-11-13');
});

test('last date wins, earlier ones stay in the title', () => {
  const r = P('move fri meeting to mon');
  assert.equal(r.due.date, '2026-11-16'); assert.equal(r.title, 'move fri meeting to');
});

test('quotes are never parsed', () => {
  const r = P('poster "meeting on friday" @mike');
  assert.equal(r.due, undefined); assert.equal(r.title, 'poster "meeting on friday"'); assert.equal(r.assignee.id, 'm@x');
  assert.equal(P('"call @aaron" tomorrow').ambiguous, undefined);
});

test('backslash escapes a word', () => {
  const r = P('\\today is a word');
  assert.equal(r.due, undefined); assert.equal(r.title, 'today is a word');
  const r2 = P('\\today besok');
  assert.equal(r2.due.date, '2026-11-14'); assert.equal(r2.title, 'today');
});

test('rejected tokens stay in the title', () => {
  const r = P('poster fri', { rejected: new Set(['date:fri']) });
  assert.equal(r.due, undefined); assert.equal(r.title, 'poster fri');
  const r2 = P('x @mike', { rejected: new Set(['assignee:mike']) });
  assert.equal(r2.assignee, undefined); assert.equal(r2.title, 'x @mike');
  const r3 = P('x p1', { rejected: new Set(['priority:p1']) });
  assert.equal(r3.priority, undefined); assert.equal(r3.title, 'x p1');
});

test('@me and no assignee field when nothing is typed', () => {
  const r = P('x @me');
  assert.equal(r.assignee.id, 'me@x'); assert.equal(r.title, 'x');
  assert.equal('assignee' in P('plain title'), false);
});

test('assignee matching: alias with last name, last-name prefix, fuzzy', () => {
  assert.equal(P('x @mike w').assignee.id, 'm@x');
  assert.equal(P('x @mike w').title, 'x');
  assert.equal(P('x @yap').assignee.id, 'b@x');
  assert.equal(P('x @brittny').assignee.id, 'b@x');
  assert.equal(P('x @brit').assignee.id, 'b@x');
  assert.equal(P('x @BRITTANY').assignee.id, 'b@x');
});

test('fuzzy needs 4 or more characters', () => {
  assert.equal(P('x @brx').assignee, undefined);
  assert.equal(P('x @brx').title, 'x @brx');
});

test('unknown assignee stays in the title', () => {
  const r = P('x @nobody');
  assert.equal(r.assignee, undefined); assert.equal(r.title, 'x @nobody');
});

test('@aaron tan picks the narrower match', () => {
  assert.equal(P('x @aaron tan').assignee.id, 'a2@x');
  assert.equal(P('x @aaron tan').ambiguous, undefined);
});

test('events', () => {
  let r = P('banner #"end of year"');
  assert.equal(r.event.id, 'eoy'); assert.equal(r.title, 'banner');
  r = P('banner #carnival'); assert.equal(r.event.id, 'c');
  r = P('banner #car'); assert.equal(r.event.id, 'c');
  r = P('banner #zzz'); assert.equal(r.event, undefined); assert.equal(r.title, 'banner #zzz');
});

test('priority', () => {
  assert.equal(P('x p1').priority, 1); assert.equal(P('x p1').title, 'x');
  assert.equal(P('x !2').priority, 2); assert.equal(P('x !2').title, 'x');
  assert.equal(P('x p4').priority, 4);
  assert.equal(P('x p1 p3').priority, 3);
  assert.equal(P('x p5').priority, undefined);
  assert.equal(P('x ap1').priority, undefined);
  assert.equal(P('x').priority, undefined);
});

test('role limits: warn and block, never drop the assignee', () => {
  const off = mem('off@x', 'Olivia Officer', { role: 'officer', departmentId: 'd1' });
  const roster = [off, mem('same@x', 'Sam Same', { departmentId: 'd1' }), mem('other@x', 'Oscar Other', { departmentId: 'd2' })];
  const c = { now: NOW, me: off, members: roster, events, role: 'officer' };
  const bad = parse('x @oscar', c);
  assert.equal(bad.assignee.id, 'other@x'); assert.equal(bad.blocked, true); assert.ok(bad.warnings.length > 0);
  const good = parse('x @sam', c);
  assert.equal(good.assignee.id, 'same@x'); assert.ok(!good.blocked); assert.deepEqual(good.warnings, []);
  const mine = { ...c, me: { ...off, departmentId: 'd1' }, role: 'member' };
  const m = parse('x @sam', { ...mine, me: mem('mm@x', 'Mem Ber'), members: [...roster, mem('mm@x', 'Mem Ber')] });
  assert.equal(m.blocked, true);
});

test('rankPeople: tiers, me first, officer subteam first', () => {
  assert.deepEqual(rankPeople('aaron', ctx).map((m) => m.id), ['a1@x', 'a2@x']);
  assert.equal(rankPeople('mike', ctx)[0].id, 'm@x');
  assert.equal(rankPeople('yap', ctx)[0].id, 'b@x');
  assert.equal(rankPeople('me', ctx)[0].id, 'me@x');
  assert.equal(rankPeople('', ctx).length, members.length);
  assert.equal(rankPeople('qqqqqq', ctx).length, 0);
  const off = mem('off@x', 'Olivia Officer', { role: 'officer', departmentId: 'd2' });
  const ms = [off, mem('x1@x', 'Pat One', { departmentId: 'd1' }), mem('x2@x', 'Pat Two', { departmentId: 'd2' })];
  assert.deepEqual(rankPeople('pat', { now: NOW, me: off, members: ms }).map((m) => m.id), ['x2@x', 'x1@x']);
});

test('rankPeople skips inactive members and teachers', () => {
  const ms = [me, mem('i@x', 'Inactive Ivy', { active: false }), mem('t@x', 'Teacher Ted', { role: 'teacher' })];
  const c = { now: NOW, me, members: ms };
  assert.equal(rankPeople('ivy', c).length, 0); assert.equal(rankPeople('ted', c).length, 0);
});

test('parseDate', () => {
  assert.deepEqual(parseDate('fri', NOW).date, '2026-11-13');
  const d = parseDate('besok 3pm', NOW);
  assert.deepEqual([d.date, d.time], ['2026-11-14', '15:00']);
  assert.equal(parseDate('hello', NOW), null);
});

test('dueLabel', () => {
  assert.equal(dueLabel({ date: '2026-11-13' }, NOW), 'Today');
  assert.equal(dueLabel({ date: '2026-11-14', time: '15:00' }, NOW), 'Tomorrow 15:00');
  assert.equal(dueLabel({ date: '2026-11-20' }, NOW), 'Fri 20 Nov');
  assert.equal(dueLabel({ date: '2027-01-04' }, NOW), 'Mon 4 Jan 2027');
  assert.equal(dueLabel(null, NOW), '');
});

test('preview', () => {
  const r = P('Buy confetti @Brit 20 nov #eoy p1');
  assert.equal(preview(r, me, NOW), 'Brittany · Fri 20 Nov · End of Year Party · P1');
  assert.equal(preview(P('x @me p4'), me, NOW), '');
  assert.equal(preview(P('x'), me, NOW), '');
});

test('title tidying: whitespace and stray punctuation', () => {
  assert.equal(P('  call   vendor ,  tmr  ').title, 'call vendor');
  assert.equal(P('tmr call vendor').title, 'call vendor');
});

test('perf: 2000 parses average under 1 ms', () => {
  const inputs = ['Buy confetti @Brit fri #eoy', 'poster next fri @mike w', 'beli balon besok @aaron', 'report in 2w p1', 'sunday school snacks', 'fix stage jam 3 sore'];
  for (const s of inputs) P(s); // warm up
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) P(inputs[i % inputs.length]);
  const avg = (performance.now() - t0) / 2000;
  assert.ok(avg < 1, `average ${avg.toFixed(3)} ms`);
});
