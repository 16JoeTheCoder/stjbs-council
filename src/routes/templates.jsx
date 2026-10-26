import { useEffect, useState } from 'preact/hooks';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, toast } from '../store.js';
import { isBoss } from '../model.js';
import { createTree, putDoc } from '../actions.js';
import { addDays, isoDay } from '../time.js';
import { Title } from '../ui.jsx';
import { download } from './views.jsx';

export const PROMPT = `You are an expert event and project planner who converts messy planning documents (PDFs, Word files, slides, last year's plans) into clean, reusable project templates for a school student council. When I attach a document, extract every team, task and subtask, preserve the hierarchy, and output ONLY JSON in the schema below, with no commentary.

Rules:
- Give every item a unique short "key". "parentKey" is null for the top-level project, otherwise the key of its parent.
- "type" is "task" unless the item involves negotiating with an outside party (sponsor, vendor, partner), in which case it is "deal".
- "teamTag" is the subteam name.
- "offsetDays" is the due date in days relative to the event date (negative = before, 0 = event day). Estimate it only from the document's own timeline; if there is none, use null rather than guessing.
- "title" max 80 characters, "notes" max 200 characters.
- Never invent tasks the document does not imply. Put anything ambiguous in the top-level "questions" array.

Schema:
{"templateName":"","version":1,"questions":[],"items":[{"key":"","parentKey":null,"title":"","notes":"","type":"task","teamTag":"","offsetDays":null}]}`;

// Returns a list of specific, one-line problems. Empty means valid.
export function validate(t) {
  if (!t || typeof t !== 'object' || !Array.isArray(t.items)) return ['The file needs an "items" array at the top level.'];
  const errs = [], keys = new Map(), name = (it, i) => `Item ${i + 1}${it?.title ? ` ("${String(it.title).slice(0, 30)}")` : ''}`;
  if (!t.templateName || typeof t.templateName !== 'string') errs.push('Add a "templateName" text field.');
  if (t.items.length > 300) errs.push(`The template has ${t.items.length} items; the limit is 300.`);
  if (t.questions != null && !(Array.isArray(t.questions) && t.questions.every((q) => typeof q === 'string'))) errs.push('"questions" must be a list of text lines.');
  t.items.forEach((it, i) => {
    if (!it || typeof it !== 'object') return errs.push(`Item ${i + 1} is not an object with a key and a title.`);
    if (typeof it.key !== 'string' || !it.key) return errs.push(`${name(it, i)}: "key" must be non-empty text.`);
    if (keys.has(it.key)) errs.push(`${name(it, i)}: key "${it.key}" is used twice.`);
    keys.set(it.key, it);
    if (typeof it.title !== 'string' || !it.title.trim() || it.title.length > 80) errs.push(`${name(it, i)}: "title" must be 1 to 80 characters.`);
    if (it.notes != null && (typeof it.notes !== 'string' || it.notes.length > 200)) errs.push(`${name(it, i)}: "notes" must be at most 200 characters.`);
    if (!['task', 'deal'].includes(it.type)) errs.push(`${name(it, i)}: "type" must be "task" or "deal".`);
    if (it.offsetDays != null && !(Number.isInteger(it.offsetDays) && Math.abs(it.offsetDays) <= 3650)) errs.push(`${name(it, i)}: "offsetDays" must be a whole number of days or null.`);
  });
  const roots = t.items.filter((it) => it && typeof it === 'object' && it.parentKey == null);
  if (roots.length !== 1) errs.push(`There must be exactly one top-level item (parentKey null); found ${roots.length}.`);
  t.items.forEach((it, i) => {
    if (!it || typeof it !== 'object') return;
    if (it.parentKey != null && !keys.has(it.parentKey)) return errs.push(`${name(it, i)}: parentKey "${it.parentKey}" matches no key.`);
    let depth = 1, p = it;
    while (p?.parentKey != null && depth <= 5) { p = keys.get(p.parentKey); depth++; }
    if (depth > 4) errs.push(`${name(it, i)}: nested ${depth > 5 ? 'in a loop or ' : ''}deeper than 4 levels.`);
  });
  return errs;
}

