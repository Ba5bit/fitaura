# 018 — Landing v2: multi-mode hero, Scan Modes section, scroll-spy rail

Brings the marketing landing in line with the v2 design notes
(`Fitaura Landing v2 — Design Notes.md`), keeping the existing cyan visual
direction (the reference mockups were color-only mockups). Scope was confirmed
with the user: content + Scan Modes section + left rail — **not** the header nav
rework (header kept as-is).

## Changes

### Hero (multi-mode promise)
- Eyebrow `FACE · OUTFIT · DATING RECEIPT` → **`SOLO · FRIEND VS FRIEND · GLOW UP`**.
- Headline `UPLOAD YOUR FACE AND OUTFIT. GET YOUR FULL VERDICT.` →
  **`EVERY AURA HAS A VERDICT.`** (`VERDICT.` keeps the `.hl` cyan).
- Sub rewritten to the three-mode pitch.
- Second CTA `See examples → #examples` → **`Explore the modes` → `#modes`**.
  Primary CTA (`Scan me — it's free` → `/vault`) unchanged.

### New Scan Modes section (`#modes`)
- Inserted after **How**, before **Bundle**.
- Driven by the Vault's existing `SCAN_MODES` data (`features/vault/modes.ts`),
  so landing copy and the in-product mode list share one source of truth.
- **Solo Scan** — live: lime *Available now* status, cyan CTA
  **Start a Solo Scan → /vault**.
- **Friend vs Friend** / **Glow Up** — locked: `LOCKED` badge, gold
  *Coming soon* status, **disabled** dashed "Coming soon" button (no action),
  per the product rule that future modes are never presented as working actions.
- Lightweight per-mode preview mocks (`ModePreview`): Solo = Face/Outfit/Receipt
  tiles, Friend = VS, Glow Up = before/after bars.

### Examples section removed
- The `Examples` component ("Three outcomes. One of them is you.") and its render
  were deleted; unused imports (`VERDICT_LABEL`, `DatingVerdict`) dropped.
- Footer Product link `Examples → #examples` → **`Scan modes → #modes`**.

### Left scroll-spy rail (`SectionRail`)
- Fixed left-gutter numbered rail (1–4): The verdict (`#outputs`) · How it works
  (`#how`) · Scan modes (`#modes`) · Credits (`#credits`).
- `IntersectionObserver` with a thin center band (`rootMargin: -45% 0 -45%`)
  lights the active section's circle (accent fill + glow). Labels reveal as
  blurred pills on hover. Hidden below 1320px via CSS (footer columns are the
  small-screen fallback).

## Files

- `apps/web/src/features/landing/Landing.tsx` — hero copy, `Modes` +
  `ModePreview`, `SectionRail` + `RAIL`, removed `Examples`, render order,
  footer link, imports.
- `apps/web/src/design/landing.css` — new `.ln-rail*`, `.ln-modes*`, `.ln-mode`,
  `.lm-*` rules + responsive (`<1320px` hides rail, `<980px` stacks modes).

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Ran the dev server and screenshotted at 1440px: hero shows the new
  headline/eyebrow/CTAs with the rail dots on the left; the Scan Modes section
  renders the three cards (Solo active, Friend/Glow Up locked) with previews;
  scroll-spy correctly lit rail item #3 while viewing `#modes`.
- The one console error (Supabase auth refresh 400) is pre-existing and unrelated
  to this change.
