# Fiat Lux: the STJBS Student Council design system

Dark SaaS dashboard, Berchmans red, school photography. The school motto from the crest, *Fiat Lux*, names it: a dark room with one red light. This file is the only visual rule book for the council app and its public site. If something is not covered here, copy the nearest existing component; do not invent a new style.

## Files

| File | Use |
|---|---|
| `tokens.css` | Every colour, font, size, radius, shadow, duration. Also the `@font-face` rules and the `.fl-stage` class. |
| `components.css` | Every component, prefix `fl-`. Import after `tokens.css`. |
| `fonts/` | Plus Jakarta Sans 200, 400, 500, 700, 800 and JetBrains Mono 400, 700 (woff2, self-hosted, OFL). |
| `img/` | `crest.png` (640 px, transparent), `crest-256.png`, `building.webp`, `campus-sunset.webp`, `campus-sky.webp`. |
| `reference/` | `concept-desktop.png` (the approved concept), `mission-card.png`, `phone-tabbar.png`, `preview-desktop.png`, `preview-phone.png`. Look, do not copy text from them. |
| `preview.html` | A working Home built only from these classes. Open it to see every main component. |
| `design-check.sh` | Lint. Run from the repo root. Must print `ok`. |

Install: copy the folder to `design/fiatlux/` and import `design/fiatlux/tokens.css` then `design/fiatlux/components.css` once, in the app entry. Copy `img/` files to `public/img/`.

## The look in five rules

1. **Dark first.** Near-black ground `--surface`, raised cards `--surface-raised`, hairline borders `--line`, radius 20 on panels. Light theme exists (`[data-theme="light"]`) and every screen must work in it, but dark is the default.
2. **Red is the light.** `--red` fills the primary button, the active nav item, the active tab bar tile, red panels and progress. Red as text uses `--red-text`, never `--red`. White on red only.
3. **Gradients and patterns are allowed only inside these components** (all already written in `components.css`): `.fl-hero` (photo fading into dark red), `.fl-panel--red` (red gradient + sunburst rays), `.fl-mission` (diagonal slabs), `.fl-ann--one` (single announcement banner), `.fl-sheet__card` (faint red tint at the top), `.fl-cal__bg` (grid lines). App code never writes a gradient.
4. **At most two red-filled surfaces per screen.** Red-filled means `.fl-panel--red`, `.fl-mission` and the `.fl-ann--one` banner. If a single announcement banner shows on Home while the check-in is due, hide the mission card. One `fl-btn--red` per section.
5. **Status is colour + shape + word**, never colour alone: `fl-badge--ok` (green circle), `--warn` (amber triangle), `--bad` (rose diamond). Brand red never means "bad".

## Colour tokens (dark / light)

`--surface` #0A0A0C / #F6F3EF · `--surface-raised` #131316 / #FFF · `--surface-sunken` #060607 / #ECE7E1 · `--surface-high` #1C1C21 / #FBF9F6 · `--line` #2A2A31 / #DDD6CD · `--line-strong` #70707B / #8A8179 · `--ink` #F7F4F0 / #121214 · `--ink-muted` #B8B5B0 / #4F4B47 · `--ink-subtle` #8F8C88 / #67625D · `--red` #E0261D / #C8211A · `--red-text` #FF5144 / #C8211A · `--red-deep` #8F1410 / #7A110D · `--ok` #35D07F / #0F7A4A · `--warn` #FFB020 / #8A5A00 · `--bad` #FF6B9A / #C2185B · `--info` #5BB5FF / #0B63B8. Paper notes: `--paper-1..3`, `--paper-ink`.

Use `var(--token)` everywhere. Raw hex lives only in `tokens.css` and `manifest.webmanifest`.

**Stage surfaces** (hero, mission card, single announcement banner, sign-in photo side) are always dark, even in light theme: add `fl-stage` to them.

## Type

Plus Jakarta Sans for everything; JetBrains Mono only for times, dates in lists, counts and percentages. Weights: 200 (the light phrase), 400 (body), 500 (UI), 700 (labels, buttons, headings), 800 (display and titles). Nothing else.

| Class | Size | Use |
|---|---|---|
| `fl-display` | 36 to 56 px, 800 | Hero greeting only. Pair with a `fl-light` phrase: "Good afternoon, **Josef.**" |
| `fl-title` | 30 to 40 px, 800 | Page title, one per page. |
| `fl-h2` | 22 px, 700 | Panel heading. |
| `fl-h3` | 17 px, 700 | Row, card and task titles. |
| body | 15 px, 400 | Paragraphs. |
| `fl-small` | 13 px, 500 | Secondary lines. |
| `fl-caption` / `fl-eyebrow` | 12 px | Metadata / uppercase labels above headings. |

## Layout

- **Laptop (900 px and up):** `.fl-app` grid = left `.fl-rail` (232 px: crest lockup, `.fl-nav`, photo card at the bottom) + `.fl-col` (sticky `.fl-top` bar, then `.fl-main`). Top bar: search on the left, bell and `.fl-user` avatar menu on the right.
- **Phone (below 900 px):** the rail disappears. `.fl-top` shows the crest, bell and avatar on one row and search on the next. Navigation is the floating `.fl-tabbar`: Home, Calendar, Projects, Ideas, More (5 icon tiles, active tile solid red, 24 px radius, floats 12 px off the edges). More opens a sheet with every destination the tiles do not cover, so nothing is laptop-only. Copy `reference/phone-tabbar.png`.
- `.fl-main` max 1320 px, 32 to 48 px padding, 32 px between sections. Two-column body is `.fl-split` (1.5 : 1), collapsing below 1100 px.
- Every tap target is at least 44 px.

