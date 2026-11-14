// Writes for tasks, budgets, purchases and photos. Quick actions do not wait for the server: Firestore's local cache
// shows the change at once, the toast offers Undo, and a refused write rolls back with a plain sentence.
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, fail, toast } from './store.js';
import { batchName, batchOf } from './work-model.js';
import { fmtDay, idr } from './time.js';

const T = () => S.term.termId, now = () => Date.now(), TWO_WEEKS = 14 * 86400e3;
const newRef = (path) => doc(collection(db, path));
const first = (uid) => (S.members.find((m) => m.id === uid)?.name || 'Someone').split(' ')[0];
function note(b, to, text, link) {
  if (to && to !== S.me.id) b.set(newRef(`notifications/${to}/items`), { termId: T(), toUid: to, fromUid: S.me.id, type: 'work', text, link, read: false, createdAt: now() });
}
// Commit in the background; say what happened now.
function go(fn, msg, undo) {
  const b = writeBatch(db);
  fn(b);
  b.commit().catch(fail);
  toast(msg, undo ? { label: 'Undo', fn: undo } : null);
}
const patchTask = (b, t, patch) => b.update(doc(db, 'tasks', t.id), { ...patch, updatedAt: now() });

// ---- Tasks
export function addTask({ title, ownerUid = S.me.id, dueDate = null, dueTime = null, budgetId = null, priority = 4 }) {
  const ref = newRef('tasks');
  go((b) => {
    b.set(ref, { termId: T(), title: title.trim().slice(0, 120), ownerUid, assignerUid: S.me.id, dueDate, status: 'todo', blockedReason: '',
      waitingOnUid: null, budgetId, ...(priority < 4 ? { priority } : {}), ...(dueDate && dueTime ? { dueTime } : {}), assignedAt: now(), doneAt: null, createdAt: now(), updatedAt: now() });
    note(b, ownerUid, `gave you a task: "${title.trim().slice(0, 80)}"${dueDate ? `, due ${dueDate}` : ''}`, '#/tasks');
  }, ownerUid === S.me.id ? 'Task added.' : `Task given to ${first(ownerUid)}.`, () => deleteDoc(ref).catch(fail));
}
const state = (status, reason = '', waitingOnUid = null) => ({ status, blockedReason: status === 'blocked' ? reason.trim().slice(0, 140) : '',
  waitingOnUid: status === 'blocked' ? waitingOnUid : null, doneAt: status === 'done' ? now() : null });
// One tap: done, back to to-do, in progress, or blocked with a reason. Done tells the assigner; reopening tells the owner.
export function setStatus(t, status, reason, waitingOnUid) {
  const back = { status: t.status, blockedReason: t.blockedReason, waitingOnUid: t.waitingOnUid ?? null, doneAt: t.doneAt ?? null };
  go((b) => {
    patchTask(b, t, state(status, reason, waitingOnUid));
    if (status === 'done') note(b, t.assignerUid, `finished "${t.title.slice(0, 80)}"`, '#/tasks?v=given');
    if (t.status === 'done' && status !== 'done') note(b, t.ownerUid, `reopened "${t.title.slice(0, 80)}"`, '#/tasks');
    if (status === 'blocked') note(b, waitingOnUid, `is waiting on you for "${t.title.slice(0, 80)}": ${reason.trim().slice(0, 100)}`, '#/home');
  }, status === 'done' ? 'Done.' : t.status === 'done' ? 'Reopened.' : status === 'blocked' ? 'Marked blocked.' : 'Updated.',
  () => go((b) => patchTask(b, t, back), 'Put back.'));
}
// The assigner or an executive edits title, date, owner or budget. A new owner restarts the 48-hour clock.
export function editTask(t, patch, quiet = false) {
  const moved = patch.ownerUid && patch.ownerUid !== t.ownerUid;
  if (quiet) { const b = writeBatch(db); patchTask(b, t, patch); b.commit().catch(fail); return; }
  const back = Object.fromEntries(Object.keys(patch).map((k) => [k, t[k] ?? null]));
  const msg = moved ? `Given to ${first(patch.ownerUid)}.` : 'dueDate' in patch ? (patch.dueDate ? `Moved to ${fmtDay(patch.dueDate)}.` : 'Date removed.') : 'Saved.';
  go((b) => {
    patchTask(b, t, { ...patch, ...(moved ? { assignerUid: S.me.id, assignedAt: now() } : {}) });
    if (moved) note(b, patch.ownerUid, `gave you a task: "${t.title.slice(0, 80)}"`, '#/tasks');
  }, msg, moved ? null : () => editTask(t, back, true));
}
export function removeTask(t) {
  if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return false;
  deleteDoc(doc(db, 'tasks', t.id)).catch(fail);
  toast('Task deleted.');
  return true;
}

// ---- Budgets (treasurers and admins)
export function saveBudget(old, { name, amountIdr, active = true }) {
  const ref = old ? doc(db, 'budgets', old.id) : newRef('budgets');
  go((b) => (old ? b.update(ref, { name, amountIdr, active, updatedAt: now() })
    : b.set(ref, { termId: T(), name, amountIdr, active, createdByUid: S.me.id, createdAt: now(), updatedAt: now() })), old ? 'Budget saved.' : `Budget "${name}" added.`);
}

