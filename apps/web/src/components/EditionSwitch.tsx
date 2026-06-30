// apps/web/src/components/EditionSwitch.tsx
import { useAccount } from '../features/account/AccountContext';
import { entitledEditions, asEditionId, type EditionId } from './cards/editions/registry';

/**
 * "Edition · Default | nFactorial" segmented control. Renders nothing unless the
 * account is entitled to at least one non-default edition — so before a code is
 * redeemed the result pages look exactly as before (no pills, just the card stack).
 * Gating is the account's real entitlements, identical in dev and prod; to preview
 * the skin locally, redeem the code or open the /dev/cards route.
 */
export function EditionSwitch({ value, onChange }: { value: EditionId; onChange: (id: EditionId) => void }) {
  const { entitlements } = useAccount();
  const options = entitledEditions(entitlements);
  if (options.length < 2) return null;
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
