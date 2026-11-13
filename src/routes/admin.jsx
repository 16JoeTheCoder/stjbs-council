// Members and roles: one management screen. Search, filters, sortable columns, a sticky header, bulk edits with a
// preview of every change and the rows you may not change, chunked writes and a 10-second undo.
import { useMemo, useState } from 'preact/hooks';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName, plain } from '../store.js';
import { initials, isAdmin, roleName } from '../model.js';
import { bulkAddMembers, putDoc } from '../actions.js';
import { CSV_TEMPLATE, confirmed, confirmPhrase, importable, isCsv, parseBulk, parseCsv } from '../bulk-roster.js';
import { Sheet } from '../shared.jsx';
import { isoDay, monday, weekId } from '../time.js';
import { Title, useAutofocus } from '../ui.jsx';
import { download } from './views.jsx';
import { Menu } from '../pickers.jsx';
import { POSITIONS, ROLE_INFO, YEAR_LEVELS, committees, departments, deptMembers, deptOf, placeOf, positionIn, positionName, presidentUid, reportsToIn } from '../org.js';
import { applyPlan, saveDepartment } from '../org-actions.js';

const ROLES = ['member', 'officer', 'secretary', 'treasurer', 'vp', 'president', 'teacher', 'advisor'];
const PRESIDENT_ROLES = ['member', 'officer', 'treasurer', 'secretary', 'teacher'];
const SCHOOL = /^[^@\s]+@stjbs\.sch\.id$/;

// What the signed-in admin may do to a member; mirrors the members rules in firestore.rules.
export function rosterPowers(m) {
  const r = S.me.role, self = m?.id === S.me.id, target = m?.role;
  if (r === 'advisor') return { roles: ROLES, role: !self, active: !self, edit: true, place: !self };
  if (r === 'vp') return { roles: ROLES.filter((x) => x !== 'advisor'), role: !self && target !== 'advisor', active: !self && target !== 'advisor', edit: target !== 'advisor', place: !self && target !== 'advisor' };
  if (r === 'president') return { roles: PRESIDENT_ROLES, role: !m, active: false, edit: target !== 'advisor', place: !self && target !== 'advisor' };
  return { roles: [], role: false, active: false, edit: false, place: false };
}
const whyNot = (m, what) => {
  if (m.id === S.me.id) return `Nobody changes their own ${what}.`;
  if (m.role === 'advisor' && S.me.role !== 'advisor') return 'Only the advisor changes the advisor.';
  if (S.me.role === 'president' && (what === 'role' || what === 'access')) return `A president cannot change ${what === 'role' ? 'roles' : 'access'}. Ask the vice president.`;
  return 'Your role cannot make this change.';
};
const RoleSelect = ({ id, value, onChange, roles, disabled }) => (
  <>
    <select id={id} class="fl-input" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-describedby={`${id}-help`}>
      {roles.map((r) => <option key={r} value={r}>{ROLE_INFO[r]?.[0] || r}</option>)}
    </select>
    <span id={`${id}-help`} class="fl-help">{ROLE_INFO[value]?.[1]}</span>
  </>
);
const SectionSelect = ({ id, value, onChange, disabled }) => (
  <select id={id} class="fl-input" value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
    <option value="">No year level</option>{YEAR_LEVELS.map((y) => <option key={y}>{y}</option>)}
    {value && !YEAR_LEVELS.includes(value) && <option value={value}>{value} (old value)</option>}
  </select>
);

// ---------- Department maths shared by quick add, edit and bulk edits

