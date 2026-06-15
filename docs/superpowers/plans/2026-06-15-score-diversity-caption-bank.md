# Score Diversity + Caption Bank Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make solo-scan scores genuinely diverse (10–90+) by having Gemini emit direct 0–100 category scores, and expand the caption/sticker bank with score-band-aware, seeded selection.

**Architecture:** Replace the 1–5 rating → fixed-curve mapping with a direct 0–100 rating. `scoreFromRating` becomes a clamp pass-through; verdict thresholds recalibrate. Captions move from 3-verdict selection to a 6-band (`elite…dire`) model with deterministic seeded picks from band pools, plus matching stickers. The Gemini prompt, Zod schema, fixtures, and tests move with it; the edge function is redeployed.

**Tech Stack:** TypeScript monorepo (`packages/shared`, `apps/web`), Zod, Vitest, Supabase Edge Function (Deno) calling Gemini structured output.

**Test commands** (run from `apps/web`):
- Single file: `npx vitest run src/solo-scan/<file>.test.ts`
- Full web suite: `npm test` (i.e. `vitest run`)
- Typecheck (whole web app, catches cross-file type breaks): `npm run typecheck`

**Note on intermediate typecheck:** Tasks 2→5 temporarily leave `assemble.ts` type-mismatched until Task 5 rewires it. Per-task we run only the relevant **vitest** file (esbuild strips types, so isolated tests still run). Do **not** expect `npm run typecheck` to pass until Task 5 is complete.

---

### Task 1: Expand the sticker bank

**Files:**
- Modify: `packages/shared/src/sticker-bank.ts:19-32`

- [ ] **Step 1: Add the new face + outfit presets**

Replace the `face:` and `outfit:` arrays (lines 19–32) with:

```ts
  face: [
    { id: 'hear-me-out', label: 'HEAR ME OUT', tone: 'warn', rotation: -8 },
    { id: 'plot-relevant', label: 'PLOT RELEVANT', tone: 'chrome', rotation: -8 },
    { id: 'aura-farmer', label: 'AURA FARMER', tone: 'accent', rotation: -8 },
    { id: 'chad', label: 'CHAD', tone: 'accent', rotation: -6 },
    { id: 'main-character', label: 'MAIN CHARACTER', tone: 'chrome', rotation: -8 },
    { id: 'goat', label: 'GOAT', tone: 'accent', rotation: -7 },
    { id: 'mafia-boss', label: 'MAFIA BOSS', tone: 'accent', rotation: -6 },
    { id: 'locked-in', label: 'LOCKED IN', tone: 'accent', rotation: -7 },
    { id: 'honorable-mention', label: 'HONORABLE MENTION', tone: 'chrome', rotation: -7 },
    { id: 'delusional', label: 'DELUSIONAL', tone: 'warn', rotation: -7 },
    { id: 'chopped', label: 'CHOPPED', tone: 'warn', rotation: -8 },
    { id: 'canon-event', label: 'CANON EVENT', tone: 'warn', rotation: -6 },
    { id: 'negative-aura', label: 'NEGATIVE AURA', tone: 'warn', rotation: -7 },
    { id: 'unc', label: 'UNC STATUS', tone: 'warn', rotation: -8 },
    { id: 'ai-slop', label: 'AI SLOP', tone: 'warn', rotation: -6 },
  ],
  outfit: [
    { id: 'fit-has-lore', label: 'FIT HAS LORE', tone: 'accent', rotation: 7 },
    { id: 'let-him-cook', label: 'LET HIM COOK', tone: 'accent', rotation: 7 },
    { id: 'never-cook-again', label: 'NEVER COOK AGAIN', tone: 'warn', rotation: 7 },
    { id: 'buffering', label: 'BUFFERING', tone: 'chrome', rotation: 7 },
    { id: 'performative', label: 'PERFORMATIVE', tone: 'chrome', rotation: 6 },
    { id: 'locked-in', label: 'LOCKED IN', tone: 'accent', rotation: 7 },
    { id: 'rizz', label: 'RIZZ ON SIGHT', tone: 'accent', rotation: 6 },
    { id: 'delulu', label: 'DELULU', tone: 'chrome', rotation: 7 },
    { id: 'ai-slop', label: 'AI SLOP', tone: 'warn', rotation: 6 },
    { id: 'chopped', label: 'CHOPPED FIT', tone: 'warn', rotation: 7 },
    { id: 'aura-debt', label: 'AURA DEBT', tone: 'warn', rotation: 7 },
  ],
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/sticker-bank.ts
git commit -m "feat(shared): expand sticker bank with new meme presets"
```

