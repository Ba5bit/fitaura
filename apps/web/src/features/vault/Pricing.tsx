import { CREDIT_PACKS } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useAccount } from '../account/AccountContext';
import { VaultNav } from './VaultNav';
import { SubHead } from './SubHead';

const UNLOCKS = [
  'Face Card',
  'Face Analysis',
  'Outfit Card',
  'Outfit Analysis',
  'Dating Score Receipt',
  'Shareable 9:16 exports',
];

/** Pricing & credits — credit-pack selector wired to the real checkout flow. */
export function Pricing() {
  const { credits } = useGeneration();
  const { pack, setPack, startCheckout, flash } = useAccount();
  const zero = credits === 0;
  const selected = CREDIT_PACKS.find((p) => p.id === pack) ?? CREDIT_PACKS[0];

  return (
    <div className="vlt">
      <VaultNav />
      <div className="vlt-body">
        <div className="vlt-sub">
          <SubHead
            eyebrow="CREDITS"
            title="PRICING & CREDITS"
            sub="FitAura runs on credits, not subscriptions. One credit unlocks the complete verdict — all three cards plus analysis."
          />

          <div className="vlt-panel glow">
            <div className="vlt-balance">
              <div>
                <div className="lbl">Credit balance</div>
                <div className={'n' + (zero ? ' zero' : '')}>{credits}</div>
                <div className="meta">1 credit = the full three-card verdict</div>
              </div>
              <div className="gem">
                <Icon.gemFill />
              </div>
            </div>
          </div>

          <div className="vlt-packs" role="radiogroup" aria-label="Credit packs">
            {CREDIT_PACKS.map((p) => (
              <button
                key={p.id}
                className="vlt-pack"
                role="radio"
                aria-checked={pack === p.id}
                onClick={() => setPack(p.id)}
              >
                {p.featured && <span className="vlt-pack-badge">{p.badge ?? 'Most picked'}</span>}
                <span className="radio" />
                <span className="tier">{p.tier}</span>
                <span className="credits">
                  {p.credits}
                  <span>credits</span>
                </span>
                <span className="price">{p.price}</span>
                <span className="per">{p.perScan}</span>
              </button>
            ))}
          </div>

          <div className="vlt-unlock">
            <div className="h">
              <span className="bolt">
                <Icon.bolt />
              </span>
              One credit unlocks the complete verdict
            </div>
            <ul>
              {UNLOCKS.map((u) => (
                <li key={u}>
                  <span className="ck">
                    <Icon.check />
                  </span>
                  {u}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
            <button className="vlt-btn primary lg" onClick={() => startCheckout(selected.id)}>
              <Icon.gem /> Buy {selected.credits} credits · {selected.price}
            </button>
            <button className="vlt-btn lg ghost" onClick={() => flash('Payment receipts are saved to your account.')}>
              <Icon.receipt /> Payment receipts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
