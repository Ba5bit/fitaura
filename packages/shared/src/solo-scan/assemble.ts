// packages/shared/src/solo-scan/assemble.ts
import type {
  FullGenerationResult, ScoreItem, FaceTrait, SupportingStat, ReceiptRow, OutfitNameplate,
} from '../result.ts';
import type { ScanParts } from '../result.ts';
import { STICKER_BANK, stickerFromPreset } from '../sticker-bank.ts';
import { VERDICT_LABEL } from '../verdict.ts';
import type { SoloScanAIOutput, RubricRating } from './schema.ts';
import {
  scoreFromRating, faceScore, outfitScore, auraIndex, displayScore, percent, pickVerdict,
  biasFactor, applyScoreBias, isMemeGlory, applyGloryFloor,
} from './scoring.ts';
import { pickFaceArchetype, pickOutfitCaption, pickPunchline, scoreBand } from './content-bank.ts';
import { scrubName } from './copyFilter.ts';
import { clampAccent } from './accent.ts';

/** Display value for a rubric category that is null (not assessable). */
const UNSCORED_DISPLAY = 50;
/** Playful multiplier turning the Aura Index into the receipt's "Aura Gained"
 * flavor number (e.g. aura 70 → +240), matching the scale of the original mock. */
const AURA_GAIN_SCALE = 12;

const descriptorFor = (score: number | null): string => {
  if (score == null) return '—';
  if (score >= 85) return 'Elite';
  if (score >= 68) return 'Strong';
  if (score >= 45) return 'Even';
  if (score >= 25) return 'Soft';
  return 'Off';
};

function faceStickerById(id: string) {
  return stickerFromPreset(STICKER_BANK.face.find((s) => s.id === id) ?? STICKER_BANK.face[0]);
}
function outfitStickerById(id: string) {
  return stickerFromPreset(STICKER_BANK.outfit.find((s) => s.id === id) ?? STICKER_BANK.outfit[0]);
}

const score = (id: string, label: string, value: number, hot = false): ScoreItem => ({ id, label, value, hot });

