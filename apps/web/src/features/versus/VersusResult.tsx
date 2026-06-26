import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeBattle,
  deriveReads,
  generateMetrics,
  summarizeBattle,
  winnerOf,
  type BattleVerdict,
  type BattleWinner,
  type DerivedRead,
  type Metric,
  type MetricGroupResult,
  type Side,
  type SideCopy,
  type VersusCopy,
} from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { useCountUp } from '../../lib/useCountUp';
import { renderCardBlob, renderPanelShot, downloadResult, shareResult } from '../../lib/exportCard';
import { battleNames, useBattle, type Battle } from '../../state/battle';
import { useAccount } from '../account/AccountContext';
import { ProfileMenu } from '../account/ProfileMenu';
import {
  Crown,
  CrownAvatar,
  CrownGlyph,
  FlagChip,
  SplitBar,
  VerdictReadRow,
} from './components/versusBits';
import { VerdictShareCard } from './components/VerdictShareCard';
import '../../design/result-shell.css';
import '../../design/versus.css';

type Tab = 'face' | 'outfit' | 'verdict';
/** Which share-card layout the deck is showing for the active mode. */
type CardView = 'verdict' | 'stats';

/** Native share-card dimensions (see VerdictShareCard); the deck scales to fit. */
const CARD_W = 360;
const CARD_H = 640;
const otherView = (v: CardView): CardView => (v === 'verdict' ? 'stats' : 'verdict');

// FvF contender palettes — drawn from Solo Scan's own semantic tokens for consistency.
// A is always Solo's brand accent (icy blue); B varies per matchup among Solo's other
// distinct accents (lime / gold / red) so each matchup looks a bit different while both
// sides keep a clear, on-brand identity. (cyan clashes with the icy A; magenta is the
// blue+pink combo the user disliked — both left out.) Applied by overriding --icy/--gold
// on the result root (see versus.css `.vs-result-app`).
const PALETTES: { a: string; b: string }[] = [
  { a: '#83b4ff', b: '#b6ff3c' }, // icy / lime
  { a: '#83b4ff', b: '#ffcf66' }, // icy / gold
  { a: '#83b4ff', b: '#ff3b49' }, // icy / red
];

/** Deterministic palette pick from the matchup, so a given battle keeps its colours
 * across refreshes (and as a saved battle) instead of flickering a new pair each view. */
function pickPalette(seed: string): { a: string; b: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}
const SIDE_VAR: Record<BattleWinner, string> = { a: 'var(--icy)', b: 'var(--gold)', tie: 'var(--ink)' };

// Display label only; the tab number is the position in the active tab list (see
// the nav), so face/outfit-only modes still read 01 → 02 with no gap.
const TAB_LABEL: Record<Tab, string> = {
  face: 'Face',
  outfit: 'Outfit',
  verdict: 'Verdict',
};

function whoLabel(winner: BattleWinner, names: { a: string; b: string }): string {
  return winner === 'a' ? names.a : winner === 'b' ? names.b : 'Dead heat';
}

