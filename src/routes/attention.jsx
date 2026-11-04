// For you: requests, invitations, meeting responsibilities and minutes that involve me. Loading or error, never both.
import { useState } from 'preact/hooks';
import { S, set } from '../store.js';
import { markAttentionRead } from '../attention.js';
import { Empty, Panel, Title } from '../ui.jsx';
import { stamp } from '../time.js';

export function Attention() {
  const [filter, setFilter] = useState('all'), [busy, setBusy] = useState(false);
  const all = S.attention || [], entries = all.filter((x) => (filter === 'unread' ? !x.read : filter === 'action' ? x.action : true));
  const error = S.attentionError, loading = !S.attentionReady && !error;
  return (
    <>
      <Title light="For" bold="you." title="For you">
        <button class="fl-btn fl-btn--ghost fl-btn--sm" disabled={busy || !all.some((x) => !x.read)}
          onClick={async () => { setBusy(true); await Promise.all(all.filter((x) => !x.read).map(markAttentionRead)); setBusy(false); }}>
          {busy ? 'Marking…' : 'Mark all as read'}
        </button>
      </Title>
      <p class="fl-muted fl-measure">Event requests, invitations, meeting roles, actions given to you and published minutes. Read marks follow you across devices.</p>
      <div class="fl-seg" role="group" aria-label="Show">
        {[['all', 'All updates'], ['unread', 'Unread'], ['action', 'Needs action']].map(([id, label]) => (
          <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <Panel title={filter === 'action' ? 'Needs action' : filter === 'unread' ? 'Unread updates' : 'Updates'} id="attn-h">
        {error ? (
          <div class="fl-calnote" role="alert"><span>Your updates did not load. {error}</span>
            <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => set({ attentionRetry: (S.attentionRetry || 0) + 1 })}>Retry</button></div>
        ) : loading ? <p role="status" class="fl-muted">Loading your updates…</p> : entries.length ? (
          <ul class="fl-list">
            {entries.map((x) => (
              <li class="fl-row fl-row--attn2" key={x.id}>
                <div>
                  <a class={`fl-h3 fl-attn__t${x.read ? '' : ' is-unread'}`} href={x.href} onClick={() => markAttentionRead(x)}>{x.title}</a>
                  <p class="fl-small fl-muted">{x.detail}</p>
                  <p class="fl-small fl-muted">{x.action && <span class="fl-badge fl-badge--warn">Needs action</span>} <span class="fl-mono">{x.at ? stamp(x.at) : ''}</span></p>
                </div>
                {!x.read && <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => markAttentionRead(x)}>Mark read</button>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{filter === 'unread' ? 'You have read every update.' : filter === 'action' ? 'Nothing needs your action right now.' : 'Updates appear here when council work involves you.'}</Empty>
        )}
      </Panel>
    </>
  );
}
