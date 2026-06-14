# 022 — Auth modal: close button no longer overlaps the Sign up / Log in tabs

## Problem

In the two-column auth modal (`AuthGate`, `WebModal size="lg"`), the top-right
close button (`.aw-modal-close`, `right:16; width:36` → occupies ~16–52px from the
modal's right edge) overlapped the segmented **Sign up / Log in** tabs
(`.aw-seg`), which span the full width of the right panel down to ~36px from the
edge. The "Log in" tab sat under the X.

## Fix

Reserve horizontal clearance for the close button on the auth modal's tab strip:

- `.aw-auth .aw-seg { margin-right: 46px; }` — shortens the tab strip so its right
  edge clears the close button (scoped to the auth modal; other modals don't have
  interactive content in that corner).
- In the `≤880px` stacked layout the left panel moves on top and the close button
  sits over it, so the tabs reclaim full width: `.aw-auth .aw-seg { margin-right: 0; }`.

## Files

- `apps/web/src/design/account-web.css` — `.aw-auth .aw-seg` right margin +
  mobile reset.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server, opened the auth modal via the guest avatar (`aria-label="Sign in"`):
  - Desktop (1280px): clear gap between the "Log in" tab and the X — no overlap.
  - Stacked (560px): tabs span full width, X over the header area — no overlap.
