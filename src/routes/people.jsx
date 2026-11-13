// Committees: the general committee (executive board and six departments), special committees (each its own org
// chart of teams) and the org chart built from department data. A person's page shows their week and tasks.
import { useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { activeMembers, isAdmin, personStatus, roleName } from '../model.js';
import { board, committees, deptMembers, departments, deptOf, placeOf, positionName } from '../org.js';
import { newTeam, saveCommittee, saveDepartment } from '../org-actions.js';
import { fmtDay, isoDay } from '../time.js';
import { Sheet } from '../shared.jsx';
import { Badge, Chip, Empty, Panel, TaskList, Title } from '../ui.jsx';
import { DateField, Menu } from '../pickers.jsx';
import { TeamChart } from './views.jsx';
import { tree } from '../model.js';

const go = (patch) => {
  const p = new URLSearchParams(location.hash.split('?')[1] || '');
  for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
  location.hash = `#/committees${p.size ? `?${p}` : ''}`;
};
const first = (uid) => memberName(uid).split(' ')[0];
const PersonLink = ({ uid, label, lead }) => {
  const m = S.members.find((x) => x.id === uid);
  if (!m) return null;
  return (
    <li class="fl-member">
      <a class="fl-person" href={`#/people/${encodeURIComponent(uid)}`}><Chip email={uid} lead={lead} /><span>{m.name}{label && <small> · {label}</small>}</span></a>
    </li>
  );
};
// Search the roster, tick people, confirm. Shows each person's current department.
export function PeoplePicker({ title, pool, onPick, onClose, note, target = null, action = 'Add' }) {
  const [q, setQ] = useState(''), [pick, setPick] = useState([]), [busy, setBusy] = useState(false);
  const t = q.trim().toLowerCase(), shown = pool.filter((m) => !t || m.name.toLowerCase().includes(t) || m.id.includes(t)).sort((a, b) => a.name.localeCompare(b.name));
  const flip = (id) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);
  const go = async () => {
    const moving = target ? pick.map((u) => [u, deptOf(u)]).filter(([, d]) => d && d.id !== target.id) : [];
    if (moving.length && !confirm(moving.map(([u, d]) => `Move ${first(u)} from ${d.name} to ${target.name}?`).join('\n'))) return;
    setBusy(true); await onPick(pick); setBusy(false);
  };
  return (
    <Sheet label={title} onClose={onClose}>
      <h2 class="fl-h2">{title}</h2>
      {note && <p class="fl-help">{note}</p>}
      <label class="fl-field"><span class="fl-field__label">Search by name</span><input class="fl-input" value={q} onInput={(e) => setQ(e.target.value)} placeholder="Type a name" /></label>
      <ul class="fl-pick">
        {shown.map((m) => { const d = deptOf(m.id); return (
          <li key={m.id}><label class="fl-checkrow"><input type="checkbox" class="fl-check" checked={pick.includes(m.id)} onChange={() => flip(m.id)} />
            <span class="fl-grow">{m.name}<small class="fl-muted"> · {roleName(m.role)}{m.section ? `, ${m.section}` : ''}</small></span>
            <span class="fl-small fl-muted">{d ? d.name : 'No department'}</span></label></li>
        ); })}
        {!shown.length && <li class="fl-small fl-muted fl-pad">Nobody matches. Clear the search to see everyone.</li>}
      </ul>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={!pick.length || busy} onClick={go}>{busy ? 'Saving…' : `${action} ${pick.length || ''} ${pick.length === 1 ? 'person' : 'people'}`}</button>
        <button class="fl-btn fl-btn--ghost" onClick={onClose}>Cancel</button></div>
    </Sheet>
  );
}

