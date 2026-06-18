import type { OutfitCardContent } from '@fitaura/shared';
import { OutfitCard } from '../OutfitCard';
import type { SkinProps } from './types';

/** The current framed "dossier" outfit card, adapted to the skin contract. */
export function DossierOutfit({ content, stickerOn, run, roast }: SkinProps) {
  return <OutfitCard content={content as OutfitCardContent} stickerOn={stickerOn} run={run} roast={roast} />;
}
