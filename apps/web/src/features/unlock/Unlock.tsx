// apps/web/src/features/unlock/Unlock.tsx
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';

const MESSAGE: Record<string, string> = {
  ok: 'Unlocked! The nFactorial Edition is now on your account.',
  already_owned: 'You already own this — the Edition is on your account.',
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  exhausted: 'That code has reached its redemption limit.',
  unauthenticated: 'Please sign in to redeem your code.',
};

/**
 * Deep-link redeem funnel (fitaura.studio/unlock/<CODE>). Signed in → redeem on
 * arrival and bounce to the Vault with a toast. Signed out → open the auth modal
 * with a redirect back here, then redeem after sign-in.
 */
export function Unlock() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { signedIn, redeemCode, flash, openAuth } = useAccount();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      openAuth(`/unlock/${code}`, 'login');
      return;
    }
    if (triedRef.current) return;
    triedRef.current = true;
    void redeemCode(code).then((res) => {
      flash(MESSAGE[res.status] ?? MESSAGE.invalid);
      navigate('/vault', { replace: true });
    });
  }, [signedIn, code, redeemCode, flash, openAuth, navigate]);

  return (
    <div className="vlt" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--ink-dim)', fontFamily: 'var(--mono, monospace)' }}>
        {signedIn ? 'Redeeming your code…' : 'Sign in to redeem your code…'}
      </p>
    </div>
  );
}
