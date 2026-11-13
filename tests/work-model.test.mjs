// Pure-logic tests for src/work-model.js. Run: node tests/work-model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysLate, bucket, groupTasks, price, budgetRows, flagged, batchOf, batchName, batches, assignable, waitingOn, summary,
} from '../src/work-model.js';
import { idr } from '../src/time.js';

const TODAY = '2026-11-13'; // a Friday; its week runs Mon 2026-11-09 to Sun 2026-11-15
const JKT = 7 * 3600e3, H = 3600e3;
const startOf = (day) => Date.parse(day) - JKT; // instant a Jakarta day starts
const OLD = startOf('2026-10-01');
const task = (o) => ({ id: 't', title: 'Task', ownerUid: 'a@x', assignerUid: 'a@x', dueDate: null, status: 'todo', blockedReason: '', waitingOnUid: null, assignedAt: OLD, doneAt: null, ...o });

test('daysLate: plain lateness, grace for short notice, never for blocked, done, undated or due today', () => {
  assert.equal(daysLate(task({ dueDate: '2026-11-12', assignedAt: startOf('2026-11-06') }), TODAY), 1);
  // Due yesterday, assigned 24h before the end of that day: under 48h, so the first day is free.
  const dueEnd = startOf('2026-11-13');
  assert.equal(daysLate(task({ dueDate: '2026-11-12', assignedAt: dueEnd - 24 * H }), TODAY), 0);
  assert.equal(daysLate(task({ dueDate: '2026-11-12', assignedAt: dueEnd - 47 * H }), TODAY), 0);
  assert.equal(daysLate(task({ dueDate: '2026-11-12', assignedAt: dueEnd - 49 * H }), TODAY), 1);
  // The same short-notice task two days after the due date is 2 days late.
  assert.equal(daysLate(task({ dueDate: '2026-11-12', assignedAt: dueEnd - 24 * H }), '2026-11-14'), 2);
  assert.equal(daysLate(task({ dueDate: '2026-11-01', status: 'blocked' }), TODAY), 0);
  assert.equal(daysLate(task({ dueDate: '2026-11-01', status: 'done' }), TODAY), 0);
  assert.equal(daysLate(task({ dueDate: null }), TODAY), 0);
  assert.equal(daysLate(task({ dueDate: TODAY }), TODAY), 0);
  assert.equal(daysLate(task({ dueDate: '2026-11-20' }), TODAY), 0);
});

test('bucket and groupTasks: overdue, week, later, blocked, done, each in order', () => {
  const list = [
    task({ id: 'later2', title: 'L', dueDate: '2026-12-01' }),
    task({ id: 'done1', status: 'done', doneAt: 100, dueDate: '2026-11-01' }),
    task({ id: 'done2', status: 'done', doneAt: 200 }),
    task({ id: 'wk2', dueDate: '2026-11-15' }),
    task({ id: 'od2', dueDate: '2026-11-10' }),
    task({ id: 'blk', status: 'blocked', blockedReason: 'x', dueDate: '2026-11-01' }),
    task({ id: 'wk1', dueDate: '2026-11-13' }),
    task({ id: 'od1', dueDate: '2026-11-05' }),
    task({ id: 'later1', title: 'K', dueDate: '2026-11-16' }),
    task({ id: 'nodate' }),
  ];
  assert.equal(bucket(list.find((t) => t.id === 'wk2'), TODAY), 'week');
  assert.equal(bucket(list.find((t) => t.id === 'later1'), TODAY), 'later');
  assert.equal(bucket(list.find((t) => t.id === 'nodate'), TODAY), 'later');
  const g = groupTasks(list, TODAY);
  assert.deepEqual(Object.keys(g), ['overdue', 'week', 'later', 'blocked', 'done']);
  assert.deepEqual(g.overdue.map((t) => t.id), ['od1', 'od2']);
  assert.deepEqual(g.week.map((t) => t.id), ['wk1', 'wk2']);
  assert.deepEqual(g.later.map((t) => t.id), ['later1', 'later2', 'nodate']);
  assert.deepEqual(g.blocked.map((t) => t.id), ['blk']);
  assert.deepEqual(g.done.map((t) => t.id), ['done2', 'done1']);
});

