// One-step migration to departments and positions. Applies directly; no dry run (Josef's decision, see decision.md).
// It signs in as the advisor or the vice president with email and password, so firestore.rules check every write like any app session.
// A vice president cannot edit the advisor's record (the rules forbid it), so that one record is skipped and reported.
//
// Production, VS Code terminal in the repo root (reads the Firebase config from .env.local):
//   COUNCIL_EMAIL=you@stjbs.sch.id COUNCIL_PASSWORD='your password' node scripts/migrate-departments.mjs
// Emulator test first (with `npm run demo` running in another terminal):
//   node scripts/migrate-departments.mjs --emulator
//
// What it does, in order:
// 1. Saves every member document to backups/members-<time>.json on this computer (the undo).
// 2. Creates six standing departments named "Department 1" to "Department 6" if the term has none. Rename them in the app.
// 3. For every member: section mapped to the fixed year-level list ("sec3" becomes "Sec 3") or cleared; department,
//    position and reportsTo rewritten from department data. Outside a department: position "member" for students and none
//    for the advisor, the board and teachers; the board reports to the president, the president to the advisor.
// The signed-in person's own position is left alone: nobody may change their own position.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { BOARD_ORDER, deptMembers, positionIn, reportsToIn, yearLevel } from '../src/org-model.js';

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
if (!email || !password) throw new Error('Set COUNCIL_EMAIL and COUNCIL_PASSWORD to the advisor account, then run again.');
await signInWithEmailAndPassword(auth, email, password);
const me = email.toLowerCase();

const term = (await getDoc(doc(db, 'settings/current'))).data();
if (!term?.termId) throw new Error('settings/current has no termId. Set the term first.');
const T = term.termId, now = Date.now();
const members = (await getDocs(collection(db, 'members'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const myRole = (members.find((m) => m.id === me) || {}).role;
if (!['advisor', 'vp'].includes(myRole)) throw new Error(`${me} is not the advisor or the vice president. Sign in with one of those accounts.`);

// 1. Backup
mkdirSync('backups', { recursive: true });
const file = `backups/members-${new Date(now).toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(members, null, 1));
console.log(`saved ${members.length} members to ${file}`);

// 2. Departments
const existing = (await getDocs(query(collection(db, 'departments'), where('termId', '==', T)))).docs;
let b = writeBatch(db);
if (!existing.length) {
  for (let i = 0; i < 6; i++)
    b.set(doc(db, 'departments', `dept-${i + 1}`), { termId: T, name: `Department ${i + 1}`, order: i, jcLeadUid: null, secLeadUid: null, memberUids: [], active: true, createdAt: now, updatedAt: now });
  await b.commit();
  console.log('created 6 departments: Department 1 to Department 6');
} else console.log(`kept ${existing.length} existing departments`);

// 3. Members
const president = members.find((m) => m.active && m.role === 'president')?.id || null;
const advisor = members.find((m) => m.active && m.role === 'advisor')?.id || null;
// Department data decides placement, so a second run keeps people where the app put them.
const depts = existing.map((d) => ({ id: d.id, ...d.data() }));
// The rules let a vice president edit everyone except the advisor, so leave the advisor's record out of the batches.
const skipped = myRole === 'vp' ? members.filter((m) => m.role === 'advisor').map((m) => m.id) : [];
const plan = members.filter((m) => !skipped.includes(m.id)).map((m) => {
  const student = !BOARD_ORDER.includes(m.role) && m.role !== 'teacher', d = depts.find((x) => deptMembers(x).includes(m.id));
  const patch = {
    section: yearLevel(m.section), departmentId: d?.id || null,
    reportsTo: d ? reportsToIn(d, m.id, president) : m.role === 'president' ? advisor : BOARD_ORDER.includes(m.role) && m.role !== 'advisor' ? president : null,
    termId: T, updatedAt: now,
  };
  if (m.id !== me) patch.position = d ? positionIn(d, m.id) : student ? 'member' : null;
  return { id: m.id, patch };
});
let done = 0, failed = [];
for (let i = 0; i < plan.length; i += 400) {
  const chunk = plan.slice(i, i + 400);
  b = writeBatch(db);
  for (const r of chunk) b.update(doc(db, 'members', r.id), r.patch);
  try { await b.commit(); done += chunk.length; } catch {
    for (const r of chunk) { // one bad document must not block the rest
      try { const one = writeBatch(db); one.update(doc(db, 'members', r.id), r.patch); await one.commit(); done++; } catch (e) { failed.push(`${r.id} (${e.code || e.message})`); }
    }
  }
}
console.log(`updated ${done} of ${plan.length} members`);
if (skipped.length) console.log(`left alone because a vice president cannot edit the advisor: ${skipped.join(', ')}. Its section and reports-to can stay as they are.`);
if (failed.length) console.log(`not updated, fix these by hand in the app:\n  ${failed.join('\n  ')}`);
console.log('done. Next: rename the six departments in Committees, set each JC and Sec officer, then assign members with bulk edit.');
process.exit(0);
