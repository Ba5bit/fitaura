import type { SupportingStat as SupportingStatData } from '@fitaura/shared';
import { useCountUp } from '../../lib/useCountUp';

/**
 * Secondary outfit/physique stat: name, score, a thin neon performance line with
 * a value marker, and a one-line reason. Visually subordinate to the main
 * `TraitRow` metrics. The fill + marker are JS-driven (count-up) so they stay in
 * sync with the number — no CSS transition to freeze.
 */
export function SupportingStat({ stat, run }: { stat: SupportingStatData; run: boolean }) {
  const n = useCountUp(stat.value, run, 900);
  return (
    <div className="rs-substat">
      <div className="top">
        <span className="nm">{stat.label}</span>
        <span className="val">{n}</span>
      </div>
      <div className="line" role="presentation">
        <i className="fill" style={{ width: `${n}%` }} />
        <i className="dot" style={{ left: `${n}%` }} />
      </div>
      <div className="note">{stat.note}</div>
    </div>
  );
}
