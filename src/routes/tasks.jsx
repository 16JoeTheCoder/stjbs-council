// Tasks: the row (one tap marks done), the detail sheet, the quick-add sheet and the Tasks tab.
import { useEffect, useRef, useState } from 'preact/hooks';
import { S } from '../store.js';
import { addDays, fmtDay, isoDay, week } from '../time.js';
import { STATUS, assignable, bucket, dueWord, fullName, groupTasks, isBossRole, overdueByPerson, waitingLine } from '../work-model.js';
import { addTask, editTask, removeTask, setStatus } from '../work-actions.js';
import { Sheet } from '../shared.jsx';

const firstName = (uid) => fullName(S.members, uid).split(' ')[0];
const canEdit = (t) => S.me.role !== 'teacher' && (t.assignerUid === S.me.id || isBossRole(S.me));
const canMove = (t) => S.me.role !== 'teacher' && (t.ownerUid === S.me.id || canEdit(t));

// who: show the owner's first name (lists that mix people). reopen: the assigner's one-tap button on done rows.
export function TaskRow({ t, who, reopen }) {
  const [open, setOpen] = useState(false);
  const b = bucket(t), done = t.status === 'done';
  const meta = b === 'blocked' ? waitingLine(t, S.members) : [who && firstName(t.ownerUid), dueWord(t), t.status === 'doing' && 'In progress'].filter(Boolean).join(' · ');
  return (
    <div class={`fl-t fl-t--${b}`}>
      {canMove(t) ? <label class="fl-t__tick"><input type="checkbox" class="fl-check" checked={done} onChange={() => setStatus(t, done ? 'todo' : 'done')} aria-label={`Mark ${t.title} ${done ? 'not done' : 'done'}`} /></label> : <span class="fl-t__tick" />}
      <button class="fl-t__main" onClick={() => setOpen(true)}><span class="fl-t__title">{t.title}</span>{meta && <span class="fl-t__meta">{meta}</span>}</button>
      {reopen && done && canEdit(t) && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setStatus(t, 'todo')}>Reopen</button>}
      {open && <TaskSheet t={t} close={() => setOpen(false)} />}
    </div>
  );
}

// Due-date shortcuts: one tap each, no calendar unless asked for.
function DueChips({ value, set }) {
  const today = isoDay(), fri = week().due;
  const opts = [[today, 'Today'], [addDays(today, 1), 'Tomorrow'], ...(fri > addDays(today, 1) ? [[fri, 'Friday']] : []), [addDays(week().start, 11), 'Next Fri']];
  return (
    <div class="fl-pick" role="group" aria-label="Due date">
      {opts.map(([d, l]) => <button type="button" key={d} class="fl-filter" aria-pressed={value === d} onClick={() => set(value === d ? null : d)}>{l}</button>)}
      <input class="fl-input fl-pick__date" type="date" aria-label="Pick a date" value={value || ''} onInput={(e) => set(e.target.value || null)} />
    </div>
  );
}
function PeopleChips({ value, set, list, label }) {
  if (list.length < 2) return null;
  return (
    <div class="fl-pick fl-pick--scroll" role="group" aria-label={label}>
      {list.map((m) => <button type="button" key={m.id} class="fl-filter" aria-pressed={value === m.id} onClick={() => set(m.id)}>{m.id === S.me.id ? 'Me' : m.name.split(' ')[0]}</button>)}
    </div>
  );
}

// The "+" sheet: type, optionally tap a person and a date, Add. Owner defaults to me; the budget comes from the page.
export function QuickAdd({ close, budgetId = null }) {
  const [title, setTitle] = useState(''), [owner, setOwner] = useState(S.me.id), [due, setDue] = useState(null), box = useRef();
  useEffect(() => { const id = setTimeout(() => box.current?.focus(), 50); return () => clearTimeout(id); }, []);
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ title, ownerUid: owner, dueDate: due, budgetId });
    close();
  };
  return (
    <Sheet label="Add a task" onClose={close} low>
      <form class="fl-qs" onSubmit={submit}>
        <input ref={box} class="fl-input" maxLength={120} placeholder="What needs doing?" aria-label="Task" enterkeyhint="done" value={title} onInput={(e) => setTitle(e.target.value)} />
        <PeopleChips value={owner} set={setOwner} list={assignable(S.me, S.members)} label="Who does it" />
        <DueChips value={due} set={setDue} />
        <button class="fl-btn fl-btn--red fl-btn--block" disabled={!title.trim()}>Add task</button>
      </form>
    </Sheet>
  );
}

