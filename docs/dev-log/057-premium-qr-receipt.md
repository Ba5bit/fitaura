# 057 — Premium QR Receipt (Phase A pt2)

**Date:** 2026-06-18
**Plan:** `docs/superpowers/plans/2026-06-18-premium-qr-receipt.md`
**Merged to `main`** (`31516c6`) + pushed · frontend-only (no edge redeploy)

## What shipped

A third Dating Score Receipt "paper": **Premium** — a holo "verified pass" with a **real, scannable QR** to `https://fitaura.studio/`, alongside Dark Neon and Thermal.

- `lib/qr.ts` — `qrMatrix(text)` (via `qrcode-generator`, ~8 KB) → boolean module grid; `SITE_URL`.
- `components/cards/QrCode.tsx` — renders the grid as a **scalable inline SVG** (one `<rect>` per dark module, `fill` set on the svg, `shapeRendering="crispEdges"`). SVG survives snapdom export, so the downloaded PNG keeps a scannable code. Module count is data-driven (~25–33), so the viewBox sizes to it (the prototype's hardcoded 21×21 grid would have been wrong).
- `ReceiptPaper` gains `'premium'` (shared).
- `components/cards/ReceiptPremium.tsx` + `design/receipt-premium.css` — the pass, rebuilt in **system tokens** (accent follows the card's gender identity via the ancestor `data-gender`; verdict colour stays semantic; only intentional hex literals are the QR's light bg + dark modules + white stamp text). Ported from the Card Studio v2 prototype, not copied.
- `Result.tsx` — paper control gains **Premium**; the visible asset, the export host, the stamp overlay (→ null), and the stamp/reposition controls all branch on `paper === 'premium'`. `Settings.tsx` default-paper selector also gains Premium.

## Notes / decisions

- **Real QR, not the prototype's fake matrix.** The prototype drew a random on/off grid; this encodes the actual URL so a phone camera opens the site.
- **snapdom-safe by construction:** inline SVG with an explicit `fill` attribute means even if the stylesheet is stripped during capture, the modules render.
- `qrMatrix` guards `qr.make()` (throws past type-40 capacity) and returns an empty grid → `QrCode` renders nothing rather than crashing.
- Premium carries its own seal/QR, so the movable thermal-style stamp is suppressed for it (overlay null + controls hidden + edit panel gated).

## Process

Subagent-driven for the QR helper/component (caught real fixes: memoize the rects, explicit `fill`, `make()` guard, drop the deprecated `@types` stub); the rest implemented directly from the plan with per-step typecheck/build. Final holistic review caught the missing **Settings** Premium option. 154 tests pass; build clean.

## Follow-ups

- [ ] Phase B — Clean + Lore skins + the card-stack switcher (separate plan; the big one).
- Manual: confirm the exported premium PNG's QR scans on a phone (renders real modules; expected to scan).
