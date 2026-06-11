import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';

/**
 * Compact Vault top nav (v3 IA): Home · Vault · profile. Credits / Storage /
 * Results are intentionally NOT here — they live behind the profile menu and
 * their own secondary pages. Shared across the vault and its secondary pages.
 * Ported from the design's `VaultNav`.
 */
export function VaultNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signedIn, user, openAuth, requestLogout } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  // Dismiss the profile menu on outside click / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const goPage = (to: string) => {
    setMenuOpen(false);
    navigate(to);
  };

  return (
    <nav className="vlt-nav">
      <button className="vlt-brand" onClick={() => navigate('/')} aria-label="FITAURA — home">
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
        {signedIn && user ? (
          <button
            className="vlt-avatar"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Profile menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((x) => !x);
            }}
          >
            {user.initial}
          </button>
        ) : (
          <button className="vlt-avatar guest" aria-label="Sign in" onClick={openAuth}>
            <Icon.user />
          </button>
        )}

        {menuOpen && signedIn && user && (
          <div className="vlt-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="vlt-menu-id">
              <div className="av">{user.initial}</div>
              <div className="tx">
                <div className="em">{user.email}</div>
                <div className="mb">MEMBER SINCE {user.since}</div>
              </div>
            </div>
            <div className="vlt-menu-list">
              <button className="vlt-menu-item" role="menuitem" onClick={() => goPage('/account')}>
                <span className="mi">
                  <Icon.user />
                </span>
                Account info
              </button>
              <button className="vlt-menu-item" role="menuitem" onClick={() => goPage('/credits')}>
                <span className="mi">
                  <Icon.gem />
                </span>
                Pricing &amp; credits
              </button>
              <button className="vlt-menu-item" role="menuitem" onClick={() => goPage('/settings')}>
                <span className="mi">
                  <Icon.gear />
                </span>
                Settings
              </button>
              <div className="vlt-menu-sep" />
              <button
                className="vlt-menu-item danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  requestLogout();
                }}
              >
                <span className="mi">
                  <Icon.logout />
                </span>
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
