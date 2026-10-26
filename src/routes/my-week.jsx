import { S } from '../store.js';
import { isMine, tree } from '../model.js';
import { isoDay, week } from '../time.js';
import { FilterBar, TaskList, Title, useFilter } from '../ui.jsx';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const count = (n, noun) => `${WORDS[n] || n} ${noun}${n === 1 ? '' : 's'}.`;

export function MyWeek() {
  const w = week(), tasks = S.items.filter((t) => t.kind === 'task');
  const due = tasks.filter((t) => isMine(t) && t.dueDate && t.dueDate <= w.end && (t.status !== 'done' || t.dueDate >= w.start));
  const blockedOnMe = tasks.filter((t) => t.blocked && t.status !== 'done' && t.blockedOnUid === S.me.id);
  const ci = S.checkins.find((c) => c.uid === S.me.id && c.weekId === w.id);
  const [f, setF] = useFilter('week', 'mine');
  const open = due.filter((t) => t.status !== 'done').length;
  return (
    <>
      <Title light="Your week." bold={count(open, 'task')} title="My week" />
      {ci ? (
        <p class="jy-caption">Checked in for <span class="jy-mono">{w.id}</span>. <a href="#/checkin">Edit check-in</a></p>
      ) : (
        <section class="jy-banner" aria-labelledby="ci-h">
          <p class="jy-eyebrow">Check-in due Friday <span class="jy-mono">{w.due}</span> 23:59</p>
          <h2 id="ci-h" class="jy-h2">Three answers. Under a minute.</h2>
          <a class="jy-btn jy-btn--accent" href="#/checkin">Start check-in</a>
        </section>
      )}
      <section class="jy-section" aria-labelledby="due-h">
        <h2 id="due-h" class="jy-h2">Due this week</h2>
        <TaskList list={due} path empty={`Nothing of yours is due by ${w.end}. Check the filter below for later work.`} />
      </section>
      {blockedOnMe.length > 0 && (
        <section class="jy-section" aria-labelledby="bl-h">
          <h2 id="bl-h" class="jy-h2">Blocked on you</h2>
          <ul class="jy-list">{blockedOnMe.map((t) => (
            <li key={t.id} class="jy-task is-mine"><span class="jy-task__body"><b>{t.title}</b>
              <span class="jy-pre jy-caption">{t.blockedReason || 'No reason given.'}</span></span>
              <a class="jy-btn jy-btn--ghost jy-btn--s" href={`#/p/${t.id}`}>Open task</a></li>
          ))}</ul>
        </section>
      )}
      <section class="jy-section" aria-labelledby="all-h">
        <h2 id="all-h" class="jy-h2">All tasks <span class="jy-caption">{isoDay()}</span></h2>
        <FilterBar list={tasks} f={f} set={setF} teams={S.items.filter((i) => i.kind === 'team' && tree().byId[i.id])} />
      </section>
    </>
  );
}