---

### Task 2: Scoring engine → 0–100

**Files:**
- Modify: `packages/shared/src/solo-scan/scoring.ts`
- Test: `apps/web/src/solo-scan/scoring.test.ts`

- [ ] **Step 1: Update the failing tests**

Replace the body of `apps/web/src/solo-scan/scoring.test.ts` with:

```ts
// apps/web/src/solo-scan/scoring.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreFromRating, weightedAverage, jitter, displayScore,
  pickVerdict, percent,
} from '@fitaura/shared';

describe('scoring', () => {
  it('passes a 0-100 rating straight through, clamped', () => {
    expect(scoreFromRating(73)).toBe(73);
    expect(scoreFromRating(0)).toBe(0);
    expect(scoreFromRating(100)).toBe(100);
    expect(scoreFromRating(150)).toBe(100); // clamps above range
    expect(scoreFromRating(-5)).toBe(0); // clamps below range
    expect(scoreFromRating(null)).toBeNull();
  });

  it('low ratings yield low display scores (diversity floor reaches the teens)', () => {
    expect(displayScore(12, 'scan1', 'jaw', 'v2')).toBeLessThanOrEqual(15);
    expect(displayScore(12, 'scan1', 'jaw', 'v2')).toBeGreaterThanOrEqual(9);
  });

  it('drops nulls and renormalizes weights', () => {
    expect(weightedAverage([{ score: 80, weight: 0.2 }, { score: null, weight: 0.8 }])).toBe(80);
  });

  it('returns null when every category is null', () => {
    expect(weightedAverage([{ score: null, weight: 0.5 }, { score: null, weight: 0.5 }])).toBeNull();
  });

  it('jitter is deterministic and bounded to +/-3', () => {
    expect(jitter('abc')).toBe(jitter('abc'));
    for (const s of ['a', 'b', 'c', 'd', 'scan:jaw:v2']) {
      expect(Math.abs(jitter(s))).toBeLessThanOrEqual(3);
    }
  });

  it('displayScore is stable for the same scan/key', () => {
    const a = displayScore(80, 'scan1', 'jaw', 'v2');
    const b = displayScore(80, 'scan1', 'jaw', 'v2');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(77);
    expect(a).toBeLessThanOrEqual(83);
  });

  it('pickVerdict thresholds: green >=70, normie >=45, else red', () => {
    expect(pickVerdict(90, 'x')).toBe('green_flag');
    expect(pickVerdict(55, 'x')).toBe('normie');
    expect(pickVerdict(20, 'x')).toBe('red_flag');
  });

  it('percent is clamped 0..100 and deterministic', () => {
    expect(percent('scan1', 'ghost', 50)).toBe(percent('scan1', 'ghost', 50));
    expect(percent('scan1', 'ghost', 99, 10)).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/solo-scan/scoring.test.ts`
Expected: FAIL (`scoreFromRating(73)` returns `null` today; `pickVerdict(20)` etc.)

- [ ] **Step 3: Update `scoring.ts`**

In `packages/shared/src/solo-scan/scoring.ts`:

(a) Delete the `RATING_SCORE` table (lines 6–7) and replace `scoreFromRating` (lines 9–13) with:

```ts
/** Each category rating is already a 0–100 score (rules doc §17, v2). Clamp for safety;
 * null stays null (category not assessable). */
export function scoreFromRating(rating: number | null): number | null {
  return rating == null ? null : Math.max(0, Math.min(100, rating));
}
```

(b) Export the FNV-1a hash so the content bank can reuse it (change `function hashSeed` to `export function hashSeed`):

