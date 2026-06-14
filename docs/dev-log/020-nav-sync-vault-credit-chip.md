# 020 — Nav polish: de-glow landing Vault pill + credit chip on the Vault nav

Three small follow-ups to the v2 nav ([019](019-landing-v2-header-nav.md)) so the
landing and Vault top navs match exactly.

## Changes

### 1. Landing Vault pill — no glow
The active Vault pill on the landing had a `box-shadow` glow; the Vault page's own
active link (`.vlt-navlink[aria-current]`) has none. Dropped the glow and aligned
the pill's border/background to the Vault's values (accent 45% border, 9% fill)
so the two read identically.

### 2. Credit chip on the Vault nav (synced with landing)
The landing nav shows the balance chip (`AccountEntry`), but `VaultNav` only had
the profile avatar. Extracted the chip from `AccountEntry` into a shared
**`CreditChip`** component and rendered it in `VaultNav`'s `.vlt-navright` before
the avatar. `AccountEntry` now composes `CreditChip` + `ProfileMenu`, so both navs
use one source for the chip (signed-in → credits count → `/credits`; free scan →
"1 FREE VERDICT" → `/vault`; otherwise "0" → opens auth).

### 3. Mobile: hide the "credits" word on the Vault nav
The chip's `.credit-word` span is already hidden ≤760px by a global rule
(`components.css`), so adding the same chip to the Vault nav inherits the
landing's mobile behavior automatically — the chip shows just the number.

### Mobile overflow fix (regression from #2)
Adding the chip pushed the avatar off-screen at ≤375px (nav scrollWidth 417 vs
375). Tightened the Vault nav inside its `≤620px` block: smaller brand letter-
spacing/size, reduced side padding and gaps. Measured after: nav fits exactly
(scrollWidth 375 = clientWidth, avatar fully visible).

## Files

- `apps/web/src/design/landing.css` — `.ln-navlink.vault` glow removed, values
  matched to the Vault.
- `apps/web/src/features/account/AccountChrome.tsx` — extract + export
  `CreditChip`; `AccountEntry` composes it.
- `apps/web/src/features/vault/VaultNav.tsx` — render `CreditChip` in
  `.vlt-navright`.
- `apps/web/src/design/vault.css` — `≤620px` nav tightening so the chip + avatar
  fit.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server, screenshots + DOM measurement:
  - Landing Vault pill renders flat (no glow), matching the Vault.
  - Vault nav (desktop + 375px mobile) shows the chip + avatar; mobile no longer
    overflows (`document.scrollWidth === clientWidth`, avatar `right` within
    viewport).
  - Mobile chip shows the number only (the "credits" word hidden), same as the
    landing.
