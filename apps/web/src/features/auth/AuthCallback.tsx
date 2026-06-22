import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { getCurrentSession, onAuthChange } from '../../services/authService';

/** OAuth return route (e.g. "Continue with Google").
 *
 * Supabase is configured with `detectSessionInUrl: true` + `flowType: 'pkce'`,
 * so on load the client reads the `?code=…` off this URL and exchanges it for a
 * session in the background. We don't call any exchange API ourselves — we just
 * wait for the session to land (via getCurrentSession, plus an onAuthChange
 * subscription in case the exchange completes a beat later), then route to the
 * vault. AccountContext's own onAuthChange hydrates identity + balance.
 *
 * Mirrors AuthConfirm.tsx (spinner-while-working, friendly fail state). */
export function AuthCallback() {
  const navigate = useNavigate();
  const { flash, openAuth } = useAccount();
  const [error, setError] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let active = true;
    // If Google denied/cancelled, it returns `?error=…` instead of a code.
    if (new URLSearchParams(window.location.search).has('error')) {
      setError(true);
      return;
    }

    const finish = () => {
      if (!active || done.current) return;
      done.current = true;
      flash('Signed in. Welcome to your vault.');
      navigate('/vault', { replace: true });
    };

    // The code exchange can resolve slightly after mount, so listen for the
    // SIGNED_IN event as well as polling the current session right away.
    const unsub = onAuthChange((s) => {
      if (s) finish();
    });
    getCurrentSession().then((s) => {
      if (s) finish();
    });

    // Safety net: if no session materialises (bad/expired code, provider not
    // yet configured), surface the recoverable error state instead of hanging.
    const timer = setTimeout(() => {
      if (active && !done.current) setError(true);
    }, 8000);

    return () => {
      active = false;
      unsub();
      clearTimeout(timer);
    };
  }, [navigate, flash]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {error ? (
          <>
            <div className="aw-glyph bad"><Icon.x /></div>
            <h2 className="aw-modal-title">SIGN-IN FAILED</h2>
            <p className="auth-msg">We couldn't complete Google sign-in. Please try again.</p>
            <button className="aw-btn primary" onClick={() => { navigate('/'); openAuth(undefined, 'login'); }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="aw-spinner" />
            <h2 className="aw-modal-title">SIGNING YOU IN…</h2>
            <p className="auth-msg">Finishing up with Google.</p>
          </>
        )}
      </div>
    </div>
  );
}
