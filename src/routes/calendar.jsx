// Calendar: a full-viewport tool. Week (00:00 to 24:00, 24 px per 15 minutes), Month and Agenda share one toolbar,
// one right rail and one empty-state wording. Dates are Jakarta 'YYYY-MM-DD' strings, so boundaries are string maths.
// The store listens to -7..+60 days; a page turn outside that window reads the visible range once.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName } from '../store.js';
import { isAdmin, tree } from '../model.js';
import { archiveEvent, rsvp } from '../actions.js';
import { calendarLanes, eventDefaults, remainingEvents, resolveParticipants } from '../event-model.js';
import { loadEventRequestHistory, saveEventProposal, transitionEventRequest, useEventPolicy } from '../event-actions.js';
import { addDays, addMonths, fmtDay, isoDay, monday, monthName, monthStart, toMin } from '../time.js';
import { EVENT_AHEAD_DAYS, EVENT_BACK_DAYS, eventsQuery } from '../queries.js';
import { Icon, Sheet } from '../shared.jsx';
import { Title } from '../ui.jsx';
import { EventTag } from './home.jsx';
import { wa } from './projects.jsx';
import { MiniMonth, TimeField, orgData, useDismiss } from '../pickers.jsx';
import { EventEditor } from './event-editor.jsx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const PX = 1.6; // 24 px per 15 minutes
const EV_CLASS = { meeting: 'fl-ev', project: 'fl-ev fl-ev--deep', committee: 'fl-ev fl-ev--committee', other: 'fl-ev fl-ev--quiet' };
export const evClass = (t) => EV_CLASS[t] || 'fl-ev';
const TYPES = [['meeting', 'Meeting'], ['project', 'Project'], ['committee', 'Committee'], ['other', 'Other']];
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (min) => `${pad(Math.floor(Math.min(min, 1439) / 60))}:${pad(Math.min(min, 1439) % 60)}`;
const nowMin = () => toMin(new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16));
const lastDay = (e) => (e.allDay && e.endDate > e.date ? e.endDate : e.date);
export const canAddEvents = () => S.me?.role !== 'teacher';
export const EMPTY = () => (canAddEvents() ? 'Nothing planned for these dates. Click a time in Week view, or press N, to add an event.' : 'Nothing planned for these dates.');

const go = (patch, q, replace) => {
  const p = new URLSearchParams(q);
  for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
  const h = `#/calendar?${p}`;
  if (replace) history.replaceState(null, '', h); else location.hash = h;
  if (replace) dispatchEvent(new HashChangeEvent('hashchange'));
};
function rangeLabel(from, to) {
  const y = isoDay().slice(0, 4), a = new Date(Date.parse(from)), b = new Date(Date.parse(to));
  const yr = to.slice(0, 4) !== y ? ` ${to.slice(0, 4)}` : '';
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} to ${b.getUTCDate()} ${MON[b.getUTCMonth()]}${yr}`
    : `${a.getUTCDate()} ${MON[a.getUTCMonth()]} to ${b.getUTCDate()} ${MON[b.getUTCMonth()]}${yr}`;
}

// Events for [from, to]: the store's window, plus a one-off read when the range leaves it.
export function useEvents(from, to, tick) {
  const today = isoDay(), lo = addDays(today, -EVENT_BACK_DAYS), hi = addDays(today, EVENT_AHEAD_DAYS);
  const outside = from < lo || to > hi, [extra, setExtra] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!outside) return undefined;
    let live = true;
    setExtra([]); setError(''); setLoading(true);
    getDocs(eventsQuery(S.term.termId, today, addDays(from, -14), to)).then(
      (s) => { if (live) { setExtra(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); } },
      () => { if (live) { setError('Events for these dates did not load. Check your connection.'); setLoading(false); } },
    );
    return () => { live = false; };
  }, [from, to, outside, tick]);
  const byId = new Map([...(outside ? extra : []), ...S.events].map((e) => [e.id, e]));
  return {
    events: [...byId.values()].filter((e) => !e.archived && lastDay(e) >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
    error: outside ? error : '', loading: outside && loading,
  };
}
// Deadlines: root projects and their teams with a due date. One look in Week and Month.
const deadlines = (from, to) => S.items.filter((r) => (r.kind === 'project' || r.kind === 'team') && r.dueDate && r.dueDate >= from && r.dueDate <= to && tree().byId[r.id]);
const Due = ({ r, compact }) => (
  <a class={compact ? 'fl-mchip fl-mchip--due' : 'fl-ev fl-ev--due'} href={`#/p/${r.id}`} title={`Due: ${r.title}`} onClick={(e) => e.stopPropagation()}>
    <Icon n="pin" /><span>Due: {r.title}</span>
  </a>
);

// ---------- Week

function useNow() {
  const [m, setM] = useState(nowMin());
  useEffect(() => { const t = setInterval(() => setM(nowMin()), 60e3); return () => clearInterval(t); }, []);
  return m;
}

