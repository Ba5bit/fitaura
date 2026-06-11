import type { CSSProperties } from 'react';
import type { StickerData } from '@fitaura/shared';

interface StickerProps {
  sticker: StickerData | null;
  /** Forces hidden regardless of the sticker's own flag (global toggle). */
  hidden?: boolean;
  /** Which card the sticker sits on — drives its anchored position. */
  kind: 'face' | 'outfit';
}

/** A swappable / hideable viral label. Ported from the design's `StickerEl`. */
export function Sticker({ sticker, hidden, kind }: StickerProps) {
  if (!sticker) return null;
  const isHidden = hidden || sticker.hidden;
  const cls = [
    'sticker',
    sticker.tone,
    `sticker--${kind}`,
    isHidden ? 'hidden' : 'pop',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={
        {
          // `--rot` is consumed by the pop keyframe; transform sets the rest tilt.
          '--rot': `${sticker.rotation}deg`,
          transform: `rotate(${sticker.rotation}deg)`,
        } as CSSProperties
      }
    >
      {sticker.label}
    </div>
  );
}
