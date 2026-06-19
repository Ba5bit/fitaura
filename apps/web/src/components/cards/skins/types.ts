import type { DatingVerdict, FaceCardContent, OutfitCardContent, StickerData } from '@fitaura/shared';

export type SkinKind = 'face' | 'outfit';

/** Uniform props every card skin accepts, so skins are interchangeable. */
export interface SkinProps {
  content: FaceCardContent | OutfitCardContent;
  /** The generation's categorical verdict — drives skin flavor where needed. */
  verdict: DatingVerdict;
  gender: 'femme' | 'masc';
  /** Built-in sticker visibility (the editable overlay renders the real one). */
  stickerOn: boolean;
  /** Entrance animation on the active (front) card only. */
  run: boolean;
  /** One-line roast shown under the verdict. */
  roast?: string;
  /** Dimmed, non-interactive peeking card in the stack. */
  preview?: boolean;
  /** The currently selected sticker preset (skins may render a default badge;
   * the Dossier skin ignores it — the Result page overlays the editable one). */
  sticker?: StickerData;
}

export interface CardSkin {
  id: string;
  name: string;
  Comp: React.FC<SkinProps>;
}
