import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CREDIT_PACKS, type CreditPack } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { signupPasswordError } from '../../lib/authValidation';
import { authUpdatePassword } from '../../services/authService';
import { useAccount } from './AccountContext';
import { WebModal, WebDialogBody, WebField } from './WebModal';

const packById = (id: string): CreditPack => CREDIT_PACKS.find((p) => p.id === id) ?? CREDIT_PACKS[1];

// Google sign-in stays hidden on production until the Google OAuth app is
// published — it's still in "Testing" mode, so non-test users would be blocked.
// Shown automatically in local dev; to enable it on a deployed env, set
// VITE_ENABLE_GOOGLE_AUTH=true (e.g. in Vercel) and redeploy.
const GOOGLE_AUTH_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';

/* ============================ AUTH GATE ============================ */
export function AuthGate() {
  const {
    closeScene, signUp, logIn, signInWithGoogle, requestPasswordReset, authStatus, authError, authInitialMode,
  } = useAccount();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mode, setMode] = useState<'signup' | 'login' | 'reset'>(authInitialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';
  const pending = authStatus === 'pending';

  const switchMode = (m: 'signup' | 'login' | 'reset') => {
    setMode(m);
    setPassword('');
    setConfirm('');
    setLocalError(null);
  };

  const submit = async () => {
    if (pending) return;
    setLocalError(null);
    if (isReset) {
      await requestPasswordReset(email.trim());
      return;
    }
    if (isSignup) {
      const err = signupPasswordError(password, confirm);
      if (err) {
        setLocalError(err);
        return;
      }
      await signUp(email.trim(), password);
      return;
    }
    void logIn(email.trim(), password);
  };

  const title = isReset ? ['RESET YOUR', 'PASSWORD'] : ['SAVE YOUR SCANS', 'KEEP GOING'];
  const cta = pending ? 'Working…' : isReset ? 'Send reset link' : isSignup ? 'Create account' : 'Log in';

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-auth">
        <div className="aw-auth-left">
          <span className="aw-eyebrow accent">ACCOUNT REQUIRED TO CONTINUE</span>
          <h2 className="aw-modal-title" style={{ marginTop: '16px', fontSize: '34px' }}>
            {title[0]}
            <br />
            {title[1]}
          </h2>
          <p className="aw-modal-sub">
            Your first verdict was free and stayed on this device. An account lets you buy credits and run more, on
            any device you log in from.
          </p>
          <ul className="pts">
            <li><span className="ck"><Icon.check /></span><span>Credits follow your login<span className="s">Not tied to one browser</span></span></li>
            <li><span className="ck"><Icon.check /></span><span>Payment receipts saved<span className="s">On your account, server-side</span></span></li>
            <li><span className="ck"><Icon.check /></span><span>Your photos stay on your device<span className="s">We never store source photos</span></span></li>
          </ul>
        </div>

        <div className="aw-auth-right">
          {!isReset && (
            <div className="aw-seg" role="tablist">
              <button type="button" role="tab" aria-selected={isSignup} onClick={() => switchMode('signup')}>Sign up</button>
              <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>Log in</button>
            </div>
          )}
          {!isReset && GOOGLE_AUTH_ENABLED && (
            <>
              <div className="aw-oauth">
                <button type="button" disabled={pending} onClick={() => void signInWithGoogle()}>
                  <Icon.google /> Continue with Google
                </button>
              </div>
              <div className="aw-or"><span className="ln" /> or <span className="ln" /></div>
            </>
          )}
          <form
            style={{ display: 'contents' }}
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
          >
            <WebField label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} />
            {!isReset && (
              <WebField
                label="Password"
                type="password"
                placeholder={isSignup ? 'Create a password' : 'Your password'}
                value={password}
                onChange={setPassword}
              />
            )}
            {isSignup && (
              <WebField label="Confirm password" type="password" placeholder="Re-enter your password" value={confirm} onChange={setConfirm} />
            )}
            {(localError || authError) && (
              <p className="aw-formerror" role="alert">{localError ?? authError}</p>
            )}
            <button type="submit" className="aw-btn primary block" style={{ marginTop: '18px' }} disabled={pending}>
              {cta}
            </button>
          </form>
          {!isSignup && !isReset && (
            <button type="button" className="aw-linkbtn" onClick={() => switchMode('reset')}>Forgot password?</button>
          )}
          {isReset && (
            <button type="button" className="aw-linkbtn" onClick={() => switchMode('login')}>Back to log in</button>
          )}
          <div className="aw-finehelp">
            <Icon.shield />
            <span>
              We store your account, credit balance, and payment receipts, never your photos.{' '}
              <button
                type="button"
                className="lk"
                onClick={() => { closeScene(); navigate('/settings', { state: { from: pathname } }); }}
              >
                How your data is stored
              </button>
            </span>
          </div>
        </div>
      </div>
    </WebModal>
  );
}

