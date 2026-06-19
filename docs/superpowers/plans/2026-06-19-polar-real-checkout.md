# Polar Real Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock client-side credit checkout with real Polar payments — credits are granted server-side by a signature-verified webhook, atomically and idempotently, with refunds clawing back (clamped at zero).

**Architecture:** Buy → branded ORDER SUMMARY modal → **Pay** calls a `create-checkout` edge function (verifies the user's JWT, server-sets the order metadata, returns a Polar checkout URL) → Polar's **embedded overlay** opens on fitaura.studio → on payment, a `polar-webhook` edge function verifies the signature and calls atomic Postgres RPCs that grant (`order.paid`) or claw back (`order.refunded`) credits. The browser never grants credits; the success screen polls the balance until the webhook lands.

**Tech Stack:** Supabase (Postgres + Deno edge functions, manual deploy, no Docker), Polar REST API + `@polar-sh/checkout` embed, React + vitest, `standardwebhooks` for signature verification.

**Spec:** `docs/superpowers/specs/2026-06-19-polar-real-checkout-design.md`

---

## File Structure

**Shared (single source of truth, vitest-testable):**
- Create `packages/shared/src/checkout.ts` — `ALLOWED_ORIGINS`, `isAllowedOrigin()`, `creditsForPack()`. Imported by both the edge function (via `shared/checkout.ts`) and the frontend.
- Modify `packages/shared/src/index.ts` — re-export the new module.

**Database:**
- Create `supabase/migrations/20260619120000_credit_purchases.sql` — `credit_purchases` table + `grant_purchase_credits` + `refund_purchase_credits` RPCs (also applied to the linked project via MCP).

**Edge functions (manual deploy, mirror `solo-scan` conventions):**
- Create `supabase/functions/create-checkout/deno.json`
- Create `supabase/functions/create-checkout/index.ts`
- Create `supabase/functions/polar-webhook/deno.json`
- Create `supabase/functions/polar-webhook/index.ts`

**Frontend:**
- Modify `apps/web/package.json` — add `@polar-sh/checkout`.
- Create `apps/web/src/services/checkoutService.ts` — `createCheckout()`, `openCheckoutOverlay()`, `pollBalanceUntilChange()`.
- Create `apps/web/src/services/checkoutService.test.ts`
- Create `apps/web/src/lib/checkout.test.ts` — tests the shared helpers via `@fitaura/shared`.
- Modify `apps/web/src/features/account/AccountContext.tsx` — real `pay()` flow, remove client-side grant.
- Modify `apps/web/src/features/account/AccountModals.tsx` — delete fake card form; repurpose `Failure`.
- Modify `apps/web/src/features/vault/Pricing.tsx` — `?status=success` recovery + poll.

**Docs:**
- Create `docs/dev-log/061-polar-real-checkout.md`

---

## Task 1: Shared checkout helpers

**Files:**
- Create: `packages/shared/src/checkout.ts`
- Modify: `packages/shared/src/index.ts:5`
- Test: `apps/web/src/lib/checkout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/checkout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, creditsForPack, ALLOWED_ORIGINS } from '@fitaura/shared';

describe('isAllowedOrigin', () => {
  it('accepts the production and local-dev origins', () => {
    expect(isAllowedOrigin('https://fitaura.studio')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });
  it('rejects anything else and nullish input', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('http://fitaura.studio')).toBe(false); // wrong scheme
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
  it('exposes the allowlist', () => {
    expect(ALLOWED_ORIGINS).toContain('https://fitaura.studio');
  });
});

describe('creditsForPack', () => {
  it('returns the credit count for a known pack', () => {
    expect(creditsForPack('starter')).toBe(10);
    expect(creditsForPack('regular')).toBe(30);
    expect(creditsForPack('group')).toBe(80);
  });
  it('returns undefined for an unknown pack', () => {
    expect(creditsForPack('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @fitaura/web -- checkout`
Expected: FAIL — `isAllowedOrigin`/`creditsForPack`/`ALLOWED_ORIGINS` are not exported from `@fitaura/shared`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/checkout.ts`:

```ts
import { CREDIT_PACKS } from './pricing';

/** Origins allowed to open the embedded Polar checkout (used as embed_origin). */
export const ALLOWED_ORIGINS = ['https://fitaura.studio', 'http://localhost:5173'] as const;

/** True if `origin` is an exact match for an allowed origin. */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  return !!origin && (ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

/** Credit count for a pack id, or undefined if the id is unknown. */
export function creditsForPack(packId: string): number | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId)?.credits;
}
```

Modify `packages/shared/src/index.ts` — add the re-export after the existing lines:

```ts
export * from './verdict';
export * from './result';
export * from './sticker-bank';
export * from './pricing';
export * from './solo-scan';
export * from './checkout';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace @fitaura/web -- checkout`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/checkout.ts packages/shared/src/index.ts apps/web/src/lib/checkout.test.ts
git commit -m "feat(shared): checkout origin allowlist + creditsForPack helpers"
```

