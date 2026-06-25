import type { Metric } from './schema.ts';

/**
 * Deterministic placeholder metrics — the seam where real model output drops in.
 *
 * Until the model is wired, a battle's scores are generated from a stable seed
 * (the two names) so the same matchup always crowns the same winner across a
 * refresh, and so it never reaches production users as a "real" analysis (the
 * feature is dev-gated). Replace `generateMetrics` with the model's per-metric
 * output and the rest of the pipeline is unchanged.
 */

export const FACE_METRICS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'jawline', label: 'Jawline' },
  { key: 'hairline', label: 'Hairline' },
  { key: 'rizz', label: 'Rizz' },
  { key: 'aura', label: 'Aura' },
];

export const FIT_METRICS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'drip', label: 'Drip' },
  { key: 'physique', label: 'Physique Match' },
  { key: 'pose', label: 'Pose' },
  { key: 'confidence', label: 'Confidence' },
];

/** xmur3 string hash → 32-bit seed. */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG — tiny, stable, good enough for believable demo scores. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A believable score in the 58–96 band. */
const score = (rnd: () => number) => 58 + Math.round(rnd() * 38);

/** Build one modality's metrics from a seeded PRNG. */
function buildGroup(
  defs: ReadonlyArray<{ key: string; label: string }>,
  rnd: () => number,
): Metric[] {
  return defs.map((d) => ({ key: d.key, label: d.label, a: score(rnd), b: score(rnd) }));
}

/**
 * Deterministic per-battle metrics. Seeded by the two names so a matchup is
 * stable; the empty-seed fallback keeps `Player A` / `Player B` reproducible.
 */
export function generateMetrics(seed: string): { face: Metric[]; fit: Metric[] } {
  const rnd = mulberry32(hashSeed(seed || 'player-a|player-b'));
  return { face: buildGroup(FACE_METRICS, rnd), fit: buildGroup(FIT_METRICS, rnd) };
}
