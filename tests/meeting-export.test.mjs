import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAttendance,
  formatMeetingTime,
  GOOGLE_EXPORT_SCOPE,
  validateGoogleConfig,
  connectGoogleAccount,
  renderMeetingHtml,
  downloadMeetingDocument,
  printMeeting,
  exportGoogleMeeting,
} from "../src/meeting-export.js";

const clientId = "123456-schooltest.apps.googleusercontent.com";
const record = {
  id: "meeting-1",
  status: "published",
  revision: 2,
  name: '<Council & "friends">',
  date: "2026-11-03",
  startTime: "09:00",
  endTime: "10:00",
  actualStart: "09:05",
  actualEnd: "10:10",
  venue: "Library",
  chairName: "Chair",
  minutesTakerName: "Secretary",
  attendance: [
    {
      uid: "one",
      name: "Alex",
      designation: "Member",
      status: "absent",
      followUp: "Send agenda",
      privateReason: "PRIVATE_MEDICAL",
      reason: "PRIVATE_REASON",
    },
  ],
  summary: "Whole meeting summary",
  agenda: [
    {
      title: "Budget",
      presenterUid: "Alex",
      discussion: "Discussed costs",
      outcome: "Agreed",
      decision: "APPROVED",
    },
  ],
  decisions: "Approve budget",
  actions: [
    {
      text: "Book venue",
      ownerUid: "Alex",
      dueDate: "2026-11-06",
      status: "open",
      taskLinks: [
        { url: "https://council.example/#/p/task1", title: "Task 1" },
        { url: "javascript:alert(1)", title: "Bad" },
      ],
    },
  ],
  deferred: ["Catering"],
  nextMeeting: { date: "2026-11-10", time: "09:00", venue: "Hall" },
  preparedBy: "Secretary",
  reviewedBy: "Teacher",
  publishedAt: "2026-11-03T11:00:00Z",
};
const now = () => 100000;
const session = {
  accessToken: "test-token",
  account: { email: "school@example.test", sub: "123" },
  expiresAt: 200000,
};
const ok = (body) => ({ ok: true, json: async () => body });
const opts = (extra = {}) => ({
  record,
  session,
  confirmedAccountEmail: session.account.email,
  now,
  ...extra,
});

test("Google config validates a web client ID and disables only Google when missing", () => {
  assert.equal(validateGoogleConfig(clientId).enabled, true);
  for (const invalid of [
    "",
    undefined,
    "test",
    "secret.apps.googleusercontent.com",
    "123-foo.apps.googleusercontent.com/",
  ])
    assert.equal(validateGoogleConfig(invalid).enabled, false);
  assert.match(validateGoogleConfig("").message, /Print/);
  assert.match(renderMeetingHtml(record), /Published version 2/);
  assert.match(GOOGLE_EXPORT_SCOPE, /drive\.file/);
  assert.doesNotMatch(GOOGLE_EXPORT_SCOPE, /auth\/drive(?:\s|$)/);
});

