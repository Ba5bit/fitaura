import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ReceiptPaper } from '@fitaura/shared';
import { useAccount } from '../features/account/AccountContext';
import { asEditionId, type EditionId } from '../components/cards/editions/registry';
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
  type AccountPreferences,
} from '../services/preferencesService';

/**
 * App preferences (default receipt paper, reduce-motion) that follow the account
 * across devices. They live on the per-account `profiles` row server-side; the
 * device keeps a localStorage mirror so the choice renders instantly on load and
 * still works for signed-out guests.
 *
 * Reconciliation: on sign-in the account's saved value wins and is written back
 * to the mirror (so a fresh device reflects the account). A change made while
 * signed in updates the mirror AND the server; a guest's change is mirror-only.
 *
 * The localStorage keys are unchanged (`fitaura.paper`, `fitaura.reduceMotion`)
 * so existing on-device choices carry over and the delete-account wipe of every
 * `fitaura.*` key still clears them.
 */

const PAPER_KEY = 'fitaura.paper';
const MOTION_KEY = 'fitaura.reduceMotion';
// Active card theme/edition (what the cards actually render as). Device-local (not
// account-synced) so it needs no profiles column; the UI only lets you pick
// editions you've actually unlocked.
const EDITION_KEY = 'fitaura.edition';
// Which theme is *turned on* via the Settings → Themes pills. Separate from the
// active edition: turning a theme on reveals the Default | <theme> switch on the
// result pages, and that switch sets `edition`. So you can sit on Default while
// the theme stays on (switch visible). Device-local, same as EDITION_KEY.
const EDITION_ON_KEY = 'fitaura.editionEnabled';

function readEdition(key: string): EditionId {
  try {
    return asEditionId(localStorage.getItem(key));
  } catch {
    return 'default';
  }
}

/** Persist an edition value to its localStorage key; returns the narrowed id. */
function writeEdition(key: string, id: EditionId): EditionId {
  const e = asEditionId(id);
  try {
    localStorage.setItem(key, e);
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  return e;
}

function readMirror(): AccountPreferences {
  const read = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    receiptPaper: read<ReceiptPaper>(PAPER_KEY, DEFAULT_PREFERENCES.receiptPaper),
    reduceMotion: read<boolean>(MOTION_KEY, DEFAULT_PREFERENCES.reduceMotion),
  };
}

function writeMirror(prefs: AccountPreferences): void {
  try {
    localStorage.setItem(PAPER_KEY, JSON.stringify(prefs.receiptPaper));
    localStorage.setItem(MOTION_KEY, JSON.stringify(prefs.reduceMotion));
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
}

interface PreferencesValue extends AccountPreferences {
  setReceiptPaper: (paper: ReceiptPaper) => void;
  setReduceMotion: (on: boolean) => void;
  /** Active card theme/edition (what renders); set by the result EditionSwitch. */
  edition: EditionId;
  setEdition: (id: EditionId) => void;
  /** Theme turned on via the Settings → Themes pills; gates the result EditionSwitch. */
  enabledEdition: EditionId;
  setEnabledEdition: (id: EditionId) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { userId } = useAccount();
  const [prefs, setPrefs] = useState<AccountPreferences>(() => readMirror());
  const [edition, setEditionState] = useState<EditionId>(() => readEdition(EDITION_KEY));
  const [enabledEdition, setEnabledEditionState] = useState<EditionId>(() => readEdition(EDITION_ON_KEY));

  const setEdition = useCallback((id: EditionId) => {
    setEditionState(writeEdition(EDITION_KEY, id));
  }, []);

  const setEnabledEdition = useCallback((id: EditionId) => {
    setEnabledEditionState(writeEdition(EDITION_ON_KEY, id));
  }, []);

  // Reflect reduce-motion on <html> for CSS/motion code to key off. Lives here
  // (always mounted) rather than on the Settings page so it applies app-wide.
  useEffect(() => {
    const el = document.documentElement;
    if (prefs.reduceMotion) el.setAttribute('data-reduce-motion', 'true');
    else el.removeAttribute('data-reduce-motion');
  }, [prefs.reduceMotion]);

  // On sign-in, the account's saved preferences win and seed the device mirror.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void getPreferences(userId).then((server) => {
      if (!active || !server) return;
      setPrefs(server);
      writeMirror(server);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const update = useCallback(
    (patch: Partial<AccountPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        writeMirror(next);
        return next;
      });
      if (userId) void savePreferences(userId, patch);
    },
    [userId],
  );

  const value = useMemo<PreferencesValue>(
    () => ({
      ...prefs,
      setReceiptPaper: (paper) => update({ receiptPaper: paper }),
      setReduceMotion: (on) => update({ reduceMotion: on }),
      edition,
      setEdition,
      enabledEdition,
      setEnabledEdition,
    }),
    [prefs, update, edition, setEdition, enabledEdition, setEnabledEdition],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
