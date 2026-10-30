// Admin view screens for the advisor, president and VP: Overview (needs attention only), Announcements,
// Public site and Approvals and archive. Submissions load only here, never in a member's session.
import { useEffect, useState } from 'preact/hooks';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName, toast } from '../store.js';
import { activeMembers, checksIn, googleUrl, roleName, tree } from '../model.js';
import { addTemplate, archiveAnnouncement, archiveTemplate, decide, saveAnnouncement, updateItem } from '../actions.js';
import { localFeedHash, publish } from '../publish.js';
import { addDays, fmtDay, isoDay, week } from '../time.js';
import { ago, dateRange } from '../feed.js';
import { Icon, PublicProject } from '../shared.jsx';
import { Chip, Empty, Panel, Title, useAutofocus } from '../ui.jsx';
import { wa } from './projects.jsx';
import { SUB_STATUS, SUB_TYPE } from './resources.jsx';

const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
function useQuery(make, deps = []) {
  const [list, setList] = useState(null);
  useEffect(() => onSnapshot(make(), (s) => setList(rows(s)), () => setList(false)), deps);
  return list;
}
const usePending = () => useQuery(() => query(collection(db, 'submissions'), where('status', '==', 'pending')));

const Attention = ({ icon, title, children, link }) => (
  <div class="fl-row fl-row--attn"><span class="fl-iconbtn" aria-hidden="true"><Icon n={icon} /></span>
    <div><div class="fl-h3">{title}</div>{children}</div>{link}</div>
);

