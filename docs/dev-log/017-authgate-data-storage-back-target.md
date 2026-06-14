# 017 — "How your data is stored" back control returns to origin, not the vault

## Problem

Routing bug from the login-suggestion (`AuthGate`) panel:

1. `AuthGate` modal shows "How your data is stored".
2. It navigates to `/settings` (the data-storage description page).
3. On `/settings`, the `SubHead` back control read "Vault" and returned to
   `/vault` — even though the user opened the login suggestion from the landing
   page, not the vault.

## Root cause

`SubHead` (`features/vault/SubHead.tsx`) decides its back target from router
state: `location.state.from`. When set, it labels the button per `ORIGIN_LABELS`
and does `navigate(-1)` (history pop). When **not** set, it falls back to
`navigate('/vault')` with the label "Vault".

`ProfileMenu` already passes `navigate(to, { state: { from: pathname } })`, so
secondary pages reached via the profile menu return correctly. But `AuthGate`'s
"How your data is stored" link called `navigate('/settings')` with **no state**,
so `SubHead` hit the vault fallback.

## Change

Mirrored the `ProfileMenu` pattern in `AuthGate`: capture the current pathname
with `useLocation()` and pass it as `from` state when navigating to `/settings`.

```ts
navigate('/settings', { state: { from: pathname } });
```

Now `SubHead` does a history pop back to wherever the login suggestion was shown
(e.g. the landing page) and labels the button from the origin path.

## Files

- `apps/web/src/features/account/AccountModals.tsx` — `AuthGate`: import
  `useLocation`, read `pathname`, pass `{ state: { from: pathname } }` on the
  "How your data is stored" navigation.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Logic: `SubHead` uses `from` → `navigate(-1)` returns to the origin page; with
  the login suggestion opened on `/`, the back label resolves to "Home" via
  `ORIGIN_LABELS`. Paths without a label fall back to a generic "Back", still
  popping to the correct page.
