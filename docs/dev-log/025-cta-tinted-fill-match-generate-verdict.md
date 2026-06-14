# 025 — CTAs use the "Generate verdict" tinted fill

## Goal

The user wants the primary CTAs to share the **Generate verdict** button's look —
a translucent accent fill (not the transparent outline from [016](016-speed-insights-and-transparent-ctas.md),
not a fully solid block).

The target is `.vlt-btn.primary` (vault.css):
`background: color-mix(in oklab, var(--accent) 16%, transparent)`,
`border: accent 65%`, `color: var(--accent)`,
`box-shadow: 0 0 0 1px accent 22%, 0 16px 40px -22px accent`, hover bg `22%`.

## Changes

### Looks good / Scan my aura (`.cta.go`, upload.css)
Was transparent (outline only). Now uses the `.vlt-btn.primary` tinted fill +
border + glow, hover → 22% fill. Covers both the per-zone "Looks good" confirm and
the page-bottom "Scan my aura" CTA.

### Result page Vault / New scan (`.rs-newscan`, result-shell.css)
Were a **solid** accent block (`background: var(--accent)`, `color: --accent-ink`).
Now the same translucent tinted fill (accent text, 16% fill, 65% border, glow,
hover 22%) so they match Generate verdict.

## Not changed

The scanner-mode `.reveal .go` (Reveal my verdict) and `.confirmed .go` were left
as their transparent style — the user only named Looks good / Scan my aura and the
result Vault / New scan. Easy to align later if wanted.

## Files

- `apps/web/src/design/upload.css` — `.cta.go` + hover.
- `apps/web/src/design/result-shell.css` — `.rs-newscan` + hover.

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server, `/scan` with both sample photos loaded: "Looks good" (both zones)
  and "Scan my aura — free" render with the translucent blue fill matching
  Generate verdict.
- Result page (`/result`) redirects without a generated result, so its buttons
  weren't screenshotted live; the `.rs-newscan` rule is a direct copy of the
  verified `.vlt-btn.primary` target.
