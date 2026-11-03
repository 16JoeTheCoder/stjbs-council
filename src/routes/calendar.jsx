// Calendar: a week grid (06:00 to 18:00) and a month view, all dates as Jakarta 'YYYY-MM-DD' strings so month and
// year boundaries are plain string arithmetic. Events outside 06:00 to 18:00 and root-project due dates sit in the
// all-day row. The store listens to -7..+60 days; a page turn outside that window reads the visible range once.
import { useEffect, useRef, useState } from "preact/hooks";
import {
  getDocs,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { S, memberName } from "../store.js";
import { isAdmin, tree } from "../model.js";
import { archiveEvent, rsvp } from "../actions.js";
import {
  remainingEvents,
  calendarLanes,
  eventDefaults,
  nextThursday,
  resolveParticipants,
} from "../event-model.js";
import {
  loadEventRequestHistory,
  saveEventProposal,
  transitionEventRequest,
  useEventPolicy,
} from "../event-actions.js";
import { ParticipantFields } from "./event-settings.jsx";
import {
  addDays,
  addMonths,
  fmtDay,
  isoDay,
  monday,
  monthName,
  monthStart,
  toMin,
} from "../time.js";
import { EVENT_AHEAD_DAYS, EVENT_BACK_DAYS, eventsQuery } from "../queries.js";
import { Icon, Sheet } from "../shared.jsx";
import { Empty, Panel, Title, useAutofocus } from "../ui.jsx";
import { EventTag } from "./home.jsx";
import { wa } from "./projects.jsx";
import sunset from "../../design/fiatlux/img/campus-sunset.webp";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EV_CLASS = {
  meeting: "fl-ev",
  project: "fl-ev fl-ev--deep",
  committee: "fl-ev fl-ev--committee",
  other: "fl-ev fl-ev--quiet",
};
const inGrid = (e) => !e.allDay && !!e.start && !!e.end;
const go = (patch, q) => {
  const p = new URLSearchParams(q);
  for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k);
  location.hash = `#/calendar?${p}`;
};