const children = (t, key) => t.items.filter((x) => x.parentKey === key);

function Node({ t, it, setT }) {
  const patch = (p) => setT({ ...t, items: t.items.map((x) => (x === it ? { ...x, ...p } : x)) });
  const remove = () => {
    const gone = new Set([it.key]);
    let grew = true;
    while (grew) { grew = false; for (const x of t.items) if (gone.has(x.parentKey) && !gone.has(x.key)) { gone.add(x.key); grew = true; } }
    setT({ ...t, items: t.items.filter((x) => !gone.has(x.key)) });
  };
  const add = () => setT({ ...t, items: [...t.items, { key: `k${Date.now().toString(36)}`, parentKey: it.key, title: 'New task', notes: '', type: 'task', teamTag: '', offsetDays: null }] });
  return (
    <li>
      <div class="jy-row">
        <label class="jy-field"><span class="jy-sr">Title</span><input class="jy-field__input" maxLength={80} value={it.title} onInput={(e) => patch({ title: e.target.value })} /></label>
        <label class="jy-field jy-field--num"><span class="jy-sr">Offset days for {it.title}</span>
          <input class="jy-field__input" type="number" placeholder="No date" value={it.offsetDays ?? ''} onInput={(e) => patch({ offsetDays: e.target.value === '' ? null : Math.round(Number(e.target.value)) })} /></label>
        {it.type === 'deal' && <span class="jy-tag">Deal</span>}
        <button class="jy-link" onClick={add}>Add item</button>
        {it.parentKey != null && <button class="jy-link" onClick={remove}>Remove</button>}
      </div>
      {children(t, it.key).length > 0 && <ul>{children(t, it.key).map((c) => <Node key={c.key} t={t} it={c} setT={setT} />)}</ul>}
    </li>
  );
}

// Parents before children, so the batch writer can resolve each parent.
export function toNodes(t, event) {
  const out = [], visit = (it) => {
    const kids = children(t, it.key), root = it.parentKey == null;
    out.push({ key: it.key, parentKey: it.parentKey ?? null, title: it.title.trim().slice(0, 80), notes: (it.notes || '').slice(0, 200),
      kind: root ? 'project' : kids.length ? 'team' : 'task', isDeal: !kids.length && it.type === 'deal',
      dueDate: root ? event : it.offsetDays == null ? null : addDays(event, it.offsetDays) });
    kids.forEach(visit);
  };
  visit(t.items.find((x) => x.parentKey == null));
  return out;
}

