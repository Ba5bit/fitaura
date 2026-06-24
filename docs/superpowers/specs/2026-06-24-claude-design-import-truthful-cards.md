# Truthful Solo-Scan card export for Claude Design

**Date:** 2026-06-24
**Status:** Approved for planning
**Folder produced:** `claude-design-import/` (repo root)

## Goal

Produce a self-contained, portable folder of HTML files that faithfully reproduce
the **real** Solo Scan output — the Face card, Outfit card, the three receipt
papers, the alternate card skins, and the analyzing/scanning sequence — so the
user can import them into Claude Design (claude.ai/design) and build animations on
top of them.

"Truthful" is the controlling requirement. The existing `design-sync/fitaura/*.html`
cards re-authored the production CSS by hand and drifted (gradient-blob "photos,"
simplified markup). This bundle instead **inlines the production CSS verbatim** and
mirrors the (simple, presentational) component markup 1:1, with a **real sample
photo embedded** so each file reads exactly like a live scan.

## Approach (decided: A)

For each card asset:

1. **CSS — verbatim, not re-authored.** Inline, unchanged, the production rules the
   component depends on. To avoid the global `html/body` rules in `fitaura.css`
   fighting the standalone preview, inline only:
   - a Google Fonts `@import` (Anton · Hanken Grotesk · Space Mono),
   - the `:root` token block from `apps/web/src/design/fitaura.css`,
   - the relevant rules from `apps/web/src/design/gender-theme.css`
     (`--accent` / `--verdict` per `data-gender`),
   - `.card-image` rules from `apps/web/src/design/components.css`,
   - the asset's skin CSS file(s) **verbatim** (see per-asset table),
   - a tiny preview-only `body { min-height:100vh; display:grid; place-items:center }`
     shell (the only hand-written CSS, mirroring the existing `@dsCard` previews).
2. **Markup — 1:1 port.** Translate the component's JSX to static HTML exactly
   (same class names, same element order). The components are pure presentational
   markup (see `FaceCard.tsx`, `OutfitCard.tsx`, `Receipt.tsx`), so this is a
   mechanical, low-risk port. Set the verdict/gender CSS vars inline on the root
   wrapper (e.g. `data-gender`, `style="--verdict:...; --accent:..."`).
3. **Imagery — real photo, base64.** Embed `apps/web/src/assets/example-face.jpg`
   (face slots) and `apps/web/src/assets/example-fit.jpg` (outfit slots) as
   base64 `data:` URIs inside `<img>` so each file stays a single portable HTML.
4. **QR — real.** The thermal receipt bakes a real QR to `https://fitaura.studio`
   as inline SVG (reuse what `QrCode.tsx` generates).

The **scan** asset is special-cased: it is a hand-built auto-playing HTML that
inlines the real `apps/web/src/design/scanner.css` verbatim, uses the real example
photos, and adds a small `<script>` that cycles the `data-stage` attribute through
`prep → face → fit → aura → verdict` (then loops). All the visual scanning behaviour
(scanline sweep, grid drift, per-stage accent recolor, rail progression, face
medallion lift/dim) already lives in `scanner.css` and is driven purely by
`data-stage` + the progress width — the script only advances state.

### Why not B (SSR) or C (Playwright)

Visual fidelity lives in the CSS, which approach A copies byte-for-byte; the markup
is trivial enough that a 1:1 port carries no real fidelity risk. SSR needs a
Vite-SSR build script resolving `@fitaura/shared` + hooks; Playwright needs a
running server + seeded result and messy post-hoc CSS inlining. Both add fragility
for no fidelity gain here.

## Deliverables

`claude-design-import/` containing:

| File | Source component | CSS inlined (verbatim) | Image |
|---|---|---|---|
| `face-card.html` | `FaceCard` (Clean default) | `clean-skin.css` | example-face |
| `outfit-card.html` | `OutfitCard` (Clean default) | `clean-skin.css` | example-fit |
| `face-card-buffering.html` | `skins/BufferingFace` | `buffering-skin.css` (+ clean base) | example-face |
| `outfit-card-nameplate.html` | `skins/NameplateOutfit` | `nameplate-skin.css` (+ clean base) | example-fit |
| `receipt-thermal.html` | `Receipt` (`paper="thermal"`) | `.receipt` rules from `fitaura.css` | — (QR only) |
| `receipt-premium.html` | `ReceiptPremium` (pass) | `receipt-premium.css` | example-face/fit if used |
| `receipt-white.html` | `ReceiptPremium` (ivory skin) | `receipt-premium.css` | example-face/fit if used |
| `scan.html` | real `scanner.css` (auto-play) | `scanner.css` | example-face + example-fit |
| `ANIMATION-NOTES.md` | — | — | — |

