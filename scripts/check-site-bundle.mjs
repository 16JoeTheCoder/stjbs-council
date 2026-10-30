// Fails if the public page (dist/index.html) loads any chunk containing the Firebase SDK.
// Run after a build (npm run check does both). VS Code terminal, repo root.
import { readFileSync, existsSync } from 'node:fs';

const html = 'dist/index.html';
if (!existsSync(html)) { console.error('x no dist/index.html: run npm run build first'); process.exit(1); }
const seen = new Set();
const visit = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  const js = readFileSync(`dist/${file}`, 'utf8');
  for (const [, dep] of js.matchAll(/["'(]\.?\/?(assets\/[\w.-]+\.js)["')]/g)) visit(dep);
  for (const [, dep] of js.matchAll(/["']\.\/([\w.-]+\.js)["']/g)) visit(`assets/${dep}`);
};
for (const [, src] of readFileSync(html, 'utf8').matchAll(/(?:src|href)="\/(assets\/[\w.-]+\.js)"/g)) visit(src);
// SDK markers only: the page legitimately names the firestore.googleapis.com REST host.
const bad = [...seen].filter((f) => /FirebaseError|@firebase\/|initializeApp|onSnapshot/.test(readFileSync(`dist/${f}`, 'utf8')));
if (!seen.size) { console.error('x the public page loads no script'); process.exit(1); }
if (bad.length) { console.error(`x the public page loads Firebase code: ${bad.join(', ')}`); process.exit(1); }
console.log(`ok public page is Firebase-free (${seen.size} chunks)`);
