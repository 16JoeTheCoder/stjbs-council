# STJBS Council

The student council of St. Johannes Berchmans School, Jakarta, works here. The repo serves two things from one Firebase project:

- **The public site at `/`.** What the council is working on, coming events, announcements and how to join. There is no sign-in, and it makes one database read per visit.
- **The members' dashboard at `/app/`.** Plan projects, check in once a week in under a minute, run the weekly meeting, share templates and pin ideas. It feeds the WhatsApp and Google Chat groups through a copyable digest; it does not replace them.

Stack: Vite, Preact (plain JavaScript), Firebase Auth (email and password), Firestore, Firebase Hosting, on the free Spark plan. Design: the Fiat Lux system in `design/fiatlux/` (read its `DESIGN.md`).

## Run it locally with demo data

Needs Node 22 or later and Java 11 or later (for the Firestore emulator). In the **VS Code terminal in the repo root**:

```bash
npm install
```

```bash
npm run demo
```

`npm run demo` starts the Auth and Firestore emulators, seeds a demo council, and serves:

- the public site at http://localhost:5173/
- the dashboard at http://localhost:5173/app/

Every demo password is `council123`. Accounts:

- `ariel@stjbs.sch.id` (advisor)
- `nadia@stjbs.sch.id` (president)
- `kevin@stjbs.sch.id` (vice president)
- `sarah@stjbs.sch.id` (treasurer)
- `raka@stjbs.sch.id` (officer)
- `budi@stjbs.sch.id` (teacher)

Nothing touches the real project. Stop it with Ctrl+C.

## Checks before every push

Same terminal, repo root:

```bash
npm run check
```

That runs the design lint (`design/fiatlux/design-check.sh`), a build, and `scripts/check-site-bundle.mjs`, which fails if Firebase code ever reaches the public page. Expect two `ok` lines.

```bash
npm run test:rules
```

That runs `tests/rules.test.mjs` against the Firestore emulator. Expect `# fail 0`.

## Architecture

- **Two Vite entry points, one deploy.** `index.html` plus `src/site.jsx` is the public site; `app/index.html` plus `src/main.jsx` is the dashboard, with hash routes such as `/app/#/week`. Hosting serves `dist/app/index.html` at `/app/` on its own, so there are no rewrites.
- **Old links still work.** `/#/week`, and a home-screen icon saved at `/`, are sent to `/app/` by a script in the public page's head before anything renders. The manifest keeps `"id": "/"`, so installed apps keep their identity.
- **The public site reads one document,** `public/feed`, over the Firestore REST API. It loads no Firebase SDK. If the read fails it shows the visitor's last copy with "Updated earlier", or just the static page.
- **Publishing needs no Cloud Functions.** While the advisor, president or vice president has the dashboard open, their session rebuilds the feed on open and every 10 minutes. It writes only when the content changed, and it re-reads the public data from the server first, so a phone that has been asleep cannot republish something made private. Admin, Public site, Publish now forces it.
- **The payload is a fixed list of fields.**
  - Public root projects: title, stage, percent, task counts and a one-line blurb.
  - Public events from today on: title, type, date, times and place.
  - Announcements for everyone: title, text and dates.

  It never holds names, emails, comments, check-ins or task titles. Once something is public, only an admin can change its title, place or time.
- **The read budget.** The free plan allows 50 000 reads a day; past that, every read fails until midnight Pacific time (14:00 or 15:00 in Jakarta). Three measures keep the dashboard well under that:
  - **Item snapshot.** One `cache/{term}` document holds every live item of the term. A cold open reads it plus only the items changed since it was built, about 210 reads instead of about 590. Admin sessions rebuild it from a fresh server read about once a day, and after bulk changes.
  - **Device cache.** Data is cached on the device, so a reopen within about 30 minutes costs only the changes.
  - **Optional data.** Activity, ideas, RSVPs and submissions load only on the screens that show them.

  The arithmetic is in `docs/plan.md`, section 6.
- **No Cloud Storage.** Files are always Google Docs or Drive links, and the rules accept only those hosts.

## Roles

`firestore.rules` is the permission layer; hidden buttons are cosmetic. Every read and write needs a signed-in, email-verified account whose lowercased school email has an active document in `members`.

