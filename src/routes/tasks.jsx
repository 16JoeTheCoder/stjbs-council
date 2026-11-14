// Tasks: the flat row (one tap completes), the edit panel (side panel on laptop, sheet on phone, same parser as quick
// add), and the Tasks tab with its views, day groups, keyboard and drag.
import { useEffect, useRef, useState } from 'preact/hooks';
import { S, set, toast } from '../store.js';
import { addDays, fmtDay, isoDay } from '../time.js';
import { STATUS, between, daysLate, fullName, groupDays, isBossRole, overdueByPerson, rank, waitingLine } from '../work-model.js';
import { editTask, removeTask, setStatus } from '../work-actions.js';
import { parse, parseDate, dueLabel } from '../quickadd.js';
import { DatePicker, EventPicker, PRI, PeoplePicker, PriorityPicker, eventsFor } from '../quick-add.jsx';
import { Icon, Sheet } from '../shared.jsx';
import { Chip } from '../ui.jsx';

const firstName = (uid) => fullName(S.members, uid).split(' ')[0];
const canEdit = (t) => S.me.role !== 'teacher' && (t.assignerUid === S.me.id || isBossRole(S.me));
const canMove = (t) => S.me.role !== 'teacher' && (t.ownerUid === S.me.id || canEdit(t));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const openTask = (t, field = null) => set({ panel: { id: t.id, field } });

// One tap: the ring fills, the check draws, the row folds away, and Undo waits in the toast.
function Tick({ t }) {
  const done = t.status === 'done', p = t.priority || 4;
  if (!canMove(t)) return <span class="fl-tick-slot" />;
  const go = (e) => {
    const row = e.currentTarget.closest('.fl-t');
    if (done) return setStatus(t, 'todo');
    row?.classList.add('is-completing');
    setTimeout(() => setStatus(t, 'done'), calm() ? 0 : 420);
  };
  return (
    <button type="button" class={`fl-tick fl-tick--p${p}`} role="checkbox" aria-checked={done} aria-label={`Complete ${t.title}`} onClick={go}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>
    </button>
  );
}

// who: show the owner (lists that mix people). reopen: the assigner's one-tap button on done rows.
export function TaskRow({ t, who, reopen }) {
  const today = isoDay(), late = daysLate(t, today), done = t.status === 'done';
  const ev = t.budgetId && S.budgets.find((b) => b.id === t.budgetId);
  const when = !t.dueDate ? '' : late ? `${fmtDay(t.dueDate)} · ${late}d late` : dueLabel({ date: t.dueDate, time: t.dueTime });
  return (
    <div class={`fl-t${late ? ' fl-t--overdue' : ''}${done ? ' fl-t--done' : ''}${t.status === 'blocked' ? ' fl-t--blocked' : ''}`} data-id={t.id}>
      <Tick t={t} />
      <button class="fl-t__main" onClick={() => openTask(t)}>
        <span class="fl-t__title">{t.title}</span>
        {(when || who || ev || t.status !== 'todo') && (
          <span class="fl-t__meta">
            {when && <span class={`fl-t__when${late ? ' is-late' : ''}`}><Icon n="calendar" />{when}</span>}
            {t.status === 'blocked' && <span class="fl-t__wait">{waitingLine(t, S.members)}</span>}
            {t.status === 'doing' && <span>In progress</span>}
            {ev && <span class="fl-t__ev">{ev.name}</span>}
          </span>
        )}
      </button>
      {who && t.ownerUid !== S.me.id && <Chip email={t.ownerUid} />}
      {reopen && done && canEdit(t) && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setStatus(t, 'todo')}>Reopen</button>}
    </div>
  );
}

