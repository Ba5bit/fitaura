# Solo-Scan Score Diversity + Caption Bank Expansion — Design

**Date:** 2026-06-15
**Status:** Approved design, pending implementation plan
**Area:** `packages/shared/src/solo-scan`, `supabase/functions/solo-scan`, `packages/shared/src/sticker-bank.ts`

## Problem

Two complaints about the post-analysis result:

1. **Scores feel samey and never go low.** Gemini rates each rubric category as an
   integer 1–5; the curve `RATING_SCORE = {1:35, 2:50, 3:65, 4:80, 5:92}` plus a ±3
   jitter collapses every displayed score into one of five narrow bands
   (~32–38, 47–53, 62–68, 77–83, 89–95). There is no way to land in the 10s, 20s, or
   40s. The floor is ~32. Goal: genuinely diverse scores spanning **10 to 90+**.

2. **Captions repeat.** The fixed "punchy" content bank (`content-bank.ts`) holds only
   5 face archetypes, 5 outfit captions, and 4 punchlines, selected by one of just 3
   verdicts. The pool is too small and too coarse.

## Decisions (from brainstorming)

- Score engine: **Gemini outputs a direct 0–100 score per category** (replaces 1–5).
- Caption bank: **expand all three pools** and **tie selection to finer score bands**,
  not just the 3 verdicts. Incorporate the user's meme vocabulary.

---

## Section 1 — Scoring engine: 0–100 direct

### Schema (`packages/shared/src/solo-scan/schema.ts`)

`rubricRatingSchema.rating`: `z.number().int().min(1).max(5).nullable()`
→ `z.number().int().min(0).max(100).nullable()`. Integer kept (clean display);
nullable kept (unassessable categories).

### Prompt (`supabase/functions/solo-scan/gemini.ts`)

- `RUBRIC_SHAPE.rating` stays `{ type: 'INTEGER', nullable: true }` (range is now 0–100).
- Replace the "Use the 1-5 rubric…" line in `SYSTEM_INSTRUCTION` with an anchored
  0–100 rubric:

  > Score each category 0–100. Anchor: 0–20 clearly weak for this presentation ·
  > 21–40 below average · 41–60 neutral or mixed · 61–80 strong · 81–100 clearly
  > elite. Use the full range, differentiate categories from one another, and avoid
  > clustering on round multiples of 10. Return a null rating only when a category
  > genuinely cannot be assessed.

- `generationConfig.temperature` 0.2 → **0.3** to encourage spread.

### Scoring (`packages/shared/src/solo-scan/scoring.ts`)

- Delete the `RATING_SCORE` table.
- `scoreFromRating(rating)` becomes a pass-through clamp:
  `rating == null ? null : clamp(rating, 0, 100)`. Name retained to avoid churn across
  `assemble.ts` and tests; add a comment noting the rating *is* the score now.
- `weightedAverage`, `faceScore`, `outfitScore`, `auraIndex`, `displayScore` (±3
  jitter), `percent` — unchanged; all already operate on 0–100.
- **`pickVerdict` bands recalibrated.** Starting thresholds:
  `green_flag ≥ 70`, `normie ≥ 45`, else `red_flag` (still with the ±3 seeded nudge).
  These are an estimate; the true aura distribution depends on how Gemini uses the
  scale. Treated as a **post-launch calibration pass** once live outputs are observed
  (see Risks).

### Assembly (`packages/shared/src/solo-scan/assemble.ts`)

- `DESCRIPTOR` (keyed 1–5) → a 0–100 banded helper `descriptorFor(score)`:
  `≥85 Elite · ≥68 Strong · ≥45 Even · ≥25 Soft · <25 Off · null → "—"`.
  Callers pass the computed 0–100 score instead of the raw rating.
- `UNSCORED_DISPLAY = 50` unchanged. `tags` sort (`b.rating - a.rating`) still valid
  (ordering preserved). Receipt percent metrics read truer 0–100 bases — improvement,
  no structural change.

### Versioning (`packages/shared/src/solo-scan/constants.ts`)

- `SOLO_SCAN_SCHEMA_VERSION` → `solo_scan_v2` (rating scale changed).
- `SOLO_SCAN_PROMPT_VERSION` → `v2` (prompt + scoring changed; re-seeds jitter).
- Old saved generations are stored as assembled `FullGenerationResult` JSON and are
  unaffected — only new scans use v2. `soloScanSchema` validates Gemini's `schemaVersion`
  field at scan time; the prompt instructs Gemini to emit `solo_scan_v2`.

---

## Section 2 — Caption bank: expand + tie to score bands

### Score bands

A finer band derived from the aura index (`packages/shared/src/solo-scan/content-bank.ts`):

| band    | aura range |
|---------|------------|
| `elite` | ≥ 80       |
| `high`  | 65–79      |
| `mid`   | 50–64      |
| `low`   | 35–49      |
| `poor`  | 20–34      |
| `dire`  | < 20       |

`scoreBand(aura: number): ScoreBand`.

### Pick logic

Each picker (`pickFaceArchetype`, `pickOutfitCaption`, `pickPunchline`) signature gains
the band + scan seed: `pick…(candidates, band, scanId)`.

1. Filter AI `candidates` to those present in the (expanded) bank. If any remain, pick
   one **deterministically by `scanId` seed** (reuse the FNV-1a `hashSeed`).
2. Otherwise pick deterministically (same seed) from `BAND_POOL[band]`. If a band's pool
   is empty, fall back to the nearest non-empty band toward `mid`.

Result: lines vary **per scan** (seeded, stable across re-renders) *and* **per band**, so
a 15-score and a 45-score red flag get different lines. AI suggestions still win when
present and valid.

### Content bank (starting set)

