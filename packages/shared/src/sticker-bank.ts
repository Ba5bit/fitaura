import type { StickerData, StickerTone } from './result';

/** A sticker preset before it is bound to a card (no `hidden`/`id` state). */
export interface StickerPreset {
  id: string;
  label: string;
  tone: StickerTone;
  rotation: number;
}

/**
 * The swappable sticker banks the result page cycles through. Kept in shared so
 * both the mock data and the UI controls reference one source of truth.
 */
export const STICKER_BANK: {
  face: StickerPreset[];
  outfit: StickerPreset[];
} = {
  face: [
    { id: 'hear-me-out', label: 'HEAR ME OUT', tone: 'warn', rotation: -8 },
    { id: 'plot-relevant', label: 'PLOT RELEVANT', tone: 'chrome', rotation: -8 },
    { id: 'aura-farmer', label: 'AURA FARMER', tone: 'accent', rotation: -8 },
    { id: 'chad', label: 'CHAD', tone: 'accent', rotation: -6 },
    { id: 'main-character', label: 'MAIN CHARACTER', tone: 'chrome', rotation: -8 },
  ],
  outfit: [
    { id: 'fit-has-lore', label: 'FIT HAS LORE', tone: 'accent', rotation: 7 },
    { id: 'let-him-cook', label: 'LET HIM COOK', tone: 'accent', rotation: 7 },
    { id: 'never-cook-again', label: 'NEVER COOK AGAIN', tone: 'warn', rotation: 7 },
    { id: 'buffering', label: 'BUFFERING', tone: 'chrome', rotation: 7 },
    { id: 'performative', label: 'PERFORMATIVE', tone: 'chrome', rotation: 6 },
  ],
};

export type StickerKind = keyof typeof STICKER_BANK;

/** Bind a preset into live card sticker state. */
export function stickerFromPreset(
  preset: StickerPreset,
  hidden = false,
): StickerData {
  return {
    id: preset.id,
    label: preset.label,
    tone: preset.tone,
    rotation: preset.rotation,
    hidden,
  };
}
