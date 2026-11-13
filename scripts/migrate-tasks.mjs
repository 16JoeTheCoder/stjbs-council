// Copies open tasks from the old project tree (items) into the flat tasks collection (decision.md, "Migration").
// It signs in as the advisor, president or vice president, so firestore.rules check every write. Safe to run twice:
// each copy has the id item_<old id>, and existing copies are skipped. Nothing in items is changed.
//
// Production, VS Code terminal in the repo root (reads the Firebase config from .env.local):
//   COUNCIL_EMAIL=you@stjbs.sch.id COUNCIL_PASSWORD='your password' node scripts/migrate-tasks.mjs
// Emulator test first (with `npm run demo` running in another terminal):
//   node scripts/migrate-tasks.mjs --emulator
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';

const emulator = process.argv.includes('--emulator');
const env = {};
if (!emulator) {
  if (!existsSync('.env.local')) throw new Error('No .env.local in the repo root. Copy .env.example to .env.local and fill it in first.');
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
}
const app = initializeApp(emulator ? { apiKey: 'demo', projectId: 'demo-council', authDomain: 'demo-council.firebaseapp.com' }
  : { apiKey: env.VITE_FB_API_KEY, authDomain: env.VITE_FB_AUTH_DOMAIN, projectId: env.VITE_FB_PROJECT_ID, appId: env.VITE_FB_APP_ID });
const auth = getAuth(app), db = getFirestore(app);
if (emulator) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }

const email = process.env.COUNCIL_EMAIL || (emulator ? 'ariel@stjbs.sch.id' : '');
const password = process.env.COUNCIL_PASSWORD || (emulator ? 'council123' : '');
if (!email || !password) throw new Error('Set COUNCIL_EMAIL and COUNCIL_PASSWORD to the advisor, president or vice president account, then run again.');
await signInWithEmailAndPassword(auth, email, password);

const T = (await getDoc(doc(db, 'settings/current'))).data()?.termId;
if (!T) throw new Error('settings/current has no termId. Set the term first.');
const members = new Set((await getDocs(collection(db, 'members'))).docs.filter((d) => d.data().active).map((d) => d.id));
const old = (await getDocs(query(collection(db, 'items'), where('termId', '==', T), where('archived', '==', false)))).docs
  .map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.kind === 'task' && x.status !== 'done');
const have = new Set((await getDocs(query(collection(db, 'tasks'), where('termId', '==', T)))).docs.map((d) => d.id));

const now = Date.now();
let made = 0, skipped = 0, b = writeBatch(db), n = 0;
for (const x of old) {
  const id = `item_${x.id}`, owner = [...(x.assigneeUids || []), x.createdByUid].find((u) => members.has(u));
  if (have.has(id) || !owner) { skipped++; continue; }
  const blocked = x.blocked && (x.blockedReason || '').trim();
  b.set(doc(db, 'tasks', id), { termId: T, title: String(x.title).slice(0, 120), ownerUid: owner, assignerUid: members.has(x.createdByUid) ? x.createdByUid : owner,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(x.dueDate || '') ? x.dueDate : null, status: blocked ? 'blocked' : x.status === 'doing' ? 'doing' : 'todo',
    blockedReason: blocked ? x.blockedReason.trim().slice(0, 140) : '', waitingOnUid: blocked ? x.blockedOnUid || null : null, budgetId: null,
    assignedAt: x.assignedAt || x.createdAt || now, doneAt: null, createdAt: x.createdAt || now, updatedAt: now, legacyItemId: x.id });
  made++;
  if (++n === 400) { await b.commit(); b = writeBatch(db); n = 0; }
}
if (n) await b.commit();
console.log(`ok copied ${made} open tasks, skipped ${skipped} (already copied, or nobody active to own them). Old items are unchanged.`);
process.exit(0);
