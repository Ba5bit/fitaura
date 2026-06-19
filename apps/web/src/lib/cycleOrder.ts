/** Move the front item to the back (the front card slides behind the stack). */
export function cycleOrder<T>(order: T[]): T[] {
  if (order.length <= 1) return order.slice();
  return [...order.slice(1), order[0]];
}

/**
 * Rotate `order` so that `target` becomes the front (index 0), preserving the
 * ring arrangement of the rest. Used by the card-stack switcher: tapping the
 * right peek brings it to the centre (== landing `next`/`cycleOrder`); tapping
 * the left peek brings it to the centre (== landing `prev`). The CSS transition
 * animates the resulting clockwise / anti-clockwise travel.
 */
export function rotateToFront<T>(order: T[], target: T): T[] {
  const pos = order.indexOf(target);
  if (pos <= 0) return order.slice(); // already front, or not found
  return [...order.slice(pos), ...order.slice(0, pos)];
}
