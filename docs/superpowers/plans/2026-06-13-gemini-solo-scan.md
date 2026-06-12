# Gemini 2.5 Flash Solo Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock generation path with a real Gemini 2.5 Flash analysis of the user's face + outfit photos, behind a Supabase Edge Function, returning a fully-assembled `FullGenerationResult` the existing Result page renders unchanged.

**Architecture:** Gemini classifies (1–5 rubric + evidence + candidate content IDs); the backend (Edge Function + a pure shared module) computes all display scores, the Aura Index, the dating verdict, and selects stickers/captions from an allowlist; the frontend presents. The API key lives only as an Edge Function secret. Photos transit the function and are discarded — never persisted server-side. A failed scan refunds the credit.

**Tech Stack:** TypeScript, Zod (validation, runs in Node + Deno via `npm:zod`), Supabase Edge Functions (Deno, REST call to Gemini via `fetch`), React 18 + Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-gemini-solo-scan-design.md` (section refs below cite the rules doc `~/Downloads/fitaura_gemini_2_5_flash_solo_scan.md` as §N).

---

## File Structure

**Shared pure logic (new) — `packages/shared/src/solo-scan/`:**
- `schema.ts` — Zod `solo_scan_v1` schema + inferred `SoloScanAIOutput` type + the Gemini REST `responseSchema` object.
- `scoring.ts` — rating→score map, weighted average with null-redistribution, Aura Index, seeded jitter, dating verdict, percent helper.
- `content-bank.ts` — face-archetype / outfit-caption / punchline allowlists + per-verdict defaults + candidate picker.
- `assemble.ts` — `assembleResult(ai, scanId, promptVersion)` → `FullGenerationResult`.
- `constants.ts` — `SOLO_SCAN_SCHEMA_VERSION`, `SOLO_SCAN_PROMPT_VERSION`.
- `__fixtures__.ts` — `sampleAIOutput()` test fixture (reused by several test files).
- `index.ts` — barrel; re-exported from `packages/shared/src/index.ts`.

**Edge Function (new) — `supabase/functions/solo-scan/`:**
- `deno.json` — import map (`npm:zod`) + relative import of the shared module.
- `gemini.ts` — system instruction, REST request builder, `callGemini()` with one retry, usage logging.
- `index.ts` — Deno `serve()` handler: CORS, parse, call, validate, input-quality gate, assemble, respond.

**Frontend:**
- Create `apps/web/src/services/soloScanService.ts` — splits data URLs, invokes the function, maps outcomes.
- Modify `apps/web/src/services/creditsService.ts` — add `refundCredit` + `clearFreeScanUsed`.
- Modify `apps/web/src/features/account/AccountContext.tsx` — add `refundScan()`.
- Modify `apps/web/src/state/generation.tsx` — `runGeneration` becomes async with `retake` / `error` outcomes.
- Modify `apps/web/src/features/scan/Scan.tsx` — async reveal with loading / retake / error UX.

**Tests (Vitest, in `apps/web`, importing the public `@fitaura/shared` API):**
- `apps/web/src/solo-scan/scoring.test.ts`, `content-bank.test.ts`, `schema.test.ts`, `assemble.test.ts`
- `apps/web/src/services/soloScanService.test.ts`

> **Test placement note:** Cycle 1 established Vitest only in `apps/web`. To avoid new test infra in `packages/shared`, the pure logic is tested from `apps/web` through the public `@fitaura/shared` barrel. Run all tests with `npm run test -w @fitaura/web`.

---

## Task 1: Shared module scaffold — constants + Zod schema

**Files:**
- Create: `packages/shared/src/solo-scan/constants.ts`
- Create: `packages/shared/src/solo-scan/schema.ts`
- Create: `packages/shared/src/solo-scan/index.ts`
- Modify: `packages/shared/src/index.ts` (add barrel export)
- Modify: `packages/shared/package.json` (add `zod` dependency)
- Create: `apps/web/src/solo-scan/schema.test.ts`

- [ ] **Step 1: Add `zod` to shared package deps**

Edit `packages/shared/package.json` — add to `dependencies` (create the block if absent):

```json
"dependencies": {
  "zod": "^3.23.8"
}
```

Then install from the repo root:

Run: `npm install`
Expected: `zod` resolved, lockfile updated.

- [ ] **Step 2: Write `constants.ts`**

```typescript
// packages/shared/src/solo-scan/constants.ts
/** AI response contract version (rules doc §15). Bump on schema changes. */
export const SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v1' as const;

/** Prompt/scoring version — feeds the seeded display jitter so a saved result
 * stays stable, and lets us re-calibrate later. Bump when the system
 * instruction or scoring weights change. */
export const SOLO_SCAN_PROMPT_VERSION = 'v1' as const;
```

- [ ] **Step 3: Write the failing schema test**

```typescript
// apps/web/src/solo-scan/schema.test.ts
import { describe, expect, it } from 'vitest';
import { soloScanSchema } from '@fitaura/shared';
import { sampleAIOutput } from '@fitaura/shared';

describe('soloScanSchema', () => {
  it('accepts a well-formed solo_scan_v1 object', () => {
    const parsed = soloScanSchema.safeParse(sampleAIOutput());
    expect(parsed.success).toBe(true);
  });

  it('rejects an out-of-range rating', () => {
    const bad = sampleAIOutput();
    bad.faceAnalysis.jawPresence.rating = 7 as never;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects confidence above 1', () => {
    const bad = sampleAIOutput();
    bad.faceAnalysis.jawPresence.confidence = 1.4;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });

  it('requires retakeInstruction when not usable', () => {
    const bad = sampleAIOutput();
    bad.inputQuality.usable = false;
    bad.inputQuality.retakeInstruction = null;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test -w @fitaura/web -- schema`
Expected: FAIL — `soloScanSchema`/`sampleAIOutput` not exported.

- [ ] **Step 5: Write `schema.ts`**

```typescript
// packages/shared/src/solo-scan/schema.ts
import { z } from 'zod';
import { SOLO_SCAN_SCHEMA_VERSION } from './constants';

/** One bounded rubric rating (rules doc §5): 1–5 or null when not assessable. */
export const rubricRatingSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(400),
});
export type RubricRating = z.infer<typeof rubricRatingSchema>;

export const inputIssueSchema = z.enum([
  'face_missing', 'multiple_faces', 'face_too_small', 'face_obscured',
  'face_blurry', 'face_low_light', 'outfit_missing', 'outfit_too_cropped',
  'outfit_obscured', 'outfit_blurry', 'outfit_low_light',
  'different_people_suspected', 'unsupported_content', 'other',
]);

const candidates = z.array(z.string().max(80)).max(8);

export const soloScanSchema = z
  .object({
    schemaVersion: z.literal(SOLO_SCAN_SCHEMA_VERSION),
    inputQuality: z.object({
      usable: z.boolean(),
      faceUsable: z.boolean(),
      outfitUsable: z.boolean(),
      samePersonLikely: z.boolean().nullable(),
      issues: z.array(inputIssueSchema).max(14),
      retakeInstruction: z.string().max(300).nullable(),
    }),
    faceAnalysis: z.object({
      photoPresentation: rubricRatingSchema,
      faceHarmony: rubricRatingSchema,
      jawPresence: rubricRatingSchema,
      haircutMatch: rubricRatingSchema,
      groomingCoherence: rubricRatingSchema,
      visualPresence: rubricRatingSchema,
      mainCharacterEnergy: rubricRatingSchema,
    }),
    outfitAnalysis: z.object({
      fit: rubricRatingSchema,
      silhouette: rubricRatingSchema,
      proportions: rubricRatingSchema,
      colorCoherence: rubricRatingSchema,
      physiqueMatch: rubricRatingSchema,
      layering: rubricRatingSchema,
      accessories: rubricRatingSchema,
      stylingIntent: rubricRatingSchema,
      overallCohesion: rubricRatingSchema,
    }),
    faceCopy: z.object({
      strongestPoint: z.string().max(200),
      improvement: z.string().max(200),
      summary: z.string().max(200),
    }),
    outfitCopy: z.object({
      works: z.string().max(200),
      hurts: z.string().max(200),
      verdict: z.string().max(200),
    }),
    contentSelection: z.object({
      faceArchetypeCandidates: candidates,
      outfitCaptionCandidates: candidates,
      stickerCandidates: candidates,
      contentTags: candidates,
    }),
    receiptContent: z.object({
      metricCandidates: candidates,
      punchlineCandidates: candidates,
    }),
  })
  .superRefine((val, ctx) => {
    if (!val.inputQuality.usable && val.inputQuality.retakeInstruction === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inputQuality', 'retakeInstruction'],
        message: 'retakeInstruction is required when usable is false',
      });
    }
  });

