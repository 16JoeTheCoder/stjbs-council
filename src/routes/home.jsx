// Home: only things with an action behind them, biggest first. My tasks (overdue, then this week), what waits on me,
// then one line per budget. No hero, no cards; an empty section is one quiet line.
import { useEffect } from 'preact/hooks';
import { S, toast } from '../store.js';
import { progress, tree } from '../model.js';
import { groupDays, budgetRows, summary, waitingOn } from '../work-model.js';
import { addDays, fmtDay, isoDay } from '../time.js';
import { Icon } from '../shared.jsx';
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

// Home, in order: my tasks (overdue first), what waits on me, the next 7 days of events, then budgets.
export function Home() {
  useEffect(() => { document.title = 'Home · Council'; }, []);
  const today = isoDay(), soon = addDays(today, 7);
  const g = groupDays(S.tasks.filter((t) => t.ownerUid === S.me.id)), w = waitingOn(S.me, S.tasks, S.purchases);
  const mineNow = [...g.overdue, ...g.today, ...g.upcoming.filter((t) => t.dueDate <= soon)];
  const later = g.upcoming.length + g.nodate.length - (mineNow.length - g.overdue.length - g.today.length);
  const waiting = w.approvals.length + w.receipts.length + w.blocked.length;
  const events = S.events.filter((e) => e.date >= today && e.date <= soon).sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
  const pots = budgetRows(S.budgets, S.purchases);
  return (
    <>
      {mineNow.length ? <Section title="My tasks" n={mineNow.length} tone={g.overdue.length ? 'is-late' : ''}>{mineNow.map((t) => <TaskRow key={t.id} t={t} />)}</Section>
        : <Quiet>Nothing due from you this week.</Quiet>}
      {later > 0 && <a class="fl-linkbtn fl-quiet" href="#/tasks">{later} more of yours, later or undated</a>}
      {waiting > 0 ? (
        <Section title="Waiting on me" n={waiting}>
          {w.approvals.map((p) => <PurchaseRow key={p.id} p={p} who />)}
          {w.receipts.map((p) => <PurchaseRow key={p.id} p={p} />)}
          {w.blocked.map((t) => <TaskRow key={t.id} t={t} who />)}
        </Section>
      ) : <Quiet>Nothing is waiting on you.</Quiet>}
      {events.length ? (
        <Section title="Next 7 days">
          {events.slice(0, 6).map((e) => (
            <a key={e.id} class="fl-line fl-evline" href="#/calendar"><span class="fl-mono">{e.date === today ? 'Today' : fmtDay(e.date).slice(0, 6)}{e.start && !e.allDay ? ` ${e.start}` : ''}</span><span>{e.title}</span></a>
          ))}
        </Section>
      ) : <Quiet>No events in the next 7 days.</Quiet>}
      {pots.length > 0 ? <Section title="Budgets"><BudgetRows rows={pots} /></Section> : <Quiet>No active budgets.</Quiet>}
      <button class="fl-linkbtn fl-quiet" onClick={copySummary}><Icon n="copy" />Copy WhatsApp summary</button>
    </>
  );
}
