// Firestore rules tests for tasks, budgets, purchases and photos. Run: npm run test:rules (VS Code terminal, repo root).
// Document shapes match src/work-actions.js exactly. Needs Java 11+ and the Firestore emulator.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const T = '2026-27';
let env;
const P = {
  advisor: 'advisor@stjbs.sch.id', president: 'pres@stjbs.sch.id', treasA: 'tresa@stjbs.sch.id', treasB: 'tresb@stjbs.sch.id',
  officer: 'off@stjbs.sch.id', memE: 'meme@stjbs.sch.id', memS: 'mems@stjbs.sch.id', teacher: 'teach@stjbs.sch.id',
};
const as = (email) => env.authenticatedContext(email.split('@')[0], { email, email_verified: true }).firestore();
const now = () => Date.now();

const task = (o) => ({
  termId: T, title: 'Do it', ownerUid: P.memE, assignerUid: P.officer, dueDate: '2026-12-01', status: 'todo', blockedReason: '',
  waitingOnUid: null, budgetId: null, assignedAt: 1, doneAt: null, createdAt: 1, updatedAt: 1, ...o,
});
const budget = (o) => ({ termId: T, name: 'Carnival', amountIdr: 5000000, active: true, createdByUid: P.treasA, createdAt: 1, updatedAt: 1, ...o });
const purchase = (o) => ({
  termId: T, budgetId: 'b1', requesterUid: P.memE, item: 'Paint', specs: 'red', qty: 2, unitIdr: 50000, totalIdr: 100000,
  photoIds: ['ph-item'], status: 'pending', createdAt: 1, updatedAt: 1, ...o,
});
const photo = (o) => ({ termId: T, ownerUid: P.memE, purchaseId: 'pu', kind: 'item', data: 'abc', createdAt: 1, deleteAfter: null, ...o });
// What a purchase looks like after each stage, as the app writes it.
const approved = { status: 'approved', approverUid: P.treasB, decidedAt: 2 };
const bought = { ...approved, status: 'bought', paidIdr: 95000, changeNote: '', receiptPhotoId: 'ph-rc', batchId: '2026-11-1', boughtAt: 3 };
const paid = { ...bought, status: 'paid', paidByUid: P.treasB, paidAt: 4 };

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'settings/current'), { termId: T, termName: T });
    const m = (email, role, o = {}) => setDoc(doc(db, 'members', email), { name: role, role, active: true, termId: T, section: '', reportsTo: null, ...o });
    await m(P.advisor, 'advisor');
    await m(P.president, 'president');
    await m(P.treasA, 'treasurer');
    await m(P.treasB, 'treasurer');
    await m(P.officer, 'officer', { departmentId: 'events' });
    await m(P.memE, 'member', { departmentId: 'events' });
    await m(P.memS, 'member', { departmentId: 'sports' });
    await m(P.teacher, 'teacher');
    await setDoc(doc(db, 'budgets/b1'), budget({}));
    await setDoc(doc(db, 'budgets/b2'), budget({ name: 'Closed', active: false }));
    await setDoc(doc(db, 'checkins/x'), { termId: T, note: 'old' });
  });
}
const admin = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
// Seed a purchase (id 'pu') with its item photo, in the given state; the receipt photo too once bought.
const seedPurchase = (o = {}, extraPhotos = true) => admin(async (db) => {
  await setDoc(doc(db, 'purchases/pu'), purchase(o));
  await setDoc(doc(db, 'photos/ph-item'), photo({}));
  if (extraPhotos && ['bought', 'paid', 'vetoed'].includes(o.status) && o.receiptPhotoId) await setDoc(doc(db, 'photos/ph-rc'), photo({ kind: 'receipt' }));
});
const reseed = async (fn) => { await seed(); if (fn) await fn(); };

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-council-work', firestore: { rules: readFileSync(process.env.FIRESTORE_RULES_FILE || 'firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(seed);

