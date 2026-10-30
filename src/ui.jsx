// Shared dashboard components. One fixed form per recurring element.
import { useEffect, useRef, useState } from 'preact/hooks';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, memberName } from './store.js';
import { fmtDay, stamp } from './time.js';
import { CHIPS, activeMembers, applyFilter, canWork, groupState, initials, isMine, progress, taskState, tree } from './model.js';
import { addComment, deleteComment, toggleDone } from './actions.js';

export function Chip({ email, lead, big, named, sub }) {
  const m = S.members.find((x) => x.id === email);
  const name = m?.name || email;
  const cls = `fl-chip${lead || email === S.me?.id ? ' fl-chip--lead' : ''}${big ? ' fl-chip--lg' : ''}`;
  const chip = <span class={cls} title={name} aria-label={named ? undefined : name} role={named ? undefined : 'img'}>{m?.initials || initials(name)}</span>;
  return named ? <span class="fl-person">{chip}<span>{name}{sub && <small> · {sub}</small>}</span></span> : chip;
}
export const Chips = ({ list, lead }) => (
  <span class="fl-chips">{lead && <Chip email={lead} lead />}{[...new Set(list)].filter((e) => e && e !== lead).slice(0, 6).map((e) => <Chip key={e} email={e} />)}</span>
);

export const Bar = ({ done, total, label }) => (
  <div class="fl-bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={total || 1} aria-valuenow={done} aria-valuetext={`${done} of ${total} done`}>
    <i style={{ width: `${total ? (100 * done) / total : 0}%` }} />
  </div>
);
export const Badge = ({ s }) => <span class={`fl-badge fl-badge--${s.cls}`}>{s.word}</span>;
export const pct = (p) => (p.total ? Math.round((100 * p.done) / p.total) : 0);

// Focus the first field when a form opens; return focus to the trigger row when it closes.
export function useAutofocus() {
  const ref = useRef();
  useEffect(() => ref.current?.querySelector('input:not([type=checkbox]), select, textarea')?.focus(), []);
  return ref;
}
export function useReturnFocus(open) {
  const ref = useRef(), was = useRef(open);
  useEffect(() => { if (was.current && !open) ref.current?.querySelector('button, a')?.focus(); was.current = open; }, [open]);
  return ref;
}

// Page heading: a light phrase and a bold phrase. Sets the document title and takes focus once per route.
export function Title({ light, bold, title, children }) {
  const ref = useRef();
  useEffect(() => { document.title = `${title || `${light || ''} ${bold}`.trim()} · Council`; }, [title, light, bold]);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div class="fl-pagehead">
      <h1 ref={ref} tabIndex={-1} class="fl-title">{light && <span class="fl-light">{light} </span>}{bold}</h1>
      {children && <div class="fl-actions">{children}</div>}
    </div>
  );
}
export const Empty = ({ children }) => <p class="fl-empty">{children}</p>;
export const Panel = ({ title, id, link, children, extra = '' }) => (
  <section class={`fl-panel ${extra}`} aria-labelledby={id}>
    <div class="fl-panel__head"><h2 id={id} class="fl-h2">{title}</h2>{link}</div>
    {children}
  </section>
);

export function TaskRow({ t, path }) {
  const { byId } = tree(), mine = isMine(t), s = taskState(t), done = t.status === 'done';
  return (
    <div class={`fl-row fl-row--task${mine ? ' is-mine' : ''}${done ? ' is-done' : ''}`}>
      {canWork(t)
        ? <input type="checkbox" class="fl-check" checked={done} onChange={() => toggleDone(t)} aria-label={`Done: ${t.title}`} />
        : <span aria-hidden="true" />}
      <div>
        <a class="fl-h3" href={`#/p/${t.id}`}>{t.title}</a>
        {path && <div class="fl-caption fl-mono">{t.ancestors.map((a) => byId[a]?.title).filter(Boolean).join(' / ')}</div>}
      </div>
      <span class="fl-rowmeta"><Badge s={s} />{t.isDeal && <span class="fl-tag">Deal</span>}</span>
      <span class="fl-mono fl-small fl-muted">{t.dueDate ? fmtDay(t.dueDate) : 'No date'}</span>
    </div>
  );
}
export const TaskList = ({ list, path, empty }) =>
  list.length ? <div class="fl-list">{list.map((t) => <TaskRow key={t.id} t={t} path={path} />)}</div> : <Empty>{empty}</Empty>;

export function ItemCard({ it }) {
  const list = tree().under(it.id), p = progress(list), mineN = list.filter(isMine).length;
  return (
    <article class="fl-card">
      <div class="fl-card__meta"><a class="fl-h3" href={`#/p/${it.id}`}>{it.title}</a><Badge s={groupState(list)} /></div>
      <Bar done={p.done} total={p.total} label={`${it.title} progress`} />
      <div class="fl-card__meta">
        <span class="fl-mono fl-small fl-muted">{p.done} of {p.total} tasks{it.dueDate ? ` · due ${fmtDay(it.dueDate)}` : ''}</span>
        <span class="fl-rowmeta">{mineN > 0 && <span class="fl-tag fl-tag--meeting">{mineN} yours</span>}{list.some((t) => t.isDeal) && <span class="fl-tag">Deal</span>}</span>
      </div>
      <Chips list={list.flatMap((t) => t.assigneeUids)} lead={it.leadUid} />
    </article>
  );
}

