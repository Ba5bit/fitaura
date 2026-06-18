# 058 — Card Skins + Stack Switcher (Phase B)

**Date:** 2026-06-18
**Plans:** `docs/superpowers/plans/2026-06-18-phase-b1-skin-switcher.md` (B1)
**Commits:** B1 `0c8fa62`, B2 `231b3d3`, B3 `9ca9153` (all on `main`, pushed) · frontend-only

## What shipped

A landing-style **card-stack switcher** on the Result page that flips between three **skins** per face/outfit card — the existing **Dossier**, plus two new full-bleed designs: **Clean** (Tinder-style) and **Lore** (collectible). Gender-themed (accent follows femme/masc). Built in three de-risked steps:

- **B1 — infrastructure (invisible).** A per-kind skin registry (`components/cards/skins/`: `types.ts` `SkinProps`/`CardSkin`, `registry.ts`, `DossierFace`/`DossierOutfit` wrapping the current cards) + a `CardSwitcher` stack component (front card full-size + live, peeking skins dimmed behind). With one skin it's a strict no-op. Selected skin persists per `{generationId, kind}` via `usePerCardState`. **Verified in-browser** as a perfect no-op before adding any skin.
- **B2 — Clean skin.** Full-bleed: photo fills the card, a scrim carries the verdict, stat chips and a one-line read. Registering it made the switcher visible (dots + peeking card + stack animation). The dots were moved out of the scaled 640px card mount into the Result layout (full-size, below the card). The **export host renders the active skin** (`FaceSkinComp`/`OutfitSkinComp`) so downloads match the on-screen skin.
- **B3 — Lore skin.** Collectible: FIT LORE header (volume + rarity), gold class label, verdict title, read, and dot-meters. Added `verdict` to `SkinProps` (drives the rarity/class flavor via a small `LORE_COPY` map).

## Key decisions / gotchas

- **The switcher reuses the front-live pattern, not the landing fan's uniform 0.62 scale** — the result card is the editable/exportable asset, so the front must be full-size; peeking skins scale/dim behind. The sticker editor overlay is passed into the switcher and rides on the front skin only (`.cs-card:not(.front-live) * { pointer-events: none }`).
- **Dots can't live inside the scaled mount** — the card fills the fixed 640px mount, so dots rendered there overflow/clip. They're rendered in the Result layout below the card instead.
- **Skins read the same `SkinProps`** (content/gender/verdict/roast), so they're interchangeable; Clean/Lore reuse existing result content (no new AI fields) + a static `LORE_COPY` flavor map.
- **Gender theming is free** — both skins paint off `--accent`, which `gender-theme.css` remaps to `--magenta` on the femme `data-gender` ancestor.

## Verification

Drove the real dev server via Playwright (seeded a face+outfit result into IndexedDB): confirmed each skin renders, the switch animation works, the **export renders the selected skin**, edit-mode/sticker still work, and the selection persists. Build clean; 156 tests pass (incl. registry tests).

## Follow-ups (minor, not blocking)

- [ ] Per-skin sticker default geometry — sticker `pos` is currently shared across skins.
- [ ] Clean/Lore are photo-led — best on real scans with a photo.
- [ ] Lore dot-meters render faint in the snapdom export (fine on-screen).
