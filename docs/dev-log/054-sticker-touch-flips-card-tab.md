# 054 — Tapping/dragging a sticker on mobile flipped the card (face → receipt)

## Bug

On mobile, interacting with the editable sticker on a card (Result page) would
switch the visible card — e.g. face → receipt — instead of just touching the
sticker.

## Root cause

The card frame (`.rs-frame`, `Result.tsx`) has **swipe-to-switch-tab** wired with
**touch events** (`onTouchStart` / `onTouchEnd`): a horizontal drag > 52px flips
the tab. The sticker (`StickerLayer`) lives *inside* that frame and drags via its
own **pointer events** — and is draggable even outside edit mode (`beginDrag`
only checks `hidden`, not `editing`).

On a touchscreen one finger emits **both** event streams:

- pointer stream → drives the sticker drag (with `setPointerCapture`),
- touch stream → **bubbles up to `.rs-frame`** and feeds the swipe detector.

So a horizontal drag/flick on the sticker (which feels like "tapping" it) was
**double-counted as a card swipe** and changed the tab. `touch-action:none` on
`.st-sticker` stops the browser's scroll/zoom but does **not** stop touch events
from firing and bubbling. The frame's `onTouchStart` never checked whether the
gesture began on the sticker.

(The receipt stamp overlay does *not* have this bug: `.st-stickerlayer` is
`pointer-events:none` in non-edit mode and its preset buttons only render while
editing, where swipe is already disabled.)

## Fix

New pure, unit-testable module `features/result/swipeGesture.ts`:

- `swipeStep(dx, dy)` — the existing threshold logic (52px, 1.4× horizontal
  dominance) extracted to `-1 | 0 | 1`.
- `startsOnInteractiveSticker(target)` — `target.closest('.st-sticker') != null`.

`Result.tsx` `onTouchStart` now **bails (doesn't arm the swipe) when the touch
begins on the sticker**, so a sticker drag no longer reaches the swipe detector.
Swipes that start anywhere else on the card still flip tabs as before.

```ts
const onTouchStart = (e) => {
  if (editing) return;
  if (startsOnInteractiveSticker(e.target)) { touch.current = null; return; }
  touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
};
const onTouchEnd = (e) => {
  if (!touch.current) return;
  const step = swipeStep(e.changedTouches[0].clientX - touch.current.x,
                         e.changedTouches[0].clientY - touch.current.y);
  if (step) setTab(tab + step);
  touch.current = null;
};
```

Why exclude only `.st-sticker` (not the whole `.st-stickerlayer`): the layer
spans the card, so excluding it would kill swipe on the photo too. Only the
sticker chip has `pointer-events:auto`, so it's the precise hit target.

## Not changed (observation)

The sticker is still free-draggable outside edit mode (that's existing behavior,
not the reported bug). If accidental repositioning is also unwanted, gating
`beginDrag` on `editing` is a separate, easy follow-up.

## Verification

TDD: wrote `swipeGesture.test.ts` first → red (module missing) → implemented →
green. Full suite **139/139** (18 files), `typecheck` clean, `build` ✓.

- `swipeStep`: tap (≤52px) → 0; left → +1; right → −1; mostly-vertical → 0.
- `startsOnInteractiveSticker`: sticker target → true (excluded); elsewhere →
  false; null/non-element → false.

On-device confirmation: tapping/dragging the sticker no longer changes the card;
swiping the photo still does.

## Files

- `apps/web/src/features/result/swipeGesture.ts` — new pure gesture helpers
- `apps/web/src/features/result/swipeGesture.test.ts` — unit tests
- `apps/web/src/features/result/Result.tsx` — exclude sticker touches from swipe
