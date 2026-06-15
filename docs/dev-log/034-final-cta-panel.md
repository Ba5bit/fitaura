# 034 — Landing: final CTA gets the elevated-panel background

## Ask

The "UPLOAD. SCAN. GET POSTED." final CTA looked flat (a plain band). Make its
background match the "1 SCAN = 3 CARDS" credit box — an elevated card panel.

## Change

- `Landing.tsx` `FinalCTA`: the section is now `ln-section ln-wrap` with the
  content wrapped in an inner `<div className="ln-final">`. The outer `.ln-wrap`
  insets the panel from the screen edges (like the credit box sits inside the
  bundle grid).
- `landing.css` `.ln-final`: now the panel — `border-radius: 22px`,
  `border: 1px solid var(--hair)`,
  `background: linear-gradient(170deg, var(--bg-2), #0a0c11 80%)`,
  `box-shadow: var(--shadow-card)`, `overflow: hidden`, with internal padding
  (was `padding … 0`, vertical-only). Same recipe as `.ln-credit-box`. The
  existing centered accent radial (`::before`) is kept (nudged 12% → 14%).

## Verification

Dev server + Playwright at 393×852: the CTA renders as a rounded, shadowed
panel inset from the edges, consistent with the credit box and privacy card.
tsc clean.

## Files

- `apps/web/src/features/landing/Landing.tsx`
- `apps/web/src/design/landing.css`
