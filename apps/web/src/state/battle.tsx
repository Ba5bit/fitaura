import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VersusMode } from '@fitaura/shared';

/**
 * Friend vs Friend battle state — the decoupled hand-off between the three
 * versus screens (Upload → Scan → Result). Transient by design: the committed
 * battle lives in memory and is mirrored to `sessionStorage` so a refresh on the
 * Scan/Result screens survives, but it does not persist across sessions and is
 * never written to the per-account IndexedDB the Solo flow uses.
 *
 * Upload WRITES the battle on launch; Scan + Result READ it on mount with
 * `Player A` / `Player B` fallbacks.
 */

export interface BattleImages {
  aFace?: string;
  aFit?: string;
  bFace?: string;
  bFit?: string;
}

export interface Battle {
  mode: VersusMode;
  nameA: string;
  nameB: string;
  imgs: BattleImages;
}

const STORAGE_KEY = 'fvf:battle';

export const DEFAULT_NAME_A = 'Player A';
export const DEFAULT_NAME_B = 'Player B';

interface BattleContextValue {
  battle: Battle | null;
  /** True once the initial sessionStorage read has run. */
  hydrated: boolean;
  /** Write the battle (Upload, on launch) — persists to sessionStorage. */
  commit: (battle: Battle) => void;
  /** Drop the battle (e.g. New battle / Rematch reset). */
  clear: () => void;
}

const BattleContext = createContext<BattleContextValue | null>(null);

function readStored(): Battle | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Battle>;
    if (!parsed || typeof parsed !== 'object') return null;
    const mode = parsed.mode;
    if (mode !== 'face' && mode !== 'fit' && mode !== 'both') return null;
    return {
      mode,
      nameA: typeof parsed.nameA === 'string' ? parsed.nameA : DEFAULT_NAME_A,
      nameB: typeof parsed.nameB === 'string' ? parsed.nameB : DEFAULT_NAME_B,
      imgs: parsed.imgs && typeof parsed.imgs === 'object' ? parsed.imgs : {},
    };
  } catch {
    return null;
  }
}

export function BattleProvider({ children }: { children: ReactNode }) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBattle(readStored());
    setHydrated(true);
  }, []);

  const commit = useCallback((next: Battle) => {
    setBattle(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* sessionStorage unavailable — keep the in-memory battle */
    }
  }, []);

  const clear = useCallback(() => {
    setBattle(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<BattleContextValue>(
    () => ({ battle, hydrated, commit, clear }),
    [battle, hydrated, commit, clear],
  );

  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>;
}

export function useBattle(): BattleContextValue {
  const ctx = useContext(BattleContext);
  if (!ctx) throw new Error('useBattle must be used within a BattleProvider');
  return ctx;
}

/** The two names with fallbacks applied — used by Scan + Result. */
export function battleNames(battle: Battle | null): { a: string; b: string } {
  return {
    a: battle?.nameA?.trim() || DEFAULT_NAME_A,
    b: battle?.nameB?.trim() || DEFAULT_NAME_B,
  };
}
