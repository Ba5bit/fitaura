import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import {
  type FullGenerationResult,
} from '@fitaura/shared';
import { runSoloScan, type SoloScanOutcome } from '../services/soloScanService';
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

/** The retake fields, derived from the service outcome so the two can't drift. */
export type RetakeInfo = Omit<Extract<SoloScanOutcome, { kind: 'retake' }>, 'kind'>;

type RunOutcome =
  | { ok: true; result: GenerationResult }
  | { ok: false; reason: 'missing_photos' }
  | { ok: false; reason: 'retake'; retake: RetakeInfo }
  | { ok: false; reason: 'error'; message: string };

interface GenerationContextValue {
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  result: GenerationResult | null;
  bothPhotosReady: boolean;
  /** Recent on-device results (newest first). */
  history: GenerationResult[];
  setFace: (photo: UploadedPhoto | null) => void;
  setOutfit: (photo: UploadedPhoto | null) => void;
  /** Runs the AI generation from the uploaded photos. Credit gating happens in AccountContext. */
  runGeneration: () => Promise<RunOutcome>;
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

  // Mirror of the latest state so runGeneration can read current state without a
  // stale closure. IMPORTANT: after any await, merge via a functional setState
  // updater (read `prev`) — state may have changed while the scan was in flight.
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

  const runGeneration = useCallback<GenerationContextValue['runGeneration']>(async () => {
    const s = stateRef.current;
    if (!s.face || !s.outfit) return { ok: false, reason: 'missing_photos' };

    const outcome = await runSoloScan(s.face.url, s.outfit.url);
    if (outcome.kind === 'retake') {
      return { ok: false, reason: 'retake', retake: { faceUsable: outcome.faceUsable, outfitUsable: outcome.outfitUsable, instruction: outcome.instruction } };
    }
    if (outcome.kind === 'error') {
      return { ok: false, reason: 'error', message: outcome.message };
    }

    const now = new Date().toISOString();
    const base = outcome.result;
    // Use the photos that were actually scanned (captured before the await) for the
    // card images — not whatever may have been swapped in while the scan was running.
    const result: GenerationResult = {
      ...base,
      producedAt: now,
      face: { ...base.face, card: { ...base.face.card, imageUrl: s.face.url } },
      outfit: { ...base.outfit, card: { ...base.outfit.card, imageUrl: s.outfit.url } },
      receipt: { ...base.receipt, generatedAt: now },
    };

    // Merge into whatever state is current AFTER the await (functional updater) so a
    // face/outfit/history change made during the scan isn't clobbered by a stale snapshot.
    setState((prev) => ({
      ...prev,
      result,
      history: [result, ...prev.history.filter((h) => h.receipt.generationId !== result.receipt.generationId)].slice(
        0,
        HISTORY_CAP,
      ),
    }));
    return { ok: true, result };
  }, [setState]);

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
