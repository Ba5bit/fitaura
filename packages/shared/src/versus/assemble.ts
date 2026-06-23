// packages/shared/src/versus/assemble.ts
//
// Turn the raw comparative AI result into the stored `VersusResult` the deck
// renders. `computeBattle` over the scored `Metric[]` is the SINGLE SOURCE OF
// TRUTH for who wins — this module maps the AI scores into metrics, runs the
// math, and reconciles the AI's crown to it (spec §5.3) so the headline can
// never contradict the numbers on the card. Unrecoverable input (missing or
// out-of-range active-category scores) throws so the edge function treats it as
// a hard failure and refunds.
import { computeBattle } from './computeBattle.ts';
import { FACE_METRICS, FIT_METRICS } from './metrics.ts';
import type { Metric, Superlative, VersusMode, VersusResult } from './schema.ts';
import type { VersusAIResult } from './aiSchema.ts';

interface ShapeMeta {
  mode: VersusMode;
  battleId: string;
}

/** Build display name for the computed winner used in the templated crown fallback. */
const CROWN_FALLBACK: Record<'a' | 'b' | 'tie', string> = {
  a: 'A takes the crown.',
  b: 'B takes the crown.',
  tie: 'Dead heat — nobody blinked.',
};

/**
 * Map an AI score block (keyed by metric key) to `Metric[]`, pulling labels from
 * the canonical metric defs. Throws when a key is missing or a score is out of
 * the integer 0-100 range — the zod schema already guards a well-formed payload,
 * this is the assemble-time backstop for the active categories.
 */
function toMetrics(
  defs: ReadonlyArray<{ key: string; label: string }>,
  block: Record<string, { a: number; b: number }> | undefined,
): Metric[] {
  if (!block) throw new Error('versus_missing_scores');
  return defs.map((d) => {
    const pair = block[d.key];
    if (!pair) throw new Error(`versus_missing_metric:${d.key}`);
    for (const v of [pair.a, pair.b]) {
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        throw new Error(`versus_score_out_of_range:${d.key}`);
      }
    }
    return { key: d.key, label: d.label, a: pair.a, b: pair.b };
  });
}

/**
 * Ensure exactly one superlative is `locked`. If none/multiple are flagged, the
 * LAST one becomes the wildcard and the rest are unlocked. Returns a new array.
 */
function coerceOneLocked(superlatives: Superlative[]): Superlative[] {
  if (superlatives.length === 0) return superlatives;
  const lockedCount = superlatives.filter((s) => s.locked).length;
  if (lockedCount === 1) return superlatives.map((s) => ({ ...s }));
  const lastIndex = superlatives.length - 1;
  return superlatives.map((s, i) => ({ ...s, locked: i === lastIndex }));
}

/**
 * Validate, map, compute, reconcile. Throws on unrecoverable input (missing or
 * out-of-range active-category scores) — the edge function treats a throw as a
 * hard failure and refunds the battle.
 */
export function shapeVersusResult(ai: VersusAIResult, meta: ShapeMeta): VersusResult {
  const includeFace = meta.mode === 'face' || meta.mode === 'both';
  const includeFit = meta.mode === 'fit' || meta.mode === 'both';

  const face = includeFace ? toMetrics(FACE_METRICS, ai.scores.face) : null;
  const fit = includeFit ? toMetrics(FIT_METRICS, ai.scores.fit) : null;

  // computeBattle is the authoritative winner.
  const battle = computeBattle({
    mode: meta.mode,
    face: face ?? undefined,
    fit: fit ?? undefined,
  });

  // Reconcile the crown (§5.3): keep the AI line only when its winner matches
  // the computed winner; otherwise fall back to a templated line keyed to the math.
  const crown =
    ai.crown.winner === battle.winner
      ? { winner: battle.winner, line: ai.crown.line }
      : { winner: battle.winner, line: CROWN_FALLBACK[battle.winner] };

  const superlatives = coerceOneLocked(ai.superlatives);

  return {
    mode: meta.mode,
    face,
    fit,
    copy: {
      crown,
      decisiveRead: ai.decisiveRead,
      sides: {
        a: { face: ai.sides.a.face, fit: ai.sides.a.fit },
        b: { face: ai.sides.b.face, fit: ai.sides.b.fit },
      },
      superlatives,
    },
  };
}
