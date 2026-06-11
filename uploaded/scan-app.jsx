// scan-app.jsx — FITAURA scanner / analyzing experience.
// The bridge between "uploads confirmed" and the result cards.
// Renders inside the desktop + mobile device frames (scanner.jsx).
// Phases: ready (confirmed) -> scanning (5 finite stages) -> done | error.
// Honors reduced-motion + slow-network as first-class variants.
// Exports ScanApp + sample generators to window.

const { useState, useRef, useEffect, useMemo, useCallback } = React;

/* ---------------- icons (match system vocabulary) ---------------- */
const ICN = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round"/></svg>,
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5" strokeLinecap="round"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v5M12 17h.01M10.3 3.9 2.4 18a1.9 1.9 0 001.7 2.9h15.8a1.9 1.9 0 001.7-2.9L13.7 3.9a1.9 1.9 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  retry: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 3v4h4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  wifi: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M2 9a15 15 0 0120 0" strokeLinecap="round"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" strokeLinejoin="round"/></svg>,
  motion: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ---------------- the 5 finite stages ---------------- */
// boundary = cumulative % where the stage ENDS.
const STAGES = [
  { key:"prep",    code:"01", rail:"Prepping photos",  title:["Prepping your ","photos"],   boundary:12, cap:"PREP · INGESTING PHOTOS",
    micro:["Wiping down the lens…","Loading you in…","Adjusting the lights…","Cracking knuckles…"] },
  { key:"face",    code:"02", rail:"Reading the face", title:["Reading your ","face"],       boundary:40, cap:"SCAN · FACE GEOMETRY",
    micro:["Finding the jawline…","Checking the angles…","Measuring main-character energy…","Locating the gaze…","Counting cheekbones…"] },
  { key:"fit",     code:"03", rail:"Sizing the fit",   title:["Sizing up the ","fit"],       boundary:68, cap:"SCAN · OUTFIT PROPORTIONS",
    micro:["Tracing the silhouette…","Checking proportions…","Rating the drip…","Editorial, or gym-bro?…","Inspecting the fit…"] },
  { key:"aura",    code:"04", rail:"Calculating aura", title:["Calculating your ","aura"],   boundary:88, cap:"COMPUTE · AURA FIELD",
    micro:["Bottling the aura…","Tallying good-angle points…","Cross-checking the vibe…","Consulting the group chat…"] },
  { key:"verdict", code:"05", rail:"Printing verdict", title:["Printing your ","verdict"],   boundary:100, cap:"PRINT · DATING VERDICT",
    micro:["Warming up the receipt printer…","Stamping the verdict…","Doing the math on your love life…","Tearing the receipt…"] },
];
const stageAt = (p) => { for (let i=0;i<STAGES.length;i++) if (p < STAGES[i].boundary || i===STAGES.length-1) return i; return 0; };

/* HUD callout chips per stage (playful, not clinical) */
const MARKERS = [
  { st:"prep",    cls:"h-tr", label:"Photos loaded", ok:true },
  { st:"face",    cls:"h-l",  label:"Gaze · found" },
  { st:"face",    cls:"h-tr", label:"Jawline", ok:true },
  { st:"face",    cls:"h-r",  label:"Symmetry" },
  { st:"fit",     cls:"h-r",  label:"Silhouette" },
  { st:"fit",     cls:"h-br", label:"Proportions" },
  { st:"fit",     cls:"h-bl", label:"Drip · reading" },
  { st:"aura",    cls:"h-r",  label:"Aura field" },
  { st:"aura",    cls:"h-bl", label:"Good angles +" },
  { st:"verdict", cls:"h-br", label:"Receipt · printing" },
  { st:"verdict", cls:"h-tr", label:"Stamping" },
];

/* receipt the verdict prints onto */
const RECEIPT = [
  ["Dating Score", "6.7 / 10", false],
  ["Aura Gained", "+240", false],
  ["Ghosting Risk", "HIGH", false],
  ["Lover-Boy Prob.", "31%", false],
];

