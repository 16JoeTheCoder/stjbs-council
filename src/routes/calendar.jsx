// Calendar: a week grid (06:00 to 18:00) and a month view, all dates as Jakarta 'YYYY-MM-DD' strings so month and
// year boundaries are plain string arithmetic. Events outside 06:00 to 18:00 and root-project due dates sit in the
// all-day row. The store listens to -7..+60 days; a page turn outside that window reads the visible range once.
import { useEffect, useState } from 'preact/hooks';
import { getDocs, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName } from '../store.js';
import { isAdmin, isBoss, tree } from '../model.js';
import { archiveEvent, rsvp, saveEvent } from '../actions.js';
import { addDays, addMonths, fmtDay, isoDay, monday, monthName, monthStart, toMin } from '../time.js';
import { EVENT_AHEAD_DAYS, EVENT_BACK_DAYS, eventsQuery } from '../queries.js';
import { Icon, Sheet } from '../shared.jsx';
import { Empty, Panel, Title, useAutofocus } from '../ui.jsx';
import { EventTag } from './home.jsx';
import { wa } from './projects.jsx';
import sunset from '../../design/fiatlux/img/campus-sunset.webp';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EV_CLASS = { meeting: 'fl-ev', project: 'fl-ev fl-ev--deep', committee: 'fl-ev fl-ev--committee', other: 'fl-ev fl-ev--quiet' };
const DAY_START = 6 * 60, DAY_END = 18 * 60;
const inGrid = (e) => toMin(e.start) >= DAY_START && toMin(e.end) <= DAY_END;
const go = (patch, q) => { const p = new URLSearchParams(q); for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k)); location.hash = `#/calendar?${p}`; };

