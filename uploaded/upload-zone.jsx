// upload-zone.jsx — FITAURA upload flow: the per-photo zone.
// Handles drag/drop + browse, accepted-file + framing guidance, upload
// progress, friendly crop (drag-reposition + zoom slider + pinch), reset,
// replace/remove, validation, and "return to edited photo" (saved crop).
// Exported to window for upload.jsx.

const { useState, useRef, useEffect, useCallback } = React;

/* ---- rules ---- */
const ACCEPT_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ACCEPT_LABEL = ["JPG", "PNG", "WEBP", "HEIC"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ZOOM_MIN = 1, ZOOM_MAX = 3;
const CROP = {
  face:   { w: 220, h: 220, ratio: "1:1",  minSide: 600 },
  outfit: { w: 230, h: 306, ratio: "3:4",  minW: 600, minH: 800 },
};

/* ---- icons (match landing vocabulary) ---- */
const UI = {
  face: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="9" r="4"/><path d="M5.5 20a6.5 6.5 0 0113 0" strokeLinecap="round"/></svg>,
  hanger: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 7a2 2 0 112-2M12 7v2.5L3.5 15a1.5 1.5 0 00.9 2.7h15.2a1.5 1.5 0 00.9-2.7L12 9.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v5M12 17h.01M10.3 3.9 2.4 18a1.9 1.9 0 001.7 2.9h15.8a1.9 1.9 0 001.7-2.9L13.7 3.9a1.9 1.9 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  move: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pinch: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11V5a2 2 0 014 0v6M13 7a2 2 0 014 0v6c0 3.3-2.7 6-6 6s-6-2.7-6-6v-2l2.5.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  reset: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 3v4h4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  swap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h13l-3-3M20 17H7l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>,
  minus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14" strokeLinecap="round"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" strokeLinecap="round"/></svg>,
};

/* ---- sample image generator (clearly a placeholder, not a fake photo) ---- */
function makeSample(kind, variant) {
  const W = kind === "face" ? 900 : 900;
  const H = kind === "face" ? 900 : 1200;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  // base gradient
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1a2230"); grad.addColorStop(0.5, "#222a39"); grad.addColorStop(1, "#12161f");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // diagonal stripes (placeholder texture)
  g.save(); g.globalAlpha = 0.05; g.strokeStyle = "#ffffff"; g.lineWidth = 2;
  for (let i = -H; i < W; i += 26) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  g.restore();
  // "subject" blob — centred for good, shoved to a corner for poor framing
  const cx = variant === "poor" ? W * 0.78 : W * 0.5;
  const cy = variant === "poor" ? (kind === "face" ? H * 0.74 : H * 0.30) : (kind === "face" ? H * 0.46 : H * 0.5);
  const r = kind === "face" ? W * 0.26 : W * 0.22;
  const rg = g.createRadialGradient(cx, cy, 8, cx, cy, r * (kind === "face" ? 1.6 : 2.4));
  rg.addColorStop(0, "rgba(131,180,255,0.55)"); rg.addColorStop(1, "rgba(131,180,255,0)");
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r * (kind === "face" ? 1.6 : 2.4), 0, 7); g.fill();
  // label
  g.fillStyle = "rgba(255,255,255,0.6)"; g.textAlign = "center"; g.font = "600 30px 'Space Mono', monospace";
  g.fillText(kind === "face" ? "SAMPLE · SELFIE" : "SAMPLE · OUTFIT", W / 2, H - 54);
  g.font = "400 22px 'Space Mono', monospace"; g.fillStyle = "rgba(255,255,255,0.32)";
  g.fillText("drop your real photo to replace", W / 2, H - 22);
  return { url: c.toDataURL("image/webp", 0.8), w: W, h: H };
}

