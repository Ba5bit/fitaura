import type { CSSProperties, Ref } from 'react';
import { splitPercent, type MetricGroupResult } from '@fitaura/shared';

/**
 * The Friend-vs-Friend shareable cards — a faithful port of the handoff's
 * "Result Deck v2" cards (`design_handoff_friend_vs_friend/Result Deck v2.dc.html`).
 *
 * Four layouts, two reachable per mode: a battle is single-modality, so face mode
 * shows the Face Verdict + Face Stats cards and fit mode shows the Outfit Verdict +
 * Outfit Stats cards (the deck's `view` toggle flips between the two).
 *
 * Rendered at a native 360×640 and scaled to fit by the deck stage. Photos use
 * `background-image` (NOT `<img>`) so snapdom keeps them in the exported PNG — the
 * same gotcha the duel card already works around.
 */

const CARD_W = 360;
const CARD_H = 640;

/** A flattering one-liner per metric, used by the verdict card's "reads" pills. */
const GOOD: Record<string, string> = {
  jawline: 'Sharp jawline',
  hairline: 'Clean hairline',
  rizz: 'Magnetic rizz',
  aura: 'Main-character aura',
  drip: 'Certified drip',
  physique: 'Dialed fit',
  pose: 'Owns the pose',
  confidence: 'Pure confidence',
};

const CROWN = '#ffd23f';
const INK = '#f3f6f9';

const mono = "'Space Mono', monospace";
const anton = "'Anton', sans-serif";

/** Background-image style for a contender photo (with the studio fallback gradient). */
function photo(src?: string): CSSProperties {
  return {
    backgroundImage: src ? `url("${src}")` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#1b1822',
  };
}

const FALLBACK_BG =
  'radial-gradient(60% 50% at 50% 32%, #d7c2b0, #b89683 45%, transparent 70%), linear-gradient(160deg,#3a3340,#1b1822)';

type View = 'verdict' | 'stats';
type Kind = 'face' | 'fit';

export interface VerdictShareCardProps {
  view: View;
  kind: Kind;
  group: MetricGroupResult;
  names: { a: string; b: string };
  imgs: { aFace?: string; aFit?: string; bFace?: string; bFit?: string };
  /** Contender A colour (icy) and B colour (this matchup's gold/lime/red). */
  colA: string;
  colB: string;
  cardRef?: Ref<HTMLDivElement>;
}

/** Shared derived data for both cards of a mode. */
function useShare({ group, names, imgs, colA, colB, kind }: Omit<VerdictShareCardProps, 'view' | 'cardRef'>) {
  const metrics = group.metrics;
  const { avgA, avgB, winner } = group;
  const tie = winner === 'tie';
  const winnerKey: 'a' | 'b' = winner === 'b' ? 'b' : 'a';
  const winRim = winner === 'b' ? colB : colA;
  const loseRim = winner === 'b' ? colA : colB;
  const winName = winner === 'b' ? names.b : names.a;
  const loseName = winner === 'b' ? names.a : names.b;
  const winScore = Math.max(avgA, avgB);
  const margin = Math.abs(avgA - avgB);

  const sortedFor = (key: 'a' | 'b') =>
    [...metrics].map((m) => ({ key: m.key, label: m.label, v: key === 'a' ? m.a : m.b })).sort((x, y) => y.v - x.v);
  const reads = sortedFor(winnerKey).slice(0, 3).map((r) => ({ name: GOOD[r.key] || r.label, v: r.v }));
  const statLines = sortedFor(winnerKey).slice(0, 4);

  const sub =
    kind === 'face'
      ? tie ? 'Two faces, one stalemate. Somebody blink.' : margin >= 5 ? 'Out-angled, out-glowed, out-classed.' : 'Edged the face-off and will not shut up.'
      : tie ? 'Two fits, zero agreement. Run it back.' : margin >= 5 ? 'Out-dressed in every single frame. No notes.' : 'Won the fit by a thread — and gloating anyway.';

  return {
    metrics, avgA, avgB, winner, tie, winnerKey, winRim, loseRim, winName, loseName, winScore, margin, reads, statLines, sub,
    winFace: winnerKey === 'a' ? imgs.aFace : imgs.bFace,
    loseFace: winnerKey === 'a' ? imgs.bFace : imgs.aFace,
    winFit: winnerKey === 'a' ? imgs.aFit : imgs.bFit,
    word: tie ? 'TIES' : 'HUMILIATED',
    winTag: kind === 'face' ? 'Face' : 'Fit',
    loserLine: tie ? 'Refused to concede.' : margin >= 5 ? 'Took the L in 4K.' : `Lost by ${margin}. Wants a recount.`,
    votePct: tie ? 50 : Math.min(99, 60 + margin * 6),
  };
}