function AllDayRow({ days, events, dues, open }) {
  const [more, setMore] = useState(false);
  const idx = (d) => Math.max(0, Math.min(6, Math.round((Date.parse(d) - Date.parse(days[0])) / 864e5)));
  const items = [
    ...events.map((e) => ({ key: e.id, a: idx(e.date < days[0] ? days[0] : e.date), b: idx(lastDay(e) > days[6] ? days[6] : lastDay(e)), node: (
      <button class={`${evClass(e.type)} fl-ev--bar`} onClick={() => open(e)} title={e.title}>
        <span>{e.title}</span>{lastDay(e) > e.date && <small>{fmtDay(e.date)} to {fmtDay(lastDay(e))}</small>}
      </button>) })),
    ...dues.map((r) => ({ key: `due-${r.id}`, a: idx(r.dueDate), b: idx(r.dueDate), node: <Due r={r} /> })),
  ].sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
  const rows = [];
  for (const it of items) {
    let r = rows.findIndex((row) => row.every((o) => o.b < it.a || o.a > it.b));
    if (r < 0) { r = rows.length; rows.push([]); }
    rows[r].push(it); it.row = r;
  }
  const cap = 2, hidden = (d) => items.filter((it) => it.row >= cap && it.a <= d && it.b >= d).length;
  const shown = more ? items : items.filter((it) => it.row < cap);
  return (
    <div class="fl-week__allday">
      <div class="fl-week__corner fl-caption">{rows.length > cap ? <button class="fl-linkbtn fl-linkbtn--quiet fl-small" onClick={() => setMore(!more)}>{more ? 'Show less' : 'All day'}</button> : 'All day'}</div>
      <div class="fl-week__adgrid" style={{ gridTemplateRows: `repeat(${Math.max(1, more ? rows.length : Math.min(rows.length, cap + (rows.length > cap ? 1 : 0)))}, 28px)` }}>
        {days.map((d, i) => <div key={d} class={`fl-week__adcell${i > 4 ? ' is-weekend' : ''}`} style={{ gridColumn: i + 1, gridRow: '1 / -1' }} />)}
        {shown.map((it) => <div key={it.key} class="fl-week__aditem" style={{ gridColumn: `${it.a + 1} / ${it.b + 2}`, gridRow: it.row + 1 }}>{it.node}</div>)}
        {!more && rows.length > cap && days.map((d, i) => hidden(i) > 0 && (
          <button key={`m${d}`} class="fl-week__admore" style={{ gridColumn: i + 1, gridRow: cap + 1 }} onClick={() => setMore(true)} aria-label={`${hidden(i)} more on ${fmtDay(d)}`}>+{hidden(i)}</button>
        ))}
      </div>
    </div>
  );
}

