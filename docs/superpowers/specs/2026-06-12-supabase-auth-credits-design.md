# Cycle 1 — Service layer + Supabase Auth + per-account credits

**Date:** 2026-06-12
**Status:** Approved design, ready for implementation plan
**Scope:** First of several backend-integration cycles. This cycle stands up real
authentication, a thin service layer (the audit's #1 prerequisite), and
per-account credits stored in Postgres. Payments stay mock. OAuth is deferred.

Backreferences: `docs/audit/2026-06-12-frontend-audit.md` (§9 architecture seams,
§11 async states), `docs/dev-log/013-frontend-stabilization.md`.

---

## 1. Goal & non-goals

**Goal.** Replace mock auth with real Supabase Auth (email/password), introduce a
service layer so React contexts call services instead of mocks/SDK directly, split
the localStorage trust domains, and make credits a real per-account value stored in
Postgres — enough for a working MVP showcase.

**Backend shape:** Supabase-direct (React → Supabase SDK; RLS enforces access). No
`apps/api` server this cycle.

**Non-goals (deferred to later cycles, noted where relevant):**
- Real payment provider — checkout stays a mock that grants credits without charging.
- Forgery-proof credits — owner-update RLS means a user could reset their own
  balance; hardening via a `SECURITY DEFINER` RPC is later work.
- Google/Apple OAuth — buttons removed this cycle; re-added when configured.
- Profile editing / `display_name`, avatars, password reset UI.
- Server-side AI generation (`mockGenerations.ts` stays).

---

## 2. Architecture: the service seam

Plain typed service modules behind interfaces (chosen over a DI container or inline
SDK calls). Contexts import services; only the services import the Supabase client.
This is the drop-in seam later cycles swap behind.

```
src/lib/supabase.ts          # single Supabase client (env-driven)
src/services/authService.ts  # the only file touching Supabase Auth
src/services/creditsService.ts  # the only file touching the credits table
```

**Data flow:**
```
AccountModals ─▶ AccountContext ─▶ authService ─▶ Supabase Auth
                                 └▶ creditsService ─▶ profiles (Postgres, RLS)
Scan/Result   ─▶ generation ctx ─▶ creditsService (spend / balance)
```

---

## 3. Supabase client & config

- Add dependency `@supabase/supabase-js`.
- `src/lib/supabase.ts` creates one client from `import.meta.env.VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY`.
- `.env.local` (gitignored) holds the real values; commit a `.env.example` template.
- The **anon/publishable** key ships to the client by design; RLS is the protection
  boundary.
- Project ref (already connected via MCP): `rxtlbhjysksoxkdcdqyr`.

---

## 4. Auth

### authService.ts
```ts
type AuthResult = { ok: true; user: SessionUser } | { ok: false; error: string };

signUpWithPassword(email, password): Promise<AuthResult>
signInWithPassword(email, password): Promise<AuthResult>
signOut(): Promise<void>
getSession(): Promise<Session | null>
onAuthStateChange(cb): Unsubscribe
```
- Wraps Supabase Auth. Maps Supabase error codes to friendly copy
  (e.g. invalid credentials, email already registered, weak password).
- Email confirmation is OFF (set in dashboard), so signup yields an active session
  immediately.

### AccountContext (rewrite)
- **Session is the source of truth** for `signedIn` / `user`, subscribed via
  `onAuthStateChange` and seeded with `getSession()` on mount. Delete the
  `fitaura.account` localStorage blob (Supabase manages its own session storage).
- `AccountUser` derived from the session: `email`, `initial` (first letter),
  `since` (month/year from `created_at`).
- Replace mock `signIn(email)` with async actions: `signUpWithPassword`,
  `signInWithPassword`, `signOut`.
- Add async UI state: `authStatus: 'idle' | 'pending' | 'error'`, `authError: string | null`
  (fixes audit §11 — auth had no loading/verify/error states).
- Preserve the existing `authRedirect` behavior (land back where the guest was after
  a mid-flow sign-in).

### AccountModals (wire-up)
- Read the real **password** field (currently decorative).
- Login vs. signup tabs call `signInWithPassword` / `signUpWithPassword`.
- **Remove** the Google and Apple/iCloud OAuth buttons.
- Pending → submit disabled + spinner; error → inline message from `authError`.

---

## 5. Credits (per-account, Postgres)

### Migration
`profiles` table:
| column      | type        | notes                                   |
|-------------|-------------|-----------------------------------------|
| id          | uuid        | PK, `references auth.users(id)` on delete cascade |
| credits     | int         | `not null default 3`                    |
| created_at  | timestamptz | `default now()`                         |

- **Trigger** `on auth.users insert` → insert a `profiles` row, so every new account
  starts with 3 credits enforced by the DB default (not client code).
- **RLS** enabled: a user may `select` and `update` only the row where
  `id = auth.uid()`. No `insert`/`delete` from the client (trigger owns insert).
- Generate TS types via the Supabase MCP after applying the migration.

### creditsService.ts
```ts
getBalance(): Promise<number>          // select credits where id = auth.uid()
spend(n = 1): Promise<{ ok: boolean }> // decrement; refuse if balance < n
grant(n): Promise<void>                // increment (used by mock checkout)
// guest device flag (scan-first IA):
hasUsedFreeScan(): boolean
markFreeScanUsed(): void
```
- Signed-in users → real Supabase reads/writes against `profiles`.
- The **guest free-scan flag** is the only credit-domain value that stays on the
  device (small key owned by this service, e.g. `fitaura.freeScan`).

---

## 6. Flows

- **Guest (not signed in):** first scan is free (device flag); IA scan-first/
  account-optional preserved. After the free scan, the existing gate invites sign-in.
- **Signed-in account:** starts with 3 credits → each scan calls `spend(1)` → at 0,
  the paywall scene appears.
- **Buy:** the existing **mock checkout** (`AccountContext.pay()` → processing →
  success; no real charge) now calls `creditsService.grant(packCredits)` on success,
  writing the selected pack's credits to the server balance. The credit packs already
  exist in `@fitaura/shared` (`starter` = 5, `pro` = 15, `group` = 40); for the demo
  the checkout defaults to the **`starter` pack (5 credits)**. No pack data changes.

### Credit enforcement
- `CREDITS_ENFORCED` (in `generation.tsx`) flips to **true**.
- `generation.tsx` delegates credit reads/spend to `creditsService` instead of its
  own `credits`/`freeUsed` fields.

---

## 7. Trust-domain split

- `fitaura.state` (in `generation.tsx`) keeps **only device data**:
  `face`, `outfit`, `result`, `history` — account-agnostic, never namespaced by
  user, never server-bound (privacy rule: photos stay on device).
- Removed from that blob: `credits` (now `profiles.credits`) and `freeUsed` (now the
  guest device flag in `creditsService`).
- Result: the two trust domains are cleanly separated; later cycles only touch
  `creditsService` internals.

---

## 8. Error handling

- `authService` / `creditsService` return typed results; never throw raw Supabase
  errors at the UI.
- Network/auth failures surface as `authStatus: 'error'` + message — no crash.
- Render-time throws are already caught by the `ErrorBoundary` added in dev-log 013.
- `spend` refuses when balance is insufficient (returns `{ ok: false }`), so the UI
  gates instead of going negative.

---

## 9. Testing

- **Unit:** `creditsService` (balance/spend/grant guard logic, Supabase client
  mocked); `authService` error-mapping (Supabase client mocked).
- **Manual / Playwright:** signup → 3 credits shown → scan spends 1 → buy grants +5 →
  reload persists session + balance → signout returns to guest state (device results
  remain, per the account-agnostic rule).
- `tsc --noEmit` + `vite build` clean (existing bar).

---

## 10. Files

**New**
- `apps/web/src/lib/supabase.ts`
- `apps/web/src/services/authService.ts`
- `apps/web/src/services/creditsService.ts`
- `apps/web/.env.example` (and local `.env.local`, gitignored)
- tests for the two services
- one Supabase migration (`profiles` + trigger + RLS)

**Edited**
- `apps/web/src/features/account/AccountContext.tsx` — real async auth, session as
  source of truth, async states, checkout grants server credits.
- `apps/web/src/features/account/AccountModals.tsx` — real password, remove OAuth
  buttons, pending/error UI.
- `apps/web/src/state/generation.tsx` — delegate credits to `creditsService`,
  `CREDITS_ENFORCED = true`, slim `fitaura.state` to device data.
- `apps/web/src/features/account/AccountContext.tsx` also: default the selected pack
  to `starter` (5 credits) for the demo. No `@fitaura/shared` pack data changes.
- `apps/web/.gitignore` (or root) — ensure `.env.local` ignored.

---

## 11. Dashboard setup (manual, already partly done)

- Email provider **on**; **Confirm email OFF** (done).
- No OAuth configuration needed this cycle.

---

## 12. Later cycles (for context, not this plan)

1. Harden credits (decrement via `SECURITY DEFINER` RPC; remove client update).
2. Real payment provider + server-side confirmation (webhook → `grant`).
3. Server-side AI generation (Edge Function) replacing `mockGenerations.ts`.
4. OAuth (Google) once a client is configured.
