# 052 — Mobile scan: true full-bleed + centered verdict + de-cluttered HUD (for Reels/TikTok)

## Problem

Optimizing the scan animation for recording vertical video (TikTok/Reels). Three
issues on phones:

1. **Boxed, not full-bleed.** Despite the scanner already having a `data-mobile`
   full-bleed block, the scan still rendered as a rounded card inset from the
   screen edges (margin + `border-radius` visible around it).
2. **Verdict text stranded at the bottom.** "PRINTING YOUR VERDICT … 86%" sat in
   a slim bottom strip — small, and exactly where TikTok/Reels overlay their
   caption + right-side button rail, so it gets covered while recording.
3. **Overlapping HUD.** The header "SCANNING" live-chip collided with the
   floating "STAMPING" / "RECEIPT · PRINTING" callout stickers at the top-right;
   stickers also crowded the face medallion.

## Cause (issue 1)

The scanner's full-bleed CSS (`scanner.css`, `.sa[data-mobile="true"]`) was real,
but the **page wrapper overrode it** (`components.css`):

```css
@media (max-width: 720px) {
  .scan-page { padding: 12px; }
  .scan-page .sa { border-radius: 20px; min-height: calc(100vh - 24px); }
}
```

That `padding:12px` + the base `.scan-page .sa { border:1px solid var(--hair);
border-radius:24px }` is the inset rounded card. Worse, a **breakpoint mismatch**:
the scanner goes full-bleed at `≤760px` (`data-mobile` = `useMediaQuery('(max-width:760px)')`),
but the wrapper boxed it at `≤720px` — so 721–760px was a dead zone (boxed page,
full-bleed innards).

## Fix

**1 — true full-bleed (`components.css`).** Re-point the wrapper override to the
scanner's own 760px breakpoint and zero out the inset/border:

```css
@media (max-width: 760px) {
  .scan-page { padding: 0; min-height: 100dvh; }
  .scan-page .sa { border: 0; border-radius: 0; max-width: none; min-height: 100dvh; }
}
```

**2 — verdict readout → vertical-center hero (`scanner.css`).** The readout was a
`bottom:0` strip; make it a centered overlay over the photo, enlarged, with a soft
radial scrim for legibility (no hard panel). `pointer-events:none` so the header's
leave (✕) stays tappable through the full-screen overlay:

```css
.sa[data-mobile="true"] .readout{ position:absolute; inset:0; z-index:10; pointer-events:none;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  text-align:center; gap:14px; padding:0 28px;
  background:radial-gradient(120% 58% at 50% 50%, rgba(8,10,14,.78), rgba(8,10,14,.34) 46%, transparent 72%); }
.sa[data-mobile="true"] .ro-title{ font-size:clamp(36px, 9vw, 46px); }
.sa[data-mobile="true"] .ro-pct .n{ font-size:48px; }
.sa[data-mobile="true"] .ro-bar{ width:min(72vw, 300px); margin:0 auto; }
/* + ro-stage / ro-tick / ro-prog / ro-pct centered */
```

**3 — de-clutter (`scanner.css`).** Drop the floating callout stickers and the
redundant header chip on mobile; keep the scanning *template* (frame, sweeping
scanline, corner reticles, face medallion, one in-frame caption) — each now lives
in its own zone (brand top-left, medallion upper-left, verdict center, caption
bottom), so nothing collides:

```css
.sa[data-mobile="true"] .hud{ display:none; }        /* floating callout stickers */
.sa[data-mobile="true"] .live-chip{ display:none; }  /* header 'Scanning' chip */
```

All changes are scoped to `data-mobile` / `≤760px`; desktop is untouched. No JS
changes — the `.hud` / `.live-chip` nodes stay in the DOM (React logic intact),
just hidden via CSS.

## Decisions

- **Vertical center** (vs. lower-center band) chosen for the readout — boldest
  read for video; the radial scrim offsets the cost of covering more of the face.
- **Simplify** (vs. reposition) chosen for the HUD — fewer moving stickers reads
  cleaner on camera than spacing them all into lanes.

## Verification

`npm run build` passes (Vite, CSS compiled clean). Visual confirmation is the
on-device recording loop. Reduced-motion + desktop paths untouched (rules are
`data-mobile`-scoped).

## Files

- `apps/web/src/design/components.css` — full-bleed wrapper override (760px)
- `apps/web/src/design/scanner.css` — centered readout, enlarged text, HUD/chip hidden
