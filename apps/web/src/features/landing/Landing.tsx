import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CREDIT_PACKS, VERDICT_COLOR_VAR, VERDICT_LABEL } from '@fitaura/shared';
import { useGeneration } from '../../state/generation';
import { FaceCard, OutfitCard, Receipt } from '../../components/cards';
import { Icon } from '../../lib/icons';
import { useInView } from '../../lib/useInView';
import { useAccount } from '../account/AccountContext';
import { AccountEntry } from '../account/AccountChrome';
import { SCAN_MODES, type ScanModeId } from '../vault/modes';
import { MOCK_GENERATIONS, DEFAULT_VERDICT, HERO_CHARACTERS, fanBreakdown, type FanKind } from '../../data/mockGenerations';
import { CardFan } from './CardFan';
import '../../design/landing.css';
import '../../design/result-shell.css';

const HERO = MOCK_GENERATIONS[DEFAULT_VERDICT];

/**
 * v2 header — mirrors the Vault's own nav (brand · Home / Vault pills · profile)
 * so the public landing and the authenticated product read as one surface. The
 * Vault pill is shown active; the old text links + "Get your verdict" button are
 * gone (the Vault pill and the AccountEntry chip carry the primary action).
 */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  return (
    <nav className={'ln-nav v2' + (scrolled ? ' scrolled' : '')}>
      <a className="ln-brand" href="#top" aria-label="FITAURA home">
        <span className="dot" />
        <span className="wm">FITAURA</span>
      </a>
      <div className="ln-navmid">
        <a className="ln-navlink active" href="#top" aria-current="page">
          <Icon.home />
          <span>Home</span>
        </a>
        <Link className="ln-navlink" to="/vault">
          <Icon.grid />
          <span>Vault</span>
        </Link>
      </div>
      <div className="ln-nav-cta">
        <AccountEntry />
        <button
          className="ln-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((x) => !x)}
        >
          {menuOpen ? <Icon.x /> : <Icon.menu />}
        </button>
      </div>
      {menuOpen && (
        <div className="ln-mobilemenu">
          <a href="#top" onClick={() => setMenuOpen(false)}>
            Home
          </a>
          <a href="#modes" onClick={() => setMenuOpen(false)}>
            Scan modes
          </a>
          <a href="#credits" onClick={() => setMenuOpen(false)}>
            Credits
          </a>
          <Link className="ln-btn primary block" to="/vault" onClick={() => setMenuOpen(false)}>
            Open the Vault
          </Link>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <header className="ln-hero ln-wrap" id="top">
      <div className="ln-hero-grid">
        <div className="ln-hero-copy">
          <span className="ln-eyebrow">SOLO · FRIEND VS FRIEND · GLOW UP</span>
          <h1>
            EVERY AURA HAS A <span className="hl">VERDICT</span>
          </h1>
          <p className="ln-hero-sub">
            Scan yourself, a friend, or your glow-up. Get a verdict built to post.
          </p>
          <div className="ln-hero-actions">
            <Link className="ln-btn primary lg" to="/vault">
              Scan me
            </Link>
            <a className="ln-btn lg ghost" href="#modes">
              Explore the modes
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
          <div
            className="ln-fan-stage"
            style={{ ['--verdict']: VERDICT_COLOR_VAR[DEFAULT_VERDICT] } as CSSProperties}
          >
            <div className="ln-fan-card left"><FaceCard content={HERO_CHARACTERS[2].content} roast={HERO_CHARACTERS[2].roast} run /></div>
            <div className="ln-fan-card right"><FaceCard content={HERO_CHARACTERS[1].content} roast={HERO_CHARACTERS[1].roast} run /></div>
            <div className="ln-fan-card mid"><FaceCard content={HERO_CHARACTERS[0].content} roast={HERO_CHARACTERS[0].roast} run /></div>
          </div>
        </div>
      </div>
    </header>
  );
}

/** Map a breakdown block to result-shell.css's tier (drives bar + tag color). */
function blockTier(b: { tag: string; pct: number }): 'high' | 'mid' | 'low' {
  const v = b.tag ? (b.tag === 'ELITE' || b.tag === 'HIGH' ? 90 : b.tag === 'SOLID' ? 70 : 40) : b.pct;
  return v >= 78 ? 'high' : v >= 60 ? 'mid' : 'low';
}

/**
 * Two-column "distinct cards" block: a tappable CardFan (Face → Outfit →
 * Receipt) on the left, and a 2×2 breakdown grid that re-renders to whichever
 * card is currently front. One HERO mock backs all three faces + the breakdown.
 */
function Artifacts() {
  const [ref, seen] = useInView<HTMLElement>();
  const [front, setFront] = useState<FanKind>('face');
  const KIND: FanKind[] = ['face', 'outfit', 'receipt'];
  const bd = fanBreakdown(front);
  return (
    <section className="ln-section ln-wrap" id="outputs" ref={ref}>
      <div className="ln-artifacts-head">
        <div>
          <span className="ln-eyebrow">ONE SCAN, DISTINCT CARDS</span>
          <h2 className="ln-h2">
            Distinct cards
            <br />
            <span className="hl">One verdict</span>
          </h2>
        </div>
        <div className="ln-bundle-note">
          <Icon.bolt />
          <span>Scan a face, a fit, or both — get the cards that fit.</span>
        </div>
      </div>
      <div className="ln-distinct" style={{ ['--verdict']: VERDICT_COLOR_VAR[DEFAULT_VERDICT] } as CSSProperties}>
        <div className="ln-distinct-fan">
          <CardFan
            onFrontChange={(i) => setFront(KIND[i])}
            items={[
              <FaceCard key="f" content={HERO.face!.card} roast={HERO.face!.analysis.roast} run={seen} />,
              <OutfitCard key="o" content={HERO.outfit!.card} roast={HERO.outfit!.analysis.verdict} run={seen} />,
              <Receipt key="r" content={HERO.receipt} paper="neon" />,
            ]}
          />
        </div>
        <div className="ln-distinct-bd">
          {front === 'receipt' ? (
            /* Receipt has no per-metric graphs — show the final verdict summary instead. */
            <div className="ln-distinct-summary">
              <div className="ln-eyebrow">RECEIPT · FINAL READING</div>
              <div className="lds-head">
                <div className="lds-score">
                  {HERO.receipt.datingScore}
                  <span className="u">/10</span>
                </div>
                <span className="lds-stamp">{VERDICT_LABEL[HERO.receipt.datingVerdict]}</span>
              </div>
              <div className="lds-lbl">DATING SCORE</div>
              <p className="ln-distinct-cap">
                <span className="hl">{HERO.receipt.finalPunchline}.</span> {HERO.receipt.summary}
              </p>
            </div>
          ) : (
            <>
              <div className="ln-eyebrow">{bd.eyebrow}</div>
              <h3 className="ln-distinct-title">{bd.title}</h3>
              <div className="rs-breakgrid">
                {bd.blocks.map((b) => (
                  <div
                    className="gym-card"
                    data-tier={front === 'outfit' ? undefined : blockTier(b)}
                    data-accent={front === 'outfit' ? 'blue' : undefined}
                    key={b.label}
                  >
                    <div className="gc-top">
                      <div className="gc-score">
                        <span className="num">{b.value}</span>
                        {b.tag && <span className="tier">{b.tag}</span>}
                      </div>
                    </div>
                    <div className="gc-name">{b.label}</div>
                    <div className="gc-bar">
                      <i style={{ width: `${b.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="ln-distinct-cap">{bd.cap}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: 'STEP 01', ic: <Icon.upload />, h: 'Upload your photos', p: "A selfie, an outfit, or both — crop till it's right." },
    { n: 'STEP 02', ic: <Icon.scan />, h: 'Run the scan', p: 'We read your face, aura and fit, then score how they play together.' },
    { n: 'STEP 03', ic: <Icon.receipt />, h: 'Get the verdict', p: 'Your cards land ready to screenshot and post.' },
  ];
  return (
    <section className="ln-section alt" id="how">
      <div className="ln-wrap">
        <span className="ln-eyebrow">HOW IT WORKS</span>
        <h2 className="ln-h2">
          From photo to <span className="hl">posted</span> in under a minute
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

function Credits() {
  const { credits, startCheckout } = useAccount();

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
              First scan's <span className="hl">on us</span>
            </h2>
            <p className="ln-lead">
              Your first verdict is free. After that, top up whenever. Friends, exes, celebrities — all fair game.
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
              <span className="ln-pack-cta">Get {p.credits} credits</span>
            </button>
          ))}
        </div>
        <p className="ln-packs-foot">
          Credits never expire. One credit = one verdict.
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
        Your photos stay <span className="hl">yours</span>
      </h2>
      <div className="ln-privacy-card">
        <div className="ic">
          <Icon.shield />
        </div>
        <div>
          <h3>We don't keep your source photos</h3>
          <p>
            We use your photos to build your verdict, then drop them — <b style={{ color: 'var(--ink)' }}>never stored on our servers</b>. Your cards and history live on your device.
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

/** Lightweight per-mode preview mock shown at the top of each mode card. */
function ModePreview({ id }: { id: ScanModeId }) {
  if (id === 'solo') {
    return (
      <div className="lm-pv tiles">
        {['Face', 'Outfit', 'Receipt'].map((t) => (
          <span className="lm-pv-tile" key={t}>
            <span className="box" />
            <span className="lbl">{t}</span>
          </span>
        ))}
      </div>
    );
  }
  if (id === 'friend') {
    return (
      <div className="lm-pv vs">
        <span className="box" />
        <span className="x">VS</span>
        <span className="box" />
      </div>
    );
  }
  return (
    <div className="lm-pv ba">
      <div className="row">
        <span className="k">Before</span>
        <span className="bar" style={{ width: '60%' }} />
      </div>
      <div className="row">
        <span className="k">After</span>
        <span className="bar" style={{ width: '88%' }} />
      </div>
    </div>
  );
}

function Modes() {
  const navigate = useNavigate();
  const { startNewScan } = useGeneration();
  // Mirror the Vault's Solo flow: clear any stale photos, then go to the upload
  // (scan) page directly rather than back through the Vault.
  const startSolo = () => {
    startNewScan();
    navigate('/scan');
  };
  return (
    <section className="ln-section alt" id="modes">
      <div className="ln-wrap">
        <div className="ln-modes-head">
          <div>
            <span className="ln-eyebrow">THREE WAYS TO SCAN</span>
            <h2 className="ln-h2">
              More ways to test your <span className="hl">aura</span>
            </h2>
          </div>
        </div>
        <div className="ln-modes">
          {SCAN_MODES.map((m) => {
            const locked = m.status === 'locked';
            const ModeIcon = Icon[m.icon];
            return (
              <article className={'ln-mode' + (locked ? ' locked' : '')} key={m.id}>
                <div className="lm-preview">
                  <ModePreview id={m.id} />
                  {locked && (
                    <span className="lm-lock">
                      <Icon.lock /> LOCKED
                    </span>
                  )}
                </div>
                <div className="lm-body">
                  <div className="lm-row">
                    <span className="lm-ic">
                      <ModeIcon />
                    </span>
                    <span className={'lm-status ' + (locked ? 'soon' : 'live')}>
                      {locked ? 'Coming soon' : 'Available now'}
                    </span>
                  </div>
                  <h3 className="lm-name">{m.name}</h3>
                  <p className="lm-blurb">{m.blurb}</p>
                  <div className="lm-chips">
                    {m.outputs.map((o) => (
                      <span className="lm-chip" key={o}>
                        {o}
                      </span>
                    ))}
                  </div>
                  {locked ? (
                    <button className="lm-cta locked" type="button" disabled>
                      <Icon.lock /> Coming soon
                    </button>
                  ) : m.id === 'friend' ? (
                    <button className="lm-cta" type="button" onClick={() => navigate('/versus')}>
                      Start a battle
                    </button>
                  ) : (
                    <button className="lm-cta" type="button" onClick={startSolo}>
                      Start a Solo Scan
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Section list the rail tracks; ordered by page position. */
const RAIL = [
  { id: 'how', n: 1, label: 'How it works' },
  { id: 'outputs', n: 2, label: 'The cards' },
  { id: 'modes', n: 3, label: 'Scan modes' },
  { id: 'credits', n: 4, label: 'Credits' },
];

/** Fixed left scroll-spy rail (desktop ≥1320px; hidden below via CSS). */
function SectionRail() {
  const [active, setActive] = useState('how');
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      // Thin center band so the active section is the one crossing mid-viewport.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    const els = RAIL.map((r) => document.getElementById(r.id)).filter(Boolean) as Element[];
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return (
    <nav className="ln-rail" aria-label="Section navigation">
      <ul>
        {RAIL.map((r) => (
          <li key={r.id}>
            <a
              href={'#' + r.id}
              className={'ln-rail-dot' + (active === r.id ? ' active' : '')}
              aria-current={active === r.id ? 'true' : undefined}
            >
              <span className="n">{r.n}</span>
              <span className="lbl">{r.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FinalCTA() {
  return (
    <section className="ln-section ln-wrap">
      <div className="ln-final">
        <span className="ln-eyebrow" style={{ justifyContent: 'center', display: 'flex' }}>
          YOUR TURN
        </span>
        <h2>
          UPLOAD SCAN <span className="hl">GET POSTED</span>
        </h2>
        <p>
          One scan, one credit, cards your group chat won't let go of. First one's free.
        </p>
        <div className="ln-hero-actions">
          <Link className="ln-btn primary lg" to="/vault">
            Get your verdict
          </Link>
        </div>
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
              Face card, outfit check, and dating receipt, made for sharing. For entertainment only.
            </p>
          </div>
          <div className="ln-footer-cols">
            <div className="ln-footer-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#outputs">The cards</a>
              <a href="#modes">Scan modes</a>
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
      <Link className="ln-btn primary" to="/vault">
        Scan me
      </Link>
    </div>
  );
}

export function Landing() {
  // Smooth-scroll the in-page anchor jumps (section rail, hero, footer) instead
  // of teleporting. Scoped to the landing via the <html> scroll-behavior while
  // this page is mounted; skipped when the user prefers reduced motion.
  useEffect(() => {
    const prefersReduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reduceMotion === 'true';
    if (prefersReduced) return;
    const root = document.documentElement;
    root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = '';
    };
  }, []);

  return (
    <div className="ln">
      <Nav />
      <SectionRail />
      <Hero />
      <hr className="ln-hr ln-wrap" />
      <How />
      <Artifacts />
      <Modes />
      <Credits />
      <Privacy />
      <FinalCTA />
      <Footer />
      <MobileBar />
    </div>
  );
}
