import { describe, expect, it } from 'vitest';
import { computeBattle, splitPercent, winnerOf } from './computeBattle.ts';
import { generateMetrics } from './metrics.ts';
import type { Metric } from './schema.ts';

const m = (key: string, a: number, b: number): Metric => ({ key, label: key, a, b });

describe('winnerOf', () => {
  it('crowns the higher average', () => {
    expect(winnerOf(90, 80)).toBe('a');
    expect(winnerOf(70, 88)).toBe('b');
  });
  it('reads a within-band gap as a tie', () => {
    expect(winnerOf(85, 85)).toBe('tie');
    expect(winnerOf(85, 84)).toBe('tie'); // 1 apart == TIE_BAND
  });
  it('is decisive just outside the band', () => {
    expect(winnerOf(86, 84)).toBe('a'); // 2 apart
  });
});

describe('computeBattle', () => {
  it('compares face only when mode=face', () => {
    const v = computeBattle({ mode: 'face', face: [m('skin', 90, 70), m('eyes', 80, 60)] });
    expect(v.face).not.toBeNull();
    expect(v.fit).toBeNull();
    expect(v.face!.avgA).toBe(85);
    expect(v.face!.avgB).toBe(65);
    expect(v.winner).toBe('a');
    expect(v.overall.winner).toBe('a');
  });

  it('compares fit only when mode=fit', () => {
    const v = computeBattle({ mode: 'fit', fit: [m('drip', 50, 92), m('color', 60, 90)] });
    expect(v.fit).not.toBeNull();
    expect(v.face).toBeNull();
    expect(v.winner).toBe('b');
  });

  it('weighs face and fit equally for mode=both', () => {
    // A dominates face, B dominates fit by the same margin → dead heat overall.
    const v = computeBattle({
      mode: 'both',
      face: [m('skin', 90, 70)],
      fit: [m('drip', 70, 90)],
    });
    expect(v.face!.winner).toBe('a');
    expect(v.fit!.winner).toBe('b');
    expect(v.overall.avgA).toBe(80);
    expect(v.overall.avgB).toBe(80);
    expect(v.winner).toBe('tie');
  });

  it('handles an empty group without crashing', () => {
    const v = computeBattle({ mode: 'face', face: [] });
    expect(v.face!.avgA).toBe(0);
    expect(v.winner).toBe('tie');
  });
});

describe('splitPercent', () => {
  it('splits proportionally and sums to 100', () => {
    const s = splitPercent(75, 25);
    expect(s.a).toBe(75);
    expect(s.b).toBe(25);
  });
  it('falls back to 50/50 when both are zero', () => {
    expect(splitPercent(0, 0)).toEqual({ a: 50, b: 50 });
  });
});

describe('generateMetrics', () => {
  it('is deterministic for a given seed', () => {
    const x = generateMetrics('Ann|Bo');
    const y = generateMetrics('Ann|Bo');
    expect(x).toEqual(y);
  });
  it('differs across seeds', () => {
    const x = generateMetrics('Ann|Bo');
    const z = generateMetrics('Cat|Dee');
    expect(x).not.toEqual(z);
  });
  it('produces in-band scores for all five metrics per modality', () => {
    const { face, fit } = generateMetrics('seed');
    expect(face).toHaveLength(5);
    expect(fit).toHaveLength(5);
    for (const grp of [face, fit]) {
      for (const metric of grp) {
        for (const side of [metric.a, metric.b]) {
          expect(side).toBeGreaterThanOrEqual(58);
          expect(side).toBeLessThanOrEqual(96);
        }
      }
    }
  });
});
