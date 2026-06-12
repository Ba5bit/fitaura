import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from './AccountContext';

/**
 * Profile avatar + dismissible dropdown (Account info · Pricing & credits ·
 * Settings · Log out). Shared by the Vault nav and the public Landing nav so
 * the profile control behaves identically everywhere. Guests get a "Sign in"
 * avatar that opens the auth modal instead of the menu.
 *
 * `avatarClassName` lets each surface keep its own avatar styling
 * (`vlt-avatar` in the vault, `aw-avatar` on the landing).
 */
export function ProfileMenu({ avatarClassName = 'vlt-avatar' }: { avatarClassName?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signedIn, user, openAuth, requestLogout } = useAccount();
  const [open, setOpen] = useState(false);

  // Dismiss on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!signedIn || !user) {
    return (
      <button className={avatarClassName + ' guest'} aria-label="Sign in" onClick={() => openAuth()}>
        <Icon.user />
      </button>
    );
  }

  // Record where we came from so the secondary page's back button returns here
  // (and not always to the vault) regardless of which page opened the menu.
  const goPage = (to: string) => {
    setOpen(false);
    navigate(to, { state: { from: pathname } });
  };

  return (
    <div className="vlt-profile" style={{ position: 'relative' }}>
      <button
        className={avatarClassName}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Profile menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((x) => !x);
        }}
      >
        {user.initial}
      </button>
      {open && (
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
                setOpen(false);
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
  );
}
