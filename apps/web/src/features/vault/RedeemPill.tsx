// apps/web/src/features/vault/RedeemPill.tsx
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { REDEEM_MESSAGE } from '../../lib/redeemMessages';

/**
 * Header "Have a code?" control: a compact chip that animates open into an inline
 * promo-code field, sitting in the Vault nav next to the credits chip. The single
 * container transitions its width (CSS) so the button visibly becomes the input.
 *
 * Signed-in only — entitlements attach to an account, so a guest sees nothing.
 * Feedback rides the global toast (`flash`); success collapses + clears.
 */
export function RedeemPill() {
  const { signedIn, redeemCode, flash } = useAccount();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the field as it expands.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Click-away collapses an empty field (anything typed is kept open).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node) && !code.trim()) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, code]);

  if (!signedIn) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    const res = await redeemCode(code);
    setBusy(false);
    flash(REDEEM_MESSAGE[res.status]);
    if (res.status === 'ok' || res.status === 'already_owned') {
      setCode('');
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="vlt-redeempill" data-open={open}>
      <button
        type="button"
        className="vlt-redeempill-label"
        onClick={() => setOpen(true)}
        tabIndex={open ? -1 : 0}
        aria-hidden={open}
      >
        Have a code?
      </button>
      <form className="vlt-redeempill-form" onSubmit={submit}>
        <input
          ref={inputRef}
          aria-label="Promo code"
          placeholder="ENTER YOUR CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          spellCheck={false}
          autoCapitalize="characters"
          tabIndex={open ? 0 : -1}
        />
        <button
          className="vlt-redeempill-go"
          disabled={busy || !code.trim()}
          aria-label="Redeem code"
        >
          <Icon.check />
        </button>
      </form>
    </div>
  );
}
