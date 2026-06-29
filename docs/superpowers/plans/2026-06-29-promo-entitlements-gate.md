# Promo / Entitlements Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in account redeem a promo code (`NFACTORIAL2026`) and receive a permanent per-account entitlement (`theme:company-nfactorial`) that the rest of the app can gate features on.

**Architecture:** Three additive, RLS-locked Postgres tables (`promo_codes`, `code_redemptions`, `account_entitlements`) and one atomic `SECURITY DEFINER` RPC `redeem_code(p_code)`. A client `entitlementsService` (mirroring `creditsService`/`preferencesService`) exposes `getEntitlements` + `redeemCode`; `AccountContext` loads entitlements after sign-in and exposes `hasEntitlement(key)` + `redeemCode(code)`. Three surfaces reach the RPC: a `/unlock/:code` deep-link, a Settings "Have a code?" field, and a Vault announcement banner.

**Tech Stack:** Supabase (Postgres + RLS + RPC), React + TypeScript, react-router-dom v6, Vitest.

This plan is the **dependency** of `2026-06-29-nfactorial-edition-skin.md` (the skin's Edition switch consumes `hasEntitlement`). Build this one first.

---

## Spec reference
`docs/superpowers/specs/2026-06-29-nfactorial-edition-skin-design.md` §5, §6, §9.

## Conventions discovered (follow these)
- Migrations: plain SQL in `supabase/migrations/<UTCstamp>_<name>.sql`. RLS uses `auth.uid() = <owner col>`. `SECURITY DEFINER` functions set `search_path to ''` and fully-qualify `public.*` (see `20260625120000_grant_ten_credits_on_signup.sql`).
- `profiles.id` **is** `auth.uid()` (the user id). Existing owner-only RLS pattern lives on `profiles`.
- Client data access goes through `getSupabase()` (lazy dynamic import) — see `apps/web/src/lib/supabase.ts`. Services are thin async functions (see `creditsService.ts`).
- `AccountContext` loads per-account server state (credits) in a `useEffect` keyed on `userId` — **never inside `onAuthChange`** (auth-lock deadlock; comment at `AccountContext.tsx:156-162`).
- Tests are Vitest, colocated `*.test.ts`. Run from the web workspace.

## Test commands (exact)
- Single file: `cd "apps/web" && npx vitest run src/<path>.test.ts`
- All web tests: `npm run test --workspace @fitaura/web`
- Typecheck: `npm run typecheck --workspace @fitaura/web`

## ⚠️ Production database caveat (read before Task 7)
The Supabase MCP/CLI for this project **only reaches production** — there is no dev branch. The migration in Task 1 is **additive and inert** (no existing row reads it) until someone redeems. Applying it (Task 7) is a **discrete, explicitly-approved step** — do not apply it as a side effect of any earlier task. All client code (Tasks 3–6) is written to typecheck and unit-test **without** the tables existing, by using a local types module + a narrow cast (Task 3), so nothing here depends on touching prod until Task 7.

---

## File structure

**Create**
- `supabase/migrations/20260629120000_promo_entitlements.sql` — tables + RLS + `redeem_code` RPC.
- `supabase/migrations/20260629120100_seed_nfactorial2026.sql` — seed the campaign code.
- `apps/web/src/services/entitlementsService.ts` — `normalizeCode`, `getEntitlements`, `redeemCode`, types.
- `apps/web/src/services/entitlementsService.test.ts` — unit tests (mocked Supabase).
- `apps/web/src/features/unlock/Unlock.tsx` — the `/unlock/:code` redeem screen.
- `apps/web/src/features/vault/UnlockBanner.tsx` — the Vault announcement + inline code field.

**Modify**
- `apps/web/src/features/account/AccountContext.tsx` — entitlements state + `hasEntitlement` + `redeemCode`.
- `apps/web/src/App.tsx` — add `/unlock/:code` route.
- `apps/web/src/features/vault/Settings.tsx` — "Have a code?" panel.
- `apps/web/src/features/vault/Vault.tsx` — render `<UnlockBanner />`.

---

## Task 1: Database migration — tables, RLS, RPC

**Files:**
- Create: `supabase/migrations/20260629120000_promo_entitlements.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Promo codes → permanent per-account entitlements. Additive + RLS-locked; inert
-- until a code is redeemed. Mirrors the owner-only RLS already on profiles.
--
--   promo_codes         — campaign codes; each grants a set of entitlement keys.
--                         NO select policy → codes can't be enumerated by clients.
--   code_redemptions    — one row per (code, user); unique() blocks double-redeem.
--   account_entitlements— the permanent grants; owner-only read, NO client writes.
--
-- redeem_code(p_code) is the ONLY write path into redemptions/entitlements
-- (SECURITY DEFINER, atomic). Clients can never insert directly.

-- ---- tables -------------------------------------------------------------
create table if not exists public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                 -- stored normalized (UPPER, trimmed)
  entitlements      text[] not null default '{}',
  max_redemptions   integer,                              -- null = unlimited
  redemptions_count integer not null default 0,
  expires_at        timestamptz,                          -- null = no expiry
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists public.code_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code_id    uuid not null references public.promo_codes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);

create table if not exists public.account_entitlements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  entitlement text not null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, entitlement)
);

-- ---- RLS ----------------------------------------------------------------
alter table public.promo_codes          enable row level security;
alter table public.code_redemptions     enable row level security;
alter table public.account_entitlements enable row level security;

-- promo_codes: NO policies at all → not selectable/insertable by clients
-- (the SECURITY DEFINER RPC bypasses RLS to read/update it).

-- code_redemptions: owner may read their own rows; no client writes.
drop policy if exists code_redemptions_select_own on public.code_redemptions;
create policy code_redemptions_select_own on public.code_redemptions
  for select using (auth.uid() = user_id);

-- account_entitlements: owner may read their own grants; no client writes.
drop policy if exists account_entitlements_select_own on public.account_entitlements;
create policy account_entitlements_select_own on public.account_entitlements
  for select using (auth.uid() = user_id);

-- ---- redeem RPC ---------------------------------------------------------
-- Atomic: validate → per-user dedupe → record redemption, bump counter, grant.
-- Returns { status, entitlements } where status is one of:
--   ok | already_owned | invalid | expired | exhausted | unauthenticated
create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid   uuid := auth.uid();
  v_code  public.promo_codes%rowtype;
  v_norm  text := upper(trim(coalesce(p_code, '')));
  v_ent   text;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select * into v_code from public.promo_codes
    where code = v_norm and active = true
    for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  -- Already redeemed by this user → friendly idempotent success.
  if exists (select 1 from public.code_redemptions
               where code_id = v_code.id and user_id = v_uid) then
    return jsonb_build_object('status', 'already_owned', 'entitlements', v_code.entitlements);
  end if;

  if v_code.max_redemptions is not null
     and v_code.redemptions_count >= v_code.max_redemptions then
    return jsonb_build_object('status', 'exhausted');
  end if;

  insert into public.code_redemptions (code_id, user_id) values (v_code.id, v_uid);
  update public.promo_codes set redemptions_count = redemptions_count + 1
    where id = v_code.id;

  foreach v_ent in array v_code.entitlements loop
    insert into public.account_entitlements (user_id, entitlement)
      values (v_uid, v_ent)
      on conflict (user_id, entitlement) do nothing;
  end loop;

  return jsonb_build_object('status', 'ok', 'entitlements', v_code.entitlements);
end;
$function$;

revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;
```

- [ ] **Step 2: Lint the SQL by eye**

Confirm: every table has `enable row level security`; `promo_codes` has **no** policy; `redeem_code` is `security definer` + `set search_path to ''` + fully-qualified `public.*`; `grant execute ... to authenticated` only. (No automated runner — SQL is verified by review here and by the smoke in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260629120000_promo_entitlements.sql
git commit -m "feat(db): promo_codes + entitlements tables + redeem_code RPC (not yet applied)"
```

---

## Task 2: Seed migration — NFACTORIAL2026

**Files:**
- Create: `supabase/migrations/20260629120100_seed_nfactorial2026.sql`

- [ ] **Step 1: Write the seed**

```sql
-- Campaign code for the nFactorial Edition drop. Idempotent: re-running only
-- refreshes the grant set / window, never resets redemptions_count.
-- Adjust expires_at to the real event window before applying.
insert into public.promo_codes (code, entitlements, max_redemptions, expires_at, active)
values ('NFACTORIAL2026', array['theme:company-nfactorial'], null,
        timestamptz '2026-12-31 23:59:59+00', true)
on conflict (code) do update
  set entitlements = excluded.entitlements,
      expires_at   = excluded.expires_at,
      active       = excluded.active;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260629120100_seed_nfactorial2026.sql
git commit -m "feat(db): seed NFACTORIAL2026 → theme:company-nfactorial (not yet applied)"
```

---

## Task 3: Entitlements service (TDD, mocked Supabase)

**Files:**
- Create: `apps/web/src/services/entitlementsService.ts`
- Test: `apps/web/src/services/entitlementsService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/services/entitlementsService.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the lazy Supabase client. Each test installs its own fake.
const mockClient = { from: vi.fn(), rpc: vi.fn() };
vi.mock('../lib/supabase', () => ({ getSupabase: () => Promise.resolve(mockClient) }));

import { normalizeCode, getEntitlements, redeemCode } from './entitlementsService';

afterEach(() => vi.clearAllMocks());

describe('normalizeCode', () => {
  it('uppercases and trims', () => {
    expect(normalizeCode('  nfactorial2026 ')).toBe('NFACTORIAL2026');
    expect(normalizeCode(undefined as unknown as string)).toBe('');
  });
});

describe('getEntitlements', () => {
  it('maps rows to a string[] of entitlement keys', async () => {
    mockClient.from.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ entitlement: 'theme:company-nfactorial' }], error: null }),
      }),
    });
    expect(await getEntitlements('u1')).toEqual(['theme:company-nfactorial']);
  });

  it('returns [] on error', async () => {
    mockClient.from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'x' } }) }),
    });
    expect(await getEntitlements('u1')).toEqual([]);
  });
});

