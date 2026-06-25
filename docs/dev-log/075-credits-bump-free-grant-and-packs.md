# 075 — Credits: 10 free on signup + bigger packs (FvF launch promo)

**Date:** 2026-06-25
**Area:** pricing/credits, end-to-end (`packages/shared/src/pricing.ts`, web copy,
`supabase/functions/create-checkout`, `handle_new_user` DB trigger)

FvF is landing well, so we got more generous: **10 free credits on signup** (was 3) and
**more credits per pack at the same prices**.

## Packs (prices unchanged → no Polar edits)
`pricing.ts` `CREDIT_PACKS` is the single source (Landing pricing section + `/credits` page
both `.map` it; `creditsForPack` derives the granted amount from it):

| pack    | credits (was → now) | price   | per-scan |
|---------|---------------------|---------|----------|
| starter | 10 → **20**         | $3.99   | $0.20    |
| regular | 30 → **80**         | $9.99   | $0.12    |
| group   | 80 → **150**        | $14.99  | $0.10    |

Because the **prices didn't change**, the Polar products (`POLAR_PRODUCT_*` secrets) are
untouched — only the credits granted changes, and that flows from `creditsForPack` →
`create-checkout` metadata → `polar-webhook` `grant_purchase_credits`. So the only backend
move is redeploying `create-checkout` so it bundles the new `pricing.ts`.

## Free grant 3 → 10
The grant is the `on_auth_user_created` trigger → `public.handle_new_user()`, which inserted
`credits = 3` (the `profiles.credits` column default is `1`, unused for real signups).
Migration `grant_ten_credits_on_signup` recreates it to insert `10`. Applied to the live DB;
mirrored as a repo migration file (idempotent `create or replace`).

## Copy
Every "3 free credits" string → "10": Landing (hero pill, "10 credits on us", lead "ten full
verdicts", closing line, mobile bar), `/credits` chip (`AccountChrome`), Solo + Upload +
Versus upload chips/hints. `checkout.test.ts` updated to the new pack amounts (20/80/150).

## Verification + deploy
`tsc` clean; shared 73 + web 187 tests green. Live Playwright check: `/credits` shows
20/80/150 at $3.99/$9.99/$14.99 with a "10 FREE CREDITS" chip; Landing hero shows the "10
free credits" pill. **Deployed:** migration applied (grant=10, verified); `create-checkout`
redeployed (v4, `verify_jwt:true` preserved, bundles new pricing); frontend pushed to `main`
→ Vercel. `polar-webhook` needs no change (grants the metadata credits).

## Heads-up
10 free credits/signup is more cost exposure (free AI scans) and more farmable across throwaway
emails; flagged for the user as a deliberate growth trade-off. Prices/credit economics are the
user's call.
