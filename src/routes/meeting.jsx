import { useEffect, useRef, useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { activeMembers, applyFilter, checksIn, canManage, personStatus, progress, taskState, tree } from '../model.js';
import { createItem, saveCheckin } from '../actions.js';
import { fmtDay, week } from '../time.js';
import { Badge, Bar, Chip, FilterBar, TaskRow, Title, useFilter } from '../ui.jsx';

export function Checkin() {
  const w = week(), ci = S.checkins.find((c) => c.uid === S.me.id && c.weekId === w.id) || {};
  const [v, setV] = useState({ done: ci.done || '', doing: ci.doing || '', blocked: ci.blocked || '' }), [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!checksIn(S.me)) return <><Title light="Check-in." bold="Not needed for you." title="Check-in" /><p class="fl-muted">The advisor and teachers do not check in. The members' answers are on their profiles and in the meeting view.</p></>;
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!v.done.trim() && !v.doing.trim() && !v.blocked.trim()) return setErr('Write at least one answer, then submit.');
    setBusy(true);
    if (await saveCheckin({ done: v.done.trim(), doing: v.doing.trim(), blocked: v.blocked.trim() })) location.hash = '#/week';
    else setBusy(false);
  };
  const box = (k, label, help) => (
    <label class="fl-field"><span class="fl-field__label">{label}</span>
      <textarea class="fl-input" rows={3} maxLength={500} value={v[k]} onInput={(e) => setV({ ...v, [k]: e.target.value })} aria-describedby={`${k}-help`} />
      <span id={`${k}-help`} class="fl-help">{help}</span></label>
  );
  return (
    <>
      <Title light={`Week ${w.id.slice(6)}.`} bold="Check in." title="Check-in" />
      <p class="fl-muted">Due {fmtDay(w.due)}, 23:59 Jakarta time. You can edit it until {fmtDay(w.end)}.</p>
      <form class="fl-panel fl-form" onSubmit={submit}>
        {box('done', 'Done', 'What you finished this week.')}
        {box('doing', 'Doing', 'What you work on next.')}
        {box('blocked', 'Blocked', 'What stops you. Leave empty if nothing does.')}
        <p class="fl-error" role="alert">{err}</p>
        <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>Submit check-in</button><a class="fl-btn fl-btn--ghost" href="#/week">Cancel</a></div>
      </form>
    </>
  );
}

// The first lane's trigger is the view's one accent while no lane form is open; an open form carries it instead.
function LaneAdd({ lane, open, setOpen, accent }) {
  const [title, setTitle] = useState(''), [who, setWho] = useState(''), [due, setDue] = useState(''), [busy, setBusy] = useState(false);
  const ref = useRef(), was = useRef(open);
  useEffect(() => { if (open || was.current) ref.current?.querySelector('input, button')?.focus(); was.current = open; }, [open]);
  if (!open) return <div ref={ref}><button class={`fl-btn fl-btn--sm ${accent ? 'fl-btn--red' : 'fl-btn--ghost'}`} onClick={() => setOpen(lane.id)}>Add task</button></div>;
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    if (await createItem(lane, { title: title.trim().slice(0, 80), assigneeUids: who ? [who] : [], dueDate: due || null })) { setTitle(''); setWho(''); setDue(''); }
    setBusy(false);
  };
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref}>
      <label class="fl-field"><span class="fl-field__label">Task</span><input class="fl-input" maxLength={80} value={title} onInput={(e) => setTitle(e.target.value)} /></label>
      <label class="fl-field"><span class="fl-field__label">Who</span><select class="fl-input" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">Nobody yet</option>{activeMembers().filter((m) => m.role !== 'teacher').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label class="fl-field"><span class="fl-field__label">Due</span><input class="fl-input" type="date" value={due} onInput={(e) => setDue(e.target.value)} /></label>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy || !title.trim()}>Add task</button>
        <button type="button" class="fl-btn fl-btn--ghost" onClick={() => setOpen(null)}>Close form</button></div>
    </form>
  );
}

export function Meeting({ id }) {
  const { byId, kids, under } = tree(), root = byId[id];
  const [f, setF] = useFilter('meeting'), [open, setOpen] = useState(null);
  if (!root) return <><Title light="Not found." bold="No such project" /><a class="fl-link" href="#/projects">Go to Projects</a></>;
  const lanes = [...(kids[id] || []).filter((x) => x.kind !== 'task'), ...((kids[id] || []).some((x) => x.kind === 'task') ? [root] : [])];
  const all = under(id), visible = new Set(applyFilter(all, f).out.map((t) => t.id));
  const voters = activeMembers().filter(checksIn);
  const statuses = voters.map((m) => personStatus(m.id));
  const checked = statuses.filter((s) => s.ci).length;
  const blocked = all.filter((t) => t.blocked && t.status !== 'done'), overdue = all.filter((t) => taskState(t).word === 'Overdue');
  return (
    <>
      <Title light={`${root.title}.`} bold="Meeting." title={`${root.title} meeting`} />
      <p class="fl-rowmeta"><span class="fl-mono">{checked} of {voters.length}</span> checked in for {week().id.slice(5)}. <a class="fl-link" href="#/digest">Open digest</a> <a class="fl-link" href={`#/p/${id}`}>Back to project</a></p>
      <section class="fl-panel fl-section" aria-labelledby="ag-h">
        <h2 id="ag-h" class="fl-h2">Agenda</h2>
        {!blocked.length && !overdue.length && !statuses.some((s) => s.blocked) && <p>Nothing blocked or overdue. Run through the lanes.</p>}
        {blocked.map((t) => <p key={t.id}><Badge s={taskState(t)} /> <a class="fl-link" href={`#/p/${t.id}`}>{t.title}</a>{t.blockedReason && <>: "{t.blockedReason}"</>}</p>)}
        {statuses.filter((s) => s.blocked).map((s, i) => <p key={i}><Badge s={{ cls: 'bad', word: 'Blocked' }} /> {s.line}</p>)}
        {overdue.map((t) => <p key={t.id}><Badge s={taskState(t)} /> <a class="fl-link" href={`#/p/${t.id}`}>{t.title}</a> <span class="fl-mono">{fmtDay(t.dueDate)}</span></p>)}
      </section>
      <FilterBar list={all} f={f} set={setF} hideList />
      <p class="fl-caption">The meeting view is built for a wide screen. Scroll sideways to see every lane.</p>
      <div class="fl-scroll"><div class="fl-lanes" role="list" aria-label="Subteams">
        {lanes.map((lane, i) => {
          const tasks = lane === root ? (kids[id] || []).filter((x) => x.kind === 'task') : under(lane.id), p = progress(tasks);
          return (
            <section key={lane.id} class="fl-lane" role="listitem" aria-label={lane.title}>
              <div class="fl-section"><h3 class="fl-h3"><a href={`#/p/${lane.id}`}>{lane === root ? 'Project tasks' : lane.title}</a></h3>
                {lane.leadUid && <span class="fl-person"><Chip email={lane.leadUid} lead /><span>{memberName(lane.leadUid)}</span></span>}
                <Bar done={p.done} total={p.total} label={`${lane.title} progress`} /><span class="fl-mono fl-small">{p.done} of {p.total} tasks</span></div>
              <div class="fl-list">{tasks.filter((t) => visible.has(t.id)).map((t) => <TaskRow key={t.id} t={t} />)}</div>
              {canManage(lane) && <LaneAdd lane={lane} open={open === lane.id} setOpen={setOpen} accent={open == null && lane === lanes.find(canManage)} />}
            </section>
          );
        })}
      </div></div>
    </>
  );
}
