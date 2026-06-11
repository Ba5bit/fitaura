// result-analysis.jsx — supporting in-app analysis blocks for the result shell.
// Face Analysis Block (ring + thin bars + stat rows + roast, glass),
// Outfit Analysis Block, Receipt final-summary controls.
// Depends on FITAURA_DATA (cards.jsx). Exports to window.
const { useEffect: useEffectRA, useRef: useRefRA, useState: useStateRA } = React;

/* Authored reads + tags per verdict (Outfit / Receipt keep the lighter style). */
const RESULT_READS = {
  red_flag: {
    outfit: "Gym bro cosplaying as editorial. The physique match is genuinely unfair — the proportions are a cry for help wearing a nice fit.",
    summary:"High aura, questionable commitment. Posts like a green flag, behaves like a plot twist. Date at your own risk; archive the receipt for evidence.",
    outfitTags:[["physique > fit","good"],["tried something","good"],["proportions need help","bad"]],
  },
  green_flag: {
    outfit: "Let him cook. Fit, physique and proportions are in a group chat and, for once, they all agree on the plan.",
    summary:"Face and fit both cooperated. Low ghosting risk, high lover-boy probability — the rare scan that survives a second look. Frame it.",
    outfitTags:[["cohesive fit","good"],["proportions locked","good"],["repeat offender","good"]],
  },
  normie: {
    outfit: "Safe to the point of stealth. Fits fine, reads fine, and is forgotten by the time the next slide loads. Inoffensive is a choice.",
    summary:"Clean NPC with upside. No red flags, no fireworks — a respectable mid that wins on consistency. One bold move from a re-rate.",
    outfitTags:[["stealth fit","good"],["low risk","good"],["one bold move away","bad"]],
  },
};

/* Face Analysis — aura ring + one explanation + one roast, then a gym-app
   "Score Breakdown" grid of trait cards (icon · score · tier · descriptor · bar). */
const FACE_ANALYSIS = {
  red_flag: {
    aura: 71, verdict: "RED FLAG",
    read: "Top-tier jaw, mid-tier everything else. The aura is real — it is just renting space on a face that peaks at exactly one angle.",
    roast: "Devastating in photos, a structural liability in person. Hear me out.",
    breakdown: [
      { k: "Jaw Presence",   v: 84, d: "Sharp",      ic: "jaw" },
      { k: "Face Harmony",   v: 63, d: "Off-axis",   ic: "harmony" },
      { k: "Visual Presence",v: 70, d: "Magnetic",   ic: "eye" },
      { k: "Eyebrows",       v: 78, d: "Expressive", ic: "brow" },
      { k: "Facial Hair",    v: 52, d: "Patchy",     ic: "beard" },
      { k: "Main Character", v: 55, d: "Side quest",  ic: "star" },
    ],
  },
  green_flag: {
    aura: 92, verdict: "GREEN FLAG",
    read: "Everything cooperated at once. Symmetry, structure and aura all showed up to the same meeting and, shockingly, agreed.",
    roast: "Annoyingly well-assembled. No notes — which is itself a little suspicious.",
    breakdown: [
      { k: "Jaw Presence",   v: 88, d: "Carved",     ic: "jaw" },
      { k: "Face Harmony",   v: 90, d: "Balanced",   ic: "harmony" },
      { k: "Visual Presence",v: 93, d: "Commanding", ic: "eye" },
      { k: "Eyebrows",       v: 86, d: "Elite",      ic: "brow" },
      { k: "Facial Hair",    v: 84, d: "Intentional",ic: "beard" },
      { k: "Main Character", v: 94, d: "Lead role",  ic: "star" },
    ],
  },
  normie: {
    aura: 58, verdict: "NORMIE",
    read: "Clean, balanced, completely unbothered. Nothing misfires — nothing detonates either. The face equivalent of a reliable mid.",
    roast: "Would pass a vibe check and be forgotten by the next slide. Respectable buffering.",
    breakdown: [
      { k: "Jaw Presence",   v: 64, d: "Soft",       ic: "jaw" },
      { k: "Face Harmony",   v: 70, d: "Even",       ic: "harmony" },
      { k: "Visual Presence",v: 61, d: "Quiet",      ic: "eye" },
      { k: "Eyebrows",       v: 66, d: "Fine",       ic: "brow" },
      { k: "Facial Hair",    v: 60, d: "Optional",   ic: "beard" },
      { k: "Main Character", v: 49, d: "Background",  ic: "star" },
    ],
  },
};

