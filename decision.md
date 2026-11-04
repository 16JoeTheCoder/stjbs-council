# Decisions for Josef

Every design or technical decision made during this release, in plain language: what, why, and what was rejected.

## Ground rules

1. **Fiat Lux wins over the general brand note.** A personal note on this machine names a different palette (ink, paper, orange). The project's `CLAUDE.md` and `design/fiatlux/DESIGN.md` are the rule book for this repo, so every colour here is a Fiat Lux token. Rejected: mixing the two palettes.
2. **Part 2 wins where it conflicts with part 1.** The event editor is built once, as the split-screen editor from part 2, not first as the side sheet from part 1. The participant picker is built once, as part 2's card picker, and it also keeps part 1's search box, kind labels, struck excluded chips with undo and the live count.
3. **No new runtime dependencies.** Date picker, time field, combobox and drag-to-create are written by hand, small. A date library would add more code than it removes.