const deptData = (d) => ({ termId: S.term.termId, name: d.name, order: d.order ?? 0, jcLeadUid: d.jcLeadUid || null, secLeadUid: d.secLeadUid || null, memberUids: d.memberUids || [], active: d.active !== false, createdAt: d.createdAt || Date.now() });
// Moves uids into a department (or out of all departments when deptId is ''), at a position. Returns plan parts.
function placePlan(moves) {
  const state = new Map(S.departments.map((d) => [d.id, { ...d, memberUids: [...(d.memberUids || [])] }]));
  for (const { uid, deptId, position } of moves) {
    for (const d of state.values()) {
      d.memberUids = d.memberUids.filter((u) => u !== uid);
      if (d.jcLeadUid === uid) d.jcLeadUid = null;
      if (d.secLeadUid === uid) d.secLeadUid = null;
    }
    const t = deptId && state.get(deptId);
    if (!t) continue;
    if (position === 'jc_officer') { if (t.jcLeadUid) t.memberUids.push(t.jcLeadUid); t.jcLeadUid = uid; }
    else if (position === 'sec_officer') { if (t.secLeadUid) t.memberUids.push(t.secLeadUid); t.secLeadUid = uid; }
    else t.memberUids.push(uid);
  }
  const departmentsOut = [], touched = new Set(), pres = presidentUid();
  for (const d of state.values()) {
    const old = S.departments.find((x) => x.id === d.id);
    d.memberUids = [...new Set(d.memberUids)].filter((u) => u !== d.jcLeadUid && u !== d.secLeadUid);
    if (JSON.stringify(deptData(old)) !== JSON.stringify(deptData(d))) {
      departmentsOut.push({ id: d.id, data: deptData(d), before: deptData(old) });
      [...deptMembers(old), ...deptMembers(d)].forEach((u) => touched.add(u));
    }
  }
  for (const m of moves) touched.add(m.uid);
  const membersOut = [];
  for (const uid of touched) {
    const m = S.members.find((x) => x.id === uid);
    if (!m || uid === S.me.id) continue;
    const d = [...state.values()].find((x) => deptMembers(x).includes(uid));
    const patch = d ? { departmentId: d.id, position: positionIn(d, uid), reportsTo: reportsToIn(d, uid, pres) } : { departmentId: null, position: null, reportsTo: m.reportsTo && placeOf(uid).dept ? null : m.reportsTo ?? null };
    const before = { departmentId: m.departmentId ?? null, position: m.position ?? null, reportsTo: m.reportsTo ?? null };
    if (JSON.stringify(patch) !== JSON.stringify(before)) membersOut.push({ uid, patch, before });
  }
  return { departments: departmentsOut, members: membersOut, committees: [] };
}

// ---------- Add and edit one member

