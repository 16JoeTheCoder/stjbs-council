// Home: only things with an action behind them, biggest first. My tasks (overdue, then this week), what waits on me,
// then one line per budget. No hero, no cards; an empty section is one quiet line.
import { useEffect } from 'preact/hooks';
import { S, toast } from '../store.js';
import { progress, tree } from '../model.js';
import { groupTasks, budgetRows, summary, waitingOn } from '../work-model.js';
import { Bar } from '../ui.jsx';
import { BudgetRows, PurchaseRow } from './budgets.jsx';
import { Quiet, Section, TaskRow } from './tasks.jsx';

const TYPE_TAG = { meeting: ['fl-tag--meeting', 'Meeting'], committee: ['fl-tag--committee', 'Committee'], project: ['', 'Project'], other: ['', 'Other'] };
export const EventTag = ({ type }) => <span class={`fl-tag ${TYPE_TAG[type]?.[0] || ''}`}>{TYPE_TAG[type]?.[1] || type}</span>;

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

// The same text for every role: it is built from shared data by one pure function.
export async function copySummary() {
  const text = summary({ tasks: S.tasks, budgets: S.budgets, purchases: S.purchases, members: S.members });
  try { await navigator.clipboard.writeText(text); toast('Summary copied. Paste it into WhatsApp.'); }
  catch { toast('Copying is blocked in this browser.'); }
}

export function Home() {
  useEffect(() => { document.title = 'Home · Council'; }, []);
  const g = groupTasks(S.tasks.filter((t) => t.ownerUid === S.me.id)), w = waitingOn(S.me, S.tasks, S.purchases);
  const waiting = w.approvals.length + w.receipts.length + w.blocked.length, rest = g.later.length + g.blocked.length;
  const pots = budgetRows(S.budgets, S.purchases);
  return (
    <>
      {g.overdue.length > 0 && <Section title="Overdue" n={g.overdue.length} tone="is-late">{g.overdue.map((t) => <TaskRow key={t.id} t={t} />)}</Section>}
      {g.week.length > 0 ? <Section title="This week" n={g.week.length}>{g.week.map((t) => <TaskRow key={t.id} t={t} />)}</Section>
        : !g.overdue.length && <Quiet>Nothing due from you this week.</Quiet>}
      {rest > 0 && <a class="fl-linkbtn fl-quiet" href="#/tasks">{rest} more of yours, later or blocked</a>}
      {waiting > 0 ? (
        <Section title="Waiting on you" n={waiting}>
          {w.approvals.map((p) => <PurchaseRow key={p.id} p={p} who />)}
          {w.receipts.map((p) => <PurchaseRow key={p.id} p={p} />)}
          {w.blocked.map((t) => <TaskRow key={t.id} t={t} who />)}
        </Section>
      ) : <Quiet>Nothing is waiting on you.</Quiet>}
      {pots.length > 0 ? <Section title="Budgets"><BudgetRows rows={pots} /></Section> : <Quiet>No active budgets.</Quiet>}
      <button class="fl-btn fl-btn--ghost fl-btn--block" onClick={copySummary}>Copy WhatsApp summary</button>
    </>
  );
}
