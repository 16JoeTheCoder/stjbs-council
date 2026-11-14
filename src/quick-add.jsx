// Quick add: one line of text, parsed as you type. Tokens light up inline, a plain-words preview confirms, Enter adds
// and the box stays open for the next one. The row of small buttons under the input does the same job by tapping.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { S } from './store.js';
import { parse, parseDate, preview, rankPeople, dueLabel } from './quickadd.js';
import { addTask } from './work-actions.js';
import { assignable, isOfficer } from './work-model.js';
import { Icon, Sheet } from './shared.jsx';
import { Chip } from './ui.jsx';
import { addDays, isoDay } from './time.js';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const eventsFor = () => S.budgets.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));
const first = (m) => m.name.split(' ')[0];
export const PRI = [[1, 'Priority 1', 'Urgent'], [2, 'Priority 2', 'High'], [3, 'Priority 3', 'Medium'], [4, 'Priority 4', 'None']];

// A searchable list in a popover: type to filter, arrows to move, Enter to choose. Never wider than its host.
export function Picker({ label, items, onPick, search = true, render, empty = 'No match.', head }) {
  const [q, setQ] = useState(''), [i, setI] = useState(0), list = useRef();
  const shown = typeof items === 'function' ? items(q) : items;
  useEffect(() => setI(0), [q]);
  useEffect(() => list.current?.children[i]?.scrollIntoView?.({ block: 'nearest' }), [i]);
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && shown[i]) { e.preventDefault(); onPick(shown[i], q); }
  };
  return (
    <div class="fl-qpop" role="dialog" aria-label={label} onKeyDown={key}>
      {search && <input class="fl-input fl-qpop__search" autoFocus placeholder={`Search ${label.toLowerCase()}`} aria-label={`Search ${label.toLowerCase()}`} value={q} onInput={(e) => setQ(e.target.value)} />}
      {head && head(q)}
      <ul class="fl-qpop__list" role="listbox" aria-label={label} ref={list} tabIndex={search ? -1 : 0} autoFocus={!search}>
        {shown.length ? shown.map((it, k) => (
          <li key={it.id ?? k} role="option" aria-selected={k === i} class="fl-qpop__opt" onPointerMove={() => setI(k)} onClick={() => onPick(it, q)}>{render(it)}</li>
        )) : <li class="fl-qpop__none">{empty}</li>}
      </ul>
    </div>
  );
}

// Date choices: typed words go through the same parser ("fri", "besok 3pm"), plus one-tap shortcuts.
export function DatePicker({ onPick }) {
  const today = isoDay(), now = new Date();
  const fixed = [{ id: 'today', date: today, label: 'Today' }, { id: 'tmr', date: addDays(today, 1), label: 'Tomorrow' },
    { id: 'wkend', ...parseDate('weekend', now), label: 'This weekend' }, { id: 'next', ...parseDate('next week', now), label: 'Next week' }, { id: 'none', date: null, label: 'No date' }];
  return (
    <Picker label="Date" onPick={(it) => onPick(it.date ? { date: it.date, time: it.time } : null)}
      items={(q) => { const d = q.trim() && parseDate(q, now); return d ? [{ id: 'typed', ...d, label: dueLabel(d, now) }] : fixed; }}
      empty="Try fri, 15 nov, besok or in 3 days."
      render={(it) => <><Icon n="calendar" /><span class="fl-qpop__main">{it.label}</span>{it.date && it.id !== 'typed' && <span class="fl-qpop__aside fl-mono">{dueLabel({ date: it.date }, now).replace(/^(Today|Tomorrow)$/, '')}</span>}</>}
      head={() => <input class="fl-input fl-qpop__native" type="date" aria-label="Pick from a calendar" onInput={(e) => e.target.value && onPick({ date: e.target.value })} />} />
  );
}
export function PeoplePicker({ onPick, ctx }) {
  return <Picker label="People" onPick={onPick} items={(q) => rankPeople(q, ctx)}
    render={(m) => <><Chip email={m.id} /><span class="fl-qpop__main">{m.id === S.me.id ? `${m.name} (me)` : m.name}</span></>} />;
}
export function EventPicker({ onPick }) {
  return <Picker label="Events" onPick={onPick} empty="No active event budgets."
    items={(q) => [{ id: null, name: 'No event' }, ...eventsFor().filter((e) => !q || fold(e.name).includes(fold(q)))]}
    render={(e) => <><Icon n="wallet" /><span class="fl-qpop__main">{e.name}</span></>} />;
}
export function PriorityPicker({ onPick }) {
  return <Picker label="Priority" search={false} onPick={onPick} items={PRI.map(([id, l, w]) => ({ id, l, w }))}
    render={(p) => <><span class={`fl-flag fl-flag--p${p.id}`}><Icon n="flag" /></span><span class="fl-qpop__main">{p.l}</span><span class="fl-qpop__aside">{p.w}</span></>} />;
}

