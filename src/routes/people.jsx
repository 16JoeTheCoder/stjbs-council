import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { S, memberName } from '../store.js';
import { activeMembers, checksIn, personStatus, roleLinks } from '../model.js';
import { Badge, Chip, TaskList, Title } from '../ui.jsx';

const ROLE = { advisor: 'Advisor', president: 'President', vp: 'Vice president', treasurer: 'Treasurer', secretary: 'Secretary', officer: 'Officer', teacher: 'Teacher' };
export const roleName = (r) => ROLE[r] || r;

function Org() {
  const members = activeMembers(), ids = new Set(members.map((m) => m.id));
  const node = (m, seen) => {
    const reports = members.filter((x) => x.reportsTo === m.id && !seen.has(x.id));
    return (
      <li key={m.id}><a href={`#/people/${m.id}`} class="jy-person-named"><Chip email={m.id} lead={reports.length > 0} /><span>{m.name} <span class="jy-caption">{roleName(m.role)}</span></span></a>
        {reports.length > 0 && <ul>{reports.map((r) => node(r, new Set([...seen, m.id])))}</ul>}</li>
    );
  };
  // A root has no active manager, or sits in a reportsTo loop (walking up returns to itself).
  const loops = (m) => { let x = m; for (let i = 0; i < members.length; i++) { x = members.find((y) => y.id === x.reportsTo); if (!x) return false; if (x.id === m.id) return true; } return false; };
  const roots = members.filter((m) => !m.reportsTo || !ids.has(m.reportsTo) || loops(m));
  return <ul class="jy-org">{roots.map((m) => node(m, new Set(roots.map((r) => r.id))))}</ul>;
}

export function People({ id }) {
  if (id) return <Person email={id} />;
  const members = activeMembers();
  return (
    <>
      <Title light="The council." bold={`${members.length} people.`} title="People" />
      <section aria-label="People list"><ul class="jy-list">{members.map((m) => {
        const s = personStatus(m.id);
        return (
          <li key={m.id} class="jy-task"><Chip email={m.id} />
            <span class="jy-task__body"><a class="jy-task__title" href={`#/people/${m.id}`}>{m.name}</a>
              <span class="jy-meta"><span>{roleName(m.role)}{m.section ? ` · ${m.section}` : ''}</span>{checksIn(m) && <Badge s={s} />}</span>
              {checksIn(m) && <span class="jy-caption">{s.line}</span>}</span></li>
        );
      })}</ul></section>
      <section class="jy-section" aria-labelledby="org-h"><h2 id="org-h" class="jy-h2">Org chart</h2><Org /></section>
    </>
  );
}

function Person({ email }) {
  const m = S.members.find((x) => x.id === email);
  if (!m) return <><Title light="Not found." bold="No such member" /><a href="#/people">Go to People</a></>;
  const s = personStatus(email), mine = S.items.filter((t) => t.kind === 'task' && t.assigneeUids.includes(email));
  const open = mine.filter((t) => t.status !== 'done'), done = mine.filter((t) => t.status === 'done');
  return (
    <>
      <Title light={`${roleName(m.role)}.`} bold={m.name} title={m.name} />
      <p class="jy-meta"><Chip email={email} big />{m.section && <span>{m.section}</span>}{m.reportsTo && <span>Reports to {memberName(m.reportsTo)}</span>}{checksIn(m) && <Badge s={s} />}</p>
      {checksIn(m) && <p class="jy-section">{s.line}</p>}
      {s.ci && <dl class="jy-section">{['done', 'doing', 'blocked'].map((k) => s.ci[k] && <div key={k}><dt class="jy-eyebrow">{k}</dt><dd class="jy-pre">"{s.ci[k]}"</dd></div>)}</dl>}
      <section class="jy-section" aria-labelledby="open-h"><h2 id="open-h" class="jy-h2">Open tasks</h2><TaskList list={open} path empty="No open tasks." /></section>
      <section class="jy-section" aria-labelledby="done-h"><h2 id="done-h" class="jy-h2">Done</h2><TaskList list={done} path empty="Nothing done yet this term." /></section>
      {email === S.me.id && <div class="jy-actions jy-section">{roleLinks().map(([k, label]) => <a key={k} class="jy-btn jy-btn--ghost" href={`#/${k}`}>Open {label.toLowerCase()}</a>)}<a class="jy-btn jy-btn--ghost" href="#/about">About this app</a><button class="jy-btn jy-btn--ghost" onClick={() => signOut(auth)}>Sign out</button></div>}
    </>
  );
}
