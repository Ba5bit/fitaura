import { describe, expect, it } from 'vitest';
import { qrMatrix, SITE_URL } from './qr';

describe('qrMatrix', () => {
  it('encodes the site url as a square grid with the QR finder pattern', () => {
    const m = qrMatrix(SITE_URL);
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(m[0][0]).toBe(true);
    expect(m[0][6]).toBe(true);
    expect(m[1][1]).toBe(false);
    expect(m[3][3]).toBe(true);
  });

  it('is deterministic for the same input', () => {
    expect(qrMatrix('hello')).toEqual(qrMatrix('hello'));
  });

  it('differs for different input', () => {
    expect(qrMatrix('a')).not.toEqual(qrMatrix('b'));
  });

  it('points at the configured site', () => {
    expect(SITE_URL).toBe('https://fitaura.studio/');
  });
});
