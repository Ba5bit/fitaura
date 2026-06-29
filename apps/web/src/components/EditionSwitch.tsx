// apps/web/src/components/EditionSwitch.tsx
import { useAccount } from '../features/account/AccountContext';
import { entitledEditions, asEditionId, NFACTORIAL_ENTITLEMENT, type EditionId } from './cards/editions/registry';

/**
 * "Edition · Default | nFactorial" segmented control. Renders nothing unless the
 * account is entitled to at least one non-default edition — so by default the
 * result pages look exactly as before (no locked teasers).
 *
 * DEV-only: in a local dev build every edition is surfaced (as if owned) so the
 * skin can be tested without the prod entitlements migration. `import.meta.env.DEV`
 * is false in the production build, so the gate stays fully real in prod.
 */
export function EditionSwitch({ value, onChange }: { value: EditionId; onChange: (id: EditionId) => void }) {
  const { entitlements } = useAccount();
  const owned = import.meta.env.DEV ? [...entitlements, NFACTORIAL_ENTITLEMENT] : entitlements;
  const options = entitledEditions(owned);
  if (options.length < 2) return null;
  return (
    <div className="rs-seg edition-seg" role="tablist" aria-label="Card edition">
      {options.map((e) => (
        <button
          key={e.id}
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
