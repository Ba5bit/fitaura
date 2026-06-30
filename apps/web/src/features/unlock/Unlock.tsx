// apps/web/src/features/unlock/Unlock.tsx
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '../account/AccountContext';
import { REDEEM_MESSAGE } from '../../lib/redeemMessages';

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
      flash(REDEEM_MESSAGE[res.status]);
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
