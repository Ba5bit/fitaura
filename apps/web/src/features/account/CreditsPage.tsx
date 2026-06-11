import { CREDIT_PACKS } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useAccount } from './AccountContext';
import { AccountNav, UnlockList } from './AccountChrome';

/** Credit-pack selector — the monetization entry, wired to real CREDIT_PACKS. */
export function CreditsPage() {
  const { pack, setPack, startCheckout, signedIn } = useAccount();
  const { credits } = useGeneration();

  return (
    <>
      <AccountNav />
      <div className="aw-page">
        <div className="aw-dash-head">
          <div>
            <span className="aw-eyebrow accent">CREDITS · NO SUBSCRIPTION</span>
            <h1 className="aw-h1">
              TOP UP <span className="hl">CREDITS</span>
            </h1>
            <p className="aw-lead">
              Credits never expire and there's no auto-renew. One credit always returns the full three-card verdict —
              never one card at a time.
            </p>
          </div>
          {signedIn && (
            <span className="aw-chip" style={{ cursor: 'default' }}>
              <span className="gem">
                <Icon.gem />
              </span>
              <b>{credits}</b> credits
            </span>
          )}
        </div>

        <div className="aw-packs" role="radiogroup" aria-label="Credit packs">
          {CREDIT_PACKS.map((p) => (
            <button
              key={p.id}
              className="aw-pack"
              role="radio"
              aria-checked={pack === p.id}
              onClick={() => setPack(p.id)}
            >
              {p.featured && <span className="aw-pack-badge">{p.badge ?? 'Most picked'}</span>}
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

        <div
          style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginTop: '28px', alignItems: 'center' }}
          className="aw-credits-foot"
        >
          <UnlockList />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="aw-btn primary lg block" onClick={() => startCheckout()}>
              Continue <Icon.arrow />
            </button>
            <div className="aw-fineprint" style={{ marginTop: 0 }}>
              One-time charge · No auto-renew · Balance stored on your account
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
