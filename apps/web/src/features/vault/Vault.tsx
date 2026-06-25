import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { VaultNav } from './VaultNav';
import { SoloMode } from './SoloMode';
import { LockedMode } from './LockedMode';
import { FriendMode } from './FriendMode';
import { SCAN_MODES, type ScanModeId } from './modes';

/** Left scan-mode selector — Solo live, the rest intentionally locked. */
function ModeRail({ mode, onSelect }: { mode: ScanModeId; onSelect: (id: ScanModeId) => void }) {
  return (
    <aside className="vlt-rail">
      <div className="vlt-rail-h">Scan modes</div>
      {SCAN_MODES.map((m) => {
        const locked = m.status === 'locked';
        const ModeIcon = Icon[m.icon];
        return (
          <button
            key={m.id}
            className={'vlt-mode' + (locked ? ' locked' : '')}
            aria-current={mode === m.id}
            onClick={() => onSelect(m.id)}
          >
            <span className="mic">
              <ModeIcon />
            </span>
            <span className="mtx">
              <span className="mnm">{m.name}</span>
              <span className="mtg">
                <span className="d" />
                {m.tag}
              </span>
            </span>
            {locked && (
              <span className="lk">
                <Icon.lock />
              </span>
            )}
          </button>
        );
      })}
      <div className="vlt-rail-foot">
        <div className="t">More modes incoming</div>
        <div className="s">Friend vs Friend and Glow Up unlock the same Vault. Your cards, new previews.</div>
      </div>
    </aside>
  );
}

/**
 * Vault — the authenticated product dashboard and app home (v3 IA). Open to
 * guests so the free first scan needs no account; sign-in is offered, never
 * forced. Ported from the design's `vault-app` shell.
 */
export function Vault() {
  // A result page can hand back the mode to open (e.g. returning from a Friend vs
  // Friend verdict reopens the Friend tab, a Solo verdict reopens Solo). Validated
  // against the known modes; anything else (or a direct visit) falls back to Solo.
  const { state } = useLocation();
  const requested = (state as { vaultMode?: ScanModeId } | null)?.vaultMode;
  const initialMode: ScanModeId = requested && SCAN_MODES.some((m) => m.id === requested) ? requested : 'solo';
  const [mode, setMode] = useState<ScanModeId>(initialMode);
  const active = SCAN_MODES.find((m) => m.id === mode)!;

  return (
    <div className="vlt">
      <VaultNav />
      <div className="vlt-body">
        <div className="vlt-cols">
          <ModeRail mode={mode} onSelect={setMode} />
          <main>
            {active.id === 'friend' ? (
              // Friend vs Friend decides dev-launcher vs locked internally.
              <FriendMode mode={active} />
            ) : active.status === 'live' ? (
              <SoloMode mode={active} />
            ) : (
              <LockedMode mode={active} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
