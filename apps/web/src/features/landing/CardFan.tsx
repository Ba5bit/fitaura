import { useState } from 'react';
import { cycleOrder } from './cardFanCycle';

interface CardFanProps {
  items: React.ReactNode[];
  onFrontChange?: (frontIndex: number) => void;
}

const POSE = ['front', 'backRight', 'backLeft'];

export function CardFan({ items, onFrontChange }: CardFanProps) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const front = order[0];

  const advance = () => {
    const next = cycleOrder(order);
    setOrder(next);
    onFrontChange?.(next[0]);
  };
  // Bring a card to the centre by SWAPPING it with the current front card — the
  // clicked card and the centre trade places, the third card stays put. This reads
  // as a clean swap rather than a confusing 3-card rotation.
  const swapToFront = (itemIdx: number) => {
    if (itemIdx === front) return;
    const i = order.indexOf(itemIdx);
    const next = order.slice();
    [next[0], next[i]] = [next[i], next[0]];
    setOrder(next);
    onFrontChange?.(itemIdx);
  };

  return (
    <div className="cardfan-wrap">
      <div className="cardfan">
        {order.map((itemIdx, stackPos) => {
          // Front card cycles to the next; a side card swaps into the centre.
          const act = () => (stackPos === 0 ? advance() : swapToFront(itemIdx));
          return (
            <div
              key={itemIdx}
              className={'cardfan-item ' + (POSE[stackPos] || 'backLeft')}
              style={{ zIndex: items.length - stackPos }}
              role="button"
              tabIndex={0}
              aria-label={stackPos === 0 ? 'Next card' : 'Bring this card to the front'}
              onClick={act}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }}
            >
              {items[itemIdx]}
            </div>
          );
        })}
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
            onClick={() => swapToFront(i)}
          />
        ))}
      </div>
    </div>
  );
}
