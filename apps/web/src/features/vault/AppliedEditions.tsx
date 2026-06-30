import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { EDITIONS, NFACTORIAL_ENTITLEMENT } from '../../components/cards/editions/registry';

/**
 * The editions a user has unlocked via promo codes, listed in the Settings
 * Editions panel. In a local DEV build the nFactorial entitlement is surfaced
 * (mirrors the EditionSwitch's `import.meta.env.DEV` bypass) so the UI is testable
 * without the prod migration applied; in production this reflects only the
 * account's real redeemed entitlements.
 */
export function AppliedEditions() {
  const { entitlements } = useAccount();
  const owned = import.meta.env.DEV ? [...entitlements, NFACTORIAL_ENTITLEMENT] : entitlements;
  const unlocked = EDITIONS.filter((e) => e.entitlement && owned.includes(e.entitlement));

  if (unlocked.length === 0) {
    return <p className="vlt-editions-empty">No themes unlocked yet — redeem a code below to add one.</p>;
  }
  return (
    <div className="vlt-editions">
      {unlocked.map((e) => (
        <span className="vlt-edition-chip" key={e.id}>
          <Icon.check /> {e.label} Edition
        </span>
      ))}
    </div>
  );
}
