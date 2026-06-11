import { Icon } from '../../lib/icons';
import { useAccount } from '../account/AccountContext';
import type { ScanMode } from './modes';

/** The blurred preview mock for a locked future mode. */
function LockedPreview({ id }: { id: ScanMode['id'] }) {
  if (id === 'friend') {
    return (
      <div className="lk-preview">
        <span className="lk-badge">Locked</span>
        <span className="lk-blur" />
        <div className="lk-vs">
          <div className="p" />
          <span className="vsx">VS</span>
          <div className="p" />
        </div>
      </div>
    );
  }
  return (
    <div className="lk-preview">
      <span className="lk-badge">Locked</span>
      <span className="lk-blur" />
      <div className="lk-ba">
        <div className="row">
          <span className="lab">Before</span>
          <span className="bar" />
        </div>
        <div className="row">
          <span className="lab">After</span>
          <span className="bar" />
        </div>
      </div>
    </div>
  );
}

/** Intentionally-locked Coming-Soon surface for a future scan mode. */
export function LockedMode({ mode }: { mode: ScanMode }) {
  const { flash } = useAccount();
  return (
    <div className="vlt-locked">
      <div className="vlt-locked-hero">
        <div>
          <span className="vlt-eyebrow lock lk-eyebrow">
            <Icon.lock /> FUTURE SCAN · COMING SOON
          </span>
          <h1 className="vlt-h1" style={{ color: '#fff' }}>
            {mode.name.toUpperCase()}
          </h1>
          <p className="vlt-lead">{mode.blurb}</p>
          <div className="lk-acts">
            <span className="vlt-lockbtn">
              <Icon.lock /> Locked for now
            </span>
            <button className="vlt-btn ghost" onClick={() => flash(`We'll ping you the moment ${mode.name} goes live.`)}>
              <Icon.bolt /> Notify me when it's ready
            </button>
          </div>
        </div>
        <LockedPreview id={mode.id} />
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
