import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { runSoloScan, type SoloScanOutcome } from '../services/soloScanService';
import { useAccount } from '../features/account/AccountContext';
import {
  accountKeyFor, loadAccount, putResult, putSession, deleteResult, renameResultDb,
  moveAccountData, migrateLegacyLocalStorage, trimToCap,
  type UploadedPhoto, type GenerationResult,
} from './generationDb';

// Re-export the shared types so existing consumers keep importing them from here.
export type { UploadedPhoto, GenerationResult } from './generationDb';

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
  canScanPhotos: boolean;
  /** Recent on-device results for the current account (newest first). */
  history: GenerationResult[];
  /** False until the current account's on-device data has loaded from IndexedDB. */
  hydrated: boolean;
  setFace: (photo: UploadedPhoto | null) => void;
  setOutfit: (photo: UploadedPhoto | null) => void;
  runGeneration: () => Promise<RunOutcome>;
  startNewScan: () => void;
  openResult: (generationId: string) => boolean;
  removeResult: (generationId: string) => void;
  renameResult: (generationId: string, name: string) => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { userId } = useAccount();
  const accountKey = accountKeyFor(userId);

  const [face, setFaceState] = useState<UploadedPhoto | null>(null);
  const [outfit, setOutfitState] = useState<UploadedPhoto | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const result = useMemo(
    () => history.find((h) => h.receipt.generationId === currentId) ?? null,
    [history, currentId],
  );

  // Latest snapshot for callbacks that run after an await (avoids stale closures).
  const stateRef = useRef({ face, outfit, history, currentId, accountKey });
  stateRef.current = { face, outfit, history, currentId, accountKey };

  // Tracks the previous account so a guest→login transition can be detected.
  // undefined = first run (no hand-off); null = was guest; string = was signed in.
  const prevUserId = useRef<string | null | undefined>(undefined);

  // Hydrate on mount and on account switch; run the one-time legacy migration and
  // the guest→login hand-off. Degrades to in-memory if IndexedDB is unavailable.
  useEffect(() => {
    let active = true;
    setHydrated(false);
    // Reset in-memory state immediately so stateRef is consistent with the
    // new accountKey during the IndexedDB load window. Without this, any write
    // that fires before the await resolves would use the new key but the old
    // account's face/outfit/history, corrupting the wrong namespace.
    setFaceState(null);
    setOutfitState(null);
    setHistory([]);
    setCurrentId(null);
    void (async () => {
      try {
        await migrateLegacyLocalStorage(Date.now());
        if (prevUserId.current === null && userId) {
          await moveAccountData('guest', accountKey, Date.now());
        }
        const data = await loadAccount(accountKey, Date.now());
        if (!active) return;
        setFaceState(data.session.face);
        setOutfitState(data.session.outfit);
        setCurrentId(data.session.currentResultId);
        setHistory(data.results);
      } catch {
        // IndexedDB blocked/unavailable — keep whatever is in memory.
      } finally {
        if (active) {
          prevUserId.current = userId;
          setHydrated(true);
        }
      }
    })();
    return () => { active = false; };
  }, [accountKey, userId]);

  const persistSession = useCallback((next: Partial<{ face: UploadedPhoto | null; outfit: UploadedPhoto | null; currentResultId: string | null }>) => {
    const s = stateRef.current;
    void putSession(s.accountKey, {
      accountKey: s.accountKey,
      face: next.face !== undefined ? next.face : s.face,
      outfit: next.outfit !== undefined ? next.outfit : s.outfit,
      currentResultId: next.currentResultId !== undefined ? next.currentResultId : s.currentId,
    });
  }, []);

  const setFace = useCallback((photo: UploadedPhoto | null) => {
    setFaceState(photo);
    persistSession({ face: photo });
  }, [persistSession]);

  const setOutfit = useCallback((photo: UploadedPhoto | null) => {
    setOutfitState(photo);
    persistSession({ outfit: photo });
  }, [persistSession]);

  const canScanPhotos = !!face || !!outfit;

  const runGeneration = useCallback<GenerationContextValue['runGeneration']>(async () => {
    const s = stateRef.current;
    if (!s.face && !s.outfit) return { ok: false, reason: 'missing_photos' };

    // Capture the account identity and photos BEFORE the long await so that an
    // account switch during the scan cannot cause us to persist under the wrong key.
    const startedKey = s.accountKey;
    const startedFace = s.face;
    const startedOutfit = s.outfit;

    const outcome = await runSoloScan(startedFace?.url ?? null, startedOutfit?.url ?? null);
    if (outcome.kind === 'retake') {
      return { ok: false, reason: 'retake', retake: { faceUsable: outcome.faceUsable, outfitUsable: outcome.outfitUsable, instruction: outcome.instruction } };
    }
    if (outcome.kind === 'error') {
      return { ok: false, reason: 'error', message: outcome.message };
    }

    const now = new Date().toISOString();
    const base = outcome.result;
    // Use the pre-await photos for card imageUrls — never the post-await snapshot.
    const result: GenerationResult = {
      ...base,
      producedAt: now,
      face: base.face ? { ...base.face, card: { ...base.face.card, imageUrl: startedFace?.url ?? null } } : null,
      outfit: base.outfit ? { ...base.outfit, card: { ...base.outfit.card, imageUrl: startedOutfit?.url ?? null } } : null,
      receipt: { ...base.receipt, generatedAt: now },
    };

    await putResult(startedKey, result);
    void putSession(startedKey, { accountKey: startedKey, face: startedFace, outfit: startedOutfit, currentResultId: result.receipt.generationId });

    // Only update the live React state if the provider is still on the account
    // that started this generation. If the user switched mid-scan the result is
    // safely persisted in IndexedDB and will appear on next load of that account.
    if (stateRef.current.accountKey === startedKey) {
      setHistory((prev) => trimToCap([result, ...prev.filter((h) => h.receipt.generationId !== result.receipt.generationId)]));
      setCurrentId(result.receipt.generationId);
    }
    return { ok: true, result };
  }, []);

  const startNewScan = useCallback(() => {
    setFaceState(null);
    setOutfitState(null);
    persistSession({ face: null, outfit: null });
  }, [persistSession]);

  const openResult = useCallback((generationId: string) => {
    const s = stateRef.current;
    if (!s.history.some((h) => h.receipt.generationId === generationId)) return false;
    setCurrentId(generationId);
    persistSession({ currentResultId: generationId });
    return true;
  }, [persistSession]);

  const removeResult = useCallback((generationId: string) => {
    const s = stateRef.current;
    setHistory((prev) => prev.filter((h) => h.receipt.generationId !== generationId));
    if (s.currentId === generationId) {
      setCurrentId(null);
      persistSession({ currentResultId: null });
    }
    void deleteResult(s.accountKey, generationId);
  }, [persistSession]);

  const renameResult = useCallback((generationId: string, name: string) => {
    const clean = name.trim();
    setHistory((prev) => prev.map((r) => (r.receipt.generationId === generationId ? { ...r, name: clean || undefined } : r)));
    void renameResultDb(stateRef.current.accountKey, generationId, clean);
  }, []);

  const value = useMemo<GenerationContextValue>(
    () => ({
      face, outfit, result, canScanPhotos, history, hydrated,
      setFace, setOutfit, runGeneration, startNewScan, openResult, removeResult, renameResult,
    }),
    [face, outfit, result, canScanPhotos, history, hydrated, setFace, setOutfit, runGeneration, startNewScan, openResult, removeResult, renameResult],
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used within a GenerationProvider');
  return ctx;
}
