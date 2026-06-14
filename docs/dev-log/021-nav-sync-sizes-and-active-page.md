# 021 — Nav parity: match Landing/Vault sizes + active pill follows current page

Two issues with the Home/Vault top nav after [020](020-nav-sync-vault-credit-chip.md):
the landing's logo/pills/avatar were sized differently from the Vault's, and the
landing always highlighted **Vault** even though you're on Home.

## Changes

### Active pill follows the current page
- **Landing** (`Landing.tsx`): the **Home** pill is now the active/blue one
  (`.ln-navlink.active` + `aria-current="page"`); the Vault pill is inactive. The
  old hardcoded active-Vault was the "fixed color" the user saw.
- **Vault** (`VaultNav.tsx`): already highlights Vault on `/vault` — unchanged.
- Renamed the landing active style `.ln-navlink.vault` → `.ln-navlink.active`
  (page-agnostic).

### Size/element parity (landing → match the Vault)
The landing nav was visibly heavier than the Vault's. Aligned the landing values
to the Vault nav (`vlt-*`):
- **Nav box**: padding `16px 40px` → `16px clamp(20px,4vw,52px)`, gap `20px` → `24px`.
- **Brand wordmark**: added `color: var(--ink)` (was inheriting a different tone);
  size/spacing already matched.
- **Pills** (`.ln-navlink`): font `14px` → `13.5px`, padding `9px 16px` →
  `9px 15px`, icon `16px` → `15px`, `.ln-navmid` gap `8px` → `6px`, hover
  background → `var(--panel)` — all matching `.vlt-navlink`.
- **Avatar** (`.aw-avatar`, shared via `AccountEntry`): `40px`/`font 15` →
  `42px`/`font 16` and the same hover/focus ring as `.vlt-avatar`.

The balance chip is already the shared `CreditChip` (`.aw-chip`), identical on
both surfaces.

## Files

- `apps/web/src/features/landing/Landing.tsx` — Home pill active, Vault inactive.
- `apps/web/src/design/landing.css` — nav padding/gap, brand color, pill sizes,
  `.vault` → `.active`.
- `apps/web/src/design/account-web.css` — `.aw-avatar` sized to match
  `.vlt-avatar`.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server screenshots at 1440px: Landing shows **Home** active (blue), Vault
  page shows **Vault** active; logo, pills, chip and avatar are visually identical
  across the two pages.
- Mobile: no overflow on the landing at 360px (`scrollWidth === clientWidth`)
  after the +2px avatar bump; the Vault mobile fit from #020 still holds.