function TaskSheet({ t, close }) {
  const [reason, setReason] = useState(null), [on, setOn] = useState(t.waitingOnUid || (t.assignerUid !== S.me.id ? t.assignerUid : null));
  const move = canMove(t), edit = canEdit(t), budget = S.budgets.find((b) => b.id === t.budgetId);
  const pick = (s) => { if (s === 'blocked') return setReason(t.blockedReason || ''); setStatus(t, s); close(); };
  const people = S.members.filter((m) => m.active && m.id !== t.ownerUid).sort((a, b) => (b.id === on) - (a.id === on) || a.name.localeCompare(b.name));
  return (
    <Sheet label={t.title} onClose={close} low>
      <div class="fl-qs">
        <h2 class="fl-h2">{t.title}</h2>
        <p class="fl-small fl-muted">{fullName(S.members, t.ownerUid)}{t.assignerUid !== t.ownerUid && ` · from ${firstName(t.assignerUid)}`}{t.dueDate && ` · due ${fmtDay(t.dueDate)}`}{budget && ` · ${budget.name}`}</p>
        {t.status === 'blocked' && reason === null && <p>{waitingLine(t, S.members)}</p>}
        {move && reason === null && <div class="fl-seg fl-seg--fill" role="group" aria-label="Status">{STATUS.map(([k, l]) => <button key={k} aria-pressed={t.status === k} onClick={() => pick(k)}>{l}</button>)}</div>}
        {reason !== null && (
          <form class="fl-qs" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) { setStatus(t, 'blocked', reason, on); close(); } }}>
            <input class="fl-input" autoFocus maxLength={140} placeholder="What are you waiting for? One line." aria-label="Reason" value={reason} onInput={(e) => setReason(e.target.value)} />
            <PeopleChips value={on} set={setOn} list={people} label="Waiting on" />
            <button class="fl-btn fl-btn--red fl-btn--block" disabled={!reason.trim()}>Mark blocked</button>
          </form>
        )}
        {edit && reason === null && <>
          <DueChips value={t.dueDate} set={(d) => editTask(t, { dueDate: d })} />
          <PeopleChips value={t.ownerUid} set={(u) => { if (u !== t.ownerUid) { editTask(t, { ownerUid: u }); close(); } }} list={assignable(S.me, S.members)} label="Owner" />
          <button class="fl-linkbtn fl-quiet" onClick={() => removeTask(t) && close()}>Delete task</button>
        </>}
      </div>
    </Sheet>
  );
}

export const Section = ({ title, n, tone = '', children }) => (
  <section class="fl-sec"><h2 class={`fl-sec__h ${tone}`}>{title}{n != null && <span class="fl-mono"> {n}</span>}</h2>{children}</section>
);
// An empty section is one quiet line, never a card.
export const Quiet = ({ children }) => <p class="fl-quiet">{children}</p>;

const VIEWS = [['mine', 'Mine'], ['given', 'Given'], ['all', 'Everyone']];
export function Tasks({ q }) {
  const [v, setV] = useState(q?.get('v') || 'mine'), [showDone, setShowDone] = useState(v === 'given');
  useEffect(() => { document.title = 'Tasks · Council'; }, []);
  const boss = isBossRole(S.me), views = boss ? [...VIEWS, ['people', 'Overdue']] : VIEWS;
  const list = S.tasks.filter((t) => (v === 'mine' ? t.ownerUid === S.me.id : v === 'given' ? t.assignerUid === S.me.id && t.ownerUid !== S.me.id : true));
  const g = groupTasks(list), who = v !== 'mine', weekAgo = Date.now() - 7 * 86400e3;
  const done = g.done.filter((t) => (t.doneAt || 0) >= weekAgo);
  const rows = (l, reopen) => l.map((t) => <TaskRow key={t.id} t={t} who={who} reopen={reopen} />);
  const open = g.overdue.length + g.week.length + g.later.length + g.blocked.length;
  return (
    <>
      <div class="fl-seg fl-seg--fill" role="group" aria-label="Which tasks">{views.map(([k, l]) => <button key={k} aria-pressed={v === k} onClick={() => setV(k)}>{l}</button>)}</div>
      {v === 'people' ? <People /> : <>
        {g.overdue.length > 0 && <Section title="Overdue" n={g.overdue.length} tone="is-late">{rows(g.overdue)}</Section>}
        {g.week.length > 0 && <Section title="This week" n={g.week.length}>{rows(g.week)}</Section>}
        {g.later.length > 0 && <Section title="Later" n={g.later.length}>{rows(g.later)}</Section>}
        {g.blocked.length > 0 && <Section title="Blocked" n={g.blocked.length}>{rows(g.blocked)}</Section>}
        {!open && <Quiet>{v === 'mine' ? 'No open tasks. Tap + to add one.' : v === 'given' ? 'Nothing you gave out is open.' : 'No open tasks.'}</Quiet>}
        {done.length > 0 && (showDone ? <Section title="Done, last 7 days" n={done.length}>{rows(done, true)}</Section>
          : <button class="fl-linkbtn fl-quiet" onClick={() => setShowDone(true)}>Show {done.length} done this week</button>)}
      </>}
    </>
  );
}

// Executives: who is late, and by how many tasks. Tap a name to see them.
function People() {
  const [uid, setUid] = useState(null), rows = overdueByPerson(S.tasks, S.members);
  if (!rows.length) return <Quiet>Nobody has an overdue task.</Quiet>;
  return (
    <Section title="Overdue by person" tone="is-late">
      {rows.map((r) => (
        <div key={r.uid}>
          <button class="fl-line" aria-expanded={uid === r.uid} onClick={() => setUid(uid === r.uid ? null : r.uid)}><span>{r.name}</span><b class="fl-mono fl-late">{r.count}</b></button>
          {uid === r.uid && groupTasks(S.tasks.filter((t) => t.ownerUid === r.uid)).overdue.map((t) => <TaskRow key={t.id} t={t} />)}
        </div>
      ))}
    </Section>
  );
}
