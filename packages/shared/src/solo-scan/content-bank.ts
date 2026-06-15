// packages/shared/src/solo-scan/content-bank.ts
import { hashSeed } from './scoring.ts';

/** Six display bands derived from the Aura Index, finer than the 3 dating verdicts. */
export type ScoreBand = 'elite' | 'high' | 'mid' | 'low' | 'poor' | 'dire';

export function scoreBand(aura: number): ScoreBand {
  if (aura >= 80) return 'elite';
  if (aura >= 65) return 'high';
  if (aura >= 50) return 'mid';
  if (aura >= 35) return 'low';
  if (aura >= 20) return 'poor';
  return 'dire';
}

/** Deterministic element from `items` keyed by `seed` (stable across re-renders). */
function seededPick<T>(items: T[], seed: string): T {
  return items[hashSeed(seed) % items.length];
}

const BAND_ORDER: ScoreBand[] = ['dire', 'poor', 'low', 'mid', 'high', 'elite'];

interface Banded { band: ScoreBand; }

function groupByBand<T extends Banded>(bank: Record<string, T>): Record<ScoreBand, string[]> {
  const out: Record<ScoreBand, string[]> = { elite: [], high: [], mid: [], low: [], poor: [], dire: [] };
  for (const [id, e] of Object.entries(bank)) out[e.band].push(id);
  return out;
}

/** The band's own pool, else walk toward `mid` and continue past it to the far end
 * until a non-empty band is found. A defensive fallback — every band is currently
 * populated, so the first line always returns. */
function poolFor(byBand: Record<ScoreBand, string[]>, band: ScoreBand): string[] {
  if (byBand[band].length) return byBand[band];
  const here = BAND_ORDER.indexOf(band);
  const mid = BAND_ORDER.indexOf('mid');
  const step = here < mid ? 1 : -1;
  for (let i = here + step; i >= 0 && i < BAND_ORDER.length; i += step) {
    if (byBand[BAND_ORDER[i]].length) return byBand[BAND_ORDER[i]];
  }
  return Object.values(byBand).flat();
}

/** Valid AI candidate (seeded pick among them), else a seeded pick from the band pool. */
function pickBanded<T extends Banded>(
  candidates: string[] | undefined,
  bank: Record<string, T>,
  byBand: Record<ScoreBand, string[]>,
  band: ScoreBand,
  scanId: string,
  poolKey: string,
): T {
  const valid = (candidates ?? []).filter((c) => c in bank);
  const pool = valid.length ? valid : poolFor(byBand, band);
  const id = seededPick(pool, `${scanId}:${poolKey}:${band}`);
  const result = bank[id];
  if (result === undefined) throw new Error(`[content-bank] empty pool for "${poolKey}" band "${band}"`);
  return result;
}

/* --- Face archetype → card verdict line + face sticker id --- */
export interface FaceArchetype { line: [string, string]; stickerId: string; }
interface FaceEntry extends FaceArchetype, Banded {}
const FACE_BANK: Record<string, FaceEntry> = {
  'face_archetype.goat': { line: ['CERTIFIED', 'GOAT'], stickerId: 'goat', band: 'elite' },
  'face_archetype.mafia_boss': { line: ['CERTIFIED', 'MAFIA BOSS'], stickerId: 'mafia-boss', band: 'elite' },
  'face_archetype.main_character': { line: ['MAIN', 'CHARACTER'], stickerId: 'main-character', band: 'high' },
  'face_archetype.aura_farmer': { line: ['CERTIFIED', 'AURA FARMER'], stickerId: 'aura-farmer', band: 'high' },
  'face_archetype.locked_in': { line: ['LOCKED', 'IN'], stickerId: 'locked-in', band: 'high' },
  'face_archetype.plot_relevant': { line: ['CLEAN NPC', 'PLOT RELEVANT'], stickerId: 'plot-relevant', band: 'mid' },
  'face_archetype.honorable_mention': { line: ['HONORABLE', 'MENTION'], stickerId: 'honorable-mention', band: 'mid' },
  'face_archetype.red_flag_good_angles': { line: ['RED FLAG', 'WITH GOOD ANGLES'], stickerId: 'hear-me-out', band: 'low' },
  'face_archetype.delusional': { line: ['DELUSIONAL', 'BUT CONFIDENT'], stickerId: 'delusional', band: 'low' },
  'face_archetype.chopped': { line: ['ABSOLUTELY', 'CHOPPED'], stickerId: 'chopped', band: 'poor' },
  'face_archetype.canon_event': { line: ['CANON', 'EVENT'], stickerId: 'canon-event', band: 'poor' },
  'face_archetype.ai_slop': { line: ['CERTIFIED', 'AI SLOP'], stickerId: 'ai-slop', band: 'poor' },
  'face_archetype.negative_aura': { line: ['NEGATIVE', 'AURA'], stickerId: 'negative-aura', band: 'dire' },
  'face_archetype.unc': { line: ['UNC', 'STATUS'], stickerId: 'unc', band: 'dire' },
};
const FACE_BY_BAND = groupByBand(FACE_BANK);
export function pickFaceArchetype(candidates: string[] | undefined, band: ScoreBand, scanId: string): FaceArchetype {
  return pickBanded(candidates, FACE_BANK, FACE_BY_BAND, band, scanId, 'face');
}

