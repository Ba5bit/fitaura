# 041 — Score diversity (0–100) + caption bank expansion

**Date:** 2026-06-15
**Branch:** `feat/score-diversity-caption-bank`
**Area:** `packages/shared/src/solo-scan`, `packages/shared/src/sticker-bank.ts`, `supabase/functions/solo-scan`

## Why

Two complaints about the post-analysis result:

1. **Scores felt samey and never went low.** Gemini rated each rubric category as an
   integer **1–5**, and the curve `RATING_SCORE = {1:35, 2:50, 3:65, 4:80, 5:92}` plus a
   deterministic ±3 jitter collapsed every displayed number into one of **five narrow
   bands** (~32–38, 47–53, 62–68, 77–83, 89–95). There was literally no way to land in the
   10s, 20s, or 40s — the floor was ~32. Goal: genuinely diverse scores spanning **10–90+**.
2. **Captions repeated.** The "punchy" content bank held only 5 face archetypes,
   5 outfit captions, and 4 punchlines, chosen by one of just **3 verdicts**. Too small,
   too coarse.

## What changed

### Scoring → direct 0–100 (the core fix)

The fix is conceptual, not cosmetic: the granularity bottleneck was the **1–5 rating**, so
no amount of jitter could fill the gaps. We moved the granularity to the source.

- **Schema** (`schema.ts`): `rating` is now `int 0–100 | null` (was `1–5 | null`).
- **Prompt** (`gemini.ts`): the model now scores each category **0–100** against an
  anchored rubric (`0–20 weak · 21–40 below avg · 41–60 neutral · 61–80 strong ·
  81–100 elite`), explicitly told to *use the full range, differentiate categories, and
  avoid clustering on round multiples of 10*. `temperature` nudged `0.2 → 0.3` for spread.
- **`scoreFromRating`** is now a pass-through clamp (`Math.max(0, Math.min(100, rating))`,
  null stays null). The whole `RATING_SCORE` curve table is gone. The weighted averages,
  `auraIndex`, `displayScore` (±3 jitter), and `percent` already operated on 0–100 — they
  were untouched.
- **Verdict bands recalibrated** for the new distribution: `green_flag ≥ 70`,
  `normie ≥ 45`, else `red_flag` (was 78/58, which assumed the old inflated 35-floor
  curve). These are a **starting estimate** — see Calibration below.
- **Descriptor labels** (`assemble.ts`) rebanded off 0–100: `≥85 Elite · ≥68 Strong ·
  ≥45 Even · ≥25 Soft · <25 Off`.

### Captions → 6 score bands + seeded selection

- New `scoreBand(aura)` → `elite ≥80 · high 65–79 · mid 50–64 · low 35–49 · poor 20–34 ·
  dire <20`. Finer than the 3 dating verdicts, which still drive the receipt tone.
- Each pool (face / outfit / punchline) is now keyed by band. Selection (`pickBanded`):
  1. if the AI returned a valid candidate (in the expanded bank), pick deterministically
     among those by the scan seed;
  2. otherwise pick deterministically from the band's pool.
  Determinism uses the FNV-1a `hashSeed` (now exported from `scoring.ts` and reused) with
  seed `${scanId}:${poolKey}:${band}` — so a saved result is stable across re-renders, the
  three picks for one scan don't move in lockstep, and **a 15-score and a 45-score red flag
  get different lines**.
- Bank expanded from the user's meme vocabulary: GOAT, Mafia Boss, Locked In, Aura Farmer,
  Rizz, Canon Event (placed in the *chopped* zone — a canon event is the unavoidable bad
  beat), Negative Aura, Aura Debt, Delusional, Delulu, Chopped, Unc, AI Slop, Honorable
  Mention, etc. Matching stickers added to `sticker-bank.ts` (face 5→15, outfit 5→11) so
  captions resolve to a real sticker label instead of falling back. The Gemini allowlists
  were expanded to the new ids so the model can also drive relevant picks.

### Versioning

`SOLO_SCAN_SCHEMA_VERSION → solo_scan_v2`, `SOLO_SCAN_PROMPT_VERSION → v2`. Old saved
generations are stored as assembled results, so they're unaffected; only new scans use v2.
The prompt version also re-seeds the display jitter.

## A subtlety worth remembering

`verdict` (jittered, 3 bands) and `band` (hard thresholds, 6 bands) are **intentionally
decoupled** scales off the same aura. Near a boundary, the card archetype/caption and the
receipt's verdict tone can land on different sides — that's by design (the verdict has a
deliberate ±3 nudge; the caption band does not). A comment in `assemble.ts` flags this so a
future reader doesn't "fix" the apparent inconsistency.

## Testing

TDD throughout. `apps/web` suite: **44 tests across 8 files, all green**; `npm run
typecheck` and `npm run build` clean. New/updated coverage: 0–100 clamp + diversity floor
(`displayScore(12,…)` lands in the teens), recalibrated verdict thresholds, `scoreBand`
boundaries, seeded pick determinism, and cross-band variety.

## Process

Brainstormed → spec (`docs/superpowers/specs/2026-06-15-…`) → plan
(`docs/superpowers/plans/2026-06-15-…`) → subagent-driven execution with two-stage review
(spec compliance ✅, code quality ✅ approve, minor nits applied).

## Calibration caveat (open item)

The 70/45 verdict thresholds are an estimate — the true aura distribution depends on how
Gemini actually uses the 0–100 scale. After deploy, sample several real scans; if the
green/normie/red split skews, adjust `pickVerdict` (and possibly the prompt anchor) and
bump `PROMPT_VERSION` again. Cheap and isolated.

## Deploy note

The `solo-scan` edge function imports the shared package via an import map
(`shared/` → `packages/shared/src/`), so a deploy must bundle the whole transitive set.
The Supabase CLI (`supabase functions deploy solo-scan`) handles this automatically; the
live function is `verify_jwt: false` and must stay that way.