/* ============================ EMAIL SENT (confirm / recovery) ============================ */
export function EmailSentNotice() {
  const { pendingEmail, confirmKind, resendConfirmation, resendCooldown, closeScene, openAuth } = useAccount();
  const isRecovery = confirmKind === 'recovery';
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph neutral">
          <Icon.mail />
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          CHECK YOUR EMAIL
        </h2>
        <p className="aw-modal-sub">
          {isRecovery
            ? 'We sent a password-reset link to '
            : 'We sent a confirmation link to '}
          <b style={{ color: 'var(--ink)' }}>{pendingEmail ?? 'your inbox'}</b>
          {isRecovery ? '. Open it to set a new password.' : '. Click it to activate your account.'}
        </p>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '20px' }}
          disabled={resendCooldown > 0}
          onClick={() => void resendConfirmation()}
        >
          <Icon.refresh /> {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : isRecovery ? 'Resend reset link' : 'Resend confirmation'}
        </button>
        <button className="aw-linkbtn" onClick={() => openAuth(undefined, 'login')}>
          Back to log in
        </button>
        <div className="aw-fineprint" style={{ marginTop: '6px' }}>
          Can't find it? Check your spam folder.
        </div>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ PAYWALL ============================ */
export function Paywall() {
  const { closeScene } = useAccount();
  const navigate = useNavigate();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <span className="aw-eyebrow warn" style={{ alignSelf: 'center' }}>
          OUT OF CREDITS
        </span>
        <div className="aw-bignum warn" style={{ fontSize: '64px', marginTop: '12px' }}>
          0
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '8px' }}>
          FREE VERDICT USED
        </h2>
        <p className="aw-modal-sub">
          Your next scan needs 1 credit. Each credit returns all three cards plus the full analysis, never one card
          at a time.
        </p>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '22px' }}
          onClick={() => {
            closeScene();
            navigate('/credits');
          }}
        >
          <Icon.gem /> Get credits
        </button>
        <button className="aw-linkbtn" onClick={closeScene}>
          Maybe later
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ CHECKOUT (order summary → Polar overlay) ============================ */
export function Checkout() {
  const { pack, pay, closeScene } = useAccount();
  const p = packById(pack);

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-checkout">
        {/* LEFT — order summary */}
        <div className="aw-checkout-left">
          <span className="aw-eyebrow accent">ORDER SUMMARY</span>
          <div
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: '44px',
              color: '#fff',
              lineHeight: 0.9,
              marginTop: '14px',
              textTransform: 'uppercase',
            }}
          >
            {p.credits} CREDITS
          </div>
          <div className="aw-summary">
            <div className="row"><span className="k">Pack</span><span className="v">{p.credits} credits</span></div>
            <div className="row"><span className="k">Billing</span><span className="v">One-time</span></div>
            <div className="row total"><span className="k">Total today</span><span className="v">{p.price}</span></div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <span className="aw-tag server"><Icon.receipt /> Receipt saved to your account</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '22px' }}>
            <div className="aw-securebar">
              <Icon.shield /> Secured by Polar · PCI-compliant · Fitaura never sees your card
            </div>
          </div>
        </div>

        {/* RIGHT — confirm + open Polar overlay */}
        <div className="aw-checkout-right" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="aw-eyebrow accent">REVIEW & CONFIRM</span>
          <h2 className="aw-modal-title" style={{ fontSize: '26px' }}>CONFIRM PURCHASE</h2>
          <p className="aw-modal-sub">
            Payment opens securely on this page, powered by our payment partner. You won't leave Fitaura.
          </p>
          <button className="aw-btn primary block" style={{ marginTop: 'auto' }} onClick={() => void pay()}>
            <Icon.lock /> Pay {p.price}
          </button>
          <div className="aw-fineprint">
            One-time charge. Credits are added to your account once payment is confirmed.
          </div>
        </div>
      </div>
    </WebModal>
  );
}

