# 013 — Frontend stabilization (audit fixes)

Implements the fixes from `docs/audit/2026-06-12-frontend-audit.md`. No backend
work (per the task). `tsc --noEmit` + `vite build` clean; key paths verified live
via Playwright.

## Responsive (P0)
- Added `lib/useMediaQuery.ts`; `Upload.tsx` and `Scan.tsx` now drive `data-mobile`
  off `(max-width: 760px)` instead of the hardcoded `"false"` — the existing
  `[data-mobile="true"]` mobile layouts now actually activate. (Verified: upload
  zones stack on a 390px viewport.)
- `Landing.tsx` burger now opens a real mobile menu (`.ln-mobilemenu` in
  `landing.css`) with the nav links + CTA; Esc closes it. (Verified on mobile.)

## Stability & a11y (P1)
- New `components/ErrorBoundary.tsx` wraps `<App>` in `main.tsx` — render errors
  now show a branded recovery screen instead of a white page.
- `WebModal` got a focus trap, initial focus, and focus-return on close.
- Clickable `<span>`s in `AccountModals` ("How your data is stored", "Change")
  are now `<button>`s (keyboard-operable); added button resets in `account-web.css`.
- `CardImage` falls back to its placeholder if the image fails to load.

## Cleanup / dead code (P1/P2)
- Rewrote `account-web.css`: **443 → 210 lines**. Removed the design-tool browser-
  frame chrome, the deleted dashboard/results, the duplicate pack-selector/unlock/
  storage styles (those live in `vault.css`), and the old site-nav/handoff rules —
  all 0-reference (verified by grep against TSX). Kept only the live modal/auth/
  checkout/toast/chip styles. Build CSS dropped 179 KB → 163 KB.
- Obsolete route links fixed in `AccountModals`: `/storage`→`/settings`,
  `/results`→`/vault` (+ "Back to vault" label); refreshed the AuthGate eyebrow
  ("…TO CONTINUE") and the stale `FA-2B6T` mock id.
- Removed the stale committed `apps/web/dist/`.

## Performance (P1)
- The 3 offscreen export-host card trees in `Result.tsx` are now mounted **only
  during an export** (`withExportHost` arms them, waits for paint + image decode,
  captures, unmounts) instead of always. (Verified: download produces a correct
  full-render PNG.)
- Object URLs in `UploadZone` are now revoked on replace/remove/unmount (was a
  leak).

## Polish
- Added `public/favicon.svg` + link (kills the favicon 404).
- Added React Router v7 `future` flags in `main.tsx` (silences the 2 console
  deprecation warnings). Console is now 0 errors / 0 warnings.

## Deliberately deferred (need backend or are large, separate efforts)
- **Server-authoritative credits / payments / generation** — impossible without
  the backend; called out in the audit (§9–10). The mock flow stays until Supabase
  + payments land.
- **Service-layer extraction + splitting the localStorage domains** — a larger
  refactor best done as the first step of backend integration (so it's wired to
  real services, not restructured twice).
- **Full ESLint + test suite** — `tsconfig` already enables
  `noUnusedLocals`/`noUnusedParameters` (catches unused locals/params), so the
  gap is narrower than first stated; a real linter + tests remain a recommended
  pre-integration follow-up.
- **localStorage → IndexedDB for images** — recommended (quota risk) but deferred
  with the state refactor above.
- `uploaded/` prototypes left in place (reference; not bundled).
