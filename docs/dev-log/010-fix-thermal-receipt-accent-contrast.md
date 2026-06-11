# 010 — Fix accent contrast on the thermal receipt

## Problem

On the thermal-paper receipt, accent colors didn't read against the cream
surface: positive values (`+240`, `good` tone), emphasized metric results
(`hi` tone), the categorical-verdict stamp, and the corner seal all came out
washed-out and hard to read. The receipt concept and the chosen palette hues
were fine — the issue was purely color choice / contrast within the thermal
style.

## Root cause

The receipt's accent colors come from the semantic tokens `--cyan`, `--lime`,
`--red` (`fitaura.css:23`), and from `--verdict`, which `Result.tsx:104` sets
to the literal token `var(--lime)` / `var(--cyan)` / `var(--red)` per verdict
(`packages/shared/src/verdict.ts:26`).

The thermal variant (`.receipt[data-style="thermal"]`, `fitaura.css:321`) only
remapped the paper background and ink (`--receipt-bg/--receipt-ink/
--receipt-line`). It never remapped the accents. So on the cream `#f4f1e9`
paper:

- `.r-row .v.good` → `--lime` `#b6ff3c` (~1.2:1 — effectively invisible)
- `.r-row .v.hi`, `.r-stamp-big`, `.r-seal` → `--verdict` → `--cyan` `#54e6f0`
  (~1.5:1) / `--lime` / `--red`

The neon palette is tuned for the dark paper; those same values have almost no
contrast on cream. The stamp/seal also leaned on neon glow (`box-shadow` /
`text-shadow`) for presence, which is invisible on a light surface.

## Fix

Scoped, hue-preserving token remap inside the thermal subtree only
(`fitaura.css`):

```css
.receipt[data-style="thermal"]{ --cyan:#0c6f7d; --lime:#0d6b2f; --red:#c01c2b; }
```

Same hues (green stays green, cyan→teal, red stays red), just paper-legible.

### Correction — the `--verdict` uses needed a second step

The first pass assumed the remap above would also fix everything driven by
`--verdict` (the categorical-verdict stamp `.r-stamp-big`, the seal, and `.hi`
values), on the theory that `--verdict`'s inner `var(--lime)` would resolve
against the scoped tokens. **That was wrong**, and it showed: the `.v.good`
values (which read `--lime` *directly*) fixed, but the stamp and verdict label
were still washed out.

Why: `Result.tsx:104` sets `--verdict` on `:root` to the token
`var(--lime|cyan|red)`. A custom property's `var()` is substituted to a concrete
value **at the element where the property is declared** — here `:root` — and
that resolved color then inherits down. Redefining `--lime` lower on the receipt
can't retroactively change an already-resolved value inherited from an ancestor.
(The "override a base token downstream" theming trick only works when the
consuming property is *also* declared at/below the override, not when it was
baked at `:root`.)

So `--verdict` must be overridden **directly on the receipt**, per active
verdict. The receipt now carries `data-verdict` (`Receipt.tsx`), and:

```css
.receipt[data-style="thermal"][data-verdict="green_flag"]{ --verdict:#0d6b2f; }
.receipt[data-style="thermal"][data-verdict="normie"]   { --verdict:#0c6f7d; }
.receipt[data-style="thermal"][data-verdict="red_flag"] { --verdict:#c01c2b; }
```

A value set on the element wins over the one inherited from `:root` (inheritance
carries no specificity), so the stamp, seal, and `.hi` values now use the
paper-safe ink. This fixes the good-tone values, the `.hi` values, the verdict
stamp, and the seal.

### Correction 2 — the "VERIFIED" overlay stamp

The "VERIFIED" stamp (`.st-receipt-stamp`) is **not** part of the Receipt
component — it's a sticker overlay rendered as a *sibling* of `.receipt` inside
`.rs-card-mount` (on screen) and `.rs-export-card.is-receipt` (export). So the
receipt's `--verdict` override (a descendant rule) never touched it, and it
stayed neon on cream.

Fix: the two container elements now carry `data-paper` + `data-verdict`
(`Result.tsx`), and `sticker-studio.css` recolors `.st-receipt-stamp` to the
same paper-safe ink per verdict and drops its neon glow when
`[data-paper="thermal"]`. Applies to both the on-screen card and the export
copy.

Also dropped the now-pointless neon glow on the thermal stamp/seal and gave
them a faint solid tint instead, so they read as crisp ink-on-paper.

### Contrast (WCAG, on `#f4f1e9`)

| Accent | Before | After |
| --- | --- | --- |
| good / positive | `#b6ff3c` ≈ 1.2:1 | `#0d6b2f` **5.9:1** |
| cyan / normie | `#54e6f0` ≈ 1.5:1 | `#0c6f7d` **5.2:1** |
| red | `#ff3b49` ≈ 3.0:1 | `#c01c2b` **5.4:1** |

All three clear AA (4.5:1) even at the small mono size. The dark (`neon`) paper
is untouched.

## Files

- `apps/web/src/design/fitaura.css` — thermal accent token remap, per-verdict
  `--verdict` override, stamp/seal ink treatment.
- `apps/web/src/components/cards/Receipt.tsx` — emit `data-verdict` so the
  thermal `--verdict` override can key off the active verdict.
- `apps/web/src/design/sticker-studio.css` — recolor the `.st-receipt-stamp`
  overlay (VERIFIED) per verdict on thermal + drop its glow.
- `apps/web/src/features/result/Result.tsx` — emit `data-paper`/`data-verdict`
  on the card mount and export card so the overlay stamp can be scoped.

## Verification

- Computed WCAG contrast ratios above (≥5.1:1 vs ~1.2–3.0:1 before).
- Manual: switch the receipt to thermal paper and confirm `+` values, the
  stamp, and the seal read clearly across all three verdicts; download/export
  inherits the same DOM so the exported card matches.