/* ---------------- placeholder photo generator (striped, clearly a sample) ---------------- */
function makeScanSample(kind) {
  const W = 900, H = kind === "face" ? 900 : 1200;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1a2230"); grad.addColorStop(.5, "#222a39"); grad.addColorStop(1, "#10141d");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .05; g.strokeStyle = "#fff"; g.lineWidth = 2;
  for (let i = -H; i < W; i += 26) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  g.restore();
  const cx = W * .5, cy = kind === "face" ? H * .46 : H * .42, r = kind === "face" ? W * .28 : W * .24;
  const rg = g.createRadialGradient(cx, cy, 8, cx, cy, r * 1.8);
  rg.addColorStop(0, "rgba(131,180,255,.5)"); rg.addColorStop(1, "rgba(131,180,255,0)");
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r * 1.8, 0, 7); g.fill();
  g.fillStyle = "rgba(255,255,255,.55)"; g.textAlign = "center"; g.font = "600 30px 'Space Mono',monospace";
  g.fillText(kind === "face" ? "SAMPLE · SELFIE" : "SAMPLE · OUTFIT", W / 2, H - 52);
  g.font = "400 21px 'Space Mono',monospace"; g.fillStyle = "rgba(255,255,255,.3)";
  g.fillText("drop your real photo to scan it", W / 2, H - 22);
  return c.toDataURL("image/webp", .82);
}

/* ============================ SPECIMEN ============================ */
function Specimen({ stageKey, faceSrc, outfitSrc, frozen }) {
  return (
    <div className={"specimen" + (frozen ? "" : " ignite")}>
      <div className="spec-aura" />
      <div className="spec-frame">
        <image-slot id="fitaura-outfit" shape="rect" fit="cover" src={outfitSrc} placeholder="drop outfit photo"></image-slot>
        <div className="scrim" />
        <div className="spec-ov">
          <div className="spec-grid-ov" />
          <div className="spec-band" />
          <div className="spec-scanline" />
        </div>
        <div className="spec-corners"><span className="tl" /><span className="tr" /><span className="bl" /><span className="br" /></div>
        <div className="spec-cap"><span className="blip" /><span className="txt">{(STAGES.find(s => s.key === stageKey) || STAGES[0]).cap}</span></div>
      </div>

      {/* face medallion inset */}
      <div className="spec-face">
        <div className="ring" />
        <image-slot id="fitaura-face" shape="circle" src={faceSrc} placeholder="drop face photo"></image-slot>
        <span className="tick t1" /><span className="tick t2" />
      </div>

      {/* HUD chips */}
      {MARKERS.map((m, i) => (
        <span key={i} className={"hud " + m.cls} data-on={m.st === stageKey}>
          <span className="hd" />{m.label}{m.ok ? <span className="ok">✓</span> : null}
        </span>
      ))}
    </div>
  );
}

