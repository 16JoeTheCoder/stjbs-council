/** Published minutes exports. Google tokens stay in memory; Firebase identity is untouched. */
export const GOOGLE_EXPORT_SCOPE =
  "https://www.googleapis.com/auth/drive.file openid email profile";
const s = (value) => (value == null ? "" : String(value));
export const escapeHtml = (value) =>
  s(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const label = (value) =>
  typeof value === "object" && value
    ? s(value.name || value.label || value.email || value.id)
    : s(value);
const names = (value) =>
  Array.isArray(value) ? value.map(label).join(", ") : label(value);
const entries = (value) => (Array.isArray(value) ? value : []);
const texts = (value) =>
  typeof value === "string" && value.trim() ? [value] : entries(value);
const fail = (code, message) => Object.assign(new Error(message), { code });

export function normalizeAttendance(value, members = []) {
  const roster = new Map(members.map((m) => [m.id, m.name]));
  const rows = Array.isArray(value)
    ? value
    : Object.entries(value || {}).map(([uid, status]) => ({ uid, status }));
  return rows
    .filter(
      (row) =>
        row &&
        typeof row.uid === "string" &&
        ["present", "late", "absent", "excused"].includes(row.status),
    )
    .map((row) => ({
      uid: row.uid,
      name:
        roster.get(row.uid) ||
        (typeof row.name === "string" ? row.name : row.uid),
      status: row.status,
    }));
}
export function formatMeetingTime(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : s(value);
}

export function publishedRevision(record) {
  const revision =
    record?.publishedVersion ?? record?.revision ?? record?.version;
  if (
    record?.status !== "published" ||
    revision == null ||
    s(revision).trim() === "" ||
    (/^[-+]?\d+(\.\d+)?$/.test(s(revision)) && Number(revision) <= 0)
  )
    throw fail(
      "UNPUBLISHED",
      "Publish the minutes before exporting a versioned copy.",
    );
  return s(revision);
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

/** Only explicit public fields are rendered: absence reasons and arbitrary object fields never leave the app. */
export function renderMeetingHtml(record) {
  const revision = publishedRevision(record),
    e = escapeHtml;
  const row = (key, value) =>
    `<tr><th>${e(key)}</th><td>${e(names(value) || "—")}</td></tr>`;
  const p = (title, value) =>
    `<p><strong>${e(title)}:</strong> ${e(names(value) || "—")}</p>`;
  const list = (items, render) =>
    items.length
      ? `<ol>${items.map((item) => `<li>${render(item)}</li>`).join("")}</ol>`
      : "<p>None recorded.</p>";
  const attendance = normalizeAttendance(record.attendance)
    .map(
      (a) =>
        `<tr><td>${e(a.name || a.memberName || a.uid)}</td><td>—</td><td>${e(a.status)}</td><td>—</td></tr>`,
    )
    .join("");
  const agenda = entries(record.agenda);
  const action = (a) => {
    const links = entries(a.taskLinks || (a.taskUrl ? [a.taskUrl] : []))
      .map((t) => {
        const url = safeLink(typeof t === "string" ? t : t.url);
        return url
          ? `<a href="${e(url)}">${e(typeof t === "string" ? "Task" : t.title || "Task")}</a>`
          : "";
      })
      .filter(Boolean)
      .join(" · ");
    return `${p("Action", a.title || a.text || a.action)}${p("Owner", a.owners || a.ownerNames || a.owner || a.ownerUid)}${p("Due", a.dueDate || a.due)}${p("Status", a.status)}${links}`;
  };
  const body = `<h1>${e(record.name || record.title || "Council meeting")} — Minutes</h1><p>Published version ${e(revision)}</p><table>${row("Date", record.date)}${row("Planned time", record.plannedTime || [record.plannedStart || record.startTime, record.plannedEnd || record.endTime].filter(Boolean).join(" – "))}${row(
    "Actual time",
    record.actualTime ||
      [record.actualStart, record.actualEnd]
        .filter((v) => v != null)
        .map(formatMeetingTime)
        .join(" – "),
  )}${row("Venue", record.venue)}${row("Chair", record.chairName || record.chair || record.chairUid)}${row("Minutes taken by", record.minutesTakerName || record.actualMinutesTaker || record.minutesTaker || record.editorUid)}</table><h2>Attendance</h2><table><thead><tr><th>Name</th><th>Designation</th><th>Status</th><th>Follow-up</th></tr></thead><tbody>${attendance}</tbody></table><h2>Meeting summary</h2>${p("Summary", record.summary)}<h2>Agenda and discussion</h2>${list(agenda, (a) => `<h3>${e(a.title || a.topic)}</h3>${p("Presenter", a.presenterName || a.presenter || a.presenterUid)}${p("Planned duration", a.duration)}${p("Summary", a.summary || a.discussion)}${p("Outcome", a.outcome)}${p("Status", a.status)}${a.decision ? p("Decision", a.decision) : ""}`)}<h2>Decisions</h2>${list(texts(record.decisions), (d) => e(typeof d === "string" ? d : d.text || d.decision || d.title))}<h2>Actions</h2>${list(entries(record.actions), action)}<h2>Deferred matters</h2>${list(texts(record.deferred || record.deferredMatters), (d) => e(typeof d === "string" ? d : d.title || d.text))}<h2>Next meeting</h2>${p("Details", typeof record.nextMeeting === "object" && record.nextMeeting ? [record.nextMeeting.date, record.nextMeeting.time, record.nextMeeting.venue, record.nextMeeting.notes].filter(Boolean).join(" · ") : record.nextMeeting)}<h2>Closing</h2><p>${e(record.closing && record.closing.trim() !== "Meeting closed at" ? record.closing : `Meeting closed at ${formatMeetingTime(record.actualEnd || record.closedAt) || "the recorded closing time"}.`)}</p>${record.thanks ? `<p>${e(record.thanks)}</p>` : ""}${p("Prepared by", record.preparedBy)}${p("Reviewed by", record.reviewedBy)}${p("Published at", typeof record.publishedAt === "number" && Number.isFinite(record.publishedAt) ? new Date(record.publishedAt).toISOString() : record.publishedAt)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(record.name || record.title || "Council meeting")} — v${e(revision)}</title><style>body{font:12pt Arial,sans-serif;line-height:1.5;max-width:48rem;margin:2rem auto;color:black}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid gray;text-align:left;vertical-align:top;padding:.4rem}th{font-weight:bold}h1{font-size:22pt}h2{font-size:16pt;page-break-after:avoid}li{break-inside:avoid}p{white-space:pre-wrap}@media print{body{margin:0}a{color:inherit}}</style></head><body>${body}</body></html>`;
}

export function downloadMeetingDocument(
  record,
  {
    documentImpl = globalThis.document,
    urlImpl = globalThis.URL,
    BlobImpl = globalThis.Blob,
  } = {},
) {
  const html = renderMeetingHtml(record),
    revision = publishedRevision(record);
  const blob = new BlobImpl(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = urlImpl.createObjectURL(blob),
    anchor = documentImpl.createElement("a");
  anchor.href = url;
  anchor.download = `${s(record.name || record.title || "meeting")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .slice(0, 80)}-v${revision.replace(/[^a-z0-9_-]/gi, "-")}.doc`;
  documentImpl.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => urlImpl.revokeObjectURL(url), 1000);
  return {
    filename: anchor.download,
    format: "Word-compatible HTML",
    revision,
  };
}

export function printMeeting(record, { windowImpl = globalThis.window } = {}) {
  const html = renderMeetingHtml(record),
    popup = windowImpl.open("", "_blank");
  if (!popup)
    throw fail(
      "POPUP_BLOCKED",
      "Allow pop-ups for this site, then choose Print / Save PDF again.",
    );
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function validateGoogleConfig(clientId) {
  const valid =
    typeof clientId === "string" &&
    /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId.trim());
  return {
    enabled: valid,
    clientId: valid ? clientId.trim() : "",
    message: valid
      ? ""
      : "Google export is unavailable. Configure VITE_GOOGLE_CLIENT_ID with a Google OAuth web client ID. Print / Save PDF and editable download remain available.",
  };
}

export async function loadGoogleIdentity({
  documentImpl = globalThis.document,
  google = globalThis.google,
} = {}) {
  if (google?.accounts?.oauth2) return google;
  if (!documentImpl)
    throw fail("BROWSER_REQUIRED", "Connect Google in a supported browser.");
  await new Promise((resolve, reject) => {
    let script = documentImpl.querySelector(
      "script[data-council-google-identity]",
    );
    if (script?.dataset.loaded === "true")
      return reject(
        fail(
          "GIS_UNAVAILABLE",
          "Google sign-in did not load. Reload the page and retry.",
        ),
      );
    if (!script) {
      script = documentImpl.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.councilGoogleIdentity = "true";
      documentImpl.head.appendChild(script);
    }
    const timeout = setTimeout(
      () =>
        reject(
          fail(
            "GIS_UNAVAILABLE",
            "Google sign-in timed out. Check your connection and retry.",
          ),
        ),
      15000,
    );
    script.addEventListener(
      "load",
      () => {
        clearTimeout(timeout);
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(
          fail(
            "GIS_UNAVAILABLE",
            "Google sign-in could not load. Check your connection and retry.",
          ),
        );
      },
      { once: true },
    );
  });
  if (!globalThis.google?.accounts?.oauth2)
    throw fail(
      "GIS_UNAVAILABLE",
      "Google sign-in is unavailable in this browser.",
    );
  return globalThis.google;
}

export async function connectGoogleAccount({
  clientId,
  google = globalThis.google,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const config = validateGoogleConfig(clientId);
  if (!config.enabled) throw fail("GOOGLE_UNCONFIGURED", config.message);
  if (!google?.accounts?.oauth2)
    throw fail(
      "GIS_UNAVAILABLE",
      "Load Google sign-in, then connect your school Google account.",
    );
  const token = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: GOOGLE_EXPORT_SCOPE,
      include_granted_scopes: false,
      callback: (response) =>
        response.error
          ? reject(
              fail(
                "GOOGLE_AUTH",
                "Google authorization was declined or expired. Connect your school account and retry.",
              ),
            )
          : resolve(response),
      error_callback: () =>
        reject(
          fail(
            "GOOGLE_AUTH",
            "Google sign-in was closed or blocked. Allow the pop-up and retry.",
          ),
        ),
    });
    client.requestAccessToken({ prompt: "select_account consent" });
  });
  if (
    !token.access_token ||
    !Number.isFinite(Number(token.expires_in)) ||
    Number(token.expires_in) <= 0
  )
    throw fail(
      "GOOGLE_AUTH",
      "Google returned an invalid authorization. Reconnect and retry.",
    );
  let response;
  try {
    response = await fetchImpl(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
  } catch {
    throw fail(
      "GOOGLE_ACCOUNT",
      "Could not confirm the Google account. Check your connection, reconnect and retry.",
    );
  }
  if (!response.ok)
    throw fail(
      "GOOGLE_ACCOUNT",
      "Could not confirm the Google account. Reconnect and retry.",
    );
  const account = await response.json();
  if (!account.email || !account.sub || account.email_verified !== true)
    throw fail(
      "GOOGLE_ACCOUNT",
      "Google did not return a verified account email. Reconnect with your school account.",
    );
  return {
    accessToken: token.access_token,
    account: {
      email: account.email,
      name: account.name || account.email,
      sub: account.sub,
    },
    expiresAt: now() + Number(token.expires_in) * 1000,
  };
}