function NameSheet({ title, value = '', label = 'Name', onSave, onClose }) {
  const [v, setV] = useState(value), [busy, setBusy] = useState(false);
  return (
    <Sheet label={title} onClose={onClose}>
      <form class="fl-form" onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) return; setBusy(true); if (await onSave(v.trim())) onClose(); setBusy(false); }}>
        <h2 class="fl-h2">{title}</h2>
        <label class="fl-field"><span class="fl-field__label">{label}</span><input class="fl-input" maxLength={60} value={v} onInput={(e) => setV(e.target.value)} /></label>
        <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={!v.trim() || busy}>Save</button><button type="button" class="fl-btn fl-btn--ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Sheet>
  );
}

function LeadsSheet({ d, onClose }) {
  const [jc, setJc] = useState(d.jcLeadUid || ''), [sec, setSec] = useState(d.secLeadUid || ''), [busy, setBusy] = useState(false);
  const pool = S.members.filter((m) => m.active && !['teacher', 'advisor'].includes(m.role)).sort((a, b) => a.name.localeCompare(b.name));
  const opt = (m) => { const o = deptOf(m.id); return <option key={m.id} value={m.id}>{m.name}{o && o.id !== d.id ? ` (now in ${o.name})` : ''}</option>; };
  const save = async () => {
    const moving = [jc, sec].filter(Boolean).map((u) => [u, deptOf(u)]).filter(([, o]) => o && o.id !== d.id);
    if (moving.length && !confirm(moving.map(([u, o]) => `Move ${first(u)} from ${o.name} to ${d.name}?`).join('\n'))) return;
    setBusy(true);
    if (await saveDepartment(d, { jcLeadUid: jc || null, secLeadUid: sec && sec !== jc ? sec : null }, `Leads of ${d.name} saved.`)) onClose();
    setBusy(false);
  };
  return (
    <Sheet label={`Change leads of ${d.name}`} onClose={onClose}>
      <h2 class="fl-h2">Leads of {d.name}</h2>
      <p class="fl-help">The JC officer heads the department. The Sec officer is second. Both report lines update when you save.</p>
      <label class="fl-field"><span class="fl-field__label">JC officer (head)</span><select class="fl-input" value={jc} onChange={(e) => setJc(e.target.value)}><option value="">Nobody yet</option>{pool.map(opt)}</select></label>
      <label class="fl-field"><span class="fl-field__label">Sec officer (second)</span><select class="fl-input" value={sec} onChange={(e) => setSec(e.target.value)}><option value="">Nobody yet</option>{pool.filter((m) => m.id !== jc).map(opt)}</select></label>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy} onClick={save}>Save leads</button><button class="fl-btn fl-btn--ghost" onClick={onClose}>Cancel</button></div>
    </Sheet>
  );
}

function DeptCard({ d, admin, act }) {
  return (
    <section class="fl-panel fl-deptcard" aria-labelledby={`d-${d.id}`}>
      <div class="fl-panel__head">
        <h2 id={`d-${d.id}`} class="fl-h3"><a href={`#/department/${d.id}`}>{d.name}</a></h2>
        {admin && <Menu label={`Actions for ${d.name}`} items={[['Rename', () => act('rename', d)], ['Change leads', () => act('leads', d)], ['Add members', () => act('add', d)]]} />}
      </div>
      <ul class="fl-list">
        {d.jcLeadUid ? <PersonLink uid={d.jcLeadUid} label="Head, JC officer" lead /> : <li class="fl-small fl-muted fl-slot">No JC officer yet</li>}
        {d.secLeadUid ? <PersonLink uid={d.secLeadUid} label="Second, Sec officer" lead /> : <li class="fl-small fl-muted fl-slot">No Sec officer yet</li>}
      </ul>
      {(d.memberUids || []).length > 0 ? <ul class="fl-list fl-deptcard__members">{d.memberUids.map((u) => <PersonLink key={u} uid={u} />)}</ul>
        : <p class="fl-small fl-muted">No general members yet.</p>}
    </section>
  );
}