---

## Task 2: Database — credit_purchases table + grant/refund RPCs

**Files:**
- Create: `supabase/migrations/20260619120000_credit_purchases.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260619120000_credit_purchases.sql`:

```sql
-- Real Polar purchases: one row per Polar order. Idempotency key = order_id.
-- Doubles as the user's payment-receipt history.
create table if not exists public.credit_purchases (
  order_id    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  pack_id     text not null,
  credits     int  not null,
  amount      numeric,
  status      text not null default 'paid',  -- 'paid' | 'refunded'
  created_at  timestamptz not null default now(),
  refunded_at timestamptz
);

alter table public.credit_purchases enable row level security;

-- Owner may read their own receipts. No client writes: the webhook uses the
-- service role, which bypasses RLS, so no insert/update policy is defined.
drop policy if exists "own receipts readable" on public.credit_purchases;
create policy "own receipts readable" on public.credit_purchases
  for select using (auth.uid() = user_id);

-- Atomic + idempotent grant. Returns true iff THIS call granted (first time
-- for order_id); duplicate webhook deliveries return false and change nothing.
create or replace function public.grant_purchase_credits(
  p_order_id text, p_user_id uuid, p_pack_id text, p_credits int, p_amount numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare n_inserted int;
begin
  insert into credit_purchases(order_id, user_id, pack_id, credits, amount)
  values (p_order_id, p_user_id, p_pack_id, p_credits, p_amount)
  on conflict (order_id) do nothing;
  get diagnostics n_inserted = row_count;          -- 1 = inserted, 0 = duplicate
  if n_inserted > 0 then
    update profiles set credits = credits + p_credits where id = p_user_id;
  end if;
  return n_inserted > 0;
end $$;

-- Atomic + idempotent refund. Subtracts the order's credits, clamped at 0.
-- Returns true iff THIS call performed the claw-back.
create or replace function public.refund_purchase_credits(p_order_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r credit_purchases;
begin
  select * into r from credit_purchases where order_id = p_order_id for update;
  if not found or r.status = 'refunded' then return false; end if;
  update credit_purchases set status = 'refunded', refunded_at = now()
    where order_id = p_order_id;
  update profiles set credits = greatest(credits - r.credits, 0) where id = r.user_id;
  return true;
end $$;
```

- [ ] **Step 2: Apply the migration to the linked project**

Use the Supabase MCP tool `apply_migration` with `name: "credit_purchases"` and the SQL above (the whole file contents).
Expected: success, no error. Then confirm with MCP `list_tables` that `credit_purchases` exists.

- [ ] **Step 3: Verify idempotency + clamp (safe, rolls back)**

Replace `<USER_ID>` with your own `auth.users` id (get it via MCP `execute_sql`: `select id from auth.users limit 1;`). Run this whole block via MCP `execute_sql` — it ends in `rollback`, so nothing persists:

