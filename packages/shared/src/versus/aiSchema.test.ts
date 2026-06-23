import { describe, expect, it } from 'vitest';
import { versusAiResultSchema, VERSUS_SCHEMA_VERSION } from './aiSchema.ts';

const side = () => ({ a: 80, b: 70 });

function faceScores() {
  return {
    skin: side(),
    symmetry: side(),
    jawline: side(),
    eyes: side(),
    aura: side(),
  };
}

function fitScores() {
  return {
    fit: side(),
    color: side(),
    drip: side(),
    silhouette: side(),
    freshness: side(),
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
    superlatives: [
      { label: 'Most likely to get a free drink', winner: 'a', locked: false },
      { label: 'Most likely to text back', winner: 'b', locked: false },
      { label: 'Secret final boss', winner: 'a', locked: true },
    ],
    ...over,
  };
}

describe('versusAiResultSchema', () => {
  it('exposes a stable schema version string', () => {
    expect(typeof VERSUS_SCHEMA_VERSION).toBe('string');
    expect(VERSUS_SCHEMA_VERSION.length).toBeGreaterThan(0);
  });

  it('accepts a complete both-mode payload', () => {
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
    const bad = sample({ scores: { face: { ...faceScores(), skin: { a: 120, b: 70 } }, fit: fitScores() } });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-integer score', () => {
    const bad = sample({ scores: { face: { ...faceScores(), skin: { a: 80.5, b: 70 } }, fit: fitScores() } });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown crown winner', () => {
    expect(versusAiResultSchema.safeParse(sample({ crown: { winner: 'c', line: 'x' } })).success).toBe(false);
  });

  it('accepts a tie crown', () => {
    expect(versusAiResultSchema.safeParse(sample({ crown: { winner: 'tie', line: 'Dead heat.' } })).success).toBe(true);
  });

  it('rejects a superlative with a tie winner (only a|b allowed)', () => {
    const bad = sample({
      superlatives: [{ label: 'x', winner: 'tie', locked: true }],
    });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing crown line', () => {
    expect(versusAiResultSchema.safeParse(sample({ crown: { winner: 'a' } })).success).toBe(false);
  });

  it('rejects an incomplete face score block (missing a metric key)', () => {
    const bad = sample({ scores: { face: { skin: side() }, fit: fitScores() } });
    expect(versusAiResultSchema.safeParse(bad).success).toBe(false);
  });
});
