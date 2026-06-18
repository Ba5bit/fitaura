import { describe, expect, it } from 'vitest';
import { stickersFor } from '@fitaura/shared';

describe('stickersFor', () => {
  it('hides masc-only stickers from femme and femme-only from masc', () => {
    const femmeFace = stickersFor('face', 'femme').map((s) => s.id);
    const mascFace = stickersFor('face', 'masc').map((s) => s.id);
    // femme-only
    expect(femmeFace).toContain('girlboss');
    expect(mascFace).not.toContain('girlboss');
    // masc-only
    expect(mascFace).toContain('alpha');
    expect(femmeFace).not.toContain('alpha');
  });

  it('keeps neutral stickers for both genders', () => {
    expect(stickersFor('face', 'femme').map((s) => s.id)).toContain('hear-me-out');
    expect(stickersFor('face', 'masc').map((s) => s.id)).toContain('hear-me-out');
  });

  it('filters delulu (femme) out of the masc outfit bank', () => {
    expect(stickersFor('outfit', 'masc').map((s) => s.id)).not.toContain('delulu');
    expect(stickersFor('outfit', 'femme').map((s) => s.id)).toContain('delulu');
  });

  it('applies femme label overrides on neutral stickers', () => {
    const femmeOutfit = stickersFor('outfit', 'femme');
    expect(femmeOutfit.find((s) => s.id === 'let-him-cook')!.label).toBe('LET HER COOK');
    const mascOutfit = stickersFor('outfit', 'masc');
    expect(mascOutfit.find((s) => s.id === 'let-him-cook')!.label).toBe('LET HIM COOK');
  });
});