const create = (who, id, data) => setDoc(doc(as(who), 'tasks', id), data);
const patch = (who, coll, id, data) => updateDoc(doc(as(who), coll, id), data);

// ---- Tasks
test('tasks create: who may give a task to whom, and the shape of the document', async () => {
  await assertSucceeds(create(P.memE, 'n1', task({ ownerUid: P.memE, assignerUid: P.memE })));
  await assertFails(create(P.memE, 'n2', task({ ownerUid: P.memS, assignerUid: P.memE })));
  await assertSucceeds(create(P.officer, 'n3', task({ ownerUid: P.memE, assignerUid: P.officer })));
  await assertFails(create(P.officer, 'n4', task({ ownerUid: P.memS, assignerUid: P.officer })));
  await assertSucceeds(create(P.president, 'n5', task({ ownerUid: P.memS, assignerUid: P.president })));
  await assertFails(create(P.teacher, 'n6', task({ ownerUid: P.teacher, assignerUid: P.teacher })));
  await assertFails(create(P.president, 'n7', task({ ownerUid: P.memS, assignerUid: P.memE })));
  await assertFails(create(P.memE, 'n8', task({ ownerUid: P.memE, assignerUid: P.memE, status: 'blocked', blockedReason: '' })));
  await assertSucceeds(create(P.memE, 'n8b', task({ ownerUid: P.memE, assignerUid: P.memE, status: 'blocked', blockedReason: 'Need paint' })));
  await assertFails(create(P.memE, 'n9', task({ ownerUid: P.memE, assignerUid: P.memE, status: 'doing', blockedReason: 'because' })));
  await assertFails(create(P.memE, 'n10', task({ ownerUid: P.memE, assignerUid: P.memE, surprise: 1 })));
  await assertFails(create(P.memE, 'n11', task({ ownerUid: P.memE, assignerUid: P.memE, title: '' })));
  await assertFails(create(P.memE, 'n12', task({ ownerUid: P.memE, assignerUid: P.memE, title: 'x'.repeat(121) })));
  await assertSucceeds(create(P.memE, 'n13', task({ ownerUid: P.memE, assignerUid: P.memE, title: 'x'.repeat(120) })));
});

test('tasks update: the owner moves status only; the assigner edits the rest; reassigning follows the same limits', async () => {
  const seedTasks = () => admin(async (db) => {
    await setDoc(doc(db, 'tasks/tk'), task({}));                                  // memE owns, officer assigned
    await setDoc(doc(db, 'tasks/tkS'), task({ ownerUid: P.memS }));               // memS owns, officer assigned
    await setDoc(doc(db, 'tasks/tkP'), task({ status: 'done', doneAt: 5, assignerUid: P.president }));
  });
  await reseed(seedTasks);
  await assertSucceeds(patch(P.memE, 'tasks', 'tk', { status: 'done', doneAt: now(), updatedAt: now() }));
  await reseed(seedTasks);
  await assertFails(patch(P.memE, 'tasks', 'tk', { title: 'New title', updatedAt: now() }));
  await assertFails(patch(P.memE, 'tasks', 'tk', { dueDate: '2026-12-25', updatedAt: now() }));
  await assertSucceeds(patch(P.memE, 'tasks', 'tk', { status: 'blocked', blockedReason: 'Waiting for paint', waitingOnUid: P.treasA, updatedAt: now() }));
  await reseed(seedTasks);
  await assertSucceeds(patch(P.officer, 'tasks', 'tk', { title: 'Better title', dueDate: '2026-12-10', updatedAt: now() }));
  // The officer reassigns across departments (fail), and within the department with assignerUid = me (ok).
  await assertFails(patch(P.officer, 'tasks', 'tk', { ownerUid: P.memS, assignerUid: P.officer, assignedAt: now(), updatedAt: now() }));
  await assertSucceeds(patch(P.officer, 'tasks', 'tkS', { ownerUid: P.memE, assignerUid: P.officer, assignedAt: now(), updatedAt: now() }));
  await reseed(seedTasks);
  await assertSucceeds(patch(P.president, 'tasks', 'tkP', { status: 'todo', doneAt: null, updatedAt: now() }));
  await assertSucceeds(patch(P.president, 'tasks', 'tk', { status: 'todo', doneAt: null, updatedAt: now() }));
  await reseed(seedTasks);
  await assertFails(patch(P.memS, 'tasks', 'tk', { status: 'done', doneAt: now(), updatedAt: now() }));
  await assertFails(patch(P.memS, 'tasks', 'tk', { title: 'Hijack', updatedAt: now() }));
  await assertFails(patch(P.teacher, 'tasks', 'tk', { title: 'Hijack', updatedAt: now() }));
  await assertFails(patch(P.officer, 'tasks', 'tk', { createdAt: 99, updatedAt: now() }));
  await assertFails(patch(P.president, 'tasks', 'tk', { createdAt: 99, updatedAt: now() }));
  await assertFails(patch(P.memE, 'tasks', 'tk', { createdAt: 99, updatedAt: now() }));
});

