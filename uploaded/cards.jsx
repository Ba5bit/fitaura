// cards.jsx — FITAURA result assets: data model + renderable card components.
// Exports to window: FITAURA_DATA, FaceCard, OutfitCard, Receipt, StickerEl
const { useEffect, useRef, useState } = React;

/* -------------------------------------------------------------
   CONTENT BANK — three mutually-exclusive verdict states.
   Featured demo lands on RED FLAG (per brief).
   datingVerdict is a single enum, never three scores.
------------------------------------------------------------- */
const FITAURA_DATA = {
  red_flag: {
    key: "red_flag",
    chip: "VERDICT · RED FLAG",
    color: "var(--red)",
    face: {
      eyebrow: "FACE VERDICT",
      verdict: ["RED FLAG", "WITH GOOD ANGLES"],   // 2nd word group is highlighted
      sticker: { text: "HEAR ME OUT", tone: "warn", rot: -8 },
      stats: [
        { k: "Aura", v: 71, hot: false },
        { k: "Jaw Presence", v: 84, hot: false },
        { k: "Face Harmony", v: 63, hot: true },
        { k: "Main Character", v: 55, hot: true },
      ],
      index: "AURA INDEX 71",
    },
    outfit: {
      score: 74,
      caption: "GYM BRO ATTEMPTS EDITORIAL",
      sticker: { text: "FIT HAS LORE", tone: "accent", rot: 7 },
      stats: [
        { k: "Silhouette", v: 68 },
        { k: "Proportions", v: 61 },
        { k: "Fit", v: 79 },
        { k: "Physique Match", v: 86 },
      ],
    },
    receipt: {
      no: "0xA73F",
      rows: [
        { k: "Dating Score", v: "6.7 / 10", cls: "" },
        { k: "Aura Gained", v: "+240", cls: "good" },
        { k: "Ghosting Potential", v: "HIGH", cls: "hi" },
        { k: "Commitment Risk", v: "SEVERE", cls: "hi" },
        { k: "Delusion Index", v: "73%", cls: "" },
        { k: "Lover-Boy Prob.", v: "31%", cls: "" },
      ],
      subtotal: ["6 metrics analyzed", "1 credit"],
      verdict: "RED FLAG",
      punch: "RED FLAG WITH GOOD ANGLES",
      seal: ["FITAURA", "VERIFIED"],
    },
  },

  green_flag: {
    key: "green_flag",
    chip: "VERDICT · GREEN FLAG",
    color: "var(--lime)",
    face: {
      eyebrow: "FACE VERDICT",
      verdict: ["CERTIFIED", "MAIN CHARACTER"],
      sticker: { text: "AURA FARMER", tone: "accent", rot: -8 },
      stats: [
        { k: "Aura", v: 92, hot: false },
        { k: "Jaw Presence", v: 88, hot: false },
        { k: "Face Harmony", v: 90, hot: false },
        { k: "Main Character", v: 94, hot: false },
      ],
      index: "AURA INDEX 92",
    },
    outfit: {
      score: 91,
      caption: "LET HIM COOK",
      sticker: { text: "FIT HAS LORE", tone: "accent", rot: 7 },
      stats: [
        { k: "Silhouette", v: 90 },
        { k: "Proportions", v: 88 },
        { k: "Fit", v: 93 },
        { k: "Physique Match", v: 89 },
      ],
    },
    receipt: {
      no: "0xC10E",
      rows: [
        { k: "Dating Score", v: "9.1 / 10", cls: "good" },
        { k: "Aura Gained", v: "+610", cls: "good" },
        { k: "Lover-Boy Prob.", v: "88%", cls: "good" },
        { k: "Commitment Risk", v: "LOW", cls: "good" },
        { k: "Ghosting Potential", v: "12%", cls: "" },
        { k: "Main-Char Energy", v: "94%", cls: "good" },
      ],
      subtotal: ["6 metrics analyzed", "1 credit"],
      verdict: "GREEN FLAG",
      punch: "CERTIFIED LOVER BOY",
      seal: ["FITAURA", "VERIFIED"],
    },
  },

  normie: {
    key: "normie",
    chip: "VERDICT · NORMIE",
    color: "var(--cyan)",
    face: {
      eyebrow: "FACE VERDICT",
      verdict: ["CLEAN NPC", "WITH POTENTIAL"],
      sticker: { text: "PLOT RELEVANT", tone: "chrome", rot: -8 },
      stats: [
        { k: "Aura", v: 58, hot: false },
        { k: "Jaw Presence", v: 64, hot: false },
        { k: "Face Harmony", v: 70, hot: false },
        { k: "Main Character", v: 49, hot: true },
      ],
      index: "AURA INDEX 58",
    },
    outfit: {
      score: 66,
      caption: "CLEAN NPC WITH POTENTIAL",
      sticker: { text: "BUFFERING", tone: "chrome", rot: 7 },
      stats: [
        { k: "Silhouette", v: 64 },
        { k: "Proportions", v: 70 },
        { k: "Fit", v: 62 },
        { k: "Physique Match", v: 67 },
      ],
    },
    receipt: {
      no: "0x5B2D",
      rows: [
        { k: "Dating Score", v: "5.9 / 10", cls: "" },
        { k: "Aura Gained", v: "+90", cls: "" },
        { k: "Ghosting Potential", v: "MEDIUM", cls: "" },
        { k: "Commitment Risk", v: "MODERATE", cls: "" },
        { k: "Delusion Index", v: "44%", cls: "" },
        { k: "Lover-Boy Prob.", v: "52%", cls: "" },
      ],
      subtotal: ["6 metrics analyzed", "1 credit"],
      verdict: "NORMIE",
      punch: "CLEAN NPC WITH POTENTIAL",
      seal: ["FITAURA", "VERIFIED"],
    },
  },
};

