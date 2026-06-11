// result-shell.jsx — FITAURA shared result-page shell.
// Wraps the Face / Outfit / Receipt assets (cards.jsx) with a product shell:
// header, segmented navigation, sticky asset preview, supporting analysis,
// sticker controls, export/share, new-generation, credits, local-save feedback.
const { useState: useS, useEffect: useE, useRef: useR, useCallback: useCB } = React;

const VERDICT_COLOR_RS = { red_flag: "var(--red)", normie: "var(--cyan)", green_flag: "var(--lime)" };

const RS_TABS = [
  { id: 0, slug: "face",    name: "FACE",    n: "01", kind: "face" },
  { id: 1, slug: "outfit",  name: "OUTFIT",  n: "02", kind: "outfit" },
  { id: 2, slug: "receipt", name: "RECEIPT", n: "03", kind: "receipt" },
];

const RS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "verdict": "red_flag",
  "accent": "#54e6f0",
  "receiptStyle": "neon",
  "stickerOn": true
}/*EDITMODE-END*/;

function slugToTab(slug){ const i = RS_TABS.findIndex(t => t.slug === slug); return i < 0 ? null : i; }

function ResultShell(){
  const [t, setTweak] = useTweaks(RS_DEFAULTS);

  // ---- navigation: hash → localStorage → 0 ----
  const initialTab = (() => {
    const fromHash = slugToTab((location.hash || "").replace("#", ""));
    if (fromHash != null) return fromHash;
    const stored = slugToTab(localStorage.getItem("fitaura.tab") || "");
    return stored != null ? stored : 0;
  })();
  const [tab, setTabRaw] = useS(initialTab);
  const [editing, setEditing] = useS(false);
  const [scanNonce, setScanNonce] = useS(0);

  const setTab = useCB((next) => {
    const n = Math.max(0, Math.min(RS_TABS.length - 1, next));
    setTabRaw(n);
    setEditing(false);
    const slug = RS_TABS[n].slug;
    if (location.hash.replace("#", "") !== slug) history.replaceState(null, "", "#" + slug);
    localStorage.setItem("fitaura.tab", slug);
    // scroll restoration: changing tab returns the reading position to the top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // respond to back/forward hash changes
  useE(() => {
    const onHash = () => { const i = slugToTab((location.hash || "").replace("#", "")); if (i != null) setTabRaw(i); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // ---- credits + local save feedback ----
  const [credits, setCredits] = useS(() => {
    const v = parseInt(localStorage.getItem("fitaura.credits"), 10);
    return Number.isFinite(v) ? v : 2;
  });
  useE(() => { localStorage.setItem("fitaura.credits", String(credits)); }, [credits]);
  const [savedFlash, setSavedFlash] = useS(false);
  const [toast, setToast] = useS(null);
  const toastTimer = useR(null);
  const ping = useCB((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // ---- stickers ----
  const SEED = { red_flag: { face: 0, outfit: 0 }, green_flag: { face: 2, outfit: 1 }, normie: { face: 1, outfit: 3 } };
  const [stk, setStk] = useS(SEED[t.verdict] || { face: 0, outfit: 0 });
  useE(() => { setStk(SEED[t.verdict] || { face: 0, outfit: 0 }); }, [t.verdict]);

  const data = FITAURA_DATA[t.verdict] || FITAURA_DATA.red_flag;

  // apply accent + verdict color to :root
  useE(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--verdict", VERDICT_COLOR_RS[t.verdict] || "var(--red)");
    root.style.setProperty("--receipt-bg", t.receiptStyle === "thermal" ? "#f4f1e9" : "#0a0c11");
  }, [t.accent, t.verdict, t.receiptStyle]);

  // ---- keyboard nav ----
  useE(() => {
    const h = (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select")) return;
      if (e.key === "ArrowRight") setTab(tab + 1);
      if (e.key === "ArrowLeft") setTab(tab - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tab, setTab]);

  // ---- swipe nav (asset frame; not the only method) ----
  const touch = useR(null);
  const onTouchStart = (e) => { const tch = e.touches[0]; touch.current = { x: tch.clientX, y: tch.clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const tch = e.changedTouches[0];
    const dx = tch.clientX - touch.current.x, dy = tch.clientY - touch.current.y;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) setTab(tab + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  // ---- card auto-scale: fit width on mobile, fit the sticky column on desktop ----
  const frameRef = useR(null);
  const mountRef = useR(null);
  useE(() => {
    const fit = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const vw = window.innerWidth;
      // available card-column width, derived from viewport (no feedback from the card itself)
      const colW = vw > 1000 ? 440 : Math.min(560, vw) - 36;
      let s = Math.min(1, (colW - 4) / 360);
      if (vw > 1000) {
        const stickyTop = 62 + 66 + 26;          // header + nav + stage padding
        const reserve = 210;                      // controls (may wrap) + export + gaps below card
        const availH = window.innerHeight - stickyTop - reserve;
        s = Math.min(s, availH / 640);
      }
      s = Math.max(0.6, Math.min(1, s));
      frame.style.setProperty("--rs-scale", s.toFixed(3));
    };
    fit();
    window.addEventListener("resize", fit);
    const id = setTimeout(fit, 120);
    return () => { window.removeEventListener("resize", fit); clearTimeout(id); };
  }, [tab]);

  // ---- actions ----
  const tabDef = RS_TABS[tab];
  const kind = tabDef.kind;
  const faceSticker = STICKER_BANK.face[stk.face];
  const outfitSticker = STICKER_BANK.outfit[stk.outfit];

  const swapSticker = () => setStk(s => ({ ...s, [kind]: ((s[kind] || 0) + 1) % STICKER_BANK[kind].length }));
  const pickSticker = (i) => setStk(s => ({ ...s, [kind]: i }));

  const download = () => { ping(`Saved ${tabDef.name.toLowerCase()} card to device`); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1600); };
  const share = () => ping("Share sheet opened");
  const saveHistory = () => { ping("Saved to history on this device"); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1600); };
  const exportAll = () => ping("Exporting all 3 cards…");

  const newScan = () => {
    if (credits <= 0){ ping("Out of credits — grab a pack"); return; }
    setCredits(c => c - 1);
    setScanNonce(n => n + 1);
    setTab(0);
    ping("New scan started · drop your photos");
  };

  // ---- render: asset + analysis keyed so each change re-runs entrance anim ----
  const animKey = `${kind}-${t.verdict}-${scanNonce}`;
  const assetEl = kind === "face"
    ? <FaceCard key={animKey} data={data} sticker={faceSticker} stickerOn={t.stickerOn} run={true} />
    : kind === "outfit"
    ? <OutfitCard key={animKey} data={data} sticker={outfitSticker} stickerOn={t.stickerOn} run={true} />
    : <Receipt key={animKey} data={data} style={t.receiptStyle} sealOn={t.stickerOn} run={true} />;

  const analysisEl = kind === "face"
    ? <FaceAnalysis key={animKey} data={data} verdict={t.verdict} run={true} />
    : kind === "outfit"
    ? <OutfitAnalysis key={animKey} data={data} verdict={t.verdict} run={true} />
    : <ReceiptSummary key={animKey} data={data} verdict={t.verdict} run={true}
        onExportAll={exportAll} onShare={share} onSaveHistory={saveHistory} onNewScan={newScan} />;

  return (
    <div className={"rs-app" + (editing ? " editing" : "")}>
      {/* ===================== HEADER ===================== */}
      <header className="rs-header">
        <div className="rs-h-left">
          <div className="rs-brand"><span className="dot" /><span className="rs-wm">FITAURA</span></div>
          <div className="rs-divider" />
          <div className="rs-resultlabel">RESULT · <b>NO. {data.receipt.no}</b><br />11 JUN 2026 · 14:08</div>
          <div className="verdict-chip" style={{ marginLeft: 6 }}><span className="pulse" />{data.chip}</div>
        </div>
        <div className="rs-h-right">
          <div className={"rs-saved" + (savedFlash ? " flash" : "")}>
            <span className="led" /><span>{savedFlash ? "SAVED ✓" : "SAVED TO DEVICE"}</span>
          </div>
          <button className="rs-credits" onClick={() => ping(`${credits} scan${credits === 1 ? "" : "s"} left · tap for packs`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h5" /></svg>
            <b>{credits}</b> left
          </button>
          <div className="rs-h-actions" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button className="rs-newscan" onClick={newScan}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              <span>New scan</span>
            </button>
            <div className="rs-avatar" title="Account" onClick={() => ping("Account menu")}>K</div>
          </div>
        </div>
      </header>

      {/* ===================== NAV ===================== */}
      <nav className="rs-nav">
        <div className="rs-tabs" role="tablist">
          {RS_TABS.map(tb => (
            <button key={tb.id} className="tab" role="tab" aria-selected={tab === tb.id} onClick={() => setTab(tb.id)}>
              <span className="n">{tb.n}</span>{tb.name}
            </button>
          ))}
        </div>
        <div className="rs-stepper">
          <span className="rs-count"><b>{tabDef.n}</b> / 03</span>
          <button className="rs-arrow" onClick={() => setTab(tab - 1)} disabled={tab === 0} aria-label="Previous">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="rs-arrow" onClick={() => setTab(tab + 1)} disabled={tab === 2} aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </nav>

      {/* ===================== STAGE ===================== */}
      <main className="rs-stage">
        {/* LEFT: asset preview (sticky on desktop) */}
        <div className="rs-asset">
          <div className={"rs-frame" + (editing ? " editing" : "")} ref={frameRef}
               onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="rs-frame-inner">
              <div className="rs-card-mount" ref={mountRef}>{assetEl}</div>
            </div>
          </div>

          {/* sticker / paper controls — contextual */}
          {!editing && kind !== "receipt" && (
            <div className="rs-controlbar">
              <span className="rs-cb-label">Sticker</span>
              <span className="rs-cb-current"><i style={{ background: "var(--accent)" }} />{(kind === "face" ? faceSticker : outfitSticker).text}</span>
              <span className="rs-cb-spacer" />
              <button className="rs-cb-btn" onClick={swapSticker}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12" /></svg>Swap
              </button>
              <button className={"rs-cb-btn" + (t.stickerOn ? " on" : "")} onClick={() => setTweak("stickerOn", !t.stickerOn)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                {t.stickerOn ? "Shown" : "Hidden"}
              </button>
              <button className="rs-cb-btn" onClick={() => setEditing(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>Edit
              </button>
            </div>
          )}

          {!editing && kind === "receipt" && (
            <div className="rs-controlbar">
              <span className="rs-cb-label">Paper</span>
              <div className="rs-seg">
                <button aria-pressed={t.receiptStyle === "neon"} onClick={() => setTweak("receiptStyle", "neon")}>Dark neon</button>
                <button aria-pressed={t.receiptStyle === "thermal"} onClick={() => setTweak("receiptStyle", "thermal")}>Thermal</button>
              </div>
              <span className="rs-cb-spacer" />
              <button className={"rs-cb-btn" + (t.stickerOn ? " on" : "")} onClick={() => setTweak("stickerOn", !t.stickerOn)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1-6-4.5h7.6z" /></svg>
                {t.stickerOn ? "Seal on" : "Seal off"}
              </button>
            </div>
          )}

          {/* edit-mode sticker picker — replaces controls, dims the rest of the shell */}
          {editing && kind !== "receipt" && (
            <div className="rs-editpanel">
              <div className="eh">
                <span className="t">EDIT STICKER · {kind.toUpperCase()}</span>
                <button className={"rs-cb-btn" + (t.stickerOn ? " on" : "")} onClick={() => setTweak("stickerOn", !t.stickerOn)}>{t.stickerOn ? "Visible" : "Hidden"}</button>
              </div>
              <div className="rs-stickergrid">
                {STICKER_BANK[kind].map((s, i) => (
                  <button key={s.text} className="rs-stickeropt" aria-pressed={stk[kind] === i}
                          onClick={() => { pickSticker(i); if (!t.stickerOn) setTweak("stickerOn", true); }}>{s.text}</button>
                ))}
              </div>
              <div className="erow">
                <button className="ctrl primary" onClick={() => { setEditing(false); ping("Sticker updated"); }}>Done</button>
              </div>
            </div>
          )}

          {/* per-asset export / share */}
          {!editing && (
            <div className="rs-assetactions">
              <button className="ctrl" onClick={download}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Download {tabDef.name.toLowerCase()}
              </button>
              <button className="ctrl" onClick={share}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a3 3 0 10-2.8-4M6 15a3 3 0 100 6 3 3 0 000-6zM18 19a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                Share
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: supporting analysis */}
        <div className="rs-analysis">{analysisEl}</div>
      </main>

      {/* ===================== MOBILE ACTION BAR ===================== */}
      <div className="rs-mobilebar">
        <button className="mb-btn" onClick={download}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>Save
        </button>
        <button className="mb-btn" onClick={share}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a3 3 0 10-2.8-4M6 15a3 3 0 100 6 3 3 0 000-6zM18 19a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>Share
        </button>
        <button className="mb-btn primary" onClick={newScan}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>New scan
        </button>
      </div>

      {/* ===================== TOAST ===================== */}
      <div className={"rs-toast" + (toast ? " show" : "")}><span className="led" />{toast}</div>

      {/* ===================== TWEAKS ===================== */}
      <TweaksPanel>
        <TweakSection label="Verdict" />
        <TweakRadio label="Outcome" value={t.verdict}
          options={[{ label: "Green", value: "green_flag" }, { label: "Normie", value: "normie" }, { label: "Red", value: "red_flag" }]}
          onChange={v => setTweak("verdict", v)} />
        <TweakSection label="Identity" />
        <TweakColor label="Accent" value={t.accent}
          options={["#54e6f0", "#83b4ff", "#b6ff3c", "#ff52a6"]}
          onChange={v => setTweak("accent", v)} />
        <TweakSection label="Receipt" />
        <TweakRadio label="Paper" value={t.receiptStyle}
          options={[{ label: "Dark neon", value: "neon" }, { label: "Thermal", value: "thermal" }]}
          onChange={v => setTweak("receiptStyle", v)} />
        <TweakSection label="Stickers" />
        <TweakToggle label="Show on cards" value={t.stickerOn} onChange={v => setTweak("stickerOn", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ResultShell />);
