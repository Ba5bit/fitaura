# Solo Scan v3 — Gender-aware scoring, meme recognition & savage voice

**Date:** 2026-06-16
**Bucket:** B (backend / prompt / scoring / content overhaul)
**Status:** design — awaiting user review before writing-plans
**Versions:** `SOLO_SCAN_SCHEMA_VERSION solo_scan_v2 → solo_scan_v3`, `SOLO_SCAN_PROMPT_VERSION v2 → v3`

> Companion reference: `docs/solo-scan-scoring-and-content-reference.md` (the v2 baseline this
> spec changes). Read it for the existing pipeline, weights, banks, and "where to tune what."

---

## 1. Goal

Make Solo Scan funnier, more shareable, and gender-aware:

1. **Detect apparent gender presentation** (femme / masc / unsure) for entertainment styling.
2. **Bias femme presentations higher** (+5–10%, default +7%) and give them **female-coded card
   names / captions / punchlines** (no "Lover Boy").
3. **Recognize widely-known public figures & meme characters** and reward them (a score
   multiplier), surfacing the name in copy only when recognition is very confident.
4. **Rewrite the verdict/explanation voice** to a full savage roast — internet-native, brutal on
   the *look*, never on protected traits, with an explicit anti-AI-slop banlist.

Non-goals (deferred): distinct **visual styling** for female cards (future frontend work — data
will be gender-aware so it's a pure UI follow-up); the "remove Save-to-history button" (frontend,
Bucket C).

---

## 2. Design decisions (locked with user)

| Decision | Choice |
|---|---|
| Gender model | Three-way `femme \| masc \| unsure` + `genderConfidence`. Bias + female content apply **only** when `femme` and confident. `unsure`/`masc` → current neutral path. |
| Bias method | **Uniform multiplicative** bump to every category rating, clamped 0–100. |
| Femme bias factor | `FEMME_SCORE_BIAS = 0.07` (×1.07), tunable 0.05–0.10. Gate: `genderConfidence ≥ 0.60`. |
| Female content | Shared banks + optional `femme` **text override** per entry + a few **femme-only** memes. |
| Meme/celebrity | **Literal recognition** of public figures / meme characters. Never identify private individuals. |
| Icon boost | **Multiplier `ICON_SCORE_BIAS = 0.15` (×1.15), no floor.** Gate: `recognizedConfidence ≥ 0.60`. Stacks with femme bias, clamps at 100. |
| Icon name in copy | Only when `recognizedConfidence ≥ 0.85` (`ICON_NAME_CONFIDENCE_MIN`); otherwise silent boost. |
| Voice | **Full savage roast** of the look/fit/vibe. Hard rule: never roast protected traits. Anti-AI-slop banlist enforced. |

---

## 3. Schema changes (`packages/shared/src/solo-scan/schema.ts`)

Add a top-level `presentation` object to `soloScanSchema`:

```ts
presentation: z.object({
  gender: z.enum(['femme', 'masc', 'unsure']),
  genderConfidence: z.number().min(0).max(1),
  recognizedIcon: z.string().max(60).nullable(),     // e.g. "McLovin"; null if none
  recognizedConfidence: z.number().min(0).max(1),
})
```

- Mirror the shape into `RESPONSE_SCHEMA` in `gemini.ts` (OpenAPI subset; `recognizedIcon`
  nullable; all four `required`).
- Bump `SOLO_SCAN_SCHEMA_VERSION` to `'solo_scan_v3'`; the prompt must echo it; Zod's
  `z.literal` rejects mismatches (old cached output fails cleanly).

---

## 4. Scoring changes (`packages/shared/src/solo-scan/scoring.ts`)

New tunable constants + a single bias helper applied **before** aggregation:

```ts
export const FEMME_SCORE_BIAS = 0.07;        // ×1.07; tunable 0.05–0.10
export const FEMME_CONFIDENCE_MIN = 0.60;
export const ICON_SCORE_BIAS = 0.15;         // ×1.15
export const ICON_CONFIDENCE_MIN = 0.60;
export const ICON_NAME_CONFIDENCE_MIN = 0.85;

/** Combined multiplicative bias from gender + icon recognition. 1.0 when neither applies. */
export function biasFactor(p: Presentation): number {
  const femme = p.gender === 'femme' && p.genderConfidence >= FEMME_CONFIDENCE_MIN ? 1 + FEMME_SCORE_BIAS : 1;
  const icon  = p.recognizedIcon && p.recognizedConfidence >= ICON_CONFIDENCE_MIN ? 1 + ICON_SCORE_BIAS : 1;
  return femme * icon;
}

/** Apply bias to a single rating, clamped. null stays null. */
export function biasedRating(rating: number | null, factor: number): number | null {
  return rating == null ? null : Math.max(0, Math.min(100, Math.round(rating * factor)));
}
```

- `faceScore` / `outfitScore` apply `biasedRating(..., factor)` to each category before the
  weighted average. Result: aggregates, Aura Index, verdict, receipt, **and** the displayed
  sub-scores all move together — internally consistent.
- `auraIndex` unchanged (operates on already-biased aggregates + biased `visualPresence`).
- `pickVerdict` thresholds **unchanged** (70/45); the bias shifts the *input* aura, not the bands.
  (Verdict-band calibration remains a post-deploy live check.)
- `displayScore` jitter unchanged; re-seeded by the `v3` prompt-version bump.

> **Tuning note:** because bias is applied at the rating level, `descriptorFor` (raw-rating
> descriptors in `assemble.ts`) must receive the **biased** rating too, or the word ("Strong")
> and the number won't agree. Pass biased ratings through.

---

## 5. Content changes (`content-bank.ts`, `sticker-bank.ts`)

