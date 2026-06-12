// apps/web/src/solo-scan/scoring.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreFromRating, weightedAverage, jitter, displayScore,
  pickVerdict, percent,
} from '@fitaura/shared';

describe('scoring', () => {
  it('maps ratings on the fixed curve', () => {
    expect(scoreFromRating(1)).toBe(35);
    expect(scoreFromRating(5)).toBe(92);
    expect(scoreFromRating(null)).toBeNull();
  });

  it('drops nulls and renormalizes weights', () => {
    // one present category → its own score regardless of others being null
    expect(weightedAverage([{ score: 80, weight: 0.2 }, { score: null, weight: 0.8 }])).toBe(80);
  });

  it('returns null when every category is null', () => {
    expect(weightedAverage([{ score: null, weight: 0.5 }, { score: null, weight: 0.5 }])).toBeNull();
  });

  it('jitter is deterministic and bounded to +/-3', () => {
    expect(jitter('abc')).toBe(jitter('abc'));
    for (const s of ['a', 'b', 'c', 'd', 'scan:jaw:v1']) {
      expect(Math.abs(jitter(s))).toBeLessThanOrEqual(3);
    }
  });

  it('displayScore is stable for the same scan/key', () => {
    const a = displayScore(80, 'scan1', 'jaw', 'v1');
    const b = displayScore(80, 'scan1', 'jaw', 'v1');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(77);
    expect(a).toBeLessThanOrEqual(83);
  });

  it('pickVerdict thresholds across the range', () => {
    expect(pickVerdict(95, 'x')).toBe('green_flag');
    expect(pickVerdict(65, 'x')).toBe('normie');
    expect(pickVerdict(40, 'x')).toBe('red_flag');
  });

  it('percent is clamped 0..100 and deterministic', () => {
    expect(percent('scan1', 'ghost', 50)).toBe(percent('scan1', 'ghost', 50));
    expect(percent('scan1', 'ghost', 99, 10)).toBeLessThanOrEqual(100);
  });
});
