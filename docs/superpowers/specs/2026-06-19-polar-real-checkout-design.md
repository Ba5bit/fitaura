# Polar real checkout — design

**Date:** 2026-06-19
**Status:** Approved (brainstorm), pending implementation plan
**Topic:** Replace the mock client-side checkout with real Polar payments for one-time credit packs.

## Goal

Today the credit purchase is pure theater: `Pricing` → `'checkout'` scene → `pay()` runs a
2.3s timer → the **client** calls `grantCredits` directly against Supabase. For real money
this is unacceptable — the browser can never be the thing that grants credits.

Wire in **Polar** (production org) so the three existing credit packs are bought with real
money and credits are granted **server-side**, fulfilled by a verified webhook.

## Locked decisions

1. **Embedded checkout** — Polar's overlay opens *on* fitaura.studio (no full-page
   redirect), for buyer trust / on-site cohesion. The card form inside is Polar's secure
   iframe (keeps us out of PCI scope); theming is limited and that's accepted.
2. **Branded summary first** — Buy → our existing ORDER SUMMARY modal → "Pay $X" → Polar
   overlay. We keep the summary panel; we delete the fake card form.
3. **Webhook is the source of truth** for granting. The post-payment UI polls the balance
   until the webhook lands.
4. **Refunds actually subtract credits**, idempotently, **clamped at zero**.
5. **Production-only.** No sandbox. Verify with a real purchase + dashboard refund (or a
   100%-off discount code).

## Products (already created in Polar, prod)

| Pack id   | Tier        | Credits | Price   |
|-----------|-------------|---------|---------|
| `starter` | Starter     | 10      | $3.99   |
| `regular` | Regular     | 30      | $9.99   |
| `group`   | Group chat  | 80      | $14.99  |

Source of truth for credits/price: `packages/shared/src/pricing.ts` (`CREDIT_PACKS`).
Polar **product ids** are injected as secrets (below), keyed by pack id.

## Flow

```
/credits  →  [Buy N credits · $X]   (startCheckout: must be signed in)
                │
                ▼
   ORDER SUMMARY modal (branded, our UI)  →  [ Pay $X ]
                │  scene = 'processing' (brief)
                │  checkoutService.createCheckout(packId)
                ▼
        create-checkout (edge fn)
          • verify caller JWT  → real userId + email
          • packId → Polar product id (env)  + credits (CREDIT_PACKS)
          • validate Origin against allowlist → embed_origin + success_url
          • POST api.polar.sh/v1/checkouts/
              { products:[productId], external_customer_id:userId,
                customer_email, embed_origin, success_url,
                metadata:{ user_id, pack_id, credits } }   ← server-set, trusted
          • return { url }
                │  PolarEmbedCheckout.create(url)  → overlay opens on-site
                ▼
        Polar overlay  → user pays
                │
        ┌───────┴───────────────────────────────┐
        ▼ (async webhook, authoritative)         ▼ (embed 'success' event)
  polar-webhook (edge fn)                  scene = 'success'
   • verify signature (standardwebhooks)   poll getBalance() every ~1.5s,
   • order.paid  → grant RPC                 ~15s cap, until balance bumps
   • order.refunded → refund RPC           → show +N / new balance
   • 200 fast
```

## Components

### 1. `create-checkout` edge function (new)
- Conventions mirror `solo-scan`: `Deno.serve`, shared `CORS`, `json()` helper, its own
  `deno.json` with `"shared/": "../../../packages/shared/src/"`.
- **Auth:** require `Authorization: Bearer <supabase jwt>`. Verify via
  `GET ${SUPABASE_URL}/auth/v1/user` (or anon client `auth.getUser`) → real `userId` +
  `email`. Reject 401 if absent/invalid. The client cannot buy credits for another user
  because metadata is derived from the verified token, never from the request body.
- **Input:** `{ packId }`. Look up `CREDIT_PACKS` for credits; reject unknown pack (400).
- **Product map:** `POLAR_PRODUCT_<STARTER|REGULAR|GROUP>` env → product id.
- **Origin:** read request `Origin`; validate against an allowlist
  (`https://fitaura.studio`, `http://localhost:5173`). Use it for both `embed_origin` and
  the `success_url` base. Reject disallowed origins (403).
