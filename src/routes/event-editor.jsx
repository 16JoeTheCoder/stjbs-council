// The full event editor: a full-height split screen. The form scrolls on the left; the right pane previews the event
// as attendees see it, places it in its week, flags clashes, counts invitations and says whether it goes public.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { S, memberName, toast } from '../store.js';
import { isAdmin, tree } from '../model.js';
import { eventDefaults, nextThursday, resolveParticipants } from '../event-model.js';
import { saveEventProposal } from '../event-actions.js';
import { addDays, daysBetween, fmtDay, isoDay, monday, toMin } from '../time.js';
import { Icon } from '../shared.jsx';
import { DateField, ParticipantPicker, TimeField, orgData, selectionSummary } from '../pickers.jsx';
import { EventTag } from './home.jsx';

const TYPES = [['meeting', 'Meeting'], ['project', 'Project'], ['committee', 'Committee'], ['other', 'Other']];
const MEETING_KEYS = ['agenda', 'minutes', 'instructions', 'chairUid', 'minutesUid', 'minutesBackupUid', 'cohostUids', 'duration'];
const TPL_KEYS = ['title', 'type', 'start', 'end', 'location', 'notes'];
const pad = (n) => String(n).padStart(2, '0');
const plusHour = (t) => { const m = Math.min(toMin(t) + 60, 1439); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

function useTrap(ref, onEscape) {
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    const back = document.activeElement, el = ref.current;
    el.querySelector('input:not([type=checkbox]), button')?.focus();
    const key = (e) => {
      if (document.querySelector('.fl-sheet')) return;
      if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); esc.current(); }
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll('a[href], button, input, select, textarea, [tabindex="0"]')].filter((x) => !x.disabled && x.tabIndex >= 0 && x.getClientRects().length);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    };
    addEventListener('keydown', key);
    document.body.classList.add('fl-locked');
    return () => { removeEventListener('keydown', key); document.body.classList.remove('fl-locked'); if (back?.isConnected) back.focus?.(); };
  }, []);
}

function Section({ id, title, children, hint }) {
  return (
    <section class="fl-esec" aria-labelledby={`es-${id}`}>
      <h3 id={`es-${id}`} class="fl-esec__h">{title}{hint && <span class="fl-small fl-muted">{hint}</span>}</h3>
      {children}
    </section>
  );
}

function initialValues({ ev, request, prefill, policy }) {
  const source = request?.proposal || ev;
  if (source) {
    const v = { ...source.configSnapshot?.defaults, ...source, ...source.meetingDefaults };
    return { ...v, notes: v.notes || '', location: v.location || '', itemId: v.itemId || '', endDate: v.endDate || '' };
  }
  const tpl = policy.templates.find((t) => t.id === policy.settings?.defaultTemplateId && t.available !== false);
  const d = eventDefaults(policy.settings, tpl, prefill?.type ? { type: prefill.type } : {});
  const date = prefill?.date || (d.type === 'meeting' ? nextThursday(isoDay()) : isoDay());
  return { ...d, ...prefill, date, public: false, allDay: !!prefill?.allDay, endDate: prefill?.endDate || '', itemId: prefill?.itemId || '', notes: prefill?.notes ?? d.notes ?? '', location: prefill?.location ?? d.location ?? '' };
}

