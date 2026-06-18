import { useMemo } from 'react';
import { qrMatrix } from '../../lib/qr';

interface QrCodeProps {
  value: string;
  className?: string;
}

/**
 * Renders a QR code as a scalable inline SVG — one `<rect>` per dark module on a
 * transparent ground (the container provides the light background). snapdom
 * rasterizes SVG faithfully, so the exported card keeps a scannable code.
 * The module count varies with the URL length, so the viewBox is sized to it.
 */
export function QrCode({ value, className }: QrCodeProps) {
  const { n, rects } = useMemo(() => {
    const grid = qrMatrix(value);
    const size = grid.length;
    const out: React.ReactNode[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // 1.02 oversize fills sub-pixel seams between modules when rasterized.
        if (grid[r][c]) out.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} />);
      }
    }
    return { n: size, rects: out };
  }, [value]);

  if (n === 0) return null;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      fill="#000"
      role="img"
      aria-label={`QR code: ${value}`}
    >
      {rects}
    </svg>
  );
}
