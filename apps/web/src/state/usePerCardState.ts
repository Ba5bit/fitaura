import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Like {@link useLocalStorage} but for a key that CHANGES at runtime — e.g. one
 * key per saved result id, so each card remembers its own sticker placement.
 *
 * Loads the stored value whenever the key changes (a different card opened, or
 * the result hydrating after a reload). Persists **write-through** inside the
 * setter, so only explicit updates touch storage — the load never echoes a
 * write, and switching cards can't overwrite one card's saved state with
 * another's. A `null` key disables persistence (the value stays `initial` and
 * nothing is read or written) — used before the result has loaded.
 */
export function usePerCardState<T>(
  key: string | null,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const keyRef = useRef<string | null>(null);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // Load when the key changes (new card opened, or result hydrated).
  useEffect(() => {
    keyRef.current = key;
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setValue(raw != null ? (JSON.parse(raw) as T) : initialRef.current);
    } catch {
      setValue(initialRef.current);
    }
  }, [key]);

  // Persist only explicit updates, to the key that's currently active.
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      const k = keyRef.current;
      if (k) {
        try {
          localStorage.setItem(k, JSON.stringify(v));
        } catch {
          /* quota/serialization — non-fatal for an entertainment app */
        }
      }
      return v;
    });
  }, []);

  return [value, set];
}
