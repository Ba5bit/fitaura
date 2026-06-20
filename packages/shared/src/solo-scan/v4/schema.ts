// packages/shared/src/solo-scan/v4/schema.ts
//
// v4 generation contract: 3.5 OWNS the result. Unlike v3.5 (where the AI nominated
// bank IDs and the backend selected the headline/caption/punchline), here the model
// writes the final, photo-grounded content directly. The backend only validates,
// averages the category ratings into the Aura/Dating numbers, and applies the
// recognized-persona override. No banks, no bias/glory/jitter.
import { z } from 'zod';
import { rubricRatingSchema, presentationSchema, inputIssueSchema, FACE_KEYS, OUTFIT_KEYS } from '../schema.ts';

export const SOLO_SCAN_V4_SCHEMA_VERSION = 'solo_scan_v4' as const;

/** A per-category rating block built from the canonical key list. */
const analysisOf = (keys: readonly string[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, rubricRatingSchema])));

/** The Nameplate block (unchanged from v3.5 — flatters the fit, not the wearer). */
const nameplateSchema = z.object({
  name: z.string().max(40),
  eyebrow: z.string().max(60),
  tagline: z.string().max(80),
  lane: z.string().max(24),
  accentHex: z.string().max(9),
  dossier: z.array(z.object({ label: z.string().max(20), value: z.string().max(28) })).max(4),
});

export const soloScanV4Schema = z
  .object({
    schemaVersion: z.literal(SOLO_SCAN_V4_SCHEMA_VERSION),
    inputQuality: z.object({
      usable: z.boolean(),
      faceUsable: z.boolean(),
      outfitUsable: z.boolean(),
      samePersonLikely: z.boolean().nullable(),
      issues: z.array(inputIssueSchema).max(14),
      retakeInstruction: z.string().max(300).nullable(),
    }),
    presentation: presentationSchema,
    // The AI picks the categorical dating verdict DIRECTLY (no band-from-aura math).
    verdict: z.enum(['green_flag', 'normie', 'red_flag']),
    // Category ratings stay — they drive the breakdown bars and the averaged Aura.
    faceAnalysis: analysisOf(FACE_KEYS),
    outfitAnalysis: analysisOf(OUTFIT_KEYS),
    // FACE — the model writes the headline fresh and picks a sticker by id.
    face: z.object({
      headline: z.object({ lead: z.string().max(24), punch: z.string().max(24) }),
      stickerId: z.string().max(40),
      strongest: z.string().max(200),
      roast: z.string().max(200),
      summary: z.string().max(200),
    }),
    // OUTFIT — caption written fresh, sticker by id, nameplate, analysis copy.
    outfit: z.object({
      caption: z.string().max(48),
      stickerId: z.string().max(40),
      nameplate: nameplateSchema,
      works: z.string().max(200),
      hurts: z.string().max(200),
      verdict: z.string().max(200),
    }),
    // RECEIPT — the final viral punchline, written fresh.
    receipt: z.object({
      punchline: z.string().max(48),
      summary: z.string().max(200),
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

export type SoloScanV4Output = z.infer<typeof soloScanV4Schema>;