// ---- Photos: shrunk in the browser and stored one per document, so the free plan needs no Cloud Storage.
const MAX_CHARS = 300000;
export async function shrink(file) {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let side = 1280, q = 0.7;
  for (;;) {
    const k = Math.min(1, side / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', q).split(',')[1];
    if (data.length <= MAX_CHARS || side < 400) return data;
    if (q > 0.45) q -= 0.15; else { side *= 0.75; q = 0.6; }
  }
}
export const photoSrc = (data) => `data:image/jpeg;base64,${data}`;
const cache = new Map();
export async function getPhoto(id) {
  if (!cache.has(id)) cache.set(id, (await getDoc(doc(db, 'photos', id))).data()?.data || null);
  return cache.get(id);
}
const putPhoto = (b, purchaseId, kind, data) => {
  const ref = newRef('photos');
  b.set(ref, { termId: T(), ownerUid: S.me.id, purchaseId, kind, data, createdAt: now(), deleteAfter: null });
  cache.set(ref.id, data);
  return ref.id;
};
const photoIds = (p) => [...(p.photoIds || []), p.receiptPhotoId].filter(Boolean);
const expire = (b, p, at) => photoIds(p).forEach((id) => b.update(doc(db, 'photos', id), { deleteAfter: at }));
// Once a day per device: delete photos whose two weeks are up. Runs for any member; the rules check the date.
export async function sweepPhotos() {
  try {
    const day = new Date().toDateString();
    if (localStorage.getItem('council-photo-sweep') === day) return;
    localStorage.setItem('council-photo-sweep', day);
    const old = await getDocs(query(collection(db, 'photos'), where('deleteAfter', '<=', now()), limit(20)));
    await Promise.all(old.docs.map((d) => deleteDoc(d.ref)));
  } catch { /* the next visit tries again */ }
}

// ---- Purchases. Photo uploads wait for the server, so the form can say plainly if one did not arrive.
async function send(fn, msg) {
  const b = writeBatch(db);
  try { fn(b); await b.commit(); toast(msg); return true; } catch (e) { fail(e); return false; }
}
export function requestPurchase({ budgetId, item, specs, qty, unitIdr, totalIdr }, photos) {
  const ref = newRef('purchases');
  return send((b) => {
    const ids = photos.map((data) => putPhoto(b, ref.id, 'item', data));
    b.set(ref, { termId: T(), budgetId, requesterUid: S.me.id, item: item.trim().slice(0, 80), specs: (specs || '').trim().slice(0, 300),
      qty, unitIdr, totalIdr, photoIds: ids, status: 'pending', createdAt: now(), updatedAt: now() });
    for (const m of S.members.filter((x) => x.active && x.role === 'treasurer')) note(b, m.id, `asks to buy "${item.trim().slice(0, 60)}" for ${idr(totalIdr)}`, '#/budgets');
  }, 'Sent to the treasurers.');
}
const patchBuy = (b, p, patch) => b.update(doc(db, 'purchases', p.id), { ...patch, updatedAt: now() });
// Approve or reject. Undo puts it back to pending.
export function decide(p, status) {
  go((b) => {
    patchBuy(b, p, { status, approverUid: S.me.id, decidedAt: now() });
    if (status === 'rejected') expire(b, p, now() + TWO_WEEKS);
    note(b, p.requesterUid, status === 'approved' ? `approved "${p.item}". Buy it, then add the receipt.` : `rejected "${p.item}"`, '#/home');
  }, status === 'approved' ? `Approved. ${first(p.requesterUid)} is told to buy.` : 'Rejected.',
  () => go((b) => { patchBuy(b, p, { status: 'pending', approverUid: null, decidedAt: null }); if (status === 'rejected') expire(b, p, null); }, 'Back to pending.'));
}
export function addReceipt(p, { paidIdr, changeNote, photo }) {
  return send((b) => {
    const id = putPhoto(b, p.id, 'receipt', photo), batchId = batchOf();
    patchBuy(b, p, { status: 'bought', paidIdr, changeNote: (changeNote || '').trim().slice(0, 140), receiptPhotoId: id, batchId, boughtAt: now() });
  }, `Receipt saved. You are paid back in batch ${batchName(batchOf())}.`);
}
export function payBatch(batch) {
  const set = (status, at) => (b) => batch.items.forEach((p) => {
    patchBuy(b, p, { status, paidByUid: status === 'paid' ? S.me.id : null, paidAt: status === 'paid' ? now() : null });
    expire(b, p, at);
    if (status === 'paid') note(b, p.requesterUid, `paid you back ${idr(p.paidIdr)} for "${p.item}"`, '#/budgets');
  });
  go(set('paid', now() + TWO_WEEKS), `Batch ${batchName(batch.id)} marked paid.`, () => go(set('bought', null), 'Batch reopened.'));
}
// The Teacher's veto: any stage, a reason is required, and it stays on the record.
export function veto(p, reason) {
  return send((b) => {
    patchBuy(b, p, { status: 'vetoed', vetoReason: reason.trim().slice(0, 300), vetoUid: S.me.id, vetoAt: now() });
    if (!['paid', 'rejected'].includes(p.status)) expire(b, p, now() + TWO_WEEKS); // those photos already have a date, and may be gone
    note(b, p.requesterUid, `vetoed "${p.item}": ${reason.trim().slice(0, 120)}`, '#/budgets');
  }, 'Vetoed.');
}
export function cancelPurchase(p) {
  if (!confirm(`Delete your request for "${p.item}"?`)) return Promise.resolve(false);
  return send((b) => { b.delete(doc(db, 'purchases', p.id)); photoIds(p).forEach((id) => b.delete(doc(db, 'photos', id))); }, 'Request deleted.');
}
