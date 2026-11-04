// My department: who is in it, what it has coming up and its open tasks. Its two officers add and remove members here.
import { useState } from 'preact/hooks';
import { S } from '../store.js';
import { isAdmin, taskState } from '../model.js';
import { deptMembers, placeOf, positionName } from '../org.js';
import { leadSetMembers } from '../org-actions.js';
import { fmtDay, isoDay } from '../time.js';
import { Chip, Empty, Panel, TaskList, Title } from '../ui.jsx';
import { EventTag } from './home.jsx';
import { PeoplePicker } from './people.jsx';

export function Department({ id }) {
  const mine = placeOf(S.me.id), d = id ? S.departments.find((x) => x.id === id) : mine.dept;
  const [adding, setAdding] = useState(false);
  if (!d) return (
    <><Title light="My department." bold="Not placed yet." title="My department" />
      <Empty>You are not in a department yet. The president or vice president places members from Committees.</Empty>
      <p><a class="fl-link" href="#/committees">Open Committees</a></p></>
  );
  const uids = deptMembers(d), today = isoDay(), lead = S.me.id === d.jcLeadUid || S.me.id === d.secLeadUid;
  const events = S.events.filter((e) => !e.archived && e.date >= today && (e.participantSelection?.departmentIds?.includes(d.id) || (e.participantUids || []).some((u) => uids.includes(u))))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).slice(0, 5);
  const tasks = S.items.filter((t) => t.kind === 'task' && t.status !== 'done' && t.assigneeUids?.some((u) => uids.includes(u))).sort((a, b) => taskState(b).rank - taskState(a).rank).slice(0, 8);
  const row = (uid) => {
    const m = S.members.find((x) => x.id === uid), pos = uid === d.jcLeadUid ? 'jc_officer' : uid === d.secLeadUid ? 'sec_officer' : 'member';
    return m && (
      <li key={uid} class="fl-member">
        <a class="fl-person" href={`#/people/${encodeURIComponent(uid)}`}><Chip email={uid} lead={pos !== 'member'} /><span>{m.name}<small> · {positionName(pos)}{m.section ? `, ${m.section}` : ''}</small></span></a>
        {lead && pos === 'member' && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => confirm(`Remove ${m.name} from ${d.name}? They keep their account and tasks.`) && leadSetMembers(d, [], [uid])}>Remove</button>}
      </li>
    );
  };
  return (
    <>
      <nav class="fl-crumbs" aria-label="Breadcrumb"><a href="#/home">Home</a><span aria-hidden="true">/</span><span aria-current="page">{d.name}</span></nav>
      <Title light={id && id !== mine.dept?.id ? 'Department.' : 'My department.'} bold={d.name} title={d.name}>
        {(lead || isAdmin()) && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setAdding(true)}>Add members</button>}
      </Title>
      {adding && (
        <PeoplePicker title={`Add members to ${d.name}`} onClose={() => setAdding(false)}
          pool={S.members.filter((m) => m.active && !uids.includes(m.id) && m.role !== 'teacher' && (isAdmin() || !placeOf(m.id).dept))}
          note={isAdmin() ? null : 'You can add people who are not in a department yet. To move someone from another department, ask the president or vice president.'}
          onPick={async (picked) => { if (await leadSetMembers(d, picked, [])) setAdding(false); }} />
      )}
      <div class="fl-split">
        <Panel title="People" id="dept-people" link={<span class="fl-small fl-muted">{uids.length} in {d.name}</span>}>
          <ul class="fl-list">{[d.jcLeadUid, d.secLeadUid].filter(Boolean).map(row)}{(d.memberUids || []).map(row)}</ul>
          {!uids.length && <Empty>Nobody is in this department yet.</Empty>}
        </Panel>
        <div class="fl-stack">
          <Panel title="Coming up" id="dept-events" link={<a class="fl-link fl-small" href="#/calendar">Calendar</a>}>
            {events.length ? <ul class="fl-list">{events.map((e) => (
              <li key={e.id}><a class="fl-row" href={`#/calendar?v=week&d=${e.date}&e=${e.id}`}>
                <span class="fl-mono fl-small">{fmtDay(e.date)}</span><div><div class="fl-h3">{e.title}</div><div class="fl-caption">{e.allDay ? 'All day' : `${e.start} to ${e.end}`}{e.location ? ` · ${e.location}` : ''}</div></div><EventTag type={e.type} /></a></li>
            ))}</ul> : <Empty>Nothing planned for {d.name}. Invite the department when you add an event.</Empty>}
          </Panel>
          <Panel title="Open tasks" id="dept-tasks"><TaskList list={tasks} path empty={`No open tasks for ${d.name}.`} /></Panel>
        </div>
      </div>
    </>
  );
}