## Length budget (the most important layout rule)

A screen earns scroll only with things people act on. Home must fit in about **1.5 laptop screens** and **5 phone screens**. No stat rows on Home. Each list shows at most 5 rows, then a link ("All my tasks"). Decorative parts (`fl-mission`, idea notes) get `fl-desk-only` and disappear on phones, where Ideas has its own tab.

**Home order:**
- **Phone:** hero (greeting + one line) → check-in panel (only while due) → announcements (only if any, swipe row) → Needs you (max 5) → Today's agenda (events only, max 5) → My projects (max 3).
- **Laptop:** hero → announcements (if any) → `.fl-split`: left Needs you, Today's agenda; right check-in panel (only while due), My projects, mission card → Top ideas (3 notes + "Open idea board").

## Components

| Component | Class | Notes |
|---|---|---|
| Buttons | `fl-btn` + `--red` / `--white` (on red) / `--ghost`, `--sm`, `--block` | Verb first: "Start check-in", "Pin idea". |
| Panel | `fl-panel`, `fl-panel__head` | Default container for every section. |
| Red panel | `fl-panel--red` | The one call to action of the screen (check-in, publish). Contains a `fl-btn--white`. |
| Hero | `fl-hero fl-stage` + `fl-hero__img` + `fl-hero__body` | Members' Home: `campus-sunset.webp`. Public site: `building.webp` with `fl-hero--tall`. Sign-in: `campus-sky.webp`. |
| Mission card | `fl-mission fl-stage` | Three `<i>` slabs, ghost `building.webp`, rotating message on the arrow button, dots show position. Messages: "Ad maiorem Dei gloriam.", "Small steps create big change.", "Lead. Serve. Build." |
| Row | `fl-row` (time / title / tag), `fl-row--task` (checkbox / title / badge / date) | `is-mine` = red left edge; `is-done` = struck through. |
| Tags | `fl-tag` + `--meeting` / `--committee` / `--public` | Event and item types. |
| Badge | `fl-badge--ok/warn/bad` | Status. |
| Person | `fl-chip` (initials, 32 px), `fl-chip--lg` (40 px), `--me` / `--lead` red | No photos. |
| Progress | `fl-bar > i[style=width]`, `fl-steps > span.is-done/.is-now` | Bars for percentages, steps for milestones (at most 5 steps, then a `span.fl-more` "+n"). Never rings or spinners. |
| Pipeline | `fl-board > fl-board__col > fl-card` | Columns Planning / In progress / Done. |
| Announcements | `fl-ann`, `fl-ann__grid`, `fl-ann-card`, `fl-ann--one` | 1 = wide banner, 2 to 3 = cards, 0 = render nothing. |
| Sheet | `fl-sheet > fl-sheet__card` | Full-screen detail (announcement, task on phone). Close button top right, Esc closes, focus returns. |
| Idea notes | `fl-ideas > fl-note`, `fl-vote[aria-pressed]` | The one deliberately different surface: paper, tape, slight tilt. |
| Calendar | `fl-cal__grid` (week, 06:00 to 18:00), `fl-cal__allday`, `fl-month`, `fl-ev` | Event colour: `fl-ev` meeting, `--deep` project, `--committee` committee, `--quiet` other. Events outside 06:00 to 18:00 go in the all-day row. |
| Date tile | `fl-date` | Upcoming lists. |
| Forms | `fl-form`, `fl-field`, `fl-input`, `fl-help`, `fl-error`, `fl-check`, `fl-switch`, `fl-seg` | Labels always visible. Errors say what happened and what to do. |
| Popovers | `fl-pop` (`--wide`, `--search`) | Bell list, avatar menu, search results. |
| Table | `fl-table` | Admin lists. Numbers in `fl-mono`, right aligned. |
| Feedback | `fl-toast`, `fl-empty`, `fl-live` | Empty states say what to do next. |
| Scroll wrapper | `fl-scroll` | Wide tables and the meeting swimlanes scroll sideways inside it, never the page. |

Kept app features with no component here (timeline bars, meeting swimlanes, org chart, deal stage bar, filter chips, breadcrumbs) are built in the app's `src/app.css` from the nearest component above: same tokens, radii and type, one fixed form each.

Icons: Lucide, 2 px stroke, inline SVG, class `fl-icon`. No emoji anywhere.

## Voice

Answer first. Sentence case. Verb-first buttons. No exclamation marks, no emoji, no "Oops". On screen, dates read "Thu 29 Oct" (add the year only when it is not this year); data, exports and URLs keep ISO `2026-10-29`. Times are 24-hour "15:30", money "15 000 000 IDR". People by first name in lists, full name in profiles.

## Accessibility

Text contrast 4.5:1, marks 3:1, in both themes (the tokens already pass; do not lighten them). Visible focus ring (`--focus`, 2 px). Motion uses the duration tokens and stops for `prefers-reduced-motion`. Popovers and sheets trap and return focus, close on Esc.

## Do not

Glassmorphism or blur, glow outside `--glow-red` on the red button hover, text shadows, gradients outside the list above, new colours, new font weights, rounded pills except switches and tab bar tiles, stat rows on Home, decorative charts, stock photos, photos of students, the builtbyjosef brand (retired for this app).
