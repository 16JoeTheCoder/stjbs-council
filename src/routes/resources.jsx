// Resources: the council's document templates (Google links, never uploads), suggestions for new or better
// templates, the handover archive, and your own submissions with their status. Exec also reach project templates.
import { useEffect, useState } from 'preact/hooks';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S } from '../store.js';
import { copyUrl, googleUrl, isExec, tree } from '../model.js';
import { submitResource } from '../actions.js';
import { fmtDay, isoDay } from '../time.js';
import { Icon } from '../shared.jsx';
import { Empty, Panel, Title, useAutofocus } from '../ui.jsx';

export const SUB_STATUS = { pending: ['warn', 'Pending'], approved: ['ok', 'Approved'], rejected: ['bad', 'Rejected'], filed: ['ok', 'Filed'] };
export const SUB_TYPE = { 'new-template': 'New template', 'template-edit': 'Template edit', archive: 'Archive file' };

// Your own submissions only: the rules refuse an unfiltered query.
function useMine() {
  const [list, setList] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'submissions'), where('byUid', '==', S.me.id)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)), () => setList(false)), []);
  return list;
}

function ShareForm({ target, done }) {
  const [v, setV] = useState({ type: target ? 'template-edit' : 'new-template', name: target ? `${target.name}, improved` : '', url: '', note: '', projectId: '' });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), ref = useAutofocus();
  const on = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!v.name.trim()) return setErr({ f: 'name', m: 'Add a name, then send.' });
    if (!googleUrl(v.url.trim())) return setErr({ f: 'url', m: 'Paste a Google Docs, Sheets, Slides, Forms or Drive link (https://docs.google.com/... or https://drive.google.com/...).' });
    setErr({}); setBusy(true);
    const ok = await submitResource({ type: v.type, name: v.name.trim().slice(0, 80), url: v.url.trim(), note: v.note.trim().slice(0, 500),
      targetId: target?.id, projectId: v.type === 'archive' ? v.projectId : '' });
    setBusy(false);
    if (ok) done();
  };
  const help = { 'new-template': 'An admin checks it, then it joins the templates everyone can copy.', 'template-edit': 'An admin checks it, then it replaces the current version.',
    archive: 'Filed straight into the handover archive for next year\'s council. Only admins and you can open it.' };
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">{target ? `Suggest an edit to ${target.name}` : 'Share something'}</h2>
      {!target && (
        <div class="fl-seg" role="group" aria-label="What are you sharing">
          <button type="button" aria-pressed={v.type === 'new-template'} onClick={() => setV({ ...v, type: 'new-template' })}>A new template</button>
          <button type="button" aria-pressed={v.type === 'archive'} onClick={() => setV({ ...v, type: 'archive' })}>An archive file</button>
        </div>)}
      <p class="fl-help">{help[v.type]}</p>
      <div class={`fl-field${err.f === 'name' ? ' fl-field--error' : ''}`}><label for="sub-name">Name</label>
        <input id="sub-name" class="fl-input" maxLength={80} value={v.name} onInput={on('name')} aria-invalid={err.f === 'name' || undefined} /></div>
      <div class={`fl-field${err.f === 'url' ? ' fl-field--error' : ''}`}><label for="sub-url">Google link</label>
        <input id="sub-url" class="fl-input" type="url" inputMode="url" value={v.url} onInput={on('url')} placeholder="https://docs.google.com/document/d/..." aria-invalid={err.f === 'url' || undefined} aria-describedby="sub-err" /></div>
      {v.type === 'archive' && (
        <div class="fl-field"><label for="sub-proj">Project</label><select id="sub-proj" class="fl-input" value={v.projectId} onChange={on('projectId')}>
          <option value="">Not tied to a project</option>{(tree().kids.root || []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></div>)}
      <div class="fl-field"><label for="sub-note">Note</label><textarea id="sub-note" class="fl-input" rows={2} maxLength={500} value={v.note} onInput={on('note')} placeholder="What changed, or what this file is" /></div>
      <p id="sub-err" class="fl-error" role="alert">{err.m}</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>{v.type === 'archive' ? 'File it' : 'Send for approval'}</button>
        <button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </form>
  );
}

export function Resources() {
  const mine = useMine(), [form, setForm] = useState(null), teacher = S.me.role === 'teacher';
  const docs = [...S.docTemplates].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <Title light="Resources." bold="Templates and handover." title="Resources">
        {!teacher && !form && <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm({})}><Icon n="plus" />Share something</button>}
      </Title>
      {form && <ShareForm target={form.target} done={() => setForm(null)} />}
      <Panel title="Document templates" id="docs-h">
        {S.fail.docTemplates ? <p class="fl-error" role="alert">Templates did not load. Reload to try again.</p> : docs.length ? (
          <div class="fl-list">{docs.map((d) => {
            const copy = copyUrl(d.url);
            return (
              <div key={d.id} class="fl-row fl-row--doc">
                <span class="fl-tag">{d.kind}</span>
                <div><div class="fl-h3">{d.name}</div><div class="fl-caption fl-mono">Version {d.version}</div></div>
                <span class="fl-actions">
                  <a class="fl-btn fl-btn--ghost fl-btn--sm" href={copy || d.url} target="_blank" rel="noopener noreferrer"><Icon n={copy ? 'copy' : 'ext'} />{copy ? 'Make a copy' : 'Open'}</a>
                  {!teacher && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm({ target: d })} aria-label={`Suggest an edit to ${d.name}`}>Suggest an edit</button>}
                </span>
              </div>
            );
          })}</div>
        ) : <Empty>No templates yet. Share one and an admin adds it.</Empty>}
      </Panel>
      {!teacher && (
        <Panel title="My submissions" id="subs-h">
          {mine === null ? <p class="fl-muted" role="status">Loading your submissions.</p> : mine === false ? <p class="fl-error" role="alert">Your submissions did not load. Reload to try again.</p>
            : mine.length ? <div class="fl-list">{mine.map((x) => (
              <div key={x.id} class="fl-row fl-row--doc">
                <span class={`fl-badge fl-badge--${SUB_STATUS[x.status][0]}`}>{SUB_STATUS[x.status][1]}</span>
                <div><a class="fl-h3" href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a><div class="fl-caption">{SUB_TYPE[x.type]} · {fmtDay(isoDay(x.createdAt))}</div></div>
                <span />
              </div>))}</div>
            : <Empty>Nothing shared yet. Use Share something to suggest a template or file a document for next year.</Empty>}
        </Panel>
      )}
      {isExec() && (
        <Panel title="Project templates" id="ptpl-h" link={<a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/templates">Open project templates</a>}>
          <p class="fl-muted fl-measure">Turn a planning document into a reusable project tree with the AI prompt, import or export JSON, and start a new project from a saved template.</p>
        </Panel>
      )}
    </>
  );
}
