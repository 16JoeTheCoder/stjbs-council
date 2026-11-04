// Writes for departments, special committees and bulk member edits. Every department write also rewrites the
// mirrored member fields (departmentId, position, reportsTo) so older screens that read reportsTo keep working.
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, fail, toast } from './store.js';
import { deptMembers, positionIn, reportsToIn } from './org-model.js';
import { presidentUid } from './org.js';

const LIMIT = 450; // under Firestore's 500 writes per batch
const now = () => Date.now();
async function commit(ops) {
  for (let i = 0; i < ops.length; i += LIMIT) {
    const b = writeBatch(db);
    for (const [ref, data, kind] of ops.slice(i, i + LIMIT)) (kind === 'set' ? b.set(ref, data) : b.update(ref, data));
    await b.commit();
  }
}
const memberRef = (uid) => doc(db, 'members', uid);
const mirror = (d, uid) => ({ departmentId: d.id, position: positionIn(d, uid), reportsTo: reportsToIn(d, uid, presidentUid()), termId: S.term.termId, updatedAt: now() });
const cleared = () => ({ departmentId: null, position: null, reportsTo: null, termId: S.term.termId, updatedAt: now() });
const changedMember = (uid, patch) => {
  const m = S.members.find((x) => x.id === uid);
  return m && Object.entries(patch).some(([k, v]) => k !== 'updatedAt' && k !== 'termId' && (m[k] ?? null) !== v);
};

// Admin save of one department. People who leave lose the mirror; people who arrive leave their old department.
// The signed-in admin's own position cannot change (rules), so their own document is left alone.
export async function saveDepartment(d, patch, msg = 'Department saved.') {
  const next = { ...d, ...patch, memberUids: [...new Set(patch.memberUids || d.memberUids || [])] };
  next.memberUids = next.memberUids.filter((u) => u !== next.jcLeadUid && u !== next.secLeadUid);
  const before = new Set(d.id ? deptMembers(d) : []), after = new Set(deptMembers(next)), ops = [];
  const ref = d.id ? doc(db, 'departments', d.id) : doc(collection(db, 'departments'));
  next.id = ref.id;
  const data = { termId: S.term.termId, name: next.name, order: next.order ?? 0, jcLeadUid: next.jcLeadUid || null, secLeadUid: next.secLeadUid || null, memberUids: next.memberUids, active: next.active !== false, createdAt: d.createdAt || now(), updatedAt: now() };
  ops.push([ref, data, 'set']);
  for (const other of S.departments.filter((x) => x.id !== next.id)) {
    const moving = deptMembers(other).filter((u) => after.has(u));
    if (moving.length) ops.push([doc(db, 'departments', other.id), {
      memberUids: (other.memberUids || []).filter((u) => !after.has(u)),
      jcLeadUid: after.has(other.jcLeadUid) ? null : other.jcLeadUid || null, secLeadUid: after.has(other.secLeadUid) ? null : other.secLeadUid || null, updatedAt: now() }]);
  }
  for (const uid of after) if (uid !== S.me.id && changedMember(uid, mirror(next, uid))) ops.push([memberRef(uid), mirror(next, uid)]);
  for (const uid of before) if (!after.has(uid) && uid !== S.me.id) ops.push([memberRef(uid), cleared()]);
  try { await commit(ops); toast(msg); return ref.id; } catch (e) { fail(e); return null; }
}

