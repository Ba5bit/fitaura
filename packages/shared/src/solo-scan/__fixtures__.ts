// packages/shared/src/solo-scan/__fixtures__.ts
import type { SoloScanAIOutput } from './schema';

const r = (rating: number | null, confidence = 0.8, evidence = 'Visible in the image.') =>
  ({ rating, confidence, evidence });

/** A deterministic, schema-valid AI output for tests. */
export function sampleAIOutput(): SoloScanAIOutput {
  return {
    schemaVersion: 'solo_scan_v1',
    inputQuality: {
      usable: true, faceUsable: true, outfitUsable: true,
      samePersonLikely: true, issues: [], retakeInstruction: null,
    },
    faceAnalysis: {
      photoPresentation: r(4), faceHarmony: r(4), jawPresence: r(3),
      haircutMatch: r(4), groomingCoherence: r(4), visualPresence: r(4),
      mainCharacterEnergy: r(4),
    },
    outfitAnalysis: {
      fit: r(4), silhouette: r(3), proportions: r(3), colorCoherence: r(4),
      physiqueMatch: r(4), layering: r(3), accessories: r(null, 0.2),
      stylingIntent: r(4), overallCohesion: r(4),
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
      faceArchetypeCandidates: ['face_archetype.main_character_intern'],
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
