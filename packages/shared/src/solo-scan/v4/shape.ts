// packages/shared/src/solo-scan/v4/shape.ts
//
// Turn the AI-owned v4 output into the rendered FullGenerationResult. This replaces
// assemble.ts's bank-picking + bias/jitter machinery with: average the ratings into
// the Aura number, use the model's own headlines/caption/punchline, pick the sticker
// the model chose, and apply the recognized-persona override (locks score + verdict).
import type {
  FullGenerationResult, ScoreItem, FaceTrait, SupportingStat, ReceiptRow, OutfitNameplate, ScanParts,
} from '../../result.ts';
import { STICKER_BANK, stickerFromPreset } from '../../sticker-bank.ts';
import { VERDICT_LABEL } from '../../verdict.ts';
import { clampAccent } from '../accent.ts';
import { scrubName } from '../copyFilter.ts';
import { FACE_KEYS, OUTFIT_KEYS } from '../schema.ts';
import type { SoloScanV4Output } from './schema.ts';
import { findPersona } from './personas.ts';

const AURA_GAIN_SCALE = 12;
const UNSCORED_DISPLAY = 50;

const descriptorFor = (s: number | null): string => {
  if (s == null) return '—';
  if (s >= 85) return 'Elite';
  if (s >= 68) return 'Strong';
  if (s >= 45) return 'Even';
  if (s >= 25) return 'Soft';
  return 'Off';
};

const score = (id: string, label: string, value: number, hot = false): ScoreItem => ({ id, label, value, hot });