function Week({ start, events, open, onSlot, draft }) {
  const today = isoDay(), days = DOW.map((_, i) => addDays(start, i)), box = useRef(), now = useNow();
  const timed = events.filter((e) => !e.allDay && e.start && e.end), allDay = events.filter((e) => e.allDay);
  const dues = deadlines(start, days[6]), [drag, setDrag] = useState(null);
  // Busy days get wider columns, so side-by-side events keep readable titles.
  const laid = days.map((d) => calendarLanes(timed.filter((e) => e.date === d)));
  const cols = laid.map((l) => { const n = Math.max(1, ...l.map((e) => e.calendarLanes)); return `minmax(${n > 1 ? n * 52 : 72}px, ${1 + (n - 1) * 0.6}fr)`; }).join(' ');
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const target = Math.max(nowMin(), 7 * 60);
    el.scrollTop = Math.max(0, (target - 60) * PX);
    const col = el.querySelector('[aria-current="date"]');
    if (col && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, col.offsetLeft - 56);
  }, [start]);
  // Click or drag on an empty slot: 15-minute steps, at least 15 minutes, default an hour.
  const minAt = (e, col) => Math.max(0, Math.min(1425, Math.floor((e.clientY - col.getBoundingClientRect().top) / PX / 15) * 15));
  const down = (e, day) => {
    if (e.button !== 0 || e.target !== e.currentTarget || !canAddEvents()) return;
    const col = e.currentTarget, a = minAt(e, col);
    col.setPointerCapture(e.pointerId);
    setDrag({ day, a, b: a + 15, moved: false, col });
  };
  const move = (e) => { if (!drag) return; const b = minAt(e, drag.col) + 15; if (b !== drag.b) setDrag({ ...drag, b: Math.max(b, drag.a + 15), moved: true }); };
  const up = () => {
    if (!drag) return;
    const end = drag.moved ? drag.b : Math.min(1439, drag.a + 60), r = drag.col.getBoundingClientRect();
    onSlot({ date: drag.day, start: hhmm(drag.a), end: hhmm(end), x: r.left + r.width / 2, y: r.top + drag.a * PX });
    setDrag(null);
  };
  const ghost = draft && days.includes(draft.date) ? draft : drag && { date: drag.day, start: hhmm(drag.a), end: hhmm(drag.b) };
  return (
    <div class="fl-week" ref={box} tabIndex={-1}>
      <div class="fl-week__inner" style={{ '--cols': cols }}>
        <div class="fl-week__head">
          <div class="fl-week__corner fl-caption">GMT+7</div>
          {days.map((d, i) => (
            <button key={d} class={`fl-week__day${i > 4 ? ' is-weekend' : ''}`} aria-current={d === today ? 'date' : undefined} aria-label={fmtDay(d)}
              onClick={() => canAddEvents() && onSlot({ date: d, start: '09:00', end: '10:00', anchor: 'toolbar' })}>
              <span>{DOW[i]}</span><b>{Number(d.slice(8))}</b>
            </button>
          ))}
        </div>
        <AllDayRow days={days} events={allDay} dues={dues} open={open} />
        <div class="fl-week__body" style={{ height: `${1440 * PX}px` }}>
          <div class="fl-week__gutter" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => h > 0 && <span key={h} style={{ top: `${h * 60 * PX}px` }}>{pad(h)}:00</span>)}
            {days.includes(today) && <i class="fl-week__nowdot" style={{ top: `${now * PX}px` }} />}
          </div>
          <div class="fl-week__lines" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} class={i % 2 ? 'is-half' : ''} />)}</div>
          {days.map((d, i) => {
            const list = laid[i];
            return (
              <div key={d} class={`fl-week__col${i > 4 ? ' is-weekend' : ''}`} aria-current={d === today ? 'date' : undefined} role="group" aria-label={fmtDay(d)}
                onPointerDown={(e) => down(e, d)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
                {list.map((e) => {
                  const dur = Math.max(15, toMin(e.end) - toMin(e.start)), h = dur * PX;
                  return (
                    <button key={e.id} class={`${evClass(e.type)} fl-ev--block${dur < 45 ? ' is-short' : ''}`} onClick={() => open(e)}
                      aria-label={`${e.title}, ${e.start} to ${e.end}${e.location ? `, ${e.location}` : ''}`}
                      style={{ top: `${toMin(e.start) * PX}px`, height: `${h - 2}px`, left: `calc(${(e.calendarLane * 100) / e.calendarLanes}% + 2px)`, width: `calc(${100 / e.calendarLanes}% - 4px)` }}>
                      <span class="fl-ev__title">{e.title}</span>{dur >= 45 && <small>{e.start} to {e.end}</small>}
                    </button>
                  );
                })}
                {ghost && ghost.date === d && <div class="fl-ev fl-ev--ghost" style={{ top: `${toMin(ghost.start) * PX}px`, height: `${(toMin(ghost.end) - toMin(ghost.start)) * PX - 2}px` }}><small>{ghost.start} to {ghost.end}</small></div>}
                {d === today && <i class="fl-week__now" style={{ top: `${now * PX}px` }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Month

const MonthChip = ({ e, open }) => (
  <button class="fl-mchip" onClick={(x) => { x.stopPropagation(); open(e); }} title={e.title}>
    <i class={`fl-dot--${e.type}`} aria-hidden="true" /><span class="fl-mono">{e.allDay ? 'All day' : e.start}</span><span class="fl-mchip__t">{e.title}</span>
  </button>
);
function Month({ anchor, events, q, open }) {
  const first = monthStart(anchor), next = addMonths(anchor, 1), today = isoDay(), start = monday(first), cells = [];
  for (let d = start; d < next || cells.length % 7; d = addDays(d, 1)) cells.push(d);
  const dues = deadlines(start, cells.at(-1)), [pop, setPop] = useState(null), popRef = useRef();
  useDismiss(!!pop, () => setPop(null), popRef);
  return (
    <div class="fl-monthv">
      <div class="fl-monthv__head" aria-hidden="true">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <div class="fl-monthv__grid" role="grid" aria-label={monthName(first)} style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(96px, 1fr))` }}>
        {cells.map((d) => {
          const list = events.filter((e) => e.date <= d && lastDay(e) >= d), due = dues.filter((r) => r.dueDate === d);
          const all = [...due.map((r) => ({ due: r })), ...list.map((e) => ({ e }))], cap = 3, rest = all.length - cap;
          return (
            <div key={d} class={`fl-monthv__cell${d.slice(0, 7) === first.slice(0, 7) ? '' : ' is-other'}${[5, 6].includes(cells.indexOf(d) % 7) ? ' is-weekend' : ''}`}
              aria-current={d === today ? 'date' : undefined} onClick={() => go({ v: 'week', d, e: null }, q)}>
              <button class="fl-monthv__num" aria-label={`${fmtDay(d)}, open in Week`} onClick={(x) => { x.stopPropagation(); go({ v: 'week', d, e: null }, q); }}>{Number(d.slice(8))}</button>
              {all.slice(0, rest > 0 ? cap - 1 : cap).map((x) => (x.due ? <Due key={`d${x.due.id}`} r={x.due} compact /> : <MonthChip key={x.e.id} e={x.e} open={open} />))}
              {rest > 0 && <button class="fl-linkbtn fl-small fl-monthv__more" onClick={(x) => { x.stopPropagation(); setPop(d); }} aria-haspopup="dialog">+{rest + 1} more</button>}
              {pop === d && (
                <div class="fl-pop fl-pop--day" role="dialog" aria-label={fmtDay(d)} ref={popRef} onClick={(x) => x.stopPropagation()}>
                  <h4>{fmtDay(d)}</h4>
                  {all.map((x) => (x.due ? <Due key={`d${x.due.id}`} r={x.due} compact /> : <MonthChip key={x.e.id} e={x.e} open={(e) => { setPop(null); open(e); }} />))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Agenda

function Agenda({ start, weeks, events, open, more, loading }) {
  const end = addDays(start, weeks * 7 - 1), dues = deadlines(start, end), days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const list = events.filter((e) => e.date <= d && lastDay(e) >= d), due = dues.filter((r) => r.dueDate === d);
    if (list.length || due.length) days.push({ d, list, due });
  }
  return (
    <div class="fl-agenda">
      {days.map(({ d, list, due }) => (
        <section key={d} class="fl-agenda__day" aria-label={fmtDay(d)}>
          <h2 class="fl-agenda__label" aria-current={d === isoDay() ? 'date' : undefined}>{fmtDay(d)}{d === isoDay() && <span class="fl-tag fl-tag--meeting">Today</span>}</h2>
          <ul class="fl-list">
            {list.map((e) => (
              <li key={e.id} class="fl-arow">
                <span class="fl-date">{MON[Number(e.date.slice(5, 7)) - 1]}<b>{Number(e.date.slice(8))}</b></span>
                <button class="fl-arow__main" onClick={() => open(e)}>
                  <span class="fl-h3">{e.title}</span>
                  <span class="fl-small fl-muted"><span class="fl-mono">{e.allDay ? (lastDay(e) > e.date ? `${fmtDay(e.date)} to ${fmtDay(lastDay(e))}` : 'All day') : `${e.start} to ${e.end}`}</span>{e.location ? ` · ${e.location}` : ''}</span>
                </button>
                <EventTag type={e.type} />
              </li>
            ))}
            {due.map((r) => (
              <li key={r.id} class="fl-arow">
                <span class="fl-date">{MON[Number(d.slice(5, 7)) - 1]}<b>{Number(d.slice(8))}</b></span>
                <a class="fl-arow__main" href={`#/p/${r.id}`}><span class="fl-h3">{r.title}</span><span class="fl-small fl-muted">Deadline</span></a>
                <span class="fl-tag">Due</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!loading && !days.length && <p class="fl-empty">{EMPTY()}</p>}
      <div class="fl-actions fl-agenda__end"><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={more}>Load next week</button>
        <span class="fl-small fl-muted">Showing {fmtDay(start)} to {fmtDay(end)}</span></div>
    </div>
  );
}

// ---------- Quick create

function QuickCreate({ slot, policy, close, full, saved }) {
  const ref = useRef(), [v, setV] = useState({ title: '', type: 'other', start: slot.start, end: slot.end }), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useDismiss(true, close, ref);
  useEffect(() => { ref.current?.querySelector('input')?.focus(); }, []);
  const tpl = policy.templates.find((t) => t.id === policy.settings?.defaultTemplateId && t.available !== false) || null;
  const approval = eventDefaults(policy.settings, tpl, { type: v.type }).approval;
  const asRequest = !isAdmin() && approval === 'required';
  const save = async (e) => {
    e.preventDefault();
    if (!v.title.trim()) { setErr('Add a title to save.'); ref.current.querySelector('input').focus(); return; }
    if (v.end <= v.start) { setErr('The end time must be after the start.'); return; }
    setBusy(true);
    const d = eventDefaults(policy.settings, tpl, { type: v.type });
    const ok = await saveEventProposal({ data: { ...d, title: v.title.trim().slice(0, 80), type: v.type, date: slot.date, start: v.start, end: v.end, allDay: false, public: false, customValues: {}, itemId: d.itemId || null }, templateId: tpl?.id || null });
    setBusy(false);
    if (ok) { saved(); close(); }
  };
  const W = 320, x = Math.max(16, Math.min(innerWidth - W - 16, (slot.x ?? innerWidth - W - 40) - W / 2)), y = Math.max(80, Math.min(innerHeight - 340, (slot.y ?? 120) - 20));
  return (
    <form class="fl-quick" role="dialog" aria-label="New event" ref={ref} onSubmit={save} noValidate style={{ left: `${x}px`, top: `${y}px`, width: `${W}px` }}>
      <label class="fl-sr" for="qc-title">Title</label>
      <input id="qc-title" class="fl-input" placeholder={asRequest ? 'Event title for your request' : 'Add a title'} maxLength={80} value={v.title}
        aria-invalid={!!err || undefined} aria-describedby="qc-err" onInput={(e) => setV({ ...v, title: e.target.value })} />
      <div class="fl-seg fl-seg--fit" role="group" aria-label="Type">
        {TYPES.map(([k, l]) => <button type="button" key={k} aria-pressed={v.type === k} onClick={() => setV({ ...v, type: k })}>{l}</button>)}
      </div>
      <div class="fl-quick__when">
        <span class="fl-small">{fmtDay(slot.date)}</span>
        <TimeField id="qc-start" value={v.start} onChange={(s) => setV({ ...v, start: s, end: v.end <= s ? hhmm(toMin(s) + 60) : v.end })} />
        <span class="fl-small fl-muted">to</span>
        <TimeField id="qc-end" value={v.end} after={v.start} onChange={(s) => setV({ ...v, end: s })} />
      </div>
      <p class="fl-small fl-muted">{asRequest ? 'Meetings go to an admin for approval before they appear.' : isAdmin() ? 'Admins can schedule directly.' : 'This appears on the calendar straight away.'}</p>
      <p id="qc-err" class="fl-error" role="alert">{err}</p>
      <div class="fl-actions">
        <button class="fl-btn fl-btn--red fl-btn--sm" disabled={busy}>{busy ? 'Saving…' : asRequest ? 'Send request' : 'Save'}</button>
        <button type="button" class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => full({ ...v, date: slot.date })}>Open full editor</button>
      </div>
    </form>
  );
}

// ---------- Event detail

function EventSheet({ ev, close, edit, duplicate, cancel, archived, groups = [] }) {
  const current = resolveParticipants(ev.participantSelection, S.members, groups, orgData());
  const added = current.filter((u) => !ev.participantUids?.includes(u)), removed = (ev.participantUids || []).filter((u) => !current.includes(u));
  const [rs, setRs] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'rsvps'), where('eventId', '==', ev.id)), (s) => setRs(s.docs.map((d) => d.data())), () => setRs(false)), [ev.id]);
  const mine = rs && rs.find((r) => r.uid === S.me.id)?.status, who = (st) => (rs ? rs.filter((r) => r.status === st) : []);
  const invited = ev.participantUids || [], answered = new Set((rs || []).map((r) => r.uid)), silent = invited.filter((u) => !answered.has(u));
  const canEdit = S.me.role !== 'teacher' && (ev.createdByUid === S.me.id || isAdmin());
  const when = ev.allDay ? (lastDay(ev) > ev.date ? `${fmtDay(ev.date)} to ${fmtDay(lastDay(ev))}` : `${fmtDay(ev.date)} · All day`) : `${fmtDay(ev.date)} · ${ev.start} to ${ev.end}`;
  const text = `${ev.title}\n${when}${ev.location ? `\n${ev.location}` : ''}\n${location.origin}/app/#/calendar?v=week&d=${ev.date}&e=${ev.id}`;
  const first = (u) => memberName(u).split(' ')[0];
  return (
    <Sheet label={ev.title} onClose={close}>
      <span class="fl-eyebrow fl-eyebrow--red fl-mono">{when}</span>
      <h1>{ev.title}</h1>
      <div class="fl-stats">
        <EventTag type={ev.type} />{ev.public && <span class="fl-tag fl-tag--public">Public</span>}
        {ev.location && <span>{ev.location}</span>}
        {ev.itemId && tree().byId[ev.itemId] && <a class="fl-link" href={`#/p/${ev.itemId}`}>{tree().byId[ev.itemId].title}</a>}
      </div>
      {ev.notes && <p class="fl-pre">{ev.notes}</p>}
      <section class="fl-section" aria-label="Replies">
        {rs === false ? <p class="fl-error" role="alert">Replies did not load. Close and open the event to try again.</p> : (
          <>
            <div class="fl-actions">
              <button class={`fl-btn fl-btn--sm ${mine === 'going' ? 'fl-btn--red' : 'fl-btn--ghost'}`} aria-pressed={mine === 'going'} disabled={S.me.role === 'teacher'} onClick={() => rsvp(ev, 'going')}>Going</button>
              <button class={`fl-btn fl-btn--sm ${mine === 'not' ? 'fl-btn--red' : 'fl-btn--ghost'}`} aria-pressed={mine === 'not'} disabled={S.me.role === 'teacher'} onClick={() => rsvp(ev, 'not')}>Can't go</button>
            </div>
            {rs && (rs.length > 0 || invited.length > 0) && (
              <dl class="fl-tally">
                <div><dt>Going</dt><dd class="fl-mono">{who('going').length}</dd></div>
                <div><dt>Can't go</dt><dd class="fl-mono">{who('not').length}</dd></div>
                {invited.length > 0 && <div><dt>No response</dt><dd class="fl-mono">{silent.length}</dd></div>}
              </dl>
            )}
            {rs && who('going').length > 0 && <p class="fl-small fl-muted">Going: {who('going').map((r) => first(r.uid)).join(', ')}</p>}
          </>
        )}
      </section>
      {invited.length > 0 && <details><summary class="fl-small">{invited.length} invited</summary><p class="fl-small fl-muted">{invited.map(memberName).join(', ')}</p></details>}
      {ev.participantSelection && (added.length > 0 || removed.length > 0) && (
        <p class="fl-small fl-muted">Since this was scheduled, {added.length} {added.length === 1 ? 'person has' : 'people have'} joined these groups and {removed.length} left. Edit the event to update the invitations.</p>
      )}
      <div class="fl-actions">
        {ev.type === 'meeting' && <a class="fl-btn fl-btn--ghost fl-btn--sm" href={`#/meeting-hub/${ev.id}`}>Open meeting hub</a>}
        <a class="fl-btn fl-btn--ghost fl-btn--sm" href={wa(text)} target="_blank" rel="noopener noreferrer"><Icon n="share" />Share to WhatsApp</a>
        {canEdit && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={edit}>Edit event</button>}
        {canAddEvents() && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={duplicate}><Icon n="copy" />Duplicate event</button>}
        {canEdit && ev.requestId && cancel && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={cancel}>Cancel event</button>}
        {canEdit && !ev.requestId && (
          <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => confirm(`Archive "${ev.title}"? It disappears from the calendar. You can restore it from the message that follows.`) && archiveEvent(ev).then((ok) => ok && archived())}>Archive event</button>
        )}
      </div>
    </Sheet>
  );
}

