# Google Docs and local minutes exports

`src/meeting-export.js` exports a **copy of published minutes**, never a live sync. Every filename and native Google document title includes the published revision. Google account connection is separate from Firebase school roster access: it neither signs a user into Council nor changes who can view, edit or publish a meeting.

## Configuration (deployment administrator)

1. In [Google Cloud Console](https://console.cloud.google.com/), select the school's intended project and enable **Google Drive API**. The module uses Drive `files.create` multipart upload to convert `text/html` into `application/vnd.google-apps.document`, as supported by [Drive import documentation](https://developers.google.com/workspace/drive/api/guides/manage-uploads#import_to_google_docs_types). It does not call Google Docs API; that API need not be enabled for this implementation.
2. Configure the OAuth consent screen with the school's app name, support contact and privacy policy. Use Internal audience only if the deployment and project organization meet Google's Workspace requirements. Otherwise use External with approved test users while testing; meet Google's verification/publishing requirements before broad rollout. School Workspace administrators may need to allow the app.
3. Create an OAuth **Web application** client. Add each exact scheme/host/port used to serve Council to **Authorized JavaScript origins** (for example `https://council.school.example` and the actual development origin). Do not include a path or wildcard. This browser token flow needs no server redirect URI.
4. Set the build-time environment variable `VITE_GOOGLE_CLIENT_ID` to the resulting `123...-....apps.googleusercontent.com` web client ID in the deployment configuration and rebuild through the normal release process. This is a public client identifier. **Never put a client secret, refresh token, service-account key or access token into a Vite variable, source file or Firestore document.**
5. Permit `https://accounts.google.com/gsi/client` and the Google identity/Drive endpoints in the site's CSP if a CSP is configured. Google Identity Services must load before the user's Connect click; token requests should run directly from that user action to avoid browser pop-up blocking.

Requested scope string: `https://www.googleapis.com/auth/drive.file openid email profile`. `drive.file` grants access to files created by/opened with this app, rather than all school Drive files. The identity scopes let the app display and confirm the actual Google account. No domain restriction is inferred from an email address: a user must explicitly confirm that the displayed account is the intended school account. School account eligibility remains governed by the school's Google settings and Council's existing Firebase permissions.

An optional destination is a raw Drive folder ID. The module validates its syntax, requests its metadata and verifies that it is a non-trashed folder with `capabilities.canAddChildren`. Under `drive.file`, an arbitrary pre-existing folder may be invisible even when the account owns it: use My Drive by leaving the field empty, or a folder already made available to this app. This module does not include a Google Picker integration and does not request broad Drive scope to access arbitrary folders. Export does not share the resulting document with anyone.

## Consumer integration

```js
import {
  validateGoogleConfig, loadGoogleIdentity, connectGoogleAccount,
  exportGoogleMeeting, downloadMeetingDocument, printMeeting,
} from './meeting-export.js';

const config = validateGoogleConfig(import.meta.env.VITE_GOOGLE_CLIENT_ID);
// Show config.message and disable only Google controls when !config.enabled.
// Preload GIS after configuration is valid (e.g. while the export panel opens).
const google = config.enabled ? await loadGoogleIdentity() : null;
// In the Connect button click handler:
const session = await connectGoogleAccount({ clientId: config.clientId, google });
// Display session.account.email, destination (My Drive by default), and version.
// Obtain explicit account confirmation before calling:
const result = await exportGoogleMeeting({
  record: publicPublishedRecord,
  session,
  confirmedAccountEmail: session.account.email,
  destinationFolderId: '',
  previousExport: savedExportMetadata,
});
// Save result metadata through the existing authorized meeting action.
// Show result.url as an Open Google Doc link only after successful return.
```

Session/access-token state stays in memory only; discard it when disconnecting/unmounting. Never persist or log the session or the raw token response. Consumers should display `error.message`, allow reconnect/retry, and avoid logging raw Google response bodies. Helpers sanitize Google HTTP errors rather than displaying server-provided text.

The record must have `id`, `status: 'published'`, and `publishedVersion` or `revision` (or legacy `version`). It supports `name`/`title`, `date`, planned `startTime`/`endTime`, `actualStart`/`actualEnd`, `venue`, `chairName`, `minutesTakerName`, `summary`, `attendance`, `agenda`, `decisions`, `actions`, `deferred`/`deferredMatters`, `nextMeeting`, `closing`, optional `thanks`, `preparedBy`, `reviewedBy`, and `publishedAt`. Attendance explicitly exports only name, designation/role, status, and follow-up; reason/private-reason fields are never read. The consumer must supply the immutable public published snapshot, not a live draft or private attendance object. Resolve chair, actual minutes taker, presenter and owner IDs into names before export for readable minutes; IDs are only a fallback. Supply action `taskLinks: [{url, title}]` as absolute HTTP(S) links. Unsafe URL schemes are omitted.

Return metadata contains `meetingId`, string `revision`, `documentId`, `url`, `accountEmail`, `destinationFolderId`, `exportedAt`, and `status: 'exported' | 'current'`. A supplied previous export is reused only when meeting, revision, account and destination match and Google confirms the native document still exists and is not trashed. A changed revision/account/destination creates another copy. Prior metadata must be persisted by the consumer; concurrent first exports, a lost create response, or failure to save metadata can create duplicates. Network failure explicitly asks users to check Drive before retrying. A missing or inaccessible prior document produces an actionable error; clear its metadata deliberately before creating a replacement. These limitations should not be described as exactly-once export or synchronization. Do not overwrite a published snapshot without incrementing its revision.

## Google-independent outputs

`printMeeting(record)` opens escaped standalone HTML and invokes the browser Print dialog. Select **Save as PDF** for a PDF; the app does not generate a PDF binary itself. Pop-up blocking is reported with a retry instruction. `downloadMeetingDocument(record)` downloads a versioned `.doc` containing Word-compatible HTML, not OOXML `.docx`; Word or LibreOffice can open and edit it, and may show their normal format confirmation. Both formats use the same allowlisted public fields and remain available with missing/invalid Google configuration. Draft export is rejected so the published version is explicit.

## Verification

In the VS Code terminal in the repository root `/workspace/stjbs-council`, run:

```sh
node tests/meeting-export.test.mjs
```

The dependency-injected tests cover GIS token requests, verified identity, config validation, actual native-conversion request format, current/stale metadata, writable destination validation, account confirmation and expiry, HTTP/network errors, HTML escaping, unsafe links, omission of private reasons, print and real editable-download content. They use fake responses and do not contact Google.

A deployment administrator should perform this manual smoke test with an approved test meeting and school account after configuration:

1. Before configuration, confirm Google controls say unavailable while Print / Save PDF and editable download work. Confirm the printed document includes the published revision and no private absence reasons.
2. With configured allowed origin/client ID, open the export panel, connect the school Google account and verify the displayed email matches the selected Google chooser account. Confirm account and destination explicitly. Decline consent once and confirm the app reports failure without marking export complete.
3. Export a published revision to My Drive. Open the result link and confirm it is a native editable Google Doc, has the versioned title, contains structured minutes, and is owned by the chosen account. Confirm no automatic sharing occurred.
4. Export the same revision/account/destination again and confirm it opens/reuses the existing Doc. Publish a changed revision and confirm a separate Doc is created and the older copy remains unchanged.
5. Try an invalid/inaccessible folder ID and confirm no success is shown. If the app already has access to a writable test folder, verify that folder destination. Connect another permitted school account and confirm it is shown separately from Council login.
6. Expire/revoke access, block the sign-in popup, and interrupt the network; verify clear reconnect/retry feedback. Check Drive before retrying an interrupted create. Close/reload the app and verify the Google access token was not persisted.

No real Google OAuth or Drive write has been performed by the automated test suite. Configuration validation and passing mocks do not prove that the school's consent policy, origin, network or APIs are correctly configured.
