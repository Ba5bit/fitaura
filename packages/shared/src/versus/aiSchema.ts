// packages/shared/src/versus/aiSchema.ts
//
// Zod contract for the RAW comparative Gemini result (one call sees both
// contenders). The model owns the scores + all the roast copy; `assemble.ts`
// validates the active categories, maps scores to `Metric[]`, runs
// `computeBattle` for the authoritative winner, and reconciles the crown.
//
// Both score categories are OPTIONAL at the schema level — single-mode scans
// (face-only / fit-only) carry only the active block. `assemble.ts` enforces
// that the mode's active categories are actually present.
import { z } from 'zod';
import { FACE_METRICS, FIT_METRICS } from './metrics.ts';

export const VERSUS_SCHEMA_VERSION = 'versus_v1' as const;

/** Clamp an over-long string to fit instead of rejecting the whole payload.
 * The Gemini responseSchema carries no maxLength, so on real photos the model
 * occasionally writes copy past these caps; trimming to fit keeps the verdict
 * rather than failing the battle with schema_invalid (the "battle hiccup"). */
const clamped = (max: number) =>
  z.string().transform((s) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s));

/** One metric's head-to-head pair: integer 0-100 for each side. */
const sideScoreSchema = z.object({
  a: z.number().int().min(0).max(100),
  b: z.number().int().min(0).max(100),
});

/** A per-category score block keyed by the canonical metric keys. */
const scoresOf = (defs: ReadonlyArray<{ key: string }>) =>
  z.object(Object.fromEntries(defs.map((d) => [d.key, sideScoreSchema])));

/** A side's copy for one modality, or null when the modality is inactive. */
const sideCopySchema = z
  .object({
    superpower: clamped(200),
    roast: clamped(200),
  })
  .nullable();

export const versusAiResultSchema = z.object({
  scores: z.object({
    face: scoresOf(FACE_METRICS).optional(),
    fit: scoresOf(FIT_METRICS).optional(),
  }),
  crown: z.object({
    winner: z.enum(['a', 'b', 'tie']),
    line: clamped(160),
  }),
  decisiveRead: clamped(200),
  sides: z.object({
    a: z.object({ face: sideCopySchema, fit: sideCopySchema }),
    b: z.object({ face: sideCopySchema, fit: sideCopySchema }),
  }),
  reads: z
    .array(
      z.object({
        metricKey: z.string(),
        title: clamped(80),
        flex: z.boolean(),
        reason: clamped(180), // full human sentence, no numbers
      }),
    )
    .max(8),
});

export type VersusAIResult = z.infer<typeof versusAiResultSchema>;
