# Frontend Tweaks (Bucket C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five frontend-only tweaks — remove the redundant Save-to-history button, fix the breakdown-hero glow square edge, add double-tap-to-cycle on stickers, make the mobile scan animation full-bleed, and add desktop webcam capture for the face photo.

**Architecture:** All changes live in `apps/web/src`. No `packages/shared` or `supabase` changes, so this bucket is independent of Bucket B (zero shared files → no merge conflicts). Most changes are component/CSS; one small pure helper (tap detection) is unit-tested.

**Tech Stack:** React + TypeScript, Vite, plain CSS (`apps/web/src/design/*.css`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-frontend-tweaks-design.md`

**Conventions:**
- Typecheck: `cd "apps/web" && npx tsc --noEmit`.
- Build: `cd "apps/web" && npm run build`.
- Tests: `cd "apps/web" && npx vitest run <path>`.
- Dev server for manual checks: `npm run dev` (from repo root) → open the printed localhost URL.
- Commit after each task. Commits on `main` auto-push per project convention.

---

## File map

| File | Task |
|---|---|
| `apps/web/src/components/analysis/ReceiptSummaryBlock.tsx` | T1 — remove Save button + prop |
| `apps/web/src/features/result/Result.tsx` | T1 (drop wiring), T3 (cycle handler) |
| `apps/web/src/design/result-shell.css` | T2 — hero glow fix |
| `apps/web/src/components/cards/StickerLayer.tsx` | T3 — double-tap cycle |
| `apps/web/src/lib/tapGesture.ts` (new) + test | T3 — tap-vs-drag/double-tap helper |
| `apps/web/src/features/scan/Scan.tsx`, `apps/web/src/design/scanner.css` | T4 — full-bleed mobile |
| `apps/web/src/features/upload/UploadZone.tsx`, `apps/web/src/features/upload/WebcamCapture.tsx` (new) | T5 — webcam |

---

## Task 1: Remove the Save-to-history button (C5)

The button is redundant — generations auto-persist to the per-account IndexedDB vault on creation, and a passive "SAVED TO DEVICE" indicator already shows in the header.

**Files:**
- Modify: `apps/web/src/components/analysis/ReceiptSummaryBlock.tsx`
- Modify: `apps/web/src/features/result/Result.tsx`

- [ ] **Step 1: Remove the button + prop from `ReceiptSummaryBlock.tsx`**

Delete `onSaveHistory` from the props interface and the destructure, and delete the button:

```tsx
// remove from interface:  onSaveHistory: () => void;
// remove from destructure: onSaveHistory,
// remove this button entirely:
//   <button className="rs-bigbtn" onClick={onSaveHistory}>
//     <Icon.bookmark />
//     Save to history
//   </button>
```

Resulting `rs-summary-actions` keeps Export all 3 / Share verdict / New scan.

- [ ] **Step 2: Drop the wiring in `Result.tsx`**

- Remove `onSaveHistory={saveHistory}` from the `<ReceiptSummaryBlock ... />` usage.
- Remove the `saveHistory` function (the `const saveHistory = () => { ping('Saved to history on this device'); flashSaved(); };`).
- Remove `flashSaved` and the `savedFlash` state if now unused, and simplify the header indicator to the static label:

```tsx
// header indicator — was: {savedFlash ? 'SAVED ✓' : 'SAVED TO DEVICE'}
<div className="rs-saved">
  <span className="led" />
  <span>SAVED TO DEVICE</span>
</div>
```

(If `savedFlash`/`flashSaved` are referenced nowhere else, delete their declarations; `tsc` in Step 3 will flag any straggler.)

- [ ] **Step 3: Typecheck**

Run: `cd "apps/web" && npx tsc --noEmit`
Expected: no errors (no unused-variable or missing-prop errors).

- [ ] **Step 4: Manual check + commit**

Manual: open a result page → the receipt tab's summary no longer shows "Save to history"; the header still shows "SAVED TO DEVICE"; the result is still in the vault.

```bash
git add apps/web/src/components/analysis/ReceiptSummaryBlock.tsx apps/web/src/features/result/Result.tsx
git commit -m "feat(web): remove redundant Save-to-history button (auto-save stays)"
```

---

## Task 2: Fix the breakdown-hero glow (C3)

The hero's background radial is centered **above** the card (`at 86% -16%`), so `overflow:hidden` + `border-radius:18px` slice the bright bloom along the straight top/right edges → a "square end" glow. Pull the center inside the card and fade it before the edges. Two hero variants share the pattern.

**Files:**
- Modify: `apps/web/src/design/result-shell.css`

- [ ] **Step 1: Replace the `.rs-block.hero` radial (≈ line 184)**

```css
.rs-block.hero{ background:
    radial-gradient(360px 200px at 80% 14%, color-mix(in oklab,var(--accent) 12%,transparent), transparent 62%),
    var(--panel); }
```

- [ ] **Step 2: Replace the `.rs-block.glass.hero` radial (≈ line 237)**

```css
.rs-block.glass.hero{
  background:
    radial-gradient(380px 210px at 80% 14%, color-mix(in oklab,var(--accent) 15%,transparent), transparent 62%),
    linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
}
```

(Center moved inside the card at `80% 14%` and the falloff reaches `transparent` by 62%, so the bloom fades before any edge — no hard cut. Intensity kept near the originals.)

- [ ] **Step 3: Build + manual verify**

Run: `cd "apps/web" && npm run build`
Expected: build succeeds.
Manual: on the result page Face tab AND the landing `#analysis` Face card, the accent glow is a soft round bloom fully inside the rounded card — no square/straight cut at the edge. (The landing showcase reuses these `.rs-block.hero` styles; confirm both.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/design/result-shell.css
git commit -m "fix(web): contain breakdown-hero glow so it no longer clips to a square edge"
```

---

## Task 3: Double-tap a sticker to cycle (C4)

Add double-tap (touch) / double-click (mouse) on the sticker to advance to the next preset, without breaking drag-to-reposition. Keep the existing "Swap" button and add a small hint.

**Files:**
- Create: `apps/web/src/lib/tapGesture.ts`
- Create/Test: `apps/web/src/lib/tapGesture.test.ts`
- Modify: `apps/web/src/components/cards/StickerLayer.tsx`
- Modify: `apps/web/src/features/result/Result.tsx`

- [ ] **Step 1: Write the failing helper test**

`apps/web/src/lib/tapGesture.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDoubleTap } from './tapGesture';

