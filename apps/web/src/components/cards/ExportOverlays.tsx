import type { CSSProperties } from 'react';
import type { StickerTone } from '@fitaura/shared';
import { RECEIPT_PRESETS, type Point } from '../../features/result/stickerGeometry';

const pct = (v: number) => `${v * 100}%`;

/** Non-interactive sticker at a fixed position — used in the export copy. */
export function StaticSticker({
  label,
  tone,
  rotation,
  pos,
}: {
  label: string;
  tone: StickerTone;
  rotation: number;
  pos: Point;
}) {
  return (
    <div className="st-stickerlayer">
      <div
        className={'st-sticker ' + tone}
        style={
          {
            left: pct(pos.cx),
            top: pct(pos.cy),
            '--rot': `${rotation}deg`,
            transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
            cursor: 'default',
          } as CSSProperties
        }
      >
        {label}
      </div>
    </div>
  );
}

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