```ts
/** FNV-1a string hash → unsigned 32-bit. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

(c) Recalibrate `pickVerdict` thresholds (the `>= 78` / `>= 58` lines) to:

```ts
export function pickVerdict(aura: number, scanId: string): DatingVerdict {
  const c = aura + jitter(`${scanId}:verdict`, 3);
  if (c >= 70) return 'green_flag';
  if (c >= 45) return 'normie';
  return 'red_flag';
}
```

Leave `weightedAverage`, `faceScore`, `outfitScore`, `auraIndex`, `jitter`, `displayScore`, `percent` unchanged.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/solo-scan/scoring.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/scoring.ts apps/web/src/solo-scan/scoring.test.ts
git commit -m "feat(shared): 0-100 direct rating + recalibrated verdict bands"
```

---

### Task 3: Score bands + expanded content bank

**Files:**
- Rewrite: `packages/shared/src/solo-scan/content-bank.ts`
- Test: `apps/web/src/solo-scan/content-bank.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/solo-scan/content-bank.test.ts` with:

```ts
// apps/web/src/solo-scan/content-bank.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreBand, pickFaceArchetype, pickOutfitCaption, pickPunchline, STICKER_BANK,
} from '@fitaura/shared';

describe('scoreBand', () => {
  it('maps aura to the six bands at the boundaries', () => {
    expect(scoreBand(95)).toBe('elite');
    expect(scoreBand(80)).toBe('elite');
    expect(scoreBand(79)).toBe('high');
    expect(scoreBand(65)).toBe('high');
    expect(scoreBand(50)).toBe('mid');
    expect(scoreBand(35)).toBe('low');
    expect(scoreBand(20)).toBe('poor');
    expect(scoreBand(5)).toBe('dire');
  });
});

describe('content bank', () => {
  it('picks from the band pool when no AI candidates, and resolves a real face sticker', () => {
    const a = pickFaceArchetype([], 'elite', 'scan-a');
    expect(a.line).toHaveLength(2);
    expect(STICKER_BANK.face.some((s) => s.id === a.stickerId)).toBe(true);
  });

  it('respects a valid AI candidate over the band pool', () => {
    const a = pickFaceArchetype(['face_archetype.aura_farmer'], 'dire', 'scan-a');
    expect(a.line).toEqual(['CERTIFIED', 'AURA FARMER']);
  });

  it('is deterministic for the same scan + band', () => {
    expect(pickFaceArchetype([], 'low', 'scan-z')).toEqual(pickFaceArchetype([], 'low', 'scan-z'));
    expect(pickPunchline([], 'poor', 'scan-z')).toBe(pickPunchline([], 'poor', 'scan-z'));
  });

  it('different bands can yield different lines', () => {
    const elite = pickPunchline([], 'elite', 'scan-q');
    const dire = pickPunchline([], 'dire', 'scan-q');
    expect(elite).not.toBe(dire);
  });

  it('outfit caption resolves to a real outfit sticker', () => {
    const c = pickOutfitCaption([], 'mid', 'scan-a');
    expect(STICKER_BANK.outfit.some((s) => s.id === c.stickerId)).toBe(true);
  });

  it('never throws on an empty band — falls back toward mid', () => {
    expect(() => pickFaceArchetype(['nonsense'], 'dire', 'scan-a')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/solo-scan/content-bank.test.ts`
Expected: FAIL (`scoreBand` not exported; pickers have the old `(candidates, verdict)` signature)

- [ ] **Step 3: Rewrite `content-bank.ts`**

Replace the entire contents of `packages/shared/src/solo-scan/content-bank.ts` with:

