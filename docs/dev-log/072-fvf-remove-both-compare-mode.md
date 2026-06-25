# 072 — FvF: remove the "Both" compare mode (full strip)

**Date:** 2026-06-25
**Area:** Friend vs Friend, end-to-end (`packages/shared/src/versus/*`, `apps/web/src/features/versus/*`, `apps/web/src/state/*`, `supabase/functions/versus-scan/*`)

Real-world testing on a big group showed that letting people compare **face** and **fit**
*separately* is the better UX than a combined "Both" run. So `both` is gone — not hidden,
removed from the type union outward (a "full strip"), with **Face** as the new default.

## Why narrow the type first
`VersusMode = 'face' | 'fit' | 'both'` → `'face' | 'fit'` in `versus/schema.ts` is the
source of truth. Narrowing it turns every remaining `mode === 'both'` / `|| 'both'` branch
into a compiler error, so `tsc` hands you the exact removal list instead of grep guesswork.
Each predicate collapsed from `mode === 'x' || mode === 'both'` to `mode === 'x'`:

- shared: `computeBattle.ts`, `assemble.ts`, `prompt.ts`
- web: `versusBits.tsx` (selector array + labels), `VersusUpload.tsx` (`requiredSlots`,
  `ContenderCard`, **default `'both'`→`'face'`**, hint copy), `VersusResult.tsx`
  (`cards` list lost `['face','fit','overall']`; `catLabel` lost the `categoryCount===2`
  branch), `services/versusScanService.ts`, `state/battle.tsx` hydration guards
- edge: `versus-scan/index.ts` has its **own local** `VersusMode` + `validMode` +
  `includeFace/Fit` — narrowed too.

`computeBattle`/`summarizeBattle` keep their multi-group averaging structurally (it
collapses cleanly to one group); only the mode predicates + stale comments changed. No
CSS change — `.vs-modes` is `inline-flex`, so 2 buttons just reflow.

## The non-obvious landmine: saved battles
FvF battles persist per-account in IndexedDB, and the old default was `both`, so **most
saved battles in real vaults are `mode:'both'`.** Under full strip those compute to a bogus
0–0 dead heat (the Solo-Vault malformed-result crash class). Fix in `generationDb.ts`
`loadBattles`: a new `isSupportedMode` gate **drops + deletes** any non-`face`/`fit` row on
load, exactly like the existing expired-row prune. Legacy Both battles disappear cleanly
instead of rendering broken. Locked in by a new `generationDb.test.ts` case.

## Verification
`tsc` clean both workspaces. shared **73** tests + web **187** tests green (rewrote the
`both`-mode cases in `computeBattle`/`assemble`/`prompt`/`aiSchema` tests to single-mode;
`aiSchema` stays permissive about an extra block by design).

## Deploy note
The edge function imports the shared `prompt`/`assemble` directly and is **MANUAL deploy**.
**DONE this session** — `versus-scan` redeployed via the Supabase CLI (`functions deploy
versus-scan --project-ref rxtlbhjysksoxkdcdqyr --no-verify-jwt`, bundles the shared `.ts`
from disk, no Docker → server-side bundler). Now **version 3, ACTIVE**; boot-probed clean
(`{}`→400 `invalid_images`, `mode:'both'`→`invalid_images`, no Gemini call). This one deploy
also carried the still-pending 06-24 result-polish metrics. Frontend push still held per
session convention.
