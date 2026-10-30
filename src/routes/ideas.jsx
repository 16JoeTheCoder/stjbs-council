// The idea board: paper notes anyone pins and votes on. Only the 20 newest of the term load, and only here and on
// laptop Home; "top" means most votes among those 20 (Firestore cannot order by the length of a list).
import { useEffect, useState } from 'preact/hooks';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S } from '../store.js';
import { firstName, isAdmin } from '../model.js';
import { archiveIdea, pinIdea, toggleVote } from '../actions.js';
import { Empty, Panel, Title } from '../ui.jsx';

function useIdeas() {
  const [list, setList] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'ideas'), where('termId', '==', S.term.termId), where('archived', '==', false), orderBy('createdAt', 'desc'), limit(20)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setList(false)), []);
  return list;
}
const byVotes = (list) => [...list].sort((a, b) => b.voters.length - a.voters.length || b.createdAt - a.createdAt);
const state = (list, empty) => (list === null ? <p class="fl-muted" role="status">Loading ideas.</p>
  : list === false ? <p class="fl-error" role="alert">Ideas did not load. Reload the page to try again.</p>
  : !list.length ? <Empty>{empty}</Empty> : null);

function Note({ idea, board }) {
  const mine = idea.voters.includes(S.me.id), n = idea.voters.length, [busy, setBusy] = useState(false);
  const vote = async () => { setBusy(true); await toggleVote(idea); setBusy(false); }; // a double tap must not undo itself
  return (
    <article class="fl-note">
      <p>{idea.text}</p>
      <footer>
        <span>{firstName(idea.authorUid)}</span>
        <span class="fl-actions">
          {board && isAdmin() && <button class="fl-vote" onClick={() => archiveIdea(idea)} aria-label={`Archive idea: ${idea.text}`}>Archive</button>}
          <button class="fl-vote" aria-pressed={mine} disabled={busy || S.me.role === 'teacher'} title={S.me.role === 'teacher' ? 'Teachers read the board; students vote.' : undefined} onClick={vote}
            aria-label={`${mine ? 'Remove your vote for' : 'Vote for'} "${idea.text}", ${n} ${n === 1 ? 'vote' : 'votes'}`}>▲ {n}</button>
        </span>
      </footer>
    </article>
  );
}

export function TopIdeas() {
  const list = useIdeas();
  return (
    <Panel title="Top ideas" id="ideas-h" extra="fl-desk-only" link={<a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/ideas">Open idea board</a>}>
      <p class="fl-small fl-muted">Anyone can pin an idea. Vote for the ones you want.</p>
      {state(list, 'No ideas yet. Pin the first one on the idea board.') || <div class="fl-ideas">{byVotes(list).slice(0, 3).map((i) => <Note key={i.id} idea={i} />)}</div>}
    </Panel>
  );
}

export function Ideas() {
  const list = useIdeas(), [text, setText] = useState(''), [sort, setSort] = useState('top'), [busy, setBusy] = useState(false);
  const pin = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await pinIdea(text.trim())) setText('');
    setBusy(false);
  };
  const shown = list ? (sort === 'top' ? byVotes(list) : list) : list;
  return (
    <>
      <Title light="Ideas." bold="Pin one, vote for the best." title="Ideas" />
      {S.me.role === 'teacher' ? <p class="fl-muted">Teachers can read the board; students pin and vote.</p> : (
        <form class="fl-panel fl-form" onSubmit={pin}>
          <div class="fl-field"><label for="idea">Your idea</label>
            <input id="idea" class="fl-input" maxLength={140} value={text} onInput={(e) => setText(e.target.value)} placeholder="Movie night in the hall after exams" aria-describedby="idea-help" />
            <span id="idea-help" class="fl-help">{140 - text.length} characters left. Everyone on the council sees your first name with it.</span></div>
          <div class="fl-actions"><button class="fl-btn fl-btn--red" disabled={busy || !text.trim()}>Pin idea</button></div>
        </form>
      )}
      <div class="fl-seg" role="group" aria-label="Sort ideas">
        <button aria-pressed={sort === 'top'} onClick={() => setSort('top')}>Most votes</button>
        <button aria-pressed={sort === 'new'} onClick={() => setSort('new')}>Newest</button>
      </div>
      {state(shown, 'No ideas yet. Pin the first one above.') || <div class="fl-ideas">{shown.map((i) => <Note key={i.id} idea={i} board />)}</div>}
    </>
  );
}
