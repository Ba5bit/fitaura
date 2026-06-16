# Solo Scan — Scoring & Content Reference

> **Purpose.** A single map of how a Solo Scan turns two photos into three cards: what
> the Gemini model decides, what the backend decides, every scoring weight and threshold,
> every caption / sticker / punchline bank, and **where to edit what** when you want to
> tune the vibe. This is the reference for prompt fine-tuning.
>
> **Status:** describes the live system at `SOLO_SCAN_PROMPT_VERSION = v3_1` /
> `SOLO_SCAN_SCHEMA_VERSION = solo_scan_v3_1`. Keep this file in sync when you tune.
> **v3.1 (latest):** recognition is split by `recognizedKind` — a confident **meme** gets a
> **glory floor** (every rating lifted to 75–92 → high/green + legend content), while a **real
> public figure** gets the **honest read** (no boost). The old flat ×1.15 icon multiplier is gone.
> See dev-log `045-meme-glory-vs-honest-celebrity.md`.
> **v3 (over v2):** apparent-gender presentation + meme/figure **icon recognition** (the
> `presentation` field), a femme **score bias** (×1.07), **gendered content banks** (masc/femme
> variants + female-coded overrides), a **savage anti-slop voice**, and a **Face Card metric swap**
> (third mini-score is the Masc/Fem Index). See dev-log `042-solo-scan-v3.md`.

---

## 1. Pipeline overview

```
 ┌─────────────┐     ┌──────────────────────────┐     ┌────────────────────────────┐
 │ face photo  │ ──▶ │  Gemini (solo-scan fn)   │ ──▶ │  backend scoring + assembly │ ──▶ 3 cards
 │ outfit photo│     │  gemini.ts SYSTEM_INSTR. │     │  scoring.ts + assemble.ts   │
 └─────────────┘     └──────────────────────────┘     └────────────────────────────┘
```

**The model decides** (per category, 0–100): the raw rubric ratings, confidence, and a
short evidence string; the **presentation read** (apparent gender + a recognized icon name,
each with a confidence); usability of the photos; the copy strings (face/outfit summaries,
"works/hurts/verdict"); and **candidate lists** of archetype / caption / punchline / sticker
IDs drawn from fixed allowlists.

