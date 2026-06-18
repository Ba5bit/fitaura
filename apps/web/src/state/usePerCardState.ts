import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Like {@link useLocalStorage} but for a key that CHANGES at runtime — e.g. one
 * key per saved result id, so each card remembers its own sticker placement.
 *
 * It loads the stored value whenever the key changes (a different card opened,
 * or the result hydrating after a reload) and persists on change. It tracks the
 * last value written for the active key, so the load itself never re-writes
 * storage and switching cards can never overwrite one card's saved state with
 * another's. A `null` key disables persistence: the value stays `initial` and
 * nothing is read or written (used before the result has loaded).
 */
export function usePerCardState<T>(
  key: string | null,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const keyRef = useRef<string | null>(null);
  const savedRef = useRef<{ key: string; json: string } | null>(null);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // Load when the key changes (new card opened, or result hydrated).
  useEffect(() => {
    keyRef.current = key;
    if (!key) return;
    let next = initialRef.current;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
      if (raw != null) next = JSON.parse(raw) as T;
    } catch {
      /* corrupt entry — fall back to initial */
    }
    // Mark current storage as "saved" so the load echo below is a no-op write.
    savedRef.current = { key, json: raw ?? JSON.stringify(next) };
    setValue(next);
  }, [key]);

  // Persist on change, skipping writes that match what's already stored for this
  // key (the load echo, and re-renders that don't touch the value).
  useEffect(() => {
    const k = keyRef.current;
    if (!k) return;
    const json = JSON.stringify(value);
    if (savedRef.current && savedRef.current.key === k && savedRef.current.json === json) return;
    try {
      localStorage.setItem(k, json);
      savedRef.current = { key: k, json };
    } catch {
      /* quota/serialization — non-fatal for an entertainment app */
    }
  }, [value]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, set];
}