| Role | Can |
|---|---|
| advisor | Everything. The only one who sets the term (`settings/current`) and assigns or removes the advisor role. |
| vp | Admin view. Adds members; changes any member's role and active flag except the advisor's and their own; never assigns advisor. Announcements, publishing, approvals. |
| president | Admin view. Adds officers, treasurers, secretaries and teachers; edits name, section and reports-to; cannot change roles or active flags. Announcements, publishing, approvals. |
| treasurer, secretary | Start root projects, edit the digest and project templates. |
| officer | Work on tasks, lead subteams they are made lead of, add events, pin and vote on ideas, share resources. |
| teacher | Read and comment only. |

Nobody changes their own role or active flag. Every `*Uid` field stores the lowercased school email, so tasks can be assigned before someone's first sign-in. Nothing is deleted except your own comments and notifications; everything else is archived.

## What Josef sets up once

Nothing new in the Firebase console. This release only needs the rules, indexes and hosting deployed, in this order, from the **VS Code terminal in the repo root**:

1. Once per computer, pick the project. It is registered under the name `build`.

   ```bash
   npx firebase use build
   ```

2. Ship the new indexes first, so copies of the old app keep working while they build:

   ```bash
   npx firebase deploy --only firestore:indexes
   ```

3. Wait until every index shows **Enabled**. Check this in the Firebase console in the browser, under Firestore, Indexes; it takes a few minutes.
4. Deploy the rules and both sites:

   ```bash
   npm run deploy
   ```

5. Open the dashboard once as the advisor, president or vice president. That builds the first item snapshot and the public feed.
6. In Projects, Pipeline, move each real project to the right column. Existing projects all start in Planning. Then switch on Public for the ones visitors should see, and give each a one-line blurb.

After deploy day, `npm run deploy` is all a release needs.

### First setup of a brand-new project (only if the Firebase project ever has to be recreated)

Do all of this signed in as the dedicated council Gmail account, never a personal one.

1. **Create the project.** In the Firebase console in the browser: Add project, Analytics off.
2. **Add a web app.** Project settings, Your apps, Web. Copy the config values.
3. **Enable sign-in.** Build, Authentication, Sign-in method, Email/Password, Enable. Edit the verification email text under Templates.
4. **Create Firestore.** Build, Firestore Database, production mode, location `asia-southeast2` (Jakarta). The location cannot change later.
5. **Bootstrap.** In the Firestore data tab, create:
   - collection `settings`, document `current`: `termId` and `termName` (strings, for example `2026-27`) and `startDate` (string, for example `2026-10-26`);
   - collection `members`, document id = the advisor's lowercased school email: `name` (string), `role` `advisor`, `active` `true`, `section` (string), `reportsTo` (null), `termId` (string).
6. **Test email delivery on day one.** Create an account with a real school inbox. If the verification email does not arrive, ask IT to allow `noreply@<project-id>.firebaseapp.com`.
7. **Config.** In VS Code, in the repo root, copy `.env.example` to `.env.local` and paste the values from step 2. They are public identifiers, not secrets; `.env.local` stays out of git.

Then follow the deploy steps above.

## Decisions

- **No Cloud Functions, no Storage, no paid plan.** Functions and new Storage buckets need the Blaze plan, which is hard to get approved. Publishing runs in admin sessions, and files are Google links.
- **Reads are the limit to watch.** The cost driver is opens, not usage. During the first week, check Firestore, Usage in the Firebase console. Bulk changes (a lead change on a large tree, a template import) cost one read per open client per item.
- **The device cache and shared computers.** Sign out from the avatar menu wipes the device's copy of council data. The wipe cannot run while another tab has the app open, and a session that simply expires keeps the copy, so on shared school computers members should close other tabs and use Sign out.
- **Notifications are in-app only.** Push and email need Functions.
- **No profile photos.** Initials only; photos of minors need the school's consent.
- **Close term** changes only `settings/current.termId` after a forced backup download of every collection. Templates, submissions (the handover archive) and the public feed are cross-term and survive it.
- **Data kept about students:** name, school email, role, section, reports-to and their council work. Nothing else.

## Layout

```
index.html, src/site.jsx      public site
app/index.html, src/main.jsx  dashboard
src/                          store, model, actions, queries, publish, feed, shared views, routes/
firestore.rules               the permission layer
firestore.indexes.json        composite indexes (production enforces them; the emulator does not)
tests/                        rules tests
design/fiatlux/               the design system
scripts/                      seed-emulator.mjs, make-icons.cjs, check-site-bundle.mjs
qa/                           checker reports, backlog, independent tests (never built into the site)
docs/                         plan, brief, QA history, screenshots
```
