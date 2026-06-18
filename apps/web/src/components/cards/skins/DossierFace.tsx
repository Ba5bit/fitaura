import type { FaceCardContent } from '@fitaura/shared';
import { FaceCard } from '../FaceCard';
import type { SkinProps } from './types';

/** The current framed "dossier" face card, adapted to the skin contract. */
export function DossierFace({ content, stickerOn, run, roast }: SkinProps) {
  return <FaceCard content={content as FaceCardContent} stickerOn={stickerOn} run={run} roast={roast} />;
}
