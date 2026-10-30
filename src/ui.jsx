// Shared dashboard components. One fixed form per recurring element.
import { useEffect, useRef, useState } from 'preact/hooks';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { S, memberName } from './store.js';
import { fmtDay, stamp } from './time.js';
import { CHIPS, activeMembers, applyFilter, canManage, canWork, groupState, initials, isMine, progress, taskState, tree } from './model.js';
import { ItemForm } from './routes/projects.jsx';
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

// "@Name" picks a member; names that two people share get the last initial. Only names still in the text notify.
const mentionLabels = () => {
  const list = activeMembers(), first = (m) => m.name.split(' ')[0];
  return list.map((m) => ({ id: m.id, label: list.filter((x) => first(x) === first(m)).length > 1 ? `${first(m)} ${m.name.split(' ').at(-1)[0]}` : first(m) }));
};
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function MentionText({ text, uids = [] }) {
  const names = mentionLabels().filter((x) => uids.includes(x.id)).map((x) => x.label);
  if (!names.length) return <p class="fl-pre">{text}</p>;
  const parts = text.split(new RegExp(`(@(?:${names.map(escape).join('|')}))`, 'g'));
  return <p class="fl-pre">{parts.map((p, i) => (i % 2 ? <span key={i} class="fl-mention">{p}</span> : p))}</p>;
}

export function Comments({ it }) {
  const [list, setList] = useState(null), [all, setAll] = useState(false), [open, setOpen] = useState(false);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [picked, setPicked] = useState({}), [q, setQ] = useState(null);
  const [task, setTask] = useState(null), box = useRef();
  useEffect(() => onSnapshot(query(collection(db, 'comments'), where('itemId', '==', it.id), where('termId', '==', S.term.termId)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt)), () => setList(false)), [it.id]);
  if (list === false) return <p class="fl-error" role="alert">Comments did not load. Reload the page to try again.</p>;
  if (!list) return <p class="fl-caption" role="status">Loading comments.</p>;
  const shown = all ? list : list.slice(-2);
  const parent = it.kind === 'task' ? tree().byId[it.parentId] : it, manage = parent && canManage(parent);
  const type = (e) => {
    setText(e.target.value);
    const m = e.target.value.slice(0, e.target.selectionStart).match(/(?:^|\s)@([A-Za-z]*)$/);
    setQ(m ? m[1].toLowerCase() : null);
  };
  const choices = q === null ? [] : mentionLabels().filter((x) => x.id !== S.me.id && x.label.toLowerCase().startsWith(q)).slice(0, 6);
  const pick = (x) => {
    const at = box.current.selectionStart, before = text.slice(0, at).replace(/@[A-Za-z]*$/, `@${x.label} `);
    setText(before + text.slice(at)); setPicked({ ...picked, [x.label]: x.id }); setQ(null);
    setTimeout(() => { box.current.focus(); box.current.setSelectionRange(before.length, before.length); });
  };
  const post = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const uids = [...new Set(Object.entries(picked).filter(([label]) => text.includes(`@${label}`)).map(([, id]) => id))].slice(0, 10);
    if (await addComment(it, text.trim(), uids)) { setText(''); setPicked({}); }
    box.current?.focus();
    setBusy(false);
  };
  // Make task: the comment becomes a task under this item (or its parent, since tasks are leaves), for the person
  // it mentions or else its author. The existing task form opens prefilled; saving sends the usual "assigned" notice.
  const makeTask = (c) => setTask({ title: c.text.split('\n')[0].replace(/@\S+\s?/g, '').trim().slice(0, 80) || 'New task',
    assigneeUids: [c.mentionUids?.[0] || c.authorUid].filter((u) => S.members.find((m) => m.id === u && m.active && m.role !== 'teacher')) });
  return (
    <section class="fl-panel" aria-labelledby="comments-h">
      <div class="fl-panel__head"><h2 id="comments-h" class="fl-h2">Comments</h2>
        {list.length > 2 && <button class="fl-btn fl-btn--ghost fl-btn--sm" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show latest two' : `Show all (${list.length})`}</button>}</div>
      {task && <ItemForm parent={parent} kind="task" prefill={task} done={() => setTask(null)} />}
      {shown.map((c) => (
        <div key={c.id} class="fl-comment"><Chip email={c.authorUid} />
          <div><p><b>{memberName(c.authorUid)}</b> <span class="fl-caption fl-mono">{stamp(c.createdAt)}</span></p><MentionText text={c.text} uids={c.mentionUids} />
            <div class="fl-actions">
              {manage && !task && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => makeTask(c)}>Make task</button>}
              {c.authorUid === S.me.id && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => deleteComment(c)}>Delete comment</button>}
            </div></div></div>
      ))}
      {!list.length && !open ? <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => { setOpen(true); setTimeout(() => box.current?.focus()); }}>Add comment</button> : (
        <form onSubmit={post} class="fl-form">
          <div class="fl-field fl-mentions"><label for="comment-box">Comment</label>
            <textarea id="comment-box" ref={box} class="fl-input" maxLength={500} rows={3} value={text} onInput={type} aria-describedby="comment-help"
              onKeyDown={(e) => { if (choices.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pick(choices[0]); } if (e.key === 'Escape') setQ(null); }} />
            {choices.length > 0 && <div class="fl-pop" role="listbox" aria-label="Mention someone">{choices.map((x) => (
              <button type="button" role="option" key={x.id} onMouseDown={(e) => { e.preventDefault(); pick(x); }}><Chip email={x.id} />@{x.label}</button>))}</div>}
            <span id="comment-help" class="fl-help">Type @ and a first name to mention someone; Enter picks the first match.</span></div>
          <div class="fl-actions"><button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy || !text.trim()}>Post comment</button></div>
        </form>
      )}
    </section>
  );
}
