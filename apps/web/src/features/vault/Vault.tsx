import { useEffect, useState } from 'react';
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
const VAULT_MODE_KEY = 'vault:mode';
const isMode = (m: unknown): m is ScanModeId => SCAN_MODES.some((x) => x.id === m);
function storedMode(): ScanModeId | null {
  try {
    const m = sessionStorage.getItem(VAULT_MODE_KEY);
    return isMode(m) ? m : null;
  } catch {
    return null;
  }
}

export function Vault() {
  // Which mode to open. In-app navigation hands it back via router state (e.g. a
  // Friend vs Friend verdict reopens the Friend tab). Browser back/forward does NOT
  // replay that state, so we fall back to the last mode persisted in sessionStorage
  // (set below + by the result pages); a direct visit defaults to Solo.
  const { state } = useLocation();
  const requested = (state as { vaultMode?: ScanModeId } | null)?.vaultMode;
  const initialMode: ScanModeId = (isMode(requested) ? requested : null) ?? storedMode() ?? 'solo';
  const [mode, setMode] = useState<ScanModeId>(initialMode);
  // Persist the active tab so a later browser back/forward reopens the same mode.
  useEffect(() => {
    try {
      sessionStorage.setItem(VAULT_MODE_KEY, mode);
    } catch {
      /* sessionStorage unavailable — mode just won't persist across history nav */
    }
  }, [mode]);
  const active = SCAN_MODES.find((m) => m.id === mode)!;

  // Each mode is its own page sharing one scrolling window, so switching modes
  // must reset the window to the top — otherwise a scrolled-down list (e.g. many
  // Friend battles) leaves the next mode scrolled into empty space.
  const selectMode = (id: ScanModeId) => {
    setMode(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div className="vlt">
      <VaultNav />
      <div className="vlt-body">
        <div className="vlt-cols">
          <ModeRail mode={mode} onSelect={selectMode} />
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
