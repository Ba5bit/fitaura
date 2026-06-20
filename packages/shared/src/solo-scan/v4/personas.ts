// packages/shared/src/solo-scan/v4/personas.ts
//
// Curated override table for recognized public figures / meme characters. The model
// recognizes the persona (presentation.recognizedIcon + confidence); when the name
// matches an entry above the confidence floor, the backend LOCKS the score + verdict
// while 3.5 still writes the grounded copy. Add celebrities by editing this list —
// no prompt change, no extra tokens per scan.
//
// HARD RULE: entries are for widely-known PUBLIC figures and meme characters only.
// Never add private or ordinary individuals.
import type { DatingVerdict } from '../../verdict.ts';

export interface PersonaOverride {
  /** Lowercased name fragments the model might emit for this persona. */
  match: string[];
  /** Locked Aura Index 0–100 (drives the numbers). */
  aura: number;
  /** Locked dating verdict. */
  verdict: DatingVerdict;
  /** Optional human note for whoever curates the list. */
  note?: string;
}

/** Minimum recognizedConfidence before an override is allowed to fire. */
export const PERSONA_MIN_CONFIDENCE = 0.6;

export const PERSONA_OVERRIDES: PersonaOverride[] = [
  // Example (meme character). Curate / extend this list for viral targets.
  { match: ['mclovin', 'fogell'], aura: 84, verdict: 'green_flag', note: 'Superbad meme — fan favourite' },
];

/** Find a curated override for a recognized icon name, gated by confidence. */
export function findPersona(
  recognizedIcon: string | null | undefined,
  confidence: number,
  table: PersonaOverride[] = PERSONA_OVERRIDES,
  minConfidence = PERSONA_MIN_CONFIDENCE,
): PersonaOverride | null {
  if (!recognizedIcon || confidence < minConfidence) return null;
  const name = recognizedIcon.toLowerCase();
  for (const p of table) {
    if (p.match.some((m) => name.includes(m.toLowerCase()))) return p;
  }
  return null;
}
