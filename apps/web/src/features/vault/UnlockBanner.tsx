// apps/web/src/features/vault/UnlockBanner.tsx
import { useState } from 'react';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';

const TONE: Record<string, string> = {
  ok: 'var(--lime)', already_owned: 'var(--lime)',
  invalid: 'var(--red)', expired: 'var(--red)', exhausted: 'var(--red)', unauthenticated: 'var(--gold)',
};
const NOTE: Record<string, string> = {
  ok: 'Unlocked! Your new Edition is on your account.',
  already_owned: 'You already own this Edition.',
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  exhausted: 'That code has reached its limit.',
  unauthenticated: 'Sign in first, then redeem your code.',
};

/** Inline "Have a code?" redeem field. `variant="banner"` for the Vault home
 *  announcement, `variant="row"` for the Settings panel. */
export function UnlockBanner({ variant = 'banner' }: { variant?: 'banner' | 'row' }) {
  const { redeemCode, signedIn, openAuth } = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ msg: string; tone: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    if (!signedIn) {
      openAuth('/vault', 'login');
      return;
    }
    setBusy(true);
    const res = await redeemCode(code);
    setBusy(false);
    setNote({ msg: NOTE[res.status] ?? NOTE.invalid, tone: TONE[res.status] ?? 'var(--red)' });
    if (res.status === 'ok' || res.status === 'already_owned') setCode('');
  };

  return (
    <form className={'vlt-redeem ' + variant} onSubmit={submit}>
      <div className="vlt-redeem-tx">
        <div className="k">Have a code?</div>
        <div className="s">Redeem a campaign code to unlock a limited Edition skin.</div>
      </div>
      <div className="vlt-redeem-field">
        <input
          aria-label="Promo code"
          placeholder="NFACTORIAL2026"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoCapitalize="characters"
        />
        <button className="vlt-btn sm" disabled={busy || !code.trim()}>
          <Icon.check /> {busy ? 'Redeeming…' : 'Redeem'}
        </button>
      </div>
      {note && <div className="vlt-redeem-note" style={{ color: note.tone }}>{note.msg}</div>}
    </form>
  );
}
