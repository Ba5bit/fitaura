import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { VersusMode, VersusResult } from '@fitaura/shared';
import { useAccount } from '../features/account/AccountContext';
import {
  accountKeyFor, loadBattles, putBattle, deleteBattle, renameBattleDb,
  type SavedBattle,
} from './generationDb';

// Re-export so vault consumers can import the saved-battle type from here.
export type { SavedBattle } from './generationDb';

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
const RESULT_KEY = 'fvf:result';

export const DEFAULT_NAME_A = 'Player A';
export const DEFAULT_NAME_B = 'Player B';

interface BattleContextValue {
  battle: Battle | null;
  /** The AI verdict produced during the scan, or null until it lands. */
  result: VersusResult | null;
  /** True once the initial sessionStorage read has run. */
  hydrated: boolean;
  /** Write the battle (Upload, on launch) — persists to sessionStorage. A fresh
   * battle invalidates any prior verdict. */
  commit: (battle: Battle) => void;
  /** Store the verdict (Scan, on success) — persists to sessionStorage. */
  commitResult: (result: VersusResult) => void;
  /** Drop the battle + verdict (e.g. New battle / Rematch reset). */
  clear: () => void;
  /** Saved battles for the current account (on-device, newest first). */
  history: SavedBattle[];
  /** False until the current account's saved battles have loaded. */
  historyHydrated: boolean;
  /** Persist a completed battle to the on-device vault (Scan, on success). */
  saveBattle: (battle: Battle, result: VersusResult) => void;
  /** Load a saved battle into the transient flow; true when found. */
  openBattle: (battleId: string) => boolean;
  /** Delete a saved battle from this device. */
  removeBattle: (battleId: string) => void;
  /** Rename a saved battle on this device. */
  renameBattle: (battleId: string, name: string) => void;
}

const BattleContext = createContext<BattleContextValue | null>(null);

function readStored(): Battle | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Battle>;
    if (!parsed || typeof parsed !== 'object') return null;
    const mode = parsed.mode;
    if (mode !== 'face' && mode !== 'fit') return null;
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

/** Loose hydration guard for a stored verdict — transient dev data, so a bad
 * shape just falls back to null (the Result screen regenerates a placeholder). */
function readStoredResult(): VersusResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VersusResult>;
    if (!parsed || typeof parsed !== 'object') return null;
    const mode = parsed.mode;
    if (mode !== 'face' && mode !== 'fit') return null;
    if (!parsed.copy || typeof parsed.copy !== 'object') return null;
    return parsed as VersusResult;
  } catch {
    return null;
  }
}

export function BattleProvider({ children }: { children: ReactNode }) {
  const { userId } = useAccount();
  const accountKey = accountKeyFor(userId);

  const [battle, setBattle] = useState<Battle | null>(null);
  const [result, setResult] = useState<VersusResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<SavedBattle[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);

  // Latest accountKey for callbacks that run after an await (avoids stale closures).
  const keyRef = useRef(accountKey);
  keyRef.current = accountKey;

  // Transient flow hand-off (sessionStorage) — survives a refresh on Scan/Result.
  useEffect(() => {
    setBattle(readStored());
    setResult(readStoredResult());
    setHydrated(true);
  }, []);

  // Per-account saved battles (IndexedDB). Reload on account switch.
  useEffect(() => {
    let active = true;
    setHistoryHydrated(false);
    setHistory([]);
    void (async () => {
      try {
        const battles = await loadBattles(accountKey, Date.now());
        if (active) setHistory(battles);
      } catch {
        /* IndexedDB blocked/unavailable — keep an empty list */
      } finally {
        if (active) setHistoryHydrated(true);
      }
    })();
    return () => { active = false; };
  }, [accountKey]);

  const commit = useCallback((next: Battle) => {
    setBattle(next);
    // A fresh battle invalidates any prior verdict.
    setResult(null);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      sessionStorage.removeItem(RESULT_KEY);
    } catch {
      /* sessionStorage unavailable — keep the in-memory battle */
    }
  }, []);

  const commitResult = useCallback((next: VersusResult) => {
    setResult(next);
    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(next));
    } catch {
      /* sessionStorage unavailable — keep the in-memory result */
    }
  }, []);

  const clear = useCallback(() => {
    setBattle(null);
    setResult(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(RESULT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const saveBattle = useCallback((b: Battle, r: VersusResult) => {
    const key = keyRef.current;
    const saved: SavedBattle = {
      battleId: crypto.randomUUID(),
      producedAt: new Date().toISOString(),
      mode: b.mode,
      nameA: b.nameA,
      nameB: b.nameB,
      imgs: b.imgs,
      result: r,
    };
    void putBattle(key, saved);
    // Only reflect in live state if still on the account that produced it.
    setHistory((prev) => (keyRef.current === key ? [saved, ...prev] : prev));
  }, []);

  const openBattle = useCallback((battleId: string): boolean => {
    const saved = history.find((b) => b.battleId === battleId);
    if (!saved) return false;
    const b: Battle = { mode: saved.mode, nameA: saved.nameA, nameB: saved.nameB, imgs: saved.imgs };
    setBattle(b);
    setResult(saved.result);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(b));
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(saved.result));
    } catch {
      /* ignore */
    }
    return true;
  }, [history]);

  const removeBattle = useCallback((battleId: string) => {
    setHistory((prev) => prev.filter((b) => b.battleId !== battleId));
    void deleteBattle(keyRef.current, battleId);
  }, []);

  const renameBattle = useCallback((battleId: string, name: string) => {
    const clean = name.trim();
    setHistory((prev) => prev.map((b) => (b.battleId === battleId ? { ...b, name: clean || undefined } : b)));
    void renameBattleDb(keyRef.current, battleId, clean);
  }, []);

  const value = useMemo<BattleContextValue>(
    () => ({
      battle, result, hydrated, commit, commitResult, clear,
      history, historyHydrated, saveBattle, openBattle, removeBattle, renameBattle,
    }),
    [battle, result, hydrated, commit, commitResult, clear, history, historyHydrated, saveBattle, openBattle, removeBattle, renameBattle],
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
