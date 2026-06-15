# 033 — Mobile: hero card-fan overflowed into the next section

## Bug

On phones, the landing hero's floating card "fan" overlapped the following
"DISTINCT CARDS. ONE VERDICT." section — the Face Card spilled downward over the
heading.

## Cause

`.ln-fan-card` is `360×640`, centered in `.ln-fan` via `inset:0; margin:auto`,
then scaled. The mobile (`max-width:760px`) rules scaled the mid card to `0.86`
(≈ `640×0.86 = 550px` tall) but kept the container at `height:400px`. A
center-anchored 550px card in a 400px box (with no clipping) overflows ~75px top
**and** bottom, so the bottom bled into the next section. Side cards
(`scale .78`, `translateX ±120`) also pushed too far.

## Fix (`landing.css`, `@media (max-width:760px)`)

- `.ln-fan` height `400 → 500px` (+ `margin-top: 8px`) so it contains the scaled
  mid card.
- Mid card `scale .86 → .76` (≈ 486px, fits in 500).
- Side cards `scale .78 → .62`, `translateX ±120 → ±100` (less edge bleed).

`body { overflow-x: hidden }` (fitaura.css) already prevents the side-card peek
from causing horizontal scroll, so only the vertical containment needed fixing.

## Verification

Ran the dev server and screenshotted at 393×852 (Playwright): Face Card sits
fully inside the hero; the "DISTINCT CARDS" heading clears it with proper spacing.

## Files

- `apps/web/src/design/landing.css`
