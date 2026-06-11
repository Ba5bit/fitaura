import { useEffect, useState } from 'react';

/**
 * Animated count-up. When `run` is false the target shows immediately (used for
 * static contexts and reduced-motion). Uses setInterval so it survives rAF
 * throttling. Ported from the design's `useCountUp`.
 */
export function useCountUp(target: number, run: boolean, ms = 900): number {
  const [n, setN] = useState(run ? 0 : target);

  useEffect(() => {
    if (!run) {
      setN(target);
      return;
    }
    const start = performance.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p >= 1) {
        setN(target);
        clearInterval(iv);
      }
    }, 40);
    return () => clearInterval(iv);
  }, [target, run, ms]);

  return n;
}