async function googleRequest(fetchImpl, url, options) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch {
    throw fail(
      "GOOGLE_NETWORK",
      "Google could not be reached. Check Drive for a created copy before retrying to avoid duplicates.",
    );
  }
  if (!response.ok) {
    const messages = {
      401: "Google access expired. Reconnect your school account and retry.",
      403: "Google denied access. Check school administrator consent, Drive API access and folder permission.",
      404: "The destination or document is unavailable to this app. Use My Drive or a folder selected for this app.",
      429: "Google is receiving too many requests. Wait briefly and retry.",
    };
    throw fail(
      `GOOGLE_${response.status}`,
      messages[response.status] ||
        "Google could not complete the export. Check Drive for a created copy before retrying.",
    );
  }
  return response.json();
}

export async function exportGoogleMeeting({
  record,
  session,
  destinationFolderId = "",
  confirmedAccountEmail,
  previousExport,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const revision = publishedRevision(record),
    html = renderMeetingHtml(record);
  if (!record.id)
    throw fail(
      "MEETING_ID",
      "Save the meeting before exporting a versioned copy.",
    );
  if (
    !session?.accessToken ||
    !session.account?.email ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= now() + 30000
  )
    throw fail(
      "GOOGLE_EXPIRED",
      "Connect your school Google account again before exporting.",
    );
  if (confirmedAccountEmail !== session.account.email)
    throw fail(
      "ACCOUNT_CONFIRMATION",
      "Confirm the displayed school Google account before creating the export.",
    );
  const folder = s(destinationFolderId).trim();
  if (folder && !/^[a-zA-Z0-9_-]{10,200}$/.test(folder))
    throw fail(
      "INVALID_FOLDER",
      "Enter a valid Drive folder ID, or leave it empty to use My Drive.",
    );
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const base = "https://www.googleapis.com/drive/v3/files";
  const same =
    s(previousExport?.revision) === revision &&
    previousExport?.meetingId === s(record.id) &&
    previousExport?.accountEmail === session.account.email &&
    previousExport?.destinationFolderId === folder &&
    previousExport?.documentId;
  if (same) {
    const doc = await googleRequest(
      fetchImpl,
      `${base}/${encodeURIComponent(previousExport.documentId)}?fields=id,trashed,mimeType&supportsAllDrives=true`,
      { headers },
    );
    if (!doc.trashed && doc.mimeType === "application/vnd.google-apps.document")
      return {
        ...previousExport,
        revision,
        url: `https://docs.google.com/document/d/${encodeURIComponent(previousExport.documentId)}/edit`,
        status: "current",
      };
  }
  if (folder) {
    const destination = await googleRequest(
      fetchImpl,
      `${base}/${folder}?fields=id,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`,
      { headers },
    );
    if (
      destination.trashed ||
      destination.mimeType !== "application/vnd.google-apps.folder" ||
      destination.capabilities?.canAddChildren !== true
    )
      throw fail(
        "INVALID_FOLDER",
        "Choose a writable Drive folder available to this app, or use My Drive.",
      );
  }
  const boundary = `council_export_${now()}_${Math.random().toString(36).slice(2)}`;
  const metadata = {
    name: `${record.name || record.title || "Council meeting"} — Minutes v${revision}`,
    mimeType: "application/vnd.google-apps.document",
    ...(folder ? { parents: [folder] } : {}),
    appProperties: {
      councilMeetingId: s(record.id),
      publishedRevision: revision,
    },
  };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  const doc = await googleRequest(
    fetchImpl,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!doc.id)
    throw fail(
      "GOOGLE_RESULT",
      "Google did not return a document ID. Check Drive before retrying.",
    );
  return {
    status: "exported",
    meetingId: s(record.id),
    revision,
    documentId: doc.id,
    url: `https://docs.google.com/document/d/${encodeURIComponent(doc.id)}/edit`,
    exportedAt: new Date(now()).toISOString(),
    accountEmail: session.account.email,
    destinationFolderId: folder,
  };
}
