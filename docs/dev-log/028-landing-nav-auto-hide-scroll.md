# 028 — Landing nav: auto-hide on scroll-down

## Change

The Landing header now slides up out of view when you scroll **down** and slides
back in when you scroll **up** (classic auto-hiding nav). Works on desktop and
mobile — same logic and CSS.

### Logic (`Landing.tsx` `Nav`)
- Added a `hidden` state and a `lastY` ref. The existing scroll handler now also
  computes direction:
  - `scrollY < 80` → always shown (near the top).
  - scrolling down (`y > lastY + 5`) → hide.
  - scrolling up (`y < lastY - 5`) → show.
- Class becomes `ln-nav … hidden` only when `hidden && !menuOpen` (the mobile menu
  keeps the nav pinned while open).

### CSS (`landing.css`)
- `.ln-nav` transitions `transform .34s cubic-bezier(.22,1,.36,1)` (+ `will-change`).
- `.ln-nav.hidden { transform: translateY(-100%); }`.
- Reduced-motion guard: under `prefers-reduced-motion: reduce` **or** the in-app
  `[data-reduce-motion="true"]` toggle, the transform/transition are disabled so
  the nav stays put.

## Files

- `apps/web/src/features/landing/Landing.tsx`
- `apps/web/src/design/landing.css`

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server, measured `getComputedStyle(nav).transform`:
  - Desktop (1280px): top → `none`; scroll down → `hidden` + `translateY(-74.8px)`;
    scroll up → `none`.
  - Mobile (390px): scroll down → `hidden` + `translateY(-82px)`; scroll up → `none`.
