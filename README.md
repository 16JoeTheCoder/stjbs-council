# STJBS Council

The student council dashboard for St. Johannes Berchmans School, Jakarta. One place to plan projects, see each other's progress, check in once a week in under a minute, and run the weekly meeting. It feeds the WhatsApp and Google Chat groups through a copyable digest; it does not replace them.

Stack: Vite, Preact (plain JavaScript), Firebase Auth (email and password), Firestore, Firebase Hosting. Design: the builtbyjosef system in `design/builtbyjosef/` (read its `DESIGN.md`).

## Run it locally with demo data

Needs Node 20+ and Java 11+ (for the Firestore emulator). In the **VS Code terminal in the repo root** (or an Ubuntu/WSL terminal):

```bash
npm install
npm run demo
```

This starts the Auth and Firestore emulators, seeds a demo council, and serves the app at http://localhost:5173. Sign in as `raka@stjbs.sch.id`, `nadia@stjbs.sch.id` (president) or `ariel@stjbs.sch.id` (advisor); every demo password is `council123`. Nothing touches the real project. Stop with Ctrl+C.

## Test the security rules

Same terminal, repo root:

```bash
npm run test:rules
```

It runs `tests/rules.test.mjs` against the Firestore emulator via `firebase emulators:exec`. Expect `# pass 15` and `# fail 0`. Then run the design lint: `bash scripts/jy-check.sh` (expect `ok builtbyjosef check clean`).

## What Josef sets up once (browser, Firebase console)

Do all of this signed in as the dedicated council Gmail account, never a personal one.

1. **Create the project.** console.firebase.google.com, Add project, name it `stjbs-council`. Analytics off.
2. **Add a web app.** Project settings, Your apps, Web. Copy the config values.
3. **Enable sign-in.** Build, Authentication, Sign-in method, Email/Password, Enable. Under Templates, edit the verification email text (for example: "Verify your email to join the STJBS Council dashboard.").
4. **Create Firestore.** Build, Firestore Database, Create database, production mode, location `asia-southeast2` (Jakarta) or `asia-southeast1` (Singapore). The location cannot be changed later.
5. **Bootstrap.** In the Firestore data tab, create:
   - collection `settings`, document `current`: `termId` (string) `2026-27`, `termName` (string) `2026-27`, `startDate` (string) today as `2026-10-26`.
   - collection `members`, document id = Mr. Ariel's school email in lowercase: `name` (string), `role` (string) `advisor`, `active` (boolean) `true`, `section` (string) `Advisor`, `reportsTo` (null), `termId` (string) `2026-27`.
   After that, the app manages the roster (Admin screen).
6. **Test email delivery on day one.** Create an account in the app with a real school inbox. If the verification email does not arrive, check the school's quarantine and ask Mr. Ariel to have IT allow `noreply@<project-id>.firebaseapp.com`. This is the biggest launch risk; find it before anything else.
7. **Config file.** In VS Code, in the repo root, copy `.env.example` to `.env.local` and paste the values from step 2. These are public identifiers, not secrets, but `.env.local` stays out of git.

## Deploy

VS Code terminal, repo root, once: `npx firebase login` (opens the browser; use the council Gmail account), then `npx firebase use --add` and pick the project. Each deploy:

```bash
npm run deploy
```

It builds into `dist/` and deploys Hosting plus the Firestore rules and indexes. The first deploy builds the activity index; the Feed may say "Live updates stopped" for a few minutes until it is ready.

## How permissions work

`firestore.rules` is the permission layer; hidden buttons are cosmetic. Every read and write requires a signed-in, email-verified account whose lowercased email has an `active` document in `members`. Anyone can create a raw Firebase account; without a roster entry it reads nothing.

- Member ids are lowercased school emails, and every `*Uid` field (`assigneeUids`, `leadUids`, `authorUid`, `actorUid`, `toUid` and so on) stores that email, not the Firebase uid. This lets the president assign tasks to someone before their first sign-in.
- `leadUids` on every item is the leads of all its ancestors plus its own. The rules check it equals the parent's `leadUids` plus the item's lead, read after the batch, so it cannot be forged; a lead change rewrites the subtree in batches.
- Assignees may change only status, blocked fields, notes, link and (on deal tasks) the deal fields. Teachers read and comment only.
- Nothing is deleted except your own comments and your own notifications. Everything else is archived, so year-long statistics survive.

## Decisions

- **Notifications are in-app only.** Push and email need Cloud Functions, which needs Firebase's paid Blaze plan. Josef chose to skip reminders. The bell shows unread items; the Feed has a For you list.
- **No profile photos.** Uploads need Storage, and showing photos of minors needs the school's consent. Initials in small squares do the job. If the school approves later, add uploads behind a flag.
- **Quiet tasks use tokens, not opacity**, so the not-mine text stays at 4.5:1 contrast.
- **Hide done is view-only.** It never archives or deletes, so completion statistics stay intact.
- **Workload numbers.** The live table is computed from tasks every member can read anyway. Only the saved weekly snapshots in `stats/` are restricted (advisor, president, VP). The underlying data is not secret.
- **No service worker.** Current Chrome installs the app from the manifest alone; there is no offline mode and Firestore data is never cached by us.
- **Close term** changes only `settings/current.termId` after a forced backup download. Every screen filters to the current term; set the old value back to undo.
- **Data kept about students:** name, school email, role, section, reports-to and their council work. Nothing else.

## Layout

```
src/            app code (store, model, actions, ui, routes/)
firestore.rules the permission layer
tests/          rules tests
design/         the builtbyjosef design system (installed by its script)
scripts/        jy-check.sh, seed-emulator.mjs, make-icons.cjs
public/         manifest, icons, favicon
docs/qa/        lessons, quality gate reports, known issues
```
