// Home: what needs you this week, today's agenda, the check-in and your projects. Length budget: about 1.5 laptop
// screens and 5 phone screens, lists capped at 5 rows, no stat rows (design/fiatlux/DESIGN.md).
import { useEffect, useState } from 'preact/hooks';
import { S } from '../store.js';
import { checksIn, isMine, progress, taskState, tree } from '../model.js';
import { fmtDay, isoDay, jktHour, week } from '../time.js';
import { activeAnnouncements } from '../feed.js';
import { Announcements, Mission } from '../shared.jsx';
import { Bar, Empty, FilterBar, Panel, TaskList, Title, pct, useFilter } from '../ui.jsx';
import { TopIdeas, useIdeas } from './ideas.jsx';
import { placeOf } from '../org.js';
import { Icon } from '../shared.jsx';
import sunset from '../../design/fiatlux/img/campus-sunset.webp';
import building from '../../design/fiatlux/img/building.webp';

const TYPE_TAG = { meeting: ['fl-tag--meeting', 'Meeting'], committee: ['fl-tag--committee', 'Committee'], project: ['', 'Project'], other: ['', 'Other'] };
export const EventTag = ({ type }) => <span class={`fl-tag ${TYPE_TAG[type]?.[0] || ''}`}>{TYPE_TAG[type]?.[1] || type}</span>;

// Mine and not done, due by the end of this week (overdue included), plus anything blocked on me; worst first.
export function needsYou(w = week()) {
  const open = S.items.filter((t) => t.kind === 'task' && t.status !== 'done');
  const due = open.filter((t) => isMine(t) && t.dueDate && t.dueDate <= w.end);
  const blocked = open.filter((t) => t.blocked && t.blockedOnUid === S.me.id && !due.includes(t));
  return { due, list: [...due, ...blocked].sort((a, b) => taskState(b).rank - taskState(a).rank || (a.dueDate || '9').localeCompare(b.dueDate || '9')) };
}

// Root projects where I hold a task or lead something, soonest first.
function myProjects() {
  const { kids, under } = tree();
  return (kids.root || []).filter((r) => under(r.id).some(isMine) || r.leadUids?.includes(S.me.id)
    || (kids[r.id] || []).some((k) => k.leadUid === S.me.id)).slice(0, 3);
}

// Subteams as steps: done when every task in it is done; the first unfinished one is "now". At most 5, then +n.
export function Steps({ root }) {
  const { kids, under } = tree(), teams = (kids[root.id] || []).filter((k) => k.kind !== 'task');
  if (!teams.length) { const p = progress(under(root.id)); return <Bar done={p.done} total={p.total} label={`${root.title} progress`} />; }
  const done = (t) => { const l = under(t.id); return l.length > 0 && l.every((x) => x.status === 'done'); };
  const now = teams.find((t) => !done(t));
  return (
    <div class="fl-steps" role="list" aria-label={`${root.title} subteams`}>
      {teams.slice(0, 5).map((t) => <span key={t.id} role="listitem" class={done(t) ? 'is-done' : t === now ? 'is-now' : ''}>{t.title}<span class="fl-sr">{done(t) ? ', done' : t === now ? ', in progress' : ''}</span></span>)}
      {teams.length > 5 && <span class="fl-more">+{teams.length - 5}</span>}
    </div>
  );
}

const greeting = (h = jktHour()) => (h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,');
const longDate = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });
const plural = (n, word) => `${n || 'No'} ${word}${n === 1 ? '' : 's'}`;

