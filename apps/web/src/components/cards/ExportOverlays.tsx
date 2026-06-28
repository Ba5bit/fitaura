import type { CSSProperties } from 'react';
import { RECEIPT_PRESETS } from '../../features/result/stickerGeometry';

const pct = (v: number) => `${v * 100}%`;

/** Non-interactive receipt stamp at a preset — used in the export copy. */
export function StaticStamp({ preset }: { preset: string | null }) {
  const cur = RECEIPT_PRESETS.find((p) => p.id === preset);
  if (!cur) return null;
  return (
    <div className="st-stickerlayer">
      <div
        className={'st-receipt-stamp' + (cur.wide ? ' wide' : '')}
        style={
          {
            position: 'absolute',
            left: pct(cur.cx),
            top: pct(cur.cy),
            transform: `translate(-50%,-50%) rotate(${cur.rot}deg)`,
          } as CSSProperties
        }
      >
        {cur.wide ? '· VERIFIED ·' : 'VERIFIED'}
      </div>
    </div>
  );
}