```ts
// packages/shared/src/solo-scan/content-bank.ts
import { hashSeed } from './scoring';

/** Six display bands derived from the Aura Index, finer than the 3 dating verdicts. */
export type ScoreBand = 'elite' | 'high' | 'mid' | 'low' | 'poor' | 'dire';

export function scoreBand(aura: number): ScoreBand {
  if (aura >= 80) return 'elite';
  if (aura >= 65) return 'high';
  if (aura >= 50) return 'mid';
  if (aura >= 35) return 'low';
  if (aura >= 20) return 'poor';
  return 'dire';
}

/** Deterministic element from `items` keyed by `seed` (stable across re-renders). */
function seededPick<T>(items: T[], seed: string): T {
  return items[hashSeed(seed) % items.length];
}

const BAND_ORDER: ScoreBand[] = ['dire', 'poor', 'low', 'mid', 'high', 'elite'];

interface Banded { band: ScoreBand; }

function groupByBand<T extends Banded>(bank: Record<string, T>): Record<ScoreBand, string[]> {
  const out: Record<ScoreBand, string[]> = { elite: [], high: [], mid: [], low: [], poor: [], dire: [] };
  for (const [id, e] of Object.entries(bank)) out[e.band].push(id);
  return out;
}

/** The band's own pool, else the nearest non-empty band walking toward `mid`. */
function poolFor(byBand: Record<ScoreBand, string[]>, band: ScoreBand): string[] {
  if (byBand[band].length) return byBand[band];
  const here = BAND_ORDER.indexOf(band);
  const mid = BAND_ORDER.indexOf('mid');
  const step = here < mid ? 1 : -1;
  for (let i = here + step; i >= 0 && i < BAND_ORDER.length; i += step) {
    if (byBand[BAND_ORDER[i]].length) return byBand[BAND_ORDER[i]];
  }
  return Object.values(byBand).flat();
}

/** Valid AI candidate (seeded pick among them), else a seeded pick from the band pool. */
function pickBanded<T extends Banded>(
  candidates: string[] | undefined,
  bank: Record<string, T>,
  byBand: Record<ScoreBand, string[]>,
  band: ScoreBand,
  scanId: string,
  poolKey: string,
): T {
  const valid = (candidates ?? []).filter((c) => c in bank);
  const pool = valid.length ? valid : poolFor(byBand, band);
  const id = seededPick(pool, `${scanId}:${poolKey}:${band}`);
  const result = bank[id];
  if (result === undefined) throw new Error(`[content-bank] empty pool for "${poolKey}" band "${band}"`);
  return result;
}

/* --- Face archetype → card verdict line + face sticker id --- */
export interface FaceArchetype { line: [string, string]; stickerId: string; }
interface FaceEntry extends FaceArchetype, Banded {}
const FACE_BANK: Record<string, FaceEntry> = {
  'face_archetype.goat': { line: ['CERTIFIED', 'GOAT'], stickerId: 'goat', band: 'elite' },
  'face_archetype.mafia_boss': { line: ['CERTIFIED', 'MAFIA BOSS'], stickerId: 'mafia-boss', band: 'elite' },
  'face_archetype.main_character': { line: ['MAIN', 'CHARACTER'], stickerId: 'main-character', band: 'high' },
  'face_archetype.aura_farmer': { line: ['CERTIFIED', 'AURA FARMER'], stickerId: 'aura-farmer', band: 'high' },
  'face_archetype.locked_in': { line: ['LOCKED', 'IN'], stickerId: 'locked-in', band: 'high' },
  'face_archetype.plot_relevant': { line: ['CLEAN NPC', 'PLOT RELEVANT'], stickerId: 'plot-relevant', band: 'mid' },
  'face_archetype.honorable_mention': { line: ['HONORABLE', 'MENTION'], stickerId: 'honorable-mention', band: 'mid' },
  'face_archetype.red_flag_good_angles': { line: ['RED FLAG', 'WITH GOOD ANGLES'], stickerId: 'hear-me-out', band: 'low' },
  'face_archetype.delusional': { line: ['DELUSIONAL', 'BUT CONFIDENT'], stickerId: 'delusional', band: 'low' },
  'face_archetype.chopped': { line: ['ABSOLUTELY', 'CHOPPED'], stickerId: 'chopped', band: 'poor' },
  'face_archetype.canon_event': { line: ['CANON', 'EVENT'], stickerId: 'canon-event', band: 'poor' },
  'face_archetype.ai_slop': { line: ['CERTIFIED', 'AI SLOP'], stickerId: 'ai-slop', band: 'poor' },
  'face_archetype.negative_aura': { line: ['NEGATIVE', 'AURA'], stickerId: 'negative-aura', band: 'dire' },
  'face_archetype.unc': { line: ['UNC', 'STATUS'], stickerId: 'unc', band: 'dire' },
};
const FACE_BY_BAND = groupByBand(FACE_BANK);
export function pickFaceArchetype(candidates: string[] | undefined, band: ScoreBand, scanId: string): FaceArchetype {
  return pickBanded(candidates, FACE_BANK, FACE_BY_BAND, band, scanId, 'face');
}

/* --- Outfit caption → card caption + outfit sticker id --- */
export interface OutfitCaption { caption: string; stickerId: string; }
interface OutfitEntry extends OutfitCaption, Banded {}
const OUTFIT_BANK: Record<string, OutfitEntry> = {
  'outfit_caption.locked_in': { caption: 'THE FIT IS LOCKED IN', stickerId: 'locked-in', band: 'elite' },
  'outfit_caption.let_him_cook': { caption: 'LET HIM COOK', stickerId: 'let-him-cook', band: 'elite' },
  'outfit_caption.fit_has_lore': { caption: 'THE FIT HAS LORE', stickerId: 'fit-has-lore', band: 'high' },
  'outfit_caption.rizz': { caption: 'RIZZ ON SIGHT', stickerId: 'rizz', band: 'high' },
  'outfit_caption.clean_npc_potential': { caption: 'CLEAN NPC WITH POTENTIAL', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.performative': { caption: 'PERFORMATIVE EDITORIAL', stickerId: 'performative', band: 'mid' },
  'outfit_caption.delulu': { caption: 'DELULU BUT WORKING', stickerId: 'delulu', band: 'low' },
  'outfit_caption.ai_slop': { caption: 'CERTIFIED AI SLOP', stickerId: 'ai-slop', band: 'poor' },
  'outfit_caption.chopped': { caption: 'CHOPPED FIT', stickerId: 'chopped', band: 'poor' },
  'outfit_caption.never_cook_again': { caption: 'NEVER COOK AGAIN', stickerId: 'never-cook-again', band: 'dire' },
  'outfit_caption.aura_debt': { caption: 'IN AURA DEBT', stickerId: 'aura-debt', band: 'dire' },
};
const OUTFIT_BY_BAND = groupByBand(OUTFIT_BANK);
export function pickOutfitCaption(candidates: string[] | undefined, band: ScoreBand, scanId: string): OutfitCaption {
  return pickBanded(candidates, OUTFIT_BANK, OUTFIT_BY_BAND, band, scanId, 'outfit');
}

/* --- Punchline → final viral line --- */
interface PunchlineEntry extends Banded { text: string; }
const PUNCHLINE_BANK: Record<string, PunchlineEntry> = {
  'punchline.certified_goat': { text: 'CERTIFIED GOAT', band: 'elite' },
  'punchline.built_different': { text: 'BUILT DIFFERENT', band: 'elite' },
  'punchline.certified_lover_boy': { text: 'CERTIFIED LOVER BOY', band: 'high' },
  'punchline.rizz_god': { text: 'RIZZ GOD CONFIRMED', band: 'high' },
  'punchline.aura_farmer': { text: 'CERTIFIED AURA FARMER', band: 'high' },
  'punchline.clean_npc_potential': { text: 'CLEAN NPC WITH POTENTIAL', band: 'mid' },
  'punchline.honorable_mention': { text: 'HONORABLE MENTION', band: 'mid' },
  'punchline.high_aura_low_stability': { text: 'RED FLAG WITH GOOD ANGLES', band: 'low' },
  'punchline.delusional_lover_boy': { text: 'DELUSIONAL LOVER BOY', band: 'low' },
  'punchline.negative_aura': { text: 'NEGATIVE AURA DETECTED', band: 'poor' },
  'punchline.ai_slop': { text: 'CERTIFIED AI SLOP', band: 'poor' },
  'punchline.aura_debt': { text: 'IN AURA DEBT', band: 'dire' },
  'punchline.canon_chopped': { text: 'CANON EVENT: CHOPPED', band: 'dire' },
};
const PUNCHLINE_BY_BAND = groupByBand(PUNCHLINE_BANK);
export function pickPunchline(candidates: string[] | undefined, band: ScoreBand, scanId: string): string {
  return pickBanded(candidates, PUNCHLINE_BANK, PUNCHLINE_BY_BAND, band, scanId, 'punchline').text;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/solo-scan/content-bank.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/content-bank.ts apps/web/src/solo-scan/content-bank.test.ts
git commit -m "feat(shared): score bands + expanded seeded caption bank"
```

