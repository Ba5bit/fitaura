import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useAccount } from './AccountContext';
import { AccountNav, ResultTile, useResultTiles, type ResultSummary } from './AccountChrome';

/** Recent on-device verdicts. */
export function ResultsPage() {
  const navigate = useNavigate();
  const { openResult } = useGeneration();
  const { openMissing } = useAccount();
  const tiles = useResultTiles();

  const onOpen = (r: ResultSummary) => {
    if (openResult(r.id)) navigate('/result');
    else openMissing(r.id);
  };

  const used = tiles.length;

  return (
    <>
      <AccountNav />
      <div className="aw-page">
        <div className="aw-dash-head">
          <div>
            <span className="aw-eyebrow">SAVED ON THIS DEVICE</span>
            <h1 className="aw-h1">RECENT VERDICTS</h1>
            <p className="aw-lead">
              Your finished cards, receipts and verdict history live in this browser — never on our servers. Clear your
              browser or switch devices and they're gone.
            </p>
          </div>
          <span className="aw-tag local">
            <Icon.phone /> On-device only
          </span>
        </div>

        {tiles.length > 0 ? (
          <>
            <div className="aw-results" style={{ marginTop: '32px' }}>
              {tiles.map((r) => (
                <ResultTile key={r.id} result={r} onOpen={onOpen} />
              ))}
            </div>

            <div
              className="aw-card"
              style={{
                marginTop: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '24px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 280px' }}>
                <div className="aw-meter" style={{ marginTop: 0 }}>
                  <div className="top">
                    <span>ON-DEVICE STORAGE</span>
                    <span>
                      {used} of 4 results · ~{(used * 2).toFixed(0)} MB
                    </span>
                  </div>
                  <div className="track">
                    <div className="fill" style={{ width: `${Math.min(100, (used / 4) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <button className="aw-btn" onClick={() => navigate('/storage')}>
                <Icon.shield /> Why are these stored locally?
              </button>
            </div>
          </>
        ) : (
          <div className="aw-card" style={{ marginTop: '32px', textAlign: 'center' }}>
            <p className="aw-lead" style={{ margin: '0 auto' }}>
              No verdicts saved on this device yet.
            </p>
            <button className="aw-btn primary" style={{ marginTop: '18px' }} onClick={() => navigate('/scan')}>
              <Icon.scan /> Run your first scan
            </button>
          </div>
        )}
      </div>
    </>
  );
}
