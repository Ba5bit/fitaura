# 059 — Result stack: cyclic landing-style fan

**Date:** 2026-06-19
**Spec:** `docs/superpowers/specs/2026-06-19-result-stack-cyclic-fan-design.md`
**Status:** implemented + verified in-browser · **commit/push held** (iterative
session — FaceCard restyle is the next prompt) · frontend-only

## What changed

The Result-page skin switcher (`CardSwitcher`: Dossier → Clean → Lore per kind)
was reworked to **look and move like the Landing fan**: switching is a true
clockwise / anticlockwise **rotation**, and the deck is a wide splayed fan — the
front skin big and lifted, the two side skins large and rotated, bleeding off the
column edges. The front is still the live, editable, exportable card.

Built in two passes this session:

1. **Cyclic rotation + state.** `order` (the deck arrangement) moved into
   `useState`. Before it was derived from `skinId` each render, so a switch just
   reordered with nothing travelling. Now an order change animates the transform
   transitions. An effect re-syncs `order` when `skinId` changes externally (the
   dots in `Result.tsx`, vault restore, a kind switch on the same mounted
   component), rotating the selected skin to the front the short way. Internal
   taps already set `skinId`, so the effect is a no-op for them (no loop).
   Helper `rotateToFront` added beside `cycleOrder`, both lifted to
   `apps/web/src/lib/cycleOrder.ts` (so `components/` no longer imports from
   `features/landing`); `CardFan` repointed, old file + test removed.

2. **Landing-faithful fan + edit pop + mobile tap** (`card-switcher.css`,
   `CardSwitcher.tsx`):
   - **Browse:** `.front-live` ≈ `translateY(-6px) scale(.94)`; side skins
     `translateX(±154px) rotate(±9deg) scale(.84)`, heavy drop-shadow +
     `brightness(.82)` to recess them. Big cards splayed wide — they overflow the
     440px column into the gutter (the Landing look), no analysis collision.
   - **Edit pops to full.** `.cs-deck.editing .front-live { transform:none }`
     (full card-border size for comfortable sticker work) and the peeks hide
     (`opacity:0`). Toggled by the `editing` class on `.cs-deck` (from `locked`).
     Browse↔edit animates (the card grows when you hit Reposition).
   - **Mobile tap-to-advance.** On `(max-width:760px)` a tap on the
     **middle/front card** advances to the next skin (the splayed side cards are
     hard to hit on a phone). Taps that land on the sticker are ignored
     (`e.target.closest('.st-sticker')`) so sticker editing is preserved. Gated by
     `useMediaQuery('(max-width:760px)')`.
   - **Mobile fit / no horizontal scroll.** A page-level
     `.rs-app { overflow-x:clip }` (in the existing `≤1000px` layout block) clips
     the side-skin bleed so it never adds a horizontal scrollbar — the bug where
     the deck overflowed the viewport (e.g. 489px wide on a 390px phone).
     `body{overflow-x:hidden}` did *not* clip it (the cards are absolutely
     positioned); `clip` on `.rs-app` is the same fix the Landing uses on `.ln`,
     scoped to the mobile block where `.rs-asset` is already static so it can't
     disturb the desktop sticky column.
   - **Mobile vertical fit.** The phone front uses `scale .98` (side skins
     `±106px scale .78`) so the front nearly fills the deck height — without this
     a smaller front left ~43px of dead space above *and* below the fan (the deck
     reserves full card height; a scaled-down front is centred in it). Now the
     gaps are just the normal stage padding + dots margin (~36/38px).

Kinds (tabs / arrows / swipe) and skins (peeks / dots / mobile middle-tap) stay
cleanly separated. Export is untouched (the offscreen host renders the selected
skin full-size — WYSIWYG regardless of the on-screen fan scale).

## Verification

- Unit: `cycleOrder` (moved) + 6 new `rotateToFront` cases. `npm test` →
  **162 passed**; `typecheck` + `build` clean.
- In-browser (Playwright, seeded `MOCK_GENERATIONS.green_flag` via the app's own
  `putResult`/`putSession`, drove the dev server at a realistic 1512×950 + a
  390×844 phone):
  - desktop fan splays wide like the Landing; front big + live (sticker +
    controls); dots rotate the deck the short way and bring each skin
    (Dossier→Clean→Lore) big to front; pose order matched `rotateToFront`.
  - **edit mode** pops the front to the full card-border size, hides the peeks,
    shows the sticker safe-zone editor.
  - **mobile**: tapping the middle card advanced the fan (dot 2→0); tapping the
    sticker did **not** advance (guard). 0 console errors.

## Revision — landing-style click zones (supersedes the tap model above)

The original tap model (pass 2) put `onClick` handlers on the **cards** — tap a
side peek and `select()` rotated *that* skin to centre, and only **mobile**
advanced on a front-card tap (`useMediaQuery` gate). Two problems surfaced
in-browser:

1. Tapping the front card did nothing on **desktop** (the `!isMobile` early
   return).
2. With only 3 cards, bringing a tapped side card to centre forces the third card
   to **sweep the full width** of the fan to wrap around — it read as "only the
   neighbouring card changes," a confusing, direction-ambiguous motion.

Fixed by adopting the **Landing fan's overlap-proof model** (`CardFan` /
`.cf-zone`): two invisible click zones — **left half = anti-clockwise (`prev`),
right half = clockwise (`next`)** — so a tap always rotates the right way no
matter how the splayed cards overlap. Because the front card here is **live**
(carries the sticker editor, unlike Landing's inert previews), the zones sit
**below** it (`z-index:3`, between the peeks at 2 and the front at 5) and overflow
the deck (`left/right:-160px`) to cover the bleeding peeks. The front card masks
the centre, so:

- **centre tap → clockwise (`next`)** on desktop *and* mobile (sticker taps still
  pass through via the `.st-sticker` guard);
- **left peek sliver → anti-clockwise**, **right peek sliver → clockwise** — fixed
  zones, no per-card sweep ambiguity.

Peeks are now fully inert (`pointer-events:none`, `aria-hidden`); the zones are
the `<button>`s (keyboard/SR-accessible, matching Landing). `useMediaQuery` and
the per-peek `select()` were removed; `next`/`prev` mirror `CardFan` exactly
(`cycleOrder` / last-to-front). `typecheck` + **184 tests** pass.

## Files

- `apps/web/src/lib/cycleOrder.ts` (new) + `cycleOrder.test.ts` (moved/extended)
- `apps/web/src/features/landing/cardFanCycle.ts` (+ test) — removed
- `apps/web/src/features/landing/CardFan.tsx` — repoint import
- `apps/web/src/components/cards/CardSwitcher.tsx` — stateful cyclic rotation,
  `editing` deck class, mobile middle-tap advance
- `apps/web/src/design/card-switcher.css` — landing-faithful fan, edit pop,
  mobile fan
- `apps/web/src/design/result-shell.css` — mobile `.rs-app{overflow-x:clip}` so
  the fan bleed never adds a horizontal scrollbar

## Follow-ups

- [ ] Confirm the revised click-zones live on the Result page (centre/left/right
      taps rotate as described, sticker editing still works). Logic + types +
      184 tests pass; live visual on the Result page not re-driven this pass.
- [ ] FaceCard restyle (separate prompt — the user's stated next step).
- [ ] Commit + push once the iterative tweak session is done (per push pref).
