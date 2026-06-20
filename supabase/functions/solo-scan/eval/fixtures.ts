import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';

/** A fully schema-valid Gemini output for tests. Pass overrides to vary fields. */
export function sampleAIOutput(over: Partial<SoloScanAIOutput> = {}): SoloScanAIOutput {
  const r = (rating: number, evidence: string) => ({ rating, confidence: 1, evidence });
  return {
    schemaVersion: 'solo_scan_v3_5',
    inputQuality: {
      usable: true,
      faceUsable: true,
      outfitUsable: true,
      samePersonLikely: null,
      issues: [],
      retakeInstruction: null,
    },
    presentation: {
      gender: 'masc',
      genderConfidence: 0.9,
      expressionStrength: 50,
      ageEstimate: 27,
      recognizedIcon: null,
      recognizedConfidence: 0,
      recognizedKind: null,
    },
    faceAnalysis: {
      photoPresentation: r(70, 'sharp'),
      faceHarmony: r(60, 'balanced'),
      jawPresence: r(80, 'strong'),
      haircutMatch: r(55, 'meh'),
      groomingCoherence: r(65, 'clean'),
      visualPresence: r(72, 'loud'),
      mainCharacterEnergy: r(77, 'yes'),
    },
    outfitAnalysis: {
      fit: r(64, 'tuck it'),
      silhouette: r(60, 'okay'),
      proportions: r(58, 'off'),
      colorCoherence: r(70, 'tonal'),
      physiqueMatch: r(62, 'fine'),
      layering: r(50, 'flat'),
      accessories: r(40, 'none'),
      stylingIntent: r(66, 'there'),
      overallCohesion: r(68, 'cohesive'),
    },
    faceCopy: {
      strongestPoint: 'JAWLINE LOADED',
      improvement: 'eyes asleep',
      summary: 'mid boss energy',
      verdictLine: { lead: 'JAW DID', punch: 'THE TALKING' },
    },
    outfitCopy: {
      works: 'tonal armor',
      hurts: 'shoes betrayed you',
      verdict: 'eats, leaves no crumbs',
      captionLine: 'quiet luxury loud ego',
    },
    outfitNameplate: {
      name: 'DENIM ARMORY',
      eyebrow: 'All-black streetwear',
      tagline: 'controlled chaos in cotton',
      lane: 'Streetwear',
      accentHex: '#3344ff',
      dossier: [{ label: 'Signature', value: 'Trucker jacket' }],
    },
    contentSelection: {
      faceArchetypeCandidates: ['face_archetype.goat'],
      outfitCaptionCandidates: ['outfit_caption.rizz'],
      stickerCandidates: ['sticker.aura'],
      contentTags: ['streetwear'],
    },
    receiptContent: {
      metricCandidates: ['metric.rizz'],
      punchlineCandidates: ['punchline.no_cap'],
      punchlineText: 'NO CAP DETECTED',
    },
    ...over,
  };
}
