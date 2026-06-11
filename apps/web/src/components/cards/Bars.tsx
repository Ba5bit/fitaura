interface BarsProps {
  seed?: number;
  count?: number;
  height?: string;
}

/**
 * Decorative pseudo-random barcode. Deterministic from `seed` so a given card
 * always renders the same bars. Ported from the design's `Bars`.
 */
export function Bars({ seed = 7, count = 34, height }: BarsProps) {
  const bars = [];
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    const w = 1 + (x % 4);
    bars.push(<i key={i} style={{ width: `${w}px`, opacity: x % 5 > 0 ? 0.85 : 0.3 }} />);
  }
  return (
    <div className="bars" style={height ? { height } : undefined}>
      {bars}
    </div>
  );
}