test('tasks delete: the assigner or an executive; not the owner, not the teacher', async () => {
  const seedTasks = () => admin(async (db) => { await setDoc(doc(db, 'tasks/tk'), task({})); });
  await reseed(seedTasks);
  await assertSucceeds(deleteDoc(doc(as(P.officer), 'tasks/tk')));
  await reseed(seedTasks);
  await assertSucceeds(deleteDoc(doc(as(P.president), 'tasks/tk')));
  await reseed(seedTasks);
  await assertFails(deleteDoc(doc(as(P.memE), 'tasks/tk')));
  await assertFails(deleteDoc(doc(as(P.teacher), 'tasks/tk')));
  await assertFails(deleteDoc(doc(as(P.memS), 'tasks/tk')));
});

// ---- Budgets
test('budgets: treasurers and executives create and edit; members cannot; nobody deletes', async () => {
  const bud = doc(as(P.treasA), 'budgets/new1');
  await assertSucceeds(setDoc(bud, budget({ createdByUid: P.treasA })));
  await assertSucceeds(setDoc(doc(as(P.president), 'budgets/new2'), budget({ createdByUid: P.president })));
  await assertFails(setDoc(doc(as(P.memE), 'budgets/new3'), budget({ createdByUid: P.memE })));
  await assertFails(setDoc(doc(as(P.treasA), 'budgets/new4'), budget({ createdByUid: P.treasA, amountIdr: -1 })));
  await assertFails(setDoc(doc(as(P.treasA), 'budgets/new5'), budget({ createdByUid: P.memE })));
  await assertSucceeds(patch(P.treasB, 'budgets', 'b1', { amountIdr: 6000000, active: false, updatedAt: now() }));
  await assertSucceeds(patch(P.treasA, 'budgets', 'b2', { active: true, updatedAt: now() }));
  await assertFails(patch(P.treasA, 'budgets', 'b1', { amountIdr: -5, updatedAt: now() }));
  await assertFails(patch(P.memE, 'budgets', 'b1', { amountIdr: 1, updatedAt: now() }));
  for (const who of [P.treasA, P.president, P.advisor, P.memE, P.teacher]) await assertFails(deleteDoc(doc(as(who), 'budgets/b1')));
});

// ---- Purchases
// requestPurchase: the photo documents and the purchase go in one batch.
function requestBatch(who, { id = 'newpu', budgetId = 'b1', photos = 1, purchaseOver = {}, photoOver = {} } = {}) {
  const db = as(who), b = writeBatch(db), ids = [];
  for (let i = 0; i < photos; i++) {
    ids.push(`ph${i}`);
    b.set(doc(db, 'photos', `ph${i}`), photo({ ownerUid: who, purchaseId: id, ...photoOver }));
  }
  b.set(doc(db, 'purchases', id), purchase({ budgetId, requesterUid: who, photoIds: ids, ...purchaseOver }));
  return b.commit();
}