function MemberForm({ m, done }) {
  const can = rosterPowers(m), place = m ? placeOf(m.id) : { dept: null, position: null };
  const [v, setV] = useState(m ? { ...m, section: m.section || '', deptId: place.dept?.id || '', position: place.position || 'member' } : { id: '', name: '', role: 'member', section: '', deptId: '', position: 'member' });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), ref = useAutofocus();
  const bad = (field, msg) => { setErr({ field, msg }); ref.current.querySelector(`[name=${field}]`)?.focus(); };
  const submit = async (e) => {
    e.preventDefault();
    const email = v.id.trim().toLowerCase();
    if (!SCHOOL.test(email)) return bad('id', 'Use a school email ending in @stjbs.sch.id.');
    if (!m && S.members.some((x) => x.id === email)) return bad('id', 'This email is already on the roster. Find them in the table and edit them instead.');
    if (!v.name.trim()) return bad('name', 'Add a name, then save.');
    const data = { name: v.name.trim(), initials: initials(v.name), section: v.section, ...(can.role ? { role: v.role } : {}) };
    if (!m) Object.assign(data, { active: true, createdAt: Date.now(), reportsTo: null });
    setBusy(true);
    let ok = await putDoc(`members/${email}`, data, `${data.name} saved.`);
    if (ok && can.place && (v.deptId !== (place.dept?.id || '') || (v.deptId && v.position !== place.position))) {
      const moved = v.deptId && deptOf(email) && deptOf(email).id !== v.deptId ? deptOf(email) : null;
      if (moved && !confirm(`Move ${data.name.split(' ')[0]} from ${moved.name} to ${S.departments.find((d) => d.id === v.deptId).name}?`)) { setBusy(false); return done(); }
      ok = await applyPlan(placePlan([{ uid: email, deptId: v.deptId, position: v.position }]), 'Department updated');
    }
    if (ok) done(); else setBusy(false);
  };
  const lab = (k, label, input) => (
    <div class={`fl-field${err.field === k ? ' fl-field--error' : ''}`}><label for={`mf-${k}`} class="fl-field__label">{label}</label>{input}</div>
  );
  return (
    <form class="fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">{m ? `Edit ${m.name}` : 'Add a member'}</h2>
      <div class="fl-fields">
        {lab('name', 'Name', <input id="mf-name" class="fl-input" name="name" maxLength={60} value={v.name} onInput={(e) => setV({ ...v, name: e.target.value })} />)}
        {lab('id', 'School email', <input id="mf-id" class="fl-input" name="id" type="email" disabled={!!m} value={v.id} placeholder="name@stjbs.sch.id" onInput={(e) => setV({ ...v, id: e.target.value })} />)}
      </div>
      <div class="fl-fields">
        {lab('role', 'Role', <RoleSelect id="mf-role" value={v.role} roles={can.role ? can.roles : [v.role]} disabled={!can.role} onChange={(r) => setV({ ...v, role: r })} />)}
        {lab('section', 'Year level', <SectionSelect id="mf-section" value={v.section} onChange={(x) => setV({ ...v, section: x })} />)}
      </div>
      <div class="fl-fields">
        {lab('dept', 'Department', (
          <select id="mf-dept" class="fl-input" value={v.deptId} disabled={!can.place || v.role === 'teacher'} onChange={(e) => setV({ ...v, deptId: e.target.value })}>
            <option value="">No department</option>{departments().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>))}
        {lab('pos', 'Position', (
          <select id="mf-pos" class="fl-input" value={v.position} disabled={!can.place || !v.deptId} onChange={(e) => setV({ ...v, position: e.target.value })}>
            {POSITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>))}
      </div>
      {m && m.id === S.me.id && <p class="fl-help">You cannot change your own role, position or access.</p>}
      <p class="fl-error" role="alert">{err.msg}</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>{busy ? 'Saving…' : m ? 'Save member' : 'Add member'}</button><button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </form>
  );
}

const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

function CloseTerm() {
  const [saved, setSaved] = useState(false), [name, setName] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const backup = async () => {
    setBusy(true); setMsg('Collecting data, step 1 of 2.');
    try {
      const out = {};
      for (const c of ['members', 'items', 'comments', 'checkins', 'activity', 'templates', 'announcements', 'events', 'rsvps', 'ideas', 'docTemplates', 'submissions', 'cache', 'tasks', 'budgets', 'purchases'])
        out[c] = (await getDocs(collection(db, c))).docs.map((d) => ({ id: d.id, ...d.data() }));
      const feed = await getDoc(doc(db, 'public', 'feed'));
      out.public = feed.exists() ? [{ id: 'feed', ...feed.data() }] : [];
      out.settings = [{ id: 'current', ...S.term }];
      setMsg('Saving files, step 2 of 2.');
      const day = isoDay();
      download(`council-backup-${day}.json`, JSON.stringify(out, null, 1));
      const cols = ['id', 'termId', 'kind', 'title', 'parentId', 'status', 'blocked', 'assigneeUids', 'leadUid', 'startDate', 'dueDate', 'completedAt', 'isDeal', 'dealStage', 'pledgedIdr', 'receivedIdr', 'archived'];
      download(`council-items-${day}.csv`, csv([cols, ...out.items.map((i) => cols.map((k) => (Array.isArray(i[k]) ? i[k].join(' ') : i[k])))]), 'text/csv');
      setSaved(true); setMsg(`Backup saved: ${Object.entries(out).map(([k, v]) => `${v.length} ${k}`).join(', ')}.`);
    } catch (e) { setMsg(`Backup failed. ${plain(e)} Nothing changed.`); }
    setBusy(false);
  };
  const close = async () => {
    setBusy(true);
    const day = isoDay();
    // Remember each term's start so setting an old name back (the undo) restores its history.
    const starts = { ...S.term.starts, [S.term.termId]: S.term.startDate || null }, id = name.trim(), startDate = starts[id] || day;
    if (await putDoc('settings/current', { termId: id, termName: id, startDate, startWeekId: weekId(monday(startDate)), starts }, `Term ${id} started.`)) setName('');
    setBusy(false);
  };
  return (
    <section class="fl-panel fl-form" aria-labelledby="close-h">
      <h2 id="close-h" class="fl-h2">Close term</h2>
      <p>Current term: <b class="fl-mono">{S.term.termId}</b>. Closing changes only the current term. Nothing is deleted; set the old name back to undo.</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--ghost" disabled={busy} onClick={backup}>Download backup</button></div>
      <p class="fl-caption" role="status">{msg}</p>
      <label class="fl-field"><span class="fl-field__label">New term name</span>
        <input class="fl-input fl-mono" value={name} placeholder="2027-28" disabled={!saved} onInput={(e) => setName(e.target.value)} aria-describedby="close-help" />
        <span id="close-help" class="fl-help">{saved ? 'Type the new term name to confirm.' : 'Locked until the backup has downloaded.'}</span></label>
      <div class="fl-actions"><button class="fl-btn fl-btn--ghost" disabled={!saved || busy || !/^[\w-]{4,20}$/.test(name.trim()) || name.trim() === S.term.termId} onClick={close}>Close term and start {name.trim() || 'the new one'}</button></div>
    </section>
  );
}

// Typed confirmation: the button stays locked until the whole sentence (with the count) is typed.
function TypeToConfirm({ phrase, value, set }) {
  return (
    <label class="fl-field"><span class="fl-field__label">To continue, type: <b class="fl-mono">{phrase}</b></span>
      <input class="fl-input" value={value} onInput={(e) => set(e.target.value)} autocomplete="off" spellcheck={false} aria-describedby="bulk-help" />
      <span id="bulk-help" class="fl-help">This is hard to undo, so the button unlocks only when the sentence matches.</span></label>
  );
}

const PLACEHOLDER = 'adelyn.liu@stjbs.sch.id\nAdelyn Liu\nPresident\nSec 4\n\njosef.yang@stjbs.sch.id\nJosef Yang\nVice President\nJC 2';

// Paste blocks (email, name, role, section) or a CSV with department and position columns. Existing emails are skipped.
function BulkAdd({ done }) {
  const [text, setText] = useState(''), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false);
  const csvMode = isCsv(text);
  const rows = useMemo(() => (csvMode ? parseCsv(text, rosterPowers(null).roles, S.members.map((m) => m.id), departments()) : parseBulk(text, rosterPowers(null).roles, S.members.map((m) => m.id))), [text]);
  const ok = importable(rows), bad = rows.filter((r) => r.errors.length).length, skipped = rows.filter((r) => !r.errors.length && r.skip).length;
  const phrase = confirmPhrase('add', ok.length);
  const go = async () => {
    setBusy(true);
    if (await bulkAddMembers(ok)) {
      const moves = ok.filter((r) => r.departmentId).map((r) => ({ uid: r.email, deptId: r.departmentId, position: r.position || 'member' }));
      if (moves.length) { S.members = [...S.members, ...ok.map((r) => ({ id: r.email, name: r.name, role: r.role, active: true }))]; await applyPlan(placePlan(moves), 'Departments set'); }
      done();
    } else setBusy(false);
  };
  return (
    <Sheet label="Bulk add members" onClose={done}>
      <h2 class="fl-h2">Bulk add members</h2>
      <p>Paste a CSV that starts with the header row, or blocks of four lines: email, name, role, section, with a blank line between people. Roles you may add: {rosterPowers(null).roles.map(roleName).join(', ')}.</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => download('council-members-template.csv', CSV_TEMPLATE, 'text/csv')}>Download CSV template</button></div>
      <label class="fl-field"><span class="fl-field__label">Pasted list</span>
        <textarea class="fl-input fl-mono" rows={8} value={text} placeholder={PLACEHOLDER} onInput={(e) => setText(e.target.value)} /></label>
      {rows.length > 0 && <div class="fl-panel fl-scroll"><table class="fl-table">
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Year level</th>{csvMode && <><th>Department</th><th>Position</th></>}<th>Result</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td class="fl-small">{r.email}</td><td>{r.name}</td><td>{r.role ? roleName(r.role) : ''}</td><td>{r.section}</td>{csvMode && <><td>{r.department}</td><td>{r.position ? positionName(r.position) : ''}</td></>}
            <td>{r.errors.length ? <span class="fl-badge fl-badge--warn">{r.errors.join(' ')}</span>
              : r.skip ? <span class="fl-badge fl-badge--warn">{r.skip}</span> : <span class="fl-badge fl-badge--ok">Will add</span>}</td></tr>))}</tbody>
      </table></div>}
      <p class="fl-caption" role="status">{rows.length ? `${ok.length} to add, ${skipped} skipped, ${bad} with problems.${bad ? ' Fix the problems or delete those rows to continue.' : ''}` : 'Nothing pasted yet.'}</p>
      {ok.length > 0 && bad === 0 && <TypeToConfirm phrase={phrase} value={typed} set={setTyped} />}
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy || !ok.length || bad > 0 || !confirmed(typed, phrase)} onClick={go}>Add {ok.length} member{ok.length === 1 ? '' : 's'}</button>
        <button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </Sheet>
  );
}

