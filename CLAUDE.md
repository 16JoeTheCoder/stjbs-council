<!-- builtbyjosef:start -->
## Design standard: builtbyjosef (cool head, hot point)

For ANY UI, site, app, dashboard, document, slide, chart, study sheet, README, artifact or visual, follow `design/builtbyjosef/DESIGN.md` unless another brand is named. If that folder is missing, run `git clone --quiet --depth 1 --branch v1 https://github.com/16JoeTheCoder/builtbyjosef-designsystem /tmp/jy`, read `/tmp/jy/DESIGN.md`, and copy `tokens.css bundle.css ignite.css index.css jy.js fonts logos` from it into the project's `design/builtbyjosef/` before building. Import `design/builtbyjosef/index.css`. Run `bash scripts/jy-check.sh` (or `bash /tmp/jy/scripts/jy-check.sh` if the project has no copy) before finishing.

- Identity: the Tab (72 x 128, 9:16, radius 10, one orange cap) is a match: ink body, orange head. Calm everywhere, hot at one exact point.
- Fonts: Space Grotesk (UI, text), JetBrains Mono (code, number columns). Weights 300, 400, 500, 700 only. Headlines pair a 300 phrase with a 700 phrase; the bold key word gets the orange burn bar (`jy-burn`).
- Colour via `var(--token)` only. Light: surface #F3F2EE, ink #0D0E10. Dark swaps them. Accent #FF5B1F. Ink text on orange, never paper. Orange text on light is `accent-text` #B93A09.
- Orange budget: one point per view, about 10% of the area at most. The only exception is one full-bleed Flare (`jy-flare`) per page, with ink buttons and no accent button beside it.
- Stage surfaces (hero, cover, title slide, end card, social image) are dark (`data-theme="dark"` + `jy-stage`). Working surfaces follow the OS.
- 8px grid, radius 10, flat, hairlines, hard stamp shadow only on hover (orange in dark). No gradients, glass, blur, glow, text-shadow, emoji icons.
- Layout: left-aligned, asymmetric, big type (`display-hero` up to 160px), generous space, Stair of 9:16 Tab cards.
- Motion: strike, catch, burn, settle. 80 / 140 / 240 / 400 / 640 ms, ease-out, once and stop, honour reduced motion. Page load ignition about one second, then still.
- Status = shape + word + colour (blue ok, amber warn, red bad). Contrast 4.5:1 text, 3:1 marks.
- Every app, site, doc, deck and program carries the signature (`tab-small.svg` or a lockup).
- Voice: answer first, sentence case, verb-first buttons, no emoji, no exclamation marks. Name `builtbyjosef`, person Josef Yang, monogram JY.
- Code: lean, no gold-plating, SI units in names. Say exactly where to run each command (Ubuntu/WSL terminal, VS Code terminal, Windows PowerShell, browser). Build only when told to build.
<!-- builtbyjosef:end -->
