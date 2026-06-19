import { useEffect, useState, type MouseEvent } from 'react';
import { skinsFor, skinIndex } from './skins/registry';
import type { SkinKind, SkinProps } from './skins/types';
import { cycleOrder, rotateToFront } from '../../lib/cycleOrder';

const POSE = ['front', 'backRight', 'backLeft'];

interface CardSwitcherProps {
  kind: SkinKind;
  /** Selected skin id (persisted by the parent). */
  skinId: string;
  setSkinId: (id: string) => void;
  /** Props passed to every skin (front gets run=true; peeks get preview=true). */
  skinProps: Omit<SkinProps, 'preview' | 'run'>;
  /** Overlay (sticker editor) rendered on top of the FRONT skin only. */
  overlay?: React.ReactNode;
  /** Disable switching (e.g. while editing a sticker). */
  locked?: boolean;
}

/**
 * Card-stack skin switcher. The front skin is the live, full-size, editable card
 * (the parent's overlay rides on it); peeking skins splay behind it, dimmed.
 *
 * Rotation works like the Landing fan (`CardFan`): two invisible click zones — a
 * left half (rotate anti-clockwise) and a right half (rotate clockwise) — sit over
 * the deck so a tap always rotates the right way regardless of how the splayed
 * cards overlap. Unlike Landing (whose cards are inert), the front card here is
 * live, so the zones sit *below* it: the front card masks the centre (a centre tap
 * advances clockwise, but a tap on a sticker passes through to the editor), while
 * the exposed left / right peek slivers fall on the zones. The parent's dots jump
 * directly. Deck order is held in state so switches *animate* (a true rotation)
 * rather than snapping. With one skin it renders only the front — a plain card.
 */
export function CardSwitcher({ kind, skinId, setSkinId, skinProps, overlay, locked }: CardSwitcherProps) {
  const skins = skinsFor(kind);
  const n = skins.length;
  const target = skinIndex(kind, skinId);

  // `order` is the live deck arrangement (skin indices, front first). Initialised
  // with the selected skin at the front.
  const [order, setOrder] = useState<number[]>(() =>
    rotateToFront(skins.map((_, i) => i), target),
  );

  // Re-sync when the selected skin changes externally (dots, vault restore, or a
  // kind switch reusing this mounted component). Rotating the existing order
  // keeps the ring arrangement so the change animates; a length mismatch (a
  // different kind's skin set) rebuilds from scratch. Internal taps already set
  // `skinId`, so this is a no-op for them.
  useEffect(() => {
    setOrder((o) =>
      o.length === n && o[0] === target
        ? o
        : rotateToFront(o.length === n ? o : skins.map((_, i) => i), target),
    );
    // skins is stable per kind; `target` already encodes skinId + kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, n]);

  // Rotate the deck one step (animated) and tell the parent which skin is now
  // front. `next` = clockwise (right peek → centre, == landing next/cycleOrder);
  // `prev` = anti-clockwise (left peek → centre). Order from the render closure is
  // current at click time, matching `CardFan`.
  const rotate = (nextOrder: number[]) => {
    if (locked) return;
    setOrder(nextOrder);
    setSkinId(skins[nextOrder[0]].id);
  };
  const next = () => rotate(cycleOrder(order));
  const prev = () => rotate([order[order.length - 1], ...order.slice(0, -1)]);

  // A tap on the live front card advances clockwise — but ignore taps on a sticker
  // (those belong to the sticker editor) or while editing/single-skin.
  const onFrontClick = (e: MouseEvent<HTMLDivElement>) => {
    if (locked || n < 2) return;
    if ((e.target as HTMLElement).closest('.st-sticker')) return;
    next();
  };

  return (
    <div className="cs-switch">
      <div className={'cs-deck' + (locked ? ' editing' : '')}>
        {order.map((skinIdx, stackPos) => {
          const skin = skins[skinIdx];
          const Comp = skin.Comp;
          const isFront = stackPos === 0;
          return (
            <div
              key={skin.id}
              className={'cs-card ' + (POSE[stackPos] || 'backLeft') + (isFront ? ' front-live' : '')}
              aria-hidden={!isFront}
              onClick={isFront ? onFrontClick : undefined}
            >
              <Comp {...skinProps} run={isFront} preview={!isFront} />
              {isFront && overlay}
            </div>
          );
        })}
        {/* Landing-style rotation zones: left = anti-clockwise, right = clockwise.
            Below the live front card (which masks the centre and keeps stickers
            tappable) but above the dimmed peeks, so a tap on a peek sliver always
            rotates the right way. Hidden while editing / with a single skin. */}
        {n > 1 && !locked && (
          <>
            <button type="button" className="cs-zone prev" aria-label="Previous skin" onClick={prev} />
            <button type="button" className="cs-zone next" aria-label="Next skin" onClick={next} />
          </>
        )}
      </div>
    </div>
  );
}