---

### Task 4: Schema 0–100 + fixtures + schema tests

**Files:**
- Modify: `packages/shared/src/solo-scan/schema.ts:6-10`
- Modify: `packages/shared/src/solo-scan/__fixtures__.ts`
- Test: `apps/web/src/solo-scan/schema.test.ts`

- [ ] **Step 1: Update the failing schema tests**

In `apps/web/src/solo-scan/schema.test.ts`, change the "accepts" description and the out-of-range value:

```ts
  it('accepts a well-formed solo_scan_v2 object', () => {
    const parsed = soloScanSchema.safeParse(sampleAIOutput());
    expect(parsed.success).toBe(true);
  });

  it('rejects an out-of-range rating', () => {
    const bad = sampleAIOutput();
    bad.faceAnalysis.jawPresence.rating = 150 as never;
    expect(soloScanSchema.safeParse(bad).success).toBe(false);
  });
```

(Leave the confidence and retakeInstruction tests unchanged.)

- [ ] **Step 2: Run, verify failure**

Run: `npx vitest run src/solo-scan/schema.test.ts`
Expected: FAIL ("accepts" fails — fixture still says `solo_scan_v1`, which after Task 6's version bump won't match; and `rating = 150` is currently accepted since max is 5… run after Step 3+4 below)

