// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { hasUsedFreeScan, markFreeScanUsed, clearFreeScanUsed } from './creditsService';

describe('clearFreeScanUsed', () => {
  beforeEach(() => localStorage.clear());
  it('restores the guest free-scan flag', () => {
    markFreeScanUsed();
    expect(hasUsedFreeScan()).toBe(true);
    clearFreeScanUsed();
    expect(hasUsedFreeScan()).toBe(false);
  });
});
