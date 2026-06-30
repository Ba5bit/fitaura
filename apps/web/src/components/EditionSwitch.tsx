// apps/web/src/components/EditionSwitch.tsx
import { useAccount } from '../features/account/AccountContext';
import { entitledEditions, asEditionId, type EditionId } from './cards/editions/registry';

/**
 * "Edition · Default | nFactorial" segmented control. Renders nothing unless the
 * account is entitled to at least one non-default edition AND a non-default theme
 * is currently active (toggled on via the Settings → Themes pills). So with the
 * theme off, the result pages look exactly as before (no pills, just the card
 * stack) — identical to an account that never redeemed a code; the switch only
 * surfaces once a theme is on, to let you flip back to Default from the result.
 * Gating is the account's real entitlements, identical in dev and prod; to preview
 * the skin locally, redeem the code or open the /dev/cards route.
 */
export function EditionSwitch({ value, onChange }: { value: EditionId; onChange: (id: EditionId) => void }) {
  const { entitlements } = useAccount();
  const options = entitledEditions(entitlements);
  if (options.length < 2) return null;
  // Hidden while the active edition is Default: only show once a theme is turned on.
  if (value === 'default') return null;
  return (
    <div className="edition-seg" role="tablist" aria-label="Card edition">
      {options.map((e) => (
        <button
          key={e.id}
          className="tab"
          role="tab"
          aria-selected={value === e.id}
          onClick={() => onChange(asEditionId(e.id))}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
