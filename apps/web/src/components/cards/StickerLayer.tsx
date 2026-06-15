import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type CSSProperties } from 'react';
import type { StickerTone } from '@fitaura/shared';
import {
  CARD_GEOM,
  clampSticker,
  nearestGuide,
  posWords,
  type Point,
  type StickerKind,
} from '../../features/result/stickerGeometry';
import { createDoubleTap } from '../../lib/tapGesture';

export interface EditableSticker {
  label: string;
  tone: StickerTone;
  rotation: number;
}

interface StickerLayerProps {
  kind: StickerKind;
  sticker: EditableSticker;
  pos: Point;
  setPos: (p: Point) => void;
  /** Pinned edit mode — keeps the safe-zone overlay + selection visible. */
  editing: boolean;
  hidden: boolean;
  /** Double-tap / double-click the sticker to advance to the next preset. */
  onCycle?: () => void;
}

/**
 * Draggable / keyboard-nudgeable sticker with a safe-zone + critical-text
 * overlay and snap guides. Ported from the Card Studio's `StickerLayer` and
 * embedded directly in the Verdict card so repositioning happens in-place.
 */
export function StickerLayer({ kind, sticker, pos, setPos, editing, hidden, onCycle }: StickerLayerProps) {
  const spec = CARD_GEOM[kind];
  const layerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  // Keep a ref to the latest onCycle so the once-created detector always calls
  // the current handler (which closes over the active tab's sticker state).
  const onCycleRef = useRef(onCycle);
  onCycleRef.current = onCycle;
  const dtap = useRef(createDoubleTap(() => onCycleRef.current?.())).current;
  const drag = useRef<{ lw: number; lh: number; hw: number; hh: number; startX: number; startY: number; base: Point } | null>(null);
  const [guide, setGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [grabbing, setGrabbing] = useState(false);
  const [snapAnim, setSnapAnim] = useState(false);
  const [live, setLive] = useState(false);
  const placing = editing || live;

  // When pinned edit mode ends (e.g. "Done" / Esc), clear any lingering `live`
  // state so the safe-zone + exclusion overlay always disappears. A drag while
  // editing sets `live` true, but endDrag only clears it when not editing — so
  // without this the red zones would stay on screen after pressing Done.
  useEffect(() => {
    if (!editing) setLive(false);
  }, [editing]);

  // Measured half-extents (normalized), accounting for the rendered (rotated) box.
  const halfExt = useCallback(() => {
    const layer = layerRef.current;
    const st = stickRef.current;
    if (!layer || !st) return { hw: 0.16, hh: 0.05 };
    const L = layer.getBoundingClientRect();
    const S = st.getBoundingClientRect();
    if (!L.width || !L.height) return { hw: 0.16, hh: 0.05 };
    return { hw: S.width / 2 / L.width, hh: S.height / 2 / L.height };
  }, []);

  const beginDrag = (e: PointerEvent) => {
    if (hidden) return;
    e.preventDefault();
    stickRef.current?.focus();
    setLive(true);
    const layer = layerRef.current!.getBoundingClientRect();
    const ext = halfExt();
    drag.current = { lw: layer.width, lh: layer.height, ...ext, startX: e.clientX, startY: e.clientY, base: { ...pos } };
    setGrabbing(true);
    setSnapAnim(false);
    dtap.down(e.clientX, e.clientY, e.timeStamp);
    try {
      stickRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  };
  const moveDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const cx = d.base.cx + (e.clientX - d.startX) / d.lw;
    const cy = d.base.cy + (e.clientY - d.startY) / d.lh;
    const c = clampSticker(spec, cx, cy, d.hw, d.hh);
    setGuide({
      x: nearestGuide(c.cx, spec.guides.x, d.hw, spec.safe.x0, spec.safe.x1),
      y: nearestGuide(c.cy, spec.guides.y, d.hh, spec.safe.y0, spec.safe.y1),
    });
    setPos(c);
  };
  const endDrag = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    let { cx, cy } = pos;
    const gx = nearestGuide(cx, spec.guides.x, d.hw, spec.safe.x0, spec.safe.x1);
    const gy = nearestGuide(cy, spec.guides.y, d.hh, spec.safe.y0, spec.safe.y1);
    if (gx != null) cx = gx;
    if (gy != null) cy = gy;
    const c = clampSticker(spec, cx, cy, d.hw, d.hh);
    setSnapAnim(gx != null || gy != null);
    setPos(c);
    setGuide({ x: null, y: null });
    setGrabbing(false);
    drag.current = null;
    dtap.up(e.clientX, e.clientY, e.timeStamp);
    try {
      stickRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    if (!editing) setLive(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (hidden) return;
    const fine = e.shiftKey ? 0.06 : 0.02;
    let { cx, cy } = pos;
    let used = true;
    if (e.key === 'ArrowLeft') cx -= fine;
    else if (e.key === 'ArrowRight') cx += fine;
    else if (e.key === 'ArrowUp') cy -= fine;
    else if (e.key === 'ArrowDown') cy += fine;
    else used = false;
    if (!used) return;
    e.preventDefault();
    const { hw, hh } = halfExt();
    setSnapAnim(true);
    setPos(clampSticker(spec, cx, cy, hw, hh));
  };

  const cls = [
    'st-sticker',
    sticker.tone,
    hidden ? 'hidden' : '',
    grabbing ? 'grabbing' : '',
    snapAnim ? 'snapped' : '',
    placing ? 'sel' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const safe = spec.safe;
  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className={'st-stickerlayer' + (placing ? ' editing' : '')} ref={layerRef}>
      <div className={'st-overlay' + (placing ? ' show' : '')}>
        <div className="scrim" />
        <div
          className="st-safe"
          style={{ left: pct(safe.x0), top: pct(safe.y0), width: pct(safe.x1 - safe.x0), height: pct(safe.y1 - safe.y0) }}
        >
          <span className="st-safe-tag">SAFE ZONE</span>
        </div>
        {spec.exclude.map((z, i) => (
          <div
            key={i}
            className="st-excl"
            style={{ left: pct(z.x0), top: pct(z.y0), width: pct(z.x1 - z.x0), height: pct(z.y1 - z.y0) }}
          >
            <span className="lab">{z.label}</span>
          </div>
        ))}
        <div className={'st-guide v' + (guide.x != null ? ' on' : '')} style={{ left: pct(guide.x ?? 0.5) }} />
        <div className={'st-guide h' + (guide.y != null ? ' on' : '')} style={{ top: pct(guide.y ?? 0.5) }} />
      </div>

      <div
        ref={stickRef}
        className={cls}
        style={
          {
            left: pct(pos.cx),
            top: pct(pos.cy),
            '--rot': `${sticker.rotation}deg`,
            transform: `translate(-50%,-50%) rotate(${sticker.rotation}deg)`,
          } as CSSProperties
        }
        tabIndex={hidden ? -1 : 0}
        role="button"
        aria-label={`Sticker ${sticker.label}, ${posWords(pos.cx, pos.cy)}. Drag to move, or use arrow keys.`}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onFocus={() => !editing && setLive(true)}
        onBlur={() => !editing && !drag.current && setLive(false)}
        onKeyDown={onKey}
      >
        {sticker.label}
        <span className="pip tl" />
        <span className="pip tr" />
        <span className="pip bl" />
        <span className="pip br" />
      </div>
    </div>
  );
}
