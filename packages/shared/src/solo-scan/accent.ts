// packages/shared/src/solo-scan/accent.ts
// Legibility-clamped accent for the Nameplate outfit card. Gemini returns a hex
// matched to the fit's palette; we KEEP its hue (vibe-matched) but pull
// saturation/lightness into a band that reads on the dark card and bars. A
// near-gray (no usable hue) or unparseable value falls back to the gender accent.

type Gender = 'femme' | 'masc';

const FALLBACK: Record<Gender, string> = { masc: '#83b4ff', femme: '#ff52a6' };

const S_MIN = 0.5;
const S_MAX = 0.95;
// Band edges nudged ~0.002 inward so the HSL→8-bit-hex round-trip can't quantize
// the result back outside the legible lightness band.
const L_MIN = 0.582;
const L_MAX = 0.738;
const GRAY_S = 0.12; // below this there is no usable hue

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function parseRgb(raw: string): [number, number, number] | null {
  if (typeof raw !== 'string') return null;
  let h = raw.trim().replace(/^#/, '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Parse a hex color to HSL (each channel 0–1), or null if unparseable. */
export function hexToHsl(raw: string): [number, number, number] | null {
  const rgb = parseRgb(raw);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  let h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  const seg = Math.floor(h * 6) % 6;
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

/** Clamp a raw accent hex into the legible band, keeping hue; fall back per gender. */
export function clampAccent(raw: string, gender: Gender): string {
  const fallback = FALLBACK[gender];
  const hsl = hexToHsl(raw);
  if (!hsl) return fallback;
  const [h, s, l] = hsl;
  if (s < GRAY_S) return fallback;
  return hslToHex(h, clamp(s, S_MIN, S_MAX), clamp(l, L_MIN, L_MAX));
}