### 5.1 Femme overrides on shared entries
Add an optional `femme?: string` to bank entry types. Examples (final list in plan):

| ID | default | femme |
|---|---|---|
| `punchline.certified_lover_boy` | CERTIFIED LOVER BOY | CERTIFIED HEARTBREAKER |
| `punchline.delusional_lover_boy` | DELUSIONAL LOVER BOY | DELULU IT-GIRL |
| `face_archetype.unc` (UNC STATUS) | UNC / STATUS | AUNTIE / STATUS |
| `outfit_caption.let_him_cook` | LET HIM COOK | LET HER COOK |
| `face_archetype.main_character` | MAIN / CHARACTER | (shared — neutral) |

### 5.2 Femme-only entries
Add femme-coded memes across bands (with stickers): **It Girl** (high), **Mother** (elite),
**Material Girl** (high), **Clean Girl** (mid), **Femme Fatale** (elite). New sticker presets as
needed (tones per existing convention). Add their IDs to the prompt allowlists.

### 5.3 Rendering & selection
- `assemble.ts` resolves display text: `confidentlyFemme && entry.femme ? entry.femme : entry.default`.
- `pickBanded` is unchanged mechanically (candidate-driven). Femme-only IDs are reachable because
  the prompt is told to nominate them when `gender === 'femme'`. The masc/unsure path simply never
  nominates them; if one slips through on a non-femme scan, the shared band fallback still renders
  fine (femme-only entries still have a default `band`).

---

## 6. Prompt rewrite (`gemini.ts SYSTEM_INSTRUCTION`)

1. **Gender presentation block:** "Classify the subject's *apparent gender presentation* as
   femme, masc, or unsure with a confidence, for entertainment styling only. This is a
   presentation read, NOT an identity, and may be wrong — use `unsure` when genuinely ambiguous."
2. **Guardrail rewrite:** remove `gender identity` from the do-not-infer list (now handled above);
   keep the rest (ethnicity, religion, sexuality, health, disability, wealth, criminality, real
   trustworthiness/personality/compatibility).
3. **Icon recognition block:** "You MAY recognize widely-known public figures and popular fictional
   / meme characters and set `recognizedIcon` + confidence. NEVER attempt to identify a private
   individual; if it's just an ordinary person, `recognizedIcon` is null. A strong resemblance is
   entertainment, not a factual identity claim."
4. **Voice spec (savage roast):** confident, funny, internet-native; matches the sticker lexicon
   (rizz, NPC, delulu, chopped, aura). Roast the *look / fit / pose / vibe*. **Never** roast or
   reference protected traits (ethnicity, religion, disability, body shaming, etc.). One punchy
   sentence per copy field.
5. **Anti-AI-slop banlist:** no "elevate / in today's world / let's dive in / it's not just X, it's
   Y / a testament to / when it comes to"; no em-dash sermons; no hedging ("consider…", "you might
   want to"); no corporate-fashion register. Plain, sharp, human, funny.
6. **Femme copy steer:** when `gender === 'femme'`, copy + candidate IDs use female-coded
   references; never "lover boy"; prefer the femme-only meme IDs where they fit the band.
7. **Icon-in-copy rule:** the model writes copy generically; the **backend** decides whether to
   surface `recognizedIcon` (only at `recognizedConfidence ≥ 0.85`). Prompt should NOT hard-code
   the name into every field — keep copy standalone so a low-confidence name can be dropped.
8. Scoring anchor (0–20 … 81–100) **unchanged** for now; revisit only if live calibration is off.
9. `schemaVersion` set to `"solo_scan_v3"`.

---

## 7. Assembly changes (`assemble.ts`)

- Compute `factor = biasFactor(ai.presentation)` once; pass biased ratings everywhere a rating is
  read (aggregates via scoring, plus `descriptorFor`, supporting stats, receipt `mce` percent).
- `confidentlyFemme = gender==='femme' && genderConfidence ≥ FEMME_CONFIDENCE_MIN` → select `femme`
  text overrides.
- Icon name surfacing: if `recognizedIcon && recognizedConfidence ≥ ICON_NAME_CONFIDENCE_MIN`, weave
  the name into the receipt summary / a card line (exact placement decided in plan — likely the
  receipt `summary` or a dedicated "GIVING ___ ENERGY" line). Below threshold, ignore the name.

---

## 8. Versioning & deploy

- `constants.ts`: `SCHEMA_VERSION → solo_scan_v3`, `PROMPT_VERSION → v3`.
- Run the shared test suite (Vitest) — all green.
- **Manual edge-function redeploy** of `solo-scan` (not git/Vercel; `.ts` import extensions, no
  Docker). See the deploy memory.
- Post-deploy: sample 3–5 real scans (incl. a femme photo and a recognizable meme face) to sanity-
  check the bias, the female copy, the icon path, and the verdict-band split (the still-open
  calibration follow-up).

---

## 9. Testing (unit, in `packages/shared`)

- `biasFactor`: femme-only, icon-only, both (stacked), neither, and below-confidence gates → 1.0.
- `biasedRating`: clamp at 100, null passthrough, rounding.
- `faceScore`/`outfitScore`/`auraIndex` shift upward by ~the factor when biased.
- Femme text rendering: override used when confidently femme, default otherwise; femme-only entry
  renders default text on a non-femme scan without crashing.
- Schema: `solo_scan_v3` literal required; missing `presentation` fails parse.
- Verdict bands: unchanged behavior given a fixed aura (regression guard).

---

## 10. Open items folded into the implementation plan

- Final femme override list + femme-only meme set (text, band, sticker, tone).
- Exact placement of the icon name in copy.
- New sticker presets for femme-only memes.
