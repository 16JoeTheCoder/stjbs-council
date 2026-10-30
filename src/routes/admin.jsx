import { useState } from 'preact/hooks';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName } from '../store.js';
import { initials, isAdmin } from '../model.js';
import { putDoc } from '../actions.js';
import { isoDay, monday, weekId } from '../time.js';
import { Title, useAutofocus, useReturnFocus } from '../ui.jsx';
import { roleName } from './people.jsx';
import { download } from './views.jsx';

const ROLES = ['president', 'vp', 'treasurer', 'secretary', 'officer', 'teacher', 'advisor'];
const PRESIDENT_ROLES = ['officer', 'treasurer', 'secretary', 'teacher'];
const SCHOOL = /^[^@\s]+@stjbs\.sch\.id$/;

// What the signed-in admin may do to a member; mirrors the members rules in firestore.rules.
export function rosterPowers(m) {
  const r = S.me.role, self = m?.id === S.me.id, target = m?.role;
  if (r === 'advisor') return { roles: ROLES, role: !self, active: !self, edit: true };
  if (r === 'vp') return { roles: ROLES.filter((x) => x !== 'advisor'), role: !self && target !== 'advisor', active: !self && target !== 'advisor', edit: target !== 'advisor' };
  if (r === 'president') return { roles: PRESIDENT_ROLES, role: !m, active: false, edit: target !== 'advisor' };
  return { roles: [], role: false, active: false, edit: false };
}

