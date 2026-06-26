# FvsF Verdict Tab — Card Stack + Roasted Breakdown (redesign)

**Date:** 2026-06-25
**Status:** Design approved, pending spec review
**Area:** `apps/web/src/features/versus` + `packages/shared/src/versus`

## Goal

Rebuild the Friend-vs-Friend **Verdict tab** breakdown that was hidden last session
(`SHOW_BREAKDOWN = false`, commit `0654b2d`). The new breakdown adopts:

- the **card-stack** presentation from the Solo Scan result page (peek-behind deck), and
- the **roasted superlatives breakdown** from the provided design reference
  (`design_handoff_friend_vs_friend/Result Deck v2.dc.html`, Images #1/#3),

restyled to Fitaura's existing palette and fonts. The reference's blue/pink neon is
**not** used — A keeps `--icy`, B keeps the per-matchup `--gold` (lime/gold/red), roast
rows use red.

Each breakdown row is a funny "most likely to…" title tied to a **real** metric, with its
own score, tier, bar, and a grounded one-line read. The read sentence is **human-sounding
and carries no numbers** (the score/tier/bar beside it already do) — e.g.
_"Committed to one palette and never blinked — every piece looked chosen, not grabbed."_
(not _"Theo's color read 91–78 — committed to one palette…"_).

## Decisions (from brainstorming)

1. **Row data source — AI-authored, real-scored.** The model writes the funny title + a
   short reason clause and links each row to a metric; `computeBattle` still owns every
   number. Requires a manual `versus-scan` edge-function redeploy. Old saved battles fall
   back gracefully.
2. **Row composition — curated highlights (~4–5).** Real metric sets are 4 per modality
   (face: jawline/hairline/rizz/aura; fit: drip/physique/pose/confidence), so in practice
   the panel surfaces all 4, with the AI choosing flex-vs-roast framing per row and the
   selection guaranteeing at least one roast row when one exists.

## Current state (what we're changing)

- `VersusResult.tsx` → `VerdictTab` already renders a working **card stack** (`BattleCard`)
  on the left. The right `.vs-bd` breakdown is built but gated off by
  `const SHOW_BREAKDOWN = false`. When off, the grid is forced to a single centered column.
- The old (hidden) breakdown rendered: overall winner + margin pill + punchline, a scoreline,
  3 stat-cards, decisive-read copy, category chips, a `SuperlativesRow` of locked
  tap-to-reveal chips, and a "Where it was won" grid.
- AI copy today (`VersusCopy`): `crown {winner,line}`, `decisiveRead`, per-side
  `superpower`/`roast` per modality, and `superlatives: {label, winner, locked}[]`
  (≈3 funny labels, exactly one locked, **not tied to any metric or score**).

## Layout

Re-enable `.vs-verdict` as a two-column grid (remove the `SHOW_BREAKDOWN` single-column
override and the gate):

- **Left — card stack.** Keep the existing `BattleCard` (face-duel / fit / overall share
  card) as the sharp **front** card, presented in a peek-behind deck: two rotated,
  translucent backdrop cards behind it (handoff treatment: `rotate(-5deg) translateY(10px)
  scale(0.97)` and `rotate(3.5deg) translateY(5px) scale(0.985)`, opacities ~0.5 / ~0.72).
  The **Download card** button sits below. One card per mode → no dots.
- **Right — breakdown panel** (see below).
- **Mobile:** single column, breakdown stacked under the card.

## Breakdown panel (right column)

Mirrors the reference (`Result Deck v2.dc.html` lines 449–511), restyled to our tokens.

1. **Header row**
   - Eyebrow: `Overall winner` (or `Dead heat`) in the winner's side color.
   - `winnerName` in Anton, large, with a soft side-color glow.
   - Margin pill (right): reuse `summarizeBattle(...).marginLabel`
     (`By a hair` / `Close call` / `Clear win` / `Blowout` / `Dead heat`), boxed in the
     winner color.
2. **Scoreline:** `nameA  avgA  /  avgB  nameB` — winner side at full opacity + glow, loser
   dimmed (`opacity ~0.42`). Numbers in Anton, names in Space Mono (A icy, B gold).
3. **Hairline divider.**
4. **Superlatives header:** left `Superlatives`, right `Most likely to…` (Space Mono).
5. **Reads list** — ~4 rows, each a 2-column card (`grid-template-columns:1fr 1fr`):
   - *Left (the joke):* mountain-glyph badge in the row's side color + **title** (Hanken 700)
     + a tag below:
     - flex: `{METRIC} · +{gap} ahead` (muted)
     - roast: `Roast · {METRIC} · {gap} behind` (red)
   - *Right (the read):* metric label (Space Mono, muted) + winner **name** (Anton, side
     color, glow) on the left; **score** (Anton) + **tier** stacked on the right; a fill bar
     (`width = score%`); then the **why** line (Hanken 500, muted).
   - **Flex row** = crowns the metric's real leader, accent = that side's color.
     **Roast row** = names the metric's real trailer, accent/score/tier/bar/tag = red.
   - **Tier** (from the displayed score): flex → `Elite` ≥90, `Strong` ≥82, else `Solid`;
     roast → `Needs work`.
   - **Read** line is the AI's `reason` rendered **verbatim** — a complete, human-sounding
     sentence with **no numbers and no templated `"{name}'s {metric} read 88–82 —"` prefix**.
     The figures live in the score/tier/bar to its right, so the prose never recites them and
     never drifts. Flex reads describe the win conversationally; roast reads land the burn.
6. **Final word** panel: dual-corner radial-tinted card; label `Final word`; body = AI
   `copy.crown.line` (already reconciled to the computed winner in `assemble.ts`), with the
   templated fallback `"{winner} edges {loser} {hi}–{lo}. Screenshot it. Gloat responsibly."`
   when copy is absent (dev/legacy).
7. **Actions:** `Rematch` (calls existing `onRematch`) + `Share the verdict` (existing
   `share()`).

## Data-layer changes (`packages/shared/src/versus`)

### `schema.ts`
- Add:
  ```ts
  /** One AI-authored breakdown read, linked to a real metric. */
  export interface VerdictRead {
    /** Active-modality metric key this read is about (e.g. `jawline`). */
    metricKey: string;
    /** Funny "most likely to…" line. */
    title: string;
    /** true = flex (crown the metric leader); false = roast (mock the trailer). */
    flex: boolean;
    /** The full human-sounding read sentence, rendered verbatim. No numbers. */
    reason: string;
  }
  ```
- In `VersusCopy`, **replace** `superlatives: Superlative[]` with `reads: VerdictRead[]`.
- `Superlative` type: remove if nothing references it after the `SuperlativesRow` deletion
  (verify by grep). Legacy stored battles carry `superlatives`, but those items have no
  `metricKey`/`reason`, so they cannot populate the new metric-linked rows — legacy battles
  use the static-bank fallback (below), not their stored `superlatives`.

### `aiSchema.ts`
- Replace the `superlatives` zod block with:
  ```ts
  reads: z.array(z.object({
    metricKey: z.string(),
    title: clamped(80),
    flex: z.boolean(),
    reason: clamped(180), // full human sentence, no numbers
  })).max(8)
  ```

### `prompt.ts`
- responseSchema: replace `superlatives` with `reads` (`metricKey` STRING, `title` STRING,
  `flex` BOOLEAN, `reason` STRING; all required), update top-level `required`.
- Instruction: replace the `SUPERLATIVES:` paragraph with a `READS:` paragraph — for ~4–6
  metrics, invent a funny `title` ("most likely to…"); set `flex:true` to crown that
  metric's leader as a flex or `flex:false` to **roast its trailer**; set `metricKey` to one
  of the active metric keys; write `reason` as **one complete, human-sounding sentence** that
  explains the read like a friend talking — grounded in a specific visible detail. **Never
  state scores or numbers** and **do not start with "{name}'s {metric} read…"**; the score
  badge already shows the figures. Cover at least one roast. Keep `title` ≤ ~70 chars,
  `reason` ≤ ~170.
- **Voice — savage roasts.** Roast `title`s should be brutal group-chat superlatives about
  the social fallout of the photo, not flat metric restatements — e.g. _"Most likely to
  fumble his first date"_, _"Most likely to get left on read"_, _"Most likely to peak in the
  group photo"_. Flex `title`s stay cocky-funny (_"Gatekeeps their skincare routine"_).
  The `reason` lands the burn hard. **The existing HARD NEVER list still governs every line
  unchanged** — aim at the photo, fit, angle, lighting, pose, effort, and ego; never at
  identity, body, or anything the person can't change. Savage at the bit, never an actual
  bully.

### `assemble.ts`
- Remove `coerceOneLocked`. Add `shapeReads(ai.reads, mode)`:
  - keep only reads whose `metricKey` is an active-modality metric key,
  - drop duplicate metricKeys (keep first),
  - pass through `title` / `flex` / `reason` (already clamped by zod).
- Store `reads` instead of `superlatives` in the returned `copy`.
- `decisiveRead` and per-side `superpower`/`roast` are unchanged (the latter still feed the
  Face/Outfit comparison tabs; `decisiveRead` stays produced but is no longer rendered).

### Shared selection helper (`computeBattle.ts` or a new `reads.ts`)
- `deriveReads(verdict: BattleVerdict, copy: VersusCopy | null, names): DerivedRead[]`:
  - **Source of titles/reasons:** `copy.reads` when present; else a static per-metric
    title/reason bank (so legacy battles without `reads` and the dev seed still render). The
    static bank keys a flex title + a full human-sounding `reason` sentence by metric key,
    plus one roast title + reason sentence per metric — same voice as the AI reads, no numbers
    (the handoff's `_whyFlex`/`_whyRoast` tables, rewritten as complete sentences).
  - For each candidate metric: compute `gap`, skip `gap === 0`; resolve `flex`’s
    leader/trailer from real scores; compute `score`, `name`, `tier`, `barColor`, `tag`; the
    read sentence is the `reason` verbatim (no number templating).
  - Sort by `gap` desc, take top 5; if no roast present, swap the 5th for the
    largest-gap roast candidate (handoff logic, `Result Deck v2.dc.html` lines 735–741).
  - Returns view-ready rows (numbers + resolved side + flags) — the React component only maps
    to JSX.

### Tests
- Update `aiSchema.test.ts`, `assemble.test.ts`, `prompt.test.ts` for `reads`
  (drop locked-coercion cases).
- Add `deriveReads` unit tests: flex/roast resolution from scores, gap sort + roast
  guarantee, `copy.reads` passthrough, no-`reads` (legacy/dev) static-bank fallback,
  `gap===0` skip, and that no rendered read string contains a digit.

## UI changes (`apps/web/src/features/versus`)

- **`VersusResult.tsx`:**
  - Remove `SHOW_BREAKDOWN` gate; render the new `.vs-bd` per spec; restore the 2-col grid.
  - Wrap `BattleCard` in the peek-behind deck stage.
  - Replace `SuperlativesRow` usage; render the reads list via a new `VerdictReadRow`.
  - Drop `WonCard`, `CatChip`, the stat-cards, and `SuperlativesRow` from this tab (remove
    if unused elsewhere — verify by grep before deleting).
- **`components/versusBits.tsx`:** add `VerdictReadRow` (stateless; consumes a `DerivedRead`
  + `names`). Remove `SuperlativeChip`/`SuperlativesRow` if no longer referenced.
- **`design/versus.css`:** replace `.vs-bd` stat-cards / cat-chips / superlatives / wongrid
  rules with the new header / scoreline / reads-list / final-word styles. Add the
  `.vs-stack` peek-behind backdrop. All colors via `--icy` / `--gold` / red; no new hex for
  contender colors.

## Fallback behavior

- **New battles:** `copy.reads` → full AI-authored rows.
- **Legacy saved battles** (stored with `superlatives`, no `reads`): `deriveReads` ignores
  the stored `superlatives` (not metric-linked) and builds rows from real metrics + the
  static title/reason bank → panel still renders, just without the new AI titles.
- **Dev fallback** (refresh straight onto `/versus/result`, no `copy`): same static-bank path
  over the seeded metrics.

## Deploy

- Manual `versus-scan` edge-function redeploy is required for the prompt/schema change
  (the deploy already flagged pending in memory). `.ts` import extensions, project ref +
  command per the solo-scan deploy note. Until redeployed, new battles still render via the
  fallback bank, so the UI is safe to ship ahead of the deploy.

## Out of scope / dropped

- Tap-to-reveal **locked** superlative wildcard (not in the reference).
- Stat-cards, category chips, "Where it was won" grid (superseded by the reads list).
- The left-card sub-toggles (Verdict/Stats, Face/Outfit) seen in Image #1 — the card stack
  stays one share card per mode.
- No change to the Face/Outfit comparison tabs.