```sql
begin;
  update profiles set credits = 5 where id = '<USER_ID>';
  select grant_purchase_credits('test_order_1','<USER_ID>','starter',10,3.99) as granted_first; -- t
  select credits as after_grant from profiles where id = '<USER_ID>';                            -- 15
  select grant_purchase_credits('test_order_1','<USER_ID>','starter',10,3.99) as granted_dup;   -- f
  select credits as after_dup from profiles where id = '<USER_ID>';                              -- 15
  update profiles set credits = 3 where id = '<USER_ID>';   -- simulate spending down
  select refund_purchase_credits('test_order_1') as refunded;      -- t
  select credits as after_refund from profiles where id = '<USER_ID>';   -- 0 (greatest(3-10,0))
  select refund_purchase_credits('test_order_1') as refunded_dup; -- f
rollback;
```

Expected: `granted_first=t`, `after_grant=15`, `granted_dup=f`, `after_dup=15`, `refunded=t`, `after_refund=0`, `refunded_dup=f`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260619120000_credit_purchases.sql
git commit -m "feat(db): credit_purchases + atomic idempotent grant/refund RPCs"
```

---

## Task 3: `create-checkout` edge function

**Files:**
- Create: `supabase/functions/create-checkout/deno.json`
- Create: `supabase/functions/create-checkout/index.ts`

- [ ] **Step 1: Write the deno import map**

Create `supabase/functions/create-checkout/deno.json`:

```json
{
  "imports": {
    "shared/": "../../../packages/shared/src/"
  }
}
```

- [ ] **Step 2: Write the function**

Create `supabase/functions/create-checkout/index.ts`:

```ts
// supabase/functions/create-checkout/index.ts
import { creditsForPack, isAllowedOrigin } from 'shared/checkout.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const PRODUCT_ENV: Record<string, string> = {
  starter: 'POLAR_PRODUCT_STARTER',
  regular: 'POLAR_PRODUCT_REGULAR',
  group: 'POLAR_PRODUCT_GROUP',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, message: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const POLAR_TOKEN = Deno.env.get('POLAR_ACCESS_TOKEN');
  if (!POLAR_TOKEN) return json({ ok: false, message: 'missing_polar_token' }, 500);

  // 1. Origin allowlist (also used as embed_origin + success_url base).
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) return json({ ok: false, message: 'forbidden_origin' }, 403);

  // 2. Verify the caller's Supabase JWT → real user id + email.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: ANON },
  });
  if (!userRes.ok) return json({ ok: false, message: 'unauthorized' }, 401);
  const user = await userRes.json() as { id: string; email?: string };

  // 3. Resolve pack → credits + Polar product id.
  let body: { packId?: string };
  try { body = await req.json(); } catch { return json({ ok: false, message: 'bad_request' }, 400); }
  const packId = body.packId ?? '';
  const credits = creditsForPack(packId);
  const productEnv = PRODUCT_ENV[packId];
  if (credits === undefined || !productEnv) return json({ ok: false, message: 'unknown_pack' }, 400);
  const productId = Deno.env.get(productEnv);
  if (!productId) return json({ ok: false, message: 'missing_product_id' }, 500);

  // 4. Create the Polar checkout (metadata is server-set → trusted by the webhook).
  const success_url = `${origin}/credits?status=success&checkout_id={CHECKOUT_ID}`;
  const res = await fetch('https://api.polar.sh/v1/checkouts/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${POLAR_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      products: [productId],
      external_customer_id: user.id,
      customer_email: user.email,
      embed_origin: origin,
      success_url,
      metadata: { user_id: user.id, pack_id: packId, credits },
    }),
  });
  if (!res.ok) {
    console.log(JSON.stringify({ fn: 'create-checkout', success: false, status: res.status, pack: packId }));
    return json({ ok: false, message: 'polar_error' }, 502);
  }
  const checkout = await res.json() as { id: string; url: string };
  console.log(JSON.stringify({ fn: 'create-checkout', success: true, user: user.id, pack: packId, checkout_id: checkout.id }));
  return json({ ok: true, url: checkout.url });
});
```

- [ ] **Step 3: Commit**

The pure helpers (`isAllowedOrigin`, `creditsForPack`) are already unit-tested in Task 1; the HTTP orchestration is verified end-to-end in Task 9 (no Deno test runner in this repo, matching the `solo-scan` convention).

```bash
git add supabase/functions/create-checkout/
git commit -m "feat(edge): create-checkout — JWT-verified Polar checkout session"
```

---

## Task 4: `polar-webhook` edge function

**Files:**
- Create: `supabase/functions/polar-webhook/deno.json`
- Create: `supabase/functions/polar-webhook/index.ts`

- [ ] **Step 1: Write the deno import map**

Create `supabase/functions/polar-webhook/deno.json`:

```json
{
  "imports": {
    "standardwebhooks": "npm:standardwebhooks@^1.0.0"
  }
}
```

- [ ] **Step 2: Write the function**

Create `supabase/functions/polar-webhook/index.ts`:

```ts
// supabase/functions/polar-webhook/index.ts
import { Webhook } from 'standardwebhooks';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('POLAR_WEBHOOK_SECRET')!;

