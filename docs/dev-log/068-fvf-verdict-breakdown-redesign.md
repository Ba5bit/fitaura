# 068 — FvsF Verdict tab: card stack + roasted breakdown

**Date:** 2026-06-26
**Spec:** `docs/superpowers/specs/2026-06-25-fvf-verdict-breakdown-redesign-design.md`
**Touches:** `packages/shared/src/versus/*`, `apps/web/src/features/versus/*`, `apps/web/src/design/versus.css`

## What & why

The Verdict tab's breakdown panel was hidden last session (`SHOW_BREAKDOWN = false`,
commit `0654b2d`) pending a redesign. This rebuilds it to:

- keep the share-card **deck** on the left (now with the Solo-Scan-style peek-behind
  backers), and
- replace the old stat-cards / category-chips / "where it was won" grid with a
  **roasted superlatives list** (the provided `Result Deck v2` reference), restyled to the
  FvsF palette (A `--icy`, B `--gold` per matchup, roast red — no blue/pink neon).

Each row = a savage "Most likely to…" title + a real metric (category · margin), the
subject's score + tier + bar, and a **human, number-free** read sentence.

## Architecture — numbers vs. voice (the key idea)

The invariant from the AI-verdict work holds: **`computeBattle` owns every number; the AI
only dresses it.** Concretely the breakdown row is split:

- **Voice (AI):** `VersusCopy.reads: VerdictRead[]` where `VerdictRead = { metricKey, title,
  flex, reason }`. The model writes the funny title + a full human sentence and picks the
  metric + flex/roast framing. It is told **never to put numbers in the prose** and not to
  start with `"{name}'s {metric} read…"` — the figures live in the badge.
- **Numbers (derived):** a new pure helper `deriveReads(verdict, copy, names)` resolves each
  row's subject (flex → metric leader, roast → trailer), score, `other`, gap, tier
  (Elite ≥90 / Strong ≥82 / Solid, or "Needs work" for roasts), and the tag — all from the
  real metric. So a hallucinated number can never reach the UI.

`deriveReads` also drives the **fallback**: when there's no `copy.reads` (legacy saved
battles, or the dev seed with no AI), it builds every metric as a flex from a static
title/reason **bank** written in the same savage, number-free voice, then guarantees a roast
by converting the smallest-gap row (so it reads last, matching the reference). Selection =
skip dead-even metrics, sort by gap desc, cap at 5.

This means the UI is **never empty** and never crashes on old data, even though we changed
the stored `copy` shape.

## Data-layer changes

- `schema.ts`: added `VerdictRead`; `VersusCopy.superlatives` → `reads` (removed the old
  `Superlative` type + the tap-to-reveal "locked" concept — not in the reference).
- `aiSchema.ts`: `superlatives` zod → `reads` (`metricKey`, `title` ≤80, `flex`,
  `reason` clamped to 180).
- `prompt.ts`: response schema `reads`; the `SUPERLATIVES` instruction became a `READS`
  paragraph with the savage-roast voice, the metric-key list, the ≥1-roast rule, and the
  hard "no numbers / no name-prefix" constraints. The HARD-NEVER guardrails are unchanged.
- `assemble.ts`: dropped `coerceOneLocked`; added `shapeReads` (keep active-modality keys,
  de-dupe by key). Numbers are derived later, so this only validates the title payload.
- `reads.ts` (new): `deriveReads` + `DerivedRead` + the static bank.
- Tests: rewrote `aiSchema`/`assemble`/`prompt` specs for `reads`; added `reads.test.ts`
  (flex/roast resolution, gap sort, roast guarantee, bank fallback, gap-0 skip, and a
  **no-digit-in-prose** assertion).

## UI changes

- `versusBits.tsx`: removed `SuperlativeChip`/`SuperlativesRow`; added `VerdictReadRow`
  (stateless; `--c` = side colour, `[data-roast]` flips score/tier/bar/tag to red in CSS).
