import type { DatingVerdict } from './verdict.ts';

/**
 * Fitaura result model.
 *
 * Designed from the product context (`aura_project_context_rebuilt_cards_v2.md`)
 * §7 and extended so it can carry every piece of content the imported design
 * renders. The model deliberately separates:
 *
 *   - `card`     — content shown on the compact, EXPORTABLE shareable asset
 *   - `analysis` — content shown only in the in-app, page-only analysis block
 *
 * This keeps the exported card compact while the result page can show more
 * detail (the core layout rule of the product).
 */

/** What a scan contains. At least one of the two is always true. */
export interface ScanParts {
  face: boolean;
  outfit: boolean;
}

/**
 * Parts of a (possibly legacy) result. Results saved before this feature predate
 * `parts` and always carried both cards, so a missing `parts` resolves from presence
 * (which, for those rows, is both).
 */
export function partsOf(r: { parts?: ScanParts; face?: unknown; outfit?: unknown }): ScanParts {
  if (r.parts) return r.parts;
  return { face: r.face != null, outfit: r.outfit != null };
}

/** Tone presets a sticker can take — maps to the visual sticker styles. */
export type StickerTone = 'accent' | 'warn' | 'chrome' | 'lime';

/** A swappable / hideable sticker or viral label on an image-based card. */
export interface StickerData {
  id: string;
  /** The text shown on the sticker, e.g. "HEAR ME OUT". */
  label: string;
  tone: StickerTone;
  /** Rotation in degrees for the playful tilt. */
  rotation: number;
  hidden: boolean;
  /** Optional manual position override (image cards only). */
  position?: { x: number; y: number };
}

/**
 * A single playful statistic. `value` is the 0–100 numeric used for bars and
 * count-ups; `displayValue` overrides the rendered text when the stat is
 * categorical (e.g. "HIGH", "+240", "6.7 / 10").
 */
export interface ScoreItem {
  id: string;
  label: string;
  value: number;
  displayValue?: string;
  /** Flags a "watch this" stat — rendered with the warning treatment. */
  hot?: boolean;
  /** Hide the fill bar (for non-0–100 stats like an age estimate). */
  noBar?: boolean;
}

/* ------------------------------------------------------------------ */
/* FACE                                                                */
/* ------------------------------------------------------------------ */

export interface FaceCardContent {
  imageUrl: string | null;
  eyebrow: string;
  /**
   * Two-part verdict line; the second group renders highlighted.
   * e.g. ["RED FLAG", "WITH GOOD ANGLES"].
   */
  verdict: [string, string];
  /** Aura index caption shown in the card footer, e.g. "AURA INDEX 71". */
  index: string;
  scores: ScoreItem[];
  sticker: StickerData;
}

/** One gym-app-style trait card in the Face Analysis breakdown. */
export interface FaceTrait {
  id: string;
  label: string;
  value: number;
  /** Short descriptor, e.g. "Sharp", "Off-axis". */
  descriptor: string;
  /** Geometric trait icon key (jaw | harmony | eye | brow | beard | star). */
  icon: FaceTraitIcon;
}

export type FaceTraitIcon =
  | 'jaw'
  | 'harmony'
  | 'eye'
  | 'brow'
  | 'beard'
  | 'star'
  | 'face'
  | 'scissors'
  | 'razor';

export interface FaceAnalysisContent {
  /** Aura score driving the ring (0–100). */
  aura: number;
  /** Short, playful explanation of the result. */
  explanation: string;
  /** One short roast / observation. */
  roast: string;
  breakdown: FaceTrait[];
}

export interface FaceResult {
  card: FaceCardContent;
  analysis: FaceAnalysisContent;
}

/* ------------------------------------------------------------------ */
/* OUTFIT                                                              */
/* ------------------------------------------------------------------ */

export interface OutfitCardContent {
  imageUrl: string | null;
  caption: string;
  /** Overall fit score (0–100). */
  overallScore: number;
  scores: ScoreItem[];
  sticker: StickerData;
}

/** A short tagged observation in the outfit analysis block. */
export interface OutfitTag {
  label: string;
  tone: 'good' | 'bad';
}

/**
 * A secondary "supporting" outfit/physique stat shown beneath the main four
 * metrics — more specific physique insight, each with a one-line reason.
 */
export interface SupportingStat {
  id: string;
  label: string;
  /** 0–100 score driving the segmented indicator. */
  value: number;
  /** Very short note on what affected the score. */
  note: string;
}

export interface OutfitAnalysisContent {
  /** One short explanation of why the outfit received its score. */
  explanation: string;
  /** Works / Hurts / Verdict micro-structure. */
  works: string;
  hurts: string;
  verdict: string;
  tags: OutfitTag[];
  /** Optional extra stats shown in the analysis block. */
  scores?: ScoreItem[];
  /**
   * Optional secondary physique stats rendered below the main four metrics.
   * Visually subordinate; 3–4 items. New metrics only — never repeats of the
   * four main `card.scores`.
   */
  supporting?: SupportingStat[];
}

export interface OutfitResult {
  card: OutfitCardContent;
  analysis: OutfitAnalysisContent;
}

/* ------------------------------------------------------------------ */
/* DATING SCORE RECEIPT                                                */
/* ------------------------------------------------------------------ */

/** Visual tone for a receipt row value. */
export type ReceiptRowTone = 'default' | 'good' | 'hi';

export interface ReceiptRow {
  id: string;
  label: string;
  value: number | string;
  tone?: ReceiptRowTone;
}

export type ReceiptPaper = 'neon' | 'thermal';

export interface DatingReceiptResult {
  /** Generation identifier shown on the receipt (e.g. "0xA73F"). */
  generationId: string;
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** Headline dating score, 0–10 (e.g. 6.7). */
  datingScore: number;
  /** Aura gained/lost on this generation (e.g. +240). */
  auraValue: number;
  rows: ReceiptRow[];
  /** The single categorical verdict — never three separate scores. */
  datingVerdict: DatingVerdict;
  /** The big final viral punchline — separate from `datingVerdict`. */
  finalPunchline: string;
  /** Verdict-seal / stamp text, e.g. ["FITAURA", "VERIFIED"]. */
  stamp?: [string, string];
  /** Optional thumbnail (small outfit/face image) for some templates. */
  imageUrl?: string | null;
  /** A short final-summary read for the in-app block under the receipt. */
  summary: string;
}

/* ------------------------------------------------------------------ */
/* FULL GENERATION                                                     */
/* ------------------------------------------------------------------ */

export interface FullGenerationResult {
  /** The single categorical verdict for the whole generation. */
  verdict: DatingVerdict;
  /** Verdict chip text, e.g. "VERDICT · RED FLAG". */
  chip: string;
  /** Fixed presentation gender the AI resolved at scan time; drives card theme,
   * the Femininity/Masculinity label, and the eligible sticker set. */
  gender: 'femme' | 'masc';
  /** Which modalities this scan contains. */
  parts: ScanParts;
  face: FaceResult | null;
  outfit: OutfitResult | null;
  receipt: DatingReceiptResult;
}

/** Resolve a result's fixed gender, defaulting legacy rows to masc. */
export function genderOf(r: { gender?: 'femme' | 'masc' }): 'femme' | 'masc' {
  return r.gender ?? 'masc';
}