// ---------- Requests (rail list and review sheet)

const STATE_WORD = { draft: 'Draft', awaiting: 'Waiting for approval', scheduled: 'Scheduled', 'changes-requested': 'Changes requested', declined: 'Declined', withdrawn: 'Withdrawn', cancelled: 'Cancelled' };
const STATE_BADGE = { awaiting: 'warn', 'changes-requested': 'warn', declined: 'bad', scheduled: 'ok' };
function RequestSheet({ r, close, edit }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const change = async (state) => { setBusy(true); const ok = await transitionEventRequest(r, state, reason); setBusy(false); if (ok) close(); };
  const p = r.proposal, mine = r.createdByUid === S.me.id;
  return (
    <Sheet label={`Request: ${p.title}`} onClose={close}>
      <span class="fl-eyebrow fl-mono">{fmtDay(p.date)} · {p.allDay ? 'All day' : `${p.start} to ${p.end}`}</span>
      <h1>{p.title}</h1>
      <div class="fl-stats"><span class={`fl-badge fl-badge--${STATE_BADGE[r.state] || 'ok'}`}>{STATE_WORD[r.state]}</span><EventTag type={p.type} /><span>{p.location || 'No place set'}</span><span class="fl-muted">From {memberName(r.createdByUid)}</span></div>
      {p.notes && <p class="fl-pre">{p.notes}</p>}
      <p class="fl-small fl-muted">{p.participantUids.length ? `${p.participantUids.length} invited: ${p.participantUids.map((u) => memberName(u).split(' ')[0]).join(', ')}` : 'Nobody invited yet.'}</p>
      {r.replacesEventId && <p class="fl-help">This changes an existing event. The current schedule stays until an admin approves.</p>}
      {r.reviewNote && <p class="fl-small">Admin note: {r.reviewNote}</p>}
      {isAdmin() && r.state === 'awaiting' && (
        <div class="fl-field"><label for={`review-${r.id}`}>Note to {memberName(r.createdByUid).split(' ')[0]} (needed to request changes or decline)</label>
          <textarea id={`review-${r.id}`} class="fl-input" rows={3} maxLength={1000} value={reason} onInput={(e) => setReason(e.target.value)} /></div>
      )}
      <div class="fl-actions">
        {isAdmin() && r.state === 'awaiting' && <>
          <button class="fl-btn fl-btn--red fl-btn--sm" disabled={busy} onClick={() => change('scheduled')}>Approve and schedule</button>
          <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy} onClick={() => { close(); edit(r); }}>Edit and schedule</button>
          <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy || !reason.trim()} onClick={() => change('changes-requested')}>Request changes</button>
          <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy || !reason.trim()} onClick={() => change('declined')}>Decline</button>
        </>}
        {mine && ['draft', 'changes-requested'].includes(r.state) && <button class="fl-btn fl-btn--red fl-btn--sm" disabled={busy} onClick={() => { close(); edit(r); }}>Edit and submit</button>}
        {mine && ['draft', 'awaiting', 'changes-requested'].includes(r.state) && <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy} onClick={() => confirm('Withdraw this request?') && change('withdrawn')}>Withdraw request</button>}
        {r.state === 'scheduled' && <a class="fl-btn fl-btn--ghost fl-btn--sm" href={`#/calendar?v=week&d=${p.date}&e=${r.eventId}`} onClick={close}>Open event</a>}
        {r.state === 'scheduled' && (isAdmin() || mine) && <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy} onClick={() => confirm('Cancel this event and remove it from the calendar?') && change('cancelled')}>Cancel event</button>}
      </div>
    </Sheet>
  );
}
function RequestQueue({ policy, openRequest }) {
  const [history, setHistory] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const live = isAdmin() ? policy.requests.filter((r) => r.state === 'awaiting') : policy.requests.filter((r) => ['draft', 'awaiting', 'changes-requested'].includes(r.state));
  const rows = history || live;
  const earlier = async () => {
    setBusy(true); setErr('');
    try { setHistory(await loadEventRequestHistory((history || policy.requests).at(-1))); } catch { setErr('Earlier requests did not load. Try again.'); }
    setBusy(false);
  };
  if (!policy.requests.length) return null;
  return (
    <section class="fl-railbox" aria-labelledby="rq-h">
      <h2 id="rq-h" class="fl-railbox__h">{isAdmin() ? 'Waiting for approval' : 'My requests'}<span class="fl-mono fl-muted">{live.length}</span></h2>
      {rows.length ? (
        <ul class="fl-list">{rows.slice(0, 8).map((r) => (
          <li key={r.id}><button class="fl-rq" onClick={() => openRequest(r)}>
            <span class="fl-rq__t">{r.proposal.title}</span>
            <span class="fl-small fl-muted"><span class="fl-mono">{fmtDay(r.proposal.date)}</span> · {isAdmin() ? memberName(r.createdByUid).split(' ')[0] : STATE_WORD[r.state]}</span>
          </button></li>))}</ul>
      ) : <p class="fl-small fl-muted">{isAdmin() ? 'No requests are waiting. New ones from members appear here.' : 'Nothing waiting. Requests you send appear here.'}</p>}
      {err && <p class="fl-error" role="alert">{err}</p>}
      <div class="fl-actions">
        {history ? <button class="fl-linkbtn fl-small" onClick={() => setHistory(null)}>Back to current requests</button>
          : <button class="fl-linkbtn fl-small" disabled={busy} onClick={earlier}>{busy ? 'Loading…' : 'Earlier requests'}</button>}
      </div>
    </section>
  );
}

