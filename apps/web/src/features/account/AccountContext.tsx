import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CREDIT_PACKS } from '@fitaura/shared';
import { authSignIn, authSignOut, authSignUp, getCurrentSession, onAuthChange } from '../../services/authService';
import { clearFreeScanUsed, getBalance, grantCredits, hasUsedFreeScan, markFreeScanUsed, refundCredit, spendCredit } from '../../services/creditsService';

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

export type AuthStatus = 'idle' | 'pending' | 'error';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function toAccountUser(user: { id: string; email: string | null | undefined }, createdAt?: string): AccountUser {
  const email = user.email ?? 'you@email.com';
  const d = createdAt ? new Date(createdAt) : new Date();
  return {
    email,
    initial: (email[0] || 'U').toUpperCase(),
    since: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  };
}

interface AccountContextValue {
  signedIn: boolean;
  user: AccountUser | null;
  /** Server-side credit balance for the signed-in user. */
  credits: number;
  /** Guest only: a free first scan is still available. */
  freeScanAvailable: boolean;
  /** Whether a scan can start right now (guest free, or has credits). */
  canScan: boolean;
  /** Spend for one scan: guest → mark free used; signed-in → spend a credit. Returns ok. */
  spendForScan: () => Promise<boolean>;
  /** Give back what spendForScan took, when a scan ultimately fails. */
  refundScan: () => Promise<void>;

  scene: Scene;
  authStatus: AuthStatus;
  authError: string | null;
  /** Pack id selected on the credits page / in checkout. */
  pack: string;
  setPack: (id: string) => void;
  lastPurchaseCredits: number;
  missingId: string | null;
  toast: string | null;

  flash: (msg: string) => void;
  closeScene: () => void;
  openAuth: (redirectTo?: string) => void;
  /** Email/password sign-up. Resolves true on success. */
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Email/password log-in. Resolves true on success. */
  logIn: (email: string, password: string) => Promise<boolean>;
  requestLogout: () => void;
  confirmLogout: () => void;
  openPaywall: () => void;
  startCheckout: (packId?: string) => void;
  pay: () => void;
  failPayment: () => void;
  openMissing: (id: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AccountUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [freeScanAvailable, setFreeScanAvailable] = useState(!hasUsedFreeScan());

  const [scene, setScene] = useState<Scene>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authError, setAuthError] = useState<string | null>(null);
  // Default the checkout selection to the 5-credit starter pack for the demo.
  const [pack, setPack] = useState<string>(CREDIT_PACKS.find((p) => p.id === 'starter')?.id ?? CREDIT_PACKS[0].id);
  const [lastPurchaseCredits, setLastPurchaseCredits] = useState(0);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const procTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authRedirect = useRef<string | null>(null);

  const signedIn = !!userId;