export function EventEditor({ ev = null, request = null, prefill = null, duplicate = false, policy, close, saved, events = [] }) {
  const ref = useRef();
  const start = useMemo(() => initialValues({ ev, request, prefill, policy }), []);
  const [v, setV] = useState(start), [templateId, setTemplate] = useState(request?.proposal?.configSnapshot?.templateId || ev?.configSnapshot?.templateId || (!ev && !request && !duplicate ? policy.settings?.defaultTemplateId || '' : ''));
  const [participantsChanged, setParticipantsChanged] = useState(!ev && !request), [tried, setTried] = useState(false), [busy, setBusy] = useState(false), [pane, setPane] = useState('form'), [repeat, setRepeat] = useState('');
  const dirty = !same(v, start) || !!repeat;
  const tryClose = () => { if (!dirty || confirm('Discard your changes to this event?')) close(); };
  useTrap(ref, tryClose);
  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const on = (k) => (e) => set({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const isNew = !ev && !request, locked = ev?.public && !isAdmin();
  const template = policy.templates.find((t) => t.id === templateId) || null;
  const tplValues = template ? eventDefaults(policy.settings, template) : null;
  const approval = eventDefaults(policy.settings, template, { type: v.type }).approval;
  const goesToApproval = !isAdmin() && (approval === 'required' || !!ev?.requestId || (ev && v.type === 'meeting' && ev.type !== 'meeting') || (request && !isAdmin()));

  // Inline validation, shown after the first save attempt.
  const errors = {};
  if (!v.title?.trim()) errors.title = 'Add a title.';
  if (!v.date) errors.date = 'Choose a date.';
  if (!v.allDay && (!v.start || !v.end)) errors.end = 'Add a start and an end time.';
  else if (!v.allDay && v.end <= v.start) errors.end = 'The end time must be after the start.';
  if (v.allDay && v.endDate && v.endDate < v.date) errors.endDate = 'The last day must be on or after the first day.';
  for (const f of v.customFields || start.configSnapshot?.defaults?.customFields || [])
    if (f.required && (f.type === 'checkbox' ? v.customValues?.[f.id] !== true : !String(v.customValues?.[f.id] || '').trim())) errors[`custom-${f.id}`] = `Complete ${f.label}.`;
  const repeats = isNew && !v.allDay && repeat && repeat > v.date ? Math.min(26, Math.floor(daysBetween(v.date, repeat) / 7) + 1) : 1;
  const missing = Object.values(errors);
  const err = (k) => tried && errors[k];
  const help = (k) => (err(k) ? `ee-${k}-err` : undefined);

  const invitees = participantsChanged || isNew ? resolveParticipants(v.participantSelection, S.members, policy.groups, orgData()) : (ev?.participantUids || request?.proposal?.participantUids || []);
  // Clash: only events already loaded, so it costs no reads.
  const known = [...new Map([...S.events, ...events].map((e) => [e.id, e])).values()].filter((e) => !e.archived && e.id !== ev?.id);
  const overlaps = (e) => e.date === v.date && (e.allDay || v.allDay || (e.start < v.end && v.start < e.end));
  const clashes = known.filter(overlaps).map((e) => ({ e, n: (e.participantUids || []).filter((u) => invitees.includes(u)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);

  const pickTemplate = (id) => {
    setTemplate(id);
    const t = policy.templates.find((x) => x.id === id) || null, d = eventDefaults(policy.settings, t);
    set({ ...d, date: d.type === 'meeting' && v.date === start.date && isNew ? nextThursday(v.date) : v.date, public: false, allDay: false, endDate: '', itemId: d.itemId || '', title: d.title || v.title, notes: d.notes || '', location: d.location || '' });
    setParticipantsChanged(true);
  };
  const TplMark = ({ k }) => {
    if (!tplValues || !tplValues[k] || (Array.isArray(tplValues[k]) && !tplValues[k].length)) return null;
    return same(v[k], tplValues[k]) ? <span class="fl-tplmark">From template</span>
      : <button type="button" class="fl-tplmark fl-tplmark--reset" onClick={() => set({ [k]: tplValues[k] })}><Icon n="undo" />Reset to template</button>;
  };

  const submit = async (draft = false) => {
    setTried(true);
    if (missing.length) { ref.current.querySelector('[aria-invalid="true"]')?.focus(); return; }
    setBusy(true);
    const data = {
      title: v.title.trim().slice(0, 80), type: v.type, date: v.date, endDate: v.allDay && v.endDate > v.date ? v.endDate : '',
      start: v.allDay ? v.start || '00:00' : v.start, end: v.allDay ? (v.end > (v.start || '00:00') ? v.end : '23:59') : v.end, allDay: !!v.allDay,
      location: (v.location || '').trim().slice(0, 120), notes: (v.notes || '').slice(0, 1000), customValues: v.customValues || {},
      ...Object.fromEntries(MEETING_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, v[k]])),
      participantSelection: v.participantSelection, public: isAdmin() ? !!v.public : (ev?.public ?? false), itemId: v.itemId || null,
    };
    let ok = true, made = 0;
    for (let i = 0; i < repeats && ok; i++) {
      ok = await saveEventProposal({ event: ev, request, data: { ...data, date: addDays(v.date, 7 * i) }, templateId: templateId || null, draft, participantsChanged });
      if (ok) made++;
    }
    setBusy(false);
    if (repeats > 1) toast(ok ? `Created ${made} weekly events.` : `Created ${made} of ${repeats} events. The rest did not save; try them again.`);
    if (made) { saved(); close(); }
  };

  const stateLine = isAdmin() ? 'Admins can schedule directly.'
    : ev?.requestId ? 'Your changes go to an admin. The event stays as it is until they approve.'
      : goesToApproval ? 'Will be sent to an admin for approval before it appears.'
        : 'Appears on the calendar as soon as you save.';
  const saveLabel = busy ? 'Saving…' : request ? (isAdmin() ? 'Save and schedule' : 'Submit request') : ev ? (goesToApproval ? 'Send changes for approval' : 'Save changes') : goesToApproval ? 'Send for approval' : repeats > 1 ? `Save ${repeats} events` : 'Save event';
  const field = (k, label, input, extra) => (
    <div class={`fl-field${err(k) ? ' fl-field--error' : ''}`}>
      <span class="fl-field__row"><label for={`ee-${k}`}>{label}</label>{extra}</span>
      {input}
      {err(k) && <span id={`ee-${k}-err`} class="fl-error">{errors[k]}</span>}
    </div>
  );
  const people = S.members.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name));
  const summary = selectionSummary(v.participantSelection, policy.groups);
  const heading = ev ? 'Edit event' : request ? (isAdmin() ? 'Review request' : 'Edit request') : duplicate ? 'Duplicate event' : 'New event';

  return (
    <div class="fl-editor" role="dialog" aria-modal="true" aria-labelledby="ee-h" ref={ref}>
      <header class="fl-editor__top">
        <h2 id="ee-h" class="fl-h2">{heading}</h2>
        <div class="fl-seg fl-editor__panes" role="group" aria-label="Show">
          <button type="button" aria-pressed={pane === 'form'} onClick={() => setPane('form')}>Details</button>
          <button type="button" aria-pressed={pane === 'preview'} onClick={() => setPane('preview')}>Preview</button>
        </div>
        <button type="button" class="fl-iconbtn" aria-label="Close editor" onClick={tryClose}><Icon n="x" /></button>
      </header>
      <div class={`fl-editor__split is-${pane}`}>
        <form class="fl-editor__form" noValidate onSubmit={(e) => { e.preventDefault(); submit(false); }}>
          {locked && <p class="fl-help">This event is on the public website, so only an admin can change its title, type, time and place.</p>}
          <Section id="basics" title="Basics">
            {isNew && field('template', 'Template', (
              <select id="ee-template" class="fl-input" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                <option value="">Blank event</option>
                {policy.templates.filter((t) => t.available !== false).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>))}
            {field('title', 'Title', <input id="ee-title" class="fl-input" maxLength={80} value={v.title} onInput={on('title')} disabled={locked} aria-invalid={!!err('title')} aria-describedby={help('title')} />, <TplMark k="title" />)}
            <div class="fl-field">
              <span class="fl-field__row"><span class="fl-field__label" id="ee-type-l">Type</span><TplMark k="type" /></span>
              <div class="fl-seg fl-seg--fit" role="group" aria-labelledby="ee-type-l">
                {TYPES.map(([k, l]) => <button type="button" key={k} aria-pressed={v.type === k} disabled={locked} onClick={() => set({ type: k })}>{l}</button>)}
              </div>
            </div>
          </Section>
          <Section id="when" title="When">
            <label class="fl-checkrow"><input type="checkbox" class="fl-switch" checked={!!v.allDay} onChange={on('allDay')} disabled={locked} />All day</label>
            <div class="fl-fields">
              {field('date', v.allDay ? 'First day' : 'Date', <DateField id="ee-date" value={v.date} onChange={(d) => set({ date: d, endDate: v.endDate && v.endDate < d ? d : v.endDate })} disabled={locked} invalid={!!err('date')} describedBy={help('date')} />)}
              {v.allDay && field('endDate', 'Last day', <DateField id="ee-endDate" value={v.endDate || v.date} min={v.date} onChange={(d) => set({ endDate: d === v.date ? '' : d })} disabled={locked} invalid={!!err('endDate')} describedBy={help('endDate')} />)}
              {!v.allDay && field('start', 'Start', <TimeField id="ee-start" value={v.start} disabled={locked} onChange={(t) => set({ start: t, end: !v.end || v.end <= t ? plusHour(t) : v.end })} />, <TplMark k="start" />)}
              {!v.allDay && field('end', 'End', <TimeField id="ee-end" value={v.end} after={v.start} disabled={locked} invalid={!!err('end')} describedBy={help('end')} onChange={(t) => set({ end: t })} />, <TplMark k="end" />)}
            </div>
            {isNew && !v.allDay && (
              <div class="fl-field">
                <span class="fl-field__row"><label for="ee-repeat">Repeats weekly until</label>{repeat && <button type="button" class="fl-linkbtn fl-small" onClick={() => setRepeat('')}>Stop repeating</button>}</span>
                <DateField id="ee-repeat" value={repeat} min={addDays(v.date, 7)} onChange={setRepeat} />
                <span class="fl-help">{repeats > 1 ? `Creates ${repeats} separate events, one each ${fmtDay(v.date).split(' ')[0]}, last on ${fmtDay(addDays(v.date, 7 * (repeats - 1)))}.` : 'Leave empty for a single event. Each repeat is its own event, so you can change one without the others.'}</span>
              </div>
            )}
          </Section>
          <Section id="where" title="Where">
            {field('location', 'Place', <input id="ee-location" class="fl-input" maxLength={120} placeholder="Room, field or online" value={v.location} onInput={on('location')} disabled={locked} />, <TplMark k="location" />)}
          </Section>
          <Section id="people" title="Participants" hint={`${invitees.length} invited`}>
            <ParticipantPicker id="ee-pp" value={v.participantSelection} groups={policy.groups} onChange={(s) => { setParticipantsChanged(true); set({ participantSelection: s }); }} />
          </Section>
          <Section id="project" title="Project">
            {field('itemId', 'Linked project', (
              <select id="ee-itemId" class="fl-input" value={v.itemId} onChange={on('itemId')}>
                <option value="">None</option>{(tree().kids.root || []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>))}
          </Section>
          <Section id="notes" title="Notes">
            {field('notes', 'Notes for attendees', <textarea id="ee-notes" class="fl-input" rows={4} maxLength={1000} value={v.notes} onInput={on('notes')} />, <TplMark k="notes" />)}
            {(v.customFields || start.configSnapshot?.defaults?.customFields || []).map((f) => {
              const val = v.customValues?.[f.id], put = (x) => set({ customValues: { ...v.customValues, [f.id]: x } }), k = `custom-${f.id}`;
              return f.type === 'checkbox'
                ? <label key={f.id} class="fl-checkrow"><input type="checkbox" class="fl-switch" checked={!!val} onChange={(e) => put(e.target.checked)} />{f.label}{f.required ? '' : ' (optional)'}</label>
                : <div key={f.id}>{field(k, `${f.label}${f.required ? '' : ' (optional)'}`, f.type === 'select'
                  ? <select id={`ee-${k}`} class="fl-input" value={val || ''} onChange={(e) => put(e.target.value)} aria-invalid={!!err(k)}><option value="">Choose an option</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
                  : f.type === 'textarea' ? <textarea id={`ee-${k}`} class="fl-input" rows={3} maxLength={1000} value={val || ''} onInput={(e) => put(e.target.value)} aria-invalid={!!err(k)} />
                    : <input id={`ee-${k}`} class="fl-input" maxLength={1000} value={val || ''} onInput={(e) => put(e.target.value)} aria-invalid={!!err(k)} />)}</div>;
            })}
            {v.type === 'meeting' && (
              <details class="fl-edetails">
                <summary>Meeting roles and agenda<span class="fl-small fl-muted">{v.chairUid ? `Chair ${memberName(v.chairUid).split(' ')[0]}` : 'Chair not set'} · {v.minutesUid ? `minutes ${memberName(v.minutesUid).split(' ')[0]}` : 'minute taker not set'}</span></summary>
                <div class="fl-fields">
                  {[['chairUid', 'Chair'], ['minutesUid', 'Minute taker'], ['minutesBackupUid', 'Backup minute taker']].map(([k, l]) => field(k, l, (
                    <select id={`ee-${k}`} class="fl-input" value={v[k] || ''} onChange={(e) => set({ [k]: e.target.value || null })}>
                      <option value="">Choose later</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>)))}
                </div>
                {[['agenda', 'Agenda', 4000], ['minutes', 'Minutes outline', 4000], ['instructions', 'Instructions for participants', 1000]].map(([k, l, max]) => field(k, l, <textarea id={`ee-${k}`} class="fl-input" rows={3} maxLength={max} value={v[k] || ''} onInput={on(k)} />))}
              </details>
            )}
          </Section>
          <Section id="vis" title="Visibility">
            {isAdmin() ? <label class="fl-checkrow"><input type="checkbox" class="fl-switch" checked={!!v.public} onChange={on('public')} />Show on the public website</label>
              : <p class="fl-small fl-muted">{v.public ? 'This event is on the public website. Only admins change that.' : 'Members only. Admins decide what goes on the public website.'}</p>}
          </Section>
        </form>
        <aside class="fl-editor__preview" aria-label="Preview">
          <Preview v={v} invitees={invitees} summary={summary} clashes={clashes} known={known} />
        </aside>
      </div>
      <footer class="fl-editor__foot">
        <p class="fl-small" role="status">{tried && missing.length ? <span class="fl-error">To save, fix: {missing.map((m) => m.replace(/\.$/, '').toLowerCase()).join('; ')}.</span> : stateLine}</p>
        <div class="fl-actions">
          <button type="button" class="fl-btn fl-btn--ghost" onClick={tryClose}>Cancel</button>
          {!ev && !(request && isAdmin()) && repeats === 1 && <button type="button" class="fl-btn fl-btn--ghost" disabled={busy} onClick={() => submit(true)}>Save draft</button>}
          <button type="button" class="fl-btn fl-btn--red" disabled={busy} onClick={() => submit(false)}>{saveLabel}</button>
        </div>
      </footer>
    </div>
  );
}

// ---------- Preview pane

function Preview({ v, invitees, summary, clashes, known }) {
  const when = v.allDay ? (v.endDate && v.endDate > v.date ? `${fmtDay(v.date)} to ${fmtDay(v.endDate)}` : `${fmtDay(v.date)} · All day`) : `${fmtDay(v.date)} · ${v.start || '--:--'} to ${v.end || '--:--'}`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday(v.date || isoDay()), i));
  const lo = 7 * 60, hi = 21 * 60, y = (t) => `${(100 * (Math.min(hi, Math.max(lo, toMin(t))) - lo)) / (hi - lo)}%`;
  const project = v.itemId && tree().byId[v.itemId];
  return (
    <div class="fl-preview">
      <section aria-labelledby="pv-card">
        <h3 id="pv-card" class="fl-esec__h">As attendees see it</h3>
        <div class="fl-pvcard">
          <span class="fl-small fl-mono fl-muted">{when}</span>
          <p class="fl-pvcard__title">{v.title?.trim() || 'Untitled event'}</p>
          <div class="fl-stats"><EventTag type={v.type} />{v.public && <span class="fl-tag fl-tag--public">Public</span>}{v.location && <span class="fl-small">{v.location}</span>}{project && <span class="fl-small fl-muted">{project.title}</span>}</div>
          {v.notes && <p class="fl-small fl-pre fl-pvcard__notes">{v.notes}</p>}
        </div>
      </section>
      <section aria-labelledby="pv-week">
        <h3 id="pv-week" class="fl-esec__h">That week<span class="fl-small fl-muted">07:00 to 21:00</span></h3>
        <div class="fl-strip" role="img" aria-label={`Week of ${fmtDay(days[0])}${clashes.length ? `, ${clashes.length} clashes` : ''}`}>
          {days.map((d) => {
            const list = known.filter((e) => e.date === d && !e.allDay), mine = d === v.date;
            return (
              <div key={d} class={`fl-strip__day${mine ? ' is-this' : ''}`}>
                <span class="fl-strip__label">{fmtDay(d).split(' ').slice(0, 2).join(' ')}</span>
                <div class="fl-strip__col">
                  {list.map((e) => <i key={e.id} class={`fl-strip__ev${clashes.some((c) => c.e.id === e.id) ? ' is-clash' : ''}`} style={{ top: y(e.start), height: `calc(${y(e.end)} - ${y(e.start)})` }} title={`${e.title} ${e.start}`} />)}
                  {mine && !v.allDay && v.start && v.end > v.start && <i class="fl-strip__ev is-new" style={{ top: y(v.start), height: `calc(${y(v.end)} - ${y(v.start)})` }} />}
                  {mine && v.allDay && <i class="fl-strip__ev is-new" style={{ top: 0, height: '100%' }} />}
                </div>
              </div>
            );
          })}
        </div>
        {clashes.length ? (
          <ul class="fl-clash" aria-live="polite">{clashes.slice(0, 3).map(({ e, n }) => (
            <li key={e.id}><span class="fl-badge fl-badge--warn">Clash</span><span>{n} {n === 1 ? 'invitee already has' : 'invitees already have'} <b>{e.title}</b> at that time ({e.start} to {e.end}).</span></li>))}</ul>
        ) : <p class="fl-small fl-muted">No clashes with events already on the calendar.</p>}
      </section>
      <section aria-labelledby="pv-people">
        <h3 id="pv-people" class="fl-esec__h">Invitations<span class="fl-mono">{invitees.length}</span></h3>
        {summary.rows.length || summary.include.length ? (
          <ul class="fl-pvlist">
            {summary.rows.map((r, i) => <li key={i}><span>{r.name}</span><small>{r.kind}</small><span class="fl-mono">{r.n}</span></li>)}
            {summary.include.length > 0 && <li><span>Added one by one</span><small>People</small><span class="fl-mono">{summary.include.length}</span></li>}
            {summary.exclude.length > 0 && <li><span>Left out</span><small>People</small><span class="fl-mono">{summary.exclude.length}</span></li>}
          </ul>
        ) : <p class="fl-small fl-muted">Nobody invited yet. Pick a department, a rank or a team, or search for a person.</p>}
      </section>
      <section aria-labelledby="pv-pub">
        <h3 id="pv-pub" class="fl-esec__h">Public website</h3>
        <p class="fl-small">{v.public ? `Visitors will see: ${v.title?.trim() || 'Untitled event'}, ${when}${v.location ? `, ${v.location}` : ''}. Names and notes stay private.` : 'Not on the public website. Only signed-in members see it.'}</p>
      </section>
    </div>
  );
}
