/**
 * Friend vs Friend — shared types for the head-to-head verdict.
 *
 * The whole feature is UI-first: scores are produced deterministically from a
 * seed (see `metrics.ts`) until the real model is wired. `computeBattle` is the
 * single place the comparison math lives — screens only render its output, and
 * the real model output drops in here later.
 */

/** Which modality the battle compares — face or fit (never both at once). */
export type VersusMode = 'face' | 'fit';

export const VERSUS_MODES: readonly VersusMode[] = ['face', 'fit'] as const;

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
  /** Present when the mode is `face`. */
  face: MetricGroupResult | null;
  /** Present when the mode is `fit`. */
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

/* ─── Real AI verdict (replaces the seeded placeholder) ─────────────────────
 * The model returns scores PLUS comparative copy in one call. `computeBattle`
 * over the scored `Metric[]` stays the single source of truth for who wins;
 * the copy below only dresses the math (see `assemble.ts`).
 */

/** A side's two copy lines for one modality — the flex and the burn. */
export interface SideCopy {
  /** The flex — the thing this side wins on. */
  superpower: string;
  /** The burn — the savage one-liner about this side. */
  roast: string;
}

/** One AI-invented "Who's more likely to ___" verdict crowned to a side. */
export interface Superlative {
  /** AI-invented, e.g. "Most likely to get a free drink". */
  label: string;
  /** Which side it crowns. */
  winner: Side;
  /** Exactly one true → the tap-to-reveal wildcard. */
  locked: boolean;
}

/** The comparative roast payload the AI returns alongside the scores. */
export interface VersusCopy {
  /** Headline punchline — reconciled to the computed winner (see assemble §5.3). */
  crown: { winner: BattleWinner; line: string };
  /** One line about the biggest-gap metric. */
  decisiveRead: string;
  /** Per-side, per-modality copy; a category is null when inactive for the mode. */
  sides: Record<Side, { face: SideCopy | null; fit: SideCopy | null }>;
  /** ~3 comparative superlatives, exactly one locked. */
  superlatives: Superlative[];
}

/** The stored verdict the result deck renders. */
export interface VersusResult {
  mode: VersusMode;
  /** Present when the mode includes face. */
  face: Metric[] | null;
  /** Present when the mode includes fit. */
  fit: Metric[] | null;
  copy: VersusCopy;
}