- `VersusResult.tsx`: removed the `SHOW_BREAKDOWN` gate + `WonCard`/`CatChip`; `VerdictTab`
  now renders the deck (peek-behind stage) + the new breakdown (overall-winner header +
  margin pill from `summarizeBattle().marginLabel`, scoreline, reads list, "Final word" =
  `copy.crown.line` with a templated fallback, Rematch + Share).
- `versus.css`: added `.vs-cardstage`/`.vs-cardback`; replaced the stat-card/won-grid/
  superlative styles with `.vs-readrow` + `.vs-finalword`; added the mobile single-column
  stacking for the rows.

## Verification

- `npm run typecheck` clean; `npx vitest run` → 195 passing (the one failing *suite* is the
  pre-existing `creditsService.refund` env issue — needs `VITE_SUPABASE_URL`, unrelated).
- Rendered locally and screenshotted: AI-reads path and the static-bank fallback path, both
  desktop (2-col) and mobile (stacked). Confirmed: blue/lime/red palette, roast row red,
  tiers correct, no digits in any read sentence, no console errors.

## Addendum — card deck variations + reads carousel (same day)

First pass only added decorative backers behind the *one* existing card and the
breakdown list overflowed. Reworked per feedback:

- **Swipeable card deck (`VerdictShareCard.tsx`).** Ported the handoff's four share
  cards faithfully (Face Verdict humiliation-circle, Face Stats stacked-split, Outfit
  Verdict full-bleed, Outfit Stats side-by-side bars). A battle is single-mode, so the
  deck shows the **two** cards for the active mode and a **Verdict / Stats** toggle (+ dots)
  flips between them inside the peek-behind stage. Rendered at native 360×640 and scaled to
  fit the column via a resize effect; the export still captures the unscaled card. Photos
  use `background-image` (snapdom drops `<img>` in absolute layers — the existing gotcha).
  Removed the old `BattleCard`/`CardBar`/`topMetricChips`/`BARS` (the duel card).
- **Reads carousel.** The breakdown reads now sit in a fixed-height **horizontal carousel**
  (`ReadsCarousel`, ~2 rows/slide, arrows + dots) so the panel never scrolls.
- **Bigger superlative type** (title 13.5→15.5, score 30→34, name 15→18, why 11→12.5, etc.).

Verified locally (Playwright) across **all four** card variants (face + fit, verdict +
stats), the toggle/dots, and the carousel paging — palette blue/red, no console errors;
tsc + lint + 195 tests green.

### Addendum 2 — fanned deck + fit-to-height + headline wrap

- **Fanned deck (Solo card-stack logic).** Dropped the flat backers + the Verdict/Stats
  text toggle; the deck now renders BOTH cards — the active one sharp in front, the other
  splayed behind (`rotate(7deg) translateX(48px) scale(.9)`, dimmed), tap front / peek / dot
  to switch (`.vs-fanwrap` / `.vs-fandeck` / `.vs-fancard.front|.back`).
- **No-scroll sizing.** The deck scales to fit BOTH column width and viewport height (capped
  ≤ .78 so it stays compact), and the breakdown's padding/margins were trimmed (fonts kept
  big) — the page no longer scrolls (verified 900-tall: scrollH === innerH, breakdown 742→682).
- **Headline wrap fix.** The share-card `WINNER word loser` headline used `line-height:.84`,
  so long names (e.g. the default "Player A … Player B") collided when wrapping; bumped to
  `.96` so wrapped Anton cap-lines have clean spacing.
- **Headline colours.** Winner name + the verb ("HUMILIATED") now read in the winner's
  colour; the loser name is white (was: winner colour / white verb / loser colour).
- **Removed the scoreline** (`nameA avgA / avgB nameB`) from the breakdown per feedback, and
  **compacted the read rows** (tighter padding/margins, fonts kept big) — together with the
  fit-to-height the verdict tab now fits without scrolling (breakdown ≈ 559px @900-tall).

## Follow-up — deploy

The prompt/schema change needs a **manual `versus-scan` edge-function redeploy** (see
solo-scan deploy note: `.ts` import extensions, project ref + command). Until then, new
battles render via the static-bank fallback, so the UI is safe to ship ahead of the deploy.
Push is being **held** per the iterative-session rule.
