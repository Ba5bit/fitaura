import { describe, expect, it } from 'vitest';
import { versusAiResultSchema, VERSUS_SCHEMA_VERSION } from './aiSchema.ts';

const side = () => ({ a: 80, b: 70 });

function faceScores() {
  return {
    jawline: side(),
    hairline: side(),
    rizz: side(),
    aura: side(),
  };
}

function fitScores() {
  return {
    drip: side(),
    physique: side(),
    pose: side(),
    confidence: side(),
  };
}

const sideCopy = () => ({ superpower: 'jaw loaded', roast: 'eyes asleep' });

function sample(over: Record<string, unknown> = {}) {
  return {
    scores: { face: faceScores(), fit: fitScores() },
    crown: { winner: 'a', line: 'A takes it, no notes.' },
    decisiveRead: 'A won on jawline by a mile.',
    sides: {
      a: { face: sideCopy(), fit: sideCopy() },
      b: { face: sideCopy(), fit: sideCopy() },
    },
    reads: [
      { metricKey: 'jawline', title: 'Could cut glass with that jaw', flex: true, reason: 'The angle did all the heavy lifting and got away with it.' },
      { metricKey: 'aura', title: 'Most likely to be the NPC', flex: false, reason: 'Faded into the wall and let the background win.' },
    ],
    ...over,
  };
}

describe('versusAiResultSchema', () => {
  it('exposes a stable schema version string', () => {
    expect(typeof VERSUS_SCHEMA_VERSION).toBe('string');
    expect(VERSUS_SCHEMA_VERSION.length).toBeGreaterThan(0);
  });

  it('accepts a payload carrying both score blocks (schema stays permissive)', () => {
    expect(versusAiResultSchema.safeParse(sample()).success).toBe(true);
  });

  it('accepts a face-only payload (fit omitted, fit sides null)', () => {
    const faceOnly = sample({
      scores: { face: faceScores() },
      sides: {
        a: { face: sideCopy(), fit: null },
        b: { face: sideCopy(), fit: null },
      },
    });
    expect(versusAiResultSchema.safeParse(faceOnly).success).toBe(true);
  });

  it('accepts a fit-only payload (face omitted, face sides null)', () => {
    const fitOnly = sample({
      scores: { fit: fitScores() },
      sides: {
        a: { face: null, fit: sideCopy() },
        b: { face: null, fit: sideCopy() },
      },
    });
    expect(versusAiResultSchema.safeParse(fitOnly).success).toBe(true);
  });

  it('rejects a score outside 0-100', () => {
    const bad = sample({ scores: { face: { ...faceScores(), jawline: { a: 120, b: 70 } }, fit: fitScores() } });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-integer score', () => {
    const bad = sample({ scores: { face: { ...faceScores(), jawline: { a: 80.5, b: 70 } }, fit: fitScores() } });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown crown winner', () => {
    expect(versusAiResultSchema.safeParse(sample({ crown: { winner: 'c', line: 'x' } })).success).toBe(false);
  });

  it('accepts a tie crown', () => {
    expect(versusAiResultSchema.safeParse(sample({ crown: { winner: 'tie', line: 'Dead heat.' } })).success).toBe(true);
  });

  it('accepts reads with a metric key, title, flex flag and reason', () => {
    const ok = sample({
      reads: [{ metricKey: 'rizz', title: 'Could talk into anywhere', flex: true, reason: 'Stared down the lens unbothered.' }],
    });
    expect(versusAiResultSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects a read missing its reason', () => {
    const bad = sample({
      reads: [{ metricKey: 'rizz', title: 'x', flex: true }],
    });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });

  it('clamps an over-long read reason instead of rejecting', () => {
    const long = 'word '.repeat(80);
    const parsed = versusAiResultSchema.safeParse(sample({
      reads: [{ metricKey: 'aura', title: 'x', flex: false, reason: long }],
    }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.reads[0].reason.length).toBeLessThanOrEqual(180);
  });

  it('rejects a missing crown line', () => {
    expect(versusAiResultSchema.safeParse(sample({ crown: { winner: 'a' } })).success).toBe(false);
  });

  it('rejects an incomplete face score block (missing a metric key)', () => {
    const bad = sample({ scores: { face: { jawline: side() }, fit: fitScores() } });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });
});