export function Overview({ nav }) {
  const pending = usePending(), today = isoDay(), w = week();
  const ending = S.announcements.filter((a) => !a.archived && a.startDate <= today && a.endDate <= addDays(today, 3));
  const missing = activeMembers().filter(checksIn).filter((m) => !S.checkins.some((c) => c.uid === m.id && c.weekId === w.id));
  const reminder = `Hi ${missing.map((m) => m.name.split(' ')[0]).join(', ')}: this week's council check-in is due ${fmtDay(w.due)}, 23:59. Three answers, under a minute: ${location.origin}/app/#/checkin`;
  const unpublished = S.ready.feed && localFeedHash() !== S.feed?.hash;
  const admins = S.members.filter((m) => m.active && ['advisor', 'president', 'vp'].includes(m.role));
  const copy = () => navigator.clipboard.writeText(reminder).then(() => toast('Reminder copied. Paste it into the chat.'), () => toast('Copy failed. Use Share to WhatsApp instead.'));
  return (
    <>
      <Title light="Admin." bold="Needs attention." title="Admin overview" />
      <nav class="fl-more fl-phone-only" aria-label="Admin sections">{nav.slice(1).map(([k, label, icon]) => <a key={k} href={`#/${k}`}><Icon n={icon} />{label}</a>)}</nav>
      <section class="fl-panel" aria-label="Needs attention">
        {missing.length > 0 && (
          <Attention icon="check" title={`${missing.length} missing this week's check-in`} link={<span class="fl-actions">
            <button class="fl-btn fl-btn--red fl-btn--sm" onClick={copy}><Icon n="copy" />Copy reminder</button>
            <a class="fl-btn fl-btn--ghost fl-btn--sm" href={wa(reminder)} target="_blank" rel="noopener noreferrer"><Icon n="share" />WhatsApp</a></span>}>
            <p class="fl-small fl-muted">{missing.map((m) => m.name).join(', ')} · due {fmtDay(w.due)}, 23:59</p>
          </Attention>
        )}
        {pending === false ? <p class="fl-error" role="alert">Pending submissions did not load.</p> : pending?.length > 0 && (
          <Attention icon="inbox" title={`${pending.length} ${pending.length === 1 ? 'submission waits' : 'submissions wait'} for approval`}
            link={<a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/admin/approvals">Review</a>}>
            <p class="fl-small fl-muted">{pending.slice(0, 3).map((x) => x.name).join(', ')}{pending.length > 3 ? ' and more' : ''}</p>
          </Attention>
        )}
        {ending.map((a) => (
          <Attention key={a.id} icon="megaphone" title={`"${a.title}" ends ${fmtDay(a.endDate)}`} link={<a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/admin/announcements">Edit</a>}>
            <p class="fl-small fl-muted">{a.audience === 'everyone' ? 'Everyone, also on the public website' : 'Members only'}</p>
          </Attention>
        ))}
        {(unpublished || S.publishError) && (
          <Attention icon="globe" title={S.publishError ? 'The public site did not update' : 'The public site has changes not published yet'}
            link={<a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/admin/public">Open</a>}>
            <p class="fl-small fl-muted">{S.publishError ? `Last attempt failed (${S.publishError}). Publish now to retry.` : 'It updates on its own within 10 minutes while an admin has the app open.'}</p>
          </Attention>
        )}
        {S.cacheFull && (
          <Attention icon="archive" title="The item cache is full">
            <p class="fl-small fl-muted">Archive finished projects so members open the app with one read again.</p>
          </Attention>
        )}
        {!missing.length && !pending?.length && !ending.length && !unpublished && !S.publishError && !S.cacheFull && pending !== null && <p class="fl-muted">Nothing needs you right now.</p>}
      </section>
      <Panel title="Who has admin" id="admins-h" link={<a class="fl-link fl-small" href="#/admin/members">Members and roles</a>}>
        <ul class="fl-list">{admins.map((m) => <li key={m.id}><span class="fl-person"><Chip email={m.id} /><span>{m.name}<small> · {roleName(m.role)}</small></span></span></li>)}</ul>
      </Panel>
    </>
  );
}

// ---- Announcements

function AnnouncementForm({ a, done }) {
  const today = isoDay();
  const [v, setV] = useState(a ? { ...a } : { title: '', body: '', audience: 'members', startDate: today, endDate: addDays(today, 7) });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), ref = useAutofocus();
  const on = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!v.title.trim()) return setErr('Add a title, then post.');
    if (!v.startDate || !v.endDate) return setErr('Add a start and an end date.');
    if (v.endDate < v.startDate) return setErr('The end date is before the start date. Change one of them.');
    setErr(''); setBusy(true);
    const ok = await saveAnnouncement(a, { title: v.title.trim().slice(0, 80), body: v.body.trim().slice(0, 2000), audience: v.audience, startDate: v.startDate, endDate: v.endDate });
    setBusy(false);
    if (ok) done();
  };
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">{a ? 'Edit announcement' : 'New announcement'}</h2>
      <div class="fl-field"><label for="an-title">Title</label><input id="an-title" class="fl-input" maxLength={80} value={v.title} onInput={on('title')} /></div>
      <div class="fl-field"><label for="an-body">Text</label><textarea id="an-body" class="fl-input" rows={5} maxLength={2000} value={v.body} onInput={on('body')} />
        <span class="fl-help">{2000 - v.body.length} characters left. A blank line starts a new paragraph.</span></div>
      <fieldset class="fl-fieldset"><legend>Who sees it</legend>
        <label class="fl-checkrow"><input type="radio" name="aud" checked={v.audience === 'everyone'} onChange={() => setV({ ...v, audience: 'everyone' })} />Everyone (also shown on the public website)</label>
        <label class="fl-checkrow"><input type="radio" name="aud" checked={v.audience === 'members'} onChange={() => setV({ ...v, audience: 'members' })} />Members only</label>
      </fieldset>
      <div class="fl-fields">
        <div class="fl-field"><label for="an-start">Show from</label><input id="an-start" class="fl-input" type="date" value={v.startDate} onInput={on('startDate')} /></div>
        <div class="fl-field"><label for="an-end">Until</label><input id="an-end" class="fl-input" type="date" value={v.endDate} onInput={on('endDate')} /></div>
      </div>
      <p class="fl-error" role="alert">{err}</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy}>{a ? 'Save announcement' : 'Post announcement'}</button><button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </form>
  );
}

