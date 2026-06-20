import { describe, it, expect } from 'vitest';
import { buildBody } from '../gemini.ts';

describe('buildBody', () => {
  it('defaults to thinkingBudget 0 and 2900 max tokens', () => {
    const body = buildBody({
      apiKey: 'x',
      model: 'gemini-2.5-flash',
      face: { mimeType: 'image/jpeg', data: 'AAAA' },
    });
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.maxOutputTokens).toBe(2900);
  });

  it('applies thinkingConfig + maxOutputTokens overrides', () => {
    const body = buildBody({
      apiKey: 'x',
      model: 'gemini-3.5-flash',
      outfit: { mimeType: 'image/png', data: 'BBBB' },
      thinkingConfig: { thinkingLevel: 'low' },
      maxOutputTokens: 4096,
    });
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });

  it('labels and inlines the provided image part', () => {
    const body = buildBody({
      apiKey: 'x',
      model: 'm',
      face: { mimeType: 'image/jpeg', data: 'AAAA' },
    });
    const s = JSON.stringify(body.contents);
    expect(s).toContain('IMAGE: FACE PHOTO');
    expect(s).toContain('AAAA');
  });
});
