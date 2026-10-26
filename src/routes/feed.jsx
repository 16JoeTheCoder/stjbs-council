import { S, memberName } from '../store.js';
import { markRead } from '../actions.js';
import { stamp } from '../time.js';
import { Chip, Title } from '../ui.jsx';

const Entry = ({ who, text, at, itemId, children }) => (
  <li class="jy-entry"><Chip email={who} />
    <p><span>{memberName(who)} {itemId ? <a href={`#/p/${itemId}`}>{text}</a> : text}</span> <span class="jy-mono jy-caption">{stamp(at)}</span></p>{children}</li>
);

export function Feed({ compact }) {
  const unread = S.notes.filter((n) => !n.read);
  const list = compact ? S.activity.slice(0, 12) : S.activity;
  return (
    <>
      {compact ? <h2 class="jy-h2">Activity</h2> : <Title light="What changed." bold="Feed" />}
      {!compact && (
        <section class="jy-section" aria-labelledby="fy-h">
          <h2 id="fy-h" class="jy-h2">For you <span class="jy-caption">{unread.length} unread</span></h2>
          {unread.length > 1 && <button class="jy-link" onClick={() => unread.forEach(markRead)}>Mark all as read</button>}
          {S.notes.length ? <ul class="jy-feed">{S.notes.map((n) => (
            <Entry key={n.id} who={n.fromUid} text={n.text} at={n.createdAt} itemId={n.itemId}>
              {!n.read && <button class="jy-btn jy-btn--ghost jy-btn--s" onClick={() => markRead(n)}>Mark as read</button>}
            </Entry>))}</ul> : <p class="jy-empty">Nothing for you yet. Comments, assignments and blocks on you show up here.</p>}
        </section>
      )}
      <section class={compact ? '' : 'jy-section'} aria-label="Activity">
        {!compact && <h2 class="jy-h2">Activity</h2>}
        {list.length ? <ul class="jy-feed">{list.map((a) => <Entry key={a.id} who={a.actorUid} text={a.text} at={a.createdAt} itemId={a.itemId} />)}</ul>
          : <p class="jy-empty">No activity this term yet.</p>}
      </section>
    </>
  );
}
