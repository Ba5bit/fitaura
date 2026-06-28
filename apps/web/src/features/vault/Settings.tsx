import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useBattle } from '../../state/battle';
import { useAccount } from '../account/AccountContext';
import { usePreferences } from '../../state/preferences';
import { VaultNav } from './VaultNav';
import { SubHead } from './SubHead';

/** Settings — privacy, on-device storage management and app preferences. */
export function Settings() {
  const { history, clearAll: clearSolo } = useGeneration();
  const { history: battles, clearAll: clearBattles } = useBattle();
  const { flash } = useAccount();
  // Account-synced (cross-device when signed in); device-local for guests.
  const { receiptPaper, reduceMotion, setReceiptPaper, setReduceMotion } = usePreferences();

  // Count every mode's saved cards (Solo results + FvF battles + future modes).
  const present = history.length + battles.length;
  const fill = Math.min(present * 25, 100);

  const clearAll = async () => {
    if (present === 0) return;
    if (!window.confirm('Permanently remove every generated card and receipt from this device?')) return;
    // clearSolo wipes ALL on-device stores for this account (every mode); the
    // FvF call just resets its live view afterwards.
    await clearSolo();
    clearBattles();
    flash('All on-device results cleared');
  };

  return (
    <div className="vlt">
      <VaultNav />
      <div className="vlt-body">
        <div className="vlt-sub">
          <SubHead
            eyebrow="SETTINGS"
            title="SETTINGS"
            sub="Privacy, on-device storage and app preferences. Your photos and finished cards never leave this device."
          />

          {/* privacy / where data lives */}
          <div className="vlt-panel">
            <h3 className="vlt-panel-h">
              <Icon.shield /> Where your data lives
            </h3>
            <p className="vlt-lead" style={{ margin: '6px 0 0', maxWidth: '640px', fontSize: '14px' }}>
              FitAura keeps only your account on its servers. Everything you generate stays in this browser.
            </p>
            <div className="vlt-store-cols">
              <div className="vlt-store-col server">
                <div className="ch">
                  <span className="ic">
                    <Icon.cloud />
                  </span>
                  <div>
                    <div className="ti">On our server</div>
                    <div className="tag">Synced to your login</div>
                  </div>
                </div>
                <ul>
                  <li>
                    <Icon.check /> Account &amp; sign-in
                  </li>
                  <li>
                    <Icon.check /> Credit balance
                  </li>
                  <li>
                    <Icon.check /> Payment receipts
                  </li>
                </ul>
              </div>
              <div className="vlt-store-col local">
                <div className="ch">
                  <span className="ic">
                    <Icon.phone />
                  </span>
                  <div>
                    <div className="ti">On this device</div>
                    <div className="tag">This browser only</div>
                  </div>
                </div>
                <ul>
                  <li>
                    <Icon.check /> Face &amp; outfit photos
                  </li>
                  <li>
                    <Icon.check /> Generated cards &amp; receipts
                  </li>
                  <li>
                    <Icon.check /> Verdict history
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* device storage management */}
          <div className="vlt-panel">
            <h3 className="vlt-panel-h">
              <Icon.phone /> Device storage
            </h3>
            <div className="vlt-meter">
              <div className="top">
                <span>
                  {present} result{present === 1 ? '' : 's'} kept locally
                </span>
                <span>~{present * 2} MB</span>
              </div>
              <div className="track">
                <div className="fill" style={{ width: fill + '%' }} />
              </div>
            </div>
            <div className="vlt-setrow" style={{ borderTop: '1px solid var(--hair-soft)', marginTop: '8px' }}>
              <div className="tx">
                <div className="k">Clear saved results</div>
                <div className="s">
                  Permanently removes every generated card and receipt from this device. Your account and credits are not
                  affected.
                </div>
              </div>
              <button
                className="vlt-btn sm"
                onClick={clearAll}
                style={{ borderColor: 'color-mix(in oklab, var(--red) 45%, var(--hair))', color: 'var(--red)' }}
              >
                <Icon.trash /> Clear all
              </button>
            </div>
          </div>

          {/* preferences */}
          <div className="vlt-panel">
            <h3 className="vlt-panel-h">
              <Icon.gear /> Preferences
            </h3>
            <div className="vlt-setrow">
              <div className="tx">
                <div className="k">Reduce motion</div>
                <div className="s">Tone down scanner sweeps, count-ups and sticker pops.</div>
              </div>
              <button
                className="vlt-toggle"
                role="switch"
                aria-checked={reduceMotion}
                onClick={() => setReduceMotion(!reduceMotion)}
              >
                <span className="k" />
              </button>
            </div>
            <div className="vlt-setrow">
              <div className="tx">
                <div className="k">Default receipt paper</div>
                <div className="s">Which Dating Score Receipt style new scans use.</div>
              </div>
              <div className="vlt-seg" role="tablist">
                <button role="tab" aria-selected={receiptPaper === 'neon'} onClick={() => setReceiptPaper('neon')}>
                  Dark neon
                </button>
                <button role="tab" aria-selected={receiptPaper === 'thermal'} onClick={() => setReceiptPaper('thermal')}>
                  Thermal
                </button>
                <button role="tab" aria-selected={receiptPaper === 'premium'} onClick={() => setReceiptPaper('premium')}>
                  Onyx
                </button>
                <button role="tab" aria-selected={receiptPaper === 'white'} onClick={() => setReceiptPaper('white')}>
                  Ivory
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
