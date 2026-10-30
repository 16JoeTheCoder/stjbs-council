import { useEffect, useState } from 'preact/hooks';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, memberName, unreadCount } from '../store.js';
import { markRead } from '../actions.js';
import { stamp } from '../time.js';
import { Chip, Title } from '../ui.jsx';

const Entry = ({ who, text, at, itemId, children }) => (
  <li class="jy-entry"><Chip email={who} />
    <p><span>{memberName(who)} {itemId ? <a href={`#/p/${itemId}`}>{text}</a> : text}</span> <span class="jy-mono jy-caption">{stamp(at)}</span></p>{children}</li>
);

// Activity loads only where it is shown, so a cold open of the app does not pay for it.
function useActivity(n) {
  const [list, setList] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'activity'), where('termId', '==', S.term.termId), orderBy('createdAt', 'desc'), limit(n)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setList(false)), [n]);
  return list;
}

export function Feed({ compact }) {
  const unread = S.notes.filter((n) => !n.read);
  const list = useActivity(compact ? 12 : 50);
  return (
    <>
      {compact ? <h2 class="jy-h2">Activity</h2> : <Title light="What changed." bold="Feed" title="Feed" />}
      {!compact && (
        <section class="jy-section" aria-labelledby="fy-h">
          <h2 id="fy-h" class="jy-h2">For you <span class="jy-caption">{unreadCount()} unread</span></h2>
          {unread.length > 1 && <button class="jy-link" onClick={() => unread.forEach(markRead)}>Mark all as read</button>}
          {S.notes.length ? <ul class="jy-feed">{S.notes.map((n) => (
            <Entry key={n.id} who={n.fromUid} text={n.text} at={n.createdAt} itemId={n.itemId}>
              {!n.read && <button class="jy-btn jy-btn--ghost jy-btn--s" onClick={() => markRead(n)}>Mark as read</button>}
            </Entry>))}</ul> : <p class="jy-empty">Nothing for you yet. Comments, assignments and blocks on you show up here.</p>}
        </section>
      )}
      <section class={compact ? '' : 'jy-section'} aria-label="Activity">
        {!compact && <h2 class="jy-h2">Activity</h2>}
        {list === null ? <p class="jy-caption">Loading activity.</p> : list === false ? <p class="jy-error" role="alert">Activity did not load. Reload the page to try again.</p> : list.length ? <ul class="jy-feed">{list.map((a) => <Entry key={a.id} who={a.actorUid} text={a.text} at={a.createdAt} itemId={a.itemId} />)}</ul>
          : <p class="jy-empty">No activity this term yet.</p>}
      </section>
    </>
  );
}
