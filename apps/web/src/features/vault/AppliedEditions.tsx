import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { usePreferences } from '../../state/preferences';
import { EDITIONS } from '../../components/cards/editions/registry';

/**
 * The editions a user has unlocked via promo codes, shown in the Settings Themes
 * panel as ON/OFF toggle pills. Clicking a pill *turns that theme on*
 * (`enabledEdition`), which reveals the Default | <theme> switch on the result
 * pages and applies the theme right away (`edition`); clicking the lit pill turns
 * it back off and reverts to Default. The pill reflects whether the theme is on —
 * not the active edition — so it can stay lit while you sit on Default via the
 * result switch. Only the account's real redeemed editions appear.
 */
export function AppliedEditions() {
  const { entitlements } = useAccount();
  const { enabledEdition, setEnabledEdition, setEdition } = usePreferences();
  const unlocked = EDITIONS.filter((e) => e.entitlement && entitlements.includes(e.entitlement));

  if (unlocked.length === 0) {
    return <p className="vlt-editions-empty">No themes unlocked yet — redeem a code below to add one.</p>;
  }
  return (
    <div className="vlt-editions">
      {unlocked.map((e) => {
        const on = enabledEdition === e.id;
        const toggle = () => {
          setEnabledEdition(on ? 'default' : e.id);
          setEdition(on ? 'default' : e.id);
        };
        return (
          <button
            key={e.id}
            type="button"
            className={'vlt-edition-chip' + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={toggle}
          >
            {on && <Icon.check />} {e.label} Edition
          </button>
        );
      })}
    </div>
  );
}
