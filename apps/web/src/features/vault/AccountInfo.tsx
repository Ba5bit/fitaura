import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import { VaultNav } from './VaultNav';
import { SubHead } from './SubHead';

/** Account info — login & account status (the only data kept on our servers). */
export function AccountInfo() {
  const navigate = useNavigate();
  const { signedIn, user, openAuth, requestLogout, openChangePassword, requestDeleteAccount } = useAccount();

  // Account info requires an account — bounce guests home and offer sign-in.
  useEffect(() => {
    if (!signedIn) {
      navigate('/', { replace: true });
      openAuth();
    }
  }, [signedIn, navigate, openAuth]);
  if (!signedIn || !user) return null;

  return (
    <div className="vlt">
      <VaultNav />
      <div className="vlt-body">
        <div className="vlt-sub">
          <SubHead
            eyebrow="PROFILE"
            title="ACCOUNT INFO"
            sub="Your login and account status. This is the only part of FitAura kept on our servers."
          />

          <div className="vlt-panel glow">
            <div className="vlt-acct-id">
              <div className="av">{user.initial}</div>
              <div>
                <div className="em">{user.email}</div>
                <div className="badges">
                  <span className="vlt-status">
                    <span className="d" />
                    Active
                  </span>
                  <span className="vlt-tag server">
                    <Icon.cloud /> Synced to your login
                  </span>
                </div>
              </div>
            </div>
            <div className="vlt-rows" style={{ marginTop: '20px' }}>
              <div className="vlt-row">
                <span className="ic">
                  <Icon.user />
                </span>
                <div className="tx">
                  <div className="k">Signed in with</div>
                  <div className="v">{user.email}</div>
                </div>
              </div>
              <div className="vlt-row">
                <span className="ic">
                  <Icon.star />
                </span>
                <div className="tx">
                  <div className="k">Member since</div>
                  <div className="v">{user.since}</div>
                </div>
              </div>
              <div className="vlt-row">
                <span className="ic">
                  <Icon.key />
                </span>
                <div className="tx">
                  <div className="k">Security</div>
                  <div className="v">Password &amp; sign-in</div>
                </div>
                <button className="vlt-btn sm act" onClick={openChangePassword}>
                  Manage
                </button>
              </div>
            </div>
          </div>

          <div className="vlt-panel">
            <h3 className="vlt-panel-h">
              <Icon.shield /> Account actions
            </h3>
            <div className="vlt-rows">
              <div className="vlt-row">
                <span
                  className="ic"
                  style={{ color: 'var(--red)', borderColor: 'color-mix(in oklab, var(--red) 30%, var(--hair))' }}
                >
                  <Icon.trash />
                </span>
                <div className="tx">
                  <div className="k">Your data</div>
                  <div className="v" style={{ color: 'var(--red)' }}>
                    Delete account
                  </div>
                </div>
                <button
                  className="vlt-btn sm act danger"
                  onClick={requestDeleteAccount}
                  style={{ borderColor: 'color-mix(in oklab, var(--red) 45%, var(--hair))', color: 'var(--red)' }}
                >
                  Delete
                </button>
              </div>
              <div className="vlt-row">
                <span
                  className="ic"
                  style={{ color: 'var(--red)', borderColor: 'color-mix(in oklab, var(--red) 30%, var(--hair))' }}
                >
                  <Icon.logout />
                </span>
                <div className="tx">
                  <div className="k">Session</div>
                  <div className="v" style={{ color: 'var(--red)' }}>
                    Log out
                  </div>
                </div>
                <button
                  className="vlt-btn sm act danger"
                  onClick={requestLogout}
                  style={{ borderColor: 'color-mix(in oklab, var(--red) 45%, var(--hair))', color: 'var(--red)' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