export function Announcements() {
  const [form, setForm] = useState(null), today = isoDay();
  const list = S.announcements.filter((a) => !a.archived).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <>
      <Title light="Announcements." bold="Say it once." title="Announcements">
        {!form && <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm({})}><Icon n="plus" />New announcement</button>}
      </Title>
      {form && <AnnouncementForm a={form.a} done={() => setForm(null)} />}
      <p class="fl-muted fl-measure">Members see at most three at a time on Home, newest first, from the start date to the end date. Everyone-audience announcements also appear on the public website.</p>
      <Panel title="Live and scheduled" id="ann-list-h">
        {S.fail.announcements ? <p class="fl-error" role="alert">Announcements did not load.</p> : list.length ? <div class="fl-list">{list.map((a) => (
          <div key={a.id} class="fl-row fl-row--doc">
            <span class={`fl-badge fl-badge--${a.startDate <= today ? 'ok' : 'warn'}`}>{a.startDate <= today ? 'Live' : 'Scheduled'}</span>
            <div><div class="fl-h3">{a.title}</div><div class="fl-caption">{dateRange(a.startDate, a.endDate)} · {a.audience === 'everyone' ? 'Everyone and the public website' : 'Members only'}</div></div>
            <span class="fl-actions"><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm({ a })} aria-label={`Edit ${a.title}`}>Edit</button>
              <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => confirm(`Archive "${a.title}"? It stops showing everywhere.`) && archiveAnnouncement(a)} aria-label={`Archive ${a.title}`}>Archive</button></span>
          </div>))}</div> : <Empty>No announcements running. Post one to show it on Home.</Empty>}
      </Panel>
    </>
  );
}

// ---- Public site

function Blurb({ r }) {
  const [v, setV] = useState(r.publicBlurb || ''), dirty = v !== (r.publicBlurb || '');
  return (
    <div class="fl-field"><label for={`blurb-${r.id}`}>One line for the public site</label>
      <div class="fl-actions"><input id={`blurb-${r.id}`} class="fl-input fl-grow" maxLength={140} value={v} onInput={(e) => setV(e.target.value)} placeholder="What it is, for visitors" />
        <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={!dirty} onClick={() => updateItem(r, { publicBlurb: v.trim() }, 'changed the public line of').then((ok) => ok && toast('Public line saved.'))}>Save</button></div>
    </div>
  );
}

export function PublicSite() {
  const roots = tree().kids.root || [], [busy, setBusy] = useState(false);
  let preview = null;
  try { preview = JSON.parse(S.feed?.json || 'null'); } catch { /* a damaged feed shows no preview */ }
  const go = async () => { setBusy(true); toast((await publish(true)) ? 'Published. The public site shows it now.' : `Publish failed${S.publishError ? ` (${S.publishError})` : ''}. Try again.`); setBusy(false); };
  return (
    <>
      <Title light="Public site." bold="What visitors see." title="Public site">
        <a class="fl-btn fl-btn--ghost fl-btn--sm" href="/" target="_blank" rel="noopener"><Icon n="ext" />Open the public site</a>
        <button class="fl-btn fl-btn--red fl-btn--sm" disabled={busy} onClick={go}><Icon n="globe" />Publish now</button>
      </Title>
      <p class="fl-muted fl-measure">
        {S.feed ? `Last published ${ago(S.feed.updatedAt)}.` : 'Not published yet.'} Changes publish on their own within 10 minutes while an admin has the app open. Only project titles, stage, progress and the line below go out; never names, tasks or comments.
      </p>
      <Panel title="Projects" id="pub-proj-h">
        {roots.length ? <div class="fl-list">{roots.map((r) => (
          <div key={r.id} class="fl-proj">
            <div><a class="fl-h3" href={`#/p/${r.id}`}>{r.title}</a>
              <label class="fl-checkrow fl-small"><input type="checkbox" class="fl-switch" checked={r.public === true} onChange={() => updateItem(r, { public: !r.public }, r.public ? 'made private' : 'made public')} />Public</label></div>
            {r.public && <Blurb r={r} />}
          </div>))}</div> : <Empty>No projects yet.</Empty>}
      </Panel>
      <Panel title="Preview of the live section" id="pub-prev-h">
        {preview?.projects?.length ? <div class="fl-grid">{preview.projects.map((p) => <PublicProject key={p.title} p={p} />)}</div> : <Empty>No public projects in the last publish.</Empty>}
        {preview && <p class="fl-small fl-muted">{preview.events.length} public {preview.events.length === 1 ? 'event' : 'events'} and {preview.announcements.length} public {preview.announcements.length === 1 ? 'announcement' : 'announcements'} in the last publish. Make an event public from its edit form in the calendar.</p>}
      </Panel>
    </>
  );
}

// ---- Approvals and the handover archive

