# Meeting concurrency and integrity emulator results

Date: 2026-11-03. Dedicated Firestore emulator project: `demo-council-concurrency`, at `127.0.0.1:8080`. This suite loads the repository's current `firestore.rules` into that project only and clears only its own project between cases. The browser project's `demo-council` data was not cleared. No production service or Google OAuth was used.

Run from the VS Code terminal in the repository root `/workspace/stjbs-council` while the local Firestore emulator is running:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/meeting-concurrency.test.mjs
```

The final completed run returned **11 passing, 0 failing**, 11 total, exit status 0, in 1.90 seconds. No tests were skipped. Fixtures follow the final rules protocol: an immutable pure-proposal companion for each request revision, canonical attendance status maps, and both immutable agenda section documents on publication.

| Case | Observed outcome |
| --- | --- |
| Two independent admin clients approve one request after both read revision 1 | One transaction commits, one rejects after conflict/revision recheck; exactly one event exists and the request is scheduled at revision 2. Creating a second event linked to the request is denied. |
| Two owner clients save the same request snapshot; stale event write | Exactly one request edit commits. Direct stale owner and event revision replays are denied. |
| Current host transfers to the designated cohost while that cohost explicitly claims the host role | Exactly one transfer commits; meeting/session host IDs agree. Former host replay is denied even when it supplies the next revision. New host can advance the session. |
| Two independent current-host clients simultaneously transfer minutes ownership | Exactly one transfer commits; meeting owner and private draft editor agree. Atomic draft revision increment matches the action's implementation without reading private text. Former editor cannot save draft, private topic notes or a temporarily authorized task; new editor can save. |
| Two independent editor tabs save one draft revision | Exactly one transaction commits. Queued stale draft and private-topic writes are denied. |
| Task transaction pauses after reading a live grant; another client closes meeting | Closed meeting commits first; paused task write rejects. Original task stays unchanged. Offline replay and subsequent session mutation are denied. |
| Invited room, teacher, host and cohost privacy boundaries | Each can read shared session controls. Every tested draft, private topic and sensitive attendance read is denied. Signed-out room read is denied. Admin can read the private records. |
| Current-term payloads against missing/old-term meeting parents | Session, draft, private-topic writes and forged temporary task grants are denied. |
| Teacher is deliberately named host/cohost/editor | Lifecycle, session, private minutes/topic and task mutations are denied. Existing bounded teacher suggestion creation remains allowed. |
| Atomic publication adds a top-level `absenceReasons` field | Entire batch is denied; draft remains in review and no version is created. |
| Atomic publication embeds `reason` inside a canonical attendance map value | Entire batch is denied. The same publication with only attendance corrected to `{uid: 'absent'}` succeeds, and the invited room client reads the safe status. |

The original nested-attendance privacy regression now passes. Final publication uses a map from participant UID to one of four status strings, so nested attendance reason objects are rejected. The negative fixture supplies all required publication dependencies, including both agenda chunks, and follows its rejection with an otherwise identical successful publication using a valid attendance status. This verifies that unrelated missing companion documents do not mask the privacy assertion. App exports still omit private absence reasons by default.

The approval and owner-edit transactions write the required exact proposal companion atomically at each workflow revision. The host race uses only authorized targets: current host to designated cohost, and designated cohost to self. The minutes handoff race uses two clients of the sole current host; an ordinary cohost no longer has concurrent controller authority. The teacher positive shared-read fixture explicitly includes the teacher in frozen participants.

The race cases use separate authenticated SDK contexts, real `runTransaction` operations, and barriers that ensure both initial reads occur before the first commit. The closing case explicitly holds one client's transaction while the other closes, then releases its write. No mocked Firestore results or security-rule bypasses are used for assertions. Rules-disabled contexts are used only to seed fixtures, old-term records and deliberately malformed role assignments. The suite mirrors action transaction semantics with small SDK calls; it does not import browser-global application actions, test notification rendering, or prove browser offline persistence behavior. Direct stale writes exercise the server-side protection expected when queued writes reconnect.
