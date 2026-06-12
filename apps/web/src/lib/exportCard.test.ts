import { describe, expect, it } from 'vitest';
import { solidify } from './exportCard';

describe('solidify', () => {
  it('raises a thin translucent background toward opaque (the score-badge case)', () => {
    // .score-badge uses rgba(6,7,10,.55) + backdrop-filter; export drops the blur.
    expect(solidify('rgba(6, 7, 10, 0.55)')).toBe('rgba(6, 7, 10, 0.90)');
  });

  it('leaves already-opaque-enough backgrounds untouched', () => {
    expect(solidify('rgba(6, 7, 10, 0.9)')).toBe('rgba(6, 7, 10, 0.9)');
    expect(solidify('rgb(10, 12, 17)')).toBe('rgb(10, 12, 17)');
  });

  it('passes through non-rgb values (gradients, named colors) unchanged', () => {
    expect(solidify('transparent')).toBe('transparent');
    expect(solidify('linear-gradient(170deg, #000, #111)')).toBe('linear-gradient(170deg, #000, #111)');
  });
});
