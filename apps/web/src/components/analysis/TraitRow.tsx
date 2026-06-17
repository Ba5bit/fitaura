import type { ScoreItem } from '@fitaura/shared';

export function capFor(v: number): string {
  if (v >= 88) return 'ELITE';
  if (v >= 78) return 'STRONG';
  if (v >= 66) return 'SOLID';
  if (v >= 55) return 'PASSABLE';
  return 'NEEDS WORK';
}

/** Returns the highest and lowest scored stat — used for Best/Watch tags. */
export function bestWorst(stats: ScoreItem[]): { best: ScoreItem; worst: ScoreItem } {
  let best = stats[0];
  let worst = stats[0];
  for (const s of stats) {
    if (s.value > best.value) best = s;
    if (s.value < worst.value) worst = s;
  }
  return { best, worst };
}
