import { useEffect, useState } from "preact/hooks";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { S, plain } from "../store.js";
import { isAdmin } from "../model.js";
import {
  EVENT_TYPES,
  emptySelection,
  suggestedMeetingDefaults,
  previewEventDefaults,
} from "../event-model.js";
import {
  applyEventDefaults,
  saveEventConfiguration,
  useEventPolicy,
} from "../event-actions.js";
import { isoDay, fmtDay } from "../time.js";
import { Empty, Panel, Title } from "../ui.jsx";
import { Sheet } from "../shared.jsx";
import { Menu, ParticipantFields } from "../pickers.jsx";

export { ParticipantFields };
function ConfigurationForm({
  kind,
  value,
  groups,
  templates = [],
  meeting = false,
  groupCode = "custom",
  done,
}) {
  const [name, setName] = useState(
      value?.name ||
        { jc6: "JC officers", sec6: "Sec officers", executive4: "Executive board" }[groupCode] ||
        "",
    ),
    [defaults, setDefaults] = useState(
      value?.defaults ||
        (meeting
          ? suggestedMeetingDefaults(S.members)
          : { participantSelection: emptySelection() }),
    );
  const [description, setDescription] = useState(value?.description || ""),
    [available, setAvailable] = useState(value?.available !== false),
    [defaultTemplateId, setDefaultTemplate] = useState(
      value?.defaultTemplateId || "",
    );
  const [code, setCode] = useState(value?.code || groupCode);
  const expected =
    code === "executive4" ? 4 : ["jc6", "sec6"].includes(code) ? 6 : 0;
  const [positions, setPositions] = useState(
    value?.positions ||
      Array.from({ length: expected }, (_, index) => ({
        title:
          code === "executive4"
            ? ["President", "Vice president", "Secretary", "Treasurer"][index]
            : "",
        memberUid:
          value?.memberUids?.[index] ||
          (code === "executive4"
            ? S.members.find(
                (m) =>
                  m.active &&
                  m.role ===
                    ["president", "vp", "secretary", "treasurer"][index],
              )?.id
            : null) ||
          null,
      })),
  );
  const positionChange = (index, patch) => {
    const updated = positions.map((p, i) =>
      i === index ? { ...p, ...patch } : p,
    );
    setPositions(updated);
    setMembers([...new Set(updated.map((p) => p.memberUid).filter(Boolean))]);
  };
  const [memberUids, setMembers] = useState(
      value?.memberUids ||
        (groupCode === "executive4"
          ? ["president", "vp", "secretary", "treasurer"]
              .map(
                (role) =>
                  S.members.find((m) => m.active && m.role === role)?.id,
              )
              .filter(Boolean)
          : []),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (k, v) => {
    const d = { ...defaults };
    if (!v && ["type", "start", "end"].includes(k)) delete d[k];
    else d[k] = v;
    setDefaults(d);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (kind !== "settings" && !name.trim()) return setError("Add a name.");
    setBusy(true);
    setError("");
    const data =
      kind === "group"
        ? {
            name: name.trim().slice(0, 80),
            memberUids,
            code,
            ...(expected ? { positions } : {}),
            available:
              available &&
              (!expected ||
                (memberUids.length === expected &&
                  positions.every((p) => p.title.trim() && p.memberUid))),
          }
        : {
            ...(kind === "template"
              ? {
                  name: name.trim().slice(0, 80),
                  description: description.trim().slice(0, 1000),
                  type: defaults.type || "other",
                  available,
                }
              : { defaultTemplateId: defaultTemplateId || null }),
            defaults,
          };
    if (await saveEventConfiguration(kind, value, data)) done(true);
    setBusy(false);
  };
  return (
    <form class="fl-panel fl-form" onSubmit={submit}>
      <h2 class="fl-h2">
        {kind === "settings"
          ? "Term defaults"
          : `${value ? "Edit" : "Add"} ${kind === "group" ? "participant group" : "event template"}`}
      </h2>
      {kind !== "settings" && (
        <div class="fl-field">
          <label for="config-name">Name</label>
          <input
            id="config-name"
            class="fl-input"
            maxLength={80}
            value={name}
            onInput={(e) => setName(e.target.value)}
          />
        </div>
      )}
      {kind === "template" && (
        <>
          <div class="fl-field">
            <label for="config-description">Description</label>
            <textarea
              id="config-description"
              class="fl-input"
              maxLength={1000}
              value={description}
              onInput={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <label class="fl-checkrow">
            <input
              type="checkbox"
              class="fl-switch"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Available when adding events
          </label>
        </>
      )}
      {kind === "settings" && (
        <div class="fl-field">
          <label for="default-template">Default event template</label>
          <select
            id="default-template"
            class="fl-input"
            value={defaultTemplateId}
            onChange={(e) => setDefaultTemplate(e.target.value)}
          >
            <option value="">Blank event</option>
            {templates
              .filter((t) => t.available !== false)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      )}
      {kind === "group" ? (
        <div class="fl-field">
          {expected > 0 && (
            <fieldset>
              <legend>Who is in this group</legend>
              <p class="fl-help">
                Link each place to a person on the roster. Linking changes nobody's
                permissions. The group can be invited once every place is linked.
              </p>
              {positions.map((position, index) => (
                <div class="fl-fields" key={index}>
                  <label class="fl-field">
                    Place {index + 1} title
                    <input
                      class="fl-input"
                      aria-label={`Position ${index + 1} title`}
                      maxLength="80"
                      placeholder={`Title, for example Head of events`}
                      value={position.title}
                      onInput={(e) =>
                        positionChange(index, { title: e.currentTarget.value })
                      }
                    />
                  </label>
                  <label class="fl-field">
                    Place {index + 1} person
                    <select
                      class="fl-input"
                      aria-label={`Position ${index + 1} member`}
                      value={position.memberUid || ""}
                      onChange={(e) =>
                        positionChange(index, {
                          memberUid: e.currentTarget.value || null,
                        })
                      }
                    >
                      <option value="">Not linked yet</option>
                      {S.members
                        .filter((m) => m.active)
                        .map((m) => (
                          <option value={m.id}>{m.name}</option>
                        ))}
                    </select>
                  </label>
                </div>
              ))}
            </fieldset>
          )}
          {!expected && (
            <>
              <label for="group-members">Group members</label>
              <select
                id="group-members"
                class="fl-input"
                multiple
                size={8}
                value={memberUids}
                onChange={(e) =>
                  setMembers([...e.target.selectedOptions].map((o) => o.value))
                }
              >
                {S.members
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <p class="fl-help">
                Hold Ctrl or Command to select several people.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div class="fl-fields">
            <div class="fl-field">
              <label for="config-type">Default type</label>
              <select
                id="config-type"
                class="fl-input"
                value={defaults.type || ""}
                onChange={(e) => {
                  if (e.target.value === "meeting" && !value)
                    setDefaults({
                      ...suggestedMeetingDefaults(S.members),
                      ...defaults,
                      type: "meeting",
                    });
                  else set("type", e.target.value);
                }}
              >
                <option value="">Inherit type</option>
                {EVENT_TYPES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div class="fl-field">
              <label for="config-approval">Approval policy</label>
              <select
                id="config-approval"
                class="fl-input"
                value={defaults.approval || ""}
                onChange={(e) => {
                  const d = { ...defaults };
                  if (e.target.value) d.approval = e.target.value;
                  else delete d.approval;
                  setDefaults(d);
                }}
              >
                <option value="">Inherit policy</option>
                <option value="required">Admin approval required</option>
                <option value="immediate">Schedule immediately</option>
              </select>
            </div>
            {["start", "end", "location", "title"].map((k) => (
              <div class="fl-field" key={k}>
                <label for={`config-${k}`}>
                  {
                    {
                      start: "Start time",
                      end: "End time",
                      location: "Place",
                      title: "Default title",
                    }[k]
                  }
                </label>
                <input
                  id={`config-${k}`}
                  class="fl-input"
                  type={["start", "end"].includes(k) ? "time" : "text"}
                  value={defaults[k] || ""}
                  maxLength={k === "location" ? 120 : 80}
                  onInput={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div class="fl-field">
            <label for="config-notes">Default notes</label>
            <textarea
              id="config-notes"
              class="fl-input"
              rows={3}
              maxLength={1000}
              value={defaults.notes || ""}
              onInput={(e) => set("notes", e.target.value)}
            />
          </div>
          <div class="fl-fields">
            {["instructions", "agenda", "minutes"].map((k) => (
              <div class="fl-field" key={k}>
                <label for={`default-${k}`}>
                  {
                    {
                      instructions: "Participant instructions",
                      agenda: "Default agenda",
                      minutes: "Minutes skeleton",
                    }[k]
                  }
                </label>
                <textarea
                  id={`default-${k}`}
                  class="fl-input"
                  rows={3}
                  maxLength={k === "instructions" ? 1000 : 4000}
                  value={defaults[k] || ""}
                  onInput={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
            <div class="fl-field">
              <label for="default-duration">Suggested duration (minutes)</label>
              <input
                id="default-duration"
                class="fl-input"
                type="number"
                min={1}
                max={1440}
                value={defaults.duration || ""}
                onInput={(e) => {
                  const d = { ...defaults };
                  if (e.target.value)
                    d.duration = Math.min(
                      1440,
                      Math.max(1, Number(e.target.value)),
                    );
                  else delete d.duration;
                  setDefaults(d);
                }}
              />
            </div>
          </div>
          <div class="fl-fields">
            {[
              ["chairUid", "Suggested chair"],
              ["minutesUid", "Suggested minute taker"],
              ["minutesBackupUid", "Suggested backup minute taker"],
            ].map(([k, label]) => (
              <div key={k} class="fl-field">
                <label for={`default-${k}`}>{label}</label>
                <select
                  id={`default-${k}`}
                  class="fl-input"
                  value={defaults[k] || ""}
                  onChange={(e) => set(k, e.target.value || null)}
                >
                  <option value="">Choose when scheduling</option>
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
            <div class="fl-field">
              <label for="default-cohosts">Suggested cohosts</label>
              <select
                id="default-cohosts"
                class="fl-input"
                multiple
                value={defaults.cohostUids || []}
                onChange={(e) =>
                  set(
                    "cohostUids",
                    [...e.target.selectedOptions].map((o) => o.value),
                  )
                }
              >
                {S.members
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <CustomFieldEditor
            fields={defaults.customFields || []}
            onChange={(fields) => set("customFields", fields)}
          />
          <ParticipantFields
            value={defaults.participantSelection}
            groups={groups}
            onChange={(s) => set("participantSelection", s)}
          />
        </>
      )}
      {error && (
        <p class="fl-error" role="alert">
          {error}
        </p>
      )}
      <div class="fl-actions">
        <button class="fl-btn fl-btn--red" disabled={busy}>
          {busy ? "Saving…" : "Save configuration"}
        </button>
        <button class="fl-btn fl-btn--ghost" type="button" onClick={() => done(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
const TABS = [
  ["templates", "Templates", "Templates fill in new events. Editing an event never changes its template."],
  ["groups", "Participant groups", "Groups are saved lists of people you can invite in one go. They do not change anyone's permissions."],
  ["defaults", "Term defaults", "Term defaults fill every new event this term. Templates override them, and each event can override both."],
];
const LEGACY_GROUPS = [["jc6", "JC officers", 6], ["sec6", "Sec officers", 6], ["executive4", "Executive board", 4]];
function SettingRow({ title, meta, primary, menu }) {
  return (
    <li class="fl-srow">
      <div><b class="fl-h3">{title}</b>{meta && <p class="fl-small fl-muted">{meta}</p>}</div>
      <div class="fl-actions">{primary}{menu}</div>
    </li>
  );
}
export function EventSettings({ q }) {
  const policy = useEventPolicy(),
    [form, setForm] = useState(null),
    [history, setHistory] = useState(null),
    [apply, setApply] = useState(false);
  const tab = TABS.some(([k]) => k === q?.get("tab")) ? q.get("tab") : "templates";
  if (!isAdmin())
    return <><Title light="Not for you." bold="Event settings" /><Empty>Only the advisor, the president and the vice president change event settings.</Empty></>;
  const archive = (kind, item) =>
    confirm(`Archive “${item.name}”? Events already planned keep their invitations.`) &&
    saveEventConfiguration(kind, item, kind === "group"
      ? { name: item.name, memberUids: item.memberUids, code: item.code || "custom", positions: item.positions || [], available: item.available !== false, archived: true }
      : { name: item.name, description: item.description || item.name, type: item.type || item.defaults.type || "other", available: item.available !== false, defaults: item.defaults, archived: true });
  const future = S.events.filter((e) => !e.archived && e.date >= isoDay());
  const sentence = TABS.find(([k]) => k === tab)[2];
  return (
    <>
      <Title light="Event" bold="settings." title="Event settings">
        <a class="fl-btn fl-btn--ghost fl-btn--sm" href="#/calendar">Back to calendar</a>
      </Title>
      <div class="fl-seg" role="tablist" aria-label="Event settings">
        {TABS.map(([k, label]) => <a key={k} role="tab" aria-selected={tab === k} aria-current={tab === k ? "page" : undefined} href={`#/event-settings?tab=${k}`}>{label}</a>)}
      </div>
      {policy.error && <p class="fl-error" role="alert">{policy.error}</p>}
      <p class="fl-measure">{sentence}</p>
      {!policy.ready ? <p role="status" class="fl-muted">Loading event settings…</p> : (
        <section class="fl-panel" aria-label={TABS.find(([k]) => k === tab)[1]}>
          {tab === "templates" && (
            <>
              <div class="fl-actions">
                <button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm({ kind: "template", value: null, meeting: true })}>Add meeting template</button>
                <button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm({ kind: "template", value: null })}>Add other template</button>
              </div>
              {policy.templates.length ? (
                <ul class="fl-list">{policy.templates.map((t) => (
                  <SettingRow key={t.id} title={t.name}
                    meta={`${policy.settings?.defaultTemplateId === t.id ? "Default for new events · " : ""}${t.available === false ? "Hidden from new events · " : ""}Version ${t.version}`}
                    primary={<button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm({ kind: "template", value: t })}>Edit</button>}
                    menu={<Menu label={`More for ${t.name}`} items={[
                      policy.settings?.defaultTemplateId !== t.id && t.available !== false && ["Use for new events", () => saveEventConfiguration("settings", policy.settings, { defaults: policy.settings?.defaults || {}, defaultTemplateId: t.id })],
                      ["Version history", () => setHistory(t)],
                      ["Archive", () => archive("template", t)],
                    ]} />} />
                ))}</ul>
              ) : <Empty>No templates yet. Add one so new events start filled in.</Empty>}
            </>
          )}
          {tab === "groups" && (
            <>
              <div class="fl-actions"><button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm({ kind: "group", value: null })}>Add group</button></div>
              <ul class="fl-list">
                {LEGACY_GROUPS.map(([code, name, count]) => {
                  const g = policy.groups.find((x) => x.code === code), n = g?.memberUids.length || 0, missing = count - n;
                  return (
                    <SettingRow key={code} title={g?.name && !/^(JC6|SEC6|Executive4)$/.test(g.name) ? g.name : name}
                      meta={missing > 0 ? `${missing} ${missing === 1 ? "person" : "people"} not linked yet` : `${n} people · ready to invite`}
                      primary={<button class={`fl-btn fl-btn--sm ${missing > 0 ? "fl-btn--red" : "fl-btn--ghost"}`} onClick={() => setForm({ kind: "group", value: g || null, groupCode: code })}>{missing > 0 ? "Link people" : "Edit"}</button>} />
                  );
                })}
                {policy.groups.filter((g) => !LEGACY_GROUPS.some(([c]) => c === g.code)).map((g) => (
                  <SettingRow key={g.id} title={g.name} meta={`${g.memberUids.length} ${g.memberUids.length === 1 ? "person" : "people"}`}
                    primary={<button class="fl-btn fl-btn--ghost fl-btn--sm" onClick={() => setForm({ kind: "group", value: g })}>Edit</button>}
                    menu={<Menu label={`More for ${g.name}`} items={[["Archive", () => archive("group", g)]]} />} />
                ))}
              </ul>
              <p class="fl-help">Departments, ranks and special-committee teams are invited straight from the event editor and stay up to date on their own.</p>
            </>
          )}
          {tab === "defaults" && (
            <ul class="fl-list">
              <SettingRow title={`Defaults for ${S.term.termName || S.term.termId}`}
                meta={`Version ${policy.settings?.version || 0}${policy.settings?.defaults?.location ? ` · place ${policy.settings.defaults.location}` : ""}`}
                primary={<button class="fl-btn fl-btn--red fl-btn--sm" onClick={() => setForm({ kind: "settings", value: policy.settings })}>Edit term defaults</button>}
                menu={future.length > 0 && <Menu label="More for term defaults" items={[["Apply to planned events", () => setApply(true)]]} />} />
            </ul>
          )}
        </section>
      )}
      {form && (
        <Sheet label={form.value ? `Edit ${form.value.name || "term defaults"}` : "New"} onClose={() => setForm(null)}>
          <ConfigurationForm key={`${form.kind}-${form.groupCode || ""}-${form.value?.id || "new"}-${form.meeting ? "m" : "n"}`} {...form}
            groups={policy.groups} templates={policy.templates}
            done={(saved) => { const wasSettings = form.kind === "settings"; setForm(null); if (wasSettings && saved && future.length) setApply(true); }} />
        </Sheet>
      )}
      {history && <Sheet label={`Version history of ${history.name}`} onClose={() => setHistory(null)}><TemplateHistory template={history} close={() => setHistory(null)} /></Sheet>}
      {apply && (
        <Sheet label="Apply new defaults to planned events" onClose={() => setApply(false)}>
          <h2 class="fl-h2">Apply the new defaults to planned events?</h2>
          <p>Events already on the calendar keep their old settings unless you choose them here. Preview who and what changes before anything is saved.</p>
          <BulkDefaults policy={policy} />
          <div class="fl-actions"><button class="fl-btn fl-btn--ghost" onClick={() => setApply(false)}>Not now</button></div>
        </Sheet>
      )}
    </>
  );
}

function CustomFieldEditor({ fields, onChange }) {
  const change = (index, patch) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <fieldset>
      <legend class="fl-h3">Custom event fields</legend>
      <p class="fl-help">
        Up to 4 fields. Required fields must be completed before submission.
        Field IDs stay stable in saved event versions.
      </p>
      {fields.map((f, i) => (
        <section key={f.id} class="fl-section">
          <div class="fl-fields">
            <div class="fl-field">
              <label for={`custom-label-${i}`}>Field label</label>
              <input
                id={`custom-label-${i}`}
                class="fl-input"
                maxLength={80}
                value={f.label}
                onInput={(e) => change(i, { label: e.target.value })}
              />
            </div>
            <div class="fl-field">
              <label for={`custom-type-${i}`}>Field type</label>
              <select
                id={`custom-type-${i}`}
                class="fl-input"
                value={f.type}
                onChange={(e) => change(i, { type: e.target.value })}
              >
                <option value="text">Short text</option>
                <option value="textarea">Long text</option>
                <option value="select">Choice</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
          </div>
          {f.type === "select" && (
            <div class="fl-field">
              <label for={`custom-options-${i}`}>
                Choices (one per line, up to 20)
              </label>
              <textarea
                id={`custom-options-${i}`}
                class="fl-input"
                value={(f.options || []).join("\n")}
                onInput={(e) =>
                  change(i, {
                    options: e.target.value
                      .split("\n")
                      .slice(0, 20)
                      .map((s) => s.slice(0, 80)),
                  })
                }
              />
            </div>
          )}
          <div class="fl-actions">
            <label class="fl-checkrow">
              <input
                type="checkbox"
                class="fl-switch"
                checked={f.required}
                onChange={(e) => change(i, { required: e.target.checked })}
              />
              Required
            </label>
            <button
              type="button"
              class="fl-btn fl-btn--ghost fl-btn--sm"
              onClick={() => onChange(fields.filter((_, index) => index !== i))}
            >
              Remove field
            </button>
          </div>
        </section>
      ))}
      <button
        type="button"
        class="fl-btn fl-btn--ghost fl-btn--sm"
        disabled={fields.length >= 4}
        onClick={() =>
          onChange([
            ...fields,
            {
              id: `field_${Date.now()}_${fields.length}`,
              label: "",
              type: "text",
              required: false,
              options: [],
            },
          ])
        }
      >
        Add custom field
      </button>
    </fieldset>
  );
}

function BulkDefaults({ policy }) {
  const [selected, setSelected] = useState([]),
    [replaceInvitations, setReplace] = useState(false),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false);
  const today = isoDay(),
    future = S.events
      .filter((e) => !e.archived && e.date >= today)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
      );
  const reset = () => setPreview(null);
  const show = () =>
    setPreview(
      future
        .filter((e) => selected.includes(e.id))
        .map((event) => ({
          event,
          ...previewEventDefaults(
            event,
            policy.settings,
            policy.templates.find(
              (t) => t.id === event.configSnapshot?.templateId,
            ),
            replaceInvitations,
            S.members,
            policy.groups,
          ),
        })),
    );
  return (
    <Panel title="Apply new defaults to scheduled events">
      <p class="fl-help">
        Saving settings changes future forms only. To update existing events,
        select up to 10 from the loaded calendar window, review the exact
        schedule and invitation changes, then apply. Titles and dates stay as
        scheduled.
      </p>
      {!future.length ? (
        <Empty>No upcoming events in the loaded calendar window.</Empty>
      ) : (
        <>
          <div class="fl-field">
            <label for="bulk-events">Scheduled events</label>
            <select
              id="bulk-events"
              class="fl-input"
              multiple
              size={Math.min(6, future.length)}
              value={selected}
              onChange={(e) => {
                setSelected(
                  [...e.target.selectedOptions]
                    .map((o) => o.value)
                    .slice(0, 10),
                );
                reset();
              }}
            >
              {future.map((e) => (
                <option key={e.id} value={e.id}>
                  {fmtDay(e.date)} · {e.title}
                </option>
              ))}
            </select>
          </div>
          <label class="fl-checkrow">
            <input
              type="checkbox"
              class="fl-switch"
              checked={replaceInvitations}
              onChange={(e) => {
                setReplace(e.target.checked);
                reset();
              }}
            />
            Replace invitations with current group and section membership
          </label>
          <button
            class="fl-btn fl-btn--ghost"
            disabled={!selected.length || busy}
            onClick={show}
          >
            Preview selected changes
          </button>
          {preview && (
            <section class="fl-section" aria-label="Changes to review">
              <ul class="fl-list">
                {preview.map((p) => (
                  <li key={p.event.id} class="fl-section">
                    <b>{p.event.title}</b>
                    <p class="fl-small fl-muted">
                      {fmtDay(p.event.date)} · Revision {p.event.revision || 0}{" "}
                      → {(p.event.revision || 0) + 1} · Template v
                      {p.proposal.configSnapshot.templateVersion}
                    </p>
                    {p.error && (
                      <p class="fl-error" role="alert">
                        {p.error}
                      </p>
                    )}
                    {p.changes.length ? (
                      <ul>
                        {p.changes.map((c) => (
                          <li key={c.field}>
                            {
                              {
                                start: "Start",
                                end: "End",
                                location: "Place",
                                notes: "Notes",
                              }[c.field]
                            }
                            : {c.before || "(empty)"} → {c.after || "(empty)"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p class="fl-small">No time, place or notes changes.</p>
                    )}
                    <p class="fl-small">
                      Invitations: {p.added.length} added, {p.removed.length}{" "}
                      removed. Meeting agenda, instructions and role suggestions
                      will use the reviewed template version.
                    </p>
                    {p.added.length > 0 && (
                      <p class="fl-small">
                        Added:{" "}
                        {p.added
                          .map(
                            (uid) =>
                              S.members.find((m) => m.id === uid)?.name || uid,
                          )
                          .join(", ")}
                      </p>
                    )}
                    {p.removed.length > 0 && (
                      <p class="fl-small">
                        Removed:{" "}
                        {p.removed
                          .map(
                            (uid) =>
                              S.members.find((m) => m.id === uid)?.name || uid,
                          )
                          .join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div class="fl-actions">
                <button
                  class="fl-btn fl-btn--red"
                  disabled={busy || preview.some((p) => p.error)}
                  onClick={async () => {
                    setBusy(true);
                    if (
                      await applyEventDefaults(
                        preview.map((p) => p.event),
                        policy,
                        replaceInvitations,
                      )
                    ) {
                      setPreview(null);
                      setSelected([]);
                    }
                    setBusy(false);
                  }}
                >
                  {busy ? "Applying…" : "Apply reviewed changes"}
                </button>
                <button class="fl-btn fl-btn--ghost" onClick={reset}>
                  Discard preview
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </Panel>
  );
}

function TemplateHistory({ template, close }) {
  const [rows, setRows] = useState([]),
    [cursor, setCursor] = useState(null),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async (after = null) => {
    setBusy(true);
    setError("");
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "eventTemplates", template.id, "versions"),
          orderBy("version", "desc"),
          ...(after ? [startAfter(after)] : []),
          limit(10),
        ),
      );
      setRows((v) =>
        after
          ? [...v, ...snapshot.docs.map((d) => d.data())]
          : snapshot.docs.map((d) => d.data()),
      );
      setCursor(snapshot.docs.at(-1) || null);
      setMore(snapshot.size === 10);
    } catch (e) {
      setError(
        `Template history did not load. ${plain(e)}`,
      );
    }
    setBusy(false);
  };
  useEffect(() => {
    load();
  }, [template.id]);
  return (
    <Panel title={`Version history · ${template.name}`}>
      <p class="fl-help">
        Each saved template version is immutable. Existing events retain the
        version used when created.
      </p>
      {error && (
        <p class="fl-error" role="alert">
          {error}
        </p>
      )}
      <ul class="fl-list">
        {rows.map((r) => (
          <li key={r.version} class="fl-section">
            <h3 class="fl-h3">
              Version {r.version} · {r.name}
            </h3>
            <p class="fl-small fl-muted">
              {new Date(r.updatedAt).toLocaleString("en-GB", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              ·{" "}
              {r.archived
                ? "Archived"
                : r.available === false
                  ? "Unavailable"
                  : "Available"}
            </p>
            <p>{r.description}</p>
            <p class="fl-small">
              {r.defaults.type || r.type} ·{" "}
              {r.defaults.start || "Inherited start"} to{" "}
              {r.defaults.end || "inherited end"} ·{" "}
              {r.defaults.location || "Inherited place"} ·{" "}
              {r.defaults.approval || "Inherited approval"}
            </p>
            {r.defaults.agenda && (
              <p class="fl-pre">Agenda: {r.defaults.agenda}</p>
            )}
            {r.defaults.minutes && (
              <p class="fl-pre">Minutes skeleton: {r.defaults.minutes}</p>
            )}
            <p class="fl-small">
              Custom fields:{" "}
              {(r.defaults.customFields || [])
                .map((f) => `${f.label}${f.required ? " (required)" : ""}`)
                .join(", ") || "None"}
            </p>
          </li>
        ))}
      </ul>
      <div class="fl-actions">
        {(more || error) && (
          <button
            class="fl-btn fl-btn--ghost"
            disabled={busy}
            onClick={() => load(cursor)}
          >
            {busy
              ? "Loading…"
              : rows.length
                ? "Load earlier versions"
                : "Load history"}
          </button>
        )}
        <button class="fl-btn fl-btn--ghost" onClick={close}>
          Close history
        </button>
      </div>
    </Panel>
  );
}
