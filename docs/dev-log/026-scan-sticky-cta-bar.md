# 026 — Scan page: keep scroll, pin the action bar to the bottom

## Decision

The scan/upload page (`/scan`) scrolls once a photo is loaded — the cropping
state (preview + zoom + hint + Reset/Replace/Remove + Looks good) makes each card
tall, and two side by side exceed the viewport. The user asked whether to force
no-scroll. We agreed forcing no-scroll would require shrinking the cards (which
the user explicitly wanted to keep) and breaks on short laptops. So: **keep the
scroll, but pin the action bar to the bottom** so the primary CTA is always
reachable.

## Change

The footer (`.ua-foot` — Face/Outfit ready chips, validation banner, "Scan my
aura" CTA + cost meta, privacy line) is now a **fixed** bottom bar.

- `.ua-foot { position: fixed; left/right/bottom: 0; z-index: 30 }` with a blurred
  translucent `--bg-0` background + top border. New `.ua-foot-inner` centers the
  content at the same `max-width: 880px` as the page column.
- Because the bar height varies (the validation banner appears on a failed
  attempt), `Upload.tsx` measures it with a `ResizeObserver` and reserves exactly
  that much space via an inline `padding-bottom` on `.ua-pad`, so the last card
  never hides behind the bar.

`position: sticky` wouldn't work here — the footer is the last child of its
container, so there's nothing below it for sticky-bottom to travel against; the
bar needs to overlay the viewport regardless of scroll, which is `fixed`.

## Files

- `apps/web/src/features/upload/Upload.tsx` — `ResizeObserver` height measure,
  `.ua-foot` ref + `.ua-foot-inner` wrapper, measured `padding-bottom` on `.ua-pad`.
- `apps/web/src/design/upload.css` — `.ua-foot` fixed bar + `.ua-foot-inner`
  (mobile side padding).

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server, `/scan` with both photos loaded (cropping state):
  - `.ua-foot` computes `position: fixed`, `bottom === viewport bottom` (800/800),
    bar height 188px, `.ua-pad` padding-bottom 204px.
  - At scroll top: header + cards render, CTA bar pinned at the bottom; cards
    scroll under it. Mobile (390px): single column, bar pinned, no overflow.