// The edit panel. Every field takes typed words through the same parser: "fri" in the date field, "@mike" in the title.
export function TaskPanel() {
  const t = S.panel && S.tasks.find((x) => x.id === S.panel.id);
  const [pop, setPop] = useState(null), [reason, setReason] = useState(null), [dateText, setDateText] = useState(null), [title, setTitle] = useState(null);
  const dateRef = useRef();
  useEffect(() => { setPop(null); setReason(null); setDateText(null); setTitle(null); }, [S.panel?.id]);
  useEffect(() => { if (S.panel?.field === 'date') setTimeout(() => dateRef.current?.focus(), 60); }, [S.panel]);
  if (!t) return null;
  const close = () => (pop ? setPop(null) : set({ panel: null }));
  const edit = canEdit(t), move = canMove(t), ev = S.budgets.find((b) => b.id === t.budgetId);
  const ctx = { now: new Date(), me: S.me, members: S.members, events: eventsFor() };
  const saveTitle = () => {
    if (title == null) return;
    const r = parse(title, ctx), patch = {};
    if (r.title && r.title !== t.title) patch.title = r.title.slice(0, 120);
    if (r.due) Object.assign(patch, { dueDate: r.due.date, dueTime: r.due.time || null });
    if (r.event) patch.budgetId = r.event.id;
    if (r.priority) patch.priority = r.priority;
    if (r.assignee && !r.blocked) patch.ownerUid = r.assignee.id;
    if (Object.keys(patch).length) editTask(t, patch);
    setTitle(null);
  };
  const typed = dateText?.trim() ? parseDate(dateText) : null;
  const saveDate = (d) => { editTask(t, { dueDate: d?.date || null, dueTime: d?.time || null }); setDateText(null); setPop(null); };
  const people = S.members.filter((m) => m.active && m.id !== t.ownerUid);
  const field = (k, icon, label, value, picker, ok = edit) => (
    <div class="fl-tp__row">
      <span class="fl-tp__label"><Icon n={icon} />{label}</span>
      {ok ? <button class="fl-tp__val" aria-expanded={pop === k} onClick={() => setPop(pop === k ? null : k)}>{value}</button> : <span class="fl-tp__val is-static">{value}</span>}
      {pop === k && <div class="fl-tp__pop">{picker}</div>}
    </div>
  );
  return (
    <Sheet label={t.title} onClose={close} side>
      <div class="fl-tp">
        <div class="fl-tp__head">
          <Tick t={t} />
          {edit ? <textarea class="fl-tp__title" rows={1} maxLength={200} aria-label="Title" value={title ?? t.title}
            onInput={(e) => { setTitle(e.target.value); e.target.style.height = '0'; e.target.style.height = `${e.target.scrollHeight}px`; }}
            onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
            : <h2 class="fl-tp__title">{t.title}</h2>}
        </div>
        {title != null && <p class="fl-help">Typing fri, @name, #event or p1 here sets that field when you leave the title.</p>}
        <p class="fl-small fl-muted">From {t.assignerUid === S.me.id ? 'you' : firstName(t.assignerUid)}{t.status === 'blocked' && ` · ${waitingLine(t, S.members)}`}</p>

        <div class="fl-tp__fields">
          <div class="fl-tp__row">
            <span class="fl-tp__label"><Icon n="calendar" />Date</span>
            {edit ? <input ref={dateRef} class={`fl-tp__val fl-tp__date${daysLate(t) ? ' is-late' : ''}`} aria-label="Due date. Type fri, besok or 15 nov" placeholder="No date"
              value={dateText ?? (t.dueDate ? dueLabel({ date: t.dueDate, time: t.dueTime }) : '')}
              onFocus={(e) => e.target.select()} onInput={(e) => setDateText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!dateText?.trim()) saveDate(null); else if (typed) saveDate(typed); } if (e.key === 'Escape' && dateText != null) { e.stopPropagation(); setDateText(null); } }}
              onBlur={() => { if (typed) saveDate(typed); else if (dateText != null && !dateText.trim()) saveDate(null); else setDateText(null); }} />
              : <span class="fl-tp__val is-static">{t.dueDate ? dueLabel({ date: t.dueDate, time: t.dueTime }) : 'No date'}</span>}
            {edit && <button class="fl-iconbtn fl-tp__cal" aria-label="Date shortcuts" aria-expanded={pop === 'date'} onClick={() => setPop(pop === 'date' ? null : 'date')}><Icon n="right" /></button>}
            {dateText?.trim() && <span class={`fl-tp__hint${typed ? '' : ' is-warn'}`}>{typed ? dueLabel(typed) : 'Not a date yet'}</span>}
            {pop === 'date' && <div class="fl-tp__pop"><DatePicker onPick={saveDate} /></div>}
          </div>
          {field('who', 'user', 'Assignee', <span class="fl-person"><Chip email={t.ownerUid} /><span>{fullName(S.members, t.ownerUid)}</span></span>,
            <PeoplePicker ctx={{ ...ctx, members: S.members }} onPick={(m) => { setPop(null); if (m.id !== t.ownerUid) editTask(t, { ownerUid: m.id }); }} />)}
          {field('event', 'wallet', 'Event', ev?.name || 'None', <EventPicker onPick={(e) => { setPop(null); editTask(t, { budgetId: e.id }); }} />)}
          {field('pri', 'flag', 'Priority', <span class={`fl-flag fl-flag--p${t.priority || 4}`}>{PRI[(t.priority || 4) - 1][1]}</span>,
            <PriorityPicker onPick={(p) => { setPop(null); editTask(t, { priority: p.id }); }} />)}
        </div>

        {move && reason === null && (
          <div class="fl-seg fl-seg--fill" role="group" aria-label="Status">
            {STATUS.map(([k, l]) => <button key={k} aria-pressed={t.status === k} onClick={() => (k === 'blocked' ? setReason(t.blockedReason || '') : setStatus(t, k))}>{l}</button>)}
          </div>
        )}
        {reason !== null && <Blocked t={t} reason={reason} setReason={setReason} people={people} />}
        {edit && <button class="fl-linkbtn fl-quiet" onClick={() => removeTask(t) && set({ panel: null })}>Delete task</button>}
      </div>
    </Sheet>
  );
}
function Blocked({ t, reason, setReason, people }) {
  const [on, setOn] = useState(t.waitingOnUid || (t.assignerUid !== S.me.id ? t.assignerUid : null)), [pick, setPick] = useState(false);
  return (
    <form class="fl-qs" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) { setStatus(t, 'blocked', reason, on); setReason(null); } }}>
      <input class="fl-input" autoFocus maxLength={140} placeholder="What are you waiting for? One line." aria-label="Reason" value={reason} onInput={(e) => setReason(e.target.value)} />
      <div class="fl-tp__row">
        <span class="fl-tp__label"><Icon n="user" />Waiting on</span>
        <button type="button" class="fl-tp__val" aria-expanded={pick} onClick={() => setPick(!pick)}>{on ? fullName(S.members, on) : 'Someone'}</button>
        {pick && <div class="fl-tp__pop"><PeoplePicker ctx={{ now: new Date(), me: S.me, members: people }} onPick={(m) => { setOn(m.id); setPick(false); }} /></div>}
      </div>
      <button class="fl-btn fl-btn--red fl-btn--block" disabled={!reason.trim()}>Mark blocked</button>
    </form>
  );
}

