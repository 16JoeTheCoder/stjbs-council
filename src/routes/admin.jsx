import { useMemo, useState } from 'preact/hooks';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName } from '../store.js';
import { initials, isAdmin, roleName } from '../model.js';
import { bulkAddMembers, bulkDeactivate, putDoc } from '../actions.js';
import { confirmed, confirmPhrase, importable, parseBulk, sectionsOf } from '../bulk-roster.js';
import { Sheet } from '../shared.jsx';
import { isoDay, monday, weekId } from '../time.js';
import { Title, useAutofocus, useReturnFocus } from '../ui.jsx';
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
    <label class={`fl-field${err.field === k ? ' fl-field--error' : ''}`}><span class="fl-field__label">{label}</span>
      <input class="fl-input" name={k} value={v[k]} onInput={on(k)} {...extra} aria-invalid={err.field === k || undefined} aria-describedby={err.field === k ? 'm-err' : undefined} /></label>
  );
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">{m ? `Edit ${m.name}` : 'Add member'}</h2>
      {field('id', 'School email', { type: 'email', disabled: !!m })}
      {field('name', 'Name', { maxLength: 60 })}
      <label class="fl-field"><span class="fl-field__label">Role</span><select class="fl-input" value={v.role} onChange={on('role')} disabled={!can.role}>
        {(can.role ? can.roles : [v.role]).map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select></label>
      {field('section', 'Section', { maxLength: 60, placeholder: 'For example sec 1 to sec 3' })}
      <label class="fl-field"><span class="fl-field__label">Reports to</span><select class="fl-input" value={v.reportsTo || ''} onChange={on('reportsTo')}>
        <option value="">Nobody</option>{S.members.filter((x) => x.active && x.id !== v.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <p id="m-err" class="fl-error" role="alert">{err.msg}</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>Save member</button><button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
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

// Paste blocks of email, name, role, section (blank line between people). Existing emails are skipped, never overwritten.
function BulkAdd({ done }) {
  const [text, setText] = useState(''), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false);
  const rows = useMemo(() => parseBulk(text, rosterPowers(null).roles, S.members.map((m) => m.id)), [text]);
  const ok = importable(rows), bad = rows.filter((r) => r.errors.length).length, skipped = rows.filter((r) => !r.errors.length && r.skip).length;
  const phrase = confirmPhrase('add', ok.length);
  const go = async () => { setBusy(true); if (await bulkAddMembers(ok)) done(); else setBusy(false); };
  return (
    <Sheet label="Bulk add members" onClose={done}>
      <h2 class="fl-h2">Bulk add members</h2>
      <p>One person per block, four lines: email, name, role, section. Leave a blank line between people. Roles you may add: {rosterPowers(null).roles.map(roleName).join(', ')}.</p>
      <label class="fl-field"><span class="fl-field__label">Pasted list</span>
        <textarea class="fl-input fl-mono" rows={8} value={text} placeholder={PLACEHOLDER} onInput={(e) => setText(e.target.value)} /></label>
      {rows.length > 0 && <div class="fl-panel fl-scroll"><table class="fl-table">
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Section</th><th>Result</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td class="fl-small">{r.email}</td><td>{r.name}</td><td>{r.role ? roleName(r.role) : ''}</td><td>{r.section}</td>
            <td>{r.errors.length ? <span class="fl-badge fl-badge--warn">{r.errors.join(' ')}</span>
              : r.skip ? <span class="fl-badge fl-badge--warn">{r.skip}</span> : <span class="fl-badge fl-badge--ok">Will add</span>}</td></tr>))}</tbody>
      </table></div>}
      <p class="fl-caption" role="status">{rows.length ? `${ok.length} to add, ${skipped} skipped, ${bad} with problems.${bad ? ' Fix the problems or delete those blocks to continue.' : ''}` : 'Nothing pasted yet.'}</p>
      {ok.length > 0 && bad === 0 && <TypeToConfirm phrase={phrase} value={typed} set={setTyped} />}
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy || !ok.length || bad > 0 || !confirmed(typed, phrase)} onClick={go}>Add {ok.length} member{ok.length === 1 ? '' : 's'}</button>
        <button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </Sheet>
  );
}

