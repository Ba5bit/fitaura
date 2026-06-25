# 073 — Vault reopens the mode you came from

**Date:** 2026-06-25
**Area:** Vault ↔ result navigation (`apps/web/src/features/vault/Vault.tsx`,
`features/versus/VersusResult.tsx`, `features/result/Result.tsx`)

Going back to the Vault from a **Friend vs Friend** verdict dumped you on **Solo Scan**, and
vice-versa — the Vault always booted to Solo.

## Why
`Vault` held its active tab in `useState<ScanModeId>('solo')`. Routing unmounts/remounts
`Vault` on every visit, so the initializer re-ran to `'solo'` no matter where you came from.

## Fix
Carry the intended tab in React Router **navigation state** at the point of leaving:

- `VersusResult` "Vault" button → `navigate('/vault', { state: { vaultMode: 'friend' } })`
- `Result` "Vault" button → `navigate('/vault', { state: { vaultMode: 'solo' } })`

`Vault` reads `useLocation().state?.vaultMode`, **validates it against `SCAN_MODES`**, and
seeds `useState` with it — anything invalid or a direct visit falls back to `'solo'`. State
(not a query param) keeps the URL clean; the remount-runs-initializer behavior that caused
the bug is exactly what makes this read fresh each return.

## Verification
`tsc` clean; web **187** tests green. Not unit-tested at the routing layer (no router tests
in repo) — logic is a validated state read. Live click-through still worth a smoke before
ship. Local/uncommitted, push held.
