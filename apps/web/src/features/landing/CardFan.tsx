import { useState } from 'react';
import { cycleOrder } from '../../lib/cycleOrder';

interface CardFanProps {
  items: React.ReactNode[];
  onFrontChange?: (frontIndex: number) => void;
}

const POSE = ['front', 'backRight', 'backLeft'];

/**
 * Tappable card fan. Two invisible click zones (left = previous, right = next)
 * sit above the cards so a click always rotates the right way regardless of how
 * the cards overlap. Clicking the right side brings the right card to centre and
 * rotates one way; the left side brings the left card to centre and rotates the
 * other way. Repeating a side cycles through all cards. Dots jump directly.
 */
export function CardFan({ items, onFrontChange }: CardFanProps) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const front = order[0];

  const apply = (nextOrder: number[]) => {
    setOrder(nextOrder);
    onFrontChange?.(nextOrder[0]);
  };
  const next = () => apply(cycleOrder(order)); // right card → centre
  const prev = () => apply([order[order.length - 1], ...order.slice(0, -1)]); // left card → centre
  // Dot click: rotate the short way to bring that card to the front.
  const jump = (i: number) => {
    const pos = order.indexOf(i);
    if (pos === 0) return;
    if (pos === order.length - 1) prev();
    else next();
  };

  return (
    <div className="cardfan-wrap">
      <div className="cardfan">
        {order.map((itemIdx, stackPos) => (
          <div
            key={itemIdx}
            className={'cardfan-item ' + (POSE[stackPos] || 'backLeft')}
            style={{ zIndex: items.length - stackPos }}
            aria-hidden={stackPos !== 0}
          >
            {items[itemIdx]}
          </div>
        ))}
        <button type="button" className="cf-zone prev" aria-label="Previous card" onClick={prev} />
        <button type="button" className="cf-zone next" aria-label="Next card" onClick={next} />
      </div>
      <div className="cardfan-dots" role="tablist" aria-label="Select a card">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === front}
            aria-label={`Card ${i + 1}`}
            className={'cardfan-dot' + (i === front ? ' active' : '')}
            onClick={() => jump(i)}
          />
        ))}
      </div>
    </div>
  );
}
