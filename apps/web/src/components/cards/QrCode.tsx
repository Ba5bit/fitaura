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
  const grid = useMemo(() => qrMatrix(value), [value]);
  const n = grid.length;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) {
        rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} />);
      }
    }
  }
  return (
    <svg
      className={className}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code to fitaura.studio"
    >
      {rects}
    </svg>
  );
}
