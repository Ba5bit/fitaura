// packages/shared/src/solo-scan/scoring.ts
import type { DatingVerdict } from '../verdict.ts';
import type { SoloScanAIOutput } from './schema.ts';
import { FACE_KEYS, OUTFIT_KEYS } from './schema.ts';

/** Each category rating is already a 0–100 score (rules doc §17, v2). Clamp for safety;
 * null stays null (category not assessable). */
export function scoreFromRating(rating: number | null): number | null {
  return rating == null ? null : Math.max(0, Math.min(100, rating));
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
 * Aura Index = Face×0.45 + Outfit×0.45 + normalizedVisualPresence×0.10 (rules doc §17).
 * `face`/`outfit` must be the non-null results of `faceScore`/`outfitScore` — the
 * caller (see `assembleResult`) guards for null and rejects the scan first.
 */
export function auraIndex(ai: SoloScanAIOutput, face: number, outfit: number): number {
  const vp = scoreFromRating(ai.faceAnalysis.visualPresence.rating) ?? face;
  return Math.round(face * 0.45 + outfit * 0.45 + vp * 0.10);
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
