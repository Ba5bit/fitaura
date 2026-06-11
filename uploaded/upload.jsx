// upload.jsx — FITAURA combined upload page.
// One page, both photos, consistent on desktop + mobile. Review toolbar lets you
// flip device + user-state + scenario. Mounts UploadZone (window) inside device frames.
// Followed by a designer spec sheet: crop behavior, interaction notes, approval checklist.

const { useState, useRef, useEffect, useMemo } = React;

/* ---------------- review-toolbar scenarios ---------------- */
// Each scenario seeds the two zones with an initial condition.
const SCENARIOS = {
  normal:   { label: "Normal", face: null, outfit: null },
  ready:    { label: "Both ready", face: { srcKind: "good" }, outfit: { srcKind: "good" } },
  invalid:  { label: "Invalid file", face: { status: "error", errorType: "invalid" }, outfit: null },
  oversized:{ label: "Oversized", face: null, outfit: { status: "error", errorType: "oversized" } },
  poor:     { label: "Poor framing", face: { srcKind: "good" }, outfit: { srcKind: "poor", flag: "warn" } },
  missing:  { label: "Missing photo", face: { srcKind: "good" }, outfit: null, forceMissing: ["outfit"] },
};
const SCEN_ORDER = ["normal", "ready", "invalid", "oversized", "poor", "missing"];

const G = {
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5" strokeLinecap="round"/></svg>,
  coin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v5M12 17h.01M10.3 3.9 2.4 18a1.9 1.9 0 001.7 2.9h15.8a1.9 1.9 0 001.7-2.9L13.7 3.9a1.9 1.9 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  face: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="9" r="4"/><path d="M5.5 20a6.5 6.5 0 0113 0" strokeLinecap="round"/></svg>,
  hanger: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 7a2 2 0 112-2M12 7v2.5L3.5 15a1.5 1.5 0 00.9 2.7h15.2a1.5 1.5 0 00.9-2.7L12 9.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>,
};

