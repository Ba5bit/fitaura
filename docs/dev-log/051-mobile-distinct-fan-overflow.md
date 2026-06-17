# 051 — Mobile: "Distinct cards" fan overflowed and shoved the card off-centre

## Bug

On phones, the landing's **"Distinct cards / One verdict"** section (the tappable
`CardFan`) was broken: the front Face Card sat off-centre to the right with its
right edge clipped, and only the left (receipt) card peeked. Scrolled into view,
the card's top (header + selfie) read as "cut off". Same root cause as the hero
fan in [033](033-mobile-hero-fan-overflow.md), but a different mechanism.

## Cause

`.cardfan` has a **fixed `width:500px`** (`max-width:100%`). On mobile the
section collapses to one column (`.ln-distinct { grid-template-columns:1fr }`),
and the fan lives in that `1fr` track inside `.ln-distinct-fan`.

A grid `1fr` track's automatic minimum is `auto` = its content's **min-content**.
The fixed-width 500px fan makes the track's min-content 500px, so on a 390px
phone the track (and the whole row) blew out to **500px** — wider than the
viewport. `max-width:100%` couldn't help: the parent itself had already grown to
500px, so `100%` *was* 500px.

`.ln-distinct-fan { justify-content:center }` then centred the 500px fan in that
500px box, so the front card (centred in the fan) landed at viewport-x ≈ 270 on a
390px screen — right of centre, right edge clipped, left card peeking.
`body { overflow-x:hidden }` hid the spill but left the card off-centre.

Measured (390px viewport, before): cell `500px`, front card center-x `270`,
`right:407` (clipped past 390). `frontFullyVisible: false`.

## Fix (`landing.css`, `@media (max-width:760px)`)

```css
.ln-distinct-fan { display:block; min-width:0; }  /* let the 1fr track shrink */
.cardfan        { width:100%; }                    /* fan fills the shrunk cell */
```

- `min-width:0` (plus dropping the now-pointless flex centring to `display:block`)
  lets the grid track shrink below the fan's fixed width.
- `.cardfan { width:100% }` makes the fan fill the column instead of forcing 500px,
  so the front card centres in the viewport. The side cards still peek and are
  clipped by `body{overflow-x:hidden}` — that's the intended fan effect.

`min-width:0` **alone** proved flaky (the fixed-width flex child didn't reliably
shrink); `display:block` + `width:100%` resolves the percentage deterministically.
Scoped to `≤760px`, so the desktop two-column layout (fan stays `500px`,
`flex`-centred) is untouched.

## Verification

Dev server + Playwright. After, at 390px: cell `335px`, front card center-x `200`
(≈ viewport centre 195), `left:63 right:337` fully inside the viewport,
`frontFullyVisible: true`, no horizontal scroll. Confirmed at 360px too, and that
desktop (1280px) is unchanged (cell still `flex`, fan still `500px`).

## Files

- `apps/web/src/design/landing.css`