test("minutes escape content, include public fields and omit private reasons and unsafe links", () => {
  const html = renderMeetingHtml({
    ...record,
    closing: "<script>alert(1)</script>",
  });
  for (const text of [
    "Alex",
    "absent",
    "09:00",
    "10:00",
    "09:05",
    "10:10",
    "Chair",
    "Secretary",
    "Whole meeting summary",
    "Discussed costs",
    "APPROVED",
    "Approve budget",
    "Book venue",
    "2026-11-06",
    "Catering",
    "2026-11-10",
    "Hall",
    "Teacher",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /&lt;Council &amp; &quot;friends&quot;&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(
    html,
    /<script|PRIVATE_|javascript:|Send agenda|>Member</,
  );
  assert.match(html, /href="https:\/\/council.example\/#\/p\/task1"/);
  assert.match(renderMeetingHtml(record), /Meeting closed at 10:10\./);
});

test("all formats require a published revision", async () => {
  for (const invalid of [
    { ...record, status: "draft" },
    { ...record, revision: null },
    { ...record, revision: 0 },
  ]) {
    assert.throws(() => renderMeetingHtml(invalid), { code: "UNPUBLISHED" });
    assert.throws(() => downloadMeetingDocument(invalid), {
      code: "UNPUBLISHED",
    });
    assert.throws(() => printMeeting(invalid), { code: "UNPUBLISHED" });
    await assert.rejects(exportGoogleMeeting(opts({ record: invalid })), {
      code: "UNPUBLISHED",
    });
  }
});

test("editable download is a real Word-compatible HTML blob with versioned filename", async () => {
  let captured,
    clicked = false,
    removed = false;
  const anchor = {
    click() {
      clicked = true;
    },
    remove() {
      removed = true;
    },
  };
  const result = downloadMeetingDocument(record, {
    documentImpl: { createElement: () => anchor, body: { appendChild() {} } },
    urlImpl: {
      createObjectURL(blob) {
        captured = blob;
        return "blob:test";
      },
      revokeObjectURL() {},
    },
  });
  assert.equal(captured.type, "application/msword;charset=utf-8");
  assert.match(await captured.text(), /<!doctype html>/);
  assert.match(result.filename, /-v2\.doc$/);
  assert.equal(clicked && removed, true);
});

test("print opens escaped standalone minutes and invokes browser print; blocked popup is actionable", () => {
  let written = "",
    printed = false;
  const popup = {
    document: {
      open() {},
      write(html) {
        written = html;
      },
      close() {},
    },
    focus() {},
    print() {
      printed = true;
    },
  };
  printMeeting(record, { windowImpl: { open: () => popup } });
  assert.equal(printed, true);
  assert.match(written, /Minutes/);
  assert.equal(popup.opener, null);
  assert.throws(
    () => printMeeting(record, { windowImpl: { open: () => null } }),
    { code: "POPUP_BLOCKED" },
  );
});

test("GIS requests minimal file scope and account chooser, verifies account separately from Firebase", async () => {
  let init, request, userinfo;
  const google = {
    accounts: {
      oauth2: {
        initTokenClient(options) {
          init = options;
          return {
            requestAccessToken(options) {
              request = options;
              init.callback({ access_token: "test-token", expires_in: 3600 });
            },
          };
        },
      },
    },
  };
  const result = await connectGoogleAccount({
    clientId,
    google,
    now,
    fetchImpl: async (url, options) => {
      userinfo = [url, options];
      return ok({
        email: "school@example.test",
        email_verified: true,
        sub: "123",
        name: "School",
      });
    },
  });
  assert.equal(init.scope, GOOGLE_EXPORT_SCOPE);
  assert.equal(init.include_granted_scopes, false);
  assert.match(request.prompt, /select_account/);
  assert.equal(userinfo[0], "https://openidconnect.googleapis.com/v1/userinfo");
  assert.equal(userinfo[1].headers.Authorization, "Bearer test-token");
  assert.equal(result.account.email, "school@example.test");
  assert.equal(result.expiresAt, 3700000);
  await assert.rejects(connectGoogleAccount({ clientId: "", google }), {
    code: "GOOGLE_UNCONFIGURED",
  });
});

test("authorization denial and missing verified identity never produce sessions", async () => {
  const fake = (response) => ({
    accounts: {
      oauth2: {
        initTokenClient(options) {
          return {
            requestAccessToken() {
              options.callback(response);
            },
          };
        },
      },
    },
  });
  await assert.rejects(
    connectGoogleAccount({
      clientId,
      google: fake({ error: "access_denied" }),
    }),
    { code: "GOOGLE_AUTH" },
  );
  await assert.rejects(
    connectGoogleAccount({
      clientId,
      google: fake({ access_token: "token", expires_in: 0 }),
    }),
    { code: "GOOGLE_AUTH" },
  );
  await assert.rejects(
    connectGoogleAccount({
      clientId,
      google: fake({ access_token: "token", expires_in: 3600 }),
      fetchImpl: async () =>
        ok({ email: "x", sub: "123", email_verified: false }),
    }),
    { code: "GOOGLE_ACCOUNT" },
  );
});

test("Google export converts HTML into a native versioned Doc with no secrets in metadata", async () => {
  let request;
  const result = await exportGoogleMeeting(
    opts({
      fetchImpl: async (url, options) => {
        request = [url, options];
        return ok({ id: "doc123" });
      },
    }),
  );
  assert.match(request[0], /upload\/drive\/v3\/files\?uploadType=multipart/);
  assert.equal(request[1].method, "POST");
  assert.match(request[1].body, /application\/vnd.google-apps.document/);
  assert.match(request[1].body, /text\/html; charset=UTF-8/);
  assert.match(request[1].body, /Minutes v2/);
  assert.doesNotMatch(request[1].body, /test-token|PRIVATE_/);
  assert.equal(result.status, "exported");
  assert.equal(result.revision, "2");
  assert.equal(result.url, "https://docs.google.com/document/d/doc123/edit");
  assert.equal(result.accountEmail, session.account.email);
  assert.equal(result.destinationFolderId, "");
});

test("current same revision is verified remotely and returns without creating duplicate", async () => {
  const previousExport = {
    meetingId: record.id,
    revision: "2",
    accountEmail: session.account.email,
    destinationFolderId: "",
    documentId: "existing",
    url: "javascript:alert(1)",
  };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push([url, options]);
    return ok({
      id: "existing",
      mimeType: "application/vnd.google-apps.document",
    });
  };
  const result = await exportGoogleMeeting(opts({ previousExport, fetchImpl }));
  assert.equal(result.status, "current");
  assert.equal(result.url, "https://docs.google.com/document/d/existing/edit");
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].method, undefined);
  assert.match(requests[0][0], /\/existing\?/);
});

