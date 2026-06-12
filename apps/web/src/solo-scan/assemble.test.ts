// apps/web/src/solo-scan/assemble.test.ts
import { describe, expect, it } from 'vitest';
import { assembleResult, sampleAIOutput, DATING_VERDICTS } from '@fitaura/shared';

describe('assembleResult', () => {
  const result = assembleResult(sampleAIOutput(), 'scan-test-1', 'v1');

  it('produces a valid verdict and matching chip', () => {
    expect(DATING_VERDICTS).toContain(result.verdict);
    expect(result.chip).toContain('VERDICT');
  });

  it('fills the face card with 4 scores and a sticker', () => {
    expect(result.face.card.scores).toHaveLength(4);
    expect(result.face.card.verdict).toHaveLength(2);
    expect(result.face.card.sticker.label.length).toBeGreaterThan(0);
    expect(result.face.card.imageUrl).toBeNull();
  });

  it('fills the outfit card and skips not_assessable supporting stats', () => {
    expect(result.outfit.card.scores).toHaveLength(4);
    // accessories is null in the fixture → excluded from supporting
    expect(result.outfit.analysis.supporting?.some((s) => s.label === 'Accessories')).toBe(false);
  });

  it('builds a receipt with a dating score in range and a punchline', () => {
    expect(result.receipt.datingScore).toBeGreaterThanOrEqual(0);
    expect(result.receipt.datingScore).toBeLessThanOrEqual(10);
    expect(result.receipt.finalPunchline.length).toBeGreaterThan(0);
    expect(result.receipt.datingVerdict).toBe(result.verdict);
    expect(result.receipt.rows.length).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic for the same scanId', () => {
    const again = assembleResult(sampleAIOutput(), 'scan-test-1', 'v1');
    expect(again.face.card.scores[0].value).toBe(result.face.card.scores[0].value);
    expect(again.verdict).toBe(result.verdict);
  });

  it('throws on insufficient signal (all face ratings null)', () => {
    const ai = sampleAIOutput();
    for (const k of Object.keys(ai.faceAnalysis) as (keyof typeof ai.faceAnalysis)[]) {
      ai.faceAnalysis[k].rating = null;
    }
    expect(() => assembleResult(ai, 'scan-x', 'v1')).toThrow(/insufficient_signal/);
  });
});
