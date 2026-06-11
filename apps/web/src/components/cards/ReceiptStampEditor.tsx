import type { CSSProperties } from 'react';
import { RECEIPT_PRESETS } from '../../features/result/stickerGeometry';

interface ReceiptStampEditorProps {
  /** Active preset id, or null = stamp off. */
  preset: string | null;
  setPreset: (id: string | null) => void;
  editing: boolean;
}

const pct = (v: number) => `${v * 100}%`;

/**
 * Receipt verdict stamp — preset positions only (no free drag). Ported from the
 * Card Studio's `ReceiptStampEditor`. Renders the live stamp plus, in edit mode,
 * clickable preset slots over the receipt.
 */
export function ReceiptStampEditor({ preset, setPreset, editing }: ReceiptStampEditorProps) {
  const cur = RECEIPT_PRESETS.find((p) => p.id === preset);
  return (
    <div className={'st-stickerlayer' + (editing ? ' editing' : '')} role="group" aria-label="Receipt stamp position">
      <div className={'st-overlay' + (editing ? ' show' : '')}>
        <div className="scrim" />
        {RECEIPT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={'st-preset' + (p.wide ? ' wide' : '')}
            aria-pressed={preset === p.id}
            style={{ left: pct(p.cx), top: pct(p.cy) }}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {cur && (
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
      )}
    </div>
  );
}
