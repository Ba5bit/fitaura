// apps/web/src/components/EditionSwitch.tsx
import { useAccount } from '../features/account/AccountContext';
import { usePreferences } from '../state/preferences';
import { EDITIONS, entitledEditions, asEditionId, type EditionId } from './cards/editions/registry';

/**
 * "Default | nFactorial" segmented control on the result pages. Hidden until a
 * theme is *turned on* via the Settings → Themes pills (`enabledEdition`) — so
 * with no theme on the result pages look exactly as before (no pills, just the
 * card stack), identical to an account that never redeemed a code. Once a theme
 * is on the switch stays visible and lets you freely flip the *active* edition
 * (`value`) between Default and that theme without dismissing the switch.
 * Entitlement is re-checked as a safety net (a stale localStorage flag can't show
 * a switch for a theme the account no longer owns); the active edition is preview
 * state, identical in dev and prod.
 */
export function EditionSwitch({ value, onChange }: { value: EditionId; onChange: (id: EditionId) => void }) {
  const { entitlements } = useAccount();
  const { enabledEdition } = usePreferences();
  // Only once a theme is turned on in Settings — and only if still owned.
  if (enabledEdition === 'default') return null;
  if (!entitledEditions(entitlements).some((e) => e.id === enabledEdition)) return null;
  // Offer Default + the turned-on theme (not every owned edition).
  const options = EDITIONS.filter((e) => e.id === 'default' || e.id === enabledEdition);
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
