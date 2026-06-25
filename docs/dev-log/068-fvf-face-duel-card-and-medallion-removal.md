# 068 — FvF FACE share-card → "duel" layout; VS medallion removed from all cards

**Date:** 2026-06-23
**Area:** `apps/web` — `VersusResult.tsx` (`BattleCard`), `versus.css`
**Follows:** [067](067-fvf-verdict-share-card-name-stats.md)

## Goal (from a reference mockup)

1. Rebuild the **FACE** share card as a two-half "duel": each half is a portrait
   with its own **score + name + top-2 metric chips**, the winner lit in its
   contender colour and the loser greyed out.
2. **Remove the VS medallion** from *every* share card.

The medallion was a purple/magenta gradient circle — off-palette for FvF, whose
identity is solid **icy (A) / gold (B)** with no pink/cyan blends (see
[[friend-vs-friend-feature]]).

## Changes

### `VersusResult.tsx`
- Dropped the `VersusMedallion` import + its `.medal-anchor` node from the
  classic (`fit` / `overall`) card photo band.
- New **duel branch** for `variant === 'face'` (`.vs-card.is-duel`):
  - Header = `FITAURA` + `FACE · VS` + a gold `CrownGlyph`.
  - Two `.dhalf` (A top / B bottom), each a full-bleed `.photo` + per-side scrim +
    a `.dside` block: big Anton **score**, `Player A/B` eyebrow, name, and chips.
  - Bottom-right reticle `.corner`. No footer, no medallion.
- `topMetricChips(metrics, side)` — a side's two strongest **own** metrics as
  `LABEL value` chips (e.g. `EYES 84`). Always yields 2 chips; these are the
  person's highlight reel, independent of who won (so a loser can still show a
  high trait — intentional).

### `versus.css`
- Removed the dead `.vs-card .medal-anchor` rule.
- Added the `.vs-card.is-duel` block. Type scale matches the Solo/067 language:
  Anton score (54px), Space Mono eyebrow + chip labels, Hanken-800 name + chip
  values. Winner (`[data-state="win"]`) → contender colour + white glowing score;
  loser (`lose`) → greyed; `tie` keeps both lit in their own colour.
- Half A's `.dside` is bottom-anchored, half B's is top-anchored, so the two info
  blocks mirror around the centre hairline (the divider is `border-top` on `.dhalf.b`).

## Verification

- `tsc --noEmit` clean.
- Drove the verdict stack on the dev server (seeded `fvf:battle`, dev-fallback
  metrics) and screenshotted:
  - **Face duel card** — header crown, winner half (icy, glowing score, icy chips),
    greyed loser half, hairline divider, corner bracket. Matches the reference.
  - **Overall card** — photo band now clean with the medallion gone.

## Notes / open

- The `fit` and `overall` cards still use the 067 photo-band + name + stats
  layout (now medallion-free). The duel layout is wired per-category, so applying
  it to the **fit** card later is a one-line gate change — flagged for the user.
- On-screen node == export node, so downloads inherit the new face card.
- Push held per the iterative-session convention.

## Follow-up (user feedback on a real-photo card)

- **Both halves' info bottom-anchored** (was: A bottom / B top, mirrored). `.dside`
  is now `justify-content: flex-end` for both, so each face sits up top and the
  score/name/chips read at the bottom of *its own* image. Flipped `.dhalf.b .dscrim`
  to darken the bottom (it previously darkened the top for the top-anchored block).
- **Loser's score no longer shaded:** `.dhalf[data-state="lose"] .sc` → `#fff`
  (was `--ink-dim`). The winner is still set apart by its contender-colour glow +
  coloured label/chips; only the *score* is full-strength on both sides. Loser
  name/label/chips stay greyed (only the score was called out).
- Verified on the dev server with a face-up-top placeholder photo and an A-loses
  battle (Kanye vs Kendrick): both blocks at the bottom, loser "73" now white.

## Follow-up 2 (annotated feedback)

- **Loser text fully opaque** (was semi-transparent `--ink-dim`/`--ink-faint`,
  which let the photo bleed through and looked washed out). Now solid hex:
  `lose .nm`/`.dchip b` → `#fff`, `lose .lab`/`.dchip` → `#c4c8ce`. The winner is
  set apart only by its gold/icy colour + score glow + header crown — the loser is
  neutral but fully readable.
- **Number + text pulled to the bottom of each image:** both scrims now darken
  progressively from ~46% down to a heavy bottom (was a transparent mid-band), and
  the score dropped 54px → 46px so the bottom-anchored cluster sits lower, on the
  dark band, instead of floating over the face.