function General({ admin }) {
  const [act, setAct] = useState(null), depts = departments(), teachers = activeMembers().filter((m) => m.role === 'teacher');
  const unplaced = activeMembers().filter((m) => !['teacher', 'advisor', 'president', 'vp', 'treasurer', 'secretary'].includes(m.role) && !deptOf(m.id));
  const doAct = (kind, d) => setAct({ kind, d });
  return (
    <>
      <section class="fl-panel" aria-labelledby="board-h">
        <div class="fl-panel__head"><h2 id="board-h" class="fl-h2">Executive board</h2></div>
        <ul class="fl-board-row">{board().map((m) => <PersonLink key={m.id} uid={m.id} label={roleName(m.role)} lead={m.role === 'advisor'} />)}</ul>
      </section>
      {depts.length ? <div class="fl-grid fl-grid--depts">{depts.map((d) => <DeptCard key={d.id} d={d} admin={admin} act={doAct} />)}</div>
        : <Empty>{admin ? 'No departments yet. Run the department migration once, then rename the six departments here.' : 'Departments appear here once the president sets them up.'}</Empty>}
      {(teachers.length > 0 || (admin && unplaced.length > 0)) && (
        <div class="fl-grid">
          {teachers.length > 0 && <Panel title="Teachers" id="teach-h"><ul class="fl-list">{teachers.map((m) => <PersonLink key={m.id} uid={m.id} />)}</ul></Panel>}
          {admin && unplaced.length > 0 && <Panel title="Not in a department" id="unp-h" link={<a class="fl-link fl-small" href="#/committees?view=org">Assign in Org chart</a>}>
            <p class="fl-small fl-muted">{unplaced.length} {unplaced.length === 1 ? 'person has' : 'people have'} no department yet: {unplaced.slice(0, 6).map((m) => m.name.split(' ')[0]).join(', ')}{unplaced.length > 6 ? ' and more' : ''}.</p></Panel>}
        </div>
      )}
      {act?.kind === 'rename' && <NameSheet title={`Rename ${act.d.name}`} value={act.d.name} label="Department name" onClose={() => setAct(null)} onSave={(name) => saveDepartment(act.d, { name }, 'Department renamed.')} />}
      {act?.kind === 'leads' && <LeadsSheet d={act.d} onClose={() => setAct(null)} />}
      {act?.kind === 'add' && (
        <PeoplePicker title={`Add members to ${act.d.name}`} target={act.d} onClose={() => setAct(null)}
          pool={activeMembers().filter((m) => m.role !== 'teacher' && m.role !== 'advisor' && !deptMembers(act.d).includes(m.id))}
          onPick={async (uids) => { if (await saveDepartment(act.d, { memberUids: [...(act.d.memberUids || []), ...uids] }, `Added ${uids.length} to ${act.d.name}.`)) setAct(null); }} />
      )}
    </>
  );
}

// ---------- Org charts: a root, then branches side by side; each branch lists its people top-down.
const Node = ({ uid, label, lead }) => uid && (
  <span class="fl-orgnode"><Chip email={uid} lead={lead} /><span><b>{memberName(uid)}</b>{label && <small>{label}</small>}</span></span>
);
const Head = ({ title, sub }) => <span class="fl-orgnode fl-orgnode--dept"><span><b>{title}</b>{sub && <small>{sub}</small>}</span></span>;
const Branch = ({ head, top = [], rest = [] }) => (
  <div class="fl-tree__branch">
    {head}
    {(top.length > 0 || rest.length > 0) && <ul class="fl-tree__people">{top.map((x, i) => <li key={`t${i}`}>{x}</li>)}
      {rest.length > 0 && <li><ul class={top.length ? 'fl-tree__sub' : 'fl-tree__people'}>{rest.map((x, i) => <li key={`r${i}`}>{x}</li>)}</ul></li>}</ul>}
  </div>
);

// ---------- Org chart, from department data