/* sticker presets the swap control cycles through */
const STICKER_BANK = {
  face: [
    { text: "HEAR ME OUT", tone: "warn", rot: -8 },
    { text: "PLOT RELEVANT", tone: "chrome", rot: -8 },
    { text: "AURA FARMER", tone: "accent", rot: -8 },
    { text: "CHAD", tone: "accent", rot: -6 },
    { text: "MAIN CHARACTER", tone: "chrome", rot: -8 },
  ],
  outfit: [
    { text: "FIT HAS LORE", tone: "accent", rot: 7 },
    { text: "LET HIM COOK", tone: "accent", rot: 7 },
    { text: "NEVER COOK AGAIN", tone: "warn", rot: 7 },
    { text: "BUFFERING", tone: "chrome", rot: 7 },
    { text: "PERFORMATIVE", tone: "chrome", rot: 6 },
  ],
};

/* animated count-up number */
function useCountUp(target, run, ms = 900) {
  const [n, setN] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setN(target); return; }
    const start = performance.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * e));
      if (p >= 1) { setN(target); clearInterval(iv); }
    }, 40);
    return () => clearInterval(iv);
  }, [target, run]);
  return n;
}

function Bars({ seed = 7, count = 34, h }) {
  const bars = [];
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    const w = 1 + (x % 4);
    bars.push(<i key={i} style={{ width: w + "px", opacity: (x % 5) > 0 ? 0.85 : 0.3 }} />);
  }
  return <div className="bars" style={h ? { height: h } : null}>{bars}</div>;
}

function StickerEl({ s, hidden, kind }) {
  if (!s) return null;
  const cls = `sticker ${s.tone || ""} sticker--${kind} ${hidden ? "hidden" : "pop"}`;
  return <div className={cls} style={{ "--rot": s.rot + "deg", transform: `rotate(${s.rot}deg)` }}>{s.text}</div>;
}

function MStat({ s, run }) {
  return (
    <div className={"mstat" + (s.hot ? " hot" : "")}>
      <div className="top">
        <span className="lbl">{s.k}</span>
        <span className="val">{useCountUp(s.v, run)}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: s.v + "%" }} />
      </div>
    </div>
  );
}

