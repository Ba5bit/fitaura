# 012 — Vault dashboard (v3 IA): account area → Card Vault

## Why

Per the updated product context (`aura_project_context_vault_flow_v3.md`), the
authenticated experience is no longer an account/settings page — it's the
**Vault**, the product home: a scan-mode workspace that leads with generated
verdicts. The old `/account` dashboard + `/results` + `/storage` + the crowded
account nav were replaced.

Flow: **Landing → CTA → Vault → Generate → upload → scanner → Result → back to
Vault**. Scan-first / account-optional: the vault is open to guests, the first
scan is free, sign-in is offered but never forced.

## What changed

Ported the design prototype (`vault.css`, `vault-app.jsx`, `vault-modes.jsx`,
`vault-pages.jsx`, `account-data.jsx`) into the real React/TS app, rewired from
mock data / `window.location` to the real state + react-router.

### Routes (`App.tsx`)
- `/vault` → `Vault` (NEW) — product home, avatar default + Landing CTA target, **not** auth-gated
- `/account` → `AccountInfo` (NEW) — identity/login status; guest-guarded
- `/credits` → `Pricing` (NEW design; replaces `CreditsPage`) — packs wired to existing `startCheckout`
- `/settings` → `Settings` (NEW) — privacy + on-device storage meter + clear-all + preferences
- `/storage` → redirect `/settings`; `/results` → redirect `/vault`

### New feature folder `features/vault/`
`Vault` (mode rail + body), `VaultNav` (compact nav Home · Vault · profile
dropdown), `SoloMode` (generate panel + collection of real `history`, Outfit-image
thumbnail, open/download/manage), `LockedMode` (Friend vs Friend / Glow Up
coming-soon), `AccountInfo`, `Pricing`, `Settings`, `SubHead`, `modes.ts`.

### State (`state/generation.tsx`)
- `removeResult(id)` — delete a verdict from on-device history (clears the open result if it was that one)
- `renameResult(id, name)` — rename a verdict; added optional `name` on `GenerationResult`

### Other
- `icons.tsx`: added `home`, `grid`, `users`, `sparkle`, `gear`, `dots`, `open`, `layers`, `pencil`, `key`.
- `design/vault.css` added; `account-web.css` retained (still styles the auth/checkout/paywall/success/logout scenes via `AccountOverlays`).
- `AccountContext.signIn()` post-auth destination `/credits` → `/vault`.
- `AccountChrome` trimmed to just `AccountEntry` (Landing nav), retargeted to `/vault`.
- `Landing` CTAs `to="/scan"` → `to="/vault"` (5).
- `Result` + `Upload` got a clear **Back to Vault** control.
- Removed: `AccountDashboard.tsx`, `ResultsPage.tsx`, `StoragePage.tsx`, `CreditsPage.tsx`, and the old `AccountNav`/`ResultTile`/`useResultTiles`/`UnlockList`.

### Card actions (decision)
Open / Download / Edit-in-Card-Studio all route to the **Result page** (which
already owns export/share/edit; card studio was folded into Result in dev-log
007). The export pipeline was **not** rebuilt in the vault. Rename + Delete are
real on-device ops.

## Verification

- `tsc --noEmit` clean; `vite build` clean (103 modules).
- Live (Playwright, dev server): vault renders for guest (free-verdict chip +
  empty state), locked Friend/Glow Up coming-soon hero, sign-up → signed-in
  vault, profile dropdown, Pricing (packs + balance), Settings (data-lives,
  storage meter, clear-all, reduce-motion toggle, receipt-paper segment). No
  console errors beyond a favicon 404.

## Follow-up fix — shared ProfileMenu on the Landing

The Landing's `AccountEntry` avatar navigated to `/vault` instead of opening the
profile dropdown. Extracted the dropdown into a shared `features/account/ProfileMenu.tsx`
(avatar + dismissible menu; guest → "Sign in") used by **both** `VaultNav`
(`avatarClassName="vlt-avatar"`) and the Landing `AccountEntry`
(`avatarClassName="aw-avatar"`). Now the profile button shows the same
Account info · Pricing & credits · Settings · Log out dropdown everywhere.
Verified on the Landing via the accessibility tree (menu opens with identity +
all four items).

## Known minor follow-up

Clicking "Vault" / signing in while already on `/vault` keeps the previously
selected mode (the `Vault` component doesn't remount, so internal `mode` state
isn't reset to Solo). Cosmetic; lift mode to the URL if it matters later.
