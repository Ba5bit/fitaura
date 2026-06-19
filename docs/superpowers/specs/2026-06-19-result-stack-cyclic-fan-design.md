# Result stack — cyclic landing-style fan

**Date:** 2026-06-19
**Status:** Approved (design) — **shipped design evolved during implementation**;
see `docs/dev-log/059-result-stack-cyclic-fan.md` for what actually shipped.
This doc captures the original "Approach A — moderate fan". On review the user
asked to match the Landing fan more faithfully: front scaled + lifted, side
skins large and splayed ±154px/9° (bleeding off the column), the front **popping
to full size in edit mode**, and a **mobile tap-the-middle-card-to-advance**
affordance. The cyclic-rotation + state model below is unchanged.
**Scope:** frontend-only · the Result-page skin switcher only

## Problem

The Result page's skin switcher (`CardSwitcher`: Dossier → Clean → Lore per
kind) uses a subtle peek (34px offset, 5°) and a *reorder* on switch — there is
no visible travel, so it doesn't read as a "stack" the way the landing fan does.
We want the Result stack to take on the landing fan's look and motion: peeks
splayed wide, switching is a true **clockwise / anticlockwise rotation**.

The landing fan (`CardFan`) can splay ±150px because its front is scaled to 0.62
inside a 500px box. The Result front has no such headroom — it stays **full-size
(360×640), live, and exportable** (it carries the sticker editor and is the
WYSIWYG export source; prior work deliberately locked this in). So we adopt the
landing's *motion + splay feel* without shrinking the front (decision: Approach A
— "moderate fan").

## Non-goals

- FaceCard restyle (a separate follow-up prompt).
- OutfitCard / Receipt visuals, the kind-tabs, the export pipeline.
- Adding/removing skins.
- Drag-to-peel on the front (would fight the sticker drag) and skin-swipe
  gestures (a horizontal swipe already switches *kinds*).

## Design

### Interaction
- **Tap the right peek** → rotate clockwise (that card travels to centre).
  **Tap the left peek** → rotate anticlockwise. Same mapping as the landing's
  `next` / `prev`.
- **Dots** (already rendered below the card in `Result.tsx`) → jump to a skin,
  rotating the short way.
- The **front card is never a switch target** — it keeps pointer events for the
  sticker editor. No invisible click-zones over the front, no drag-to-peel.
- **Kinds vs skins stay separate:** tabs / arrows / horizontal-swipe switch
  *kinds* (unchanged); tapping peeks / dots switches *skins*. No gesture
  collision.
- Rotation is disabled while `locked` (editing) and under
  `prefers-reduced-motion` (snap, no animation).

### Visual / fan geometry — `apps/web/src/design/card-switcher.css`
- Front: `transform:none`, full 360×640, top z-index — unchanged.
- Peeks splay wider than today (tunable starting point):
  - `backRight` ≈ `translateX(80px) translateY(8px) rotate(8deg) scale(.82)`,
    `opacity:.5`.
  - `backLeft` mirrored, `opacity:.42`.
  - both `filter:saturate(.7)`, `transform-origin:50% 60%`, landing easing
    `transform .5s cubic-bezier(.22,1,.36,1), opacity .4s ease`.
- Keep `.cs-card:not(.front-live) * { pointer-events:none }` so a tap lands on
  the card (switch), not its inner photo/sticker/button.
- Splay tuned so peeks bleed only into the column gutter / grid gap — no
  collision with the analysis column. Reference: desktop card column is 440px,
  front is 360px; a 0.82-scaled peek offset ±80px stays within ~437px of the
  440px column. Verify no ancestor (`.rs-frame`, `.rs-card-mount`, `.rs-stage`)
  clips the peeks with `overflow:hidden`; allow controlled bleed.

### State model — `apps/web/src/components/cards/CardSwitcher.tsx` (the real change)
Today `order` is *derived* from `skinId` (`[active, …rest]`) every render, so a
switch just reorders — nothing travels. Change:

- Move `order` into component **state** (mirroring `CardFan`) so rotation
  animates the transform transitions.
- `next()` = `cycleOrder(order)` (front → back; the right/`backRight` card comes
  to centre). `prev()` = move the last item to front (the left/`backLeft` card
  comes to centre).
- Every order change writes the new front (`order[0]`) back to `skinId` via
  `setSkinId` — persistence per `{generationId, kind}` is unchanged.
- An effect re-syncs `order` when `skinId` changes **externally** (dots, vault
  restore, kind switch reusing the same mounted component): if
  `skinId !== skins[order[0]].id`, rotate `order` the short way to bring the
  target to front — so external changes also animate and order stays consistent.
  (Internal rotations already set `skinId`, so the effect is a no-op for them.)
- `locked` short-circuits all switching (unchanged contract).

### Shared helper
Reuse the existing pure `cycleOrder` (currently
`apps/web/src/features/landing/cardFanCycle.ts`). To avoid a
`components → features/landing` dependency, lift `cycleOrder` + its test to a
shared util (e.g. `apps/web/src/lib/cycleOrder.ts`) and repoint `CardFan` at it.

### `Result.tsx`
Essentially untouched. The skin dots already call `setFaceSkin` / `setOutfitSkin`
(i.e. `setSkinId`); under the new model that triggers the animated re-sync.

## Verification

- **Unit:** `cycleOrder` (existing test, moved with the helper) + the order
  re-sync logic (front always equals the selected skin after internal and
  external changes).
- **In-browser (Playwright)**, seeding a face+outfit result into IndexedDB as in
  dev-log 058 / driving the dev server:
  - tap right peek / dot-forward → clockwise rotation; tap left peek →
    anticlockwise.
  - dots stay in sync with the front.
  - front still drags stickers and enters edit mode.
  - export renders the **selected** skin (`FaceSkinComp` / `OutfitSkinComp`).
  - selection persists across reload.
  - `prefers-reduced-motion` disables the animation (snaps).
- Build clean; full test suite green.

## Files touched

- `apps/web/src/components/cards/CardSwitcher.tsx` — stateful order + cyclic
  rotation + external re-sync.
- `apps/web/src/design/card-switcher.css` — wider peek geometry + landing easing.
- `apps/web/src/lib/cycleOrder.ts` (new) + test — lifted from landing.
- `apps/web/src/features/landing/CardFan.tsx` — repoint import.
- (`apps/web/src/features/landing/cardFanCycle.ts` + test removed/relocated.)

## Dev-log

Write `docs/dev-log/059-result-stack-cyclic-fan.md` after shipping (per the
project's dev-log convention).
