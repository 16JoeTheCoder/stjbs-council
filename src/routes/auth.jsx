import { useEffect, useState } from 'preact/hooks';
import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { auth } from '../firebase.js';
import { S, boot } from '../store.js';
import { Title } from '../ui.jsx';

const MESSAGES = {
  'auth/invalid-credential': 'Email or password is wrong. Check both, or reset your password.',
  'auth/user-not-found': 'Email or password is wrong. Check both, or create an account.',
  'auth/wrong-password': 'Email or password is wrong. Check both, or reset your password.',
  'auth/invalid-email': 'That email address is not valid. Use your school email.',
  'auth/email-already-in-use': 'That email already has an account. Sign in or reset your password.',
  'auth/weak-password': 'That password is too short. Use at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'No connection. Check your internet, then try again.',
};
const say = (e) => MESSAGES[e.code] || `Something went wrong (${e.code || e.message}). Try again.`;

let deferredInstall = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

export function Login() {
  const [mode, setMode] = useState('in'), [email, setEmail] = useState(''), [pw, setPw] = useState('');
  const [error, setError] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const titles = { in: ['Council.', 'Sign in'], up: ['New here.', 'Create account'], reset: ['Forgot it.', 'Reset password'] };
  const submit = async (e) => {
    e.preventDefault(); setError(''); setNote(''); setBusy(true);
    const addr = email.trim().toLowerCase();
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, addr, pw);
      if (mode === 'up') {
        if (pw.length < 8) throw { code: 'auth/weak-password' };
        const cred = await createUserWithEmailAndPassword(auth, addr, pw);
        await sendEmailVerification(cred.user);
      }
      if (mode === 'reset') { await sendPasswordResetEmail(auth, addr); setNote(`If ${addr} has an account, a reset link is on its way. Check spam too.`); }
    } catch (err) { setError(say(err)); }
    setBusy(false);
  };
  return (
    <main id="main" class="jy-auth">
      <Title light={titles[mode][0]} bold={titles[mode][1]} />
      {S.phase === 'no-roster' && <p class="jy-alert" role="alert">Your email isn't on the council roster. Ask the president to add it.</p>}
      <form class="jy-form" onSubmit={submit} noValidate>
        <label class="jy-field"><span class="jy-field__label">School email</span>
          <input class="jy-field__input" type="email" autocomplete="username" required value={email} onInput={(e) => setEmail(e.target.value)} placeholder="name@stjbs.sch.id" /></label>
        {mode !== 'reset' && (
          <label class={`jy-field${error ? ' jy-field--error' : ''}`}><span class="jy-field__label">Password</span>
            <input class="jy-field__input" type="password" required minLength={8} autocomplete={mode === 'up' ? 'new-password' : 'current-password'}
              value={pw} onInput={(e) => setPw(e.target.value)} aria-describedby="auth-error" /></label>
        )}
        <p id="auth-error" class="jy-error" role="alert">{error}</p>
        {note && <p class="jy-caption" role="status">{note}</p>}
        <button class="jy-btn jy-btn--accent" disabled={busy}>{titles[mode][1]}</button>
      </form>
      <p class="jy-links">
        {mode !== 'in' && <button class="jy-link" onClick={() => setMode('in')}>Sign in instead</button>}
        {mode !== 'up' && <button class="jy-link" onClick={() => setMode('up')}>Create account</button>}
        {mode !== 'reset' && <button class="jy-link" onClick={() => setMode('reset')}>Reset password</button>}
      </p>
      <Install />
    </main>
  );
}

function Install() {
  const [can, setCan] = useState(!!deferredInstall);
  useEffect(() => { const f = () => setCan(true); addEventListener('beforeinstallprompt', f); return () => removeEventListener('beforeinstallprompt', f); }, []);
  return (
    <section class="jy-section" aria-labelledby="install-h">
      <h2 id="install-h" class="jy-h2">Put it on your phone</h2>
      {can && <button class="jy-btn jy-btn--ghost" onClick={() => { deferredInstall.prompt(); deferredInstall = null; setCan(false); }}>Install app</button>}
      <p class="jy-caption">iPhone: open this page in Safari, tap Share.</p>
      <p class="jy-caption">Then tap Add to Home Screen.</p>
    </section>
  );
}

export function Verify() {
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); boot(auth.currentUser); }
    else setMsg('Not verified yet. Open the link in the email, then press this again.');
    setBusy(false);
  };
  const resend = async () => {
    try { await sendEmailVerification(auth.currentUser); setMsg('Sent again. Check spam and the school quarantine folder too.'); }
    catch (e) { setMsg(say(e)); }
  };
  return (
    <main id="main" class="jy-auth">
      <Title light="One step." bold="Verify your email" />
      <p>We sent a link to <b>{S.user.email}</b>. Open it, then come back here.</p>
      <div class="jy-actions">
        <button class="jy-btn jy-btn--accent" disabled={busy} onClick={check}>Continue after verifying</button>
        <button class="jy-btn jy-btn--ghost" onClick={resend}>Resend verification email</button>
        <button class="jy-btn jy-btn--ghost" onClick={() => signOut(auth)}>Sign out</button>
      </div>
      <p class="jy-caption" role="status">{msg}</p>
    </main>
  );
}
