# Frontend Tweaks (Bucket C) — Design

**Date:** 2026-06-16
**Bucket:** C (frontend-only; independent of Bucket B)
**Status:** design — awaiting user review before writing-plans

Five contained frontend tweaks. All are frontend-only and touch a disjoint set of files
from Bucket B (B: `packages/shared`, `supabase/functions/solo-scan`, `apps/web/src/data/mockGenerations.ts`),
so the two buckets parallelize with no merge conflicts.

---

## C1 · Desktop webcam capture (face)

**File:** `apps/web/src/features/upload/UploadZone.tsx` (+ small new capture component, e.g.
`apps/web/src/features/upload/WebcamCapture.tsx`).

- Add a **"Take photo"** button in the FACE zone's empty state (next to "Use a sample"), shown
  only on desktop (`!mobile`). Outfit zone and mobile are unchanged (mobile already gets the
  native camera via the file input).
- Capture flow: open `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })`,
  show a **live mirrored** preview inside the zone, a "Capture" + "Cancel" control. On capture,
  draw the current video frame to a `<canvas>` (un-mirrored for the saved image), export a
  data URL, build a `File`/`HTMLImageElement`, and route it through the **existing** `ingest()`
  path so crop/zoom/re-bake behave exactly like an uploaded photo.
- Lifecycle/edge cases: stop all `MediaStreamTrack`s on capture, cancel, and unmount;
  permission denied / no camera / insecure context → close the capture view and show a short
  note pointing back to "browse files". `getUserMedia` requires HTTPS (production is HTTPS;
  localhost is allowed).
- **Testing:** unit-test the frame→dataURL helper if extracted (canvas mock); otherwise manual
  (grant camera, capture, confirm it lands in the crop view, denial falls back cleanly).

## C2 · Full-bleed mobile scan animation

**Files:** `apps/web/src/features/scan/Scan.tsx`, `apps/web/src/design/scanner.css`.

- On mobile only (`.sa[data-mobile="true"]`), the specimen (outfit) image fills the **entire
  viewport edge-to-edge**; the face photo becomes a small corner inset; the scanline + HUD
  markers animate over the full-bleed image.
- The side `readout` (stage code, title, progress, rail, footer) collapses into a **slim
  translucent bottom strip**: stage label · % · progress bar · rotating microcopy. The top bar
  stays minimal (brand + close). The rail may reduce to dots or be hidden on mobile.
- **No logic changes** — the progress driver, stage machine, generation sync, and reveal flow in
  `Scan.tsx` are untouched. This is a presentational reorg gated by `data-mobile`, mostly CSS;
  any JSX change is limited to markup/structure the mobile CSS targets. Desktop layout unchanged.
- Honor `prefers-reduced-motion` (already handled via the `rm` class).
- **Testing:** manual at ≤760px (the existing mobile breakpoint) — image fills the screen,
  readout legible over it, reveal still works; desktop visually unchanged.

## C3 · Glow fix (in-app breakdown hero)

**Files:** the CSS for the breakdown hero — `apps/web/src/design/result-shell.css` (the
`.rs-block.hero` / `ScoreRing` glow); verify whether the landing "Full analysis" showcase shares
it.

- The aura glow currently bleeds to a hard **square edge** at the container bound (Image #1). Fix
  so the glow stays **inside the card's rounded bounds** — e.g. clip the glowing element to the
  rounded container (`overflow: hidden` + matching `border-radius`) and/or inset the glow so it
  doesn't reach the edge. Keep the soft aura look; only remove the square clipping.
- Apply the same fix anywhere that hero/glow renders (result page; landing showcase if shared).
- **Testing:** visual — glow is a soft round bloom contained in the rounded card, no square edge,
  on result + landing.

## C4 · Double-tap sticker to cycle

**Files:** `apps/web/src/features/result/Result.tsx`,
`apps/web/src/components/cards/StickerLayer.tsx`.

- Pass an `onCycle?: () => void` prop into `StickerLayer` wired to the existing `swapSticker`
  (advances `stk[kind]` to the next preset; already `% length`).
- Detect a **double-tap (touch) / double-click (mouse)** on the sticker that is **not a drag**:
  in the existing pointer handlers, treat a pointer up as a "tap" when total movement is under a
  small threshold (e.g. < 6px) and short; two taps within ~300 ms → call `onCycle`. This must not
  interfere with single-drag-to-reposition or keyboard nudge.
- Keep the "Swap" button in the control bar; add a subtle, non-exported hint (e.g. "double-tap to
  swap") on/near the sticker in the interactive view only (never on the exported card).
- Works in the normal (non-editing) result view where the sticker is shown via `StickerLayer`.
- **Testing:** unit-test the tap-vs-drag/double-tap detection helper if extracted; manual on
  touch + mouse (double-tap cycles; a drag still moves; export unaffected).

## C5 · Remove Save-to-history button

**Files:** `apps/web/src/features/result/Result.tsx` and the toolbar component it passes
`onSaveHistory` to (the `onSaveHistory={saveHistory}` consumer around `Result.tsx:336`).

- Remove the Save-to-history button from the toolbar, the `onSaveHistory` prop from the toolbar
  component, and the now-unused `saveHistory`/`flashSaved`/`savedFlash` wiring if nothing else
  uses them. Keep the passive **"SAVED TO DEVICE"** indicator — generations already auto-persist
  to the per-account IndexedDB vault on creation, so the manual button is redundant.
- **Testing:** typecheck (no dangling refs); manual — the button is gone, results still appear in
  the vault automatically.

---

## Build / verification (whole bucket)

- `cd apps/web && npx tsc --noEmit` (typecheck) and `npm run build` must pass.
- Manual smoke on the dev server: desktop webcam capture (C1), mobile full-bleed scan (C2),
  contained glow (C3), double-tap cycle + drag still works (C4), no Save button + auto-save intact
  (C5).
- No `packages/shared` / `supabase` changes — independent of Bucket B.

## Open items for the plan

- Whether the landing "Full analysis" showcase shares the breakdown-hero glow CSS (confirm during
  C3).
- Exact mobile bottom-strip styling (heights, blur, type sizes) — tune in implementation.
- Whether to extract the C4 tap-detection + C1 frame-capture into small testable helpers.