function AddTemplate({ done }) {
  const [v, setV] = useState({ name: '', url: '' }), [err, setErr] = useState(''), ref = useAutofocus();
  const submit = async (e) => {
    e.preventDefault();
    if (!v.name.trim()) return setErr('Add a name.');
    if (!googleUrl(v.url.trim())) return setErr('Paste a Google Docs, Sheets, Slides, Forms or Drive link.');
    if (await addTemplate({ name: v.name.trim().slice(0, 80), url: v.url.trim() })) done();
  };
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">Add a template</h2>
      <div class="fl-fields">
        <div class="fl-field"><label for="tp-name">Name</label><input id="tp-name" class="fl-input" maxLength={80} value={v.name} onInput={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div class="fl-field"><label for="tp-url">Google link</label><input id="tp-url" class="fl-input" type="url" value={v.url} onInput={(e) => setV({ ...v, url: e.target.value })} placeholder="https://docs.google.com/..." /></div>
      </div>
      <p class="fl-error" role="alert">{err}</p>
      <div class="fl-actions"><button class="fl-btn fl-btn--red">Add template</button><button type="button" class="fl-btn fl-btn--ghost" onClick={done}>Cancel</button></div>
    </form>
  );
}

export function Approvals() {
  const pending = usePending(), [adding, setAdding] = useState(false);
  const archive = useQuery(() => query(collection(db, 'submissions'), where('type', '==', 'archive'), orderBy('createdAt', 'desc'), limit(50)));
  const target = (x) => S.docTemplates.find((t) => t.id === x.targetId);
  return (
    <>
      <Title light="Approvals." bold="And the archive." title="Approvals and archive">
        {!adding && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setAdding(true)}><Icon n="plus" />Add a template</button>}
      </Title>
      {adding && <AddTemplate done={() => setAdding(false)} />}
      <Panel title="Waiting for approval" id="pend-h">
        {pending === null ? <p class="fl-muted" role="status">Loading.</p> : pending === false ? <p class="fl-error" role="alert">Submissions did not load.</p>
          : pending.length ? <div class="fl-list">{pending.sort((a, b) => a.createdAt - b.createdAt).map((x) => (
            <div key={x.id} class="fl-row fl-row--doc">
              <span class="fl-tag">{SUB_TYPE[x.type]}</span>
              <div><a class="fl-h3" href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a>
                <div class="fl-caption">From {memberName(x.byUid)} · {fmtDay(isoDay(x.createdAt))}{x.type === 'template-edit' && ` · replaces ${target(x)?.name || 'a template that no longer exists'}`}</div>
                {x.note && <p class="fl-small fl-muted fl-pre">{x.note}</p>}</div>
              <span class="fl-actions">
                <button class="fl-btn fl-btn--red fl-btn--sm" disabled={x.type === 'template-edit' && !target(x)} onClick={() => decide(x, 'approved')} aria-label={`Approve ${x.name}`}>Approve</button>
                <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => decide(x, 'rejected')} aria-label={`Reject ${x.name}`}>Reject</button></span>
            </div>))}</div> : <Empty>Nothing waits for approval.</Empty>}
      </Panel>
      <Panel title="Document templates" id="tpl-h">
        {S.docTemplates.length ? <div class="fl-list">{[...S.docTemplates].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
          <div key={t.id} class="fl-row fl-row--doc"><span class="fl-tag">{t.kind}</span>
            <div><a class="fl-h3" href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a><div class="fl-caption fl-mono">Version {t.version}</div></div>
            <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => confirm(`Archive "${t.name}"? Members stop seeing it.`) && archiveTemplate(t)} aria-label={`Archive ${t.name}`}>Archive</button></div>))}</div>
          : <Empty>No templates yet.</Empty>}
      </Panel>
      <Panel title="Handover archive" id="arch-h">
        {archive === null ? <p class="fl-muted" role="status">Loading.</p> : archive === false ? <p class="fl-error" role="alert">The archive did not load.</p>
          : archive.length ? <div class="fl-list">{archive.map((x) => (
            <div key={x.id} class="fl-row fl-row--doc"><span class={`fl-badge fl-badge--${SUB_STATUS[x.status][0]}`}>{SUB_STATUS[x.status][1]}</span>
              <div><a class="fl-h3" href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a>
                <div class="fl-caption">{x.projectId ? `${tree().byId[x.projectId]?.title || 'A past project'} · ` : ''}{memberName(x.byUid)} · {fmtDay(isoDay(x.createdAt))}</div></div><span /></div>))}</div>
          : <Empty>The archive is empty. Members file reports and final documents from Resources.</Empty>}
      </Panel>
    </>
  );
}