- [ ] **Step 3: Widen the rating range in `schema.ts`**

Replace lines 5–10 of `packages/shared/src/solo-scan/schema.ts`:

```ts
/** One bounded rubric rating (rules doc §5, v2): a 0–100 score, or null when not assessable. */
export const rubricRatingSchema = z.object({
  rating: z.number().int().min(0).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(400),
});
```

- [ ] **Step 4: Convert the fixture to 0–100 + v2**

In `packages/shared/src/solo-scan/__fixtures__.ts`: set `schemaVersion: 'solo_scan_v2'`, update the candidate id to the new key, and change the rating values:

```ts
    schemaVersion: 'solo_scan_v2',
```

```ts
    faceAnalysis: {
      photoPresentation: r(78), faceHarmony: r(76), jawPresence: r(55),
      haircutMatch: r(78), groomingCoherence: r(74), visualPresence: r(80),
      mainCharacterEnergy: r(72),
    },
    outfitAnalysis: {
      fit: r(78), silhouette: r(55), proportions: r(52), colorCoherence: r(74),
      physiqueMatch: r(76), layering: r(58), accessories: r(null, 0.2),
      stylingIntent: r(75), overallCohesion: r(77),
    },
```

```ts
      faceArchetypeCandidates: ['face_archetype.main_character'],
```

(Leave `outfitCaptionCandidates: ['outfit_caption.let_him_cook']` and `punchlineCandidates: ['punchline.certified_lover_boy']` — both still exist in the new banks.)

> **Note:** this step depends on Task 6 bumping `SOLO_SCAN_SCHEMA_VERSION` to `solo_scan_v2`. If running strictly in order, the "accepts" test will only pass once Task 6 is done — that's expected; the full suite in Task 8 is the gate.

- [ ] **Step 5: Run, verify the out-of-range test passes**

Run: `npx vitest run src/solo-scan/schema.test.ts`
Expected: the "rejects an out-of-range rating" and confidence/retake tests PASS. The "accepts" test passes after Task 6.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/solo-scan/schema.ts packages/shared/src/solo-scan/__fixtures__.ts apps/web/src/solo-scan/schema.test.ts
git commit -m "feat(shared): 0-100 rating schema + v2 fixtures"
```

---

### Task 5: Wire assembly to bands + reband descriptors

**Files:**
- Modify: `packages/shared/src/solo-scan/assemble.ts`
- Test: `apps/web/src/solo-scan/assemble.test.ts`

- [ ] **Step 1: Update the assemble test (version arg → v2)**

In `apps/web/src/solo-scan/assemble.test.ts`, change every `assembleResult(..., 'v1')` to `'v2'` (3 occurrences: lines 6, 35, and the throw test on line 47). No other assertions change — they check lengths/ranges/determinism, all still valid.

- [ ] **Step 2: Run, verify failure**

Run: `npx vitest run src/solo-scan/assemble.test.ts`
Expected: FAIL at import/compile or runtime — `assemble.ts` still calls `pickFaceArchetype(candidates, verdict)` (old signature) and `descriptorFor(rating)` keyed 1–5.

- [ ] **Step 3: Update `assemble.ts`**

(a) Update the content-bank import (line 11) to include `scoreBand`:

```ts
import { pickFaceArchetype, pickOutfitCaption, pickPunchline, scoreBand } from './content-bank';
```

(b) Replace the `DESCRIPTOR` map + `descriptorFor` (lines 19–20) with a 0–100 banded helper:

```ts
const descriptorFor = (score: number | null): string => {
  if (score == null) return '—';
  if (score >= 85) return 'Elite';
  if (score >= 68) return 'Strong';
  if (score >= 45) return 'Even';
  if (score >= 25) return 'Soft';
  return 'Off';
};
```

(c) After `const verdict = pickVerdict(aura, scanId);` (line 52), add the band:

```ts
  const band = scoreBand(aura);
