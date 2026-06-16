// apps/web/src/solo-scan/scoring.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreFromRating, weightedAverage, jitter, displayScore,
  pickVerdict, percent,
  biasFactor, biasedRating, applyScoreBias, faceScore,
  isMemeGlory, gloryFloor, applyGloryFloor, GLORY_MIN, GLORY_MAX,
  sampleAIOutput,
} from '@fitaura/shared';

describe('scoring', () => {
  it('passes a 0-100 rating straight through, clamped', () => {
    expect(scoreFromRating(73)).toBe(73);
    expect(scoreFromRating(0)).toBe(0);
    expect(scoreFromRating(100)).toBe(100);
    expect(scoreFromRating(150)).toBe(100); // clamps above range
    expect(scoreFromRating(-5)).toBe(0); // clamps below range
    expect(scoreFromRating(null)).toBeNull();
  });

  it('low ratings yield low display scores (diversity floor reaches the teens)', () => {
    expect(displayScore(12, 'scan1', 'jaw', 'v2')).toBeLessThanOrEqual(15);
    expect(displayScore(12, 'scan1', 'jaw', 'v2')).toBeGreaterThanOrEqual(9);
  });

  it('drops nulls and renormalizes weights', () => {
    expect(weightedAverage([{ score: 80, weight: 0.2 }, { score: null, weight: 0.8 }])).toBe(80);
  });

  it('returns null when every category is null', () => {
    expect(weightedAverage([{ score: null, weight: 0.5 }, { score: null, weight: 0.5 }])).toBeNull();
  });

  it('jitter is deterministic and bounded to +/-3', () => {
    expect(jitter('abc')).toBe(jitter('abc'));
    for (const s of ['a', 'b', 'c', 'd', 'scan:jaw:v2']) {
      expect(Math.abs(jitter(s))).toBeLessThanOrEqual(3);
    }
  });

  it('displayScore is stable for the same scan/key', () => {
    const a = displayScore(80, 'scan1', 'jaw', 'v2');
    const b = displayScore(80, 'scan1', 'jaw', 'v2');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(77);
    expect(a).toBeLessThanOrEqual(83);
  });

  it('pickVerdict thresholds: green >=70, normie >=45, else red', () => {
    expect(pickVerdict(90, 'x')).toBe('green_flag');
    expect(pickVerdict(55, 'x')).toBe('normie');
    expect(pickVerdict(20, 'x')).toBe('red_flag');
  });

  it('percent is clamped 0..100 and deterministic', () => {
    expect(percent('scan1', 'ghost', 50)).toBe(percent('scan1', 'ghost', 50));
    expect(percent('scan1', 'ghost', 99, 10)).toBeLessThanOrEqual(100);
  });
});

describe('bias', () => {
  const base = () => sampleAIOutput().presentation;

  it('is 1.0 with no femme, no icon', () => {
    expect(biasFactor({ ...base(), gender: 'masc', recognizedIcon: null })).toBe(1);
  });

  it('applies the femme factor only when confidently femme', () => {
    expect(biasFactor({ ...base(), gender: 'femme', genderConfidence: 0.9 })).toBeCloseTo(1.07);
    expect(biasFactor({ ...base(), gender: 'femme', genderConfidence: 0.4 })).toBe(1); // below gate
  });

  it('does not multiply for a recognized icon (memes use the glory floor; real people read honestly)', () => {
    expect(biasFactor({ ...base(), gender: 'masc', recognizedIcon: 'McLovin', recognizedConfidence: 0.9, recognizedKind: 'meme' })).toBe(1);
    expect(biasFactor({ ...base(), gender: 'masc', recognizedIcon: 'Lewis Hamilton', recognizedConfidence: 0.9, recognizedKind: 'real_person' })).toBe(1);
  });

  it('femme still applies regardless of icon', () => {
    const f = biasFactor({ ...base(), gender: 'femme', genderConfidence: 0.9, recognizedIcon: 'X', recognizedConfidence: 0.9, recognizedKind: 'meme' });
    expect(f).toBeCloseTo(1.07);
  });

  it('biasedRating clamps to 100 and passes null through', () => {
    expect(biasedRating(50, 1.07)).toBe(54); // round(53.5)
    expect(biasedRating(98, 1.15)).toBe(100); // clamps
    expect(biasedRating(null, 1.15)).toBeNull();
  });

  it('applyScoreBias raises the aggregate face score', () => {
    const ai = sampleAIOutput();
    const biased = applyScoreBias(ai, 1.15);
    expect(faceScore(biased)!).toBeGreaterThan(faceScore(ai)!);
    // factor 1 returns the same object untouched
    expect(applyScoreBias(ai, 1)).toBe(ai);
  });
});

describe('meme glory (v3.1)', () => {
  const base = () => sampleAIOutput().presentation;

  it('isMemeGlory: only a confident meme qualifies', () => {
    expect(isMemeGlory({ ...base(), recognizedIcon: 'McLovin', recognizedConfidence: 0.9, recognizedKind: 'meme' })).toBe(true);
    expect(isMemeGlory({ ...base(), recognizedIcon: 'McLovin', recognizedConfidence: 0.4, recognizedKind: 'meme' })).toBe(false); // below gate
    expect(isMemeGlory({ ...base(), recognizedIcon: 'Lewis Hamilton', recognizedConfidence: 0.95, recognizedKind: 'real_person' })).toBe(false);
    expect(isMemeGlory({ ...base(), recognizedIcon: null, recognizedConfidence: 0, recognizedKind: null })).toBe(false);
  });

  it('gloryFloor stays within [GLORY_MIN, GLORY_MAX] and is deterministic', () => {
    for (const s of ['a', 'b', 'scan:glory:face:jawPresence', 'zzz']) {
      const v = gloryFloor(s);
      expect(v).toBeGreaterThanOrEqual(GLORY_MIN);
      expect(v).toBeLessThanOrEqual(GLORY_MAX);
    }
    expect(gloryFloor('same')).toBe(gloryFloor('same'));
  });

  it('applyGloryFloor lifts low/null ratings into the legend range and keeps high ones', () => {
    const ai = sampleAIOutput();
    ai.faceAnalysis.jawPresence.rating = 12;     // low → lifted
    ai.faceAnalysis.visualPresence.rating = 99;  // high → kept
    ai.faceAnalysis.haircutMatch.rating = null;  // null → floored
    const g = applyGloryFloor(ai, 'scan-glory');
    expect(g.faceAnalysis.jawPresence.rating!).toBeGreaterThanOrEqual(GLORY_MIN);
    expect(g.faceAnalysis.visualPresence.rating).toBe(99);
    expect(g.faceAnalysis.haircutMatch.rating!).toBeGreaterThanOrEqual(GLORY_MIN);
    expect(faceScore(g)!).toBeGreaterThan(faceScore(ai)!);
  });
});