/** Mean of the non-null ratings, or null when none are scorable. */
function mean(ratings: Array<number | null>): number | null {
  const v = ratings.filter((r): r is number => r != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

function pickSticker(kind: 'face' | 'outfit', id: string) {
  return stickerFromPreset(STICKER_BANK[kind].find((s) => s.id === id) ?? STICKER_BANK[kind][0]);
}

function genId(scanId: string): string {
  let h = 0;
  for (let i = 0; i < scanId.length; i++) h = (h * 31 + scanId.charCodeAt(i)) >>> 0;
  return '0x' + (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Build the rendered result from v4 AI output.
 * Throws Error('insufficient_signal') when a PROVIDED modality cannot be scored.
 */
export function shapeV4Result(ai: SoloScanV4Output, scanId: string, parts: ScanParts): FullGenerationResult {
  const confidentlyFemme = ai.presentation.gender === 'femme' && ai.presentation.genderConfidence >= 0.6;
  const contentGender: 'femme' | 'masc' = confidentlyFemme ? 'femme' : 'masc';

  const faceMean = parts.face ? mean(FACE_KEYS.map((k) => ai.faceAnalysis[k].rating)) : null;
  const outfitMean = parts.outfit ? mean(OUTFIT_KEYS.map((k) => ai.outfitAnalysis[k].rating)) : null;
  if ((parts.face && faceMean == null) || (parts.outfit && outfitMean == null)) {
    throw new Error('insufficient_signal');
  }

  // Aura = mean of the provided modalities; a recognized persona LOCKS it.
  const provided = [faceMean, outfitMean].filter((n): n is number => n != null);
  const computedAura = provided.length ? Math.round(provided.reduce((a, b) => a + b, 0) / provided.length) : UNSCORED_DISPLAY;
  const persona = findPersona(ai.presentation.recognizedIcon, ai.presentation.recognizedConfidence);
  const aura = persona ? persona.aura : computedAura;
  const verdict = persona ? persona.verdict : ai.verdict;

  const iconName = ai.presentation.recognizedIcon;
  const fa = ai.faceAnalysis;
  const oa = ai.outfitAnalysis;
  const ratingOf = (key: keyof typeof fa | keyof typeof oa, block: typeof fa | typeof oa): number =>
    block[key as string].rating ?? UNSCORED_DISPLAY;

  /* ---- Face ---- */
  let faceResult = null as FullGenerationResult['face'];
  if (parts.face) {
    const faceCard = {
      imageUrl: null,
      eyebrow: 'FACE VERDICT',
      verdict: [ai.face.headline.lead, ai.face.headline.punch] as [string, string],
      index: `AURA INDEX ${aura}`,
      scores: [
        score('aura', 'Aura', aura),
        {
          id: 'age', label: 'Est. Age', value: ai.presentation.ageEstimate ?? 0,
          displayValue: ai.presentation.ageEstimate != null ? `${ai.presentation.ageEstimate} y.o.` : '—',
          noBar: true,
        },
        score('gender-index', confidentlyFemme ? 'Femininity' : 'Masculinity', ai.presentation.expressionStrength),
        score('main-character', 'Main Character', ratingOf('mainCharacterEnergy', fa), true),
      ] as ScoreItem[],
      sticker: pickSticker('face', ai.face.stickerId),
    };
    const breakdown: FaceTrait[] = [
      { id: 'jaw', label: 'Jaw Presence', value: ratingOf('jawPresence', fa), descriptor: descriptorFor(fa.jawPresence.rating), icon: 'jaw' },
      { id: 'harmony', label: 'Face Harmony', value: ratingOf('faceHarmony', fa), descriptor: descriptorFor(fa.faceHarmony.rating), icon: 'harmony' },
      { id: 'presence', label: 'Visual Presence', value: ratingOf('visualPresence', fa), descriptor: descriptorFor(fa.visualPresence.rating), icon: 'eye' },
      { id: 'haircut', label: 'Haircut Match', value: ratingOf('haircutMatch', fa), descriptor: descriptorFor(fa.haircutMatch.rating), icon: 'brow' },
      { id: 'grooming', label: 'Grooming', value: ratingOf('groomingCoherence', fa), descriptor: descriptorFor(fa.groomingCoherence.rating), icon: 'beard' },
      { id: 'main-character', label: 'Main Character', value: ratingOf('mainCharacterEnergy', fa), descriptor: descriptorFor(fa.mainCharacterEnergy.rating), icon: 'star' },
    ];
    faceResult = { card: faceCard, analysis: { aura, explanation: ai.face.summary, roast: ai.face.roast, breakdown } };
  }

  /* ---- Outfit ---- */
  let outfitResult = null as FullGenerationResult['outfit'];
  if (parts.outfit) {
    const np = ai.outfit.nameplate;
    const nameplate: OutfitNameplate = {
      name: np.name, eyebrow: np.eyebrow, tagline: np.tagline, lane: np.lane,
      accent: clampAccent(np.accentHex, contentGender),
      dossier: np.dossier.slice(0, 4).map((row) => ({ label: row.label, value: row.value })),
    };
    const outfitCard = {
      imageUrl: null,
      caption: ai.outfit.caption,
      overallScore: outfitMean as number,
      scores: [
        { id: 'silhouette', label: 'Silhouette', value: ratingOf('silhouette', oa), note: oa.silhouette.evidence },
        { id: 'proportions', label: 'Proportions', value: ratingOf('proportions', oa), note: oa.proportions.evidence },
        { id: 'fit', label: 'Fit', value: ratingOf('fit', oa), note: oa.fit.evidence },
        { id: 'physique-match', label: 'Physique Match', value: ratingOf('physiqueMatch', oa), note: oa.physiqueMatch.evidence },
      ] as ScoreItem[],
      sticker: pickSticker('outfit', ai.outfit.stickerId),
      nameplate,
    };
    const supportingDefs = [
      { id: 'color-story', label: 'Color Match', key: 'colorCoherence' as const },
      { id: 'layering', label: 'Layering', key: 'layering' as const },
      { id: 'styling-intent', label: 'Styling Effort', key: 'stylingIntent' as const },
      { id: 'overall-cohesion', label: 'Overall Look', key: 'overallCohesion' as const },
      { id: 'accessories', label: 'Accessories', key: 'accessories' as const },
    ];
    const supporting: SupportingStat[] = supportingDefs
      .filter((s) => oa[s.key].rating != null)
      .slice(0, 4)
      .map((s) => ({ id: s.id, label: s.label, value: oa[s.key].rating as number, note: oa[s.key].evidence }));
    const assessed = supportingDefs.filter((s) => oa[s.key].rating != null);
    const sorted = [...assessed].sort((a, b) => (oa[b.key].rating! - oa[a.key].rating!));
    const tags = sorted.length >= 2
      ? [
          { label: `${sorted[0].label.toLowerCase()} on point`, tone: 'good' as const },
          { label: `${sorted[sorted.length - 1].label.toLowerCase()} needs work`, tone: 'bad' as const },
        ]
      : [{ label: 'clean fit', tone: 'good' as const }];
    outfitResult = {
      card: outfitCard,
      analysis: { explanation: ai.outfit.works, works: ai.outfit.works, hurts: ai.outfit.hurts, verdict: ai.outfit.verdict, tags, supporting },
    };
  }

  /* ---- Receipt ---- */
  const datingScore = Math.round(aura) / 10;
  const auraValue = Math.round((aura - 50) * AURA_GAIN_SCALE);
  const goodTone = verdict === 'green_flag';
  const rows: ReceiptRow[] = [
    { id: 'dating-score', label: 'Dating Score', value: `${datingScore.toFixed(1)} / 10`, tone: goodTone ? 'good' : 'default' },
    { id: 'aura-gained', label: 'Aura Gained', value: `${auraValue >= 0 ? '+' : ''}${auraValue}`, tone: auraValue >= 0 ? 'good' : 'default' },
    { id: 'lover-boy', label: contentGender === 'femme' ? 'Heartbreaker Prob.' : 'Lover-Boy Prob.', value: `${goodTone ? 84 : 48}%`, tone: goodTone ? 'good' : 'default' },
    { id: 'ghosting', label: 'Ghosting Potential', value: `${verdict === 'red_flag' ? 72 : 34}%`, tone: verdict === 'red_flag' ? 'hi' : 'default' },
  ];
  if (parts.face) {
    rows.push({ id: 'main-char', label: 'Main-Char Energy', value: `${ratingOf('mainCharacterEnergy', fa)}%`, tone: 'default' });
  }

  const faceSummary = parts.face ? scrubName(ai.face.summary, iconName) : '';
  const outfitSummary = parts.outfit ? scrubName(ai.outfit.verdict, iconName) : '';
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
      finalPunchline: scrubName(ai.receipt.punchline, iconName),
      stamp: ['FITAURA', 'VERIFIED'],
      summary: summary || scrubName(ai.receipt.summary, iconName),
    },
  };
}
