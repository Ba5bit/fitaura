import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { LockedMode } from './LockedMode';
import type { ScanMode } from './modes';
import '../../design/versus.css';

/**
 * Vault surface for Friend vs Friend. The verdict is a deterministic placeholder
 * until the model is wired, so in PRODUCTION this stays the same locked tile
 * everyone already sees. Only in dev does it become a launcher into the real
 * /versus flow — flip the `import.meta.env.DEV` guard (here + the routes in
 * App.tsx) when the analysis goes live.
 */
export function FriendMode({ mode }: { mode: ScanMode }) {
  const navigate = useNavigate();
  if (!import.meta.env.DEV) return <LockedMode mode={mode} />;

  return (
    <div>
      <div className="vlt-head">
        <div className="vlt-head-l">
          <span className="vlt-eyebrow">SCAN MODE · DEV PREVIEW</span>
          <h1 className="vlt-h1">
            FRIEND VS <span className="hl">FRIEND</span>
          </h1>
          <p className="vlt-lead">{mode.blurb}</p>
        </div>
        <div className="vlt-head-r">
          <span className="vs-devnote">
            <Icon.bolt /> Dev only · placeholder verdict
          </span>
          <button className="vlt-btn primary lg" onClick={() => navigate('/versus')}>
            <Icon.users /> Start a battle
          </button>
        </div>
      </div>

      <div className="vlt-lk-outs">
        {mode.outputs.map((o, i) => (
          <div className="vlt-lk-out" key={o}>
            <div className="n">0{i + 1}</div>
            <div className="t">{o}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
