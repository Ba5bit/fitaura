import { describe, expect, it } from 'vitest';
import { createDoubleTap } from './tapGesture';

describe('createDoubleTap', () => {
  it('fires on two quick low-movement taps', () => {
    let fired = 0;
    const dt = createDoubleTap(() => { fired++; }, { maxMove: 6, maxGap: 300 });
    dt.down(0, 0, 1000); dt.up(2, 2, 1080);   // tap 1
    dt.down(1, 1, 1200); dt.up(2, 0, 1260);   // tap 2 within gap
    expect(fired).toBe(1);
  });

  it('does not fire when the pointer moved too far (a drag)', () => {
    let fired = 0;
    const dt = createDoubleTap(() => { fired++; }, { maxMove: 6, maxGap: 300 });
    dt.down(0, 0, 1000); dt.up(40, 40, 1080); // moved → not a tap
    dt.down(0, 0, 1200); dt.up(2, 2, 1260);
    expect(fired).toBe(0);
  });

  it('does not fire when taps are too far apart in time', () => {
    let fired = 0;
    const dt = createDoubleTap(() => { fired++; }, { maxMove: 6, maxGap: 300 });
    dt.down(0, 0, 1000); dt.up(1, 1, 1050);
    dt.down(0, 0, 2000); dt.up(1, 1, 2050);   // gap 950ms
    expect(fired).toBe(0);
  });
});