function MemberForm({ m, done }) {
  const can = rosterPowers(m);
  const [v, setV] = useState(m ? { ...m, section: m.section || '' } : { id: '', name: '', role: 'officer', section: '', reportsTo: '' });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), ref = useAutofocus();
  const bad = (field, msg) => { setErr({ field, msg }); ref.current.querySelector(`[name=${field}]`)?.focus(); };
  const on = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const email = v.id.trim().toLowerCase();
    if (!SCHOOL.test(email)) return bad('id', 'Use a school email ending in @stjbs.sch.id.');
    if (!m && S.members.some((x) => x.id === email)) return bad('id', 'This email is already on the roster. Close this form and edit that member instead.');
    if (!v.name.trim()) return bad('name', 'Add a name, then save.');
    // A president's edit may touch only name, section and reports-to, so role is sent only when it may change.
    const data = { name: v.name.trim(), initials: initials(v.name), section: v.section.trim(), reportsTo: v.reportsTo || null, ...(can.role ? { role: v.role } : {}) };
    if (!m) Object.assign(data, { active: true, createdAt: Date.now() });
    setBusy(true);
    if (await putDoc(`members/${email}`, data, `${data.name} saved.`)) done(); else setBusy(false);
  };
  const field = (k, label, extra) => (
    <label class={`jy-field${err.field === k ? ' jy-field--error' : ''}`}><span class="jy-field__label">{label}</span>
      <input class="jy-field__input" name={k} value={v[k]} onInput={on(k)} {...extra} aria-invalid={err.field === k || undefined} aria-describedby={err.field === k ? 'm-err' : undefined} /></label>
  );
  return (
    <form class="jy-form jy-panel" onSubmit={submit} ref={ref} noValidate>
      <h2 class="jy-h2">{m ? `Edit ${m.name}` : 'Add member'}</h2>
      {field('id', 'School email', { type: 'email', disabled: !!m })}
      {field('name', 'Name', { maxLength: 60 })}
      <label class="jy-field"><span class="jy-field__label">Role</span><select class="jy-field__input" value={v.role} onChange={on('role')} disabled={!can.role}>
        {(can.role ? can.roles : [v.role]).map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select></label>
      {field('section', 'Section', { maxLength: 60, placeholder: 'For example sec 1 to sec 3' })}
      <label class="jy-field"><span class="jy-field__label">Reports to</span><select class="jy-field__input" value={v.reportsTo || ''} onChange={on('reportsTo')}>
        <option value="">Nobody</option>{S.members.filter((x) => x.active && x.id !== v.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <p id="m-err" class="jy-error" role="alert">{err.msg}</p>
      <div class="jy-actions"><button class="jy-btn" disabled={busy}>Save member</button><button type="button" class="jy-btn jy-btn--ghost" onClick={done}>Cancel</button></div>
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
      for (const c of ['members', 'items', 'comments', 'checkins', 'activity', 'templates', 'announcements', 'events', 'rsvps', 'ideas', 'docTemplates', 'submissions', 'cache'])
        out[c] = (await getDocs(collection(db, c))).docs.map((d) => ({ id: d.id, ...d.data() }));
      const feed = await getDoc(doc(db, 'public', 'feed'));
      out.public = feed.exists() ? [{ id: 'feed', ...feed.data() }] : [];
      out.settings = [{ id: 'current', ...S.term }, { id: 'digest', ...S.digest }];
      setMsg('Saving files, step 2 of 2.');
      const day = isoDay();
      download(`council-backup-${day}.json`, JSON.stringify(out, null, 1));
      const cols = ['id', 'termId', 'kind', 'title', 'parentId', 'status', 'blocked', 'assigneeUids', 'leadUid', 'startDate', 'dueDate', 'completedAt', 'isDeal', 'dealStage', 'pledgedIdr', 'receivedIdr', 'archived'];
      download(`council-items-${day}.csv`, csv([cols, ...out.items.map((i) => cols.map((k) => (Array.isArray(i[k]) ? i[k].join(' ') : i[k])))]), 'text/csv');
      setSaved(true); setMsg(`Backup saved: ${Object.entries(out).map(([k, v]) => `${v.length} ${k}`).join(', ')}.`);
    } catch (e) { setMsg(`Backup failed (${e.code || e.message}). Nothing changed. Try again.`); }
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
    <section class="jy-section jy-form" aria-labelledby="close-h">
      <h2 id="close-h" class="jy-h2">Close term</h2>
      <p>Current term: <b class="jy-mono">{S.term.termId}</b>. Closing changes only the current term. Nothing is deleted; set the old name back to undo.</p>
      <div class="jy-actions"><button class="jy-btn jy-btn--ghost" disabled={busy} onClick={backup}>Download backup</button></div>
      <p class="jy-caption" role="status">{msg}</p>
      <label class="jy-field"><span class="jy-field__label">New term name</span>
        <input class="jy-field__input jy-mono" value={name} placeholder="2027-28" disabled={!saved} onInput={(e) => setName(e.target.value)} aria-describedby="close-help" />
        <span id="close-help" class="jy-field__help">{saved ? 'Type the new term name to confirm.' : 'Locked until the backup has downloaded.'}</span></label>
      <div class="jy-actions"><button class="jy-btn jy-btn--ghost" disabled={!saved || busy || !/^[\w-]{4,20}$/.test(name.trim()) || name.trim() === S.term.termId} onClick={close}>Close term and start {name.trim() || 'the new one'}</button></div>
    </section>
  );
}

export function Admin() {
  const [edit, setEdit] = useState(null), advisor = S.me.role === 'advisor', back = useReturnFocus(!!edit);
  if (!isAdmin()) return <><Title light="Not for you." bold="Admin" /><p>Only the advisor, the president and the vice president manage the roster.</p></>;
  const members = [...S.members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return (
    <>
      <Title light="The roster." bold="Admin." title="Admin" />
      {edit ? <MemberForm m={edit === 'new' ? null : edit} done={() => setEdit(null)} /> :
        <div class="jy-actions" ref={back}><button class="jy-btn jy-btn--ghost" onClick={() => setEdit('new')}>Add member</button></div>}
      <div class="jy-section jy-scroll"><table class="jy-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Section</th><th>Reports to</th><th>Status</th><th><span class="jy-sr">Actions</span></th></tr></thead>
        <tbody>{members.map((m) => (
          <tr key={m.id}><td>{m.name}</td><td class="jy-mono">{m.id}</td><td>{roleName(m.role)}</td><td>{m.section}</td><td>{m.reportsTo ? memberName(m.reportsTo) : ''}</td>
            <td>{m.active ? 'Active' : 'Deactivated'}</td>
            <td>{rosterPowers(m).edit && <button class="jy-link" onClick={() => setEdit(m)}>Edit {m.name}</button>}{' '}
              {rosterPowers(m).active && <button class="jy-link" onClick={() => putDoc(`members/${m.id}`, { active: !m.active }, `${m.name} ${m.active ? 'deactivated' : 'reactivated'}.`)}>{m.active ? 'Deactivate' : 'Reactivate'}</button>}</td></tr>))}</tbody>
      </table></div>
      {advisor && <CloseTerm />}
    </>
  );
}
