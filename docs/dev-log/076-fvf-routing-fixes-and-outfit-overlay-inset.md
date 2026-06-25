# 076 — FvF: routing fixes (mirror Solo) + outfit overlay inset

**Date:** 2026-06-25
**Area:** Friend vs Friend routing + result deck
(`VersusScan.tsx`, `Vault.tsx`, `VersusResult.tsx`, `result/Result.tsx`, `versus.css`)

Two reports: (1) the outfit card's PLAYER name/score overlays were stuck to the frame
brackets; (2) FvF routing bugs — Chrome **back** to the Vault showed **Solo Scan** instead of
Friend vs Friend, and you could **back into the scan** from the result page.

## Outfit overlay inset
`.vs-fitframe` brackets sit at 10px. The overlays were at `fit-bl` left/bottom 14/12 and
`fit-tr` top/right 12 — kissing the corners. Bumped to `fit-bl` 22/20 and `fit-tr` 18 so the
PLAYER name and SCORE badge have clear breathing room off the brackets.

## Routing — back into the scan
Mirrored Solo's anti-reback logic (Solo's `Scan.tsx` `alreadyScanned` guard at lines 174/191):
- **VersusScan kickoff guard:** if a `result` already exists on mount (came back to the scan
  route, or manual entry), set `startedRef` and `navigate('/versus/result', { replace })`
  instead of re-running — prevents a re-scan **and a double 2-credit spend**. Safe during a
  live scan: the result commits *after* `startedRef` is set, so the effect's re-run bails on
  the `startedRef` check (no premature bounce before the reveal CTA).
- **Reveal navigates with `replace`** (`/versus/result`), so a completed scan leaves
  `/versus/run` out of the back stack entirely — Chrome back from the verdict goes to the
  upload page, not the scan.

## Routing — Vault opens the wrong mode on browser back
Root cause: the Vault tab is React state seeded from router `state.vaultMode`, but **browser
back/forward doesn't replay router state**, so a history visit to `/vault` always defaulted to
Solo. Fix: persist the active mode in `sessionStorage['vault:mode']` —
- `Vault` seeds from `state.vaultMode` → `sessionStorage` → `'solo'`, and writes the key
  whenever the tab changes (so manual rail switches survive history nav too).
- `VersusResult` sets it to `'friend'` on mount; `Result` (Solo) sets `'solo'` on mount — so
  returning to the Vault from either verdict reopens the matching tab regardless of how you
  navigate (in-app button, browser back, or a saved-battle deep link).

## Verification
`tsc` clean; web 187 tests pass. Live Playwright: outfit overlay clearly off the brackets;
`/versus/result` → `/vault` opens **Friend vs Friend** (`vault:mode='friend'` persisted +
read); `/versus/run` with a result present redirects to `/versus/result` (no re-scan). Local.
