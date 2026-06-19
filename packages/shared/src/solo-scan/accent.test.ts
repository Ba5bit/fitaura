import { describe, expect, it } from 'vitest';
import { clampAccent, hexToHsl } from './accent.ts';

const MASC = '#83b4ff';
const FEMME = '#ff52a6';

describe('clampAccent', () => {
  it('keeps a usable hue and pulls saturation/lightness into the legible band', () => {
    const out = clampAccent('#2a64b8', 'masc'); // deep but saturated blue
    const hsl = hexToHsl(out)!;
    expect(hsl[1]).toBeGreaterThanOrEqual(0.499);
    expect(hsl[1]).toBeLessThanOrEqual(0.951);
    expect(hsl[2]).toBeGreaterThanOrEqual(0.579);
    expect(hsl[2]).toBeLessThanOrEqual(0.741);
    // hue preserved (within rounding tolerance) — vibe-matched
    const inHue = hexToHsl('#2a64b8')![0];
    expect(Math.abs(hsl[0] - inHue)).toBeLessThan(0.02);
  });

  it('lightens a too-dark color into the band (keeps hue)', () => {
    const out = clampAccent('#0a0f1e', 'masc');
    expect(out).not.toBe('#0a0f1e');
    expect(hexToHsl(out)![2]).toBeGreaterThanOrEqual(0.579);
  });

  it('darkens a too-light color into the band', () => {
    const out = clampAccent('#eef3ff', 'masc');
    expect(hexToHsl(out)![2]).toBeLessThanOrEqual(0.741);
  });

  it('falls back to the gender accent for a near-gray (no usable hue)', () => {
    expect(clampAccent('#222222', 'masc')).toBe(MASC);
    expect(clampAccent('#cccccc', 'femme')).toBe(FEMME);
  });

  it('falls back for invalid/empty input', () => {
    expect(clampAccent('nope', 'masc')).toBe(MASC);
    expect(clampAccent('', 'femme')).toBe(FEMME);
    expect(clampAccent('#12', 'masc')).toBe(MASC);
  });

  it('accepts 3-digit hex and a missing leading #', () => {
    expect(clampAccent('f00', 'masc')).toMatch(/^#[0-9a-f]{6}$/);
    expect(hexToHsl('#f00')).not.toBeNull();
  });
});
