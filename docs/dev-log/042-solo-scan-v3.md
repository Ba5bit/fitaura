# 042 — Solo Scan v3: gender-aware scoring, icon recognition, savage voice

Second tuning pass on the real (Gemini) Solo Scan after the v2 score-diversity work
(`041`). v3 makes the read **gender-aware**, lets the model **recognize public
figures / meme faces**, rewrites the copy **voice** to be savage and anti-AI-slop, and
**swaps a Face Card metric**. Shipped as two parallel buckets merged to `main`:

- **Bucket B** (`ef67b74`) — the scoring/content/prompt engine (this log's focus).
- **Bucket C** (`f2a3778`) — frontend tweaks, logged separately in `043`.

Spec/plan: `docs/superpowers/specs/2026-06-16-*` + `docs/superpowers/plans/2026-06-16-*`.
`tsc --noEmit` + `vite build` clean; 74 unit tests pass. Versions bumped:
`SOLO_SCAN_SCHEMA_VERSION → solo_scan_v3`, `SOLO_SCAN_PROMPT_VERSION → v3`.

> The full, always-current map of every weight / threshold / bank lives in
> `docs/solo-scan-scoring-and-content-reference.md` (kept at v3). This log is the
> *why* behind the changes; that doc is the *what*.

## The rule that still holds
Same north star as `015`: **Gemini observes and classifies; the backend decides and
calculates; the frontend presents.** v3 added inputs to the model's observation
(`presentation`) and new deterministic transforms in the backend (bias, gendered
picks), but the model still never computes a score, verdict, or final caption — the
prompt explicitly forbids it. This is why all four v3 features could land with the
scoring still 100% unit-testable without calling the model.

## 1. The `presentation` field (new model output)
`schema.ts` gained a `presentation` object: `gender` (`femme|masc|unsure`),
`genderConfidence`, `expressionStrength` (0–100), `recognizedIcon` (string|null),
`recognizedConfidence`. The Gemini `RESPONSE_SCHEMA` in `gemini.ts` mirrors it so the
model is structurally forced to emit it.

**Framing was deliberate and load-bearing.** The prompt calls this an *apparent
presentation read for entertainment styling*, explicitly **not an identity claim**, and
keeps the "do not infer ethnicity/religion/sexuality/health/…" guardrail. (The v2
reference doc flagged that the old guardrail line — "do not infer … gender identity …" —
*conflicted* with this feature; v3 reworded it to permit a presentation read while still
banning identity/protected-trait inference.) Icon recognition is scoped hard: **only**
widely-known public figures or meme characters, **never** a private/ordinary individual →
`null`. A future agent loosening either of these is changing the product's safety posture,
not just a prompt string.

## 2. Score bias (femme + icon) — multiplicative, gated, applied once
`scoring.ts` gained `biasFactor(presentation)` and `applyScoreBias(ai, factor)`:

- Confidently femme (`gender==='femme' && genderConfidence>=0.60`) → ×1.07
  (`FEMME_SCORE_BIAS`).
- Recognized icon (`recognizedIcon!=null && recognizedConfidence>=0.60`) → ×1.15
  (`ICON_SCORE_BIAS`).
- They compose multiplicatively; `biasFactor` is `1.0` when neither gate is met.

**Design decisions worth keeping:**
- **Applied up front, once.** `assembleResult` computes the factor, produces a biased
  *clone* of the AI output (`applyScoreBias`), and runs *everything downstream* (aggregates,
  Aura Index, verdict, band, every sub-score) on the clone. So the bias is internally
  consistent — you never see a biased aggregate next to an unbiased breakdown.
- **`applyScoreBias` returns the input unchanged when `factor === 1`.** The common (neutral)
  path allocates nothing and is referentially identical — cheap and side-effect-free.
- **`expressionStrength` and all copy are NOT biased.** The Masc/Fem Index is a vanity stat,
  not a score; biasing it would be meaningless.
- **Gotcha — the bias shifts the verdict input.** `pickVerdict` reads the (already biased)
  Aura Index, so femme/icon scans skew greener. The `70/45` thresholds are still the v2
  estimate and were **not** recalibrated for v3 — that's an open follow-up (sample real
  scans, then adjust `pickVerdict`). Tune `FEMME_SCORE_BIAS` (doc'd range 0.05–0.10) and the
  thresholds *together*.

## 3. Gendered content banks + female-coded overrides
`content-bank.ts` roughly doubled: each bank now carries NEUTRAL entries plus
`gender: 'masc'` and `gender: 'femme'` entries (face 14/8/9, outfit 11/5/5, punchline
15/6/5). Two mechanisms:

- **Gender filtering in `pickBanded`.** A new `eligibleFor(entry, gender)` gates both the
  model's candidate IDs *and* the fallback pool: a femme scan sees NEUTRAL+FEMME, a
  masc/unsure scan sees NEUTRAL+MASC. So a mis-tagged candidate from the model is *dropped*,
  not rendered. The prompt is told the same rule, but the backend enforces it.
- **Female-coded line overrides.** Some neutral entries carry a `femme:` variant rendered
  only for femme scans (`let_him_cook` → "LET HER COOK", `certified_lover_boy` → "CERTIFIED
  HEARTBREAKER", `unc` → "AUNTIE STATUS", `delusional_lover_boy` → "DELULU IT-GIRL"). This
  satisfies the prompt's "femme copy must never say 'lover boy'" rule for the *picked lines*.

**Gotcha — "unsure" maps to masc content.** `confidentlyFemme` requires `gender==='femme'`
*and* `genderConfidence>=0.60`; everything else (including `unsure`) → `contentGender='masc'`.
So masc is the default. A femme read below 0.60 confidence gets neither the bias nor femme
content. This mirrors the bias gate, so the two stay in lockstep.

**Gotcha — receipt row labels are still ungendered.** The femme overrides cover the
archetype/caption/punchline/Masc-Fem-Index only. The static receipt rows in `assemble.ts`
still read "Lover-Boy Prob." even on a femme scan — a known gap, noted in §6 of the
reference doc. Left for a future pass to keep this one scoped.

## 4. Savage anti-slop voice + Face Card metric swap
- **Voice (`gemini.ts`):** a `VOICE:` block (savage, internet-native, sticker lexicon, roast
  the *presentation only*, one short sentence per field) plus a `BANNED:` list of corporate /
  AI tells ("elevate", "in today's world", "it's not just X it's Y", em-dash sermons, hedging,
  …). This is the lever against AI-slop copy — extend the banned list to kill new tells.
- **Face Card metric swap (`assemble.ts`):** the third Face Card mini-score is now the
  **Masc/Fem Index** (label "Femininity Index" when confidently femme, else "Masculinity
  Index"; value = `expressionStrength`). v2's tiles were `Aura · Jaw Presence · Face Harmony ·
  Main Character`; v3 is `Aura · Haircut Match · Masc/Fem Index · Main Character`. Jaw Presence
  and Face Harmony still live in the breakdown below the card. The landing showcase Face Cards
  (`mockGenerations.ts`, static) were updated to match (`ee43f70`).
- **Icon name in copy (`assemble.ts`):** the receipt summary prefixes "Giving {icon} energy."
  but **only** at `recognizedConfidence >= 0.85` (`ICON_NAME_CONFIDENCE_MIN`) — higher than the
  0.60 bias gate. So a face can get the ×1.15 score nudge without the app ever naming who it
  thinks you look like, which keeps a shaky guess from making a false-sounding claim.

## Deploy + verification status
The edge function is a **manual deploy** (not git/Vercel — see the reference doc §7 and the
`fitaura-solo-scan-deploy` convention). After the merge it was redeployed v4→**v5 ACTIVE** via
`npx supabase functions deploy solo-scan --project-ref rxtlbhjysksoxkdcdqyr --no-verify-jwt`;
Vercel auto-deployed the frontend. **Behavioral verification is still pending** — a real scan
(needs photos + a credit) to confirm femme bias + "Femininity Index" label, masc/femme content,
icon recognition (name only at ≥0.85), and the savage copy actually land. Then calibrate the
verdict split (§2 gotcha).
