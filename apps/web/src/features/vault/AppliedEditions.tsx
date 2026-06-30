import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { EDITIONS } from '../../components/cards/editions/registry';

/**
 * The editions a user has unlocked via promo codes, listed in the Settings
 * Editions panel. Reflects only the account's real redeemed entitlements
 * (identical in dev and prod) — nothing shows until a code is redeemed.
 */
export function AppliedEditions() {
  const { entitlements } = useAccount();
  const unlocked = EDITIONS.filter((e) => e.entitlement && entitlements.includes(e.entitlement));

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
