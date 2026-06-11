// landing.jsx — FITAURA marketing landing page.
// Reuses FaceCard / OutfitCard / Receipt + FITAURA_DATA from cards.jsx (window).
const { useState, useEffect, useRef, useCallback } = React;

const VERDICT_COLOR = { red_flag: "var(--red)", normie: "var(--cyan)", green_flag: "var(--lime)" };

/* headline options — the required promise is the default (index 0) */
const HEADLINES = [
  { h: ["UPLOAD YOUR FACE AND OUTFIT.", "GET YOUR FULL", "VERDICT."],
    sub: "Two photos in. A Face Card, an Outfit Check and a Dating Receipt out — built to post." },
  { h: ["YOUR FACE.", "YOUR FIT.", "YOUR VERDICT."],
    sub: "Drop a selfie and your fit. Get three shareable verdicts your group chat will fight over." },
  { h: ["ONE SCAN.", "THREE VERDICTS.", "ZERO MERCY."],
    sub: "Green flag, normie, or red flag with good angles? Upload and find out in seconds." },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#54e6f0",
  "headline": 0,
  "heroVerdict": "red_flag"
}/*EDITMODE-END*/;

/* tiny in-view hook to fire card stat animations on scroll */
function useInView(opts = { threshold: 0.25 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, opts);
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

/* ---- small inline icons ---- */
const Ico = {
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  scan: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2M3 12h18" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  receipt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3v18l2-1.4L10 21l2-1.4L14 21l2-1.4L18 21V3l-2 1.4L14 3l-2 1.4L10 3 8 4.4 6 3zM9 8h6M9 12h6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6l8-3z" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" /></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>,
};

/* ============================ NAV ============================ */
function Nav({ onCta }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    h(); window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav className={"ln-nav" + (scrolled ? " scrolled" : "")}>
      <div className="ln-brand"><span className="dot" /><span className="wm">FITAURA</span></div>
      <div className="ln-nav-links">
        <a href="#how">How it works</a>
        <a href="#outputs">The verdict</a>
        <a href="#examples">Examples</a>
        <a href="#credits">Credits</a>
      </div>
      <div className="ln-nav-cta">
        <a className="ln-btn primary" href="#top" onClick={onCta}>Get your verdict</a>
        <button className="ln-burger" aria-label="Menu">{Ico.menu}</button>
      </div>
    </nav>
  );
}