test('purchases create: needs an item photo in the same batch, an open budget, and my own pending request', async () => {
  await assertSucceeds(requestBatch(P.memE));
  await seed();
  await assertSucceeds(requestBatch(P.memE, { photos: 3 }));
  await seed();
  await assertFails(setDoc(doc(as(P.memE), 'purchases/lonely'), purchase({ photoIds: ['ghost'] })));
  await assertFails(requestBatch(P.memE, { photos: 0, purchaseOver: { photoIds: [] } }));
  await assertFails(requestBatch(P.memE, { budgetId: 'b2' }));
  await assertFails(requestBatch(P.memE, { purchaseOver: { requesterUid: P.memS } }));
  await assertFails(requestBatch(P.memE, { purchaseOver: { status: 'approved' } }));
  await assertFails(requestBatch(P.teacher, {}));
  await assertFails(requestBatch(P.memE, { photoOver: { purchaseId: 'someother' } }));
});

test('purchases approval: a treasurer decides someone else\'s request, never their own', async () => {
  const dec = { status: 'approved', approverUid: P.treasB, decidedAt: now(), updatedAt: now() };
  await reseed(() => seedPurchase({ requesterUid: P.treasA }));
  await assertSucceeds(patch(P.treasB, 'purchases', 'pu', dec));
  await reseed(() => seedPurchase({ requesterUid: P.treasA }));
  await assertFails(patch(P.treasA, 'purchases', 'pu', { ...dec, approverUid: P.treasA })); // the important one
  await reseed(() => seedPurchase({}));
  await assertSucceeds(patch(P.treasA, 'purchases', 'pu', { ...dec, approverUid: P.treasA }));
  await reseed(() => seedPurchase({}));
  for (const who of [P.memS, P.president, P.advisor, P.officer, P.teacher]) await assertFails(patch(who, 'purchases', 'pu', { ...dec, approverUid: who }));
  await assertFails(patch(P.treasB, 'purchases', 'pu', { ...dec, approverUid: P.treasA })); // approver must be me
  await assertFails(patch(P.memE, 'purchases', 'pu', { ...dec, approverUid: P.memE })); // not even the requester
  // Undo: the approver takes it back to pending.
  await reseed(() => seedPurchase(approved));
  await assertSucceeds(patch(P.treasB, 'purchases', 'pu', { status: 'pending', approverUid: null, decidedAt: null, updatedAt: now() }));
  // Another treasurer cannot undo it.
  await reseed(() => seedPurchase(approved));
  await assertFails(patch(P.treasA, 'purchases', 'pu', { status: 'pending', approverUid: null, decidedAt: null, updatedAt: now() }));
  // Approving an already approved request.
  await assertFails(patch(P.treasA, 'purchases', 'pu', { ...dec, approverUid: P.treasA }));
  await assertFails(patch(P.treasB, 'purchases', 'pu', dec));
  // Changing the total while approving.
  await reseed(() => seedPurchase({}));
  await assertFails(patch(P.treasB, 'purchases', 'pu', { ...dec, totalIdr: 1 }));
  await assertFails(patch(P.treasB, 'purchases', 'pu', { ...dec, totalIdr: 999999 }));
});

// addReceipt: the receipt photo and the purchase update in one batch.
function receiptBatch(who, { withPhoto = true, over = {}, photoOver = {} } = {}) {
  const db = as(who), b = writeBatch(db);
  if (withPhoto) b.set(doc(db, 'photos', 'ph-rc'), photo({ ownerUid: who, purchaseId: 'pu', kind: 'receipt', ...photoOver }));
  b.update(doc(db, 'purchases', 'pu'), { status: 'bought', paidIdr: 95000, changeNote: '', receiptPhotoId: 'ph-rc', batchId: '2026-11-1', boughtAt: now(), updatedAt: now(), ...over });
  return b.commit();
}