export type SoloScanAIOutput = z.infer<typeof soloScanSchema>;

/** Face/outfit rubric category keys, reused by scoring + assembly. */
export const FACE_KEYS = [
  'photoPresentation', 'faceHarmony', 'jawPresence', 'haircutMatch',
  'groomingCoherence', 'visualPresence', 'mainCharacterEnergy',
] as const;
export const OUTFIT_KEYS = [
  'fit', 'silhouette', 'proportions', 'colorCoherence', 'physiqueMatch',
  'layering', 'accessories', 'stylingIntent', 'overallCohesion',
] as const;
```

- [ ] **Step 6: Write `__fixtures__.ts`**

```typescript
// packages/shared/src/solo-scan/__fixtures__.ts
import type { SoloScanAIOutput } from './schema';

const r = (rating: number | null, confidence = 0.8, evidence = 'Visible in the image.') =>
  ({ rating, confidence, evidence });

/** A deterministic, schema-valid AI output for tests. */
export function sampleAIOutput(): SoloScanAIOutput {
  return {
    schemaVersion: 'solo_scan_v1',
    inputQuality: {
      usable: true, faceUsable: true, outfitUsable: true,
      samePersonLikely: true, issues: [], retakeInstruction: null,
    },
    faceAnalysis: {
      photoPresentation: r(4), faceHarmony: r(4), jawPresence: r(3),
      haircutMatch: r(4), groomingCoherence: r(4), visualPresence: r(4),
      mainCharacterEnergy: r(4),
    },
    outfitAnalysis: {
      fit: r(4), silhouette: r(3), proportions: r(3), colorCoherence: r(4),
      physiqueMatch: r(4), layering: r(3), accessories: r(null, 0.2),
      stylingIntent: r(4), overallCohesion: r(4),
    },
    faceCopy: {
      strongestPoint: 'The haircut frames the face cleanly.',
      improvement: 'A more direct angle would add presence.',
      summary: 'Strong base presentation with room for a sharper angle.',
    },
    outfitCopy: {
      works: 'The jacket adds structure through the shoulders.',
      hurts: 'The trouser break shortens the silhouette.',
      verdict: 'Good base, but the proportions can be sharper.',
    },
    contentSelection: {
      faceArchetypeCandidates: ['face_archetype.main_character_intern'],
      outfitCaptionCandidates: ['outfit_caption.let_him_cook'],
      stickerCandidates: ['sticker.main_character'],
      contentTags: ['clean', 'structured'],
    },
    receiptContent: {
      metricCandidates: ['metric.lover_boy_probability'],
      punchlineCandidates: ['punchline.certified_lover_boy'],
    },
  };
}
```

- [ ] **Step 7: Write `index.ts` and re-export from shared barrel**

```typescript
// packages/shared/src/solo-scan/index.ts
export * from './constants';
export * from './schema';
export * from './scoring';
export * from './content-bank';
export * from './assemble';
export * from './__fixtures__';
```

> Note: `scoring`, `content-bank`, `assemble` are created in later tasks. Until then, temporarily comment out those three lines so the build passes; uncomment each as its task lands. (Re-stated in each task's commit step.)

For this task, `index.ts` should export only the modules that exist:

```typescript
// packages/shared/src/solo-scan/index.ts
export * from './constants';
export * from './schema';
export * from './__fixtures__';
```

Add to `packages/shared/src/index.ts` (append):

```typescript
export * from './solo-scan';
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -w @fitaura/web -- schema`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/shared/package.json packages/shared/src/solo-scan packages/shared/src/index.ts apps/web/src/solo-scan/schema.test.ts package-lock.json
git commit -m "feat(shared): solo_scan_v1 Zod schema + fixture"
```

---

## Task 2: Deterministic scoring

**Files:**
- Create: `packages/shared/src/solo-scan/scoring.ts`
- Modify: `packages/shared/src/solo-scan/index.ts` (uncomment `./scoring`)
- Create: `apps/web/src/solo-scan/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/solo-scan/scoring.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreFromRating, weightedAverage, jitter, displayScore,
  pickVerdict, percent,
} from '@fitaura/shared';

describe('scoring', () => {
  it('maps ratings on the fixed curve', () => {
    expect(scoreFromRating(1)).toBe(35);
    expect(scoreFromRating(5)).toBe(92);
    expect(scoreFromRating(null)).toBeNull();
  });

  it('drops nulls and renormalizes weights', () => {
    // one present category → its own score regardless of others being null
    expect(weightedAverage([{ score: 80, weight: 0.2 }, { score: null, weight: 0.8 }])).toBe(80);
  });

  it('returns null when every category is null', () => {
    expect(weightedAverage([{ score: null, weight: 0.5 }, { score: null, weight: 0.5 }])).toBeNull();
  });

  it('jitter is deterministic and bounded to +/-3', () => {
    expect(jitter('abc')).toBe(jitter('abc'));
    for (const s of ['a', 'b', 'c', 'd', 'scan:jaw:v1']) {
      expect(Math.abs(jitter(s))).toBeLessThanOrEqual(3);
    }
  });

  it('displayScore is stable for the same scan/key', () => {
    const a = displayScore(80, 'scan1', 'jaw', 'v1');
    const b = displayScore(80, 'scan1', 'jaw', 'v1');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(77);
    expect(a).toBeLessThanOrEqual(83);
  });

  it('pickVerdict thresholds across the range', () => {
    expect(pickVerdict(95, 'x')).toBe('green_flag');
    expect(pickVerdict(65, 'x')).toBe('normie');
    expect(pickVerdict(40, 'x')).toBe('red_flag');
  });

  it('percent is clamped 0..100 and deterministic', () => {
    expect(percent('scan1', 'ghost', 50)).toBe(percent('scan1', 'ghost', 50));
    expect(percent('scan1', 'ghost', 99, 10)).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @fitaura/web -- scoring`
Expected: FAIL — exports not found.

- [ ] **Step 3: Write `scoring.ts`**

