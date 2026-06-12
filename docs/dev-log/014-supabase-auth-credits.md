# 014 — Supabase auth + per-account credits (Cycle 1)

First backend-integration cycle. Replaces mock auth with real Supabase email/
password auth, introduces a service-layer seam, splits the localStorage trust
domains, and moves credits to Postgres (3 per account). Payments stay mock; OAuth
deferred. Spec: `docs/superpowers/specs/2026-06-12-supabase-auth-credits-design.md`.
Plan: `docs/superpowers/plans/2026-06-12-supabase-auth-credits.md`.

`tsc --noEmit` + `vite build` clean; 11 unit tests pass; full auth/credits flow
verified live against the real project via Playwright + SQL.

## The service seam (why first)
The frontend audit (§9) flagged that all flow logic lived directly in React
contexts calling mocks — so a Supabase swap would mean rewriting the contexts
twice. The fix is a thin service layer the contexts call instead:

- `lib/supabase.ts` — single typed client (`createClient<Database>`), env-driven
  (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `.env.local` gitignored,
  `.env.example` committed). The publishable key is client-side by design — **RLS**
  is the protection boundary, not key secrecy.
- `services/authService.ts` — the only file touching `supabase.auth`. Returns typed
  `{ ok, user } | { ok:false, error }` and maps raw Supabase messages to friendly
  copy. Exposes `onAuthChange` so the session, not localStorage, is the source of
  truth.
- `services/creditsService.ts` — the only file touching the `profiles` table.
  `getBalance` / `spendCredit` (refuses at 0) / `grantCredits`, plus the guest
  free-scan flag (the one credit-domain value that stays on the device).

Both services are unit-tested with the supabase client mocked (`vi.hoisted` so the
mock factory — which is hoisted above the file — can reference the spies).

## Database (server-authoritative credits)
One migration: `profiles (id uuid pk → auth.users, credits int not null default 3,
created_at)`, RLS **owner-only select/update**, and a `SECURITY DEFINER` trigger
`handle_new_user` that inserts a profile row on signup — so **every new account
starts at 3 credits enforced by the DB default**, not client code. A follow-up
migration `revoke execute … from anon, authenticated, public` on the trigger fn to
clear the two advisor WARN lints (triggers fire regardless of EXECUTE grants).
Types generated into `lib/database.types.ts`.

## Trust-domain split
`generation.tsx` previously mixed server-domain (`credits`, `freeUsed`) and
device-domain (`face/outfit/result/history`) in one `fitaura.state` blob. Now:
- `generation.tsx` holds **device data only** (and drops legacy credit fields on
  read for old blobs). `runGeneration` only fails on `missing_photos`.
- Account credits live in `profiles`; the guest free-scan flag lives in
  `creditsService` (`fitaura.freeScanUsed`). Device data stays **account-agnostic**
  (signing in/out never touches photos/results — privacy rule preserved).

## Context + provider changes
- `AccountContext` is now the server-domain orchestrator: session (via
  `onAuthChange` + `getCurrentSession`), reactive `credits` balance, `canScan` /
  `freeScanAvailable`, `spendForScan`, and the scene/checkout flow. It no longer
  imports `useGeneration` — which let us **invert the provider order** in `App.tsx`
  to `AccountProvider` (outer) → `GenerationProvider` (inner), since generation's
  consumers now read credits from `useAccount`.
- Async auth states added (`authStatus` `idle|pending|error`, `authError`) — the
  audit's §11 gap. `AuthGate` reads the real password field, shows pending/disabled
  + inline error, and **drops the Apple/Google OAuth buttons**.
- Credit consumers re-pointed from `useGeneration` → `useAccount` across
  `AccountChrome`, `Result`, `SoloMode`, `Landing`, `Upload`, `Pricing`, and the
  `PaySuccess` modal (more call-sites than the plan first found — `isFree`→
  `freeScanAvailable`, `canAffordScan`→`canScan`).

## Flows
- **Guest:** first scan free (device flag), reveals without login — this changed
  `Scan.tsx`, which previously forced login before *any* reveal. Gating is now
  `canScan`; a used-up guest is sent to auth, a signed-in user at 0 hits the paywall.
- **Account:** starts with 3 credits; each reveal calls `spendForScan` (server
  decrement). The mock checkout now grants the **selected pack's** credits server-
  side (`grantCredits`); the demo defaults to the `starter` pack (5).

## Live verification (Playwright + SQL, real project)
Signup → DB trigger created the row with `credits=3` (confirmed via SQL) → UI showed
3 → bought the starter pack via mock checkout → success screen "+5 / 8 credits",
SQL confirmed `credits=8` → reloaded → session + balance persisted. 0 console errors.

## Known limitations (deferred — see spec §1/§12)
- **Credits not forgery-proof:** owner-`update` RLS lets a user rewrite their own
  balance; hardening = a `SECURITY DEFINER` decrement RPC (next cycle).
- Guest free-scan flag is device-local — clearing localStorage resets it.
- No real payment provider; no OAuth; no `profiles` editing / `display_name`.
- Server-side AI generation still mocked (`mockGenerations.ts`).

## Setup notes
Dashboard: Email provider on, **Confirm email OFF** (so signup yields an active
session immediately — good for demos). No OAuth config needed this cycle. New deps:
`@supabase/supabase-js` (runtime), `vitest` + `jsdom` (dev/test).