Tone legend: `accent` = good (green), `chrome` = neutral, `warn` = bad (red).
Entries can be refined during implementation; this is the concrete launch set.

**Face archetypes** — `line: [string, string]`, `stickerId`, band:

| band  | line                          | stickerId         | tone   |
|-------|-------------------------------|-------------------|--------|
| elite | CERTIFIED / GOAT              | `goat`            | accent |
| elite | CERTIFIED / MAFIA BOSS        | `mafia-boss`      | accent |
| high  | MAIN / CHARACTER              | `main-character`  | chrome |
| high  | CERTIFIED / AURA FARMER       | `aura-farmer`     | accent |
| high  | LOCKED / IN                   | `locked-in`       | accent |
| mid   | CLEAN NPC / PLOT RELEVANT     | `plot-relevant`   | chrome |
| mid   | HONORABLE / MENTION           | `honorable-mention` | chrome |
| low   | RED FLAG / WITH GOOD ANGLES   | `hear-me-out`     | warn   |
| low   | DELUSIONAL / BUT CONFIDENT    | `delusional`      | warn   |
| poor  | CHOPPED / —                   | `chopped`         | warn   |
| poor  | CANON / EVENT                 | `canon-event`     | warn   |
| poor  | CERTIFIED / AI SLOP           | `ai-slop`         | warn   |
| dire  | NEGATIVE / AURA               | `negative-aura`   | warn   |
| dire  | UNC / STATUS                  | `unc`             | warn   |

**Outfit captions** — `caption`, `stickerId`, band:

| band  | caption                    | stickerId        | tone   |
|-------|----------------------------|------------------|--------|
| elite | THE FIT IS LOCKED IN       | `locked-in`      | accent |
| elite | LET HIM COOK               | `let-him-cook`   | accent |
| high  | THE FIT HAS LORE           | `fit-has-lore`   | accent |
| high  | RIZZ ON SIGHT              | `rizz`           | accent |
| mid   | CLEAN NPC WITH POTENTIAL   | `buffering`      | chrome |
| mid   | PERFORMATIVE EDITORIAL     | `performative`   | chrome |
| low   | DELULU BUT WORKING         | `delulu`         | chrome |
| poor  | CERTIFIED AI SLOP          | `ai-slop`        | warn   |
| poor  | CHOPPED FIT                | `chopped`        | warn   |
| dire  | NEVER COOK AGAIN           | `never-cook-again` | warn |
| dire  | IN AURA DEBT               | `aura-debt`      | warn   |

**Punchlines** — final viral line, band:

| band  | punchline                  |
|-------|----------------------------|
| elite | CERTIFIED GOAT             |
| elite | BUILT DIFFERENT            |
| high  | CERTIFIED LOVER BOY        |
| high  | RIZZ GOD CONFIRMED         |
| high  | CERTIFIED AURA FARMER      |
| mid   | CLEAN NPC WITH POTENTIAL   |
| mid   | HONORABLE MENTION          |
| low   | RED FLAG WITH GOOD ANGLES  |
| low   | DELUSIONAL LOVER BOY       |
| poor  | NEGATIVE AURA DETECTED     |
| poor  | CERTIFIED AI SLOP          |
| dire  | IN AURA DEBT               |
| dire  | CANON EVENT: CHOPPED       |

### Stickers (`packages/shared/src/sticker-bank.ts`)

Add presets so caption stickerIds resolve to matching labels instead of falling back to
`[0]`. New face stickers: `goat`, `mafia-boss`, `locked-in`, `honorable-mention`,
`delusional`, `chopped`, `canon-event`, `negative-aura`, `unc`, `ai-slop` (existing reused:
`main-character`, `aura-farmer`, `hear-me-out`, `plot-relevant`, `chad`).
New outfit stickers: `locked-in`, `rizz`, `delulu`, `ai-slop`, `chopped`, `aura-debt`
(existing reused: `let-him-cook`, `fit-has-lore`, `buffering`, `performative`,
`never-cook-again`). Labels match the caption text; tone per tables above; rotation
follows existing convention (face ≈ −8…−6, outfit ≈ 6…7).

### AI allowlist (`gemini.ts`)

Expand the `faceArchetypeCandidates` / `outfitCaptionCandidates` / `punchlineCandidates`
allowlists in `SYSTEM_INSTRUCTION` to the new ids so Gemini can drive relevant picks; the
band-pool fallback guarantees variety regardless.

---

## Section 3 — Tests, fixtures, deploy

- **Update:** `scoring.test.ts` (curve→pass-through; new verdict band thresholds),
  `assemble.test.ts`, `content-bank.test.ts`, `__fixtures__.ts` (fixture ratings 1–5 →
  0–100).
- **Add:** `scoreBand` boundary tests; seeded band-pool pick determinism + band-variance
  tests; a full-range diversity assertion in scoring (low ratings → low display scores).
- **Deploy:** redeploy the `solo-scan` edge function (bundles the shared
  schema/scoring/assemble/content-bank + prompt). Push to main without asking per
  standing instruction.
- **Dev-log:** write a study log under `docs/dev-log/` per project convention.

## Risks / open items

- **Verdict band calibration.** 70/45 thresholds are an estimate. After deploy, sample a
  handful of real scans; if the distribution skews, adjust thresholds (and possibly the
  prompt anchor) and bump `PROMPT_VERSION` again. Cheap and isolated.
- **Gemini round-number clustering.** 0–100 models tend to favor multiples of 5/10; the
  prompt explicitly discourages it and the ±3 jitter smooths residual banding.
- **Two-line vs one-line stamps.** A few new face lines are single-concept (CHOPPED);
  represented as `['CHOPPED', '']` — implementation must render an empty second line
  gracefully (verify against the stamp component).