test("stale revision creates a fresh copy; trashed prior copy also creates a replacement", async () => {
  for (const revision of ["1", "2"]) {
    let posts = 0;
    const previousExport = {
      meetingId: record.id,
      revision,
      accountEmail: session.account.email,
      destinationFolderId: "",
      documentId: "old",
    };
    const result = await exportGoogleMeeting(
      opts({
        previousExport,
        fetchImpl: async (url, options) => {
          if (options.method === "POST") {
            posts++;
            return ok({ id: "new" });
          }
          return ok({ id: "old", trashed: true });
        },
      }),
    );
    assert.equal(result.documentId, "new");
    assert.equal(posts, 1);
  }
});

test("requires account confirmation, fresh session and valid destination before network work", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return ok({});
  };
  for (const [extra, code] of [
    [{ confirmedAccountEmail: "" }, "ACCOUNT_CONFIRMATION"],
    [{ session: { ...session, expiresAt: undefined } }, "GOOGLE_EXPIRED"],
    [{ session: { ...session, expiresAt: 101000 } }, "GOOGLE_EXPIRED"],
    [
      { destinationFolderId: "https://drive.google.com/folder" },
      "INVALID_FOLDER",
    ],
    [{ record: { ...record, id: "" } }, "MEETING_ID"],
  ])
    await assert.rejects(exportGoogleMeeting(opts({ fetchImpl, ...extra })), {
      code,
    });
  assert.equal(calls, 0);
});

test("validates folder access before creating a Doc in its parent destination", async () => {
  const requests = [];
  const destinationFolderId = "folder123456789";
  const result = await exportGoogleMeeting(
    opts({
      destinationFolderId,
      fetchImpl: async (url, options) => {
        requests.push([url, options]);
        return ok(
          options.method === "POST"
            ? { id: "new" }
            : {
                id: destinationFolderId,
                mimeType: "application/vnd.google-apps.folder",
                capabilities: { canAddChildren: true },
              },
        );
      },
    }),
  );
  assert.equal(result.destinationFolderId, destinationFolderId);
  assert.match(requests[1][1].body, /"parents":\["folder123456789"\]/);
  await assert.rejects(
    exportGoogleMeeting(
      opts({
        destinationFolderId,
        fetchImpl: async () =>
          ok({
            mimeType: "application/vnd.google-apps.folder",
            capabilities: { canAddChildren: false },
          }),
      }),
    ),
    { code: "INVALID_FOLDER" },
  );
});

test("API and network failures remain actionable, retryable failures with no fake success", async () => {
  for (const status of [401, 403, 404, 429, 500])
    await assert.rejects(
      exportGoogleMeeting(
        opts({
          fetchImpl: async () => ({
            ok: false,
            status,
            json: async () => ({ error: { message: "SECRET_TOKEN" } }),
          }),
        }),
      ),
      (error) => {
        assert.equal(error.code, `GOOGLE_${status}`);
        assert.doesNotMatch(error.message, /SECRET_TOKEN/);
        return true;
      },
    );
  await assert.rejects(
    exportGoogleMeeting(
      opts({
        fetchImpl: async () => {
          throw new Error("SECRET_TOKEN");
        },
      }),
    ),
    { code: "GOOGLE_NETWORK" },
  );
  await assert.rejects(
    exportGoogleMeeting(opts({ fetchImpl: async () => ok({}) })),
    { code: "GOOGLE_RESULT" },
  );
});

test("canonical attendance status maps retain only safe enum rows and resolve authorized roster names", () => {
  const rows = normalizeAttendance(
    {
      "a@school.test": "present",
      "b@school.test": "excused",
      "c@school.test": { reason: "PRIVATE_REASON" },
    },
    [{ id: "a@school.test", name: "Ariel" }],
  );
  assert.deepEqual(rows, [
    { uid: "a@school.test", name: "Ariel", status: "present" },
    { uid: "b@school.test", name: "b@school.test", status: "excused" },
  ]);
  assert.doesNotMatch(
    renderMeetingHtml({
      ...record,
      attendance: {
        "a@school.test": "late",
        "b@school.test": { reason: "PRIVATE_REASON" },
      },
      actualStart: Date.parse("2026-11-03T08:05:00Z"),
      actualEnd: Date.parse("2026-11-03T09:00:00Z"),
    }),
    /PRIVATE_REASON/,
  );
  assert.equal(formatMeetingTime(Date.parse("2026-11-03T08:05:00Z")), "15:05");
});