function useWide() {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 900px)').matches);
  useEffect(() => { const m = matchMedia('(min-width: 900px)'), f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return wide;
}

export function Home() {
  const w = week(), today = isoDay(), wide = useWide();
  const { due, list } = needsYou(w);
  const ci = S.checkins.find((c) => c.uid === S.me.id && c.weekId === w.id), late = today > w.due;
  const showCheckin = checksIn(S.me) && !ci;
  const anns = activeAnnouncements(S.announcements, today);
  const agenda = S.events.filter((e) => e.date === today && (!e.requestState || e.requestState === 'scheduled') && (!e.state || e.state === 'scheduled')).sort((a, b) => a.start.localeCompare(b.start));
  const projects = myProjects(), place = placeOf(S.me.id), ideas = useIdeas();
  const calm = !list.length && !agenda.length && (!wide || (ideas && !ideas.length));
  const checkinPanel = showCheckin && (
    <section class="fl-panel fl-panel--red" aria-labelledby="ci-h">
      <span class="fl-eyebrow">Weekly check-in · {late ? 'was due' : 'due'} {fmtDay(w.due)}</span>
      <h2 id="ci-h">Three answers. <span class="fl-light">Under a minute.</span></h2>
      <a class="fl-btn fl-btn--white" href="#/checkin">{late ? 'Check in now' : 'Start check-in'}</a>
    </section>
  );
  return (
    <>
      <section class="fl-hero fl-hero--short fl-stage" aria-labelledby="hello-h">
        <img class="fl-hero__img" src={sunset} alt="" />
        <div class="fl-hero__body">
          <span class="fl-eyebrow">{longDate()}</span>
          <Title light={greeting()} bold={`${S.me.name.split(' ')[0]}.`} title="Home" />
          <p class="fl-muted">
            {place.dept && <><a class="fl-link" href="#/department">{place.dept.name}</a> · </>}{plural(due.length, 'task')} this week
            {checksIn(S.me) && (ci ? <> · Checked in for {w.id.slice(5)} · <a class="fl-link" href="#/checkin">Edit check-in</a></>
              : ` · check-in ${late ? 'was due' : 'closes'} ${late ? fmtDay(w.due) : 'Friday'}`)}
          </p>
        </div>
      </section>
      {!wide && checkinPanel}
      <FirstRun dept={place.dept} />
      <Announcements list={anns} />
      {calm && <p class="fl-calm">Nothing needs you today. <a class="fl-link" href="#/calendar?v=week">See what is coming up in the calendar</a>, or <a class="fl-link" href="#/tasks">all my tasks</a>.</p>}
      <div class="fl-split">
        <div class="fl-stack">
          {list.length > 0 && <Panel title="Needs you" id="needs-h" link={<a class="fl-link fl-small" href="#/tasks">All my tasks</a>}>
            <TaskList list={list.slice(0, 5)} path />
            {list.length > 5 && <a class="fl-link fl-small" href="#/tasks">{list.length - 5} more in All my tasks</a>}
          </Panel>}
          {agenda.length > 0 && <Panel title="Today's agenda" id="agenda-h" link={<a class="fl-link fl-small" href="#/calendar?v=week">Calendar</a>}>
            {agenda.slice(0, 5).map((e) => (
              <a key={e.id} class="fl-row" href={`#/calendar?v=week&d=${e.date}&e=${e.id}`}>
                <span class="fl-row__time fl-mono">{e.allDay ? 'All day' : e.start}</span>
                <div><div class="fl-h3">{e.title}</div><div class="fl-caption">{e.location || 'No place set'}</div></div>
                <EventTag type={e.type} />
              </a>
            ))}
          </Panel>}
          {!calm && !list.length && !agenda.length && <p class="fl-calm">Nothing due from you this week and nothing on today. <a class="fl-link" href="#/calendar?v=week">Calendar</a></p>}
        </div>
        <div class="fl-stack">
          {wide && checkinPanel}
          <Panel title="My projects" id="mine-h" link={<a class="fl-link fl-small" href="#/projects">Projects</a>}>
            {projects.length ? projects.map((r) => (
              <div key={r.id} class="fl-proj">
                <div><a class="fl-h3" href={`#/p/${r.id}`}>{r.title}</a><span class="fl-mono fl-small">{pct(progress(tree().under(r.id)))}%</span></div>
                <Steps root={r} />
              </div>
            )) : <Empty>{checksIn(S.me) ? 'You are not on a project yet. Ask a lead to add you to a task.' : 'Projects you lead or hold tasks in show here. Projects has every project.'}</Empty>}
          </Panel>
          {!(anns.length === 1 && showCheckin) && <Mission img={building} extra="fl-desk-only" />}
        </div>
      </div>
      {wide && <TopIdeas list={ideas} />}
    </>
  );
}

// First run: three steps for a new member. Dismissed once, it never returns on this device.
const seen = (k) => { try { return localStorage.getItem(`council-firstrun-${k}`) === '1'; } catch { return false; } };
export const markSeen = (k) => { try { localStorage.setItem(`council-firstrun-${k}`, '1'); } catch { /* storage blocked */ } };
function FirstRun({ dept }) {
  const [gone, setGone] = useState(() => seen('dismissed'));
  if (gone || !checksIn(S.me)) return null;
  const steps = [
    ['dept', dept ? `Check your department, ${dept.name}` : 'Check which department you are in', dept ? '#/department' : '#/committees', seen('dept')],
    ['checkin', 'Do your first check-in', '#/checkin', S.checkins.some((c) => c.uid === S.me.id)],
    ['calendar', 'Open the calendar and add it to your week', '#/calendar?v=week', seen('calendar')],
  ];
  if (steps.every((x) => x[3])) return null;
  const close = () => { markSeen('dismissed'); setGone(true); };
  return (
    <section class="fl-panel" aria-labelledby="fr-h">
      <div class="fl-panel__head"><h2 id="fr-h" class="fl-h2">Get started</h2><button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={close}>Dismiss</button></div>
      <ol class="fl-checklist">{steps.map(([k, label, href, done]) => (
        <li key={k}><span class={`fl-tick${done ? ' is-on' : ''}`} aria-hidden="true">{done && <Icon n="check" />}</span>
          <a class={`fl-link${done ? ' is-done' : ''}`} href={href} onClick={() => markSeen(k)}>{label}</a><span class="fl-sr">{done ? ', done' : ''}</span></li>
      ))}</ol>
    </section>
  );
}

export function AllTasks() {
  const [f, setF] = useFilter('week', 'mine');
  const tasks = S.items.filter((t) => t.kind === 'task');
  return (
    <>
      <Title light="All tasks." bold="Find anything." title="All my tasks" />
      <FilterBar list={tasks} f={f} set={setF} teams={S.items.filter((i) => i.kind === 'team' && tree().byId[i.id])} />
    </>
  );
}