test('price: unit mode multiplies, total mode divides, bad quantity counts as 1', () => {
  assert.deepEqual(price('unit', 15000, 4), { qty: 4, unitIdr: 15000, totalIdr: 60000 });
  assert.deepEqual(price('total', 60000, 4), { qty: 4, unitIdr: 15000, totalIdr: 60000 });
  assert.equal(price('unit', 15000, 0).qty, 1);
  assert.equal(price('unit', 15000, 0).totalIdr, 15000);
  assert.equal(price('unit', 15000, '').totalIdr, 15000);
  assert.equal(price('total', 60000, '').unitIdr, 60000);
  assert.equal(price('total', 60000, 0).qty, 1);
});

test('budgetRows: remaining counts approved totals and bought/paid actuals only', () => {
  const budgets = [
    { id: 'b1', name: 'Carnival', amountIdr: 1000000, active: true },
    { id: 'b2', name: 'Old', amountIdr: 500000, active: false },
    { id: 'b0', name: 'Assembly', amountIdr: 200000, active: true },
  ];
  const p = (o) => ({ budgetId: 'b1', totalIdr: 100000, status: 'pending', ...o });
  const purchases = [
    p({ id: '1', status: 'approved' }),
    p({ id: '2', status: 'bought', paidIdr: 90000 }),
    p({ id: '3', status: 'paid', paidIdr: 50000 }),
    p({ id: '4', status: 'pending', totalIdr: 70000 }),
    p({ id: '5', status: 'pending', totalIdr: 30000 }),
    p({ id: '6', status: 'rejected' }),
    p({ id: '7', status: 'vetoed' }),
    p({ id: '8', budgetId: 'b2', status: 'approved' }),
  ];
  const rows = budgetRows(budgets, purchases);
  assert.deepEqual(rows.map((r) => r.id), ['b0', 'b1']); // inactive left out, sorted by name
  assert.equal(rows[1].remaining, 1000000 - 100000 - 90000 - 50000);
  assert.equal(rows[1].pending, 2);
  assert.equal(rows[0].remaining, 200000);
  assert.equal(rows[0].pending, 0);
});

test('flagged: more than 10% off the estimate once bought or paid', () => {
  assert.equal(flagged({ status: 'paid', totalIdr: 90000, paidIdr: 100000 }), true); // 11.1% over
  assert.equal(flagged({ status: 'bought', totalIdr: 100000, paidIdr: 110000 }), false); // exactly 10%
  assert.equal(flagged({ status: 'bought', totalIdr: 100000, paidIdr: 111000 }), true);
  assert.equal(flagged({ status: 'pending', totalIdr: 90000, paidIdr: 100000 }), false);
  assert.equal(flagged({ status: 'approved', totalIdr: 90000, paidIdr: 100000 }), false);
});

test('batchOf and batchName: two batches a month', () => {
  assert.equal(batchOf('2026-11-15'), '2026-11-1');
  assert.equal(batchOf('2026-11-16'), '2026-11-2');
  assert.equal(batchOf('2026-11-01'), '2026-11-1');
  assert.equal(batchName('2026-11-2'), 'Nov #2');
  assert.equal(batchName('2026-01-1'), 'Jan #1');
});

test('batches: bought purchases grouped by batch, summed per requester, oldest first', () => {
  const members = [{ id: 'a@x', name: 'Ayu Lestari' }, { id: 'b@x', name: 'Budi Santoso' }];
  const p = (o) => ({ status: 'bought', ...o });
  const out = batches([
    p({ id: '1', requesterUid: 'b@x', batchId: '2026-11-2', paidIdr: 30000 }),
    p({ id: '2', requesterUid: 'a@x', batchId: '2026-11-1', paidIdr: 10000 }),
    p({ id: '3', requesterUid: 'a@x', batchId: '2026-11-1', paidIdr: 5000 }),
    p({ id: '4', requesterUid: 'b@x', batchId: '2026-11-1', paidIdr: 7000 }),
    p({ id: '5', requesterUid: 'a@x', batchId: '2026-11-1', paidIdr: 99999, status: 'paid' }),
    p({ id: '6', requesterUid: 'a@x', status: 'approved' }),
  ], members);
  assert.deepEqual(out.map((b) => b.id), ['2026-11-1', '2026-11-2']);
  assert.equal(out[0].total, 22000);
  assert.equal(out[0].items.length, 3);
  assert.deepEqual(out[0].pay, [{ uid: 'a@x', name: 'Ayu Lestari', amount: 15000 }, { uid: 'b@x', name: 'Budi Santoso', amount: 7000 }]);
  assert.equal(out[1].total, 30000);
});

