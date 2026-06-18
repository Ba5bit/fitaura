import type { CardSkin, SkinKind } from './types';
import { DossierFace } from './DossierFace';
import { DossierOutfit } from './DossierOutfit';
import { CleanFace } from './CleanFace';
import { CleanOutfit } from './CleanOutfit';
import { LoreFace } from './LoreFace';
import { LoreOutfit } from './LoreOutfit';

export const CARD_SKINS: Record<SkinKind, CardSkin[]> = {
  face: [
    { id: 'dossier', name: 'Dossier', Comp: DossierFace },
    { id: 'clean', name: 'Clean', Comp: CleanFace },
    { id: 'lore', name: 'Lore', Comp: LoreFace },
  ],
  outfit: [
    { id: 'dossier', name: 'Dossier', Comp: DossierOutfit },
    { id: 'clean', name: 'Clean', Comp: CleanOutfit },
    { id: 'lore', name: 'Lore', Comp: LoreOutfit },
  ],
};

export function skinsFor(kind: SkinKind): CardSkin[] {
  return CARD_SKINS[kind];
}

/** Index of `skinId` in the kind's list, or 0 (the default) if not found. */
export function skinIndex(kind: SkinKind, skinId: string): number {
  const i = CARD_SKINS[kind].findIndex((s) => s.id === skinId);
  return i < 0 ? 0 : i;
}
