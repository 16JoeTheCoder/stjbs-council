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
