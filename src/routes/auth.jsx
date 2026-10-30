import { useState } from 'preact/hooks';
import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { auth } from '../firebase.js';
import { S, boot } from '../store.js';
import { Title } from '../ui.jsx';
import { Install } from './settings.jsx';
import sky from '../../design/fiatlux/img/campus-sky.webp';
import crest from '../../design/fiatlux/img/crest-256.png';

const MESSAGES = {
  'auth/invalid-credential': 'Email or password is wrong. Check both, or reset your password.',
  'auth/user-not-found': 'Email or password is wrong. Check both, or create an account.',
  'auth/wrong-password': 'Email or password is wrong. Check both, or reset your password.',
  'auth/invalid-email': 'That email address is not valid. Use your school email.',
  'auth/missing-password': 'Type your password, then sign in.',
  'auth/email-already-in-use': 'That email already has an account. Sign in or reset your password.',
  'auth/weak-password': 'That password is too short. Use at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'No connection. Check your internet, then try again.',
};
const say = (e) => MESSAGES[e.code] || `Something went wrong (${e.code || e.message}). Try again.`;

// Split layout: the school on the left (a stage surface, dark in both themes), the form on the right.
const Stage = () => (
  <section class="fl-auth__stage fl-stage" aria-label="St. Johannes Berchmans Student Council">
    <img src={sky} alt="" />
    <div class="fl-brand"><img src={crest} alt="" width="44" height="44" /><div><b>Student Council</b><span>St. Johannes Berchmans</span></div></div>
    <p class="fl-display">Lead. <span class="fl-light">Serve. Build.</span></p>
  </section>
);

export function Login() {
  const [mode, setMode] = useState('in'), [email, setEmail] = useState(''), [pw, setPw] = useState('');
  const [error, setError] = useState({}), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const titles = { in: ['Council.', 'Sign in'], up: ['New here.', 'Create account'], reset: ['Forgot it.', 'Reset password'] };
  const submit = async (e) => {
    e.preventDefault(); setError({}); setNote(''); setBusy(true);
    const addr = email.trim().toLowerCase();
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, addr, pw);
      if (mode === 'up') {
        if (pw.length < 8) throw { code: 'auth/weak-password' };
        const cred = await createUserWithEmailAndPassword(auth, addr, pw);
        await sendEmailVerification(cred.user);
      }
      if (mode === 'reset') { await sendPasswordResetEmail(auth, addr); setNote(`If ${addr} has an account, a reset link is on its way. Check spam too.`); }
    } catch (err) { setError({ msg: say(err), field: err.code === 'auth/invalid-email' || mode === 'reset' ? 'email' : 'password' }); }
    setBusy(false);
  };
  const field = (id, label, input) => (
    <div class={`fl-field${error.field === id ? ' fl-field--error' : ''}`}><label for={id}>{label}</label>{input}</div>
  );
  return (
    <div class="fl-auth">
      <Stage />
      <main id="main" class="fl-auth__form">
        <Title light={titles[mode][0]} bold={titles[mode][1]} />
        {S.phase === 'no-roster' && <p class="fl-alert" role="alert">Your email isn't on the council roster, or your access was turned off. Ask the president or vice president.</p>}
        <form class="fl-form" onSubmit={submit} noValidate>
          {field('email', 'School email', <input id="email" class="fl-input" type="email" autocomplete="username" required value={email} onInput={(e) => setEmail(e.target.value)}
            placeholder="name@stjbs.sch.id" aria-invalid={error.field === 'email' || undefined} aria-describedby={error.field === 'email' ? 'auth-error' : undefined} />)}
          {mode !== 'reset' && field('password', 'Password', <input id="password" class="fl-input" type="password" required minLength={8}
            autocomplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onInput={(e) => setPw(e.target.value)}
            aria-invalid={error.field === 'password' || undefined} aria-describedby={error.field === 'password' ? 'auth-error' : undefined} />)}
          <p id="auth-error" class="fl-error" role="alert">{error.msg}</p>
          {note && <p class="fl-small fl-muted" role="status">{note}</p>}
          <button class="fl-btn fl-btn--red fl-btn--block" disabled={busy}>{titles[mode][1]}</button>
        </form>
        <p class="fl-actions">
          {mode !== 'in' && <button class="fl-linkbtn" onClick={() => setMode('in')}>Sign in instead</button>}
          {mode !== 'up' && <button class="fl-linkbtn" onClick={() => setMode('up')}>Create account</button>}
          {mode !== 'reset' && <button class="fl-linkbtn" onClick={() => setMode('reset')}>Reset password</button>}
        </p>
        <p class="fl-small fl-muted">Only council members on the roster can open the dashboard. <a class="fl-link" href="/">Back to the public site</a></p>
        <Install />
      </main>
    </div>
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
    <div class="fl-auth">
      <Stage />
      <main id="main" class="fl-auth__form">
        <Title light="One step." bold="Verify your email" />
        <p>We sent a link to <b>{S.user.email}</b>. Open it, then come back here.</p>
        <div class="fl-actions">
          <button class="fl-btn fl-btn--red" disabled={busy} onClick={check}>Continue after verifying</button>
          <button class="fl-btn fl-btn--ghost" onClick={resend}>Resend verification email</button>
          <button class="fl-btn fl-btn--ghost" onClick={() => signOut(auth)}>Sign out</button>
        </div>
        <p class="fl-small fl-muted" role="status">{msg}</p>
      </main>
    </div>
  );
}