**The backend decides** (deterministic, seeded by `scanId`): a **bias factor** from the
presentation read, the aggregate Face / Outfit scores (computed on the *biased* ratings),
the **Aura Index**, the categorical **verdict** (green / normie / red), the 6-way score
band, display jitter (±3 so scores don't look suspiciously round), the receipt's flavor
metrics, the **final pick** of archetype / caption / sticker / punchline from the model's
candidates (gender-filtered), and **whether to surface the recognized icon's name** in copy.

> The model never computes the Aura Score, Dating Score, or verdict — the prompt explicitly
> forbids it (`gemini.ts` SYSTEM_INSTRUCTION). Final scoring is 100% backend, so it's stable
> and tunable without re-prompting. The model also never writes the recognized icon's name
> into copy; the backend decides whether the recognition was confident enough to surface.

**Key files**

| File | Role |
|---|---|
| `supabase/functions/solo-scan/gemini.ts` | The prompt (`SYSTEM_INSTRUCTION`), the response JSON schema, the Gemini call. |
| `supabase/functions/solo-scan/index.ts` | HTTP handler: validate images → call Gemini → validate → assemble → log. |
| `packages/shared/src/solo-scan/schema.ts` | Zod contract for the model's JSON (incl. `presentation`) + the canonical `FACE_KEYS` / `OUTFIT_KEYS`. |
| `packages/shared/src/solo-scan/scoring.ts` | Weights, `biasFactor`/`applyScoreBias`, `auraIndex`, `displayScore` jitter, `percent`, `pickVerdict`. |
| `packages/shared/src/solo-scan/content-bank.ts` | `scoreBand` + the gendered archetype / caption / punchline banks + gender-aware `pickBanded`. |
| `packages/shared/src/solo-scan/assemble.ts` | Turns the rubric + banks into the final `FullGenerationResult`. |
| `packages/shared/src/sticker-bank.ts` | The face / outfit sticker presets (label, tone, rotation). |
| `packages/shared/src/solo-scan/constants.ts` | `SOLO_SCAN_PROMPT_VERSION` / `SCHEMA_VERSION`. |

> Note: the **landing page** hero/analysis cards use *static showcase data*, not this
> pipeline (`apps/web/src/data/mockGenerations.ts`). The marketing Face Cards were updated
> to the v3 metric labels, but the numbers are hard-coded mockups — don't tune against them.
> The real assembled output is defined in `assemble.ts` (see §6).

---

## 2. The Gemini prompt (current `SYSTEM_INSTRUCTION`)

Verbatim from `gemini.ts` (v3):

```
You are FitAura's Solo Scan visual classification engine.
Analyze the supplied FACE PHOTO and OUTFIT PHOTO using only visible, presentation-related evidence.
Return only JSON matching the provided schema. The result is entertainment-oriented styling feedback. Do not present subjective judgments as scientific, biometric, medical, or psychological facts.

GENDER PRESENTATION: Classify the subject's apparent gender presentation as "femme", "masc", or "unsure" with genderConfidence 0-1, for entertainment styling only. This is a read of presentation, NOT a claim about identity, and may be wrong; use "unsure" when genuinely ambiguous. Set expressionStrength 0-100 for how strongly the look reads as that presentation (a vanity stat, not attractiveness).
Do not infer ethnicity, nationality, religion, sexuality, health, disability, wealth, criminality, real trustworthiness, real personality, or romantic compatibility.

ICON RECOGNITION: You MAY recognize widely-known public figures or popular fictional/meme characters and set recognizedIcon to the name with recognizedConfidence 0-1. NEVER attempt to identify a private or ordinary individual; if the subject is not a widely-known public figure or meme character, set recognizedIcon to null. A resemblance is entertainment, not a factual identity claim.

If an attribute cannot be assessed reliably, return a null rating and explain why briefly.
Score each category 0-100. Anchor: 0-20 clearly weak for this presentation, 21-40 below average, 41-60 neutral or mixed, 61-80 strong, 81-100 clearly elite. Use the full range, differentiate categories from one another, and avoid clustering on round multiples of 10. Return a null rating only when a category genuinely cannot be assessed.

VOICE: Write every copy field as a savage, funny roast of the look, fit, pose and vibe — confident, internet-native, in the sticker lexicon (rizz, NPC, delulu, chopped, aura, sigma, mid). Roast hard, but ONLY the presentation. NEVER roast or reference ethnicity, nationality, religion, sexuality, disability, body in a hateful way, or any protected trait. One short, punchy sentence per field.
BANNED (never write like an AI or a corporate fashion app): "elevate", "in today's world", "let's dive in", "it's not just X it's Y", "a testament to", "when it comes to", "consider ...", em-dash sermons, hedging, polite filler. Be sharp, plain, human and funny.

Select content IDs only from these allowlists, matching the detected gender. If gender is "femme", pick from NEUTRAL or FEMME only. If gender is "masc" or "unsure", pick from NEUTRAL or MASC only. Femme copy must use female-coded language (never "lover boy").
faceArchetypeCandidates: NEUTRAL / MASC / FEMME — see §5
outfitCaptionCandidates: NEUTRAL / MASC / FEMME — see §5
punchlineCandidates: NEUTRAL / MASC / FEMME — see §5

Do not calculate the final Aura Score, Dating Score, or categorical verdict. The backend performs final scoring and verdict assignment. Do not write the recognized icon's name into the copy; the backend decides whether to surface it.
Set schemaVersion to "solo_scan_v3".
```

**Annotations / levers:**

- **Scoring anchor** — the `0-20 … 81-100` band text is the single biggest lever on score
  distribution. Loosening/tightening it shifts where real scans land. (See §4 for how that
  feeds the green/normie/red split.) Note this is the *pre-bias* distribution; the femme/icon
  bias (§4.2) then nudges the inputs upward.
- **Gender + icon read** — `presentation` is what drives the bias (§4.2), the content gender
  filter (§5), and the Face Card's Masc/Fem Index (§6). It's an *entertainment styling read*,
  explicitly not an identity claim; the prompt guards against inferring protected traits.
- **VOICE block + BANNED list** — this is the savage anti-slop voice. The banned-phrase list is
  the lever against corporate/AI-tell copy. The copy fields (`faceCopy`/`outfitCopy`) are 100%
  model-authored, one short sentence each.
- **Allowlists are gender-scoped** — the model is told to pick only NEUTRAL+MASC (for masc/unsure)
  or NEUTRAL+FEMME (for femme). The backend *also* enforces this (see §5), so a mis-tagged
  candidate is dropped, not rendered.
- **"avoid clustering on round multiples of 10"** + `temperature: 0.3` — pushes the model off
  lazy 70/80/90 answers so categories actually differentiate.
- **Generation config** (`gemini.ts buildBody`): `temperature 0.3`, `maxOutputTokens 2500`,
  `thinkingConfig.thinkingBudget 0`, structured JSON output via `responseSchema`.

---

## 3. The model's response contract (`schema.ts`)

Every category rating is `{ rating: int 0–100 | null, confidence: 0–1, evidence: ≤400 chars }`.
`null` rating = "not assessable" (dropped from the weighted average, see §4).

**`presentation` (v3, new):**

| Field | Type | Meaning |
|---|---|---|
| `gender` | `'femme' \| 'masc' \| 'unsure'` | Apparent presentation (entertainment read, not identity). |
| `genderConfidence` | `0–1` | Confidence in the gender read; **gates** the femme bias + content gender at `≥ 0.60`. |
| `expressionStrength` | `int 0–100` | "How strongly the look reads as that presentation" — a vanity stat. Shown as the Face Card Masc/Fem Index; **not** an attractiveness score and **not** biased. |
| `recognizedIcon` | `string ≤60 \| null` | A widely-known public figure / meme character name, or `null`. Never a private individual. |
| `recognizedConfidence` | `0–1` | Confidence in the recognition; **gates** the meme-glory floor at `≥ 0.60` and the icon *name in copy* at `≥ 0.85`. |
| `recognizedKind` (v3.1) | `'meme' \| 'real_person' \| null` | Whether the recognized icon is a fictional/meme character (→ glory floor, §4.2) or a real public figure (→ honest read, no boost). `null` when nothing recognized. |

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
> so a stray free-text issue can't sink an otherwise-valid scan. The Gemini response schema
> (`RESPONSE_SCHEMA` in `gemini.ts`) mirrors `presentation` so the model is structurally forced
> to emit it.

---

## 4. Scoring math (`scoring.ts`)

### 4.1 Category → biased rating → aggregate

Each rating is already 0–100 (clamped by `scoreFromRating`). **Before aggregation, v3 applies a
multiplicative bias** to every face/outfit rating (§4.2). Aggregate Face and Outfit scores are
then **weighted averages that drop `null` categories and redistribute their weight**:

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

### 4.2 Score bias — femme multiplier + meme-glory floor (v3.1)

**Femme multiplier.** `biasFactor` applies one multiplicative nudge to every face/outfit rating
*before* the weighted averages — **gender only** (icon no longer multiplies):

| Source | Factor | Gate | Constant |
|---|---|---|---|
| Confidently **femme** | ×1.07 | `gender === 'femme'` && `genderConfidence ≥ 0.60` | `FEMME_SCORE_BIAS = 0.07`, `FEMME_CONFIDENCE_MIN = 0.60` |

`applyScoreBias(ai, factor)` returns the input **unchanged when `factor === 1`**; otherwise it
clones the AI output with every rating `round(rating × factor)` clamped 0–100. `expressionStrength`
and copy are not biased.

**Meme glory (v3.1).** Recognition is split by kind (`presentation.recognizedKind`):
- **`'meme'`** (fictional / comedic / internet-meme character) + `recognizedConfidence ≥
  ICON_CONFIDENCE_MIN (0.60)` → **glory**: `applyGloryFloor` lifts *every* face/outfit rating up to
  a **per-category seeded value in [`GLORY_MIN`=75, `GLORY_MAX`=92]** (never lowering a
  genuinely-high rating; a null rating becomes the floor), applied after the femme multiplier.
  Because it floors the *ratings*, the aggregates, Aura (lands 75–92), verdict (green), descriptors,
  and sub-scores all read high and coherent. Content is also forced from the high/elite bank
  (§5/§6). Seeded → varied across categories + scans, not a flat 90.
- **`'real_person'`** (real public figure / celebrity) → **no boost**. Honest read: a handsome
  celeb scores high on merit, a plain one scores plainly.

> This replaces the v3 flat ×1.15 icon multiplier (`ICON_SCORE_BIAS`, removed), which trashed
> beloved memes (McLovin → Red Flag) — +15% on a low read is still low. See dev-log 045.

> **Tuning note.** `FEMME_SCORE_BIAS` (0.05–0.10) shifts the verdict split for femme scans —
> recalibrate `pickVerdict` (§4.5) alongside it. `GLORY_MIN`/`GLORY_MAX` set how legendary memes feel.

### 4.3 Aura Index

```
auraIndex = round( face × 0.45 + outfit × 0.45 + visualPresence × 0.10 )
```

`face`/`outfit` are the biased aggregates; `visualPresence` is the biased raw category rating
(falls back to the Face aggregate if null). The Aura Index is the spine: it drives the verdict,
the score band, and the receipt metrics.

### 4.4 Display jitter — why scores aren't round

- `hashSeed(s)` — FNV-1a 32-bit hash of a string. Deterministic.
- `jitter(seed, spread=3)` — integer in `[-spread, +spread]` from the hash.
- `displayScore(score, scanId, key, promptVersion)` = `clamp(round(score) + jitter("scanId:key:promptVersion"), 0, 100)`.

So every displayed sub-score wobbles ±3 deterministically per scan. Because `promptVersion` is
in the seed, **bumping `SOLO_SCAN_PROMPT_VERSION` re-rolls the jitter** for all saved results.

- `percent(scanId, key, base, spread=12)` = `clamp(base + jitter("scanId:key", 12), 0, 100)` —
  used for the receipt's flavor percentages (note: **not** seeded with promptVersion).

### 4.5 Verdict & bands

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

> The `70 / 45` thresholds are an **estimate** carried over from v2 and not yet calibrated against
> the v3 bias. With femme ×1.07 + icon ×1.15 shifting the input upward, biased scans skew greener.
> This is an open follow-up: sample real scans and adjust `pickVerdict` if the split feels off.

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

## 5. Content banks (now gendered)

> **How a line gets chosen — read this first.** In `pickBanded` (`content-bank.ts`): the model's
> candidate IDs are filtered to those that **exist in the bank _and_ are eligible for the scan's
> gender**. A femme scan is eligible for NEUTRAL + FEMME entries; a masc/unsure scan for
> NEUTRAL + MASC. **If at least one valid candidate survives, the pick is a seeded choice _among
> the model's candidates_ — the band is NOT used to filter.** The band only matters (a) as part of
> the random seed and (b) as the (gender-filtered) fallback pool when the model returns zero valid
> candidates. **Implication for tuning: the model effectively controls which
> archetype/caption/punchline you get, via its candidate list — so bias the content through the
> prompt's candidate selection, not the bands.**
>
> **Content gender** is derived in `assemble.ts`: `confidentlyFemme = gender === 'femme' &&
> genderConfidence ≥ 0.60` → `'femme'`, otherwise `'masc'`. So **"unsure" maps to masc content**.
> Femme entries with a `femme:` override render the female-coded line instead of the default
> (e.g. `let_him_cook` → "LET HER COOK", `certified_lover_boy` → "CERTIFIED HEARTBREAKER",
> `unc` → "AUNTIE STATUS").

### 5.1 Face archetypes (`FACE_BANK`, 31) → card verdict line + sticker

**Neutral (14):**

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
| `face_archetype.unc` | UNC / STATUS *(femme: AUNTIE / STATUS)* | unc | dire |

**Masc-only (8):**

| ID | Line | Sticker | Band |
|---|---|---|---|
| `face_archetype.gigachad` | GIGA / CHAD | chad | elite |
| `face_archetype.alpha_male` | ALPHA / MALE | alpha | high |
| `face_archetype.sigma_male` | SIGMA / MALE | sigma | high |
| `face_archetype.milf_hunter` | DEFINITELY A / MILF HUNTER | milf-hunter | mid |
| `face_archetype.performative_male` | PERFORMATIVE / MALE | performative-male | mid |
| `face_archetype.simp` | CERTIFIED / SIMP | simp | low |
| `face_archetype.beta_male` | BETA / MALE | beta | poor |
| `face_archetype.tate_follower` | TATE ACADEMY / DROPOUT | tate | poor |

**Femme-only (9):**

| ID | Line | Sticker | Band |
|---|---|---|---|
| `face_archetype.mother` | SHE IS / MOTHER | mother | elite |
| `face_archetype.femme_fatale` | FEMME / FATALE | femme-fatale | elite |
| `face_archetype.it_girl` | IT / GIRL | it-girl | high |
| `face_archetype.girlboss` | CERTIFIED / GIRLBOSS | girlboss | high |
| `face_archetype.material_girl` | MATERIAL / GIRL | material-girl | high |
| `face_archetype.vip` | VIP / ENERGY | vip | high |
| `face_archetype.clean_girl` | CLEAN / GIRL | clean-girl | mid |
| `face_archetype.brat` | CERTIFIED / BRAT | brat | mid |
| `face_archetype.drama_queen` | DRAMA / QUEEN | drama-queen | low |

### 5.2 Outfit captions (`OUTFIT_BANK`, 21) → outfit card caption + sticker

**Neutral (11):**

| ID | Caption | Sticker | Band |
|---|---|---|---|
| `outfit_caption.locked_in` | THE FIT IS LOCKED IN | locked-in | elite |
| `outfit_caption.let_him_cook` | LET HIM COOK *(femme: LET HER COOK)* | let-him-cook | elite |
| `outfit_caption.fit_has_lore` | THE FIT HAS LORE | fit-has-lore | high |
| `outfit_caption.rizz` | RIZZ ON SIGHT | rizz | high |
| `outfit_caption.clean_npc_potential` | CLEAN NPC WITH POTENTIAL | buffering | mid |
| `outfit_caption.performative` | PERFORMATIVE EDITORIAL | performative | mid |
| `outfit_caption.delulu` | DELULU BUT WORKING | delulu | low |
| `outfit_caption.ai_slop` | CERTIFIED AI SLOP | ai-slop | poor |
| `outfit_caption.chopped` | CHOPPED FIT | chopped | poor |
| `outfit_caption.never_cook_again` | NEVER COOK AGAIN | never-cook-again | dire |
| `outfit_caption.aura_debt` | IN AURA DEBT | aura-debt | dire |

**Masc-only (5, age / roast):**

| ID | Caption | Sticker | Band |
|---|---|---|---|
| `outfit_caption.sigma_grindset` | SIGMA GRINDSET FIT | sigma-fit | high |
| `outfit_caption.millennial_coded` | MILLENNIAL CODED | millennial | low |
| `outfit_caption.unc_fit` | UNC FIT DETECTED | unc-fit | low |
| `outfit_caption.old_money_temu` | OLD MONEY (FROM TEMU) | old-money-temu | poor |
| `outfit_caption.boomer` | BOOMER-CODED FIT | boomer | poor |

**Femme-only (5):**

| ID | Caption | Sticker | Band |
|---|---|---|---|
| `outfit_caption.fashion_girl` | FASHION GIRL CERTIFIED | fashion-girl | high |
| `outfit_caption.vip_fit` | VIP LIST FIT | vip-fit | high |
| `outfit_caption.material_girl_fit` | MATERIAL GIRL FIT | material-girl-fit | high |
| `outfit_caption.brat_fit` | BRAT SUMMER FIT | brat-fit | high |
| `outfit_caption.clean_girl_fit` | CLEAN GIRL AESTHETIC | clean-girl-fit | mid |

### 5.3 Punchlines (`PUNCHLINE_BANK`, 26) → receipt final reading

**Neutral (15):**

| ID | Text | Band |
|---|---|---|
| `punchline.certified_goat` | CERTIFIED GOAT | elite |
| `punchline.built_different` | BUILT DIFFERENT | elite |
| `punchline.certified_lover_boy` | CERTIFIED LOVER BOY *(femme: CERTIFIED HEARTBREAKER)* | high |
| `punchline.rizz_god` | RIZZ GOD CONFIRMED | high |
| `punchline.aura_farmer` | CERTIFIED AURA FARMER | high |
| `punchline.no_cap` | NO CAP | high |
| `punchline.clean_npc_potential` | NPC WITH POTENTIAL | mid |
| `punchline.honorable_mention` | HONORABLE MENTION | mid |
| `punchline.high_aura_low_stability` | RED FLAG ON REMISSION | low |
| `punchline.delusional_lover_boy` | DELUSIONAL LOVER BOY *(femme: DELULU IT-GIRL)* | low |
| `punchline.negative_aura` | NEGATIVE AURA DETECTED | poor |
| `punchline.ai_slop` | DOCUMENTED AI SLOP | poor |
| `punchline.bro_capping` | BRO IS CAPPING | poor |
| `punchline.aura_debt` | IN AURA DEBT | dire |
| `punchline.canon_chopped` | CANON EVENT | dire |

**Masc-only (6):**

| ID | Text | Band |
|---|---|---|
| `punchline.alpha_confirmed` | ALPHA CONFIRMED | elite |
| `punchline.sigma_grindset` | SIGMA GRINDSET | high |
| `punchline.milf_hunter_license` | MILF HUNTER LICENSE | mid |
| `punchline.certified_simp` | CERTIFIED SIMP | low |
| `punchline.beta_energy` | BETA ENERGY | poor |
| `punchline.tate_dropout` | TATE ACADEMY DROPOUT | dire |

**Femme-only (5):**

| ID | Text | Band |
|---|---|---|
| `punchline.mother_mothered` | MOTHER HAS MOTHERED | elite |
| `punchline.slay` | CERTIFIED SLAYYY | elite |
| `punchline.it_girl` | CERTIFIED IT GIRL | high |
| `punchline.girlboss_trio` | GASLIGHT GATEKEEP GIRLBOSS | high |
| `punchline.drama_queen_crowned` | DRAMA QUEEN CROWNED | low |

### 5.4 Stickers (`sticker-bank.ts`)

Each preset: `{ label, tone, rotation }`. Tones: `accent` (positive), `chrome` (neutral),
`warn` (negative). Archetypes/captions reference stickers **by id** (the `stickerId` columns above).

- **Face stickers (31):** the 15 original — `hear-me-out`(warn), `plot-relevant`(chrome),
  `aura-farmer`(accent), `chad`(accent), `main-character`(chrome), `goat`(accent),
  `mafia-boss`(accent), `locked-in`(accent), `honorable-mention`(chrome), `delusional`(warn),
  `chopped`(warn), `canon-event`(warn), `negative-aura`(warn), `unc`(warn), `ai-slop`(warn) —
  plus masc `alpha`(accent), `sigma`(chrome), `beta`(warn), `tate`(warn), `milf-hunter`(chrome),
  `simp`(warn), `performative-male`(chrome) and femme `mother`(accent), `femme-fatale`(accent),
  `it-girl`(accent), `girlboss`(accent), `material-girl`(accent), `vip`(accent),
  `clean-girl`(chrome), `brat`(accent), `drama-queen`(warn).
- **Outfit stickers (21):** the 11 original — `fit-has-lore`(accent), `let-him-cook`(accent),
  `never-cook-again`(warn), `buffering`(chrome), `performative`(chrome), `locked-in`(accent),
  `rizz`(accent), `delulu`(chrome), `ai-slop`(warn), `chopped`(warn), `aura-debt`(warn) — plus
  masc `sigma-fit`(chrome), `millennial`(chrome), `unc-fit`(warn), `old-money-temu`(warn),
  `boomer`(warn) and femme `fashion-girl`(accent), `vip-fit`(accent), `material-girl-fit`(accent),
  `brat-fit`(accent), `clean-girl-fit`(chrome).

> **v2 gotcha now resolved:** in v2 the `chad` face sticker existed with no archetype mapping to
> it. In v3 `face_archetype.gigachad` (masc, elite) maps to `chad`. Every sticker referenced by an
> archetype/caption now exists in the bank, and they're also reachable via the in-app manual
> double-tap sticker cycler (see dev-log `043`).

---

## 6. Assembly — what each card shows (`assemble.ts`)

Given the *biased* rubric + aura + verdict + band + content gender, `assembleResult` builds three
cards. Display values run through `displayScore` (±3 jitter); `null` categories render as
`UNSCORED_DISPLAY = 50`.

**Face Card:** verdict line = chosen archetype (femme override applied when femme);
`AURA INDEX {aura}`; 4 mini-scores — **Aura · Haircut Match · Masc/Fem Index · Main Character**
(last one flagged "hot"). The third tile's label is **"Femininity Index"** when confidently femme,
else **"Masculinity Index"**, and its value is `presentation.expressionStrength` (jittered for
display). Sticker = archetype's.

> **v2 → v3 metric swap:** the v2 Face Card showed `Aura · Jaw Presence · Face Harmony · Main
> Character`. v3 replaces Jaw Presence + Face Harmony tiles with `Haircut Match` + the Masc/Fem
> Index. Jaw Presence and Face Harmony still appear in the **breakdown** below.

**Face breakdown (6 traits):** Jaw Presence, Face Harmony, Visual Presence, Haircut Match,
Grooming, Main Character. Each gets a `descriptor` from the **raw (biased) rating** (not the
jittered display): `≥85 Elite · ≥68 Strong · ≥45 Even · ≥25 Soft · else Off · null "—"`.

**Outfit Card:** caption = chosen outfit caption (femme override applied); overall = Outfit
aggregate; 4 mini-scores (Silhouette, Proportions, Fit, Physique Match); sticker = caption's.

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
`finalPunchline` (femme override applied), the verdict, and `summary`. The summary prefixes
**"Giving {recognizedIcon} energy."** when `recognizedIcon != null && recognizedConfidence ≥ 0.85`
(`ICON_NAME_CONFIDENCE_MIN`); otherwise it's just `faceCopy.summary + " " + outfitCopy.verdict`.

> **Known v3 gap (worth a future fix):** the receipt **row labels are not gendered** — "Lover-Boy
> Prob." renders even on a femme scan, despite the femme voice rule banning "lover boy" elsewhere.
> Only the archetype / caption / punchline / Masc-Fem-Index reflect gender; the static receipt row
> labels in `assemble.ts` (`rows[]`) don't. If you gender the copy further, that's the place.

> **Copy source:** the verdict explanation = `faceCopy.summary`, the roast = `faceCopy.improvement`,
> outfit works/hurts/verdict come straight from `outfitCopy`. These are 100% model-authored, in the
> savage anti-slop voice, capped at one short sentence each by the prompt.

---

## 7. Version constants (`constants.ts`)

- `SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v3_1'` — the response contract. Bump on **schema** changes
  (the model must echo it back; Zod asserts the literal, so a mismatch rejects the scan).
- `SOLO_SCAN_PROMPT_VERSION = 'v3_1'` — the prompt/scoring version. Bump when the **system
  instruction or scoring weights change**; it re-seeds display jitter so old saved results stay
  internally consistent and new ones reflect the change.

> The edge function is a **manual deploy** (not git/Vercel). After any change here or in
> `gemini.ts` / `scoring.ts` / `content-bank.ts`: run tests → bump the version(s) → redeploy the
> `solo-scan` function with
> `npx supabase functions deploy solo-scan --project-ref rxtlbhjysksoxkdcdqyr --no-verify-jwt`.
> Docker is **not** required (and not installed) — the CLI's server-side bundler is used, which is
> why every relative import in `packages/shared/src/solo-scan` carries an explicit `.ts` extension.

---

## 8. Where to tune what

| You want to… | Edit | Notes |
|---|---|---|
| Make **captions/archetypes/punchlines funnier or add new ones** | `content-bank.ts` (add to bank) **and** `gemini.ts` allowlist | Must add to both, or the model can't pick it. Tag with `gender: 'masc' \| 'femme'` (omit for neutral). The model's candidate list drives the pick (§5). |
| **Bias content toward a meme** (e.g. force GOAT/CHAD for a recognized face) | `gemini.ts` SYSTEM_INSTRUCTION — instructions on when to nominate which candidates | Selection is candidate-driven; band is fallback only. The icon *score* bias (§4.2) is separate from which line you get. |
| Tune the **femme bias** or **meme-glory level** | `FEMME_SCORE_BIAS` / `GLORY_MIN`+`GLORY_MAX` in `scoring.ts` | Femme tunable 0.05–0.10 (recalibrate §4.5 with it). Glory range sets how legendary recognized memes feel; real people are unaffected (honest read). |
| Change **when a recognized name appears in copy** | `ICON_NAME_CONFIDENCE_MIN` in `scoring.ts` (default 0.85) | Bias kicks in at 0.60 (`ICON_CONFIDENCE_MIN`); the *name* in the receipt summary only at 0.85. |
| Make **verdict explanations / roasts funnier, less formal** | `gemini.ts` VOICE block + BANNED list | `faceCopy`/`outfitCopy` are model-authored. Extend the banned-phrase list to kill new AI tells. |
| Shift the **green / normie / red split** | `pickVerdict` thresholds in `scoring.ts` (70 / 45) | Bump `PROMPT_VERSION`, retest, redeploy. **Open follow-up: not yet calibrated against the v3 bias.** |
| Change the **score distribution** (harsher/kinder) | the `0-20 … 81-100` anchor in `gemini.ts` | The single biggest lever on where raw (pre-bias) scores land. |
| Gender the **receipt row labels** ("Lover-Boy Prob." on femme) | `rows[]` in `assemble.ts` | Currently static; see the "known v3 gap" note in §6. |
| Reweight which categories matter | `FACE_WEIGHTS` / `OUTFIT_WEIGHTS` in `scoring.ts` | Keep each set summing to 1.00. |
| Add a new **Masc/Fem Index** behavior | `presentation.expressionStrength` (model) + the `gender-index` tile in `assemble.ts` | It's display-only and not biased. |
| Adjust the **score wobble** | `jitter` spread in `scoring.ts` | Default ±3 for display, ±12 for receipt percentages. |

---

*Last updated for `prompt v3_1 / schema solo_scan_v3_1`. Update this doc whenever you change a
weight, threshold, bias constant, bank entry, or the prompt.*
