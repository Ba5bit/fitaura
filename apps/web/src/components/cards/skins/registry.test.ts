import { describe, expect, it } from 'vitest';
import { CARD_SKINS, skinsFor, skinIndex } from './registry';

describe('card skin registry', () => {
  it('exposes the dossier + clean + lore skins for face and outfit', () => {
    expect(skinsFor('face').map((s) => s.id)).toEqual(['dossier', 'clean', 'lore']);
    expect(skinsFor('outfit').map((s) => s.id)).toEqual(['dossier', 'clean', 'lore']);
    expect(CARD_SKINS.face.every((s) => typeof s.Comp === 'function')).toBe(true);
  });

  it('skinIndex finds a skin by id and clamps unknown ids to 0', () => {
    expect(skinIndex('face', 'dossier')).toBe(0);
    expect(skinIndex('face', 'clean')).toBe(1);
    expect(skinIndex('face', 'lore')).toBe(2);
    expect(skinIndex('face', 'nope')).toBe(0);
  });
});