// Events for [from, to]: the store's window, plus a one-off read when the range leaves it.
function useEvents(from, to, tick) {
  const today = isoDay(),
    lo = addDays(today, -EVENT_BACK_DAYS),
    hi = addDays(today, EVENT_AHEAD_DAYS);
  const outside = from < lo || to > hi,
    [extra, setExtra] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!outside) return;
    let live = true;
    setExtra([]);
    setError("");
    setLoading(true);
    getDocs(eventsQuery(S.term.termId, today, from, to)).then(
      (s) => {
        if (live) {
          setExtra(s.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        }
      },
      (e) => {
        if (live) {
          setError(
            `Events for these dates did not load (${e.code || "connection error"}). Use Reload dates to try again.`,
          );
          setLoading(false);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [from, to, outside, tick]); // tick re-reads after this page saves or archives an event outside the window
  const byId = new Map(
    [...(outside ? extra : []), ...S.events].map((e) => [e.id, e]),
  );
  return {
    events: [...byId.values()]
      .filter((e) => !e.archived && e.date >= from && e.date <= to)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
      ),
    error: outside ? error : "",
    loading: outside && loading,
  };
}
const dueMarkers = (from, to) =>
  (tree().kids.root || []).filter(
    (r) => r.dueDate && r.dueDate >= from && r.dueDate <= to,
  );

const Chip = ({ e, q, day }) => (
  <button
    class={EV_CLASS[e.type] || "fl-ev"}
    onClick={() => go({ e: e.id }, q)}
  >
    {e.title}
    <small>
      {day ? `${fmtDay(e.date)}, ` : ""}
      {e.allDay ? "All day" : `${e.start} to ${e.end}`}
    </small>
  </button>
);
const Due = ({ r }) => (
  <a class="fl-ev fl-ev--quiet" href={`#/p/${r.id}`}>
    Due: {r.title}
  </a>
);

function Week({ start, events, q }) {
  const today = isoDay(),
    days = DOW.map((_, i) => addDays(start, i)),
    end = days[6],
    box = useRef();
  // On a phone the grid scrolls sideways; open it at today rather than Monday.
  useEffect(() => {
    const el = box.current?.querySelector('[aria-current="date"]');
    if (el) box.current.scrollLeft = el.offsetLeft - 64;
  }, [start]);
  const allDay = events.filter((e) => !inGrid(e)),
    timed = events.filter(inGrid),
    dues = dueMarkers(start, end);
  const dayStart = Math.min(
      6 * 60,
      ...timed.map((e) => Math.floor(toMin(e.start) / 60) * 60),
    ),
    dayEnd = Math.max(
      18 * 60,
      ...timed.map((e) => Math.ceil(toMin(e.end) / 60) * 60),
    ),
    rows = (dayEnd - dayStart) / 30;
  return (
    <>
      {(allDay.length > 0 || dues.length > 0) && (
        <div class="fl-cal__allday" aria-label="All day and due dates">
          {allDay.map((e) => (
            <Chip key={e.id} e={e} q={q} day />
          ))}
          {dues.map((r) => (
            <Due key={r.id} r={r} />
          ))}
        </div>
      )}
      <div class="fl-cal fl-scroll" ref={box}>
        <div
          class="fl-cal__grid"
          style={{ gridTemplateRows: `64px repeat(${rows}, 28px)` }}
          role="grid"
          aria-label={`Week of ${fmtDay(start)}`}
        >
          {days.map((d, i) => (
            <div
              key={d}
              class="fl-cal__day"
              style={{ gridColumn: i + 2 }}
              aria-current={d === today ? "date" : undefined}
            >
              {DOW[i]}
              <b>{Number(d.slice(8))}</b>
            </div>
          ))}
          <div
            class="fl-cal__bg"
            style={{ gridRow: `2 / ${rows + 2}` }}
            aria-hidden="true"
          />
          {days.includes(today) && (
            <div
              class="fl-cal__today"
              style={{
                gridColumn: days.indexOf(today) + 2,
                gridRow: `2 / ${rows + 2}`,
              }}
              aria-hidden="true"
            />
          )}
          {Array.from({ length: (dayEnd - dayStart) / 60 }, (_, h) => (
            <span key={h} class="fl-cal__hour" style={{ gridRow: 2 + h * 2 }}>
              {String(dayStart / 60 + h).padStart(2, "0")}:00
            </span>
          ))}
          {calendarLanes(timed).map((e) => {
            const s = (toMin(e.start) - dayStart) / 30,
              span = Math.max(
                1,
                Math.round((toMin(e.end) - toMin(e.start)) / 30),
              );
            return (
              <button
                key={e.id}
                class={EV_CLASS[e.type] || "fl-ev"}
                style={{
                  gridColumn: days.indexOf(e.date) + 2,
                  gridRow: `${2 + Math.floor(s)} / span ${span}`,
                  width: `calc(${100 / e.calendarLanes}% - 8px)`,
                  marginLeft: `calc(${(e.calendarLane * 100) / e.calendarLanes}% + 4px)`,
                  marginRight: 0,
                  justifySelf: "start",
                }}
                onClick={() => go({ e: e.id }, q)}
              >
                {e.title}
                <small>
                  {e.start} to {e.end}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Month({ anchor, events, q }) {
  const first = monthStart(anchor),
    next = addMonths(anchor, 1),
    today = isoDay();
  const start = monday(first),
    cells = [];
  for (let d = start; d < next || cells.length % 7; d = addDays(d, 1))
    cells.push(d);
  const dues = dueMarkers(start, cells.at(-1));
  return (
    <div class="fl-scroll">
      <div class="fl-month fl-month--head" aria-hidden="true">
        {DOW.map((d) => (
          <div key={d} class="fl-eyebrow">
            {d}
          </div>
        ))}
      </div>
      <div class="fl-month" role="grid" aria-label={monthName(first)}>
        {cells.map((d) => {
          const list = events.filter((e) => e.date === d),
            due = dues.filter((r) => r.dueDate === d);
          return (
            <div
              key={d}
              class={d.slice(0, 7) === first.slice(0, 7) ? "" : "is-other"}
              aria-current={d === today ? "date" : undefined}
            >
              <b>{Number(d.slice(8))}</b>
              {list.slice(0, 3).map((e) => (
                <Chip key={e.id} e={e} q={q} />
              ))}
              {list.length > 3 && (
                <button
                  class="fl-linkbtn fl-small"
                  onClick={() => go({ v: "week", d }, q)}
                >
                  +{list.length - 3} more
                </button>
              )}
              {due.map((r) => (
                <Due key={r.id} r={r} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventSheet({ ev, q, edit, archived, cancel, groups = [] }) {
  const current = resolveParticipants(
      ev.participantSelection,
      S.members,
      groups,
    ),
    added = current.filter((uid) => !ev.participantUids?.includes(uid)),
    removed = (ev.participantUids || []).filter(
      (uid) => !current.includes(uid),
    );
  const [rs, setRs] = useState(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "rsvps"), where("eventId", "==", ev.id)),
        (s) => setRs(s.docs.map((d) => d.data())),
        () => setRs(false),
      ),
    [ev.id],
  );
  const mine = rs && rs.find((r) => r.uid === S.me.id)?.status,
    n = (st) => (rs ? rs.filter((r) => r.status === st).length : 0);
  const canEdit =
    S.me.role !== "teacher" && (ev.createdByUid === S.me.id || isAdmin());
  const text = `${ev.title}\n${fmtDay(ev.date)}, ${ev.start} to ${ev.end}${ev.location ? `\n${ev.location}` : ""}\n${location.origin}/app/#/calendar?d=${ev.date}&e=${ev.id}`;
  return (
    <Sheet label={ev.title} onClose={() => go({ e: null }, q)}>
      <span class="fl-eyebrow fl-eyebrow--red">
        {fmtDay(ev.date)} · {ev.allDay ? "All day" : `${ev.start} to ${ev.end}`}
      </span>
      <h1>{ev.title}</h1>
      <div class="fl-stats">
        <EventTag type={ev.type} />
        {ev.public && <span class="fl-tag fl-tag--public">Public</span>}
        {ev.location && <span>{ev.location}</span>}
        {ev.itemId && tree().byId[ev.itemId] && (
          <a class="fl-link" href={`#/p/${ev.itemId}`}>
            {tree().byId[ev.itemId].title}
          </a>
        )}
      </div>
      {ev.notes && <p class="fl-pre">{ev.notes}</p>}
      {ev.participantUids && (
        <p class="fl-small fl-muted">
          Invited:{" "}
          {ev.participantUids.length
            ? ev.participantUids.map(memberName).join(", ")
            : "No participants selected"}
        </p>
      )}
      {ev.participantSelection && (added.length > 0 || removed.length > 0) && (
        <details>
          <summary>
            Membership changed since scheduling · {added.length} additions,{" "}
            {removed.length} removals
          </summary>
          <p>
            Newly selected: {added.map(memberName).join(", ") || "None"}. No
            longer selected: {removed.map(memberName).join(", ") || "None"}.
            Frozen invitations remain unchanged. Edit this event to preview and
            explicitly apply an audience change.
          </p>
        </details>
      )}
      {ev.type === "meeting" && (
        <a class="fl-btn fl-btn--ghost" href={`#/meeting-hub/${ev.id}`}>
          Open meeting hub
        </a>
      )}
      <section class="fl-section" aria-label="RSVP">
        {rs === false ? (
          <p class="fl-error" role="alert">
            Replies did not load. Reload to try again.
          </p>
        ) : (
          <div class="fl-actions">
            <button
              class={`fl-btn fl-btn--sm ${mine === "going" ? "fl-btn--red" : "fl-btn--ghost"}`}
              aria-pressed={mine === "going"}
              disabled={S.me.role === "teacher"}
              onClick={() => rsvp(ev, "going")}
            >
              Going <span class="fl-mono">{n("going")}</span>
            </button>
            <button
              class={`fl-btn fl-btn--sm ${mine === "not" ? "fl-btn--red" : "fl-btn--ghost"}`}
              aria-pressed={mine === "not"}
              disabled={S.me.role === "teacher"}
              onClick={() => rsvp(ev, "not")}
            >
              Can't go <span class="fl-mono">{n("not")}</span>
            </button>
          </div>
        )}
        {rs && n("going") > 0 && (
          <p class="fl-small fl-muted">
            Going:{" "}
            {rs
              .filter((r) => r.status === "going")
              .map((r) => memberName(r.uid).split(" ")[0])
              .join(", ")}
          </p>
        )}
      </section>
      <div class="fl-actions">
        <a
          class="fl-btn fl-btn--ghost fl-btn--sm"
          href={wa(text)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon n="share" />
          Share to WhatsApp
        </a>
        {canEdit && (
          <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={edit}>
            Edit event
          </button>
        )}
        {canEdit && ev.requestId && cancel && (
          <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={cancel}>
            Cancel event
          </button>
        )}
        {canEdit && !ev.requestId && (
          <button
            class="fl-btn fl-btn--ghost fl-btn--sm"
            onClick={() =>
              confirm(
                `Archive "${ev.title}"? It disappears from the calendar.`,
              ) &&
              archiveEvent(ev).then((ok) => {
                if (ok) {
                  archived();
                  go({ e: null }, q);
                }
              })
            }
          >
            Archive event
          </button>
        )}
      </div>
    </Sheet>
  );
}

const TYPES = [
  ["meeting", "Meeting"],
  ["project", "Project"],
  ["committee", "Committee"],
  ["other", "Other"],
];
function EventForm({ ev, request, day, done, policy }) {
  const [templateId, setTemplate] = useState(
    request?.proposal?.configSnapshot?.templateId ||
      ev?.configSnapshot?.templateId ||
      policy.settings?.defaultTemplateId ||
      "",
  );
  const [participantsChanged, setParticipantsChanged] = useState(
    !ev && !request,
  );
  const source = request?.proposal || ev;
  const initial = source
    ? {
        ...source.configSnapshot?.defaults,
        ...source,
        ...source.meetingDefaults,
      }
    : null;
  const [v, setV] = useState(
    initial
      ? {
          ...initial,
          notes: initial.notes || "",
          location: initial.location || "",
          itemId: initial.itemId || "",
        }
      : (() => {
          const defaults = eventDefaults(
            policy.settings,
            policy.templates.find(
              (t) =>
                t.id === policy.settings?.defaultTemplateId &&
                t.available !== false,
            ),
          );
          return {
            ...defaults,
            date: defaults.type === "meeting" ? nextThursday(day) : day,
            public: false,
          };
        })(),
  );
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    ref = useAutofocus();
  const on = (k) => (e) =>
    setV({
      ...v,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });
  const baselineInvites =
    ev?.participantUids || request?.proposal?.participantUids || [];
  const previewInvites =
    participantsChanged || (!ev && !request)
      ? resolveParticipants(v.participantSelection, S.members, policy.groups)
      : baselineInvites;
  const addedInvites = previewInvites.filter(
      (uid) => !baselineInvites.includes(uid),
    ),
    removedInvites = baselineInvites.filter(
      (uid) => !previewInvites.includes(uid),
    );
  const locked = ev?.public && !isAdmin(); // a public event's text and time are reviewed by an admin
  const submit = async (e) => {
    e.preventDefault();
    const draft = e.submitter?.value === "draft";
    if (!v.title.trim()) return setErr("Add a title, then save.");
    if (!v.date || !v.start || !v.end)
      return setErr("Add the date, start and end time.");
    if (v.end <= v.start)
      return setErr(
        "The end time must be after the start. Change one of them.",
      );
    setErr("");
    setBusy(true);
    const data = {
      title: v.title.trim().slice(0, 80),
      type: v.type,
      date: v.date,
      start: v.start,
      end: v.end,
      allDay: !!v.allDay,
      location: v.location.trim().slice(0, 120),
      notes: v.notes.slice(0, 1000),
      customValues: v.customValues || {},
      ...Object.fromEntries(
        [
          "agenda",
          "minutes",
          "instructions",
          "chairUid",
          "minutesUid",
          "minutesBackupUid",
          "cohostUids",
          "duration",
        ]
          .filter((k) => v[k] !== undefined)
          .map((k) => [k, v[k]]),
      ),
      participantSelection: v.participantSelection,
      public: isAdmin() ? v.public : (ev?.public ?? false),
      itemId: v.itemId || null,
    };
    if (
      await saveEventProposal({
        event: ev,
        request,
        data,
        templateId: templateId || null,
        draft,
        participantsChanged,
      })
    )
      done();
    setBusy(false);
  };
  const field = (k, label, type = "text", extra = {}) => (
    <div class="fl-field">
      <label for={`ev-${k}`}>{label}</label>
      <input
        id={`ev-${k}`}
        class="fl-input"
        type={type}
        value={v[k]}
        onInput={on(k)}
        disabled={locked}
        {...extra}
      />
    </div>
  );
  return (
    <form class="fl-panel fl-form" onSubmit={submit} ref={ref} noValidate>
      <h2 class="fl-h2">
        {ev ? "Edit event" : request ? "Edit request" : "Add event"}
      </h2>
      {!ev && (
        <div class="fl-field">
          <label for="ev-template">Event template</label>
          <select
            id="ev-template"
            class="fl-input"
            value={templateId}
            onChange={(e) => {
              const id = e.target.value;
              setTemplate(id);
              const defaults = eventDefaults(
                policy.settings,
                policy.templates.find((t) => t.id === id),
              );
              setV({
                ...defaults,
                date:
                  defaults.type === "meeting" ? nextThursday(v.date) : v.date,
                public: false,
              });
            }}
          >
            <option value="">Blank event</option>
            {policy.templates
              .filter((t) => t.available !== false)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · v{t.version}
                </option>
              ))}
          </select>
        </div>
      )}
      {locked && (
        <p class="fl-small fl-muted">
          This event is on the public website, so only an admin can change its
          title, type, time and place.
        </p>
      )}
      {field("title", "Title", "text", { maxLength: 80 })}
      <div class="fl-fields">
        <div class="fl-field">
          <label for="ev-type">Type</label>
          <select
            id="ev-type"
            class="fl-input"
            value={v.type}
            onChange={on("type")}
            disabled={locked}
          >
            {TYPES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {field("date", "Date", "date")}
        {!v.allDay && (
          <>
            {field("start", "Start", "time")}
            {field("end", "End", "time")}
          </>
        )}
      </div>
      <label class="fl-checkrow">
        <input
          type="checkbox"
          class="fl-switch"
          checked={!!v.allDay}
          onChange={on("allDay")}
          disabled={locked}
        />
        All-day event
      </label>
      {field("location", "Place", "text", { maxLength: 120 })}
      <div class="fl-field">
        <label for="ev-item">Project</label>
        <select
          id="ev-item"
          class="fl-input"
          value={v.itemId}
          onChange={on("itemId")}
        >
          <option value="">None</option>
          {(tree().kids.root || []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>
      <div class="fl-field">
        <label for="ev-notes">Notes</label>
        <textarea
          id="ev-notes"
          class="fl-input"
          rows={3}
          maxLength={1000}
          value={v.notes}
          onInput={on("notes")}
        />
      </div>
      {(
        v.customFields ||
        initial?.configSnapshot?.defaults?.customFields ||
        []
      ).map((f) => (
        <div key={f.id} class="fl-field">
          <label for={`event-custom-${f.id}`}>
            {f.label}
            {f.required ? " (required)" : " (optional)"}
          </label>
          {f.type === "checkbox" ? (
            <input
              id={`event-custom-${f.id}`}
              type="checkbox"
              class="fl-switch"
              checked={!!v.customValues?.[f.id]}
              onChange={(e) =>
                setV({
                  ...v,
                  customValues: { ...v.customValues, [f.id]: e.target.checked },
                })
              }
            />
          ) : f.type === "select" ? (
            <select
              id={`event-custom-${f.id}`}
              class="fl-input"
              value={v.customValues?.[f.id] || ""}
              onChange={(e) =>
                setV({
                  ...v,
                  customValues: { ...v.customValues, [f.id]: e.target.value },
                })
              }
            >
              <option value="">Choose an option</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              id={`event-custom-${f.id}`}
              class="fl-input"
              rows={3}
              maxLength={1000}
              value={v.customValues?.[f.id] || ""}
              onInput={(e) =>
                setV({
                  ...v,
                  customValues: { ...v.customValues, [f.id]: e.target.value },
                })
              }
            />
          ) : (
            <input
              id={`event-custom-${f.id}`}
              class="fl-input"
              maxLength={1000}
              value={v.customValues?.[f.id] || ""}
              onInput={(e) =>
                setV({
                  ...v,
                  customValues: { ...v.customValues, [f.id]: e.target.value },
                })
              }
            />
          )}
        </div>
      ))}
      {v.type === "meeting" && (
        <>
          <div class="fl-fields">
            {[
              ["chairUid", "Chair"],
              ["minutesUid", "Minute taker"],
              ["minutesBackupUid", "Backup minute taker"],
            ].map(([k, label]) => (
              <div class="fl-field" key={k}>
                <label for={`event-${k}`}>{label}</label>
                <select
                  id={`event-${k}`}
                  class="fl-input"
                  value={v[k] || ""}
                  onChange={(e) => setV({ ...v, [k]: e.target.value || null })}
                >
                  <option value="">Choose later</option>
                  {S.members
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
          {["agenda", "minutes", "instructions"].map((k) => (
            <div class="fl-field" key={k}>
              <label for={`event-${k}`}>
                {
                  {
                    agenda: "Agenda",
                    minutes: "Minutes skeleton",
                    instructions: "Participant instructions",
                  }[k]
                }
              </label>
              <textarea
                id={`event-${k}`}
                class="fl-input"
                rows={3}
                maxLength={k === "instructions" ? 1000 : 4000}
                value={v[k] || ""}
                onInput={on(k)}
              />
            </div>
          ))}
        </>
      )}
      <ParticipantFields
        value={v.participantSelection}
        groups={policy.groups}
        onChange={(s) => {
          setParticipantsChanged(true);
          setV({ ...v, participantSelection: s });
        }}
      />
      <p class="fl-small fl-muted">
        {previewInvites.length} invited people.{" "}
        {!isAdmin() && ev?.requestId
          ? "Changes go to an admin for approval. The current event stays scheduled while changes are reviewed."
          : isAdmin()
            ? "Admins can schedule directly."
            : eventDefaults(
                  policy.settings,
                  policy.templates.find((t) => t.id === templateId),
                  { type: v.type },
                ).approval === "required" || ev?.requestId
              ? "This event goes to an admin for approval. The current event stays scheduled while changes are reviewed."
              : "This event can be scheduled immediately."}
      </p>
      {participantsChanged && (ev || request) && (
        <p class="fl-small fl-muted">
          Invitation changes:{" "}
          {addedInvites.length
            ? `add ${addedInvites.map(memberName).join(", ")}`
            : "no additions"}
          ;{" "}
          {removedInvites.length
            ? `remove ${removedInvites.map(memberName).join(", ")}`
            : "no removals"}
          .
        </p>
      )}
      {isAdmin() && (
        <label class="fl-checkrow">
          <input
            type="checkbox"
            class="fl-switch"
            checked={v.public}
            onChange={on("public")}
          />
          Show on the public website
        </label>
      )}
      <p class="fl-error" role="alert">
        {err}
      </p>
      <div class="fl-actions">
        <button class="fl-btn fl-btn--red" disabled={busy}>
          {busy
            ? "Saving…"
            : request
              ? isAdmin()
                ? "Save and schedule"
                : "Submit request"
              : ev
                ? "Save changes"
                : "Save event"}
        </button>
        {!ev && !(request && isAdmin()) && (
          <button
            type="submit"
            value="draft"
            class="fl-btn fl-btn--ghost"
            disabled={busy}
          >
            Save draft
          </button>
        )}
        <button type="button" class="fl-btn fl-btn--ghost" onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Calendar({ q }) {
  const today = isoDay(),
    view = ["month", "week", "agenda"].includes(q.get("v"))
      ? q.get("v")
      : globalThis.matchMedia?.("(max-width: 600px)").matches
        ? "agenda"
        : "week",
    anchor = /^\d{4}-\d{2}-\d{2}$/.test(q.get("d") || "") ? q.get("d") : today;
  const policy = useEventPolicy();
  const [form, setForm] = useState(null),
    [tick, setTick] = useState(0),
    saved = () => setTick(tick + 1);
  const from = view !== "month" ? monday(anchor) : monday(monthStart(anchor));
  const to =
    view !== "month"
      ? addDays(from, 6)
      : addDays(monday(addDays(addMonths(anchor, 1), -1)), 6);
  const {
    events,
    error: rangeError,
    loading: rangeLoading,
  } = useEvents(from, to, tick);
  const open =
    q.get("e") &&
    (events.find((e) => e.id === q.get("e")) ||
      S.events.find((e) => e.id === q.get("e")));
  const upcoming = remainingEvents(
    S.events,
    today,
    new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16),
  );
  const featured = upcoming[0];
  const step = (n) =>
    go(
      {
        d: view !== "month" ? addDays(anchor, 7 * n) : addMonths(anchor, n),
        e: null,
      },
      q,
    );
  const label =
    view !== "month" ? `${fmtDay(from)} to ${fmtDay(to)}` : monthName(anchor);
  return (
    <>
      <Title light="Calendar." bold={label} title="Calendar">
        {isAdmin() && (
          <a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/event-settings">
            Event settings
          </a>
        )}
        {S.me.role !== "teacher" && !form && (
          <button
            disabled={!policy.ready}
            class="fl-btn fl-btn--red fl-btn--sm"
            onClick={() => setForm({ day: anchor })}
          >
            <Icon n="plus" />
            Add event
          </button>
        )}
      </Title>
      {policy.error && (
        <p class="fl-error" role="alert">
          {policy.error}
        </p>
      )}
      {form && (
        <EventForm
          key={form.ev?.id || form.request?.id || "new"}
          policy={policy}
          ev={form.ev}
          request={form.request}
          day={form.day}
          done={() => {
            setForm(null);
            saved();
          }}
        />
      )}
      <div class="fl-actions">
        <div class="fl-seg" role="group" aria-label="View">
          <button
            aria-pressed={view === "agenda"}
            onClick={() => go({ v: "agenda" }, q)}
          >
            Agenda
          </button>
          <button
            aria-pressed={view === "week"}
            onClick={() => go({ v: "week" }, q)}
          >
            Week
          </button>
          <button
            aria-pressed={view === "month"}
            onClick={() => go({ v: "month" }, q)}
          >
            Month
          </button>
        </div>
        <button
          class="fl-iconbtn"
          aria-label={view !== "month" ? "Previous week" : "Previous month"}
          onClick={() => step(-1)}
        >
          <Icon n="left" />
        </button>
        <button
          class="fl-btn fl-btn--ghost fl-btn--sm"
          onClick={() => go({ d: null, e: null }, q)}
        >
          Today
        </button>
        <button
          class="fl-iconbtn"
          aria-label={view !== "month" ? "Next week" : "Next month"}
          onClick={() => step(1)}
        >
          <Icon n="right" />
        </button>
      </div>
      <section class="fl-panel" aria-label={label}>
        {rangeLoading && <p role="status">Loading events for these dates…</p>}
        {rangeError && (
          <div class="fl-section">
            <p class="fl-error" role="alert">
              {rangeError}
            </p>
            <button class="fl-btn fl-btn--ghost" onClick={saved}>
              Reload dates
            </button>
          </div>
        )}
        {view === "agenda" ? (
          <Agenda
            start={from}
            events={events}
            q={q}
            loading={rangeLoading || !!rangeError}
          />
        ) : view === "week" ? (
          <Week start={from} events={events} q={q} />
        ) : (
          <Month anchor={anchor} events={events} q={q} />
        )}
        {S.fail.events && (
          <p class="fl-error" role="alert">
            Events did not load ({S.fail.events}). Reload to try again.
          </p>
        )}
      </section>
      <EventRequests policy={policy} edit={(request) => setForm({ request })} />
      <div class="fl-split">
        <Panel title="Upcoming" id="up-h">
          {upcoming.length ? (
            <ul class="fl-list">
              {upcoming.slice(0, 5).map((e) => (
                <li key={e.id} class="fl-up">
                  <span class="fl-date">
                    {fmtDay(e.date).split(" ")[2]}
                    <b>{e.date.slice(8)}</b>
                  </span>
                  <div>
                    <button
                      class="fl-linkbtn fl-h3"
                      onClick={() => go({ e: e.id, d: e.date }, q)}
                    >
                      {e.title}
                    </button>
                    <p class="fl-small fl-muted">
                      <span class="fl-mono">
                        {fmtDay(e.date)} · {e.start}
                      </span>
                      {e.location && ` · ${e.location}`}
                    </p>
                  </div>
                  <EventTag type={e.type} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              Nothing coming up in the next {EVENT_AHEAD_DAYS} days. Add an
              event to start.
            </Empty>
          )}
        </Panel>
        {featured && (
          <section class="fl-hero fl-stage" aria-labelledby="feat-h">
            <img class="fl-hero__img" src={sunset} alt="" />
            <div class="fl-hero__body">
              <span class="fl-eyebrow">
                Next up · {fmtDay(featured.date)}, {featured.start}
              </span>
              <h2 id="feat-h" class="fl-h2">
                {featured.title}
              </h2>
              {featured.location && <p class="fl-muted">{featured.location}</p>}
              <div>
                <button
                  class="fl-btn fl-btn--ghost fl-btn--sm"
                  onClick={() => go({ e: featured.id, d: featured.date }, q)}
                >
                  Open event
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      {open && (
        <EventSheet
          groups={policy.groups}
          ev={open}
          q={q}
          archived={saved}
          cancel={
            policy.requests.some((r) => r.id === open.requestId)
              ? async () => {
                  const r = policy.requests.find(
                    (r) => r.id === open.requestId,
                  );
                  if (
                    confirm(
                      "Cancel this event and remove it from the calendar?",
                    ) &&
                    (await transitionEventRequest(r, "cancelled"))
                  ) {
                    saved();
                    go({ e: null }, q);
                  }
                }
              : null
          }
          edit={() => {
            setForm({ ev: open });
            go({ e: null }, q);
          }}
        />
      )}
    </>
  );
}

function EventRequests({ policy, edit }) {
  const selectedRequest = new URLSearchParams(
    location.hash.split("?")[1] || "",
  ).get("request");
  const [busy, setBusy] = useState(""),
    [reason, setReason] = useState({}),
    [expanded, setExpanded] = useState(selectedRequest || "");
  useEffect(() => {
    if (selectedRequest) setExpanded(selectedRequest);
  }, [selectedRequest]);
  const [history, setHistory] = useState(null),
    [historyError, setHistoryError] = useState(""),
    [historyBusy, setHistoryBusy] = useState(false),
    [historyCursors, setHistoryCursors] = useState([]);
  const displayed = history || policy.requests;
  const earlier = async () => {
    setHistoryBusy(true);
    setHistoryError("");
    const after = displayed.at(-1);
    try {
      const rows = await loadEventRequestHistory(after);
      setHistoryCursors([...historyCursors, after]);
      setHistory(rows);
    } catch (e) {
      setHistoryError(
        `Earlier requests could not load (${e.code || e.message}). Try again.`,
      );
    } finally {
      setHistoryBusy(false);
    }
  };
  const change = async (r, state) => {
    setBusy(r.id);
    await transitionEventRequest(r, state, reason[r.id] || "");
    setBusy("");
  };
  if (!policy.requests.length) return null;
  return (
    <Panel title={isAdmin() ? "Event requests" : "My event requests"}>
      <p class="fl-small fl-muted">
        {history ? "Earlier request history" : "Latest 50 requests"}
      </p>
      {historyError && (
        <p class="fl-error" role="alert">
          {historyError}
        </p>
      )}
      <div class="fl-actions">
        <button
          class="fl-btn fl-btn--ghost"
          disabled={historyBusy || !displayed.length}
          onClick={earlier}
        >
          {historyBusy ? "Loading…" : "Earlier requests"}
        </button>
        {history && (
          <button
            class="fl-btn fl-btn--ghost"
            onClick={() => {
              setHistory(null);
              setHistoryCursors([]);
            }}
          >
            Return to latest requests
          </button>
        )}
      </div>
      {history && !history.length && (
        <p>No earlier requests. Return to the latest requests to continue.</p>
      )}
      <ul class="fl-list">
        {displayed.map((r) => (
          <li key={r.id}>
            <div class="fl-row">
              <div>
                <button
                  class="fl-linkbtn fl-h3"
                  onClick={() => setExpanded(expanded === r.id ? "" : r.id)}
                  aria-expanded={expanded === r.id}
                >
                  {r.proposal.title}
                </button>
                <p class="fl-small fl-muted">
                  {r.state.replaceAll("-", " ")} · {fmtDay(r.proposal.date)} ·{" "}
                  {r.proposal.start} to {r.proposal.end}
                  {isAdmin() ? ` · ${memberName(r.createdByUid)}` : ""}
                </p>
                {r.reviewNote && <p class="fl-small">Review: {r.reviewNote}</p>}
              </div>
            </div>
            {expanded === r.id && (
              <section
                class="fl-section"
                aria-label={`Request for ${r.proposal.title}`}
              >
                <p>{r.proposal.location || "No place set"}</p>
                {r.proposal.notes && <p class="fl-pre">{r.proposal.notes}</p>}
                <p class="fl-small fl-muted">
                  Invited:{" "}
                  {r.proposal.participantUids.map(memberName).join(", ") ||
                    "No participants selected"}{" "}
                  · Settings v{r.proposal.configSnapshot.settingsVersion} ·
                  Template v{r.proposal.configSnapshot.templateVersion}
                </p>
                {r.replacesEventId && (
                  <p class="fl-help">
                    Changes to an existing event. Its current schedule remains
                    until approval.
                  </p>
                )}
                {isAdmin() && r.state === "awaiting" && (
                  <div class="fl-field">
                    <label for={`review-${r.id}`}>
                      Review reason (required for changes or decline)
                    </label>
                    <textarea
                      id={`review-${r.id}`}
                      class="fl-input"
                      maxLength={1000}
                      value={reason[r.id] || ""}
                      onInput={(e) =>
                        setReason({ ...reason, [r.id]: e.target.value })
                      }
                    />
                  </div>
                )}
                <div class="fl-actions">
                  {isAdmin() && r.state === "awaiting" && (
                    <>
                      <button
                        class="fl-btn fl-btn--ghost fl-btn--sm"
                        disabled={!!busy}
                        onClick={() => edit(r)}
                      >
                        Edit and schedule
                      </button>
                      <button
                        class="fl-btn fl-btn--red fl-btn--sm"
                        disabled={!!busy}
                        onClick={() => change(r, "scheduled")}
                      >
                        Approve and schedule
                      </button>
                      <button
                        class="fl-btn fl-btn--ghost fl-btn--sm"
                        disabled={!!busy || !reason[r.id]?.trim()}
                        onClick={() => change(r, "changes-requested")}
                      >
                        Request changes
                      </button>
                      <button
                        class="fl-btn fl-btn--ghost fl-btn--sm"
                        disabled={!!busy || !reason[r.id]?.trim()}
                        onClick={() => change(r, "declined")}
                      >
                        Decline request
                      </button>
                    </>
                  )}
                  {r.createdByUid === S.me.id &&
                    ["draft", "changes-requested"].includes(r.state) && (
                      <button
                        class="fl-btn fl-btn--ghost fl-btn--sm"
                        disabled={!!busy}
                        onClick={() => edit(r)}
                      >
                        Edit and submit
                      </button>
                    )}
                  {r.createdByUid === S.me.id &&
                    ["draft", "awaiting", "changes-requested"].includes(
                      r.state,
                    ) && (
                      <button
                        class="fl-btn fl-btn--ghost fl-btn--sm"
                        disabled={!!busy}
                        onClick={() =>
                          confirm("Withdraw this event request?") &&
                          change(r, "withdrawn")
                        }
                      >
                        Withdraw request
                      </button>
                    )}
                  {r.state === "scheduled" && (
                    <>
                      <a
                        class="fl-btn fl-btn--ghost fl-btn--sm"
                        href={`#/calendar?d=${r.proposal.date}&e=${r.eventId}`}
                      >
                        Open event
                      </a>
                      {(isAdmin() || r.createdByUid === S.me.id) && (
                        <button
                          class="fl-btn fl-btn--ghost fl-btn--sm"
                          disabled={!!busy}
                          onClick={() =>
                            confirm(
                              "Cancel this event and remove it from the calendar?",
                            ) && change(r, "cancelled")
                          }
                        >
                          Cancel event
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Agenda({ start, events, q, loading }) {
  const dues = dueMarkers(start, addDays(start, 6));
  return (
    <div>
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((day) => {
        const scheduled = events.filter((e) => e.date === day),
          due = dues.filter((r) => r.dueDate === day);
        if (!scheduled.length && !due.length) return null;
        return (
          <section class="fl-section" key={day} aria-label={fmtDay(day)}>
            <h2 class="fl-h3">{fmtDay(day)}</h2>
            <ul class="fl-list">
              {scheduled.map((e) => (
                <li key={e.id} class="fl-row">
                  <div>
                    <button
                      class="fl-linkbtn fl-h3"
                      onClick={() => go({ e: e.id }, q)}
                    >
                      {e.title}
                    </button>
                    <p class="fl-small fl-muted">
                      <span class="fl-mono">
                        {e.allDay ? "All day" : `${e.start} to ${e.end}`}
                      </span>
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <EventTag type={e.type} />
                </li>
              ))}
              {due.map((r) => (
                <li key={r.id} class="fl-row">
                  <a class="fl-link" href={`#/p/${r.id}`}>
                    Due: {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!loading && !events.length && !dues.length && (
        <Empty>No events this week. Use Add event to plan one.</Empty>
      )}
    </div>
  );
}