function OrgChart({ admin }) {
  const [assign, setAssign] = useState(null), depts = departments(), b = board(), adv = b.find((m) => m.role === 'advisor'), pres = b.find((m) => m.role === 'president');
  const rest = b.filter((m) => !['advisor', 'president'].includes(m.role));
  const unplaced = activeMembers().filter((m) => !['teacher', 'advisor', 'president', 'vp', 'treasurer', 'secretary'].includes(m.role) && !deptOf(m.id));
  const node = (uid, label, kids, lead) => uid && (
    <li key={uid}><span class="fl-orgnode"><Chip email={uid} lead={lead} /><span><b>{memberName(uid)}</b><small>{label}</small></span></span>{kids && <ul>{kids}</ul>}</li>
  );
  const dept = (d) => (
    <li key={d.id}><span class="fl-orgnode fl-orgnode--dept"><b>{d.name}</b><small>{deptMembers(d).length} people</small></span>
      <ul>{d.jcLeadUid ? node(d.jcLeadUid, 'JC officer', [d.secLeadUid ? node(d.secLeadUid, 'Sec officer', (d.memberUids || []).map((u) => node(u, 'General member'))) : (d.memberUids || []).map((u) => node(u, 'General member'))].flat(), true)
        : [d.secLeadUid && node(d.secLeadUid, 'Sec officer'), ...(d.memberUids || []).map((u) => node(u, 'General member'))]}</ul></li>
  );
  return (
    <>
      <section class="fl-panel fl-scroll" aria-label="Org chart">
        <div class="fl-tree">
          {adv && <div class="fl-tree__root"><Node uid={adv.id} label="Advisor" lead /></div>}
          {pres && <div class="fl-tree__root"><Node uid={pres.id} label="President" lead /></div>}
          {rest.length > 0 && <div class="fl-tree__root fl-tree__row">{rest.map((m) => <Node key={m.id} uid={m.id} label={roleName(m.role)} />)}</div>}
          <div class="fl-tree__kids">
            {depts.map((d) => {
              const members = (d.memberUids || []).map((u) => <Node key={u} uid={u} label="General member" />);
              const sec = d.secLeadUid && <Node uid={d.secLeadUid} label="Sec officer" lead />;
              return <Branch key={d.id} head={<Head title={d.name} sub={`${deptMembers(d).length} people`} />}
                top={[d.jcLeadUid ? <Node uid={d.jcLeadUid} label="JC officer, head" lead /> : <span class="fl-small fl-muted">No JC officer yet</span>]}
                rest={sec ? [<div class="fl-tree__nest">{sec}{members.length > 0 && <ul class="fl-tree__sub">{members.map((x, i) => <li key={i}>{x}</li>)}</ul>}</div>] : members} />;
            })}
          </div>
        </div>
      </section>
      {unplaced.length > 0 && (
        <Panel title="Unassigned" id="unassigned-h" link={<span class="fl-small fl-muted">{unplaced.length} not in a department</span>}>
          <ul class="fl-list">{unplaced.map((m) => (
            <li key={m.id} class="fl-member"><a class="fl-person" href={`#/people/${encodeURIComponent(m.id)}`}><Chip email={m.id} /><span>{m.name}<small> · {roleName(m.role)}{m.section ? `, ${m.section}` : ''}</small></span></a>
              {admin && depts.length > 0 && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setAssign(m)}>Assign</button>}</li>
          ))}</ul>
        </Panel>
      )}
      <ProjectTeams />
      {assign && (
        <Sheet label={`Assign ${assign.name}`} onClose={() => setAssign(null)}>
          <h2 class="fl-h2">Assign {assign.name}</h2>
          <p class="fl-help">They join as a general member and report to the department's JC officer.</p>
          <div class="fl-assign">{depts.map((d) => (
            <button key={d.id} class="fl-rq" onClick={async () => { if (await saveDepartment(d, { memberUids: [...(d.memberUids || []), assign.id] }, `${assign.name.split(' ')[0]} joined ${d.name}.`)) setAssign(null); }}>
              <span class="fl-rq__t">{d.name}</span><span class="fl-small fl-muted">{deptMembers(d).length} people{d.jcLeadUid ? ` · head ${first(d.jcLeadUid)}` : ''}</span></button>))}</div>
        </Sheet>
      )}
    </>
  );
}

