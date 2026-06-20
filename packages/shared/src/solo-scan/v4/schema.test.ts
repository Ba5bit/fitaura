import { describe, it, expect } from 'vitest';
import { soloScanV4Schema, SOLO_SCAN_V4_SCHEMA_VERSION } from './schema.ts';
import { FACE_KEYS, OUTFIT_KEYS } from '../schema.ts';

const r = () => ({ rating: 70, confidence: 1, evidence: 'ok' });
const analysis = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, r()]));

function sample(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: SOLO_SCAN_V4_SCHEMA_VERSION,
    inputQuality: { usable: true, faceUsable: true, outfitUsable: true, samePersonLikely: null, issues: [], retakeInstruction: null },
    presentation: { gender: 'masc', genderConfidence: 0.9, expressionStrength: 50, ageEstimate: 27, recognizedIcon: null, recognizedConfidence: 0, recognizedKind: null },
    verdict: 'green_flag',
    faceAnalysis: analysis(FACE_KEYS),
    outfitAnalysis: analysis(OUTFIT_KEYS),
    face: { headline: { lead: 'JAW DID', punch: 'THE TALKING' }, stickerId: 'main-character', strongest: 'jaw loaded', roast: 'eyes asleep', summary: 'boss energy' },
    outfit: { caption: 'QUIET LUXURY LOUD EGO', stickerId: 'rizz', nameplate: { name: 'DENIM ARMORY', eyebrow: 'All-black streetwear', tagline: 'controlled chaos', lane: 'Streetwear', accentHex: '#3344ff', dossier: [{ label: 'Signature', value: 'Trucker jacket' }] }, works: 'tonal armor', hurts: 'shoes betrayed you', verdict: 'eats, no crumbs' },
    receipt: { punchline: 'BUILT DIFFERENT', summary: 'mid boss energy' },
    ...over,
  };
}

describe('soloScanV4Schema', () => {
  it('accepts a complete v4 output', () => {
    expect(soloScanV4Schema.safeParse(sample()).success).toBe(true);
  });

  it('picks the verdict directly (rejects an unknown verdict)', () => {
    expect(soloScanV4Schema.safeParse(sample({ verdict: 'maybe_flag' })).success).toBe(false);
  });

  it('requires every face + outfit rating category', () => {
    const missing = sample({ faceAnalysis: { jawPresence: r() } });
    expect(soloScanV4Schema.safeParse(missing).success).toBe(false);
  });

  it('requires retakeInstruction when not usable', () => {
    const bad = sample({ inputQuality: { usable: false, faceUsable: false, outfitUsable: false, samePersonLikely: null, issues: [], retakeInstruction: null } });
    expect(soloScanV4Schema.safeParse(bad).success).toBe(false);
  });
});
