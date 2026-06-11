# 009 — Fix font fallback in downloaded card export

## Problem

The verdict card looked correct in the browser, but the downloaded PNG rendered
with the wrong fonts — most visibly the main verdict headline, which should use
Anton (condensed bold display) but came out in a generic, wider fallback. Some
smaller labels also fell back.

## Root cause

`apps/web/src/lib/exportCard.ts` uses `html-to-image`'s `toCanvas`. That library
serializes the DOM into an SVG `<foreignObject>` and rasterizes it through an
`<img>`. **That SVG renders in an isolated context with no access to the fonts
already loaded in the live document.** Unless the actual font data is embedded in
the snapshot (as `@font-face` rules with the binary inlined), the SVG falls back
to system fonts.

The previous code set `skipFonts: true` with a comment claiming "the fonts are
already loaded in the document, so the snapshot still renders them correctly."
That assumption is false. `skipFonts` was added only to silence a
`SecurityError` — the fonts come from a **cross-origin** Google Fonts `<link>`
(`fonts.googleapis.com`), and html-to-image throws when it tries to read
`cssRules` off a cross-origin stylesheet. Skipping fonts dodged the error but
also embedded *no* font data, guaranteeing the fallback.

## Fix

Build a self-contained `@font-face` stylesheet ourselves and hand it to
html-to-image via the `fontEmbedCSS` option (when set, the library uses exactly
that CSS and never touches the cross-origin sheet — so no SecurityError *and*
the real fonts ship inside the snapshot):

1. Find the existing `fonts.googleapis.com` `<link>` href in the document (stays
   in sync with `index.html` instead of hardcoding the family list).
2. `fetch` that stylesheet — Google's CSS API sends `access-control-allow-origin: *`,
   so CORS is fine.
3. Extract every `url(...)` (the gstatic woff2 files, also CORS-permissive),
   fetch each, and rewrite to a base64 `data:` URI.
4. Pass the resulting CSS as `fontEmbedCSS`; drop `skipFonts` to the fallback path.

The built CSS is cached in a module-level promise (cleared on failure so a later
attempt can retry). If embedding fails (e.g. offline), we fall back to
`skipFonts: true` so an image is still produced rather than throwing.

The card design and the intended fonts are unchanged — only the export pipeline
was touched.

## Files

- `apps/web/src/lib/exportCard.ts` — added `buildFontEmbedCSS()` /
  `fetchAsDataURI()` / `getFontStylesheetHref()`; replaced `skipFonts: true`
  with `fontEmbedCSS` + fallback.

## Verification

- `npx tsc --noEmit` clean.
- Manual: download a card and confirm the headline renders in Anton, matching
  the on-screen card.