// The team chart of one project (subteams and leads), kept from the earlier Committees page.
function ProjectTeams() {
  const roots = tree().kids.root || [], [team, setTeam] = useState(roots[0]?.id || '');
  if (!roots.length) return null;
  return (
    <Panel title="Project team chart" id="team-h" link={roots.length > 1 && (
      <label class="fl-field"><span class="fl-sr">Project</span>
        <select class="fl-input" value={team} onChange={(e) => setTeam(e.target.value)}>{roots.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>)}>
      {tree().byId[team] ? <TeamChart root={tree().byId[team]} /> : <Empty>Choose a project to see its teams.</Empty>}
    </Panel>
  );
}

// ---------- Special committees

const STATUS = { planning: ['warn', 'Planning'], active: ['ok', 'Active'], closed: ['ok', 'Closed'] };
const range = (c) => (c.startDate === c.endDate ? fmtDay(c.startDate) : `${fmtDay(c.startDate)} to ${fmtDay(c.endDate)}`);

function CommitteeForm({ c, onClose }) {
  const today = isoDay(), [v, setV] = useState({ name: c?.name || '', startDate: c?.startDate || today, endDate: c?.endDate || today, teams: '' }), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (!v.name.trim()) return setErr('Add a name, then save.');
    if (v.endDate < v.startDate) return setErr('The end date must be on or after the start date.');
    setBusy(true);
    const names = v.teams.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean), teams = [...(c?.teams || [])];
    for (const n of names) teams.push(newTeam(n, teams.map((t) => t.id)));
    const id = await saveCommittee(c || {}, { name: v.name, startDate: v.startDate, endDate: v.endDate, teams, status: c?.status || 'planning' }, c ? 'Committee saved.' : `${v.name.trim()} created.`);
    setBusy(false);
    if (id) { onClose(); if (!c) go({ view: 'special', c: id }); }
  };
  return (
    <Sheet label={c ? `Edit ${c.name}` : 'New special committee'} onClose={onClose}>
      <form class="fl-form" onSubmit={save} noValidate>
        <h2 class="fl-h2">{c ? `Edit ${c.name}` : 'New special committee'}</h2>
        <label class="fl-field"><span class="fl-field__label">Name</span><input class="fl-input" maxLength={80} placeholder="Carnival committee" value={v.name} onInput={(e) => setV({ ...v, name: e.target.value })} /></label>
        <div class="fl-fields">
          <div class="fl-field"><span class="fl-field__label">Starts</span><DateField id="cm-start" value={v.startDate} onChange={(d) => setV({ ...v, startDate: d, endDate: v.endDate < d ? d : v.endDate })} /></div>
          <div class="fl-field"><span class="fl-field__label">Ends</span><DateField id="cm-end" value={v.endDate} min={v.startDate} onChange={(d) => setV({ ...v, endDate: d })} /></div>
        </div>
        <label class="fl-field"><span class="fl-field__label">{c ? 'Add teams (optional)' : 'Teams (optional)'}</span>
          <textarea class="fl-input" rows={4} placeholder={'Finance team\nTenant stall team\nReach and registration'} value={v.teams} onInput={(e) => setV({ ...v, teams: e.target.value })} />
          <span class="fl-help">One team per line, or separate them with commas. You can add, rename and reorder teams later.</span></label>
        <p class="fl-error" role="alert">{err}</p>
        <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>{busy ? 'Saving…' : c ? 'Save committee' : 'Create committee'}</button><button type="button" class="fl-btn fl-btn--ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Sheet>
  );
}