const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k)) }; } catch { return d; } };
export function useFilter(screen, chip = 'all') {
  const key = `council-filter-${screen}`;
  const [f, setF] = useState(() => load(key, { chip, person: null, team: null, hideDone: false }));
  const update = (patch) => { const n = { ...f, ...patch }; setF(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch {} };
  return [f, update];
}

const teamName = (t) => [tree().byId[t.ancestors[0]]?.title, t.title].filter(Boolean).join(' / ');
// Status chips with counts, Hide done, and list-based person and team filters.
export function FilterBar({ list, f, set, teams = [], hideList }) {
  const [open, setOpen] = useState(false);
  const { out, counts, doneHidden } = applyFilter(list, f);
  const scope = f.person ? memberName(f.person) : f.team ? tree().byId[f.team]?.title : null;
  return (
    <div class="fl-section">
      <div class="fl-filters" role="group" aria-label="Filter tasks">
        {CHIPS.map(([k, label]) => (
          <button key={k} class="fl-filter" aria-pressed={f.chip === k} onClick={() => set({ chip: k })}>{label} <span class="fl-mono">{counts[k]}</span></button>
        ))}
        <button class="fl-filter" aria-pressed={f.hideDone} onClick={() => set({ hideDone: !f.hideDone })}>{f.hideDone ? <>Show done <span class="fl-mono">{doneHidden}</span></> : 'Hide done'}</button>
        <button class="fl-filter" aria-expanded={open} onClick={() => setOpen(!open)}>Person or team</button>
      </div>
      {scope && <p class="fl-small fl-muted">Showing {scope} only. <button class="fl-linkbtn" onClick={() => set({ person: null, team: null })}>Show everyone</button></p>}
      {open && (
        <div class="fl-pickers">
          <ul aria-label="People">{activeMembers().map((m) => (
            <li key={m.id}><button class="fl-filter" aria-pressed={f.person === m.id} onClick={() => set({ person: m.id, team: null })}>{m.name.split(' ')[0]}</button></li>
          ))}</ul>
          {teams.length > 0 && <ul aria-label="Teams">{teams.map((t) => (
            <li key={t.id}><button class="fl-filter" aria-pressed={f.team === t.id} onClick={() => set({ team: t.id, person: null })}>{teamName(t)}</button></li>
          ))}</ul>}
        </div>
      )}
      {!hideList && <TaskList list={out} path empty="No tasks match this filter. Choose All to see everything." />}
    </div>
  );
}

export function Comments({ it }) {
  const [list, setList] = useState(null), [all, setAll] = useState(false), [open, setOpen] = useState(false);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), box = useRef();
  useEffect(() => onSnapshot(query(collection(db, 'comments'), where('itemId', '==', it.id), where('termId', '==', S.term.termId)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt)), () => setList(false)), [it.id]);
  if (list === false) return <p class="fl-error" role="alert">Comments did not load. Reload the page to try again.</p>;
  if (!list) return <p class="fl-caption" role="status">Loading comments.</p>;
  const shown = all ? list : list.slice(-2);
  const post = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await addComment(it, text.trim())) setText('');
    box.current?.focus();
    setBusy(false);
  };
  return (
    <section class="fl-panel" aria-labelledby="comments-h">
      <div class="fl-panel__head"><h2 id="comments-h" class="fl-h2">Comments</h2>
        {list.length > 2 && <button class="fl-btn fl-btn--ghost fl-btn--sm" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show latest two' : `Show all (${list.length})`}</button>}</div>
      {shown.map((c) => (
        <div key={c.id} class="fl-comment"><Chip email={c.authorUid} />
          <div><p><b>{memberName(c.authorUid)}</b> <span class="fl-caption fl-mono">{stamp(c.createdAt)}</span></p><p class="fl-pre">{c.text}</p>
            {c.authorUid === S.me.id && <div><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => deleteComment(c)}>Delete comment</button></div>}</div></div>
      ))}
      {!list.length && !open ? <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => { setOpen(true); setTimeout(() => box.current?.focus()); }}>Add comment</button> : (
        <form onSubmit={post} class="fl-form">
          <div class="fl-field"><label for="comment-box">Comment</label>
            <textarea id="comment-box" ref={box} class="fl-input" maxLength={500} rows={3} value={text} onInput={(e) => setText(e.target.value)} /></div>
          <div class="fl-actions"><button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy || !text.trim()}>Post comment</button></div>
        </form>
      )}
    </section>
  );
}