  // Hydrate the session on mount and subscribe to auth changes (sign-in/out
  // from any tab). The Supabase session — not localStorage — is the source of truth.
  useEffect(() => {
    let active = true;
    const apply = async (uid: string | null, email: string | null | undefined, createdAt?: string) => {
      if (!active) return;
      if (uid) {
        setUserId(uid);
        setUser(toAccountUser({ id: uid, email }, createdAt));
        setCredits(await getBalance(uid));
      } else {
        setUserId(null);
        setUser(null);
        setCredits(0);
      }
    };
    getCurrentSession().then((s) =>
      apply(s?.user.id ?? null, s?.user.email, s?.user.created_at),
    );
    const unsub = onAuthChange((s) =>
      apply(s?.user.id ?? null, s?.user.email, s?.user.created_at),
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const closeScene = useCallback(() => {
    authRedirect.current = null;
    setAuthStatus('idle');
    setAuthError(null);
    setScene(null);
  }, []);
  const openAuth = useCallback((redirectTo?: string) => {
    authRedirect.current = redirectTo ?? null;
    setAuthStatus('idle');
    setAuthError(null);
    setScene('auth');
  }, []);
  const openPaywall = useCallback(() => setScene('paywall'), []);
  const openMissing = useCallback((id: string) => {
    setMissingId(id);
    setScene('missing');
  }, []);

  // Shared completion for a successful sign-up or log-in.
  const finishAuth = useCallback(
    (uid: string, email: string | null | undefined) => {
      setUserId(uid);
      setUser(toAccountUser({ id: uid, email }));
      setAuthStatus('idle');
      setScene(null);
      const dest = authRedirect.current ?? '/vault';
      authRedirect.current = null;
      flash(dest === '/vault' ? 'Signed in — welcome to your vault.' : 'Signed in — revealing your verdict…');
      navigate(dest);
    },
    [flash, navigate],
  );

  const signUp = useCallback<AccountContextValue['signUp']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignUp(email, password);
      if (!res.ok) {
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      // Registration and login are deliberately two steps. Email confirmation is
      // off, so Supabase auto-creates a session on signup — discard it so the
      // user logs in explicitly next (the AuthGate switches to the Log in tab).
      // The profile (3 credits) was already created by the DB signup trigger.
      await authSignOut();
      setAuthStatus('idle');
      return true;
    },
    [],
  );

  const logIn = useCallback<AccountContextValue['logIn']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignIn(email, password);
      if (!res.ok) {
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      setCredits(await getBalance(res.user.id));
      finishAuth(res.user.id, res.user.email);
      return true;
    },
    [finishAuth],
  );

  const requestLogout = useCallback(() => setScene('logout'), []);
  const confirmLogout = useCallback(async () => {
    await authSignOut();
    setUserId(null);
    setUser(null);
    setCredits(0);
    setScene(null);
    flash('Logged out — results stay on this device.');
    navigate('/');
  }, [flash, navigate]);

  const canScan = signedIn ? credits > 0 : freeScanAvailable;

  const spendForScan = useCallback<AccountContextValue['spendForScan']>(async () => {
    if (!signedIn) {
      if (!freeScanAvailable) return false;
      markFreeScanUsed();
      setFreeScanAvailable(false);
      return true;
    }
    if (!userId) return false;
    const res = await spendCredit(userId);
    setCredits(res.balance);
    return res.ok;
  }, [signedIn, freeScanAvailable, userId]);

  const refundScan = useCallback<AccountContextValue['refundScan']>(async () => {
    if (!signedIn) {
      clearFreeScanUsed();
      setFreeScanAvailable(true);
      return;
    }
    if (!userId) return;
    const next = await refundCredit(userId);
    setCredits(next);
  }, [signedIn, userId]);

  const startCheckout = useCallback(
    (packId?: string) => {
      if (packId) setPack(packId);
      if (!signedIn) {
        authRedirect.current = null;
        setScene('auth');
        return;
      }
      setScene('checkout');
    },
    [signedIn],
  );

  const pay = useCallback(() => {
    setScene('processing');
    if (procTimer.current) clearTimeout(procTimer.current);
    procTimer.current = setTimeout(async () => {
      const packCredits = CREDIT_PACKS.find((p) => p.id === pack)?.credits ?? 0;
      if (userId) {
        const next = await grantCredits(userId, packCredits);
        setCredits(next);
      }
      setLastPurchaseCredits(packCredits);
      setScene('success');
      flash('Credits added to your account.');
    }, 2300);
  }, [pack, userId, flash]);

  const failPayment = useCallback(() => setScene('failure'), []);

  const value = useMemo<AccountContextValue>(
    () => ({
      signedIn,
      user,
      credits,
      freeScanAvailable,
      canScan,
      spendForScan,
      refundScan,
      scene,
      authStatus,
      authError,
      pack,
      setPack,
      lastPurchaseCredits,
      missingId,
      toast,
      flash,
      closeScene,
      openAuth,
      signUp,
      logIn,
      requestLogout,
      confirmLogout,
      openPaywall,
      startCheckout,
      pay,
      failPayment,
      openMissing,
    }),
    [
      signedIn, user, credits, freeScanAvailable, canScan, spendForScan, refundScan, scene, authStatus, authError,
      pack, lastPurchaseCredits, missingId, toast, flash, closeScene, openAuth, signUp, logIn,
      requestLogout, confirmLogout, openPaywall, startCheckout, pay, failPayment, openMissing,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
}