// ---------- Bulk edits: plan, preview, apply

const ACTIONS = [['role', 'Set role'], ['dept', 'Set department'], ['position', 'Set position'], ['section', 'Set year level'], ['team-add', 'Add to a committee team'], ['team-remove', 'Remove from a committee team'], ['deactivate', 'Deactivate'], ['reactivate', 'Reactivate']];
function buildPlan(action, value, list) {
  const changes = [], skipped = [], moves = [];
  const say = (m, from, to) => changes.push({ m, from, to });
  if (['role', 'section', 'deactivate', 'reactivate'].includes(action)) {
    const members = [];
    for (const m of list) {
      const p = rosterPowers(m);
      if (action === 'role') {
        if (!p.role) { skipped.push({ m, why: whyNot(m, 'role') }); continue; }
        if (!p.roles.includes(value)) { skipped.push({ m, why: `Your role cannot give the ${roleName(value)} role.` }); continue; }
        if (m.role === value) continue;
        members.push({ uid: m.id, patch: { role: value }, before: { role: m.role } }); say(m, roleName(m.role), roleName(value));
      } else if (action === 'section') {
        if (!p.edit) { skipped.push({ m, why: whyNot(m, 'details') }); continue; }
        if ((m.section || '') === value) continue;
        members.push({ uid: m.id, patch: { section: value }, before: { section: m.section || '' } }); say(m, m.section || 'No year level', value || 'No year level');
      } else {
        const want = action === 'reactivate';
        if (!p.active) { skipped.push({ m, why: whyNot(m, 'access') }); continue; }
        if (m.active === want) continue;
        members.push({ uid: m.id, patch: { active: want }, before: { active: m.active } }); say(m, m.active ? 'Active' : 'Deactivated', want ? 'Active' : 'Deactivated');
      }
    }
    return { plan: { members, departments: [], committees: [] }, changes, skipped };
  }
  if (action === 'dept' || action === 'position') {
    const perDept = {};
    for (const m of list) {
      const p = rosterPowers(m), here = placeOf(m.id);
      if (!p.place) { skipped.push({ m, why: whyNot(m, 'position') }); continue; }
      if (m.role === 'teacher') { skipped.push({ m, why: 'Teachers are in no department.' }); continue; }
      if (action === 'dept') {
        if ((here.dept?.id || '') === value) continue;
        moves.push({ uid: m.id, deptId: value, position: 'member' });
        say(m, here.dept?.name || 'No department', S.departments.find((d) => d.id === value)?.name || 'No department');
      } else {
        if (!here.dept) { skipped.push({ m, why: 'Not in a department yet. Set the department first.' }); continue; }
        if (here.position === value) continue;
        if (value !== 'member') { perDept[here.dept.id] = (perDept[here.dept.id] || 0) + 1; if (perDept[here.dept.id] > 1) { skipped.push({ m, why: `${here.dept.name} has one ${positionName(value)}. Choose one person per department.` }); continue; } }
        moves.push({ uid: m.id, deptId: here.dept.id, position: value });
        say(m, positionName(here.position), positionName(value));
      }
    }
    return { plan: placePlan(moves), changes, skipped };
  }
  // Committee teams: one document per committee.
  const [cid, tid] = value.split(':'), c = S.committees.find((x) => x.id === cid), t = c?.teams?.find((x) => x.id === tid);
  if (!c || !t) return { plan: { members: [], departments: [], committees: [] }, changes, skipped };
  const before = { ...c }; delete before.id;
  const teams = c.teams.map((x) => ({ ...x, leadUids: [...(x.leadUids || [])], memberUids: [...(x.memberUids || [])] })), team = teams.find((x) => x.id === tid);
  for (const m of list) {
    const inTeam = [...team.leadUids, ...team.memberUids].includes(m.id);
    if (action === 'team-add') { if (inTeam) continue; team.memberUids.push(m.id); say(m, 'Not in the team', t.name); }
    else { if (!inTeam) continue; team.memberUids = team.memberUids.filter((u) => u !== m.id); team.leadUids = team.leadUids.filter((u) => u !== m.id); say(m, t.name, 'Not in the team'); }
  }
  return { plan: { members: [], departments: [], committees: changes.length ? [{ id: c.id, data: { ...before, teams }, before }] : [] }, changes, skipped };
}