function SideRail({ anchor, q, policy, open, openRequest }) {
  const [month, setMonth] = useState(monthStart(anchor)), today = isoDay();
  useEffect(() => setMonth(monthStart(anchor)), [anchor.slice(0, 7)]);
  const upcoming = remainingEvents(S.events, today, new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16)).slice(0, 3);
  const marks = new Set(S.events.map((e) => e.date));
  return (
    <>
      <MiniMonth value={anchor} month={month} onMonth={setMonth} marks={marks} label="Go to a date" onPick={(d) => go({ d, e: null }, q)} />
      <section class="fl-railbox" aria-labelledby="next-h">
        <h2 id="next-h" class="fl-railbox__h">Next up</h2>
        {upcoming.length ? <ul class="fl-list">{upcoming.map((e) => (
          <li key={e.id}><button class="fl-rq" onClick={() => open(e)}>
            <span class="fl-rq__t">{e.title}</span>
            <span class="fl-small fl-muted"><span class="fl-mono">{e.date === today ? 'Today' : fmtDay(e.date)}{e.allDay ? '' : `, ${e.start}`}</span>{e.location ? ` · ${e.location}` : ''}</span>
          </button></li>))}</ul> : <p class="fl-small fl-muted">Nothing in the next {EVENT_AHEAD_DAYS} days.</p>}
      </section>
      <RequestQueue policy={policy} openRequest={openRequest} />
      {isAdmin() && <a class="fl-link fl-small" href="#/event-settings">Event templates and defaults</a>}
    </>
  );
}

