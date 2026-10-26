// Shared components. One fixed form per recurring element (Kata).
import { useEffect, useRef, useState } from 'preact/hooks';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, memberName } from './store.js';
import { stamp } from './time.js';
import { CHIPS, activeMembers, applyFilter, canWork, groupState, initials, isMine, progress, taskState, tree } from './model.js';
import { addComment, deleteComment, toggleDone } from './actions.js';

const PATHS = {
  week: 'M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  projects: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  feed: 'M22 12h-4l-3 9L9 3l-3 9H2',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
};
export const Icon = ({ n }) => (
  <svg class="jy-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={PATHS[n]} /></svg>
);

export function Chip({ email, lead, big, named }) {
  const m = S.members.find((x) => x.id === email);
  const name = m?.name || email;
  const chip = <span class={`jy-person${lead ? ' jy-person--lead' : ''}${big ? ' jy-person--l' : ''}`} title={name} aria-label={named ? undefined : name} role={named ? undefined : 'img'}>{m?.initials || initials(name)}</span>;
  return named ? <span class="jy-person-named">{chip}<span>{name}</span></span> : chip;
}
export const Chips = ({ list, lead }) => (
  <span class="jy-chips">{lead && <Chip email={lead} lead />}{[...new Set(list)].filter((e) => e && e !== lead).slice(0, 6).map((e) => <Chip key={e} email={e} />)}</span>
);

export const Bar = ({ done, total, label }) => (
  <div class="jy-bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={total || 1} aria-valuenow={done} aria-valuetext={`${done} of ${total} done`}>
    <i style={{ width: `${total ? (100 * done) / total : 0}%` }} />
  </div>
);
export const Badge = ({ s }) => <span class={`jy-badge jy-badge--${s.cls}`}>{s.word}</span>;

// Page heading: sets the document title and takes focus on route change.
export function Title({ light, bold, title }) {
  const ref = useRef();
  useEffect(() => { document.title = `${title || `${light} ${bold}`.trim()} · Council`; ref.current?.focus({ preventScroll: false }); }, [title, light, bold]);
  return <h1 ref={ref} tabIndex={-1} class="jy-title">{light && <span>{light} </span>}<b>{bold}</b></h1>;
}

export function TaskRow({ t, path }) {
  const { byId } = tree(), mine = isMine(t), s = taskState(t);
  return (
    <li class={`jy-task ${mine ? 'is-mine' : 'is-quiet'}`}>
      {canWork(t) ? (
        <label class="jy-check"><input type="checkbox" checked={t.status === 'done'} onChange={() => toggleDone(t)} /><span class="jy-sr">Done: {t.title}</span></label>
      ) : <span class="jy-check" aria-hidden="true" />}
      <span class="jy-task__body">
        <a class="jy-task__title" href={`#/p/${t.id}`}>{t.title}</a>
        {path && <span class="jy-caption">{t.ancestors.map((a) => byId[a]?.title).filter(Boolean).join(' / ')}</span>}
        <span class="jy-meta"><Badge s={s} />{t.isDeal && <span class="jy-tag">Deal</span>}<Chips list={t.assigneeUids} /><span class="jy-mono">{t.dueDate || 'No due date'}</span></span>
      </span>
    </li>
  );
}
export const TaskList = ({ list, path, empty }) =>
  list.length ? <ul class="jy-list">{list.map((t) => <TaskRow key={t.id} t={t} path={path} />)}</ul> : <p class="jy-empty">{empty}</p>;

