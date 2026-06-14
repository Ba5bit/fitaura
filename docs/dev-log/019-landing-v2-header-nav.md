# 019 — Landing v2: header nav rework (Home / Vault pills)

Follow-up to [018](018-landing-v2-hero-modes-rail.md) — the header rework that was
deferred there. Completes the v2 nav so the public landing mirrors the Vault's own
top nav (`features/vault/VaultNav.tsx`) and the two surfaces read as one product.

## Change

Reworked the landing `Nav` (`features/landing/Landing.tsx`):

- **Removed** the four text links (`How it works · The verdict · Examples ·
  Credits`) and the standalone **"Get your verdict"** primary button.
- **Added** centered **Home** + **Vault** pills (`.ln-navmid` / `.ln-navlink`):
  - Home → `#top` (scroll to top), house icon.
  - Vault → `/vault`, grid icon, shown **active** (cyan fill + outline + glow,
    `aria-current="page"`).
- Brand wordmark is now an `<a href="#top">` (was an inert `<div>`).
- Right side keeps `AccountEntry` (credits chip + profile avatar) — the chip is
  the primary "1 free verdict / open Vault" action, so no separate CTA button is
  needed.
- **Mobile menu** updated: Home · Scan modes · Credits + an "Open the Vault" CTA
  (was the old text links + "Get your verdict"). Burger unchanged; `.ln-navmid`
  is hidden ≤760px alongside the legacy `.ln-nav-links`.

`NAV_LINKS` constant removed (no longer referenced).

## Files

- `apps/web/src/features/landing/Landing.tsx` — `Nav` rewrite, drop `NAV_LINKS`.
- `apps/web/src/design/landing.css` — `.ln-navmid`, `.ln-navlink(.vault)`,
  `.ln-brand` link reset; hide `.ln-navmid` at ≤760px.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Ran the dev server and screenshotted the header at 1440px: brand left, centered
  Home + active cyan Vault pill (grid icon), AccountEntry chip ("1 FREE VERDICT")
  + avatar right. Old links and the "Get your verdict" button are gone — matches
  the v2 reference mockup.