- **Polar call:** raw `fetch` `POST https://api.polar.sh/v1/checkouts/` with
  `Authorization: Bearer ${POLAR_ACCESS_TOKEN}`. Body as in the flow diagram.
  `success_url = ${origin}/credits?status=success&checkout_id={CHECKOUT_ID}`.
- **Output:** `{ ok:true, url }`. On Polar error → `{ ok:false, message }` 502.
- Logs one structured line (no PII beyond user id): pack, amount, checkout id, latency.

### 2. `polar-webhook` edge function (new)
- Public endpoint (no JWT — Polar calls it). Security is the **signature**.
- **Verify** with `npm:standardwebhooks` `Webhook(POLAR_WEBHOOK_SECRET).verify(rawBody, {
  'webhook-id', 'webhook-timestamp', 'webhook-signature' })`. Invalid → 400, no side effects.
- **Events handled:**
  - `order.paid` → read `order.metadata` `{ user_id, credits }` and `order.id`. Call
    `grant_purchase_credits`. Capture `amount` for the receipt.
  - `order.refunded` → read `order.id`. Call `refund_purchase_credits`.
  - Anything else → 200 ignore.
- **DB access:** raw `fetch` to `${SUPABASE_URL}/rest/v1/rpc/<fn>` with the auto-injected
  `SUPABASE_SERVICE_ROLE_KEY` (`apikey` + `Authorization: Bearer`). No supabase-js dep.
- Always return **200** quickly on success so Polar doesn't hammer retries; return 5xx only
  on transient DB failure (so Polar *does* retry).

### 3. Database migration (new)

```sql
create table public.credit_purchases (
  order_id    text primary key,            -- Polar order id (idempotency key)
  user_id     uuid not null references auth.users(id) on delete cascade,
  pack_id     text not null,
  credits     int  not null,
  amount      numeric,                      -- charged amount, for receipts
  status      text not null default 'paid', -- 'paid' | 'refunded'
  created_at  timestamptz not null default now(),
  refunded_at timestamptz
);

-- RLS: owner can read their own receipts; no client writes (webhook uses service role).
alter table public.credit_purchases enable row level security;
create policy "own receipts readable" on public.credit_purchases
  for select using (auth.uid() = user_id);
```

```sql
-- Atomic + idempotent grant. Returns true iff this call granted (first time for order_id).
create or replace function public.grant_purchase_credits(
  p_order_id text, p_user_id uuid, p_pack_id text, p_credits int, p_amount numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare n_inserted int;
begin
  insert into credit_purchases(order_id, user_id, pack_id, credits, amount)
  values (p_order_id, p_user_id, p_pack_id, p_credits, p_amount)
  on conflict (order_id) do nothing;
  get diagnostics n_inserted = row_count;         -- 1 = newly inserted, 0 = duplicate
  if n_inserted > 0 then
    update profiles set credits = credits + p_credits where id = p_user_id;
  end if;
  return n_inserted > 0;
end $$;
```

```sql
-- Atomic + idempotent refund. Clamps balance at 0. Returns true iff it subtracted now.
create or replace function public.refund_purchase_credits(p_order_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r credit_purchases;
begin
  select * into r from credit_purchases where order_id = p_order_id for update;
  if not found or r.status = 'refunded' then return false; end if;
  update credit_purchases set status='refunded', refunded_at=now() where order_id=p_order_id;
  update profiles set credits = greatest(credits - r.credits, 0) where id = r.user_id;
  return true;
end $$;
```

Both `security definer` so the webhook (service role) is the only writer; idempotency comes
from the unique `order_id` (grant) and the `status` guard (refund).

### 4. Frontend changes
- **New** `apps/web/src/services/checkoutService.ts`:
  `createCheckout(packId): Promise<{ url }>` via
  `supabase.functions.invoke('create-checkout', { body: { packId } })`.
- **New dep** `@polar-sh/checkout` (embed). A thin helper opens
  `PolarEmbedCheckout.create(url, theme)` and resolves on the `success` event / rejects on
  `close` without success.
