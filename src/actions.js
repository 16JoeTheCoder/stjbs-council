// Every write. Each change carries termId and writes its activity entry and notifications in the same batch.
import { collection, doc, writeBatch, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, fail, toast } from './store.js';
import { tree } from './model.js';
import { week } from './time.js';

const T = () => S.term.termId;
const now = () => Date.now();
const newRef = (path) => doc(collection(db, path));

function log(b, type, itemId, text) {
  b.set(newRef('activity'), { termId: T(), actorUid: S.me.id, type, itemId: itemId || null, text, createdAt: now() });
}
function notify(b, to, type, item, text) {
  for (const uid of new Set(to.filter((u) => u && u !== S.me.id)))
    b.set(newRef(`notifications/${uid}/items`), { termId: T(), toUid: uid, fromUid: S.me.id, type, itemId: item.id, text, read: false, createdAt: now() });
}
// Assignees, creator and the nearest lead, minus the author (notify removes the author).
export const audience = (it) => [...(it.assigneeUids || []), it.createdByUid, it.leadUids?.at(-1), it.blocked && it.blockedOnUid];

async function run(fn, done) {
  const b = writeBatch(db);
  try { fn(b); await b.commit(); if (done) toast(done); return true; } catch (e) { fail(e); return false; }
}

export function createItem(parent, data) {
  const ref = newRef('items');
  const leadUid = data.leadUid || null;
  const item = {
    termId: T(), parentId: parent?.id || null, ancestors: parent ? [...parent.ancestors, parent.id] : [],
    leadUids: [...(parent?.leadUids || []), ...(leadUid ? [leadUid] : [])], leadUid, kind: 'task', title: '', notes: '', link: '',
    assigneeUids: [], createdByUid: S.me.id, status: 'todo', blocked: false, blockedReason: '', blockedOnUid: null,
    startDate: null, dueDate: null, assignedAt: data.assigneeUids?.length ? now() : null, completedAt: null,
    archived: false, isDeal: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdAt: now(), updatedAt: now(), ...data,
  };
  return run((b) => {
    b.set(ref, item);
    log(b, 'created', ref.id, `added "${item.title}"`);
    notify(b, item.assigneeUids, 'assigned', { id: ref.id }, `assigned you "${item.title}"`);
  }, `Added "${item.title}".`).then((ok) => ok && ref.id);
}

export function updateItem(it, patch, verb = 'updated') {
  const p = { ...patch, updatedAt: now() };
  if (patch.status && (patch.status === 'done') !== (it.status === 'done')) p.completedAt = patch.status === 'done' ? now() : null;
  const added = (patch.assigneeUids || []).filter((u) => !it.assigneeUids.includes(u));
  if (added.length) p.assignedAt = now();
  return run((b) => {
    b.update(doc(db, 'items', it.id), p);
    log(b, verb, it.id, `${verb} "${patch.title || it.title}"`);
    notify(b, added, 'assigned', it, `assigned you "${it.title}"`);
    if (patch.blockedOnUid && patch.blockedOnUid !== it.blockedOnUid) notify(b, [patch.blockedOnUid], 'blocked-on-you', it, `is blocked on you: "${it.title}"`);
  });
}

export const toggleDone = (t) => updateItem(t, { status: t.status === 'done' ? 'todo' : 'done' }, t.status === 'done' ? 'reopened' : 'completed')
  .then((ok) => ok && toast(`${t.status === 'done' ? 'Reopened' : 'Done'}: "${t.title}".`));

// Writes many items while keeping each batch under 450 writes and 15 distinct parents (rules access-call limit).
async function commitChunked(ops) {
  ops.sort((a, b) => a.depth - b.depth);
  let b = writeBatch(db), n = 0, parents = new Set();
  for (const o of ops) {
    if (n >= 450 || (parents.size >= 15 && !parents.has(o.parentId))) { await b.commit(); b = writeBatch(db); n = 0; parents = new Set(); }
    o.data ? b.set(o.ref, o.data) : b.update(o.ref, o.patch);
    parents.add(o.parentId); n++;
  }
  await b.commit();
}

