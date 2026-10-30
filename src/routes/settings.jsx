// Settings from the avatar menu: theme, install the app, About with the version, sign out.
import { useEffect, useState } from 'preact/hooks';
import { signOutHere } from '../store.js';
import { Title } from '../ui.jsx';

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('council-theme', theme); } catch {}
}

let deferredInstall = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

// The install button appears only where the browser offers it; iPhones always get the Safari steps.
export function Install() {
  const [can, setCan] = useState(!!deferredInstall);
  useEffect(() => { const f = () => setCan(true); addEventListener('beforeinstallprompt', f); return () => removeEventListener('beforeinstallprompt', f); }, []);
  return (
    <section class="fl-section" aria-labelledby="install-h">
      <h2 id="install-h" class="fl-h3">Put it on your phone</h2>
      {can && <div><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => { deferredInstall.prompt(); deferredInstall = null; setCan(false); }}>Install app</button></div>}
      <p class="fl-small fl-muted">iPhone: open this page in Safari, tap Share, then tap Add to Home Screen.</p>
    </section>
  );
}

export function Settings() {
  const [theme, set] = useState(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const pick = (t) => { setTheme(t); set(t); };
  return (
    <>
      <Title light="Your app." bold="Settings." title="Settings" />
      <section class="fl-panel fl-section" aria-labelledby="theme-h">
        <h2 id="theme-h" class="fl-h3">Theme</h2>
        <div class="fl-seg" role="group" aria-labelledby="theme-h">
          <button aria-pressed={theme === 'dark'} onClick={() => pick('dark')}>Dark</button>
          <button aria-pressed={theme === 'light'} onClick={() => pick('light')}>Light</button>
        </div>
      </section>
      <div class="fl-panel"><Install /></div>
      <section class="fl-panel fl-section" aria-labelledby="about-h">
        <h2 id="about-h" class="fl-h3">About</h2>
        <p class="fl-muted fl-measure">One place for the St. Johannes Berchmans student council to plan projects, check in once a week and run meetings. It feeds the WhatsApp and Google Chat groups; it does not replace them.</p>
        <p class="fl-small">Version <span class="fl-mono">{__VERSION__}</span></p>
      </section>
      <div><button class="fl-btn fl-btn--ghost" onClick={signOutHere}>Sign out</button></div>
    </>
  );
}
