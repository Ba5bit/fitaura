import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { WebField } from '../account/WebModal';
import { useAccount } from '../account/AccountContext';
import { authUpdatePassword, getCurrentSession } from '../../services/authService';
import { signupPasswordError } from '../../lib/authValidation';

/** Reached via the recovery link (after /auth/confirm establishes a recovery
 * session). Gated: no session → tell the user to request a new link. */
export function UpdatePassword() {
  const navigate = useNavigate();
  const { flash } = useAccount();
  const [ready, setReady] = useState<boolean | null>(null); // null = checking
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentSession().then((s) => { if (active) setReady(!!s); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (busy) return;
    const err = signupPasswordError(password, confirm);
    if (err) { setError(err); return; }
    setBusy(true);
    setError(null);
    const res = await authUpdatePassword(password);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    flash('Password updated.');
    navigate('/vault', { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {ready === null ? (
          <>
            <div className="aw-spinner" />
            <p className="auth-msg">Checking your reset link…</p>
          </>
        ) : !ready ? (
          <>
            <div className="aw-glyph bad"><Icon.x /></div>
            <h2 className="aw-modal-title">LINK EXPIRED</h2>
            <p className="auth-msg">This reset link is no longer valid. Request a new one from the login screen.</p>
            <button className="aw-btn primary" onClick={() => navigate('/')}>Back to sign in</button>
          </>
        ) : (
          <>
            <div className="aw-glyph neutral"><Icon.key /></div>
            <h2 className="aw-modal-title">SET A NEW PASSWORD</h2>
            <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <WebField label="New password" type="password" placeholder="Create a password" value={password} onChange={setPassword} />
              <WebField label="Confirm password" type="password" placeholder="Re-enter your password" value={confirm} onChange={setConfirm} />
              {error && <p className="aw-formerror" role="alert">{error}</p>}
              <button type="submit" className="aw-btn primary" disabled={busy}>{busy ? 'Working…' : 'Update password'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
