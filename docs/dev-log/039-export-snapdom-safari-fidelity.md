# 039 — Card export: switch html-to-image → snapdom (Safari fidelity)

Branch: `fix/export-safari-snapdom` (follow-up to 037, which only fixed the
blank-photo half on Safari).

## Problem

After 037 the photo rendered on iPhone, but exports still had Safari-only
rendering bugs: miscoloured score-bar gradients, the frosted "FIT SCORE" badge
turning into a hard black box, and glow/box-shadow decorations rasterizing as
stray circles / "black holes".

## Root cause

`html-to-image` rasterizes by serializing the card into an SVG `<foreignObject>`
and drawing that to canvas. Safari/WebKit's SVG renderer does not reproduce
advanced CSS the way Chrome does — `backdrop-filter`, `box-shadow` glows and CSS
gradients all render differently. Our own `neutralizeGlass` workaround (solidify
glass backgrounds for the snapshot) is what produced the black-box badge. This
is a fidelity limitation of the browser-side foreignObject approach on Safari,
not a single bug — we'd hit it three separate times (img, glows, gradients).

## Fix

Swapped the rasterizer to **snapdom** (`@zumer/snapdom`), which reproduces
backdrop-filter, shadows and gradients faithfully across Chrome and Safari.
`renderCardBlob` now just `snapdom.toCanvas(el, { scale: 3, embedFonts: true,
backgroundColor: 'transparent', exclude: ['.st-overlay','.st-edithint'] })` and
composites the result onto the 1080×1920 poster as before.

Removed the html-to-image-era machinery that's no longer needed and was causing
artifacts: `neutralizeGlass`/`solidify` (black box), the custom Google-Fonts
`fontEmbedCSS` inliner (snapdom's `embedFonts` handles it), and the WebKit
multi-pass capture. Kept `ensureFonts` + `decodeAllImages` as cheap insurance.
Deleted `exportCard.test.ts` (it only tested the now-removed `solidify`).

## Verification

- tsc clean; tests 40/40; `vite build` succeeds (snapdom bundles).
- Chromium e2e (Playwright): ran the real `renderCardBlob` on a live card →
  1080×1920 PNG, ~44% bright pixels (real content, not blank), photo + fonts +
  colours + sticker all correct.
- **Safari fidelity is the user's test** (Chromium-only tooling here): open the
  branch's Vercel preview on iPhone/Mac Safari and re-check the three cards.

## Files

- `apps/web/package.json` — add `@zumer/snapdom`.
- `apps/web/src/lib/exportCard.ts` — rewritten on snapdom.
- `apps/web/src/lib/exportCard.test.ts` — deleted.