function capFor(v){
  if (v >= 88) return "ELITE";
  if (v >= 78) return "STRONG";
  if (v >= 66) return "SOLID";
  if (v >= 55) return "PASSABLE";
  return "NEEDS WORK";
}
function bestWorst(stats){
  let best = stats[0], worst = stats[0];
  for (const s of stats){ if (s.v > best.v) best = s; if (s.v < worst.v) worst = s; }
  return { best, worst };
}

/* count-up via setInterval (survives iframe rAF throttling) */
function useCountUpRA(target, run, ms = 1000){
  const [n, setN] = useStateRA(run ? 0 : target);
  useEffectRA(() => {
    if (!run){ setN(target); return; }
    const start = performance.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * e));
      if (p >= 1){ setN(target); clearInterval(iv); }
    }, 40);
    return () => clearInterval(iv);
  }, [target, run]);
  return n;
}

/* gym-app score ring — fill is driven by the JS count-up (no CSS transition to freeze) */
function ScoreRing({ value, label, run, size = 120, stroke = 9 }){
  const n = useCountUpRA(value, run);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - n / 100);
  const c = size / 2;
  return (
    <div className="rs-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-bg" cx={c} cy={c} r={r} strokeWidth={stroke} fill="none" />
        <circle className="ring-fg" cx={c} cy={c} r={r} strokeWidth={stroke} fill="none"
                strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`}
                style={{ strokeDasharray: C, strokeDashoffset: offset }} />
      </svg>
      <div className="rs-ring-c"><span className="num">{n}</span><span className="lbl">{label}</span></div>
    </div>
  );
}

/* thin bar — rendered at target width (always visible) */
function TraitRow({ s }){
  return (
    <div className={"rs-trait" + (s.hot ? " hot" : "")}>
      <div className="top">
        <span className="nm">{s.k} <span className="cap">· {capFor(s.v)}</span></span>
        <span className="val">{s.v}</span>
      </div>
      <div className="track"><div className="fill" style={{ width: s.v + "%" }} /></div>
    </div>
  );
}

/* score tier (gym-app style) */
function tierOf(v){ return v >= 78 ? "high" : v >= 60 ? "mid" : "low"; }
const TIER_LABEL = { high: "HIGH", mid: "MID", low: "LOW" };

/* simple geometric trait icons */
function GIcon({ name }){
  const paths = {
    jaw:     <path d="M5 5v6a7 7 0 0 0 14 0V5" />,
    harmony: <g><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></g>,
    eye:     <g><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.4" /></g>,
    brow:    <path d="M4 14c3-5 13-5 16 0" />,
    beard:   <path d="M6 7c0 8 3 11 6 11s6-3 6-11" />,
    star:    <path d="M12 3l2.3 6.2L21 11l-6.7 1.8L12 21l-2.3-8.2L3 11l6.7-1.8z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.star}</svg>
  );
}

/* gym-app "Score Breakdown" trait card */
function GymCard({ k, v, d, ic, run }){
  const tier = tierOf(v);
  const n = useCountUpRA(v, run);
  return (
    <div className="gym-card" data-tier={tier}>
      <div className="gc-top">
        <span className="gc-ico"><GIcon name={ic} /></span>
        <div className="gc-score">
          <span className="num">{n}</span>
          <span className="tier">{TIER_LABEL[tier]}</span>
        </div>
      </div>
      <div className="gc-name">{k}</div>
      <div className="gc-desc">{d}</div>
      <div className="gc-bar"><i style={{ width: v + "%" }} /></div>
    </div>
  );
}

/* ---------------------------- FACE ANALYSIS BLOCK ---------------------------- */
function FaceAnalysis({ verdict, run }){
  const fa = FACE_ANALYSIS[verdict] || FACE_ANALYSIS.red_flag;
  return (
    <>
      <section className="rs-block glass hero">
        <div className="rs-eyebrow">IN-APP BREAKDOWN · FACE</div>
        <div className="rs-facehead">
          <ScoreRing value={fa.aura} label="AURA" run={run} />
          <div className="meta">
            <span className="rs-facestamp">{fa.verdict}</span>
            <p className="rs-read">{fa.read}</p>
          </div>
        </div>
        <div className="rs-roast">
          <span className="q">&ldquo;</span>
          <div><div className="re">The roast</div><p>{fa.roast}</p></div>
        </div>
      </section>

      <section className="rs-block glass">
        <h3 className="rs-blocktitle">Score breakdown <span className="n">{fa.breakdown.length} categories</span></h3>
        <div className="rs-breakgrid">
          {fa.breakdown.map(b => <GymCard key={b.k} k={b.k} v={b.v} d={b.d} ic={b.ic} run={run} />)}
        </div>
      </section>
    </>
  );
}

/* ---------------------------- OUTFIT ANALYSIS BLOCK ---------------------------- */
function OutfitAnalysis({ data, verdict, run }){
  const o = data.outfit;
  const reads = RESULT_READS[verdict];
  const { best, worst } = bestWorst(o.stats);
  return (
    <>
      <section className="rs-block hero">
        <div className="rs-eyebrow">IN-APP BREAKDOWN · OUTFIT</div>
        <div className="rs-scorehead">
          <div>
            <div className="rs-scorenum">{useCountUpRA(o.score, run)}<span className="u">/100</span></div>
            <div className="rs-scorelbl">FIT SCORE</div>
          </div>
          <div className="rs-verdictbadge"><span className="vstamp" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>{o.caption}</span></div>
        </div>
        <p className="rs-read">{reads.outfit}</p>
        <div className="rs-tags">
          <span className="rs-tag good">Best · {best.k}</span>
          <span className="rs-tag bad">Watch · {worst.k}</span>
          {reads.outfitTags.map(([t, tone]) => <span key={t} className={"rs-tag " + (tone === "good" ? "good" : "bad")}>{t}</span>)}
        </div>
      </section>
      <section className="rs-block">
        <h3 className="rs-blocktitle">Fit &amp; physique read <span className="n">4 metrics</span></h3>
        <div className="rs-traits">
          {o.stats.map(s => <TraitRow key={s.k} s={s} />)}
        </div>
      </section>
    </>
  );
}

/* ---------------------------- RECEIPT FINAL SUMMARY ---------------------------- */
function ReceiptSummary({ data, verdict, run, onExportAll, onShare, onSaveHistory, onNewScan }){
  const r = data.receipt;
  const reads = RESULT_READS[verdict];
  const score = (r.rows.find(x => /dating score/i.test(x.k)) || {}).v || "—";
  const scoreNum = score.split("/")[0].trim();
  return (
    <>
      <section className="rs-block hero rs-summary">
        <div className="rs-eyebrow">FINAL SUMMARY</div>
        <div className="rs-scorehead">
          <div>
            <div className="rs-scorenum">{scoreNum}<span className="u">/10</span></div>
            <div className="rs-scorelbl">DATING SCORE</div>
          </div>
          <div className="rs-verdictbadge"><span className="vstamp">{r.verdict}</span></div>
        </div>
        <p className="rs-read"><span className="hl">{r.punch}.</span> {reads.summary}</p>
        <div className="rs-summary-actions">
          <button className="rs-bigbtn primary" onClick={onExportAll}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export all 3 cards
          </button>
          <button className="rs-bigbtn" onClick={onShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a3 3 0 10-2.8-4M6 15a3 3 0 100 6 3 3 0 000-6zM18 19a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            Share verdict
          </button>
          <button className="rs-bigbtn" onClick={onSaveHistory}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
            Save to history
          </button>
          <button className="rs-bigbtn danger" onClick={onNewScan}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></svg>
            New scan · uses 1 credit
          </button>
        </div>
        <div className="rs-summary-foot">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Photos never stored on our servers · result lives on this device
        </div>
      </section>
    </>
  );
}

Object.assign(window, { FaceAnalysis, OutfitAnalysis, ReceiptSummary, FACE_ANALYSIS, RESULT_READS });
