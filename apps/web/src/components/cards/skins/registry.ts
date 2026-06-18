import type { CardSkin, SkinKind } from './types';
import { DossierFace } from './DossierFace';
import { DossierOutfit } from './DossierOutfit';

export const CARD_SKINS: Record<SkinKind, CardSkin[]> = {
  face: [{ id: 'dossier', name: 'Dossier', Comp: DossierFace }],
  outfit: [{ id: 'dossier', name: 'Dossier', Comp: DossierOutfit }],
};

export function skinsFor(kind: SkinKind): CardSkin[] {
  return CARD_SKINS[kind];
}

/** Index of `skinId` in the kind's list, or 0 (the default) if not found. */
export function skinIndex(kind: SkinKind, skinId: string): number {
  const i = CARD_SKINS[kind].findIndex((s) => s.id === skinId);
  return i < 0 ? 0 : i;
}
