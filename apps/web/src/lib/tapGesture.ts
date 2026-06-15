/** Detects a double-tap/double-click made of two low-movement taps within a time gap.
 * Pure + time-injected so it's testable. Feed it pointer down/up coordinates + timestamps. */
export interface DoubleTapOpts { maxMove?: number; maxGap?: number; }

export function createDoubleTap(onDouble: () => void, opts: DoubleTapOpts = {}) {
  const maxMove = opts.maxMove ?? 6;
  const maxGap = opts.maxGap ?? 300;
  let downX = 0, downY = 0, downT = 0;
  let lastTapT = 0;
  return {
    down(x: number, y: number, t: number) { downX = x; downY = y; downT = t; },
    up(x: number, y: number, t: number) {
      const moved = Math.hypot(x - downX, y - downY);
      const isTap = moved <= maxMove && t - downT < 500;
      if (!isTap) { lastTapT = 0; return; }
      if (lastTapT && t - lastTapT <= maxGap) { lastTapT = 0; onDouble(); }
      else lastTapT = t;
    },
  };
}
