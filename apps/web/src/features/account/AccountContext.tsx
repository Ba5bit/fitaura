import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CREDIT_PACKS } from '@fitaura/shared';
import {
  authDeleteAccount, authResend, authResetPassword, authSignIn, authSignInWithGoogle, authSignOut, authSignUp,
  getCurrentSession, onAuthChange, type SimpleResult,
} from '../../services/authService';
import { getBalance, refundCredit, spendCredit } from '../../services/creditsService';
import { createCheckout, openCheckoutOverlay, pollBalanceUntilChange } from '../../services/checkoutService';
import { accountKeyFor, clearAccount } from '../../state/generationDb';

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
  | 'confirm'
  | 'paywall'
  | 'checkout'
  | 'processing'
  | 'success'
  | 'failure'
  | 'logout'
  | 'changePassword'
  | 'deleteAccount'
  | 'missing';

export type ConfirmKind = 'signup' | 'recovery';

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
  /** Stable account id used to namespace on-device storage (null when signed out). */
  userId: string | null;
  user: AccountUser | null;
  /** Server-side credit balance for the signed-in user. */
  credits: number;
  /** Whether a verdict can be generated right now: signed in AND holding credits.
   * Guests can still run the teaser scan, but generation is gated behind sign-up. */
  canScan: boolean;
  /** Spend for one scan: guest → mark free used; signed-in → spend a credit. Returns ok. */
  spendForScan: () => Promise<boolean>;
  /** Give back what spendForScan took, when a scan ultimately fails. */
  refundScan: () => Promise<void>;
  /** Spend for one Friend-vs-Friend battle: signed-in only, costs 2 credits. Returns ok. */
  spendForBattle: () => Promise<boolean>;
  /** Give back what spendForBattle took (2), when a battle ultimately fails. */
  refundBattle: () => Promise<void>;

  scene: Scene;
  authStatus: AuthStatus;
  authError: string | null;
  /** Pack id selected on the credits page / in checkout. */
  pack: string;
  setPack: (id: string) => void;
  lastPurchaseCredits: number;
  missingId: string | null;
  toast: string | null;

  /** Email awaiting confirmation / reset, shown on the confirm scene. */
  pendingEmail: string | null;
  /** Which "check your email" copy to show. */
  confirmKind: ConfirmKind;
  /** Seconds remaining before resend is allowed again (0 = allowed). */
  resendCooldown: number;
  /** Resend the signup-confirmation or password-reset email (cooldown-guarded). */
  resendConfirmation: () => Promise<void>;
  /** Send a password-reset email and open the recovery confirm scene. */
  requestPasswordReset: (email: string) => Promise<void>;

  flash: (msg: string) => void;
  closeScene: () => void;
  openAuth: (redirectTo?: string, mode?: 'signup' | 'login') => void;
  /** Initial tab for the auth modal when it next opens. */
  authInitialMode: 'signup' | 'login';
  /** Email/password sign-up. Resolves true on success. */
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Email/password log-in. Resolves true on success. */
  logIn: (email: string, password: string) => Promise<boolean>;
  /** Start "Continue with Google" OAuth. Redirects the browser away on success;
   * surfaces an auth error in the modal if the handshake can't even start. */
  signInWithGoogle: () => Promise<void>;
  requestLogout: () => void;
  confirmLogout: () => void;
  /** Open the "change password" modal (user already has a live session). */
  openChangePassword: () => void;
  /** Open the destructive "delete account" confirmation modal. */
  requestDeleteAccount: () => void;
  /** Permanently delete the account + wipe this device. Resolves true on success. */
  confirmDeleteAccount: () => Promise<boolean>;
  openPaywall: () => void;
  startCheckout: (packId?: string) => void;
  pay: () => void;
  /** Re-fetch the balance after returning from Polar's hosted success redirect. */
  refreshBalanceAfterPurchase: () => Promise<void>;
  failPayment: () => void;
  openMissing: (id: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AccountUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);

  const [scene, setScene] = useState<Scene>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authError, setAuthError] = useState<string | null>(null);
  // Default the checkout selection to the 5-credit starter pack for the demo.
  const [pack, setPack] = useState<string>(CREDIT_PACKS.find((p) => p.id === 'starter')?.id ?? CREDIT_PACKS[0].id);
  const [lastPurchaseCredits, setLastPurchaseCredits] = useState(0);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authRedirect = useRef<string | null>(null);

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>('signup');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [authInitialMode, setAuthInitialMode] = useState<'signup' | 'login'>('signup');

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const RESEND_COOLDOWN_SECONDS = 45;

  const signedIn = !!userId;

  // Hydrate the session on mount and subscribe to auth changes (sign-in/out
  // from any tab). The Supabase session — not localStorage — is the source of truth.
  //
  // IMPORTANT: this callback only sets identity — it MUST NOT await a Supabase
  // call. onAuthStateChange runs while the auth lock is held; awaiting a query
  // (e.g. getBalance) here deadlocks that lock, which in turn hangs signOut() and
  // makes logout impossible. The balance is fetched in a separate effect below.
  useEffect(() => {
    let active = true;
    const applyIdentity = (uid: string | null, email: string | null | undefined, createdAt?: string) => {
      if (!active) return;
      if (uid) {
        setUserId(uid);
        setUser(toAccountUser({ id: uid, email }, createdAt));
      } else {
        setUserId(null);
        setUser(null);
      }
    };
    getCurrentSession().then((s) =>
      applyIdentity(s?.user.id ?? null, s?.user.email, s?.user.created_at),
    );
    const unsub = onAuthChange((s) =>
      applyIdentity(s?.user.id ?? null, s?.user.email, s?.user.created_at),
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Load the server credit balance whenever the signed-in user changes. Kept out
  // of the onAuthChange callback (see above) so the Supabase query runs after the
  // auth lock is released rather than deadlocking it.
  useEffect(() => {
    if (!userId) {
      setCredits(0);
      return;
    }
    let active = true;
    getBalance(userId).then((b) => {
      if (active) setCredits(b);
    });
    return () => {
      active = false;
    };
  }, [userId]);

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
  const openAuth = useCallback((redirectTo?: string, mode?: 'signup' | 'login') => {
    authRedirect.current = redirectTo ?? null;
    setAuthInitialMode(mode ?? 'signup');
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
      flash(dest === '/vault' ? 'Signed in. Welcome to your vault.' : 'Signed in. Revealing your verdict…');
      navigate(dest);
    },
    [flash, navigate],
  );

  const signUp = useCallback<AccountContextValue['signUp']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignUp(email.trim(), password);
      if (!res.ok) {
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      if (res.status === 'session') {
        // Email confirmation off (e.g. dev): a session already exists — just sign in.
        finishAuth(res.user.id, res.user.email);
        return true;
      }
      // Email confirmation is on: signUp creates no session. Show the
      // "check your email" scene instead of logging in.
      setAuthStatus('idle');
      setPendingEmail(res.user.email ?? email.trim());
      setConfirmKind('signup');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setScene('confirm');
      return true;
    },
    [finishAuth],
  );

  const logIn = useCallback<AccountContextValue['logIn']>(
    async (email, password) => {
      setAuthStatus('pending');
      setAuthError(null);
      const res = await authSignIn(email.trim(), password);
      if (!res.ok) {
        if (res.needsConfirm) {
          // They have an account but haven't confirmed — send them to the
          // confirm scene so they can resend.
          setAuthStatus('idle');
          setPendingEmail(email.trim());
          setConfirmKind('signup');
          setResendCooldown(0);
          setScene('confirm');
          return false;
        }
        setAuthStatus('error');
        setAuthError(res.error);
        return false;
      }
      finishAuth(res.user.id, res.user.email);
      return true;
    },
    [finishAuth],
  );

  const signInWithGoogle = useCallback<AccountContextValue['signInWithGoogle']>(async () => {
    setAuthStatus('pending');
    setAuthError(null);
    const res = await authSignInWithGoogle();
    // On success the browser is already navigating to Google — leave the modal in
    // its pending state. We only get here synchronously if the handshake failed.
    if (!res.ok) {
      setAuthStatus('error');
      setAuthError(res.error);
    }
  }, []);

  const requestPasswordReset = useCallback<AccountContextValue['requestPasswordReset']>(async (email) => {
    setAuthStatus('pending');
    setAuthError(null);
    const res = await authResetPassword(email.trim());
    if (!res.ok) {
      setAuthStatus('error');
      setAuthError(res.error);
      return;
    }
    setAuthStatus('idle');
    setPendingEmail(email.trim());
    setConfirmKind('recovery');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setScene('confirm');
  }, []);

  const resendConfirmation = useCallback<AccountContextValue['resendConfirmation']>(async () => {
    if (resendCooldown > 0 || !pendingEmail) return;
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const res = confirmKind === 'recovery'
      ? await authResetPassword(pendingEmail)
      : await authResend(pendingEmail);
    flash(res.ok ? 'Email sent — check your inbox.' : res.error);
  }, [resendCooldown, pendingEmail, confirmKind, flash]);

  const requestLogout = useCallback(() => setScene('logout'), []);
  const confirmLogout = useCallback(() => {
    // Log out of the UI immediately, then revoke the session in the background.
    // We deliberately do NOT await signOut: if its auth-lock call ever stalls
    // (notably under dev StrictMode's double-mount), awaiting it would trap the
    // user "logged in". The onAuthChange SIGNED_OUT event re-confirms this state.
    setScene(null);
    setUserId(null);
    setUser(null);
    setCredits(0);
    flash('Logged out. Results stay on this device.');
    navigate('/');
    void authSignOut().catch(() => {});
  }, [flash, navigate]);

  const openChangePassword = useCallback(() => setScene('changePassword'), []);

  const requestDeleteAccount = useCallback(() => setScene('deleteAccount'), []);
  const confirmDeleteAccount = useCallback<AccountContextValue['confirmDeleteAccount']>(async () => {
    // Server first: if the account delete fails, we keep the local data intact.
    // Guard the whole call so an unexpected throw can never strand the modal on
    // its "Deleting…" state — always resolve to false so the UI re-enables.
    let res: SimpleResult;
    try {
      res = await authDeleteAccount();
    } catch {
      flash('Could not delete your account. Please try again.');
      return false;
    }
    if (!res.ok) {
      flash(res.error);
      return false;
    }
    // Account is gone — wipe this device. The user chose "wipe everything", so we
    // clear the on-device scan history/session for this account AND every
    // `fitaura.*` localStorage key (free-scan gate, per-card FX, UI prefs).
    await clearAccount(accountKeyFor(userId)).catch(() => {});
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fitaura.')) localStorage.removeItem(key);
      }
    } catch {
      /* storage unavailable — nothing to clear */
    }
    setScene(null);
    setUserId(null);
    setUser(null);
    setCredits(0);
    navigate('/');
    flash('Account deleted.');
    return true;
  }, [userId, flash, navigate]);

  // A verdict can only be generated by a signed-in user with credits. Guests run
  // the teaser scan but never spend tokens — generation happens after they sign up.
  const canScan = signedIn && credits > 0;

  const spendForScan = useCallback<AccountContextValue['spendForScan']>(async () => {
    if (!signedIn || !userId) return false;
    const res = await spendCredit(userId);
    setCredits(res.balance);
    return res.ok;
  }, [signedIn, userId]);

  const refundScan = useCallback<AccountContextValue['refundScan']>(async () => {
    if (!signedIn || !userId) return;
    const next = await refundCredit(userId);
    setCredits(next);
  }, [signedIn, userId]);

  const spendForBattle = useCallback<AccountContextValue['spendForBattle']>(async () => {
    if (!signedIn || !userId) return false;
    const res = await spendCredit(userId, 2);
    setCredits(res.balance);
    return res.ok;
  }, [signedIn, userId]);

  const refundBattle = useCallback<AccountContextValue['refundBattle']>(async () => {
    if (!signedIn || !userId) return;
    const next = await refundCredit(userId, 2);
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

  // Real Polar checkout: create session → open embedded overlay → on success,
  // poll the server balance until the webhook has granted the credits.
  const pay = useCallback(async () => {
    if (!userId) return;
    const packCredits = CREDIT_PACKS.find((p) => p.id === pack)?.credits ?? 0;
    setScene('processing');
    try {
      const url = await createCheckout(pack);
      const outcome = await openCheckoutOverlay(url);
      if (outcome !== 'success') {
        setScene('checkout'); // user closed the overlay without paying
        return;
      }
      setLastPurchaseCredits(packCredits);
      setScene('success');
      const next = await pollBalanceUntilChange(userId, credits);
      setCredits(next);
      flash('Credits added to your account.');
    } catch {
      setScene('failure');
    }
  }, [userId, pack, credits, flash]);

  // Returning to /credits?status=success (overlay event missed): poll until the
  // webhook-granted credits land, then reflect the new balance.
  const refreshBalanceAfterPurchase = useCallback(async () => {
    if (!userId) return;
    const next = await pollBalanceUntilChange(userId, credits);
    setCredits(next);
    flash('Credits added to your account.');
  }, [userId, credits, flash]);

  const failPayment = useCallback(() => setScene('failure'), []);

  const value = useMemo<AccountContextValue>(
    () => ({
      signedIn,
      userId,
      user,
      credits,
      canScan,
      spendForScan,
      refundScan,
      spendForBattle,
      refundBattle,
      scene,
      authStatus,
      authError,
      pack,
      setPack,
      lastPurchaseCredits,
      missingId,
      toast,
      pendingEmail,
      confirmKind,
      resendCooldown,
      resendConfirmation,
      requestPasswordReset,
      flash,
      closeScene,
      openAuth,
      authInitialMode,
      signUp,
      logIn,
      signInWithGoogle,
      requestLogout,
      confirmLogout,
      openChangePassword,
      requestDeleteAccount,
      confirmDeleteAccount,
      openPaywall,
      startCheckout,
      pay,
      refreshBalanceAfterPurchase,
      failPayment,
      openMissing,
    }),
    [
      signedIn, userId, user, credits, canScan, spendForScan, refundScan, spendForBattle, refundBattle, scene, authStatus, authError,
      pack, lastPurchaseCredits, missingId, toast, pendingEmail, confirmKind, resendCooldown,
      resendConfirmation, requestPasswordReset, flash, closeScene, openAuth, authInitialMode, signUp, logIn,
      signInWithGoogle, requestLogout, confirmLogout, openChangePassword, requestDeleteAccount, confirmDeleteAccount,
      openPaywall, startCheckout, pay, refreshBalanceAfterPurchase, failPayment, openMissing,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
}
