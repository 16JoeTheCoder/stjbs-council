import { useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { STAGES, activeMembers, canManage, canWork, groupState, isAdmin, isExec, progress, safeUrl, taskState, tree } from '../model.js';
import { archiveItem, changeLead, createItem, updateItem } from '../actions.js';
import { fmtDay, idr } from '../time.js';
import { STAGE_WORD } from '../feed.js';
import { Icon } from '../shared.jsx';
import { Badge, Chips, Comments, Empty, FilterBar, ItemCard, Title, pct, useAutofocus, useFilter, useReturnFocus } from '../ui.jsx';
import { Steps } from './home.jsx';
import { TeamChart, Timeline, exportProject } from './views.jsx';

export const wa = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const link = (path) => `${location.origin}/app/#${path}`;
const COLUMNS = [['todo', 'Planning'], ['doing', 'In progress'], ['done', 'Done']];

// The soonest open task under a root, for the Progress card.
const nextTask = (id) => tree().under(id).filter((t) => t.status !== 'done' && t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

function PublicSwitch({ it }) {
  if (!isAdmin()) return null;
  return (
    <label class="fl-checkrow fl-small">
      <input type="checkbox" class="fl-switch" checked={it.public === true} onChange={() => updateItem(it, { public: !it.public }, it.public ? 'made private' : 'made public')} />
      Public
    </label>
  );
}

function ProgressCard({ it }) {
  const list = tree().under(it.id), p = progress(list), next = nextTask(it.id);
  return (
    <article class="fl-card">
      <div class="fl-card__meta"><a class="fl-h3" href={`#/p/${it.id}`}>{it.title}</a><Badge s={groupState(list)} /></div>
      <Steps root={it} />
      <div class="fl-card__meta">
        <span class="fl-mono fl-small">{pct(p)}% · {p.done} of {p.total} tasks</span>
        <PublicSwitch it={it} />
      </div>
      <p class="fl-small fl-muted">{next ? <>Next: <a class="fl-link" href={`#/p/${next.id}`}>{next.title}</a> <span class="fl-mono">{fmtDay(next.dueDate)}</span></> : 'No open tasks with a date.'}</p>
    </article>
  );
}

function Pipeline({ roots }) {
  return (
    <div class="fl-board">
      {COLUMNS.map(([status, label]) => {
        const list = roots.filter((r) => (r.status || 'todo') === status);
        return (
          <section key={status} class="fl-board__col" aria-labelledby={`col-${status}`}>
            <div class="fl-board__head"><h2 id={`col-${status}`} class="fl-h3">{label}</h2><span class="fl-mono">{list.length}</span></div>
            {list.length ? list.map((r) => {
              const p = progress(tree().under(r.id));
              return (
                <article key={r.id} class="fl-card">
                  <a class="fl-h3" href={`#/p/${r.id}`}>{r.title}</a>
                  <div class="fl-bar" aria-hidden="true"><i style={{ width: `${pct(p)}%` }} /></div>
                  <div class="fl-card__meta"><span class="fl-mono fl-small">{pct(p)}% · {p.done} of {p.total}</span><PublicSwitch it={r} /></div>
                  {canManage(r) && (
                    <label class="fl-field"><span class="fl-sr">Move {r.title} to</span>
                      <select class="fl-input" value={status} onChange={(e) => updateItem(r, { status: e.target.value }, `moved to ${STAGE_WORD[e.target.value]}:`)}>
                        {COLUMNS.map(([s, l]) => <option key={s} value={s}>{s === status ? l : `Move to ${l}`}</option>)}</select></label>
                  )}
                </article>
              );
            }) : <p class="fl-small fl-muted">Nothing here.</p>}
          </section>
        );
      })}
    </div>
  );
}

export function Projects({ q }) {
  const roots = tree().kids.root || [], view = q.get('view') === 'pipeline' ? 'pipeline' : 'progress';
  const [adding, setAdding] = useState(false), back = useReturnFocus(adding);
  return (
    <>
      <Title light="All projects." bold={`${roots.length} running.`} title="Projects">
        {isExec() && <a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/digest"><Icon n="digest" />Digest</a>}
        {isExec() && <a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/templates">Start from template</a>}
        {isExec() && !adding && <span ref={back}><button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setAdding(true)}><Icon n="plus" />New project</button></span>}
      </Title>
      {adding && <ItemForm kind="project" done={() => setAdding(false)} />}
      <nav class="fl-seg" aria-label="Project views">
        <a href="#/projects" aria-current={view === 'progress' ? 'page' : undefined}>Progress</a>
        <a href="#/projects?view=pipeline" aria-current={view === 'pipeline' ? 'page' : undefined}>Pipeline</a>
      </nav>
      {!roots.length ? <Empty>No projects yet. An exec or the advisor can start one with New project.</Empty>
        : view === 'pipeline' ? <Pipeline roots={roots} />
        : <div class="fl-grid">{roots.map((it) => <ProgressCard key={it.id} it={it} />)}</div>}
    </>
  );
}

function Crumbs({ it }) {
  const { byId } = tree();
  return (
    <nav aria-label="Breadcrumb" class="fl-crumbs"><a href="#/projects">Projects</a>
      {it.ancestors.map((a) => byId[a] && <span key={a} class="fl-crumbs"><span aria-hidden="true">/</span><a href={`#/p/${a}`}>{byId[a].title}</a></span>)}
      <span aria-hidden="true">/</span><span aria-current="page">{it.title}</span></nav>
  );
}

export function Item({ id, q }) {
  const { byId, kids, under } = tree(), it = byId[id];
  const [f, setF] = useFilter('project');
  const [form, setForm] = useState(null), back = useReturnFocus(!!form);
  if (!it) return <><Title light="Not found." bold="This item is gone" /><p>It may be archived or from another term. <a class="fl-link" href="#/projects">Go to Projects</a></p></>;
  if (it.kind === 'task') return <Task it={it} />;
  const list = under(it.id), p = progress(list);
  const view = q.get('view') || 'cards', groups = (kids[it.id] || []).filter((k) => k.kind !== 'task');
  const deals = list.filter((t) => t.isDeal), teams = S.items.filter((x) => x.kind === 'team' && x.ancestors.includes(it.id));
  const tab = (k, label) => <a key={k} href={`#/p/${it.id}${k === 'cards' ? '' : `?view=${k}`}`} aria-current={view === k ? 'page' : undefined}>{label}</a>;
  return (
    <>
      <Crumbs it={it} />
      <Title light={`${it.title}.`} bold={`${pct(p)}% done.`} title={it.title}>
        {!it.parentId && <a class="fl-btn fl-btn--ghost fl-btn--sm" href={`#/meeting/${it.id}`}>Meeting view</a>}
        {!it.parentId && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => exportProject(it)}>Export as template</button>}
      </Title>
      <div class="fl-stats">
        <span><b>{p.total}</b> tasks</span>
        <span><b>{list.filter((t) => taskState(t).word === 'Overdue').length}</b> overdue</span>
        <span><b>{list.filter((t) => t.blocked && t.status !== 'done').length}</b> blocked</span>
        {it.leadUid && <span class="fl-muted">Lead: {memberName(it.leadUid)}</span>}
        {it.dueDate && <span class="fl-mono fl-muted">Due {fmtDay(it.dueDate)}</span>}
        {!it.parentId && <PublicSwitch it={it} />}
      </div>
      {it.notes && <p class="fl-pre fl-measure">{it.notes}</p>}
      <nav class="fl-seg" aria-label="Views">{tab('cards', 'Cards')}{tab('timeline', 'Timeline')}{tab('team', 'Team chart')}</nav>
      {canManage(it) && (form ? <ItemForm parent={it} kind={form} done={() => setForm(null)} /> : (
        <div class="fl-actions" ref={back}>
          <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm('task')}><Icon n="plus" />Add task</button>
          {it.ancestors.length < 2 && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm('team')}>Add subteam</button>}
          <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm('edit')}>Edit {it.kind === 'project' ? 'project' : 'subteam'}</button>
        </div>))}
      {view === 'timeline' && <Timeline root={it} />}
      {view === 'team' && <TeamChart root={it} />}
      {view === 'cards' && <>
        {groups.length > 0 && <div class="fl-grid">{groups.map((g) => <ItemCard key={g.id} it={g} />)}</div>}
        {deals.length > 0 && <DealTable deals={deals} />}
        <section class="fl-panel" aria-labelledby="tasks-h"><div class="fl-panel__head"><h2 id="tasks-h" class="fl-h2">Tasks</h2></div>
          <FilterBar list={list} f={f} set={setF} teams={teams} /></section>
      </>}
    </>
  );
}

