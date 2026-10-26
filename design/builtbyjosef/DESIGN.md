# builtbyjosef design standard (v1.1)

The default for everything Josef Yang makes (UI, sites, apps, dashboards, documents, slides, charts, study sheets, READMEs, code, artifacts, cloud environments), unless another brand is named. It is self-contained. Import `index.css` and you have the tokens, the components and the ignition layer. Logos are in `logos/`. Run `scripts/jy-check.sh` before you finish.

## The aura in one line

Cool head, hot point.

The mark is a match: an ink body with one orange head. The whole system lives at the instant after the strike, when everything is calm and exact and one small point is already alive. Ink, paper, space, hairlines and blue status colours are the composure. Orange is the fire. That split is the identity, and every decision below protects it.

The non-obvious part: orange only feels hot because the ground around it is cool. In this palette orange reads 6.2:1 against ink and only 2.8:1 against paper, so the same orange is more than twice as visible on near-black. Fire is contrast multiplied by speed, never area. Spending more orange makes the page look warmer and weaker. Spending it exactly, and moving it fast, makes it look like fire. Treat orange like a flame: small, precise, alive, and surrounded by dark.

## Heat doctrine

There are three heat levels. Use the lowest one that does the job.

| Level | What it is | Allowed |
| --- | --- | --- |
| Spark | the cap, a 6px bar, a 28 x 6 cap fragment, an 8px dot, the accent button | always; counts toward the one point per view |
| Ember | `accent-text`, a 1px orange rule, `data-1`, the `seq` heat ramp, the burn bar under one key word | where it carries meaning |
| Flare | a full-bleed orange field with ink type | at most one per page, deck or document |

Strike, catch, burn, settle is the motion vocabulary that follows from the match. Strike is the press and hover (hard shadow, 80 to 140 ms). Catch is the cap sweeping orange across a panel or landing on a button (240 ms). Burn is the orange bar drawn under one key word in a headline (640 ms, once). Settle is the long ease-out tail on everything, so energy always resolves into composure.

## Four rules

**Ma.** Leave deliberate space. Empty space is a material. A hero gets 96px or more around it.

**Itten.** At rest, one orange point per view, at most about 10% of the area. The Flare is the single exception: it is the page's one orange point, and nothing else orange competes with it in the same viewport (no accent button on a flare, ink buttons only).

**Kata.** One fixed form per recurring element. A button is always a small Tab. A stat is always cap, label, light numeral, bold unit. Do not invent a second form.

**Dynamic.** Motion tells state. Snap, then settle. Nothing loops except one live indicator.

If a detail does not improve the result, cut it.

## Voice

Answer first. Short sentences. Sentence case. Verb-first buttons (Run simulation, Export PDF, Start timer). No emoji, no exclamation marks, no flame clip-art; energy comes from verbs, numbers and speed, not punctuation. Headlines are a claim or a command in two to six words, set as a light phrase plus a bold phrase (see Type). Errors say what happened and what to do, in one line. Name: `builtbyjosef`, one word, lowercase (`builtby` weight 300, `josef` weight 700). Person: Josef Yang. Monogram: JY (never JDY). Tagline: "Built to a standard. Built to move." Numbers carry units with a space and use SI (`12.4 GWh`), thin-space thousands, decimal point. Dates are `2026-10-26`.

## Colour

Always use `var(--token)`, never raw hex outside the token files.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| surface | #F3F2EE | #0D0E10 | page ground |
| surface-raised | #FBFAF7 | #16181B | panels, inputs |
| surface-sunken | #E8E6E0 | #08090A | code, wells, table heads |
| ink | #0D0E10 | #F3F2EE | text |
| ink-muted | #4A4D53 | #A9ADB3 | secondary text |
| ink-subtle | #5E6167 | #8D9198 | captions, placeholders |
| line / line-strong | #D3D0C7 / #767A80 | #2A2D32 / #7B8088 | hairlines / control borders |
| accent | #FF5B1F | #FF5B1F | fill for THE one action; the cap; the flare |
| on-accent | #0D0E10 | #0D0E10 | text on orange (never paper: 2.8:1) |
| accent-text | #B93A09 | #FF5B1F | orange as text or thin marks |
| focus | #0D0E10 | #FF5B1F | 2px ring, 2px gap |
| status-ok / warn / bad | #0B5FB5 / #8F5B00 / #C41E3A | #6DB3FF / #F0B429 / #FF6B7F | blue, amber, red; always shape + word |
| data-1..6 | #D9480F #0B63C5 #00796B #A8326F #9A6700 #4A4D53 | #FF5B1F #56B4E9 #2FD3A3 #E58FBD #F0C419 #A9ADB3 | chart series, in order |
| seq-1..5 | #FFE3D6 to #8F2A04 | #3A1E12 to #FFC4A8 | heat ramp; higher always reads stronger |