function CommitteeList({ admin }) {
  const [form, setForm] = useState(false), list = committees();
  return (
    <>
      {admin && <div class="fl-actions"><button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm(true)}>New special committee</button></div>}
      {list.length ? (
        <ul class="fl-cmlist">{list.map((c) => (
          <li key={c.id}><button class="fl-cmrow" onClick={() => go({ view: 'special', c: c.id })}>
            <span class="fl-h3">{c.name}</span>
            <span class="fl-small fl-muted fl-mono">{range(c)}</span>
            <span class="fl-small fl-muted">{c.teams?.length || 0} {c.teams?.length === 1 ? 'team' : 'teams'}</span>
            <span class={`fl-badge fl-badge--${STATUS[c.status]?.[0] || 'ok'}`}>{STATUS[c.status]?.[1] || c.status}</span>
          </button></li>))}</ul>
      ) : <Empty>{admin ? 'No special committees yet. Create one for an occasion such as a carnival, with its own teams.' : 'No special committees yet. The president creates them for occasions such as a carnival.'}</Empty>}
      {form && <CommitteeForm onClose={() => setForm(false)} />}
    </>
  );
}

function Committee({ c, admin }) {
  const [act, setAct] = useState(null), closed = c.status === 'closed', edit = admin && !closed;
  const teams = c.teams || [];
  const save = (teamsNext, msg) => saveCommittee(c, { teams: teamsNext }, msg);
  const patchTeam = (id, fn, msg) => save(teams.map((t) => (t.id === id ? fn(t) : t)), msg);
  const move = (i, dir) => { const n = [...teams]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; save(n, 'Team moved.'); };
  return (
    <>
      <div class="fl-cmhead">
        <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => go({ c: null, view: null })}>Back to general committee</button>
        <div class="fl-grow">
          <p class="fl-small fl-muted"><span class="fl-mono">{range(c)}</span> · {teams.length} {teams.length === 1 ? 'team' : 'teams'} · <span class={`fl-badge fl-badge--${STATUS[c.status]?.[0]}`}>{STATUS[c.status]?.[1]}</span></p>
        </div>
        {admin && <div class="fl-actions">
          {edit && <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setAct({ kind: 'team' })}>Add team</button>}
          <Menu label={`Actions for ${c.name}`} items={[
            edit && ['Edit details', () => setAct({ kind: 'details' })],
            edit && ['Choose chair', () => setAct({ kind: 'chair' })],
            edit && c.status === 'planning' && ['Mark active', () => saveCommittee(c, { status: 'active' }, `${c.name} is active.`)],
            edit && ['Close committee', () => confirm(`Close ${c.name}? It becomes read-only and archived. Nothing is deleted.`) && saveCommittee(c, { status: 'closed' }, `${c.name} closed.`)],
            closed && ['Reopen committee', () => saveCommittee(c, { status: 'active' }, `${c.name} reopened.`)],
          ]} />
        </div>}
      </div>
      {closed && <p class="fl-calnote fl-calnote--plain">This committee is closed. It is archived and read-only.</p>}
      <section class="fl-panel fl-scroll" aria-label={`${c.name} org chart`}>
        <div class="fl-tree">
          <div class="fl-tree__root">{c.chairUids?.length ? c.chairUids.map((u) => <Node key={u} uid={u} label="Chair" lead />) : <Head title={c.name} sub="No overall chair" />}</div>
          <div class="fl-tree__kids">
            {teams.map((t) => (
              <Branch key={t.id} head={<Head title={t.name} sub={(t.leadUids || []).length ? null : 'No leader'} />}
                top={(t.leadUids || []).map((u) => <Node uid={u} label="Leader" lead />)}
                rest={(t.memberUids || []).map((u) => <Node uid={u} />)} />
            ))}
          </div>
        </div>
      </section>
      {teams.length ? <div class="fl-grid fl-grid--depts">{teams.map((t, i) => (
        <section key={t.id} class="fl-panel fl-deptcard" aria-labelledby={`t-${t.id}`}>
          <div class="fl-panel__head">
            <h3 id={`t-${t.id}`} class="fl-h3">{t.name}</h3>
            <span class="fl-small fl-muted">{(t.memberUids || []).length + (t.leadUids || []).length} people</span>
            {edit && <Menu label={`Actions for ${t.name}`} items={[
              ['Add members', () => setAct({ kind: 'members', t })], ['Add leader', () => setAct({ kind: 'leader', t })], ['Rename team', () => setAct({ kind: 'rename', t })],
              i > 0 && ['Move up', () => move(i, -1)], i < teams.length - 1 && ['Move down', () => move(i, 1)],
              ['Remove team', () => confirm(`Remove ${t.name} from ${c.name}? Its people stay in the council.`) && save(teams.filter((x) => x.id !== t.id), 'Team removed.')],
            ]} />}
          </div>
          {(t.leadUids || []).length > 0 && <ul class="fl-list">{t.leadUids.map((u) => (
            <li key={u} class="fl-member"><span class="fl-person"><Chip email={u} lead /><span>{memberName(u)}<small> · Leader</small></span></span>
              {edit && <button class="fl-btn fl-btn--ghost fl-btn--sm" aria-label={`Remove ${memberName(u)} as leader`} onClick={() => patchTeam(t.id, (x) => ({ ...x, leadUids: x.leadUids.filter((y) => y !== u), memberUids: [...(x.memberUids || []), u] }), 'Leader removed.')}>Not leader</button>}</li>))}</ul>}
          <ul class="fl-list fl-deptcard__members">{(t.memberUids || []).map((u) => (
            <li key={u} class="fl-member"><span class="fl-person"><Chip email={u} /><span>{memberName(u)}</span></span>
              {edit && <button class="fl-btn fl-btn--ghost fl-btn--sm" aria-label={`Remove ${memberName(u)} from ${t.name}`} onClick={() => patchTeam(t.id, (x) => ({ ...x, memberUids: x.memberUids.filter((y) => y !== u) }), 'Removed from the team.')}>Remove</button>}</li>))}</ul>
          {!(t.memberUids || []).length && !(t.leadUids || []).length && <p class="fl-small fl-muted">Nobody in this team yet.{edit ? ' Use the menu to add members.' : ''}</p>}
        </section>))}</div> : <Empty>{edit ? 'No teams yet. Add the first team, such as a finance team.' : 'No teams yet.'}</Empty>}
      {act?.kind === 'team' && <NameSheet title={`Add a team to ${c.name}`} label="Team name" onClose={() => setAct(null)} onSave={(name) => save([...teams, newTeam(name, teams.map((t) => t.id))], `${name} added.`)} />}
      {act?.kind === 'rename' && <NameSheet title={`Rename ${act.t.name}`} value={act.t.name} label="Team name" onClose={() => setAct(null)} onSave={(name) => patchTeam(act.t.id, (x) => ({ ...x, name }), 'Team renamed.')} />}
      {act?.kind === 'details' && <CommitteeForm c={c} onClose={() => setAct(null)} />}
      {(act?.kind === 'members' || act?.kind === 'leader') && (
        <PeoplePicker title={act.kind === 'leader' ? `Add a leader to ${act.t.name}` : `Add members to ${act.t.name}`} action={act.kind === 'leader' ? 'Make leader:' : 'Add'}
          note="Anyone in the council can join, whatever their department. One person can be in several teams."
          pool={activeMembers().filter((m) => !(act.kind === 'leader' ? act.t.leadUids || [] : [...(act.t.memberUids || []), ...(act.t.leadUids || [])]).includes(m.id))}
          onClose={() => setAct(null)}
          onPick={async (uids) => { if (await patchTeam(act.t.id, (x) => act.kind === 'leader'
            ? { ...x, leadUids: [...(x.leadUids || []), ...uids], memberUids: (x.memberUids || []).filter((u) => !uids.includes(u)) }
            : { ...x, memberUids: [...(x.memberUids || []), ...uids] }, act.kind === 'leader' ? 'Leader added.' : `Added ${uids.length} to ${act.t.name}.`)) setAct(null); }} />
      )}
      {act?.kind === 'chair' && (
        <PeoplePicker title={`Choose the chair of ${c.name}`} action="Make chair:" note="Optional. A committee can have no chair, or more than one."
          pool={activeMembers().filter((m) => !(c.chairUids || []).includes(m.id))} onClose={() => setAct(null)}
          onPick={async (uids) => { if (await saveCommittee(c, { chairUids: [...(c.chairUids || []), ...uids].slice(0, 10) }, 'Chair saved.')) setAct(null); }} />
      )}
    </>
  );
}