/* --- Outfit caption → card caption + outfit sticker id --- */
export interface OutfitCaption { caption: string; stickerId: string; }
interface OutfitEntry extends OutfitCaption, Banded {}
const OUTFIT_BANK: Record<string, OutfitEntry> = {
  'outfit_caption.locked_in': { caption: 'THE FIT IS LOCKED IN', stickerId: 'locked-in', band: 'elite' },
  'outfit_caption.let_him_cook': { caption: 'LET HIM COOK', stickerId: 'let-him-cook', band: 'elite' },
  'outfit_caption.fit_has_lore': { caption: 'THE FIT HAS LORE', stickerId: 'fit-has-lore', band: 'high' },
  'outfit_caption.rizz': { caption: 'RIZZ ON SIGHT', stickerId: 'rizz', band: 'high' },
  'outfit_caption.clean_npc_potential': { caption: 'CLEAN NPC WITH POTENTIAL', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.performative': { caption: 'PERFORMATIVE EDITORIAL', stickerId: 'performative', band: 'mid' },
  'outfit_caption.delulu': { caption: 'DELULU BUT WORKING', stickerId: 'delulu', band: 'low' },
  'outfit_caption.ai_slop': { caption: 'CERTIFIED AI SLOP', stickerId: 'ai-slop', band: 'poor' },
  'outfit_caption.chopped': { caption: 'CHOPPED FIT', stickerId: 'chopped', band: 'poor' },
  'outfit_caption.never_cook_again': { caption: 'NEVER COOK AGAIN', stickerId: 'never-cook-again', band: 'dire' },
  'outfit_caption.aura_debt': { caption: 'IN AURA DEBT', stickerId: 'aura-debt', band: 'dire' },
};
const OUTFIT_BY_BAND = groupByBand(OUTFIT_BANK);
export function pickOutfitCaption(candidates: string[] | undefined, band: ScoreBand, scanId: string): OutfitCaption {
  return pickBanded(candidates, OUTFIT_BANK, OUTFIT_BY_BAND, band, scanId, 'outfit');
}

/* --- Punchline → final viral line --- */
interface PunchlineEntry extends Banded { text: string; }
const PUNCHLINE_BANK: Record<string, PunchlineEntry> = {
  'punchline.certified_goat': { text: 'CERTIFIED GOAT', band: 'elite' },
  'punchline.built_different': { text: 'BUILT DIFFERENT', band: 'elite' },
  'punchline.certified_lover_boy': { text: 'CERTIFIED LOVER BOY', band: 'high' },
  'punchline.rizz_god': { text: 'RIZZ GOD CONFIRMED', band: 'high' },
  'punchline.aura_farmer': { text: 'CERTIFIED AURA FARMER', band: 'high' },
  'punchline.clean_npc_potential': { text: 'NPC WITH POTENTIAL', band: 'mid' },
  'punchline.honorable_mention': { text: 'HONORABLE MENTION', band: 'mid' },
  'punchline.high_aura_low_stability': { text: 'RED FLAG ON REMISSION', band: 'low' },
  'punchline.delusional_lover_boy': { text: 'DELUSIONAL LOVER BOY', band: 'low' },
  'punchline.negative_aura': { text: 'NEGATIVE AURA DETECTED', band: 'poor' },
  'punchline.ai_slop': { text: 'DOCUMENTED AI SLOP', band: 'poor' },
  'punchline.aura_debt': { text: 'IN AURA DEBT', band: 'dire' },
  'punchline.canon_chopped': { text: 'CANON EVENT', band: 'dire' },
};
const PUNCHLINE_BY_BAND = groupByBand(PUNCHLINE_BANK);
export function pickPunchline(candidates: string[] | undefined, band: ScoreBand, scanId: string): string {
  return pickBanded(candidates, PUNCHLINE_BANK, PUNCHLINE_BY_BAND, band, scanId, 'punchline').text;
}
