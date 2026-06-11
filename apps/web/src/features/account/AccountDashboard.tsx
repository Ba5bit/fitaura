import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useAccount } from './AccountContext';
import { AccountNav, ResultTile, useResultTiles, type ResultSummary } from './AccountChrome';

/** Account dashboard — the profile experience reached by the avatar. */
export function AccountDashboard() {
  const navigate = useNavigate();
  const { user, signedIn, requestLogout, openAuth, openMissing } = useAccount();
  const { credits, openResult } = useGeneration();
  const tiles = useResultTiles();

  // Guests can't see the dashboard — bounce home and offer sign-in.
  useEffect(() => {
    if (!signedIn) {
      navigate('/', { replace: true });
      openAuth();
    }
  }, [signedIn, navigate, openAuth]);
  if (!signedIn || !user) return null;

  const onOpen = (r: ResultSummary) => {
    if (openResult(r.id)) navigate('/result');
    else openMissing(r.id);
  };

  const usedSlots = tiles.length;

  return (
    <>
      <AccountNav />
      <div className="aw-page">
        <div className="aw-dash-head">
          <div>
            <span className="aw-eyebrow">YOUR ACCOUNT</span>
            <h1 className="aw-h1">ACCOUNT</h1>
          </div>
          <span className="aw-tag server">
            <Icon.cloud /> Synced to your login
          </span>
        </div>

        <div className="aw-dash-grid">
          {/* left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="aw-card">
              <div className="aw-acct-id">
                <div className="av">{user.initial}</div>
                <div>
                  <div className="em">{user.email}</div>
                  <div className="mb">MEMBER SINCE {user.since}</div>
                </div>
              </div>
              <div className="aw-acct-rows">
                <button className="aw-acct-row" onClick={() => navigate('/results')}>
                  <span className="ic">
                    <Icon.phone />
                  </span>
                  <span className="txt">
                    <span>Results on this device</span>
                    <span className="s">Saved locally — not on our servers</span>
                  </span>
                  <span className="chev">
                    <Icon.chevronRight />
                  </span>
                </button>
                <button className="aw-acct-row" onClick={() => navigate('/storage')}>
                  <span className="ic">
                    <Icon.shield />
                  </span>
                  <span className="txt">
                    <span>Where your data lives</span>
                    <span className="s">Server vs. on-device, explained</span>
                  </span>
                  <span className="chev">
                    <Icon.chevronRight />
                  </span>
                </button>
                <button className="aw-acct-row" onClick={() => navigate('/credits')}>
                  <span className="ic">
                    <Icon.receipt />
                  </span>
                  <span className="txt">
                    <span>Payment receipts</span>
                    <span className="s">Stored on your account</span>
                  </span>
                  <span className="chev">
                    <Icon.chevronRight />
                  </span>
                </button>
                <button className="aw-acct-row danger" onClick={requestLogout}>
                  <span className="ic">
                    <Icon.logout />
                  </span>
                  <span className="txt">
                    <span>Log out</span>
                  </span>
                  <span className="chev">
                    <Icon.chevronRight />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="aw-card glow">
              <div className="aw-balance">
                <div>
                  <div className="lbl">Credit balance</div>
                  <div className={'n' + (credits === 0 ? ' zero' : '')}>{credits}</div>
                  <div className="meta">1 credit = the full three-card verdict</div>
                </div>
                <div
                  className="aw-balance-actions"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}
                >
                  <div className="gem">
                    <Icon.gemFill />
                  </div>
                  <button className="aw-btn primary" onClick={() => navigate('/credits')}>
                    <Icon.gem /> Buy credits
                  </button>
                </div>
              </div>
            </div>

            <div className="aw-card">
              <div className="aw-section-h">
                <span className="t">
                  <span style={{ display: 'inline-flex', width: 18, color: 'var(--gold)' }}>
                    <Icon.phone />
                  </span>{' '}
                  Recent verdicts
                </span>
                <span className="aw-tag local">
                  <Icon.phone /> This device only
                </span>
              </div>
              {tiles.length > 0 ? (
                <>
                  <div className="aw-results">
                    {tiles.map((r) => (
                      <ResultTile key={r.id} result={r} onOpen={onOpen} />
                    ))}
                  </div>
                  <div className="aw-meter">
                    <div className="top">
                      <span>ON-DEVICE STORAGE</span>
                      <span>
                        {usedSlots} of 4 results · ~{(usedSlots * 2).toFixed(0)} MB
                      </span>
                    </div>
                    <div className="track">
                      <div className="fill" style={{ width: `${Math.min(100, (usedSlots / 4) * 100)}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="aw-lead" style={{ marginTop: 0 }}>
                  No verdicts saved on this device yet.{' '}
                  <button className="aw-linkbtn" style={{ display: 'inline', margin: 0 }} onClick={() => navigate('/scan')}>
                    Run your first scan →
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
