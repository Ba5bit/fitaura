import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { CreditChip } from '../account/AccountChrome';
import { ProfileMenu } from '../account/ProfileMenu';

/**
 * Compact Vault top nav (v3 IA): Home · Vault · profile. Credits / Storage /
 * Results are intentionally NOT here — they live behind the profile menu and
 * their own secondary pages. Shared across the vault and its secondary pages.
 * Ported from the design's `VaultNav`.
 */
export function VaultNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="vlt-nav">
      <button className="vlt-brand" onClick={() => navigate('/')} aria-label="FITAURA home">
        <span className="dot" />
        <span className="wm">FITAURA</span>
      </button>
      <div className="vlt-navmid">
        <button className="vlt-navlink" onClick={() => navigate('/')}>
          <Icon.home />
          <span>Home</span>
        </button>
        <button className="vlt-navlink" aria-current={pathname === '/vault'} onClick={() => navigate('/vault')}>
          <Icon.grid />
          <span>Vault</span>
        </button>
      </div>
      <div className="vlt-navright">
        <CreditChip />
        <ProfileMenu avatarClassName="vlt-avatar" />
      </div>
    </nav>
  );
}