export function ItemCard({ it }) {
  const list = tree().under(it.id), p = progress(list), mineN = list.filter(isMine).length;
  return (
    <a class={`jy-card ${mineN ? 'is-mine' : 'is-quiet'}`} href={`#/p/${it.id}`}>
      <span class="jy-card__head"><b>{it.title}</b><Badge s={groupState(list)} /></span>
      <Bar done={p.done} total={p.total} label={`${it.title} progress`} />
      <span class="jy-meta">
        <span class="jy-mono">{p.done} of {p.total} tasks</span>
        {mineN > 0 && <span class="jy-tag">{mineN} yours</span>}
        {list.some((t) => t.isDeal) && <span class="jy-tag">Deal</span>}
        {it.dueDate && <span class="jy-mono">{it.dueDate}</span>}
      </span>
      <Chips list={list.flatMap((t) => t.assigneeUids)} lead={it.leadUid} />
    </a>
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
    <>
      <div class="jy-filters" role="group" aria-label="Filter tasks">
        {CHIPS.map(([k, label]) => (
          <button key={k} class="jy-filter" aria-pressed={f.chip === k} onClick={() => set({ chip: k })}>{label} <span class="jy-mono">{counts[k]}</span></button>
        ))}
        <button class="jy-filter" aria-pressed={f.hideDone} onClick={() => set({ hideDone: !f.hideDone })}>{f.hideDone ? `Show done (${doneHidden})` : 'Hide done'}</button>
        <button class="jy-filter" aria-expanded={open} onClick={() => setOpen(!open)}>People and teams</button>
      </div>
      {scope && <p class="jy-scope">Showing {scope} only. <button class="jy-link" onClick={() => set({ person: null, team: null })}>Show everyone</button></p>}
      {open && (
        <div class="jy-rail">
          <ul aria-label="People">{activeMembers().map((m) => (
            <li key={m.id}><button class="jy-filter" aria-pressed={f.person === m.id} onClick={() => set({ person: m.id, team: null })}><Chip email={m.id} named /></button></li>
          ))}</ul>
          {teams.length > 0 && <ul aria-label="Teams">{teams.map((t) => (
            <li key={t.id}><button class="jy-filter" aria-pressed={f.team === t.id} onClick={() => set({ team: t.id, person: null })}>{teamName(t)}</button></li>
          ))}</ul>}
        </div>
      )}
      {!hideList && <TaskList list={out} path empty="No tasks match this filter. Choose All to see everything." />}
    </>
  );
}

export function Comments({ it }) {
  const [list, setList] = useState(null), [all, setAll] = useState(false), [open, setOpen] = useState(false);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(query(collection(db, 'comments'), where('itemId', '==', it.id), where('termId', '==', S.term.termId)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt)), () => setList(false)), [it.id]);
  if (list === false) return <p class="jy-error" role="alert">Comments did not load. Reload the page to try again.</p>;
  if (!list) return <p class="jy-caption">Loading comments, step 1 of 1.</p>;
  const shown = all ? list : list.slice(-2);
  const post = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await addComment(it, text.trim())) setText('');
    setBusy(false);
  };
  return (
    <section class="jy-section" aria-labelledby="comments-h">
      <h2 id="comments-h" class="jy-h2">Comments</h2>
      {list.length > 2 && <button class="jy-link" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show latest two' : `Show all (${list.length})`}</button>}
      <ul class="jy-comments">{shown.map((c) => (
        <li key={c.id}><Chip email={c.authorUid} /><div><p class="jy-caption">{memberName(c.authorUid)} <span class="jy-mono">{stamp(c.createdAt)}</span></p><p class="jy-pre">{c.text}</p>
          {c.authorUid === S.me.id && <button class="jy-link" onClick={() => deleteComment(c)}>Delete comment</button>}</div></li>
      ))}</ul>
      {!list.length && !open ? <button class="jy-link" aria-expanded="false" onClick={() => setOpen(true)}>Add comment</button> : (
        <form onSubmit={post} class="jy-form">
          <label class="jy-field jy-field--wide"><span class="jy-field__label">Comment</span>
            <textarea class="jy-field__input" maxLength={500} rows={3} value={text} onInput={(e) => setText(e.target.value)} /></label>
          <button class="jy-btn jy-btn--ghost" disabled={busy || !text.trim()}>Post comment</button>
        </form>
      )}
    </section>
  );
}
