import {
  TIE_BAND,
  type BattleVerdict,
  type BattleWinner,
  type Metric,
  type MetricGroupResult,
  type VersusMode,
} from './schema.ts';

const round = (n: number) => Math.round(n);

/** Winner from two averages, honoring the dead-heat band. */
export function winnerOf(avgA: number, avgB: number): BattleWinner {
  if (Math.abs(avgA - avgB) <= TIE_BAND) return 'tie';
  return avgA > avgB ? 'a' : 'b';
}

function groupResult(metrics: Metric[]): MetricGroupResult {
  if (metrics.length === 0) {
    return { metrics, avgA: 0, avgB: 0, winner: 'tie' };
  }
  const sum = metrics.reduce(
    (acc, m) => ({ a: acc.a + m.a, b: acc.b + m.b }),
    { a: 0, b: 0 },
  );
  const avgA = round(sum.a / metrics.length);
  const avgB = round(sum.b / metrics.length);
  return { metrics, avgA, avgB, winner: winnerOf(avgA, avgB) };
}

export interface ComputeBattleInput {
  mode: VersusMode;
  /** Required when the mode includes face. */
  face?: Metric[];
  /** Required when the mode includes fit. */
  fit?: Metric[];
}

/**
 * Compare two contenders into a full verdict. Pure: same input → same output.
 *
 * - Per-modality winner = higher rounded average (within `TIE_BAND` = tie).
 * - `overall` averages the active modalities equally (face + fit for `both`).
 * - The headline `winner` is the overall winner.
 */
export function computeBattle(input: ComputeBattleInput): BattleVerdict {
  const includeFace = input.mode === 'face' || input.mode === 'both';
  const includeFit = input.mode === 'fit' || input.mode === 'both';

  const face = includeFace ? groupResult(input.face ?? []) : null;
  const fit = includeFit ? groupResult(input.fit ?? []) : null;

  const groups = [face, fit].filter((g): g is MetricGroupResult => g !== null);
  // Average the per-modality averages so face and fit weigh equally regardless
  // of how many metrics each carries.
  const avgA = groups.length ? round(groups.reduce((s, g) => s + g.avgA, 0) / groups.length) : 0;
  const avgB = groups.length ? round(groups.reduce((s, g) => s + g.avgB, 0) / groups.length) : 0;
  const winner = winnerOf(avgA, avgB);

  return { mode: input.mode, face, fit, overall: { avgA, avgB, winner }, winner };
}

/** A side's share of a metric track, 0–100 (A fills from the left). */
export function splitPercent(a: number, b: number): { a: number; b: number } {
  const total = a + b;
  if (total <= 0) return { a: 50, b: 50 };
  const pa = (a / total) * 100;
  return { a: pa, b: 100 - pa };
}
