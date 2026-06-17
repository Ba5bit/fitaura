import type { IconName } from '../../lib/icons';

/**
 * Scan modes shown in the Vault's left selector. Solo Scan is the live MVP mode;
 * Friend vs Friend and Glow Up are intentionally-locked future modes (visual
 * placeholders only — never functional). Ported from the design's `AC_MODES`.
 */
export type ScanModeId = 'solo' | 'friend' | 'glowup';
export type ScanModeStatus = 'live' | 'locked';

export interface ScanMode {
  id: ScanModeId;
  name: string;
  tag: string;
  status: ScanModeStatus;
  icon: IconName;
  blurb: string;
  outputs: [string, string, string];
}

export const SCAN_MODES: ScanMode[] = [
  {
    id: 'solo',
    name: 'Solo Scan',
    tag: 'Available',
    status: 'live',
    icon: 'scan',
    blurb:
      'Scan a face, a fit, or both — get the cards that fit.',
    outputs: ['Face Card', 'Outfit Card', 'Dating Receipt'],
  },
  {
    id: 'friend',
    name: 'Friend vs Friend',
    tag: 'Coming soon',
    status: 'locked',
    icon: 'users',
    blurb:
      "Put two people side by side. Who has more aura, the better fit, and who's more likely to ghost. A head-to-head verdict card.",
    outputs: ['Person A vs B', 'Winner by stat', 'Comparison card'],
  },
  {
    id: 'glowup',
    name: 'Glow Up',
    tag: 'Coming soon',
    status: 'locked',
    icon: 'sparkle',
    blurb:
      'Compare an old you and a new you. Track how your aura, fit and verdict shift from before to after, plus a transformation receipt.',
    outputs: ['Before / After', 'Score changes', 'Verdict shift'],
  },
];