test('purchases bought: only the requester, from approved, with a receipt photo and a real batch', async () => {
  await reseed(() => seedPurchase(approved));
  await assertSucceeds(receiptBatch(P.memE));
  await reseed(() => seedPurchase(approved));
  await assertSucceeds(receiptBatch(P.memE, { over: { batchId: '2026-11-2', changeNote: 'Cheaper' } }));
  await reseed(() => seedPurchase(approved));
  await assertFails(receiptBatch(P.memE, { withPhoto: false }));
  await assertFails(receiptBatch(P.memE, { photoOver: { purchaseId: 'other' } }));
  await assertFails(receiptBatch(P.memS));
  await assertFails(receiptBatch(P.treasA));
  await assertFails(receiptBatch(P.memE, { over: { batchId: '2026-11-3' } }));
  await assertFails(receiptBatch(P.memE, { over: { batchId: 'nov-1' } }));
  await assertFails(receiptBatch(P.memE, { over: { paidIdr: -1 } }));
  await assertFails(receiptBatch(P.memE, { over: { totalIdr: 1 } }));
  await reseed(() => seedPurchase({}));
  await assertFails(receiptBatch(P.memE)); // still pending
});

test('purchases paid: a treasurer closes and reopens a batch; nobody else; not straight from pending', async () => {
  const pay = { status: 'paid', paidByUid: P.treasB, paidAt: now(), updatedAt: now() };
  await reseed(() => seedPurchase(bought));
  await assertSucceeds(patch(P.treasB, 'purchases', 'pu', pay));
  await reseed(() => seedPurchase(bought));
  await assertFails(patch(P.memE, 'purchases', 'pu', { ...pay, paidByUid: P.memE }));
  await assertFails(patch(P.president, 'purchases', 'pu', { ...pay, paidByUid: P.president }));
  await assertFails(patch(P.treasA, 'purchases', 'pu', pay)); // paidByUid must be me
  await reseed(() => seedPurchase(paid));
  await assertSucceeds(patch(P.treasA, 'purchases', 'pu', { status: 'bought', paidByUid: null, paidAt: null, updatedAt: now() }));
  await reseed(() => seedPurchase(paid));
  await assertFails(patch(P.memE, 'purchases', 'pu', { status: 'bought', paidByUid: null, paidAt: null, updatedAt: now() }));
  await reseed(() => seedPurchase({}));
  await assertFails(patch(P.treasB, 'purchases', 'pu', pay));
  await reseed(() => seedPurchase(approved));
  await assertFails(patch(P.treasB, 'purchases', 'pu', pay));
});

test('purchases veto: only the advisor, at any stage, with a reason; never twice', async () => {
  const veto = (over = {}) => ({ status: 'vetoed', vetoReason: 'Too expensive', vetoUid: P.advisor, vetoAt: now(), updatedAt: now(), ...over });
  const stages = { pending: {}, approved, bought, paid };
  for (const [name, o] of Object.entries(stages)) {
    await reseed(() => seedPurchase(o));
    await assertSucceeds(patch(P.advisor, 'purchases', 'pu', veto()).catch((e) => { e.message = `${name}: ${e.message}`; throw e; }));
  }
  await reseed(() => seedPurchase({}));
  await assertFails(patch(P.advisor, 'purchases', 'pu', veto({ vetoReason: '' })));
  await assertFails(patch(P.advisor, 'purchases', 'pu', (({ vetoReason, ...rest }) => rest)(veto())));
  await assertFails(patch(P.advisor, 'purchases', 'pu', veto({ vetoReason: 'x'.repeat(301) })));
  await assertFails(patch(P.advisor, 'purchases', 'pu', veto({ vetoUid: P.president })));
  await assertFails(patch(P.president, 'purchases', 'pu', veto({ vetoUid: P.president })));
  await assertFails(patch(P.treasA, 'purchases', 'pu', veto({ vetoUid: P.treasA })));
  await assertFails(patch(P.memE, 'purchases', 'pu', veto({ vetoUid: P.memE })));
  await reseed(() => seedPurchase({ status: 'vetoed', vetoReason: 'No', vetoUid: P.advisor, vetoAt: 5 }));
  await assertFails(patch(P.advisor, 'purchases', 'pu', veto()));
});

