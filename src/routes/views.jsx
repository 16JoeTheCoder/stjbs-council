// Project views computed from data: timeline, team chart, export to the template schema.
import { memberName, toast } from '../store.js';
import { isMine, tree } from '../model.js';
import { addDays, daysBetween, isoDay, monday, weekId } from '../time.js';
import { Chip } from '../ui.jsx';

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const walk = (id, depth = 0, out = []) => {
  for (const x of tree().kids[id] || []) { out.push([x, depth]); walk(x.id, depth + 1, out); }
  return out;
};

export function Timeline({ root }) {
  const rows = walk(root.id), today = isoDay();
  // A bar starts at its start date, or at its due date when that comes first (overdue work).
  const start = (x) => [x.startDate || isoDay(x.createdAt), x.dueDate].sort()[0];
  const dated = rows.filter(([x]) => x.dueDate);
  if (!dated.length) return <p class="fl-empty">No due dates yet. Add due dates to tasks to see the timeline.</p>;
  const from = monday([today, ...dated.map(([x]) => start(x))].sort()[0]);
  const to = [today, ...dated.map(([x]) => x.dueDate)].sort().at(-1);
  const span = daysBetween(from, to) + 7, pct = (d) => `${(100 * daysBetween(from, d)) / span}%`;
  const weeks = [];
  for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(d);
  return (
    <section class="fl-scroll" aria-label="Timeline">
      <div class="fl-tl">
        <div class="fl-tl__row fl-tl__axis" aria-hidden="true"><span /><span class="fl-tl__track">{weeks.map((d) => <span key={d} style={{ left: pct(d) }}>{weekId(d).slice(5)}</span>)}</span></div>
        {rows.map(([x, depth]) => {
          const s = start(x);
          return (
            <div key={x.id} class="fl-tl__row">
              <a href={`#/p/${x.id}`} class="fl-tl__name" style={{ paddingLeft: `${depth * 12}px` }}>{x.title}</a>
              <span class="fl-tl__track">
                {x.dueDate ? <i class={x.kind === 'task' && isMine(x) ? 'is-mine' : ''} style={{ left: pct(s), width: `${(100 * (daysBetween(s, x.dueDate) + 1)) / span}%` }}
                  title={`${s} to ${x.dueDate}`} /> : <span class="fl-caption">No due date</span>}
                {x.dueDate && <span class="fl-sr">{s} to {x.dueDate}</span>}
                <b class="fl-tl__today" style={{ left: pct(today) }} aria-hidden="true" />
              </span>
            </div>
          );
        })}
      </div>
      <p class="fl-caption">Week numbers along the top. The ink line is today, <span class="fl-mono">{today}</span>.</p>
    </section>
  );
}

export function TeamChart({ root }) {
  const { kids, under } = tree(), teams = (kids[root.id] || []).filter((x) => x.kind !== 'task');
  if (!teams.length) return <p class="fl-empty">No subteams yet. Add a subteam to see the team chart.</p>;
  return (
    <section class="fl-teamchart" aria-label="Team chart">
      {teams.map((t) => {
        const members = [...new Set(under(t.id).flatMap((x) => x.assigneeUids))].filter((e) => e !== t.leadUid);
        return (
          <div key={t.id} class="fl-card"><a href={`#/p/${t.id}`} class="fl-h3">{t.title}</a>
            {t.leadUid ? <a href={`#/people/${t.leadUid}`} class="fl-person"><Chip email={t.leadUid} lead /><span>{memberName(t.leadUid)} (lead)</span></a> : <p class="fl-caption">No lead yet</p>}
            {members.map((e) => <a key={e} href={`#/people/${e}`} class="fl-person"><Chip email={e} /><span>{memberName(e)}</span></a>)}
          </div>
        );
      })}
    </section>
  );
}

export function exportProject(root) {
  const { byId } = tree(), event = root.dueDate;
  if (!event) return toast('Set the project due date (the event day) first; offsets are counted from it.');
  const nodes = [root, ...walk(root.id).map(([x]) => x)];
  const items = nodes.map((x) => ({
    key: x.id, parentKey: x.id === root.id ? null : x.parentId, title: x.title.slice(0, 80), notes: (x.notes || '').slice(0, 200),
    type: x.isDeal ? 'deal' : 'task', teamTag: x.kind === 'team' ? x.title : byId[x.ancestors.findLast((a) => byId[a]?.kind === 'team')]?.title || '',
    offsetDays: event && x.dueDate ? daysBetween(event, x.dueDate) : null,
  }));
  download(`${root.title.replace(/\W+/g, '-').toLowerCase()}.json`, JSON.stringify({ templateName: root.title, version: 1, questions: [], items }, null, 2));
}