"Clean" is the default card, so it *is* `face-card.html` / `outfit-card.html`; the
skin files add the buffering face + nameplate outfit. The **Dossier** skin is out of
scope (user listed clean/nameplate/buffering).

### File format

Every HTML file starts with the existing card header convention so Claude Design
recognizes it, followed by a one-line animation-hooks comment:

```html
<!-- @dsCard group="Live / Truthful" name="Face Card" subtitle="Solo Scan output · truthful · 360×640" -->
<!-- @anim hooks: .selfie-stage (reveal), .fc-line .hl (verdict pop), .mstat .fill (bar fill), .barcode (settle) -->
```

### ANIMATION-NOTES.md

A short manifest: one section per file listing the elements worth animating and the
intended motion, so Claude Design knows the seams. Examples:

- **face-card**: `.selfie-stage` scale/fade-in → `.fc-eyebrow`/`.fc-line` rise →
  `.fc-line .hl` highlight pop → `.mstat .fill` bars fill left→right + `.mstat .val`
  count-up → `.barcode` settle.
- **outfit-card**: `.outfit-photo img` ken-burns → `.score-badge .num` count-up →
  `.caption-bar` slide-up → `.oc-stats .fill` bars.
- **receipt-thermal**: print top→bottom; `.r-row` reveal staggered; `.r-stamp-big`
  stamp-in (rotate+scale); QR fade last.
- **scan**: already self-animating; document the 5 `data-stage` values + the
  `--accent` per stage so Claude Design can re-time or extend it.

## Sample content (concrete, to avoid placeholders)

Use these fixed values so the files are deterministic and read like a real scan.
Gender = `male` (`data-gender="male"`), so `--accent` = icy/blue and `--verdict`
follows the male verdict color from `gender-theme.css`.

- **Face card** — eyebrow `THE VERDICT`; verdict `["CERTIFIED", "HEARTBREAKER"]`;
  index `FACE CARD · 01`; roast `"Dangerously photogenic. Lock up your
  situationships."`; scores: Aura 88, Rizz 81, Heartbreak 94 (hot), Age 23.
- **Outfit card** — overallScore 86; caption `"Quiet-luxury menace. The fit is
  fitting."`; foot `FIT / PHYSIQUE READ`; scores: Drip 87, Fit 84, Color 79, Vibe 90.
- **Receipt (thermal)** — `NO. FA-2K6Q19`; verdict label from a mid/high
  `datingVerdict`; rows: Face 88, Fit 86, Aura 90, Rizz 81, Red Flags "Low" (good),
  Green Flags "High" (hi); subtotal "6 metrics analyzed / 1 credit"; final punchline
  `"Swipe right with confidence — this one clears."`; QR → `https://fitaura.studio`.
- **Premium / white** — same numbers in the verified-pass layout.

These values match the real type shapes (`FaceCardContent`, `OutfitCardContent`,
`DatingReceiptResult` in `@fitaura/shared`). If a captured sample result already
exists in a fixture, prefer it; otherwise use the above.

## Non-goals

- No changes to any production component, CSS, or app behaviour — this is a
  read-only extraction into a new folder.
- Not added to the `design-sync/fitaura/` Design System library (that holds the
  curated approximations; this is a separate import bundle).
- No Dossier skin, no Friend-vs-Friend, no social/marketing formats.
- Not synced via the `DesignSync` tool (the user imports these manually into the
  orange Claude Design canvas for animation work).

## Verification

- Open each HTML file in a browser: it renders standalone, centered, with the real
  photo and correct fonts/colors, visually matching the live Solo Scan card.
- `scan.html` auto-plays through all five stages and loops, recoloring per stage.
- Each file is self-contained (no external asset refs except the Google Fonts
  `@import`); images are base64; the QR resolves to `fitaura.studio`.
- Diff each inlined CSS block against its source file to confirm it was copied
  verbatim (not re-authored).
- `ANIMATION-NOTES.md` lists every HTML file with at least its primary hooks.
```