const rootStyle: CSSProperties = {
  position: 'relative',
  width: CARD_W,
  height: CARD_H,
  flex: 'none',
  borderRadius: 24,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 40px 90px -30px rgba(0,0,0,0.85), 0 8px 30px -12px rgba(0,0,0,0.6)',
  background: '#0a0c11',
  color: INK,
  fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
  WebkitFontSmoothing: 'antialiased',
};

/** Gold mountain "crown" marking the winner's name on a card. */
function CrownMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={CROWN} aria-hidden="true" style={{ flex: 'none', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.55))' }}>
      <path d="M3 7l4 4 5-7 5 7 4-4v11H3z" />
    </svg>
  );
}

function TopChrome({ label }: { label: string }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 16px', pointerEvents: 'none' }}>
      <span style={{ fontWeight: 800, letterSpacing: '0.3em', fontSize: 9.5, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 8px #000' }}>FITAURA</span>
      <span style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', textShadow: '0 1px 8px #000' }}>{label}</span>
    </div>
  );
}

/** Verdict headline: WINNER · word · loser, all white. line-height is kept clear of
 * 1× so long names that wrap to multiple lines don't collide (Anton caps stick
 * together under a sub-1 line-height); a soft dark shadow keeps it legible on the
 * photo. */
function Headline({ winnerLabel, winRim, tie, size, crown }: { winnerLabel: string; winRim: string; tie: boolean; size: number; crown?: boolean }) {
  return (
    <>
      {crown && <div style={{ lineHeight: 0, margin: '4px 0 2px' }}><CrownMark size={Math.round(size * 0.74)} /></div>}
      <h2 style={{ fontFamily: anton, fontWeight: 400, margin: '6px 0 0', fontSize: size, lineHeight: 0.96, textTransform: 'uppercase', color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>
        {tie ? 'Dead heat' : (
          <>
            <span style={{ color: winRim, textShadow: `0 1px 18px color-mix(in oklab, ${winRim} 60%, transparent)` }}>{winnerLabel}</span> wins
          </>
        )}
      </h2>
    </>
  );
}

export function VerdictShareCard(props: VerdictShareCardProps) {
  const { view, kind, names, colA, colB, cardRef } = props;
  const s = useShare(props);
  const kindLabel = kind === 'face' ? 'Face' : 'Outfit';
  // Short headline "{winner} wins". Long names (that would wrap to a 2nd line) fall
  // back to the generic "Player A/B" so the headline stays a single tidy line.
  const winnerLabel = s.winName.length > 10 ? `Player ${s.winnerKey.toUpperCase()}` : s.winName;

  // ---- OUTFIT VERDICT — full-bleed winner photo + verdict + stat lines + humiliated panel
  if (view === 'verdict' && kind === 'fit') {
    return (
      <div className="vs-sharecard" ref={cardRef} style={rootStyle}>
        <div style={{ position: 'absolute', inset: 0, background: FALLBACK_BG }} />
        <div style={{ position: 'absolute', inset: 0, ...photo(s.winFit) }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,7,10,.5) 0%, transparent 22%, rgba(6,7,10,.22) 52%, rgba(6,7,10,.97) 84%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: `inset 0 0 0 2px ${s.winRim}`, pointerEvents: 'none' }} />
        <TopChrome label="Outfit · VS" />
        <div style={{ position: 'absolute', top: 48, right: 15, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#06070a', padding: '3px 8px', borderRadius: 7, background: s.winRim }}>{s.winTag}</span>
          <span style={{ fontFamily: anton, fontSize: 52, lineHeight: 0.78, color: '#fff', textShadow: '0 3px 18px #000', marginTop: 2 }}>{s.winScore}</span>
        </div>
        <div style={{ position: 'absolute', left: 17, right: 17, bottom: 16, zIndex: 5 }}>
          <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>The verdict is in</div>
          <Headline winnerLabel={winnerLabel} winRim={s.winRim} tie={s.tie} size={30} crown />
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {s.statLines.map((r) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)', width: 104, flex: 'none' }}>{r.label}</span>
                <div style={{ position: 'relative', flex: 1, height: 6, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.2)' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${r.v}%`, borderRadius: 99, background: `linear-gradient(90deg, color-mix(in oklab, ${s.winRim} 55%, #fff), ${s.winRim})` }} />
                </div>
                <span style={{ fontFamily: anton, fontSize: 19, lineHeight: 1, color: '#fff', width: 30, flex: 'none', textAlign: 'right' }}>{r.v}</span>
              </div>
            ))}
          </div>
          <HumiliatedBar loseName={s.loseName} loseRim={s.loseRim} winRim={s.winRim} winName={s.winName} votePct={s.votePct} />
        </div>
      </div>
    );
  }

  // ---- FACE VERDICT — humiliation circle card
  if (view === 'verdict' && kind === 'face') {
    return (
      <div className="vs-sharecard" ref={cardRef} style={{ ...rootStyle, display: 'flex', flexDirection: 'column', background: 'linear-gradient(175deg,#15181f,#0a0c11 72%)' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, boxShadow: `inset 0 0 0 2px ${s.winRim}`, pointerEvents: 'none', zIndex: 7 }} />
        <div style={{ position: 'relative', height: 304, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(120% 84% at 50% 16%, color-mix(in oklab, ${s.winRim} 24%, transparent), transparent 62%)` }}>
          <TopChrome label="Face · VS" />
          <div style={{ position: 'relative', width: 224, height: 224, marginTop: 8 }}>
            <span style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', zIndex: 6, color: CROWN, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.6))' }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M3 7l4 4 5-7 5 7 4-4v11H3z" /></svg>
            </span>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from 0deg, ${s.winRim}, color-mix(in oklab, ${s.winRim} 30%, #fff), ${s.winRim}, color-mix(in oklab, ${s.winRim} 10%, transparent), ${s.winRim})`, WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))' }} />
            <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 0 0 3px #0a0c11', background: FALLBACK_BG, ...photo(s.winFace) }} />
            <div style={{ position: 'absolute', right: -8, bottom: -16, zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', filter: 'drop-shadow(0 5px 12px rgba(0,0,0,.55))' }}>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#06070a', padding: '4px 11px', borderRadius: 8, background: s.winRim }}>{s.winTag}</span>
              <span style={{ fontFamily: anton, fontSize: 70, lineHeight: 0.8, color: '#fff', textShadow: '0 3px 16px #000' }}>{s.winScore}</span>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1, background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'rgba(243,246,249,0.42)' }}>The verdict is in</div>
          <Headline winnerLabel={winnerLabel} winRim={s.winRim} tie={s.tie} size={35} />
          <p style={{ margin: '9px 0 0', fontWeight: 800, fontSize: 13, lineHeight: 1.3, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'rgba(243,246,249,0.78)' }}>{s.sub}</p>
          <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(243,246,249,0.46)', marginTop: 12 }}>Most recognised</div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {s.reads.map((r, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', border: `1px solid color-mix(in oklab, ${s.winRim} 55%, transparent)`, background: `color-mix(in oklab, ${s.winRim} 20%, rgba(0,0,0,0.35))` }}>
                {r.name} <b style={{ color: s.winRim }}>{r.v}</b>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14 }}>
            <div style={{ position: 'relative', width: 68, height: 68, flex: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from 0deg, ${s.loseRim}, color-mix(in oklab, ${s.loseRim} 30%, #fff), ${s.loseRim})`, WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))' }} />
              <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', overflow: 'hidden', filter: 'grayscale(0.65)', background: FALLBACK_BG, ...photo(s.loseFace) }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: s.loseRim }}>Humiliated by {s.winName}</div>
              <div style={{ fontWeight: 800, fontSize: 21, color: '#fff', lineHeight: 1.12, marginTop: 1 }}>{s.loseName}</div>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.02em', color: 'rgba(243,246,249,0.72)', marginTop: 3 }}>{s.loserLine}</div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div style={{ fontFamily: anton, fontSize: 34, lineHeight: 0.78, color: '#fff' }}>{s.votePct}%</div>
              <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(243,246,249,0.66)' }}>backed {s.winName}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- FACE STATS — two stacked face halves, each with score + name + pills
  if (view === 'stats' && kind === 'face') {
    const halves: ('a' | 'b')[] = ['a', 'b'];
    return (
      <div className="vs-sharecard" ref={cardRef} style={{ ...rootStyle, display: 'flex', flexDirection: 'column' }}>
        {halves.map((side, i) => {
          const sideName = side === 'a' ? names.a : names.b;
          const sideScore = side === 'a' ? s.avgA : s.avgB;
          const sideCol = side === 'a' ? colA : colB;
          const isLose = s.winner !== 'tie' && (side === 'a' ? s.winner !== 'a' : s.winner !== 'b');
          const pills = [...s.metrics].map((m) => ({ label: m.label, v: side === 'a' ? m.a : m.b })).sort((x, y) => y.v - x.v).slice(0, 2);
          const face = side === 'a' ? props.imgs.aFace : props.imgs.bFace;
          return (
            <div key={side} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: FALLBACK_BG, ...photo(face) }} />
              {/* light bottom-only scrim for the text — keeps the face clear (no heavy gradient) */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(6,7,10,.85) 0%, rgba(6,7,10,.32) 22%, transparent 44%)' }} />
              {isLose && <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,7,10,0.4)', zIndex: 2 }} />}
              <div style={{ position: 'absolute', right: 18, bottom: 26, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontFamily: mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#06070a', padding: '4px 10px', borderRadius: 7, background: sideCol }}>{kindLabel}</span>
                <span style={{ fontFamily: anton, fontSize: 64, lineHeight: 0.78, color: '#fff', textShadow: '0 3px 20px #000', marginTop: 2 }}>{sideScore}</span>
              </div>
              <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, zIndex: 4 }}>
                {!isLose && s.winner !== 'tie' && <div style={{ lineHeight: 0, marginBottom: 5 }}><CrownMark size={22} /></div>}
                <span style={{ display: 'block', fontFamily: anton, fontSize: 30, lineHeight: 0.86, textTransform: 'uppercase', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.8)' }}>{sideName}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {pills.map((p) => (
                    <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 999, border: `1px solid color-mix(in oklab, ${sideCol} 60%, transparent)`, background: `color-mix(in oklab, ${sideCol} 24%, rgba(0,0,0,0.4))`, fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.94)' }}>
                      {p.label} <b style={{ color: sideCol }}>{p.v}</b>
                    </span>
                  ))}
                </div>
              </div>
              {i === 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, ${colA}, ${colB})`, boxShadow: '0 0 14px 1px rgba(255,255,255,0.22)', zIndex: 5 }} />}
            </div>
          );
        })}
        <TopChrome label="Face · VS" />
      </div>
    );
  }

  // ---- OUTFIT STATS — two side-by-side fit photos + comparative split bars
  const winnerName = s.winner === 'tie' ? 'Dead heat' : s.winName;
  return (
    <div className="vs-sharecard" ref={cardRef} style={{ ...rootStyle, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 404, flex: 'none', display: 'flex' }}>
        {(['a', 'b'] as const).map((side) => {
          const fit = side === 'a' ? props.imgs.aFit : props.imgs.bFit;
          const sideCol = side === 'a' ? colA : colB;
          const sideScore = side === 'a' ? s.avgA : s.avgB;
          return (
            <div key={side} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: FALLBACK_BG, ...photo(fit) }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,7,10,.45) 0%, transparent 34%, transparent 56%, rgba(6,7,10,.95) 100%)' }} />
              <div style={{ position: 'absolute', [side === 'a' ? 'left' : 'right']: 12, bottom: 11, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: side === 'a' ? 'flex-start' : 'flex-end' }}>
                {s.winner !== 'tie' && s.winnerKey === side && <div style={{ lineHeight: 0, marginBottom: 4 }}><CrownMark size={24} /></div>}
                <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#06070a', padding: '4px 11px', borderRadius: 7, background: sideCol }}>Player {side.toUpperCase()}</span>
                <span style={{ fontFamily: anton, fontSize: 56, lineHeight: 0.78, color: '#fff', textShadow: '0 3px 16px #000' }}>{sideScore}</span>
              </div>
            </div>
          );
        })}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, transform: 'translateX(-0.75px)', background: `linear-gradient(180deg, ${colA}, ${colB})`, boxShadow: '0 0 16px 1px rgba(255,255,255,0.22)', zIndex: 3 }} />
        <TopChrome label={`${kindLabel} · VS`} />
      </div>
      <div style={{ textAlign: 'center', padding: '11px 18px 2px' }}>
        <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'rgba(243,246,249,0.4)' }}>{kindLabel} winner</div>
        <h2 style={{ fontFamily: anton, fontWeight: 400, margin: '3px 0 0', fontSize: 27, lineHeight: 0.84, textTransform: 'uppercase', color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>{winnerName}</h2>
      </div>
      <div style={{ flex: 1, padding: '10px 18px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {s.metrics.slice(0, 4).map((m) => {
          const p = splitPercent(m.a, m.b);
          const aWin = m.a >= m.b;
          const num = (col: string, win: boolean, align: 'left' | 'right'): CSSProperties => ({ fontFamily: anton, fontSize: 18, lineHeight: 1, width: 32, flex: 'none', textAlign: align, color: col, opacity: win ? 1 : 0.4 });
          return (
            <div key={m.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={num(colA, aWin, 'left')}>{m.a}</span>
                <span style={{ flex: 1, textAlign: 'center', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(243,246,249,0.5)' }}>{m.label}</span>
                <span style={num(colB, !aWin, 'right')}>{m.b}</span>
              </div>
              <div style={{ position: 'relative', height: 6, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginTop: 4 }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.a}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${colA} 55%, #fff), ${colA})`, borderRadius: '99px 0 0 99px' }} />
                <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${p.b}%`, background: `linear-gradient(90deg, ${colB}, color-mix(in oklab, ${colB} 55%, #fff))`, borderRadius: '0 99px 99px 0' }} />
                <span style={{ position: 'absolute', top: -2, bottom: -2, left: `${p.a}%`, width: 2, transform: 'translateX(-1px)', background: '#fff', boxShadow: '0 0 8px 1px rgba(255,255,255,.7)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The "humiliated" pill at the bottom of the outfit verdict card. */
function HumiliatedBar({ loseName, loseRim, winRim, winName, votePct }: { loseName: string; loseRim: string; winRim: string; winName: string; votePct: number }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 13, background: 'rgba(0,0,0,0.5)', border: `1px solid color-mix(in oklab, ${winRim} 60%, transparent)`, boxShadow: `0 0 30px -10px ${winRim}, inset 0 0 0 1px rgba(255,255,255,0.04)` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: loseRim }}>Humiliated</div>
        <div style={{ fontFamily: anton, fontSize: 27, lineHeight: 0.9, textTransform: 'uppercase', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loseName}</div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div style={{ fontFamily: anton, fontSize: 32, lineHeight: 0.78, color: winRim, textShadow: `0 0 20px color-mix(in oklab, ${winRim} 60%, transparent)` }}>{votePct}%</div>
        <div style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>backed {winName}</div>
      </div>
    </div>
  );
}