export const Section = ({ title, n, tone = '', children, extra }) => (
  <section class="fl-sec"><h2 class={`fl-sec__h ${tone}`}>{title}{n != null && <span class="fl-mono"> {n}</span>}{extra}</h2>{children}</section>
);
// An empty section is one quiet line, never a card.
export const Quiet = ({ children }) => <p class="fl-quiet">{children}</p>;

// ---------- Drag: a mouse drags after 6 px, a finger after a short hold (so scrolling still works).
// Drop on a row to reorder, or on a day in the strip to reschedule.
function useDrag(list) {
  const [drag, setDrag] = useState(null);
  const st = useRef(null);
  useEffect(() => {
    const move = (e) => {
      const s = st.current;
      if (!s) return;
      if (!s.on) {
        if (s.touch) { if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) { clearTimeout(s.timer); st.current = null; } return; }
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
        s.on = true;
      }
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY), day = el?.closest('[data-day]'), row = el?.closest('.fl-t[data-id]');
      const over = day ? { day: day.dataset.day } : row && row.dataset.id !== s.t.id ? { id: row.dataset.id, after: e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2 } : null;
      setDrag({ t: s.t, x: e.clientX, y: e.clientY, over });
    };
    const up = () => {
      const s = st.current; st.current = null;
      if (s) clearTimeout(s.timer);
      setDrag((d) => { if (s?.on && d?.over) drop(d.t, d.over); return null; });
    };
    const drop = (t, over) => {
      if (over.day) {
        if (!canEdit(t)) return toast(`Only ${firstName(t.assignerUid)} can change this date.`);
        if (over.day !== t.dueDate) editTask(t, { dueDate: over.day });
        return;
      }
      const ids = list.current.map((x) => x.id), at = ids.indexOf(over.id);
      if (at < 0 || !canMove(t)) return;
      const rest = list.current.filter((x) => x.id !== t.id), i = rest.findIndex((x) => x.id === over.id) + (over.after ? 1 : 0);
      editTask(t, { order: between(rest[i - 1] && rank(rest[i - 1]), rest[i] && rank(rest[i])) }, true);
    };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
  }, []);
  const onPointerDown = (e) => {
    const row = e.target.closest('.fl-t[data-id]');
    if (!row || e.target.closest('.fl-tick, .fl-btn') || e.button > 0) return;
    const t = S.tasks.find((x) => x.id === row.dataset.id);
    if (!t || !canMove(t)) return;
    const s = { t, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', on: false };
    if (s.touch) s.timer = setTimeout(() => { s.on = true; s.touch = false; navigator.vibrate?.(10); setDrag({ t, x: s.x, y: s.y, over: null }); }, 280);
    st.current = s;
  };
  return { drag, onPointerDown };
}
function DayStrip({ drag }) {
  const today = isoDay(), days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  return (
    <div class={`fl-days${drag ? ' is-live' : ''}`} aria-label="Drop a task on a day to move it">
      {days.map((d) => { const [w, n] = fmtDay(d).split(' '); return (
        <span key={d} data-day={d} class={`fl-day${drag?.over?.day === d ? ' is-over' : ''}`}><small>{w}</small><b class="fl-mono">{n}</b></span>
      ); })}
    </div>
  );
}

