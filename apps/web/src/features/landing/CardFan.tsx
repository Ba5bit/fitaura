import { useState } from 'react';
import { cycleOrder } from './cardFan';

interface CardFanProps {
  items: React.ReactNode[];
  onFrontChange?: (frontIndex: number) => void;
}

const POSE = ['front', 'backRight', 'backLeft'];

export function CardFan({ items, onFrontChange }: CardFanProps) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const advance = () => {
    const next = cycleOrder(order);
    setOrder(next);
    onFrontChange?.(next[0]);
  };
  return (
    <div className="cardfan">
      {order.map((itemIdx, stackPos) => (
        <div
          key={itemIdx}
          className={'cardfan-item ' + (POSE[stackPos] || 'backLeft')}
          style={{ zIndex: items.length - stackPos }}
          role="button"
          tabIndex={stackPos === 0 ? 0 : -1}
          aria-hidden={stackPos !== 0}
          onClick={stackPos === 0 ? advance : undefined}
          onKeyDown={
            stackPos === 0
              ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } }
              : undefined
          }
        >
          {items[itemIdx]}
        </div>
      ))}
    </div>
  );
}
