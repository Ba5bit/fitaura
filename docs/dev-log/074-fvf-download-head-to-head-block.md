# 074 — FvF: download the head-to-head block (desktop)

**Date:** 2026-06-25
**Area:** Friend vs Friend result deck (`apps/web/src/features/versus/VersusResult.tsx`,
`apps/web/src/lib/exportCard.ts`, `apps/web/src/design/versus.css`)

The Face/Outfit tab's head-to-head card (banner + both player cards + VS stat bars +
side-copy) is the most-screenshotted view. Added a **"Download card"** button **centered in
the middle column, just below the VS stat bars**, so people can save the block directly
instead of screenshotting — **desktop only** (mobile is left out: those users already export
the share card on the Verdict tab, which carries the same stats). The button lives *inside*
the captured panel but is dropped from the rendered image via snapdom's `exclude` (so the
shot is clean). Sized to match Solo Scan's "Download" button (base `.ctrl`: 13px Hanken
Grotesk, padding 11/17, radius 12).

## The catch — `renderCardBlob` is 9:16-only
The existing share-card export composites the captured element onto a fixed **1080×1920
story poster**. The head-to-head block is **wide landscape**, so that path would scale it to
the frame height and clip the sides to a sliver. So a new `renderPanelShot(el, {accentHex})`
in `exportCard.ts` keeps the element's **own aspect ratio**: snapdom → canvas, then composite
onto a dark backdrop (+ soft accent glow) sized to the panel + ~4.5% padding. Reuses
`ensureFonts` / `decodeAllImages` / `downloadResult`.

## The risk I verified — snapdom + `<img>`
The deck renders real `<img>` photos (`CrownAvatar`, `.vs-fitframe`), and an old note warned
snapdom can drop `<img>` inside absolutely-positioned layers (why the share cards use
`background-image`). But `exportCard.ts`'s own header says snapdom fixed the html-to-image
"blank `<img>`" problem, and `decodeAllImages` preps them. **Verified live** (Playwright,
injected `fvf:battle` with two data-URL photos, dev-fallback metrics): clicked Download →
saved `fitaura-versus-outfit.png` (1.7 MB) → **both photos rendered correctly**, along with
banner / scores / VS splits / names / chips / crown on the dark backdrop. Mobile (390px):
button correctly absent.

## Wiring
`ComparisonTab` gained a `panelRef` on `.vs-deckpanel` (the captured element), a `busy` flag,
and a `downloadShot()` handler. The button (`.vs-shot-btn.ctrl.primary`) lives *inside* the
panel — in the `.vs-center` column right after `.vs-splits`; `renderPanelShot` takes an
`exclude: ['.vs-shot-btn']` so snapdom drops it from the shot (`excludeMode: 'remove'`).
Accent for the backdrop glow = the winning side's palette colour (new `palette` prop, same
pair the deck already paints with). `versus.css` centers it (`display:flex; width:fit-content;
margin:auto`), leaves the base `.ctrl` sizing intact to match Solo's Download button, and
**hides it at `max-width:760px`**.

## Verification
`tsc` clean; live Playwright smoke passed: button shows centered below the stat bars on
desktop (computed 13px / padding 11px 17px / radius 12px — identical to Solo's `.ctrl`),
download produces a clean shot with **both photos rendered and the button absent** (exclude
works), and the button is `display:none` at 390px. Local — push/commit per session decision.
