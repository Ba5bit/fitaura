# Per-Account On-Device Vault (IndexedDB) — Design

**Date:** 2026-06-15
**Status:** Approved design, pending implementation plan
**Area:** `apps/web/src/state` (generation store), `apps/web/src/features/account/AccountContext.tsx`, consumers of `useGeneration` (`Result.tsx`, `Scan.tsx`, `SoloMode.tsx`)

## Problem

On-device data (uploaded photos, the current verdict, and recent history) is saved
under a **single global localStorage key** (`fitaura.state` in
`apps/web/src/state/generation.tsx`). Every account that logs in on the same browser
reads the same blob, so **one account can see another account's photos and results** on a
shared desktop. Two further limits compound it:

1. localStorage caps at ~5 MB per origin; photos are stored inline as base64 data URLs, so
   history is artificially capped at **4** results (`HISTORY_CAP`).
2. There is no retention — old generations live forever (until the cap evicts them).

## Decisions (from brainstorming)

- **Isolate per account.** Key all on-device generation data by the Supabase `userId`
  (`guest` when signed out). Logging out hides an account's data; logging back in restores
  it; other accounts never see it.
- **Move to IndexedDB.** Replace localStorage for the generation store so it can hold many
  results reliably (large quota). Practically **uncapped**, with a safety backstop of
  **100** newest per account.
- **Guest → login hand-off.** On the guest→signed-in transition, move the guest's pending
  photos + current result into the account, then clear the guest space. Preserves the
  "scan as guest → sign up → see your verdict" flow.
- **Logout keeps data** under the account namespace (hidden from others, restored on
  re-login).
- **14-day expiry by created-time.** Any generation whose `producedAt` is more than 14 days
  old is auto-deleted on load. The clock is the creation time and never resets.

## Architecture

### New IndexedDB layer — `apps/web/src/state/generationDb.ts`

A small async wrapper around one database. **No third-party IndexedDB library** — thin
hand-rolled promise wrappers over the native API (the surface is small).

**Database:** name `fitaura`, version `1`. Two object stores:

- **`results`** — one record per generation.
  - keyPath: `id` (string) = `` `${accountKey}::${generationId}` ``
  - fields: `{ id, accountKey, result }` where `result: GenerationResult` (already carries
    `producedAt` and optional `name`).
  - index: `by_account` on `accountKey` (non-unique) for per-account queries.
- **`session`** — one small record per account holding the "current scan" pointers.
  - keyPath: `accountKey` (string).
  - fields: `{ accountKey, face: UploadedPhoto | null, outfit: UploadedPhoto | null, currentResultId: string | null }`.
  - The current result object is **not** duplicated here — `currentResultId` points into
    `results` (single source of truth).

`accountKeyFor(userId: string | null): string` → `userId ?? 'guest'`.

**Wrapper API (all async):**

- `loadAccount(accountKey, now): Promise<{ session, results }>` — reads the session record
  and all results for the account via `by_account`, **prunes expired** (see Expiry) and
  applies the safety cap, returns results sorted by `producedAt` descending.
- `putResult(accountKey, result): Promise<void>` — upsert; then trim to the cap.
- `deleteResult(accountKey, generationId): Promise<void>`.
- `renameResultDb(accountKey, generationId, name): Promise<void>`.
- `putSession(accountKey, session): Promise<void>`.
- `pruneExpired(accountKey, now, maxAgeDays): Promise<string[]>` — deletes expired results,
  returns the surviving generationIds (so the caller can clear a dangling `currentResultId`).
- `moveAccountData(fromKey, toKey): Promise<void>` — guest→account hand-off (see below).
- `clearAccount(accountKey): Promise<void>`.
- `migrateLegacyLocalStorage(): Promise<void>` — one-time import (see Legacy migration).

### Pure, unit-testable helpers (no IDB)

Kept as plain functions so the merge/expiry/cap logic is tested without a database:

- `isExpired(producedAt: string, now: number, maxAgeDays = 14): boolean` —
  `now - Date.parse(producedAt) > maxAgeDays * 86_400_000`.
- `trimToCap(results: GenerationResult[], cap = 100): GenerationResult[]` — keep the newest
  `cap` by `producedAt`.
- `mergeGuestIntoAccount(account, guest)` — returns the merged session + results: guest's
  `face`/`outfit`/current `result` **override** the account's current scan (the guest just
  made them), the guest result is prepended to the account's results (de-duped by
  generationId, then capped), and the account's existing history is preserved.

### Constants

- `MAX_AGE_DAYS = 14`
- `SAFETY_CAP = 100` (replaces `HISTORY_CAP = 4`)

### `GenerationProvider` (rewrite of `generation.tsx`)

Same public context API as today, plus one field. It now reads the account from
`useAccount()` and is **async-backed**.

