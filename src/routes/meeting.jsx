import { useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { activeMembers, applyFilter, checksIn, canManage, personStatus, progress, taskState, tree } from '../model.js';
import { createItem, saveCheckin } from '../actions.js';
import { week } from '../time.js';
import { Badge, Bar, Chip, FilterBar, TaskRow, Title, useFilter } from '../ui.jsx';

export function Checkin() {
  const w = week(), ci = S.checkins.find((c) => c.uid === S.me.id && c.weekId === w.id) || {};
  const [v, setV] = useState({ done: ci.done || '', doing: ci.doing || '', blocked: ci.blocked || '' }), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (await saveCheckin({ done: v.done.trim(), doing: v.doing.trim(), blocked: v.blocked.trim() })) location.hash = '#/week';
    else setBusy(false);
  };
  const box = (k, label, help) => (
    <label class="jy-field jy-field--wide"><span class="jy-field__label">{label}</span>
      <textarea class="jy-field__input" rows={3} maxLength={500} value={v[k]} onInput={(e) => setV({ ...v, [k]: e.target.value })} aria-describedby={`${k}-help`} />
      <span id={`${k}-help`} class="jy-field__help">{help}</span></label>
  );
  return (
    <>
      <Title light={`Week ${w.id.slice(6)}.`} bold="Check in." title="Check-in" />
      <p class="jy-caption">Due Friday <span class="jy-mono">{w.due}</span> 23:59. You can edit it until Sunday <span class="jy-mono">{w.end}</span>.</p>
      <form class="jy-form jy-section" onSubmit={submit}>
        {box('done', 'Done', 'What you finished this week.')}
        {box('doing', 'Doing', 'What you work on next.')}
        {box('blocked', 'Blocked', 'What stops you. Leave empty if nothing does.')}
        <div class="jy-actions"><button class="jy-btn jy-btn--accent" disabled={busy}>Submit check-in</button><a href="#/week">Cancel</a></div>
      </form>
    </>
  );
}

function LaneAdd({ lane, open, setOpen }) {
  const [title, setTitle] = useState(''), [who, setWho] = useState(''), [due, setDue] = useState(''), [busy, setBusy] = useState(false);
  if (!open) return <button class="jy-btn jy-btn--ghost jy-btn--s" onClick={() => setOpen(lane.id)}>Add task</button>;
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    if (await createItem(lane, { title: title.trim().slice(0, 80), assigneeUids: who ? [who] : [], dueDate: due || null })) { setTitle(''); setWho(''); setDue(''); }
    setBusy(false);
  };
  return (
    <form class="jy-form jy-panel" onSubmit={submit}>
      <label class="jy-field"><span class="jy-field__label">Task</span><input class="jy-field__input" maxLength={80} value={title} onInput={(e) => setTitle(e.target.value)} /></label>
      <label class="jy-field"><span class="jy-field__label">Who</span><select class="jy-field__input" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">Nobody yet</option>{activeMembers().filter((m) => m.role !== 'teacher').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label class="jy-field"><span class="jy-field__label">Due</span><input class="jy-field__input" type="date" value={due} onInput={(e) => setDue(e.target.value)} /></label>
      <div class="jy-actions"><button class="jy-btn jy-btn--accent" disabled={busy || !title.trim()}>Add task</button>
        <button type="button" class="jy-btn jy-btn--ghost jy-btn--s" onClick={() => setOpen(null)}>Done adding</button></div>
    </form>
  );
}

export function Meeting({ id }) {
  const { byId, kids, under } = tree(), root = byId[id];
  const [f, setF] = useFilter('meeting'), [open, setOpen] = useState(null);
  if (!root) return <><Title light="Not found." bold="No such project" /><a href="#/projects">Go to Projects</a></>;
  const lanes = [...(kids[id] || []).filter((x) => x.kind !== 'task'), ...((kids[id] || []).some((x) => x.kind === 'task') ? [root] : [])];
  const all = under(id), visible = new Set(applyFilter(all, f).out.map((t) => t.id));
  const voters = activeMembers().filter(checksIn);
  const statuses = voters.map((m) => personStatus(m.id));
  const checked = statuses.filter((s) => s.ci).length;
  const blocked = all.filter((t) => t.blocked && t.status !== 'done'), overdue = all.filter((t) => taskState(t).word === 'Overdue');
  return (
    <>
      <Title light={`${root.title}.`} bold="Meeting." title={`${root.title} meeting`} />
      <p class="jy-meta"><span class="jy-mono">{checked} of {voters.length}</span> checked in for {week().id}. <a href="#/digest">Open digest</a> <a href={`#/p/${id}`}>Back to project</a></p>
      <section class="jy-agenda jy-section" aria-labelledby="ag-h">
        <h2 id="ag-h" class="jy-h2">Agenda</h2>
        {!blocked.length && !overdue.length && !statuses.some((s) => s.blocked) && <p>Nothing blocked or overdue. Run through the lanes.</p>}
        {blocked.map((t) => <p key={t.id}><Badge s={taskState(t)} /> <a href={`#/p/${t.id}`}>{t.title}</a>{t.blockedReason && <>: "{t.blockedReason}"</>}</p>)}
        {statuses.filter((s) => s.blocked).map((s, i) => <p key={i}><Badge s={{ cls: 'bad', word: 'Blocked' }} /> {s.line}</p>)}
        {overdue.map((t) => <p key={t.id}><Badge s={taskState(t)} /> <a href={`#/p/${t.id}`}>{t.title}</a> <span class="jy-mono">{t.dueDate}</span></p>)}
      </section>
      <FilterBar list={all} f={f} set={setF} hideList />
      <p class="jy-wide-note jy-caption">The meeting view is built for a wide screen. Scroll sideways to see every lane.</p>
      <div class="jy-lanes" role="list" aria-label="Subteams">
        {lanes.map((lane) => {
          const tasks = lane === root ? (kids[id] || []).filter((x) => x.kind === 'task') : under(lane.id), p = progress(tasks);
          return (
            <section key={lane.id} class="jy-lane" role="listitem" aria-label={lane.title}>
              <div class="jy-panel"><h3 class="jy-h3"><a href={`#/p/${lane.id}`}>{lane === root ? 'Project tasks' : lane.title}</a></h3>
                {lane.leadUid && <span class="jy-person-named"><Chip email={lane.leadUid} lead /><span>{memberName(lane.leadUid)}</span></span>}
                <Bar done={p.done} total={p.total} label={`${lane.title} progress`} /><span class="jy-mono">{p.done} of {p.total} tasks</span></div>
              <ul class="jy-list">{tasks.filter((t) => visible.has(t.id)).map((t) => <TaskRow key={t.id} t={t} />)}</ul>
              {canManage(lane) && <LaneAdd lane={lane} open={open === lane.id} setOpen={setOpen} />}
            </section>
          );
        })}
      </div>
    </>
  );
}
