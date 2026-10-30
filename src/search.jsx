// Search anything: client-side over data already loaded (projects and tasks, people, events, announcements,
// document templates), so it costs no reads. "/" focuses it, arrows move, Enter opens, Esc closes.
// On a phone the open search fills the screen.
import { useEffect, useRef, useState } from 'preact/hooks';
import { S } from './store.js';
import { googleUrl, roleName, tree } from './model.js';
import { fmtDay } from './time.js';
import { AnnouncementSheet, Icon } from './shared.jsx';

function results(q) {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const has = (...xs) => xs.some((x) => typeof x === 'string' && x.toLowerCase().includes(t));
  const { byId } = tree(), kind = { project: 'Project', team: 'Subteam' };
  return [
    ['Projects and tasks', S.items.filter((i) => has(i.title)).slice(0, 6)
      .map((i) => ({ key: i.id, label: i.title, meta: kind[i.kind] || byId[i.ancestors[0]]?.title || 'Task', href: `#/p/${i.id}` }))],
    ['People', S.members.filter((m) => m.active && has(m.name, m.section, roleName(m.role))).slice(0, 5)
      .map((m) => ({ key: m.id, label: m.name, meta: roleName(m.role), href: `#/people/${encodeURIComponent(m.id)}` }))],
    ['Events', S.events.filter((e) => has(e.title, e.location)).slice(0, 5)
      .map((e) => ({ key: e.id, label: e.title, meta: fmtDay(e.date), href: `#/calendar?d=${e.date}&e=${e.id}` }))],
    ['Announcements', S.announcements.filter((a) => has(a.title, a.body)).slice(0, 3)
      .map((a) => ({ key: a.id, label: a.title, meta: fmtDay(a.startDate), ann: a }))],
    ['Templates', S.docTemplates.filter((d) => googleUrl(d.url) && has(d.name, d.kind)).slice(0, 5)
      .map((d) => ({ key: d.id, label: d.name, meta: d.kind, href: d.url, ext: true }))],
  ].filter(([, list]) => list.length);
}

const typing = (el) => /INPUT|TEXTAREA|SELECT/.test(el?.tagName) || el?.isContentEditable;

export function Search() {
  const [q, setQ] = useState(''), [open, setOpen] = useState(false), [i, setI] = useState(0), [ann, setAnn] = useState(null);
  const input = useRef(), box = useRef();
  useEffect(() => {
    const k = (e) => { if (e.key === '/' && !typing(document.activeElement) && !document.querySelector('.fl-sheet')) { e.preventDefault(); input.current.focus(); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => !box.current?.contains(e.target) && setOpen(false);
    addEventListener('pointerdown', out);
    return () => removeEventListener('pointerdown', out);
  }, [open]);
  const groups = results(q), flat = groups.flatMap(([, list]) => list), shown = open && q.trim().length > 1;
  const close = () => { setOpen(false); setQ(''); input.current?.blur(); };
  const go = (r) => {
    close();
    if (r.ann) setAnn(r.ann);
    else if (r.ext) window.open(r.href, '_blank', 'noopener,noreferrer');
    else location.hash = r.href;
  };
  const key = (e) => {
    const n = Math.max(flat.length, 1);
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((i + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((i - 1 + n) % n); }
    else if (e.key === 'Enter' && flat[i]) { e.preventDefault(); go(flat[i]); }
    else if (e.key === 'Escape') close();
  };
  let n = -1;
  return (
    <div class={`fl-search${open ? ' is-open' : ''}`} ref={box}>
      <div>
        <label><Icon n="search" />
          <input ref={input} value={q} placeholder="Search anything" aria-label="Search projects, people, events and templates" role="combobox"
            aria-expanded={shown} aria-controls="search-results" aria-activedescendant={shown && flat[i] ? `hit-${i}` : undefined} autocomplete="off"
            onFocus={() => setOpen(true)} onInput={(e) => { setQ(e.target.value); setI(0); setOpen(true); }} onKeyDown={key} />
          <span class="fl-kbd" aria-hidden="true">/</span></label>
        <button class="fl-iconbtn fl-search__close" aria-label="Close search" onClick={close}><Icon n="x" /></button>
      </div>
      {shown && (
        <div class="fl-pop fl-pop--search" id="search-results" role="listbox" aria-label="Search results">
          {groups.length ? groups.map(([title, list]) => (
            <div key={title} role="group" aria-label={title}><h4>{title}</h4>
              {list.map((r) => {
                const k = ++n;
                return (
                  <a key={r.key} id={`hit-${k}`} role="option" class="fl-hit" aria-selected={k === i} href={r.ann ? '#' : r.href}
                    onClick={(e) => { e.preventDefault(); go(r); }} onMouseEnter={() => setI(k)}>
                    <span>{r.label}</span><small>{r.meta}{r.ext && ' · opens Google'}</small>
                  </a>
                );
              })}
            </div>
          )) : <p class="fl-small fl-muted fl-pad">Nothing matches "{q.trim()}". Try a project, a person or an event.</p>}
        </div>
      )}
      {ann && <AnnouncementSheet a={ann} onClose={() => setAnn(null)} />}
    </div>
  );
}