/** Call a Postgres RPC with the service role (bypasses RLS). Returns the JSON body. */
async function rpc(fn: string, args: Record<string, unknown>): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(args),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  const raw = await req.text();

  // 1. Verify the Standard-Webhooks signature. Invalid → 400, no side effects.
  try {
    new Webhook(WEBHOOK_SECRET).verify(raw, {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    });
  } catch {
    return new Response('invalid_signature', { status: 400 });
  }

  const event = JSON.parse(raw) as { type: string; data: any };

  try {
    if (event.type === 'order.paid') {
      const order = event.data;
      const m = order.metadata ?? {};
      const amount = (order.total_amount ?? order.amount ?? 0) / 100;
      const res = await rpc('grant_purchase_credits', {
        p_order_id: order.id,
        p_user_id: m.user_id,
        p_pack_id: m.pack_id,
        p_credits: Number(m.credits),
        p_amount: amount,
      });
      if (!res.ok) return new Response('grant_failed', { status: 500 }); // Polar will retry
      const granted = await res.json();
      console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, order: order.id, granted }));
    } else if (event.type === 'order.refunded') {
      const order = event.data;
      const res = await rpc('refund_purchase_credits', { p_order_id: order.id });
      if (!res.ok) return new Response('refund_failed', { status: 500 });
      const refunded = await res.json();
      console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, order: order.id, refunded }));
    }
    // Any other event: acknowledged, ignored.
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, error: String(e) }));
    return new Response('error', { status: 500 });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/polar-webhook/
