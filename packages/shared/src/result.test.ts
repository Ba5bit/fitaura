import { describe, expect, it } from 'vitest';
import { partsOf } from './result.ts';

describe('partsOf', () => {
  it('returns explicit parts when present', () => {
    expect(partsOf({ parts: { face: false, outfit: true }, face: null, outfit: {} })).toEqual({ face: false, outfit: true });
  });
  it('defaults a legacy result (no parts) to both', () => {
    expect(partsOf({ face: {}, outfit: {} })).toEqual({ face: true, outfit: true });
  });
  it('infers from presence when parts missing', () => {
    expect(partsOf({ face: null, outfit: {} })).toEqual({ face: false, outfit: true });
  });
});