/* ============================ STAGE RAIL ============================ */
function Rail({ idx, mobile }) {
  return (
    <div className="rail">
      {STAGES.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <div className="rail-step" key={s.key} data-state={state}>
            <span className="rail-node">{state === "done" ? ICN.check : <span className="num">{s.code}</span>}</span>
            <span className="rail-label">{s.rail}</span>
            <span className="rail-code">{state === "active" ? "scanning" : state === "done" ? "done" : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ MINI RECEIPT (prints on done) ============================ */
function ScanReceipt({ lines, stamp }) {
  return (
    <div className="scan-receipt">
      <div className="r-logo">FITAURA</div>
      <div className="r-sub">DATING VERDICT · NOT SCIENCE</div>
      <hr className="r-hr" />
      {RECEIPT.map((r, i) => (
        <div className={"r-row" + (i < lines ? " in" : "")} key={i}>
          <span className="k">{r[0]}</span><span className={"v" + (i === 0 ? " hi" : "")}>{r[1]}</span>
        </div>
      ))}
      <div className={"r-stamp" + (stamp ? " in" : "")}>RED FLAG</div>
    </div>
  );
}

/* ============================ THE SCAN APP ============================ */
function ScanApp({ mobile, motion, network, outcome, initialPhase = "ready", autoRun = true, runToken, faceSrc, outfitSrc }) {
  const rm = motion === "reduced";
  const slow = network === "slow";

  const [phase, setPhase] = useState(initialPhase);    // ready | scanning | done | error
  const [progress, setProgress] = useState(initialPhase === "done" ? 100 : initialPhase === "error" ? 78 : 0);
  const [microIdx, setMicroIdx] = useState(0);
  const [queued, setQueued] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [rLines, setRLines] = useState(initialPhase === "done" ? RECEIPT.length : 0);
  const [rStamp, setRStamp] = useState(initialPhase === "done");

  const rafRef = useRef(0);
  const startRef = useRef(null);
  const lastRef = useRef(0);
  const pauseRef = useRef(false);
  pauseRef.current = confirmLeave;

  const idx = stageAt(progress);
  const stage = STAGES[idx];

  const stop = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = 0; };

  const start = useCallback(() => {
    stop();
    setPhase("scanning"); setProgress(0); setMicroIdx(0);
    setRLines(0); setRStamp(false);
    setQueued(slow);
    startRef.current = null;
    const dur = slow ? 15500 : 9000;
    const queue = slow ? 1700 : 220;
    const errAt = 78;
    const frame = (t) => {
      if (startRef.current == null) { startRef.current = t; lastRef.current = t; }
      const dt = t - lastRef.current; lastRef.current = t;
      if (pauseRef.current) { startRef.current += dt; rafRef.current = requestAnimationFrame(frame); return; }
      const elapsed = t - startRef.current;
      let p;
      if (elapsed < queue) { p = 0; }
      else { p = Math.min(100, ((elapsed - queue) / dur) * 100); if (slow) p = Math.min(100, Math.floor(p / 2.4) * 2.4); }
      setQueued(slow && elapsed < queue);
      if (outcome === "error" && p >= errAt) { setProgress(errAt); setPhase("error"); stop(); return; }
      if (p >= 100) { setProgress(100); setPhase("done"); stop(); return; }
      setProgress(p);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [slow, outcome]);

  // mount / runToken change: set up the requested phase
  useEffect(() => {
    stop();
    setConfirmLeave(false);
    if (initialPhase === "scanning") { start(); }
    else if (initialPhase === "done") { setPhase("done"); setProgress(100); }
    else if (initialPhase === "error") { setPhase("error"); setProgress(78); }
    else {
      setPhase("ready"); setProgress(0);
      if (autoRun) { const id = setTimeout(start, 1250); return () => { clearTimeout(id); stop(); }; }
    }
    return stop;
    // eslint-disable-next-line
  }, [runToken]);

  // microcopy rotation
  useEffect(() => {
    if (phase !== "scanning" || confirmLeave) return;
    const id = setInterval(() => setMicroIdx((n) => n + 1), slow ? 2300 : 1750);
    return () => clearInterval(id);
  }, [phase, confirmLeave, slow]);

  // receipt printing on done
  useEffect(() => {
    if (phase !== "done") return;
    if (rm) { setRLines(RECEIPT.length); setRStamp(true); return; }
    setRLines(0); setRStamp(false);
    const ids = [];
    RECEIPT.forEach((_, i) => ids.push(setTimeout(() => setRLines(i + 1), 260 + i * 240)));
    ids.push(setTimeout(() => setRStamp(true), 260 + RECEIPT.length * 240 + 220));
    return () => ids.forEach(clearTimeout);
  }, [phase, rm]);

  const micro = stage.micro[microIdx % stage.micro.length];
  const dataStage = phase === "done" ? "verdict" : phase === "error" ? "aura" : stage.key;

  function reallyLeave() { setConfirmLeave(false); stop(); setPhase("ready"); setProgress(0); }

  /* ---------- render branches ---------- */
  return (
    <div className={"sa" + (rm ? " rm" : "")} data-mobile={mobile ? "true" : "false"} data-stage={dataStage} data-phase={phase}>
      {/* header */}
      <div className="sa-head">
        <div className="brand"><span className="dot" /><span className="wm">Fitaura</span></div>
        <div className="right">
          {phase === "scanning" && (
            <span className="live-chip"><span className="d" />{queued ? "Queued" : slow ? "Slow link" : "Scanning"}</span>
          )}
          {phase === "scanning" && (
            <button className="leave-btn" onClick={() => setConfirmLeave(true)} aria-label="Leave scan">{ICN.x}</button>
          )}
        </div>
      </div>

      {/* READY — bridge from confirmed uploads */}
      {phase === "ready" && (
        <div className="confirmed">
          <div className="thumbs">
            <div className="cf-thumb face">
              <image-slot id="fitaura-face" shape="circle" src={faceSrc} placeholder="face"></image-slot>
              <span className="badge">{ICN.check}</span>
            </div>
            <span className="cf-link">+</span>
            <div className="cf-thumb outfit">
              <image-slot id="fitaura-outfit" shape="rect" fit="cover" src={outfitSrc} placeholder="outfit"></image-slot>
              <span className="badge">{ICN.check}</span>
            </div>
          </div>
          <span className="eyebrow">Uploads confirmed · 2 / 2</span>
          <h2>You're locked <span className="hl">in.</span></h2>
          <p className="sub">Both photos are checked and framed. Sit tight — the scan takes about 20 seconds.</p>
          <button className="go" onClick={start}>{ICN.bolt} Scan my aura — free</button>
          <div className="meta"><span className="free">First scan free</span><span>·</span><span>~20 sec</span></div>
        </div>
      )}

      {/* SCANNING */}
      {phase === "scanning" && (
        <div className="sa-stage">
          <Specimen stageKey={stage.key} faceSrc={faceSrc} outfitSrc={outfitSrc} />
          <div className="readout">
            <div className="ro-stage">
              <span className="ro-code">{stage.code} · {stage.key.toUpperCase()}</span>
              <span className="ro-of">Stage {idx + 1} of 5</span>
            </div>
            <h2 className="ro-title">{stage.title[0]}<span className="hl">{stage.title[1]}</span></h2>
            <div className="ro-tick"><span className="car">›</span><span className="txt" key={micro}>{queued ? "Waiting for the server…" : micro}</span></div>

            <div className="ro-prog">
              <div className="ro-pct"><span className="n">{Math.round(progress)}</span><span className="p">%</span></div>
              <div className="ro-bar"><div className="fill" style={{ width: progress + "%" }} /></div>
            </div>

            <Rail idx={idx} mobile={mobile} />

            {slow && progress > 30 && progress < 96 && !queued && (
              <div className="ro-net">{ICN.wifi}<span><b>Still working.</b> Your connection's slow — big aura takes a sec. We'll keep going.</span></div>
            )}

            <button className="ro-leave" onClick={() => setConfirmLeave(true)}>{ICN.x} Leave scan</button>

            <div className="rm-note">{ICN.motion} Reduced-motion · stepped progress, no sweep</div>
            <div className="ro-foot">{ICN.shield} Processed for this scan only · for the bit, not science</div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {phase === "error" && (
        <div className="sa-stage">
          <Specimen stageKey="aura" faceSrc={faceSrc} outfitSrc={outfitSrc} frozen />
          <div className="readout">
            <div className="scan-error" style={{ padding: 0, alignItems: mobile ? "center" : "flex-start", textAlign: mobile ? "center" : "left" }}>
              <span className="ic">{ICN.alert}</span>
              <h2>Scan stalled</h2>
              <p className="sub" style={{ marginInline: mobile ? "auto" : 0 }}>We lost the connection mid-aura. Nothing's lost — your photos are still framed and ready to go again.</p>
              <div className="actions" style={{ justifyContent: mobile ? "center" : "flex-start" }}>
                <button className="btn primary" onClick={start}>{ICN.retry} Try the scan again</button>
                <button className="btn" onClick={() => { stop(); setPhase("ready"); setProgress(0); }}>{ICN.back} Back to photos</button>
              </div>
              <div className="reason">Error · aura_stream_timeout · stage 04</div>
            </div>
          </div>
        </div>
      )}

      {/* DONE — verdict printed, hand off to results */}
      {phase === "done" && (
        <div className="reveal">
          <span className="stamp">✶ Verdict printed ✶</span>
          <h2>Your verdict is <span className="hl">in.</span></h2>
          <p className="sub">Three cards and one dating receipt — fresh off the press.</p>
          <ScanReceipt lines={rLines} stamp={rStamp} />
          <a className="go" href="Fitaura Result Cards.html">Reveal my verdict {ICN.arrow}</a>
        </div>
      )}

      {/* LEAVE CONFIRM */}
      {confirmLeave && (
        <div className="leave-ov">
          <div className="leave-card">
            <h3>Leave the scan?</h3>
            <p>Your photos stay framed and ready. You can run the scan again whenever you want — the first one's still free.</p>
            <div className="row">
              <button className="b stay" onClick={() => setConfirmLeave(false)}>Keep scanning</button>
              <button className="b go" onClick={reallyLeave}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ScanApp, makeScanSample });
