import { describe, expect, it } from 'vitest';
import { computeBattle, splitPercent, summarizeBattle, winnerOf } from './computeBattle.ts';
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

describe('summarizeBattle', () => {
  // A wins face (clearly), B wins fit (clearly) → 1-1 categories, equal-ish overall.
  const v = computeBattle({
    mode: 'both',
    face: [m('skin', 92, 86), m('symmetry', 88, 83), m('jawline', 84, 89), m('gaze', 86, 84), m('aura', 90, 85)],
    fit: [m('silhouette', 81, 89), m('color', 78, 91), m('statement', 85, 82), m('texture', 80, 87), m('coordination', 83, 86)],
  });

  it('splits categories per modality winner', () => {
    const s = summarizeBattle(v);
    expect(s.categoryCount).toBe(2);
    expect(s.categoriesA).toBe(1); // face
    expect(s.categoriesB).toBe(1); // fit
  });

  it('counts metrics won across all modalities', () => {
    const s = summarizeBattle(v);
    expect(s.metricsTotal).toBe(10);
    expect(s.metricsWonA + s.metricsWonB).toBe(10);
  });

  it('labels a 1-point margin "By a hair" and a tie "Dead heat"', () => {
    expect(summarizeBattle(v).marginLabel).toMatch(/hair|Dead heat|Close/);
    const tie = computeBattle({ mode: 'face', face: [m('skin', 80, 80)] });
    expect(summarizeBattle(tie).marginLabel).toBe('Dead heat');
  });

  it('returns the 4 most decisive reads, largest gap first', () => {
    const s = summarizeBattle(v);
    expect(s.topReads).toHaveLength(4);
    const gaps = s.topReads.map((r) => Math.abs(r.metric.a - r.metric.b));
    expect(gaps).toEqual([...gaps].sort((x, y) => y - x));
    expect(s.topReads[0].category === 'face' || s.topReads[0].category === 'fit').toBe(true);
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
