import { describe, expect, it } from 'vitest';
import { cycleOrder, rotateToFront } from './cycleOrder';

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

describe('rotateToFront', () => {
  it('brings the right peek to the centre (matches landing next/cycleOrder)', () => {
    const order = [0, 1, 2]; // front, backRight, backLeft
    expect(rotateToFront(order, 1)).toEqual([1, 2, 0]);
    expect(rotateToFront(order, 1)).toEqual(cycleOrder(order));
  });
  it('brings the left peek to the centre (matches landing prev)', () => {
    const order = [0, 1, 2];
    expect(rotateToFront(order, 2)).toEqual([2, 0, 1]);
  });
  it('is a no-op when the target is already front', () => {
    expect(rotateToFront([0, 1, 2], 0)).toEqual([0, 1, 2]);
  });
  it('returns a copy when the target is absent', () => {
    expect(rotateToFront([0, 1, 2], 9)).toEqual([0, 1, 2]);
  });
  it('preserves ring order for a longer deck', () => {
    expect(rotateToFront([0, 1, 2, 3], 2)).toEqual([2, 3, 0, 1]);
  });
  it('always lands the target at the front', () => {
    const order = [4, 7, 1, 9];
    for (const t of order) {
      expect(rotateToFront(order, t)[0]).toBe(t);
    }
  });
});
