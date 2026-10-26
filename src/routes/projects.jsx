import { useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { STAGES, activeMembers, canManage, canWork, isBoss, progress, safeUrl, taskState, tree } from '../model.js';
import { archiveItem, changeLead, createItem, updateItem } from '../actions.js';
import { idr } from '../time.js';
import { Badge, Bar, Chips, Comments, FilterBar, ItemCard, Title, useAutofocus, useFilter, useReturnFocus } from '../ui.jsx';
import { Feed } from './feed.jsx';
import { TeamChart, Timeline, exportProject } from './views.jsx';

export function Projects() {
  const roots = tree().kids.root || [];
  const [adding, setAdding] = useState(false), back = useReturnFocus(adding);
  return (
    <>
      <Title light="All projects." bold={`${roots.length} running.`} title="Projects" />
      {isBoss() && S.me.role !== 'teacher' && (adding ? <ItemForm kind="project" done={() => setAdding(false)} /> :
        <div class="jy-actions" ref={back}><button class="jy-btn jy-btn--ghost" onClick={() => setAdding(true)}>New project</button><a class="jy-btn jy-btn--ghost" href="#/templates">Start from template</a></div>)}
      <div class="jy-split">
        <div class="jy-grid">{roots.length ? roots.map((it) => <ItemCard key={it.id} it={it} />) : <p class="jy-empty">No projects yet. An exec or the advisor can start one.</p>}</div>
        <aside class="jy-well" aria-label="Recent activity"><Feed compact /></aside>
      </div>
    </>
  );
}

function Crumbs({ it }) {
  const { byId } = tree();
  return (
    <nav aria-label="Breadcrumb" class="jy-crumbs"><a href="#/projects">Projects</a>
      {it.ancestors.map((a) => byId[a] && <span key={a}> / <a href={`#/p/${a}`}>{byId[a].title}</a></span>)}<span aria-current="page"> / {it.title}</span></nav>
  );
}

export function Item({ id, q }) {
  const { byId, kids, under } = tree(), it = byId[id];
  const [f, setF] = useFilter('project');
  const [form, setForm] = useState(null), back = useReturnFocus(!!form);
  if (!it) return <><Title light="Not found." bold="This item is gone" /><p>It may be archived or from another term. <a href="#/projects">Go to Projects</a></p></>;
  if (it.kind === 'task') return <Task it={it} />;
  const list = under(it.id), p = progress(list), pct = p.total ? Math.round((100 * p.done) / p.total) : 0;
  const view = q.get('view') || 'cards', groups = (kids[it.id] || []).filter((k) => k.kind !== 'task');
  const deals = list.filter((t) => t.isDeal), teams = S.items.filter((x) => x.kind === 'team' && x.ancestors.includes(it.id));
  const stats = [['Done', pct, '%'], ['Tasks', p.total, ''], ['Overdue', list.filter((t) => taskState(t).word === 'Overdue').length, ''], ['Blocked', list.filter((t) => t.blocked && t.status !== 'done').length, '']];
  return (
    <>
      <Crumbs it={it} />
      <Title light={`${it.title}.`} bold={`${pct}% done.`} title={it.title} />
      <div class="jy-stats">{stats.map(([label, v, unit], i) => (
        <div key={label} class={`jy-stat${i ? ' jy-stat--quiet' : ''}`}><span class="jy-stat__label">{label}</span><span class="jy-stat__value">{v}<span class="jy-stat__unit">{unit}</span></span></div>
      ))}</div>
      <p class="jy-meta">{it.leadUid && <span>Lead: {memberName(it.leadUid)}</span>}{it.dueDate && <span class="jy-mono">Due {it.dueDate}</span>}</p>
      {it.notes && <p class="jy-pre">{it.notes}</p>}
      <nav class="jy-views" aria-label="Views">
        {[['cards', 'Cards'], ['timeline', 'Timeline'], ['team', 'Team chart']].map(([k, label]) => (
          <a key={k} href={`#/p/${it.id}${k === 'cards' ? '' : `?view=${k}`}`} aria-current={view === k ? 'page' : undefined}>{label}</a>))}
        {!it.parentId && <a href={`#/meeting/${it.id}`}>Meeting view</a>}
        {!it.parentId && <button class="jy-link" onClick={() => exportProject(it)}>Export as template</button>}
      </nav>
      {canManage(it) && (form ? <ItemForm parent={it} kind={form} done={() => setForm(null)} /> : (
        <div class="jy-actions" ref={back}>
          <button class="jy-btn jy-btn--ghost" onClick={() => setForm('task')}>Add task</button>
          {it.ancestors.length < 2 && <button class="jy-btn jy-btn--ghost" onClick={() => setForm('team')}>Add subteam</button>}
          <button class="jy-btn jy-btn--ghost" onClick={() => setForm('edit')}>Edit {it.kind === 'project' ? 'project' : 'subteam'}</button>
        </div>))}
      {view === 'timeline' && <Timeline root={it} />}
      {view === 'team' && <TeamChart root={it} />}
      {view === 'cards' && <>
        {groups.length > 0 && <div class="jy-grid jy-section">{groups.map((g) => <ItemCard key={g.id} it={g} />)}</div>}
        {deals.length > 0 && <DealTable deals={deals} />}
        <section class="jy-section" aria-labelledby="tasks-h"><h2 id="tasks-h" class="jy-h2">Tasks</h2>
          <FilterBar list={list} f={f} set={setF} teams={teams} /></section>
      </>}
    </>
  );
}

function DealTable({ deals }) {
  const sum = (k) => deals.reduce((a, d) => a + (d[k] || 0), 0);
  return (
    <section class="jy-section jy-scroll" aria-labelledby="deals-h"><h2 id="deals-h" class="jy-h2">Deals</h2>
      <table class="jy-table"><thead><tr><th>Deal</th><th>Stage</th><th class="num">Pledged</th><th class="num">Received</th></tr></thead>
        <tbody>{deals.map((d) => (
          <tr key={d.id}><td><a href={`#/p/${d.id}`}>{d.title}</a></td><td>{d.dealStage}</td><td class="num">{idr(d.pledgedIdr)}</td><td class="num">{idr(d.receivedIdr)}</td></tr>))}
          <tr><td><b>Total</b></td><td /><td class="num">{idr(sum('pledgedIdr'))}</td><td class="num">{idr(sum('receivedIdr'))}</td></tr></tbody></table>
    </section>
  );
}

export const StageBar = ({ stage }) => {
  const n = STAGES.indexOf(stage) + 1;
  return (
    <div class="jy-stagebar" role="img" aria-label={`Stage ${n} of 4: ${stage}`}>
      <span class="jy-steps">{STAGES.map((s, i) => <i key={s} class={i < n ? 'on' : ''} />)}</span>
      <span class="jy-mono">Stage {n} of 4 · {stage}</span>
    </div>
  );
};

function Task({ it }) {
  const [edit, setEdit] = useState(false), back = useReturnFocus(edit);
  const url = safeUrl(it.link), s = taskState(it);
  return (
    <>
      <Crumbs it={it} />
      <Title bold={it.title} title={it.title} />
      <p class="jy-meta"><Badge s={s} />{it.isDeal && <span class="jy-tag">Deal</span>}<Chips list={it.assigneeUids} />
        <span class="jy-mono">{it.dueDate ? `Due ${it.dueDate}` : 'No due date'}</span></p>
      {it.blocked && <p class="jy-pre">Blocked{it.blockedOnUid ? ` on ${memberName(it.blockedOnUid)}` : ''}: {it.blockedReason || 'no reason given'}</p>}
      {it.notes && <p class="jy-pre">{it.notes}</p>}
      {url && <p><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></p>}
      {it.isDeal && <section class="jy-section" aria-label="Deal"><StageBar stage={it.dealStage} />
        <p class="jy-mono">Pledged {idr(it.pledgedIdr)} · received {idr(it.receivedIdr)}</p></section>}
      {canWork(it) && (edit ? <ItemForm item={it} done={() => setEdit(false)} /> : <div class="jy-actions" ref={back}><button class="jy-btn" onClick={() => setEdit(true)}>Update task</button></div>)}
      <Comments it={it} />
    </>
  );
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const WORK = ['status', 'blocked', 'blockedReason', 'blockedOnUid', 'notes', 'link'], DEAL = ['dealStage', 'pledgedIdr', 'receivedIdr'];

// One form for create and edit. Assignees see only the fields the rules let them change.
function ItemForm({ item, parent, kind, done }) {
  const editing = kind === 'edit' ? parent : item, manage = editing ? canManage(editing) : true;
  const k = editing?.kind || kind;
  const [v, setV] = useState(editing ? { ...editing } : { title: '', dueDate: '', startDate: '', notes: '', link: '', assigneeUids: [], leadUid: '', isDeal: false });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), ref = useAutofocus();
  const bad = (field, msg) => { setErr({ field, msg }); ref.current.querySelector(`[name=${field}]`)?.focus(); };
  const on = (key, num) => (e) => setV({ ...v, [key]: e.target.type === 'checkbox' ? e.target.checked : num ? Number(e.target.value) || 0 : e.target.value });
  const field = (key, label, type = 'text', extra = {}) => (
    <label class={`jy-field${err.field === key ? ' jy-field--error' : ''}`}><span class="jy-field__label">{label}</span>
      <input class="jy-field__input" name={key} type={type} value={v[key] ?? ''} onInput={on(key, type === 'number')} {...extra}
        aria-invalid={err.field === key || undefined} aria-describedby={err.field === key ? 'item-err' : undefined} /></label>
  );
  const submit = async (e) => {
    e.preventDefault();
    if (manage && !v.title.trim()) return bad('title', 'Add a title, then save.');
    if (v.link && !safeUrl(v.link)) return bad('link', 'The link must start with http:// or https://.');
    setErr({}); setBusy(true);
    const data = manage ? pick(v, ['title', 'dueDate', 'startDate', 'notes', 'link', ...(k === 'task' ? ['assigneeUids', 'isDeal', ...WORK, ...DEAL] : [])])
      : pick(v, [...WORK, ...(editing.isDeal ? DEAL : [])]);
    for (const key of ['dueDate', 'startDate', 'blockedOnUid']) if (data[key] === '') data[key] = null;
    if (data.title) data.title = data.title.trim().slice(0, 80);
    let ok;
    if (!editing) ok = await createItem(parent, { ...data, kind: k, leadUid: v.leadUid || null });
    else {
      ok = await updateItem(editing, data);
      if (ok && k !== 'task' && (v.leadUid || null) !== (editing.leadUid || null)) await changeLead(editing, v.leadUid || null);
    }
    setBusy(false);
    if (ok) done();
  };
  const people = activeMembers().filter((m) => m.role !== 'teacher');
  return (
    <form class="jy-form jy-panel" onSubmit={submit} ref={ref} noValidate>
      <h2 class="jy-h2">{editing ? `Edit ${k}` : `New ${k}`}</h2>
      {manage && field('title', 'Title', 'text', { maxLength: 80, required: true })}
      {manage && <div class="jy-row">{field('startDate', 'Start date', 'date')}{field('dueDate', 'Due date', 'date')}</div>}
      {manage && k !== 'task' && (
        <label class="jy-field"><span class="jy-field__label">Lead</span>
          <select class="jy-field__input" value={v.leadUid || ''} onChange={on('leadUid')}><option value="">No lead</option>
            {people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>)}
      {manage && k === 'task' && (
        <fieldset class="jy-fieldset"><legend class="jy-field__label">Assignees</legend>
          {people.map((m) => (<label key={m.id} class="jy-check-row"><input type="checkbox" checked={v.assigneeUids.includes(m.id)}
            onChange={(e) => setV({ ...v, assigneeUids: e.target.checked ? [...v.assigneeUids, m.id] : v.assigneeUids.filter((x) => x !== m.id) })} />{m.name}</label>))}
        </fieldset>)}
      {editing && k === 'task' && (<>
        <label class="jy-field"><span class="jy-field__label">Status</span>
          <select class="jy-field__input" value={v.status} onChange={on('status')}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select></label>
        <label class="jy-check-row"><input type="checkbox" checked={v.blocked} onChange={on('blocked')} />Blocked</label>
        {v.blocked && <>{field('blockedReason', 'What is blocking it', 'text', { maxLength: 200 })}
          <label class="jy-field"><span class="jy-field__label">Blocked on</span>
            <select class="jy-field__input" value={v.blockedOnUid || ''} onChange={on('blockedOnUid')}><option value="">Nobody in the council</option>
              {activeMembers().map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></>}
      </>)}
      <label class="jy-field jy-field--wide"><span class="jy-field__label">Notes</span>
        <textarea class="jy-field__input" rows={3} maxLength={1000} value={v.notes} onInput={on('notes')} /></label>
      {field('link', 'Link', 'url', { placeholder: 'https://' })}
      {manage && k === 'task' && <label class="jy-check-row"><input type="checkbox" checked={v.isDeal} onChange={on('isDeal')} />This is a deal with an outside party</label>}
      {editing && k === 'task' && v.isDeal && editing.isDeal && (<div class="jy-row">
        <label class="jy-field"><span class="jy-field__label">Deal stage</span>
          <select class="jy-field__input" value={v.dealStage} onChange={on('dealStage')}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></label>
        {field('pledgedIdr', 'Pledged (IDR)', 'number', { min: 0 })}{field('receivedIdr', 'Received (IDR)', 'number', { min: 0 })}</div>)}
      <p id="item-err" class="jy-error" role="alert">{err.msg}</p>
      <div class="jy-actions">
        <button class="jy-btn jy-btn--ghost" disabled={busy}>{editing ? 'Save changes' : `Add ${k}`}</button>
        <button type="button" class="jy-btn jy-btn--ghost" onClick={done}>Cancel</button>
        {editing && manage && <button type="button" class="jy-btn jy-btn--ghost" onClick={() => archiveItem(editing).then((ok) => ok && (location.hash = editing.parentId ? `#/p/${editing.parentId}` : '#/projects'))}>Archive {k}</button>}
      </div>
    </form>
  );
}
export { ItemForm };
