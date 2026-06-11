import type { ScoreItem } from '@fitaura/shared';
import { useCountUp } from '../../lib/useCountUp';

interface MiniStatProps {
  stat: ScoreItem;
  run: boolean;
}

/** Compact on-card stat: label, count-up value, fill bar. Design's `MStat`. */
export function MiniStat({ stat, run }: MiniStatProps) {
  const value = useCountUp(stat.value, run);
  return (
    <div className={'mstat' + (stat.hot ? ' hot' : '')}>
      <div className="top">
        <span className="lbl">{stat.label}</span>
        <span className="val">{stat.displayValue ?? value}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${stat.value}%` }} />
      </div>
    </div>
  );
}
