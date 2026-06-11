import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CREDIT_PACKS } from '@fitaura/shared';
import { useGeneration } from '../../state/generation';
import { useLocalStorage } from '../../state/useLocalStorage';

export interface AccountUser {
  email: string;
  /** Avatar initial. */
  initial: string;
  /** "MEMBER SINCE" label, e.g. "JUN 2026". */
  since: string;
}

/** The overlay surfaces the account/monetization flow can show. */
export type Scene =
  | null
  | 'auth'
  | 'paywall'
  | 'checkout'
  | 'processing'
  | 'success'
  | 'failure'
  | 'logout'
  | 'missing';

interface PersistedAccount {
  signedIn: boolean;
  user: AccountUser | null;
}

const INITIAL: PersistedAccount = { signedIn: false, user: null };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface AccountContextValue {
  signedIn: boolean;
  user: AccountUser | null;
  scene: Scene;
  /** Pack id selected on the credits page / in checkout. */
  pack: string;
  setPack: (id: string) => void;
  /** Credits granted by the last successful purchase (for the success screen). */
  lastPurchaseCredits: number;
  /** A missing-result id, when the missing-result dialog is shown. */
  missingId: string | null;
  toast: string | null;

  flash: (msg: string) => void;
  closeScene: () => void;
  openAuth: () => void;
  signIn: (email?: string) => void;
  requestLogout: () => void;
  confirmLogout: () => void;
  openPaywall: () => void;
  /** Begin checkout for the current/selected pack (gates on sign-in). */
  startCheckout: (packId?: string) => void;
  /** Confirm payment → processing → success (grants credits). */
  pay: () => void;
  /** Force the failure dialog (used by the "different card" path). */
  failPayment: () => void;
  openMissing: (id: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { addCredits } = useGeneration();

  const [acct, setAcct] = useLocalStorage<PersistedAccount>('fitaura.account', INITIAL);
  const [scene, setScene] = useState<Scene>(null);
  const [pack, setPack] = useState<string>(CREDIT_PACKS.find((p) => p.featured)?.id ?? CREDIT_PACKS[0].id);
  const [lastPurchaseCredits, setLastPurchaseCredits] = useState(0);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const procTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const closeScene = useCallback(() => setScene(null), []);
  const openAuth = useCallback(() => setScene('auth'), []);
  const openPaywall = useCallback(() => setScene('paywall'), []);
  const openMissing = useCallback((id: string) => {
    setMissingId(id);
    setScene('missing');
  }, []);

  const signIn = useCallback(
    (email?: string) => {
      const clean = (email || '').trim() || 'you@email.com';
      const now = new Date();
      const user: AccountUser = {
        email: clean,
        initial: (clean[0] || 'U').toUpperCase(),
        since: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
      };
      setAcct({ signedIn: true, user });
      setScene(null);
      flash("Signed in — welcome to your vault.");
      navigate('/vault');
    },
    [setAcct, flash, navigate],
  );

  const requestLogout = useCallback(() => setScene('logout'), []);
  const confirmLogout = useCallback(() => {
    setAcct(INITIAL);
    setScene(null);
    flash('Logged out — results stay on this device.');
    navigate('/');
  }, [setAcct, flash, navigate]);

  const startCheckout = useCallback(
    (packId?: string) => {
      if (packId) setPack(packId);
      if (!acct.signedIn) {
        setScene('auth');
        return;
      }
      setScene('checkout');
    },
    [acct.signedIn],
  );

  const pay = useCallback(() => {
    setScene('processing');
    if (procTimer.current) clearTimeout(procTimer.current);
    procTimer.current = setTimeout(() => {
      const credits = CREDIT_PACKS.find((p) => p.id === pack)?.credits ?? 0;
      addCredits(credits);
      setLastPurchaseCredits(credits);
      setScene('success');
      flash('Credits added to your account.');
    }, 2300);
  }, [pack, addCredits, flash]);

  const failPayment = useCallback(() => setScene('failure'), []);

  const value = useMemo<AccountContextValue>(
    () => ({
      signedIn: acct.signedIn,
      user: acct.user,
      scene,
      pack,
      setPack,
      lastPurchaseCredits,
      missingId,
      toast,
      flash,
      closeScene,
      openAuth,
      signIn,
      requestLogout,
      confirmLogout,
      openPaywall,
      startCheckout,
      pay,
      failPayment,
      openMissing,
    }),
    [
      acct,
      scene,
      pack,
      lastPurchaseCredits,
      missingId,
      toast,
      flash,
      closeScene,
      openAuth,
      signIn,
      requestLogout,
      confirmLogout,
      openPaywall,
      startCheckout,
      pay,
      failPayment,
      openMissing,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
}