- Reads `const { userId } = useAccount();` → `accountKey = accountKeyFor(userId)`.
  (Requires exposing `userId` from `AccountContext` — see below.)
- Holds the in-memory mirror: `face`, `outfit`, `result` (resolved from
  `currentResultId`), `history`, and a new **`hydrated: boolean`**.
- **Hydration / account switch:** an effect keyed on `accountKey` calls
  `loadAccount(accountKey, Date.now())`, sets state, and flips `hydrated` true. While a load
  is in flight after a switch, `hydrated` is false.
- **Guest→login hand-off:** track `prevUserId` in a ref. When it transitions
  `null → <id>` (a real login, not a reload — a reload starts `prevUserId === undefined`),
  call `moveAccountData('guest', <id>)` before/while hydrating the account, then hydrate.
- **Mutations** write through to IDB then update state:
  - `setFace`/`setOutfit` → `putSession`.
  - `runGeneration` → on success `putResult` + set `currentResultId` via `putSession`;
    update `result` + prepend to `history`.
  - `startNewScan` → clear `face`/`outfit` in session.
  - `openResult` → set `currentResultId` in session; resolve `result`.
  - `removeResult` → `deleteResult`; clear `currentResultId` if it matched.
  - `renameResult` → `renameResultDb`; update mirror.

### Exposing the account id

`AccountContext` already holds `userId` in state but doesn't surface it. Add
`userId: string | null` to `AccountContextValue`, the provider's `value` object, and its
memo dependency array. No behavior change for existing consumers.

### The `hydrated` gate (async-read consequence)

localStorage reads were synchronous; IndexedDB is not, so right after a reload `result`
and `history` are momentarily empty. Consumers that branch on "no result → redirect" must
wait for `hydrated`. The plan will audit and update:

- `Result.tsx` — must not redirect away (e.g. to `/`) while `!hydrated`.
- `Scan.tsx` / `SoloMode.tsx` — any logic gating on presence of photos/result.

## Expiry (14-day, created-time)

- On every `loadAccount` (app start and each account switch), `pruneExpired` deletes results
  with `isExpired(result.producedAt, now, 14)`.
- If the surviving set no longer contains the session's `currentResultId`, that pointer is
  cleared (the open result expired → `result` becomes null).
- Pending in-progress photos (`session.face`/`outfit`) are **not** expired — only finished
  generations in `results`.
- The clock is `producedAt` (creation) and never resets on view/open.

## Legacy migration (one-time)

On DB init, `migrateLegacyLocalStorage()` runs once:

1. Read `localStorage['fitaura.state']`. If absent, do nothing.
2. Coerce it (old blobs may predate `history`); write its `history` (and `result` if not
   already in history) into `results` under the **`guest`** account, and its
   `face`/`outfit`/current id into the `guest` `session`.
3. `localStorage.removeItem('fitaura.state')` — reclaims the ~MB of orphaned photo data and
   makes the step idempotent (it never runs again).

Migrating to **guest** (not a specific account) is deliberate: the legacy blob was
account-agnostic, and a subsequent guest→login hand-off will carry it into the first
account that signs in.

## Out of scope / intentionally unchanged

- **Stays in localStorage:** `fitaura.tab` (UI tab pref, not private) and
  `fitaura.freeScanUsed` (per-device guest anti-abuse — one free scan per device by design).
- **Photos remain data-URL strings** inside IDB (not converted to Blobs). IDB's quota makes
  this reliable, and it avoids rewriting the card image pipeline + object-URL lifecycle.
  Blob storage is a possible future optimization, explicitly not done here.
- Server-side storage is untouched — photos/results still never leave the device.

## Risks

- **Async hydration flicker / false redirects.** Mitigated by the `hydrated` gate; the plan
  must verify each `useGeneration` consumer respects it.
- **IndexedDB unavailability** (private-mode quirks, disabled storage). The wrapper should
  fail soft: on open failure, the provider degrades to an in-memory-only session (no
  persistence) rather than crashing. Hydrated still flips true.
- **StrictMode double-mount (dev).** Effects run twice; hand-off and migration must be
  idempotent (migration deletes its source; `moveAccountData` is a no-op once guest is
  empty).
- **Multi-tab writes.** Two tabs on the same account can race; last-write-wins is
  acceptable for an entertainment app (matches today's localStorage behavior).

## Testing

- **Pure helpers:** `isExpired` boundary (just under / just over 14 days), `trimToCap`,
  `mergeGuestIntoAccount` (guest overrides current scan; account history preserved;
  de-dupe; cap).
- **IDB wrapper** with `fake-indexeddb` (new devDependency, imported via
  `fake-indexeddb/auto` in the test): per-account isolation (account A's results invisible
  to account B), `pruneExpired` removes only expired + clears dangling `currentResultId`,
  `moveAccountData` hand-off, `migrateLegacyLocalStorage` runs once.
- Existing `creditsService`/scoring/etc. suites must stay green.
