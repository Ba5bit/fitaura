# 024 — Sync the back-button shape (Upload page → `.vlt-back` pill)

## Problem

The "← Vault" back control was styled two different ways:
- **Upload page** (`/scan`): a plain inline text link (inline styles, no pill).
- **Vault secondary pages** (Account Info, Settings, Credits via `SubHead`): a
  rounded **`.vlt-back`** pill (border + panel background).

## Change

Converted the Upload page's back link to the shared `.vlt-back` pill so both
back controls ("back to previous page" in `SubHead` and "back to Vault" on Upload)
have the same shape. `vault.css` is already imported globally in `App.tsx`, so the
class is available on the Upload page.

```tsx
<Link to="/vault" className="vlt-back" style={{ textDecoration: 'none' }}>
  <Icon.back /> Vault
</Link>
```

(Removed the bespoke inline styles and the hard-coded `Icon.back` size — `.vlt-back`
already sizes the icon to 16px.)

## Files

- `apps/web/src/features/upload/Upload.tsx` — inline back link → `.vlt-back` pill.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server screenshot of `/scan`: the "← Vault" control now renders as the same
  rounded pill used by `SubHead` on the Account Info page.