- **`AccountContext`:**
  - `pay()` no longer calls `grantCredits`. New path: `scene='processing'` →
    `createCheckout(pack)` → open embed → on success `scene='success'` + start balance poll;
    on user-close `scene='checkout'`; on error `scene='failure'`.
  - `pollBalanceUntilChange(prev)`: `getBalance` every ~1.5s up to ~15s until it increases,
    then `setCredits`. (Webhook may lag the redirect/`success` event.)
  - Client-side `grantCredits` stays only for the failed-scan refund path (`refundScan`);
    its purchase use is removed. (That refund path keeps its existing concurrency caveat —
    out of scope here.)
- **`Checkout` component (`AccountModals.tsx`):** keep the **left ORDER SUMMARY** panel;
  **delete** the right `embedded` sub-state and the entire fake card form
  (`4242…`/CVC/ZIP/Country). The single action becomes **"Pay $X"** → opens the Polar embed.
- **`Processing` / `Success` / `Failure`** scenes are reused; `Failure` copy shifts from
  "card declined" (Polar owns that in-overlay) to "couldn't start checkout".
- `success_url` lands on `/credits?status=success`; on mount `/credits` reads the param,
  shows `Success`, and polls (covers the case where the embed event was missed, e.g. tab
  closed/reopened).

## Error handling

| Case | Behaviour |
|---|---|
| Not signed in on Buy | existing `startCheckout` opens auth modal |
| Unknown packId | create-checkout 400 → `Failure` ("couldn't start checkout") |
| Disallowed Origin | create-checkout 403 |
| Polar API error | create-checkout 502 → `Failure` |
| User closes overlay | back to `Checkout` scene, no charge, no grant |
| Invalid webhook signature | 400, **no** DB write |
| Duplicate `order.paid` (retry) | grant RPC no-ops (unique `order_id`), balance unchanged |
| Duplicate `order.refunded` | refund RPC no-ops (status guard) |
| Refund after credits spent | balance clamps at 0 (no negative) |
| Webhook lags the success event | Success scene polls until balance bumps; param-based recovery on reload |
| Transient DB failure in webhook | return 5xx so Polar retries |

## Security

- Access token + webhook secret + service-role key live **only** in edge secrets; never
  shipped to the client.
- `create-checkout` trusts **only** the verified JWT for `user_id`; request body supplies
  just `packId`.
- Credits/user_id in checkout `metadata` are **server-set**, so the webhook can trust them.
- `embed_origin` allowlist prevents arbitrary sites embedding our checkout.
- No card data ever touches our code or DB (Polar iframe).

## Secrets / config

Edge secrets (set via `supabase secrets set …`):
`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`,
`POLAR_PRODUCT_STARTER`, `POLAR_PRODUCT_REGULAR`, `POLAR_PRODUCT_GROUP`.
Auto-injected by Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
Frontend dep: `@polar-sh/checkout`.

## Deployment (manual — same as solo-scan)

1. Apply the migration to the linked project (`rxtlbhjysksoxkdcdqyr`).
2. `supabase secrets set` the five Polar secrets.
3. **Manual** deploy both functions (no Docker, `.ts` import extensions required):
   `supabase functions deploy create-checkout` / `… polar-webhook`.
4. In Polar (prod) → register a webhook → URL
   `https://rxtlbhjysksoxkdcdqyr.supabase.co/functions/v1/polar-webhook`, events
   `order.paid`, `order.refunded`; copy its secret into `POLAR_WEBHOOK_SECRET`.
5. Frontend ships via the normal Vercel/git path.

## Testing

- **DB:** SQL test that `grant_purchase_credits` is idempotent (second call returns false,
  balance unchanged) and `refund_purchase_credits` clamps at 0 + is idempotent.
- **Frontend:** `checkoutService` invoked with the right body; `pollBalanceUntilChange`
  stops on increase and on timeout. (Embed/Polar mocked.)
- **Manual (prod):** one real purchase → credits land → refund in dashboard → credits
  subtract (clamped). Or a 100%-off discount code for the purchase leg.

## Out of scope (v1)

- No subscriptions; no Apple-Pay-specific work (Polar's overlay handles wallets).
- No migration of the old mock receipt strings.
- No RPC-ifying the failed-scan refund path (separate concern).
- No partial refunds (treat any `order.refunded` as full claw-back of that order's credits).

## Open follow-ups

- Decide whether `/credits` should also surface the real receipt history from
  `credit_purchases` (the UI references "payment receipts" today). Likely a fast follow.
