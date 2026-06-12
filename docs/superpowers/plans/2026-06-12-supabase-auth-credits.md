# Supabase Auth + Per-Account Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock auth with real Supabase email/password auth, introduce a thin service layer, split the localStorage trust domains, and store per-account credits (3 on signup) in Postgres — enough for a working MVP showcase.

**Architecture:** Supabase-direct (React → Supabase SDK; RLS enforces access). Two service modules (`authService`, `creditsService`) are the only files touching Supabase; React contexts call the services. Server-domain state (auth + credits) lives in `AccountContext`; device-domain state (photos/results) stays in `GenerationProvider`. Provider order is inverted so `AccountProvider` is outer and `GenerationProvider` (which spends credits) is inner.

**Tech Stack:** Vite 6 + React 18 + TS, `@supabase/supabase-js` v2, Vitest (new), Supabase Postgres + RLS.

**Spec:** `docs/superpowers/specs/2026-06-12-supabase-auth-credits-design.md`

**Project:** ref `rxtlbhjysksoxkdcdqyr`, URL `https://rxtlbhjysksoxkdcdqyr.supabase.co` (connected via Supabase MCP).

---

## File structure

**New**
- `apps/web/src/lib/supabase.ts` — single Supabase browser client.
- `apps/web/src/services/authService.ts` — auth wrapper + error mapping.
- `apps/web/src/services/authService.test.ts`
- `apps/web/src/services/creditsService.ts` — credit balance (server) + guest free-scan flag (device).
- `apps/web/src/services/creditsService.test.ts`
- `apps/web/.env.example` — committed template.
- `apps/web/.env.local` — real values (gitignored; `.env*` already ignored).
- `apps/web/vitest.config.ts` — test runner config.
- One Supabase migration (applied via MCP, not a repo file): `profiles` table + trigger + RLS.

**Modified**
- `apps/web/package.json` — add deps + `test` script.
- `apps/web/src/state/generation.tsx` — remove all credit fields; device-only.
- `apps/web/src/features/account/AccountContext.tsx` — real auth + reactive credits + checkout grant.
- `apps/web/src/features/account/AccountModals.tsx` — real password, remove OAuth, async states.
- `apps/web/src/features/account/AccountChrome.tsx` — read credits from `useAccount`.
- `apps/web/src/features/scan/Scan.tsx` — gate on `canScan`, spend on reveal, guest-first-free.
- `apps/web/src/App.tsx` — invert provider order.

---

## Task 1: Test infrastructure (Vitest)

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run from repo root:
```bash
npm install -D -w @fitaura/web vitest
```
Expected: `vitest` added to `apps/web` devDependencies, no errors.

- [ ] **Step 2: Add the test script**

In `apps/web/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create the Vitest config**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@fitaura/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 4: Add a smoke test to prove the runner works**

Create `apps/web/src/services/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run from repo root:
```bash
npm run test -w @fitaura/web
```
Expected: PASS, 1 test.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm apps/web/src/services/smoke.test.ts
git add apps/web/package.json apps/web/vitest.config.ts package-lock.json
git commit -m "chore(web): add vitest test runner"
```

---

## Task 2: Supabase client + env

**Files:**
- Create: `apps/web/src/lib/supabase.ts`, `apps/web/.env.example`, `apps/web/.env.local`

- [ ] **Step 1: Install the SDK**

Run from repo root:
```bash
npm install -w @fitaura/web @supabase/supabase-js
```
Expected: `@supabase/supabase-js` in `apps/web` dependencies.

- [ ] **Step 2: Create the env template**

Create `apps/web/.env.example`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
```

- [ ] **Step 3: Create the local env file**

Fetch the publishable (anon) key with the Supabase MCP tool `get_publishable_keys`, then create `apps/web/.env.local`:
```
VITE_SUPABASE_URL=https://rxtlbhjysksoxkdcdqyr.supabase.co
VITE_SUPABASE_ANON_KEY=<paste the anon/publishable key from MCP get_publishable_keys>
```
Note: `.env*` is already gitignored (with a `!.env.example` exception), so `.env.local` will not be committed. Verify with `git status` — it must NOT appear.

- [ ] **Step 4: Create the client**

Create `apps/web/src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

- [ ] **Step 5: Typecheck and commit**

Run from repo root:
```bash
npm run typecheck -w @fitaura/web
```
Expected: no errors. Then:
```bash
git add apps/web/src/lib/supabase.ts apps/web/.env.example apps/web/package.json package-lock.json
git commit -m "feat(web): add supabase client + env template"
```

---

## Task 3: Database — profiles table, RLS, signup trigger

**Files:** Supabase migration applied via MCP `apply_migration` (name: `profiles_credits`).

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP tool `apply_migration` with name `profiles_credits` and this SQL:
```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  credits int not null default 3,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile (with 3 credits via the column default) on signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Verify the table exists**

Use the MCP tool `list_tables` (schema `public`).
Expected: one table `profiles` with columns `id`, `credits`, `created_at`.

