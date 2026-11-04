// Organisation helpers bound to the live store. Departments and committees each come from one term listener.
import { S } from './store.js';
import { BOARD_ORDER, deptMembers, positionIn, reportsToIn } from './org-model.js';

export * from './org-model.js';

export const departments = () => (S.departments || []).filter((d) => d.active !== false)
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
export const committees = () => (S.committees || []).slice().sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (b.startDate || '').localeCompare(a.startDate || ''));
export const deptOf = (uid) => departments().find((d) => deptMembers(d).includes(uid)) || null;
export function placeOf(uid) {
  const d = deptOf(uid);
  return d ? { dept: d, position: positionIn(d, uid) } : { dept: null, position: null };
}
export const presidentUid = () => S.members.find((m) => m.active && m.role === 'president')?.id || null;
export const board = () => BOARD_ORDER.flatMap((r) => S.members.filter((m) => m.active && m.role === r));
export const leadsDept = (uid = S.me?.id) => departments().find((d) => d.jcLeadUid === uid || d.secLeadUid === uid) || null;
// Member-document fields that mirror one department, for every person in it.
export const memberPatches = (d) => deptMembers(d).map((uid) => ({ uid, patch: { departmentId: d.id, position: positionIn(d, uid), reportsTo: reportsToIn(d, uid, presidentUid()) } }));
