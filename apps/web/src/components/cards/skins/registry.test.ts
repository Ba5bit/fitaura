import { describe, expect, it } from 'vitest';
import { CARD_SKINS, skinsFor, skinIndex } from './registry';

describe('card skin registry', () => {
  it('exposes a dossier skin for face and outfit', () => {
    expect(skinsFor('face').map((s) => s.id)).toEqual(['dossier']);
    expect(skinsFor('outfit').map((s) => s.id)).toEqual(['dossier']);
    expect(CARD_SKINS.face[0].Comp).toBeTypeOf('function');
  });

  it('skinIndex finds a skin by id and clamps unknown ids to 0', () => {
    expect(skinIndex('face', 'dossier')).toBe(0);
    expect(skinIndex('face', 'nope')).toBe(0);
  });
});