```

(d) Update the three picker calls (lines 55–57) to the new signature:

```ts
  const archetype = pickFaceArchetype(ai.contentSelection.faceArchetypeCandidates, band, scanId);
  const caption = pickOutfitCaption(ai.contentSelection.outfitCaptionCandidates, band, scanId);
  const punchline = pickPunchline(ai.receiptContent.punchlineCandidates, band, scanId);
```

(e) The `faceTraits` array calls `descriptorFor(fa.jawPresence.rating)` etc. — those now pass the raw 0–100 rating, which is exactly the score the descriptor should band. **No change needed** to those call sites; they already pass `.rating`, which is now 0–100.

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/solo-scan/assemble.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/solo-scan/assemble.ts apps/web/src/solo-scan/assemble.test.ts
git commit -m "feat(shared): assemble uses score bands + 0-100 descriptors"
```

---

### Task 6: Bump schema + prompt versions

**Files:**
- Modify: `packages/shared/src/solo-scan/constants.ts:3,8`

- [ ] **Step 1: Bump both versions**

```ts
export const SOLO_SCAN_SCHEMA_VERSION = 'solo_scan_v2' as const;
```

```ts
export const SOLO_SCAN_PROMPT_VERSION = 'v2' as const;
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/solo-scan/constants.ts
git commit -m "chore(shared): bump solo-scan schema + prompt to v2"
```

---

### Task 7: Update the Gemini prompt + schema

**Files:**
- Modify: `supabase/functions/solo-scan/gemini.ts:62,65-67,115`

- [ ] **Step 1: Replace the rubric line**

In `SYSTEM_INSTRUCTION`, replace line 62 (`Use the 1-5 rubric consistently: ...`) with:

```
Score each category 0-100. Anchor: 0-20 clearly weak for this presentation, 21-40 below average, 41-60 neutral or mixed, 61-80 strong, 81-100 clearly elite. Use the full range, differentiate categories from one another, and avoid clustering on round multiples of 10. Return a null rating only when a category genuinely cannot be assessed.
```

- [ ] **Step 2: Replace the three allowlist lines**

Replace lines 65–67 (the `faceArchetypeCandidates allowed: …` / `outfitCaptionCandidates allowed: …` / `punchlineCandidates allowed: …` lines) with:

```
faceArchetypeCandidates allowed: face_archetype.goat, face_archetype.mafia_boss, face_archetype.main_character, face_archetype.aura_farmer, face_archetype.locked_in, face_archetype.plot_relevant, face_archetype.honorable_mention, face_archetype.red_flag_good_angles, face_archetype.delusional, face_archetype.chopped, face_archetype.canon_event, face_archetype.ai_slop, face_archetype.negative_aura, face_archetype.unc.
outfitCaptionCandidates allowed: outfit_caption.locked_in, outfit_caption.let_him_cook, outfit_caption.fit_has_lore, outfit_caption.rizz, outfit_caption.clean_npc_potential, outfit_caption.performative, outfit_caption.delulu, outfit_caption.ai_slop, outfit_caption.chopped, outfit_caption.never_cook_again, outfit_caption.aura_debt.
punchlineCandidates allowed: punchline.certified_goat, punchline.built_different, punchline.certified_lover_boy, punchline.rizz_god, punchline.aura_farmer, punchline.clean_npc_potential, punchline.honorable_mention, punchline.high_aura_low_stability, punchline.delusional_lover_boy, punchline.negative_aura, punchline.ai_slop, punchline.aura_debt, punchline.canon_chopped.
```

