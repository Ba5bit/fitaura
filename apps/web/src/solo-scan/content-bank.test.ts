// apps/web/src/solo-scan/content-bank.test.ts
import { describe, expect, it } from 'vitest';
import {
  scoreBand, pickFaceArchetype, pickOutfitCaption, pickPunchline, STICKER_BANK,
} from '@fitaura/shared';

describe('scoreBand', () => {
  it('maps aura to the six bands at the boundaries', () => {
    expect(scoreBand(95)).toBe('elite');
    expect(scoreBand(80)).toBe('elite');
    expect(scoreBand(79)).toBe('high');
    expect(scoreBand(65)).toBe('high');
    expect(scoreBand(50)).toBe('mid');
    expect(scoreBand(35)).toBe('low');
    expect(scoreBand(20)).toBe('poor');
    expect(scoreBand(5)).toBe('dire');
  });
});

describe('content bank', () => {
  it('picks from the band pool when no AI candidates, and resolves a real face sticker', () => {
    const a = pickFaceArchetype([], 'elite', 'scan-a');
    expect(a.line).toHaveLength(2);
    expect(STICKER_BANK.face.some((s) => s.id === a.stickerId)).toBe(true);
  });

  it('respects a valid AI candidate over the band pool', () => {
    const a = pickFaceArchetype(['face_archetype.aura_farmer'], 'dire', 'scan-a');
    expect(a.line).toEqual(['CERTIFIED', 'AURA FARMER']);
  });

  it('is deterministic for the same scan + band', () => {
    expect(pickFaceArchetype([], 'low', 'scan-z')).toEqual(pickFaceArchetype([], 'low', 'scan-z'));
    expect(pickPunchline([], 'poor', 'scan-z')).toBe(pickPunchline([], 'poor', 'scan-z'));
  });

  it('different bands can yield different lines', () => {
    const elite = pickPunchline([], 'elite', 'scan-q');
    const dire = pickPunchline([], 'dire', 'scan-q');
    expect(elite).not.toBe(dire);
  });

  it('outfit caption resolves to a real outfit sticker', () => {
    const c = pickOutfitCaption([], 'mid', 'scan-a');
    expect(STICKER_BANK.outfit.some((s) => s.id === c.stickerId)).toBe(true);
  });

  it('never throws on an empty band — falls back toward mid', () => {
    expect(() => pickFaceArchetype(['nonsense'], 'dire', 'scan-a')).not.toThrow();
  });
});
