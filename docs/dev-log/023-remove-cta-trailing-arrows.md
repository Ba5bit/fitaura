# 023 — Remove trailing arrows from CTA buttons

## Change

Removed the decorative trailing arrow on call-to-action buttons across the site.

- **`Icon.arrow`** removed from 8 buttons:
  - Landing: "Open the Vault", "Scan me — it's free", "Run your first scan free",
    "Start a Solo Scan", "Get your verdict", mobile bar "Scan me".
  - Scan: the reveal button ("Reveal my verdict" / "Log in to reveal…").
  - Auth modal: "Create account" / "Log in" submit.
- **Literal `→`** removed from the Landing credit-pack CTA ("Get N credits").

## Kept (intentionally)

Functional navigation arrows that are not decorative trailing CTA arrows:
- `Icon.back` on the back controls (`SubHead` "← Vault/Back", Upload "← Vault") —
  the arrow signals "go back".
- `Icon.chevronLeft/Right` on the Result card carousel — icon-only prev/next
  controls; removing them would leave empty buttons.

(Can remove these too on request.)

## Files

- `apps/web/src/features/landing/Landing.tsx`
- `apps/web/src/features/scan/Scan.tsx`
- `apps/web/src/features/account/AccountModals.tsx`

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server screenshots: landing hero ("Scan me — it's free", "Explore the
  modes") and the Vault "Generate verdict" button render cleanly with no trailing
  arrows. The CSS `gap` on those buttons is harmless with a single (text-only)
  child.
