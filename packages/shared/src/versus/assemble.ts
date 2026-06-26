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
import type { Metric, VerdictRead, VersusMode, VersusResult } from './schema.ts';
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
 * Keep only reads that point at an ACTIVE-modality metric key, drop duplicate
 * keys (first wins), and cap the count. The numbers are derived later from the
 * metric, so this only validates the AI's title/framing payload. Returns a new
 * array. `deriveReads` (schema.ts consumers) fills in any gaps from the metrics.
 */
function shapeReads(reads: VerdictRead[], mode: VersusMode): VerdictRead[] {
  const defs = mode === 'face' ? FACE_METRICS : FIT_METRICS;
  const active = new Set(defs.map((d) => d.key));
  const seen = new Set<string>();
  const out: VerdictRead[] = [];
  for (const r of reads) {
    if (!active.has(r.metricKey) || seen.has(r.metricKey)) continue;
    seen.add(r.metricKey);
    out.push({ metricKey: r.metricKey, title: r.title, flex: r.flex, reason: r.reason });
  }
  return out;
}

/**
 * Validate, map, compute, reconcile. Throws on unrecoverable input (missing or
 * out-of-range active-category scores) — the edge function treats a throw as a
 * hard failure and refunds the battle.
 */
export function shapeVersusResult(ai: VersusAIResult, meta: ShapeMeta): VersusResult {
  const includeFace = meta.mode === 'face';
  const includeFit = meta.mode === 'fit';

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

  const reads = shapeReads(ai.reads, meta.mode);

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
      reads,
    },
  };
}