// Events for [from, to]: the store's window, plus a one-off read when the range leaves it.
function useEvents(from, to, tick) {
  const today = isoDay(), lo = addDays(today, -EVENT_BACK_DAYS), hi = addDays(today, EVENT_AHEAD_DAYS);
  const outside = from < lo || to > hi, [extra, setExtra] = useState([]);
  useEffect(() => {
    if (!outside) return;
    let live = true;
    getDocs(eventsQuery(S.term.termId, today, from, to)).then((s) => live && setExtra(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => live && setExtra([]));
    return () => { live = false; };
  }, [from, to, outside, tick]); // tick re-reads after this page saves or archives an event outside the window
  const byId = new Map([...(outside ? extra : []), ...S.events].map((e) => [e.id, e]));
  return [...byId.values()].filter((e) => !e.archived && e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
const dueMarkers = (from, to) => (tree().kids.root || []).filter((r) => r.dueDate && r.dueDate >= from && r.dueDate <= to);

const Chip = ({ e, q, day }) => (
  <button class={EV_CLASS[e.type] || 'fl-ev'} onClick={() => go({ e: e.id }, q)}>{e.title}<small>{day ? `${fmtDay(e.date)}, ` : ''}{e.start} to {e.end}</small></button>
);
const Due = ({ r }) => <a class="fl-ev fl-ev--quiet" href={`#/p/${r.id}`}>Due: {r.title}</a>;

function Week({ start, events, q }) {
  const today = isoDay(), days = DOW.map((_, i) => addDays(start, i)), end = days[6];
  const allDay = events.filter((e) => !inGrid(e)), dues = dueMarkers(start, end);
  return (
    <>
      {(allDay.length > 0 || dues.length > 0) && (
        <div class="fl-cal__allday" aria-label="All day and evening">{allDay.map((e) => <Chip key={e.id} e={e} q={q} day />)}{dues.map((r) => <Due key={r.id} r={r} />)}</div>
      )}
      <div class="fl-cal fl-scroll">
        <div class="fl-cal__grid" role="grid" aria-label={`Week of ${fmtDay(start)}`}>
          {days.map((d, i) => (
            <div key={d} class="fl-cal__day" style={{ gridColumn: i + 2 }} aria-current={d === today ? 'date' : undefined}>{DOW[i]}<b>{Number(d.slice(8))}</b></div>
          ))}
          <div class="fl-cal__bg" aria-hidden="true" />
          {days.includes(today) && <div class="fl-cal__today" style={{ gridColumn: days.indexOf(today) + 2 }} aria-hidden="true" />}
          {Array.from({ length: 12 }, (_, h) => <span key={h} class="fl-cal__hour" style={{ gridRow: 2 + h * 2 }}>{String(6 + h).padStart(2, '0')}:00</span>)}
          {events.filter(inGrid).map((e) => {
            const s = (toMin(e.start) - DAY_START) / 30, span = Math.max(1, Math.round((toMin(e.end) - toMin(e.start)) / 30));
            return (
              <button key={e.id} class={EV_CLASS[e.type] || 'fl-ev'} style={{ gridColumn: days.indexOf(e.date) + 2, gridRow: `${2 + Math.floor(s)} / span ${span}` }}
                onClick={() => go({ e: e.id }, q)}>{e.title}<small>{e.start} to {e.end}</small></button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Month({ anchor, events, q }) {
  const first = monthStart(anchor), next = addMonths(anchor, 1), today = isoDay();
  const start = monday(first), cells = [];
  for (let d = start; d < next || cells.length % 7; d = addDays(d, 1)) cells.push(d);
  const dues = dueMarkers(start, cells.at(-1));
  return (
    <div class="fl-scroll">
      <div class="fl-month fl-month--head" aria-hidden="true">{DOW.map((d) => <div key={d} class="fl-eyebrow">{d}</div>)}</div>
      <div class="fl-month" role="grid" aria-label={monthName(first)}>
        {cells.map((d) => {
          const list = events.filter((e) => e.date === d), due = dues.filter((r) => r.dueDate === d);
          return (
            <div key={d} class={d.slice(0, 7) === first.slice(0, 7) ? '' : 'is-other'} aria-current={d === today ? 'date' : undefined}>
              <b>{Number(d.slice(8))}</b>
              {list.slice(0, 3).map((e) => <Chip key={e.id} e={e} q={q} />)}
              {list.length > 3 && <button class="fl-linkbtn fl-small" onClick={() => go({ v: 'week', d }, q)}>+{list.length - 3} more</button>}
              {due.map((r) => <Due key={r.id} r={r} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventSheet({ ev, q, edit, archived }) {
  const [rs, setRs] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'rsvps'), where('eventId', '==', ev.id)), (s) => setRs(s.docs.map((d) => d.data())), () => setRs(false)), [ev.id]);
  const mine = rs && rs.find((r) => r.uid === S.me.id)?.status, n = (st) => (rs ? rs.filter((r) => r.status === st).length : 0);
  const canEdit = S.me.role !== 'teacher' && (ev.createdByUid === S.me.id || isBoss());
  const text = `${ev.title}\n${fmtDay(ev.date)}, ${ev.start} to ${ev.end}${ev.location ? `\n${ev.location}` : ''}\n${location.origin}/app/#/calendar?d=${ev.date}&e=${ev.id}`;
  return (
    <Sheet label={ev.title} onClose={() => go({ e: null }, q)}>
      <span class="fl-eyebrow fl-eyebrow--red">{fmtDay(ev.date)} · {ev.start} to {ev.end}</span>
      <h1>{ev.title}</h1>
      <div class="fl-stats"><EventTag type={ev.type} />{ev.public && <span class="fl-tag fl-tag--public">Public</span>}
        {ev.location && <span>{ev.location}</span>}{ev.itemId && tree().byId[ev.itemId] && <a class="fl-link" href={`#/p/${ev.itemId}`}>{tree().byId[ev.itemId].title}</a>}</div>
      {ev.notes && <p class="fl-pre">{ev.notes}</p>}
      <section class="fl-section" aria-label="RSVP">
        {rs === false ? <p class="fl-error" role="alert">Replies did not load. Reload to try again.</p> : (
          <div class="fl-actions">
            <button class={`fl-btn fl-btn--sm ${mine === 'going' ? 'fl-btn--red' : 'fl-btn--ghost'}`} aria-pressed={mine === 'going'} disabled={S.me.role === 'teacher'} onClick={() => rsvp(ev, 'going')}>Going <span class="fl-mono">{n('going')}</span></button>
            <button class={`fl-btn fl-btn--sm ${mine === 'not' ? 'fl-btn--red' : 'fl-btn--ghost'}`} aria-pressed={mine === 'not'} disabled={S.me.role === 'teacher'} onClick={() => rsvp(ev, 'not')}>Can't go <span class="fl-mono">{n('not')}</span></button>
          </div>)}
        {rs && n('going') > 0 && <p class="fl-small fl-muted">Going: {rs.filter((r) => r.status === 'going').map((r) => memberName(r.uid).split(' ')[0]).join(', ')}</p>}
      </section>
      <div class="fl-actions">
        <a class="fl-btn fl-btn--ghost fl-btn--sm" href={wa(text)} target="_blank" rel="noopener noreferrer"><Icon n="share" />Share to WhatsApp</a>
        {canEdit && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={edit}>Edit event</button>}
        {canEdit && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => confirm(`Archive "${ev.title}"? It disappears from the calendar.`) && archiveEvent(ev).then((ok) => { if (ok) { archived(); go({ e: null }, q); } })}>Archive event</button>}
      </div>
    </Sheet>
  );
}

const TYPES = [['meeting', 'Meeting'], ['project', 'Project'], ['committee', 'Committee'], ['other', 'Other']];
function EventForm({ ev, day, done }) {
  const [v, setV] = useState(ev ? { ...ev, notes: ev.notes || '', location: ev.location || '', itemId: ev.itemId || '' }
    : { title: '', type: 'meeting', date: day, start: '15:30', end: '16:30', location: '', notes: '', public: false, itemId: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), ref = useAutofocus();
  const on = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const locked = ev?.public && !isAdmin(); // a public event's text and time are reviewed by an admin
  const submit = async (e) => {
    e.preventDefault();
    if (!v.title.trim()) return setErr('Add a title, then save.');
    if (!v.date || !v.start || !v.end) return setErr('Add the date, start and end time.');
    if (v.end < v.start) return setErr('The end time is before the start. Change one of them.');
    setErr(''); setBusy(true);
    const data = { title: v.title.trim().slice(0, 80), type: v.type, date: v.date, start: v.start, end: v.end, location: v.location.trim().slice(0, 120),
      notes: v.notes.slice(0, 1000), public: isAdmin() ? v.public : (ev?.public ?? false), itemId: v.itemId || null };
    if (await saveEvent(ev, data)) done();
    setBusy(false);
  };
  const field = (k, label, type = 'text', extra = {}) => (
    <div class="fl-field"><label for={`ev-${k}`}>{label}</label><input id={`ev-${k}`} class="fl-input" type={type} value={v[k]} onInput={on(k)} disabled={locked} {...extra} /></div>
  );
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">{ev ? 'Edit event' : 'Add event'}</h2>
      {locked && <p class="fl-small fl-muted">This event is on the public website, so only an admin can change its title, type, time and place.</p>}
      {field('title', 'Title', 'text', { maxLength: 80 })}
      <div class="fl-fields">
        <div class="fl-field"><label for="ev-type">Type</label><select id="ev-type" class="fl-input" value={v.type} onChange={on('type')} disabled={locked}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {field('date', 'Date', 'date')}{field('start', 'Start', 'time')}{field('end', 'End', 'time')}
      </div>
      {field('location', 'Place', 'text', { maxLength: 120 })}
      <div class="fl-field"><label for="ev-item">Project</label><select id="ev-item" class="fl-input" value={v.itemId} onChange={on('itemId')}>
        <option value="">None</option>{(tree().kids.root || []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></div>
      <div class="fl-field"><label for="ev-notes">Notes</label><textarea id="ev-notes" class="fl-input" rows={3} maxLength={1000} value={v.notes} onInput={on('notes')} /></div>
      {isAdmin() && <label class="fl-checkrow"><input type="checkbox" class="fl-switch" checked={v.public} onChange={on('public')} />Show on the public website</label>}
      <p class="fl-error" role="alert">{err}</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>{ev ? 'Save event' : 'Add event'}</button><button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </form>
  );
}

export function Calendar({ q }) {
  const today = isoDay(), view = q.get('v') === 'month' ? 'month' : 'week', anchor = /^\d{4}-\d{2}-\d{2}$/.test(q.get('d') || '') ? q.get('d') : today;
  const [form, setForm] = useState(null), [tick, setTick] = useState(0), saved = () => setTick(tick + 1);
  const from = view === 'week' ? monday(anchor) : monday(monthStart(anchor));
  const to = view === 'week' ? addDays(from, 6) : addDays(monday(addDays(addMonths(anchor, 1), -1)), 6);
  const events = useEvents(from, to, tick);
  const open = q.get('e') && (events.find((e) => e.id === q.get('e')) || S.events.find((e) => e.id === q.get('e')));
  const upcoming = S.events.filter((e) => !e.archived && e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const featured = upcoming.find((e) => e.public) || upcoming[0];
  const step = (n) => go({ d: view === 'week' ? addDays(anchor, 7 * n) : addMonths(anchor, n), e: null }, q);
  const label = view === 'week' ? `${fmtDay(from)} to ${fmtDay(to)}` : monthName(anchor);
  return (
    <>
      <Title light="Calendar." bold={label} title="Calendar">
        {S.me.role !== 'teacher' && !form && <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm({ day: anchor })}><Icon n="plus" />Add event</button>}
      </Title>
      {form && <EventForm ev={form.ev} day={form.day} done={() => { setForm(null); saved(); }} />}
      <div class="fl-actions">
        <div class="fl-seg" role="group" aria-label="View">
          <button aria-pressed={view === 'week'} onClick={() => go({ v: 'week' }, q)}>Week</button>
          <button aria-pressed={view === 'month'} onClick={() => go({ v: 'month' }, q)}>Month</button>
        </div>
        <button class="fl-iconbtn" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)}><Icon n="left" /></button>
        <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => go({ d: null, e: null }, q)}>Today</button>
        <button class="fl-iconbtn" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)}><Icon n="right" /></button>
      </div>
      <section class="fl-panel" aria-label={label}>
        {view === 'week' ? <Week start={from} events={events} q={q} /> : <Month anchor={anchor} events={events} q={q} />}
        {S.fail.events && <p class="fl-error" role="alert">Events did not load ({S.fail.events}). Reload to try again.</p>}
      </section>
      <div class="fl-split">
        <Panel title="Upcoming" id="up-h">
          {upcoming.length ? <ul class="fl-list">{upcoming.slice(0, 5).map((e) => (
            <li key={e.id} class="fl-up"><span class="fl-date">{fmtDay(e.date).split(' ')[2]}<b>{e.date.slice(8)}</b></span>
              <div><button class="fl-linkbtn fl-h3" onClick={() => go({ e: e.id, d: e.date }, q)}>{e.title}</button>
                <p class="fl-small fl-muted"><span class="fl-mono">{fmtDay(e.date)} · {e.start}</span>{e.location && ` · ${e.location}`}</p></div>
              <EventTag type={e.type} /></li>))}</ul> : <Empty>Nothing coming up in the next {EVENT_AHEAD_DAYS} days. Add an event to start.</Empty>}
        </Panel>
        {featured && (
          <section class="fl-hero fl-stage" aria-labelledby="feat-h">
            <img class="fl-hero__img" src={sunset} alt="" />
            <div class="fl-hero__body">
              <span class="fl-eyebrow">Next up · {fmtDay(featured.date)}, {featured.start}</span>
              <h2 id="feat-h" class="fl-h2">{featured.title}</h2>
              {featured.location && <p class="fl-muted">{featured.location}</p>}
              <div><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => go({ e: featured.id, d: featured.date }, q)}>Open event</button></div>
            </div>
          </section>
        )}
      </div>
      {open && <EventSheet ev={open} q={q} archived={saved} edit={() => { setForm({ ev: open }); go({ e: null }, q); }} />}
    </>
  );
}