const SHORTCUTS = [['T', 'Today'], ['← →', 'Previous or next'], ['W', 'Week'], ['M', 'Month'], ['A', 'Agenda'], ['N', 'New event']];
function Shortcuts() {
  const [open, setOpen] = useState(false), ref = useRef(), btn = useRef();
  useDismiss(open, () => setOpen(false), ref, btn);
  return (
    <div class="fl-search-host">
      <button ref={btn} class="fl-iconbtn" aria-label="Keyboard shortcuts" aria-expanded={open} onClick={() => setOpen(!open)}><Icon n="keyboard" /></button>
      {open && (
        <div class="fl-pop fl-pop--keys" role="dialog" aria-label="Keyboard shortcuts" ref={ref}>
          <h4>Keyboard shortcuts</h4>
          <dl>{SHORTCUTS.map(([k, l]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{l}</dd></div>)}</dl>
        </div>
      )}
    </div>
  );
}

// ---------- Page

export function Calendar({ q }) {
  const today = isoDay(), wide = globalThis.matchMedia?.('(min-width: 600px)').matches;
  const view = ['month', 'week', 'agenda'].includes(q.get('v')) ? q.get('v') : wide ? 'week' : 'agenda';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(q.get('d') || '') ? q.get('d') : today;
  useEffect(() => { if (!q.get('v')) go({ v: view }, q, true); }, [q.get('v')]);
  const policy = useEventPolicy();
  const [tick, setTick] = useState(0), saved = () => setTick((t) => t + 1);
  const [weeks, setWeeks] = useState(2), [quick, setQuick] = useState(null), [editor, setEditor] = useState(null), [req, setReq] = useState(null), [drawer, setDrawer] = useState(false);
  useEffect(() => setWeeks(2), [view, anchor]);
  const from = view === 'month' ? monday(monthStart(anchor)) : monday(anchor);
  const to = view === 'month' ? addDays(monday(addDays(addMonths(anchor, 1), -1)), 6) : addDays(from, view === 'agenda' ? weeks * 7 - 1 : 6);
  const { events, error: rangeError, loading } = useEvents(from, to, tick);
  const opened = q.get('e') && (events.find((e) => e.id === q.get('e')) || S.events.find((e) => e.id === q.get('e')));
  const step = (n) => go({ d: view === 'month' ? addMonths(anchor, n) : addDays(anchor, 7 * n), e: null }, q);
  const label = view === 'month' ? monthName(anchor) : rangeLabel(from, addDays(from, 6));
  const open = (e) => go({ e: e.id }, q);
  const canAdd = canAddEvents() && policy.ready;
  const startNew = (prefill = {}) => { setQuick(null); setEditor({ prefill: { date: anchor >= today ? anchor : today, ...prefill } }); };
  const nextSlot = () => { const m = Math.ceil((nowMin() + 1) / 15) * 15; return { start: hhmm(Math.min(m, 1380)), end: hhmm(Math.min(m + 60, 1439)) }; };
  // Shortcuts, ignored while typing or while a dialog is open.
  useEffect(() => {
    const key = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable="true"], .fl-sheet, .fl-editor, .fl-quick, [role="dialog"]')) return;
      if (document.querySelector('.fl-sheet, .fl-editor')) return;
      const k = e.key.toLowerCase();
      if (k === 't') go({ d: null, e: null }, q);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (k === 'w') go({ v: 'week' }, q);
      else if (k === 'm') go({ v: 'month' }, q);
      else if (k === 'a') go({ v: 'agenda' }, q);
      else if (k === 'n' && canAdd) { e.preventDefault(); const d = anchor >= today ? anchor : today; setQuick({ date: d, ...nextSlot(), anchor: 'toolbar' }); }
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });
  const slot = (s) => {
    if (!canAdd) return;
    if (s.anchor === 'toolbar') { const b = document.querySelector('.fl-caltool__add')?.getBoundingClientRect(); setQuick({ ...s, x: b ? b.right - 140 : undefined, y: b ? b.bottom + 12 : undefined }); }
    else setQuick(s);
  };
  const rail = <SideRail anchor={anchor} q={q} policy={policy} open={(e) => { setDrawer(false); open(e); }} openRequest={(r) => { setDrawer(false); setReq(r); }} />;
  const awaiting = isAdmin() ? policy.requests.filter((r) => r.state === 'awaiting').length : 0;
  return (
    <div class="fl-calapp">
      <header class="fl-caltool">
        <Title light="Calendar." bold={label} title={`Calendar · ${label}`} />
        <div class="fl-caltool__nav">
          <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => go({ d: null, e: null }, q)} aria-keyshortcuts="t">Today</button>
          <button class="fl-iconbtn" aria-label={view === 'month' ? 'Previous month' : 'Previous week'} onClick={() => step(-1)}><Icon n="left" /></button>
          <button class="fl-iconbtn" aria-label={view === 'month' ? 'Next month' : 'Next week'} onClick={() => step(1)}><Icon n="right" /></button>
        </div>
        <div class="fl-seg" role="group" aria-label="View">
          {[['week', 'Week'], ['month', 'Month'], ['agenda', 'Agenda']].map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => go({ v: k }, q)}>{l}</button>)}
        </div>
        <div class="fl-caltool__end">
          <Shortcuts />
          <button class="fl-iconbtn fl-calrail-toggle" aria-label={`Calendar panel${awaiting ? `, ${awaiting} requests waiting` : ''}`} aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Icon n="panel" />{awaiting > 0 && <span class="fl-count-text" aria-hidden="true">{awaiting}</span>}
          </button>
          {canAddEvents() && <button class="fl-btn fl-btn--red fl-btn--sm fl-caltool__add" disabled={!policy.ready} onClick={() => startNew()}><Icon n="plus" />Add event</button>}
        </div>
      </header>
      {(policy.error || rangeError || S.fail.events) && (
        <div class="fl-calnote" role="alert"><span>{rangeError || 'Some calendar data did not load. Check your connection.'}</span><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => (rangeError ? saved() : location.reload())}>Retry</button></div>
      )}
      <div class="fl-calbody">
        <section class="fl-calmain" aria-label={label} aria-busy={loading}>
          {loading && <p class="fl-calnote fl-calnote--quiet" role="status">Loading these dates…</p>}
          {view === 'week' ? <Week start={from} events={events} open={open} onSlot={slot} draft={quick} />
            : view === 'month' ? <Month anchor={anchor} events={events} q={q} open={open} />
              : <Agenda start={from} weeks={weeks} events={events} open={open} loading={loading} more={() => setWeeks(weeks + 1)} />}
          {view === 'week' && !loading && !events.length && !deadlines(from, to).length && <p class="fl-calempty">{EMPTY()}</p>}
        </section>
        <aside class="fl-calrail" aria-label="Calendar panel">{rail}</aside>
      </div>
      {drawer && <Sheet label="Calendar panel" onClose={() => setDrawer(false)}><div class="fl-drawer">{rail}</div></Sheet>}
      {quick && <QuickCreate key={`${quick.date}${quick.start}`} slot={quick} policy={policy} close={() => setQuick(null)} saved={saved} full={(v) => startNew(v)} />}
      {editor && <EventEditor {...editor} policy={policy} close={() => setEditor(null)} saved={saved} events={events} />}
      {req && <RequestSheet r={req} close={() => setReq(null)} edit={(r) => setEditor({ request: r })} />}
      {opened && !editor && (
        <EventSheet ev={opened} groups={policy.groups} close={() => go({ e: null }, q)}
          edit={() => { setEditor({ ev: opened }); go({ e: null }, q); }}
          duplicate={() => { const { id, revision, requestId, createdAt, updatedAt, createdByUid, ...rest } = opened; setEditor({ prefill: { ...rest, public: false, title: `${opened.title} (copy)` }, duplicate: true }); go({ e: null }, q); }}
          archived={() => { saved(); go({ e: null }, q); }}
          cancel={policy.requests.some((r) => r.id === opened.requestId) ? async () => {
            const r = policy.requests.find((x) => x.id === opened.requestId);
            if (confirm('Cancel this event and remove it from the calendar?') && (await transitionEventRequest(r, 'cancelled'))) { saved(); go({ e: null }, q); }
          } : null} />
      )}
    </div>
  );
}
