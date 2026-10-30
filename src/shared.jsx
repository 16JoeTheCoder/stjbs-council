// Building blocks shared by the dashboard and the public site. This module must never import Firebase:
// the public page bundles it, and scripts/check-site-bundle.mjs fails the check if the SDK leaks in.
import { useEffect, useRef, useState } from 'preact/hooks';
import { dateRange } from './feed.js';

// Lucide icons (2px stroke), drawn inline.
const PATHS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  projects: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z',
  committees: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  resources: 'M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM8 9h8M8 13h6',
  ideas: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  more: 'M5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM19 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM21 21l-4.3-4.3',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  x: 'M18 6 6 18M6 6l12 12',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12',
  globe: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  chart: 'M3 3v18h18M7 16l4-4 4 4 5-6',
  digest: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  ext: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  pin: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
};
export const Icon = ({ n, label }) => (
  <svg class="fl-icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label}
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={PATHS[n]} /></svg>
);

// Full-screen detail. Focus moves in, Tab stays inside, Esc and the backdrop close it, focus returns to the trigger.
export function Sheet({ label, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const back = document.activeElement, card = ref.current;
    card.querySelector('.fl-sheet__close').focus();
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab') return;
      const f = [...card.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]')];
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    };
    addEventListener('keydown', key, true);
    document.body.classList.add('fl-locked');
    return () => { removeEventListener('keydown', key, true); document.body.classList.remove('fl-locked'); back?.focus?.(); };
  }, []);
  return (
    <div class="fl-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fl-sheet__card" ref={ref}>
        <button class="fl-iconbtn fl-sheet__close" aria-label="Close" onClick={onClose}><Icon n="x" /></button>
        {children}
      </div>
    </div>
  );
}

const paragraphs = (text) => text.split(/\n+/).filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>);
export const AnnouncementSheet = ({ a, onClose }) => (
  <Sheet label={a.title} onClose={onClose}>
    <span class="fl-eyebrow fl-eyebrow--red">{dateRange(a.startDate, a.endDate)}</span>
    <h1>{a.title}</h1>
    {paragraphs(a.body || '')}
  </Sheet>
);

// Shown while start <= today <= end, newest first, at most 3: 0 renders nothing, 1 a wide banner, 2 to 3 cards.
export function Announcements({ list }) {
  const [open, setOpen] = useState(null);
  if (!list.length) return null;
  const one = list.length === 1;
  return (
    <section class={`fl-ann${one ? ' fl-ann--one' : ''}`} aria-labelledby="ann-h">
      <h2 id="ann-h" class="fl-eyebrow fl-eyebrow--red">Announcements</h2>
      <div class={one ? 'fl-ann__one' : 'fl-ann__grid'}>
        {list.map((a) => (
          <button key={a.id || a.title} class={`fl-ann-card${one ? ' fl-stage' : ''}`} onClick={() => setOpen(a)}>
            <span class="fl-eyebrow">{dateRange(a.startDate, a.endDate)}</span>
            <span><h3>{a.title}</h3>{a.body && <p>{a.body}</p>}</span>
            <span class="fl-link">Read more</span>
          </button>
        ))}
      </div>
      {open && <AnnouncementSheet a={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

const MESSAGES = ['Ad maiorem Dei gloriam.', 'Small steps create big change.', 'Lead. Serve. Build.'];
// The arrow cycles the message; it never rotates on its own.
export function Mission({ img, extra = '' }) {
  const [i, setI] = useState(0);
  return (
    <section class={`fl-mission fl-stage ${extra}`} aria-label="Our mission">
      <img class="fl-mission__ghost" src={img} alt="" /><i /><i /><i />
      <div class="fl-mission__dots" aria-hidden="true">{MESSAGES.map((m, k) => <span key={m} aria-current={k === i ? 'true' : undefined} />)}</div>
      <div class="fl-mission__body"><span class="fl-eyebrow">St. Johannes Berchmans</span><h2 aria-live="polite">{MESSAGES[i]}</h2></div>
      <button class="fl-mission__go" aria-label="Next message" onClick={() => setI((i + 1) % MESSAGES.length)}><Icon n="arrow" /></button>
    </section>
  );
}

export function PublicProject({ p }) {
  return (
    <article class="fl-card fl-pubcard">
      <div class="fl-card__meta"><h3 class="fl-h3">{p.title}</h3><span class={`fl-tag${p.stage === 'Done' ? ' fl-tag--public' : ''}`}>{p.stage}</span></div>
      {p.blurb && <p class="fl-small fl-muted">{p.blurb}</p>}
      <div class="fl-bar" role="progressbar" aria-label={`${p.title} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={p.pct}><i style={{ width: `${p.pct}%` }} /></div>
      <span class="fl-mono fl-small fl-muted">{p.pct}% · {p.done} of {p.total} tasks done</span>
    </article>
  );
}
