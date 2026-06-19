# 061 — Polar real checkout (embedded, webhook-fulfilled credits)

**Date:** 2026-06-19
**Spec:** `docs/superpowers/specs/2026-06-19-polar-real-checkout-design.md`
**Plan:** `docs/superpowers/plans/2026-06-19-polar-real-checkout.md`

Replaced the mock client-side checkout with real Polar payments. This log is the
study notes: *why* each piece is shaped the way it is, not just what changed.

## The core problem: the client must never grant credits

The old flow (`AccountContext.pay`) ran a 2.3s `setTimeout`, then called
`grantCredits(userId, n)` **from the browser** straight into Supabase. For a demo
with no money that's fine. For real money it is indefensible: anyone with dev tools
can call `grantCredits` and mint unlimited credits. The whole redesign exists to move
the *granting* to a place the user can't reach.

So the credit grant now happens only inside a **webhook** that Polar calls
server-to-server, and only after Polar confirms a real payment. The browser's job
shrinks to: ask for a checkout URL, open it, then *watch* its own balance change.

## Three trust boundaries

1. **`create-checkout` edge function** — the browser calls it, but it does NOT trust
   the request body for identity. It re-verifies the caller's Supabase JWT
   (`GET /auth/v1/user`) and derives `user_id` from the verified token. The body only
   carries `packId`. This is why a user can't buy credits *for someone else*: the only
   id that reaches Polar's metadata is the one proven by their own JWT.

2. **Server-set metadata** — `create-checkout` writes `metadata: { user_id, pack_id,
   credits }` onto the Polar checkout. Because *we* set it server-side (not the client),
   the webhook can trust it later. Polar copies checkout metadata onto the resulting
   order, so `order.metadata` carries it back to us.

3. **`polar-webhook` edge function** — public endpoint, so its security is the
   **signature**, not a JWT. It verifies the Standard-Webhooks signature
   (`standardwebhooks` lib, headers `webhook-id` / `-timestamp` / `-signature`) before
   any DB write. Only then does it call the grant RPC with the **service role** key
   (which bypasses RLS) to credit an arbitrary user.

## The deploy gotcha that would have silently broken everything

Supabase edge functions default to `verify_jwt = true` — the gateway rejects any call
without a valid Supabase JWT *before your code runs*. Polar does not send a Supabase
JWT. So `polar-webhook` **must** be deployed with `--no-verify-jwt`, or every delivery
is bounced at the gateway and no credits are ever granted — with no error in your
function logs, because your code never executes. `create-checkout` keeps the default
(the browser sends a real user JWT).

## Idempotency + atomicity live in Postgres, not in the function

Webhooks retry. Networks double-deliver. If granting were a read-modify-write in JS,
two deliveries of one `order.paid` could grant twice. So granting is a single SQL
function:

```sql
insert into credit_purchases(order_id, ...) values (...) on conflict (order_id) do nothing;
get diagnostics n_inserted = row_count;
if n_inserted > 0 then update profiles set credits = credits + p_credits ...; end if;
```

The unique `order_id` is the idempotency key: the *first* delivery inserts and grants;
every retry hits the conflict, inserts nothing, grants nothing. One statement, one
transaction — no race. This is also the fix for the concurrency hole that
`creditsService.ts` itself flagged in its own comments about read-modify-write.

`refund_purchase_credits` mirrors this: it `select ... for update`, refuses if already
`refunded`, then subtracts **clamped at zero** (`greatest(credits - n, 0)`). A user who
bought 30, spent 12, then refunded ends at 0, not −18 — they keep the scans they ran,
lose the unused balance. The `status` column is the refund idempotency guard.

`credit_purchases` doubles as the real **receipts** table (the UI already talked about
"payment receipts") — surfacing that history is a parked fast-follow.

## Embedded vs redirect, and what survived the UI cull

We chose Polar's **embedded overlay** (`@polar-sh/checkout`) over a full-page redirect,
for buyer trust / staying on `fitaura.studio`. Key point learned: even embedded, the
card form is Polar's **iframe** — that's exactly what keeps us out of PCI scope. So the
gorgeous fake card form in the old `Checkout` modal (the `4242 4242…` inputs) was
deleted; it could never touch real cards anyway. What survived: the branded ORDER
SUMMARY panel (now a confirm step) and the Processing/Success/Failure scenes.
`create-checkout` must pass `embed_origin` (the page origin) or Polar refuses to embed —
hence the `isAllowedOrigin` allowlist (`fitaura.studio` + `localhost:5173`).

## Fulfillment lag → the success page polls

The webhook is asynchronous; it can land a beat after the overlay's `success` event (or
after the `success_url` redirect). So the UI does **not** assume the balance is updated.
`pollBalanceUntilChange(userId, prevBalance)` re-reads the balance (~1.5s × up to 10)
until it rises above the pre-purchase value. Two entry points use it: the in-page
`pay()` flow after the overlay reports success, and a recovery effect on
`/credits?status=success` (covers a closed/reopened tab where the overlay event was
missed). Made testable by injecting `getBalanceFn` so tests run with `intervalMs: 1`.

## One bug the tests couldn't catch

`openCheckoutOverlay` uses a dynamic `import('@polar-sh/checkout/embed')`, which is never
executed in unit tests (the overlay is browser-only). So vitest stayed green while
`PolarEmbedCheckout.create(url, 'light')` was wrong — v0.3 takes `{ theme: 'light' }`,
not a bare string. Only `tsc --noEmit` caught it. Lesson: for code paths tests can't
exercise, the type-checker is the safety net — run it before trusting green tests.

## What's deployed manually (not via git/Vercel)

Both edge functions deploy manually (`supabase functions deploy …`, no Docker, `.ts`
import extensions required — same as `solo-scan`). The migration applies via the
Supabase MCP. Secrets (`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, three
`POLAR_PRODUCT_*` ids) are edge secrets, never shipped to the client. Production-only:
verified with a real purchase + dashboard refund.
