// Form controls with no native date, time or multi-select inputs. Stored values stay ISO ('YYYY-MM-DD', 'HH:MM').
import { useEffect, useRef, useState } from 'preact/hooks';
import { S } from './store.js';
import { addDays, addMonths, fmtDay, isoDay, monday, monthName, monthStart } from './time.js';
import { Icon } from './shared.jsx';
import { Chip } from './ui.jsx';
import { committees, departments } from './org.js';
import { RANKS, committeeKeyMembers, committeeKeyName, deptMembers, plural, rankMembers, teamMembers } from './org-model.js';
import { normalizeSelection, resolveParticipants } from './event-model.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Close on outside pointer and Esc; Esc returns focus to the trigger.
export function useDismiss(open, close, ref, trigger) {
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => !ref.current?.contains(e.target) && !trigger?.current?.contains(e.target) && close();
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); trigger?.current?.focus(); } };
    addEventListener('pointerdown', out, true); ref.current?.addEventListener('keydown', esc);
    const node = ref.current;
    return () => { removeEventListener('pointerdown', out, true); node?.removeEventListener('keydown', esc); };
  }, [open]);
}

// A month of day buttons. Arrow keys move by day and week; Enter picks. Used by the date field and the calendar rail.
export function MiniMonth({ value, month, onMonth, onPick, marks = new Set(), label = 'Choose a date' }) {
  const first = monthStart(month), start = monday(first), today = isoDay(), cells = [];
  for (let d = start; cells.length < 42; d = addDays(d, 1)) cells.push(d);
  const [focus, setFocus] = useState(value && value.slice(0, 7) === first.slice(0, 7) ? value : first), grid = useRef();
  useEffect(() => { if (focus.slice(0, 7) !== first.slice(0, 7)) setFocus(first); }, [first]);
  const key = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = addDays(focus, step);
    if (n.slice(0, 7) !== first.slice(0, 7)) onMonth(monthStart(n));
    setFocus(n);
    setTimeout(() => grid.current?.querySelector(`[data-day="${n}"]`)?.focus());
  };
  return (
    <div class="fl-mini">
      <div class="fl-mini__head">
        <b>{monthName(first)}</b>
        <button type="button" class="fl-iconbtn fl-iconbtn--sm" aria-label="Previous month" onClick={() => onMonth(addMonths(first, -1))}><Icon n="left" /></button>
        <button type="button" class="fl-iconbtn fl-iconbtn--sm" aria-label="Next month" onClick={() => onMonth(addMonths(first, 1))}><Icon n="right" /></button>
      </div>
      <div class="fl-mini__grid" role="grid" aria-label={label} ref={grid} onKeyDown={key}>
        {DOW.map((d) => <span key={d} class="fl-mini__dow" aria-hidden="true">{d.slice(0, 2)}</span>)}
        {cells.map((d) => (
          <button type="button" key={d} data-day={d} tabIndex={d === focus ? 0 : -1}
            class={`fl-mini__day${d.slice(0, 7) !== first.slice(0, 7) ? ' is-other' : ''}${marks.has(d) ? ' has-mark' : ''}`}
            aria-current={d === today ? 'date' : undefined} aria-pressed={d === value} aria-label={fmtDay(d)}
            onClick={() => onPick(d)}>{Number(d.slice(8))}</button>
        ))}
      </div>
    </div>
  );
}

// "Wed 4 Nov" button that opens a small month picker.
export function DateField({ id, value, onChange, disabled, invalid, describedBy, min }) {
  const [open, setOpen] = useState(false), [month, setMonth] = useState(monthStart(value || isoDay())), pop = useRef(), btn = useRef();
  useDismiss(open, () => setOpen(false), pop, btn);
  useEffect(() => { if (open) { setMonth(monthStart(value || isoDay())); setTimeout(() => pop.current?.querySelector('[tabindex="0"]')?.focus()); } }, [open]);
  return (
    <div class="fl-picker">
      <button type="button" id={id} ref={btn} class={`fl-input fl-input--btn${invalid ? ' is-invalid' : ''}`} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} onClick={() => setOpen(!open)}>
        <Icon n="calendar" /><span>{value ? fmtDay(value) : 'Choose a date'}</span>
      </button>
      {open && (
        <div class="fl-pop fl-pop--picker" role="dialog" aria-label="Choose a date" ref={pop}>
          <MiniMonth value={value} month={month} onMonth={setMonth} onPick={(d) => { if (!min || d >= min) { onChange(d); setOpen(false); btn.current?.focus(); } }} />
        </div>
      )}
    </div>
  );
}