git commit -m "feat(edge): polar-webhook — verified order.paid grant + order.refunded clawback"
```

---

## Task 5: Frontend checkout service

**Files:**
- Modify: `apps/web/package.json:14-23` (dependencies)
- Create: `apps/web/src/services/checkoutService.ts`
- Test: `apps/web/src/services/checkoutService.test.ts`

- [ ] **Step 1: Add the embed dependency**

Run: `npm install @polar-sh/checkout --workspace @fitaura/web`
Expected: `@polar-sh/checkout` appears under `dependencies` in `apps/web/package.json`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/services/checkoutService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke } } }));

import { createCheckout, pollBalanceUntilChange } from './checkoutService';

beforeEach(() => invoke.mockReset());

describe('createCheckout', () => {
  it('invokes the edge function with the packId and returns the url', async () => {
    invoke.mockResolvedValue({ data: { ok: true, url: 'https://polar/c/abc' }, error: null });
    const url = await createCheckout('regular');
    expect(invoke).toHaveBeenCalledWith('create-checkout', { body: { packId: 'regular' } });
    expect(url).toBe('https://polar/c/abc');
  });

  it('throws when the edge function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(createCheckout('regular')).rejects.toThrow();
  });

  it('throws when the payload is not ok', async () => {
    invoke.mockResolvedValue({ data: { ok: false, message: 'unknown_pack' }, error: null });
    await expect(createCheckout('regular')).rejects.toThrow();
  });
});

describe('pollBalanceUntilChange', () => {
  it('returns immediately when the balance is already higher', async () => {
    const getBalanceFn = vi.fn().mockResolvedValue(15);
    const next = await pollBalanceUntilChange('u1', 5, { getBalanceFn, intervalMs: 1 });
    expect(next).toBe(15);
    expect(getBalanceFn).toHaveBeenCalledTimes(1);
  });

  it('polls until the balance increases', async () => {
    const getBalanceFn = vi.fn()
      .mockResolvedValueOnce(5).mockResolvedValueOnce(5).mockResolvedValueOnce(35);
    const next = await pollBalanceUntilChange('u1', 5, { getBalanceFn, intervalMs: 1 });
    expect(next).toBe(35);
    expect(getBalanceFn).toHaveBeenCalledTimes(3);
  });

  it('returns the last reading after exhausting attempts', async () => {
    const getBalanceFn = vi.fn().mockResolvedValue(5);
    const next = await pollBalanceUntilChange('u1', 5, { getBalanceFn, attempts: 3, intervalMs: 1 });
    expect(next).toBe(5);
    expect(getBalanceFn).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test --workspace @fitaura/web -- checkoutService`
Expected: FAIL — `./checkoutService` does not exist.

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/services/checkoutService.ts`:

```ts
import { supabase } from '../lib/supabase';
import { getBalance } from './creditsService';

/** Create a Polar checkout for a pack via the edge function. Returns the checkout URL. */
export async function createCheckout(packId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: { packId } });
  if (error) throw new Error(error.message ?? 'checkout_failed');
  if (!data?.ok || !data.url) throw new Error(data?.message ?? 'checkout_failed');
  return data.url as string;
}

/** Open Polar's embedded checkout overlay on-site. Resolves when it closes. */
export async function openCheckoutOverlay(url: string): Promise<'success' | 'closed'> {
  const { PolarEmbedCheckout } = await import('@polar-sh/checkout/embed');
  const checkout = await PolarEmbedCheckout.create(url, 'light');
  return new Promise((resolve) => {
    let succeeded = false;
    checkout.addEventListener('success', () => { succeeded = true; resolve('success'); });
    checkout.addEventListener('close', () => { if (!succeeded) resolve('closed'); });
  });
}

interface PollOpts {
  attempts?: number;
  intervalMs?: number;
  getBalanceFn?: (userId: string) => Promise<number>;
}