function BulkBar({ selected, clear }) {
  const [action, setAction] = useState('role'), [value, setValue] = useState(''), [preview, setPreview] = useState(null), [busy, setBusy] = useState(false);
  const openTeams = committees().filter((c) => c.status !== 'closed').flatMap((c) => (c.teams || []).map((t) => [`${c.id}:${t.id}`, `${t.name}, ${c.name}`]));
  const options = action === 'role' ? ROLES.map((r) => [r, ROLE_INFO[r][0]])
    : action === 'dept' ? [['', 'No department'], ...departments().map((d) => [d.id, d.name])]
      : action === 'position' ? POSITIONS : action === 'section' ? [['', 'No year level'], ...YEAR_LEVELS.map((y) => [y, y])]
        : action.startsWith('team') ? openTeams : [];
  const pickAction = (a) => { setAction(a); const o = a === 'role' ? 'member' : a === 'position' ? 'member' : a.startsWith('team') ? openTeams[0]?.[0] || '' : ''; setValue(o); };
  const run = () => setPreview(buildPlan(action, action === 'role' && !value ? 'member' : value, selected));
  const apply = async () => { setBusy(true); const ok = await applyPlan(preview.plan, ACTIONS.find(([k]) => k === action)[1]); setBusy(false); if (ok) { setPreview(null); clear(); } };
  return (
    <div class="fl-bulkbar" role="region" aria-label="Bulk edit">
      <b class="fl-mono">{selected.length}</b><span>selected</span>
      <select class="fl-input fl-input--sm" aria-label="Change" value={action} onChange={(e) => pickAction(e.target.value)}>{ACTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {options.length > 0 && <select class="fl-input fl-input--sm" aria-label="To" value={value || (action === 'role' ? 'member' : '')} onChange={(e) => setValue(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
      {action.startsWith('team') && !openTeams.length && <span class="fl-small fl-muted">No open committee has teams yet.</span>}
      <button class="fl-btn fl-btn--red fl-btn--sm" disabled={action.startsWith('team') && !openTeams.length} onClick={run}>Preview changes</button>
      <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={clear}>Clear selection</button>
      {preview && (
        <Sheet label="Preview changes" onClose={() => setPreview(null)}>
          <h2 class="fl-h2">{preview.changes.length ? `${preview.changes.length} ${preview.changes.length === 1 ? 'person changes' : 'people change'}` : 'Nothing to change'}</h2>
          {preview.changes.length > 0 && <ul class="fl-list fl-preview-list">{preview.changes.map(({ m, from, to }) => <li key={m.id}><b>{m.name}</b><span class="fl-muted">{from}</span><span aria-hidden="true">to</span><span>{to}</span></li>)}</ul>}
          {preview.skipped.length > 0 && <>
            <h3 class="fl-h3">Not changed ({preview.skipped.length})</h3>
            <ul class="fl-list fl-preview-list">{preview.skipped.map(({ m, why }) => <li key={m.id}><b>{m.name}</b><span class="fl-muted fl-span2">{why}</span></li>)}</ul>
          </>}
          {preview.plan.departments.length > 0 && <p class="fl-help">Also updates {preview.plan.departments.length} {preview.plan.departments.length === 1 ? 'department' : 'departments'} and who reports to whom.</p>}
          <div class="fl-actions">
            <button class="fl-btn fl-btn--red" disabled={busy || !preview.changes.length} onClick={apply}>{busy ? 'Saving…' : `Apply to ${preview.changes.length} ${preview.changes.length === 1 ? 'person' : 'people'}`}</button>
            <button class="fl-btn fl-btn--ghost" onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ---------- The screen

const COLS = [['name', 'Name'], ['id', 'Email'], ['role', 'Role'], ['dept', 'Department'], ['position', 'Position'], ['section', 'Year level'], ['active', 'Status']];
export function Admin() {
  const [edit, setEdit] = useState(null), [bulk, setBulk] = useState(false), [pick, setPick] = useState(new Set());
  const [f, setF] = useState({ q: '', role: '', dept: '', section: '', status: 'active' }), [sort, setSort] = useState({ key: 'name', dir: 1 });
  if (!isAdmin()) return <><Title light="Not for you." bold="Admin" /><p>Only the advisor, the president and the vice president manage the roster.</p></>;
  const val = (m, k) => (k === 'dept' ? placeOf(m.id).dept?.name || '' : k === 'position' ? positionName(placeOf(m.id).position) : k === 'role' ? roleName(m.role) : k === 'active' ? (m.active ? 'Active' : 'Deactivated') : m[k] || '');
  const t = f.q.trim().toLowerCase();
  const rows = S.members.filter((m) => (!t || m.name.toLowerCase().includes(t) || m.id.includes(t)) && (!f.role || m.role === f.role)
    && (!f.dept || (f.dept === '-' ? !placeOf(m.id).dept : placeOf(m.id).dept?.id === f.dept)) && (!f.section || (f.section === '-' ? !m.section : m.section === f.section))
    && (!f.status || (f.status === 'active') === !!m.active))
    .sort((a, b) => sort.dir * String(val(a, sort.key)).localeCompare(String(val(b, sort.key))) || a.name.localeCompare(b.name));
  const selected = S.members.filter((m) => pick.has(m.id)), allOn = rows.length > 0 && rows.every((m) => pick.has(m.id));
  const flip = (id) => setPick((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sections = [...new Set(S.members.map((m) => m.section).filter(Boolean))].sort();
  return (
    <>
      <Title light="The roster." bold="Members and roles." title="Members and roles">
        <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setEdit('new')}>Add member</button>
        <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setBulk(true)}>Bulk add</button>
      </Title>
      <p class="fl-measure">Role decides what someone can do in the app. Department and position decide where they sit in the council. Section is their year level.</p>
      {bulk && <BulkAdd done={() => setBulk(false)} />}
      {edit && <Sheet label={edit === 'new' ? 'Add a member' : `Edit ${edit.name}`} onClose={() => setEdit(null)}><MemberForm m={edit === 'new' ? null : edit} done={() => setEdit(null)} /></Sheet>}
      <div class="fl-filterbar" role="search">
        <label class="fl-field fl-filterbar__q"><span class="fl-sr">Search</span><input class="fl-input" placeholder="Search names or emails" value={f.q} onInput={set('q')} /></label>
        <label class="fl-field"><span class="fl-sr">Role</span><select class="fl-input" value={f.role} onChange={set('role')}><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select></label>
        <label class="fl-field"><span class="fl-sr">Department</span><select class="fl-input" value={f.dept} onChange={set('dept')}><option value="">All departments</option><option value="-">No department</option>{departments().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label class="fl-field"><span class="fl-sr">Year level</span><select class="fl-input" value={f.section} onChange={set('section')}><option value="">All year levels</option><option value="-">No year level</option>{sections.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label class="fl-field"><span class="fl-sr">Status</span><select class="fl-input" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Deactivated</option><option value="">Everyone</option></select></label>
      </div>
      <div class="fl-actions fl-small">
        <span class="fl-muted">{rows.length} shown</span>
        {rows.length > 0 && !allOn && <button class="fl-linkbtn fl-small" onClick={() => setPick(new Set([...pick, ...rows.map((m) => m.id)]))}>Select all filtered ({rows.length})</button>}
      </div>
      {selected.length > 0 && <BulkBar selected={selected} clear={() => setPick(new Set())} />}
      <div class="fl-panel fl-scroll fl-tablebox">
        <table class="fl-table fl-table--compact">
          <thead><tr>
            <th><input type="checkbox" class="fl-check" aria-label="Select all shown" checked={allOn} onChange={() => setPick(allOn ? new Set([...pick].filter((x) => !rows.some((m) => m.id === x))) : new Set([...pick, ...rows.map((m) => m.id)]))} /></th>
            {COLS.map(([k, l]) => <th key={k} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
              <button class="fl-sortbtn" onClick={() => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })}>{l}{sort.key === k && <span aria-hidden="true">{sort.dir > 0 ? ' ↑' : ' ↓'}</span>}</button></th>)}
            <th><span class="fl-sr">Actions</span></th>
          </tr></thead>
          <tbody>{rows.map((m) => { const p = rosterPowers(m), place = placeOf(m.id); return (
            <tr key={m.id} class={pick.has(m.id) ? 'is-picked' : ''}>
              <td><input type="checkbox" class="fl-check" aria-label={`Select ${m.name}`} checked={pick.has(m.id)} onChange={() => flip(m.id)} /></td>
              <td><a class="fl-tablelink" href={`#/people/${encodeURIComponent(m.id)}`}>{m.name}</a></td>
              <td class="fl-small fl-muted">{m.id}</td>
              <td>{roleName(m.role)}</td>
              <td>{place.dept?.name || <span class="fl-muted">None</span>}</td>
              <td>{place.dept ? positionName(place.position) : <span class="fl-muted">None</span>}</td>
              <td>{m.section || <span class="fl-muted">None</span>}</td>
              <td>{m.active ? 'Active' : <span class="fl-badge fl-badge--warn">Deactivated</span>}</td>
              <td>{(p.edit || p.active) && <Menu label={`Actions for ${m.name}`} items={[
                p.edit && ['Edit', () => setEdit(m)],
                p.active && [m.active ? 'Deactivate' : 'Reactivate', () => (!m.active || confirm(`Deactivate ${m.name}? They lose access straight away. Their history stays, and Reactivate brings them back.`)) && putDoc(`members/${m.id}`, { active: !m.active }, `${m.name} ${m.active ? 'deactivated' : 'reactivated'}.`)],
              ]} />}</td>
            </tr>); })}</tbody>
        </table>
        {!rows.length && <p class="fl-empty">Nobody matches these filters. Clear the search or choose All.</p>}
      </div>
      {S.me.role === 'advisor' && <CloseTerm />}
    </>
  );
}