```typescript
// packages/shared/src/solo-scan/scoring.ts
import type { DatingVerdict } from '../verdict';
import type { SoloScanAIOutput } from './schema';
import { FACE_KEYS, OUTFIT_KEYS } from './schema';

/** rules doc §17 rating→score curve. */
const RATING_SCORE: Record<number, number> = { 1: 35, 2: 50, 3: 65, 4: 80, 5: 92 };

export function scoreFromRating(rating: number | null): number | null {
  return rating == null ? null : RATING_SCORE[rating];
}

export interface Weighted {
  score: number | null;
  weight: number;
}

/** Weighted average that drops null categories and redistributes their weight
 * across the assessable ones (rules doc §17). Null when nothing is assessable. */
export function weightedAverage(items: Weighted[]): number | null {
  const present = items.filter((i): i is { score: number; weight: number } => i.score !== null);
  const wsum = present.reduce((a, i) => a + i.weight, 0);
  if (present.length === 0 || wsum === 0) return null;
  const sum = present.reduce((a, i) => a + i.score * i.weight, 0);
  return sum / wsum;
}

const FACE_WEIGHTS: Record<(typeof FACE_KEYS)[number], number> = {
  photoPresentation: 0.10, faceHarmony: 0.20, jawPresence: 0.10, haircutMatch: 0.20,
  groomingCoherence: 0.15, visualPresence: 0.20, mainCharacterEnergy: 0.05,
};
const OUTFIT_WEIGHTS: Record<(typeof OUTFIT_KEYS)[number], number> = {
  fit: 0.20, silhouette: 0.15, proportions: 0.15, colorCoherence: 0.10, physiqueMatch: 0.15,
  layering: 0.05, accessories: 0.05, stylingIntent: 0.05, overallCohesion: 0.10,
};

export function faceScore(ai: SoloScanAIOutput): number | null {
  return weightedAverage(
    FACE_KEYS.map((k) => ({ score: scoreFromRating(ai.faceAnalysis[k].rating), weight: FACE_WEIGHTS[k] })),
  );
}
export function outfitScore(ai: SoloScanAIOutput): number | null {
  return weightedAverage(
    OUTFIT_KEYS.map((k) => ({ score: scoreFromRating(ai.outfitAnalysis[k].rating), weight: OUTFIT_WEIGHTS[k] })),
  );
}

/** Aura Index = Face×0.45 + Outfit×0.45 + normalizedVisualPresence×0.10 (rules doc §17). */
export function auraIndex(ai: SoloScanAIOutput, face: number, outfit: number): number {
  const vp = scoreFromRating(ai.faceAnalysis.visualPresence.rating) ?? face;
  return Math.round(face * 0.45 + outfit * 0.45 + vp * 0.10);
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** FNV-1a string hash → unsigned 32-bit. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic integer in [-spread, +spread]. */
export function jitter(seed: string, spread = 3): number {
  return (hashSeed(seed) % (spread * 2 + 1)) - spread;
}

/** A display score: rounded base + deterministic ±3, clamped 0..100 (rules doc §17). */
export function displayScore(score: number, scanId: string, key: string, promptVersion: string): number {
  return clamp(Math.round(score) + jitter(`${scanId}:${key}:${promptVersion}`), 0, 100);
}

/** A seeded humorous percentage, clamped 0..100. */
export function percent(scanId: string, key: string, base: number, spread = 12): number {
  return clamp(base + jitter(`${scanId}:${key}`, spread), 0, 100);
}

/** Dating verdict from the Aura Index + a small seeded nudge (rules doc §18). */
export function pickVerdict(aura: number, scanId: string): DatingVerdict {
  const c = aura + jitter(`${scanId}:verdict`, 3);
  if (c >= 78) return 'green_flag';
  if (c >= 58) return 'normie';
  return 'red_flag';
}
```

- [ ] **Step 4: Uncomment the scoring export**

In `packages/shared/src/solo-scan/index.ts` add:

```typescript
export * from './scoring';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -w @fitaura/web -- scoring`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/solo-scan/scoring.ts packages/shared/src/solo-scan/index.ts apps/web/src/solo-scan/scoring.test.ts
git commit -m "feat(shared): deterministic solo-scan scoring"
```

---

## Task 3: Content bank / allowlist

**Files:**
- Create: `packages/shared/src/solo-scan/content-bank.ts`
- Modify: `packages/shared/src/solo-scan/index.ts` (add `./content-bank`)
- Create: `apps/web/src/solo-scan/content-bank.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/solo-scan/content-bank.test.ts
import { describe, expect, it } from 'vitest';
import {
  pickFaceArchetype, pickOutfitCaption, pickPunchline, STICKER_BANK,
} from '@fitaura/shared';

