import { describe, it, expect } from 'vitest';
import { shapeV4Result } from './shape.ts';
import { findPersona } from './personas.ts';
import { FACE_KEYS, OUTFIT_KEYS } from '../schema.ts';
import type { SoloScanV4Output } from './schema.ts';

const r = (rating: number | null) => ({ rating, confidence: rating == null ? 0 : 1, evidence: 'x' });
const analysis = (keys: readonly string[], rating: number | null) =>
  Object.fromEntries(keys.map((k) => [k, r(rating)]));

function sample(over: Partial<SoloScanV4Output> = {}): SoloScanV4Output {
  return {
    schemaVersion: 'solo_scan_v4',
    inputQuality: { usable: true, faceUsable: true, outfitUsable: true, samePersonLikely: null, issues: [], retakeInstruction: null },
    presentation: { gender: 'masc', genderConfidence: 0.9, expressionStrength: 55, ageEstimate: 27, recognizedIcon: null, recognizedConfidence: 0, recognizedKind: null },
    verdict: 'red_flag',
    faceAnalysis: analysis(FACE_KEYS, 30) as SoloScanV4Output['faceAnalysis'],
    outfitAnalysis: analysis(OUTFIT_KEYS, 30) as SoloScanV4Output['outfitAnalysis'],
    face: { headline: { lead: 'JAW DID', punch: 'THE TALKING' }, stickerId: 'main-character', strongest: 'jaw', roast: 'eyes asleep', summary: 'boss energy' },
    outfit: { caption: 'QUIET LUXURY LOUD EGO', stickerId: 'rizz', nameplate: { name: 'DENIM ARMORY', eyebrow: 'streetwear', tagline: 'controlled chaos', lane: 'Streetwear', accentHex: '#3344ff', dossier: [{ label: 'Signature', value: 'Trucker jacket' }] }, works: 'tonal armor', hurts: 'shoes betrayed you', verdict: 'eats, no crumbs' },
    receipt: { punchline: 'BUILT DIFFERENT', summary: 'mid boss energy' },
    ...over,
  };
}

const BOTH = { face: true, outfit: true };

describe('shapeV4Result', () => {
  it('uses the AI-written headline, caption, and punchline directly', () => {
    const out = shapeV4Result(sample(), 'bob', BOTH);
    expect(out.face?.card.verdict).toEqual(['JAW DID', 'THE TALKING']);
    expect(out.outfit?.card.caption).toBe('QUIET LUXURY LOUD EGO');
    expect(out.receipt.finalPunchline).toBe('BUILT DIFFERENT');
  });

  it('takes the verdict from the AI and averages ratings into Aura', () => {
    const out = shapeV4Result(sample(), 'bob', BOTH);
    expect(out.verdict).toBe('red_flag');
    expect(out.face?.analysis.aura).toBe(30); // all ratings 30 → mean 30
  });

  it('a recognized persona LOCKS the score + verdict', () => {
    const out = shapeV4Result(
      sample({ presentation: { gender: 'masc', genderConfidence: 0.9, expressionStrength: 55, ageEstimate: 30, recognizedIcon: 'McLovin', recognizedConfidence: 0.95, recognizedKind: 'meme' } }),
      'bob',
      BOTH,
    );
    expect(out.verdict).toBe('green_flag'); // overridden from red_flag
    expect(out.face?.analysis.aura).toBe(84); // locked, not the 30 mean
  });

  it('throws insufficient_signal when a provided modality cannot be scored', () => {
    const blind = sample({ faceAnalysis: analysis(FACE_KEYS, null) as SoloScanV4Output['faceAnalysis'] });
    expect(() => shapeV4Result(blind, 'bob', BOTH)).toThrow('insufficient_signal');
  });

  it('picks the sticker the model chose', () => {
    const out = shapeV4Result(sample(), 'bob', BOTH);
    expect(out.face?.card.sticker.id).toBe('main-character');
    expect(out.outfit?.card.sticker.id).toBe('rizz');
  });
});

describe('findPersona', () => {
  it('matches a known alias above the confidence floor', () => {
    expect(findPersona('McLovin', 0.9)?.verdict).toBe('green_flag');
  });
  it('ignores low-confidence recognition', () => {
    expect(findPersona('McLovin', 0.3)).toBeNull();
  });
  it('returns null for an unknown name', () => {
    expect(findPersona('some random guy', 0.99)).toBeNull();
  });
});
