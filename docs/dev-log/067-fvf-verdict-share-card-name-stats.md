# 067 — FvF verdict share-card: name + stats only, photos enlarged, Solo fonts

**Date:** 2026-06-23
**Area:** `apps/web` — Friend vs Friend verdict tab (`VersusResult.tsx`, `versus.css`)

## Goal

Make the swipeable verdict **share/export card** (`.vs-card`, the `BattleCard`
component) read like the Solo Scan face/outfit cards:

1. Use the same **font language** as the Solo cards.
2. Strip it to the essentials — **winner name + stats only**.
3. Let the **photo take a bigger proportion** of the card.

## What the Solo cards use (the reference, from `fitaura.css`)

A three-font hierarchy:

- **Anton** → hero numbers / headlines (score badge 56px, caption 30px, verdict 38px)
- **Space Mono** → eyebrows + stat labels (10–12.5px, tracked, uppercase)
- **Hanken Grotesk 800** → stat *values* (`MiniStat .val` 16–18px) + brand tag
- `OutfitCard` lets the photo own ~69% of the card; stats sit in a slim body below.

The `.vs-card` already used these three families, but at a **denser, smaller
scale** (box labels at 7.5px, csuper label at 8px, pscore labels at 9px) because
the body was crammed with extra content.

## Changes

### `VersusResult.tsx` — `BattleCard`
Removed from the body, keeping only the **winner name** + the **head-to-head
stat bars**:

- the AI/templated **tagline** (`.tag`)
- the **top-superlative chip** (`.csuper`) + its `topSuperlative` computation
- the 3 **stat boxes** (Margin / Face / Outfit) — redundant with the bars and the
  per-side scores already on the photo

Consequently the `summary` and `copy` props (and the `BattleSummary` import) are
no longer needed by `BattleCard` and were dropped. (Both are still used by the
breakdown panel in `VerdictTab`.)

Also fixed the winner eyebrow: it was hard-coded "Overall winner" on every
variant; now it reads **"Face winner" / "Outfit winner" / "Overall winner"**
(`wlText`), so per-category cards label themselves correctly.

The photo band keeps the A/B split, the VS medallion, the brand+kind chrome, and
the per-side **name + score** overlays (`pscore`) — those *are* the names + scores.

### `versus.css` — `.vs-card`
- **Photo band:** `.cphoto` height `44%` → **`56%`**.
- **Chrome to Solo scale:** `.cardtop .wm` → Hanken 800 `11px/0.34em` (== `.brand-tag`);
  `.cardtop .kind` → Space Mono `10px/0.2em` (== `.kind-tag`).
- **Body to Solo scale:** `.wl` eyebrow → Space Mono `10px/0.28em` (== `.fc-eyebrow`);
  stat-bar label `.cbar .l .x` → Space Mono `11px/0.10em` (== `MiniStat .lbl`);
  stat-bar values `.cbar .l .a/.b` → **Hanken Grotesk 800 16px** (== `MiniStat .val`),
  keeping the icy/gold A/B colours.
- Removed the now-dead `.tag`, `.boxes`/`.box`, and `.csuper` rule blocks.
- Rebalanced spacing for the lighter body (`.cbars` margin-top 20px, gap 14px).

The hierarchy now matches Solo: Anton owns the hero numbers (per-side scores +
winner name), Space Mono owns the labels, Hanken-800 owns the stat values.

## Verification

- `tsc --noEmit` clean (the dropped props don't leave unused locals).
- Drove the card on the dev server via the **dev fallback** (seed `sessionStorage`
  `fvf:battle` with a `both`-mode battle and no `fvf:result` → `VersusResult`
  regenerates seeded metrics). Screenshotted both the **overall** card (photo +
  "OVERALL WINNER / MARA" + Face & Outfit bars) and a **single-category** card
  ("FIT · VS · 02", one Outfit bar) — both balanced, photo clearly dominant,
  fonts matching the Solo scale.

## Notes

- This is the on-screen **and** exported card (the same `cardRef` node is
  rasterized by `renderCardBlob`), so downloads inherit the new layout.
- Push held per the iterative-session convention.
