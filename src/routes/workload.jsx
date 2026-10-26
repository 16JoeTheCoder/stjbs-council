// Workload: live numbers from tasks every member can read, plus weekly snapshots only three roles can read.
import { useEffect, useState } from 'preact/hooks';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S } from '../store.js';
import { activeMembers, canSeeStats, checksIn, taskState } from '../model.js';
import { daysBetween, isoDay, monday, week } from '../time.js';
import { Title } from '../ui.jsx';

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
  if (snaps.length < 2) return <p class="jy-caption">The line appears once two weekly snapshots exist. {snaps.length} saved so far.</p>;
  const W = 600, H = 160, P = 32, max = Math.max(1, ...snaps.map((s) => s.totalOpen));
  const x = (i) => P + (i * (W - 2 * P)) / (snaps.length - 1), y = (v) => H - P - (v * (H - 2 * P)) / max;
  return (
    <figure class="jy-scroll">
      <svg class="jy-chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Open tasks per week, from ${snaps[0].totalOpen} to ${snaps.at(-1).totalOpen}`}>
        <line class="grid" x1={P} x2={W - P} y1={y(max)} y2={y(max)} /><line class="axis" x1={P} x2={W - P} y1={y(0)} y2={y(0)} />
        <text x={4} y={y(max) + 4}>{max}</text><text x={4} y={y(0) + 4}>0</text>
        <polyline class="ser s1" points={snaps.map((s, i) => `${x(i)},${y(s.totalOpen)}`).join(' ')} />
        <text class="lab1" x={x(snaps.length - 1) - 40} y={y(snaps.at(-1).totalOpen) - 8}>Open</text>
        <text x={P} y={H - 8}>{snaps[0].weekId}</text><text x={W - P - 64} y={H - 8}>{snaps.at(-1).weekId}</text>
      </svg>
      <figcaption class="jy-caption">Open tasks (count) per week, n = {snaps.length} snapshots. Source: saved weekly snapshots.</figcaption>
    </figure>
  );
}

export function Workload() {
  const [cis, setCis] = useState(null), [snaps, setSnaps] = useState([]), [err, setErr] = useState('');
  const ok = canSeeStats(), T = S.term.termId;
  useEffect(() => {
    if (!ok) return;
    (async () => {
      const all = (await getDocs(query(collection(db, 'checkins'), where('termId', '==', T)))).docs.map((d) => d.data());
      setCis(all);
      const id = `${T}_${week().id}`, ref = doc(db, 'stats', id);
      if (!(await getDoc(ref)).exists()) {
        const r = rows(all);
        await setDoc(ref, { termId: T, weekId: week().id, totalOpen: r.reduce((a, x) => a + x.open, 0), members: Object.fromEntries(r.map((x) => [x.id.replace(/\./g, '_'), { open: x.open, overdue: x.overdue, blocked: x.blocked, done: x.done }])), createdAt: Date.now() });
      }
      setSnaps((await getDocs(query(collection(db, 'stats'), where('termId', '==', T)))).docs.map((d) => d.data()).sort((a, b) => a.weekId.localeCompare(b.weekId)));
    })().catch((e) => setErr(`Could not load workload (${e.code || e.message}). Reload to try again.`));
  }, [ok, T]);
  if (!ok) return <><Title light="Not for you." bold="Workload" /><p>Only the advisor, president and vice president see workload.</p></>;
  const r = rows(cis);
  return (
    <>
      <Title light="Who carries what." bold="Workload." title="Workload" />
      <p class="jy-caption">Live numbers come from tasks every member can read. Only the weekly snapshots below are restricted to the advisor, president and vice president.</p>
      {err && <p class="jy-alert" role="alert">{err}</p>}
      <div class="jy-section jy-scroll"><table class="jy-table">
        <thead><tr><th>Member</th><th class="num">Open</th><th class="num">Overdue</th><th class="num">Blocked</th><th class="num">Done this term</th><th class="num">Done, last 7 days</th><th class="num">Check-ins</th></tr></thead>
        <tbody>{r.map((x) => (
          <tr key={x.id}><td><a href={`#/people/${x.id}`}>{x.name}</a></td><td class="num">{x.open}</td><td class="num">{x.overdue}</td><td class="num">{x.blocked}</td>
            <td class="num">{x.done}</td><td class="num">{x.done7}</td><td class="num">{x.checkins == null ? 'Loading' : `${x.checkins} of ${x.weeks ?? '?'}`}</td></tr>))}</tbody>
      </table></div>
      <section class="jy-section" aria-labelledby="trend-h"><h2 id="trend-h" class="jy-h2">Open tasks over the term</h2><Chart snaps={snaps} /></section>
    </>
  );
}