/* ============================ PROCESSING ============================ */
export function Processing() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 700);
    const b = setTimeout(() => setStage(2), 1500);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const lines = [
    { t: 'Authorizing payment', done: stage >= 1 },
    { t: 'Confirming with payment partner', done: stage >= 2 },
    { t: 'Adding credits to your account', done: false, on: stage >= 2 },
  ];
  return (
    <WebModal size="sm" closeable={false}>
      <WebDialogBody>
        <div className="aw-spinner" />
        <h2 className="aw-modal-title" style={{ marginTop: '22px' }}>
          PROCESSING…
        </h2>
        <p className="aw-modal-sub">Hang tight. Don't close or refresh this window.</p>
        <div className="aw-statuslines">
          {lines.map((l, i) => (
            <div key={i} className={'aw-statusline' + (l.done ? ' done' : l.on || i <= stage ? ' on' : '')}>
              {l.done ? <Icon.check /> : <span className="d" />}
              {l.t}
            </div>
          ))}
        </div>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ SUCCESS ============================ */
export function PaySuccess() {
  const { pack, closeScene, credits } = useAccount();
  const navigate = useNavigate();
  const p = packById(pack);
  return (
    <WebModal size="sm" closeable={false}>
      <WebDialogBody>
        <div className="aw-glyph good">
          <Icon.check />
        </div>
        <div className="aw-bignum good" style={{ fontSize: '56px', marginTop: '14px' }}>
          +{p.credits}
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '4px' }}>
          PAYMENT COMPLETE
        </h2>
        <p className="aw-modal-sub">{p.credits} credits are on your account. You're ready to scan.</p>
        <div className="aw-balance-after">
          New balance <b>{credits} credits</b>
        </div>
        <span className="aw-receiptline" style={{ whiteSpace: 'nowrap' }}>
          <Icon.receipt /> RECEIPT FA-PAY-90412 · {p.price}
        </span>
        <div className="aw-fineprint" style={{ marginTop: '6px' }}>
          Receipt saved to your account · server-side
        </div>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '20px' }}
          onClick={() => {
            closeScene();
            navigate('/scan');
          }}
        >
          <Icon.scan /> Start scanning
        </button>
        <button
          className="aw-linkbtn"
          onClick={() => {
            closeScene();
            navigate('/account');
          }}
        >
          Back to account
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ FAILURE ============================ */
export function PayFailure() {
  const { startCheckout, closeScene } = useAccount();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph bad">
          <Icon.x />
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          CHECKOUT DIDN'T START
        </h2>
        <p className="aw-modal-sub">
          We couldn't open the payment window just now. <b style={{ color: 'var(--ink)' }}>You haven't been
          charged.</b> Please try again.
        </p>
        <button className="aw-btn primary block" style={{ marginTop: '22px' }} onClick={() => startCheckout()}>
          <Icon.refresh /> Try again
        </button>
        <button className="aw-linkbtn" onClick={closeScene}>
          Use a different method
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ LOGOUT CONFIRM ============================ */
export function LogoutConfirm() {
  const { confirmLogout, closeScene } = useAccount();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph neutral">
          <Icon.logout />
        </div>
        <h2 className="aw-modal-title">LOG OUT?</h2>
        <p className="aw-modal-sub">
          Your credits and payment receipts are safe on your account and will be here when you log back in. Results
          stay saved on this device.
        </p>
        <button className="aw-btn danger block" style={{ marginTop: '22px' }} onClick={confirmLogout}>
          <Icon.logout /> Log out
        </button>
        <button className="aw-linkbtn" onClick={closeScene}>
          Stay logged in
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ CHANGE PASSWORD ============================ */
export function ChangePassword() {
  const { closeScene, flash } = useAccount();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const err = signupPasswordError(password, confirm);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authUpdatePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    flash('Password updated.');
    closeScene();
  };

  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph neutral">
          <Icon.key />
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          CHANGE PASSWORD
        </h2>
        <p className="aw-modal-sub">
          Set a new password for <b style={{ color: 'var(--ink)' }}>this account</b>. You'll stay logged in on this
          device.
        </p>
        <form
          style={{ display: 'contents' }}
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <WebField label="New password" type="password" placeholder="Create a password" value={password} onChange={setPassword} />
          <WebField label="Confirm password" type="password" placeholder="Re-enter your password" value={confirm} onChange={setConfirm} />
          {error && <p className="aw-formerror" role="alert">{error}</p>}
          <button type="submit" className="aw-btn primary block" style={{ marginTop: '18px' }} disabled={busy}>
            {busy ? 'Working…' : 'Update password'}
          </button>
        </form>
        <button className="aw-linkbtn" onClick={closeScene}>
          Cancel
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ DELETE ACCOUNT CONFIRM ============================ */
export function DeleteAccountConfirm() {
  const { confirmDeleteAccount, closeScene } = useAccount();
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await confirmDeleteAccount();
    // On success the scene/account state is reset for us; only re-enable on failure.
    if (!ok) setBusy(false);
  };

  return (
    <WebModal size="sm" onClose={busy ? undefined : closeScene} closeable={!busy}>
      <WebDialogBody>
        <div className="aw-glyph bad">
          <Icon.trash />
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          DELETE ACCOUNT?
        </h2>
        <p className="aw-modal-sub">
          This <b style={{ color: 'var(--ink)' }}>permanently</b> deletes your account, your profile, and your credit
          balance from our servers, and wipes the saved results and receipts on this device.{' '}
          <b style={{ color: 'var(--ink)' }}>Any remaining credits are forfeited.</b> This can't be undone.
        </p>
        <button className="aw-btn danger block" style={{ marginTop: '22px' }} onClick={() => void onConfirm()} disabled={busy}>
          <Icon.trash /> {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button className="aw-linkbtn" onClick={closeScene} disabled={busy}>
          Keep my account
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ MISSING RESULT ============================ */
export function MissingResult() {
  const { missingId, closeScene } = useAccount();
  const navigate = useNavigate();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <span className="aw-eyebrow warn" style={{ alignSelf: 'center' }}>
          RESULT NOT ON THIS DEVICE
        </span>
        <div className="aw-glyph neutral" style={{ marginTop: '16px' }}>
          <Icon.ghost />
        </div>
        <h2 className="aw-modal-title">IT'S GONE</h2>
        <p className="aw-modal-sub">
          Result <b style={{ color: 'var(--ink)' }}>{missingId ?? 'this scan'}</b> was saved on this device, but the
          local copy is no longer here. Clearing your browser, private mode, or switching devices removes locally
          stored results.
        </p>
        <div
          className="aw-securebar"
          style={{
            marginTop: '20px',
            color: 'var(--icy)',
            borderColor: 'color-mix(in oklab,var(--icy) 28%,var(--hair-soft))',
            background: 'color-mix(in oklab,var(--icy) 6%,transparent)',
          }}
        >
          <Icon.shield /> Your account and credit balance are unaffected
        </div>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '18px' }}
          onClick={() => {
            closeScene();
            navigate('/scan');
          }}
        >
          <Icon.scan /> Run a new scan
        </button>
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', width: '100%' }}>
          <button
            className="aw-btn block"
            onClick={() => {
              closeScene();
              navigate('/vault');
            }}
          >
            Back to vault
          </button>
          <button
            className="aw-btn block"
            onClick={() => {
              closeScene();
              navigate('/settings');
            }}
          >
            Why?
          </button>
        </div>
      </WebDialogBody>
    </WebModal>
  );
}
