# Solo Scan v3 — Gender-aware scoring, meme recognition, savage voice & gendered content

**Date:** 2026-06-16
**Bucket:** B (backend / prompt / scoring / content overhaul)
**Status:** design — awaiting user review before writing-plans
**Versions:** `SOLO_SCAN_SCHEMA_VERSION solo_scan_v2 → solo_scan_v3`, `SOLO_SCAN_PROMPT_VERSION v2 → v3`

> Companion reference: `docs/solo-scan-scoring-and-content-reference.md` (the v2 baseline).
> Read it for the existing pipeline, weights, banks, and "where to tune what."

---

## 1. Goal

1. **Detect apparent gender presentation** (femme / masc / unsure) for entertainment styling.
2. **Bias femme presentations higher** (+5–10%, default +7%) with **female-coded** content.
3. **Recognize public figures & meme characters** and reward them (a score multiplier); surface
   the name only when very confident.
4. **Rewrite the voice** to a full savage roast — brutal on the *look*, never protected traits,
   with an anti-AI-slop banlist.
5. **Change the Face Card's displayed metrics** (applies to the current card design now): show
   **Haircut Match** and a **Masculinity / Femininity Index** on the card; move Jaw Presence and
   Face Harmony to the right-side breakdown only.
6. **Expand the content banks** into real **gendered** sets (masc / femme / neutral) with the
   memes the user requested + more.

