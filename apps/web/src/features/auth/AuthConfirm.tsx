import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { authVerifyOtp } from '../../services/authService';
import { getSafeNextPath, isSupportedOtpType } from '../../lib/authRedirect';

const FALLBACK: Record<string, string> = { recovery: '/auth/update-password' };

/** Public route hit by the first-party confirmation/recovery email link.
 * Verifies the token via verifyOtp, then routes the (now signed-in) user. */
export function AuthConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { flash, openAuth } = useAccount();
  const [error, setError] = useState(false);
  const ran = useRef(false); // guard StrictMode double-invoke (token is single-use)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !isSupportedOtpType(type)) {
      setError(true);
      return;
    }
    const next = getSafeNextPath(params.get('next'), FALLBACK[type] ?? '/vault');
    void authVerifyOtp(tokenHash, type).then((res) => {
      if (!res.ok) {
        setError(true);
        return;
      }
      if (type !== 'recovery') flash('Email confirmed — welcome.');
      navigate(next, { replace: true });
    });
  }, [params, navigate, flash]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {error ? (
          <>
            <div className="aw-glyph bad"><Icon.x /></div>
            <h2 className="aw-modal-title">LINK INVALID</h2>
            <p className="auth-msg">This link is invalid or has expired. Sign in to request a new one.</p>
            <button className="aw-btn primary" onClick={() => { navigate('/'); openAuth(); }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="aw-spinner" />
            <h2 className="aw-modal-title">CONFIRMING…</h2>
            <p className="auth-msg">Verifying your email and signing you in.</p>
          </>
        )}
      </div>
    </div>
  );
}
