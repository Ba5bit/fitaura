# 061 — Full-bleed 9:16 story export (square corners, no glow margin)

**Date:** 2026-06-20
**Status:** implemented + typecheck/tests green + **live browser-driven visual
verification done** · **commit/push held** (iterative session)

## What changed

Downloaded/shared cards now export **full-bleed**: a 9:16 card fills the entire
1080×1920 story frame edge-to-edge with **square corners**, instead of being
centered on the branded dark-glow poster with rounded corners and margins. The
**on-screen** cards are untouched — they keep their rounded corners; only the
export squares them.

Driven by a one-line request: *"download the 16:9 cards for stories without the
circled borders (full frame 16:9 of the screen)… on the website they should be
like that, but for the export no."* — i.e. rounded corners stay in the app, go
away in the export.

One file: `apps/web/src/lib/exportCard.ts` (`renderCardBlob`).

## How it works

1. **Aspect detection decides the layout.** The export canvas is 9:16
   (`1080×1920`, AR `0.5625`). We measure the captured element's own AR
   (`el.offsetWidth / el.offsetHeight`) and treat it as full-bleed when it's
   within `0.02` of the frame AR:
   - **face / outfit / clean / buffering / nameplate** roots and the **premium /
     ivory receipt** (`.rcp`) are all `360×640` → AR `0.5625` → **full-bleed**.
   - the **thermal / neon receipt** is a narrower `340×640` strip → AR `0.531`
     (diff `0.031` > `0.02`) → **stays centered** on the glow poster (it can't
     fill 9:16 without distortion).

   So the change is automatic and per-card — no new flag, no API change, and the
   receipt strip is safely excluded by geometry.

2. **Square the corners just for the capture.** Every card root carries the
   shared `.asset` class, which holds the `border-radius` (`.asset` 26px,
   `.rcp` 22px). For full-bleed we set `assetEl.style.borderRadius = '0'`
   inline (inline beats the class rule) before the snapdom capture and **restore
   it in a `finally`** — the live DOM is only touched for the duration of the
   snapshot, and the on-screen card is never affected.

3. **Draw to fill vs. center.** Full-bleed draws the snapdom canvas at
   `(0, 0, 1080, 1920)`. Because the card AR matches the frame AR *exactly*
   (`360×640 × scale 3 = 1080×1920`), this is a 1:1 blit — **no distortion, no
   margin, no shadow**. The non-matching strip keeps the old centered path
   (4% margin + soft canvas shadow), which is why both branches still exist.

## Why these choices

- **Auto-detect by AR, not a per-kind flag.** The cards that should fill the
  frame are exactly the ones whose AR already equals the frame's, so geometry is
  the honest discriminator. It also future-proofs: any new 9:16 skin gets
  full-bleed for free, and any odd-shaped asset is left centered.
- **Inline-radius override + restore** keeps the corner-squaring scoped to the
  offscreen capture without a CSS modifier class threaded through React state.

## Verification (live, not just types)

- `tsc --noEmit` clean; full web suite **184/184 green** (no export unit test —
  the path is canvas + snapdom + real DOM, so it's verified in-browser instead).
- Drove the real `renderCardBlob` in a headless Chromium against a live
  `360×640` card on `/dev/cards` (Vite dev server):
  - output PNG = **1080×1920** ✓
  - all four extreme corners opaque and **identical** `rgba(42,43,48,255)` — the
    card's own edge, *not* the poster's blue-tinted glow (which differs
    corner-to-corner) → card fills to squared corners ✓
  - rendered the export over a magenta backdrop and screenshotted it: **square
    corners on all four sides, card content to every edge, no rounded corners,
    no dark margins** ✓

## Also in this session (separate commit)

`13ef320` — Clean outfit card: moved the roast/quote line to sit directly under
the verdict, above the stat chips (`CleanOutfit.tsx` DOM reorder; existing CSS
spacing carried over).

## Follow-ups / notes

- The `.asset` 1px hairline border is left as-is on full-bleed (barely visible at
  the very edge; "circled borders" meant the rounded corners). Trivial to drop if
  a hairline frame ever reads wrong.
- Both this and `13ef320` are **on `main` locally, push held** per the iterative
  tweak-session convention.