// A department's JC or Sec officer adds people with no department, or removes a general member.
export async function leadSetMembers(d, add = [], remove = []) {
  const ops = [[doc(db, 'departments', d.id), { memberUids: [...new Set([...(d.memberUids || []).filter((u) => !remove.includes(u)), ...add])], updatedAt: now() }]];
  for (const uid of add) ops.push([memberRef(uid), { departmentId: d.id, position: 'member', reportsTo: d.jcLeadUid || null, termId: S.term.termId, updatedAt: now() }]);
  for (const uid of remove) ops.push([memberRef(uid), cleared()]);
  try { await commit(ops); toast(add.length ? `Added ${add.length} to ${d.name}.` : `Removed from ${d.name}.`); return true; } catch (e) { fail(e); return false; }
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'team';
export const newTeam = (name, taken = []) => {
  let id = slug(name), n = 2;
  while (taken.includes(id)) id = `${slug(name)}-${n++}`;
  return { id, name: name.trim().slice(0, 60), leadUids: [], memberUids: [] };
};
export async function saveCommittee(c, patch, msg = 'Committee saved.') {
  const ref = c.id ? doc(db, 'committees', c.id) : doc(collection(db, 'committees'));
  const next = { ...c, ...patch };
  const data = {
    termId: S.term.termId, name: next.name.trim().slice(0, 80), startDate: next.startDate, endDate: next.endDate, status: next.status || 'planning',
    chairUids: next.chairUids || [], teams: (next.teams || []).map((t) => ({ id: t.id, name: t.name, leadUids: t.leadUids || [], memberUids: (t.memberUids || []).filter((u) => !(t.leadUids || []).includes(u)) })),
    createdAt: c.createdAt || now(), updatedAt: now(), createdByUid: c.createdByUid || S.me.id,
  };
  try { const b = writeBatch(db); b.set(ref, data); await b.commit(); toast(msg); return ref.id; } catch (e) { fail(e); return null; }
}

// Bulk member edit. rows: [{ uid, patch, before }]. Undo restores the before values for 10 seconds.
export async function bulkMembers(rows, label) {
  const at = now(), ops = rows.map((r) => [memberRef(r.uid), { ...r.patch, termId: S.term.termId, updatedAt: at }]);
  try {
    await commit(ops);
    const undo = async () => {
      try { await commit(rows.map((r) => [memberRef(r.uid), { ...r.before, termId: S.term.termId, updatedAt: now() }])); toast('Changes undone.'); } catch (e) { fail(e); }
    };
    toast(`${label}: ${rows.length} ${rows.length === 1 ? 'person' : 'people'} updated.`, { label: 'Undo', fn: undo });
    setTimeout(() => { if (S.undo?.fn === undo) toast(''); }, 10e3);
    return true;
  } catch (e) { fail(e); return false; }
}

// A planned set of writes with the values to restore: { members: [{uid, patch, before}], departments: [{id, data, before}],
// committees: [{id, data, before}] }. Writes go in chunks; Undo restores every before value for 10 seconds.
export async function applyPlan(plan, label) {
  const at = now(), t = S.term.termId;
  const forward = [
    ...plan.departments.map((x) => [doc(db, 'departments', x.id), { ...x.data, updatedAt: at }]),
    ...plan.committees.map((x) => [doc(db, 'committees', x.id), { ...x.data, updatedAt: at }]),
    ...plan.members.map((x) => [memberRef(x.uid), { ...x.patch, termId: t, updatedAt: at }]),
  ];
  const back = [
    ...plan.departments.map((x) => [doc(db, 'departments', x.id), { ...x.before, updatedAt: now() }]),
    ...plan.committees.map((x) => [doc(db, 'committees', x.id), { ...x.before, updatedAt: now() }]),
    ...plan.members.map((x) => [memberRef(x.uid), { ...x.before, termId: t, updatedAt: now() }]),
  ];
  try {
    await commit(forward);
    const undo = async () => { try { await commit(back); toast('Changes undone.'); } catch (e) { fail(e); } };
    const n = new Set([...plan.members.map((x) => x.uid)]).size || plan.committees.length;
    toast(`${label}: ${n} ${n === 1 ? 'person' : 'people'} updated.`, { label: 'Undo', fn: undo });
    setTimeout(() => { if (S.undo?.fn === undo) toast(''); }, 10e3);
    return true;
  } catch (e) { fail(e); return false; }
}
