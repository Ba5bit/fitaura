// packages/shared/src/solo-scan/schema.ts
// Shared rubric / presentation primitives + category keys, reused by the v4
// generation contract (see ./v4/schema.ts).
import { z } from 'zod';

/** One bounded rubric rating: a 0–100 score, or null when not assessable. */
export const rubricRatingSchema = z.object({
  rating: z.number().int().min(0).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(400),
});
export type RubricRating = z.infer<typeof rubricRatingSchema>;

/** Apparent gender presentation + icon recognition. Entertainment styling read,
 * NOT an identity claim. */
export const presentationSchema = z.object({
  gender: z.enum(['femme', 'masc', 'unsure']),
  genderConfidence: z.number().min(0).max(1),
  expressionStrength: z.number().int().min(0).max(100), // masc/fem index; display-only
  ageEstimate: z.number().int().min(0).max(120).nullable(), // apparent age, entertainment-only
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

/** Face/outfit rubric category keys — single source of truth for the analysis blocks. */
export const FACE_KEYS = [
  'photoPresentation', 'faceHarmony', 'jawPresence', 'haircutMatch',
  'groomingCoherence', 'visualPresence', 'mainCharacterEnergy',
] as const;
export const OUTFIT_KEYS = [
  'fit', 'silhouette', 'proportions', 'colorCoherence', 'physiqueMatch',
  'layering', 'accessories', 'stylingIntent', 'overallCohesion',
] as const;
