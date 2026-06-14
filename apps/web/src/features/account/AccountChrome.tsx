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
  const { signedIn, openAuth, credits, freeScanAvailable } = useAccount();

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
  if (freeScanAvailable) {
    return (
      <button className="aw-chip free" onClick={() => navigate('/vault')}>
        <span className="gem">
          <Icon.bolt />
        </span>
        1 FREE VERDICT
      </button>
    );
  }
  return (
    <button className="aw-chip zero" onClick={() => openAuth()}>
      <span className="gem">
        <Icon.gem />
      </span>
      <b>0</b>
      <span className="credit-word"> credits</span>
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
