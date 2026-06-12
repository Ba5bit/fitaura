// apps/web/src/solo-scan/content-bank.test.ts
import { describe, expect, it } from 'vitest';
import {
  pickFaceArchetype, pickOutfitCaption, pickPunchline, STICKER_BANK,
} from '@fitaura/shared';

describe('content bank', () => {
  it('picks a valid candidate when present', () => {
    const a = pickFaceArchetype(['face_archetype.aura_farmer'], 'green_flag');
    expect(a.line).toEqual(['CERTIFIED', 'AURA FARMER']);
    expect(STICKER_BANK.face.some((s) => s.id === a.stickerId)).toBe(true);
  });

  it('falls back to the per-verdict default on an invalid candidate', () => {
    const a = pickFaceArchetype(['face_archetype.nonsense'], 'red_flag');
    expect(a.line[0]).toBe('RED FLAG');
  });

  it('outfit caption resolves to a real outfit sticker', () => {
    const c = pickOutfitCaption([], 'green_flag');
    expect(STICKER_BANK.outfit.some((s) => s.id === c.stickerId)).toBe(true);
  });

  it('punchline falls back per verdict', () => {
    expect(pickPunchline([], 'green_flag')).toBe('CERTIFIED LOVER BOY');
    expect(pickPunchline(['punchline.nope'], 'red_flag')).toBe('RED FLAG WITH GOOD ANGLES');
  });
});
