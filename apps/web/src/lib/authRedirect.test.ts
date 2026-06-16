import { describe, it, expect } from 'vitest';
import { getSafeNextPath, isSupportedOtpType } from './authRedirect';

describe('getSafeNextPath', () => {
  it('returns the fallback for null/empty', () => {
    expect(getSafeNextPath(null, '/vault')).toBe('/vault');
    expect(getSafeNextPath('', '/vault')).toBe('/vault');
  });
  it('accepts a single-slash internal path', () => {
    expect(getSafeNextPath('/auth/update-password', '/vault')).toBe('/auth/update-password');
  });
  it('rejects protocol-relative, absolute and javascript URLs', () => {
    expect(getSafeNextPath('//evil.example', '/vault')).toBe('/vault');
    expect(getSafeNextPath('https://evil.example', '/vault')).toBe('/vault');
    expect(getSafeNextPath('javascript:alert(1)', '/vault')).toBe('/vault');
  });
});

describe('isSupportedOtpType', () => {
  it('accepts email and recovery', () => {
    expect(isSupportedOtpType('email')).toBe(true);
    expect(isSupportedOtpType('recovery')).toBe(true);
  });
  it('rejects unknown/empty values', () => {
    expect(isSupportedOtpType('sms')).toBe(false);
    expect(isSupportedOtpType(null)).toBe(false);
    expect(isSupportedOtpType('')).toBe(false);
  });
});