- [ ] **Step 3: Update the schemaVersion instruction**

Replace the last line of `SYSTEM_INSTRUCTION` (`Set schemaVersion to "solo_scan_v1".`) with:

```
Set schemaVersion to "solo_scan_v2".
```

- [ ] **Step 4: Bump temperature for spread**

In `buildBody`, change `temperature: 0.2` (line ~115) to `temperature: 0.3`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/solo-scan/gemini.ts
git commit -m "feat(solo-scan): 0-100 rubric prompt, temp 0.3, expanded allowlists"
```

---

### Task 8: Full verification

- [ ] **Step 1: Typecheck the web app (catches cross-file breaks)**

Run (from `apps/web`): `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Run the full web test suite**

Run (from `apps/web`): `npm test`
Expected: all suites PASS, including `services/soloScanService.test.ts` and `assemble.test.ts`. If `soloScanService.test.ts` references a `'v1'` literal or the old fixture shape, update it to `'v2'` and re-run.

- [ ] **Step 3: Production build**

Run (from repo root): `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit any test fixups**

```bash
git add -A && git commit -m "test: align solo-scan suite with v2 scoring + captions" || echo "nothing to commit"
```

---

### Task 9: Deploy the edge function

- [ ] **Step 1: Confirm the deploy target**

The edge function imports `shared/solo-scan/*` (Deno reads `.ts` directly — no shared build needed). Confirm the project/function via the Supabase MCP: `mcp__supabase__list_edge_functions`. Cross-check the method used previously in `docs/dev-log/015-gemini-solo-scan.md`.

- [ ] **Step 2: Redeploy `solo-scan`**

Primary: `npx supabase functions deploy solo-scan` (add `--project-ref <ref>` if the repo isn't linked).
Alternative: `mcp__supabase__deploy_edge_function` with the `solo-scan` source files.

- [ ] **Step 3: Verify a live scan**

Run a real scan from the app (or the dev harness) and confirm: scores span a wide range (some <40, some >80), the verdict chip renders, and a caption/punchline appears. Sample 3–5 scans.

---

### Task 10: Calibration check + dev-log + push

- [ ] **Step 1: Eyeball verdict-band calibration**

From the Task 9 sample scans, check the green/normie/red split feels right. If the distribution skews hard, adjust the `pickVerdict` thresholds (Task 2 Step 3c) and/or the prompt anchor (Task 7 Step 1), bump `SOLO_SCAN_PROMPT_VERSION` again, re-run tests, redeploy. Otherwise leave 70/45 as-is.

- [ ] **Step 2: Write the dev-log**

Create `docs/dev-log/040-score-diversity-caption-bank.md` (next sequential number — verify with `ls docs/dev-log`): study-oriented log covering the 1–5→0–100 migration, the band-aware caption model, the seeded deterministic pick, and the calibration caveat.

- [ ] **Step 3: Commit + push to main**

```bash
git add -A && git commit -m "docs(dev-log): score diversity + caption bank expansion"
git push origin HEAD
```

(Per standing instruction, push without asking. Current branch is `fix/export-safari-snapdom`; confirm whether to merge into `main` or push the branch + open a PR.)

---

## Self-Review notes

- **Spec coverage:** schema 0–100 (T4), prompt rubric + temp + allowlist (T7), `scoreFromRating`/verdict bands/descriptors (T2, T5), 6-band model + seeded pick + expanded bank (T3), stickers (T1), version bump (T6), tests/fixtures (T2–T5, T8), deploy (T9), dev-log + calibration (T10). All spec sections mapped.
- **Single-line stamp risk retired:** all face lines are two-part (e.g. `['ABSOLUTELY','CHOPPED']`), so `FaceCard.tsx`'s `verdict[0] <hl>verdict[1]</hl>` renders cleanly — no component change.
- **Type consistency:** picker signature `(candidates, band, scanId)` is identical across T3 definitions and T5 call sites; `scoreBand` exported in T3, imported in T5; `hashSeed` exported in T2, imported in T3.
