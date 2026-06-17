// apps/web/src/solo-scan/assemble.test.ts
import { describe, expect, it } from 'vitest';
import { assembleResult, sampleAIOutput, DATING_VERDICTS } from '@fitaura/shared';

describe('assembleResult', () => {
  const result = assembleResult(sampleAIOutput(), 'scan-test-1', 'v2', { face: true, outfit: true });

  it('produces a valid verdict and matching chip', () => {
    expect(DATING_VERDICTS).toContain(result.verdict);
    expect(result.chip).toContain('VERDICT');
  });

  it('fills the face card with 4 scores and a sticker', () => {
    expect(result.face!.card.scores).toHaveLength(4);
    expect(result.face!.card.verdict).toHaveLength(2);
    expect(result.face!.card.sticker.label.length).toBeGreaterThan(0);
    expect(result.face!.card.imageUrl).toBeNull();
  });

  it('fills the outfit card and skips not_assessable supporting stats', () => {
    expect(result.outfit!.card.scores).toHaveLength(4);
    // accessories is null in the fixture → excluded from supporting
    expect(result.outfit!.analysis.supporting?.some((s) => s.label === 'Accessories')).toBe(false);
  });

  it('builds a receipt with a dating score in range and a punchline', () => {
    expect(result.receipt.datingScore).toBeGreaterThanOrEqual(0);
    expect(result.receipt.datingScore).toBeLessThanOrEqual(10);
    expect(result.receipt.finalPunchline.length).toBeGreaterThan(0);
    expect(result.receipt.datingVerdict).toBe(result.verdict);
    expect(result.receipt.rows.length).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic for the same scanId', () => {
    const again = assembleResult(sampleAIOutput(), 'scan-test-1', 'v2', { face: true, outfit: true });
    expect(again.face!.card.scores[0].value).toBe(result.face!.card.scores[0].value);
    expect(again.verdict).toBe(result.verdict);
    expect(again.receipt.generationId).toBe(result.receipt.generationId);
    expect(again.receipt.auraValue).toBe(result.receipt.auraValue);
  });

  it('throws on insufficient signal (all face ratings null)', () => {
    const ai = sampleAIOutput();
    for (const k of Object.keys(ai.faceAnalysis) as (keyof typeof ai.faceAnalysis)[]) {
      ai.faceAnalysis[k].rating = null;
    }
    expect(() => assembleResult(ai, 'scan-x', 'v2', { face: true, outfit: true })).toThrow(/insufficient_signal/);
  });
});

describe('assembleResult v3', () => {
  it('face card shows aura, haircut, gender index, main character', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-v3', 'v3', { face: true, outfit: true });
    expect(r.face!.card.scores.map((s) => s.id)).toEqual(['aura', 'haircut-match', 'gender-index', 'main-character']);
    expect(r.face!.card.scores[2].label).toBe('Masculinity'); // masc fixture
  });

  it('labels the index Femininity for confident femme', () => {
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.9 };
    const r = assembleResult(ai, 'scan-v3', 'v3', { face: true, outfit: true });
    expect(r.face!.card.scores[2].label).toBe('Femininity');
  });

  it('femme bias raises the aura vs the same scan read as masc', () => {
    const masc = assembleResult(sampleAIOutput(), 'scan-cmp', 'v3', { face: true, outfit: true });
    const ai = sampleAIOutput();
    ai.presentation = { ...ai.presentation, gender: 'femme', genderConfidence: 0.9 };
    const femme = assembleResult(ai, 'scan-cmp', 'v3', { face: true, outfit: true });
    expect(femme.face!.analysis.aura).toBeGreaterThan(masc.face!.analysis.aura);
  });

  it('keeps jaw presence + face harmony in the breakdown', () => {
    const r = assembleResult(sampleAIOutput(), 'scan-v3', 'v3', { face: true, outfit: true });
    const ids = r.face!.analysis.breakdown.map((t) => t.id);
    expect(ids).toContain('jaw');
    expect(ids).toContain('harmony');
  });

  it('surfaces a recognized icon name only above the confidence gate', () => {
    const hi = sampleAIOutput();
    hi.presentation = { ...hi.presentation, recognizedIcon: 'McLovin', recognizedConfidence: 0.9 };
    const lo = sampleAIOutput();
    lo.presentation = { ...lo.presentation, recognizedIcon: 'McLovin', recognizedConfidence: 0.5 };
    expect(assembleResult(hi, 'scan-icon', 'v3', { face: true, outfit: true }).receipt.summary).toContain('McLovin');
    expect(assembleResult(lo, 'scan-icon', 'v3', { face: true, outfit: true }).receipt.summary).not.toContain('McLovin');
  });
});

