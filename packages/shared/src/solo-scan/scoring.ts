// packages/shared/src/solo-scan/scoring.ts
import type { DatingVerdict } from '../verdict.ts';
import type { ScanParts } from '../result.ts';
import type { SoloScanAIOutput, Presentation, RubricRating } from './schema.ts';
import { FACE_KEYS, OUTFIT_KEYS } from './schema.ts';

/** Each category rating is already a 0–100 score (rules doc §17, v2). Clamp for safety;
 * null stays null (category not assessable). */
export function scoreFromRating(rating: number | null): number | null {
  return rating == null ? null : Math.max(0, Math.min(100, rating));
}

/** Femme score bias: ×(1+FEMME_SCORE_BIAS) when confidently femme. Tunable 0.05–0.10. */
export const FEMME_SCORE_BIAS = 0.07;
export const FEMME_CONFIDENCE_MIN = 0.60;
/** Recognition confidence gate — shared by the meme-glory floor and surfacing the name. */
export const ICON_CONFIDENCE_MIN = 0.60;
/** Only surface the recognized icon's name in copy at/above this confidence. */
export const ICON_NAME_CONFIDENCE_MIN = 0.85;
/** Meme/fictional icon "glory" (v3.1): every rating is lifted into this seeded range, so a
 * recognized legend (e.g. McLovin) reads high. Real public figures are NOT boosted — they
 * get the honest read (a handsome celeb scores high on merit). Tunable. */
export const GLORY_MIN = 75;
export const GLORY_MAX = 92;

/** Multiplicative score bias — gender only (v3.1). Recognized memes are handled by the glory
 * floor (applyGloryFloor); real people are read truthfully. 1.0 when the femme gate isn't met. */
export function biasFactor(p: Presentation): number {
  return p.gender === 'femme' && p.genderConfidence >= FEMME_CONFIDENCE_MIN ? 1 + FEMME_SCORE_BIAS : 1;
}

/** Apply a bias factor to a single rating, clamped 0..100. null stays null. */
export function biasedRating(rating: number | null, factor: number): number | null {
  return rating == null ? null : Math.max(0, Math.min(100, Math.round(rating * factor)));
}

/** Return a copy of the AI output with every face/outfit rating biased.
 * `expressionStrength` and copy are untouched. Returns the input unchanged when factor === 1. */
export function applyScoreBias(ai: SoloScanAIOutput, factor: number): SoloScanAIOutput {
  if (factor === 1) return ai;
  const biasCat = <T extends Record<string, RubricRating>>(o: T): T => {
    const out = {} as Record<string, RubricRating>;
    for (const k of Object.keys(o)) out[k] = { ...o[k], rating: biasedRating(o[k].rating, factor) };
    return out as T;
  };
  return { ...ai, faceAnalysis: biasCat(ai.faceAnalysis), outfitAnalysis: biasCat(ai.outfitAnalysis) };
}

/** A confidently-recognized meme/fictional icon gets "glory" treatment (v3.1).
 * Real public figures (recognizedKind 'real_person') are read truthfully — no boost. */
export function isMemeGlory(p: Presentation): boolean {
  return p.recognizedKind === 'meme'
    && p.recognizedIcon != null
    && p.recognizedConfidence >= ICON_CONFIDENCE_MIN;
}

/** Seeded legend value in [GLORY_MIN, GLORY_MAX]. Tiny modulo bias is fine here. */
export function gloryFloor(seed: string): number {
  return GLORY_MIN + (hashSeed(seed) % (GLORY_MAX - GLORY_MIN + 1));
}

/** Lift every face/outfit rating up to a per-category seeded legend value (75–92) so the whole
 * card reads high. Never lowers a genuinely-high rating; a null rating becomes the floor (a
 * legend has no "not assessable" weak spots). Stays varied across categories + scans. */
export function applyGloryFloor(ai: SoloScanAIOutput, scanId: string): SoloScanAIOutput {
  const floorCat = <T extends Record<string, RubricRating>>(o: T, group: string): T => {
    const out = {} as Record<string, RubricRating>;
    for (const k of Object.keys(o)) {
      const f = gloryFloor(`${scanId}:glory:${group}:${k}`);
      const r = o[k].rating;
      out[k] = { ...o[k], rating: r == null ? f : Math.max(r, f) };
    }
    return out as T;
  };
  return { ...ai, faceAnalysis: floorCat(ai.faceAnalysis, 'face'), outfitAnalysis: floorCat(ai.outfitAnalysis, 'outfit') };
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

// photoPresentation feeds the aggregate face score (and thus the Aura Index) but is
// deliberately not shown as its own breakdown trait — it rates the photo, not the face.
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

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** FNV-1a string hash → unsigned 32-bit. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic integer in [-spread, +spread]. Tiny modulo bias is fine for display jitter. */
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

/**
 * Dating verdict from the Aura Index + a small seeded nudge (rules doc §18).
 * Bands are effectively ±3 around the 70 / 45 thresholds because of the nudge.
 */
export function pickVerdict(aura: number, scanId: string): DatingVerdict {
  const c = aura + jitter(`${scanId}:verdict`, 3);
  if (c >= 70) return 'green_flag';
  if (c >= 45) return 'normie';
  return 'red_flag';
}
