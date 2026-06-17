// packages/shared/src/solo-scan/__fixtures__.ts
import { SOLO_SCAN_SCHEMA_VERSION } from './constants.ts';
import type { SoloScanAIOutput } from './schema.ts';

const r = (rating: number | null, confidence = 0.8, evidence = 'Visible in the image.') =>
  ({ rating, confidence, evidence });

/** A deterministic, schema-valid AI output for tests. */
export function sampleAIOutput(): SoloScanAIOutput {
  return {
    schemaVersion: SOLO_SCAN_SCHEMA_VERSION,
    inputQuality: {
      usable: true, faceUsable: true, outfitUsable: true,
      samePersonLikely: true, issues: [], retakeInstruction: null,
    },
    presentation: {
      gender: 'masc', genderConfidence: 0.9, expressionStrength: 70,
      recognizedIcon: null, recognizedConfidence: 0, recognizedKind: null,
    },
    faceAnalysis: {
      photoPresentation: r(78), faceHarmony: r(76), jawPresence: r(55),
      haircutMatch: r(78), groomingCoherence: r(74), visualPresence: r(80),
      mainCharacterEnergy: r(72),
    },
    outfitAnalysis: {
      fit: r(78), silhouette: r(55), proportions: r(52), colorCoherence: r(74),
      physiqueMatch: r(76), layering: r(58), accessories: r(null, 0.2),
      stylingIntent: r(75), overallCohesion: r(77),
    },
    faceCopy: {
      strongestPoint: 'The haircut frames the face cleanly.',
      improvement: 'A more direct angle would add presence.',
      summary: 'Strong base presentation with room for a sharper angle.',
    },
    outfitCopy: {
      works: 'The jacket adds structure through the shoulders.',
      hurts: 'The trouser break shortens the silhouette.',
      verdict: 'Good base, but the proportions can be sharper.',
    },
    contentSelection: {
      faceArchetypeCandidates: ['face_archetype.main_character'],
      outfitCaptionCandidates: ['outfit_caption.let_him_cook'],
      stickerCandidates: ['sticker.main_character'],
      contentTags: ['clean', 'structured'],
    },
    receiptContent: {
      metricCandidates: ['metric.lover_boy_probability'],
      punchlineCandidates: ['punchline.certified_lover_boy'],
    },
  };
}