test('assignable: member self only, officer own department, president everyone, self first', () => {
  const m = (id, name, o) => ({ id, name, role: 'member', active: true, ...o });
  const members = [
    m('zed@x', 'Zed', { departmentId: 'events' }),
    m('off@x', 'Olive', { role: 'officer', departmentId: 'events' }),
    m('amy@x', 'Amy', { departmentId: 'events' }),
    m('sam@x', 'Sam', { departmentId: 'sports' }),
    m('ina@x', 'Ina', { departmentId: 'events', active: false }),
    m('tea@x', 'Teacher', { role: 'teacher', departmentId: 'events' }),
    m('pres@x', 'Pres', { role: 'president' }),
  ];
  const ids = (me) => assignable(me, members).map((x) => x.id);
  assert.deepEqual(ids(members[0]), ['zed@x']);
  assert.deepEqual(ids(members[1]), ['off@x', 'amy@x', 'zed@x']);
  assert.deepEqual(ids(members[6]), ['pres@x', 'amy@x', 'off@x', 'sam@x', 'zed@x']);
  // An officer with no department can only give to self.
  assert.deepEqual(ids({ id: 'off@x', role: 'officer', active: true, name: 'Olive' }), ['off@x']);
});

test('waitingOn: approvals for treasurers, receipts for requesters, tasks blocked on me', () => {
  const p = (o) => ({ createdAt: 1, totalIdr: 1, ...o });
  const purchases = [
    p({ id: 'own', status: 'pending', requesterUid: 'tres@x', createdAt: 1 }),
    p({ id: 'later', status: 'pending', requesterUid: 'mem@x', createdAt: 5 }),
    p({ id: 'sooner', status: 'pending', requesterUid: 'mem@x', createdAt: 2 }),
    p({ id: 'appr', status: 'approved', requesterUid: 'mem@x', createdAt: 3 }),
    p({ id: 'apprTres', status: 'approved', requesterUid: 'tres@x', createdAt: 4 }),
  ];
  const tasks = [
    task({ id: 'b1', status: 'blocked', blockedReason: 'need money', waitingOnUid: 'tres@x', ownerUid: 'mem@x' }),
    task({ id: 'b2', status: 'blocked', blockedReason: 'other', waitingOnUid: 'mem@x', ownerUid: 'zed@x' }),
    task({ id: 'b3', status: 'blocked', blockedReason: 'self', waitingOnUid: 'tres@x', ownerUid: 'tres@x' }),
    task({ id: 'todo', waitingOnUid: 'tres@x' }),
  ];
  const t = waitingOn({ id: 'tres@x', role: 'treasurer' }, tasks, purchases);
  assert.deepEqual(t.approvals.map((x) => x.id), ['sooner', 'later']);
  assert.deepEqual(t.receipts.map((x) => x.id), ['apprTres']);
  assert.deepEqual(t.blocked.map((x) => x.id), ['b1']);
  const m = waitingOn({ id: 'mem@x', role: 'member' }, tasks, purchases);
  assert.deepEqual(m.approvals, []);
  assert.deepEqual(m.receipts.map((x) => x.id), ['appr']);
  assert.deepEqual(m.blocked.map((x) => x.id), ['b2']);
});

