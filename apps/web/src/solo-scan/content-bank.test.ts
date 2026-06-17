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
    expect(a.line).toEqual(['AURA', 'FARMER']);
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

describe('gendered content', () => {
  it('femme override text is used when gender is femme', () => {
    // unc carries a femme override (AUNTIE / STATUS) — see Task 4 bank.
    const masc = pickFaceArchetype(['face_archetype.unc'], 'dire', 's1', 'masc');
    const femme = pickFaceArchetype(['face_archetype.unc'], 'dire', 's1', 'femme');
    expect(masc.line).toEqual(['UNC', 'STATUS']);
    expect(femme.line).toEqual(['AUNTIE', 'STATUS']);
  });

  it('a femme scan never receives a masc-only id, even if nominated', () => {
    const a = pickFaceArchetype(['face_archetype.alpha_male'], 'high', 's2', 'femme');
    expect(a.line).not.toEqual(['ALPHA', 'MALE']); // masc-only → filtered out → band fallback
  });

  it('a masc scan never receives a femme-only id, even if nominated', () => {
    const a = pickFaceArchetype(['face_archetype.it_girl'], 'high', 's3', 'masc');
    expect(a.line).not.toEqual(['IT', 'GIRL']);
  });
});