describe('redeemCode', () => {
  it('passes the normalized code to the RPC and returns its payload', async () => {
    mockClient.rpc.mockResolvedValue({ data: { status: 'ok', entitlements: ['theme:company-nfactorial'] }, error: null });
    const res = await redeemCode(' nfactorial2026 ');
    expect(mockClient.rpc).toHaveBeenCalledWith('redeem_code', { p_code: 'NFACTORIAL2026' });
    expect(res).toEqual({ status: 'ok', entitlements: ['theme:company-nfactorial'] });
  });

  it('maps a transport error to status invalid', async () => {
    mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await redeemCode('X')).status).toBe('invalid');
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (module not found)**

Run: `cd "apps/web" && npx vitest run src/services/entitlementsService.test.ts`
Expected: FAIL — `Failed to resolve import "./entitlementsService"`.

- [ ] **Step 3: Implement the service**

```ts
// apps/web/src/services/entitlementsService.ts
import { getSupabase } from '../lib/supabase';

export type RedeemStatus =
  | 'ok' | 'already_owned' | 'invalid' | 'expired' | 'exhausted' | 'unauthenticated';

export interface RedeemResult {
  status: RedeemStatus;
  /** Keys granted (present on ok / already_owned). */
  entitlements?: string[];
}

/** Codes are stored normalized (UPPER + trimmed); match that everywhere. */
export function normalizeCode(code: string): string {
  return (code ?? '').trim().toUpperCase();
}

/**
 * The new tables/RPC aren't in the generated `Database` types yet (the migration
 * is applied in a later, gated step). Narrow the client to the shape we use here
 * so this file typechecks before the tables exist. Regenerate database.types.ts
 * after the prod apply (Task 7) if you want to drop this.
 */
type EntClient = {
  from: (t: string) => {
    select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: { entitlement: string }[] | null; error: unknown }> };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

async function client(): Promise<EntClient> {
  return (await getSupabase()) as unknown as EntClient;
}

/** All entitlement keys the signed-in user owns ([] on any error / signed out). */
export async function getEntitlements(userId: string): Promise<string[]> {
  const sb = await client();
  const { data, error } = await sb.from('account_entitlements').select('entitlement').eq('user_id', userId);
  if (error || !data) return [];
  return data.map((r) => r.entitlement);
}

/** Redeem a code for the signed-in user. Returns the RPC's status payload. */
export async function redeemCode(code: string): Promise<RedeemResult> {
  const sb = await client();
  const { data, error } = await sb.rpc('redeem_code', { p_code: normalizeCode(code) });
  if (error || !data) return { status: 'invalid' };
  return data as RedeemResult;
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd "apps/web" && npx vitest run src/services/entitlementsService.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck --workspace @fitaura/web
git add apps/web/src/services/entitlementsService.ts apps/web/src/services/entitlementsService.test.ts
git commit -m "feat(entitlements): client service (getEntitlements, redeemCode)"
```

---

## Task 4: Wire entitlements into AccountContext

**Files:**
- Modify: `apps/web/src/features/account/AccountContext.tsx`

- [ ] **Step 1: Add imports + types**

At the import for the credits service (`AccountContext.tsx:8`), add below it:

```ts
import { getEntitlements, redeemCode as redeemCodeSvc, type RedeemResult } from '../../services/entitlementsService';
```

In `AccountContextValue` (after the `refundBattle` block, near line 68), add:

```ts
  /** Entitlement keys the signed-in account owns (e.g. 'theme:company-nfactorial'). */
  entitlements: string[];
  /** True when the signed-in account owns `key`. */
  hasEntitlement: (key: string) => boolean;
  /** Redeem a promo code; on success refreshes `entitlements`. */
  redeemCode: (code: string) => Promise<RedeemResult>;
```

- [ ] **Step 2: Add state + loader + callbacks**

After the credits state (`const [credits, setCredits] = useState(0);`, line 127) add:

```ts
  const [entitlements, setEntitlements] = useState<string[]>([]);
```

After the credit-balance loading effect (the `useEffect` ending at line 202), add a sibling effect — **separate from `onAuthChange`** for the same auth-lock reason:

```ts
  // Load the account's entitlements whenever the signed-in user changes. Kept out
  // of onAuthChange (see the identity effect above) so the query runs after the
  // auth lock is released.
  useEffect(() => {
    if (!userId) {
      setEntitlements([]);
      return;
    }
    let active = true;
    getEntitlements(userId).then((keys) => {
      if (active) setEntitlements(keys);
    });
    return () => {
      active = false;
    };
  }, [userId]);
```

After `refundBattle` (line 415) add the callbacks:

```ts
  const hasEntitlement = useCallback((key: string) => entitlements.includes(key), [entitlements]);

  const redeemCode = useCallback<AccountContextValue['redeemCode']>(
    async (code) => {
      const res = await redeemCodeSvc(code);
      if ((res.status === 'ok' || res.status === 'already_owned') && userId) {
        const keys = await getEntitlements(userId);
        setEntitlements(keys);
      }
      return res;
    },
    [userId],
  );
```

- [ ] **Step 3: Expose on the context value**

In the `useMemo` value object (after `refundBattle,` near line 472) add:

```ts
      entitlements,
      hasEntitlement,
      redeemCode,
```

And in the `useMemo` dependency array (line 508) add `entitlements, hasEntitlement, redeemCode,`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/account/AccountContext.tsx
git commit -m "feat(entitlements): expose entitlements + hasEntitlement + redeemCode on AccountContext"
```

---

## Task 5: `/unlock/:code` redeem screen

**Files:**
- Create: `apps/web/src/features/unlock/Unlock.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write the Unlock screen**

```tsx
// apps/web/src/features/unlock/Unlock.tsx
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';

const MESSAGE: Record<string, string> = {
  ok: 'Unlocked! The nFactorial Edition is now on your account.',
  already_owned: 'You already own this — the Edition is on your account.',
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  exhausted: 'That code has reached its redemption limit.',
  unauthenticated: 'Please sign in to redeem your code.',
};

/**
 * Deep-link redeem funnel (fitaura.studio/unlock/<CODE>). Signed in → redeem on
 * arrival and bounce to the Vault with a toast. Signed out → open the auth modal
 * with a redirect back here, then redeem after sign-in.
 */
export function Unlock() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { signedIn, redeemCode, flash, openAuth } = useAccount();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      openAuth(`/unlock/${code}`, 'login');
      return;
    }
    if (triedRef.current) return;
    triedRef.current = true;
    void redeemCode(code).then((res) => {
      flash(MESSAGE[res.status] ?? MESSAGE.invalid);
      navigate('/vault', { replace: true });
    });
  }, [signedIn, code, redeemCode, flash, openAuth, navigate]);

  return (
    <div className="vlt" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--ink-dim)', fontFamily: 'var(--mono, monospace)' }}>
        {signedIn ? 'Redeeming your code…' : 'Sign in to redeem your code…'}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

In `apps/web/src/App.tsx`, add the lazy import next to the other vault imports (after line 25):

```ts
const Unlock = lazy(() => import('./features/unlock/Unlock').then((m) => ({ default: m.Unlock })));
```

And add the route inside `<Routes>` (after the `/settings` route, line 71):

```tsx
            <Route path="/unlock/:code" element={<Unlock />} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace @fitaura/web`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/unlock/Unlock.tsx apps/web/src/App.tsx
git commit -m "feat(unlock): /unlock/:code deep-link redeem funnel"
```

---

## Task 6: Settings "Have a code?" field + Vault banner

**Files:**
- Create: `apps/web/src/features/vault/UnlockBanner.tsx`
- Modify: `apps/web/src/features/vault/Settings.tsx`, `apps/web/src/features/vault/Vault.tsx`

- [ ] **Step 1: Shared redeem field component**

```tsx
// apps/web/src/features/vault/UnlockBanner.tsx
import { useState } from 'react';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';

const TONE: Record<string, string> = {
  ok: 'var(--lime)', already_owned: 'var(--lime)',
  invalid: 'var(--red)', expired: 'var(--red)', exhausted: 'var(--red)', unauthenticated: 'var(--gold)',
};
const NOTE: Record<string, string> = {
  ok: 'Unlocked! Your new Edition is on your account.',
  already_owned: 'You already own this Edition.',
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  exhausted: 'That code has reached its limit.',
  unauthenticated: 'Sign in first, then redeem your code.',
};

/** Inline "Have a code?" redeem field. `variant="banner"` for the Vault home
 *  announcement, `variant="row"` for the Settings panel. */
export function UnlockBanner({ variant = 'banner' }: { variant?: 'banner' | 'row' }) {
  const { redeemCode, signedIn, openAuth } = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ msg: string; tone: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    if (!signedIn) {
      openAuth('/vault', 'login');
      return;
    }
    setBusy(true);
    const res = await redeemCode(code);
    setBusy(false);
    setNote({ msg: NOTE[res.status] ?? NOTE.invalid, tone: TONE[res.status] ?? 'var(--red)' });
    if (res.status === 'ok' || res.status === 'already_owned') setCode('');
  };

  return (
    <form className={'vlt-unlock ' + variant} onSubmit={submit}>
      <div className="vlt-unlock-tx">
        <div className="k">Have a code?</div>
        <div className="s">Redeem a campaign code to unlock a limited Edition skin.</div>
      </div>
      <div className="vlt-unlock-field">
        <input
          aria-label="Promo code"
          placeholder="NFACTORIAL2026"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoCapitalize="characters"
        />
        <button className="vlt-btn sm" disabled={busy || !code.trim()}>
          <Icon.check /> {busy ? 'Redeeming…' : 'Redeem'}
        </button>
      </div>
      {note && <div className="vlt-unlock-note" style={{ color: note.tone }}>{note.msg}</div>}
    </form>
  );
}
```

- [ ] **Step 2: Add minimal styles**

Append to `apps/web/src/design/vault.css`:

```css
/* "Have a code?" redeem field (Vault banner + Settings row) */
.vlt-unlock{ display:flex; align-items:center; justify-content:space-between; gap:18px;
  flex-wrap:wrap; }
.vlt-unlock.banner{ margin:0 0 18px; padding:16px 18px; border-radius:14px;
  border:1px solid color-mix(in oklab,var(--accent) 30%,var(--hair));
  background:color-mix(in oklab,var(--accent) 7%,transparent); }
.vlt-unlock-tx .k{ font-weight:700; }
.vlt-unlock-tx .s{ color:var(--ink-dim); font-size:13px; }
.vlt-unlock-field{ display:flex; gap:8px; align-items:center; }
.vlt-unlock-field input{ font-family:var(--mono,monospace); letter-spacing:.06em;
  text-transform:uppercase; padding:9px 12px; border-radius:9px;
  border:1px solid var(--hair); background:var(--panel,rgba(255,255,255,.03)); color:var(--ink); }
.vlt-unlock-note{ flex-basis:100%; font-size:13px; }
```

- [ ] **Step 3: Render the banner in the Vault**

In `apps/web/src/features/vault/Vault.tsx`, import it (after line 7):

```ts
import { UnlockBanner } from './UnlockBanner';
```

And render it inside `.vlt-body`, above `.vlt-cols` (line 97→98):

```tsx
      <div className="vlt-body">
        <UnlockBanner variant="banner" />
        <div className="vlt-cols">
```

- [ ] **Step 4: Add the Settings panel**

In `apps/web/src/features/vault/Settings.tsx`, import it (after line 7):

```ts
import { UnlockBanner } from './UnlockBanner';
```

And add a new panel after the Preferences panel closes (after line 171, before the closing `</div>`s):

```tsx
          {/* redeem a code */}
          <div className="vlt-panel">
            <h3 className="vlt-panel-h">
              <Icon.star /> Editions
            </h3>
            <UnlockBanner variant="row" />
          </div>
```

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck --workspace @fitaura/web
git add apps/web/src/features/vault/UnlockBanner.tsx apps/web/src/features/vault/Vault.tsx apps/web/src/features/vault/Settings.tsx apps/web/src/design/vault.css
git commit -m "feat(unlock): Vault announcement + Settings 'Have a code?' field"
```

> Note: confirm `Icon.star` and `Icon.check` exist in `apps/web/src/lib/icons` (both are used elsewhere in Settings/Result). If an icon name differs, swap to an existing one — do not invent an icon.

---

## Task 7: Apply to production (GATED — explicit approval required)

**Do NOT run this task without the user explicitly saying "apply".** This is the only step that touches prod.

- [ ] **Step 1: Get explicit go-ahead** from the user to apply the migration + seed.
- [ ] **Step 2: Apply** the two migrations to production (Supabase MCP `apply_migration`, or `supabase db push`). Apply `20260629120000_promo_entitlements.sql` then `20260629120100_seed_nfactorial2026.sql`.
- [ ] **Step 3: Smoke** with the tester account (`tester@fitaura.test`, see team memory): sign in, visit `/unlock/NFACTORIAL2026`, confirm the toast says "Unlocked", and that `select entitlement from account_entitlements where user_id = <tester>` returns `theme:company-nfactorial`. Re-redeem → `already_owned` (no duplicate row, counter unchanged).
- [ ] **Step 4 (optional): Regenerate types** — `mcp__supabase__generate_typescript_types` → overwrite `apps/web/src/lib/database.types.ts`. Then the `EntClient` cast in `entitlementsService.ts` can be replaced with the generated types. (Keep the generated file even though knip flags it unused — see team memory.)
- [ ] **Step 5: Write a dev-log** under `docs/dev-log/` summarizing the apply + smoke (per team convention).

---

## Self-review

**Spec coverage (spec §5/§6/§9):**
- §5.1 tables + RPC → Task 1. Seed → Task 2. ✓
- §5.2 client service → Task 3; AccountContext wiring → Task 4. ✓
- §5.3 surfaces: `/unlock/:code` → Task 5; Settings field + Vault banner → Task 6. ✓
- §5.4 guests (sign-in to redeem) → Unlock screen + UnlockBanner both call `openAuth` when signed out. ✓
- §9 prod caveat → Task 7 gated. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. The one runtime assumption (icon names) is called out with an explicit instruction, not left vague.

**Type consistency:** `RedeemResult`/`RedeemStatus`/`normalizeCode`/`getEntitlements`/`redeemCode` are defined in Task 3 and used identically in Tasks 4–6. `hasEntitlement(key: string): boolean` and `redeemCode(code): Promise<RedeemResult>` match between the `AccountContextValue` interface and the implementation.

**Note for executor:** Line numbers in Tasks 4–5 reference the files as they are at plan-time; if they've shifted, match on the quoted anchor text instead.
