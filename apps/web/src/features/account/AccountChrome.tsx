import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from './AccountContext';
import { ProfileMenu } from './ProfileMenu';

/* ============================ CREDIT CHIP ============================ */
/**
 * The balance chip shared by the Landing and Vault top navs. Signed-in users tap
 * through to the Credits page; guests with a free scan jump to the Vault, and
 * otherwise sign-in is offered. The "credits" word is hidden on mobile via the
 * global `.credit-word` rule.
 */
export function CreditChip() {
  const navigate = useNavigate();
  const { signedIn, openAuth, credits } = useAccount();

  if (signedIn) {
    return (
      <button className="aw-chip" onClick={() => navigate('/credits')}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>{credits}</b>
        <span className="credit-word"> credits</span>
      </button>
    );
  }
  // Guests: bait the free verdict — tapping opens sign-up (the free credits land
  // on registration; there is no token-spending guest scan anymore).
  return (
    <button className="aw-chip free" onClick={() => openAuth()}>
      <span className="gem">
        <Icon.bolt />
      </span>
      10 FREE CREDITS
    </button>
  );
}

/* ============================ ACCOUNT ENTRY (chip + avatar) ============================ */
/**
 * The balance chip + profile avatar for the public Landing nav. The full vault
 * nav (Home · Vault · chip · profile) lives in `vault/VaultNav`.
 */
export function AccountEntry() {
  return (
    <div className="aw-nav-right">
      <CreditChip />
      <ProfileMenu avatarClassName="aw-avatar" />
    </div>
  );
}