describe('content bank', () => {
  it('picks a valid candidate when present', () => {
    const a = pickFaceArchetype(['face_archetype.aura_farmer'], 'green_flag');
    expect(a.line).toEqual(['CERTIFIED', 'AURA FARMER']);
    expect(STICKER_BANK.face.some((s) => s.id === a.stickerId)).toBe(true);
  });

  it('falls back to the per-verdict default on an invalid candidate', () => {
    const a = pickFaceArchetype(['face_archetype.nonsense'], 'red_flag');
    expect(a.line[0]).toBe('RED FLAG');
  });

  it('outfit caption resolves to a real outfit sticker', () => {
    const c = pickOutfitCaption([], 'green_flag');
    expect(STICKER_BANK.outfit.some((s) => s.id === c.stickerId)).toBe(true);
  });

  it('punchline falls back per verdict', () => {
    expect(pickPunchline([], 'green_flag')).toBe('CERTIFIED LOVER BOY');
    expect(pickPunchline(['punchline.nope'], 'red_flag')).toBe('RED FLAG WITH GOOD ANGLES');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @fitaura/web -- content-bank`
Expected: FAIL — exports not found.

- [ ] **Step 3: Write `content-bank.ts`**

```typescript
// packages/shared/src/solo-scan/content-bank.ts
import type { DatingVerdict } from '../verdict';

/** First candidate that exists in `bank`, else the fallback id's entry. */
function pick<T>(candidates: string[] | undefined, bank: Record<string, T>, fallbackId: string): T {
  const id = (candidates ?? []).find((c) => c in bank) ?? fallbackId;
  return bank[id] ?? bank[fallbackId];
}

/* --- Face archetype → card verdict line + face sticker id (real STICKER_BANK.face ids) --- */
export interface FaceArchetype {
  line: [string, string];
  stickerId: string;
}
const FACE_ARCHETYPES: Record<string, FaceArchetype> = {
  'face_archetype.aura_farmer': { line: ['CERTIFIED', 'AURA FARMER'], stickerId: 'aura-farmer' },
  'face_archetype.main_character_intern': { line: ['CERTIFIED', 'MAIN CHARACTER'], stickerId: 'main-character' },
  'face_archetype.chad': { line: ['CERTIFIED', 'CHAD'], stickerId: 'chad' },
  'face_archetype.plot_relevant': { line: ['CLEAN NPC', 'PLOT RELEVANT'], stickerId: 'plot-relevant' },
  'face_archetype.red_flag_good_angles': { line: ['RED FLAG', 'WITH GOOD ANGLES'], stickerId: 'hear-me-out' },
};
const FACE_DEFAULT: Record<DatingVerdict, string> = {
  green_flag: 'face_archetype.main_character_intern',
  normie: 'face_archetype.plot_relevant',
  red_flag: 'face_archetype.red_flag_good_angles',
};
export function pickFaceArchetype(candidates: string[] | undefined, verdict: DatingVerdict): FaceArchetype {
  return pick(candidates, FACE_ARCHETYPES, FACE_DEFAULT[verdict]);
}

/* --- Outfit caption → card caption + outfit sticker id (real STICKER_BANK.outfit ids) --- */
export interface OutfitCaption {
  caption: string;
  stickerId: string;
}
const OUTFIT_CAPTIONS: Record<string, OutfitCaption> = {
  'outfit_caption.let_him_cook': { caption: 'LET HIM COOK', stickerId: 'let-him-cook' },
  'outfit_caption.fit_has_lore': { caption: 'THE FIT HAS LORE', stickerId: 'fit-has-lore' },
  'outfit_caption.clean_npc_potential': { caption: 'CLEAN NPC WITH POTENTIAL', stickerId: 'buffering' },
  'outfit_caption.performative': { caption: 'PERFORMATIVE EDITORIAL', stickerId: 'performative' },
  'outfit_caption.never_cook_again': { caption: 'NEVER COOK AGAIN', stickerId: 'never-cook-again' },
};
const OUTFIT_DEFAULT: Record<DatingVerdict, string> = {
  green_flag: 'outfit_caption.let_him_cook',
  normie: 'outfit_caption.clean_npc_potential',
  red_flag: 'outfit_caption.never_cook_again',
};
export function pickOutfitCaption(candidates: string[] | undefined, verdict: DatingVerdict): OutfitCaption {
  return pick(candidates, OUTFIT_CAPTIONS, OUTFIT_DEFAULT[verdict]);
}

/* --- Punchline → final viral line --- */
const PUNCHLINES: Record<string, string> = {
  'punchline.certified_lover_boy': 'CERTIFIED LOVER BOY',
  'punchline.high_aura_low_stability': 'RED FLAG WITH GOOD ANGLES',
  'punchline.clean_npc_potential': 'CLEAN NPC WITH POTENTIAL',
  'punchline.aura_farmer': 'CERTIFIED AURA FARMER',
};
const PUNCHLINE_DEFAULT: Record<DatingVerdict, string> = {
  green_flag: 'punchline.certified_lover_boy',
  normie: 'punchline.clean_npc_potential',
  red_flag: 'punchline.high_aura_low_stability',
};
export function pickPunchline(candidates: string[] | undefined, verdict: DatingVerdict): string {
  return pick(candidates, PUNCHLINES, PUNCHLINE_DEFAULT[verdict]);
}
```

- [ ] **Step 4: Add the export**

In `packages/shared/src/solo-scan/index.ts` add:

```typescript
export * from './content-bank';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -w @fitaura/web -- content-bank`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/solo-scan/content-bank.ts packages/shared/src/solo-scan/index.ts apps/web/src/solo-scan/content-bank.test.ts
git commit -m "feat(shared): solo-scan content allowlist + per-verdict defaults"
```

---

## Task 4: Assemble rubric → FullGenerationResult

**Files:**
- Create: `packages/shared/src/solo-scan/assemble.ts`
- Modify: `packages/shared/src/solo-scan/index.ts` (add `./assemble`)
- Create: `apps/web/src/solo-scan/assemble.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/solo-scan/assemble.test.ts
import { describe, expect, it } from 'vitest';
import { assembleResult, sampleAIOutput, DATING_VERDICTS } from '@fitaura/shared';

describe('assembleResult', () => {
  const result = assembleResult(sampleAIOutput(), 'scan-test-1', 'v1');

  it('produces a valid verdict and matching chip', () => {
    expect(DATING_VERDICTS).toContain(result.verdict);
    expect(result.chip).toContain('VERDICT');
  });

  it('fills the face card with 4 scores and a sticker', () => {
    expect(result.face.card.scores).toHaveLength(4);
    expect(result.face.card.verdict).toHaveLength(2);
    expect(result.face.card.sticker.label.length).toBeGreaterThan(0);
    expect(result.face.card.imageUrl).toBeNull();
  });

  it('fills the outfit card and skips not_assessable supporting stats', () => {
    expect(result.outfit.card.scores).toHaveLength(4);
    // accessories is null in the fixture → excluded from supporting
    expect(result.outfit.analysis.supporting?.some((s) => s.label === 'Accessories')).toBe(false);
  });

  it('builds a receipt with a dating score in range and a punchline', () => {
    expect(result.receipt.datingScore).toBeGreaterThanOrEqual(0);
    expect(result.receipt.datingScore).toBeLessThanOrEqual(10);
    expect(result.receipt.finalPunchline.length).toBeGreaterThan(0);
    expect(result.receipt.datingVerdict).toBe(result.verdict);
    expect(result.receipt.rows.length).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic for the same scanId', () => {
    const again = assembleResult(sampleAIOutput(), 'scan-test-1', 'v1');
    expect(again.face.card.scores[0].value).toBe(result.face.card.scores[0].value);
    expect(again.verdict).toBe(result.verdict);
  });

  it('throws on insufficient signal (all face ratings null)', () => {
    const ai = sampleAIOutput();
    for (const k of Object.keys(ai.faceAnalysis) as (keyof typeof ai.faceAnalysis)[]) {
      ai.faceAnalysis[k].rating = null;
    }
    expect(() => assembleResult(ai, 'scan-x', 'v1')).toThrow(/insufficient_signal/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @fitaura/web -- assemble`
Expected: FAIL — `assembleResult` not found.

- [ ] **Step 3: Write `assemble.ts`**

```typescript
// packages/shared/src/solo-scan/assemble.ts
import type {
  FullGenerationResult, ScoreItem, FaceTrait, SupportingStat, ReceiptRow,
} from '../result';
import { STICKER_BANK, stickerFromPreset } from '../sticker-bank';
import { VERDICT_LABEL } from '../verdict';
import type { SoloScanAIOutput, RubricRating } from './schema';
import {
  scoreFromRating, faceScore, outfitScore, auraIndex, displayScore, percent, pickVerdict,
} from './scoring';
import { pickFaceArchetype, pickOutfitCaption, pickPunchline } from './content-bank';

const DESCRIPTOR: Record<number, string> = { 5: 'Elite', 4: 'Strong', 3: 'Even', 2: 'Soft', 1: 'Off' };
const descriptorFor = (r: number | null) => (r == null ? '—' : DESCRIPTOR[r]);

function faceStickerById(id: string) {
  return stickerFromPreset(STICKER_BANK.face.find((s) => s.id === id) ?? STICKER_BANK.face[0]);
}
function outfitStickerById(id: string) {
  return stickerFromPreset(STICKER_BANK.outfit.find((s) => s.id === id) ?? STICKER_BANK.outfit[0]);
}

const score = (id: string, label: string, value: number, hot = false): ScoreItem => ({ id, label, value, hot });

/** Generation id like "0xA73F" derived deterministically from the scan id. */
function genId(scanId: string): string {
  let h = 0;
  for (let i = 0; i < scanId.length; i++) h = (h * 31 + scanId.charCodeAt(i)) >>> 0;
  return '0x' + (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Turn the AI rubric into a fully-rendered FullGenerationResult.
 * Throws Error('insufficient_signal') when face/outfit cannot be scored.
 */
export function assembleResult(
  ai: SoloScanAIOutput,
  scanId: string,
  promptVersion: string,
): FullGenerationResult {
  const face = faceScore(ai);
  const outfit = outfitScore(ai);
  if (face == null || outfit == null) throw new Error('insufficient_signal');

  const aura = auraIndex(ai, face, outfit);
  const verdict = pickVerdict(aura, scanId);
  const d = (s: number, key: string) => displayScore(s, scanId, key, promptVersion);

  const archetype = pickFaceArchetype(ai.contentSelection.faceArchetypeCandidates, verdict);
  const caption = pickOutfitCaption(ai.contentSelection.outfitCaptionCandidates, verdict);
  const punchline = pickPunchline(ai.receiptContent.punchlineCandidates, verdict);

  const fa = ai.faceAnalysis;
  const oa = ai.outfitAnalysis;
  const sc = (r: RubricRating, key: string) => d(scoreFromRating(r.rating) ?? 50, key);

  /* ---- Face ---- */
  const faceCard = {
    imageUrl: null,
    eyebrow: 'FACE VERDICT',
    verdict: archetype.line,
    index: `AURA INDEX ${aura}`,
    scores: [
      score('aura', 'Aura', aura),
      score('jaw-presence', 'Jaw Presence', sc(fa.jawPresence, 'jaw')),
      score('face-harmony', 'Face Harmony', sc(fa.faceHarmony, 'harmony')),
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

  /* ---- Outfit ---- */
  const outfitCard = {
    imageUrl: null,
    caption: caption.caption,
    overallScore: d(outfit, 'outfit-overall'),
    scores: [
      score('silhouette', 'Silhouette', sc(oa.silhouette, 'silhouette')),
      score('proportions', 'Proportions', sc(oa.proportions, 'proportions')),
      score('fit', 'Fit', sc(oa.fit, 'fit')),
      score('physique-match', 'Physique Match', sc(oa.physiqueMatch, 'physique')),
    ],
    sticker: outfitStickerById(caption.stickerId),
  };

  // Supporting stats from the remaining rubric categories; skip not_assessable.
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

  // Two tags from the strongest + weakest assessed outfit category.
  const assessed = supportingDefs.filter((s) => s.r.rating != null);
  const sorted = [...assessed].sort((a, b) => (b.r.rating! - a.r.rating!));
  const tags = sorted.length >= 2
    ? [
        { label: `${sorted[0].label.toLowerCase()} on point`, tone: 'good' as const },
        { label: `${sorted[sorted.length - 1].label.toLowerCase()} needs work`, tone: 'bad' as const },
      ]
    : [{ label: 'clean fit', tone: 'good' as const }];

  /* ---- Receipt ---- */
  const datingScore = Math.round(aura) / 10;
  const auraValue = Math.round((aura - 50) * 12);
  const goodTone = verdict === 'green_flag';
  const rows: ReceiptRow[] = [
    { id: 'dating-score', label: 'Dating Score', value: `${datingScore.toFixed(1)} / 10`, tone: goodTone ? 'good' : 'default' },
    { id: 'aura-gained', label: 'Aura Gained', value: `${auraValue >= 0 ? '+' : ''}${auraValue}`, tone: auraValue >= 0 ? 'good' : 'default' },
    { id: 'lover-boy', label: 'Lover-Boy Prob.', value: `${percent(scanId, 'loverboy', verdict === 'green_flag' ? 84 : 48)}%`, tone: goodTone ? 'good' : 'default' },
    { id: 'ghosting', label: 'Ghosting Potential', value: `${percent(scanId, 'ghost', verdict === 'red_flag' ? 72 : 34)}%`, tone: verdict === 'red_flag' ? 'hi' : 'default' },
    { id: 'main-char', label: 'Main-Char Energy', value: `${percent(scanId, 'mce', scoreFromRating(fa.mainCharacterEnergy.rating) ?? 50)}%`, tone: 'default' },
  ];

  return {
    verdict,
    chip: `VERDICT · ${VERDICT_LABEL[verdict]}`,
    face: {
      card: faceCard,
      analysis: {
        aura,
        explanation: ai.faceCopy.summary,
        roast: ai.faceCopy.improvement,
        breakdown: faceTraits,
      },
    },
    outfit: {
      card: outfitCard,
      analysis: {
        explanation: ai.outfitCopy.works,
        works: ai.outfitCopy.works,
        hurts: ai.outfitCopy.hurts,
        verdict: ai.outfitCopy.verdict,
        tags,
        supporting,
      },
    },
    receipt: {
      generationId: genId(scanId),
      generatedAt: new Date().toISOString(),
      datingScore,
      auraValue,
      rows,
      datingVerdict: verdict,
      finalPunchline: punchline,
      stamp: ['FITAURA', 'VERIFIED'],
      summary: `${ai.faceCopy.summary} ${ai.outfitCopy.verdict}`,
    },
  };
}
```

- [ ] **Step 4: Add the export**

In `packages/shared/src/solo-scan/index.ts` add:

```typescript
export * from './assemble';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -w @fitaura/web -- assemble`
Expected: PASS.

- [ ] **Step 6: Typecheck the shared package + app build**

Run: `npm run build -w @fitaura/web`
Expected: `tsc --noEmit` clean, Vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/solo-scan/assemble.ts packages/shared/src/solo-scan/index.ts apps/web/src/solo-scan/assemble.test.ts
git commit -m "feat(shared): assemble rubric into FullGenerationResult"
```

---

## Task 5: Edge Function — Gemini client

**Files:**
- Create: `supabase/functions/solo-scan/deno.json`
- Create: `supabase/functions/solo-scan/gemini.ts`

> No unit test here (Deno I/O shell, exercised live in Task 11). Keep this module thin.

- [ ] **Step 1: Write `deno.json`**

```json
{
  "imports": {
    "zod": "npm:zod@^3.23.8",
    "shared/": "../../../packages/shared/src/"
  }
}
```

- [ ] **Step 2: Write `gemini.ts`**

```typescript
// supabase/functions/solo-scan/gemini.ts
import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** OpenAPI-subset response schema for Gemini structured output (rules doc §20). */
const rubric = () => ({
  type: 'OBJECT',
  properties: {
    rating: { type: 'INTEGER', nullable: true },
    confidence: { type: 'NUMBER' },
    evidence: { type: 'STRING' },
  },
  required: ['rating', 'confidence', 'evidence'],
});
const faceKeys = ['photoPresentation', 'faceHarmony', 'jawPresence', 'haircutMatch', 'groomingCoherence', 'visualPresence', 'mainCharacterEnergy'];
const outfitKeys = ['fit', 'silhouette', 'proportions', 'colorCoherence', 'physiqueMatch', 'layering', 'accessories', 'stylingIntent', 'overallCohesion'];
const objOf = (keys: string[]) => ({
  type: 'OBJECT',
  properties: Object.fromEntries(keys.map((k) => [k, rubric()])),
  required: keys,
});
const strList = () => ({ type: 'ARRAY', items: { type: 'STRING' } });

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    schemaVersion: { type: 'STRING' },
    inputQuality: {
      type: 'OBJECT',
      properties: {
        usable: { type: 'BOOLEAN' },
        faceUsable: { type: 'BOOLEAN' },
        outfitUsable: { type: 'BOOLEAN' },
        samePersonLikely: { type: 'BOOLEAN', nullable: true },
        issues: strList(),
        retakeInstruction: { type: 'STRING', nullable: true },
      },
      required: ['usable', 'faceUsable', 'outfitUsable', 'samePersonLikely', 'issues', 'retakeInstruction'],
    },
    faceAnalysis: objOf(faceKeys),
    outfitAnalysis: objOf(outfitKeys),
    faceCopy: { type: 'OBJECT', properties: { strongestPoint: { type: 'STRING' }, improvement: { type: 'STRING' }, summary: { type: 'STRING' } }, required: ['strongestPoint', 'improvement', 'summary'] },
    outfitCopy: { type: 'OBJECT', properties: { works: { type: 'STRING' }, hurts: { type: 'STRING' }, verdict: { type: 'STRING' } }, required: ['works', 'hurts', 'verdict'] },
    contentSelection: { type: 'OBJECT', properties: { faceArchetypeCandidates: strList(), outfitCaptionCandidates: strList(), stickerCandidates: strList(), contentTags: strList() }, required: ['faceArchetypeCandidates', 'outfitCaptionCandidates', 'stickerCandidates', 'contentTags'] },
    receiptContent: { type: 'OBJECT', properties: { metricCandidates: strList(), punchlineCandidates: strList() }, required: ['metricCandidates', 'punchlineCandidates'] },
  },
  required: ['schemaVersion', 'inputQuality', 'faceAnalysis', 'outfitAnalysis', 'faceCopy', 'outfitCopy', 'contentSelection', 'receiptContent'],
};

const SYSTEM_INSTRUCTION = `You are FitAura's Solo Scan visual classification engine.
Analyze the supplied FACE PHOTO and OUTFIT PHOTO using only visible, presentation-related evidence.
Return only JSON matching the provided schema. The result is entertainment-oriented styling feedback. Do not present subjective judgments as scientific, biometric, medical, or psychological facts.
Do not infer identity, ethnicity, nationality, religion, sexuality, gender identity, health, disability, wealth, criminality, real trustworthiness, real personality, or romantic compatibility.
If an attribute cannot be assessed reliably, return a null rating and explain why briefly.
Use the 1-5 rubric consistently: 1 clearly weak in this presentation, 2 below average, 3 neutral or mixed, 4 strong, 5 clearly strong.
Keep evidence concrete and tied to visible image details. Keep all copy to one short sentence.
Select content IDs only from these allowlists.
faceArchetypeCandidates allowed: face_archetype.aura_farmer, face_archetype.main_character_intern, face_archetype.chad, face_archetype.plot_relevant, face_archetype.red_flag_good_angles.
outfitCaptionCandidates allowed: outfit_caption.let_him_cook, outfit_caption.fit_has_lore, outfit_caption.clean_npc_potential, outfit_caption.performative, outfit_caption.never_cook_again.
punchlineCandidates allowed: punchline.certified_lover_boy, punchline.high_aura_low_stability, punchline.clean_npc_potential, punchline.aura_farmer.
Do not calculate the final Aura Score, Dating Score, or categorical verdict. The backend performs final scoring and verdict assignment.
Set schemaVersion to "solo_scan_v1".`;

export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface GeminiCallResult {
  raw: unknown;
  usage: { input: number; output: number; total: number };
}

interface GeminiOpts {
  apiKey: string;
  model: string;
  face: InlineImage;
  outfit: InlineImage;
}

function buildBody(face: InlineImage, outfit: InlineImage) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'IMAGE 1: FACE PHOTO' },
          { inlineData: { mimeType: face.mimeType, data: face.data } },
          { text: 'IMAGE 2: OUTFIT PHOTO' },
          { inlineData: { mimeType: outfit.mimeType, data: outfit.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

async function once(opts: GeminiOpts): Promise<GeminiCallResult> {
  const url = `${ENDPOINT}/${opts.model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify(buildBody(opts.face, opts.outfit)),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`gemini_http_${res.status}`);
    // Mark transient statuses so the caller can retry once.
    (err as { transient?: boolean }).transient = res.status === 429 || res.status >= 500;
    (err as { detail?: string }).detail = body.slice(0, 300);
    throw err;
  }
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const err = new Error('gemini_empty_response');
    (err as { transient?: boolean }).transient = true;
    throw err;
  }
  const u = json?.usageMetadata ?? {};
  return {
    raw: JSON.parse(text) as unknown,
    usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, total: u.totalTokenCount ?? 0 },
  };
}

/** Call Gemini with exactly one retry on transient failures (rules doc §22). */
export async function callGemini(opts: GeminiOpts): Promise<GeminiCallResult> {
  try {
    return await once(opts);
  } catch (e) {
    if ((e as { transient?: boolean }).transient) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
      return once(opts);
    }
    throw e;
  }
}

export type { SoloScanAIOutput };
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/solo-scan/deno.json supabase/functions/solo-scan/gemini.ts
git commit -m "feat(edge): solo-scan Gemini REST client + response schema"
```

---

## Task 6: Edge Function — request handler

**Files:**
- Create: `supabase/functions/solo-scan/index.ts`

- [ ] **Step 1: Write `index.ts`**

```typescript
// supabase/functions/solo-scan/index.ts
// deno-lint-ignore-file no-explicit-any
import { soloScanSchema } from 'shared/solo-scan/schema.ts';
import { assembleResult } from 'shared/solo-scan/assemble.ts';
import { SOLO_SCAN_PROMPT_VERSION, SOLO_SCAN_SCHEMA_VERSION } from 'shared/solo-scan/constants.ts';
import { callGemini, type InlineImage } from './gemini.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

interface ReqBody {
  scanId: string;
  face: InlineImage;
  outfit: InlineImage;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, kind: 'error', message: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_SOLO_SCAN_MODEL') ?? 'gemini-2.5-flash';
  if (!apiKey) return json({ ok: false, kind: 'error', message: 'missing_api_key' }, 500);

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, kind: 'error', message: 'bad_request' }, 400);
  }
  const { scanId, face, outfit } = body ?? {};
  const okImg = (i: InlineImage | undefined) =>
    i && typeof i.data === 'string' && /^image\/(jpeg|png|webp)$/.test(i.mimeType ?? '');
  if (!scanId || !okImg(face) || !okImg(outfit)) {
    return json({ ok: false, kind: 'error', message: 'invalid_images' }, 400);
  }

  const started = Date.now();
  try {
    const { raw, usage } = await callGemini({ apiKey, model, face, outfit });

    const parsed = soloScanSchema.safeParse(raw);
    if (!parsed.success) {
      console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: 'schema_invalid', latency_ms: Date.now() - started }));
      return json({ ok: false, kind: 'error', message: 'schema_invalid' }, 502);
    }
    const ai = parsed.data;

    if (!ai.inputQuality.usable) {
      console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: 'unusable_input', latency_ms: Date.now() - started }));
      return json({
        ok: false,
        kind: 'retake',
        faceUsable: ai.inputQuality.faceUsable,
        outfitUsable: ai.inputQuality.outfitUsable,
        instruction: ai.inputQuality.retakeInstruction ?? 'Try clearer photos of your face and full outfit.',
      });
    }

    let result;
    try {
      result = assembleResult(ai, scanId, SOLO_SCAN_PROMPT_VERSION);
    } catch {
      return json({
        ok: false, kind: 'retake', faceUsable: true, outfitUsable: true,
        instruction: 'We could not read enough detail — try a sharper, better-lit photo.',
      });
    }

    // rules doc §3 cost estimate; §25 logging (never logs image bytes).
    const cost = (usage.input / 1e6) * 0.3 + (usage.output / 1e6) * 2.5;
    console.log(JSON.stringify({
      scan_id: scanId, model, prompt_version: SOLO_SCAN_PROMPT_VERSION, schema_version: SOLO_SCAN_SCHEMA_VERSION,
      input_tokens: usage.input, output_tokens: usage.output, total_tokens: usage.total,
      latency_ms: Date.now() - started, success: true, estimated_cost: Number(cost.toFixed(6)),
    }));

    return json({ ok: true, result });
  } catch (e) {
    console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: (e as Error).message, latency_ms: Date.now() - started }));
    return json({ ok: false, kind: 'error', message: 'generation_failed' }, 502);
  }
});
```

- [ ] **Step 2: Verify it type-checks under Deno (if Deno is installed)**

Run: `deno check supabase/functions/solo-scan/index.ts`
Expected: no errors. (If Deno is not installed locally, skip — the Supabase deploy step in Task 11 type-checks during bundling.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/solo-scan/index.ts
git commit -m "feat(edge): solo-scan request handler (gate, validate, assemble)"
```

---

## Task 7: Frontend service — `soloScanService`

**Files:**
- Create: `apps/web/src/services/soloScanService.ts`
- Create: `apps/web/src/services/soloScanService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/services/soloScanService.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { runSoloScan, dataUrlToInline } from './soloScanService';

beforeEach(() => invoke.mockReset());

describe('dataUrlToInline', () => {
  it('splits a data URL into mime + base64', () => {
    const out = dataUrlToInline('data:image/webp;base64,AAAB');
    expect(out).toEqual({ mimeType: 'image/webp', data: 'AAAB' });
  });
  it('throws on a non-data URL', () => {
    expect(() => dataUrlToInline('https://x/y.png')).toThrow();
  });
});

describe('runSoloScan', () => {
  it('returns the result on success', async () => {
    invoke.mockResolvedValue({ data: { ok: true, result: { verdict: 'normie' } }, error: null });
    const out = await runSoloScan('data:image/webp;base64,A', 'data:image/webp;base64,B');
    expect(out.kind).toBe('result');
    if (out.kind === 'result') expect(out.result.verdict).toBe('normie');
  });

  it('maps a retake response', async () => {
    invoke.mockResolvedValue({ data: { ok: false, kind: 'retake', faceUsable: true, outfitUsable: false, instruction: 'redo outfit' }, error: null });
    const out = await runSoloScan('data:image/webp;base64,A', 'data:image/webp;base64,B');
    expect(out.kind).toBe('retake');
    if (out.kind === 'retake') expect(out.outfitUsable).toBe(false);
  });

  it('maps a transport error to an error outcome', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const out = await runSoloScan('data:image/webp;base64,A', 'data:image/webp;base64,B');
    expect(out.kind).toBe('error');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @fitaura/web -- soloScanService`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `soloScanService.ts`**

```typescript
// apps/web/src/services/soloScanService.ts
import type { FullGenerationResult } from '@fitaura/shared';
import { supabase } from '../lib/supabase';

export interface InlineImage {
  mimeType: string;
  data: string;
}

export type SoloScanOutcome =
  | { kind: 'result'; result: FullGenerationResult }
  | { kind: 'retake'; faceUsable: boolean; outfitUsable: boolean; instruction: string }
  | { kind: 'error'; message: string };

/** Split a `data:<mime>;base64,<data>` URL into the inline image parts. */
export function dataUrlToInline(dataUrl: string): InlineImage {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('not_a_data_url');
  return { mimeType: m[1], data: m[2] };
}

/** Invoke the `solo-scan` Edge Function for one face + outfit data URL pair. */
export async function runSoloScan(faceDataUrl: string, outfitDataUrl: string): Promise<SoloScanOutcome> {
  let face: InlineImage;
  let outfit: InlineImage;
  try {
    face = dataUrlToInline(faceDataUrl);
    outfit = dataUrlToInline(outfitDataUrl);
  } catch {
    return { kind: 'error', message: 'bad_image' };
  }

  const scanId = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('solo-scan', {
    body: { scanId, face, outfit },
  });

  if (error || !data) return { kind: 'error', message: error?.message ?? 'no_response' };
  if (data.ok && data.result) return { kind: 'result', result: data.result as FullGenerationResult };
  if (data.kind === 'retake') {
    return { kind: 'retake', faceUsable: !!data.faceUsable, outfitUsable: !!data.outfitUsable, instruction: String(data.instruction ?? '') };
  }
  return { kind: 'error', message: String(data.message ?? 'generation_failed') };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @fitaura/web -- soloScanService`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/soloScanService.ts apps/web/src/services/soloScanService.test.ts
git commit -m "feat(web): soloScanService — invoke solo-scan Edge Function"
```

---

## Task 8: Credit refund plumbing

**Files:**
- Modify: `apps/web/src/services/creditsService.ts`
- Modify: `apps/web/src/features/account/AccountContext.tsx`
- Create: `apps/web/src/services/creditsService.refund.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/services/creditsService.refund.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { hasUsedFreeScan, markFreeScanUsed, clearFreeScanUsed } from './creditsService';

describe('clearFreeScanUsed', () => {
  beforeEach(() => localStorage.clear());
  it('restores the guest free-scan flag', () => {
    markFreeScanUsed();
    expect(hasUsedFreeScan()).toBe(true);
    clearFreeScanUsed();
    expect(hasUsedFreeScan()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @fitaura/web -- creditsService.refund`
Expected: FAIL — `clearFreeScanUsed` not exported.

- [ ] **Step 3: Add `refundCredit` + `clearFreeScanUsed` to `creditsService.ts`**

Append to `apps/web/src/services/creditsService.ts`:

```typescript
/** Refund one credit (used when a scan fails after spending). Returns new balance. */
export async function refundCredit(userId: string): Promise<number> {
  return grantCredits(userId, 1);
}

/** Restore the guest free-scan eligibility (used to refund a failed free scan). */
export function clearFreeScanUsed(): void {
  localStorage.removeItem(FREE_SCAN_KEY);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @fitaura/web -- creditsService.refund`
Expected: PASS.

- [ ] **Step 5: Add `refundScan` to `AccountContext`**

In `apps/web/src/features/account/AccountContext.tsx`:

Update the import on line 5 to include the new functions:

```typescript
import { clearFreeScanUsed, getBalance, grantCredits, hasUsedFreeScan, markFreeScanUsed, refundCredit, spendCredit } from '../../services/creditsService';
```

Add `refundScan` to the interface (after `spendForScan` on line 51):

```typescript
  /** Give back what spendForScan took, when a scan ultimately fails. */
  refundScan: () => Promise<void>;
```

Add the implementation right after the `spendForScan` callback (after line 232):

```typescript
  const refundScan = useCallback<AccountContextValue['refundScan']>(async () => {
    if (!signedIn) {
      clearFreeScanUsed();
      setFreeScanAvailable(true);
      return;
    }
    if (!userId) return;
    const next = await refundCredit(userId);
    setCredits(next);
  }, [signedIn, userId]);
```

Add `refundScan` to the `value` object (after `spendForScan,` near line 270) and to the `useMemo` dependency array (the line that starts `signedIn, user, credits, freeScanAvailable, canScan, spendForScan,`):

```typescript
      spendForScan,
      refundScan,
```

```typescript
      signedIn, user, credits, freeScanAvailable, canScan, spendForScan, refundScan, scene, authStatus, authError,
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w @fitaura/web`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/services/creditsService.ts apps/web/src/features/account/AccountContext.tsx apps/web/src/services/creditsService.refund.test.ts
git commit -m "feat(web): credit refund + guest free-scan restore"
```

---

## Task 9: `runGeneration` becomes async (real AI)

**Files:**
- Modify: `apps/web/src/state/generation.tsx`

- [ ] **Step 1: Update the `RunOutcome` type and `runGeneration` signature**

In `apps/web/src/state/generation.tsx`, replace the `RunOutcome` type (line 40) with:

```typescript
export interface RetakeInfo {
  faceUsable: boolean;
  outfitUsable: boolean;
  instruction: string;
}

type RunOutcome =
  | { ok: true; result: GenerationResult }
  | { ok: false; reason: 'missing_photos' }
  | { ok: false; reason: 'retake'; retake: RetakeInfo }
  | { ok: false; reason: 'error'; message: string };
```

Update the interface method (line 52):

```typescript
  /** Runs the AI generation from the uploaded photos. Credit gating happens in AccountContext. */
  runGeneration: () => Promise<RunOutcome>;
```

- [ ] **Step 2: Replace the mock import and `pickVerdict` helper**

Remove the mock import (line 7) and the `pickVerdict` helper (lines 65-67). Add the service import near the top:

```typescript
import { runSoloScan } from '../services/soloScanService';
```

(The `DatingVerdict` import on line 4 is no longer used by this file — remove it from the `@fitaura/shared` import, keeping `FullGenerationResult`.)

- [ ] **Step 3: Rewrite `runGeneration` to call the real service**

Replace the whole `runGeneration` callback (lines 98-124) with:

```typescript
  const runGeneration = useCallback<GenerationContextValue['runGeneration']>(async () => {
    const s = stateRef.current;
    if (!s.face || !s.outfit) return { ok: false, reason: 'missing_photos' };

    const outcome = await runSoloScan(s.face.url, s.outfit.url);
    if (outcome.kind === 'retake') {
      return { ok: false, reason: 'retake', retake: { faceUsable: outcome.faceUsable, outfitUsable: outcome.outfitUsable, instruction: outcome.instruction } };
    }
    if (outcome.kind === 'error') {
      return { ok: false, reason: 'error', message: outcome.message };
    }

    const now = new Date().toISOString();
    const base = outcome.result;
    const result: GenerationResult = {
      ...base,
      producedAt: now,
      face: { ...base.face, card: { ...base.face.card, imageUrl: s.face.url } },
      outfit: { ...base.outfit, card: { ...base.outfit.card, imageUrl: s.outfit.url } },
      receipt: { ...base.receipt, generatedAt: now },
    };

    const history = [result, ...s.history.filter((h) => h.receipt.generationId !== result.receipt.generationId)].slice(
      0,
      HISTORY_CAP,
    );
    const next: PersistedState = { ...s, result, history };
    stateRef.current = next;
    setState(next);
    return { ok: true, result };
  }, [setState]);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w @fitaura/web`
Expected: clean (the only remaining caller, `Scan.tsx`, is updated in Task 10 — if `tsc` flags the `await`/return shape there, that is expected and fixed next).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/state/generation.tsx
git commit -m "feat(web): runGeneration calls the solo-scan service (async)"
```

---

## Task 10: Scan screen — async reveal with retake/error UX

**Files:**
- Modify: `apps/web/src/features/scan/Scan.tsx`

- [ ] **Step 1: Pull in `refundScan` and add reveal/retake/error state**

In `Scan.tsx`, update the `useAccount` destructure (line 110):

```typescript
  const { signedIn, openAuth, canScan, spendForScan, openPaywall, refundScan } = useAccount();
```

Add state near the other `useState` calls (after line 113):

```typescript
  const [revealing, setRevealing] = useState(false);
  const [scanError, setScanError] = useState<{ kind: 'retake' | 'error'; message: string } | null>(null);
```

- [ ] **Step 2: Rewrite `doReveal` to await the AI and refund on failure**

Replace the `doReveal` callback (lines 159-176) with:

```typescript
  const doReveal = useCallback(async () => {
    setScanError(null);
    const ok = await spendForScan();
    if (!ok) {
      openPaywall();
      return;
    }
    setRevealing(true);
    const outcome = await runGeneration();
    setRevealing(false);

    if (outcome.ok) {
      localStorage.setItem('fitaura.tab', 'face');
      navigate('/result#face');
      return;
    }
    // Any failure after spending → give the credit back.
    if (outcome.reason !== 'missing_photos') await refundScan();
    if (outcome.reason === 'retake') {
      setScanError({ kind: 'retake', message: outcome.retake.instruction });
    } else if (outcome.reason === 'error') {
      setScanError({ kind: 'error', message: 'That scan did not go through. Your credit was refunded — give it another go.' });
    } else {
      navigate('/scan');
    }
  }, [spendForScan, openPaywall, runGeneration, refundScan, navigate]);
```

- [ ] **Step 3: Reflect `revealing` + error in the reveal UI**

In the `phase === 'done'` block (lines 266-277), replace the reveal `<button>` and add the error note. Replace the block contents with:

```typescript
        {phase === 'done' && (
          <div className="reveal">
            <span className="stamp">✶ Verdict printed ✶</span>
            <h2>
              Your verdict is <span className="hl">in.</span>
            </h2>
            <p className="sub">Three cards and one dating receipt — fresh off the press.</p>
            <button className="go" onClick={onReveal} disabled={revealing}>
              {revealing
                ? 'Reading the room…'
                : canScan
                  ? 'Reveal my verdict'
                  : 'Log in to reveal your verdict'}{' '}
              {!revealing && <Icon.arrow />}
            </button>
            {scanError && (
              <div className="crop-note warn" style={{ marginTop: 16, maxWidth: 420 }}>
                <Icon.alert />
                <span>
                  {scanError.kind === 'retake' ? scanError.message : scanError.message}
                  {scanError.kind === 'retake' && (
                    <>
                      {' '}
                      <button
                        className="leave-btn"
                        style={{ textDecoration: 'underline', width: 'auto', padding: 0 }}
                        onClick={() => navigate('/scan')}
                      >
                        Replace a photo
                      </button>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 4: Typecheck + run the full test suite**

Run: `npm run typecheck -w @fitaura/web`
Expected: clean.

Run: `npm run test -w @fitaura/web`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scan/Scan.tsx
git commit -m "feat(web): async reveal with retake + refund-on-failure UX"
```

---

## Task 11: Deploy, wire secret, and live-verify

**Files:**
- (No code) — deploy + manual verification. Optionally create `supabase/config.toml` if `supabase init` has not been run.

- [ ] **Step 1: Set the Edge Function secret (key is in `.env.gemini.local`, gitignored)**

The key was verified working against `gemini-2.5-flash`. Set it as a Supabase secret via the dashboard (Project → Edge Functions → Manage secrets) **or** CLI:

Run: `supabase secrets set GEMINI_API_KEY=<value from .env.gemini.local> GEMINI_SOLO_SCAN_MODEL=gemini-2.5-flash`
Expected: secrets stored. (If the CLI is not installed, set both in the dashboard.)

- [ ] **Step 2: Deploy the function**

Deploy `solo-scan` via the Supabase MCP `deploy_edge_function` tool (project ref `rxtlbhjysksoxkdcdqyr`) or CLI:

Run: `supabase functions deploy solo-scan`
Expected: deploy succeeds; the shared module bundles via the `deno.json` import map.

> If bundling cannot follow the `shared/` relative import in the hosted build, fall back to copying the four pure modules (`schema.ts`, `scoring.ts`, `content-bank.ts`, `assemble.ts`, `constants.ts`) into `supabase/functions/solo-scan/_shared/` and updating the imports — but try the import map first.

- [ ] **Step 3: Live smoke test — valid pair**

Run the dev app (`npm run dev -w @fitaura/web`), upload a real face + outfit (or "Use a sample" twice), scan, and Reveal.
Expected: a real verdict renders all five components; Supabase Edge logs show a `success: true` line with token counts + `estimated_cost`.

- [ ] **Step 4: Live smoke test — retake**

Upload an obviously-cropped/invalid outfit (e.g. a close-up), scan, Reveal.
Expected: the reveal shows the retake instruction, **the credit balance is unchanged** (refunded), and you can return to `/scan` to replace a photo.

- [ ] **Step 5: Live smoke test — credit refund on technical failure**

Temporarily set an invalid `GEMINI_SOLO_SCAN_MODEL` secret (e.g. `gemini-nope`), redeploy, scan, Reveal.
Expected: "that scan did not go through" message and the credit is refunded. Restore the model afterward.

- [ ] **Step 6: Production build**

Run: `npm run build -w @fitaura/web`
Expected: `tsc --noEmit` + Vite build clean.

- [ ] **Step 7: Commit any config + write the dev-log**

Per the project convention, write `docs/dev-log/015-gemini-solo-scan.md` (study-oriented: the AI-classifies/backend-decides split, the Deno adaptations, the seeded determinism, and the refund flow).

```bash
git add supabase docs/dev-log/015-gemini-solo-scan.md
git commit -m "feat(edge): deploy solo-scan + dev-log 015"
```

---

## Self-Review

**Spec coverage:**
- §1 goal (AI replaces mock path) → Tasks 5–10. ✓
- §2 data flow → Tasks 5–7, 9. ✓
- §3 client-side preprocessing → no new code needed; `bakeCrop` already emits WebP ≤1200px, EXIF-stripped (noted in plan intro). Service forwards as-is (Task 7). ✓
- §4 AI contract + Gemini config → Task 5 (`gemini.ts`, response schema, system instruction, temp/thinking). ✓
- §5 deterministic scoring + rubric→render mapping → Tasks 2, 4 (mapping table realized in `assemble.ts`). ✓
- §6 content bank/allowlist → Task 3. ✓
- §7 code location → shared modules (Tasks 1–4) + Deno shell (Tasks 5–6). ✓
- §8 frontend seam + failure UX (retake per-image, refund) → Tasks 8–10. ✓
- §9 config/secrets → Task 11 steps 1–2; constants in Task 1. ✓
- §10 console observability → Task 6 logging. ✓
- §11 testing → Tasks 1–4, 7, 8 (Vitest) + Task 11 (manual). ✓
- §12 acceptance criteria → covered across Tasks 6–11.

**Placeholder scan:** No TBD/TODO; every code step shows full code. The one conditional fallback (Task 11 step 2 note) is an explicit deploy contingency, not a placeholder.

**Type consistency:** `SoloScanAIOutput`, `RubricRating`, `FACE_KEYS`/`OUTFIT_KEYS` defined in Task 1 and consumed in Tasks 2/4. `RunOutcome` reasons (`missing_photos`/`retake`/`error`) defined in Task 9 and consumed in Task 10. `SoloScanOutcome` kinds (`result`/`retake`/`error`) defined in Task 7 and consumed in Task 9. `refundScan` added to the interface, value, and deps in Task 8 and used in Task 10. `runGeneration` is `Promise<RunOutcome>` (Task 9), awaited in Task 10. ✓
