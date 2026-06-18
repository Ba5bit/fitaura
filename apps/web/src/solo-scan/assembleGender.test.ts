import { describe, expect, it } from 'vitest';
import { assembleResult, sampleAIOutput, genderOf } from '@fitaura/shared';

const both = { face: true, outfit: true };

describe('assembleResult — fixed gender', () => {
  it('resolves masc for the masc fixture', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-g', 'v3', both);
    expect(r.gender).toBe('masc');
  });

  it('resolves femme for a confident femme read', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.9 };
    expect(assembleResult(ai, 'scan-g', 'v3', both).gender).toBe('femme');
  });

  it('resolves unsure / low-confidence femme to masc', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.4 };
    expect(assembleResult(ai, 'scan-g', 'v3', both).gender).toBe('masc');
  });

  it('genders the lover-boy receipt row (Heartbreaker for femme)', () => {
    const masc = assembleResult(sampleAIOutput(), 'scan-lb', 'v3', both);
    expect(masc.receipt.rows.find((r) => r.id === 'lover-boy')!.label).toBe('Lover-Boy Prob.');
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.9 };
    const femme = assembleResult(ai, 'scan-lb', 'v3', both);
    expect(femme.receipt.rows.find((r) => r.id === 'lover-boy')!.label).toBe('Heartbreaker Prob.');
  });
});

describe('genderOf', () => {
  it('returns the result gender when present', () => {
    expect(genderOf({ gender: 'femme' })).toBe('femme');
  });
  it('defaults legacy rows (no gender) to masc', () => {
    expect(genderOf({})).toBe('masc');
  });
});
