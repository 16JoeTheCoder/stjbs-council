import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const env = import.meta.env;
const app = initializeApp({
  apiKey: env.VITE_FB_API_KEY || 'demo-key', authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID || 'demo-council', appId: env.VITE_FB_APP_ID,
});
export const auth = getAuth(app);
export const db = getFirestore(app);
if (env.VITE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
