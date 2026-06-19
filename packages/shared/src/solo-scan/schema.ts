// packages/shared/src/solo-scan/schema.ts
import { z } from 'zod';
import { SOLO_SCAN_SCHEMA_VERSION } from './constants.ts';

/** One bounded rubric rating (rules doc §5, v2): a 0–100 score, or null when not assessable. */
export const rubricRatingSchema = z.object({
  rating: z.number().int().min(0).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(400),
});
export type RubricRating = z.infer<typeof rubricRatingSchema>;

/** Apparent gender presentation + icon recognition (rules doc §, v3).
 * Entertainment styling read, NOT an identity claim. */
export const presentationSchema = z.object({
  gender: z.enum(['femme', 'masc', 'unsure']),
  genderConfidence: z.number().min(0).max(1),
  expressionStrength: z.number().int().min(0).max(100), // masc/fem index; display-only
  ageEstimate: z.number().int().min(0).max(120).nullable(), // apparent age (y.o.), entertainment-only; null if not assessable
  recognizedIcon: z.string().max(60).nullable(),
  recognizedConfidence: z.number().min(0).max(1),
  recognizedKind: z.enum(['meme', 'real_person']).nullable(), // meme/fictional vs real public figure
});
export type Presentation = z.infer<typeof presentationSchema>;

export const inputIssueSchema = z.enum([
  'face_missing', 'multiple_faces', 'face_too_small', 'face_obscured',
  'face_blurry', 'face_low_light', 'outfit_missing', 'outfit_too_cropped',
  'outfit_obscured', 'outfit_blurry', 'outfit_low_light',
  'different_people_suspected', 'unsupported_content', 'other',
]);
export type InputIssue = z.infer<typeof inputIssueSchema>;

// These are candidate POOLS the backend picks ONE from (see assemble.ts pick*).
// Gemini routinely returns the entire allowlist (15-21 ids) instead of a few, so a
// tight cap here rejects an otherwise-perfect scan with schema_invalid -> 502. Extra
// candidates are harmless (the picker selects one), so keep this generous.
const candidates = z.array(z.string().max(80)).max(64);

export const soloScanSchema = z
  .object({
    schemaVersion: z.literal(SOLO_SCAN_SCHEMA_VERSION),
    inputQuality: z.object({
      usable: z.boolean(),
      faceUsable: z.boolean(),
      outfitUsable: z.boolean(),
      samePersonLikely: z.boolean().nullable(),
      issues: z.array(inputIssueSchema).max(14),
      retakeInstruction: z.string().max(300).nullable(),
    }),
    presentation: presentationSchema,
    faceAnalysis: z.object({
      photoPresentation: rubricRatingSchema,
      faceHarmony: rubricRatingSchema,
      jawPresence: rubricRatingSchema,
      haircutMatch: rubricRatingSchema,
      groomingCoherence: rubricRatingSchema,
      visualPresence: rubricRatingSchema,
      mainCharacterEnergy: rubricRatingSchema,
    }),
    outfitAnalysis: z.object({
      fit: rubricRatingSchema,
      silhouette: rubricRatingSchema,
      proportions: rubricRatingSchema,
      colorCoherence: rubricRatingSchema,
      physiqueMatch: rubricRatingSchema,
      layering: rubricRatingSchema,
      accessories: rubricRatingSchema,
      stylingIntent: rubricRatingSchema,
      overallCohesion: rubricRatingSchema,
    }),
    faceCopy: z.object({
      strongestPoint: z.string().max(200),
      improvement: z.string().max(200),
      summary: z.string().max(200),
      verdictLine: z.object({ lead: z.string().max(40), punch: z.string().max(40) }),
    }),
    outfitCopy: z.object({
      works: z.string().max(200),
      hurts: z.string().max(200),
      verdict: z.string().max(200),
      captionLine: z.string().max(80),
    }),
    outfitNameplate: z.object({
      name: z.string().max(40),
      eyebrow: z.string().max(60),
      tagline: z.string().max(80),
      lane: z.string().max(24),
      accentHex: z.string().max(9),
      dossier: z.array(z.object({ label: z.string().max(20), value: z.string().max(28) })),
    }),
    contentSelection: z.object({
      faceArchetypeCandidates: candidates,
      outfitCaptionCandidates: candidates,
      stickerCandidates: candidates,
      contentTags: candidates,
    }),
    receiptContent: z.object({
      metricCandidates: candidates,
      punchlineCandidates: candidates,
      punchlineText: z.string().max(80),
    }),
  })
  .superRefine((val, ctx) => {
    if (!val.inputQuality.usable && val.inputQuality.retakeInstruction === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inputQuality', 'retakeInstruction'],
        message: 'retakeInstruction is required when usable is false',
      });
    }
  });

export type SoloScanAIOutput = z.infer<typeof soloScanSchema>;

/** Face/outfit rubric category keys, reused by scoring + assembly. */
export const FACE_KEYS = [
  'photoPresentation', 'faceHarmony', 'jawPresence', 'haircutMatch',
  'groomingCoherence', 'visualPresence', 'mainCharacterEnergy',
] as const;
export const OUTFIT_KEYS = [
  'fit', 'silhouette', 'proportions', 'colorCoherence', 'physiqueMatch',
  'layering', 'accessories', 'stylingIntent', 'overallCohesion',
] as const;
