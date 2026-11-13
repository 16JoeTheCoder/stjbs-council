import { useEffect, useRef, useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { activeMembers, applyFilter, canManage, progress, taskState, tree } from '../model.js';
import { createItem } from '../actions.js';
import { fmtDay } from '../time.js';
import { Badge, Bar, Chip, FilterBar, TaskRow, Title, useFilter } from '../ui.jsx';

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
  const blocked = all.filter((t) => t.blocked && t.status !== 'done'), overdue = all.filter((t) => taskState(t).word === 'Overdue');
  return (
    <>
      <Title light={`${root.title}.`} bold="Meeting." title={`${root.title} meeting`} />
      <p class="fl-rowmeta"><a class="fl-link" href={`#/p/${id}`}>Back to project</a></p>
      <section class="fl-panel fl-section" aria-labelledby="ag-h">
        <h2 id="ag-h" class="fl-h2">Agenda</h2>
        {!blocked.length && !overdue.length && <p>Nothing blocked or overdue. Run through the lanes.</p>}
        {blocked.map((t) => <p key={t.id}><Badge s={taskState(t)} /> <a class="fl-link" href={`#/p/${t.id}`}>{t.title}</a>{t.blockedReason && <>: "{t.blockedReason}"</>}</p>)}
        {overdue.map((t) => <p key={t.id}><Badge s={taskState(t)} /> <a class="fl-link" href={`#/p/${t.id}`}>{t.title}</a> <span class="fl-mono">{fmtDay(t.dueDate)}</span></p>)}
      </section>
      <FilterBar list={all} f={f} set={setF} hideList />
      <p class="fl-caption">The meeting view is built for a wide screen. Scroll sideways to see every lane.</p>
      <div class="fl-scroll"><div class="fl-lanes" role="list" aria-label="Subteams">
        {lanes.map((lane) => {
          const tasks = lane === root ? (kids[id] || []).filter((x) => x.kind === 'task') : under(lane.id), p = progress(tasks);
          return (
            <section key={lane.id} class="fl-lane" role="listitem" aria-label={lane.title}>
              <div class="fl-section"><h3 class="fl-h3"><a href={`#/p/${lane.id}`}>{lane === root ? 'Project tasks' : lane.title}</a></h3>
                {lane.leadUid && <span class="fl-person"><Chip email={lane.leadUid} lead /><span>{memberName(lane.leadUid)}</span></span>}
                <Bar done={p.done} total={p.total} label={`${lane.title} progress`} /><span class="fl-mono fl-small">{p.done} of {p.total} {p.total === 1 ? "task" : "tasks"}</span></div>
              <div class="fl-list">{tasks.filter((t) => visible.has(t.id)).map((t) => <TaskRow key={t.id} t={t} />)}</div>
              {canManage(lane) && <LaneAdd lane={lane} open={open === lane.id} setOpen={setOpen} accent={open == null && lane === lanes.find(canManage)} />}
            </section>
          );
        })}
      </div></div>
    </>
  );
}
