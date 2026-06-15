# 030 — Fix: logout impossible (Supabase auth-lock deadlock)

## Symptom

Clicking **Log out → Log out** in the profile menu did nothing — the confirm
dialog's action never completed, so the user stayed signed in.

## Root cause

Two compounding defects in `AccountContext.tsx`:

1. **Auth-lock deadlock (real cause).** The `onAuthChange`
   (`supabase.auth.onAuthStateChange`) callback awaited a Supabase *data* query:

   ```ts
   const apply = async (uid, ...) => {
     ...
     setCredits(await getBalance(uid)); // supabase.from('profiles').select(...)
   };
   ```

   A data query needs the access token, which acquires the **auth lock** — but
   the `onAuthStateChange` callback already runs *while that lock is held*. This
   is the documented supabase-js anti-pattern: never `await` a Supabase call
   inside `onAuthStateChange`. The balance fetch deadlocks the lock; later
   `signOut()` does `_acquireLock(-1, …)` (wait forever) on that same lock, so
   `await authSignOut()` in `confirmLogout` hangs and the state-clear / navigate
   lines after it never run.

2. **No resilience in `confirmLogout`.** Even without the deadlock, if
   `signOut()` errored (offline / expired token), everything after the `await`
   was skipped and logout silently did nothing.

Unit tests passed throughout because they mock `signOut`/`getBalance`, so the
lock never engages — the deadlock only happens against the real client.

## Fix

- **Split identity from balance.** The auth-change effect now only sets
  `userId`/`user` (synchronous, no `await`). A separate `useEffect` keyed on
  `userId` fetches the credit balance — i.e. *after* the auth lock is released.
- **Drop the redundant inline `getBalance`** in `logIn`; the `userId` effect
  now owns balance loading (single source of truth).
- **Resilient `confirmLogout`.** Close the dialog first, wrap `authSignOut()` in
  `try/catch`, and clear local state + `navigate('/')` regardless of the
  network call's outcome, so a slow/failed `signOut` can never strand the user
  "logged in".

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 9 files, 43 tests pass.
- Live in-browser logout repro not run here (needs a signed-in session against
  real Supabase); the fix applies the documented-safe onAuthStateChange pattern.

## Files

- `apps/web/src/features/account/AccountContext.tsx`

## Addendum — why it only reproduced on localhost

The deadlock surfaced on `localhost` but not on the Vercel-hosted build. Cause:
`<StrictMode>` (`main.tsx`) double-invokes effects **in dev only**. The double
mount fired concurrent `getSession`/`getBalance` calls that contended for the
Supabase auth lock, reliably triggering the deadlock; the production build does
not double-invoke, so the race usually didn't trip. (Same StrictMode footgun
that bit `runGeneration` earlier.)

Hardened `confirmLogout` further: it no longer `await`s `signOut()`. It clears
local state and navigates immediately, then revokes the session in the
background (`void authSignOut().catch(...)`). A `try/catch` only guards against a
*throw*; a *hang* would still strand the user — firing-and-forgetting can't.
