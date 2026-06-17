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
  // Jump straight to a card (dot click): bring it to the front, keep the rest in order.
  const goTo = (itemIdx: number) => {
    if (itemIdx === front) return;
    const next = [itemIdx, ...order.filter((x) => x !== itemIdx)];
    setOrder(next);
    onFrontChange?.(itemIdx);
  };

  return (
    <div className="cardfan-wrap">
      <div className="cardfan">
        {order.map((itemIdx, stackPos) => {
          // Front card cycles; a side card jumps itself to the front.
          const act = () => (stackPos === 0 ? advance() : goTo(itemIdx));
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
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
