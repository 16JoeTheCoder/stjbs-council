// Every write. Each change carries termId and writes its activity entry and notifications in the same batch.
import { arrayRemove, arrayUnion, collection, doc, writeBatch, deleteDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, fail, toast } from './store.js';
import { isAdmin, tree } from './model.js';
import { publish, refreshCache } from './publish.js';
import { week } from './time.js';

const T = () => S.term.termId;
const now = () => Date.now();
// Every item write carries the server time; the rules require it and the item snapshot relies on it.
const touch = () => ({ touchedAt: serverTimestamp() });
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
    archived: false, isDeal: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdAt: now(), updatedAt: now(), ...data, ...touch(),
  };
  return run((b) => {
    b.set(ref, item);
    log(b, 'created', ref.id, `added "${item.title}"`);
    notify(b, item.assigneeUids, 'assigned', { id: ref.id }, `assigned you "${item.title}"`);
  }, `Added "${item.title}".`).then((ok) => ok && ref.id);
}

export function updateItem(it, patch, verb = 'updated') {
  const p = { ...patch, updatedAt: now(), ...touch() };
  if (patch.status && (patch.status === 'done') !== (it.status === 'done')) p.completedAt = patch.status === 'done' ? now() : null;
  const added = (patch.assigneeUids || []).filter((u) => !it.assigneeUids.includes(u));
  if (added.length) p.assignedAt = now();
  return run((b) => {
    b.update(doc(db, 'items', it.id), p);
    log(b, verb, it.id, `${verb} "${patch.title || it.title}"`);
    notify(b, added, 'assigned', it, `assigned you "${it.title}"`);
    if (patch.blockedOnUid && patch.blockedOnUid !== it.blockedOnUid) notify(b, [patch.blockedOnUid], 'blocked-on-you', it, `is blocked on you: "${it.title}"`);
  }).then((ok) => { if (ok && ('public' in patch || 'publicBlurb' in patch)) publish(); return ok; });
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
  if (ops.length > 20 && isAdmin()) refreshCache(true); // a bulk change would otherwise sit in every member's change listener
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
      patch: x.id === it.id ? { leadUid: leadUid || null, leadUids: fresh[x.id], updatedAt: now(), ...touch() } : { leadUids: fresh[x.id], ...touch() } });
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
      assignedAt: null, completedAt: null, archived: false, dealStage: 'Lead', pledgedIdr: 0, receivedIdr: 0, createdAt: now(), updatedAt: now(), ...fields, ...touch() } });
  }
  try { await commitChunked(ops); await run((b) => log(b, 'created', ids[nodes[0].key], `started "${nodes[0].title}" from a template`)); return ids[nodes[0].key]; }
  catch (e) { fail(e); return null; }
}

// Archives a subtree after a confirm naming its size; the toast offers to restore exactly those items.
export async function archiveItem(it) {
  const list = S.items.filter((x) => x.id === it.id || x.ancestors.includes(it.id));
  if (!confirm(`Archive "${it.title}"${list.length > 1 ? ` and the ${list.length - 1} items inside it` : ''}? It disappears from every screen.`)) return false;
  const flag = (archived) => commitChunked(list.map((x) => ({ ref: doc(db, 'items', x.id), depth: x.ancestors.length, parentId: x.parentId, patch: { archived, updatedAt: now(), ...touch() } })));
  try {
    await flag(true);
    await run((b) => log(b, 'archived', it.id, `archived "${it.title}"`));
    toast(`Archived "${it.title}".`, { label: 'Undo', fn: () => flag(false).then(() => run((b) => log(b, 'restored', it.id, `restored "${it.title}"`), 'Restored.')).catch(fail) });
    return true;
  } catch (e) { fail(e); return false; }
}

