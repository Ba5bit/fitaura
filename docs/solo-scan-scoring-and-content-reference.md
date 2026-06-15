# Solo Scan — Scoring & Content Reference

> **Purpose.** A single map of how a Solo Scan turns two photos into three cards: what
> the Gemini model decides, what the backend decides, every scoring weight and threshold,
> every caption / sticker / punchline bank, and **where to edit what** when you want to
> tune the vibe. This is the reference for prompt fine-tuning.
>
> **Status:** describes the live system at `SOLO_SCAN_PROMPT_VERSION = v2` /
> `SOLO_SCAN_SCHEMA_VERSION = solo_scan_v2`. Keep this file in sync when you tune.

---

## 1. Pipeline overview

```
 ┌─────────────┐     ┌──────────────────────────┐     ┌────────────────────────────┐
 │ face photo  │ ──▶ │  Gemini (solo-scan fn)   │ ──▶ │  backend scoring + assembly │ ──▶ 3 cards
 │ outfit photo│     │  gemini.ts SYSTEM_INSTR. │     │  scoring.ts + assemble.ts   │
 └─────────────┘     └──────────────────────────┘     └────────────────────────────┘
```

**The model decides** (per category, 0–100): the raw rubric ratings, confidence, and a
short evidence string; usability of the photos; the copy strings (face/outfit summaries,
"works/hurts/verdict"); and **candidate lists** of archetype / caption / punchline / sticker
IDs drawn from fixed allowlists.

