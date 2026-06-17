# Partial Scans — Phase 1 (Invisible Plumbing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the data model, scoring, AI pipeline, and edge function fully support face-only / outfit-only / both scans, with every consumer null-safe — while the UI still requires both photos, so live behaviour is unchanged.

**Architecture:** A scan's composition is an explicit `parts: { face, outfit }` value, set by the edge function from the images it received, threaded into `assembleResult`, and persisted on the result. `result.face` / `result.outfit` become nullable; `result.receipt` is always produced. The Aura Index redistributes a missing modality's weight. Phase 1 ships behind the existing both-photo upload gate, so it's independently deployable and testable via direct edge invokes.

**Tech Stack:** TypeScript, Zod, React, Supabase Edge Functions (Deno), Gemini structured output, Vitest.

**Convention:** All commits end with the repo trailer:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
Run web tests/typecheck from `apps/web` (its `.env.local` feeds `supabase.ts`). Run shared tests from `apps/web` too (the suite includes `src/solo-scan/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-17-partial-scans-face-or-outfit-design.md`

---

## File Structure

- `packages/shared/src/result.ts` — add `ScanParts`, nullable `face`/`outfit`, `parts`, `partsOf()` helper.
- `packages/shared/src/solo-scan/constants.ts` — version bumps.
- `packages/shared/src/solo-scan/scoring.ts` — parts-aware `auraIndex`.
- `packages/shared/src/solo-scan/assemble.ts` — `parts` arg; partial cards; receipt-row dropping.
- `supabase/functions/solo-scan/gemini.ts` — optional images; conditional body; prompt update.
- `supabase/functions/solo-scan/index.ts` — optional images; validate ≥1; derive + pass `parts`.
- `apps/web/src/services/soloScanService.ts` — optional data-url args.
- `apps/web/src/state/generation.tsx` — parts-aware result assembly (still both-only gate).
- `apps/web/src/features/scan/scanGuards.ts` — parts-aware photo matching.
- Null-safety sweep: `apps/web/src/data/mockGenerations.ts`, `apps/web/src/features/vault/SoloMode.tsx`, `apps/web/src/features/result/Result.tsx`, `apps/web/src/lib/exportCard.ts`.
- Tests: `apps/web/src/solo-scan/scoring.test.ts`, `apps/web/src/solo-scan/assemble.test.ts`, `apps/web/src/features/scan/scanGuards.test.ts`.

---

## Task 1: `ScanParts` type, nullable modalities, `partsOf` helper

**Files:**
- Modify: `packages/shared/src/result.ts`
- Test: `packages/shared/src/result.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { partsOf } from './result.ts';

describe('partsOf', () => {
  it('returns explicit parts when present', () => {
    expect(partsOf({ parts: { face: false, outfit: true }, face: null, outfit: {} })).toEqual({ face: false, outfit: true });
  });
  it('defaults a legacy result (no parts) to both', () => {
    expect(partsOf({ face: {}, outfit: {} })).toEqual({ face: true, outfit: true });
  });
  it('infers from presence when parts missing', () => {
    expect(partsOf({ face: null, outfit: {} })).toEqual({ face: false, outfit: true });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run (from `apps/web`): `npx vitest run ../../packages/shared/src/result.test.ts`
Expected: FAIL — `partsOf` is not exported.

- [ ] **Step 3: Implement**

In `packages/shared/src/result.ts`, add near the top (after the `StickerTone` type or before `FullGenerationResult`):

```ts
/** What a scan contains. At least one of the two is always true. */
export interface ScanParts {
  face: boolean;
  outfit: boolean;
}

/**
 * Parts of a (possibly legacy) result. Results saved before this feature predate
 * `parts` and always carried both cards, so a missing `parts` resolves from presence
 * (which, for those rows, is both).
 */
export function partsOf(r: { parts?: ScanParts; face?: unknown; outfit?: unknown }): ScanParts {
  if (r.parts) return r.parts;
  return { face: r.face != null, outfit: r.outfit != null };
}
```

Change `FullGenerationResult` to:

```ts
export interface FullGenerationResult {
  /** The single categorical verdict for the whole generation. */
  verdict: DatingVerdict;
  /** Verdict chip text, e.g. "VERDICT · RED FLAG". */
  chip: string;
  /** Which modalities this scan contains. */
  parts: ScanParts;
  face: FaceResult | null;
  outfit: OutfitResult | null;
  receipt: DatingReceiptResult;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run (from `apps/web`): `npx vitest run ../../packages/shared/src/result.test.ts`
Expected: PASS (3 tests). (Project tsc will fail until later tasks — that's expected mid-plan.)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/result.ts packages/shared/src/result.test.ts
git commit -m "feat(shared): add ScanParts + nullable modalities to the result model"
```

---

## Task 2: Parts-aware `auraIndex`

**Files:**
- Modify: `packages/shared/src/solo-scan/scoring.ts`
- Test: `apps/web/src/solo-scan/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/solo-scan/scoring.test.ts` (adjust the import if `auraIndex` is already imported):

```ts
import { auraIndex } from '@fitaura/shared';

describe('auraIndex (parts-aware)', () => {
  // minimal AI stub: only visualPresence is read by auraIndex
  const ai = (vp: number | null) =>
    ({ faceAnalysis: { visualPresence: { rating: vp, confidence: 1, evidence: '' } } } as any);

  it('both: face*0.45 + outfit*0.45 + vp*0.10', () => {
    expect(auraIndex(ai(80), { face: 60, outfit: 40 }, { face: true, outfit: true }))
      .toBe(Math.round(60 * 0.45 + 40 * 0.45 + 80 * 0.10));
  });
  it('face-only: face*0.90 + vp*0.10', () => {
    expect(auraIndex(ai(70), { face: 60, outfit: null }, { face: true, outfit: false }))
      .toBe(Math.round(60 * 0.90 + 70 * 0.10));
  });
  it('face-only falls back to face when vp is null', () => {
    expect(auraIndex(ai(null), { face: 60, outfit: null }, { face: true, outfit: false }))
      .toBe(Math.round(60 * 0.90 + 60 * 0.10));
  });
  it('outfit-only: outfit*1.0', () => {
    expect(auraIndex(ai(null), { face: null, outfit: 40 }, { face: false, outfit: true }))
      .toBe(40);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run (from `apps/web`): `npx vitest run src/solo-scan/scoring.test.ts`
Expected: FAIL — `auraIndex` signature mismatch / wrong values.

- [ ] **Step 3: Implement**

In `packages/shared/src/solo-scan/scoring.ts`, add the import at top:

```ts
import type { ScanParts } from '../result.ts';
```

Replace the existing `auraIndex` with:

```ts
/**
 * Aura Index, redistributing a missing modality's weight (spec §1.2).
 *   both        → face*0.45 + outfit*0.45 + vp*0.10
 *   face-only   → face*0.90 + vp*0.10
 *   outfit-only → outfit*1.0   (visual presence is a face metric, so it drops out)
 * The present modality scores must be non-null (the caller guards and rejects first).
 */
export function auraIndex(
  ai: SoloScanAIOutput,
  scores: { face: number | null; outfit: number | null },
  parts: ScanParts,
): number {
  const face = scores.face ?? 0;
  const outfit = scores.outfit ?? 0;
  const vp = scoreFromRating(ai.faceAnalysis.visualPresence.rating) ?? face;
  if (parts.face && parts.outfit) return Math.round(face * 0.45 + outfit * 0.45 + vp * 0.10);
  if (parts.face) return Math.round(face * 0.90 + vp * 0.10);
  return Math.round(outfit);
}
```

- [ ] **Step 4: Run to confirm pass**

Run (from `apps/web`): `npx vitest run src/solo-scan/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/scoring.ts apps/web/src/solo-scan/scoring.test.ts
git commit -m "feat(shared): make auraIndex redistribute weight for partial scans"
```

---

## Task 3: Parts-aware `assembleResult`

**Files:**
- Modify: `packages/shared/src/solo-scan/assemble.ts`
- Test: `apps/web/src/solo-scan/assemble.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `apps/web/src/solo-scan/assemble.test.ts`. The existing `assembleResult(ai, scanId, version)` calls must gain a 4th `parts` arg. Update existing calls to pass `{ face: true, outfit: true }`, then add:

```ts
import { sampleAIOutput } from '@fitaura/shared/solo-scan/__fixtures__'; // if not already imported

describe('assembleResult (partial)', () => {
  const ai = sampleAIOutput();

  it('both → face + outfit + receipt, parts both', () => {
    const r = assembleResult(ai, 'scan-both', 'v3_2', { face: true, outfit: true });
    expect(r.parts).toEqual({ face: true, outfit: true });
    expect(r.face).not.toBeNull();
    expect(r.outfit).not.toBeNull();
    expect(r.receipt).toBeTruthy();
  });

  it('outfit-only → outfit + receipt, face null, no main-char row', () => {
    const r = assembleResult(ai, 'scan-outfit', 'v3_2', { face: false, outfit: true });
    expect(r.parts).toEqual({ face: false, outfit: true });
    expect(r.face).toBeNull();
    expect(r.outfit).not.toBeNull();
    expect(r.receipt).toBeTruthy();
    expect(r.receipt.rows.some((row) => row.id === 'main-char')).toBe(false);
  });

  it('face-only → face + receipt, outfit null', () => {
    const r = assembleResult(ai, 'scan-face', 'v3_2', { face: true, outfit: false });
    expect(r.parts).toEqual({ face: true, outfit: false });
    expect(r.face).not.toBeNull();
    expect(r.outfit).toBeNull();
    expect(r.receipt).toBeTruthy();
  });

  it('throws insufficient_signal only when a PROVIDED modality cannot be scored', () => {
    const blank = sampleAIOutput();
    for (const k of Object.keys(blank.outfitAnalysis)) (blank.outfitAnalysis as any)[k].rating = null;
    // outfit-only but no outfit ratings → unscorable provided modality
    expect(() => assembleResult(blank, 'x', 'v3_2', { face: false, outfit: true })).toThrow('insufficient_signal');
    // both, outfit blank but face fine → still throws (outfit provided, unscorable)
    expect(() => assembleResult(blank, 'x', 'v3_2', { face: true, outfit: true })).toThrow('insufficient_signal');
    // face-only ignores the blank outfit → OK
    expect(() => assembleResult(blank, 'x', 'v3_2', { face: true, outfit: false })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run (from `apps/web`): `npx vitest run src/solo-scan/assemble.test.ts`
Expected: FAIL — `assembleResult` takes 3 args / returns non-null face/outfit.

- [ ] **Step 3: Implement**

In `packages/shared/src/solo-scan/assemble.ts`:

Add the import:

```ts
import type { ScanParts } from '../result.ts';
```

Replace the whole `assembleResult` function with:

```ts
export function assembleResult(
  ai: SoloScanAIOutput,
  scanId: string,
  promptVersion: string,
  parts: ScanParts,
): FullGenerationResult {
  const factor = biasFactor(ai.presentation);
  const glory = isMemeGlory(ai.presentation);
  let b = applyScoreBias(ai, factor);
  if (glory) b = applyGloryFloor(b, scanId);
  const confidentlyFemme = ai.presentation.gender === 'femme'
    && ai.presentation.genderConfidence >= 0.60;
  const contentGender = confidentlyFemme ? 'femme' : 'masc';

  const face = parts.face ? faceScore(b) : null;
  const outfit = parts.outfit ? outfitScore(b) : null;
  if ((parts.face && face == null) || (parts.outfit && outfit == null)) {
    throw new Error('insufficient_signal');
  }

  const aura = auraIndex(b, { face, outfit }, parts);
  const verdict = pickVerdict(aura, scanId);
  const band = scoreBand(aura);
  const d = (s: number, key: string) => displayScore(s, scanId, key, promptVersion);

  const punchline = pickPunchline(glory ? undefined : ai.receiptContent.punchlineCandidates, band, scanId, contentGender);

  const fa = b.faceAnalysis;
  const oa = b.outfitAnalysis;
  const sc = (r: RubricRating, key: string) => d(scoreFromRating(r.rating) ?? UNSCORED_DISPLAY, key);

  /* ---- Face (only when provided) ---- */
  let faceResult = null as FullGenerationResult['face'];
  if (parts.face) {
    const archetype = pickFaceArchetype(glory ? undefined : ai.contentSelection.faceArchetypeCandidates, band, scanId, contentGender);
    const faceCard = {
      imageUrl: null,
      eyebrow: 'FACE VERDICT',
      verdict: archetype.line,
      index: `AURA INDEX ${aura}`,
      scores: [
        score('aura', 'Aura', aura),
        score('haircut-match', 'Haircut Match', sc(fa.haircutMatch, 'haircut')),
        score('gender-index', confidentlyFemme ? 'Femininity Index' : 'Masculinity Index',
          d(ai.presentation.expressionStrength, 'gender-index')),
        score('main-character', 'Main Character', sc(fa.mainCharacterEnergy, 'mainchar'), true),
      ],
      sticker: faceStickerById(archetype.stickerId),
    };
    const faceTraits: FaceTrait[] = [
      { id: 'jaw', label: 'Jaw Presence', value: sc(fa.jawPresence, 'jaw'), descriptor: descriptorFor(fa.jawPresence.rating), icon: 'jaw' },
      { id: 'harmony', label: 'Face Harmony', value: sc(fa.faceHarmony, 'harmony'), descriptor: descriptorFor(fa.faceHarmony.rating), icon: 'harmony' },
      { id: 'presence', label: 'Visual Presence', value: sc(fa.visualPresence, 'presence'), descriptor: descriptorFor(fa.visualPresence.rating), icon: 'eye' },
      { id: 'haircut', label: 'Haircut Match', value: sc(fa.haircutMatch, 'haircut'), descriptor: descriptorFor(fa.haircutMatch.rating), icon: 'brow' },
      { id: 'grooming', label: 'Grooming', value: sc(fa.groomingCoherence, 'grooming'), descriptor: descriptorFor(fa.groomingCoherence.rating), icon: 'beard' },
      { id: 'main-character', label: 'Main Character', value: sc(fa.mainCharacterEnergy, 'mainchar'), descriptor: descriptorFor(fa.mainCharacterEnergy.rating), icon: 'star' },
    ];
    faceResult = { card: faceCard, analysis: { aura, explanation: ai.faceCopy.summary, roast: ai.faceCopy.improvement, breakdown: faceTraits } };
  }

  /* ---- Outfit (only when provided) ---- */
  let outfitResult = null as FullGenerationResult['outfit'];
  if (parts.outfit) {
    const caption = pickOutfitCaption(glory ? undefined : ai.contentSelection.outfitCaptionCandidates, band, scanId, contentGender);
    const outfitCard = {
      imageUrl: null,
      caption: caption.caption,
      overallScore: d(outfit as number, 'outfit-overall'),
      scores: [
        score('silhouette', 'Silhouette', sc(oa.silhouette, 'silhouette')),
        score('proportions', 'Proportions', sc(oa.proportions, 'proportions')),
        score('fit', 'Fit', sc(oa.fit, 'fit')),
        score('physique-match', 'Physique Match', sc(oa.physiqueMatch, 'physique')),
      ],
      sticker: outfitStickerById(caption.stickerId),
    };
    const supportingDefs: Array<{ id: string; label: string; r: RubricRating; key: string }> = [
      { id: 'color-story', label: 'Color Story', r: oa.colorCoherence, key: 'color' },
      { id: 'layering', label: 'Layering', r: oa.layering, key: 'layering' },
      { id: 'styling-intent', label: 'Styling Intent', r: oa.stylingIntent, key: 'styling' },
      { id: 'overall-cohesion', label: 'Overall Cohesion', r: oa.overallCohesion, key: 'cohesion' },
      { id: 'accessories', label: 'Accessories', r: oa.accessories, key: 'accessories' },
    ];
    const supporting: SupportingStat[] = supportingDefs
      .filter((s) => s.r.rating != null)
      .slice(0, 4)
      .map((s) => ({ id: s.id, label: s.label, value: d(scoreFromRating(s.r.rating)!, s.key), note: s.r.evidence }));
    const assessed = supportingDefs.filter((s) => s.r.rating != null);
    const sorted = [...assessed].sort((a, b2) => (b2.r.rating! - a.r.rating!));
    const tags = sorted.length >= 2
      ? [
          { label: `${sorted[0].label.toLowerCase()} on point`, tone: 'good' as const },
          { label: `${sorted[sorted.length - 1].label.toLowerCase()} needs work`, tone: 'bad' as const },
        ]
      : [{ label: 'clean fit', tone: 'good' as const }];
    outfitResult = {
      card: outfitCard,
      analysis: { explanation: ai.outfitCopy.works, works: ai.outfitCopy.works, hurts: ai.outfitCopy.hurts, verdict: ai.outfitCopy.verdict, tags, supporting },
    };
  }

  /* ---- Receipt (always) ---- */
  const datingScore = Math.round(aura) / 10;
  const auraValue = Math.round((aura - 50) * AURA_GAIN_SCALE);
  const goodTone = verdict === 'green_flag';
  const rows: ReceiptRow[] = [
    { id: 'dating-score', label: 'Dating Score', value: `${datingScore.toFixed(1)} / 10`, tone: goodTone ? 'good' : 'default' },
    { id: 'aura-gained', label: 'Aura Gained', value: `${auraValue >= 0 ? '+' : ''}${auraValue}`, tone: auraValue >= 0 ? 'good' : 'default' },
    { id: 'lover-boy', label: 'Lover-Boy Prob.', value: `${percent(scanId, 'loverboy', verdict === 'green_flag' ? 84 : 48)}%`, tone: goodTone ? 'good' : 'default' },
    { id: 'ghosting', label: 'Ghosting Potential', value: `${percent(scanId, 'ghost', verdict === 'red_flag' ? 72 : 34)}%`, tone: verdict === 'red_flag' ? 'hi' : 'default' },
  ];
  if (parts.face) {
    rows.push({ id: 'main-char', label: 'Main-Char Energy', value: `${percent(scanId, 'mce', scoreFromRating(fa.mainCharacterEnergy.rating) ?? 50)}%`, tone: 'default' });
  }

  const faceSummary = parts.face ? ai.faceCopy.summary : '';
  const outfitSummary = parts.outfit ? ai.outfitCopy.verdict : '';
  const baseSummary = [faceSummary, outfitSummary].filter(Boolean).join(' ');
  const summary = ai.presentation.recognizedIcon && ai.presentation.recognizedConfidence >= ICON_NAME_CONFIDENCE_MIN
    ? `Giving ${ai.presentation.recognizedIcon} energy. ${baseSummary}`.trim()
    : baseSummary;

  return {
    verdict,
    chip: `VERDICT · ${VERDICT_LABEL[verdict]}`,
    parts,
    face: faceResult,
    outfit: outfitResult,
    receipt: {
      generationId: genId(scanId),
      generatedAt: new Date().toISOString(),
      datingScore,
      auraValue,
      rows,
      datingVerdict: verdict,
      finalPunchline: punchline,
      stamp: ['FITAURA', 'VERIFIED'],
      summary,
    },
  };
}
```

- [ ] **Step 4: Run to confirm pass**

Run (from `apps/web`): `npx vitest run src/solo-scan/assemble.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/assemble.ts apps/web/src/solo-scan/assemble.test.ts
git commit -m "feat(shared): assemble partial results (face-only / outfit-only / both)"
```

---

## Task 4: Version bumps + prompt single-image rule

**Files:**
- Modify: `packages/shared/src/solo-scan/constants.ts`
- Modify: `supabase/functions/solo-scan/gemini.ts`

- [ ] **Step 1: Bump versions**

In `packages/shared/src/solo-scan/constants.ts`:

```ts
export const SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v3_2' as const;
export const SOLO_SCAN_PROMPT_VERSION = 'v3_2' as const;
```

- [ ] **Step 2: Make Gemini images optional + conditional body**

In `supabase/functions/solo-scan/gemini.ts`, change `GeminiOpts`:

```ts
interface GeminiOpts {
  apiKey: string;
  model: string;
  face?: InlineImage;
  outfit?: InlineImage;
}
```

Replace `buildBody` with:

```ts
function buildBody(face?: InlineImage, outfit?: InlineImage) {
  const parts: Array<Record<string, unknown>> = [];
  if (face) {
    parts.push({ text: 'IMAGE: FACE PHOTO' });
    parts.push({ inlineData: { mimeType: face.mimeType, data: face.data } });
  }
  if (outfit) {
    parts.push({ text: 'IMAGE: OUTFIT PHOTO' });
    parts.push({ inlineData: { mimeType: outfit.mimeType, data: outfit.data } });
  }
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}
```

In `once`, the body call is already `buildBody(opts.face, opts.outfit)` — leave as is (now passes optionals).

- [ ] **Step 3: Update the system instruction**

In `gemini.ts`, edit `SYSTEM_INSTRUCTION`:

- Change the second sentence to:
  `Analyze the supplied photo(s) using only visible, presentation-related evidence. You may receive a FACE PHOTO, an OUTFIT PHOTO, or both.`
- Add a new paragraph before the "If an attribute cannot be assessed" line:
  `SINGLE IMAGE: If only one photo is provided, score only that modality. For the absent modality, set EVERY rating in its analysis block to null (confidence 0, brief evidence "not provided"). Do NOT add an input issue for the absent modality and do NOT request a retake because it is missing. Set the absent modality's *Usable flag to false but keep inputQuality.usable true as long as the provided photo(s) are usable.`
- Change the final line to:
  `Set schemaVersion to "solo_scan_v3_2".`

- [ ] **Step 4: Verify**

Run (from `apps/web`): `npx vitest run src/solo-scan/`
Expected: PASS (constants version flows into schema `z.literal`; existing fixture uses the constant).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/constants.ts supabase/functions/solo-scan/gemini.ts
git commit -m "feat(solo-scan): v3.2 prompt/schema — single-image scans"
```

---

## Task 5: Edge function accepts one or both images

**Files:**
- Modify: `supabase/functions/solo-scan/index.ts`

- [ ] **Step 1: Make body optional + validate ≥1 + derive parts**

In `index.ts`, change `ReqBody`:

```ts
interface ReqBody {
  scanId: string;
  face?: InlineImage;
  outfit?: InlineImage;
}
```

Replace the validation block:

```ts
  const { scanId, face, outfit } = body ?? {};
  const MAX_B64 = 27_000_000;
  const okImg = (i: InlineImage | undefined) =>
    !!i && typeof i.data === 'string' && i.data.length > 0 && i.data.length <= MAX_B64
    && /^image\/(jpeg|png|webp)$/.test(i.mimeType ?? '');
  const parts = { face: okImg(face), outfit: okImg(outfit) };
  if (!scanId || (!parts.face && !parts.outfit)) {
    return json({ ok: false, kind: 'error', message: 'invalid_images' }, 400);
  }
```

Replace the `callGemini` call to send only provided images:

```ts
    const { raw, usage } = await callGemini({
      apiKey, model,
      face: parts.face ? face : undefined,
      outfit: parts.outfit ? outfit : undefined,
    });
```

Replace the `assembleResult` call:

```ts
      result = assembleResult(ai, scanId, SOLO_SCAN_PROMPT_VERSION, parts);
```

Update the retake guard so an absent modality is not treated as unusable. Replace the `if (!ai.inputQuality.usable)` block's `faceUsable`/`outfitUsable` to reflect parts:

```ts
    if (!ai.inputQuality.usable) {
      console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: 'unusable_input', latency_ms: Date.now() - started }));
      return json({
        ok: false,
        kind: 'retake',
        faceUsable: parts.face ? ai.inputQuality.faceUsable : false,
        outfitUsable: parts.outfit ? ai.inputQuality.outfitUsable : false,
        instruction: ai.inputQuality.retakeInstruction ?? 'Try a clearer, well-lit photo.',
      });
    }
```

- [ ] **Step 2: Deno check (if available)**

Run: `deno check supabase/functions/solo-scan/index.ts`
Expected: no errors. (If Deno is not installed locally, rely on the smoke test in Task 11.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/solo-scan/index.ts
git commit -m "feat(solo-scan): edge accepts face-only / outfit-only / both"
```

---

## Task 6: Client service — optional data URLs

**Files:**
- Modify: `apps/web/src/services/soloScanService.ts`

- [ ] **Step 1: Implement**

Replace `runSoloScan` with:

```ts
/** Invoke the `solo-scan` Edge Function with a face url, an outfit url, or both. */
export async function runSoloScan(
  faceDataUrl: string | null,
  outfitDataUrl: string | null,
): Promise<SoloScanOutcome> {
  let face: InlineImage | undefined;
  let outfit: InlineImage | undefined;
  try {
    if (faceDataUrl) face = dataUrlToInline(faceDataUrl);
    if (outfitDataUrl) outfit = dataUrlToInline(outfitDataUrl);
  } catch {
    return { kind: 'error', message: 'bad_image' };
  }
  if (!face && !outfit) return { kind: 'error', message: 'bad_image' };

  const scanId = crypto.randomUUID();
  const body: Record<string, unknown> = { scanId };
  if (face) body.face = face;
  if (outfit) body.outfit = outfit;

  const { data, error } = await supabase.functions.invoke('solo-scan', { body });

  if (error || !data) return { kind: 'error', message: error?.message ?? 'no_response' };
  if (data.ok) {
    if (data.result) return { kind: 'result', result: data.result as FullGenerationResult };
    return { kind: 'error', message: 'missing_result' };
  }
  if (data.kind === 'retake') {
    return { kind: 'retake', faceUsable: !!data.faceUsable, outfitUsable: !!data.outfitUsable, instruction: String(data.instruction ?? '') };
  }
  return { kind: 'error', message: String(data.message ?? 'generation_failed') };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/services/soloScanService.ts
git commit -m "feat(web): solo-scan service accepts a single photo"
```

---

## Task 7: Generation state — parts-aware result assembly

**Files:**
- Modify: `apps/web/src/state/generation.tsx`

> Phase 1 keeps the both-photo gate (`if (!s.face || !s.outfit) return { ok:false, reason:'missing_photos' }`) so live behaviour is unchanged. We only make the result assembly null-safe + carry `parts`.

- [ ] **Step 1: Implement**

In `runGeneration`, after `const outcome = await runSoloScan(startedFace.url, startedOutfit.url);` and the retake/error guards, replace the `result` construction with parts-aware injection:

```ts
    const now = new Date().toISOString();
    const base = outcome.result;
    const result: GenerationResult = {
      ...base,
      producedAt: now,
      face: base.face ? { ...base.face, card: { ...base.face.card, imageUrl: startedFace.url } } : null,
      outfit: base.outfit ? { ...base.outfit, card: { ...base.outfit.card, imageUrl: startedOutfit.url } } : null,
      receipt: { ...base.receipt, generatedAt: now },
    };
```

(`startedFace`/`startedOutfit` remain non-null in Phase 1 because the both-photo gate stays.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/state/generation.tsx
git commit -m "feat(web): carry parts + null-safe imageUrl injection in generation"
```

---

## Task 8: Parts-aware `resultMatchesPhotos`

**Files:**
- Modify: `apps/web/src/features/scan/scanGuards.ts`
- Test: `apps/web/src/features/scan/scanGuards.test.ts`

- [ ] **Step 1: Update tests**

Replace the `result(...)` helper and add partial cases in `scanGuards.test.ts`:

```ts
const result = (faceUrl: string | null, outfitUrl: string | null): GenerationResult =>
  ({
    parts: { face: faceUrl != null, outfit: outfitUrl != null },
    face: faceUrl != null ? { card: { imageUrl: faceUrl } } : null,
    outfit: outfitUrl != null ? { card: { imageUrl: outfitUrl } } : null,
  } as unknown as GenerationResult);

describe('resultMatchesPhotos (partial)', () => {
  it('outfit-only result matches an outfit-only session', () => {
    expect(resultMatchesPhotos(result(null, 'fit-a'), null, photo('fit-a'))).toBe(true);
  });
  it('outfit-only result does NOT match when a face photo is also present', () => {
    expect(resultMatchesPhotos(result(null, 'fit-a'), photo('face-a'), photo('fit-a'))).toBe(false);
  });
  it('face-only result matches a face-only session', () => {
    expect(resultMatchesPhotos(result('face-a', null), photo('face-a'), null)).toBe(true);
  });
});
```

(Keep the existing both-photo tests; they still pass with the new helper because `result('face-a','fit-a')` now sets `parts` both.)

- [ ] **Step 2: Run to confirm failure**

Run (from `apps/web`): `npx vitest run src/features/scan/scanGuards.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `resultMatchesPhotos` in `scanGuards.ts`:

```ts
export function resultMatchesPhotos(
  result: GenerationResult | null,
  face: UploadedPhoto | null,
  outfit: UploadedPhoto | null,
): boolean {
  if (!result) return false;
  const faceOk = result.face ? !!face && result.face.card.imageUrl === face.url : !face;
  const outfitOk = result.outfit ? !!outfit && result.outfit.card.imageUrl === outfit.url : !outfit;
  return faceOk && outfitOk;
}
```

- [ ] **Step 4: Run to confirm pass**

Run (from `apps/web`): `npx vitest run src/features/scan/scanGuards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scan/scanGuards.ts apps/web/src/features/scan/scanGuards.test.ts
git commit -m "feat(web): match partial scans in resultMatchesPhotos"
```

---

## Task 9: Null-safety sweep (tsc gate)

> Make every remaining consumer compile + not crash on a null modality. Phase 1 never *produces* a partial result via the UI, so these are minimal/defensive; Phase 2 builds the real partial UX on top.

**Files:** `apps/web/src/data/mockGenerations.ts`, `apps/web/src/features/vault/SoloMode.tsx`, `apps/web/src/features/result/Result.tsx`, `apps/web/src/lib/exportCard.ts` (plus anything else tsc flags).

- [ ] **Step 1: Add `parts` to the three mocks**

In `apps/web/src/data/mockGenerations.ts`, each of the three `FullGenerationResult` entries needs `parts`. Add `parts: { face: true, outfit: true },` next to each entry's `verdict`/`chip` field (3 places).

- [ ] **Step 2: Vault thumbnail null-safe**

In `apps/web/src/features/vault/SoloMode.tsx`, `OutfitThumb`, change:

```ts
  const img = r.outfit.card.imageUrl;
```
to:
```ts
  const img = r.outfit?.card.imageUrl ?? r.face?.card.imageUrl ?? null;
```
and guard the badge/caption that read `r.outfit`:
```tsx
      {r.outfit && (
        <div className="badge">
          <span className="num">{r.outfit.card.overallScore}</span>
          <span className="sub">FIT</span>
        </div>
      )}
      {r.outfit && <div className="cap">{r.outfit.card.caption}</div>}
```

- [ ] **Step 3: Run tsc and fix each remaining null-access**

Run (from `apps/web`): `npx tsc -p tsconfig.json --noEmit`
For every error of the form "Object is possibly 'null'" on `result.face`/`result.outfit` (expected in `Result.tsx`, `exportCard.ts`), add a guard. In Phase 1 these always have both at runtime, so the minimal correct guard is:
- In `Result.tsx`, where it renders `<FaceCard ... />` / `<OutfitCard ... />` / analysis blocks, wrap with `{result.face && (...)}` / `{result.outfit && (...)}`.
- In `exportCard.ts`, where a card export reads `result.face`/`result.outfit`, early-return / skip when null (`if (!result.face) return;` inside the face branch, etc.).

Repeat tsc until clean.

- [ ] **Step 4: Confirm tsc clean + tests green**

Run (from `apps/web`):
```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run
```
Expected: tsc no output; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "refactor(web): null-safe consumers for partial results"
```

---

## Task 10: Deploy edge function + smoke test

**Files:** none (deploy + manual verification).

- [ ] **Step 1: Deploy the edge function**

The solo-scan edge function is a MANUAL deploy (not git/Vercel). Deploy it with the project's documented command (project ref + `supabase functions deploy solo-scan`, `.ts` import extensions required, no Docker). See memory "Solo-scan deploy".

- [ ] **Step 2: Smoke test — both (must be unchanged)**

Run the live app's normal both-photo scan. Confirm: a full three-card verdict, identical behaviour to before.

- [ ] **Step 3: Smoke test — single image via direct invoke**

Invoke the function directly with only `face` (then only `outfit`) in the body (e.g. via `supabase functions invoke solo-scan` or a REST call with a base64 image). Confirm the response `result.parts` reflects the single modality, the missing card is `null`, and `receipt` is present.

- [ ] **Step 4: Commit (docs/dev-log)**

Write `docs/dev-log/0XX-partial-scans-phase-1.md` summarising the plumbing + smoke results, then:

```bash
git add docs/dev-log
git commit -m "docs: dev-log for partial-scans phase 1"
```

---

## Self-Review Notes

- **Spec coverage:** §1.1 (Task 1), §1.2 (Task 2), §1.3 (Task 3), §1.4 (Task 4), §1.5 (Tasks 5–6), §1.6 (Tasks 7–9), §1.7 (Tasks 9–10). ✓
- **Type consistency:** `auraIndex(ai, {face,outfit}, parts)`, `assembleResult(ai, scanId, version, parts)`, `runSoloScan(faceUrl|null, outfitUrl|null)`, `partsOf()`, `ScanParts` — used identically across tasks. ✓
- **UI gate stays both-only** through Phase 1 (generation.tsx + upload unchanged), so no user-visible change. Phase 2 flips it.