/** Generation id like "0xA73F" derived deterministically from the scan id. */
function genId(scanId: string): string {
  let h = 0;
  for (let i = 0; i < scanId.length; i++) h = (h * 31 + scanId.charCodeAt(i)) >>> 0;
  return '0x' + (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Turn the AI rubric into a fully-rendered FullGenerationResult.
 * Throws Error('insufficient_signal') when a PROVIDED modality cannot be scored.
 */
export function assembleResult(
  ai: SoloScanAIOutput,
  scanId: string,
  promptVersion: string,
  parts: ScanParts,
): FullGenerationResult {
  const factor = biasFactor(ai.presentation);
  const glory = isMemeGlory(ai.presentation);
  let b = applyScoreBias(ai, factor);
  if (glory) b = applyGloryFloor(b, scanId);
  const confidentlyFemme = ai.presentation.gender === 'femme'
    && ai.presentation.genderConfidence >= 0.60;
  const contentGender = confidentlyFemme ? 'femme' : 'masc';

  const face = parts.face ? faceScore(b) : null;
  const outfit = parts.outfit ? outfitScore(b) : null;
  if ((parts.face && face == null) || (parts.outfit && outfit == null)) {
    throw new Error('insufficient_signal');
  }

  const aura = auraIndex(b, { face, outfit }, parts);
  const verdict = pickVerdict(aura, scanId);
  const band = scoreBand(aura);
  const iconName = ai.presentation.recognizedIcon;
  const d = (s: number, key: string) => displayScore(s, scanId, key, promptVersion);

  // Card headlines come from the written archetype/caption/punchline bank. The AI's
  // "grounded" line tends to narrate the photo ("WHITE TOP, PURPLE LIGHTS") rather
  // than land a verdict, so the bank owns the punchy lines; AI prose stays in the
  // analysis block only.
  const punchline = pickPunchline(glory ? undefined : ai.receiptContent.punchlineCandidates, band, scanId, contentGender);

  const fa = b.faceAnalysis;
  const oa = b.outfitAnalysis;
  const sc = (r: RubricRating, key: string) => d(scoreFromRating(r.rating) ?? UNSCORED_DISPLAY, key);

  /* ---- Face (only when provided) ---- */
  let faceResult = null as FullGenerationResult['face'];
  if (parts.face) {
    const archetype = pickFaceArchetype(glory ? undefined : ai.contentSelection.faceArchetypeCandidates, band, scanId, contentGender);
    // Headline = banked archetype line (see note above); AI verdictLine is unused here.
    const verdictLine: [string, string] = archetype.line;
    const faceCard = {
      imageUrl: null,
      eyebrow: 'FACE VERDICT',
      verdict: verdictLine,
      index: `AURA INDEX ${aura}`,
      scores: [
        score('aura', 'Aura', aura),
        // Apparent age (display-only, no bar) takes the card's 2nd slot; Haircut
        // Match still appears in the score breakdown below.
        {
          id: 'age', label: 'Est. Age', value: ai.presentation.ageEstimate ?? 0,
          displayValue: ai.presentation.ageEstimate != null ? `${ai.presentation.ageEstimate} y.o.` : '—',
          noBar: true,
        },
        score('gender-index', confidentlyFemme ? 'Femininity' : 'Masculinity',
          d(ai.presentation.expressionStrength, 'gender-index')),
        score('main-character', 'Main Character', sc(fa.mainCharacterEnergy, 'mainchar'), true),
      ],
      sticker: faceStickerById(archetype.stickerId),
    };
    const faceTraits: FaceTrait[] = [
      { id: 'jaw', label: 'Jaw Presence', value: sc(fa.jawPresence, 'jaw'), descriptor: descriptorFor(fa.jawPresence.rating), icon: 'jaw' },
      { id: 'harmony', label: 'Face Harmony', value: sc(fa.faceHarmony, 'harmony'), descriptor: descriptorFor(fa.faceHarmony.rating), icon: 'harmony' },
      { id: 'presence', label: 'Visual Presence', value: sc(fa.visualPresence, 'presence'), descriptor: descriptorFor(fa.visualPresence.rating), icon: 'eye' },
      { id: 'haircut', label: 'Haircut Match', value: sc(fa.haircutMatch, 'haircut'), descriptor: descriptorFor(fa.haircutMatch.rating), icon: 'brow' },
      { id: 'grooming', label: 'Grooming', value: sc(fa.groomingCoherence, 'grooming'), descriptor: descriptorFor(fa.groomingCoherence.rating), icon: 'beard' },
      { id: 'main-character', label: 'Main Character', value: sc(fa.mainCharacterEnergy, 'mainchar'), descriptor: descriptorFor(fa.mainCharacterEnergy.rating), icon: 'star' },
    ];
    faceResult = { card: faceCard, analysis: { aura, explanation: ai.faceCopy.summary, roast: ai.faceCopy.improvement, breakdown: faceTraits } };
  }

  /* ---- Outfit (only when provided) ---- */
  let outfitResult = null as FullGenerationResult['outfit'];
  if (parts.outfit) {
    const caption = pickOutfitCaption(glory ? undefined : ai.contentSelection.outfitCaptionCandidates, band, scanId, contentGender);
    const captionText = caption.caption;
    const npAI = ai.outfitNameplate;
    const nameplate: OutfitNameplate = {
      name: npAI.name,
      eyebrow: npAI.eyebrow,
      tagline: npAI.tagline,
      lane: npAI.lane,
      accent: clampAccent(npAI.accentHex, contentGender),
      dossier: npAI.dossier.slice(0, 4).map((row) => ({ label: row.label, value: row.value })),
    };
    const outfitCard = {
      imageUrl: null,
      caption: captionText,
      overallScore: d(outfit as number, 'outfit-overall'),
      scores: [
        { id: 'silhouette', label: 'Silhouette', value: sc(oa.silhouette, 'silhouette'), note: oa.silhouette.evidence },
        { id: 'proportions', label: 'Proportions', value: sc(oa.proportions, 'proportions'), note: oa.proportions.evidence },
        { id: 'fit', label: 'Fit', value: sc(oa.fit, 'fit'), note: oa.fit.evidence },
        { id: 'physique-match', label: 'Physique Match', value: sc(oa.physiqueMatch, 'physique'), note: oa.physiqueMatch.evidence },
      ],
      sticker: outfitStickerById(caption.stickerId),
      nameplate,
    };
    const supportingDefs: Array<{ id: string; label: string; r: RubricRating; key: string }> = [
      { id: 'color-story', label: 'Color Story', r: oa.colorCoherence, key: 'color' },
      { id: 'layering', label: 'Layering', r: oa.layering, key: 'layering' },
      { id: 'styling-intent', label: 'Styling Intent', r: oa.stylingIntent, key: 'styling' },
      { id: 'overall-cohesion', label: 'Overall Cohesion', r: oa.overallCohesion, key: 'cohesion' },
      { id: 'accessories', label: 'Accessories', r: oa.accessories, key: 'accessories' },
    ];
    const supporting: SupportingStat[] = supportingDefs
      .filter((s) => s.r.rating != null)
      .slice(0, 4)
      .map((s) => ({ id: s.id, label: s.label, value: d(scoreFromRating(s.r.rating)!, s.key), note: s.r.evidence }));
    const assessed = supportingDefs.filter((s) => s.r.rating != null);
    const sorted = [...assessed].sort((a, b2) => (b2.r.rating! - a.r.rating!));
    const tags = sorted.length >= 2
      ? [
          { label: `${sorted[0].label.toLowerCase()} on point`, tone: 'good' as const },
          { label: `${sorted[sorted.length - 1].label.toLowerCase()} needs work`, tone: 'bad' as const },
        ]
      : [{ label: 'clean fit', tone: 'good' as const }];
    outfitResult = {
      card: outfitCard,
      analysis: { explanation: ai.outfitCopy.works, works: ai.outfitCopy.works, hurts: ai.outfitCopy.hurts, verdict: ai.outfitCopy.verdict, tags, supporting },
    };
  }

  /* ---- Receipt (always) ---- */
  const datingScore = Math.round(aura) / 10;
  const auraValue = Math.round((aura - 50) * AURA_GAIN_SCALE);
  const goodTone = verdict === 'green_flag';
  const rows: ReceiptRow[] = [
    { id: 'dating-score', label: 'Dating Score', value: `${datingScore.toFixed(1)} / 10`, tone: goodTone ? 'good' : 'default' },
    { id: 'aura-gained', label: 'Aura Gained', value: `${auraValue >= 0 ? '+' : ''}${auraValue}`, tone: auraValue >= 0 ? 'good' : 'default' },
    { id: 'lover-boy', label: contentGender === 'femme' ? 'Heartbreaker Prob.' : 'Lover-Boy Prob.', value: `${percent(scanId, 'loverboy', verdict === 'green_flag' ? 84 : 48)}%`, tone: goodTone ? 'good' : 'default' },
    { id: 'ghosting', label: 'Ghosting Potential', value: `${percent(scanId, 'ghost', verdict === 'red_flag' ? 72 : 34)}%`, tone: verdict === 'red_flag' ? 'hi' : 'default' },
  ];
  if (parts.face) {
    rows.push({ id: 'main-char', label: 'Main-Char Energy', value: `${percent(scanId, 'mce', scoreFromRating(fa.mainCharacterEnergy.rating) ?? 50)}%`, tone: 'default' });
  }

  const faceSummary = parts.face ? scrubName(ai.faceCopy.summary, iconName) : '';
  const outfitSummary = parts.outfit ? scrubName(ai.outfitCopy.verdict, iconName) : '';
  const summary = [faceSummary, outfitSummary].filter(Boolean).join(' ').trim();

  return {
    verdict,
    chip: `VERDICT · ${VERDICT_LABEL[verdict]}`,
    gender: contentGender,
    parts,
    face: faceResult,
    outfit: outfitResult,
    receipt: {
      generationId: genId(scanId),
      generatedAt: new Date().toISOString(),
      datingScore,
      auraValue,
      rows,
      datingVerdict: verdict,
      finalPunchline: punchline,
      stamp: ['FITAURA', 'VERIFIED'],
      summary,
    },
  };
}