**The backend decides** (deterministic, seeded by `scanId`): the aggregate Face / Outfit
scores, the **Aura Index**, the categorical **verdict** (green / normie / red), display
jitter (±3 so scores don't look suspiciously round), the receipt's flavor metrics, and the
**final pick** of archetype / caption / sticker / punchline from the model's candidates.

> The model never computes the Aura Score, Dating Score, or verdict — the prompt explicitly
> forbids it (`gemini.ts` SYSTEM_INSTRUCTION). Final scoring is 100% backend, so it's stable
> and tunable without re-prompting.

**Key files**

| File | Role |
|---|---|
| `supabase/functions/solo-scan/gemini.ts` | The prompt (`SYSTEM_INSTRUCTION`), the response JSON schema, the Gemini call. |
| `supabase/functions/solo-scan/index.ts` | HTTP handler: validate images → call Gemini → validate → assemble → log. |
| `packages/shared/src/solo-scan/schema.ts` | Zod contract for the model's JSON + the canonical `FACE_KEYS` / `OUTFIT_KEYS`. |
| `packages/shared/src/solo-scan/scoring.ts` | Weights, `auraIndex`, `displayScore` jitter, `percent`, `pickVerdict`. |
| `packages/shared/src/solo-scan/content-bank.ts` | `scoreBand` + the archetype / caption / punchline banks + `pickBanded`. |
| `packages/shared/src/solo-scan/assemble.ts` | Turns the rubric + banks into the final `FullGenerationResult`. |
| `packages/shared/src/sticker-bank.ts` | The face / outfit sticker presets (label, tone, rotation). |
| `packages/shared/src/solo-scan/constants.ts` | `SOLO_SCAN_PROMPT_VERSION` / `SCHEMA_VERSION`. |

> Note: the **landing page** hero/analysis cards use *static showcase data*, not this
> pipeline. Numbers like "Commitment Risk: LOW" or traits like "Eyebrows / Facial Hair" on
> the marketing page are hard-coded mockups; the real assembled output is defined in
> `assemble.ts` (see §6). Don't tune against the landing mock.

---

## 2. The Gemini prompt (current `SYSTEM_INSTRUCTION`)

Verbatim from `gemini.ts`:

```
You are FitAura's Solo Scan visual classification engine.
Analyze the supplied FACE PHOTO and OUTFIT PHOTO using only visible, presentation-related evidence.
Return only JSON matching the provided schema. The result is entertainment-oriented styling
feedback. Do not present subjective judgments as scientific, biometric, medical, or psychological facts.
Do not infer identity, ethnicity, nationality, religion, sexuality, gender identity, health,
disability, wealth, criminality, real trustworthiness, real personality, or romantic compatibility.
If an attribute cannot be assessed reliably, return a null rating and explain why briefly.
Score each category 0-100. Anchor: 0-20 clearly weak for this presentation, 21-40 below average,
41-60 neutral or mixed, 61-80 strong, 81-100 clearly elite. Use the full range, differentiate
categories from one another, and avoid clustering on round multiples of 10. Return a null rating
only when a category genuinely cannot be assessed.
Keep evidence concrete and tied to visible image details. Keep all copy to one short sentence.
Select content IDs only from these allowlists.
faceArchetypeCandidates allowed: <14 IDs — see §5>
outfitCaptionCandidates allowed: <11 IDs — see §5>
punchlineCandidates allowed: <13 IDs — see §5>
Do not calculate the final Aura Score, Dating Score, or categorical verdict. The backend performs
final scoring and verdict assignment.
Set schemaVersion to "solo_scan_v2".
```

**Annotations / levers:**

- **Scoring anchor** — the `0-20 … 81-100` band text is the single biggest lever on score
  distribution. Loosening/tightening it shifts where real scans land. (See §4 for how that
  feeds the green/normie/red split.)
- **"avoid clustering on round multiples of 10"** + `temperature: 0.3` — pushes the model
  off lazy 70/80/90 answers so categories actually differentiate.
- **Allowlists** — the model can only pick caption/archetype/punchline IDs that exist in the
  banks. Adding a new funny line means adding it to **both** the bank (§5) **and** the prompt
  allowlist, or the model can never choose it.
- **Guardrail line** ("Do not infer … gender identity …") — this is the clause that conflicts
  with the planned gender-aware feature; it will be reworded in Bucket B.
- **Generation config** (`gemini.ts buildBody`): `temperature 0.3`, `maxOutputTokens 2500`,
  `thinkingConfig.thinkingBudget 0`, structured JSON output via `responseSchema`.

---

## 3. The model's response contract (`schema.ts`)

Every category rating is `{ rating: int 0–100 | null, confidence: 0–1, evidence: ≤400 chars }`.
`null` rating = "not assessable" (dropped from the weighted average, see §4).

**Face rubric — `FACE_KEYS` (7):** `photoPresentation`, `faceHarmony`, `jawPresence`,
`haircutMatch`, `groomingCoherence`, `visualPresence`, `mainCharacterEnergy`.

**Outfit rubric — `OUTFIT_KEYS` (9):** `fit`, `silhouette`, `proportions`, `colorCoherence`,
`physiqueMatch`, `layering`, `accessories`, `stylingIntent`, `overallCohesion`.

Also returned: `inputQuality` (usable / faceUsable / outfitUsable / samePersonLikely / issues /
retakeInstruction), `faceCopy` (strongestPoint / improvement / summary), `outfitCopy`
(works / hurts / verdict), `contentSelection` (the 4 candidate lists), `receiptContent`
(metricCandidates / punchlineCandidates).

> The Zod schema is the gate: if the model returns a shape that fails `safeParse`, the scan is
> rejected (`schema_invalid`). `issues` is constrained to a closed enum on the Gemini side too,
> so a stray free-text issue can't sink an otherwise-valid scan.

---

## 4. Scoring math (`scoring.ts`)

### 4.1 Category → aggregate

Each rating is already 0–100 (clamped by `scoreFromRating`). Aggregate Face and Outfit
scores are **weighted averages that drop `null` categories and redistribute their weight**:

**Face weights** (sum 1.00):

| Category | Weight |
|---|---|
| `faceHarmony` | 0.20 |
| `haircutMatch` | 0.20 |
| `visualPresence` | 0.20 |
| `groomingCoherence` | 0.15 |
| `photoPresentation` | 0.10 |
| `jawPresence` | 0.10 |
| `mainCharacterEnergy` | 0.05 |

**Outfit weights** (sum 1.00):

| Category | Weight |
|---|---|
| `fit` | 0.20 |
| `silhouette` | 0.15 |
| `proportions` | 0.15 |
| `physiqueMatch` | 0.15 |
| `colorCoherence` | 0.10 |
| `overallCohesion` | 0.10 |
| `layering` | 0.05 |
| `accessories` | 0.05 |
| `stylingIntent` | 0.05 |

> `photoPresentation` feeds the Face aggregate but is **not** shown as its own breakdown trait
> (it rates the photo, not the face).

### 4.2 Aura Index

```
auraIndex = round( face × 0.45 + outfit × 0.45 + visualPresence × 0.10 )
```

`visualPresence` here is the raw category rating (falls back to the Face aggregate if null).
The Aura Index is the spine: it drives the verdict, the score band, and the receipt metrics.

### 4.3 Display jitter — why scores aren't round

- `hashSeed(s)` — FNV-1a 32-bit hash of a string. Deterministic.
- `jitter(seed, spread=3)` — integer in `[-spread, +spread]` from the hash.
- `displayScore(score, scanId, key, promptVersion)` = `clamp(round(score) + jitter("scanId:key:promptVersion"), 0, 100)`.

So every displayed sub-score wobbles ±3 deterministically per scan. Because `promptVersion` is
in the seed, **bumping `SOLO_SCAN_PROMPT_VERSION` re-rolls the jitter** for all saved results.

- `percent(scanId, key, base, spread=12)` = `clamp(base + jitter("scanId:key", 12), 0, 100)` —
  used for the receipt's flavor percentages (note: **not** seeded with promptVersion).

### 4.4 Verdict & bands

**`pickVerdict(aura, scanId)`** — the categorical dating verdict:

```
c = aura + jitter("scanId:verdict", 3)      // ±3 nudge
c >= 70  → green_flag
c >= 45  → normie
else     → red_flag
```

Effective guaranteed bands (because of the ±3 nudge):

| Aura | Outcome |
|---|---|
| ≥ 73 | always green |
| 67–72 | green / normie boundary |
| 48–66 | always normie |
| 42–47 | normie / red boundary |
| ≤ 41 | always red |

**`scoreBand(aura)`** — a finer 6-way band used **only** to pick fallback content and seed picks
(decoupled from the 3-way verdict on purpose, so a card's archetype and the receipt's verdict
can land on different sides near a boundary):

| Band | Aura |
|---|---|
| `elite` | ≥ 80 |
| `high` | 65–79 |
| `mid` | 50–64 |
| `low` | 35–49 |
| `poor` | 20–34 |
| `dire` | < 20 |

---

## 5. Content banks

> **How a line gets chosen — read this first.** In `pickBanded` (`content-bank.ts`): the model's
> candidate IDs are filtered to those that exist in the bank. **If at least one valid candidate
> survives, the pick is a seeded choice _among the model's candidates_ — the band is NOT used to
> filter.** The band only matters (a) as part of the random seed and (b) as the fallback pool when
> the model returns zero valid candidates. **Implication for tuning: the model effectively
> controls which archetype/caption/punchline you get, via its candidate list.** Bias the *content*
> by biasing the prompt's candidate selection, not the bands.

### 5.1 Face archetypes (`FACE_BANK`, 14) → card verdict line + sticker

| ID | Line | Sticker | Band |
|---|---|---|---|
| `face_archetype.goat` | CERTIFIED / GOAT | goat | elite |
| `face_archetype.mafia_boss` | CERTIFIED / MAFIA BOSS | mafia-boss | elite |
| `face_archetype.main_character` | MAIN / CHARACTER | main-character | high |
| `face_archetype.aura_farmer` | CERTIFIED / AURA FARMER | aura-farmer | high |
| `face_archetype.locked_in` | LOCKED / IN | locked-in | high |
| `face_archetype.plot_relevant` | CLEAN NPC / PLOT RELEVANT | plot-relevant | mid |
| `face_archetype.honorable_mention` | HONORABLE / MENTION | honorable-mention | mid |
| `face_archetype.red_flag_good_angles` | RED FLAG / WITH GOOD ANGLES | hear-me-out | low |
| `face_archetype.delusional` | DELUSIONAL / BUT CONFIDENT | delusional | low |
| `face_archetype.chopped` | ABSOLUTELY / CHOPPED | chopped | poor |
| `face_archetype.canon_event` | CANON / EVENT | canon-event | poor |
| `face_archetype.ai_slop` | CERTIFIED / AI SLOP | ai-slop | poor |
| `face_archetype.negative_aura` | NEGATIVE / AURA | negative-aura | dire |
| `face_archetype.unc` | UNC / STATUS | unc | dire |

### 5.2 Outfit captions (`OUTFIT_BANK`, 11) → outfit card caption + sticker

| ID | Caption | Sticker | Band |
|---|---|---|---|
| `outfit_caption.locked_in` | THE FIT IS LOCKED IN | locked-in | elite |
| `outfit_caption.let_him_cook` | LET HIM COOK | let-him-cook | elite |
| `outfit_caption.fit_has_lore` | THE FIT HAS LORE | fit-has-lore | high |
| `outfit_caption.rizz` | RIZZ ON SIGHT | rizz | high |
| `outfit_caption.clean_npc_potential` | CLEAN NPC WITH POTENTIAL | buffering | mid |
| `outfit_caption.performative` | PERFORMATIVE EDITORIAL | performative | mid |
| `outfit_caption.delulu` | DELULU BUT WORKING | delulu | low |
| `outfit_caption.ai_slop` | CERTIFIED AI SLOP | ai-slop | poor |
| `outfit_caption.chopped` | CHOPPED FIT | chopped | poor |
| `outfit_caption.never_cook_again` | NEVER COOK AGAIN | never-cook-again | dire |
| `outfit_caption.aura_debt` | IN AURA DEBT | aura-debt | dire |

### 5.3 Punchlines (`PUNCHLINE_BANK`, 13) → receipt final reading

| ID | Text | Band |
|---|---|---|
| `punchline.certified_goat` | CERTIFIED GOAT | elite |
| `punchline.built_different` | BUILT DIFFERENT | elite |
| `punchline.certified_lover_boy` | CERTIFIED LOVER BOY | high |
| `punchline.rizz_god` | RIZZ GOD CONFIRMED | high |
| `punchline.aura_farmer` | CERTIFIED AURA FARMER | high |
| `punchline.clean_npc_potential` | NPC WITH POTENTIAL | mid |
| `punchline.honorable_mention` | HONORABLE MENTION | mid |
| `punchline.high_aura_low_stability` | RED FLAG ON REMISSION | low |
| `punchline.delusional_lover_boy` | DELUSIONAL LOVER BOY | low |
| `punchline.negative_aura` | NEGATIVE AURA DETECTED | poor |
| `punchline.ai_slop` | DOCUMENTED AI SLOP | poor |
| `punchline.aura_debt` | IN AURA DEBT | dire |
| `punchline.canon_chopped` | CANON EVENT | dire |

### 5.4 Stickers (`sticker-bank.ts`)

Each preset: `{ label, tone, rotation }`. Tones: `accent` (positive), `chrome` (neutral),
`warn` (negative). Archetypes/captions reference stickers **by id** (the `stickerId` columns above).

- **Face stickers (15):** `hear-me-out`(warn), `plot-relevant`(chrome), `aura-farmer`(accent),
  `chad`(accent), `main-character`(chrome), `goat`(accent), `mafia-boss`(accent),
  `locked-in`(accent), `honorable-mention`(chrome), `delusional`(warn), `chopped`(warn),
  `canon-event`(warn), `negative-aura`(warn), `unc`(warn), `ai-slop`(warn).
- **Outfit stickers (11):** `fit-has-lore`(accent), `let-him-cook`(accent),
  `never-cook-again`(warn), `buffering`(chrome), `performative`(chrome), `locked-in`(accent),
  `rizz`(accent), `delulu`(chrome), `ai-slop`(warn), `chopped`(warn), `aura-debt`(warn).

> **Gotcha:** the `chad` face sticker exists in the bank but **no face archetype maps to it** —
> it's only reachable via the in-app manual sticker cycler, never auto-assigned. Free slot if
> you want a "chad" archetype.

---

## 6. Assembly — what each card shows (`assemble.ts`)

Given the rubric + aura + verdict + band, `assembleResult` builds three cards. Display values
run through `displayScore` (±3 jitter); `null` categories render as `UNSCORED_DISPLAY = 50`.

**Face Card:** verdict line = chosen archetype; `AURA INDEX {aura}`; 4 mini-scores
(Aura, Jaw Presence, Face Harmony, Main Character — last one flagged "hot"); sticker = archetype's.

**Face breakdown (6 traits):** Jaw Presence, Face Harmony, Visual Presence, Haircut Match,
Grooming, Main Character. Each gets a `descriptor` from the **raw rating** (not the jittered
display): `≥85 Elite · ≥68 Strong · ≥45 Even · ≥25 Soft · else Off · null "—"`.

**Outfit Card:** caption = chosen outfit caption; overall = Outfit aggregate; 4 mini-scores
(Silhouette, Proportions, Fit, Physique Match); sticker = caption's.

**Outfit supporting stats (≤4, skips null):** Color Story, Layering, Styling Intent,
Overall Cohesion, Accessories — with the model's `evidence` as the note. Plus 2 **tags**:
strongest assessed category → "… on point" (good), weakest → "… needs work" (bad).

**Receipt rows** (`AURA_GAIN_SCALE = 12`):

| Row | Value | Tone |
|---|---|---|
| Dating Score | `round(aura)/10` `/ 10` | good if green |
| Aura Gained | `round((aura − 50) × 12)` (signed) | good if ≥ 0 |
| Lover-Boy Prob. | `percent(base = green? 84 : 48)%` | good if green |
| Ghosting Potential | `percent(base = red? 72 : 34)%` | hi if red |
| Main-Char Energy | `percent(base = mainCharacterEnergy rating ?? 50)%` | default |

Receipt also carries: `generationId` (`0x….` hash of scanId), the punchline as
`finalPunchline`, the verdict, and `summary = faceCopy.summary + " " + outfitCopy.verdict`.

> **Copy source today:** the verdict explanation = `faceCopy.summary`, the roast =
> `faceCopy.improvement`, outfit works/hurts/verdict come straight from `outfitCopy`. These are
> the strings to make funnier in Bucket B — they're 100% model-authored, capped at one short
> sentence each by the prompt.

---

## 7. Version constants (`constants.ts`)

- `SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v2'` — the response contract. Bump on **schema** changes
  (the model must echo it back; Zod asserts the literal, so a mismatch rejects the scan).
- `SOLO_SCAN_PROMPT_VERSION = 'v2'` — the prompt/scoring version. Bump when the **system
  instruction or scoring weights change**; it re-seeds display jitter so old saved results stay
  internally consistent and new ones reflect the change.

> The edge function is a **manual deploy** (not git/Vercel). After any change here or in
> `gemini.ts` / `scoring.ts` / `content-bank.ts`: run tests → bump the version(s) → redeploy the
> `solo-scan` function.

---

## 8. Where to tune what

| You want to… | Edit | Notes |
|---|---|---|
| Make **captions/archetypes/punchlines funnier or add new ones** | `content-bank.ts` (add to bank) **and** `gemini.ts` allowlist | Must add to both, or the model can't pick it. The model's candidate list drives the pick (§5). |
| **Bias content toward a meme** (e.g. force GOAT/CHAD for a recognized face) | `gemini.ts` SYSTEM_INSTRUCTION — add instructions on when to nominate which candidates | Selection is candidate-driven; band is fallback only. This is the lever for "McLovin → high." |
| Make **verdict explanations / roasts funnier, less formal** | `gemini.ts` SYSTEM_INSTRUCTION (copy-voice rules) | `faceCopy`/`outfitCopy` are model-authored. Add a voice spec; ban AI-slop tells. |
| Shift the **green / normie / red split** | `pickVerdict` thresholds in `scoring.ts` (70 / 45) | Bump `PROMPT_VERSION`, retest, redeploy. Calibrate against real scans. |
| Change the **score distribution** (harsher/kinder) | the `0-20 … 81-100` anchor in `gemini.ts` | The single biggest lever on where raw scores land. |
| Reweight which categories matter | `FACE_WEIGHTS` / `OUTFIT_WEIGHTS` in `scoring.ts` | Keep each set summing to 1.00. |
| Add **gender awareness / female bias / female card names** | `schema.ts` (new field) + `gemini.ts` (detect + guardrail rewrite) + `scoring.ts` (bias) + `content-bank.ts` (female variants) | This is Bucket B; needs the guardrail line reworded and a `PROMPT_VERSION` + `SCHEMA_VERSION` bump. |
| Adjust the **score wobble** | `jitter` spread in `scoring.ts` | Default ±3 for display, ±12 for receipt percentages. |

---

*Last updated for `prompt v2 / schema solo_scan_v2`. Update this doc whenever you change a
weight, threshold, bank entry, or the prompt.*
