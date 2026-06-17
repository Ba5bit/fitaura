import type { ScoreItem } from '@fitaura/shared';

export function capFor(v: number): string {
  if (v >= 88) return 'ELITE';
  if (v >= 78) return 'STRONG';
  if (v >= 66) return 'SOLID';
  if (v >= 55) return 'PASSABLE';
  return 'NEEDS WORK';
}

/** Thin labelled bar row used in the outfit fit/physique read. Design's `TraitRow`. */
export function TraitRow({ stat }: { stat: ScoreItem }) {
  return (
    <div className={'rs-trait' + (stat.hot ? ' hot' : '')}>
      <div className="top">
        <span className="nm">
          {stat.label} <span className="cap">· {capFor(stat.value)}</span>
        </span>
        <span className="val">{stat.value}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${stat.value}%` }} />
      </div>
    </div>
  );
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