/** One side's column of a face/outfit comparison. */
function Column({
  side,
  category,
  name,
  photo,
  group,
  copy,
  reveal = false,
}: {
  side: Side;
  category: 'face' | 'fit';
  name: string;
  photo?: string;
  group: MetricGroupResult;
  /** AI flex + burn for this side/category, or null on the dev fallback. */
  copy?: SideCopy | null;
  /** First-view reveal — count the big score up from 0. */
  reveal?: boolean;
}) {
  const score = side === 'a' ? group.avgA : group.avgB;
  const shownScore = useCountUp(score, reveal, 960);
  const crowned = group.winner === side;
  const state = group.winner === side ? 'win' : group.winner === 'tie' ? 'tie' : 'lose';
  const leads = group.metrics.filter((m) => (side === 'a' ? m.a > m.b : m.b > m.a)).slice(0, 2);

  // Player label + name, and the score badge — placed BELOW on the face tab (under the
  // round avatar) but OVERLAID on the photo on the outfit tab (so the column stays
  // compact and the page doesn't scroll).
  const nameBlock = <div className="nm">{name}</div>;
  const scoreBadge = (
    <div className="score">
      <span className="lbl">Score</span>
      <span className="v">
        {shownScore}
        <small>/100</small>
      </span>
    </div>
  );

  return (
    <div className="vs-col vs-c" data-side={side} data-state={state} data-cat={category}>
      {category === 'face' ? (
        <>
          <CrownAvatar photo={photo} crowned={crowned} name={name} />
          {nameBlock}
          {scoreBadge}
        </>
      ) : (
        <div className="vs-fitwrap">
          {crowned && <Crown />}
          <div className="vs-fitframe">
            {photo ? <img className="photo" src={photo} alt={name} /> : <span className="ph" />}
            <span className="fit-scrim" />
            <span className="bk tl" />
            <span className="bk tr" />
            <span className="bk bl" />
            <span className="bk br" />
            <div className="fit-tr">{scoreBadge}</div>
            <div className="fit-bl">{nameBlock}</div>
          </div>
        </div>
      )}
      <div className="chips">
        {leads.map((m) => (
          <FlagChip key={m.key}>{m.label}</FlagChip>
        ))}
      </div>
      {copy && (
        <div className="vs-sidecopy">
          <p className="super">{copy.superpower}</p>
        </div>
      )}
    </div>
  );
}

