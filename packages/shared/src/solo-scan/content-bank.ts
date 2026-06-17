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

export type ContentGender = 'femme' | 'masc' | 'unsure';

interface Banded { band: ScoreBand; gender?: 'masc' | 'femme'; }

/** An entry is eligible for a scan's gender: neutral (untagged) always; a femme scan
 * gets femme-tagged; a masc/unsure scan gets masc-tagged. */
function eligibleFor(entry: Banded, g: ContentGender): boolean {
  if (!entry.gender) return true;
  return g === 'femme' ? entry.gender === 'femme' : entry.gender === 'masc';
}

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

/** Valid AI candidate (gender-eligible, seeded pick among them), else a seeded pick from the
 * gender-filtered band pool. */
function pickBanded<T extends Banded>(
  candidates: string[] | undefined,
  bank: Record<string, T>,
  band: ScoreBand,
  scanId: string,
  poolKey: string,
  gender: ContentGender,
): T {
  const valid = (candidates ?? []).filter((c) => c in bank && eligibleFor(bank[c], gender));
  const eligibleBank: Record<string, T> = {};
  for (const [id, e] of Object.entries(bank)) if (eligibleFor(e, gender)) eligibleBank[id] = e;
  const byBand = groupByBand(eligibleBank);
  const pool = valid.length ? valid : poolFor(byBand, band);
  const id = seededPick(pool, `${scanId}:${poolKey}:${band}`);
  const result = bank[id];
  if (result === undefined) throw new Error(`[content-bank] empty pool for "${poolKey}" band "${band}"`);
  return result;
}

/* --- Face archetype → card verdict line + face sticker id --- */
export interface FaceArchetype { line: [string, string]; stickerId: string; }
interface FaceEntry extends FaceArchetype, Banded { femme?: [string, string]; }
const FACE_BANK: Record<string, FaceEntry> = {
  'face_archetype.goat': { line: ['THE', 'GOAT'], stickerId: 'goat', band: 'elite' },
  'face_archetype.mafia_boss': { line: ['MAFIA', 'BOSS'], stickerId: 'mafia-boss', band: 'elite' },
  'face_archetype.main_character': { line: ['MAIN', 'CHARACTER'], stickerId: 'main-character', band: 'high' },
  'face_archetype.aura_farmer': { line: ['AURA', 'FARMER'], stickerId: 'aura-farmer', band: 'high' },
  'face_archetype.locked_in': { line: ['LOCKED', 'IN'], stickerId: 'locked-in', band: 'high' },
  'face_archetype.honorable_mention': { line: ['HONORABLE', 'MENTION'], stickerId: 'honorable-mention', band: 'mid' },
  'face_archetype.chopped': { line: ['ABSOLUTELY', 'CHOPPED'], stickerId: 'chopped', band: 'poor' },
  'face_archetype.canon_event': { line: ['CANON', 'EVENT'], stickerId: 'canon-event', band: 'poor' },
  'face_archetype.ai_slop': { line: ['AI', 'SLOP'], stickerId: 'ai-slop', band: 'poor' },
  'face_archetype.negative_aura': { line: ['NEGATIVE', 'AURA'], stickerId: 'negative-aura', band: 'dire' },
  'face_archetype.unc': { line: ['UNC', 'STATUS'], stickerId: 'unc', band: 'dire', femme: ['AUNTIE', 'STATUS'] },
  // --- masc-only ---
  'face_archetype.gigachad': { line: ['GIGA', 'CHAD'], stickerId: 'chad', band: 'elite', gender: 'masc' },
  'face_archetype.alpha_male': { line: ['ALPHA', 'MALE'], stickerId: 'alpha', band: 'high', gender: 'masc' },
  'face_archetype.sigma_male': { line: ['SIGMA', 'MALE'], stickerId: 'sigma', band: 'high', gender: 'masc' },
  'face_archetype.milf_hunter': { line: ['POTENTIAL', 'MILF HUNTER'], stickerId: 'milf-hunter', band: 'mid', gender: 'masc' },
  'face_archetype.performative_male': { line: ['PERFORMATIVE', 'MALE'], stickerId: 'performative-male', band: 'mid', gender: 'masc' },
  'face_archetype.simp': { line: ['LOWKEY', 'SIMP'], stickerId: 'simp', band: 'low', gender: 'masc' },
  'face_archetype.beta_male': { line: ['BETA', 'MALE'], stickerId: 'beta', band: 'poor', gender: 'masc' },
  'face_archetype.tate_follower': { line: ['TATE ACADEMY', 'DROPOUT'], stickerId: 'tate', band: 'poor', gender: 'masc' },
  // --- femme-only ---
  'face_archetype.mother': { line: ['SHE IS', 'MOTHER'], stickerId: 'mother', band: 'elite', gender: 'femme' },
  'face_archetype.it_girl': { line: ['IT', 'GIRL'], stickerId: 'it-girl', band: 'high', gender: 'femme' },
  'face_archetype.girlboss': { line: ['TOTAL', 'GIRLBOSS'], stickerId: 'girlboss', band: 'high', gender: 'femme' },
  'face_archetype.material_girl': { line: ['MATERIAL', 'GIRL'], stickerId: 'material-girl', band: 'high', gender: 'femme' },
  'face_archetype.vip': { line: ['VIP', 'ENERGY'], stickerId: 'vip', band: 'high', gender: 'femme' },
  'face_archetype.clean_girl': { line: ['CLEAN', 'GIRL'], stickerId: 'clean-girl', band: 'mid', gender: 'femme' },
  'face_archetype.brat': { line: ['PURE', 'BRAT'], stickerId: 'brat', band: 'mid', gender: 'femme' },
  'face_archetype.drama_queen': { line: ['DRAMA', 'QUEEN'], stickerId: 'drama-queen', band: 'low', gender: 'femme' },
};
export function pickFaceArchetype(
  candidates: string[] | undefined, band: ScoreBand, scanId: string, gender: ContentGender = 'unsure',
): FaceArchetype {
  const e = pickBanded(candidates, FACE_BANK, band, scanId, 'face', gender);
  const line = gender === 'femme' && e.femme ? e.femme : e.line;
  return { line, stickerId: e.stickerId };
}