// Typed entry: "1530", "15.30", "3:30pm" and "9" all become 24-hour "HH:MM". Returns '' when it cannot parse.
export function parseTime(raw) {
  const t = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm|a|p)?$/.exec(t);
  if (!m) return '';
  let h = Number(m[1]), min = Number(m[2] || 0);
  if (m[3]?.startsWith('p') && h < 12) h += 12;
  if (m[3]?.startsWith('a') && h === 12) h = 0;
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
const SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

// 24-hour time in mono with 15-minute suggestions. Arrow keys move through suggestions; Enter or blur commits.
export function TimeField({ id, value, onChange, disabled, invalid, describedBy, after }) {
  const [text, setText] = useState(value || ''), [open, setOpen] = useState(false), [hi, setHi] = useState(-1), list = useRef(), box = useRef();
  useEffect(() => setText(value || ''), [value]);
  const options = after ? SLOTS.filter((s) => s > after) : SLOTS;
  useDismiss(open, () => setOpen(false), list, box);
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, options.findIndex((s) => s >= (parseTime(text) || value || '08:00')));
    setHi(i);
    setTimeout(() => list.current?.children[i]?.scrollIntoView({ block: 'center' }));
  }, [open]);
  const commit = (v) => { const p = parseTime(v); setText(p || value || ''); if (p && p !== value) onChange(p); setOpen(false); };
  const key = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); setOpen(true);
      const n = Math.min(options.length - 1, Math.max(0, hi + (e.key === 'ArrowDown' ? 1 : -1)));
      setHi(n); list.current?.children[n]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); commit(open && hi >= 0 ? options[hi] : text); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };
  return (
    <div class="fl-picker">
      <input id={id} ref={box} class={`fl-input fl-mono${invalid ? ' is-invalid' : ''}`} inputMode="numeric" autocomplete="off" placeholder="15:30" value={text} disabled={disabled}
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-invalid={invalid || undefined} aria-describedby={describedBy}
        aria-activedescendant={open && hi >= 0 ? `${id}-o${hi}` : undefined}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onInput={(e) => setText(e.target.value)} onKeyDown={key} onBlur={() => setTimeout(() => !list.current?.contains(document.activeElement) && commit(text), 120)} />
      {open && (
        <ul class="fl-pop fl-pop--times" role="listbox" id={`${id}-list`} ref={list}>
          {options.map((s, i) => (
            <li key={s} id={`${id}-o${i}`} role="option" aria-selected={i === hi} class="fl-mono" onMouseDown={(e) => e.preventDefault()} onClick={() => commit(s)}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Participants

export const orgData = () => ({ departments: S.departments || [], committees: S.committees || [] });
const nameOf = (uid) => S.members.find((m) => m.id === uid)?.name || uid;
const initialsChips = (uids) => <span class="fl-chips">{uids.filter(Boolean).slice(0, 3).map((u) => <Chip key={u} email={u} />)}</span>;

// Every addressable group, by kind. key is the selection key it toggles.
export function participantGroups(groups = []) {
  const depts = departments(), list = [];
  for (const [r, name] of RANKS) list.push({ kind: 'Rank', key: 'ranks', id: r, name, uids: rankMembers(r, S.members, depts), leads: [] });
  for (const d of depts) list.push({ kind: 'Department', key: 'departmentIds', id: d.id, name: d.name, uids: deptMembers(d), leads: [d.jcLeadUid, d.secLeadUid] });
  for (const c of committees().filter((x) => x.status !== 'closed')) {
    list.push({ kind: 'Committee', key: 'teamIds', id: `${c.id}:*`, name: `All of ${c.name}`, uids: committeeKeyMembers(`${c.id}:*`, S.committees), leads: c.chairUids || [], committee: c.id });
    if (c.chairUids?.length) list.push({ kind: 'Committee', key: 'teamIds', id: `${c.id}:chair`, name: `${c.name} chair`, uids: c.chairUids, leads: c.chairUids, committee: c.id });
    const leads = committeeKeyMembers(`${c.id}:leads`, S.committees);
    if (leads.length) list.push({ kind: 'Committee', key: 'teamIds', id: `${c.id}:leads`, name: `Leaders across ${c.name}`, uids: leads, leads, committee: c.id });
    for (const t of c.teams || []) list.push({ kind: 'Team', key: 'teamIds', id: `${c.id}:${t.id}`, name: t.name, sub: c.name, uids: teamMembers(t), leads: t.leadUids || [], committee: c.id });
  }
  for (const g of groups.filter((x) => !x.archived && x.available !== false)) list.push({ kind: 'Group', key: 'groupIds', id: g.id, name: g.name, uids: g.memberUids || [], leads: [] });
  const secs = [...new Set(S.members.filter((m) => m.active && m.section).map((m) => m.section))].sort();
  for (const s of secs) list.push({ kind: 'Year level', key: 'sections', id: s, name: s, uids: S.members.filter((m) => m.active && m.section === s).map((m) => m.id), leads: [] });
  return list;
}
export function selectionSummary(sel, groups = []) {
  const s = normalizeSelection(sel), all = participantGroups(groups), rows = [];
  for (const k of ['ranks', 'departmentIds', 'teamIds', 'groupIds', 'sections'])
    for (const id of s[k] || []) {
      const g = all.find((x) => x.key === k && x.id === id);
      rows.push({ name: g ? (g.sub ? `${g.name}, ${g.sub}` : g.name) : k === 'teamIds' ? committeeKeyName(id, S.committees) : id, n: g?.uids.filter((u) => S.members.some((m) => m.id === u && m.active)).length || 0, kind: g?.kind || 'Group' });
    }
  return { rows, include: s.includeUids, exclude: s.excludeUids };
}

function GroupCard({ g, state, onToggle, expanded, onExpand, resolved, onPerson }) {
  const active = g.uids.filter((u) => S.members.some((m) => m.id === u && m.active));
  return (
    <div class={`fl-pcard${state !== 'none' ? ' is-on' : ''}`}>
      <button type="button" class="fl-pcard__main" role="checkbox" aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'} onClick={onToggle}>
        <span class={`fl-tri fl-tri--${state}`} aria-hidden="true" />
        <span class="fl-pcard__name">{g.name}</span>
        <span class="fl-pcard__meta"><span class="fl-mono">{active.length}</span> {active.length === 1 ? 'person' : 'people'}{g.leads.filter(Boolean).length > 0 && initialsChips(g.leads)}</span>
      </button>
      <button type="button" class="fl-linkbtn fl-pcard__more" aria-expanded={expanded} onClick={onExpand} disabled={!active.length}>{expanded ? 'Hide people' : 'Expand'}</button>
      {expanded && (
        <ul class="fl-pcard__people">
          {active.map((u) => (
            <li key={u}><label class="fl-checkrow"><input type="checkbox" class="fl-check" checked={resolved.has(u)} onChange={() => onPerson(u, !resolved.has(u))} />{nameOf(u)}{g.leads.includes(u) && <small class="fl-muted"> · lead</small>}</label></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Rail({ children, label }) {
  const box = useRef(), [ends, setEnds] = useState([true, false]);
  const measure = () => { const el = box.current; if (el) setEnds([el.scrollLeft < 4, el.scrollLeft + el.clientWidth >= el.scrollWidth - 4]); };
  useEffect(() => { measure(); addEventListener('resize', measure); return () => removeEventListener('resize', measure); }, [children]);
  const page = (dir) => box.current?.scrollBy({ left: dir * box.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div class="fl-prail">
      <button type="button" class="fl-iconbtn fl-iconbtn--sm" aria-label="Scroll groups left" disabled={ends[0]} onClick={() => page(-1)}><Icon n="left" /></button>
      <div class="fl-prail__track" ref={box} role="group" aria-label={label} onScroll={measure}
        onWheel={(e) => { if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; }}>{children}</div>
      <button type="button" class="fl-iconbtn fl-iconbtn--sm" aria-label="Scroll groups right" disabled={ends[1]} onClick={() => page(1)}><Icon n="right" /></button>
    </div>
  );
}

// value: a participant selection. Stored as rules (departments, ranks, teams, people in and out), never frozen lists.
export function ParticipantPicker({ value, onChange, groups = [], disabled = false, id = 'pp' }) {
  const sel = normalizeSelection(value);
  const [view, setView] = useState('dept'), [committee, setCommittee] = useState(''), [open, setOpen] = useState(''), [q, setQ] = useState(''), [hi, setHi] = useState(0), [undo, setUndo] = useState(null);
  const box = useRef();
  const resolved = new Set(resolveParticipants(sel, S.members, groups, orgData()));
  const all = participantGroups(groups);
  const put = (patch) => onChange(normalizeSelection({ ...sel, ...patch }));
  const has = (g) => (sel[g.key] || []).includes(g.id);
  const toggleGroup = (g) => {
    const on = has(g), list = sel[g.key] || [];
    if (on) put({ [g.key]: list.filter((x) => x !== g.id) });
    else put({ [g.key]: [...list, g.id], excludeUids: sel.excludeUids.filter((u) => !g.uids.includes(u)) });
  };
  const person = (u, want) => {
    if (want) put({ includeUids: [...sel.includeUids.filter((x) => x !== u), u], excludeUids: sel.excludeUids.filter((x) => x !== u) });
    else {
      const viaRule = !sel.includeUids.includes(u) || resolveParticipants({ ...sel, includeUids: sel.includeUids.filter((x) => x !== u) }, S.members, groups, orgData()).includes(u);
      put({ includeUids: sel.includeUids.filter((x) => x !== u), excludeUids: viaRule ? [...sel.excludeUids, u] : sel.excludeUids });
      if (viaRule) setUndo(u);
    }
  };
  const stateOf = (g) => {
    if (has(g)) return 'all';
    const live = g.uids.filter((u) => S.members.some((m) => m.id === u && m.active));
    const n = live.filter((u) => resolved.has(u)).length;
    return !n ? 'none' : n === live.length ? 'all' : 'some';
  };
  const cards = committee
    ? all.filter((g) => g.committee === committee)
    : view === 'dept'
      ? [...all.filter((g) => g.key === 'ranks' && ['teacher', 'exec'].includes(g.id)), ...all.filter((g) => g.key === 'departmentIds')]
      : all.filter((g) => g.key === 'ranks');
  // Search: groups of every kind, then people.
  const t = q.trim().toLowerCase();
  const hits = t ? [
    ...all.filter((g) => g.name.toLowerCase().includes(t) || g.sub?.toLowerCase().includes(t)).map((g) => ({ type: 'group', g })),
    ...S.members.filter((m) => m.active && m.name.toLowerCase().includes(t)).map((m) => ({ type: 'person', m })),
  ].slice(0, 8) : [];
  const pick = (h) => {
    if (!h) return;
    if (h.type === 'group') { if (!has(h.g)) toggleGroup(h.g); } else person(h.m.id, true);
    setQ(''); setHi(0); box.current?.focus();
  };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(hits.length - 1, hi + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(0, hi - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hits[hi]); }
    else if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); }
    else if (e.key === 'Backspace' && !q) {
      // Backspace on an empty search removes the last chip added.
      const last = [...sel.includeUids].pop();
      if (last) put({ includeUids: sel.includeUids.slice(0, -1) });
      else for (const k of ['teamIds', 'departmentIds', 'ranks', 'sections', 'groupIds']) if (sel[k]?.length) { put({ [k]: sel[k].slice(0, -1) }); break; }
    }
  };
  const chips = [
    ...['ranks', 'departmentIds', 'teamIds', 'groupIds', 'sections'].flatMap((k) => (sel[k] || []).map((idv) => {
      const g = all.find((x) => x.key === k && x.id === idv);
      return { label: g ? (g.sub ? `${g.name}, ${g.sub}` : g.name) : k === 'teamIds' ? committeeKeyName(idv, S.committees) : idv, kind: g?.kind || 'Group', remove: () => put({ [k]: sel[k].filter((x) => x !== idv) }) };
    })),
    ...sel.includeUids.map((u) => ({ label: nameOf(u), kind: 'Person', remove: () => put({ includeUids: sel.includeUids.filter((x) => x !== u) }) })),
  ];
  const openCommittees = committees().filter((c) => c.status !== 'closed');
  return (
    <fieldset class="fl-pp" disabled={disabled}>
      <legend class="fl-sr">Participants</legend>
      <div class="fl-pp__bar">
        {!committee && (
          <div class="fl-seg" role="group" aria-label="Group people">
            <button type="button" aria-pressed={view === 'dept'} onClick={() => setView('dept')}>By department</button>
            <button type="button" aria-pressed={view === 'rank'} onClick={() => setView('rank')}>By rank</button>
          </div>
        )}
        {openCommittees.length > 0 && (
          <label class="fl-pp__committee"><span class="fl-small fl-muted">Special committee</span>
            <select class="fl-input fl-input--sm" value={committee} onChange={(e) => { setCommittee(e.target.value); setOpen(''); }}>
              <option value="">None</option>{openCommittees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        )}
      </div>
      <Rail label={committee ? 'Committee groups' : view === 'dept' ? 'Departments' : 'Ranks'}>
        {cards.map((g) => (
          <GroupCard key={`${g.key}-${g.id}`} g={g} state={stateOf(g)} onToggle={() => toggleGroup(g)} expanded={open === `${g.key}-${g.id}`}
            onExpand={() => setOpen(open === `${g.key}-${g.id}` ? '' : `${g.key}-${g.id}`)} resolved={resolved} onPerson={person} />
        ))}
        {!cards.length && <p class="fl-small fl-muted fl-pad">{committee ? 'This committee has no teams yet.' : 'No departments yet. An admin sets them up in Committees.'}</p>}
      </Rail>
      <div class="fl-combo">
        <label class="fl-sr" for={`${id}-q`}>Add a group or a person</label>
        <div class="fl-combo__box">
          {chips.map((c, i) => (
            <span key={i} class="fl-pchip"><small>{c.kind}</small>{c.label}<button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove}><Icon n="x" /></button></span>
          ))}
          {sel.excludeUids.map((u) => (
            <span key={u} class="fl-pchip is-out"><small>Excluded</small><s>{nameOf(u)}</s><button type="button" aria-label={`Invite ${nameOf(u)} again`} onClick={() => put({ excludeUids: sel.excludeUids.filter((x) => x !== u) })}>Undo</button></span>
          ))}
          <input id={`${id}-q`} ref={box} class="fl-combo__input" placeholder={chips.length ? 'Add more' : 'Search groups, year levels and people'} value={q} autocomplete="off"
            role="combobox" aria-expanded={hits.length > 0} aria-controls={`${id}-hits`} aria-activedescendant={hits.length ? `${id}-h${hi}` : undefined}
            onInput={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={key} />
        </div>
        {hits.length > 0 && (
          <ul class="fl-pop fl-pop--combo" role="listbox" id={`${id}-hits`}>
            {hits.map((h, i) => (
              <li key={i} id={`${id}-h${i}`} role="option" aria-selected={i === hi} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                {h.type === 'group' ? <><span>{h.g.name}{h.g.sub ? `, ${h.g.sub}` : ''}</span><small>{h.g.kind} · {h.g.uids.length}</small></>
                  : <><Chip email={h.m.id} /><span>{h.m.name}</span><small>Person</small></>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p class="fl-small" role="status" aria-live="polite"><b class="fl-mono">{resolved.size}</b> {resolved.size === 1 ? 'person' : 'people'} invited
        {undo && sel.excludeUids.includes(undo) && <> · {nameOf(undo).split(' ')[0]} removed. <button type="button" class="fl-linkbtn" onClick={() => { put({ excludeUids: sel.excludeUids.filter((x) => x !== undo) }); setUndo(null); }}>Undo</button></>}
      </p>
    </fieldset>
  );
}
export const ParticipantFields = ParticipantPicker;
export { plural };

// One ⋯ button per row or card; secondary actions live here.
export function Menu({ label, items }) {
  const [open, setOpen] = useState(false), ref = useRef(), btn = useRef();
  useDismiss(open, () => setOpen(false), ref, btn);
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <div class="fl-search-host fl-menu">
      <button ref={btn} type="button" class="fl-iconbtn fl-iconbtn--sm" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon n="dots" /></button>
      {open && (
        <div class="fl-pop" role="menu" ref={ref}>
          {list.map(([text, fn]) => <button key={text} type="button" role="menuitem" onClick={() => { setOpen(false); fn(); }}>{text}</button>)}
        </div>
      )}
    </div>
  );
}