/* ============================ HERO ============================ */
function Hero({ data, headline }) {
  const hl = HEADLINES[headline] || HEADLINES[0];
  return (
    <header className="ln-hero ln-wrap" id="top">
      <div className="ln-hero-grid">
        <div className="ln-hero-copy">
          <span className="ln-eyebrow">FACE · OUTFIT · DATING RECEIPT</span>
          <h1>
            {hl.h[0]} {hl.h[1]} <span className="hl">{hl.h[2]}</span>
          </h1>
          <p className="ln-hero-sub">{hl.sub}</p>
          <div className="ln-hero-actions">
            <a className="ln-btn primary lg" href="#top">Scan me — it's free {Ico.arrow}</a>
            <a className="ln-btn lg ghost" href="#examples">See examples</a>
          </div>
          <div className="ln-hero-trust">
            <span className="free-pill"><span className="pdot" />First verdict free</span>
            <span className="t">{Ico.lock} Photos never stored on our servers</span>
          </div>
        </div>

        <div className="ln-fan">
          <div className="ln-fan-stage">
            <div className="ln-fan-card left">
              <OutfitCard data={data} sticker={data.outfit.sticker} stickerOn={true} run={true} slotId="fitaura-outfit" />
            </div>
            <div className="ln-fan-card right">
              <Receipt data={data} style="neon" sealOn={true} run={true} />
            </div>
            <div className="ln-fan-card mid">
              <FaceCard data={data} sticker={data.face.sticker} stickerOn={true} run={true} slotId="fitaura-face" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================ THREE-OUTPUT PREVIEW ============================ */
function Artifacts({ data }) {
  const [ref, seen] = useInView();
  const arts = [
    { n: "01", name: "Face Card", desc: "Your selfie, an aura read and one verdict you'll want to repost." },
    { n: "02", name: "Outfit Check", desc: "How the fit actually lands on your build — silhouette, proportions, score." },
    { n: "03", name: "Dating Receipt", desc: "The final cheque. One verdict: green flag, normie, or red flag." },
  ];
  return (
    <section className="ln-section ln-wrap" id="outputs" ref={ref}>
      <div className="ln-artifacts-head">
        <div>
          <span className="ln-eyebrow">ONE SCAN, THREE ARTIFACTS</span>
          <h2 className="ln-h2">Distinct cards.<br /><span className="hl">One verdict.</span></h2>
        </div>
        <div className="ln-bundle-note">{Ico.bolt}<span>Every scan returns <b>all three</b> — not one card at a time.</span></div>
      </div>
      <div className="ln-arts">
        <div className="ln-art">
          <div className="ln-art-stage"><FaceCard data={data} sticker={data.face.sticker} stickerOn={true} run={seen} slotId="land-art-face" /></div>
          <div className="ln-art-num">{arts[0].n}</div>
          <div className="ln-art-name">{arts[0].name}</div>
          <p className="ln-art-desc">{arts[0].desc}</p>
        </div>
        <div className="ln-art">
          <div className="ln-art-stage"><OutfitCard data={data} sticker={data.outfit.sticker} stickerOn={true} run={seen} slotId="land-art-outfit" /></div>
          <div className="ln-art-num">{arts[1].n}</div>
          <div className="ln-art-name">{arts[1].name}</div>
          <p className="ln-art-desc">{arts[1].desc}</p>
        </div>
        <div className="ln-art">
          <div className="ln-art-stage"><Receipt data={data} style="neon" sealOn={true} run={seen} /></div>
          <div className="ln-art-num">{arts[2].n}</div>
          <div className="ln-art-name">{arts[2].name}</div>
          <p className="ln-art-desc">{arts[2].desc}</p>
        </div>
      </div>
    </section>
  );
}

/* ============================ HOW IT WORKS ============================ */
function How() {
  const steps = [
    { n: "STEP 01", ic: Ico.upload, h: "Upload two photos", p: "A selfie and a full outfit shot. Crop and reframe until it's right." },
    { n: "STEP 02", ic: Ico.scan, h: "Run the scan", p: "We read your face, aura and fit — then cross-reference the two." },
    { n: "STEP 03", ic: Ico.receipt, h: "Get the verdict", p: "Three finished cards land at once, ready to screenshot and post." },
  ];
  return (
    <section className="ln-section alt" id="how">
      <div className="ln-wrap">
        <span className="ln-eyebrow">HOW IT WORKS</span>
        <h2 className="ln-h2">From two photos to <span className="hl">posted</span> in under a minute.</h2>
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

/* ============================ BUNDLE: one generation = all three ============================ */
function Bundle() {
  const items = [
    { t: "Face Card", s: "shareable" },
    { t: "Face analysis breakdown", s: "in-app" },
    { t: "Outfit Check Card", s: "shareable" },
    { t: "Outfit fit breakdown", s: "in-app" },
    { t: "Dating Score Receipt", s: "shareable" },
  ];
  return (
    <section className="ln-section ln-wrap">
      <div className="ln-bundle-grid">
        <div>
          <span className="ln-eyebrow">ONE CREDIT, THE WHOLE VERDICT</span>
          <h2 className="ln-h2">A single scan<br />unlocks <span className="hl">everything.</span></h2>
          <ul className="ln-bundle-list">
            {items.map((it) => (
              <li key={it.t}>
                <span className="ck">{Ico.check}</span>
                {it.t}
                <span className="sub">{it.s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ln-credit-box">
          <span className="ln-eyebrow">WHAT ONE CREDIT BUYS</span>
          <div className="one" style={{ marginTop: "16px" }}>1 SCAN =<br /><span className="hl">3 CARDS</span></div>
          <p className="one-sub">No piecemeal unlocks, no upsell mid-result. One credit runs the complete face, outfit and dating verdict in a single pass.</p>
          <div className="ln-hero-actions" style={{ marginTop: "26px" }}>
            <a className="ln-btn primary" href="#top">Run your first scan free {Ico.arrow}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ CREDITS / PRICING ============================ */
function Credits() {
  const packs = [
    { tier: "Starter", c: 5, price: "$4.99", per: "$1.00 / scan" },
    { tier: "Regular", c: 15, price: "$11.99", per: "$0.80 / scan", feature: true, badge: "Most picked" },
    { tier: "Group chat", c: 40, price: "$29.99", per: "$0.75 / scan" },
  ];
  return (
    <section className="ln-section alt" id="credits">
      <div className="ln-wrap">
        <div className="ln-artifacts-head">
          <div>
            <span className="ln-eyebrow">CREDITS, NOT SUBSCRIPTIONS</span>
            <h2 className="ln-h2">First scan's <span className="hl">on us.</span></h2>
            <p className="ln-lead">Your first complete verdict is free. After that, top up with credits whenever you want another — friends, exes, celebrities, fair game.</p>
          </div>
          <span className="free-pill" style={{ alignSelf: "center" }}><span className="pdot" />1 credit = 1 full verdict</span>
        </div>
        <div className="ln-packs">
          {packs.map((p) => (
            <div className={"ln-pack" + (p.feature ? " feature" : "")} key={p.tier}>
              {p.badge && <span className="ln-pack-badge">{p.badge}</span>}
              <div className="tier">{p.tier}</div>
              <div className="credits">{p.c}<span>credits</span></div>
              <div className="price">{p.price}</div>
              <div className="per">{p.per}</div>
            </div>
          ))}
        </div>
        <p className="ln-packs-foot">Credits never expire. One credit always returns the full three-card verdict.</p>
      </div>
    </section>
  );
}

/* ============================ PRIVACY ============================ */
function Privacy() {
  return (
    <section className="ln-section ln-wrap" id="privacy">
      <span className="ln-eyebrow" style={{ display: "flex", justifyContent: "center" }}>BUILT TO BE SHARED, NOT STORED</span>
      <h2 className="ln-h2" style={{ textAlign: "center" }}>Your photos stay <span className="hl">yours.</span></h2>
      <div className="ln-privacy-card">
        <div className="ic">{Ico.shield}</div>
        <div>
          <h3>We don't keep your source photos.</h3>
          <p>Your face and outfit photos are used to build your verdict and are <b style={{ color: "var(--ink)" }}>not permanently stored on our servers</b>. Finished cards, receipts and history live on your own device — so the moment you close the tab, the originals are gone from us.</p>
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

/* ============================ EXAMPLES ============================ */
function Examples() {
  const [ref, seen] = useInView();
  const order = [
    { key: "green_flag", line: "When the fit and the face both cooperate." },
    { key: "normie", line: "Clean, harmless, quietly buffering." },
    { key: "red_flag", line: "High aura, questionable everything else." },
  ];
  return (
    <section className="ln-section alt" id="examples" ref={ref}>
      <div className="ln-wrap">
        <span className="ln-eyebrow">SAMPLE RECEIPTS</span>
        <h2 className="ln-h2">Three outcomes. <span className="hl">One of them is you.</span></h2>
        <div className="ln-examples-row">
          {order.map((o) => {
            const d = FITAURA_DATA[o.key];
            return (
              <div className="ln-example" key={o.key}>
                <div className="ln-example-stage" style={{ "--verdict": VERDICT_COLOR[o.key] }}>
                  <Receipt data={d} style="neon" sealOn={true} run={seen} />
                </div>
                <div className="ln-example-cap">
                  <div className="vd" style={{ color: VERDICT_COLOR[o.key] }}>{d.receipt.verdict}</div>
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

/* ============================ FINAL CTA ============================ */
function FinalCTA() {
  return (
    <section className="ln-final ln-wrap">
      <span className="ln-eyebrow" style={{ justifyContent: "center", display: "flex" }}>YOUR TURN</span>
      <h2>UPLOAD. SCAN. <span className="hl">GET POSTED.</span></h2>
      <p>Two photos, one credit, three cards your group chat will not let go of. The first one's free.</p>
      <div className="ln-hero-actions">
        <a className="ln-btn primary lg" href="#top">Get your verdict {Ico.arrow}</a>
      </div>
    </section>
  );
}

/* ============================ FOOTER ============================ */
function Footer() {
  return (
    <footer className="ln-footer">
      <div className="ln-wrap">
        <div className="ln-footer-top">
          <div className="ln-footer-brand">
            <div className="ln-brand"><span className="dot" /><span className="wm">FITAURA</span></div>
            <p>Face card, outfit check and dating receipt — made for social sharing. For entertainment only.</p>
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
          <span className="disc">FITAURA is a playful, subjective entertainment product. Scores and verdicts are not a measure of real attractiveness, health or worth.</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================ MOBILE STICKY BAR ============================ */
function MobileBar() {
  return (
    <div className="ln-mobilebar">
      <div className="mb-meta">
        <div className="l1">Get your full verdict</div>
        <div className="l2">First scan free · 1 credit = 3 cards</div>
      </div>
      <a className="ln-btn primary" href="#top">Scan me {Ico.arrow}</a>
    </div>
  );
}

/* ============================ APP ============================ */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const data = FITAURA_DATA[t.heroVerdict] || FITAURA_DATA.red_flag;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--verdict", VERDICT_COLOR[t.heroVerdict] || "var(--red)");
  }, [t.accent, t.heroVerdict]);

  return (
    <div className="ln">
      <Nav />
      <Hero data={data} headline={t.headline} />
      <hr className="ln-hr ln-wrap" />
      <Artifacts data={data} />
      <How />
      <Bundle />
      <Credits />
      <Privacy />
      <Examples />
      <FinalCTA />
      <Footer />
      <MobileBar />

      <TweaksPanel>
        <TweakSection label="Hero headline" />
        <TweakRadio label="Variant" value={t.headline}
          options={[{ label: "Promise", value: 0 }, { label: "Triplet", value: 1 }, { label: "Punch", value: 2 }]}
          onChange={(v) => setTweak("headline", v)} />
        <TweakSection label="Featured verdict" />
        <TweakRadio label="Hero set" value={t.heroVerdict}
          options={[{ label: "Green", value: "green_flag" }, { label: "Normie", value: "normie" }, { label: "Red", value: "red_flag" }]}
          onChange={(v) => setTweak("heroVerdict", v)} />
        <TweakSection label="Brand accent" />
        <TweakColor label="Accent" value={t.accent}
          options={["#54e6f0", "#83b4ff", "#b6ff3c", "#ff52a6"]}
          onChange={(v) => setTweak("accent", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