- [ ] **Step 3: Check advisors**

Use the MCP tool `get_advisors` (type `security`).
Expected: no errors about the `profiles` table missing RLS (RLS is enabled above). Note any warnings for later but do not block.

- [ ] **Step 4: Generate TypeScript types**

Use the MCP tool `generate_typescript_types` and save the output to `apps/web/src/lib/database.types.ts`. Then commit:
```bash
git add apps/web/src/lib/database.types.ts
git commit -m "feat(db): profiles table with credits, RLS, signup trigger"
```

---

## Task 4: authService (TDD)

**Files:**
- Create: `apps/web/src/services/authService.ts`
- Test: `apps/web/src/services/authService.test.ts`

The service wraps `supabase.auth`. We mock the `supabase` module in tests so no network is needed.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/services/authService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signUp = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp, signInWithPassword, signOut } },
}));

import { authSignUp, authSignIn, authSignOut } from './authService';

beforeEach(() => {
  signUp.mockReset();
  signInWithPassword.mockReset();
  signOut.mockReset();
});

describe('authSignUp', () => {
  it('returns ok with the user on success', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, user: { id: 'u1', email: 'a@b.com' } });
  });

  it('maps "User already registered" to a friendly message', async () => {
    signUp.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } });
    const res = await authSignUp('a@b.com', 'password123');
    expect(res).toEqual({ ok: false, error: 'That email already has an account — try logging in.' });
  });
});

describe('authSignIn', () => {
  it('maps "Invalid login credentials" to a friendly message', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    const res = await authSignIn('a@b.com', 'nope');
    expect(res).toEqual({ ok: false, error: 'Wrong email or password.' });
  });

  it('returns ok with the user on success', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null });
    const res = await authSignIn('a@b.com', 'password123');
    expect(res).toEqual({ ok: true, user: { id: 'u1', email: 'a@b.com' } });
  });
});

