import { describe, it, expect } from 'vitest';
import { MODELS, resolveKey, estimateCost } from './models.ts';
import type { ModelConfig } from './types.ts';

describe('resolveKey', () => {
  it('prefers the model-specific env var', () => {
    const cfg = MODELS.find((m) => m.id === 'gemini-3.5-flash')!;
    expect(resolveKey(cfg, { GEMINI_API_KEY_35: 'k35', GEMINI_API_KEY: 'base' })).toBe('k35');
  });

  it('falls back to GEMINI_API_KEY when the specific var is unset', () => {
    const cfg = MODELS.find((m) => m.id === 'gemini-3.5-flash')!;
    expect(resolveKey(cfg, { GEMINI_API_KEY: 'base' })).toBe('base');
  });

  it('returns undefined when neither is set', () => {
    const cfg = MODELS.find((m) => m.id === 'gemini-3.5-flash')!;
    expect(resolveKey(cfg, {})).toBeUndefined();
  });
});

describe('estimateCost', () => {
  it('computes cost from per-Mtok prices', () => {
    const cfg: ModelConfig = { id: 'x', keyEnv: 'X', thinkingConfig: {}, priceIn: 0.3, priceOut: 2.5 };
    // 1e6 in * 0.3/1e6 = 0.3 ; 1e6 out * 2.5/1e6 = 2.5 ; total 2.8
    expect(estimateCost({ input: 1_000_000, output: 1_000_000 }, cfg)).toBe(2.8);
  });
});

describe('MODELS', () => {
  it('compares the v3.5 and v4 contracts on gemini-3.5-flash', () => {
    expect(MODELS.map((m) => m.contract)).toEqual(['v3_5', 'v4']);
    expect(MODELS.every((m) => m.id === 'gemini-3.5-flash')).toBe(true);
    expect(MODELS.map((m) => m.label)).toEqual(['3.5 · current (v3.5)', '3.5 · rebuild (v4)']);
    expect(MODELS.every((m) => m.keyEnv === 'GEMINI_API_KEY_35')).toBe(true);
  });
});