const VIEWS = [['mine', 'Mine'], ['given', 'Given'], ['all', 'Everyone'], ['late', 'Overdue']];
const readView = () => { try { return localStorage.getItem('council-tasks-view'); } catch { return null; } };
export function Tasks({ q }) {
  const [v, setV] = useState(q?.get('v') || readView() || 'mine'), [showDone, setShowDone] = useState(false);
  const list = useRef([]), host = useRef();
  const { drag, onPointerDown } = useDrag(list);
  useEffect(() => { document.title = 'Tasks · Council'; }, []);
  useEffect(() => { try { localStorage.setItem('council-tasks-view', v); } catch {} setShowDone(v === 'given'); }, [v]);
  // J and K move, E completes, T sets the date, Enter opens. Q and / live in the shell.
  useEffect(() => {
    const k = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], .fl-sheet')) return;
      const rows = [...(host.current?.querySelectorAll('.fl-t[data-id]') || [])], cur = rows.findIndex((r) => r.contains(document.activeElement));
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') { e.preventDefault(); const r = rows[Math.max(0, Math.min(rows.length - 1, cur < 0 ? 0 : cur + (key === 'j' ? 1 : -1)))]; r?.querySelector('.fl-t__main')?.focus(); }
      const t = cur >= 0 && S.tasks.find((x) => x.id === rows[cur].dataset.id);
      if (!t) return;
      if (key === 'e') { e.preventDefault(); rows[cur].querySelector('.fl-tick')?.click(); rows[cur + 1]?.querySelector('.fl-t__main')?.focus(); }
      if (key === 't') { e.preventDefault(); openTask(t, 'date'); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const mine = (t) => t.ownerUid === S.me.id;
  const shown = S.tasks.filter((t) => (v === 'mine' ? mine(t) : v === 'given' ? t.assignerUid === S.me.id && !mine(t) : true));
  const g = groupDays(v === 'late' ? [] : shown), who = v !== 'mine', weekAgo = Date.now() - 7 * 86400e3;
  const done = g.done.filter((t) => (t.doneAt || 0) >= weekAgo);
  list.current = [...g.overdue, ...g.today, ...g.upcoming, ...g.nodate];
  const rows = (l, reopen) => l.map((t) => <TaskRow key={t.id} t={t} who={who} reopen={reopen} />);
  const open = list.current.length;
  return (
    <div class={`fl-tasks${drag ? ' is-dragging' : ''}`} ref={host} onPointerDown={onPointerDown}>
      <div class="fl-views" role="tablist" aria-label="Which tasks">
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={v === k} onClick={() => setV(k)}>{l}</button>)}
      </div>
      {v === 'late' ? <People /> : <>
        {g.overdue.length > 0 && <Section title="Overdue" n={g.overdue.length} tone="is-late">{rows(g.overdue)}</Section>}
        <Section title="Today" n={g.today.length || null}>{g.today.length ? rows(g.today) : <Quiet>Nothing due today.</Quiet>}</Section>
        <Section title="Upcoming" n={g.upcoming.length || null}>
          <DayStrip drag={drag} />
          {rows(g.upcoming)}
        </Section>
        {g.nodate.length > 0 && <Section title="No date" n={g.nodate.length}>{rows(g.nodate)}</Section>}
        {S.me.role !== 'teacher' && <button class="fl-addrow" onClick={() => set({ quick: {} })}><Icon n="plus" />Add task</button>}
        {!open && <Quiet>{v === 'mine' ? 'Clear. Press Q or + to add one.' : v === 'given' ? 'Nothing you gave out is open.' : 'No open tasks.'}</Quiet>}
        {done.length > 0 && (showDone ? <Section title="Done, last 7 days" n={done.length}>{rows(done, true)}</Section>
          : <button class="fl-linkbtn fl-quiet" onClick={() => setShowDone(true)}>Show {done.length} done this week</button>)}
      </>}
      {drag?.x != null && <div class="fl-ghost" style={{ transform: `translate(${drag.x + 12}px, ${drag.y - 18}px)` }} aria-hidden="true">{drag.t.title}</div>}
      {drag?.over?.id && <style>{`.fl-t[data-id="${CSS.escape(drag.over.id)}"]{box-shadow:inset 0 ${drag.over.after ? -2 : 2}px 0 var(--red)}`}</style>}
    </div>
  );
}

// Overdue across the council, by person, worst first. Tap a name to see their late tasks.
function People() {
  const [uid, setUid] = useState(null), rows = overdueByPerson(S.tasks, S.members);
  if (!rows.length) return <Quiet>Nobody has an overdue task.</Quiet>;
  return (
    <Section title="Overdue by person" tone="is-late">
      {rows.map((r) => (
        <div key={r.uid}>
          <button class="fl-line" aria-expanded={uid === r.uid} onClick={() => setUid(uid === r.uid ? null : r.uid)}><span>{r.name}</span><b class="fl-mono fl-late">{r.count}</b></button>
          {uid === r.uid && groupDays(S.tasks.filter((t) => t.ownerUid === r.uid)).overdue.map((t) => <TaskRow key={t.id} t={t} />)}
        </div>
      ))}
    </Section>
  );
}