**Non-goals (deferred):** distinct *visual styling* for female cards (future frontend; data will
be gender-aware so it's a pure UI follow-up); "remove Save-to-history button" + the `.glow` fix
(frontend, Bucket C).

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Gender model | Three-way `femme \| masc \| unsure` + `genderConfidence`. Bias + femme content only when `femme` & confident; else neutral/masc path. |
| Bias method | Uniform multiplicative bump to every face/outfit rating, clamped 0–100. |
| Femme bias | `FEMME_SCORE_BIAS = 0.07` (×1.07), tunable 0.05–0.10. Gate `genderConfidence ≥ 0.60`. |
| Icon recognition | Literal recognition of **public figures / meme characters only** (never private individuals). |
| Icon boost | Multiplier `ICON_SCORE_BIAS = 0.15` (×1.15), **no floor**. Gate `recognizedConfidence ≥ 0.60`. Stacks with femme, clamps 100. |
| Icon name in copy | Only when `recognizedConfidence ≥ 0.85`; else silent boost. |
| Voice | Full savage roast of the look/fit/vibe; never protected traits; anti-AI-slop banlist. |
| Masc/Fem Index | **Single 0–100 `expressionStrength`**, labeled "Masculinity Index" (masc/unsure) or "Femininity Index" (femme). **Display-only — does NOT affect Aura.** Not biased. |
| Face card metrics | `Aura · Haircut Match · Masculinity/Femininity Index · Main Character`. Jaw Presence + Face Harmony → breakdown only. Applies to current card design immediately. |
| Content model | Every bank entry tagged `masc` / `femme` / neutral. Allowlist + fallback gender-filtered. Femme text overrides on shared entries retained. |

---

## 3. Schema changes (`packages/shared/src/solo-scan/schema.ts`)

Add a top-level `presentation` object to `soloScanSchema`:

```ts
presentation: z.object({
  gender: z.enum(['femme', 'masc', 'unsure']),
  genderConfidence: z.number().min(0).max(1),
  expressionStrength: z.number().int().min(0).max(100),  // masc/fem index (display-only)
  recognizedIcon: z.string().max(60).nullable(),         // e.g. "McLovin"; null if none
  recognizedConfidence: z.number().min(0).max(1),
})
```

- Mirror into `RESPONSE_SCHEMA` in `gemini.ts` (OpenAPI subset; `recognizedIcon` nullable; all
  five `required`).
- `faceAnalysis` / `outfitAnalysis` keys (`FACE_KEYS` / `OUTFIT_KEYS`) and their **weights are
  unchanged** — `expressionStrength` lives in `presentation`, so it never enters the weighted
  aura.
- Bump `SOLO_SCAN_SCHEMA_VERSION` → `'solo_scan_v3'` (Zod literal; rejects stale output).

---

## 4. Scoring changes (`packages/shared/src/solo-scan/scoring.ts`)

```ts
export const FEMME_SCORE_BIAS = 0.07;        // ×1.07; tunable 0.05–0.10
export const FEMME_CONFIDENCE_MIN = 0.60;
export const ICON_SCORE_BIAS = 0.15;         // ×1.15
export const ICON_CONFIDENCE_MIN = 0.60;
export const ICON_NAME_CONFIDENCE_MIN = 0.85;

export function biasFactor(p: Presentation): number {
  const femme = p.gender === 'femme' && p.genderConfidence >= FEMME_CONFIDENCE_MIN ? 1 + FEMME_SCORE_BIAS : 1;
  const icon  = p.recognizedIcon && p.recognizedConfidence >= ICON_CONFIDENCE_MIN ? 1 + ICON_SCORE_BIAS : 1;
  return femme * icon;
}
export function biasedRating(rating: number | null, factor: number): number | null {
  return rating == null ? null : Math.max(0, Math.min(100, Math.round(rating * factor)));
}
```

- `faceScore` / `outfitScore` apply `biasedRating(..., factor)` to each category **before** the
  weighted average → aggregates, Aura, verdict, receipt, and displayed sub-scores all move
  together.
- `expressionStrength` is **not** biased (it's a presentation read, not an attractiveness score).
- `pickVerdict` thresholds unchanged (70/45); bias shifts the *input* aura, not the bands.
- `descriptorFor` (in `assemble.ts`) must receive **biased** ratings so the word and number agree.

---

## 5. Face Card display change (`assemble.ts` + showcase data)

Current `faceCard.scores`: `Aura · Jaw Presence · Face Harmony · Main Character(hot)`.

New `faceCard.scores`:

| slot | id | label | value |
|---|---|---|---|
| 1 | `aura` | Aura | `aura` |
| 2 | `haircut-match` | Haircut Match | `displayScore(haircutMatch)` |
| 3 | `gender-index` | `gender==='femme' ? 'Femininity Index' : 'Masculinity Index'` | `displayScore(expressionStrength)` |
| 4 | `main-character` | Main Character (hot) | `displayScore(mainCharacterEnergy)` |

- Jaw Presence + Face Harmony **remain** in `faceTraits` (the right-side breakdown) and in the
  aura aggregate — only the card face changes.
- `FaceCard.tsx` is data-driven (`content.scores.map`), so live cards update automatically.
- **Static showcase cards** on the landing page (`Landing.tsx`) use hard-coded data and must be
  edited by hand to match the new metric layout.
- `expressionStrength` gets the standard ±3 `displayScore` jitter for visual consistency.

---

## 6. Content model — gender tagging (`content-bank.ts`, `sticker-bank.ts`)

- Add `gender?: 'masc' | 'femme'` to each bank entry. **Absent = neutral** (eligible for any
  gender). Add optional `femme?: string` text override (used when confidently femme).
- **Selection / fallback:** the prompt is given a **gender-filtered allowlist** (neutral + the
  detected gender's entries). `pickBanded`'s fallback pools are likewise filtered to `neutral +
  detectedGender` so a fallback can never surface a masc-only line on a femme scan (and vice
  versa). `unsure` is treated as `masc` for content eligibility (default masc framing).
- Rendering: `confidentlyFemme && entry.femme ? entry.femme : entry.text/line`.

---

## 7. Content catalog (DRAFT — edit freely)

> All v2 entries are **retained**. Masc-coded v2 lines are re-tagged `masc` (with femme overrides
> where natural). Below: re-tags + new additions. Bands chosen so each gender has spread across
> elite→dire (femme bias pushes femme scans higher, so femme is well-stocked at the top).

### 7.1 Face archetypes (card verdict line + sticker)

**Neutral (retag/keep):** `goat` (CERTIFIED/GOAT, elite), `mafia_boss` (elite), `main_character`
(high), `aura_farmer` (high), `locked_in` (high), `plot_relevant` (mid), `honorable_mention`
(mid), `red_flag_good_angles` (low), `delusional` (low), `chopped` (poor), `canon_event` (poor),
`ai_slop` (poor), `negative_aura` (dire), `unc` (UNC/STATUS, dire) → **femme:** AUNTIE/STATUS.

**Masc-only (new):**

| ID | Line | Band | Sticker(tone) |
|---|---|---|---|
| `face_archetype.gigachad` | GIGA / CHAD | elite | chad (accent) *(reuses the orphan sticker)* |
| `face_archetype.alpha_male` | ALPHA / MALE | high | alpha (accent) |
| `face_archetype.sigma_male` | SIGMA / MALE | high | sigma (chrome) |
| `face_archetype.milf_hunter` | DEFINITELY A / MILF HUNTER | mid | milf-hunter (chrome) |
| `face_archetype.performative_male` | PERFORMATIVE / MALE | mid | performative (chrome) |
| `face_archetype.simp` | CERTIFIED / SIMP | low | simp (warn) |
| `face_archetype.beta_male` | BETA / MALE | poor | beta (warn) |
| `face_archetype.tate_follower` | TATE ACADEMY / DROPOUT | poor | tate (warn) |

**Femme-only (new):**

| ID | Line | Band | Sticker(tone) |
|---|---|---|---|
| `face_archetype.mother` | SHE IS / MOTHER | elite | mother (accent) |
| `face_archetype.femme_fatale` | FEMME / FATALE | elite | femme-fatale (accent) |
| `face_archetype.it_girl` | IT / GIRL | high | it-girl (accent) |
| `face_archetype.girlboss` | CERTIFIED / GIRLBOSS | high | girlboss (accent) |
| `face_archetype.material_girl` | MATERIAL / GIRL | high | material-girl (accent) |
| `face_archetype.vip` | VIP / ENERGY | high | vip (accent) |
| `face_archetype.clean_girl` | CLEAN / GIRL | mid | clean-girl (chrome) |
| `face_archetype.brat` | CERTIFIED / BRAT | mid | brat (accent) |
| `face_archetype.drama_queen` | DRAMA / QUEEN | low | drama-queen (warn) |

### 7.2 Outfit captions (card caption + sticker)

**Neutral (keep):** all 11 v2 entries; `let_him_cook` → **femme:** LET HER COOK.

**Masc-only (new — age/roast):**

| ID | Caption | Band | Sticker(tone) |
|---|---|---|---|
| `outfit_caption.sigma_grindset` | SIGMA GRINDSET FIT | high | sigma-fit (chrome) |
| `outfit_caption.millennial_coded` | MILLENNIAL CODED | low | millennial (chrome) |
| `outfit_caption.unc_fit` | UNC FIT DETECTED | low | unc-fit (warn) |
| `outfit_caption.old_money_temu` | OLD MONEY (FROM TEMU) | poor | old-money-temu (warn) |
| `outfit_caption.boomer` | BOOMER-CODED FIT | poor | boomer (warn) |

**Femme-only (new):**

| ID | Caption | Band | Sticker(tone) |
|---|---|---|---|
| `outfit_caption.fashion_girl` | FASHION GIRL CERTIFIED | high | fashion-girl (accent) |
| `outfit_caption.vip_fit` | VIP LIST FIT | high | vip-fit (accent) |
| `outfit_caption.material_girl_fit` | MATERIAL GIRL FIT | high | material-girl-fit (accent) |
| `outfit_caption.brat_fit` | BRAT SUMMER FIT | high | brat-fit (accent) |
| `outfit_caption.clean_girl_fit` | CLEAN GIRL AESTHETIC | mid | clean-girl-fit (chrome) |

### 7.3 Punchlines (receipt final reading — text only, no sticker)

**Neutral (keep + new slang):** all v2 entries; `certified_lover_boy` → **femme:** CERTIFIED
HEARTBREAKER; `delusional_lover_boy` → **femme:** DELULU IT-GIRL. New neutral: `no_cap` (NO CAP,
high), `bro_capping` (BRO IS CAPPING, poor).

**Masc-only (new):** `alpha_confirmed` (ALPHA CONFIRMED, elite), `sigma_grindset` (SIGMA GRINDSET,
high), `milf_hunter_license` (MILF HUNTER LICENSE, mid), `certified_simp` (CERTIFIED SIMP, low),
`beta_energy` (BETA ENERGY, poor), `tate_dropout` (TATE ACADEMY DROPOUT, dire).

**Femme-only (new):** `mother_mothered` (MOTHER HAS MOTHERED, elite), `slay` (CERTIFIED SLAYYY,
elite), `it_girl` (CERTIFIED IT GIRL, high), `girlboss_trio` (GASLIGHT GATEKEEP GIRLBOSS, high),
`drama_queen_crowned` (DRAMA QUEEN CROWNED, low).

### 7.4 Stickers
Add presets for each new id above (tones noted in the tables). Reuse the existing orphan `chad`
sticker for `gigachad`. Tone convention: `accent` = positive, `chrome` = neutral/ironic, `warn` =
roast/negative.

> **Edginess note:** `milf_hunter`, `tate_follower`/`tate_dropout`, `simp`, `beta_male` are the
> spiciest. They roast a *vibe*, not protected traits, so they're within the savage-but-safe line
> — but they're the most likely to draw platform attention. Flag any you want cut.

---

## 8. Prompt rewrite (`gemini.ts SYSTEM_INSTRUCTION`)

1. **Gender presentation:** classify apparent presentation (femme/masc/unsure) + confidence + a
   0–100 `expressionStrength` ("how strongly the look reads as that gender"), for entertainment
   styling only — a presentation read, NOT identity; use `unsure` when ambiguous.
2. **Guardrail rewrite:** drop `gender identity` from the do-not-infer list (handled above); keep
   ethnicity, religion, sexuality, health, disability, wealth, criminality, real
   trustworthiness/personality/compatibility.
3. **Icon recognition:** MAY recognize widely-known public figures / meme characters → set
   `recognizedIcon` + confidence; NEVER identify private individuals; ordinary person → null.
4. **Voice (savage roast):** confident, funny, internet-native; sticker lexicon (rizz, NPC,
   delulu, chopped, aura, sigma). Roast the look/fit/pose/vibe. **Never** protected traits. One
   punchy sentence per copy field.
5. **Anti-AI-slop banlist:** no "elevate / in today's world / let's dive in / it's not just X,
   it's Y / a testament to / when it comes to"; no em-dash sermons; no hedging ("consider…"); no
   corporate-fashion register.
6. **Gender-aware allowlists:** provide candidate IDs split by gender. If `femme`, pick from
   `neutral + femme`; if `masc`/`unsure`, from `neutral + masc`. Prefer the gendered memes when
   they fit the band; femme copy uses female-coded references (never "lover boy").
7. **Icon-in-copy:** model writes copy standalone; the **backend** decides whether to surface
   `recognizedIcon` (only at confidence ≥ 0.85). Don't hard-code the name into every field.
8. Scoring anchor (0–20 … 81–100) unchanged for now.
9. `schemaVersion = "solo_scan_v3"`.

---

## 9. Assembly changes (`assemble.ts`)

- `factor = biasFactor(ai.presentation)`; pass biased ratings everywhere (aggregates, descriptors,
  supporting stats, receipt `mce`).
- `confidentlyFemme = gender==='femme' && genderConfidence ≥ FEMME_CONFIDENCE_MIN` → femme text
  overrides + femme/neutral pools.
- Face card metric swap (§5) + `expressionStrength` label per gender.
- Icon name: if `recognizedConfidence ≥ ICON_NAME_CONFIDENCE_MIN`, weave the name into the receipt
  summary / a "GIVING ___ ENERGY" line (exact placement in plan). Else ignore the name.

---

## 10. Versioning & deploy

- `constants.ts`: `SCHEMA_VERSION → solo_scan_v3`, `PROMPT_VERSION → v3`.
- Run shared Vitest suite → green.
- **Manual edge-function redeploy** of `solo-scan` (not git/Vercel; `.ts` import extensions, no
  Docker).
- Post-deploy live checks: a femme photo (bias + female copy + Femininity Index label), a masc
  photo (masc memes + Masculinity Index), a recognizable meme face (icon boost + name gating), and
  the verdict-band split (open calibration follow-up).

---

## 11. Testing (unit, `packages/shared`)

- `biasFactor`: femme-only / icon-only / both stacked / neither / below-gate → 1.0.
- `biasedRating`: clamp 100, null passthrough, rounding.
- Aggregates/aura shift ~factor when biased; `expressionStrength` never biased.
- Gender-filtered selection: femme scan never gets masc-only id; masc/unsure never gets femme-only;
  fallback pools respect gender; femme override text used when confidently femme.
- Face card scores: exactly `[aura, haircut-match, gender-index, main-character]`; label flips with
  gender.
- Schema: `solo_scan_v3` literal required; missing `presentation` fails parse.

---

## 12. Frontend touchpoints (this bucket)

- `assemble.ts` change is shared → live cards update automatically (`FaceCard` is data-driven).
- **Manual:** update static showcase Face Cards in `Landing.tsx` to the new metric layout.
- Out of this bucket (→ C): remove Save-to-history button, `.glow` fix, webcam, full-screen scan
  animation, double-tap sticker.

---

## 13. Open items for the plan

- Final caption/sticker copy (user edits §7).
- Exact placement of the recognized icon name in copy.
- New sticker preset tones/rotations.
- `unsure`-gender label confirm ("Masculinity Index" default).
