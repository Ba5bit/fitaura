import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  CREDIT_PACKS,
  VERDICT_COLOR_VAR,
  VERDICT_LABEL,
  type DatingVerdict,
} from '@fitaura/shared';
import { FaceCard, OutfitCard, Receipt } from '../../components/cards';
import { Icon } from '../../lib/icons';
import { useInView } from '../../lib/useInView';
import { useGeneration } from '../../state/generation';
import { useAccount } from '../account/AccountContext';
import { AccountEntry } from '../account/AccountChrome';
import { MOCK_GENERATIONS, DEFAULT_VERDICT } from '../../data/mockGenerations';
import '../../design/landing.css';

const HERO = MOCK_GENERATIONS[DEFAULT_VERDICT];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav className={'ln-nav' + (scrolled ? ' scrolled' : '')}>
      <div className="ln-brand">
        <span className="dot" />
        <span className="wm">FITAURA</span>
      </div>
      <div className="ln-nav-links">
        <a href="#how">How it works</a>
        <a href="#outputs">The verdict</a>
        <a href="#examples">Examples</a>
        <a href="#credits">Credits</a>
      </div>
      <div className="ln-nav-cta">
        <AccountEntry />
        <Link className="ln-btn primary" to="/scan">
          Get your verdict
        </Link>
        <button className="ln-burger" aria-label="Menu">
          <Icon.menu />
        </button>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="ln-hero ln-wrap" id="top">
      <div className="ln-hero-grid">
        <div className="ln-hero-copy">
          <span className="ln-eyebrow">FACE · OUTFIT · DATING RECEIPT</span>
          <h1>
            UPLOAD YOUR FACE AND OUTFIT. GET YOUR FULL <span className="hl">VERDICT.</span>
          </h1>
          <p className="ln-hero-sub">
            Two photos in. A Face Card, an Outfit Check and a Dating Receipt out — built to post.
          </p>
          <div className="ln-hero-actions">
            <Link className="ln-btn primary lg" to="/scan">
              Scan me — it's free <Icon.arrow />
            </Link>
            <a className="ln-btn lg ghost" href="#examples">
              See examples
            </a>
          </div>
          <div className="ln-hero-trust">
            <span className="free-pill">
              <span className="pdot" />
              First verdict free
            </span>
            <span className="t">
              <Icon.lock /> Photos never stored on our servers
            </span>
          </div>
        </div>

        <div className="ln-fan">
          <div className="ln-fan-stage">
            <div className="ln-fan-card left">
              <OutfitCard content={HERO.outfit.card} run />
            </div>
            <div className="ln-fan-card right">
              <Receipt content={HERO.receipt} paper="neon" />
            </div>
            <div className="ln-fan-card mid">
              <FaceCard content={HERO.face.card} run />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Artifacts() {
  const [ref, seen] = useInView<HTMLElement>();
  const arts = [
    { n: '01', name: 'Face Card', desc: "Your selfie, an aura read and one verdict you'll want to repost." },
    { n: '02', name: 'Outfit Check', desc: 'How the fit actually lands on your build — silhouette, proportions, score.' },
    { n: '03', name: 'Dating Receipt', desc: 'The final cheque. One verdict: green flag, normie, or red flag.' },
  ];
  return (
    <section className="ln-section ln-wrap" id="outputs" ref={ref}>
      <div className="ln-artifacts-head">
        <div>
          <span className="ln-eyebrow">ONE SCAN, THREE ARTIFACTS</span>
          <h2 className="ln-h2">
            Distinct cards.
            <br />
            <span className="hl">One verdict.</span>
          </h2>
        </div>
        <div className="ln-bundle-note">
          <Icon.bolt />
          <span>
            Every scan returns <b>all three</b> — not one card at a time.
          </span>
        </div>
      </div>
      <div className="ln-arts">
        <div className="ln-art">
          <div className="ln-art-stage">
            <FaceCard content={HERO.face.card} run={seen} />
          </div>
          <div className="ln-art-num">{arts[0].n}</div>
          <div className="ln-art-name">{arts[0].name}</div>
          <p className="ln-art-desc">{arts[0].desc}</p>
        </div>
        <div className="ln-art">
          <div className="ln-art-stage">
            <OutfitCard content={HERO.outfit.card} run={seen} />
          </div>
          <div className="ln-art-num">{arts[1].n}</div>
          <div className="ln-art-name">{arts[1].name}</div>
          <p className="ln-art-desc">{arts[1].desc}</p>
        </div>
        <div className="ln-art">
          <div className="ln-art-stage">
            <Receipt content={HERO.receipt} paper="neon" />
          </div>
          <div className="ln-art-num">{arts[2].n}</div>
          <div className="ln-art-name">{arts[2].name}</div>
          <p className="ln-art-desc">{arts[2].desc}</p>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: 'STEP 01', ic: <Icon.upload />, h: 'Upload two photos', p: "A selfie and a full outfit shot. Crop and reframe until it's right." },
    { n: 'STEP 02', ic: <Icon.scan />, h: 'Run the scan', p: 'We read your face, aura and fit — then cross-reference the two.' },
    { n: 'STEP 03', ic: <Icon.receipt />, h: 'Get the verdict', p: 'Three finished cards land at once, ready to screenshot and post.' },
  ];
  return (
    <section className="ln-section alt" id="how">
      <div className="ln-wrap">
        <span className="ln-eyebrow">HOW IT WORKS</span>
        <h2 className="ln-h2">
          From two photos to <span className="hl">posted</span> in under a minute.
        </h2>
        <div className="ln-steps">
          {steps.map((s) => (
            <div className="ln-step" key={s.n}>
              <div className="sn">{s.n}</div>
              <div className="si">{s.ic}</div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Bundle() {
  const items = [
    { t: 'Face Card', s: 'shareable' },
    { t: 'Face analysis breakdown', s: 'in-app' },
    { t: 'Outfit Check Card', s: 'shareable' },
    { t: 'Outfit fit breakdown', s: 'in-app' },
    { t: 'Dating Score Receipt', s: 'shareable' },
  ];
  return (
    <section className="ln-section ln-wrap">
      <div className="ln-bundle-grid">
        <div>
          <span className="ln-eyebrow">ONE CREDIT, THE WHOLE VERDICT</span>
          <h2 className="ln-h2">
            A single scan
            <br />
            unlocks <span className="hl">everything.</span>
          </h2>
          <ul className="ln-bundle-list">
            {items.map((it) => (
              <li key={it.t}>
                <span className="ck">
                  <Icon.check />
                </span>
                {it.t}
                <span className="sub">{it.s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ln-credit-box">
          <span className="ln-eyebrow">WHAT ONE CREDIT BUYS</span>
          <div className="one" style={{ marginTop: '16px' }}>
            1 SCAN =<br />
            <span className="hl">3 CARDS</span>
          </div>
          <p className="one-sub">
            No piecemeal unlocks, no upsell mid-result. One credit runs the complete face, outfit and
            dating verdict in a single pass.
          </p>
          <div className="ln-hero-actions" style={{ marginTop: '26px' }}>
            <Link className="ln-btn primary" to="/scan">
              Run your first scan free <Icon.arrow />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Credits() {
  const { credits } = useGeneration();
  const { startCheckout } = useAccount();

  // Selecting a pack opens the real checkout funnel (account gate → confirm →
  // processing → success grants credits). The funnel is the single monetization
  // path, shared with the account-area Credits page.
  const buy = (id: string) => startCheckout(id);

  return (
    <section className="ln-section alt" id="credits">
      <div className="ln-wrap">
        <div className="ln-artifacts-head">
          <div>
            <span className="ln-eyebrow">CREDITS, NOT SUBSCRIPTIONS</span>
            <h2 className="ln-h2">
              First scan's <span className="hl">on us.</span>
            </h2>
            <p className="ln-lead">
              Your first complete verdict is free. After that, top up with credits whenever you want
              another — friends, exes, celebrities, fair game.
            </p>
          </div>
          <span className="free-pill" style={{ alignSelf: 'center' }}>
            <span className="pdot" />
            {credits > 0 ? `${credits} credit${credits === 1 ? '' : 's'} ready` : '1 credit = 1 full verdict'}
          </span>
        </div>
        <div className="ln-packs">
          {CREDIT_PACKS.map((p) => (
            <button
              type="button"
              className={'ln-pack' + (p.featured ? ' feature' : '')}
              key={p.id}
              onClick={() => buy(p.id)}
            >
              {p.badge && <span className="ln-pack-badge">{p.badge}</span>}
              <div className="tier">{p.tier}</div>
              <div className="credits">
                {p.credits}
                <span>credits</span>
              </div>
              <div className="price">{p.price}</div>
              <div className="per">{p.perScan}</div>
              <span className="ln-pack-cta">Get {p.credits} credits →</span>
            </button>
          ))}
        </div>
        <p className="ln-packs-foot">
          Credits never expire. One credit always returns the full three-card verdict.
        </p>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="ln-section ln-wrap" id="privacy">
      <span className="ln-eyebrow" style={{ display: 'flex', justifyContent: 'center' }}>
        BUILT TO BE SHARED, NOT STORED
      </span>
      <h2 className="ln-h2" style={{ textAlign: 'center' }}>
        Your photos stay <span className="hl">yours.</span>
      </h2>
      <div className="ln-privacy-card">
        <div className="ic">
          <Icon.shield />
        </div>
        <div>
          <h3>We don't keep your source photos.</h3>
          <p>
            Your face and outfit photos are used to build your verdict and are{' '}
            <b style={{ color: 'var(--ink)' }}>not permanently stored on our servers</b>. Finished
            cards, receipts and history live on your own device — so the moment you close the tab, the
            originals are gone from us.
          </p>
          <div className="ln-privacy-points">
            <span className="pp">Source photos not server-stored</span>
            <span className="pp">Results saved on your device</span>
            <span className="pp">No public profile, ever</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Examples() {
  const [ref, seen] = useInView<HTMLElement>();
  const order: { key: DatingVerdict; line: string }[] = [
    { key: 'green_flag', line: 'When the fit and the face both cooperate.' },
    { key: 'normie', line: 'Clean, harmless, quietly buffering.' },
    { key: 'red_flag', line: 'High aura, questionable everything else.' },
  ];
  return (
    <section className="ln-section alt" id="examples" ref={ref}>
      <div className="ln-wrap">
        <span className="ln-eyebrow">SAMPLE RECEIPTS</span>
        <h2 className="ln-h2">
          Three outcomes. <span className="hl">One of them is you.</span>
        </h2>
        <div className="ln-examples-row">
          {order.map((o) => {
            const gen = MOCK_GENERATIONS[o.key];
            return (
              <div className="ln-example" key={o.key}>
                <div className="ln-example-stage" style={{ ['--verdict']: VERDICT_COLOR_VAR[o.key] } as CSSProperties}>
                  <Receipt content={gen.receipt} paper="neon" sealOn={seen || true} />
                </div>
                <div className="ln-example-cap">
                  <div className="vd" style={{ color: VERDICT_COLOR_VAR[o.key] }}>
                    {VERDICT_LABEL[o.key]}
                  </div>
                  <div className="ln">{o.line}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="ln-final ln-wrap">
      <span className="ln-eyebrow" style={{ justifyContent: 'center', display: 'flex' }}>
        YOUR TURN
      </span>
      <h2>
        UPLOAD. SCAN. <span className="hl">GET POSTED.</span>
      </h2>
      <p>
        Two photos, one credit, three cards your group chat will not let go of. The first one's free.
      </p>
      <div className="ln-hero-actions">
        <Link className="ln-btn primary lg" to="/scan">
          Get your verdict <Icon.arrow />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ln-footer">
      <div className="ln-wrap">
        <div className="ln-footer-top">
          <div className="ln-footer-brand">
            <div className="ln-brand">
              <span className="dot" />
              <span className="wm">FITAURA</span>
            </div>
            <p>
              Face card, outfit check and dating receipt — made for social sharing. For entertainment
              only.
            </p>
          </div>
          <div className="ln-footer-cols">
            <div className="ln-footer-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#outputs">The verdict</a>
              <a href="#examples">Examples</a>
              <a href="#credits">Credits</a>
            </div>
            <div className="ln-footer-col">
              <h4>Company</h4>
              <a href="#privacy">Privacy</a>
              <a href="#top">Terms</a>
              <a href="#top">Contact</a>
            </div>
          </div>
        </div>
        <div className="ln-footer-bottom">
          <span className="cr">© 2026 FITAURA</span>
          <span className="disc">
            FITAURA is a playful, subjective entertainment product. Scores and verdicts are not a
            measure of real attractiveness, health or worth.
          </span>
        </div>
      </div>
    </footer>
  );
}

function MobileBar() {
  return (
    <div className="ln-mobilebar">
      <div className="mb-meta">
        <div className="l1">Get your full verdict</div>
        <div className="l2">First scan free · 1 credit = 3 cards</div>
      </div>
      <Link className="ln-btn primary" to="/scan">
        Scan me <Icon.arrow />
      </Link>
    </div>
  );
}

export function Landing() {
  return (
    <div className="ln">
      <Nav />
      <Hero />
      <hr className="ln-hr ln-wrap" />
      <Artifacts />
      <How />
      <Bundle />
      <Credits />
      <Privacy />
      <Examples />
      <FinalCTA />
      <Footer />
      <MobileBar />
    </div>
  );
}