test('purchases delete: only the requester, only while pending', async () => {
  await reseed(() => seedPurchase({}));
  await assertSucceeds(deleteDoc(doc(as(P.memE), 'purchases/pu')));
  await reseed(() => seedPurchase({}));
  await assertFails(deleteDoc(doc(as(P.memS), 'purchases/pu')));
  await assertFails(deleteDoc(doc(as(P.president), 'purchases/pu')));
  await assertFails(deleteDoc(doc(as(P.treasA), 'purchases/pu')));
  await reseed(() => seedPurchase(approved));
  await assertFails(deleteDoc(doc(as(P.memE), 'purchases/pu')));
  await reseed(() => seedPurchase(bought));
  await assertFails(deleteDoc(doc(as(P.memE), 'purchases/pu')));
});

// ---- Photos
test('photos create: size cap, my own uid, deleteAfter starts empty', async () => {
  const mk = (who, id, o) => setDoc(doc(as(who), 'photos', id), photo({ ownerUid: who, ...o }));
  await assertSucceeds(mk(P.memE, 'p1', {}));
  await assertSucceeds(mk(P.memE, 'p2', { data: 'x'.repeat(900000) }));
  await assertFails(mk(P.memE, 'p3', { data: 'x'.repeat(900001) }));
  await assertFails(mk(P.memE, 'p4', { ownerUid: P.memS }));
  await assertFails(mk(P.memE, 'p5', { deleteAfter: now() }));
  await assertFails(mk(P.memE, 'p6', { kind: 'selfie' }));
  await assertFails(mk(P.teacher, 'p7', {}));
});

test('photos update: only a treasurer or the advisor set deleteAfter, and nothing else', async () => {
  const seedPh = () => admin(async (db) => { await setDoc(doc(db, 'photos/ph'), photo({})); });
  await reseed(seedPh);
  for (const who of [P.treasA, P.advisor]) {
    await assertSucceeds(patch(who, 'photos', 'ph', { deleteAfter: now() + 1e9 }));
    await assertSucceeds(patch(who, 'photos', 'ph', { deleteAfter: null }));
  }
  await assertFails(patch(P.memE, 'photos', 'ph', { deleteAfter: now() + 1e9 }));
  await assertFails(patch(P.president, 'photos', 'ph', { deleteAfter: now() + 1e9 }));
  await assertFails(patch(P.treasA, 'photos', 'ph', { data: 'changed' }));
  await assertFails(patch(P.treasA, 'photos', 'ph', { deleteAfter: 'soon' }));
  await assertFails(patch(P.advisor, 'photos', 'ph', { data: 'changed', deleteAfter: now() + 1e9 }));
});

test('photos delete: after deleteAfter any member; an owner may clear an orphan; otherwise no', async () => {
  const seedPh = (over = {}, purchaseExists = true) => async () => admin(async (db) => {
    await setDoc(doc(db, 'photos/ph'), photo({ purchaseId: 'pu', ...over }));
    if (purchaseExists) await setDoc(doc(db, 'purchases/pu'), purchase({}));
  });
  const del = (who) => deleteDoc(doc(as(who), 'photos/ph'));
  // No deleteAfter, purchase exists: nobody, owner included.
  await reseed(seedPh());
  await assertFails(del(P.memE));
  await assertFails(del(P.memS));
  await assertFails(del(P.treasA));
  await assertFails(del(P.advisor));
  // deleteAfter in the future.
  await reseed(seedPh({ deleteAfter: now() + 3600e3 }));
  await assertFails(del(P.memS));
  await assertFails(del(P.memE));
  // deleteAfter has passed: any member.
  await reseed(seedPh({ deleteAfter: now() - 3600e3 }));
  await assertSucceeds(del(P.memS));
  await reseed(seedPh({ deleteAfter: now() - 3600e3 }));
  await assertSucceeds(del(P.president));
  // Orphan: the purchase is gone, so the owner may delete it, but nobody else without a date.
  await reseed(seedPh({}, false));
  await assertFails(del(P.memS));
  await assertSucceeds(del(P.memE));
});

