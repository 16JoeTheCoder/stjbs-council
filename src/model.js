// Pure logic over store data: tree indexes, rollups, task state, filters, person status, permissions.
import { S, memberName } from './store.js';
import { addDays, dayStartMs, isoDay, monday, week, weekId } from './time.js';

export const EXEC = ['president', 'vp', 'treasurer', 'secretary'];
export const STAGES = ['Lead', 'Contacted', 'Negotiating', 'Signed'];
export const isBoss = (m = S.me) => m?.role === 'advisor' || EXEC.includes(m?.role);
export const canSeeStats = (m = S.me) => ['advisor', 'president', 'vp'].includes(m?.role);
export const canManage = (it) => S.me?.role !== 'teacher' && (isBoss() || !!it?.leadUids?.includes(S.me?.id));
export const canWork = (t) => canManage(t) || (S.me?.role !== 'teacher' && t.assigneeUids?.includes(S.me?.id));
export const isMine = (t) => !!t.assigneeUids?.includes(S.me?.id);

let memo = { items: null };
// byId, kids (id -> children sorted), tasks (id -> leaf tasks beneath or itself)
export function tree() {
  if (memo.items === S.items) return memo;
  const byId = {}, kids = {}, tasks = {};
  for (const it of S.items) byId[it.id] = it;
  for (const it of S.items) {
    if (it.parentId && !byId[it.parentId]) continue; // orphan of an archived parent
    (kids[it.parentId || 'root'] ||= []).push(it);
    if (it.kind === 'task') for (const a of [...it.ancestors, it.id]) (tasks[a] ||= []).push(it);
  }
  for (const k in kids) kids[k].sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9') || a.title.localeCompare(b.title));
  return (memo = { items: S.items, byId, kids, tasks, under: (id) => tasks[id] || [] });
}

export const progress = (list) => ({ done: list.filter((t) => t.status === 'done').length, total: list.length });

export function taskState(t, today = isoDay()) {
  if (t.status === 'done') return { cls: 'ok', word: 'Done', rank: 0 };
  if (t.blocked) return { cls: 'bad', word: 'Blocked', rank: 4 };
  if (t.dueDate && t.dueDate < today) return { cls: 'bad', word: 'Overdue', rank: 3 };
  if (t.dueDate && t.dueDate <= addDays(today, 3)) return { cls: 'warn', word: 'Due soon', rank: 2 };
  return { cls: 'ok', word: 'On track', rank: 1 };
}
export function groupState(list) {
  const open = list.map((t) => taskState(t)).filter((s) => s.rank);
  if (!open.length) return list.length ? taskState({ status: 'done' }) : { cls: 'ok', word: 'No tasks', rank: 1 };
  return open.reduce((a, b) => (b.rank > a.rank ? b : a));
}

export const CHIPS = [['all', 'All'], ['mine', 'Mine'], ['soon', 'Due soon'], ['overdue', 'Overdue'], ['blocked', 'Blocked'], ['done', 'Done']];
const chipTest = {
  all: () => true, mine: isMine, done: (t) => t.status === 'done',
  soon: (t) => taskState(t).word === 'Due soon', overdue: (t) => taskState(t).word === 'Overdue', blocked: (t) => t.status !== 'done' && t.blocked,
};
// f: { chip, person, team, hideDone }. Returns the list plus counts per chip for the bar.
export function applyFilter(list, f) {
  const scoped = list.filter((t) => (!f.person || t.assigneeUids?.includes(f.person)) && (!f.team || t.ancestors.includes(f.team)));
  const counts = Object.fromEntries(CHIPS.map(([k]) => [k, scoped.filter(chipTest[k]).length]));
  let out = scoped.filter(chipTest[f.chip] || chipTest.all);
  const doneHidden = f.hideDone && f.chip !== 'done' ? out.filter((t) => t.status === 'done').length : 0;
  if (doneHidden) out = out.filter((t) => t.status !== 'done');
  return { out, counts, doneHidden };
}

// Rule-based weekly status per person. No paraphrasing: their own blocked words are quoted.
export function personStatus(email, w = week()) {
  const ci = S.checkins.find((c) => c.uid === email && c.weekId === w.id);
  const last = S.checkins.find((c) => c.uid === email && c.weekId === w.lastId);
  const mine = S.items.filter((t) => t.kind === 'task' && t.assigneeUids?.includes(email));
  const overdue = mine.filter((t) => taskState(t).word === 'Overdue').length;
  const done = mine.filter((t) => t.status === 'done' && t.completedAt >= dayStartMs(w.start)).length;
  const startWeek = S.term?.startWeekId || (S.term?.startDate && weekId(monday(S.term.startDate)));
  const missedLast = !last && !!startWeek && startWeek <= w.lastId;
  const blocked = ci?.blocked?.trim();
  const cls = blocked || missedLast ? 'bad' : overdue || !ci ? 'warn' : 'ok';
  const word = blocked ? 'Blocked' : missedLast ? 'Missed check-in' : overdue ? 'Overdue' : !ci ? 'No check-in' : 'On track';
  const line = `${memberName(email)}: ${done} done, ${overdue} overdue.${blocked ? ` Blocked: "${blocked}"` : ''}`;
  return { cls, word, line, ci, blocked, overdue, done };
}

export const checksIn = (m) => !['teacher', 'advisor'].includes(m?.role);
export const activeMembers = () => S.members.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name));
export const initials = (name = '') => (name.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2) || '?').toUpperCase();
export const safeUrl = (u) => (/^https?:\/\/\S+$/i.test(u || '') ? u : '');