describe('assembleResult v3.1 — meme glory vs honest celebrity', () => {
  const lowRead = () => {
    const ai = sampleAIOutput();
    for (const k of Object.keys(ai.faceAnalysis) as (keyof typeof ai.faceAnalysis)[]) ai.faceAnalysis[k].rating = 20;
    for (const k of Object.keys(ai.outfitAnalysis) as (keyof typeof ai.outfitAnalysis)[]) ai.outfitAnalysis[k].rating = 20;
    ai.contentSelection.faceArchetypeCandidates = ['face_archetype.negative_aura']; // a low pick the model nominated
    return ai;
  };

  it('a confident meme lands high + green despite a low raw read', () => {
    const ai = lowRead();
    ai.presentation = { ...ai.presentation, recognizedIcon: 'McLovin', recognizedConfidence: 0.95, recognizedKind: 'meme' };
    const r = assembleResult(ai, 'scan-meme', 'v3_1', { face: true, outfit: true });
    expect(r.face!.analysis.aura).toBeGreaterThanOrEqual(75);
    expect(r.verdict).toBe('green_flag');
  });

  it('a real public figure with the same low read is NOT boosted (honest)', () => {
    const ai = lowRead();
    ai.presentation = { ...ai.presentation, recognizedIcon: 'Some Athlete', recognizedConfidence: 0.95, recognizedKind: 'real_person' };
    const r = assembleResult(ai, 'scan-celeb', 'v3_1', { face: true, outfit: true });
    expect(r.face!.analysis.aura).toBeLessThan(40);
    expect(r.verdict).toBe('red_flag');
  });
});

describe('assembleResult (partial)', () => {
  const ai = sampleAIOutput();

  it('both → face + outfit + receipt, parts both', () => {
    const r = assembleResult(ai, 'scan-both', 'v3_2', { face: true, outfit: true });
    expect(r.parts).toEqual({ face: true, outfit: true });
    expect(r.face).not.toBeNull();
    expect(r.outfit).not.toBeNull();
    expect(r.receipt).toBeTruthy();
  });

  it('outfit-only → outfit + receipt, face null, no main-char row', () => {
    const r = assembleResult(ai, 'scan-outfit', 'v3_2', { face: false, outfit: true });
    expect(r.parts).toEqual({ face: false, outfit: true });
    expect(r.face).toBeNull();
    expect(r.outfit).not.toBeNull();
    expect(r.receipt).toBeTruthy();
    expect(r.receipt.rows.some((row) => row.id === 'main-char')).toBe(false);
  });

  it('face-only → face + receipt, outfit null', () => {
    const r = assembleResult(ai, 'scan-face', 'v3_2', { face: true, outfit: false });
    expect(r.parts).toEqual({ face: true, outfit: false });
    expect(r.face).not.toBeNull();
    expect(r.outfit).toBeNull();
    expect(r.receipt).toBeTruthy();
  });

  it('throws insufficient_signal only when a PROVIDED modality cannot be scored', () => {
    const blank = sampleAIOutput();
    for (const k of Object.keys(blank.outfitAnalysis)) (blank.outfitAnalysis as any)[k].rating = null;
    expect(() => assembleResult(blank, 'x', 'v3_2', { face: false, outfit: true })).toThrow('insufficient_signal');
    expect(() => assembleResult(blank, 'x', 'v3_2', { face: true, outfit: true })).toThrow('insufficient_signal');
    expect(() => assembleResult(blank, 'x', 'v3_2', { face: true, outfit: false })).not.toThrow();
  });
});
