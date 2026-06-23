/**
 * Friend vs Friend — shared types for the head-to-head verdict.
 *
 * The whole feature is UI-first: scores are produced deterministically from a
 * seed (see `metrics.ts`) until the real model is wired. `computeBattle` is the
 * single place the comparison math lives — screens only render its output, and
 * the real model output drops in here later.
 */

/** Which modalities the battle compares. `both` runs face + fit. */
export type VersusMode = 'face' | 'fit' | 'both';

export const VERSUS_MODES: readonly VersusMode[] = ['face', 'fit', 'both'] as const;

/** A is always the left/icy contender, B the right/magenta one. */
export type Side = 'a' | 'b';

/** A battle outcome for a side, or a dead heat. */
export type BattleWinner = Side | 'tie';

/** One compared dimension (e.g. "Skin"), with each side's 0–100 score. */
export interface Metric {
  /** Stable key, e.g. `skin`. */
  key: string;
  /** Display label, e.g. `Skin`. */
  label: string;
  /** Contender A's score, 0–100. */
  a: number;
  /** Contender B's score, 0–100. */
  b: number;
}

/** The compared result for one modality (face or fit). */
export interface MetricGroupResult {
  metrics: Metric[];
  /** Rounded average of A's metric scores. */
  avgA: number;
  /** Rounded average of B's metric scores. */
  avgB: number;
  winner: BattleWinner;
}

/** The full head-to-head verdict the result deck renders. */
export interface BattleVerdict {
  mode: VersusMode;
  /** Present when the mode includes face (`face` | `both`). */
  face: MetricGroupResult | null;
  /** Present when the mode includes fit (`fit` | `both`). */
  fit: MetricGroupResult | null;
  /** Combined averages across the active modalities. */
  overall: { avgA: number; avgB: number; winner: BattleWinner };
  /** The headline winner — equals `overall.winner`. */
  winner: BattleWinner;
}

/**
 * Tie band: averages within this many points (inclusive) read as a dead heat.
 * Scores are rounded integers, so a band of 1 means "0 or 1 apart = tie".
 */
export const TIE_BAND = 1;
