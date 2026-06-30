// apps/web/src/features/vault/UnlockBanner.tsx
import { useState } from 'react';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { REDEEM_MESSAGE, REDEEM_TONE } from '../../lib/redeemMessages';

/** Per-device flag: the Vault announcement, once closed, stays closed. The header
 *  RedeemPill remains the permanent redeem path. */
const DISMISS_KEY = 'fitaura.redeem_banner_dismissed';

/** Inline "Have a code?" redeem field. `variant="banner"` for the Vault home
 *  announcement (dismissible), `variant="row"` for the Settings panel. */
export function UnlockBanner({ variant = 'banner' }: { variant?: 'banner' | 'row' }) {
  const { redeemCode, signedIn } = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ msg: string; tone: string } | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (variant !== 'banner') return false;
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Entitlements only attach to a registered account, so the redeem field is
  // hidden entirely for signed-out visitors (no "sign in to redeem" teaser).
  if (!signedIn) return null;
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — banner just won't stay dismissed across reloads */
    }
    setDismissed(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    const res = await redeemCode(code);
    setBusy(false);
    setNote({ msg: REDEEM_MESSAGE[res.status], tone: REDEEM_TONE[res.status] });
    if (res.status === 'ok' || res.status === 'already_owned') setCode('');
  };

  return (
    <form className={'vlt-redeem ' + variant} onSubmit={submit}>
      <div className="vlt-redeem-tx">
        <div className="k">Have a code?</div>
        <div className="s">Redeem a campaign code to unlock new features on Fitaura.</div>
      </div>
      <div className="vlt-redeem-field">
        <input
          aria-label="Promo code"
          placeholder="Enter your code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoCapitalize="characters"
        />
        <button className="vlt-btn sm" disabled={busy || !code.trim()}>
          <Icon.check /> {busy ? 'Redeeming…' : 'Redeem'}
        </button>
      </div>
      {note && <div className="vlt-redeem-note" role="status" aria-live="polite" style={{ color: note.tone }}>{note.msg}</div>}
      {variant === 'banner' && (
        <button type="button" className="vlt-redeem-x" onClick={dismiss} aria-label="Dismiss">
          <Icon.x />
        </button>
      )}
    </form>
  );
}
