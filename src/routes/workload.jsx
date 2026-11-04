// Workload: live numbers from tasks every member can read, plus weekly snapshots only three roles can read.
import { useEffect, useState } from 'preact/hooks';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, plain } from '../store.js';
import { activeMembers, canSeeStats, checksIn, taskState } from '../model.js';
import { daysBetween, isoDay, monday, week } from '../time.js';
import { Bar, Title } from '../ui.jsx';

export function rows(termCheckins) {
  const tasks = S.items.filter((t) => t.kind === 'task'), weekAgo = Date.now() - 7 * 86400e3;
  const weeks = S.term.startDate ? Math.floor(daysBetween(monday(S.term.startDate), monday(isoDay())) / 7) + 1 : null;
  return activeMembers().filter(checksIn).map((m) => {
    const mine = tasks.filter((t) => t.assigneeUids.includes(m.id)), open = mine.filter((t) => t.status !== 'done');
    return {
      id: m.id, name: m.name, open: open.length, overdue: open.filter((t) => taskState(t).word === 'Overdue').length,
      blocked: open.filter((t) => t.blocked).length, done: mine.length - open.length,
      done7: mine.filter((t) => t.status === 'done' && t.completedAt >= weekAgo).length,
      checkins: termCheckins ? termCheckins.filter((c) => c.uid === m.id).length : null, weeks,
    };
  });
}

function Chart({ snaps }) {
  if (snaps.length < 2) return <p class="fl-caption">The line appears once two weekly snapshots exist. {snaps.length} saved so far.</p>;
  const W = 600, H = 160, P = 32, max = Math.max(1, ...snaps.map((s) => s.totalOpen));
  const x = (i) => P + (i * (W - 2 * P)) / (snaps.length - 1), y = (v) => H - P - (v * (H - 2 * P)) / max;
  return (
    <figure class="fl-scroll">
      <svg class="fl-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Open tasks per week, from ${snaps[0].totalOpen} to ${snaps.at(-1).totalOpen}`}>
        <line class="grid" x1={P} x2={W - P} y1={y(max)} y2={y(max)} /><line class="axis" x1={P} x2={W - P} y1={y(0)} y2={y(0)} />
        <text x={4} y={y(max) + 4}>{max}</text><text x={4} y={y(0) + 4}>0</text>
        <polyline class="ser s1" points={snaps.map((s, i) => `${x(i)},${y(s.totalOpen)}`).join(' ')} />
        <text class="lab1" x={x(snaps.length - 1) - 40} y={y(snaps.at(-1).totalOpen) - 8}>Open</text>
        <text x={P} y={H - 8}>{snaps[0].weekId}</text><text x={W - P - 64} y={H - 8}>{snaps.at(-1).weekId}</text>
      </svg>
      <figcaption class="fl-caption">Open tasks (count) per week, n = {snaps.length} snapshots. Source: saved weekly snapshots.</figcaption>
    </figure>
  );
}

export function Workload() {
  const [cis, setCis] = useState(null), [snaps, setSnaps] = useState([]), [err, setErr] = useState(''), [sort, setSort] = useState({ key: 'overdue', dir: -1 });
  const ok = canSeeStats(), T = S.term.termId;
  useEffect(() => {
    if (!ok) return;
    (async () => {
      const all = (await getDocs(query(collection(db, 'checkins'), where('termId', '==', T)))).docs.map((d) => d.data());
      setCis(all);
      const id = `${T}_${week().id}`, ref = doc(db, 'stats', id);
      if (!(await getDoc(ref)).exists()) {
        const r = rows(all);
        await setDoc(ref, { termId: T, weekId: week().id, totalOpen: S.items.filter((t) => t.kind === 'task' && t.status !== 'done').length, members: Object.fromEntries(r.map((x) => [x.id.replace(/\./g, '_'), { open: x.open, overdue: x.overdue, blocked: x.blocked, done: x.done }])), createdAt: Date.now() });
      }
      setSnaps((await getDocs(query(collection(db, 'stats'), where('termId', '==', T)))).docs.map((d) => d.data()).sort((a, b) => a.weekId.localeCompare(b.weekId)));
    })().catch((e) => setErr(`Check-ins did not load. ${plain(e)}`));
  }, [ok, T]);
  if (!ok) return <><Title light="Not for you." bold="Workload" /><p>Only the advisor, president and vice president see workload.</p></>;
  const r = rows(cis).sort((a, b) => sort.dir * ((typeof a[sort.key] === 'string' ? a[sort.key].localeCompare(b[sort.key]) : (a[sort.key] ?? 0) - (b[sort.key] ?? 0))) || a.name.localeCompare(b.name));
  const max = Math.max(1, ...r.map((x) => x.open + x.done));
  const th = (k, l, num = true) => <th class={num ? 'fl-num' : ''} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}><button class="fl-sortbtn" onClick={() => setSort({ key: k, dir: sort.key === k ? -sort.dir : k === 'name' ? 1 : -1 })}>{l}{sort.key === k && <span aria-hidden="true">{sort.dir > 0 ? ' ↑' : ' ↓'}</span>}</button></th>;
  const n = (v) => <span class={v ? '' : 'fl-zero'}>{v}</span>;
  const flag = (v, word) => (v ? <span class={`fl-badge fl-badge--${v > 2 ? 'bad' : 'warn'}`}>{v} {word}</span> : <span class="fl-zero">0</span>);
  return (
    <>
      <Title light="Who carries what." bold="Workload." title="Workload" />
      <p class="fl-caption">Live numbers come from tasks every member can read. Only the weekly snapshots below are restricted to the advisor, president and vice president.</p>
      {err && <p class="fl-alert" role="alert">{err}</p>}
      <div class="fl-scroll"><table class="fl-table">
        <thead><tr>{th('name', 'Member', false)}{th('open', 'Open')}<th><span class="fl-sr">Open and done</span></th>{th('overdue', 'Overdue')}{th('blocked', 'Blocked')}{th('done', 'Done this term')}{th('done7', 'Done, 7 days')}{th('checkins', 'Check-ins')}</tr></thead>
        <tbody>{r.map((x) => (
          <tr key={x.id}><td><a class="fl-tablelink" href={`#/people/${x.id}`}>{x.name}</a></td><td class="fl-num">{n(x.open)}</td>
            <td class="fl-wl"><span style={{ width: `${(100 * (x.open + x.done)) / max}%` }}><Bar done={x.done} total={x.open + x.done} label={`${x.name}: ${x.done} done, ${x.open} open`} /></span></td>
            <td class="fl-num">{flag(x.overdue, 'overdue')}</td><td class="fl-num">{flag(x.blocked, 'blocked')}</td>
            <td class="fl-num">{n(x.done)}</td><td class="fl-num">{n(x.done7)}</td><td class="fl-num">{x.checkins == null ? <span class="fl-zero">Loading</span> : `${x.checkins} of ${x.weeks ?? '?'}`}</td></tr>))}</tbody>
      </table></div>
      <section class="fl-section" aria-labelledby="trend-h"><h2 id="trend-h" class="fl-h2">Open tasks over the term</h2><Chart snaps={snaps} /></section>
    </>
  );
}
