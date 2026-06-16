# 043 — Frontend tweaks: webcam capture, full-bleed scan, sticker cycle, glow + save-button cleanup

Bucket C of the 2026-06-16 work (merge `f2a3778`) — five independent frontend
polish items shipped alongside the Solo Scan v3 engine (`042`). Spec/plan:
`docs/superpowers/specs/2026-06-16-frontend-tweaks-*` +
`docs/superpowers/plans/2026-06-16-frontend-tweaks-*`. `tsc` + `vite build` clean;
tests green (added `tapGesture.test.ts`). None of these touch scoring, so no version
bump and no edge-function redeploy — a plain `git push` ships them via Vercel.

## 1. Desktop webcam capture for the face photo
New `features/upload/WebcamCapture.tsx`, wired into `UploadZone.tsx`.

- A **"Take photo"** button appears **only for `kind === 'face'` and only on desktop**
  (`!mobile`) — mobile already gets the OS camera via the native file picker, so a custom
  webcam UI there is redundant.
- The live preview is **CSS-mirrored** (`transform: scaleX(-1)`) so it feels like a mirror,
  but `capture()` draws the raw (un-mirrored) video frame to a canvas → JPEG `File` at 0.92
  quality. Mirroring the *saved* image would flip text/asymmetry, so only the preview is
  flipped.
- **Stream lifecycle is the thing to get right:** `getUserMedia` tracks are stopped in the
  effect cleanup **and** guarded by a `cancelled` flag (if the component unmounts before the
  promise resolves, the late-arriving stream is stopped immediately). Permission denial /
  no-camera falls back to a friendly "use browse files instead" state, never a dead UI.
- The captured `File` flows through the **same `ingest()` path** as a dropped/picked file, so
  the existing crop/zoom/`bakeCrop` WebP re-encode (which strips EXIF, see `015`) applies
  identically — the webcam path isn't a special case downstream.

## 2. Full-bleed mobile scan animation
`scanner.css` only (`71247d6`). The scan screen already set `data-mobile` from
`useMediaQuery('(max-width: 760px)')` on the `.sa` root; this adds a
`.sa[data-mobile="true"] …` block that makes the specimen image **fill the viewport**
(`position:absolute; inset:0; min-height:100dvh`, radius 0) and overlays the chrome on top:

- header → translucent top gradient strip; the readout → a slim translucent **bottom strip**
  (`linear-gradient(0deg, rgba(8,10,14,.86) …)`) with `env(safe-area-inset-bottom)` padding.
- the step **rail** and the long **privacy footer line** are `display:none` on full-bleed —
  they don't fit the image-dominant layout and aren't essential mid-scan.

Pure CSS keyed off an existing attribute → no JS/markup change, desktop untouched.

## 3. Double-tap a sticker to cycle presets
New pure helper `lib/tapGesture.ts` (`createDoubleTap`) + wiring in
`components/cards/StickerLayer.tsx`.

- `createDoubleTap(onDouble, {maxMove, maxGap})` is **pure and time-injected** — you feed it
  `down(x,y,t)` / `up(x,y,t)` and it fires on two low-movement taps (≤6px) within 300ms. That
  shape is exactly why it's unit-testable (`tapGesture.test.ts`) without a DOM or fake timers.
- It's driven from the sticker's existing pointer handlers (`beginDrag`/`endDrag` call
  `dtap.down/up`), so **drag and double-tap share one gesture stream** — a real drag moves
  >6px and never counts as a tap, so cycling never fights repositioning.
- **Stale-closure gotcha handled:** the detector is created once (`useRef(...).current`), but
  `onCycle` changes per render (it closes over the active tab's sticker state). So an
  `onCycleRef` is kept current each render and the detector calls `onCycleRef.current?.()` —
  otherwise a double-tap would cycle whichever tab was active when the detector was first made.

## 4. Contain the breakdown-hero glow (`0945605`)
`result-shell.css` — the `.rs-block.hero` radial-gradient glow was anchored above the box
(`at 88% -10%`) with `overflow:hidden`, so it clipped to a hard square top edge instead of
reading as a soft bloom. Fix: move the origin inside the box (`at 80% 14%`), shrink the radius,
and tighten the falloff (`transparent 62%`). Applied to both `.rs-block.hero` and
`.rs-block.glass.hero`. Pure visual; no behavior change.

## 5. Remove the redundant "Save to history" button (`8981049`)
Results auto-save to the on-device vault, so the manual **Save to history** button (and its
`onSaveHistory`/`flashSaved` toast) was promising an action that already happened. Removed the
button from `ReceiptSummaryBlock.tsx` and its prop + handler from `Result.tsx`. Export /
Share / New scan remain. **Why it matters for a future agent:** if you re-add a save
affordance, remember saving is automatic — frame it as "saved ✓", not an action the user must
take, or you reintroduce the same confusion.
