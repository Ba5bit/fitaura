# 007 — Integrate Card Studio into the Verdict page

**Date:** 2026-06-11
**Scope:** Result (Verdict) page + new sticker/export modules.
**Ask:** the separate "Card Studio" feels like its own product. Fold its useful
parts — edit/reposition stickers, customize, download — into the Verdict page. No
standalone Studio route/page/modal.

---

## Source files reviewed (from ~/Downloads)

`studio.jsx`, `sticker-editor.jsx`, `export-share.jsx`, `studio.css`,
`Fitaura Card Studio.html`. The two genuinely useful capabilities (vs. the
standalone page chrome) were:

1. **In-place sticker repositioning** — draggable / keyboard-nudgeable sticker with
   a safe-zone + critical-text exclusion solver and snap guides; preset-only stamp
   for the receipt.
2. **Real WYSIWYG export** — rasterize the actual card to a branded 9:16 PNG and
   download / native-share it.

Not ported: the standalone `.st-app` page (header, rail, its own selector), the
Tweaks panel, the `omelette` design-runtime bits, and the elaborate export
progress/poster-fallback state machine (kept the core renderer).

## What was added

New modules (TypeScript ports):
- `features/result/stickerGeometry.ts` — `CARD_GEOM`, `RECEIPT_PRESETS`,
  `clampSticker` (safe-zone + exclusion constraint solver), `nearestGuide`, `posWords`.
- `components/cards/StickerLayer.tsx` — interactive draggable sticker + overlay.
- `components/cards/ReceiptStampEditor.tsx` — preset-only receipt stamp.
- `components/cards/ExportOverlays.tsx` — `StaticSticker` / `StaticStamp` for the
  offscreen export copies.
- `lib/exportCard.ts` — `renderCardBlob` (html-to-image → 1080×1920 PNG),
  `downloadResult`, `shareResult` (native share with download fallback), `canShareFiles`.
- `design/sticker-studio.css` — ported subset (sticker, safe-zone/exclusion overlay,
  snap guides, preset slots, receipt stamp, edit hint, offscreen export host).
- Dependency: `html-to-image`.

Result page (`features/result/Result.tsx`):
- New state: per-kind sticker `pos` (normalized) + receipt `receiptPreset`.
- Cards now render with the **built-in sticker/seal off**; the editable
  `StickerLayer` / `ReceiptStampEditor` overlays the card inside the existing
  `.rs-card-mount` (shares its 360×640 coordinate box, scales with `--rs-scale`).
- "Edit/Reposition" enters edit mode → safe-zone overlay + drag + arrow-key nudge +
  `Esc` to finish. Sticker picker, swap, hide, and a **Reset position** stay in the
  edit panel. Receipt gets preset slots (Top right / Overlay / Bottom left / off).
- Download / Share / "Export all 3 cards" now produce **real** 9:16 PNGs captured
  from an **offscreen full-scale render host** (`.rs-exporthost`) that mirrors the
  live customization — avoids fighting the visible card's scale transform and lets
  export-all capture all three without switching tabs.
- Tab arrow-key nav + swipe are disabled while editing so they don't conflict with
  sticker nudging / dragging.

The verdict explanations and stats blocks are untouched and remain on the same page.

## Gotchas

- The dev server must be **restarted** after adding `html-to-image` (Vite resolves
  deps at boot; otherwise `exportCard.ts` 500s).
- html-to-image tried to inline the cross-origin Google Fonts stylesheet → a caught
  but noisy `SecurityError`. Fixed with `skipFonts: true` — the page fonts are
  already loaded, so the snapshot still renders Anton/Hanken/Space Mono correctly.
- Capture target is the offscreen `.rs-export-card` (full scale, no transform), not
  the visible scaled mount.

## Verification

- `npm run typecheck` + `npm run build` clean.
- Playwright: Reposition mode shows the safe zone + BRAND/VERDICT/STATS exclusions +
  draggable sticker (selection ring + pips), all inline with the analysis on the
  right. Download produced real PNGs (`fitaura-face-green_flag.png`,
  `fitaura-outfit-green_flag.png`) — correct 9:16, fonts intact, sticker at its
  repositioned location. Console clean apart from the favicon 404.

## Follow-ups

- Optional: port the Studio's bottom-sheet `ShareSheet` (curated targets) if native
  share isn't enough on desktop.
- When the backend lands, persist `pos`/`receiptPreset` per result if cross-device
  customization is wanted (currently device-local with the result).
