// scanner.jsx — FITAURA scanner review shell.
// Review toolbar (device · motion · network · outcome · phase jump · replay)
// mounts ScanApp (window) inside the desktop + mobile device frames, then a
// short spec strip documenting the states. Frames/toolbar styles come from
// upload.css; ScanApp + samples come from scan-app.jsx.

const { useState, useMemo, useRef } = React;

const GL = {
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>,
  replay: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 3v4h4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ---------------- device frames (chrome from upload.css) ---------------- */
function DesktopFrame(props) {
  return (
    <div className="frame-desktop">
      <div className="fd-bar">
        <div className="fd-lights"><i /><i /><i /></div>
        <div className="fd-url">{GL.globe} fitaura.app/scan</div>
        <div className="fd-spacer" />
      </div>
      <div className="fd-body"><ScanApp {...props} mobile={false} /></div>
    </div>
  );
}
function MobileFrame(props) {
  return (
    <div className="frame-mobile">
      <div className="fm-screen">
        <div className="fm-notch" />
        <div className="fm-status">
          <span>9:41</span>
          <span className="dots"><i /><i /><i /></span>
        </div>
        <div className="fm-scroll" style={{ display: "flex", flexDirection: "column" }}>
          <ScanApp {...props} mobile={true} />
        </div>
      </div>
    </div>
  );
}

/* ============================ ROOT ============================ */
function Root() {
  const prefersReduced = useMemo(
    () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const [device, setDevice] = useState("both");          // both | desktop | mobile
  const [motion, setMotion] = useState(prefersReduced ? "reduced" : "full");
  const [network, setNetwork] = useState("normal");      // normal | slow
  const [outcome, setOutcome] = useState("success");     // success | error
  const [jump, setJump] = useState("ready");             // ready | scanning | done | error
  const [autoRun, setAutoRun] = useState(true);
  const [seed, setSeed] = useState(0);

  // any control change restarts the run with the new params
  const ctl = (fn) => (v) => { fn(v); setSeed((s) => s + 1); };
  const setJumpC = (v) => { setJump(v); setAutoRun(false); setSeed((s) => s + 1); };
  const replay = () => { setJump("ready"); setAutoRun(true); setSeed((s) => s + 1); };

  // sample placeholders (real drops via image-slot override these)
  const faceSrc = useMemo(() => makeScanSample("face"), []);
  const outfitSrc = useMemo(() => makeScanSample("outfit"), []);

  const focus = device === "both" ? "both" : device;
  const appProps = { motion, network, outcome, initialPhase: jump, autoRun, runToken: seed, faceSrc, outfitSrc };
  const key = `${jump}_${motion}_${network}_${outcome}_${seed}`;

  const Seg = ({ label, value, set, opts }) => (
    <div className="rev-group">
      <span className="lbl">{label}</span>
      <div className="seg">
        {opts.map(([v, t]) => <button key={v} aria-pressed={value === v} onClick={() => set(v)}>{t}</button>)}
      </div>
    </div>
  );

  return (
    <div className="up">
      {/* review toolbar */}
      <div className="rev">
        <div className="rev-in">
          <div className="rev-brand">
            <span className="dot" /><span className="wm">Fitaura</span>
            <span className="tag">Scanner · Spec</span>
          </div>
          <Seg label="Device" value={device} set={setDevice} opts={[["both","Both"],["desktop","Desktop"],["mobile","Mobile"]]} />
          <Seg label="Motion" value={motion} set={ctl(setMotion)} opts={[["full","Full"],["reduced","Reduced"]]} />
          <Seg label="Network" value={network} set={ctl(setNetwork)} opts={[["normal","Normal"],["slow","Slow"]]} />
          <Seg label="Outcome" value={outcome} set={ctl(setOutcome)} opts={[["success","Success"],["error","Error"]]} />
          <Seg label="Phase" value={jump} set={setJumpC} opts={[["ready","Ready"],["scanning","Scan"],["done","Done"],["error","Error"]]} />
          <button className="ctrl primary" style={{ borderRadius: 10 }} onClick={replay}>{GL.replay} Replay</button>
        </div>
      </div>

      <div className="up-wrap">
        {/* hero */}
        <header className="stage-head">
          <span className="eyebrow">Analyzing · the in-between</span>
          <h1>The scan that turns<br />two photos into a <span className="hl">verdict.</span></h1>
          <p className="lead">The premium, entertaining beat between confirming your uploads and revealing your cards. Five honest stages — prep, face, fit, aura, verdict — with live HUD readouts, rotating microcopy, and graceful paths for cancelling, errors, slow links, and reduced motion. Playful by design, never medical or scientific.</p>
          <div className="rec">{GL.check}<span><b>Sequence:</b> Prepping photos → Reading the face → Sizing the fit → Calculating aura → Printing the verdict. Determinate progress, a 5-step rail, and a verdict that literally prints.</span></div>
        </header>

        {/* device stage */}
        <div className="devices" data-focus={focus}>
          {(device === "both" || device === "desktop") && (
            <div className="frame-desktop-wrap">
              <DesktopFrame key={"d_" + key} {...appProps} />
              <div className="device-cap">Desktop · 860px</div>
            </div>
          )}
          {(device === "both" || device === "mobile") && (
            <div className="frame-mobile-wrap">
              <MobileFrame key={"m_" + key} {...appProps} />
              <div className="device-cap">Mobile · 390px</div>
            </div>
          )}
        </div>

        <SpecStrip />
      </div>
    </div>
  );
}

/* ---------------- spec strip: stage labels + behaviors ---------------- */
function SpecStrip() {
  const stages = [
    ["01", "Prepping photos", "Ingest + warm up", "icy"],
    ["02", "Reading the face", "Jaw, angles, gaze", "cyan"],
    ["03", "Sizing the fit", "Silhouette + drip", "lime"],
    ["04", "Calculating aura", "The headline number", "magenta"],
    ["05", "Printing verdict", "Receipt prints out", "gold"],
  ];
  const behaviors = [
    ["Transition in", "Starts from the confirmed-uploads state — both photos locked, then the specimen ignites into the scan."],
    ["Cancel / leave", "An always-present Leave control opens a soft confirm. Leaving returns to the framed photos; nothing is lost."],
    ["Retry / error", "On failure the HUD goes red, the frame flickers, and a specific, recoverable message offers Try again or Back to photos."],
    ["Reduced motion", "No sweep, spin, or pulses. A single static reading line, stepped progress, and an explicit ‘Stage 3 of 5’. Honors the OS setting too."],
    ["Slow network", "A short ‘queued / waiting for server’ hold, chunky stepped progress, and a calm ‘still working’ reassurance — never a dead spinner."],
    ["Tone guardrail", "Every number is for the bit. Microcopy stays playful; a persistent ‘not science’ line keeps it honest and non-medical."],
  ];
  return (
    <section className="spec">
      <span className="eyebrow">Specification</span>
      <h2 className="spec-h">Stages &amp; <span className="hl">state behaviors</span></h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginTop: 28 }} className="stage-legend">
        {stages.map(([n, t, d, c]) => (
          <div key={n} className="spec-card" style={{ padding: "18px 18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--" + c + ")", boxShadow: "0 0 12px var(--" + c + ")" }} />
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: "0.14em", color: "var(--" + c + ")" }}>{n}</span>
            </div>
            <div style={{ fontFamily: "'Hanken Grotesk'", fontWeight: 800, fontSize: 15, color: "#fff", marginTop: 12 }}>{t}</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--ink-faint)", marginTop: 6, textTransform: "uppercase" }}>{d}</div>
          </div>
        ))}
      </div>

      <div className="spec-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 18 }}>
        {behaviors.map(([t, d], i) => (
          <div className="spec-card" key={i} style={{ padding: "20px 22px" }}>
            <h3 style={{ marginBottom: 7 }}><span className="num">{String(i + 1).padStart(2, "0")}</span>{t}</h3>
            <p style={{ margin: 0, fontFamily: "'Hanken Grotesk'", fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-dim)" }}>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
