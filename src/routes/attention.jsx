import { useState } from "preact/hooks";
import { S } from "../store.js";
import { markAttentionRead } from "../attention.js";
import { Empty, Panel, Title } from "../ui.jsx";
import { stamp } from "../time.js";

export function Attention() {
  const [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false);
  const all = S.attention || [],
    entries = all.filter((x) =>
      filter === "unread" ? !x.read : filter === "action" ? x.action : true,
    );
  return (
    <>
      <Title light="For" bold="you." title="Attention">
        <button
          class="fl-btn fl-btn--ghost fl-btn--sm"
          disabled={busy || !all.some((x) => !x.read)}
          onClick={async () => {
            setBusy(true);
            await Promise.all(
              all.filter((x) => !x.read).map(markAttentionRead),
            );
            setBusy(false);
          }}
        >
          {busy ? "Marking…" : "Mark all as read"}
        </button>
      </Title>
      <p class="fl-muted">
        Event requests, frozen invitations, meeting responsibilities, shared
        sessions, assigned actions and published minutes. Read state follows
        your account across devices.
      </p>
      <div class="fl-seg" role="group" aria-label="Attention filter">
        {[
          ["all", "All updates"],
          ["unread", "Unread"],
          ["action", "Needs action"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {S.attentionError && (
        <p class="fl-error" role="alert">
          {S.attentionError}
        </p>
      )}
      <Panel
        title={
          filter === "action"
            ? "Needs action"
            : filter === "unread"
              ? "Unread updates"
              : "Updates"
        }
      >
        {!S.attentionReady && <p role="status">Loading shared updates…</p>}
        {entries.length ? (
          <ul class="fl-list">
            {entries.map((x) => (
              <li class="fl-row" key={x.id}>
                <div>
                  <a
                    class="fl-link fl-h3"
                    href={x.href}
                    onClick={() => markAttentionRead(x)}
                  >
                    {x.title}
                  </a>
                  <p class="fl-small fl-muted">{x.detail}</p>
                  <p class="fl-small fl-muted">
                    {x.action ? "Needs action · " : ""}
                    {x.at ? stamp(x.at) : ""}
                    {!x.read ? " · Unread" : ""}
                  </p>
                </div>
                {!x.read && (
                  <button
                    class="fl-btn fl-btn--ghost fl-btn--sm"
                    onClick={() => markAttentionRead(x)}
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          S.attentionReady && (
            <Empty>
              {filter === "unread"
                ? "You have read every update."
                : filter === "action"
                  ? "Nothing needs your action right now."
                  : "Updates appear here when council work involves you."}
            </Empty>
          )
        )}
      </Panel>
    </>
  );
}