// A mention sends its own notification; mentioned people are left out of the general comment notice.
export function addComment(it, text, mentionUids = []) {
  return run((b) => {
    const c = newRef('comments');
    b.set(c, { termId: T(), itemId: it.id, authorUid: S.me.id, text, ...(mentionUids.length ? { mentionUids } : {}), createdAt: now() });
    log(b, 'comment', it.id, `commented on "${it.title}"`);
    notify(b, audience(it).filter((u) => !mentionUids.includes(u)), 'comment', it, `commented on "${it.title}": ${text.slice(0, 80)}`);
    notify(b, mentionUids, 'mention', it, `mentioned you on "${it.title}": ${text.slice(0, 80)}`);
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

// ---- Ideas: anyone but teachers pins one and votes; votes add or remove only yourself (the rules check it).
export const pinIdea = (text) => run((b) => {
  b.set(newRef('ideas'), { termId: T(), text, authorUid: S.me.id, voters: [S.me.id], archived: false, createdAt: now() });
  log(b, 'idea', null, `pinned an idea: "${text.slice(0, 60)}"`);
}, 'Idea pinned.');
export const toggleVote = (idea) =>
  updateDoc(doc(db, 'ideas', idea.id), { voters: idea.voters.includes(S.me.id) ? arrayRemove(S.me.id) : arrayUnion(S.me.id) }).catch(fail);
export const archiveIdea = (idea) =>
  updateDoc(doc(db, 'ideas', idea.id), { archived: true, updatedAt: now() }).then(() => toast('Idea archived.'), fail);

// ---- Events and RSVPs. Only admins may set public; the rules refuse it from anyone else.
export async function saveEvent(ev, data) {
  const body = { ...data, itemId: data.itemId || null, updatedAt: now() };
  try {
    if (ev) await updateDoc(doc(db, 'events', ev.id), body);
    else await setDoc(newRef('events'), { ...body, termId: T(), createdByUid: S.me.id, archived: false, createdAt: now() });
    toast(ev ? 'Event saved.' : `Added "${data.title}".`);
    return true;
  } catch (e) { fail(e); return false; }
}
export const archiveEvent = (ev) => updateDoc(doc(db, 'events', ev.id), { archived: true, updatedAt: now() }).then(() => { toast(`Archived "${ev.title}".`); return true; }, (e) => { fail(e); return false; });
export const rsvp = (ev, status) => setDoc(doc(db, 'rsvps', `${ev.id}_${S.me.id}`),
  { termId: T(), eventId: ev.id, uid: S.me.id, status, archived: false, createdAt: now(), updatedAt: now() }).catch(fail);

// ---- Resources: suggestions and the handover archive. Cross-term, so no termId.
export function submitResource({ type, name, url, note, targetId, projectId }) {
  return setDoc(newRef('submissions'), {
    type, name, url, note, byUid: S.me.id, status: type === 'archive' ? 'filed' : 'pending', archived: false, createdAt: now(),
    ...(targetId ? { targetId } : {}), ...(projectId ? { projectId } : {}),
  }).then(() => { toast(type === 'archive' ? 'Filed in the handover archive.' : 'Sent for approval.'); return true; }, (e) => { fail(e); return false; });
}

// ---- Admin: announcements, approvals, document templates (advisor, president and VP; the rules check it).
export async function saveAnnouncement(a, data) {
  try {
    if (a) await updateDoc(doc(db, 'announcements', a.id), { ...data, updatedAt: now() });
    else await setDoc(newRef('announcements'), { ...data, termId: T(), createdByUid: S.me.id, archived: false, createdAt: now() });
    toast(a ? 'Announcement saved.' : 'Announcement posted.');
    publish(); // an audience or date change reaches the public site now, not at the next 10-minute tick
    return true;
  } catch (e) { fail(e); return false; }
}
export const archiveAnnouncement = (a) => updateDoc(doc(db, 'announcements', a.id), { archived: true, updatedAt: now() }).then(() => { toast(`Archived "${a.title}".`); publish(); }, fail);

const KIND = [['document', 'Doc'], ['spreadsheets', 'Sheet'], ['presentation', 'Slides'], ['forms', 'Form'], ['drawings', 'Drawing'], ['folders', 'Folder']];
export const kindOf = (url) => KIND.find(([k]) => url.includes(`/${k}/`))?.[1] || 'File';

// Approving a new template creates it and approving an edit replaces the link and bumps the version, in one batch.
export function decide(sub, status) {
  return run((b) => {
    b.update(doc(db, 'submissions', sub.id), { status });
    if (status !== 'approved') return;
    if (sub.type === 'new-template') b.set(newRef('docTemplates'), { name: sub.name, kind: kindOf(sub.url), url: sub.url, version: 1, archived: false, createdAt: now() });
    if (sub.type === 'template-edit') {
      const t = S.docTemplates.find((x) => x.id === sub.targetId);
      if (!t) throw Object.assign(new Error('That template no longer exists'), { code: 'not-found' });
      if (t.url !== sub.url) b.update(doc(db, 'docTemplates', t.id), { url: sub.url, version: t.version + 1, updatedAt: now() });
    }
  }, status === 'approved' ? `Approved "${sub.name}".` : `Rejected "${sub.name}".`);
}
export const addTemplate = ({ name, url }) => setDoc(newRef('docTemplates'), { name, kind: kindOf(url), url, version: 1, archived: false, createdAt: now() })
  .then(() => { toast(`Added "${name}".`); return true; }, (e) => { fail(e); return false; });
export const archiveTemplate = (t) => updateDoc(doc(db, 'docTemplates', t.id), { archived: true, updatedAt: now() }).then(() => toast(`Archived "${t.name}".`), fail);