describe('createDoubleTap', () => {
  it('fires on two quick low-movement taps', () => {
    let fired = 0;
    const dt = createDoubleTap(() => { fired++; }, { maxMove: 6, maxGap: 300 });
    dt.down(0, 0, 1000); dt.up(2, 2, 1080);   // tap 1
    dt.down(1, 1, 1200); dt.up(2, 0, 1260);   // tap 2 within gap
    expect(fired).toBe(1);
  });

  it('does not fire when the pointer moved too far (a drag)', () => {
    let fired = 0;
    const dt = createDoubleTap(() => { fired++; }, { maxMove: 6, maxGap: 300 });
    dt.down(0, 0, 1000); dt.up(40, 40, 1080); // moved → not a tap
    dt.down(0, 0, 1200); dt.up(2, 2, 1260);
    expect(fired).toBe(0);
  });

  it('does not fire when taps are too far apart in time', () => {
    let fired = 0;
    const dt = createDoubleTap(() => { fired++; }, { maxMove: 6, maxGap: 300 });
    dt.down(0, 0, 1000); dt.up(1, 1, 1050);
    dt.down(0, 0, 2000); dt.up(1, 1, 2050);   // gap 950ms
    expect(fired).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd "apps/web" && npx vitest run src/lib/tapGesture.test.ts`
Expected: FAIL (`createDoubleTap` not found).

- [ ] **Step 3: Implement the helper**

`apps/web/src/lib/tapGesture.ts`:

```ts
/** Detects a double-tap/double-click made of two low-movement taps within a time gap.
 * Pure + time-injected so it's testable. Feed it pointer down/up coordinates + timestamps. */
export interface DoubleTapOpts { maxMove?: number; maxGap?: number; }

export function createDoubleTap(onDouble: () => void, opts: DoubleTapOpts = {}) {
  const maxMove = opts.maxMove ?? 6;
  const maxGap = opts.maxGap ?? 300;
  let downX = 0, downY = 0, downT = 0;
  let lastTapT = 0;
  return {
    down(x: number, y: number, t: number) { downX = x; downY = y; downT = t; },
    up(x: number, y: number, t: number) {
      const moved = Math.hypot(x - downX, y - downY);
      const isTap = moved <= maxMove && t - downT < 500;
      if (!isTap) { lastTapT = 0; return; }
      if (lastTapT && t - lastTapT <= maxGap) { lastTapT = 0; onDouble(); }
      else lastTapT = t;
    },
  };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd "apps/web" && npx vitest run src/lib/tapGesture.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `StickerLayer.tsx`**

- Add `onCycle?: () => void;` to `StickerLayerProps`.
- Create the detector once: `const dtap = useRef(createDoubleTap(() => onCycle?.())).current;` (import `createDoubleTap` and `useRef`).
- In `beginDrag`, after the existing logic, record the down: `dtap.down(e.clientX, e.clientY, e.timeStamp);`
- In `endDrag`, after the existing logic, record the up: `dtap.up(e.clientX, e.clientY, e.timeStamp);`
- This reuses the existing pointer capture/drag flow: a real drag moves > `maxMove` so it won't count as a tap; two quick still taps fire `onCycle`.

- [ ] **Step 6: Pass `onCycle` + add the hint in `Result.tsx`**

- On both `<StickerLayer .../>` usages (face + outfit), add `onCycle={swapSticker}`.
- Add a subtle interactive-only hint near the control bar's "Sticker" label (NOT in the exported card), e.g. in the `rs-controlbar`:

```tsx
<span className="rs-cb-hint">double-tap sticker to swap</span>
```

(Add a muted style for `.rs-cb-hint` in the result CSS, or reuse an existing faint-text class.)

- [ ] **Step 7: Typecheck + manual + commit**

Run: `cd "apps/web" && npx tsc --noEmit` (expect no errors).
Manual: on a result card, double-tap/double-click the sticker → it changes to the next one; a single drag still repositions it; the "Swap" button still works; the exported PNG has no hint text.

```bash
git add apps/web/src/lib/tapGesture.ts apps/web/src/lib/tapGesture.test.ts apps/web/src/components/cards/StickerLayer.tsx apps/web/src/features/result/Result.tsx
git commit -m "feat(web): double-tap a sticker to cycle to the next one"
```

---

## Task 4: Full-bleed mobile scan animation (C2)

On mobile, make the specimen image fill the viewport with the readout overlaid as a slim bottom strip. CSS-only, gated by `data-mobile="true"`; the scan logic in `Scan.tsx` is untouched. Desktop unchanged.

**Files:**
- Modify: `apps/web/src/design/scanner.css`
- (Only touch `Scan.tsx` if a wrapper hook is needed — prefer CSS-only.)

- [ ] **Step 1: Add a mobile full-bleed block to `scanner.css`**

Append (or place near the existing `data-mobile` rules) a dedicated mobile block. This makes the stage cover the viewport, the specimen fill it, and the readout overlay the bottom:

```css
/* ---- mobile full-bleed scan (C2) ---- */
.sa[data-mobile="true"] .sa-pad{ padding:0; position:relative; min-height:100dvh; }
.sa[data-mobile="true"] .sa-head{ position:absolute; top:0; left:0; right:0; z-index:10;
  padding:12px 14px; background:linear-gradient(180deg, rgba(8,10,14,0.6), transparent); }

.sa[data-mobile="true"] .sa-stage{ position:absolute; inset:0; grid-template-columns:1fr;
  gap:0; padding:0; }
.sa[data-mobile="true"] .specimen{ position:absolute; inset:0; width:100%; height:100%;
  --fw:100%; --fh:100%; margin:0; justify-self:stretch; }
.sa[data-mobile="true"] .spec-aura{ inset:0; border-radius:0; }
.sa[data-mobile="true"] .spec-frame{ position:absolute; inset:0; border-radius:0; }
.sa[data-mobile="true"] .spec-ov,
.sa[data-mobile="true"] .spec-frame .scrim{ border-radius:0; }
.sa[data-mobile="true"] .spec-corners span{ /* keep reticle but tuck to safe margins */
  width:22px; height:22px; }
/* face inset to a corner */
.sa[data-mobile="true"] .spec-face{ top:auto; bottom:120px; left:14px; --med:84px; }

/* readout collapses to a slim translucent bottom strip overlaid on the image */
.sa[data-mobile="true"] .readout{ position:absolute; left:0; right:0; bottom:0; z-index:10;
  gap:8px; padding:14px 16px calc(14px + env(safe-area-inset-bottom));
  background:linear-gradient(0deg, rgba(8,10,14,0.86) 60%, transparent); }
.sa[data-mobile="true"] .ro-title{ font-size:22px; }
.sa[data-mobile="true"] .rail{ display:none; }       /* rail hidden on full-bleed */
.sa[data-mobile="true"] .ro-foot{ display:none; }     /* drop the long privacy line on mobile */
```

- [ ] **Step 2: Build**

Run: `cd "apps/web" && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual check at mobile width**

Run dev server, open in a ≤760px viewport (or DevTools device mode). Start a scan. Verify:
- The outfit image fills the whole screen edge-to-edge; scanline + HUD animate over it.
- The face photo sits as a small inset above the bottom strip.
- The bottom strip shows stage label, %, progress bar, and rotating microcopy, legible over the image.
- The reveal screen still appears and "Reveal/Sign up" works.
- Desktop (≥761px) is visually unchanged.

> Tuning note: bottom-strip height, blur, inset positions, and the face-inset corner are visual polish — adjust the px values above live until it reads well for a screen recording. Keep all changes inside `.sa[data-mobile="true"]` so desktop is never affected.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/design/scanner.css
git commit -m "feat(web): full-bleed mobile scan animation (image-dominant, overlaid readout)"
```

---

## Task 5: Desktop webcam capture for the face (C1)

Add a "Take photo" option to the FACE upload zone on desktop that captures from the webcam and routes the frame through the existing crop/ingest flow. Mobile and the outfit zone are unchanged.

**Files:**
- Create: `apps/web/src/features/upload/WebcamCapture.tsx`
- Modify: `apps/web/src/features/upload/UploadZone.tsx`

- [ ] **Step 1: Create the `WebcamCapture` component**

`apps/web/src/features/upload/WebcamCapture.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../lib/icons';

interface WebcamCaptureProps {
  /** Called with a captured JPEG File (un-mirrored), then the capture view closes. */
  onCapture: (file: File) => void;
  onCancel: () => void;
}

/** Inline webcam capture for the face zone (desktop). Shows a mirrored live preview,
 * captures the current frame to an un-mirrored JPEG File. Stops the stream on exit. */
export function WebcamCapture({ onCapture, onCancel }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }
      })
      .catch(() => setErr('Camera unavailable. Use “browse files” instead.'));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height); // un-mirrored (preview is CSS-mirrored only)
    c.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], 'webcam.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  if (err) {
    return (
      <div className="zone-err">
        <span className="ic"><Icon.alert /></span>
        <span className="title">No camera</span>
        <span className="msg">{err}</span>
        <button className="cbtn" onClick={onCancel} style={{ marginTop: 12 }}>Back</button>
      </div>
    );
  }
  return (
    <div className="webcam-capture">
      <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 14, transform: 'scaleX(-1)' }} />
      <div className="crop-ctrls" style={{ marginTop: 12 }}>
        <button className="cbtn" onClick={capture}><Icon.camera /> Capture</button>
        <button className="cbtn danger" onClick={onCancel}><Icon.x /> Cancel</button>
      </div>
    </div>
  );
}
```

> If `Icon.camera` doesn't exist, use an existing icon (e.g. `Icon.face`) — check `apps/web/src/lib/icons`.

- [ ] **Step 2: Wire it into the FACE zone of `UploadZone.tsx`**

- Add state: `const [capturing, setCapturing] = useState(false);`
- In the `status === 'empty'` block, only for `kind === 'face' && !mobile`, add a button next to "Use a sample":

```tsx
{kind === 'face' && !mobile && (
  <button type="button" className="sample" onClick={(e) => { e.stopPropagation(); setCapturing(true); }}>
    Take photo
  </button>
)}
```

- Render the capture view (replaces the drop UI while capturing). The captured `File` goes straight into the existing `ingest`:

```tsx
{capturing && (
  <WebcamCapture
    onCapture={(file) => { setCapturing(false); ingest(file); }}
    onCancel={() => setCapturing(false)}
  />
)}
```

Place this so it renders instead of the empty drop zone while `capturing` is true (e.g. guard the empty-state JSX with `!capturing`). `ingest` already validates the mime, decodes, and enters the crop flow — no other changes needed.

- [ ] **Step 3: Typecheck + build**

Run: `cd "apps/web" && npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 4: Manual check + commit**

Manual (desktop, dev server over https/localhost): on the face zone click "Take photo" → grant camera → live mirrored preview → Capture → the shot lands in the crop view and can be zoomed/repositioned like an upload. Deny permission → falls back with the "Camera unavailable" note. Mobile face zone has no "Take photo" button.

```bash
git add apps/web/src/features/upload/WebcamCapture.tsx apps/web/src/features/upload/UploadZone.tsx
git commit -m "feat(web): desktop webcam capture for the face photo"
```

---

## Task 6: Full verification

- [ ] **Step 1: Typecheck + tests + build**

```bash
cd "apps/web" && npx tsc --noEmit && npm test && npm run build
```
Expected: typecheck clean, all tests pass (incl. `tapGesture`), build succeeds.

- [ ] **Step 2: Manual smoke (dev server)**

- C5: no "Save to history" button; auto-save indicator present.
- C3: hero glow contained, no square edge (result + landing).
- C4: double-tap cycles the sticker; drag still repositions; Swap button works.
- C2: mobile scan is full-bleed image with overlaid readout; desktop unchanged.
- C1: desktop face webcam capture → crop flow; permission-deny fallback.

- [ ] **Step 3: Dev-log**

Write `docs/dev-log/0XX-frontend-tweaks.md` per the dev-log convention (what changed, why, any tuning notes).

```bash
git add docs/dev-log/
git commit -m "docs: dev-log for frontend tweaks (Bucket C)"
```

---

## Self-review (completed during planning)

**Spec coverage:** C1 webcam (T5) ✓; C2 full-bleed mobile (T4) ✓; C3 glow fix (T2, with the diagnosed root cause) ✓; C4 double-tap cycle + keep Swap button + hint (T3) ✓; C5 remove Save button (T1) ✓; verification (T6) ✓.

**Type consistency:** `createDoubleTap` signature consistent across T3 test + impl + StickerLayer usage; `onCycle?` prop added in StickerLayer (T3) and passed in Result (T3); `WebcamCapture` props (`onCapture(file: File)`, `onCancel`) consistent between T5 component + UploadZone usage; `ingest(file: File)` already exists in UploadZone.

**Placeholder scan:** concrete code/CSS in every step. Visual polish (mobile strip sizing, glow intensity) is flagged as live-tuning on top of a concrete, working starting point — not a placeholder for logic.
