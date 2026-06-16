# 045 — Solo Scan v3.1: meme glory vs honest celebrity

Live behavioral testing of v3 surfaced a gap. Uploading **McLovin** (Superbad) produced
Aura 36 / Red Flag / "Beta Energy" / "Certified AI Slop" — a beloved icon getting trashed.
The v3 icon path *did* fire (the "Giving McLovin energy" line only prints when
`recognizedConfidence ≥ 0.85`, which is above the ×1.15 gate), but **×1.15 is a gentle nudge,
not a tier-jump** — +15% on a face the model rated low is still low.

User intent (the fix): **meme/fictional characters get glory; real public figures get the honest
read.** McLovin should be a legend; Lewis Hamilton / Timothée Chalamet should score high *on
merit* (the model's genuine read), not on a thumb on the scale — and an unattractive real person
should score honestly too.

Versions bumped `solo_scan_v3 → solo_scan_v3_1`, `v3 → v3_1`. 94 web tests green, typecheck +
build clean. **Edge function redeployed** (scoring runs server-side; see
[[fitaura-solo-scan-deploy]]).

## The key new signal: `recognizedKind`
v3's `recognizedIcon` was just a name — it couldn't tell McLovin (fictional) from Hamilton
(real), so the old ×1.15 hit both identically. v3.1 adds `recognizedKind: 'meme' | 'real_person'
| null` to the `presentation` schema; the prompt asks the model to classify what it recognized
(fictional/cartoon/comedic/meme vs real public figure). The Gemini response schema mirrors it
(enum, nullable, required) so the model is forced to emit it.

## The mechanism — and why it floors *every rating*, not just the Aura
- **Confident meme** (`recognizedKind==='meme'` && `recognizedConfidence ≥ 0.60`) → **glory**.
- **Real person** → **no boost at all**. The old ×1.15 icon multiplier is *gone* from
  `biasFactor` (which is now femme-only). Real recognitions get the pure honest read.

Glory is implemented as `applyGloryFloor`: it lifts **every** face/outfit rating up to a
per-category **seeded value in [GLORY_MIN=75, GLORY_MAX=92]** (never lowering a genuinely-high
rating; a `null` rating becomes the floor). Crucially it floors the *ratings*, not just the final
Aura — otherwise you'd get the broken-looking card the user would've hated: "Aura 85" sitting next
to "Face Harmony 37 / Soft". By flooring ratings first, the aggregates, Aura (lands 75–92), the
verdict (green), the descriptors (Strong/Elite), and the sub-scores **all read high and
coherent**. Per-category seeds keep it varied (not a flat 90 on every tile, and different between
memes/scans) — that was the user's pick ("strong + varied").

Content: for a glory scan, `assembleResult` passes `undefined` candidates to
`pickFaceArchetype/Caption/Punchline`, so it **ignores the model's (often low) nominations** and
pulls legend-tier lines from the now-high/elite band pool — McLovin gets `CERTIFIED GOAT` /
`MAIN CHARACTER`, not `NEGATIVE AURA`.

## Gotchas / notes
- **`insufficient_signal` + glory:** the glory floor runs *before* the null-face check, so a
  confident meme never throws insufficient-signal (nulls get floored). Fine in practice — if the
  model couldn't read the face at all it wouldn't confidently recognize a meme either.
- **Femme + meme compose:** femme ×1.07 (gender) still applies to ratings; the glory floor then
  lifts them. A femme meme gets femme content from the high/elite femme bank.
- **Name-in-copy unchanged:** still surfaces at `recognizedConfidence ≥ 0.85` for both kinds
  ("Giving Lewis Hamilton energy").
- **`ICON_SCORE_BIAS` removed** from code (the ×1.15). `ICON_CONFIDENCE_MIN` (0.60) is now the
  glory/name gate. If you see `ICON_SCORE_BIAS` referenced in the v3 spec/plan/dev-log-042, those
  are historical.
- **Tuning levers:** `GLORY_MIN`/`GLORY_MAX` in `scoring.ts` set how legendary memes feel; the
  meme-vs-real classification quality is the prompt's `recognizedKind` instruction in `gemini.ts`.

## Verify
Re-scan McLovin → should land green/high with legend content + "Giving McLovin energy". Scan a
real attractive celebrity → high *on merit* (no artificial floor). Scan a plain real person →
honest (no boost). Edge fn redeploy is required for any of this (scoring is server-side).
