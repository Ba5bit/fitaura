# 029 — Landing: smooth-scroll in-page anchor jumps (+ revert auto-hide nav)

## Context

[028] misread the request as an auto-hiding nav. The actual ask: when you click a
section-rail number (1–4), **animate the scroll** to that section instead of
teleporting. Reverted the auto-hide nav and implemented smooth anchor scrolling.

## Revert

Undid the auto-hide nav from c71f8f8: `Nav` is back to just the `scrolled` state;
`.ln-nav` CSS back to `transition: .25s` (no `.hidden` translate, no reduced-motion
block). Deleted the 028 dev-log.

## Smooth scroll

- `Landing` sets `document.documentElement.style.scrollBehavior = 'smooth'` while
  the page is mounted (cleared on unmount). This makes every in-page anchor jump
  on the landing animate — the section rail, the hero "Explore the modes", and the
  footer Product/Company links — with no per-link handlers.
- Skipped when the user prefers reduced motion (`prefers-reduced-motion: reduce`
  or the in-app `data-reduce-motion` toggle).
- `App.tsx` `ScrollToTop` now uses `behavior: 'instant'` so a route change never
  animates to the top even while the landing has smooth scrolling on.

## Files

- `apps/web/src/features/landing/Landing.tsx` — revert `Nav`; add scroll-behavior
  effect in `Landing`.
- `apps/web/src/design/landing.css` — revert `.ln-nav`.
- `apps/web/src/App.tsx` — `ScrollToTop` instant.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server: clicked rail dot #3 (`#modes`); sampled `window.scrollY` every 60ms:
  `0 → 22 → 122 → 367 → 1112 → 1614 → 1938 → 2131 → 2270` toward target 2597 —
  a smooth animated scroll (`scroll-behavior: smooth` active), not a jump. URL
  updated to `/#modes`.
