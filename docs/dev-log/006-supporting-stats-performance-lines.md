# 006 — Supporting stats: segmented bar → thin performance line

**Date:** 2026-06-11
**Scope:** Outfit Check supporting stats (`SupportingStat`).
**Ask:** add lines on the supporting statistics. (Clarified: thin performance line
indicator with a value marker, not divider lines or a baseline-under-segments.)

---

## What changed

The supporting stats (Shoulder/Waist Definition, Leg Length Effect, Body Balance)
swapped their 10-segment bar for a **thin neon performance line** with a glowing
**value marker dot** at the score position.

- `apps/web/src/components/analysis/SupportingStat.tsx` — replaced the segments with
  a `.line` track containing a `.fill` (0→value%) and a `.dot` at `left: value%`.
  Both are **JS-driven** by the existing count-up (`n`), so the fill, the dot, and
  the number animate together. No CSS transition (would lag/fight the per-tick
  updates).
- `apps/web/src/design/components.css` — removed `.seg` rules; added
  `.rs-substat .line` (2px track), `.line .fill` (neon gradient + glow), and
  `.line .dot` (7px white dot, cyan glow + ring, `translate(-50%,-50%)`).

## Notes

- Still visually secondary: 2px line is lighter than the main metrics' 6px bars; the
  dot adds a precise read without adding height. No solid purple; cyan `--accent`.
- Dot uses `translateX(-50%)`; near 100% it centers on the track end (half spills into
  the card padding, which is fine). Current data peaks at 91 so it never clips.
- Mobile unchanged — single column, no overflow.

## Verification

- `npm run typecheck` + `npm run build` clean.
- Playwright (Outfit tab): 4 substats, 4 `.line`, 4 `.dot`. Screenshot confirms the
  marker tracks the value (82 far-right, 54 mid-line, etc.).
