# 003 — "Scan my aura" jumped to pricing: out-of-credits flow + mock checkout

**Date:** 2026-06-11
**Scope:** Upload CTA, landing credits/pricing, generation credit model.
**Symptom (user):** clicking "Scan my aura" jumps to the landing/pricing page.

---

## Root cause

Working as designed, but the UX was a dead end. The user had already spent the one
free generation (`freeUsed=true`, `credits=0`). The Upload CTA called
`onGenerate()`, which on `!canAffordScan` did `navigate('/#credits')` — a **silent
jump** to the landing pricing section. Worse: the pricing packs were static
(non-interactive) and there's no checkout yet, so there was **no way to obtain
credits and continue** — the user was stuck.

This is distinct from log [002](002-fix-scan-cta-confirm-gate.md) (the confirm-crop
gate). Confirmed via the user: button "goes to the landing/pricing page", real
JPG/PNG photos.

## Fix

Made the out-of-credits state explicit and closed the loop with a temporary mock
checkout.

`apps/web/src/features/upload/Upload.tsx`:
- `onGenerate()` no longer branches on credits (just photos → `/scan/run`).
- When `!canAffordScan`, the CTA renders a **distinct, labelled** button —
  **"Out of scans — get credits"** — that intentionally routes to `/#credits`. No
  more silent jump from a button that says "Scan".
- Meta line + hint clarified ("Free scan used · 1 credit per scan" / "You've used
  your free verdict. Grab a credit pack…").

`apps/web/src/features/landing/Landing.tsx`:
- Credit packs are now `<button>`s. Selecting one calls `addCredits(pack.credits)`
  then `navigate('/scan')`. The free-pill shows the live balance when > 0.
- **TEMPORARY mock checkout** — clearly commented. Grants credits client-side so the
  verdict flow is exercisable end-to-end before Stripe + the NestJS credit ledger
  exist. **Replace with a real checkout that credits server-side.**

`apps/web/src/design/components.css`:
- `button.ln-pack` reset (native button → keeps the card look) + a `.ln-pack-cta`
  "Get N credits →" line that brightens on hover/focus.

## Credit model recap (current)

- First complete generation is **free** (`freeUsed` flag in `fitaura.state`).
- Each subsequent generation consumes **1 credit** (consumed in `runGeneration`).
- 0 credits + free used → CTA becomes "Out of scans — get credits" → pricing →
  (mock) buy → back to upload with credits.

## Verification

- `npm run typecheck` + `npm run build` clean.
- Playwright, seeded stuck state (`freeUsed:true, credits:0`): upload both → CTA
  "Out of scans — get credits" → `/#credits` → click Regular pack → `credits=15`,
  back at `/scan` → CTA "Scan my aura" → click → `/scan/run`. Full loop closed.

## Follow-ups

- Replace mock checkout with Stripe; move the credit ledger server-side (NestJS +
  Supabase). The free-scan flag and credit balance should become authoritative on
  the server, not localStorage.