/* ---------------------------- FACE CARD ---------------------------- */
function FaceCard({ data, sticker, stickerOn, run, slotId = "fitaura-face" }) {
  const f = data.face;
  return (
    <div className="asset facecard">
      <div className="glow" />
      <div className="fc-top">
        <span className="brand-tag">FITAURA</span>
        <span className="kind-tag">FACE CARD</span>
      </div>
      <div className="selfie-stage">
        <div className="selfie-ring" />
        <div className="fc-recticks"><span className="tl" /><span className="tr" /><span className="bl" /><span className="br" /></div>
        <image-slot id={slotId} shape="circle" placeholder="drop face photo"></image-slot>
        <StickerEl s={sticker} hidden={!stickerOn} kind="face" />
      </div>
      <div className="fc-verdict">
        <div className="fc-eyebrow">{f.eyebrow}</div>
        <h2 className="fc-line">{f.verdict[0]} <span className="hl">{f.verdict[1]}</span></h2>
      </div>
      <div className="fc-stats">
        {f.stats.map((s) => <MStat key={f.eyebrow + s.k} s={s} run={run} />)}
      </div>
      <div className="fc-foot">
        <span className="kind-tag">{f.index}</span>
        <div className="barcode"><Bars seed={31} count={20} /></div>
      </div>
    </div>
  );
}

/* ---------------------------- OUTFIT CARD ---------------------------- */
function OutfitCard({ data, sticker, stickerOn, run, slotId = "fitaura-outfit" }) {
  const o = data.outfit;
  const score = useCountUp(o.score, run);
  return (
    <div className="asset outfitcard">
      <div className="outfit-photo">
        <image-slot id={slotId} shape="rect" fit="cover" placeholder="drop outfit photo"></image-slot>
        <div className="scrim" />
        <div className="oc-top">
          <span className="brand-tag">FITAURA</span>
        </div>
        <div className="score-badge">
          <span className="num">{score}</span>
          <span className="sub">FIT SCORE</span>
        </div>
        <StickerEl s={sticker} hidden={!stickerOn} kind="outfit" />
        <div className="caption-bar">
          <div className="cap">{o.caption}</div>
        </div>
      </div>
      <div className="oc-body">
        <div className="oc-stats">
          {o.stats.map((s) => <MStat key={"oc" + s.k} s={s} run={run} />)}
        </div>
        <div className="oc-foot">
          <span className="kind-tag">FIT / PHYSIQUE READ</span>
          <div className="barcode"><Bars seed={88} count={20} /></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- RECEIPT ---------------------------- */
function Receipt({ data, style, sealOn, run }) {
  const r = data.receipt;
  return (
    <div className="asset receipt" data-style={style}>
      <div className="r-edge top" />
      <div className="receipt-inner">
        {sealOn && <div className="r-seal">{r.seal[0]}<br />{r.seal[1]}</div>}
        <div className="r-head">
          <div className="logo">FITAURA</div>
          <div className="sub">DATING SCORE RECEIPT</div>
        </div>
        <div className="r-meta">
          <span>NO. {r.no}</span><span>·</span><span>10 JUN 2026</span>
        </div>
        <hr className="r-dotted" />
        <div className="r-rows">
          {r.rows.map((row) => (
            <div className="r-row" key={row.k}>
              <span className="k">{row.k}</span>
              <span className="lead" />
              <span className={"v " + row.cls}>{row.v}</span>
            </div>
          ))}
        </div>
        <div className="r-subtotal"><span>{r.subtotal[0]}</span><span>{r.subtotal[1]}</span></div>
        <hr className="r-dotted" />
        <div className="r-verdict">
          <div className="lbl">CATEGORICAL VERDICT</div>
          <div className="r-stamp-big">{r.verdict}</div>
        </div>
        <div className="r-punch">
          <div className="eyebrow">— FINAL READING —</div>
          <div className="big">{r.punch}</div>
        </div>
        <div className="r-barcode">
          <Bars seed={r.no.length * 13 + 4} count={48} h="36px" />
          <span className="id">FITAURA · {r.no}</span>
        </div>
      </div>
      <div className="r-edge bottom" />
    </div>
  );
}

Object.assign(window, { FITAURA_DATA, STICKER_BANK, FaceCard, OutfitCard, Receipt, StickerEl });
