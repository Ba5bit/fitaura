import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useAccount } from './AccountContext';
import { ProfileMenu } from './ProfileMenu';

/* ============================ ACCOUNT ENTRY (chip + avatar) ============================ */
/**
 * The balance chip + profile avatar for the public Landing nav. Signed-in users
 * jump to their Vault (the product home); guests are offered sign-in. The full
 * vault nav (Home · Vault · profile) lives in `vault/VaultNav`.
 */
export function AccountEntry() {
  const navigate = useNavigate();
  const { signedIn, openAuth } = useAccount();
  const { credits, isFree } = useGeneration();

  let chip;
  if (signedIn) {
    chip = (
      <button className="aw-chip" onClick={() => navigate('/credits')}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>{credits}</b> credits
      </button>
    );
  } else if (isFree) {
    chip = (
      <button className="aw-chip free" onClick={() => navigate('/vault')}>
        <span className="gem">
          <Icon.bolt />
        </span>
        1 FREE VERDICT
      </button>
    );
  } else {
    chip = (
      <button className="aw-chip zero" onClick={() => openAuth()}>
        <span className="gem">
          <Icon.gem />
        </span>
        <b>0</b> credits
      </button>
    );
  }

  return (
    <div className="aw-nav-right">
      {chip}
      <ProfileMenu avatarClassName="aw-avatar" />
    </div>
  );
}
