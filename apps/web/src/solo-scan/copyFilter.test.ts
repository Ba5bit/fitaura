import { describe, expect, it } from 'vitest';
import { isCliche, scrubName, acceptWritten } from '@fitaura/shared';

describe('isCliche', () => {
  it('flags the banned patterns', () => {
    for (const t of ['Giving CEO', "it's giving lawyer", 'main villain vibes', 'rizz energy', 'the fit has lore', 'certified menace', 'a true cultural reset', 'beauty in human form', 'serving looks', 'old-money-coded']) {
      expect(isCliche(t)).toBe(true);
    }
  });
  it('passes grounded lines', () => {
    for (const t of ['JAW DID THE TALKING', 'KING OF POP', 'SUUUIII', 'STRUCTURE OVER FLASH']) {
      expect(isCliche(t)).toBe(false);
    }
  });
});

describe('scrubName', () => {
  it('removes the literal name, case-insensitive, collapsing space', () => {
    expect(scrubName('Michael Jackson moonwalks in', 'Michael Jackson')).toBe('moonwalks in');
    expect(scrubName('pure MCLOVIN energy', 'McLovin')).toBe('pure energy');
  });
  it('is a no-op when name is null or absent', () => {
    expect(scrubName('clean fit', null)).toBe('clean fit');
    expect(scrubName('clean fit', 'Ronaldo')).toBe('clean fit');
  });
});

describe('acceptWritten', () => {
  const cap = 18;
  it('returns the trimmed line when valid', () => {
    expect(acceptWritten('  JAW DID  ', cap, null)).toBe('JAW DID');
  });
  it('returns null for empty, too-long, or cliché', () => {
    expect(acceptWritten('', cap, null)).toBeNull();
    expect(acceptWritten('   ', cap, null)).toBeNull();
    expect(acceptWritten('THIS LINE IS WAY TOO LONG TO FIT', cap, null)).toBeNull();
    expect(acceptWritten('GIVING BANKER', cap, null)).toBeNull();
  });
  it('returns null when scrubbing the icon name empties it', () => {
    expect(acceptWritten('McLovin', cap, 'McLovin')).toBeNull();
  });
});
