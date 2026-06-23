import { describe, it, expect } from 'vitest';
import { VERSUS_SYSTEM_INSTRUCTION, buildVersusResponseSchema } from './prompt.ts';
import { FACE_METRICS, FIT_METRICS } from './metrics.ts';

describe('VERSUS_SYSTEM_INSTRUCTION', () => {
  it('frames the roast at the photo, not the person', () => {
    expect(VERSUS_SYSTEM_INSTRUCTION).toContain('photo');
    expect(VERSUS_SYSTEM_INSTRUCTION.toLowerCase()).toContain('roast');
  });

  it('carries the hard never-guardrail list', () => {
    const lower = VERSUS_SYSTEM_INSTRUCTION.toLowerCase();
    for (const term of ['slur', 'race', 'gender identity', 'disability', 'religion', 'age', 'body', 'sexual', 'minor']) {
      expect(lower).toContain(term);
    }
  });

  it('names both contenders as A and B', () => {
    expect(VERSUS_SYSTEM_INSTRUCTION).toMatch(/contender a/i);
    expect(VERSUS_SYSTEM_INSTRUCTION).toMatch(/contender b/i);
  });
});

describe('buildVersusResponseSchema', () => {
  it('includes only face scores for face mode', () => {
    const schema = buildVersusResponseSchema('face');
    const scoreProps = schema.properties.scores.properties;
    expect(scoreProps.face).toBeDefined();
    expect(scoreProps.fit).toBeUndefined();
    expect(schema.properties.scores.required).toEqual(['face']);
  });

  it('includes only fit scores for fit mode', () => {
    const schema = buildVersusResponseSchema('fit');
    const scoreProps = schema.properties.scores.properties;
    expect(scoreProps.fit).toBeDefined();
    expect(scoreProps.face).toBeUndefined();
    expect(schema.properties.scores.required).toEqual(['fit']);
  });

  it('includes both score blocks for both mode', () => {
    const schema = buildVersusResponseSchema('both');
    const scoreProps = schema.properties.scores.properties;
    expect(scoreProps.face).toBeDefined();
    expect(scoreProps.fit).toBeDefined();
    expect(schema.properties.scores.required).toEqual(expect.arrayContaining(['face', 'fit']));
  });

  it('keys face scores by the canonical face metric keys', () => {
    const schema = buildVersusResponseSchema('face');
    const faceKeys = Object.keys(schema.properties.scores.properties.face!.properties);
    expect(faceKeys).toEqual(FACE_METRICS.map((m) => m.key));
  });

  it('keys fit scores by the canonical fit metric keys', () => {
    const schema = buildVersusResponseSchema('fit');
    const fitKeys = Object.keys(schema.properties.scores.properties.fit!.properties);
    expect(fitKeys).toEqual(FIT_METRICS.map((m) => m.key));
  });

  it('always requires crown, decisiveRead, sides, superlatives', () => {
    const schema = buildVersusResponseSchema('both');
    expect(schema.required).toEqual(
      expect.arrayContaining(['scores', 'crown', 'decisiveRead', 'sides', 'superlatives']),
    );
  });
});
