// app.jsx — FITAURA showcase stage: card-stack nav, scanner reveal, tweaks.
const { useState, useEffect, useRef, useCallback } = React;

const VERDICT_COLOR = { red_flag: "var(--red)", normie: "var(--cyan)", green_flag: "var(--lime)" };
const VERDICT_LABEL = { red_flag: "RED FLAG", normie: "NORMIE", green_flag: "GREEN FLAG" };
const SCAN_PRESET = {
  subtle:   { dur: "1.6s", glow: 0.6, int: 0.5, total: 1500 },
  standard: { dur: "1.3s", glow: 1.0, int: 1.0, total: 2300 },
  intense:  { dur: "0.9s", glow: 1.8, int: 1.6, total: 3200 },
};
const SCAN_LINES = ["LOCKING FACIAL GEOMETRY", "READING AURA FIELD", "SCANNING OUTFIT SILHOUETTE",
  "CROSS-REFERENCING PHYSIQUE", "COMPILING DATING VERDICT"];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "verdict": "red_flag",
  "accent": "#54e6f0",
  "receiptStyle": "neon",
  "scanner": "standard",
  "stickerOn": true
}/*EDITMODE-END*/;

const TABS = [
  { id: 0, name: "FACE", n: "01" },
  { id: 1, name: "OUTFIT", n: "02" },
  { id: 2, name: "RECEIPT", n: "03" },
];

function Scanner({ preset, verdict, onDone }) {
  const [pct, setPct] = useState(0);
  const [line, setLine] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const p = SCAN_PRESET[preset];
    const start = performance.now();
    let iv, to;
    iv = setInterval(() => {
      const prog = Math.min(1, (performance.now() - start) / p.total);
      setPct(Math.round(prog * 100));
      setLine(Math.min(SCAN_LINES.length - 1, Math.floor(prog * SCAN_LINES.length)));
      if (prog >= 1) {
        clearInterval(iv);
        setPct(100);
        setDone(true);
        to = setTimeout(onDone, 480);
      }
    }, 40);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [preset]);
  const p = SCAN_PRESET[preset];
  return (
    <div className={"scanner" + (done ? " done" : "")}
         style={{ "--scan-dur": p.dur, "--scan-glow": p.glow, "--scan-int": p.int }}>
      <div>
        <div className="scan-frame">
          <div className="silhouette"><div className="blob" /></div>
          <div className="scan-grid" />
          <div className="scan-band" />
          <div className="scan-line" />
          <div className="scan-corners"><span className="tl" /><span className="tr" /><span className="bl" /><span className="br" /></div>
        </div>
        <div className="scan-readout">
          <div className="big">ANALYZING <span className="pct">{pct}%</span></div>
          <div className="line">{SCAN_LINES[line]}</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [run, setRun] = useState(false);
  const [stickers, setStickers] = useState({ faceIdx: 0, outfitIdx: 0 });

  const data = FITAURA_DATA[t.verdict] || FITAURA_DATA.red_flag;

  // apply accent + verdict color to :root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--verdict", VERDICT_COLOR[t.verdict] || "var(--red)");
  }, [t.accent, t.verdict]);

  // re-scan whenever verdict changes; seed verdict-fitting stickers
  const SEED = { red_flag: { faceIdx: 0, outfitIdx: 0 }, green_flag: { faceIdx: 2, outfitIdx: 1 }, normie: { faceIdx: 1, outfitIdx: 3 } };
  useEffect(() => {
    setScanning(true); setRun(false);
    setStickers(SEED[t.verdict] || { faceIdx: 0, outfitIdx: 0 });
  }, [t.verdict]);

  const onScanDone = useCallback(() => {
    setScanning(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setRun(true)));
  }, []);

  const rescan = () => { setRun(false); setScanning(true); };
  const swapStickers = () => setStickers(s => ({
    faceIdx: (s.faceIdx + 1) % STICKER_BANK.face.length,
    outfitIdx: (s.outfitIdx + 1) % STICKER_BANK.outfit.length,
  }));

  // keyboard nav
  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") setActive(a => Math.min(2, a + 1));
      if (e.key === "ArrowLeft") setActive(a => Math.max(0, a - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // scale deck to fit the available stage area
  const wrapRef = useRef(null);
  const deckRef = useRef(null);
  useEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current, deck = deckRef.current;
      if (!wrap || !deck) return;
      const availH = wrap.clientHeight - 24;
      const availW = wrap.clientWidth - 110;
      const s = Math.max(0.5, Math.min(1, availH / 700, availW / 410));
      deck.style.transform = `scale(${s.toFixed(3)})`;
    };
    fit();
    window.addEventListener("resize", fit);
    const id = setTimeout(fit, 120);
    return () => { window.removeEventListener("resize", fit); clearTimeout(id); };
  }, []);

  const faceSticker = STICKER_BANK.face[stickers.faceIdx];
  const outfitSticker = STICKER_BANK.outfit[stickers.outfitIdx];

  const cards = [
    <FaceCard key={"f" + t.verdict} data={data} sticker={faceSticker} stickerOn={t.stickerOn} run={run} />,
    <OutfitCard key={"o" + t.verdict} data={data} sticker={outfitSticker} stickerOn={t.stickerOn} run={run} />,
    <Receipt key={"r" + t.verdict} data={data} style={t.receiptStyle} sealOn={t.stickerOn} run={run} />,
  ];

  return (
    <div className="app">
      {scanning && <Scanner preset={t.scanner} verdict={t.verdict} onDone={onScanDone} />}

      <div className="topbar">
        <div className="brandmark"><span className="dot" /><span className="wm">FITAURA</span></div>
        <div className="verdict-chip"><span className="pulse" />{data.chip}</div>
        <div className="meta">RESULT ASSETS · MVP</div>
      </div>

      <div className="deckwrap" ref={wrapRef}>
        <button className="deck-nav prev" onClick={() => setActive(a => Math.max(0, a - 1))} aria-label="Previous">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="deck" ref={deckRef}>
          {cards.map((card, i) => (
            <div className="slot" key={i} data-pos={Math.max(-2, Math.min(2, i - active))}
                 onClick={() => i !== active && setActive(i)}>
              {card}
            </div>
          ))}
        </div>
        <button className="deck-nav next" onClick={() => setActive(a => Math.min(2, a + 1))} aria-label="Next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <div className="tabs">
        {TABS.map(tab => (
          <button key={tab.id} className="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)}>
            <span className="n">{tab.n}</span>{tab.name}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button className="ctrl" onClick={swapStickers}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12" /></svg>
          Swap sticker
        </button>
        <button className="ctrl" onClick={() => setTweak("stickerOn", !t.stickerOn)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M10.6 5.1A9 9 0 0121 12a9 9 0 01-1.6 5M6.6 6.6A9 9 0 003 12a9 9 0 0012 8.5" /></svg>
          {t.stickerOn ? "Hide sticker" : "Show sticker"}
        </button>
        <button className="ctrl primary" onClick={rescan}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></svg>
          Re-scan
        </button>
      </div>

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
        <TweakSection label="Scanner" />
        <TweakRadio label="Intensity" value={t.scanner}
          options={[{ label: "Subtle", value: "subtle" }, { label: "Standard", value: "standard" }, { label: "Intense", value: "intense" }]}
          onChange={v => setTweak("scanner", v)} />
        <TweakButton label="Re-scan now" onClick={rescan} secondary={true} />
        <TweakSection label="Stickers" />
        <TweakToggle label="Show stickers" value={t.stickerOn} onChange={v => setTweak("stickerOn", v)} />
        <TweakButton label="Swap sticker" onClick={swapStickers} secondary={true} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
