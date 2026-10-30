#!/usr/bin/env bash
# Fiat Lux lint for the council app. Run from the repo root: bash design/fiatlux/design-check.sh
# Flags what DESIGN.md forbids in app code. The design system folder itself is excluded.
set -u
paths=("${@:-src app index.html public}")
excl=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=fiatlux --exclude-dir=dist --exclude=manifest.webmanifest)
inc=(--include=*.css --include=*.html --include=*.jsx --include=*.js)
fail=0
check() { local out; out=$(LC_ALL=C grep -rnEI "${inc[@]}" "${excl[@]}" -e "$2" ${paths[@]} 2>/dev/null | head -n 8); if [ -n "$out" ]; then echo "x $1"; echo "$out"; fail=1; fi; }
check "gradient in app code (use fl-hero, fl-panel--red, fl-mission or fl-ann--one)" 'linear-gradient|radial-gradient|conic-gradient'
check "blur, glass or text-shadow"                                   'backdrop-filter|filter:[^;]*blur|text-shadow'
check "font weight outside 200 400 500 700 800"                      'font-weight:[[:space:]]*(100|300|600|900)\b|font:[[:space:]]*(100|300|600|900)[[:space:]]'
check "raw hex colour (use var(--token))"                            '(color|background|border|fill|stroke|outline)[a-z-]*:[^;{]*#[0-9a-fA-F]{3,8}\b'
check "emoji in UI"                                                  $'[\xF0\x9F][\x80-\xBF][\x80-\xBF][\x80-\xBF]'
check "exclamation mark in UI text"                                  '>[^<{]*[A-Za-z]!( |<|$)'
check "builtbyjosef leftovers"                                       'builtbyjosef|jy-[a-z]|design/builtbyjosef'
if [ "$fail" -eq 0 ]; then echo "ok fiatlux check clean"; else echo "! fix the lines above"; fi
exit "$fail"
