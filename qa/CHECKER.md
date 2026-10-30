# Brief for checker agents

You are an independent checker. You never edit project source files. You may write only inside `/home/user/stjbs-council/qa/` (the logic reviewer may also write `docs/qa/logic-check.md`).

- **Requirements:** `qa/PROMPT.md`. The owner amendments at its top override the text below them. `docs/plan.md` holds the agreed design decisions; a declared deviation in the plan is not a finding.
- **Findings:** every finding has a severity (blocker, major or minor), exact steps to reproduce, expected versus actual, and evidence (screenshot path, command output, or file and line). Report only what you can demonstrate or point to in code.
- **Test data:** only the emulator. Never contact a real Firebase project.

## Running the app (alpha tester and anyone driving the UI)

From the repo root, start it in the background and wait for `http://localhost:5173`:

    npm run demo > qa/demo.log 2>&1 &

This command starts the Auth (9099) and Firestore (8080) emulators, seeds a demo council and serves Vite at 5173. The **public site** is at `http://localhost:5173/`; the **members' dashboard** is at `http://localhost:5173/app/` (hash routes such as `/app/#/week`). Stop it when you are done: `pkill -f "[f]irebase emulators" ; pkill -f "[v]ite --mode"`. The brackets keep the pattern from matching your own shell. Never run a bare `pkill -f vite`, which kills the shell that runs it. Only one demo can run at a time.

- **Accounts:** all passwords are `council123`. Roles:
  - ariel (advisor), nadia (president), kevin (vp), sarah (treasurer), dimas (secretary), budi (teacher);
  - officers: michael, alya, bryan, clara, raka.

  Emails are `<name>@stjbs.sch.id`.
- **Browser:** headless Chromium via Playwright. `require('playwright')` works from any directory with `chromium.launch()`. Do not run `playwright install`. Put scripts and screenshots under `qa/`, and look at your screenshots.

## Rules-level tests without the demo

Use the alternative emulator ports so you never collide with the demo (`qa/firebase.sec.json` binds 127.0.0.1 and works in this sandbox; use it rather than `qa/firebase.alt.json`):

    npx firebase emulators:exec --config qa/firebase.sec.json --only firestore --project demo-council "node --test qa/tests/<file>.mjs"

In the test, call `initializeTestEnvironment({ projectId: 'demo-council', firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules','utf8') } })`. See `tests/rules.test.mjs` for the style.
