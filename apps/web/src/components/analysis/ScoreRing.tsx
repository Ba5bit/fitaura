import { useCountUp } from '../../lib/useCountUp';

interface ScoreRingProps {
  value: number;
  label: string;
  run: boolean;
  size?: number;
  stroke?: number;
}

/**
 * Gym-app aura ring. The fill is driven by the JS count-up so it can't freeze.
 * Ported from the design's `ScoreRing`.
 */
export function ScoreRing({ value, label, run, size = 120, stroke = 9 }: ScoreRingProps) {
  const n = useCountUp(value, run, 1000);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - n / 100);
  const center = size / 2;
  return (
    <div className="rs-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-bg" cx={center} cy={center} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fg"
          cx={center}
          cy={center}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ strokeDasharray: c, strokeDashoffset: offset }}
        />
      </svg>
      <div className="rs-ring-c">
        <span className="num">{n}</span>
        <span className="lbl">{label}</span>
      </div>
    </div>
  );
}
