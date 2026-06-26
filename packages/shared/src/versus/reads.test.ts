import { describe, expect, it } from 'vitest';
import { computeBattle } from './computeBattle.ts';
import { deriveReads } from './reads.ts';
import { FACE_METRICS } from './metrics.ts';
import type { VerdictRead } from './schema.ts';

const NAMES = { a: 'Maya', b: 'Theo' };

/** Build a face-mode verdict from explicit a/b pairs keyed by metric. */
function faceVerdict(pairs: Record<string, [number, number]>) {
  const metrics = FACE_METRICS.map((d) => ({ key: d.key, label: d.label, a: pairs[d.key][0], b: pairs[d.key][1] }));
  return computeBattle({ mode: 'face', face: metrics });
}

const ALL = {
  jawline: [90, 70] as [number, number],
  hairline: [82, 76] as [number, number],
  rizz: [60, 84] as [number, number],
  aura: [88, 85] as [number, number],
};

describe('deriveReads', () => {
  it('uses AI reads: flex crowns the leader, roast names the trailer', () => {
    const verdict = faceVerdict(ALL);
    const reads: VerdictRead[] = [
      { metricKey: 'jawline', title: 'Glass jaw (the good kind)', flex: true, reason: 'The angle carried it.' },
      { metricKey: 'rizz', title: 'Most likely to get left on read', flex: false, reason: 'Dry energy in 4K.' },
    ];
    const rows = deriveReads(verdict, { reads }, NAMES);

    const jaw = rows.find((r) => r.metricKey === 'jawline')!;
    expect(jaw).toMatchObject({ flex: true, side: 'a', name: 'Maya', score: 90, tier: 'Elite' });
    expect(jaw.tag).toBe('JAWLINE · +20 ahead');

    // rizz a=60,b=84 → trailer is A; the roast mocks the trailer.
    const rizz = rows.find((r) => r.metricKey === 'rizz')!;
    expect(rizz).toMatchObject({ flex: false, isRoast: true, side: 'a', name: 'Maya', score: 60, tier: 'Needs work' });
    expect(rizz.tag).toBe('Roast · RIZZ · 24 behind');
  });

  it('falls back to the static bank (all flex) and still guarantees one roast', () => {
    const rows = deriveReads(faceVerdict(ALL), null, NAMES);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.isRoast)).toHaveLength(1);
    // the manufactured roast is the smallest-gap row → sorts last
    expect(rows[rows.length - 1].isRoast).toBe(true);
  });

  it('sorts rows by gap descending', () => {
    const rows = deriveReads(faceVerdict(ALL), null, NAMES);
    const gaps = rows.map((r) => r.gap);
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
  });

  it('skips dead-even metrics (gap 0)', () => {
    const verdict = faceVerdict({ ...ALL, hairline: [80, 80] });
    const rows = deriveReads(verdict, null, NAMES);
    expect(rows.some((r) => r.metricKey === 'hairline')).toBe(false);
  });

  it('never puts a digit in the prose (title or reason)', () => {
    const rows = deriveReads(faceVerdict(ALL), null, NAMES);
    for (const r of rows) {
      expect(r.title).not.toMatch(/\d/);
      expect(r.reason).not.toMatch(/\d/);
    }
  });

  it('returns nothing when there is no active group', () => {
    const empty = { mode: 'face' as const, face: null, fit: null, overall: { avgA: 0, avgB: 0, winner: 'tie' as const }, winner: 'tie' as const };
    expect(deriveReads(empty, null, NAMES)).toEqual([]);
  });
});
