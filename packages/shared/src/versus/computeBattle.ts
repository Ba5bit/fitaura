import {
  TIE_BAND,
  type BattleVerdict,
  type BattleWinner,
  type Metric,
  type MetricGroupResult,
  type Side,
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

/** The strict per-metric leader (no tie band — a single point decides a read). */
export function metricLeader(m: Metric): Side | null {
  return m.a > m.b ? 'a' : m.b > m.a ? 'b' : null;
}

/** One decisive read, tagged with the modality it came from. */
export interface CategoryRead {
  category: 'face' | 'fit';
  metric: Metric;
  leader: Side;
}

/** The derived stats the v2 verdict breakdown renders. */
export interface BattleSummary {
  /** |overall.avgA − avgB|. */
  marginPts: number;
  /** Human label for the margin (e.g. "By a hair"). */
  marginLabel: string;
  /** Categories (face/fit) each side won. */
  categoriesA: number;
  categoriesB: number;
  /** Number of active categories (1 for face/fit, 2 for both). */
  categoryCount: number;
  /** Metrics each side led, and the total compared. */
  metricsWonA: number;
  metricsWonB: number;
  metricsTotal: number;
  /** Most decisive reads (largest gap first), capped at 4. */
  topReads: CategoryRead[];
}

/** Derive the head-to-head breakdown stats from a computed verdict. */
export function summarizeBattle(v: BattleVerdict): BattleSummary {
  const groups: { category: 'face' | 'fit'; g: MetricGroupResult }[] = [];
  if (v.face) groups.push({ category: 'face', g: v.face });
  if (v.fit) groups.push({ category: 'fit', g: v.fit });

  let categoriesA = 0;
  let categoriesB = 0;
  let metricsWonA = 0;
  let metricsWonB = 0;
  let metricsTotal = 0;
  const reads: CategoryRead[] = [];

  for (const { category, g } of groups) {
    if (g.winner === 'a') categoriesA++;
    else if (g.winner === 'b') categoriesB++;
    for (const m of g.metrics) {
      metricsTotal++;
      const ld = metricLeader(m);
      if (ld === 'a') metricsWonA++;
      else if (ld === 'b') metricsWonB++;
      if (ld) reads.push({ category, metric: m, leader: ld });
    }
  }

  const marginPts = Math.abs(v.overall.avgA - v.overall.avgB);
  const marginLabel =
    marginPts === 0 ? 'Dead heat'
    : marginPts <= 1 ? 'By a hair'
    : marginPts <= 4 ? 'Close call'
    : marginPts <= 9 ? 'Clear win'
    : 'Blowout';

  const topReads = [...reads]
    .sort((x, y) => Math.abs(y.metric.a - y.metric.b) - Math.abs(x.metric.a - x.metric.b))
    .slice(0, 4);

  return {
    marginPts,
    marginLabel,
    categoriesA,
    categoriesB,
    categoryCount: groups.length,
    metricsWonA,
    metricsWonB,
    metricsTotal,
    topReads,
  };
}
