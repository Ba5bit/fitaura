# 066 — Account-synced preferences (default receipt paper + reduce motion)

**Date:** 2026-06-23
**Scope:** New `profiles` columns + migration, `preferencesService.ts`,
`state/preferences.tsx` (PreferencesProvider), wired into `App.tsx`, consumed by
`Settings.tsx` and `Result.tsx`. Generated types updated.

## Symptom / ask
On `/settings`, the **Default receipt paper** segmented control "didn't work" and
was missing styles the receipt cards actually offer — the card switcher has four
papers (`neon` → *Dark neon*, `thermal`, `premium` → *Onyx*, `white` → *Ivory*),
but Settings showed only three (no Ivory). Follow-up: **"save the account's
preferences across all devices."**

## What was actually wrong
Two things, one cosmetic and one architectural:

1. **Missing option** — Settings hard-coded three buttons; `white`/Ivory was
   never there. (`ReceiptPaper = 'neon'|'thermal'|'premium'|'white'`.)
2. **Device-local only** — both prefs were `useLocalStorage('fitaura.paper' /
   '…reduceMotion')`. So they never followed the account to another device, and
   the reduce-motion `<html>` reflection lived in a `useEffect` **inside the
   Settings page** — meaning the attribute only (re)applied while that page was
   mounted, not app-wide on load. That's the "doesn't really work" underneath the
   report; the buttons toggled locally but had no durable, cross-device home.

## Design (mirror the credits pattern)
Account data already lives on a per-account `profiles` row (`credits`), under
owner-only RLS (`auth.uid() = id` for SELECT + UPDATE, row-level so new columns
are writable client-side just like `credits`). So preferences go there too —
no new table:

```sql
alter table public.profiles
  add column receipt_paper text not null default 'neon',
  add column reduce_motion boolean not null default false;
alter table public.profiles add constraint profiles_receipt_paper_chk
  check (receipt_paper in ('neon','thermal','premium','white'));
```

- `services/preferencesService.ts` — `getPreferences` / `savePreferences`, same
  shape as `creditsService` (best-effort, validates paper against the 4 values).
- `state/preferences.tsx` — `PreferencesProvider` + `usePreferences()`. Holds
  `{ receiptPaper, reduceMotion }`, seeded **synchronously** from the localStorage
  mirror (instant render, guest-friendly). Reconciliation:
  - **on sign-in** (`userId` change): fetch the account row; if present it wins
    and is written back to the mirror → a fresh device reflects the account.
  - **on change**: update state + mirror, and if signed in, `savePreferences`
    (server). Guests are mirror-only.
  - Centralizes the reduce-motion `<html>` attribute here (always mounted), fixing
    the page-scoped reflection bug.
  - Keeps the **same** localStorage keys (`fitaura.paper`, `fitaura.reduceMotion`)
    so existing device choices carry over and the delete-account `fitaura.*` wipe
    still clears them.
- Mounted in `App.tsx` just inside `AccountProvider` (needs `userId`).
- `Settings.tsx` + `Result.tsx` both read paper from `usePreferences()`, so the
  settings default and the on-card switcher are one synced source of truth.
  Settings now lists all four papers with the card labels.

## Verification
- `tsc -p apps/web` → clean. `vitest run apps/web` → **188 passed**.
- DB: migration applied to the live project; both columns present, all **74**
  existing rows backfilled to `neon` / `false`; check constraint active.
- Repo migration file added (`20260623120000_account_preferences.sql`) to keep
  schema version-controlled.

## Deploy note
The additive migration is **already live on the remote** (applied via MCP); the
columns are unused by the currently-deployed frontend, so there's no window of
breakage. The client code ships on the next web deploy (push held — iterative
session).

## Takeaway
"Make it work across devices" = give the preference a server home, then treat
localStorage as a **mirror/cache**, not the source of truth. And app-wide side
effects (the `<html>` reduce-motion attribute) belong in an always-mounted
provider, never in a single page's `useEffect`.