function DealTable({ deals }) {
  const sum = (k) => deals.reduce((a, d) => a + (d[k] || 0), 0);
  return (
    <section class="fl-panel" aria-labelledby="deals-h"><div class="fl-panel__head"><h2 id="deals-h" class="fl-h2">Deals</h2></div>
      <div class="fl-scroll"><table class="fl-table"><thead><tr><th>Deal</th><th>Stage</th><th class="fl-num">Pledged</th><th class="fl-num">Received</th></tr></thead>
        <tbody>{deals.map((d) => (
          <tr key={d.id}><td class="fl-wrap"><a class="fl-link" href={`#/p/${d.id}`}>{d.title}</a></td><td>{d.dealStage}</td><td class="fl-num">{idr(d.pledgedIdr)}</td><td class="fl-num">{idr(d.receivedIdr)}</td></tr>))}
          <tr><td><b>Total</b></td><td /><td class="fl-num"><b>{idr(sum('pledgedIdr'))}</b></td><td class="fl-num"><b>{idr(sum('receivedIdr'))}</b></td></tr></tbody></table></div>
    </section>
  );
}

export const StageBar = ({ stage }) => {
  const n = STAGES.indexOf(stage) + 1;
  return (
    <div class="fl-stagebar" role="img" aria-label={`Stage ${n} of 4: ${stage}`}>
      <span>{STAGES.map((s, i) => <i key={s} class={i < n ? 'on' : ''} />)}</span>
      <span class="fl-mono fl-small">Stage {n} of 4 · {stage}</span>
    </div>
  );
};