/* clamp pan so the crop frame is always fully covered (safe framing guarantee) */
function clampView(v, nat, frame) {
  const base = Math.max(frame.w / nat.w, frame.h / nat.h);
  const dispW = nat.w * base * v.zoom, dispH = nat.h * base * v.zoom;
  const mx = Math.max(0, (dispW - frame.w) / 2), my = Math.max(0, (dispH - frame.h) / 2);
  return { zoom: v.zoom, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
}
function imgStyle(v, nat, frame) {
  const base = Math.max(frame.w / nat.w, frame.h / nat.h);
  const dispW = nat.w * base * v.zoom, dispH = nat.h * base * v.zoom;
  return { width: dispW + "px", height: dispH + "px", transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))` };
}

/* ============================ UPLOAD ZONE ============================ */
function UploadZone({ kind, initial, onState, missing, mobile }) {
  const frame = CROP[kind];
  const [status, setStatus] = useState("empty");      // empty | uploading | ready | error
  const [errorType, setErrorType] = useState(null);   // invalid | oversized | toosmall
  const [src, setSrc] = useState(null);               // { url, w, h, name }
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [flag, setFlag] = useState("ok");             // ok | warn  (framing quality)
  const [editing, setEditing] = useState(true);       // crop open vs collapsed
  const [progress, setProgress] = useState(0);
  const [hinting, setHinting] = useState(false);

  const savedView = useRef(null);
  const inputRef = useRef(null);
  const cropRef = useRef(null);
  const fileInfo = useRef("");

  /* report readiness up */
  useEffect(() => {
    onState && onState({ status, ready: status === "ready", flag });
  }, [status, flag]);

  /* apply forced scenario on mount */
  useEffect(() => {
    if (!initial) return;
    if (initial.status === "error") { setStatus("error"); setErrorType(initial.errorType); return; }
    if (initial.srcKind) {
      const variant = initial.srcKind.startsWith("poor") ? "poor" : "good";
      const s = makeSample(kind, variant);
      fileInfo.current = (kind === "face" ? "selfie" : "outfit") + ".jpg · 2.4 MB";
      setSrc({ ...s, name: fileInfo.current });
      setView(clampView({ zoom: 1, x: 0, y: 0 }, s, frame));
      setFlag(initial.flag || "ok");
      setStatus("ready"); setEditing(true);
    }
  }, []);

  /* ---- ingest ---- */
  const cancelTimer = useRef(null);
  function reset() {
    setStatus("empty"); setErrorType(null); setSrc(null); setFlag("ok");
    setView({ zoom: 1, x: 0, y: 0 }); savedView.current = null; setProgress(0);
  }

  function ingest(file) {
    if (cancelTimer.current) { clearInterval(cancelTimer.current); cancelTimer.current = null; }
    if (!file) return;
    fileInfo.current = file.name + " · " + (file.size / (1024 * 1024)).toFixed(1) + " MB";
    // 1. type
    if (ACCEPT_MIME.indexOf(file.type) < 0) { setStatus("error"); setErrorType("invalid"); return; }
    // 2. size
    if (file.size > MAX_BYTES) { setStatus("error"); setErrorType("oversized"); return; }
    // 3. decode + dimensions
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth, h = im.naturalHeight;
      const tooSmall = kind === "face"
        ? Math.min(w, h) < frame.minSide
        : (w < frame.minW || h < frame.minH);
      if (tooSmall) { setStatus("error"); setErrorType("toosmall"); URL.revokeObjectURL(url); return; }
      // upload progress
      setStatus("uploading"); setProgress(0);
      let p = 0;
      cancelTimer.current = setInterval(() => {
        p += Math.random() * 16 + 9;
        if (p >= 100) {
          p = 100; clearInterval(cancelTimer.current); cancelTimer.current = null;
          setProgress(100);
          setTimeout(() => {
            setSrc({ url, w, h, name: fileInfo.current });
            setView(clampView({ zoom: 1, x: 0, y: 0 }, { w, h }, frame));
            setFlag("ok"); setStatus("ready"); setEditing(true);
            flashHint();
          }, 180);
        } else setProgress(p);
      }, 90);
    };
    im.onerror = () => { setStatus("error"); setErrorType("invalid"); URL.revokeObjectURL(url); };
    im.src = url;
  }

  function flashHint() { setHinting(true); setTimeout(() => setHinting(false), 1600); }

  function onPick(e) { const f = e.target.files && e.target.files[0]; if (f) ingest(f); e.target.value = ""; }
  function loadSample() {
    const s = makeSample(kind, "good");
    fileInfo.current = (kind === "face" ? "selfie" : "outfit") + ".jpg · 2.4 MB";
    setStatus("uploading"); setProgress(0);
    let p = 0;
    cancelTimer.current = setInterval(() => {
      p += Math.random() * 18 + 12;
      if (p >= 100) {
        clearInterval(cancelTimer.current); cancelTimer.current = null; setProgress(100);
        setTimeout(() => {
          setSrc({ ...s, name: fileInfo.current });
          setView(clampView({ zoom: 1, x: 0, y: 0 }, s, frame));
          setFlag("ok"); setStatus("ready"); setEditing(true); flashHint();
        }, 160);
      } else setProgress(p);
    }, 80);
  }

  /* ---- drag & drop ---- */
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  function dragEnter(e) { e.preventDefault(); depth.current++; setOver(true); }
  function dragOver(e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; }
  function dragLeave(e) { e.preventDefault(); if (--depth.current <= 0) { depth.current = 0; setOver(false); } }
  function drop(e) { e.preventDefault(); depth.current = 0; setOver(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) ingest(f); }

  /* ---- crop interaction: pan + pinch ---- */
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const viewRef = useRef(view); viewRef.current = view;

  function setClamped(v) { setView(clampView(v, src, frame)); }

  function onPointerDown(e) {
    if (status !== "ready" || !editing) return;
    cropRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinch.current = { d: dist(pts[0], pts[1]), zoom: viewRef.current.zoom };
    }
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const d = dist(pts[0], pts[1]);
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinch.current.zoom * (d / pinch.current.d)));
      setClamped({ ...viewRef.current, zoom: z });
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      setClamped({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy });
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function setZoom(z) { setClamped({ ...viewRef.current, zoom: z }); }
  function nudgeZoom(d) { setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewRef.current.zoom + d))); }
  function resetCrop() { setView(clampView({ zoom: 1, x: 0, y: 0 }, src, frame)); }

  function confirmCrop() { savedView.current = { ...view }; setEditing(false); }
  function adjustCrop() { if (savedView.current) setView(savedView.current); setEditing(true); flashHint(); }

  /* ---------- render ---------- */
  const KindIcon = kind === "face" ? UI.face : UI.hanger;
  const label = kind === "face" ? "Face photo" : "Outfit photo";
  const num = kind === "face" ? "01" : "02";

  return (
    <div className="zone" data-kind={kind} data-status={status} data-over={over}
      onDragEnter={dragEnter} onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}>
      <div className="zone-head">
        <span className="kind"><span className="n">{num}</span>{label}</span>
        {status === "ready"
          ? (flag === "warn"
              ? <span className="state-badge warn">{UI.alert} Check framing</span>
              : <span className="state-badge ok">{UI.check} Ready</span>)
          : <span className="req">Required</span>}
      </div>

      {/* EMPTY */}
      {status === "empty" && (
        <>
          <div className="zone-drop" data-missing={missing ? "true" : "false"}
            style={missing ? { borderColor: "var(--red)", background: "color-mix(in oklab, var(--red) 8%, transparent)" } : null}
            onClick={() => inputRef.current.click()}>
            <span className="ic">{kind === "face" ? UI.face : UI.hanger}</span>
            <span className="big">{kind === "face" ? "Drop your selfie" : "Drop your outfit shot"}</span>
            <span className="or">or <u>browse files</u></span>
            <button type="button" className="sample" onClick={(e) => { e.stopPropagation(); loadSample(); }}>Use a sample</button>
          </div>
          {missing && (
            <div className="crop-note warn" style={{ marginTop: 12 }}>{UI.alert}
              <span>Add your {kind === "face" ? "face" : "outfit"} photo to run the scan.</span></div>
          )}
          <div className="zone-guide">
            <div className="zone-accept">
              {ACCEPT_LABEL.map((f, i) => <React.Fragment key={f}><span className="fmt">{f}</span>{i < ACCEPT_LABEL.length - 1 && <span className="sep">·</span>}</React.Fragment>)}
              <span className="sep">·</span><span>up to 20 MB</span>
            </div>
            <ul className="zone-tips">
              {(kind === "face" ? [
                "Front-facing, head & shoulders",
                "Even light, no heavy shadow",
                "Just you — solo shot",
              ] : [
                "Full outfit, head to shoes",
                "Stand back, plain background",
                "Mirror or full-length is perfect",
              ]).map((t) => <li key={t}>{UI.check}{t}</li>)}
              <li className="bad">{UI.x}{kind === "face" ? "No group shots or sunglasses" : "No close-ups or cropped legs"}</li>
            </ul>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(",")} hidden onChange={onPick} />
        </>
      )}

      {/* UPLOADING */}
      {status === "uploading" && (
        <div className="zone-prog">
          <div className="meta">Uploading</div>
          <div className="fname">{fileInfo.current}</div>
          <div className="track"><div className="fill" style={{ width: progress + "%" }} /></div>
          <div className="meta">{Math.round(progress)}%</div>
          <button className="cancel" onClick={reset}>Cancel</button>
        </div>
      )}

      {/* ERROR */}
      {status === "error" && (
        <>
          <div className="zone-err">
            <span className="ic">{UI.alert}</span>
            <span className="title">{ERR[errorType].title}</span>
            <span className="msg">{ERR[errorType](kind)}</span>
          </div>
          <div className="crop-ctrls" style={{ marginTop: 12 }}>
            <button className="cbtn" onClick={() => inputRef.current.click()}>{UI.upload} Choose another</button>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(",")} hidden onChange={onPick} />
        </>
      )}

      {/* READY — crop or collapsed preview */}
      {status === "ready" && src && (
        <div className="crop-wrap">
          {editing ? (
            <>
              <div className="crop-stageline">{kind === "face" ? "Center your face in the ring" : "Fit your whole outfit in the frame"}</div>
              <div ref={cropRef} className={"crop " + kind + (hinting ? " hinting" : "")}
                data-flag={flag} data-panning={pointers.current.size > 0}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                <img src={src.url} alt="" draggable="false" style={imgStyle(view, src, frame)} />
                <div className="guide"><span className="label">{kind === "face" ? "Keep eyes inside" : "Keep head & shoes inside"}</span></div>
                <div className="grip"><span className="pill">{mobile ? UI.pinch : UI.move}{mobile ? "Pinch · drag" : "Drag to reposition"}</span></div>
              </div>

              <div className="zoom-row">
                <button className="zbtn" onClick={() => nudgeZoom(-0.2)} aria-label="Zoom out">{UI.minus}</button>
                <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step="0.01" value={view.zoom}
                  style={{ "--p": ((view.zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN) * 100) + "%" }}
                  onChange={(e) => setZoom(parseFloat(e.target.value))} />
                <button className="zbtn" onClick={() => nudgeZoom(0.2)} aria-label="Zoom in">{UI.plus}</button>
              </div>

              {flag === "warn" ? (
                <div className="crop-note warn">{UI.alert}<span><b>Looks off-center.</b> {kind === "face" ? "Get your face inside the ring and fairly large." : "Make sure your head and shoes both sit inside the frame."}</span></div>
              ) : (
                <div className="crop-note">{UI.info}<span>{mobile ? "Pinch to zoom, drag to reposition." : "Drag the photo or use zoom."} The dashed guide is the safe area.</span></div>
              )}

              <div className="crop-ctrls">
                <button className="cbtn" onClick={resetCrop}>{UI.reset} Reset</button>
                <button className="cbtn" onClick={() => inputRef.current.click()}>{UI.swap} Replace</button>
                <button className="cbtn danger" onClick={reset}>{UI.trash} Remove</button>
              </div>
              <button className="cta go" style={{ fontSize: 14, padding: "12px 18px" }} onClick={confirmCrop}>{UI.check} Looks good</button>
              <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(",")} hidden onChange={onPick} />
            </>
          ) : (
            <>
              <div className="crop-stageline">Saved framing</div>
              <div className={"crop " + kind} style={{ cursor: "default" }} data-flag={flag}>
                <img src={src.url} alt="" draggable="false" style={imgStyle(view, src, frame)} />
                <div className="guide" style={{ opacity: 0.35 }} />
              </div>
              <div className="crop-note">{UI.check}<span>Framing saved. Reopen any time — your crop is kept.</span></div>
              <div className="crop-ctrls">
                <button className="cbtn" onClick={adjustCrop}>{UI.move} Adjust</button>
                <button className="cbtn" onClick={() => inputRef.current.click()}>{UI.swap} Replace</button>
                <button className="cbtn danger" onClick={reset}>{UI.trash} Remove</button>
              </div>
              <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(",")} hidden onChange={onPick} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* validation copy */
const ERR = {
  invalid: Object.assign((k) => "We can read JPG, PNG, WEBP or HEIC. That file isn't an image we support.", { title: "Unsupported file" }),
  oversized: Object.assign((k) => "That photo is over 20 MB. Export a smaller version and try again.", { title: "File too large" }),
  toosmall: Object.assign((k) => k === "face" ? "Too small to read clearly — use a photo at least 600 px wide." : "Too small — use a photo at least 600 × 800 px.", { title: "Image too small" }),
};

Object.assign(window, { UploadZone, makeSample, UI, CROP });