// The text with its parsed tokens drawn behind it (the textarea's own text is transparent over the mirror).
function Mirror({ text, spans }) {
  const out = [];
  let at = 0;
  for (const s of spans) {
    if (s.span[0] < at) continue;
    out.push(text.slice(at, s.span[0]), <mark key={s.span[0]} class={`fl-tok fl-tok--${s.kind}${s.pending ? ' is-pending' : ''}`}>{text.slice(...s.span)}</mark>);
    at = s.span[1];
  }
  out.push(text.slice(at), '​');
  return <div class="fl-qa__mirror" aria-hidden="true">{out}</div>;
}

// The suggestion list for the token at the caret: "@br" shows people, "#e" shows events; ambiguity shows the matches.
function activeToken(text, caret) {
  const m = /(^|\s)([@#])([^\s@#"]*)$/.exec(text.slice(0, caret));
  return m ? { kind: m[2], q: m[3], start: caret - m[3].length - 1, end: caret } : null;
}

export function QuickAdd({ close, eventId = null, ownerUid = null }) {
  const [text, setText] = useState(ownerUid && ownerUid !== S.me.id ? `@${first(S.members.find((m) => m.id === ownerUid) || S.me)} ` : '');
  const [rejected, setRejected] = useState(() => new Set()), [pinned, setPinned] = useState(() => { const m = ownerUid && S.members.find((x) => x.id === ownerUid); return m ? { [fold(first(m))]: m.id } : {}; }), [caret, setCaret] = useState(text.length);
  const [pick, setPick] = useState({ eventId }), [pop, setPop] = useState(null), [hi, setHi] = useState(0), [added, setAdded] = useState(0);
  const box = useRef(), events = useMemo(eventsFor, [S.budgets]);
  const ctx = { now: new Date(), me: S.me, members: S.members, events, rejected, pinned };
  const r = parse(text, ctx);

  // What will be saved: typed tokens win, then what was tapped in the toolbar, then the defaults.
  const owner = r.assignee?.id || pick.ownerUid || S.me.id;
  const due = r.due || (pick.due === undefined ? null : pick.due);
  const ev = r.event?.id ?? pick.eventId ?? null, evName = r.event?.name || events.find((e) => e.id === ev)?.name;
  const pri = r.priority || pick.priority || 4;
  const ownerM = S.members.find((m) => m.id === owner);
  const tok = activeToken(text, caret);
  const sugg = r.ambiguous && caret >= r.ambiguous.span[1] - 1 && caret <= r.ambiguous.span[1] + 1 ? r.ambiguous.options
    : tok?.kind === '@' ? rankPeople(tok.q, ctx).slice(0, 6) : tok?.kind === '#' ? events.filter((e) => fold(e.name).includes(fold(tok.q)) || e.name.split(' ').map((w) => w[0]).join('').toLowerCase().startsWith(fold(tok.q))).slice(0, 6) : [];
  const suggKind = r.ambiguous && sugg === r.ambiguous.options ? '@' : tok?.kind;
  useEffect(() => setHi(0), [suggKind, tok?.q]);
  // Role limits: an assignee you may not use stays visible with a warning and blocks Add. It is never dropped.
  const blockedBy = assignable(S.me, S.members).some((m) => m.id === owner) ? null
    : isOfficer(S.me) ? 'Officers can only assign their subteam.' : 'You can only give tasks to yourself.';
  const ready = r.title.trim() && !r.ambiguous && !blockedBy;

  const setT = (t, c = t.length) => { setText(t); setCaret(c); requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(c, c); }); };
  const choose = (it) => {
    const span = r.ambiguous && sugg === r.ambiguous.options ? r.ambiguous.span : [tok.start, tok.end];
    let ins;
    if (suggKind === '@') { ins = `@${first(it)}`; setPinned({ ...pinned, [fold(first(it))]: it.id }); }
    else ins = /\s/.test(it.name) ? `#"${it.name}"` : `#${it.name}`;
    const t = `${text.slice(0, span[0])}${ins} ${text.slice(span[1]).replace(/^\s+/, '')}`;
    setT(t, span[0] + ins.length + 1);
  };
  const submit = () => {
    if (!ready) return;
    addTask({ title: r.title, ownerUid: owner, dueDate: due?.date || null, dueTime: due?.time || null, budgetId: ev, priority: pri });
    setAdded(added + 1); setRejected(new Set()); setPinned({}); setPick({ eventId: ev }); setT('');
  };
  const key = (e) => {
    if (sugg.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); return setHi((hi + 1) % sugg.length); }
      if (e.key === 'ArrowUp') { e.preventDefault(); return setHi((hi - 1 + sugg.length) % sugg.length); }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return choose(sugg[hi]); }
    }
    if (e.key === 'Enter') { e.preventDefault(); return submit(); }
    // Backspace right after a token turns it back into plain text (one atomic step), instead of eating a letter.
    const el = e.currentTarget;
    if (e.key === 'Backspace' && el.selectionStart === el.selectionEnd) {
      const s = r.spans.find((x) => x.span[1] === el.selectionStart && x.key);
      if (s) { e.preventDefault(); setRejected(new Set([...rejected, s.key])); }
    }
  };
  const onInput = (e) => {
    const t = e.target.value;
    // A token the user edits into something else is forgotten as rejected so it can match again later.
    setText(t); setCaret(e.target.selectionStart);
  };
  useEffect(() => { const el = box.current; if (el) { el.style.height = '0'; el.style.height = `${el.scrollHeight}px`; } }, [text]);
  useEffect(() => { const id = setTimeout(() => box.current?.focus(), 40); return () => clearTimeout(id); }, []);

  const done = (patch) => { setPick({ ...pick, ...patch }); setPop(null); requestAnimationFrame(() => box.current?.focus()); };
  const line = preview({ assignee: owner !== S.me.id && ownerM ? { id: owner, name: ownerM.name } : null, due, event: evName && { name: evName }, priority: pri }, S.me, new Date());
  const tool = (k, icon, label, value, cls = '') => (
    <button type="button" class={`fl-qtool${value ? ' is-set' : ''} ${cls}`} aria-expanded={pop === k} aria-label={value ? `${label}: ${value}` : label} onClick={() => setPop(pop === k ? null : k)}>
      <Icon n={icon} /><span>{value || label}</span>
    </button>
  );
  return (
    <Sheet label="Add a task" onClose={() => (pop ? setPop(null) : close())} low>
      <form class="fl-qa" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div class="fl-qa__field">
          <Mirror text={text} spans={r.spans} />
          <textarea ref={box} class="fl-qa__input" rows={1} maxLength={200} spellcheck={false} autocomplete="off" enterkeyhint="send"
            placeholder="Buy confetti @Brit fri #eoy" aria-label="Task, with @person, #event, a date and p1 to p4" aria-describedby="qa-preview"
            aria-autocomplete="list" aria-expanded={sugg.length > 0} value={text} onInput={onInput} onKeyDown={key}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)} onClick={(e) => setCaret(e.currentTarget.selectionStart)} />
        </div>
        {sugg.length > 0 && (
          <ul class="fl-qpop fl-qpop__list fl-qa__sugg" role="listbox" aria-label={r.ambiguous ? 'Which one?' : 'Suggestions'}>
            {r.ambiguous && sugg === r.ambiguous.options && <li class="fl-qpop__none">More than one match. Which one?</li>}
            {sugg.map((it, k) => (
              <li key={it.id} role="option" aria-selected={k === hi} class="fl-qpop__opt" onPointerDown={(e) => { e.preventDefault(); choose(it); }}>
                {suggKind === '@' ? <><Chip email={it.id} /><span class="fl-qpop__main">{it.name}</span></> : <><Icon n="wallet" /><span class="fl-qpop__main">{it.name}</span></>}
              </li>
            ))}
          </ul>
        )}
        <p id="qa-preview" class={`fl-qa__preview${blockedBy || r.warnings.length ? ' is-warn' : ''}`} aria-live="polite">
          {blockedBy || r.warnings[0] || line || (added ? `${added} added. Keep going, or Esc to close.` : 'Type @ for a person, # for an event, and a date like fri or besok.')}
        </p>
        <div class="fl-qa__bar">
          <div class="fl-qa__tools">
            {tool('date', 'calendar', 'Date', due ? dueLabel(due) : '', 'is-date')}
            {tool('who', 'user', 'Assignee', owner !== S.me.id ? first(ownerM || { name: '?' }) : '')}
            {tool('event', 'wallet', 'Event', evName || '')}
            {tool('pri', 'flag', 'Priority', pri < 4 ? `P${pri}` : '', `fl-flag--p${pri}`)}
          </div>
          <button class="fl-btn fl-btn--red fl-qa__add" disabled={!ready}>Add task</button>
          {pop && (
            <div class="fl-qa__pop">
              {pop === 'date' && <DatePicker onPick={(d) => done({ due: d })} />}
              {pop === 'who' && <PeoplePicker ctx={ctx} onPick={(m) => done({ ownerUid: m.id })} />}
              {pop === 'event' && <EventPicker onPick={(e) => done({ eventId: e.id })} />}
              {pop === 'pri' && <PriorityPicker onPick={(p) => done({ priority: p.id })} />}
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}