describe('authSignOut', () => {
  it('calls supabase signOut', async () => {
    signOut.mockResolvedValue({ error: null });
    await authSignOut();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -w @fitaura/web
```
Expected: FAIL — cannot import `./authService` (module not found).

- [ ] **Step 3: Implement authService**

Create `apps/web/src/services/authService.ts`:
```ts
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthUser = Pick<User, 'id' | 'email'>;
export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

/** Translate raw Supabase auth errors into copy we can show a user. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered')) return 'That email already has an account — try logging in.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('password should be at least')) return 'Password is too short (minimum 6 characters).';
  if (m.includes('unable to validate email')) return 'That email address looks invalid.';
  if (m.includes('email') && m.includes('valid')) return 'That email address looks invalid.';
  return 'Something went wrong. Please try again.';
}

export async function authSignUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'no user') };
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? email } };
}

export async function authSignIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: friendly(error?.message ?? 'no user') };
  return { ok: true, user: { id: data.user.id, email: data.user.email ?? email } };
}

export async function authSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -w @fitaura/web
```
Expected: PASS — all `authService` tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/authService.ts apps/web/src/services/authService.test.ts
git commit -m "feat(web): authService wrapping supabase auth with error mapping"
```

---

## Task 5: creditsService (TDD)

**Files:**
- Create: `apps/web/src/services/creditsService.ts`
- Test: `apps/web/src/services/creditsService.test.ts`

Responsibilities: server credit balance for a signed-in user (`profiles` table) and the guest free-scan flag (device localStorage). The guest flag is the only credit-domain value that stays on the device.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/services/creditsService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable supabase query mock.
const single = vi.fn();
const eqSelect = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq: eqSelect }));
const eqUpdate = vi.fn();
const update = vi.fn(() => ({ eq: eqUpdate }));
const from = vi.fn(() => ({ select, update }));

vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { getBalance, spendCredit, grantCredits, hasUsedFreeScan, markFreeScanUsed, FREE_SCAN_KEY } from './creditsService';

beforeEach(() => {
  single.mockReset();
  eqUpdate.mockReset();
  localStorage.clear();
});

describe('getBalance', () => {
  it('returns the credits for the user', async () => {
    single.mockResolvedValue({ data: { credits: 3 }, error: null });
    expect(await getBalance('u1')).toBe(3);
  });

  it('returns 0 when the row is missing or errors', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'no row' } });
    expect(await getBalance('u1')).toBe(0);
  });
});

describe('spendCredit', () => {
  it('decrements and returns ok when balance is positive', async () => {
    single.mockResolvedValue({ data: { credits: 2 }, error: null });
    eqUpdate.mockResolvedValue({ error: null });
    const res = await spendCredit('u1');
    expect(update).toHaveBeenCalledWith({ credits: 1 });
    expect(res).toEqual({ ok: true, balance: 1 });
  });

  it('refuses when balance is zero', async () => {
    single.mockResolvedValue({ data: { credits: 0 }, error: null });
    const res = await spendCredit('u1');
    expect(res).toEqual({ ok: false, balance: 0 });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('grantCredits', () => {
  it('adds n credits to the current balance', async () => {
    single.mockResolvedValue({ data: { credits: 1 }, error: null });
    eqUpdate.mockResolvedValue({ error: null });
    const res = await grantCredits('u1', 5);
    expect(update).toHaveBeenCalledWith({ credits: 6 });
    expect(res).toBe(6);
  });
});

describe('guest free-scan flag', () => {
  it('is false until marked, true after', () => {
    expect(hasUsedFreeScan()).toBe(false);
    markFreeScanUsed();
    expect(hasUsedFreeScan()).toBe(true);
    expect(localStorage.getItem(FREE_SCAN_KEY)).toBe('1');
  });
});
```

- [ ] **Step 2: Add jsdom for the localStorage part of the test**

`localStorage` needs a DOM. Install jsdom and set the test environment for this file. Run from repo root:
```bash
npm install -D -w @fitaura/web jsdom
```
Then add this comment as the FIRST line of `creditsService.test.ts`:
```ts
// @vitest-environment jsdom
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm run test -w @fitaura/web
```
Expected: FAIL — cannot import `./creditsService`.

- [ ] **Step 4: Implement creditsService**

Create `apps/web/src/services/creditsService.ts`:
```ts
import { supabase } from '../lib/supabase';

export const FREE_SCAN_KEY = 'fitaura.freeScanUsed';

export type SpendResult = { ok: boolean; balance: number };

/** Current server credit balance for a signed-in user (0 on any error). */
export async function getBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from('profiles').select('credits').eq('id', userId).single();
  if (error || !data) return 0;
  return data.credits;
}

/** Spend one credit. Refuses (without writing) when the balance is empty. */
export async function spendCredit(userId: string): Promise<SpendResult> {
  const balance = await getBalance(userId);
  if (balance <= 0) return { ok: false, balance: 0 };
  const next = balance - 1;
  const { error } = await supabase.from('profiles').update({ credits: next }).eq('id', userId);
  if (error) return { ok: false, balance };
  return { ok: true, balance: next };
}

/** Add n credits (used by the mock checkout). Returns the new balance. */
export async function grantCredits(userId: string, n: number): Promise<number> {
  const balance = await getBalance(userId);
  const next = balance + n;
  await supabase.from('profiles').update({ credits: next }).eq('id', userId);
  return next;
}

/** Guest free-scan flag — device-local, never server-bound. */
export function hasUsedFreeScan(): boolean {
  return localStorage.getItem(FREE_SCAN_KEY) === '1';
}

export function markFreeScanUsed(): void {
  localStorage.setItem(FREE_SCAN_KEY, '1');
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run test -w @fitaura/web
```
Expected: PASS — all `creditsService` tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/creditsService.ts apps/web/src/services/creditsService.test.ts apps/web/package.json package-lock.json
git commit -m "feat(web): creditsService — server balance + guest free-scan flag"
```

---

## Task 6: Strip credits out of generation.tsx (device-domain only)

**Files:**
- Modify: `apps/web/src/state/generation.tsx`

Remove `credits`, `freeUsed`, `isFree`, `canAffordScan`, `addCredits`, and `CREDITS_ENFORCED`. `runGeneration` only fails on `missing_photos`. `PersistedState` keeps only device data. Credit gating/spending now lives entirely in `AccountContext` (Task 7).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `apps/web/src/state/generation.tsx` with:
```tsx
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import {
  DATING_VERDICTS,
  type DatingVerdict,
  type FullGenerationResult,
} from '@fitaura/shared';
import { MOCK_GENERATIONS } from '../data/mockGenerations';
import { useLocalStorage } from './useLocalStorage';

/** A baked, cropped photo ready to drop into a card (data URL, on-device). */
export interface UploadedPhoto {
  url: string;
}

export interface GenerationResult extends FullGenerationResult {
  /** When this generation was produced (device-local history). */
  producedAt: string;
  /** Optional user-given name for the vault (defaults to the generation id). */
  name?: string;
}

/** Newest results kept on-device. Capped so localStorage stays small. */
const HISTORY_CAP = 4;

/** Device-domain only — photos/results never leave the device (privacy rule). */
interface PersistedState {
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  result: GenerationResult | null;
  history: GenerationResult[];
}

const INITIAL: PersistedState = {
  face: null,
  outfit: null,
  result: null,
  history: [],
};

type RunOutcome = { ok: true; result: GenerationResult } | { ok: false; reason: 'missing_photos' };

interface GenerationContextValue {
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  result: GenerationResult | null;
  bothPhotosReady: boolean;
  /** Recent on-device results (newest first). */
  history: GenerationResult[];
  setFace: (photo: UploadedPhoto | null) => void;
  setOutfit: (photo: UploadedPhoto | null) => void;
  /** Builds the result from the uploaded photos. Credit gating happens in AccountContext. */
  runGeneration: (verdict?: DatingVerdict) => RunOutcome;
  /** Clears the current photos to begin a fresh scan (keeps result/history). */
  startNewScan: () => void;
  /** Make a stored history result the current one. Returns false if missing. */
  openResult: (generationId: string) => boolean;
  /** Permanently remove a result from the on-device history. */
  removeResult: (generationId: string) => void;
  /** Rename a result in the on-device history. */
  renameResult: (generationId: string, name: string) => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

function pickVerdict(): DatingVerdict {
  return DATING_VERDICTS[Math.floor(Math.random() * DATING_VERDICTS.length)];
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [rawState, setState] = useLocalStorage<PersistedState>('fitaura.state', INITIAL);

  // Coerce against legacy persisted state (older blobs predate `history`, and
  // earlier versions stored credits/freeUsed here — those are dropped on read).
  const state: PersistedState = {
    face: rawState.face ?? null,
    outfit: rawState.outfit ?? null,
    result: rawState.result ?? null,
    history: rawState.history ?? [],
  };

  // Mirror of the latest state so runGeneration can decide its outcome purely,
  // without relying on side-effects inside a setState updater (which React
  // StrictMode intentionally double-invokes).
  const stateRef = useRef(state);
  stateRef.current = state;

  const setFace = useCallback(
    (photo: UploadedPhoto | null) => setState((s) => ({ ...s, face: photo })),
    [setState],
  );
  const setOutfit = useCallback(
    (photo: UploadedPhoto | null) => setState((s) => ({ ...s, outfit: photo })),
    [setState],
  );

  const bothPhotosReady = !!state.face && !!state.outfit;

  const runGeneration = useCallback<GenerationContextValue['runGeneration']>(
    (verdict) => {
      const s = stateRef.current;
      if (!s.face || !s.outfit) return { ok: false, reason: 'missing_photos' };

      const chosen = verdict ?? pickVerdict();
      const base = MOCK_GENERATIONS[chosen];
      const now = new Date().toISOString();
      const result: GenerationResult = {
        ...base,
        producedAt: now,
        face: { ...base.face, card: { ...base.face.card, imageUrl: s.face.url } },
        outfit: { ...base.outfit, card: { ...base.outfit.card, imageUrl: s.outfit.url } },
        receipt: { ...base.receipt, generatedAt: now },
      };

      const history = [result, ...s.history.filter((h) => h.receipt.generationId !== result.receipt.generationId)].slice(
        0,
        HISTORY_CAP,
      );
      const next: PersistedState = { ...s, result, history };
      stateRef.current = next;
      setState(next);
      return { ok: true, result };
    },
    [setState],
  );

  const startNewScan = useCallback(
    () => setState((s) => ({ ...s, face: null, outfit: null })),
    [setState],
  );

  const openResult = useCallback(
    (generationId: string) => {
      const found = stateRef.current.history.find((h) => h.receipt.generationId === generationId);
      if (!found) return false;
      setState((s) => ({ ...s, result: found }));
      return true;
    },
    [setState],
  );

  const removeResult = useCallback(
    (generationId: string) =>
      setState((s) => ({
        ...s,
        history: s.history.filter((h) => h.receipt.generationId !== generationId),
        result: s.result?.receipt.generationId === generationId ? null : s.result,
      })),
    [setState],
  );

  const renameResult = useCallback(
    (generationId: string, name: string) => {
      const clean = name.trim();
      setState((s) => {
        const apply = (r: GenerationResult): GenerationResult =>
          r.receipt.generationId === generationId ? { ...r, name: clean || undefined } : r;
        return {
          ...s,
          history: s.history.map(apply),
          result: s.result ? apply(s.result) : s.result,
        };
      });
    },
    [setState],
  );

  const value = useMemo<GenerationContextValue>(
    () => ({
      face: state.face,
      outfit: state.outfit,
      result: state.result,
      bothPhotosReady,
      history: state.history,
      setFace,
      setOutfit,
      runGeneration,
      startNewScan,
      openResult,
      removeResult,
      renameResult,
    }),
    [state, bothPhotosReady, setFace, setOutfit, runGeneration, startNewScan, openResult, removeResult, renameResult],
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used within a GenerationProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck (expect failures elsewhere — that's fine for now)**

```bash
npm run typecheck -w @fitaura/web
```
Expected: errors ONLY in `AccountContext.tsx` (uses `addCredits`), `AccountChrome.tsx` (uses `credits`/`isFree`), and `Scan.tsx` (uses `outcome.reason === 'no_credits'`). These are fixed in Tasks 7–9. No errors inside `generation.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/state/generation.tsx
git commit -m "refactor(web): generation.tsx holds device-domain state only"
```

---

## Task 7: AccountContext — real auth + reactive credits

**Files:**
- Modify: `apps/web/src/features/account/AccountContext.tsx`

This is the server-domain orchestrator: session (via authService) + reactive credit balance + guest free-scan + scene/checkout. It no longer imports `useGeneration` (the old circular dependency). Provider reorder happens in Task 9.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `apps/web/src/features/account/AccountContext.tsx` with:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CREDIT_PACKS } from '@fitaura/shared';
import { authSignIn, authSignOut, authSignUp, getCurrentSession, onAuthChange } from '../../services/authService';
import { getBalance, grantCredits, hasUsedFreeScan, markFreeScanUsed, spendCredit } from '../../services/creditsService';

export interface AccountUser {
  email: string;
  /** Avatar initial. */
  initial: string;
  /** "MEMBER SINCE" label, e.g. "JUN 2026". */
  since: string;
}

/** The overlay surfaces the account/monetization flow can show. */
export type Scene =
  | null
  | 'auth'
  | 'paywall'
  | 'checkout'
  | 'processing'
  | 'success'
  | 'failure'
  | 'logout'
  | 'missing';

export type AuthStatus = 'idle' | 'pending' | 'error';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function toAccountUser(user: { id: string; email: string | null | undefined }, createdAt?: string): AccountUser {
  const email = user.email ?? 'you@email.com';
  const d = createdAt ? new Date(createdAt) : new Date();
  return {
    email,
    initial: (email[0] || 'U').toUpperCase(),
    since: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  };
}

interface AccountContextValue {
  signedIn: boolean;
  user: AccountUser | null;
  /** Server-side credit balance for the signed-in user. */
  credits: number;
  /** Guest only: a free first scan is still available. */
  freeScanAvailable: boolean;
  /** Whether a scan can start right now (guest free, or has credits). */
  canScan: boolean;
  /** Spend for one scan: guest → mark free used; signed-in → spend a credit. Returns ok. */
  spendForScan: () => Promise<boolean>;

  scene: Scene;
  authStatus: AuthStatus;
  authError: string | null;
  /** Pack id selected on the credits page / in checkout. */
  pack: string;
  setPack: (id: string) => void;
  lastPurchaseCredits: number;
  missingId: string | null;
  toast: string | null;

  flash: (msg: string) => void;
  closeScene: () => void;
  openAuth: (redirectTo?: string) => void;
  /** Email/password sign-up. Resolves true on success. */
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Email/password log-in. Resolves true on success. */
  logIn: (email: string, password: string) => Promise<boolean>;
  requestLogout: () => void;
  confirmLogout: () => void;
  openPaywall: () => void;
  startCheckout: (packId?: string) => void;
  pay: () => void;
  failPayment: () => void;
  openMissing: (id: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AccountUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [freeScanAvailable, setFreeScanAvailable] = useState(!hasUsedFreeScan());

  const [scene, setScene] = useState<Scene>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authError, setAuthError] = useState<string | null>(null);
  // Default the checkout selection to the 5-credit starter pack for the demo.
  const [pack, setPack] = useState<string>(CREDIT_PACKS.find((p) => p.id === 'starter')?.id ?? CREDIT_PACKS[0].id);
  const [lastPurchaseCredits, setLastPurchaseCredits] = useState(0);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const procTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authRedirect = useRef<string | null>(null);

  const signedIn = !!userId;

  // Hydrate the session on mount and subscribe to auth changes (sign-in/out
  // from any tab). The Supabase session — not localStorage — is the source of truth.
  useEffect(() => {
    let active = true;
    const apply = async (uid: string | null, email: string | null, createdAt?: string) => {
      if (!active) return;
      if (uid) {
        setUserId(uid);
        setUser(toAccountUser({ id: uid, email }, createdAt));
        setCredits(await getBalance(uid));
      } else {
        setUserId(null);
        setUser(null);
        setCredits(0);
      }
    };
    getCurrentSession().then((s) =>
      apply(s?.user.id ?? null, s?.user.email ?? null, s?.user.created_at),
    );
    const unsub = onAuthChange((s) =>
      apply(s?.user.id ?? null, s?.user.email ?? null, s?.user.created_at),
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const closeScene = useCallback(() => {
    authRedirect.current = null;
    setAuthStatus('idle');
    setAuthError(null);
    setScene(null);
  }, []);
  const openAuth = useCallback((redirectTo?: string) => {
    authRedirect.current = redirectTo ?? null;
    setAuthStatus('idle');
    setAuthError(null);
    setScene('auth');
  }, []);
  const openPaywall = useCallback(() => setScene('paywall'), []);
  const openMissing = useCallback((id: string) => {
    setMissingId(id);
    setScene('missing');
  }, []);

  // Shared completion for a successful sign-up or log-in.
  const finishAuth = useCallback(
    (uid: string, email: string) => {
      setUserId(uid);
      setUser(toAccountUser({ id: uid, email }));
      setAuthStatus('idle');
      setScene(null);
      const dest = authRedirect.current ?? '/vault';
      authRedirect.current = null;
      flash(dest === '/vault' ? 'Signed in — welcome to your vault.' : 'Signed in — revealing your verdict…');
      navigate(dest);
    },
    [flash, navigate],
  );

  const signUp = useCallback<AccountContextValue['signUp']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignUp(email, password);
      if (!res.ok) {
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      // New account starts at 3 credits (DB default via signup trigger).
      setCredits(await getBalance(res.user.id));
      finishAuth(res.user.id, res.user.email);
      return true;
    },
    [finishAuth],
  );

  const logIn = useCallback<AccountContextValue['logIn']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignIn(email, password);
      if (!res.ok) {
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      setCredits(await getBalance(res.user.id));
      finishAuth(res.user.id, res.user.email);
      return true;
    },
    [finishAuth],
  );

  const requestLogout = useCallback(() => setScene('logout'), []);
  const confirmLogout = useCallback(async () => {
    await authSignOut();
    setUserId(null);
    setUser(null);
    setCredits(0);
    setScene(null);
    flash('Logged out — results stay on this device.');
    navigate('/');
  }, [flash, navigate]);

  const canScan = signedIn ? credits > 0 : freeScanAvailable;

  const spendForScan = useCallback<AccountContextValue['spendForScan']>(async () => {
    if (!signedIn) {
      if (!freeScanAvailable) return false;
      markFreeScanUsed();
      setFreeScanAvailable(false);
      return true;
    }
    if (!userId) return false;
    const res = await spendCredit(userId);
    setCredits(res.balance);
    return res.ok;
  }, [signedIn, freeScanAvailable, userId]);

  const startCheckout = useCallback(
    (packId?: string) => {
      if (packId) setPack(packId);
      if (!signedIn) {
        authRedirect.current = null;
        setScene('auth');
        return;
      }
      setScene('checkout');
    },
    [signedIn],
  );

  const pay = useCallback(() => {
    setScene('processing');
    if (procTimer.current) clearTimeout(procTimer.current);
    procTimer.current = setTimeout(async () => {
      const packCredits = CREDIT_PACKS.find((p) => p.id === pack)?.credits ?? 0;
      if (userId) {
        const next = await grantCredits(userId, packCredits);
        setCredits(next);
      }
      setLastPurchaseCredits(packCredits);
      setScene('success');
      flash('Credits added to your account.');
    }, 2300);
  }, [pack, userId, flash]);

  const failPayment = useCallback(() => setScene('failure'), []);

  const value = useMemo<AccountContextValue>(
    () => ({
      signedIn,
      user,
      credits,
      freeScanAvailable,
      canScan,
      spendForScan,
      scene,
      authStatus,
      authError,
      pack,
      setPack,
      lastPurchaseCredits,
      missingId,
      toast,
      flash,
      closeScene,
      openAuth,
      signUp,
      logIn,
      requestLogout,
      confirmLogout,
      openPaywall,
      startCheckout,
      pay,
      failPayment,
      openMissing,
    }),
    [
      signedIn, user, credits, freeScanAvailable, canScan, spendForScan, scene, authStatus, authError,
      pack, lastPurchaseCredits, missingId, toast, flash, closeScene, openAuth, signUp, logIn,
      requestLogout, confirmLogout, openPaywall, startCheckout, pay, failPayment, openMissing,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck (AccountContext should now be clean)**

```bash
npm run typecheck -w @fitaura/web
```
Expected: no errors in `AccountContext.tsx`. Remaining errors only in `AccountModals.tsx` (uses removed `signIn`), `AccountChrome.tsx`, and `Scan.tsx`. Fixed next.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/account/AccountContext.tsx
git commit -m "feat(web): real supabase auth + reactive per-account credits in AccountContext"
```

---

## Task 8: AccountModals — real password, async states, no OAuth

**Files:**
- Modify: `apps/web/src/features/account/AccountModals.tsx` (the `AuthGate` component, lines ~12–108)

- [ ] **Step 1: Confirm `WebField` supports a value/onChange for the password**

Run:
```bash
grep -n "onChange\|value\|lock\|type" apps/web/src/features/account/WebModal.tsx
```
Expected: `WebField` accepts `value`, `onChange`, `type`, `placeholder`, `label`, `lock`. (The Email field already uses `value`/`onChange`; the Password field will use the same props.)

- [ ] **Step 2: Replace the `AuthGate` component**

In `apps/web/src/features/account/AccountModals.tsx`, replace the entire `AuthGate` function (from `export function AuthGate() {` through its closing `}` before `/* ===== PAYWALL ===== */`) with:
```tsx
export function AuthGate() {
  const { closeScene, signUp, logIn, authStatus, authError } = useAccount();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isSignup = mode === 'signup';
  const pending = authStatus === 'pending';

  const submit = () => {
    if (pending) return;
    if (isSignup) void signUp(email.trim(), password);
    else void logIn(email.trim(), password);
  };

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-auth">
        <div className="aw-auth-left">
          <span className="aw-eyebrow accent">ACCOUNT REQUIRED TO CONTINUE</span>
          <h2 className="aw-modal-title" style={{ marginTop: '16px', fontSize: '34px' }}>
            SAVE YOUR SCANS.
            <br />
            KEEP GOING.
          </h2>
          <p className="aw-modal-sub">
            Your first verdict was free and stayed on this device. An account lets you buy credits and run more — on
            any device you log in from.
          </p>
          <ul className="pts">
            <li>
              <span className="ck">
                <Icon.check />
              </span>
              <span>
                Credits follow your login<span className="s">Not tied to one browser</span>
              </span>
            </li>
            <li>
              <span className="ck">
                <Icon.check />
              </span>
              <span>
                Payment receipts saved<span className="s">On your account, server-side</span>
              </span>
            </li>
            <li>
              <span className="ck">
                <Icon.check />
              </span>
              <span>
                Your photos stay on your device<span className="s">We never store source photos</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="aw-auth-right">
          <div className="aw-seg" role="tablist">
            <button role="tab" aria-selected={isSignup} onClick={() => setMode('signup')}>
              Sign up
            </button>
            <button role="tab" aria-selected={!isSignup} onClick={() => setMode('login')}>
              Log in
            </button>
          </div>
          <WebField label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} />
          <WebField
            label="Password"
            type="password"
            placeholder={isSignup ? 'Create a password' : 'Your password'}
            value={password}
            onChange={setPassword}
          />
          {authError && (
            <p className="aw-formerror" role="alert">
              {authError}
            </p>
          )}
          <button
            className="aw-btn primary block"
            style={{ marginTop: '18px' }}
            onClick={submit}
            disabled={pending}
          >
            {pending ? 'Working…' : isSignup ? 'Create account' : 'Log in'} <Icon.arrow />
          </button>
          <div className="aw-finehelp">
            <Icon.shield />
            <span>
              We store your account, credit balance and payment receipts — never your photos.{' '}
              <button
                type="button"
                className="lk"
                onClick={() => {
                  closeScene();
                  navigate('/settings');
                }}
              >
                How your data is stored
              </button>
            </span>
          </div>
        </div>
      </div>
    </WebModal>
  );
}
```

- [ ] **Step 3: Add a minimal error style**

Append to `apps/web/src/design/account-web.css`:
```css
.aw-formerror {
  margin: 10px 0 0;
  color: var(--red, #ff5470);
  font-size: 13px;
  line-height: 1.4;
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck -w @fitaura/web
```
Expected: no errors in `AccountModals.tsx` (the `Icon.apple`/`Icon.google` imports may now be unused — if `noUnusedLocals` flags them, leave the `Icon` import since other icons are still used; the named OAuth buttons are gone). Remaining errors only in `AccountChrome.tsx` and `Scan.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/account/AccountModals.tsx apps/web/src/design/account-web.css
git commit -m "feat(web): real password auth + async states in AuthGate, drop OAuth buttons"
```

---

## Task 9: Wire AccountChrome + Scan, invert provider order

**Files:**
- Modify: `apps/web/src/features/account/AccountChrome.tsx`
- Modify: `apps/web/src/features/scan/Scan.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: AccountChrome reads credits/free from useAccount**

In `apps/web/src/features/account/AccountChrome.tsx`, change line 16 from:
```tsx
  const { credits, isFree } = useGeneration();
```
to read from the account context (and remove the now-unused `useGeneration` import). The component already calls `useAccount()` on line 15 — merge the destructure:
```tsx
  const { signedIn, openAuth, credits, freeScanAvailable } = useAccount();
```
Then replace the `isFree` usage on line 28 (`} else if (isFree) {`) with:
```tsx
  } else if (freeScanAvailable) {
```
Remove the `import { useGeneration } from ...` line at the top of the file.

- [ ] **Step 2: Scan — gate on canScan, spend on reveal, guest-first-free**

In `apps/web/src/features/scan/Scan.tsx`:

Change the hook destructure (line ~109-110) from:
```tsx
  const { face, outfit, bothPhotosReady, runGeneration } = useGeneration();
  const { signedIn, openAuth } = useAccount();
```
to:
```tsx
  const { face, outfit, bothPhotosReady, runGeneration } = useGeneration();
  const { signedIn, openAuth, canScan, spendForScan, openPaywall } = useAccount();
```

Replace `doReveal` (lines ~159-171) with a version that spends a credit on success and drops the dead `no_credits` branch:
```tsx
  const doReveal = useCallback(async () => {
    const ok = await spendForScan();
    if (!ok) {
      openPaywall();
      return;
    }
    const outcome = runGeneration();
    if (outcome.ok) {
      // A freshly completed scan always opens on the first card (01 Face),
      navigate('/result#face');
    } else {
      navigate('/scan');
    }
  }, [spendForScan, openPaywall, runGeneration, navigate]);
```

Replace the reveal trigger (the click handler around lines ~173-190 that does `if (signedIn) doReveal() else openAuth()` and the `pendingReveal` effect) so that a guest with a free scan reveals immediately, a guest without one is sent to auth, and a signed-in user with no credits hits the paywall. Find the handler block:
```tsx
    if (signedIn) {
      doReveal();
    } else {
      // open auth, set pendingReveal
      ...
    }
```
and change the `signedIn` guard to `canScan`:
```tsx
    if (canScan) {
      void doReveal();
    } else if (!signedIn) {
      setPendingReveal(true);
      openAuth();
    } else {
      openPaywall();
    }
```
In the `pendingReveal` effect (lines ~185-190), change the condition from `pendingReveal && signedIn` to `pendingReveal && canScan` and call `void doReveal()`:
```tsx
  useEffect(() => {
    if (pendingReveal && canScan) {
      setPendingReveal(false);
      void doReveal();
    }
  }, [pendingReveal, canScan, doReveal]);
```
Update the dependency arrays of the affected callbacks/effects to match the new references (`canScan`, `doReveal`, `openAuth`, `openPaywall`, `signedIn`).

Note: the button label on line ~266 (`signedIn ? 'Reveal my verdict' : 'Log in to reveal your verdict'`) stays — a guest with a free scan still sees a reveal CTA only after both photos are ready; the label is acceptable for the demo. If you prefer, change it to `canScan ? 'Reveal my verdict' : 'Log in to reveal your verdict'`.

- [ ] **Step 3: Invert the provider order in App.tsx**

In `apps/web/src/App.tsx`, swap the nesting so `AccountProvider` is the OUTER provider (it no longer depends on `GenerationProvider`, and `GenerationProvider`'s consumers now read credits from `useAccount`). Replace lines 32-55:
```tsx
export function App() {
  return (
    <AccountProvider>
      <GenerationProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/scan" element={<Upload />} />
          <Route path="/scan/run" element={<Scan />} />
          <Route path="/result" element={<Result />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/account" element={<AccountInfo />} />
          <Route path="/credits" element={<Pricing />} />
          <Route path="/settings" element={<Settings />} />
          {/* Redirects from the old account-area IA into the new vault. */}
          <Route path="/storage" element={<Navigate to="/settings" replace />} />
          <Route path="/results" element={<Navigate to="/vault" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AccountOverlays />
      </GenerationProvider>
    </AccountProvider>
  );
}
```

- [ ] **Step 4: Typecheck — must be fully clean now**

```bash
npm run typecheck -w @fitaura/web
```
Expected: 0 errors across the project.

- [ ] **Step 5: Run all tests**

```bash
npm run test -w @fitaura/web
```
Expected: PASS — authService + creditsService suites green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/account/AccountChrome.tsx apps/web/src/features/scan/Scan.tsx apps/web/src/App.tsx
git commit -m "feat(web): wire credits/auth through useAccount, gate scans, invert providers"
```

---

## Task 10: Build + live verification + dev-log

**Files:**
- Create: `docs/dev-log/014-supabase-auth-credits.md`

- [ ] **Step 1: Production build**

```bash
npm run build -w @fitaura/web
```
Expected: build succeeds, no type errors.

- [ ] **Step 2: Live smoke test (manual or Playwright)**

Run `npm run dev -w @fitaura/web` and verify against the real Supabase project:
1. Sign up with a fresh email → lands in `/vault`, chrome shows **3 credits**.
2. Run a scan → balance drops to **2** (check the chrome chip and reload — it persists).
3. Open `/credits`, buy the **starter** pack via the mock checkout → success → balance **+5 = 7**.
4. Reload the page → still signed in (session persists), balance **7**.
5. Log out → returns to guest; device results (vault history) still present.
6. As a guest (logged out, fresh `localStorage`), run the **first scan free** → reveals without login; a second scan attempt prompts sign-in.
7. Confirm in the Supabase dashboard (or MCP `execute_sql`: `select id, credits from profiles`) that the row reflects the balance.

Record any failures and fix before continuing.

- [ ] **Step 3: Write the dev-log**

Create `docs/dev-log/014-supabase-auth-credits.md` documenting: the service-layer seam, the auth swap, the `profiles`/RLS/trigger schema, the trust-domain split, the provider inversion, and the known limitation (owner-update RLS = credits not yet forgery-proof; hardening deferred). Follow the study-oriented style of `013-frontend-stabilization.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/dev-log/014-supabase-auth-credits.md
git commit -m "docs: dev-log 014 — supabase auth + per-account credits"
```

---

## Self-review notes (for the executor)

- **StrictMode:** `runGeneration` stays pure via `stateRef` (unchanged). `spendForScan` is now the credit mutation; it runs in click handlers and a `pendingReveal`-guarded effect (flag flipped to `false` before the async call) to avoid a double-spend on the dev-mode double-invoke. Verify the balance only drops by 1 per scan in step 2 above.
- **Guest free-scan flag** is device-local (`fitaura.freeScanUsed`); clearing localStorage resets it (expected — not forgery-proof, deferred).
- **Credits not forgery-proof:** owner-update RLS lets a user rewrite their own balance; hardening via a `SECURITY DEFINER` decrement RPC is a later cycle (noted in spec §1/§12).
