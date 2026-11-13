// Pure logic for tasks, budgets, purchases and the WhatsApp summary. No Firebase and no store: every function takes
// its data, so the same code runs in the app and in node tests, and the summary is identical for every role.
import { addDays, daysBetween, fmtDay, idr, isoDay, week } from './time.js';

export const STATUS = [['todo', 'To do'], ['doing', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done']];
const H48 = 48 * 3600e3, JKT_MS = 7 * 3600e3;
const first = (members, uid) => (members.find((m) => m.id === uid)?.name || uid || 'Someone').split(' ')[0];
export const fullName = (members, uid) => members.find((m) => m.id === uid)?.name || uid || 'Someone';

// Days late, or 0. Blocked and done are never late. A task given less than 48 hours before the end of its due day
// gets one extra day before it shows as overdue (decision F12).
export function daysLate(t, today = isoDay()) {
  if (t.status === 'done' || t.status === 'blocked' || !t.dueDate || t.dueDate >= today) return 0;
  const late = daysBetween(t.dueDate, today);
  const dueEnd = Date.parse(addDays(t.dueDate, 1)) - JKT_MS;
  return late === 1 && dueEnd - (t.assignedAt || 0) < H48 ? 0 : late;
}
// One of: done, blocked, overdue, week (due by Sunday), later.
export function bucket(t, today = isoDay()) {
  if (t.status === 'done' || t.status === 'blocked') return t.status;
  if (daysLate(t, today)) return 'overdue';
  return t.dueDate && t.dueDate <= week(Date.parse(today)).end ? 'week' : 'later';
}
const byDue = (a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
export function groupTasks(list, today = isoDay()) {
  const g = { overdue: [], week: [], later: [], blocked: [], done: [] };
  for (const t of list) g[bucket(t, today)].push(t);
  for (const k in g) g[k].sort(byDue);
  g.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return g;
}
export const dueWord = (t, today = isoDay()) => {
  const late = daysLate(t, today);
  if (late) return `${late}d late`;
  if (!t.dueDate) return '';
  return t.dueDate === today ? 'Today' : t.dueDate === addDays(today, 1) ? 'Tomorrow' : fmtDay(t.dueDate);
};
export const waitingLine = (t, members) => `Waiting on ${t.waitingOnUid ? first(members, t.waitingOnUid) : 'someone'}: ${t.blockedReason}`;

// Who may I give a task to? Mirrors mayAssign() in firestore.rules.
const BOSS = ['advisor', 'president', 'vp', 'treasurer', 'secretary'];
export const isBossRole = (m) => BOSS.includes(m?.role);
export const isOfficer = (m) => m?.role === 'officer' || ['jc_officer', 'sec_officer'].includes(m?.position);
export function assignable(me, members) {
  const live = members.filter((m) => m.active && m.role !== 'teacher');
  const mine = live.filter((m) => m.id === me.id);
  const rest = isBossRole(me) ? live.filter((m) => m.id !== me.id)
    : isOfficer(me) && me.departmentId ? live.filter((m) => m.id !== me.id && m.departmentId === me.departmentId) : [];
  return [...mine, ...rest.sort((a, b) => a.name.localeCompare(b.name))];
}
export function overdueByPerson(tasks, members, today = isoDay()) {
  const n = {};
  for (const t of tasks) if (daysLate(t, today)) n[t.ownerUid] = (n[t.ownerUid] || 0) + 1;
  return Object.entries(n).map(([uid, count]) => ({ uid, name: fullName(members, uid), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ---- Money
export const FLAG_PCT = 0.1;
// Fill in the third number from the two the person typed. mode 'unit': unit x qty; mode 'total': total / qty.
export function price(mode, amount, qty) {
  const q = Math.max(1, Math.floor(Number(qty) || 1)), a = Math.max(0, Number(amount) || 0);
  return mode === 'unit' ? { qty: q, unitIdr: a, totalIdr: a * q } : { qty: q, unitIdr: Math.round(a / q), totalIdr: a };
}
export const committed = (p) => (p.status === 'approved' ? p.totalIdr : ['bought', 'paid'].includes(p.status) ? p.paidIdr ?? p.totalIdr : 0);
export function budgetRows(budgets, purchases) {
  return budgets.filter((b) => b.active).map((b) => {
    const mine = purchases.filter((p) => p.budgetId === b.id);
    return { ...b, remaining: b.amountIdr - mine.reduce((s, p) => s + committed(p), 0), pending: mine.filter((p) => p.status === 'pending').length };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export const flagged = (p) => ['bought', 'paid'].includes(p.status) && p.totalIdr > 0 && Math.abs(p.paidIdr - p.totalIdr) / p.totalIdr > FLAG_PCT;
export const batchOf = (day = isoDay()) => `${day.slice(0, 7)}-${Number(day.slice(8)) <= 15 ? 1 : 2}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const batchName = (id) => `${MON[Number(id.slice(5, 7)) - 1]} #${id.slice(8)}`;
// Open batches, oldest first: who to pay and how much.
export function batches(purchases, members) {
  const out = {};
  for (const p of purchases.filter((x) => x.status === 'bought')) {
    const b = (out[p.batchId] ||= { id: p.batchId, total: 0, items: [], pay: {} });
    b.items.push(p); b.total += p.paidIdr; b.pay[p.requesterUid] = (b.pay[p.requesterUid] || 0) + p.paidIdr;
  }
  return Object.values(out).sort((a, b) => a.id.localeCompare(b.id)).map((b) => ({
    ...b, pay: Object.entries(b.pay).map(([uid, amount]) => ({ uid, name: fullName(members, uid), amount })).sort((x, y) => x.name.localeCompare(y.name)),
  }));
}
export const PSTATUS = { pending: 'Waiting for a treasurer', approved: 'Approved, buy it', rejected: 'Rejected', bought: 'Bought, in batch', paid: 'Paid back', vetoed: 'Vetoed' };

// What waits on this person: approvals (treasurers; the Teacher sees them to veto), receipts to upload, tasks blocked on them.
export function waitingOn(me, tasks, purchases) {
  const sees = me.role === 'treasurer' || me.role === 'advisor';
  return {
    approvals: sees ? purchases.filter((p) => p.status === 'pending' && p.requesterUid !== me.id).sort((a, b) => a.createdAt - b.createdAt) : [],
    receipts: purchases.filter((p) => p.status === 'approved' && p.requesterUid === me.id).sort((a, b) => a.createdAt - b.createdAt),
    blocked: tasks.filter((t) => t.status === 'blocked' && t.waitingOnUid === me.id && t.ownerUid !== me.id).sort(byDue),
  };
}

// ---- The WhatsApp summary: facts only, fixed order, the same text whoever presses the button (decision F21).
export function summary({ tasks, budgets, purchases, members }, today = isoDay()) {
  const g = groupTasks(tasks, today), who = (t) => first(members, t.ownerUid);
  const by = (f) => (a, b) => f(a, b) || who(a).localeCompare(who(b)) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const out = [`*STJBS Council · ${fmtDay(today)}*`];
  const section = (head, list, line) => { if (list.length) out.push('', `*${head} (${list.length})*`, ...list.map(line)); };
  section('Overdue', g.overdue.sort(by((a, b) => daysLate(b, today) - daysLate(a, today))), (t) => `- ${who(t)}: ${t.title} (${daysLate(t, today)}d late)`);
  section('Due this week', g.week.sort(by((a, b) => a.dueDate.localeCompare(b.dueDate))), (t) => `- ${who(t)}: ${t.title} (${fmtDay(t.dueDate)})`);
  section('Blocked', g.blocked.sort(by(() => 0)), (t) => `- ${who(t)}: ${t.title} (waiting on ${t.waitingOnUid ? first(members, t.waitingOnUid) : 'someone'}: ${t.blockedReason})`);
  if (!g.overdue.length && !g.week.length && !g.blocked.length) out.push('', 'No tasks overdue, due this week or blocked.');
  const rows = budgetRows(budgets, purchases);
  if (rows.length) out.push('', '*Budgets*', ...rows.map((b) => `- ${b.name}: ${idr(b.remaining)} left of ${idr(b.amountIdr)}`));
  const pending = purchases.filter((p) => p.status === 'pending');
  out.push('', `Pending approvals: ${pending.length}${pending.length ? ` (${idr(pending.reduce((s, p) => s + p.totalIdr, 0))})` : ''}`);
  return out.join('\n');
}