export async function changeLead(it, leadUid) {
  const { byId } = tree();
  const parentLeads = it.parentId ? byId[it.parentId].leadUids : [];
  const ops = [], depth = it.ancestors.length;
  const fresh = { [it.id]: [...parentLeads, ...(leadUid ? [leadUid] : [])] };
  const subtree = S.items.filter((x) => x.id === it.id || x.ancestors.includes(it.id)).sort((a, b) => a.ancestors.length - b.ancestors.length);
  for (const x of subtree) {
    if (x.id !== it.id) fresh[x.id] = [...fresh[x.parentId], ...(x.leadUid ? [x.leadUid] : [])];
    ops.push({ ref: doc(db, 'items', x.id), depth: x.ancestors.length - depth, parentId: x.parentId,
      patch: x.id === it.id ? { leadUid: leadUid || null, leadUids: fresh[x.id], updatedAt: now() } : { leadUids: fresh[x.id] } });
  }
  try {
    await commitChunked(ops);
    await run((b) => { log(b, 'lead', it.id, `made ${leadUid || 'nobody'} lead of "${it.title}"`); notify(b, [leadUid], 'assigned', it, `made you lead of "${it.title}"`); }, 'Lead changed.');
  } catch (e) { fail(e); }
}

// Create a whole tree (templates). nodes: [{key, parentKey, ...itemFields}] parents before children.
export async function createTree(nodes) {
  const ids = {}, made = {}, ops = [];
  for (const n of nodes) {
    const ref = newRef('items'), parent = n.parentKey == null ? null : made[n.parentKey];
    ids[n.key] = ref.id;
    const { key, parentKey, ...fields } = n;
    made[n.key] = { id: ref.id, ancestors: parent ? [...parent.ancestors, parent.id] : [], leadUids: [] };
    ops.push({ ref, depth: made[n.key].ancestors.length, parentId: parent?.id || null, data: {
      termId: T(), parentId: parent?.id || null, ancestors: made[n.key].ancestors, leadUids: [], leadUid: null, notes: '', link: '',
      assigneeUids: [], createdByUid: S.me.id, status: 'todo', blocked: false, blockedReason: '', blockedOnUid: null, startDate: null,
      assignedAt: null, completedAt: null, archived: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdAt: now(), updatedAt: now(), ...fields } });
  }
  try { await commitChunked(ops); await run((b) => log(b, 'created', ids[nodes[0].key], `started "${nodes[0].title}" from a template`)); return ids[nodes[0].key]; }
  catch (e) { fail(e); return null; }
}

// Archives a subtree after a confirm naming its size; the toast offers to restore exactly those items.
export async function archiveItem(it) {
  const list = S.items.filter((x) => x.id === it.id || x.ancestors.includes(it.id));
  if (!confirm(`Archive "${it.title}"${list.length > 1 ? ` and the ${list.length - 1} items inside it` : ''}? It disappears from every screen.`)) return false;
  const flag = (archived) => commitChunked(list.map((x) => ({ ref: doc(db, 'items', x.id), depth: x.ancestors.length, parentId: x.parentId, patch: { archived, updatedAt: now() } })));
  try {
    await flag(true);
    await run((b) => log(b, 'archived', it.id, `archived "${it.title}"`));
    toast(`Archived "${it.title}".`, { label: 'Undo', fn: () => flag(false).then(() => run((b) => log(b, 'restored', it.id, `restored "${it.title}"`), 'Restored.')).catch(fail) });
    return true;
  } catch (e) { fail(e); return false; }
}

export function addComment(it, text) {
  return run((b) => {
    const c = newRef('comments');
    b.set(c, { termId: T(), itemId: it.id, authorUid: S.me.id, text, createdAt: now() });
    log(b, 'comment', it.id, `commented on "${it.title}"`);
    notify(b, audience(it), 'comment', it, `commented on "${it.title}": ${text.slice(0, 80)}`);
  });
}
export const deleteComment = (c) => deleteDoc(doc(db, 'comments', c.id)).catch(fail);

export function saveCheckin(answers) {
  const w = week(), id = `${T()}_${w.id}_${S.me.id}`;
  return run((b) => {
    b.set(doc(db, 'checkins', id), { termId: T(), weekId: w.id, uid: S.me.id, ...answers, updatedAt: now(), createdAt: now() });
    log(b, 'checkin', null, `checked in for ${w.id}`);
  }, 'Check-in saved.');
}

export const markRead = (n) => updateDoc(doc(db, `notifications/${S.me.id}/items`, n.id), { read: true }).catch(fail);
export async function putDoc(path, data, msg) {
  try { await setDoc(doc(db, path), { ...data, termId: data.termId || T(), updatedAt: now() }, { merge: true }); if (msg) toast(msg); return true; }
  catch (e) { fail(e); return false; }
}
