import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { useEffect, useRef, useState } from "preact/hooks";
import { rsvp, updateItem } from "../actions.js";
import { S, memberName, plain } from "../store.js";
import { isAdmin, canWork, googleUrl } from "../model.js";
import { isoDay, week } from "../time.js";
import { Title, TaskRow } from "../ui.jsx";
import { useMeeting, useMeetingBuffer } from "../meeting-sync.js";
import {
  ATTENDANCE,
  MEETING_PHASES,
  canControl,
  taskReview,
} from "../meeting-model.js";
import {
  markMeetingRead,
  saveTopicMinutes,
  initializeMeeting,
  captureMeetingAction,
  saveSensitive,
  resolveContribution,
  addTopic,
  attendance,
  changeMeeting,
  contribute,
  controlMeeting,
  handoff,
  lifecycle,
  publishMinutes,
  saveMinutes,
  updateTopic,
} from "../meeting-actions.js";
import {
  normalizeAttendance,
  downloadMeetingDocument,
  printMeeting,
  loadGoogleIdentity,
  connectGoogleAccount,
  exportGoogleMeeting,
  validateGoogleConfig,
} from "../meeting-export.js";
const readableRecord = (record) => ({
  ...record,
  attendance: normalizeAttendance(record.attendance, S.members),
});
function Action({ children, onClick, ...props }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        class="fl-btn fl-btn--ghost"
        disabled={busy}
        {...props}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError(plain(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && (
        <p class="fl-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
function PersonSelect({
  label,
  value,
  onChange,
  people = S.members.filter((m) => m.active),
}) {
  return (
    <label class="fl-field">
      {label}
      <select
        aria-label={label}
        class="fl-input"
        value={value || ""}
        onChange={(e) => onChange(e.currentTarget.value || null)}
      >
        <option value="">Unassigned</option>
        {people.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function DraftRecovery({ buffer }) {
  return buffer.conflict ? (
    <div class="fl-section" role="alert">
      <p>
        Your local text is retained. Compare the latest saved text before
        choosing how to continue.
      </p>
      <details>
        <summary>Latest saved version</summary>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {buffer.serverValue || "(Empty)"}
        </pre>
      </details>
      <div class="fl-actions">
        <button class="fl-btn fl-btn--ghost" onClick={buffer.reload}>
          Use saved version
        </button>
        <button class="fl-btn fl-btn--ghost" onClick={buffer.keep}>
          Keep local draft
        </button>
      </div>
    </div>
  ) : null;
}
function MinutesField({ meeting, draft, field, label, editable }) {
  const buffer = useMeetingBuffer(
    meeting.id,
    field,
    draft[field],
    (value) => saveMinutes(meeting.id, draft, { [field]: value }),
    editable,
    `${meeting.status}:${draft.editorUid}`,
  );
  return (
    <label class="fl-field">
      {label}
      <textarea
        class="fl-input"
        rows={field === "summary" ? 8 : 4}
        value={buffer.value}
        readOnly={!editable}
        maxLength={15000}
        onInput={(e) => buffer.edit(e.currentTarget.value)}
        onBlur={buffer.flush}
      />
      <DraftRecovery buffer={buffer} />
      {editable && (
        <button
          type="button"
          class="fl-btn fl-btn--ghost"
          onClick={buffer.flush}
        >
          Save now
        </button>
      )}
      <span class="fl-save-state" role="status">
        {editable ? buffer.status : "Read only"}
      </span>
    </label>
  );
}
function Contribution({ meeting, topicId, type = "question" }) {
  const buffer = useMeetingBuffer(
      meeting.id,
      `contribution-${type}`,
      "",
      async () => {},
      false,
    ),
    [error, setError] = useState("");
  if (S.me.role === "teacher")
    return <p class="fl-muted">Teacher access is read only.</p>;
  return (
    <form
      class="fl-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await contribute(meeting.id, { topicId, type, text: buffer.value });
          buffer.edit("");
          await buffer.flush();
          setError("");
        } catch (e) {
          setError(plain(e));
        }
      }}
    >
      <label class="fl-field">
        {type === "suggestion"
          ? "Suggest an agenda topic"
          : type === "update"
            ? "Done / Next / Blocked update"
            : "Question or action to capture"}
        <textarea
          class="fl-input"
          rows="3"
          value={buffer.value}
          maxLength="3000"
          required
          onInput={(e) => buffer.edit(e.currentTarget.value)}
        />
      </label>
      <button class="fl-btn fl-btn--ghost" disabled={!buffer.value.trim()}>
        Submit {type}
      </button>
      {error && (
        <p role="alert" class="fl-error">
          {error}
        </p>
      )}
    </form>
  );
}
function TopicReferences({ meeting, topic, control }) {
  const [title, setTitle] = useState(""),
    [url, setUrl] = useState("");
  return (
    <div>
      {(topic.references || []).map((r, i) => (
        <p key={i}>
          <a
            class="fl-link"
            href={googleUrl(r.url) ? r.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            {r.title}
          </a>
          {control && (
            <Action
              onClick={() =>
                updateTopic(meeting.id, topic, {
                  references: topic.references.filter((_, n) => n !== i),
                })
              }
            >
              Remove reference
            </Action>
          )}
        </p>
      ))}
      {control && (
        <details>
          <summary>Linked work and references</summary>
          <label class="fl-field">
            Selected projects
            <select
              multiple
              class="fl-input"
              aria-label="Selected projects"
              value={topic.projectIds || []}
              onChange={(e) =>
                updateTopic(meeting.id, topic, {
                  projectIds: [...e.currentTarget.selectedOptions].map(
                    (o) => o.value,
                  ),
                })
              }
            >
              {S.items
                .filter((p) => meeting.projectIds.includes(p.id))
                .map((p) => (
                  <option value={p.id}>{p.title}</option>
                ))}
            </select>
          </label>
          <label class="fl-field">
            Selected tasks
            <select
              multiple
              class="fl-input"
              aria-label="Selected tasks"
              value={topic.taskIds || []}
              onChange={(e) =>
                updateTopic(meeting.id, topic, {
                  taskIds: [...e.currentTarget.selectedOptions].map(
                    (o) => o.value,
                  ),
                })
              }
            >
              {taskReview(S.items, meeting.projectIds, isoDay()).map((t) => (
                <option value={t.id}>{t.title}</option>
              ))}
            </select>
          </label>
          <label class="fl-field">
            Reference title
            <input
              class="fl-input"
              maxLength="120"
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </label>
          <label class="fl-field">
            Google Docs or Drive URL
            <input
              class="fl-input"
              type="url"
              maxLength="500"
              value={url}
              onInput={(e) => setUrl(e.currentTarget.value)}
            />
          </label>
          <Action
            disabled={
              !title.trim() ||
              !googleUrl(url) ||
              (topic.references || []).length >= 5
            }
            onClick={async () => {
              await updateTopic(meeting.id, topic, {
                references: [
                  ...(topic.references || []),
                  { title: title.trim(), url },
                ],
              });
              setTitle("");
              setUrl("");
            }}
          >
            Add reference
          </Action>
        </details>
      )}
    </div>
  );
}
function Agenda({ data, control }) {
  const { meeting, agenda, contributions } = data,
    [title, setTitle] = useState("");
  return (
    <>
      <h2 class="fl-h2">Ordered agenda</h2>
      <p class="fl-small fl-muted">
        Up to 12 focused topics. Member updates and task reviews use their own
        phases.
      </p>
      {control && (
        <form
          class="fl-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await addTopic(meeting.id, { title, order: agenda.length });
            setTitle("");
          }}
        >
          <label class="fl-field">
            Topic title
            <input
              class="fl-input"
              value={title}
              maxLength="120"
              required
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </label>
          <button class="fl-btn fl-btn--ghost" disabled={agenda.length >= 12}>
            Add topic
          </button>
        </form>
      )}
      <ol class="fl-agenda-list">
        {agenda.map((topic, index) => (
          <li key={topic.id}>
            <h3>{topic.title}</h3>
            <p>
              {topic.duration} min · {memberName(topic.presenterUid)} ·{" "}
              {topic.status}
            </p>
            <TopicReferences
              meeting={meeting}
              topic={topic}
              control={control}
            />
            {control && (
              <div class="fl-actions">
                <Action
                  onClick={() =>
                    updateTopic(meeting.id, topic, {
                      order: Math.max(0, index - 1),
                    })
                  }
                >
                  Move earlier
                </Action>
                <Action
                  onClick={() =>
                    updateTopic(meeting.id, topic, { status: "deferred" })
                  }
                >
                  Defer
                </Action>
                <PersonSelect
                  label="Presenter"
                  value={topic.presenterUid}
                  onChange={(presenterUid) =>
                    updateTopic(meeting.id, topic, { presenterUid })
                  }
                />
                <label class="fl-field">
                  Duration in minutes
                  <input
                    class="fl-input"
                    type="number"
                    min="1"
                    max="180"
                    value={topic.duration}
                    onChange={(e) =>
                      updateTopic(meeting.id, topic, {
                        duration: Number(e.currentTarget.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
          </li>
        ))}
      </ol>
      {!agenda.length && (
        <p class="fl-empty">
          Add topics or suggest one below to prepare this meeting.
        </p>
      )}
      <Contribution meeting={meeting} type="suggestion" />
      {contributions
        .filter((c) => c.type === "suggestion")
        .map((c) => (
          <div class="fl-section" key={c.id}>
            <p>{c.text}</p>
            <small>
              Suggested by {memberName(c.authorUid)} · {c.status}
            </small>
            {control && c.status === "submitted" && (
              <Action
                onClick={async () => {
                  await addTopic(meeting.id, {
                    title: c.text.slice(0, 200),
                    presenterUid: c.authorUid,
                    order: agenda.length,
                  });
                  await resolveContribution(meeting.id, c.id, "accepted");
                }}
              >
                Accept suggestion
              </Action>
            )}
          </div>
        ))}
    </>
  );
}
function ActionCapture({ meeting, draft }) {
  const [text, setText] = useState(""),
    [ownerUid, setOwner] = useState(""),
    [dueDate, setDue] = useState(""),
    [projectId, setProject] = useState(meeting.projectIds[0] || "");
  return (
    <section class="fl-section">
      <h3>Actions and linked tasks</h3>
      <p class="fl-small fl-muted">
        Up to 10 captured actions per minutes version.
      </p>
      {draft.actions.map((a, i) => (
        <p key={i}>
          {a.text} · {memberName(a.ownerUid)} · {a.dueDate || "No due date"} ·{" "}
          {a.status}{" "}
          {a.taskId && (
            <a class="fl-link" href={`#/p/${a.taskId}`}>
              Open task
            </a>
          )}
        </p>
      ))}
      {draft.editorUid === S.me.id && draft.status === "draft" && (
        <form class="fl-form" onSubmit={(e) => e.preventDefault()}>
          <label class="fl-field">
            Action title
            <input
              class="fl-input"
              value={text}
              maxLength="120"
              onInput={(e) => setText(e.currentTarget.value)}
            />
          </label>
          <PersonSelect label="Owner" value={ownerUid} onChange={setOwner} />
          <label class="fl-field">
            Due date
            <input
              type="date"
              class="fl-input"
              value={dueDate}
              onChange={(e) => setDue(e.currentTarget.value)}
            />
          </label>
          <label class="fl-field">
            Allowed project
            <select
              aria-label="Allowed project"
              class="fl-input"
              value={projectId}
              onChange={(e) => setProject(e.currentTarget.value)}
            >
              <option value="">Select project</option>
              {S.items
                .filter((p) => meeting.projectIds.includes(p.id))
                .map((p) => (
                  <option value={p.id}>{p.title}</option>
                ))}
            </select>
          </label>
          <Action
            disabled={
              !text.trim() ||
              !projectId ||
              meeting.status !== "live" ||
              draft.actions.length >= 10
            }
            onClick={async () => {
              await captureMeetingAction(meeting, draft, {
                text,
                ownerUid,
                dueDate,
                projectId,
              });
              setText("");
            }}
          >
            Capture action as task
          </Action>
        </form>
      )}
    </section>
  );
}
function GoogleExport({ record: sourceRecord }) {
  const record = readableRecord(sourceRecord);
  const metadataKey = `council-meeting-export:${S.me.id}:${record.id}`;
  const configured = import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
    clientId = validateGoogleConfig(configured).enabled ? configured : "",
    [ready, setReady] = useState(false),
    [session, setSession] = useState(null),
    [confirmed, setConfirmed] = useState(false),
    [folder, setFolder] = useState(""),
    [result, setResult] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(metadataKey) || "null");
      } catch {
        return null;
      }
    }),
    [error, setError] = useState("");
  useEffect(() => {
    if (clientId)
      loadGoogleIdentity()
        .then(() => setReady(true))
        .catch((e) => setError(plain(e)));
  }, [clientId]);
  return (
    <section class="fl-section">
      <h3>Export to Google Docs</h3>
      {!clientId ? (
        <p>
          Google Docs export needs the school’s OAuth client configuration.
          Download and print remain available.
        </p>
      ) : (
        <>
          <p>
            Connect the account that should own this document. Access is
            requested only when you click Connect.
          </p>
          <button
            class="fl-btn fl-btn--ghost"
            disabled={!ready}
            onClick={() =>
              connectGoogleAccount({ clientId })
                .then((s) => {
                  setSession(s);
                  setConfirmed(false);
                  setError("");
                })
                .catch((e) => setError(plain(e)))
            }
          >
            Connect Google account
          </button>
          {session && (
            <>
              <label class="fl-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.currentTarget.checked)}
                />
                Export using {session.account.email}
              </label>
              <label class="fl-field">
                Optional destination folder ID
                <input
                  class="fl-input"
                  value={folder}
                  maxLength="200"
                  onInput={(e) => setFolder(e.currentTarget.value)}
                />
              </label>
              <p>
                Published version {record.publishedVersion} · Destination:{" "}
                {folder || "My Drive"} · Account: {session.account.email}
              </p>
              <Action
                disabled={!confirmed}
                onClick={async () => {
                  const exported = await exportGoogleMeeting({
                    record,
                    session,
                    confirmedAccountEmail: session.account.email,
                    destinationFolderId: folder,
                    previousExport: result,
                  });
                  setResult(exported);
                  try {
                    localStorage.setItem(metadataKey, JSON.stringify(exported));
                  } catch {}
                }}
              >
                Export published version
              </Action>
            </>
          )}
          {result && (
            <p>
              {result.status === "current"
                ? "Already current"
                : result.revision === record.publishedVersion
                  ? "Exported"
                  : "Previous export; a newer published version is available"}{" "}
              · Version {result.revision} · {result.accountEmail} ·{" "}
              {result.destinationFolderId || "My Drive"}:{" "}
              <a
                class="fl-link"
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open exported document
              </a>
            </p>
          )}
        </>
      )}
      {error && (
        <p class="fl-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function SensitiveRecord({ meeting, uid }) {
  const [record, setRecord] = useState({
      reason: "",
      followup: "",
      designation: "",
    }),
    [error, setError] = useState(""),
    [changedElsewhere, setChanged] = useState(false),
    dirty = useRef(false);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "meetings", meeting.id, "sensitive", uid),
        (snapshot) => {
          if (dirty.current) {
            setChanged(true);
            return;
          }
          setRecord(
            snapshot.data() || { reason: "", followup: "", designation: "" },
          );
        },
        (e) => setError(plain(e)),
      ),
    [meeting.id, uid],
  );
  return (
    <div>
      {["reason", "designation", "followup"].map((field) => (
        <label class="fl-field">
          {field[0].toUpperCase() + field.slice(1)}
          <textarea
            class="fl-input"
            maxLength={field === "designation" ? 120 : 2000}
            value={record[field] || ""}
            onInput={(e) => {
              dirty.current = true;
              setRecord({ ...record, [field]: e.currentTarget.value });
            }}
          />
        </label>
      ))}
      {changedElsewhere && (
        <p role="alert">
          This private record changed elsewhere. Your unsaved text is retained;
          reopen the person to compare before replacing it.
        </p>
      )}
      {error && (
        <p class="fl-error" role="alert">
          {error}
        </p>
      )}
      <Action
        disabled={changedElsewhere}
        onClick={async () => {
          await saveSensitive(meeting.id, uid, {
            reason: record.reason,
            followup: record.followup,
            designation: record.designation,
          });
          dirty.current = false;
        }}
      >
        Save private follow-up
      </Action>
    </div>
  );
}
function SensitiveAttendance({ meeting }) {
  const [uid, setUid] = useState(meeting.participantUids[0] || ""),
    [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Private attendance follow-up</summary>
      <p>
        Only the minutes editor and administrators may read these separate
        documents. Never included in the presentation or exports.
      </p>
      <PersonSelect
        label="Person"
        value={uid}
        onChange={setUid}
        people={S.members.filter((m) => meeting.participantUids.includes(m.id))}
      />
      {open && uid && <SensitiveRecord key={uid} meeting={meeting} uid={uid} />}
    </details>
  );
}
function TopicMinutes({ meeting, topic, editable, privateTopic }) {
  const discussion = useMeetingBuffer(
      meeting.id,
      `discussion-${topic.id}`,
      privateTopic?.discussion || "",
      (value) =>
        saveTopicMinutes(meeting.id, topic.id, privateTopic, {
          discussion: value,
        }),
      editable,
      meeting.status,
    ),
    outcome = useMeetingBuffer(
      meeting.id,
      `outcome-${topic.id}`,
      privateTopic?.outcome || "",
      (value) =>
        saveTopicMinutes(meeting.id, topic.id, privateTopic, {
          outcome: value,
        }),
      editable,
      meeting.status,
    );
  return (
    <section class="fl-section">
      <h3>{topic.title}</h3>
      <p>
        Presenter: {memberName(topic.presenterUid)} · {topic.duration} minutes ·{" "}
        {topic.status}
      </p>
      {[
        ["Discussion", discussion],
        ["Outcome", outcome],
      ].map(([label, b]) => (
        <label class="fl-field">
          {label}
          <textarea
            class="fl-input"
            value={b.value}
            maxLength="5000"
            readOnly={!editable}
            onInput={(e) => b.edit(e.currentTarget.value)}
            onBlur={b.flush}
          />
          <small role="status">{editable ? b.status : "Read only"}</small>
          <DraftRecovery buffer={b} />
          {editable && (
            <button
              type="button"
              class="fl-btn fl-btn--ghost"
              onClick={b.flush}
            >
              Save now
            </button>
          )}
        </label>
      ))}
      {canControl(meeting, S.me.id, isAdmin()) && (
        <Action
          onClick={() =>
            updateTopic(meeting.id, topic, { confirmedOutcome: outcome.value })
          }
        >
          Confirm outcome for presentation
        </Action>
      )}
    </section>
  );
}
function VersionHistory({ meeting, versions }) {
  const [older, setOlder] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [end, setEnd] = useState(false);
  const all = [...versions, ...older].filter(
    (v, i, a) => a.findIndex((x) => x.revision === v.revision) === i,
  );
  return (
    <details>
      <summary>Published version history</summary>
      {all.map((v) => (
        <p key={v.id}>
          Version {v.revision} ·{" "}
          {new Date(v.publishedAt).toLocaleString("en-GB", {
            timeZone: "Asia/Jakarta",
          })}
          <button
            class="fl-btn fl-btn--ghost"
            onClick={() => downloadMeetingDocument(readableRecord(v.record))}
          >
            Download version {v.revision}
          </button>
        </p>
      ))}
      {error && (
        <p class="fl-error" role="alert">
          {error}
        </p>
      )}
      <Action
        disabled={busy || end || !all.length}
        onClick={async () => {
          setBusy(true);
          try {
            const page = await getDocs(
              query(
                collection(db, "meetings", meeting.id, "versions"),
                orderBy("revision", "desc"),
                startAfter(all.at(-1).revision),
                limit(10),
              ),
            );
            setOlder([
              ...older,
              ...page.docs.map((d) => ({ id: d.id, ...d.data() })),
            ]);
            setEnd(page.size < 10);
            setError("");
          } catch (e) {
            setError(
              `Earlier versions could not load. ${plain(e)}`,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Load earlier versions
      </Action>
    </details>
  );
}
function PublishedMinutes({ record }) {
  const minutes = readableRecord(record);
  return (
    <article>
      <h2 class="fl-h2">
        Published minutes · Version {record.publishedVersion}
      </h2>
      <p>
        {record.name} · {record.date} · {record.startTime}–{record.endTime} ·{" "}
        {record.venue}
      </p>
      <p>
        Chair: {record.chairName || memberName(record.chairUid)} · Editor:{" "}
        {record.minutesTakerName || memberName(record.editorUid)}
      </p>
      <h3>Attendance</h3>
      {minutes.attendance.map((a) => (
        <p key={a.uid}>
          {a.name} · {a.status}
        </p>
      ))}
      <h3>Summary</h3>
      <p class="fl-pre">{record.summary}</p>
      <h3>Agenda and outcomes</h3>
      {record.agenda.map((a) => (
        <section class="fl-section" key={a.id}>
          <h4>{a.title}</h4>
          <p>
            {a.presenterName || memberName(a.presenterUid)} · {a.duration} min
          </p>
          <p class="fl-pre">{a.discussion}</p>
          <p class="fl-pre">Outcome: {a.outcome}</p>
        </section>
      ))}
      <h3>Decisions</h3>
      <p class="fl-pre">{record.decisions}</p>
      <h3>Actions</h3>
      {record.actions.map((a, i) => (
        <p key={i}>
          {a.text} · {memberName(a.ownerUid)} · {a.dueDate || "No due date"} ·{" "}
          {a.status}{" "}
          {a.taskId && (
            <a href={`#/p/${a.taskId}`} class="fl-link">
              Open task
            </a>
          )}
        </p>
      ))}
      <p class="fl-pre">{record.closing}</p>
      <p>Next meeting: {record.nextMeeting || "To be arranged"}</p>
      <button
        class="fl-btn fl-btn--ghost"
        onClick={() => downloadMeetingDocument(minutes)}
      >
        Download published version
      </button>
    </article>
  );
}
function Minutes({ data }) {
  const { meeting, draft, agenda, attendance: present, versions } = data;
  if (!draft)
    return (
      <>
        <p>
          Working minutes are visible to the assigned editor and administrators.
        </p>
        {versions[0]?.record ? (
          <>
            <PublishedMinutes record={versions[0].record} />
            <VersionHistory meeting={meeting} versions={versions} />
          </>
        ) : (
          <p>No published minutes yet.</p>
        )}
      </>
    );
  const editable = draft.editorUid === S.me.id && draft.status === "draft",
    published = versions[0]?.record;
  return (
    <>
      <h2 class="fl-h2">Minutes workspace</h2>
      <p>
        {memberName(draft.editorUid)} is the assigned editor. Version{" "}
        {draft.publishedVersion} · {draft.status}
      </p>
      <p class="fl-muted">
        Attendance reasons and private follow-up are kept separately and are
        excluded from published minutes and exports.
      </p>
      {["summary", "decisions", "closing", "nextMeeting"].map((field) => (
        <MinutesField
          key={field}
          meeting={meeting}
          draft={draft}
          field={field}
          label={
            {
              summary: "Discussion summary and outcomes",
              decisions: "Decisions",
              closing: "Closing wording",
              nextMeeting: "Next meeting / deferred items",
            }[field]
          }
          editable={editable}
        />
      ))}
      <h3>Agenda discussions and outcomes</h3>
      {agenda.map((topic) => (
        <TopicMinutes
          key={topic.id}
          meeting={meeting}
          topic={topic}
          privateTopic={data.topicMinutes?.find((p) => p.id === topic.id)}
          editable={editable}
        />
      ))}
      <ActionCapture meeting={meeting} draft={draft} />
      {editable && (
        <Action
          onClick={() => saveMinutes(meeting.id, draft, { status: "review" })}
        >
          Send for admin review
        </Action>
      )}
      {isAdmin() && draft.status === "review" && (
        <div class="fl-actions">
          <Action
            onClick={() =>
              publishMinutes(
                meeting,
                draft,
                agenda.map((topic) => ({
                  ...topic,
                  ...data.topicMinutes?.find((p) => p.id === topic.id),
                })),
                present,
              )
            }
          >
            Publish reviewed version
          </Action>
          <Action
            onClick={() => saveMinutes(meeting.id, draft, { status: "draft" })}
          >
            Return to editor
          </Action>
        </div>
      )}
      {isAdmin() && draft.status === "published" && (
        <Action
          onClick={() => saveMinutes(meeting.id, draft, { status: "draft" })}
        >
          Start a correction version
        </Action>
      )}
      {(isAdmin() || draft.editorUid === S.me.id) && (
        <SensitiveAttendance meeting={meeting} />
      )}
      {published && <GoogleExport record={published} />}
      {published && (
        <section class="fl-section">
          <h3>Published version {published.publishedVersion}</h3>
          <div class="fl-actions">
            <button
              class="fl-btn fl-btn--ghost"
              onClick={() => downloadMeetingDocument(readableRecord(published))}
            >
              Download document
            </button>
            <button
              class="fl-btn fl-btn--ghost"
              onClick={() => printMeeting(readableRecord(published))}
            >
              Print / save PDF
            </button>
          </div>
          <VersionHistory meeting={meeting} versions={versions} />
        </section>
      )}
    </>
  );
}
function MeetingTaskEdit({ meeting, task }) {
  const [title, setTitle] = useState(task.title),
    [notes, setNotes] = useState(task.notes || ""),
    [dueDate, setDue] = useState(task.dueDate || ""),
    [owner, setOwner] = useState(task.assigneeUids?.[0] || ""),
    [status, setTaskStatus] = useState(task.status);
  return (
    <details>
      <summary>Edit linked task in this meeting</summary>
      <label class="fl-field">
        Title
        <input
          class="fl-input"
          value={title}
          maxLength="120"
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
      </label>
      <label class="fl-field">
        Notes
        <textarea
          class="fl-input"
          value={notes}
          maxLength="5000"
          onInput={(e) => setNotes(e.currentTarget.value)}
        />
      </label>
      <PersonSelect label="Owner" value={owner} onChange={setOwner} />
      <label class="fl-field">
        Due date
        <input
          class="fl-input"
          type="date"
          value={dueDate}
          onChange={(e) => setDue(e.currentTarget.value)}
        />
      </label>
      <label class="fl-field">
        Status
        <select
          class="fl-input"
          value={status}
          onChange={(e) => setTaskStatus(e.currentTarget.value)}
        >
          <option value="todo">To do</option>
          <option value="done">Done</option>
        </select>
      </label>
      <Action
        onClick={() =>
          updateItem(task, {
            title,
            notes,
            status,
            dueDate: dueDate || null,
            assigneeUids: owner ? [owner] : [],
            meetingId: meeting.id,
          })
        }
      >
        Save linked task
      </Action>
    </details>
  );
}
export function MeetingHub({ id, room = false }) {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const data = useMeeting(id, room),
    { meeting, session, agenda, draft } = data,
    [tab, setTab] = useState("overview"),
    [follow, setFollow] = useState(true),
    [personal, setPersonal] = useState(null),
    [font, setFont] = useState(36),
    [roomControls, setRoomControls] = useState(false),
    [handoffUid, setHandoffUid] = useState("");
  if (data.error)
    return (
      <p class="fl-error" role="alert">
        Meeting could not load ({data.error}). Check your connection and reopen
        this link.
      </p>
    );
  if (!data.ready) return <p role="status">Loading meeting…</p>;
  if (!meeting)
    return (
      <>
        <Title light="Meeting." bold="Not prepared yet" />
        <p>
          Only an admin can prepare the persistent hub from a scheduled calendar
          meeting.
        </p>
        {isAdmin() && S.events.find((e) => e.id === id) && (
          <Action
            onClick={() => initializeMeeting(S.events.find((e) => e.id === id))}
          >
            Prepare meeting hub
          </Action>
        )}
        <a class="fl-link" href="#/calendar">
          Open calendar
        </a>
      </>
    );
  if (!session) return <p role="status">Loading live controls…</p>;
  const control = canControl(meeting, S.me.id, isAdmin()),
    topic = agenda.find(
      (a) => a.id === (follow ? session.activeTopicId : personal),
    ),
    tasks = taskReview(S.items, meeting.projectIds, isoDay());
  const controls = (
    <>
      {!control &&
        meeting.status !== "closed" &&
        (isAdmin() || meeting.cohostUids.includes(S.me.id)) && (
          <Action onClick={() => handoff(meeting, session, S.me.id)}>
            Take over as host
          </Action>
        )}
      <div class="fl-actions">
        {control && meeting.status === "prepared" && (
          <Action onClick={() => lifecycle(meeting, session, "live")}>
            Start meeting
          </Action>
        )}
        {control && meeting.status === "live" && (
          <Action onClick={() => lifecycle(meeting, session, "closed")}>
            Close meeting
          </Action>
        )}
        {control && meeting.status !== "closed" && (
          <>
            {MEETING_PHASES.map((phase) => (
              <Action
                key={phase}
                aria-pressed={session.phase === phase}
                onClick={() => controlMeeting(meeting, session, { phase })}
              >
                {phase}
              </Action>
            ))}
          </>
        )}
      </div>
      {control && meeting.status !== "closed" && (
        <div class="fl-actions">
          <PersonSelect
            label="Explicit handoff to"
            value={handoffUid}
            onChange={setHandoffUid}
            people={S.members.filter(
              (m) =>
                m.active &&
                m.role !== "teacher" &&
                meeting.participantUids.includes(m.id),
            )}
          />
          <Action
            disabled={!handoffUid}
            onClick={() => handoff(meeting, session, handoffUid)}
          >
            Hand over host
          </Action>
          <Action
            disabled={!handoffUid}
            onClick={() => handoff(meeting, session, handoffUid, "minutes")}
          >
            Hand over minutes
          </Action>
        </div>
      )}
    </>
  );
  if (room)
    return (
      <main class="fl-meeting-room" style={{ fontSize: `${font}px` }}>
        <header>
          <a class="fl-link" href={`#/meeting-hub/${id}`}>
            Leave presentation
          </a>
          <label>
            Text size{" "}
            <input
              type="range"
              min="24"
              max="72"
              value={font}
              onInput={(e) => setFont(Number(e.currentTarget.value))}
            />
          </label>
          <button
            class="fl-btn fl-btn--ghost"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            Fullscreen
          </button>
        </header>
        <p>
          {meeting.title} · {session.phase} · {meeting.status}
        </p>
        <h1>{topic?.title || "Ready for the meeting"}</h1>
        {session.timerStartedAt && (
          <p aria-label="Time remaining">
            {Math.max(
              0,
              Math.ceil(
                (session.timerStartedAt +
                  session.timerDuration * 60000 -
                  clock) /
                  1000,
              ),
            )}{" "}
            seconds remaining
          </p>
        )}
        <p>{memberName(session.presenterUid || topic?.presenterUid)}</p>
        {topic?.confirmedOutcome && <p>{topic.confirmedOutcome}</p>}
        {topic && (
          <TopicReferences meeting={meeting} topic={topic} control={false} />
        )}
        {topic?.confirmedDecisions && <p>{topic.confirmedDecisions}</p>}
        <p>
          {session.timerStartedAt
            ? `Timer began ${new Date(session.timerStartedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta" })} · ${session.timerDuration} minutes`
            : ""}
        </p>
        {control && meeting.status === "live" && (
          <section aria-label="Safe presentation controls">
            <button
              class="fl-btn fl-btn--ghost"
              aria-expanded={roomControls}
              onClick={() => setRoomControls(!roomControls)}
            >
              {roomControls ? "Hide host controls" : "Show host controls"}
            </button>
            {roomControls && (
              <div class="fl-actions">
                <Action
                  disabled={
                    agenda.findIndex((t) => t.id === session.activeTopicId) <= 0
                  }
                  onClick={() => {
                    const next =
                      agenda[
                        Math.max(
                          0,
                          agenda.findIndex(
                            (t) => t.id === session.activeTopicId,
                          ) - 1,
                        )
                      ];
                    return controlMeeting(meeting, session, {
                      activeTopicId: next.id,
                      presenterUid: next.presenterUid,
                      timerStartedAt: Date.now(),
                      timerDuration: next.duration,
                    });
                  }}
                >
                  Previous topic
                </Action>
                <Action
                  disabled={
                    !agenda.length ||
                    agenda.findIndex((t) => t.id === session.activeTopicId) >=
                      agenda.length - 1
                  }
                  onClick={() => {
                    const next =
                      agenda[
                        Math.min(
                          agenda.length - 1,
                          agenda.findIndex(
                            (t) => t.id === session.activeTopicId,
                          ) + 1,
                        )
                      ];
                    return controlMeeting(meeting, session, {
                      activeTopicId: next.id,
                      presenterUid: next.presenterUid,
                      timerStartedAt: Date.now(),
                      timerDuration: next.duration,
                    });
                  }}
                >
                  Next topic
                </Action>
                <Action
                  onClick={() =>
                    controlMeeting(meeting, session, {
                      phase:
                        MEETING_PHASES[
                          Math.min(
                            MEETING_PHASES.length - 1,
                            MEETING_PHASES.indexOf(session.phase) + 1,
                          )
                        ],
                    })
                  }
                >
                  Next phase
                </Action>
                <Action
                  onClick={() =>
                    controlMeeting(meeting, session, {
                      timerStartedAt: Date.now(),
                      timerDuration: topic?.duration || 5,
                    })
                  }
                >
                  Restart timer
                </Action>
                <Action
                  onClick={() =>
                    controlMeeting(meeting, session, { timerStartedAt: null })
                  }
                >
                  Stop timer
                </Action>
              </div>
            )}
          </section>
        )}
        <footer>
          <p>
            Use these public controls for a mirrored display, or keep a separate
            host window on an extended display. Private minutes never appear
            here.
          </p>
        </footer>
      </main>
    );
  return (
    <>
      <Title light={`${meeting.title}.`} bold="Meeting hub" />
      <p>
        {meeting.date} · {meeting.startTime}–{meeting.endTime} · {meeting.venue}{" "}
        · Asia/Jakarta
      </p>
      <p class="fl-save-state" role="status">
        {data.pending
          ? "Pending sync"
          : data.cached
            ? "Offline / cached copy"
            : "Confirmed by server"}{" "}
        · {meeting.status}
      </p>
      <p role="status">Live phase: {session.phase}</p>
      <nav class="fl-meeting-tabs" aria-label="Meeting sections">
        {["overview", "agenda", "updates", "minutes"].map((t) => (
          <button
            class="fl-btn fl-btn--ghost"
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <a
          class="fl-btn fl-btn--ghost"
          target="_blank"
          rel="noopener"
          href={`#/meeting-room/${id}`}
        >
          Open presentation
        </a>
      </nav>
      {tab === "overview" && (
        <>
          <h2 class="fl-h2">Responsibilities and live session</h2>
          <p>
            Chair: {memberName(meeting.chairUid)} · Host:{" "}
            {memberName(meeting.hostUid)} · Minutes:{" "}
            {memberName(meeting.minutesUid)}
          </p>
          {controls}
          {isAdmin() && meeting.status === "prepared" && (
            <details>
              <summary>Meeting responsibilities and project scope</summary>
              <PersonSelect
                label="Chair"
                value={meeting.chairUid}
                onChange={(chairUid) => changeMeeting(meeting, { chairUid })}
              />
              <PersonSelect
                label="Minutes backup (explicit handoff required)"
                value={meeting.minutesBackupUid}
                onChange={(minutesBackupUid) =>
                  changeMeeting(meeting, { minutesBackupUid })
                }
              />
              <fieldset>
                <legend>Cohosts</legend>
                {S.members
                  .filter(
                    (m) =>
                      m.active &&
                      m.role !== "teacher" &&
                      meeting.participantUids.includes(m.id),
                  )
                  .map((m) => (
                    <label class="fl-check">
                      <input
                        type="checkbox"
                        checked={meeting.cohostUids.includes(m.id)}
                        onChange={(e) =>
                          changeMeeting(meeting, {
                            cohostUids: e.currentTarget.checked
                              ? [...meeting.cohostUids, m.id]
                              : meeting.cohostUids.filter(
                                  (uid) => uid !== m.id,
                                ),
                          })
                        }
                      />
                      {m.name}
                    </label>
                  ))}
              </fieldset>
              <fieldset>
                <legend>
                  Projects allowed for temporary minutes task capture
                </legend>
                {S.items
                  .filter((p) => p.kind === "project")
                  .map((p) => (
                    <label class="fl-check">
                      <input
                        type="checkbox"
                        checked={meeting.projectIds.includes(p.id)}
                        onChange={(e) =>
                          changeMeeting(meeting, {
                            projectIds: e.currentTarget.checked
                              ? [...meeting.projectIds, p.id]
                              : meeting.projectIds.filter((id) => id !== p.id),
                          })
                        }
                      />
                      {p.title}
                    </label>
                  ))}
              </fieldset>
            </details>
          )}
          <section class="fl-section">
            <h2 class="fl-h2">Reply to this meeting</h2>
            <p>
              Reply, not attendance.{" "}
              {(data.rsvps || []).filter((r) => r.status === "going").length}{" "}
              going ·{" "}
              {(data.rsvps || []).filter((r) => r.status === "not").length}{" "}
              cannot attend. Your reply:{" "}
              {(data.rsvps || []).find((r) => r.uid === S.me.id)?.status ||
                "Not answered"}
              .
            </p>
            <div class="fl-actions">
              <Action
                disabled={S.me.role === "teacher"}
                onClick={() => rsvp({ id: meeting.eventId }, "going")}
              >
                Going
              </Action>
              <Action
                disabled={S.me.role === "teacher"}
                onClick={() => rsvp({ id: meeting.eventId }, "not")}
              >
                Cannot attend
              </Action>
              <a
                class="fl-link"
                href={`#/calendar?d=${meeting.date}&e=${meeting.eventId}`}
              >
                Open scheduled event
              </a>
            </div>
            <h2 class="fl-h2">Frozen invitees and attendance</h2>
            <details>
              <summary>{meeting.participantUids.length} invited people</summary>
              {meeting.participantUids.map((uid) => (
                <div class="fl-actions" key={uid}>
                  <span>{memberName(uid)}</span>
                  {control || draft?.editorUid === S.me.id ? (
                    <select
                      class="fl-input"
                      aria-label={`Attendance for ${memberName(uid)}`}
                      value={
                        data.attendance.find((a) => a.uid === uid)?.status ||
                        "absent"
                      }
                      onChange={(e) =>
                        attendance(id, uid, e.currentTarget.value)
                      }
                    >
                      {ATTENDANCE.map((s) => (
                        <option value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      {data.attendance.find((a) => a.uid === uid)?.status ||
                        "Not recorded"}
                    </span>
                  )}
                </div>
              ))}
            </details>
          </section>
          <section class="fl-section">
            <h2 class="fl-h2">Current topic</h2>
            <p>
              Live phase: {session.phase} ·{" "}
              {topic?.title || "No topic selected"}
            </p>
            {session.timerStartedAt && (
              <p>
                {Math.max(
                  0,
                  Math.ceil(
                    (session.timerStartedAt +
                      session.timerDuration * 60000 -
                      clock) /
                      1000,
                  ),
                )}{" "}
                seconds remaining
              </p>
            )}
            {control && meeting.status === "live" && (
              <div class="fl-actions">
                <Action
                  onClick={() =>
                    controlMeeting(meeting, session, {
                      timerStartedAt: Date.now(),
                      timerDuration: topic?.duration || 5,
                    })
                  }
                >
                  Restart timer
                </Action>
                <Action
                  onClick={() =>
                    controlMeeting(meeting, session, { timerStartedAt: null })
                  }
                >
                  Stop timer
                </Action>
                {topic && (
                  <Action
                    onClick={() => updateTopic(id, topic, { status: "done" })}
                  >
                    Mark topic complete
                  </Action>
                )}
              </div>
            )}
            <label class="fl-check">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.currentTarget.checked)}
              />
              Follow host
            </label>
            {!follow && (
              <button
                class="fl-btn fl-btn--ghost"
                onClick={() => setFollow(true)}
              >
                Return to live
              </button>
            )}
            <div class="fl-actions">
              {agenda.map((a) => (
                <button
                  class="fl-btn fl-btn--ghost"
                  key={a.id}
                  onClick={() => {
                    setFollow(false);
                    setPersonal(a.id);
                  }}
                >
                  {a.title}
                </button>
              ))}
            </div>
            {control && meeting.status === "live" && (
              <div class="fl-actions">
                {agenda.map((a) => (
                  <Action
                    key={a.id}
                    onClick={() =>
                      controlMeeting(meeting, session, {
                        activeTopicId: a.id,
                        presenterUid: a.presenterUid,
                        timerStartedAt: Date.now(),
                        timerDuration: a.duration,
                      })
                    }
                  >
                    Present {a.title}
                  </Action>
                ))}
              </div>
            )}
            <Contribution meeting={meeting} topicId={topic?.id} />
          </section>
          <h2 class="fl-h2">Task review</h2>
          <p>
            Blocked and overdue first. {tasks.length} linked tasks in the
            complete review list.
          </p>
          {tasks.map((t) => (
            <div key={t.id}>
              <TaskRow t={t} />
              {draft?.editorUid === S.me.id && meeting.status === "live" && (
                <MeetingTaskEdit meeting={meeting} task={t} />
              )}
              {draft?.editorUid === S.me.id &&
                meeting.status === "live" &&
                !canWork(t) && (
                  <Action
                    onClick={() =>
                      updateItem(t, {
                        status: t.status === "done" ? "todo" : "done",
                        meetingId: id,
                      })
                    }
                  >
                    Record {t.status === "done" ? "reopened" : "completed"} in
                    meeting
                  </Action>
                )}
            </div>
          ))}
        </>
      )}
      {tab === "agenda" && <Agenda data={data} control={control} />}
      {tab === "updates" && (
        <>
          <h2 class="fl-h2">Member updates</h2>
          <p>
            Reuse this week’s check-in, or submit an update with attribution
            below.
          </p>
          {meeting.participantUids.map((uid) => {
            const checkin = S.checkins.find(
              (c) => c.uid === uid && c.weekId === week().id,
            );
            return (
              <section class="fl-section" key={uid}>
                <h3>{memberName(uid)}</h3>
                {checkin ? (
                  <p>
                    Week {checkin.weekId}: Done: {checkin.done} · Next:{" "}
                    {checkin.doing} · Blocked: {checkin.blocked}
                  </p>
                ) : (
                  <p>No check-in this week.</p>
                )}
              </section>
            );
          })}
          <Contribution meeting={meeting} type="update" />
        </>
      )}
      {tab === "minutes" && <Minutes data={data} />}
      <section class="fl-section">
        <h2 class="fl-h2">Meeting notices</h2>
        {(data.notices || []).length > 0 && (
          <Action
            onClick={() =>
              markMeetingRead(
                meeting,
                Math.max(...data.notices.map((n) => n.revision)),
              )
            }
          >
            Mark notices as read
          </Action>
        )}
        <Action
          onClick={() =>
            navigator.clipboard.writeText(
              `${meeting.title} — ${meeting.date} ${meeting.startTime}–${meeting.endTime}, ${meeting.venue}. Open meeting: ${location.href.split("#")[0]}#/meeting-hub/${id}`,
            )
          }
        >
          Copy WhatsApp summary and link
        </Action>
        {(data.notices || []).map((n) => (
          <p key={n.id}>
            <a class="fl-link" href={n.href}>
              {n.type} · {memberName(n.actorUid)} ·{" "}
              {new Date(n.createdAt).toLocaleString("en-GB", {
                timeZone: "Asia/Jakarta",
              })}
            </a>
          </p>
        ))}
      </section>
      <section class="fl-section">
        <h2 class="fl-h2">Questions and contributions</h2>
        <p>
          Speaking queue:{" "}
          {session.queue.map(memberName).join(", ") || "No one queued"}
        </p>
        {control && meeting.status === "live" && session.queue.length > 0 && (
          <Action
            onClick={() =>
              controlMeeting(meeting, session, {
                presenterUid: session.queue[0],
                queue: session.queue.slice(1),
              })
            }
          >
            Call next speaker
          </Action>
        )}
        {data.contributions
          .filter((c) => c.type !== "suggestion")
          .map((c) => (
            <div key={c.id}>
              <p>{c.text}</p>
              <small>
                {memberName(c.authorUid)} · {c.type} ·{" "}
                {new Date(c.createdAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Jakarta",
                })}
              </small>
              {control &&
                meeting.status === "live" &&
                !session.queue.includes(c.authorUid) && (
                  <Action
                    onClick={() =>
                      controlMeeting(meeting, session, {
                        queue: [...session.queue, c.authorUid],
                      })
                    }
                  >
                    Add speaker to queue
                  </Action>
                )}
            </div>
          ))}
      </section>
    </>
  );
}