// ---- summary
const members = [
  { id: 'ayu@x', name: 'Ayu Lestari', role: 'member', active: true },
  { id: 'budi@x', name: 'Budi Santoso', role: 'member', active: true },
  { id: 'citra@x', name: 'Citra Dewi', role: 'treasurer', active: true },
];
const data = () => ({
  members,
  tasks: [
    task({ id: 't1', title: 'Book the hall', ownerUid: 'ayu@x', dueDate: '2026-11-10' }), // 3d late
    task({ id: 't2', title: 'Print posters', ownerUid: 'budi@x', dueDate: '2026-11-05' }), // 8d late
    task({ id: 't3', title: 'Order shirts', ownerUid: 'citra@x', dueDate: '2026-11-14' }),
    task({ id: 't4', title: 'Call sponsor', ownerUid: 'ayu@x', status: 'blocked', blockedReason: 'needs a letter', waitingOnUid: 'budi@x', dueDate: '2026-11-02' }),
    task({ id: 't5', title: 'ZZZ finished chore', ownerUid: 'ayu@x', status: 'done', doneAt: 5, dueDate: '2026-11-01' }),
    task({ id: 't6', title: 'Plan next term', ownerUid: 'budi@x', dueDate: '2027-01-10' }),
  ],
  budgets: [
    { id: 'b1', name: 'Carnival', amountIdr: 1000000, active: true },
    { id: 'b2', name: 'Closed', amountIdr: 300000, active: false },
    { id: 'b3', name: 'Assembly', amountIdr: 200000, active: true },
  ],
  purchases: [
    { id: 'p1', budgetId: 'b1', requesterUid: 'ayu@x', status: 'approved', totalIdr: 100000, createdAt: 1 },
    { id: 'p2', budgetId: 'b1', requesterUid: 'budi@x', status: 'bought', totalIdr: 80000, paidIdr: 90000, createdAt: 2 },
    { id: 'p3', budgetId: 'b1', requesterUid: 'ayu@x', status: 'pending', totalIdr: 70000, createdAt: 3 },
    { id: 'p4', budgetId: 'b3', requesterUid: 'budi@x', status: 'pending', totalIdr: 30000, createdAt: 4 },
    { id: 'p5', budgetId: 'b3', requesterUid: 'budi@x', status: 'vetoed', totalIdr: 999999, createdAt: 5 },
  ],
});
const shuffled = (d, k) => {
  const rot = (a) => [...a.slice(k % a.length), ...a.slice(0, k % a.length)];
  return { members: rot(d.members).reverse(), tasks: rot(d.tasks).reverse(), budgets: rot(d.budgets).reverse(), purchases: rot(d.purchases).reverse() };
};

test('summary: identical text whatever the order of the input arrays', () => {
  const d = data(), base = summary(d, TODAY);
  for (const k of [0, 1, 2, 3, 4]) assert.equal(summary(shuffled(d, k), TODAY), base);
  assert.equal(summary(JSON.parse(JSON.stringify(d)), TODAY), base);
});

test('summary: overdue, due this week, blocked, budgets and pending approvals', () => {
  const s = summary(data(), TODAY), lines = s.split('\n');
  const section = (head) => lines.findIndex((l) => l.startsWith(`*${head}`));
  assert.ok(section('Overdue') >= 0);
  assert.ok(s.includes('Ayu: Book the hall (3d late)'), s);
  assert.ok(s.includes('Budi: Print posters (8d late)'), s);
  // Most late first.
  assert.ok(s.indexOf('Print posters') < s.indexOf('Book the hall'));
  const wk = section('Due this week'), blk = section('Blocked');
  assert.ok(wk >= 0 && blk > wk);
  assert.ok(lines[wk].includes('(1)'));
  assert.ok(lines.slice(wk, blk).some((l) => l.includes('Citra: Order shirts')));
  assert.ok(s.includes('Ayu: Call sponsor (waiting on Budi: needs a letter)'), s);
  // One line per active budget, with what is left. Carnival: 1,000,000 - 100,000 approved - 90,000 bought.
  assert.ok(s.includes(`- Carnival: ${idr(810000)} left of ${idr(1000000)}`), s);
  assert.ok(s.includes(`- Assembly: ${idr(200000)} left of ${idr(200000)}`), s);
  assert.ok(!s.includes('Closed'));
  assert.equal(lines.filter((l) => l.startsWith('- ') && /left of/.test(l)).length, 2);
  assert.ok(lines.includes('Pending approvals: 2 (' + idr(100000) + ')'), s);
  assert.ok(lines.at(-1).startsWith('Pending approvals: 2'));
});

test('summary: tasks come before budgets, and done or far-off tasks are not listed', () => {
  const s = summary(data(), TODAY);
  assert.ok(s.indexOf('*Overdue') < s.indexOf('*Budgets*'));
  assert.ok(s.indexOf('*Blocked') < s.indexOf('*Budgets*'));
  assert.ok(s.indexOf('*Budgets*') < s.indexOf('Pending approvals'));
  assert.ok(!s.includes('ZZZ finished chore'));
  assert.ok(!s.includes('Plan next term')); // later tasks are not in the summary
});

test('summary: a quiet week says so and omits an empty budgets block', () => {
  const s = summary({ members, tasks: [task({ id: 'x', ownerUid: 'ayu@x', status: 'done' })], budgets: [], purchases: [] }, TODAY);
  assert.ok(s.includes('No tasks overdue, due this week or blocked.'));
  assert.ok(!s.includes('*Budgets*'));
  assert.ok(s.endsWith('Pending approvals: 0'));
});
