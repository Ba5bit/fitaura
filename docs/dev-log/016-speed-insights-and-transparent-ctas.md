# 016 — Vercel Speed Insights + transparent primary CTAs

Two small, unrelated polish changes batched into one log (catch-up entry).

## A. Vercel Speed Insights

### Problem

The app already reports analytics via `@vercel/analytics` (added in commit
`9d6ed14`), but had no Core Web Vitals / performance telemetry.

### Change

Mirrored the Analytics wiring. Added `@vercel/speed-insights` and rendered
`<SpeedInsights />` next to `<Analytics />` inside the `ErrorBoundary` in
`main.tsx`. It is a no-op locally and only collects once deployed on Vercel.

### Files

- `apps/web/package.json` — `@vercel/speed-insights` dependency.
- `apps/web/src/main.tsx` — import + `<SpeedInsights />`.

## B. Transparent outlined style for primary CTAs

### Problem

The primary call-to-action buttons were solid color-filled blocks while the rest
of the UI (zoom controls, segmented controls, `.cbtn` Reset/Replace/Remove) use
a transparent, outlined treatment. The user wanted the CTAs to match.

### Change

Converted four solid CTAs to transparent backgrounds, keeping each button's
accent identity in the text + border, with a faint accent tint on hover:

- `.cta.go` (blue / `--accent`) — "Looks good" and "Scan my aura"
  (`upload.css`).
- `.reveal .go` (gold / `--gold`) — "Reveal my verdict" (`scanner.css`).
- `.confirmed .go` (cyan / `--cyan`) — scanner-mode confirm CTA (`scanner.css`),
  converted for consistency since it lives on the same scan page.

Border uses `color-mix(in oklab, <accent> 55%, var(--hair))`; hover bumps to the
full accent and adds a 10% tint fill. Dropped the heavy glow `box-shadow`s, which
read wrong on a transparent fill.

A first attempt mistakenly targeted `.cbtn` (Reset/Replace/Remove) — that was
reverted back to its original `var(--panel)` fill once the intended buttons were
identified.

### Files

- `apps/web/src/design/upload.css` — `.cta.go` + hover.
- `apps/web/src/design/scanner.css` — `.reveal .go` and `.confirmed .go` + hovers.

## Verification

- A: `tsc --noEmit` on `@fitaura/web` passed after `npm install`.
- B: CSS-only; visual change. Border/hover use existing design tokens
  (`--accent`, `--gold`, `--cyan`, `--hair`).

## Commits

- `4a5d4a7` feat(web): add Vercel Speed Insights
- `e2063e1` style(web): transparent outlined style for primary CTAs