export function People({ id, q }) {
  if (id) return <Person email={id} />;
  const admin = isAdmin(), view = ['general', 'special', 'org'].includes(q?.get('view')) ? q.get('view') : 'general';
  const open = q?.get('c') && S.committees.find((c) => c.id === q.get('c'));
  return (
    <>
      <Title light="Committees." bold={open ? open.name : `${activeMembers().length} people.`} title="Committees" />
      {!open && (
        <div class="fl-seg" role="group" aria-label="Committee view">
          {[['general', 'General committee'], ['special', 'Special committees'], ['org', 'Org chart']].map(([k, l]) => (
            <button key={k} aria-pressed={view === k} onClick={() => go({ view: k === 'general' ? null : k, c: null })}>{l}</button>))}
        </div>
      )}
      {S.fail.departments && <p class="fl-error" role="alert">Departments did not load. Check your connection and reload.</p>}
      {open ? <Committee c={open} admin={admin} /> : view === 'special' ? <CommitteeList admin={admin} /> : view === 'org' ? <OrgChart admin={admin} /> : <General admin={admin} />}
    </>
  );
}

function Person({ email }) {
  const m = S.members.find((x) => x.id === email);
  if (!m) return <><Title light="Not found." bold="No such member" /><a class="fl-link" href="#/committees">Go to Committees</a></>;
  const s = personStatus(email), mine = S.items.filter((t) => t.kind === 'task' && t.assigneeUids.includes(email)), place = placeOf(email);
  const open = mine.filter((t) => t.status !== 'done'), done = mine.filter((t) => t.status === 'done');
  const teams = committees().filter((c) => c.status !== 'closed').flatMap((c) => (c.teams || []).filter((t) => [...(t.leadUids || []), ...(t.memberUids || [])].includes(email)).map((t) => `${t.name} (${c.name})`));
  return (
    <>
      <nav class="fl-crumbs" aria-label="Breadcrumb"><a href="#/committees">Committees</a><span aria-hidden="true">/</span><span aria-current="page">{m.name}</span></nav>
      <Title light={`${roleName(m.role)}.`} bold={m.name} title={m.name} />
      <div class="fl-stats"><Chip email={email} big />
        {place.dept && <a class="fl-link" href={`#/department/${place.dept.id}`}>{positionName(place.position)}, {place.dept.name}</a>}
        {m.section && <span>{m.section}</span>}{m.reportsTo && <span class="fl-muted">Reports to {memberName(m.reportsTo)}</span>}<Badge s={s} /></div>
      {teams.length > 0 && <p class="fl-small fl-muted">Special committees: {teams.join(', ')}.</p>}
      <Panel title="This week" id="week-h"><p>{s.line}</p></Panel>
      <Panel title="Open tasks" id="open-h"><TaskList list={open} path empty="No open tasks." /></Panel>
      <Panel title="Done" id="done-h"><TaskList list={done} path empty="Nothing done yet this term." /></Panel>
    </>
  );
}
