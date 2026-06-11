# 005 — Disable credit enforcement until the backend lands

**Date:** 2026-06-11
**Scope:** Generation credit model (`apps/web/src/state/generation.tsx`).
**Ask:** remove the credit decrease before adding the backend.

---

## What changed

Credit enforcement is now behind a single module flag, defaulted **off**, so scans
are unlimited and never consume credits or the free flag while there's no server-side
ledger. The credit UI, pricing packs, and mock checkout are left fully intact — this
is a one-line re-enable later, not a rebuild.

`apps/web/src/state/generation.tsx`:
- Added `const CREDITS_ENFORCED = false;` (commented as the backend toggle).
- `canAffordScan = !CREDITS_ENFORCED || isFree || credits > 0` → always `true` while off,
  so the "Out of scans — get credits" wall never appears.
- `runGeneration`: the `no_credits` check and the credit/`freeUsed` mutation are both
  gated on `CREDITS_ENFORCED`. While off, a generation only writes `result` — it does
  **not** decrement `credits` or set `freeUsed`.

`apps/web/src/components/analysis/ReceiptSummaryBlock.tsx`:
- "New scan · uses 1 credit" → "New scan" (the credit claim was misleading while
  scans are free).

## Behaviour now (enforcement off)

- Any number of scans, all free; `credits` and `freeUsed` never change from scanning.
- Upload CTA always shows the scan button (never the out-of-credits state).
- A fresh user keeps the "Scan my aura — free" label (since `freeUsed` is never set).

## Re-enabling with the backend

Flip `CREDITS_ENFORCED` to `true` (or, better, drive it from the server/session).
That restores: first scan free → 1 credit per scan → out-of-credits CTA → mock/real
checkout. Also restore the receipt button copy to mention the credit cost. The credit
ledger should become authoritative on the server (NestJS + Supabase), not localStorage.

## Verification

- `npm run typecheck` + `npm run build` clean.
- Playwright, seeded `freeUsed:true, credits:0` (the old "stuck" state): upload both →
  CTA "Scan my aura" → `/scan/run` → reveal → `/result`. Post-scan state:
  `credits=0` (unchanged, no negative), `freeUsed=true` (unchanged), `result` set.
