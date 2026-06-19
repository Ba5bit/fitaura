import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, creditsForPack, ALLOWED_ORIGINS } from '@fitaura/shared';

describe('isAllowedOrigin', () => {
  it('accepts the production and local-dev origins', () => {
    expect(isAllowedOrigin('https://fitaura.studio')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });
  it('rejects anything else and nullish input', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('http://fitaura.studio')).toBe(false); // wrong scheme
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
  it('exposes the allowlist', () => {
    expect(ALLOWED_ORIGINS).toContain('https://fitaura.studio');
  });
});

describe('creditsForPack', () => {
  it('returns the credit count for a known pack', () => {
    expect(creditsForPack('starter')).toBe(10);
    expect(creditsForPack('regular')).toBe(30);
    expect(creditsForPack('group')).toBe(80);
  });
  it('returns undefined for an unknown pack', () => {
    expect(creditsForPack('nope')).toBeUndefined();
  });
});