// ---- Task priority, dueTime, order; member aliases
test('tasks: priority, dueTime and order fields', async () => {
  for (const [i, o] of [[1, { priority: 1 }], [2, { priority: 4 }], [3, { dueTime: '15:00' }], [4, { dueTime: null }], [5, { order: 3.5 }], [6, { priority: 2, dueTime: '09:30', order: 0 }]])
    await assertSucceeds(create(P.memE, `f${i}`, task({ ownerUid: P.memE, assignerUid: P.memE, ...o })));
  for (const [i, o] of [[1, { priority: 5 }], [2, { priority: 0 }], [3, { priority: '1' }], [4, { dueTime: '25:99' }], [5, { dueTime: '9:00' }], [6, { dueTime: 900 }], [7, { order: '1' }]])
    await assertFails(create(P.memE, `x${i}`, task({ ownerUid: P.memE, assignerUid: P.memE, ...o })));
});

test('tasks update: owner may change order, not dueDate; assigner may change priority and dueTime', async () => {
  await admin((db) => setDoc(doc(db, 'tasks/t1'), task({ order: 1 })));        // owner memE, assigner officer
  await assertSucceeds(patch(P.memE, 'tasks', 't1', { order: 2.5, updatedAt: 5 }));
  await assertFails(patch(P.memE, 'tasks', 't1', { dueDate: '2026-12-09', updatedAt: 5 }));
  await assertFails(patch(P.memE, 'tasks', 't1', { priority: 1, updatedAt: 5 }));
  await assertFails(patch(P.memE, 'tasks', 't1', { dueTime: '10:00', updatedAt: 5 }));
  await assertFails(patch(P.memE, 'tasks', 't1', { order: 'x', updatedAt: 5 }));
  await assertFails(patch(P.memS, 'tasks', 't1', { order: 2, updatedAt: 5 }));
  await assertSucceeds(patch(P.officer, 'tasks', 't1', { priority: 2, dueTime: '14:15', dueDate: '2026-12-09', updatedAt: 5 }));
  await assertFails(patch(P.officer, 'tasks', 't1', { priority: 5, updatedAt: 6 }));
  await assertFails(patch(P.officer, 'tasks', 't1', { dueTime: '25:99', updatedAt: 6 }));
});

test('members: aliases list of at most 5', async () => {
  await assertSucceeds(patch(P.advisor, 'members', P.memE, { aliases: ['Mike'] }));
  await assertSucceeds(patch(P.advisor, 'members', P.memE, { aliases: ['a', 'b', 'c', 'd', 'e'] }));
  await assertSucceeds(patch(P.advisor, 'members', P.memE, { aliases: [] }));
  await assertFails(patch(P.advisor, 'members', P.memE, { aliases: ['a', 'b', 'c', 'd', 'e', 'f'] }));
  await assertFails(patch(P.advisor, 'members', P.memE, { aliases: 'Mike' }));
  await assertSucceeds(patch(P.president, 'members', P.memE, { aliases: ['Mike'] }));
  await assertFails(patch(P.memE, 'members', P.memS, { aliases: ['x'] }));
});

// ---- Check-ins
test('checkins: readable by members, never writable', async () => {
  const db = as(P.memE);
  await assertSucceeds(getDoc(doc(db, 'checkins/x')));
  await assertFails(setDoc(doc(db, 'checkins/x'), { termId: T, note: 'new' }));
  await assertFails(setDoc(doc(db, 'checkins/y'), { termId: T, note: 'new' }));
  await assertFails(updateDoc(doc(db, 'checkins/x'), { note: 'edit' }));
  await assertFails(deleteDoc(doc(db, 'checkins/x')));
  await assertFails(setDoc(doc(as(P.president), 'checkins/z'), { termId: T }));
  await assertFails(setDoc(doc(as(P.advisor), 'checkins/z'), { termId: T }));
});
