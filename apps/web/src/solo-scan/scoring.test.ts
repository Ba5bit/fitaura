// apps/web/src/solo-scan/scoring.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreFromRating, weightedAverage, jitter, displayScore,
  pickVerdict, percent,
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
