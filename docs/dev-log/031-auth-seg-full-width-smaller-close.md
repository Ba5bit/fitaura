# 031 — Auth modal: full-width Sign up/Log in toggle + smaller close button

## Ask

On the auth modal, the **Sign up / Log in** segmented toggle was narrower than
the Email/Password inputs below it. Make the toggle span the same width as the
inputs, and shrink the X close button so the two don't clash in the corner.

## Change (`account-web.css`)

- Removed `.aw-auth .aw-seg { margin-right: 46px; }` — that reservation existed
  only to keep the toggle clear of the close button, and was what made it
  narrower. The toggle now spans the full `.aw-auth-right` width, matching the
  inputs.
- Shrank `.aw-modal-close`: `36×36 → 28×28`, radius `10 → 9`, inset
  `16 → 14`, glyph `16 → 14`. With the smaller button tucked tighter into the
  corner, it clears the now-full-width toggle.
- Dropped the now-redundant stacked-layout override
  (`.aw-auth .aw-seg { margin-right: 0 }`) — the default already has no right
  margin.

## Files

- `apps/web/src/design/account-web.css`