export function Templates() {
  const [list, setList] = useState([]), [raw, setRaw] = useState(''), [t, setT] = useState(null), [docId, setDocId] = useState(null);
  const [errs, setErrs] = useState([]), [event, setEvent] = useState(isoDay()), [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(query(collection(db, 'templates'), where('archived', '==', false)), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
  if (!isBoss() || S.me.role === 'teacher') return <><Title light="Not for you." bold="Templates" /><p>Only execs and the advisor manage templates.</p></>;
  const load = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { setT(null); return setErrs([`This is not valid JSON (${e.message}). Paste only the JSON the AI gave you.`]); }
    const e = validate(parsed);
    setErrs(e); setT(e.length ? null : parsed); setDocId(null);
  };
  const check = t && validate(t);
  const save = async () => {
    if (busy) return;
    const id = docId || doc(collection(db, 'templates')).id;
    setBusy(true);
    if (await putDoc(`templates/${id}`, { name: t.templateName, template: t, archived: false, ...(docId ? {} : { createdAt: Date.now() }) }, 'Template saved.')) setDocId(id);
    setBusy(false);
  };
  const start = async () => {
    setBusy(true);
    const rootId = await createTree(toNodes(t, event));
    setBusy(false);
    if (rootId) location.hash = `#/p/${rootId}`;
  };
  return (
    <>
      <Title light="Plan once." bold="Reuse it." title="Templates" />
      <section class="jy-well" aria-labelledby="help-h">
        <h2 id="help-h" class="jy-h2">Turn a planning document into a template</h2>
        <p>Copy the prompt, paste it into any AI chat with the PDF or document attached, then paste the JSON it returns below.</p>
        <div class="jy-actions"><button class="jy-btn jy-btn--ghost" onClick={() => navigator.clipboard.writeText(PROMPT).then(() => toast('Prompt copied.'))}>Copy prompt</button></div>
      </section>
      <section class="jy-section" aria-labelledby="saved-h"><h2 id="saved-h" class="jy-h2">Saved templates</h2>
        {list.length ? <ul class="jy-list">{list.map((x) => (
          <li key={x.id} class="jy-task"><span class="jy-task__body"><b>{x.name}</b><span class="jy-caption">{x.template.items.length} items</span></span>
            <button class="jy-btn jy-btn--ghost jy-btn--s" onClick={() => { setT(x.template); setDocId(x.id); setErrs([]); }}>Open template</button></li>))}</ul>
          : <p class="jy-empty">No templates yet. Paste one below.</p>}
      </section>
      <section class="jy-section jy-form" aria-labelledby="imp-h"><h2 id="imp-h" class="jy-h2">Import</h2>
        <label class="jy-field jy-field--wide"><span class="jy-field__label">Template JSON</span>
          <textarea class="jy-field__input jy-mono" rows={6} value={raw} onInput={(e) => setRaw(e.target.value)} aria-describedby="imp-err" /></label>
        <div class="jy-actions"><button class="jy-btn jy-btn--ghost" onClick={() => load(raw)}>Check template</button>
          <label class="jy-btn jy-btn--ghost">Upload JSON file<input class="jy-sr" type="file" accept=".json,application/json" onChange={(e) => e.target.files[0]?.text().then(load)} /></label></div>
        <ul id="imp-err" class="jy-error" role="alert">{errs.map((e) => <li key={e}>{e}</li>)}</ul>
      </section>
      {t && (
        <section class="jy-section" aria-labelledby="tree-h">
          <h2 id="tree-h" class="jy-h2">{t.templateName} <span class="jy-caption">{t.items.length} items. Numbers are days from the event; empty means no due date.</span></h2>
          {t.questions?.length > 0 && <div class="jy-well"><b>Questions from the AI</b>{t.questions.map((q) => <p key={q}>{q}</p>)}</div>}
          <ul class="jy-org">{t.items.filter((x) => x.parentKey == null).map((it) => <Node key={it.key} t={t} it={it} setT={setT} />)}</ul>
          <ul class="jy-error" role="alert">{check.map((e) => <li key={e}>{e}</li>)}</ul>
          <div class="jy-actions">
            <button class="jy-btn jy-btn--ghost" disabled={busy || check.length > 0} onClick={save}>Save template</button>
            <button class="jy-btn jy-btn--ghost" onClick={() => download(`${t.templateName.replace(/\W+/g, '-').toLowerCase()}.json`, JSON.stringify(t, null, 2))}>Export JSON</button>
            {docId && <button class="jy-btn jy-btn--ghost" onClick={() => putDoc(`templates/${docId}`, { archived: true }, 'Template archived.').then(() => setT(null))}>Archive template</button>}
          </div>
          <div class="jy-form jy-panel">
            <label class="jy-field"><span class="jy-field__label">Event date</span><input class="jy-field__input" type="date" value={event} onInput={(e) => setEvent(e.target.value)} /></label>
            <button class="jy-btn" disabled={busy || check.length > 0 || !event} onClick={start}>Start project from template</button>
          </div>
        </section>
      )}
    </>
  );
}