Inverse (primary button fill) is ink in light mode and paper in dark mode. Contrast: text 4.5:1, marks and control borders 3:1, both themes.

### Colour decisions

Stage surfaces are dark. Heroes, covers, title slides, end cards, dashboards-as-showpieces and social images default to the dark theme, because orange is twice as visible there and the hard shadow turns orange, which is the one place the system "glows" without a glow. Wrap a section in `data-theme="dark"` plus `class="jy-stage"` to force it regardless of the OS. Working surfaces (apps, long documents, study sheets, print) follow the OS or default to light.

The Flare is a field of `accent` with `on-accent` ink text, the `tab-on-orange` logo, and ink buttons (the paper-capped variant that `ignite.css` provides). Inside a flare use ink only: no `ink-muted`, no `ink-subtle`, no blue, no data colours. One flare per page; on very long pages one per three screens at most. Never put a flare inside an app's working UI. Use it for the thesis, the cover, the section break that matters, the end card.

Orange as text on a light ground is always `accent-text` (#B93A09). Do not set body copy orange. To make a key word hot, keep the word ink and draw the burn bar under it. The burn bar and the cap are decorative marks, so the 3:1 mark rule does not apply to them; never let them carry meaning alone.

Status is shape plus word plus colour: circle ok (blue), triangle warn (amber), diamond bad (red). Blue is success on purpose; it keeps the red-green axis free for accessibility and keeps the palette from turning into a traffic light.

## Type

Space Grotesk for text and UI, JetBrains Mono for code and number columns. Weights 300, 400, 500, 700 only (never 600).

| Style | Size / line | Weight | Tracking |
| --- | --- | --- | --- |
| display-hero | clamp(64px, 11vw, 160px) / 0.9 | 300 + 700 | -0.045em |
| display-xl | 96 / 88 | 700 | -0.04em |
| display-l | 64 / 64 | 700 | -0.035em |
| display-m | 44 / 48 | 700 | -0.03em |
| h1 / h2 / h3 | 32/40, 24/32, 18/26 | 700 | -0.025 / -0.02 / -0.01em |
| body-l / body / body-s | 18/28, 15/24, 13/20 | 400 | 0 |
| label | 12 / 16, uppercase | 500 | 0.08em |
| numeral-xl | 72 / 72 | 300 | -0.04em |
| numeral | 24 / 32 mono | 500 | -0.01em |

Minimum on screen is 12px. Prose measure is 68ch. Numbers in columns use tabular figures.

### Type decisions

The weight contrast is the emotional signature. Weight 300 is composure; weight 700 is heat. Every headline sets one phrase light and the key phrase bold, and the bold phrase carries the burn bar. Examples: "Cool head. **Hot point.**", "Built to a standard. **Built to move.**", "Measure twice. **Move once.**" Big numerals are always weight 300 with a bold unit, so a huge number still feels calm.

Go big on purpose. On heroes, covers and title slides use `display-hero` and let it fill the width, left-aligned, with generous empty space beside it. Scale contrast (a 160px headline next to 15px body) is what reads as confidence. Do not fill the gap.

## Space, shape, depth

8px grid with a 4px half step (4 8 12 16 24 32 48 64 96 128). Panel padding 24. Default radius 10 (max two radii per view; pill only for toggles). Flat: 1px hairlines. One hard shadow, `4px 4px 0 0 ink` (orange in dark), with a 2px lift on hover. Soft shadow only for floating menus. No gradients, glass, blur, glow, text-shadow, emoji icons or coloured left-border cards. Icons: Lucide, 2px stroke (stand-in; no house set yet).

Layout is left-aligned and asymmetric, maximum width 1200px (display type may run to the page edge). Prefer the Stair: Tab-shaped 9:16 cards stepping down the grid (+24, +48, +64px) so the row has a pulse without any rotation or decoration. Centre-aligned everything is the enemy.

The fuse: a section divider is a 1px hairline with a 28 x 6 orange cap fragment sitting at its left end. It reads as a spark on a fuse and costs almost no orange.

## Components

`bundle.css` (prefix `jy-`): `jy-btn` (primary = ink body + orange cap; `--accent` once per view; `--ghost`), `jy-panel` (cap sweeps orange on hover; `--active`), `jy-field`, `jy-badge` (circle ok, triangle warn, diamond bad), `jy-stat`, `jy-code` (the bar says where to run it), `jy-table`, `jy-chart`. Touch targets 44px.

`ignite.css` adds: `jy-hero`, `jy-burn`, `jy-flare`, `jy-stage`, `jy-panel--tab`, `jy-stair`, `jy-rule`, `jy-heat`, `jy-ignite` (cap lands on a button), `jy-pulse` (one-shot ring), `jy-live` (the one looping indicator), and `[data-jy-reveal]` / `[data-jy-count]` behaviour from `jy.js`.

## Motion

Durations: 80 instant, 140 fast, 240 base, 400 slow, 640 sweep (the ceiling). Curves: ease-out `cubic-bezier(0.16,1,0.3,1)` is the default; ease-in `cubic-bezier(0.7,0,0.84,0)` for exits at 60% of the entrance; ease-inout `cubic-bezier(0.65,0,0.35,1)` for moves between two places; ease-snap `cubic-bezier(0.34,1.56,0.64,1)` only for toggles and the cap landing.

### Ignition sequence (page load, once)

At 0 ms the page is ink or paper and still. At 0 to 240 ms the primary button's cap drops in with ease-snap (`jy-ignite`). From 0 ms the hero lines rise 12px and fade in, 400 ms each, staggered 60 ms, at most five items (`data-jy-reveal` with `--i` 0 to 4). At 160 ms the burn bar sweeps under the key word over 640 ms. Counters roll to their value over 640 ms as they enter view. Total ceiling: about one second, then the page is perfectly still. That stillness is the composure.

### Micro-interactions

Hover on a panel or button: lift 2px, hard shadow (orange in dark), 140 to 240 ms. Press: back to 0, shadow gone, 80 ms, like a stamp. Panel cap: sweeps left to right on hover. Toggle: ease-snap. State change that succeeds: `jy-pulse` ring, once. Live data only: `jy-live` dot, 1.6 s cycle, with the word "Live" next to it, at most one per view, and it does not count as the orange point.

### Rules

Everything animates once and stops. No decorative loops, parallax, particles, confetti or bounce beyond the snap. Reveal on scroll fires once and never reverses. All motion honours `prefers-reduced-motion` (durations go to 0 ms; content is visible without JavaScript).

## Logo

Files in `logos/`. Light ground: `tab-primary-light`. Dark ground: `tab-primary-dark`. One colour (print, stamps, favicons): `tab-mono-ink` / `tab-mono-paper`. Orange ground (the Flare): `tab-on-orange`. Low-ink print and study sheets: `tab-outline`. 24 to 48px tall: `tab-small`. Signatures and README banners: `tab-lockup-light` / `tab-lockup-dark`. App icons: `tab-icon-dark` / `tab-icon-light` (512, radius 112; re-export per platform). Clear space 28 units (2 x cap); minimum 24px tall (lockup 40px). Every app, site, document, slide deck and program carries the signature.

## Surface recipes

**Landing page or site.** Dark stage hero: eyebrow label, `display-hero` light-plus-bold headline with the burn bar, one lead paragraph at 68ch, one accent button plus one ghost button. Then a `jy-rule`. Then a Stair of Tab cards, a stat row with counters, and, if the page earns it, one Flare band carrying the thesis in `display-l`. Footer is an inverse band with the lockup. Do not use a flare and an accent button in the same viewport.

**App and dashboard.** Calm. No flare. Heat appears only as state: the active cap, progress, the single accent button, the highlighted series in `data-1`, the live dot, counters rolling when data refreshes. Left-aligned, dense but spaced on the 8px grid.

**Slides.** 16:9. Title slide dark with the lockup and a `display-l` light-plus-bold title. Content slides: one claim as the headline, one visual, one `numeral-xl` where a number is the point. The thesis or closing slide is the deck's one Flare. `tab-small` bottom-left at 40px tall, slide number in mono bottom-right. One orange point per slide. Transitions are the rise only.

**Documents and PDFs.** Light. Cover: lockup, `display-l` pair, the date in mono. Each page's one orange point is a 28 x 6 cap above the h1. Tables use `jy-table`. Footer: `tab-small`, document name, date, in mono. A cover may be a Flare.

**Study sheets and print.** Low ink: coloured outlines only, no filled backgrounds, single column, generous spacing, body at least 11pt, `tab-outline` logo. Orange appears only as an outline or a rule.

**Charts.** Direct line labels, `quantity (unit)` axis titles, SI units, `data-1` for the series the chart is about (3px), dashes beyond three series, gridlines 1px `data-grid`, n and source in the caption. Heatmaps and maps use `seq-1..5`, with the `jy-heat` legend. Matplotlib: `builtbyjosef.mplstyle`.

**README and social.** README banner is the lockup and the tagline. Social and OG images are 1200 x 630, dark or Flare, lockup bottom-left, a `display-l` pair, one orange point.

**CLI.** `->` step, `ok` success, `!` warning, `x` failure. No emoji. Honour NO_COLOR.

**Video and motion.** End card is `tab-lockup-dark` on ink. Motion follows strike, catch, burn, settle at the durations above.

## Code and working rules

Lean, efficient code: no gold-plating, no feature or token spend that does not substantially improve the result. Units in names (`speed_ms`), SI internally. snake_case Python, kebab-case files and classes, PascalCase components. Equations in LaTeX, symbols defined once, working shown line by line. Whenever you instruct an install or a command, state exactly where to run it (Ubuntu/WSL terminal, VS Code terminal, Windows PowerShell, or browser). Build only when told to build; "build the plan" means plan only.

## Cheap fire (never)

Flame emoji or clip-art. Orange-to-red gradients. Glow, bloom, neon, text-shadow. More than one accent button. Orange paragraph text. Red used as a brand colour. Confetti, particles, lottie sparks. Spinners as decoration. Parallax. Bounce beyond the toggle snap. Orange overlays on stock photos. Centred, symmetrical layouts with everything the same size.

## Pre-ship check

Squint at the page: is the orange under 10% of the area, or is it one flare with nothing orange competing? Run `bash scripts/jy-check.sh` and fix every `x`. Weights are only 300, 400, 500, 700. Orange text on light is `accent-text`. Status has shape and word. All motion uses the five durations, runs once, and respects reduced motion. Touch targets are 44px and the focus ring is visible. Both themes were looked at. The signature is present. Copy is sentence case with no emoji or exclamation marks.

## Decision log

These choices were made on purpose; do not reverse them without a reason that beats the one given.

1. Dark for stage surfaces, light for working surfaces. Orange is 6.2:1 on ink and 2.8:1 on paper, so fire reads hotter on dark.
2. One Flare per page as the only break from the 10% rule. A flare is the single orange point, so the itten rule survives.
3. The 300/700 weight contrast is the identity: calm and heat in one headline.
4. Hero type goes up to 160px. Scale contrast carries confidence; decoration does not.
5. Orange text stays out of body copy. The burn bar under an ink word makes it hot and keeps contrast legal.
6. The hard stamp shadow stays the only "glow". It turns orange in dark mode.
7. Motion runs once and stops, with one live-dot exception. Perpetual motion reads as nervous, not passionate.
8. The Stair and the fuse give rhythm without rotation, gradients or decoration.
9. The always-loaded CLAUDE.md block carries the top rules inline; this file carries the detail. Sessions obey what is in front of them.
10. Public repository, so any session in any sandbox can clone it without credentials.