/* --- Outfit caption → card caption + outfit sticker id --- */
export interface OutfitCaption { caption: string; stickerId: string; }
interface OutfitEntry extends OutfitCaption, Banded { femme?: string; }
const OUTFIT_BANK: Record<string, OutfitEntry> = {
  'outfit_caption.locked_in': { caption: 'LOCKED IN', stickerId: 'locked-in', band: 'elite' },
  'outfit_caption.let_him_cook': { caption: 'LET HIM COOK', stickerId: 'let-him-cook', band: 'elite', femme: 'LET HER COOK' },
  'outfit_caption.fit_has_lore': { caption: 'THE FIT HAS LORE', stickerId: 'fit-has-lore', band: 'high' },
  'outfit_caption.rizz': { caption: 'RIZZ ON SIGHT', stickerId: 'rizz', band: 'high' },
  'outfit_caption.plays_it_safe': { caption: 'PLAYS IT SAFE', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.not_dripping': { caption: 'DRESSED, NOT DRIPPING', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.shows_up': { caption: "SHOWS UP, DOESN'T SHOW OFF", stickerId: 'buffering', band: 'mid' },
  'outfit_caption.not_dangerous': { caption: 'DECENT, NOT DANGEROUS', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.not_remarkable': { caption: 'RESPECTABLE, NOT REMARKABLE', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.room_to_grow': { caption: 'ROOM TO GROW', stickerId: 'buffering', band: 'mid' },
  'outfit_caption.delulu': { caption: 'DELULU BUT WORKING', stickerId: 'delulu', band: 'low' },
  'outfit_caption.ai_slop': { caption: 'AI SLOP FIT', stickerId: 'ai-slop', band: 'poor' },
  'outfit_caption.chopped': { caption: 'CHOPPED FIT', stickerId: 'chopped', band: 'poor' },
  'outfit_caption.never_cook_again': { caption: 'NEVER COOK AGAIN', stickerId: 'never-cook-again', band: 'dire' },
  'outfit_caption.aura_debt': { caption: 'IN AURA DEBT', stickerId: 'aura-debt', band: 'dire' },
  // --- masc-only (age / roast) ---
  'outfit_caption.sigma_grindset': { caption: 'SIGMA GRINDSET FIT', stickerId: 'sigma-fit', band: 'high', gender: 'masc' },
  'outfit_caption.millennial_coded': { caption: 'MILLENNIAL CODED', stickerId: 'millennial', band: 'low', gender: 'masc' },
  'outfit_caption.unc_fit': { caption: 'UNC FIT DETECTED', stickerId: 'unc-fit', band: 'low', gender: 'masc' },
  'outfit_caption.old_money_temu': { caption: 'OLD MONEY (FROM TEMU)', stickerId: 'old-money-temu', band: 'poor', gender: 'masc' },
  'outfit_caption.boomer': { caption: 'BOOMER-CODED FIT', stickerId: 'boomer', band: 'poor', gender: 'masc' },
  // --- femme-only ---
  'outfit_caption.fashion_girl': { caption: 'FASHION GIRL', stickerId: 'fashion-girl', band: 'high', gender: 'femme' },
  'outfit_caption.vip_fit': { caption: 'VIP LIST FIT', stickerId: 'vip-fit', band: 'high', gender: 'femme' },
  'outfit_caption.material_girl_fit': { caption: 'MATERIAL GIRL FIT', stickerId: 'material-girl-fit', band: 'high', gender: 'femme' },
  'outfit_caption.brat_fit': { caption: 'BRAT SUMMER FIT', stickerId: 'brat-fit', band: 'high', gender: 'femme' },
  'outfit_caption.clean_girl_fit': { caption: 'CLEAN GIRL AESTHETIC', stickerId: 'clean-girl-fit', band: 'mid', gender: 'femme' },
};
export function pickOutfitCaption(
  candidates: string[] | undefined, band: ScoreBand, scanId: string, gender: ContentGender = 'unsure',
): OutfitCaption {
  const e = pickBanded(candidates, OUTFIT_BANK, band, scanId, 'outfit', gender);
  const caption = gender === 'femme' && e.femme ? e.femme : e.caption;
  return { caption, stickerId: e.stickerId };
}

/* --- Punchline → final viral line --- */
interface PunchlineEntry extends Banded { text: string; femme?: string; }
const PUNCHLINE_BANK: Record<string, PunchlineEntry> = {
  'punchline.certified_goat': { text: 'THE GOAT', band: 'elite' },
  'punchline.built_different': { text: 'BUILT DIFFERENT', band: 'elite' },
  'punchline.certified_lover_boy': { text: 'CERTIFIED LOVER BOY', band: 'high', femme: 'CERTIFIED HEARTBREAKER' },
  'punchline.rizz_god': { text: 'RIZZ GOD CONFIRMED', band: 'high' },
  'punchline.aura_farmer': { text: 'AURA FARMER', band: 'high' },
  'punchline.clean_npc_potential': { text: 'PROSPECTIVE NPC', band: 'mid' },
  'punchline.honorable_mention': { text: 'HONORABLE MENTION', band: 'mid' },
  'punchline.high_aura_low_stability': { text: 'RED FLAG ON REMISSION', band: 'low' },
  'punchline.delusional_lover_boy': { text: 'DELUSIONAL LOVER BOY', band: 'low', femme: 'DELULU IT-GIRL' },
  'punchline.negative_aura': { text: 'NEGATIVE AURA DETECTED', band: 'poor' },
  'punchline.ai_slop': { text: 'DOCUMENTED AI SLOP', band: 'poor' },
  'punchline.aura_debt': { text: 'IN AURA DEBT', band: 'dire' },
  'punchline.canon_chopped': { text: 'CANON EVENT', band: 'dire' },
  // --- neutral slang ---
  'punchline.no_cap': { text: 'NO CAP', band: 'high' },
  'punchline.bro_capping': { text: 'BRO IS CAPPING', band: 'poor' },
  // --- masc-only ---
  'punchline.alpha_confirmed': { text: 'ALPHA CONFIRMED', band: 'elite', gender: 'masc' },
  'punchline.sigma_grindset': { text: 'SIGMA GRINDSET', band: 'high', gender: 'masc' },
  'punchline.milf_hunter_license': { text: 'MILF HUNTER LICENSE', band: 'mid', gender: 'masc' },
  'punchline.certified_simp': { text: 'LOWKEY SIMP', band: 'low', gender: 'masc' },
  'punchline.beta_energy': { text: 'BETA ENERGY', band: 'poor', gender: 'masc' },
  'punchline.tate_dropout': { text: 'TATE ACADEMY DROPOUT', band: 'dire', gender: 'masc' },
  // --- femme-only ---
  'punchline.slay': { text: 'ABSOLUTE SLAYYY', band: 'elite', gender: 'femme' },
  'punchline.it_girl': { text: 'THE IT GIRL', band: 'high', gender: 'femme' },
  'punchline.drama_queen_crowned': { text: 'DRAMA QUEEN CROWNED', band: 'low', gender: 'femme' },
};
export function pickPunchline(
  candidates: string[] | undefined, band: ScoreBand, scanId: string, gender: ContentGender = 'unsure',
): string {
  const e = pickBanded(candidates, PUNCHLINE_BANK, band, scanId, 'punchline', gender);
  return gender === 'femme' && e.femme ? e.femme : e.text;
}
