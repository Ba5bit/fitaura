import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { usePreferences } from '../../state/preferences';
import { EDITIONS } from '../../components/cards/editions/registry';

/**
 * The editions a user has unlocked via promo codes, shown in the Settings Themes
 * panel as ON/OFF toggle pills. Clicking a pill makes that theme the active card
 * edition (used app-wide via `usePreferences().edition`); clicking the active one
 * turns it back to Default. Only the account's real redeemed editions appear.
 */
export function AppliedEditions() {
  const { entitlements } = useAccount();
  const { edition, setEdition } = usePreferences();
  const unlocked = EDITIONS.filter((e) => e.entitlement && entitlements.includes(e.entitlement));

  if (unlocked.length === 0) {
    return <p className="vlt-editions-empty">No themes unlocked yet — redeem a code below to add one.</p>;
  }
  return (
    <div className="vlt-editions">
      {unlocked.map((e) => {
        const active = edition === e.id;
        return (
          <button
            key={e.id}
            type="button"
            className={'vlt-edition-chip' + (active ? ' on' : '')}
            aria-pressed={active}
            onClick={() => setEdition(active ? 'default' : e.id)}
          >
            {active && <Icon.check />} {e.label} Edition
          </button>
        );
      })}
    </div>
  );
}