// Pick active members by name, narrowed by role and section. Only the rows you can see and have ticked are deactivated.
// Members are never deleted; Reactivate on the roster undoes this.
function BulkRemove({ done }) {
  const pool = S.members.filter((m) => m.active && rosterPowers(m).active).sort((a, b) => a.name.localeCompare(b.name));
  const [role, setRole] = useState(''), [section, setSection] = useState('__all'), [pick, setPick] = useState(new Set()), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false);
  const shown = pool.filter((m) => (!role || m.role === role) && (section === '__all' || (m.section || '') === section));
  const chosen = shown.filter((m) => pick.has(m.id)), all = shown.length > 0 && chosen.length === shown.length;
  const flip = (id) => setPick((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const flipAll = () => setPick((p) => { const n = new Set(p); shown.forEach((m) => (all ? n.delete(m.id) : n.add(m.id))); return n; });
  const phrase = confirmPhrase('deactivate', chosen.length);
  const go = async () => { setBusy(true); if (await bulkDeactivate(chosen.map((m) => m.id))) done(); else setBusy(false); };
  return (
    <Sheet label="Bulk remove members" onClose={done}>
      <h2 class="fl-h2">Bulk remove members</h2>
      <p>Removed members are deactivated: they lose access but their history stays, and Reactivate on the roster brings them back.</p>
      <div class="fl-form">
        <label class="fl-field"><span class="fl-field__label">Role</span><select class="fl-input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>{[...new Set(pool.map((m) => m.role))].map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select></label>
        <label class="fl-field"><span class="fl-field__label">Section</span><select class="fl-input" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="__all">All sections</option>{sectionsOf(pool).map((x) => <option key={x} value={x}>{x || 'No section'}</option>)}</select></label>
      </div>
      <label class="fl-checkrow"><input type="checkbox" class="fl-check" checked={all} disabled={!shown.length} onChange={flipAll} />Select all shown ({shown.length})</label>
      <div class="fl-panel">{shown.map((m) => (
        <label key={m.id} class="fl-checkrow"><input type="checkbox" class="fl-check" checked={pick.has(m.id)} onChange={() => flip(m.id)} />
          {m.name}<span class="fl-muted fl-small">{roleName(m.role)}{m.section ? `, ${m.section}` : ''}</span></label>))}
        {!shown.length && <p class="fl-empty">No active members match.</p>}</div>
      <p class="fl-caption" role="status">{chosen.length} selected.</p>
      {chosen.length > 0 && <TypeToConfirm phrase={phrase} value={typed} set={setTyped} />}
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy || !chosen.length || !confirmed(typed, phrase)} onClick={go}>Deactivate {chosen.length} member{chosen.length === 1 ? '' : 's'}</button>
        <button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </Sheet>
  );
}

export function Admin() {
  const [edit, setEdit] = useState(null), [bulk, setBulk] = useState(null), advisor = S.me.role === 'advisor', back = useReturnFocus(!!edit);
  if (!isAdmin()) return <><Title light="Not for you." bold="Admin" /><p>Only the advisor, the president and the vice president manage the roster.</p></>;
  const members = [...S.members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return (
    <>
      <Title light="The roster." bold="Members and roles." title="Members and roles">
        {!edit && <span ref={back}><button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setEdit('new')}>Add member</button></span>}
        {!edit && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setBulk('add')}>Bulk add</button>}
        {!edit && members.some((m) => m.active && rosterPowers(m).active) && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setBulk('remove')}>Bulk remove</button>}
      </Title>
      {bulk === 'add' && <BulkAdd done={() => setBulk(null)} />}
      {bulk === 'remove' && <BulkRemove done={() => setBulk(null)} />}
      {edit && <MemberForm m={edit === 'new' ? null : edit} done={() => setEdit(null)} />}
      <div class="fl-panel fl-scroll"><table class="fl-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Section</th><th>Reports to</th><th>Status</th><th><span class="fl-sr">Actions</span></th></tr></thead>
        <tbody>{members.map((m) => (
          <tr key={m.id}><td>{m.name}</td><td class="fl-small fl-muted">{m.id}</td><td>{roleName(m.role)}</td><td>{m.section}</td><td>{m.reportsTo ? memberName(m.reportsTo) : ''}</td>
            <td><span class={`fl-badge fl-badge--${m.active ? 'ok' : 'warn'}`}>{m.active ? 'Active' : 'Deactivated'}</span></td>
            <td class="fl-actions">{rosterPowers(m).edit && <button class="fl-btn fl-btn--ghost fl-btn--sm" aria-label={`Edit ${m.name}`} onClick={() => setEdit(m)}>Edit</button>}
              {rosterPowers(m).active && <button class="fl-btn fl-btn--ghost fl-btn--sm" aria-label={`${m.active ? 'Deactivate' : 'Reactivate'} ${m.name}`} onClick={() => putDoc(`members/${m.id}`, { active: !m.active }, `${m.name} ${m.active ? 'deactivated' : 'reactivated'}.`)}>{m.active ? 'Deactivate' : 'Reactivate'}</button>}</td></tr>))}</tbody>
      </table></div>
      {advisor && <CloseTerm />}
    </>
  );
}