/** Poll the balance until it rises above `prev` (webhook fulfillment lags the redirect). */
export async function pollBalanceUntilChange(userId: string, prev: number, opts: PollOpts = {}): Promise<number> {
  const { attempts = 10, intervalMs = 1500, getBalanceFn = getBalance } = opts;
  let last = prev;
  for (let i = 0; i < attempts; i++) {
    last = await getBalanceFn(userId);
    if (last > prev) return last;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace @fitaura/web -- checkoutService`
Expected: PASS (all 6 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/services/checkoutService.ts apps/web/src/services/checkoutService.test.ts
git commit -m "feat(web): checkout service — createCheckout, embed overlay, balance polling"
```

---

## Task 6: Wire AccountContext to the real checkout

**Files:**
- Modify: `apps/web/src/features/account/AccountContext.tsx`

- [ ] **Step 1: Add the import**

In `apps/web/src/features/account/AccountContext.tsx`, change the existing credits-service import (line 8) and add the checkout service below it:

```ts
import { getBalance, grantCredits, refundCredit, spendCredit } from '../../services/creditsService';
import { createCheckout, openCheckoutOverlay, pollBalanceUntilChange } from '../../services/checkoutService';
```

(`grantCredits` stays — it is still used by the failed-scan refund path.)

- [ ] **Step 2: Replace the mock `pay()` with the real flow**

Replace the entire `pay` callback (currently `apps/web/src/features/account/AccountContext.tsx:349-362`) with:

```ts
  // Real Polar checkout: create session → open embedded overlay → on success,
  // poll the server balance until the webhook has granted the credits.
  const pay = useCallback(async () => {
    if (!userId) return;
    const packCredits = CREDIT_PACKS.find((p) => p.id === pack)?.credits ?? 0;
    setScene('processing');
    try {
      const url = await createCheckout(pack);
      const outcome = await openCheckoutOverlay(url);
      if (outcome !== 'success') {
        setScene('checkout'); // user closed the overlay without paying
        return;
      }
      setLastPurchaseCredits(packCredits);
      setScene('success');
      const next = await pollBalanceUntilChange(userId, credits);
      setCredits(next);
      flash('Credits added to your account.');
    } catch {
      setScene('failure');
    }
  }, [userId, pack, credits, flash]);
```

Then **remove the now-unused `procTimer` ref** (declared at `apps/web/src/features/account/AccountContext.tsx:119`: `const procTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`). It was only referenced by the old mock `pay`; leaving it would fail `tsc --noEmit` if `noUnusedLocals` is enabled. Delete that one line.

- [ ] **Step 3: Verify typecheck + existing tests pass**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors.
Run: `npm test --workspace @fitaura/web`
Expected: PASS (no regressions; `pay` has no unit test — it is verified end-to-end in Task 9).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/account/AccountContext.tsx
git commit -m "feat(web): AccountContext pay() drives real Polar checkout + balance poll"
```

---

## Task 7: Delete the fake card form; repurpose Failure

**Files:**
- Modify: `apps/web/src/features/account/AccountModals.tsx:209-323` (Checkout)
- Modify: `apps/web/src/features/account/AccountModals.tsx:414-438` (PayFailure)

- [ ] **Step 1: Replace the `Checkout` component**

Replace the entire `Checkout` function (`apps/web/src/features/account/AccountModals.tsx:209-323`) with the summary-only version below. It keeps the branded ORDER SUMMARY and a single **Pay** button that calls `pay()` (which now opens the Polar overlay). The fake card form and the `embedded` state are removed.

```tsx
/* ============================ CHECKOUT (order summary → Polar overlay) ============================ */
export function Checkout() {
  const { pack, pay, closeScene } = useAccount();
  const p = packById(pack);

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-checkout">
        {/* LEFT — order summary */}
        <div className="aw-checkout-left">
          <span className="aw-eyebrow accent">ORDER SUMMARY</span>
          <div
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: '44px',
              color: '#fff',
              lineHeight: 0.9,
              marginTop: '14px',
              textTransform: 'uppercase',
            }}
          >
            {p.credits} CREDITS
          </div>
          <div className="aw-summary">
            <div className="row"><span className="k">Pack</span><span className="v">{p.credits} credits</span></div>
            <div className="row"><span className="k">Billing</span><span className="v">One-time</span></div>
            <div className="row total"><span className="k">Total today</span><span className="v">{p.price}</span></div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <span className="aw-tag server"><Icon.receipt /> Receipt saved to your account</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '22px' }}>
            <div className="aw-securebar">
              <Icon.shield /> Secured by Polar · PCI-compliant · Fitaura never sees your card
            </div>
          </div>
        </div>

        {/* RIGHT — confirm + open Polar overlay */}
        <div className="aw-checkout-right" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="aw-eyebrow accent">REVIEW & CONFIRM</span>
          <h2 className="aw-modal-title" style={{ fontSize: '26px' }}>CONFIRM PURCHASE</h2>
          <p className="aw-modal-sub">
            Payment opens securely on this page, powered by our payment partner. You won't leave Fitaura.
          </p>
          <button className="aw-btn primary block" style={{ marginTop: 'auto' }} onClick={() => void pay()}>
            <Icon.lock /> Pay {p.price}
          </button>
          <div className="aw-fineprint">
            One-time charge. Credits are added to your account once payment is confirmed.
          </div>
        </div>
      </div>
    </WebModal>
  );
}
```

- [ ] **Step 2: Repurpose `PayFailure` copy (card-decline → couldn't-start)**

In `PayFailure` (`apps/web/src/features/account/AccountModals.tsx:414-438`), replace the `<h2>` + `<p>` so it no longer claims a card decline (Polar owns that inside the overlay):

```tsx
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          CHECKOUT DIDN'T START
        </h2>
        <p className="aw-modal-sub">
          We couldn't open the payment window just now. <b style={{ color: 'var(--ink)' }}>You haven't been
          charged.</b> Please try again.
        </p>