/** A face/outfit head-to-head tab. */
function ComparisonTab({
  category,
  group,
  names,
  battle,
  copy,
  palette,
  reveal = false,
  onRevealed,
}: {
  category: 'face' | 'fit';
  group: MetricGroupResult;
  names: { a: string; b: string };
  battle: Battle;
  /** AI copy, or null on the dev fallback (superpowers/roasts hidden then). */
  copy?: VersusCopy | null;
  /** This battle's contender colours — drives the exported shot's backdrop glow. */
  palette: { a: string; b: string };
  /** Play the first-view stats reveal (count-ups + staggered bar fills). */
  reveal?: boolean;
  /** Called on mount when this section reveals — so it doesn't replay on re-entry. */
  onRevealed?: () => void;
}) {
  // Freeze the reveal decision at mount: a spurious parent re-render must not flip
  // `reveal` to false mid-animation (which would snap the count-ups to final). The
  // parent's played-guard is what prevents a replay when this section is re-entered.
  const [doReveal] = useState(reveal);
  // Mark this section as played the moment it mounts revealing, so flipping tabs
  // back to it (still the just-scanned session) shows the final state, not a replay.
  useEffect(() => {
    if (doReveal) onRevealed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const who = whoLabel(group.winner, names);
  const title = category === 'face' ? 'Face winner' : 'Drip winner';
  const photoA = category === 'face' ? battle.imgs.aFace : battle.imgs.aFit;
  const photoB = category === 'face' ? battle.imgs.bFace : battle.imgs.bFit;
  const bannerColor = group.winner === 'a' ? 'var(--icy)' : group.winner === 'b' ? 'var(--gold)' : undefined;
  const copyA = copy ? copy.sides.a[category] : null;
  const copyB = copy ? copy.sides.b[category] : null;

  // Desktop-only "download this block" — the same head-to-head card people were
  // screenshotting, rasterized via snapdom on a dark backdrop. Mobile is left out
  // (the share card on the Verdict tab already carries these stats there).
  const panelRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const accentHex = group.winner === 'b' ? palette.b : palette.a;
  async function downloadShot() {
    if (busy || !panelRef.current) return;
    setBusy(true);
    try {
      const out = await renderPanelShot({
        el: panelRef.current,
        accentHex,
        filename: `fitaura-versus-${category === 'face' ? 'face' : 'outfit'}.png`,
        exclude: ['.vs-shot-btn'], // the in-panel button must not appear in the shot
      });
      downloadResult(out);
    } catch {
      /* export failed — leave the panel on screen */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vs-deckpanel" ref={panelRef}>
      <div
        className={'vs-banner' + (group.winner === 'tie' ? ' tie' : '')}
        style={bannerColor ? ({ ['--bc']: bannerColor } as CSSProperties) : undefined}
      >
        <CrownGlyph />
        {group.winner === 'tie' ? <span>Dead heat</span> : <span>{title}</span>}
        {group.winner !== 'tie' && <b>{who}</b>}
      </div>

      <div className="vs-deck">
        <Column side="a" category={category} name={names.a} photo={photoA} group={group} copy={copyA} reveal={doReveal} />
        <div className="vs-center">
          <div className="vstitle">VS</div>
          <div className="h2h">Head-to-head</div>
          <div className="vs-splits">
            {group.metrics.map((m, i) => (
              <SplitBar key={m.key} label={m.label} a={m.a} b={m.b} win={winnerOf(m.a, m.b)} reveal={doReveal} index={i} />
            ))}
          </div>
          <button className="vs-shot-btn ctrl primary" onClick={downloadShot} disabled={busy}>
            <Icon.download /> {busy ? 'Rendering…' : 'Download card'}
          </button>
        </div>
        <Column side="b" category={category} name={names.b} photo={photoB} group={group} copy={copyB} reveal={doReveal} />
      </div>
    </div>
  );
}

/** The breakdown reads as a fixed-height horizontal carousel (≈2 per slide) so the
 * panel never grows a scrollbar. Arrows + dots page through; one slide on ≤2 reads. */
function ReadsCarousel({ reads }: { reads: DerivedRead[] }) {
  const PER = 2;
  const pages: DerivedRead[][] = [];
  for (let i = 0; i < reads.length; i += PER) pages.push(reads.slice(i, i + PER));
  const [page, setPage] = useState(0);
  const at = Math.min(page, pages.length - 1);

  // Swipe between slides on touch devices (horizontal only — vertical scroll passes).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      setPage((p) => Math.max(0, Math.min(pages.length - 1, p + (dx < 0 ? 1 : -1))));
    }
  };

  return (
    <>
      <div className="vs-reads-head">
        <span className="l">Superlatives</span>
        <span className="r">Most likely to…</span>
      </div>
      <div className="vs-readslider" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="track" style={{ transform: `translateX(-${at * 100}%)` }}>
          {pages.map((grp, pi) => (
            <div className="vs-readslide" key={pi}>
              {grp.map((r) => (
                <VerdictReadRow key={r.metricKey} read={r} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {pages.length > 1 && (
        <div className="vs-readnav">
          <div className="dots">
            {pages.map((_, i) => (
              <button key={i} aria-current={i === at} aria-label={`Reads page ${i + 1}`} onClick={() => setPage(i)} />
            ))}
          </div>
          <div className="arrows">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={at === 0} aria-label="Previous reads">
              <Icon.chevronLeft />
            </button>
            <button onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))} disabled={at === pages.length - 1} aria-label="More reads">
              <Icon.chevronRight />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** The verdict tab: the share-card deck (left) + the roasted breakdown (right). */
function VerdictTab({
  battle,
  names,
  verdict,
  copy,
  palette,
  onRematch,
}: {
  battle: Battle;
  names: { a: string; b: string };
  verdict: BattleVerdict;
  /** AI copy, or null on the dev fallback (reads fall back to the static bank then). */
  copy?: VersusCopy | null;
  /** This battle's contender colours (for the exported card's accent). */
  palette: { a: string; b: string };
  onRematch: () => void;
}) {
  const summary = useMemo(() => summarizeBattle(verdict), [verdict]);
  const reads = useMemo(() => deriveReads(verdict, copy, names), [verdict, copy, names]);
  const kind: 'face' | 'fit' = battle.mode === 'face' ? 'face' : 'fit';
  const group = (kind === 'face' ? verdict.face : verdict.fit)!;
  const [view, setView] = useState<CardView>('verdict');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  // Scale the 360×640 deck to fit BOTH the column width and the available viewport
  // height, so the card never forces the page to scroll. Capped below 1 so it always
  // reads as a compact deck rather than dominating the column. Export captures the
  // unscaled card, so the PNG stays crisp.
  const [scale, setScale] = useState(0.78);
  useEffect(() => {
    const fit = () => {
      const colW = stackRef.current?.clientWidth ?? CARD_W;
      const availH = window.innerHeight - 300; // header + nav + dots + button + paddings
      const s = Math.min(colW / CARD_W, availH / CARD_H);
      setScale(Math.max(0.5, Math.min(0.78, s)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const overall = verdict.overall;
  const tie = overall.winner === 'tie';
  const who = whoLabel(overall.winner, names);

  async function buildCard() {
    if (!cardRef.current) return null;
    const out = await renderCardBlob({ el: cardRef.current, kind: 'face', verdict: 'green_flag', accentHex: overall.winner === 'b' ? palette.b : palette.a });
    out.filename = `fitaura-versus-${kind}-${view}.png`;
    return out;
  }
  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const out = await buildCard();
      if (out) downloadResult(out);
    } catch {
      /* export failed — leave the card on screen */
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const out = await buildCard();
      if (out) await shareResult(out);
    } catch {
      /* share/export failed */
    } finally {
      setBusy(false);
    }
  }

  const views: CardView[] = ['verdict', 'stats'];

  return (
    <div className="vs-verdict">
      {/* Offscreen, un-transformed, full-size copy of the ACTIVE card — the export
          capture target. Capturing the on-screen card fails because it lives inside
          the fan deck's CSS scale transforms, which makes snapdom mis-size the flex
          stats cards (clipped / stretched PNGs). This copy is plain 360×640. */}
      <div className="vs-export-offscreen" aria-hidden="true">
        <VerdictShareCard view={view} kind={kind} group={group} names={names} imgs={battle.imgs} colA={palette.a} colB={palette.b} cardRef={cardRef} />
      </div>

      {/* LEFT — the fanned share-card deck (Solo Scan card-stack logic). The other
          card splays behind; tap the front (or a peek / dot) to switch. */}
      <div className="vs-stack" ref={stackRef}>
        <div className="vs-fanwrap" style={{ width: CARD_W * scale, height: CARD_H * scale }}>
          <div className="vs-fandeck" style={{ transform: `scale(${scale})` }}>
            {views.map((v) => {
              const isFront = v === view;
              return (
                <div
                  key={v}
                  className={'vs-fancard ' + (isFront ? 'front' : 'back')}
                  aria-hidden={!isFront}
                  onClick={() => setView(isFront ? otherView(view) : v)}
                >
                  <VerdictShareCard view={v} kind={kind} group={group} names={names} imgs={battle.imgs} colA={palette.a} colB={palette.b} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="vs-stack-dots">
          {views.map((v, i) => (
            <button key={v} aria-current={view === v} aria-label={`Card ${i + 1}`} onClick={() => setView(v)} />
          ))}
        </div>
        <button className="ctrl primary" onClick={download} disabled={busy} style={{ minWidth: 210 }}>
          <Icon.download /> {busy ? 'Rendering…' : 'Download card'}
        </button>
      </div>

      {/* RIGHT — the verdict, roasted */}
      <div className="vs-bd" style={{ ['--c2']: SIDE_VAR[overall.winner] } as CSSProperties}>
        <div className="whead">
          <div>
            <div className="wlabel">{tie ? 'Dead heat' : 'Overall winner'}</div>
            <h2>{tie ? 'Dead heat' : who}</h2>
          </div>
          <span className="vs-margin-pill">{summary.marginLabel}</span>
        </div>

        <div className="rule" />

        {reads.length > 0 && <ReadsCarousel reads={reads} />}

        <div className="actions">
          <button className="ctrl" onClick={onRematch}>
            <Icon.refresh /> Rematch
          </button>
          <button className="vs-cta" onClick={share} disabled={busy}>
            <Icon.share /> Share the verdict
          </button>
        </div>
      </div>
    </div>
  );
}

/** Step 3 — the head-to-head result deck (v2). */
export function VersusResult() {
  const navigate = useNavigate();
  const { battle, result, hydrated, clear } = useBattle();
  const { credits } = useAccount();

  const names = battleNames(battle);
  // The AI copy when a stored verdict exists; null on the dev fallback (refresh
  // straight onto /versus/result), which hides the AI-only bits rather than crash.
  const copy = result?.copy ?? null;
  // This battle's contender colours — varied per matchup, stable for a given one.
  const palette = useMemo(() => pickPalette(`${names.a}|${names.b}`), [names.a, names.b]);
  const verdict = useMemo<BattleVerdict | null>(() => {
    if (!battle) return null;
    // Prefer the stored AI metrics; fall back to the deterministic seed in dev.
    let face: Metric[] | undefined;
    let fit: Metric[] | undefined;
    if (result) {
      face = result.face ?? undefined;
      fit = result.fit ?? undefined;
    } else {
      const seed = `${names.a}|${names.b}`;
      const seeded = generateMetrics(seed);
      face = seeded.face;
      fit = seeded.fit;
    }
    return computeBattle({ mode: battle.mode, face, fit });
  }, [battle, result, names.a, names.b]);

  const tabs: Tab[] = useMemo(() => {
    if (!battle) return [];
    if (battle.mode === 'face') return ['face', 'verdict'];
    if (battle.mode === 'fit') return ['outfit', 'verdict'];
    return ['face', 'outfit', 'verdict'];
  }, [battle]);
  const [tab, setTab] = useState<Tab>('face');
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

  // First-view reveal: the scan sets `fvf:reveal` right before navigating here, so
  // the stats animate exactly once after a scan — never on refresh, tab-flip, or a
  // vault reopen, and never under reduced-motion. The initializer is a PURE read
  // (idempotent across StrictMode's double-invoke); the flag is cleared in an effect
  // below so the value is captured before it's consumed.
  const [firstView] = useState(() => {
    try {
      return (
        sessionStorage.getItem('fvf:reveal') === '1' &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      );
    } catch {
      return false;
    }
  });
  // Sections that already played their reveal this session (so a tab-flip back
  // doesn't replay it).
  const playedRef = useRef<Set<string>>(new Set());

  // Mobile action bar export — captures an offscreen verdict card (the headline
  // shareable), so Save/Share work from any tab on mobile.
  const [mobileBusy, setMobileBusy] = useState(false);
  const mobileCardRef = useRef<HTMLDivElement>(null);

  // Clear the one-shot flag after `firstView` has captured it (effects run after the
  // initializer), so a refresh or a later vault reopen renders the final state.
  useEffect(() => {
    try {
      sessionStorage.removeItem('fvf:reveal');
      // Remember the mode so a browser back/forward to the Vault reopens the FvF tab
      // (router state isn't replayed by history navigation).
      sessionStorage.setItem('vault:mode', 'friend');
    } catch {
      /* sessionStorage unavailable — nothing to clear */
    }
  }, []);

  useEffect(() => {
    if (hydrated && !battle) navigate('/versus', { replace: true });
  }, [hydrated, battle, navigate]);

  if (!battle || !verdict) return <div className="vs-page" />;

  function rematch() {
    clear();
    navigate('/versus');
  }

  const idx = tabs.indexOf(activeTab);
  const go = (d: number) => setTab(tabs[(idx + d + tabs.length) % tabs.length]);
  const oWho = whoLabel(verdict.winner, names);

  // Mobile footer Save/Share — export the verdict share card (the headline) from
  // an offscreen full-size copy, so it works regardless of the active tab.
  const mobileKind: 'face' | 'fit' = battle.mode === 'face' ? 'face' : 'fit';
  const mobileGroup = (mobileKind === 'face' ? verdict.face : verdict.fit)!;
  async function buildMobileCard() {
    if (!mobileCardRef.current) return null;
    const out = await renderCardBlob({ el: mobileCardRef.current, kind: 'face', verdict: 'green_flag', accentHex: verdict.winner === 'b' ? palette.b : palette.a });
    out.filename = `fitaura-versus-${mobileKind}-verdict.png`;
    return out;
  }
  async function mobileSave() {
    if (mobileBusy) return;
    setMobileBusy(true);
    try { const o = await buildMobileCard(); if (o) downloadResult(o); } catch { /* export failed */ } finally { setMobileBusy(false); }
  }
  async function mobileShare() {
    if (mobileBusy) return;
    setMobileBusy(true);
    try { const o = await buildMobileCard(); if (o) await shareResult(o); } catch { /* share failed */ } finally { setMobileBusy(false); }
  }

  return (
    <div className="rs-app vs-result-app" style={{ ['--icy']: palette.a, ['--gold']: palette.b } as CSSProperties}>
      {/* Header — mirrors the Solo Scan result header (rs-* classes). */}
      <header className="rs-header">
        <div className="rs-h-left">
          <button className="rs-brand" onClick={() => navigate('/')} aria-label="FITAURA, back to home" title="Back to home">
            <span className="dot" />
            <span className="rs-wm">FITAURA</span>
          </button>
          <div className="rs-divider" />
          <div className="rs-resultlabel">
            FRIEND VS FRIEND
            <br />
            VERDICT · {battle.mode.toUpperCase()}
          </div>
          <div className="verdict-chip" style={{ ['--verdict']: SIDE_VAR[verdict.winner], marginLeft: 6 } as CSSProperties}>
            <span className="pulse" />
            {verdict.winner === 'tie' ? 'Dead heat' : `${oWho} wins`}
          </div>
        </div>
        <div className="rs-h-right">
          <div className="rs-saved">
            <span className="led" />
            <span>SAVED TO DEVICE</span>
          </div>
          <button className="rs-credits" onClick={() => navigate('/credits')}>
            <Icon.credit />
            <b>{credits}</b> left
          </button>
          <div className="rs-h-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="rs-newscan" onClick={() => navigate('/vault', { state: { vaultMode: 'friend' } })}>
              <Icon.grid />
              <span>Vault</span>
            </button>
            <button className="rs-newscan" onClick={rematch}>
              <Icon.plus />
              <span>New battle</span>
            </button>
            <ProfileMenu avatarClassName="rs-avatar" />
          </div>
        </div>
      </header>

      {/* Nav — tabs + stepper, same as Solo. */}
      <nav className="rs-nav">
        <div className="rs-tabs" role="tablist" aria-label="Result sections">
          {tabs.map((t, i) => (
            <button key={t} className="tab" role="tab" aria-selected={activeTab === t} onClick={() => setTab(t)}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              {TAB_LABEL[t].toUpperCase()}
            </button>
          ))}
        </div>
        <div className="rs-stepper">
          <span className="rs-count">
            <b>{String(idx + 1).padStart(2, '0')}</b> / {String(tabs.length).padStart(2, '0')}
          </span>
          <button className="rs-arrow" onClick={() => go(-1)} aria-label="Previous section">
            <Icon.chevronLeft />
          </button>
          <button className="rs-arrow" onClick={() => go(1)} aria-label="Next section">
            <Icon.chevronRight />
          </button>
        </div>
      </nav>

      <main className="vs-wrap">
        {activeTab === 'face' && verdict.face && (
          <ComparisonTab
            category="face"
            group={verdict.face}
            names={names}
            battle={battle}
            copy={copy}
            palette={palette}
            reveal={firstView && !playedRef.current.has('face')}
            onRevealed={() => playedRef.current.add('face')}
          />
        )}
        {activeTab === 'outfit' && verdict.fit && (
          <ComparisonTab
            category="fit"
            group={verdict.fit}
            names={names}
            battle={battle}
            copy={copy}
            palette={palette}
            reveal={firstView && !playedRef.current.has('fit')}
            onRevealed={() => playedRef.current.add('fit')}
          />
        )}
        {activeTab === 'verdict' && (
          <VerdictTab battle={battle} names={names} verdict={verdict} copy={copy} palette={palette} onRematch={rematch} />
        )}
      </main>

      {/* Offscreen verdict card — the mobile footer's Save/Share capture target. */}
      <div className="vs-export-offscreen" aria-hidden="true">
        <VerdictShareCard view="verdict" kind={mobileKind} group={mobileGroup} names={names} imgs={battle.imgs} colA={palette.a} colB={palette.b} cardRef={mobileCardRef} />
      </div>

      {/* Mobile action bar — mirrors the Solo Scan footer (Save / Share / New battle). */}
      <div className="rs-mobilebar">
        <button className="mb-btn" onClick={mobileSave} disabled={mobileBusy}>
          <Icon.download />
          Save
        </button>
        <button className="mb-btn" onClick={mobileShare} disabled={mobileBusy}>
          <Icon.share />
          Share
        </button>
        <button className="mb-btn primary" onClick={rematch}>
          <Icon.plus />
          New battle
        </button>
      </div>
    </div>
  );
}
