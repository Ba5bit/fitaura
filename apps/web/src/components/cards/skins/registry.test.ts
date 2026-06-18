import { describe, expect, it } from 'vitest';
import { CARD_SKINS, skinsFor, skinIndex } from './registry';

describe('card skin registry', () => {
  it('exposes the dossier + clean skins for face and outfit', () => {
    expect(skinsFor('face').map((s) => s.id)).toEqual(['dossier', 'clean']);
    expect(skinsFor('outfit').map((s) => s.id)).toEqual(['dossier', 'clean']);
    expect(CARD_SKINS.face[0].Comp).toBeTypeOf('function');
    expect(CARD_SKINS.face[1].Comp).toBeTypeOf('function');
  });

  it('skinIndex finds a skin by id and clamps unknown ids to 0', () => {
    expect(skinIndex('face', 'dossier')).toBe(0);
    expect(skinIndex('face', 'clean')).toBe(1);
    expect(skinIndex('face', 'nope')).toBe(0);
  });
});