/* ---------------- the upload app shell (used in both frames) ---------------- */
function UploadApp({ mobile, scenario, user }) {
  const sc = SCENARIOS[scenario];
  const [zones, setZones] = useState({ face: { ready: false, flag: "ok" }, outfit: { ready: false, flag: "ok" } });
  const [attempted, setAttempted] = useState(scenario === "missing");

  // reset readiness when scenario changes
  useEffect(() => {
    setZones({ face: { ready: false, flag: "ok" }, outfit: { ready: false, flag: "ok" } });
    setAttempted(scenario === "missing");
  }, [scenario, mobile]);

  const onZone = (k) => (st) => setZones((z) => ({ ...z, [k]: st }));

  const bothReady = zones.face.ready && zones.outfit.ready;
  const anyWarn = (zones.face.flag === "warn") || (zones.outfit.flag === "warn");
  const missingList = ["face", "outfit"].filter((k) => !zones[k].ready);
  const showMissingOn = attempted ? missingList : [];

  const isFree = user === "new";

  function onGenerate() {
    if (!bothReady) { setAttempted(true); return; }
    // demo only — flash CTA
  }

  return (
    <div className="ua" data-mobile={mobile ? "true" : "false"}>
      <div className="ua-pad">
        {/* header */}
        <div className="ua-head">
          <div className="brand"><span className="dot" /><span className="wm">Fitaura</span></div>
          {isFree
            ? <span className="status-chip free"><span className="d" />First scan free</span>
            : <span className="status-chip credits">{G.coin}<b>12</b>&nbsp;credits</span>}
        </div>

        {/* title */}
        <div className="ua-title">
          <span className="eyebrow">Upload · 2 photos</span>
          <h2>Drop your <span className="hl">face</span> &amp; <span className="hl">fit</span></h2>
          <p className="sub">Two photos, one scan. We read your face and outfit, then score the aura.</p>
        </div>

        {/* zones */}
        <div className="ua-zones">
          <UploadZone kind="face" mobile={mobile} initial={sc.face}
            missing={showMissingOn.indexOf("face") >= 0} onState={onZone("face")} />
          <UploadZone kind="outfit" mobile={mobile} initial={sc.outfit}
            missing={showMissingOn.indexOf("outfit") >= 0} onState={onZone("outfit")} />
        </div>

        {/* footer: review + validation + CTA */}
        <div className="ua-foot">
          <div className="review-row">
            <span className={"rchip " + (zones.face.ready ? (zones.face.flag === "warn" ? "warnchip" : "done") : (showMissingOn.indexOf("face") >= 0 ? "miss" : ""))}>
              {zones.face.ready ? (zones.face.flag === "warn" ? G.alert : G.check) : G.face} Face {zones.face.ready ? (zones.face.flag === "warn" ? "check framing" : "ready") : "needed"}
            </span>
            <span className={"rchip " + (zones.outfit.ready ? (zones.outfit.flag === "warn" ? "warnchip" : "done") : (showMissingOn.indexOf("outfit") >= 0 ? "miss" : ""))}>
              {zones.outfit.ready ? (zones.outfit.flag === "warn" ? G.alert : G.check) : G.hanger} Outfit {zones.outfit.ready ? (zones.outfit.flag === "warn" ? "check framing" : "ready") : "needed"}
            </span>
          </div>

          {attempted && missingList.length > 0 && (
            <div className="val-banner">{G.alert}
              <span className="vt"><b>Add {missingList.length === 2 ? "both photos" : "your " + (missingList[0] === "face" ? "face photo" : "outfit photo")}</b> to run your scan.</span></div>
          )}

          <div className="cta-block">
            <button className={"cta " + (bothReady ? "go" : "disabled")} onClick={onGenerate}>
              {G.bolt} {isFree ? "Scan my aura — free" : "Scan my aura"}
            </button>
            <div className="cta-meta">
              {isFree
                ? <span className="free">{G.spark} First generation is on us</span>
                : <span className="cost">{G.coin} Costs 1 credit · 11 left after</span>}
              <span>~20 sec</span>
            </div>
            {anyWarn && bothReady && (
              <div className="cta-hint block">Framing looks off on one photo — you can still scan, but results improve with the subject centered.</div>
            )}
            {!bothReady && !attempted && (
              <div className="cta-hint">Add both photos to unlock your scan.</div>
            )}
          </div>

          <div className="ua-trust">{G.shield} Photos are processed for your scan only · deleted after 24h</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- desktop + mobile frames ---------------- */
function DesktopFrame(props) {
  return (
    <div className="frame-desktop">
      <div className="fd-bar">
        <div className="fd-lights"><i /><i /><i /></div>
        <div className="fd-url">{G.globe} fitaura.app/scan</div>
        <div className="fd-spacer" />
      </div>
      <div className="fd-body"><UploadApp {...props} mobile={false} /></div>
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
        <div className="fm-scroll"><UploadApp {...props} mobile={true} /></div>
      </div>
    </div>
  );
}

/* ============================ ROOT ============================ */
function Root() {
  const [device, setDevice] = useState("both");   // both | desktop | mobile
  const [user, setUser] = useState("new");         // new | returning
  const [scenario, setScenario] = useState("normal");
  const [checks, setChecks] = useState({});

  const focus = device === "both" ? "both" : device;
  const key = scenario + "_" + user;   // remount apps when scenario/user change

  return (
    <div className="up">
      {/* review toolbar */}
      <div className="rev">
        <div className="rev-in">
          <div className="rev-brand">
            <span className="dot" /><span className="wm">Fitaura</span>
            <span className="tag">Upload Flow · Spec</span>
          </div>
          <div className="rev-group">
            <span className="lbl">Device</span>
            <div className="seg">
              {["both", "desktop", "mobile"].map((d) =>
                <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d}</button>)}
            </div>
          </div>
          <div className="rev-group">
            <span className="lbl">User</span>
            <div className="seg">
              <button aria-pressed={user === "new"} onClick={() => setUser("new")}>New · free</button>
              <button aria-pressed={user === "returning"} onClick={() => setUser("returning")}>Returning</button>
            </div>
          </div>
          <div className="rev-group">
            <span className="lbl">State</span>
            <div className="seg">
              {SCEN_ORDER.map((s) =>
                <button key={s} aria-pressed={scenario === s} onClick={() => setScenario(s)}>{SCENARIOS[s].label}</button>)}
            </div>
          </div>
        </div>
      </div>

      <div className="up-wrap">
        {/* hero / recommendation */}
        <header className="stage-head">
          <span className="eyebrow">Input flow · face + outfit</span>
          <h1>One page. <span className="hl">Two drops.</span><br />Zero friction.</h1>
          <p className="lead">The lowest-friction path is a single upload page with two clearly-labelled drop zones — never a multi-step wizard. The same layout serves desktop and mobile: two zones side-by-side become stacked, the crop becomes pinch-and-drag, and the CTA stays in reach.</p>
          <div className="rec">{G.check}<span><b>Recommended:</b> one combined page, two zones, inline crop. No wizard, no separate edit screen, no “pro editor” surface. Drop → glance → scan.</span></div>
        </header>

        {/* device stage */}
        <div className="devices" data-focus={focus}>
          {(device === "both" || device === "desktop") && (
            <div className="frame-desktop-wrap">
              <DesktopFrame key={"d_" + key} scenario={scenario} user={user} />
              <div className="device-cap">Desktop · 860px</div>
            </div>
          )}
          {(device === "both" || device === "mobile") && (
            <div className="frame-mobile-wrap">
              <MobileFrame key={"m_" + key} scenario={scenario} user={user} />
              <div className="device-cap">Mobile · 390px</div>
            </div>
          )}
        </div>

        {/* spec sheet */}
        <SpecSheet checks={checks} setChecks={setChecks} />
      </div>
    </div>
  );
}

/* ---------------- spec sheet: crop behavior + notes + checklist ---------------- */
function SpecSheet({ checks, setChecks }) {
  const cropRows = [
    ["Aspect — face", <span><b>1:1</b> square, masked to a circle ring</span>],
    ["Aspect — outfit", <span><b>3:4</b> portrait (matches the result card)</span>],
    ["Default crop", <span>Auto-centered, fit-to-cover at <b>1.0×</b> zoom</span>],
    ["Zoom range", <span><b>1.0× – 3.0×</b>; image never smaller than the frame</span>],
    ["Min image size", <span>Face <b>≥ 600px</b> shortest side · Outfit <b>≥ 600 × 800</b></span>],
    ["Max file size", <span><b>20 MB</b> · JPG, PNG, WEBP, HEIC</span>],
    ["Safe framing", <span>Dashed guide marks the keep-inside area; face = eyes/brows, outfit = head + shoes</span>],
    ["Pan limit", <span>Clamped — you can’t drag past the photo edge, so the frame is always filled</span>],
    ["Reset", <span><b>Reset</b> returns to default center + 1.0× zoom; original file untouched</span>],
    ["Return to photo", <span>Reopening shows your <b>saved crop</b>, not a re-centered default — Adjust to keep editing</span>],
  ];

  const notes = [
    ["01", <span><b>Lowest-friction by design.</b> One page, two zones, no wizard. Dropping a file goes straight to an inline crop — there is no separate “edit” screen to navigate to and back from.</span>],
    ["02", <span><b>Not a pro editor.</b> No rotate, filters, brightness, layers, or freeform crop handles. Just reposition + zoom inside a fixed frame. Two controls, one guide, done.</span>],
    ["03", <span><b>Same model, both devices.</b> Desktop drags with a cursor; mobile uses one-finger drag + two-finger pinch. The pill hint swaps copy (“Drag to reposition” ↔ “Pinch · drag”) but the interaction is identical.</span>],
    ["04", <span><b>Validation is local + immediate.</b> Type, size, and dimensions are checked before any upload bar runs, so users see “unsupported / too large / too small” instantly rather than after a wait.</span>],
    ["05", <span><b>Forgiving framing.</b> Poor framing is a soft warning (gold), never a hard block. The user can still scan; we just nudge. Only a missing photo blocks the CTA.</span>],
    ["06", <span><b>Replace vs Remove.</b> Replace swaps the file but keeps you in the crop; Remove clears the zone back to empty and drops the saved crop. Both are always one tap away.</span>],
    ["07", <span><b>Progress is honest.</b> A determinate bar with filename + percent, and a Cancel that returns to the empty zone cleanly.</span>],
    ["08", <span><b>Cost is stated before the tap.</b> New users see “first scan free”; returning users see the 1-credit cost and remaining balance right on and under the CTA — no surprise paywall.</span>],
  ];

  const items = [
    "One combined page — no multi-step wizard",
    "Face + outfit zones are independently labelled and validated",
    "Accepted formats + size shown before upload",
    "Determinate progress with filename, %, and cancel",
    "Inline crop: drag-reposition + zoom slider (desktop) and pinch (mobile)",
    "Safe-frame dashed guide on both crops",
    "Face = 1:1 circle, Outfit = 3:4 portrait, min sizes enforced",
    "Reset restores default crop; original file never altered",
    "Reopening a photo restores the saved crop, not a fresh center",
    "Replace and Remove controls present in every filled state",
    "Invalid / oversized / too-small errors are specific and recoverable",
    "Poor framing warns (gold) but does not block",
    "Missing photo blocks the CTA with a clear inline message",
    "New user sees first-free message; returning user sees credit cost + balance",
    "Generation CTA disabled until both photos are ready",
    "Desktop and mobile share one layout and one interaction model",
  ];

  const toggle = (i) => setChecks((c) => ({ ...c, [i]: !c[i] }));
  const done = items.filter((_, i) => checks[i]).length;

  return (
    <section className="spec">
      <span className="eyebrow">Specification</span>
      <h2 className="spec-h">Crop behavior &amp; <span className="hl">interaction notes</span></h2>
      <div className="spec-grid">
        <div className="spec-card">
          <h3><span className="num">A</span> Crop behavior</h3>
          <table className="spec-table"><tbody>
            {cropRows.map(([k, v]) => <tr key={k}><td className="k">{k}</td><td className="v">{v}</td></tr>)}
          </tbody></table>
        </div>
        <div className="spec-card">
          <h3><span className="num">B</span> Interaction notes</h3>
          <ul className="notes">
            {notes.map(([n, t]) => <li key={n}><span className="nn">{n}</span><span>{t}</span></li>)}
          </ul>
        </div>
      </div>

      <div className="spec-grid" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
        <div className="spec-card">
          <h3><span className="num">C</span> Approval checklist <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em", marginLeft: "auto" }}>{done}/{items.length}</span></h3>
          <ul className="checklist">
            {items.map((t, i) =>
              <li key={i} data-checked={!!checks[i]} onClick={() => toggle(i)}>
                <span className="box">{G.check}</span>
                <span className="ltext">{t}</span>
              </li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
