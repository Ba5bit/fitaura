# 077 — FvF: opaque outfit score badge (kills export glow halo)

**Date:** 2026-06-25
**Area:** `apps/web/src/design/versus.css` (`.vs-fitframe .fit-tr .score`)

The outfit card's SCORE badge used frosted glass — `backdrop-filter: blur(5px)` over a
semi-transparent `color-mix(... rgba(6,7,10,.55))` background. snapdom rasterizes that blur as
a soft colored **glow halo** around the badge in the downloaded card (visible as a red/blue
rectangle bleed around the score boxes).

Fix: make the badge **opaque** — `background: color-mix(in oklab, var(--c) 20%, #0b0d12)` with
a thin `var(--c)` border, and drop `backdrop-filter`. Reads the same on-screen (a solid tinted
chip) and captures cleanly with no halo.

## Verification
Live Playwright: downloaded card shows crisp solid score chips, no glow; on-screen badge
identical. Frontend-only CSS change.
