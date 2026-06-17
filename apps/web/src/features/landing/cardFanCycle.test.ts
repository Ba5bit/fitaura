import { describe, expect, it } from 'vitest';
import { cycleOrder } from './cardFanCycle';

describe('cycleOrder', () => {
  it('moves the front item to the back', () => {
    expect(cycleOrder([0, 1, 2])).toEqual([1, 2, 0]);
  });
  it('returns a copy for a single item', () => {
    expect(cycleOrder([5])).toEqual([5]);
  });
  it('cycles fully back to start after length steps', () => {
    let o = [0, 1, 2];
    o = cycleOrder(o); o = cycleOrder(o); o = cycleOrder(o);
    expect(o).toEqual([0, 1, 2]);
  });
});
