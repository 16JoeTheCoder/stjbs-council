import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';

const env = import.meta.env;
if (env.PROD && !env.VITE_FB_API_KEY && env.VITE_EMULATORS !== '1') {
  document.body.textContent = 'Missing Firebase config. Add the values to .env.local, then build again.';
  throw new Error('Missing Firebase config');
}
const app = initializeApp({
  apiKey: env.VITE_FB_API_KEY || 'demo-key', authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID || 'demo-council', appId: env.VITE_FB_APP_ID,
});
export const auth = getAuth(app);
// Cached on the device so a reopen within about 30 minutes reads only what changed (owner decision Q3, docs/plan.md).
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
if (env.VITE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
