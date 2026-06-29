# 079 — nFactorial Edition: co-brand skin + promo/entitlements gate

**Date:** 2026-06-29
**Branch:** `feat/nfactorial-edition` (not merged; nothing pushed/deployed yet)
**Area:** `supabase/migrations/2026062912*.sql`, `apps/web/src/services/entitlementsService.ts`,
`apps/web/src/features/account/AccountContext.tsx`, `apps/web/src/features/unlock/Unlock.tsx`,
`apps/web/src/features/vault/{UnlockBanner,Vault,Settings}.tsx`,
`apps/web/src/components/cards/editions/registry.ts`, `apps/web/src/components/{EditionSwitch,cards/EditionLockup}.tsx`,
`apps/web/src/design/nfactorial-skin.css`, `apps/web/src/features/result/Result.tsx`,
`apps/web/src/features/versus/{VersusResult.tsx,components/VerdictShareCard.tsx}`

Specs + plans: `docs/superpowers/specs/2026-06-29-nfactorial-edition-skin-design.md`,
`docs/superpowers/plans/2026-06-29-{promo-entitlements-gate,nfactorial-edition-skin}.md`.

A co-branded **"nFactorial Edition"** — a white+red re-tint of the result cards, unlocked
by the `NFACTORIAL2026` promo code. Built as two layers: a reusable **promo/entitlements
gate** and an **edition skin** that rides on it. Future packs (company-X, football) reuse the
gate verbatim.

## The gate (reusable infra)

Three additive, RLS-locked tables — `promo_codes`, `code_redemptions`,
`account_entitlements` — plus one atomic `SECURITY DEFINER` RPC `redeem_code(p_code)` that is
the **only** write path into redemptions/grants (clients can't insert directly; `promo_codes`
has *no* select policy, so codes can't be enumerated). Owning the key
`theme:company-nfactorial` is what unlocks the Edition.

Client mirror of the existing `creditsService` pattern: `entitlementsService.ts`
(`getEntitlements`, `redeemCode`, `normalizeCode`). `AccountContext` gains `entitlements` +
`hasEntitlement` + `redeemCode`, loaded in a **separate `useEffect` keyed on `userId`** — *not*
inside `onAuthChange`, which would deadlock the auth lock (same discipline the credit-balance
load already uses).

Surfaces: `/unlock/:code` deep-link (the social funnel; signs in then redeems), a Vault
"Have a code?" announcement, and a Settings field. **No locked teasers** — the Edition switch
simply doesn't render until the account is entitled.

### Gotcha — class collision
The planned redeem-field class `vlt-unlock` was **already live** on the `/credits` Pricing
panel. Appending bare `.vlt-unlock` rules would have reflowed it. Renamed the new field's
family to `vlt-redeem*` (internal-only; consumers use the `<UnlockBanner>` component, not the
class strings).

### Gotcha — prod-only Supabase
The MCP/CLI only reaches **production** (no dev branch). The migration is additive + inert
until the first redeem, but applying it is a **gated, explicit** step — left **unapplied** for
now (the local app talks to prod Supabase, so redeem can't round-trip locally until then).

## The skin (edition layer)

An "edition" layer *above* the existing per-card skin registry — `editions/registry.ts`
(`EDITIONS`, `entitledEditions`, `asEditionId`). nFactorial skins are deliberately **not** in
the `cs-dots` skin registry, so the Default result is byte-for-byte unchanged.

The kit (`~/Downloads/nfactorial-skin-kit`) is **reference only** — its `fc2-*`/full-bleed face
markup doesn't match the current cards. So the Edition **re-tints the real cards**: a scoped
`nfactorial-skin.css` under `[data-edition="nfactorial"]` flips the surface white and remaps
`--accent`/`--verdict` to nFactorial red, plus an `<EditionLockup>` co-brand overlay.

### Solo (`Result.tsx`)
Per-result `edition` state (`usePerCardState`). Under nFactorial: the **Dossier base** renders
(the scope only targets `.facecard`/`.outfitcard`, not the other skins, so the Edition pins
Dossier for both the visible card and the offscreen export host); the per-skin dots + receipt
paper bar hide; the receipt forces the standard `Receipt` (not `ReceiptPremium`, whose layout
the scope wouldn't catch); the export host carries `data-edition` so **downloads match**.

### FvsF (`VerdictShareCard.tsx` + `VersusResult.tsx`)
The share card is almost entirely **inline-styled**, so a CSS overlay can't re-tint it —
instead it takes an `edition` prop and overrides the palette: **winner → red, other →
charcoal** (A/B mapping preserved), with the co-brand in the top chrome. Only the share cards
change; the rest of the versus page is untouched. Per-battle `edition` state threaded through
`VerdictTab` to every render site (fan deck + offscreen export copies + mobile).

## DEV-only gate bypass (local testing)
`EditionSwitch` surfaces all editions when `import.meta.env.DEV` — so the skin is testable
locally **without** the prod migration. `DEV` is statically false in the production build, so
the real entitlement gate is preserved in prod (nothing to remove before deploy).

## Status
6 gate commits + 7 skin commits on the branch. `tsc --noEmit` clean; 213/213 web tests pass.
Pending: local visual QA + tuning, then (at deploy time) apply the migration + seed, merge,
and push. Visual fine-tuning of the re-tint (and the FvsF winner/charcoal split) is expected
to need in-browser iteration.
