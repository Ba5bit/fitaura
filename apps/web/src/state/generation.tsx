import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import {
  DATING_VERDICTS,
  type DatingVerdict,
  type FullGenerationResult,
} from '@fitaura/shared';
import { MOCK_GENERATIONS } from '../data/mockGenerations';
import { useLocalStorage } from './useLocalStorage';

/** A baked, cropped photo ready to drop into a card (data URL, on-device). */
export interface UploadedPhoto {
  url: string;
}

export interface GenerationResult extends FullGenerationResult {
  /** When this generation was produced (device-local history). */
  producedAt: string;
  /** Optional user-given name for the vault (defaults to the generation id). */
  name?: string;
}

/** Newest results kept on-device. Capped so localStorage stays small. */
const HISTORY_CAP = 4;

/** Device-domain only — photos/results never leave the device (privacy rule). */
interface PersistedState {
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  result: GenerationResult | null;
  history: GenerationResult[];
}

const INITIAL: PersistedState = {
  face: null,
  outfit: null,
  result: null,
  history: [],
};

type RunOutcome = { ok: true; result: GenerationResult } | { ok: false; reason: 'missing_photos' };

interface GenerationContextValue {
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  result: GenerationResult | null;
  bothPhotosReady: boolean;
  /** Recent on-device results (newest first). */
  history: GenerationResult[];
  setFace: (photo: UploadedPhoto | null) => void;
  setOutfit: (photo: UploadedPhoto | null) => void;
  /** Builds the result from the uploaded photos. Credit gating happens in AccountContext. */
  runGeneration: (verdict?: DatingVerdict) => RunOutcome;
  /** Clears the current photos to begin a fresh scan (keeps result/history). */
  startNewScan: () => void;
  /** Make a stored history result the current one. Returns false if missing. */
  openResult: (generationId: string) => boolean;
  /** Permanently remove a result from the on-device history. */
  removeResult: (generationId: string) => void;
  /** Rename a result in the on-device history. */
  renameResult: (generationId: string, name: string) => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

function pickVerdict(): DatingVerdict {
  return DATING_VERDICTS[Math.floor(Math.random() * DATING_VERDICTS.length)];
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [rawState, setState] = useLocalStorage<PersistedState>('fitaura.state', INITIAL);

  // Coerce against legacy persisted state (older blobs predate `history`, and
  // earlier versions stored credits/freeUsed here — those are dropped on read).
  const state: PersistedState = {
    face: rawState.face ?? null,
    outfit: rawState.outfit ?? null,
    result: rawState.result ?? null,
    history: rawState.history ?? [],
  };

  // Mirror of the latest state so runGeneration can decide its outcome purely,
  // without relying on side-effects inside a setState updater (which React
  // StrictMode intentionally double-invokes).
  const stateRef = useRef(state);
  stateRef.current = state;

  const setFace = useCallback(
    (photo: UploadedPhoto | null) => setState((s) => ({ ...s, face: photo })),
    [setState],
  );
  const setOutfit = useCallback(
    (photo: UploadedPhoto | null) => setState((s) => ({ ...s, outfit: photo })),
    [setState],
  );

  const bothPhotosReady = !!state.face && !!state.outfit;

  const runGeneration = useCallback<GenerationContextValue['runGeneration']>(
    (verdict) => {
      const s = stateRef.current;
      if (!s.face || !s.outfit) return { ok: false, reason: 'missing_photos' };

      const chosen = verdict ?? pickVerdict();
      const base = MOCK_GENERATIONS[chosen];
      const now = new Date().toISOString();
      const result: GenerationResult = {
        ...base,
        producedAt: now,
        face: { ...base.face, card: { ...base.face.card, imageUrl: s.face.url } },
        outfit: { ...base.outfit, card: { ...base.outfit.card, imageUrl: s.outfit.url } },
        receipt: { ...base.receipt, generatedAt: now },
      };

      const history = [result, ...s.history.filter((h) => h.receipt.generationId !== result.receipt.generationId)].slice(
        0,
        HISTORY_CAP,
      );
      const next: PersistedState = { ...s, result, history };
      stateRef.current = next;
      setState(next);
      return { ok: true, result };
    },
    [setState],
  );

  const startNewScan = useCallback(
    () => setState((s) => ({ ...s, face: null, outfit: null })),
    [setState],
  );

  const openResult = useCallback(
    (generationId: string) => {
      const found = stateRef.current.history.find((h) => h.receipt.generationId === generationId);
      if (!found) return false;
      setState((s) => ({ ...s, result: found }));
      return true;
    },
    [setState],
  );

  const removeResult = useCallback(
    (generationId: string) =>
      setState((s) => ({
        ...s,
        history: s.history.filter((h) => h.receipt.generationId !== generationId),
        result: s.result?.receipt.generationId === generationId ? null : s.result,
      })),
    [setState],
  );

  const renameResult = useCallback(
    (generationId: string, name: string) => {
      const clean = name.trim();
      setState((s) => {
        const apply = (r: GenerationResult): GenerationResult =>
          r.receipt.generationId === generationId ? { ...r, name: clean || undefined } : r;
        return {
          ...s,
          history: s.history.map(apply),
          result: s.result ? apply(s.result) : s.result,
        };
      });
    },
    [setState],
  );

  const value = useMemo<GenerationContextValue>(
    () => ({
      face: state.face,
      outfit: state.outfit,
      result: state.result,
      bothPhotosReady,
      history: state.history,
      setFace,
      setOutfit,
      runGeneration,
      startNewScan,
      openResult,
      removeResult,
      renameResult,
    }),
    [state, bothPhotosReady, setFace, setOutfit, runGeneration, startNewScan, openResult, removeResult, renameResult],
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used within a GenerationProvider');
  return ctx;
}