```

Leave the two buttons (`Try again` → `startCheckout()`, and `closeScene`) unchanged.

- [ ] **Step 3: Verify typecheck + build**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors (no remaining references to the removed `embedded` state or the deleted inputs).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/account/AccountModals.tsx
git commit -m "feat(web): drop fake card form; checkout opens Polar overlay; failure copy"
```

---

## Task 8: `/credits?status=success` recovery + poll

**Files:**
- Modify: `apps/web/src/features/vault/Pricing.tsx`

This covers the case where the user lands back on `/credits` (Polar's `success_url`) without the in-page `success` event firing (e.g. tab was closed/reopened): detect the param, show the success toast, and poll the balance.

- [ ] **Step 1: Add the recovery effect**

In `apps/web/src/features/vault/Pricing.tsx`, add imports at the top:

```tsx
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
```

`Pricing` does not call `pollBalanceUntilChange` directly — it goes through a context helper so the balance state stays owned by `AccountContext`. In `AccountContext.tsx` (which already imports `pollBalanceUntilChange` from Task 6), expose a `refreshBalanceAfterPurchase` callback and add it to the context value:

```ts
  const refreshBalanceAfterPurchase = useCallback(async () => {
    if (!userId) return;
    const next = await pollBalanceUntilChange(userId, credits);
    setCredits(next);
    flash('Credits added to your account.');
  }, [userId, credits, flash]);
```

Add `refreshBalanceAfterPurchase: () => Promise<void>;` to the `AccountContextValue` interface, include it in the `value` object and its dependency array.

- [ ] **Step 2: Consume it in `Pricing`**

Inside the `Pricing` component, after the existing `useAccount()` destructure (add `userId` and `refreshBalanceAfterPurchase` to it):

```tsx
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('status') === 'success' && userId) {
      void refreshBalanceAfterPurchase();
      params.delete('status');
      params.delete('checkout_id');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
```

- [ ] **Step 3: Verify typecheck + tests**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors.
Run: `npm test --workspace @fitaura/web`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/vault/Pricing.tsx apps/web/src/features/account/AccountContext.tsx
git commit -m "feat(web): /credits success-redirect recovery polls the balance"
```

---

## Task 9: Deploy + manual end-to-end verification (production)

**Files:** none (deploy + dashboard config).

This is the only place the real Polar/webhook integration is exercised. Do it on the deployed site (embed_origin must match `https://fitaura.studio`).

- [ ] **Step 1: Set edge secrets**

```bash
supabase secrets set \
  POLAR_ACCESS_TOKEN=polar_oat_xxx \
  POLAR_PRODUCT_STARTER=<starter product id> \
  POLAR_PRODUCT_REGULAR=<regular product id> \
  POLAR_PRODUCT_GROUP=<group product id>
```

(Set `POLAR_WEBHOOK_SECRET` in Step 3 after creating the webhook.)

- [ ] **Step 2: Deploy both functions (manual, no Docker — `.ts` import extensions required)**

```bash
supabase functions deploy create-checkout
supabase functions deploy polar-webhook --no-verify-jwt
```

**Critical:** `polar-webhook` MUST be deployed with `--no-verify-jwt` — Polar does not send a Supabase JWT, so the gateway would otherwise reject every delivery. Security for that function comes from the signature check, not the gateway.

- [ ] **Step 3: Register the Polar webhook**

In Polar (production org) → Settings → Webhooks → Add endpoint:
- URL: `https://rxtlbhjysksoxkdcdqyr.supabase.co/functions/v1/polar-webhook`
- Events: `order.paid`, `order.refunded`
- Copy the signing secret, then: `supabase secrets set POLAR_WEBHOOK_SECRET=<secret>`
- Re-deploy the webhook so it picks up the secret if it was set after deploy:
  `supabase functions deploy polar-webhook --no-verify-jwt`

- [ ] **Step 4: Confirm the product ids**

Get the three product ids (Polar → Products → each product → copy id) and confirm they were set in Step 1. Starter=$3.99/10cr, Regular=$9.99/30cr, Group=$14.99/80cr.

- [ ] **Step 5: Live purchase test**

On `https://fitaura.studio/credits`, signed in: select a pack → **Buy** → **Pay** → Polar overlay opens **on-site** → complete payment with a real card (or a 100%-off discount code). Expected:
- Overlay closes, Success scene shows, balance rises by the pack's credits within ~15s.
- MCP `execute_sql`: `select * from credit_purchases order by created_at desc limit 1;` shows the order, `status='paid'`.
- Edge logs (MCP `get_logs` / dashboard) show `polar-webhook … granted: true`.

- [ ] **Step 6: Live refund test**

In Polar dashboard → that order → Refund. Expected:
- `polar-webhook … refunded: true` in logs; `credit_purchases.status='refunded'`.
- `profiles.credits` decreased by the pack amount, clamped at 0 if it had been spent down.

- [ ] **Step 7: Commit any config files touched**

If a `supabase/config.toml` was created/edited to persist `verify_jwt = false` for `polar-webhook`, commit it:

```bash
git add supabase/config.toml
git commit -m "chore(supabase): polar-webhook verify_jwt=false"
```

---

## Task 10: Dev-log

**Files:**
- Create: `docs/dev-log/061-polar-real-checkout.md`

- [ ] **Step 1: Write the dev-log**

Create `docs/dev-log/061-polar-real-checkout.md` — a study-oriented log (per project convention) covering: why client-side granting was unsafe; the create-checkout / webhook / RPC split; why metadata is server-set; idempotency via unique `order_id`; refund clamp at zero; the `--no-verify-jwt` gotcha for the webhook; embedded overlay vs redirect decision.

- [ ] **Step 2: Commit**

```bash
git add docs/dev-log/061-polar-real-checkout.md
git commit -m "docs(dev-log): 061 — Polar real checkout"
```

---

## Notes for the executor

- **Push is held** by default (project rule: hold pushes during iterative sessions until the user says otherwise). Commit locally; do not `git push` unless asked.
- **No Deno test runner** in this repo — edge-function logic that matters (origin allowlist, credits lookup) lives in `packages/shared` and is vitest-tested (Task 1); the HTTP/Polar/webhook paths are verified end-to-end (Task 9), matching the existing `solo-scan` convention.
- **Polar field names** (`order.total_amount`, `order.metadata`, checkout `url`, webhook headers `webhook-id/-timestamp/-signature`) follow Polar's current API; if a field is absent at runtime, check the webhook log payload and adjust the single read site.
- **Amounts** from Polar are in minor units (cents); the webhook divides by 100 for the receipt `amount`.
```