function Task({ it }) {
  const [edit, setEdit] = useState(false), back = useReturnFocus(edit);
  const url = safeUrl(it.link), s = taskState(it);
  const share = `${it.title}${it.dueDate ? `\nDue ${fmtDay(it.dueDate)}` : ''}\n${link(`/p/${it.id}`)}`;
  return (
    <>
      <Crumbs it={it} />
      <Title bold={it.title} title={it.title}>
        <a class="fl-btn fl-btn--ghost fl-btn--sm" href={wa(share)} target="_blank" rel="noopener noreferrer"><Icon n="share" />Share to WhatsApp</a>
      </Title>
      <div class="fl-stats"><Badge s={s} />{it.isDeal && <span class="fl-tag">Deal</span>}<Chips list={it.assigneeUids} />
        <span class="fl-mono fl-muted">{it.dueDate ? `Due ${fmtDay(it.dueDate)}` : 'No due date'}</span></div>
      {it.blocked && <p class="fl-pre fl-measure"><span class="fl-badge fl-badge--bad">Blocked</span> {it.blockedOnUid ? `On ${memberName(it.blockedOnUid)}: ` : ''}{it.blockedReason || 'No reason given.'}</p>}
      {it.notes && <p class="fl-pre fl-measure">{it.notes}</p>}
      {url && <p><a class="fl-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a></p>}
      {it.isDeal && <section class="fl-panel fl-section" aria-label="Deal"><StageBar stage={it.dealStage} />
        <p class="fl-mono fl-small">Pledged {idr(it.pledgedIdr)} · received {idr(it.receivedIdr)}</p></section>}
      {canWork(it) && (edit ? <ItemForm item={it} done={() => setEdit(false)} /> : <div class="fl-actions" ref={back}><button class="fl-btn fl-btn--ghost" onClick={() => setEdit(true)}>Update task</button></div>)}
      <Comments it={it} />
    </>
  );
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const WORK = ['status', 'blocked', 'blockedReason', 'blockedOnUid', 'notes', 'link'], DEAL = ['dealStage', 'pledgedIdr', 'receivedIdr'];

// One form for create and edit. Assignees see only the fields the rules let them change. `prefill` seeds a new item.
export function ItemForm({ item, parent, kind, done, prefill = {} }) {
  const editing = kind === 'edit' ? parent : item, manage = editing ? canManage(editing) : true;
  const k = editing?.kind || kind;
  const [v, setV] = useState(editing ? { ...editing } : { title: '', dueDate: '', startDate: '', notes: '', link: '', assigneeUids: [], leadUid: '', isDeal: false, ...prefill });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), ref = useAutofocus();
  const bad = (field, msg) => { setErr({ field, msg }); ref.current.querySelector(`[name=${field}]`)?.focus(); };
  const on = (key, num) => (e) => setV({ ...v, [key]: e.target.type === 'checkbox' ? e.target.checked : num ? Number(e.target.value) || 0 : e.target.value });
  const field = (key, label, type = 'text', extra = {}) => (
    <div class={`fl-field${err.field === key ? ' fl-field--error' : ''}`}><label for={`f-${key}`}>{label}</label>
      <input id={`f-${key}`} class="fl-input" name={key} type={type} value={v[key] ?? ''} onInput={on(key, type === 'number')} {...extra}
        aria-invalid={err.field === key || undefined} aria-describedby={err.field === key ? 'item-err' : undefined} /></div>
  );
  const submit = async (e) => {
    e.preventDefault();
    if (manage && !v.title.trim()) return bad('title', 'Add a title, then save.');
    if (v.link && !safeUrl(v.link)) return bad('link', 'The link must start with http:// or https://.');
    if (v.startDate && v.dueDate && v.startDate > v.dueDate) return bad('dueDate', 'The due date is before the start date. Change one of them.');
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
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">{editing ? `Edit ${k}` : `New ${k}`}{parent && !editing ? <span class="fl-light"> in {parent.title}</span> : ''}</h2>
      {manage && field('title', 'Title', 'text', { maxLength: 80, required: true })}
      {manage && <div class="fl-fields">{field('startDate', 'Start date', 'date')}{field('dueDate', 'Due date', 'date')}</div>}
      {manage && k !== 'task' && (
        <div class="fl-field"><label for="f-lead">Lead</label>
          <select id="f-lead" class="fl-input" value={v.leadUid || ''} onChange={on('leadUid')}><option value="">No lead</option>
            {people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>)}
      {manage && k === 'task' && (
        <fieldset class="fl-fieldset"><legend>Assignees</legend>
          {people.map((m) => (<label key={m.id} class="fl-checkrow"><input type="checkbox" class="fl-check" checked={v.assigneeUids.includes(m.id)}
            onChange={(e) => setV({ ...v, assigneeUids: e.target.checked ? [...v.assigneeUids, m.id] : v.assigneeUids.filter((x) => x !== m.id) })} />{m.name}</label>))}
        </fieldset>)}
      {editing && k === 'task' && (<>
        <div class="fl-field"><label for="f-status">Status</label>
          <select id="f-status" class="fl-input" value={v.status} onChange={on('status')}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select></div>
        <label class="fl-checkrow"><input type="checkbox" class="fl-check" checked={v.blocked} onChange={on('blocked')} />Blocked</label>
        {v.blocked && <div class="fl-fields">{field('blockedReason', 'What is blocking it', 'text', { maxLength: 200 })}
          <div class="fl-field"><label for="f-on">Blocked on</label>
            <select id="f-on" class="fl-input" value={v.blockedOnUid || ''} onChange={on('blockedOnUid')}><option value="">Nobody in the council</option>
              {activeMembers().map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div></div>}
      </>)}
      <div class="fl-field"><label for="f-notes">Notes</label>
        <textarea id="f-notes" class="fl-input" rows={3} maxLength={1000} value={v.notes} onInput={on('notes')} /></div>
      {field('link', 'Link', 'url', { placeholder: 'https://' })}
      {manage && k === 'task' && <label class="fl-checkrow"><input type="checkbox" class="fl-check" checked={v.isDeal} onChange={on('isDeal')} />This is a deal with an outside party</label>}
      {editing && k === 'task' && v.isDeal && editing.isDeal && (<div class="fl-fields">
        <div class="fl-field"><label for="f-stage">Deal stage</label>
          <select id="f-stage" class="fl-input" value={v.dealStage} onChange={on('dealStage')}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
        {field('pledgedIdr', 'Pledged (IDR)', 'number', { min: 0 })}{field('receivedIdr', 'Received (IDR)', 'number', { min: 0 })}</div>)}
      <p id="item-err" class="fl-error" role="alert">{err.msg}</p>
      <div class="fl-actions">
        <button class="fl-btn fl-btn--red" disabled={busy}>{editing ? 'Save changes' : `Add ${k}`}</button>
        <button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button>
        {editing && manage && <button type="button" class="fl-btn fl-btn--ghost" onClick={() => archiveItem(editing).then((ok) => ok && (location.hash = editing.parentId ? `#/p/${editing.parentId}` : '#/projects'))}>Archive {k}</button>}
      </div>
    </form>
  );
}
