import type { OutfitCardContent } from '@fitaura/shared';
import { OutfitCard } from '../OutfitCard';
import type { SkinProps } from './types';

/** The current framed "dossier" outfit card, adapted to the skin contract. */
export function DossierOutfit({ content, run, roast }: SkinProps) {
  return <OutfitCard content={content as OutfitCardContent} run={run} roast={roast} />;
}
