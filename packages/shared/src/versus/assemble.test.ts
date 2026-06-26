import { describe, expect, it } from 'vitest';
import { shapeVersusResult } from './assemble.ts';
import { computeBattle } from './computeBattle.ts';
import type { VersusAIResult } from './aiSchema.ts';

const sideCopy = () => ({ superpower: 'jaw loaded', roast: 'eyes asleep' });

/** Build a face score block from explicit a/b pairs keyed by metric. */
function faceScores(pairs: Record<string, [number, number]> = {}) {
  const base: Record<string, [number, number]> = {
    jawline: [80, 70], hairline: [80, 70], rizz: [80, 70], aura: [80, 70],
  };
  const merged = { ...base, ...pairs };
  return Object.fromEntries(Object.entries(merged).map(([k, [a, b]]) => [k, { a, b }]));
}

function fitScores(pairs: Record<string, [number, number]> = {}) {
  const base: Record<string, [number, number]> = {
    drip: [60, 90], physique: [60, 90], pose: [60, 90], confidence: [60, 90],
  };
  const merged = { ...base, ...pairs };
  return Object.fromEntries(Object.entries(merged).map(([k, [a, b]]) => [k, { a, b }]));
}

function sample(over: Partial<VersusAIResult> = {}): VersusAIResult {
  return {
    scores: { face: faceScores(), fit: fitScores() },
    crown: { winner: 'a', line: 'A bodied this matchup.' },
    decisiveRead: 'A took it on jawline.',
    sides: {
      a: { face: sideCopy(), fit: sideCopy() },
      b: { face: sideCopy(), fit: sideCopy() },
    },
    reads: [
      { metricKey: 'jawline', title: 'Could cut glass with that jaw', flex: true, reason: 'The angle did the heavy lifting.' },
      { metricKey: 'aura', title: 'Most likely to be the NPC', flex: false, reason: 'Let the background win the frame.' },
    ],
    ...over,
  } as VersusAIResult;
}

const META = { mode: 'face' as const, battleId: 'battle-1' };

describe('shapeVersusResult', () => {
  it('maps AI scores to Metric[] with labels from the metric defs', () => {
    const out = shapeVersusResult(sample(), META);
    expect(out.face).not.toBeNull();
    expect(out.face!.map((m) => m.key)).toEqual(['jawline', 'hairline', 'rizz', 'aura']);
    expect(out.face!.find((m) => m.key === 'jawline')).toMatchObject({ label: 'Jawline', a: 80, b: 70 });
  });

  it('carries the copy payload through (sides, decisiveRead)', () => {
    const out = shapeVersusResult(sample(), META);
    expect(out.copy.decisiveRead).toBe('A took it on jawline.');
    expect(out.copy.sides.a.face).toEqual(sideCopy());
    expect(out.copy.sides.b.fit).toEqual(sideCopy());
  });

  it('keeps the AI crown line when the AI winner matches the computed winner', () => {
    // A dominates face → A wins; the AI's crown agrees, so the line is kept.
    const ai = sample({
      scores: { face: faceScores({ jawline: [95, 60], hairline: [95, 60], rizz: [95, 60], aura: [95, 60] }) },
      crown: { winner: 'a', line: 'A bodied this matchup.' },
    });
    const computed = computeBattle({ mode: 'face', face: ai.scores.face && asMetrics(ai.scores.face) });
    expect(computed.winner).toBe('a');
    const out = shapeVersusResult(ai, META);
    expect(out.copy.crown.winner).toBe('a');
    expect(out.copy.crown.line).toBe('A bodied this matchup.');
  });

  it('replaces the crown line with a fallback when the AI winner disagrees with the computed winner', () => {
    // Dead-heat scores → computed winner is "tie", but the AI insists "a".
    const tieScores = {
      face: faceScores({ jawline: [80, 80], hairline: [80, 80], rizz: [80, 80], aura: [80, 80] }),
    };
    const ai = sample({ scores: tieScores, crown: { winner: 'a', line: 'A obliterated B.' } });
    const out = shapeVersusResult(ai, META);
    expect(out.copy.crown.winner).toBe('tie'); // reconciled to the computed winner
    expect(out.copy.crown.line).not.toBe('A obliterated B.');
    expect(out.copy.crown.line.length).toBeGreaterThan(0);
  });

  it('keeps reads whose metricKey is in the active modality', () => {
    const out = shapeVersusResult(sample(), META);
    expect(out.copy.reads.map((r) => r.metricKey)).toEqual(['jawline', 'aura']);
    expect(out.copy.reads[0]).toMatchObject({ title: 'Could cut glass with that jaw', flex: true });
  });

  it('drops reads pointing at an inactive-modality metric key', () => {
    const ai = sample({
      reads: [
        { metricKey: 'jawline', title: 'a', flex: true, reason: 'r' },
        { metricKey: 'drip', title: 'b', flex: true, reason: 'r' }, // fit key, face mode
      ],
    });
    const out = shapeVersusResult(ai, META);
    expect(out.copy.reads.map((r) => r.metricKey)).toEqual(['jawline']);
  });

  it('de-duplicates reads by metric key (first wins)', () => {
    const ai = sample({
      reads: [
        { metricKey: 'rizz', title: 'first', flex: true, reason: 'r' },
        { metricKey: 'rizz', title: 'second', flex: false, reason: 'r' },
      ],
    });
    const out = shapeVersusResult(ai, META);
    expect(out.copy.reads).toHaveLength(1);
    expect(out.copy.reads[0].title).toBe('first');
  });

  it('handles face-only mode (fit null)', () => {
    const ai = sample({
      scores: { face: faceScores() },
      sides: { a: { face: sideCopy(), fit: null }, b: { face: sideCopy(), fit: null } },
    });
    const out = shapeVersusResult(ai, { mode: 'face', battleId: 'b' });
    expect(out.mode).toBe('face');
    expect(out.fit).toBeNull();
    expect(out.face).not.toBeNull();
    expect(out.face!).toHaveLength(4);
  });

  it('handles fit-only mode (face null)', () => {
    const ai = sample({
      scores: { fit: fitScores() },
      sides: { a: { face: null, fit: sideCopy() }, b: { face: null, fit: sideCopy() } },
    });
    const out = shapeVersusResult(ai, { mode: 'fit', battleId: 'b' });
    expect(out.mode).toBe('fit');
    expect(out.face).toBeNull();
    expect(out.fit).not.toBeNull();
    expect(out.fit!).toHaveLength(4);
    expect(out.fit!.find((m) => m.key === 'drip')).toMatchObject({ label: 'Drip', a: 60, b: 90 });
  });

  it('throws when an active category has no scores', () => {
    const ai = sample({ scores: { fit: fitScores() } }); // face mode but face scores missing
    expect(() => shapeVersusResult(ai, META)).toThrow();
  });

  it('throws when an active score is out of range', () => {
    const ai = sample({
      scores: { face: faceScores({ jawline: [150, 70] }), fit: fitScores() },
    });
    expect(() => shapeVersusResult(ai, META)).toThrow();
  });
});

/** Local helper mirroring assemble's metric mapping for the match-case assertion. */
function asMetrics(block: Record<string, { a: number; b: number }>) {
  return Object.entries(block).map(([key, v]) => ({ key, label: key, a: v.a, b: v.b }));
}
