import type { StickerData, StickerTone } from './result.ts';

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
    { id: 'aura-farmer', label: 'AURA FARMER', tone: 'chrome', rotation: -8 },
    { id: 'chad', label: 'CHAD', tone: 'chrome', rotation: -6 },
    { id: 'main-character', label: 'MAIN CHARACTER', tone: 'chrome', rotation: -8 },
    { id: 'goat', label: 'GOAT', tone: 'chrome', rotation: -7 },
    { id: 'mafia-boss', label: 'MAFIA BOSS', tone: 'chrome', rotation: -6 },
    { id: 'locked-in', label: 'LOCKED IN', tone: 'chrome', rotation: -7 },
    { id: 'honorable-mention', label: 'HONORABLE MENTION', tone: 'chrome', rotation: -7 },
    { id: 'delusional', label: 'DELUSIONAL', tone: 'warn', rotation: -7 },
    { id: 'chopped', label: 'CHOPPED', tone: 'warn', rotation: -8 },
    { id: 'canon-event', label: 'CANON EVENT', tone: 'warn', rotation: -6 },
    { id: 'negative-aura', label: 'NEGATIVE AURA', tone: 'warn', rotation: -7 },
    { id: 'unc', label: 'UNC STATUS', tone: 'warn', rotation: -8 },
    { id: 'ai-slop', label: 'AI SLOP', tone: 'warn', rotation: -6 },
    { id: 'alpha', label: 'ALPHA MALE', tone: 'chrome', rotation: -7 },
    { id: 'sigma', label: 'SIGMA MALE', tone: 'chrome', rotation: -6 },
    { id: 'beta', label: 'BETA MALE', tone: 'warn', rotation: -8 },
    { id: 'tate', label: 'TATE DROPOUT', tone: 'warn', rotation: -6 },
    { id: 'milf-hunter', label: 'MILF HUNTER', tone: 'chrome', rotation: -7 },
    { id: 'simp', label: 'SIMP', tone: 'warn', rotation: -8 },
    { id: 'performative-male', label: 'PERFORMATIVE MALE', tone: 'chrome', rotation: -6 },
    { id: 'mother', label: 'MOTHER', tone: 'chrome', rotation: -7 },
    { id: 'femme-fatale', label: 'FEMME FATALE', tone: 'chrome', rotation: -6 },
    { id: 'it-girl', label: 'IT GIRL', tone: 'chrome', rotation: -8 },
    { id: 'girlboss', label: 'GIRLBOSS', tone: 'chrome', rotation: -7 },
    { id: 'material-girl', label: 'MATERIAL GIRL', tone: 'chrome', rotation: -6 },
    { id: 'vip', label: 'VIP', tone: 'chrome', rotation: -8 },
    { id: 'clean-girl', label: 'CLEAN GIRL', tone: 'chrome', rotation: -7 },
    { id: 'brat', label: 'BRAT', tone: 'chrome', rotation: -6 },
    { id: 'drama-queen', label: 'DRAMA QUEEN', tone: 'warn', rotation: -7 },
  ],
  outfit: [
    { id: 'fit-has-lore', label: 'FIT HAS LORE', tone: 'chrome', rotation: 7 },
    { id: 'let-him-cook', label: 'LET HIM COOK', tone: 'chrome', rotation: 7 },
    { id: 'never-cook-again', label: 'NEVER COOK AGAIN', tone: 'warn', rotation: 7 },
    { id: 'buffering', label: 'BUFFERING', tone: 'chrome', rotation: 7 },
    { id: 'performative', label: 'PERFORMATIVE', tone: 'chrome', rotation: 6 },
    { id: 'locked-in', label: 'LOCKED IN', tone: 'chrome', rotation: 7 },
    { id: 'rizz', label: 'RIZZ ON SIGHT', tone: 'chrome', rotation: 6 },
    { id: 'delulu', label: 'DELULU', tone: 'chrome', rotation: 7 },
    { id: 'ai-slop', label: 'AI SLOP', tone: 'warn', rotation: 6 },
    { id: 'chopped', label: 'CHOPPED FIT', tone: 'warn', rotation: 7 },
    { id: 'aura-debt', label: 'AURA DEBT', tone: 'warn', rotation: 7 },
    { id: 'sigma-fit', label: 'SIGMA GRINDSET', tone: 'chrome', rotation: 7 },
    { id: 'millennial', label: 'MILLENNIAL CODED', tone: 'chrome', rotation: 6 },
    { id: 'unc-fit', label: 'UNC FIT', tone: 'warn', rotation: 7 },
    { id: 'old-money-temu', label: 'OLD MONEY (TEMU)', tone: 'warn', rotation: 6 },
    { id: 'boomer', label: 'BOOMER-CODED', tone: 'warn', rotation: 7 },
    { id: 'fashion-girl', label: 'FASHION GIRL', tone: 'chrome', rotation: 7 },
    { id: 'vip-fit', label: 'VIP LIST', tone: 'chrome', rotation: 6 },
    { id: 'material-girl-fit', label: 'MATERIAL GIRL', tone: 'chrome', rotation: 7 },
    { id: 'brat-fit', label: 'BRAT SUMMER', tone: 'chrome', rotation: 6 },
    { id: 'clean-girl-fit', label: 'CLEAN GIRL', tone: 'chrome', rotation: 7 },
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
