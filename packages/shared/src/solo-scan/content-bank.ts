// packages/shared/src/solo-scan/content-bank.ts
import type { DatingVerdict } from '../verdict';

/** First candidate that exists in `bank`, else the fallback id's entry. */
function pick<T>(candidates: string[] | undefined, bank: Record<string, T>, fallbackId: string): T {
  const id = (candidates ?? []).find((c) => c in bank) ?? fallbackId;
  const result = bank[id] ?? bank[fallbackId];
  // Fail loud if a per-verdict default is ever misconfigured, rather than
  // letting `undefined` surface as a blank card downstream.
  if (result === undefined) throw new Error(`[content-bank] fallback "${fallbackId}" not found in bank`);
  return result;
}

/* --- Face archetype → card verdict line + face sticker id (real STICKER_BANK.face ids) --- */
export interface FaceArchetype {
  line: [string, string];
  stickerId: string;
}
const FACE_ARCHETYPES: Record<string, FaceArchetype> = {
  'face_archetype.aura_farmer': { line: ['CERTIFIED', 'AURA FARMER'], stickerId: 'aura-farmer' },
  'face_archetype.main_character_intern': { line: ['CERTIFIED', 'MAIN CHARACTER'], stickerId: 'main-character' },
  'face_archetype.chad': { line: ['CERTIFIED', 'CHAD'], stickerId: 'chad' },
  'face_archetype.plot_relevant': { line: ['CLEAN NPC', 'PLOT RELEVANT'], stickerId: 'plot-relevant' },
  'face_archetype.red_flag_good_angles': { line: ['RED FLAG', 'WITH GOOD ANGLES'], stickerId: 'hear-me-out' },
};
const FACE_DEFAULT: Record<DatingVerdict, string> = {
  green_flag: 'face_archetype.main_character_intern',
  normie: 'face_archetype.plot_relevant',
  red_flag: 'face_archetype.red_flag_good_angles',
};
export function pickFaceArchetype(candidates: string[] | undefined, verdict: DatingVerdict): FaceArchetype {
  return pick(candidates, FACE_ARCHETYPES, FACE_DEFAULT[verdict]);
}

/* --- Outfit caption → card caption + outfit sticker id (real STICKER_BANK.outfit ids) --- */
export interface OutfitCaption {
  caption: string;
  stickerId: string;
}
const OUTFIT_CAPTIONS: Record<string, OutfitCaption> = {
  'outfit_caption.let_him_cook': { caption: 'LET HIM COOK', stickerId: 'let-him-cook' },
  'outfit_caption.fit_has_lore': { caption: 'THE FIT HAS LORE', stickerId: 'fit-has-lore' },
  'outfit_caption.clean_npc_potential': { caption: 'CLEAN NPC WITH POTENTIAL', stickerId: 'buffering' },
  'outfit_caption.performative': { caption: 'PERFORMATIVE EDITORIAL', stickerId: 'performative' },
  'outfit_caption.never_cook_again': { caption: 'NEVER COOK AGAIN', stickerId: 'never-cook-again' },
};
const OUTFIT_DEFAULT: Record<DatingVerdict, string> = {
  green_flag: 'outfit_caption.let_him_cook',
  normie: 'outfit_caption.clean_npc_potential',
  red_flag: 'outfit_caption.never_cook_again',
};
export function pickOutfitCaption(candidates: string[] | undefined, verdict: DatingVerdict): OutfitCaption {
  return pick(candidates, OUTFIT_CAPTIONS, OUTFIT_DEFAULT[verdict]);
}

/* --- Punchline → final viral line --- */
const PUNCHLINES: Record<string, string> = {
  'punchline.certified_lover_boy': 'CERTIFIED LOVER BOY',
  'punchline.high_aura_low_stability': 'RED FLAG WITH GOOD ANGLES',
  'punchline.clean_npc_potential': 'CLEAN NPC WITH POTENTIAL',
  'punchline.aura_farmer': 'CERTIFIED AURA FARMER',
};
const PUNCHLINE_DEFAULT: Record<DatingVerdict, string> = {
  green_flag: 'punchline.certified_lover_boy',
  normie: 'punchline.clean_npc_potential',
  red_flag: 'punchline.high_aura_low_stability',
};
export function pickPunchline(candidates: string[] | undefined, verdict: DatingVerdict): string {
  return pick(candidates, PUNCHLINES, PUNCHLINE_DEFAULT[verdict]);
}
