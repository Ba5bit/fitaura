import { useEffect, useState } from 'react';

/**
 * Animated count-up. When `run` is false the target shows immediately (used for
 * static contexts and reduced-motion). `delayMs` holds the value at 0 before the
 * count starts — used to stagger a row of count-ups. Uses setInterval so it
 * survives rAF throttling. Ported from the design's `useCountUp`.
 */
export function useCountUp(target: number, run: boolean, ms = 900, delayMs = 0): number {
  const [n, setN] = useState(run ? 0 : target);

  useEffect(() => {
    if (!run) {
      setN(target);
      return;
    }
    // Hold at 0 through the stagger delay, then count up.
    setN(0);
    let iv: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      const start = performance.now();
      iv = setInterval(() => {
        const p = Math.min(1, (performance.now() - start) / ms);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(target * eased));
        if (p >= 1) {
          setN(target);
          if (iv) clearInterval(iv);
        }
      }, 40);
    }, delayMs);
    return () => {
      clearTimeout(startTimer);
      if (iv) clearInterval(iv);
    };
  }, [target, run, ms, delayMs]);

  return n;
}
