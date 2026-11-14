# Progress log: quick add and the Todoist-grade task list

Branch `claude/practical-ritchie-r1rgrt`. Spec: QUICKADD_SPEC.md. Decisions Q1–Q19 in `decision.md`.

## Done
- [x] Parser `src/quickadd.js` (pure, ~0.04 ms/parse): @ tiers + aliases + ambiguity, # event budgets, p1–p4, English and Indonesian dates, noun guards, quotes, escapes, rejected tokens, role warnings.
- [x] `tests/quickadd.test.mjs`: 34 tests (all spec 1.6 rows + extras), all pass.
- [x] Quick add (`src/quick-add.jsx`): inline token highlights, plain-words preview, dropdown on ambiguity, Backspace un-highlights a token, Date/Assignee/Event/Priority popovers (searchable, keyboard), stays open after Enter keeping the event, Q key, context defaults (budget page → event, profile → person).
- [x] Tasks: Mine/Given/Everyone/Overdue, groups Overdue/Today/Upcoming/No date, round priority checkbox with complete animation + 5 s Undo, side panel/sheet editing through the parser, J/K/E/T/Enter, drag to reorder and onto a 7-day strip to reschedule (mouse and touch).
- [x] Nav: Home, Tasks, Budgets, Projects + remembered More; phone floating 5-tile bar restored. Home: My tasks → Waiting on me → Next 7 days → Budgets.
- [x] Red accent per spec; DESIGN.md updated. Rules: task `priority`, `dueTime`, `order`; member `aliases` (admin form).

## Checks (last run)
- `npm run check`: ok. `npm run test:rules`: 102 pass. `node --test tests/quickadd.test.mjs`: 34 pass.
- Browser QA on the emulator (41 members), 375 and 1440 px, screenshots in `qa/quickadd/`: @-typing 2 taps/1 s; popover 2 taps (5.7 s at 375, scrolling 40 names); Indonesian 1 tap; complete+Undo 2 taps/1.3 s; drag 0 taps/<3 s. No overflow, no console errors.

## Open
- Rescheduling by drag is assigner-only (rules); the owner gets a toast explaining why.
- Not tested on a real phone keyboard; light theme not re-checked on new screens.
- Not deployed: rules must ship with the build.


---

# Progress log: tasks and budgets backbone

Branch `claude/sharp-brown-8g9glq`, pull request 16JoeTheCoder/stjbs-council#6. Every decision is in `decision.md` under "Framework update".

## Stages
- [x] 0. Data model, roles and migration plan written to `decision.md` before code.
- [x] 1. Check-ins, hero, onboarding checklist, sunburst and Digest removed; 4-tab shell with "+"; new Home.
- [x] 2. Tasks: rules, quick add, one-tap done with Undo, blocked, 48 h grace, reopen, overdue per person.
- [x] 3. Budgets and purchases: photo required, live price maths, approval, veto, receipt.
- [x] 4. Reimbursement batches, treasurer view, photo clean-up.
- [x] 5. Copy WhatsApp summary (byte-identical for officer, member and treasurer in the QA run).
- [x] 6. Tests and the 375 px pass.

## Checks (last run)
- `npm run check`: ok. `npm run test:rules`: 99 pass. `node tests/work-model.test.mjs`: 13 pass.
- 375 px pass on the emulator demo (`npm run demo`), tap counts from Home: add task 2, mark done 1, approve 2, add receipt 2, purchase request 3 (via the Home budget row), mark batch paid 1, reopen 1, copy summary 1.
- The pass found the bottom sheets pushed off screen by an old `.fl-quick` style; fixed (the new class is `fl-qs`) and re-checked by screenshot at 375 and 1440 px.

## Open issues
- Over the 3-tap rule: a task for someone else with a date is 4 taps (both extras are optional); purchase request from the Budgets tab instead of the Home row is 4; veto is 3 taps plus the confirm.
- A task inside its 48 h grace day shows yesterday's date under "This week" with no late mark. That is the rule as written; it can look odd.
- Veto and "Send request" have no Undo (veto asks first; a request can be deleted while pending).
- The old Projects tree still exists under More, with its own tasks and percentages. Run `scripts/migrate-tasks.mjs`, then decide whether to retire it.
- Not tested: a real phone camera and keyboard, light theme on the new screens, the second treasurer approving the first one's request in the browser (covered by the rules tests), `scripts/migrate-tasks.mjs` against data.
- Not deployed. Production needs the rules deployed with the build, and roles confirmed (decision F8).

## Next
Josef reviews the pull request; deploy only when told to.
