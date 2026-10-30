// Committees: people grouped by section, the org chart from reports-to, and the team chart of one project.
// Tapping a person opens their page: weekly status, check-in answers, open and done tasks.
import { useState } from 'preact/hooks';
import { S, memberName } from '../store.js';
import { activeMembers, checksIn, personStatus, roleName, tree } from '../model.js';
import { Badge, Chip, Empty, Panel, TaskList, Title } from '../ui.jsx';
import { TeamChart } from './views.jsx';

const PersonLink = ({ m, lead }) => (
  <a class="fl-person" href={`#/people/${encodeURIComponent(m.id)}`}><Chip email={m.id} lead={lead} /><span>{m.name}<small> · {roleName(m.role)}</small></span></a>
);

function Org() {
  const members = activeMembers(), ids = new Set(members.map((m) => m.id));
  const node = (m, seen) => {
    const reports = members.filter((x) => x.reportsTo === m.id && !seen.has(x.id));
    return (
      <li key={m.id}><PersonLink m={m} lead={reports.length > 0} />
        {reports.length > 0 && <ul>{reports.map((r) => node(r, new Set([...seen, m.id])))}</ul>}</li>
    );
  };
  // A root has no active manager, or sits in a reportsTo loop (walking up returns to itself).
  const loops = (m) => { let x = m; for (let i = 0; i < members.length; i++) { x = members.find((y) => y.id === x.reportsTo); if (!x) return false; if (x.id === m.id) return true; } return false; };
  const roots = members.filter((m) => !m.reportsTo || !ids.has(m.reportsTo) || loops(m));
  return <ul class="fl-org">{roots.map((m) => node(m, new Set(roots.map((r) => r.id))))}</ul>;
}

export function People({ id }) {
  const { kids } = tree(), roots = kids.root || [];
  const busiest = [...roots].sort((a, b) => (kids[b.id] || []).filter((k) => k.kind === 'team').length - (kids[a.id] || []).filter((k) => k.kind === 'team').length)[0];
  const [team, setTeam] = useState(busiest?.id || '');
  if (id) return <Person email={id} />;
  const members = activeMembers(), sections = {};
  for (const m of members) (sections[m.section || 'No section'] ||= []).push(m);
  return (
    <>
      <Title light="Committees." bold={`${members.length} people.`} title="Committees" />
      <div class="fl-grid">
        {Object.entries(sections).sort(([a], [b]) => a.localeCompare(b)).map(([name, list]) => (
          <Panel key={name} title={name} id={`sec-${name.replace(/\W+/g, '-')}`}>
            <ul class="fl-list">{list.map((m) => {
              const s = checksIn(m) && personStatus(m.id);
              return <li key={m.id} class="fl-member"><PersonLink m={m} />{s && <Badge s={s} />}</li>;
            })}</ul>
          </Panel>
        ))}
      </div>
      <Panel title="Org chart" id="org-h"><Org /></Panel>
      <Panel title="Team chart" id="team-h" link={roots.length > 1 && (
        <label class="fl-field"><span class="fl-sr">Project</span>
          <select class="fl-input" value={team} onChange={(e) => setTeam(e.target.value)}>{roots.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>)}>
        {tree().byId[team] ? <TeamChart root={tree().byId[team]} /> : <Empty>No projects yet, so there is no team chart.</Empty>}
      </Panel>
    </>
  );
}

function Person({ email }) {
  const m = S.members.find((x) => x.id === email);
  if (!m) return <><Title light="Not found." bold="No such member" /><a class="fl-link" href="#/committees">Go to Committees</a></>;
  const s = personStatus(email), mine = S.items.filter((t) => t.kind === 'task' && t.assigneeUids.includes(email));
  const open = mine.filter((t) => t.status !== 'done'), done = mine.filter((t) => t.status === 'done');
  return (
    <>
      <nav class="fl-crumbs" aria-label="Breadcrumb"><a href="#/committees">Committees</a><span aria-hidden="true">/</span><span aria-current="page">{m.name}</span></nav>
      <Title light={`${roleName(m.role)}.`} bold={m.name} title={m.name} />
      <div class="fl-stats"><Chip email={email} big />{m.section && <span>{m.section}</span>}{m.reportsTo && <span class="fl-muted">Reports to {memberName(m.reportsTo)}</span>}{checksIn(m) && <Badge s={s} />}</div>
      {checksIn(m) && (
        <Panel title="This week" id="week-h">
          <p>{s.line}</p>
          {s.ci ? <dl class="fl-dl">{['done', 'doing', 'blocked'].map((k) => s.ci[k] && <div key={k}><dt class="fl-eyebrow">{k}</dt><dd class="fl-pre">"{s.ci[k]}"</dd></div>)}</dl>
            : <p class="fl-muted">No check-in yet this week.</p>}
        </Panel>
      )}
      <Panel title="Open tasks" id="open-h"><TaskList list={open} path empty="No open tasks." /></Panel>
      <Panel title="Done" id="done-h"><TaskList list={done} path empty="Nothing done yet this term." /></Panel>
    </>
  );
}
