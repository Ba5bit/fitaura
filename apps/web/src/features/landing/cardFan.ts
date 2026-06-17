/** Move the front item to the back (the tapped card slides behind the stack). */
export function cycleOrder<T>(order: T[]): T[] {
  if (order.length <= 1) return order.slice();
  return [...order.slice(1), order[0]];
}
