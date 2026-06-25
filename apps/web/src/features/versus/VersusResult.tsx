import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeBattle,
  generateMetrics,
  splitPercent,
  summarizeBattle,
  winnerOf,
  type BattleVerdict,
  type BattleWinner,
  type CategoryRead,
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
  SuperlativesRow,
} from './components/versusBits';
import '../../design/result-shell.css';
import '../../design/versus.css';

type Tab = 'face' | 'outfit' | 'verdict';
type CardVariant = 'face' | 'fit' | 'overall';

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

/** Deterministic barcode bar widths for a share-card footer. */
const BARS = Array.from({ length: 28 }, (_, i) => 1 + ((i * 7) % 4));

/** A side's two strongest metrics as `{label, value}` chips (own score, descending). */
function topMetricChips(metrics: Metric[], side: Side): { key: string; label: string; value: number }[] {
  return [...metrics]
    .sort((m1, m2) => (side === 'a' ? m2.a - m1.a : m2.b - m1.b))
    .slice(0, 2)
    .map((m) => ({ key: m.key, label: m.label, value: side === 'a' ? m.a : m.b }));
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
  const nameBlock = (
    <>
      <div className="plabel">Player {side === 'a' ? 'A' : 'B'}</div>
      <div className="nm">{name}</div>
    </>
  );
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

/** A two-toned face/outfit bar inside a share card. */
function CardBar({ label, a, b }: { label: string; a: number; b: number }) {
  const p = splitPercent(a, b);
  return (
    <div className="cbar">
      <div className="l">
        <span className="a">{a}</span>
        <span className="x">{label}</span>
        <span className="b">{b}</span>
      </div>
      <div className="vs-track">
        <span className="fa" style={{ width: `${p.a}%` }} />
        <span className="fb" style={{ width: `${p.b}%` }} />
        <span className="divline" style={{ left: `${p.a}%` }} />
      </div>
    </div>
  );
}

/** A single share/export card (photo band + name + stats). */
function BattleCard({
  variant,
  battle,
  names,
  verdict,
  cardRef,
}: {
  variant: CardVariant;
  battle: Battle;
  names: { a: string; b: string };
  verdict: BattleVerdict;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const split = variant === 'face' ? 'h' : 'v';
  const group = variant === 'face' ? verdict.face : variant === 'fit' ? verdict.fit : null;
  const winner = variant === 'overall' ? verdict.overall.winner : group?.winner ?? 'tie';
  const avgA = variant === 'overall' ? verdict.overall.avgA : group?.avgA ?? 0;
  const avgB = variant === 'overall' ? verdict.overall.avgB : group?.avgB ?? 0;
  const photoA = variant === 'face' ? battle.imgs.aFace : variant === 'fit' ? battle.imgs.aFit : battle.imgs.aFit ?? battle.imgs.aFace;
  const photoB = variant === 'face' ? battle.imgs.bFace : variant === 'fit' ? battle.imgs.bFit : battle.imgs.bFit ?? battle.imgs.bFace;
  const kind = variant === 'face' ? 'Face · VS · 01' : variant === 'fit' ? 'Fit · VS · 02' : 'Overall · VS · 03';
  const who = whoLabel(winner, names);
  const wlText =
    winner === 'tie'
      ? 'Dead heat'
      : variant === 'face'
        ? 'Face winner'
        : variant === 'fit'
          ? 'Outfit winner'
          : 'Overall winner';

  // FACE card — "duel" layout: two stacked photo halves, each carrying its own
  // score, name and top-2 metric chips. The winning half reads in its contender
  // colour (icy A / gold B) while the loser greys out. No VS medallion.
  if (variant === 'face' && verdict.face) {
    const g = verdict.face;
    const halves = [
      { side: 'a' as Side, name: names.a, photo: photoA, score: g.avgA },
      { side: 'b' as Side, name: names.b, photo: photoB, score: g.avgB },
    ];
    return (
      <div className="vs-card is-duel" ref={cardRef}>
        <div className="cardtop">
          <span className="wm">Fitaura</span>
          <span className="kindwrap">
            <span className="kind">Face · VS</span>
            <CrownGlyph size={13} />
          </span>
        </div>
        {halves.map((h) => {
          const state = g.winner === h.side ? 'win' : g.winner === 'tie' ? 'tie' : 'lose';
          return (
            <div key={h.side} className={'dhalf ' + h.side} data-state={state}>
              <div
                className="photo"
                role="img"
                aria-label={h.name}
                style={h.photo ? { backgroundImage: `url("${h.photo}")` } : undefined}
              >
                {!h.photo && <span className="ph" />}
              </div>
              <span className="dscrim" />
              <div className="dside">
                <div className="sc">{h.score}</div>
                <div className="lab">{h.side === 'a' ? 'Player A' : 'Player B'}</div>
                <div className="nm">{h.name}</div>
                <div className="chips">
                  {topMetricChips(g.metrics, h.side).map((c) => (
                    <span key={c.key} className="dchip">
                      {c.label} <b>{c.value}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <span className="corner" />
      </div>
    );
  }

  return (
    <div className="vs-card" ref={cardRef}>
      <div className="cphoto">
        <div className="duo" data-split={split}>
          <div className="half" data-side="a" role="img" aria-label={names.a} style={photoA ? { backgroundImage: `url("${photoA}")` } : undefined}>
            {!photoA && <span className="ph" />}
          </div>
          <div className="half" data-side="b" role="img" aria-label={names.b} style={photoB ? { backgroundImage: `url("${photoB}")` } : undefined}>
            {!photoB && <span className="ph" />}
          </div>
        </div>
        <span className="scrim" />
        <div className="cardtop">
          <span className="wm">Fitaura</span>
          <span className="kind">{kind}</span>
        </div>
        <div className="pscore a">
          A · {names.a}
          <span className="v">{avgA}</span>
        </div>
        <div className="pscore b">
          B · {names.b}
          <span className="v">{avgB}</span>
        </div>
      </div>

      <div className="cbody">
        <div className="wl">{wlText}</div>
        <div className="wn">{winner === 'tie' ? 'Dead heat' : who}</div>
        <div className="cbars">
          {variant !== 'fit' && verdict.face && <CardBar label="Face" a={verdict.face.avgA} b={verdict.face.avgB} />}
          {variant !== 'face' && verdict.fit && <CardBar label="Outfit" a={verdict.fit.avgA} b={verdict.fit.avgB} />}
        </div>
      </div>

      <div className="cfoot">
        <span className="url">fitaura.studio</span>
        <div className="barcode">
          {BARS.map((w, i) => (
            <i key={i} style={{ width: w }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A "category winner" chip — green if that category's winner is the overall winner, else red. */
function CatChip({
  label,
  group,
  overallWinner,
  names,
}: {
  label: string;
  group: MetricGroupResult;
  overallWinner: BattleWinner;
  names: { a: string; b: string };
}) {
  if (group.winner === 'tie') return <FlagChip tone="gold">{label} · dead heat</FlagChip>;
  const who = group.winner === 'a' ? names.a : names.b;
  const tone = group.winner === overallWinner ? 'green' : 'red';
  return (
    <FlagChip tone={tone}>
      {who} · {label}
    </FlagChip>
  );
}

/** One "where it was won" read card. */
function WonCard({ read, names }: { read: CategoryRead; names: { a: string; b: string } }) {
  const m = read.metric;
  const p = splitPercent(m.a, m.b);
  const lc = read.leader === 'a' ? 'var(--icy)' : 'var(--gold)';
  const leadName = read.leader === 'a' ? names.a : names.b;
  return (
    <div className="vs-woncard" style={{ ['--lc']: lc } as CSSProperties}>
      <div className="top">
        <span>{read.category === 'face' ? 'Face' : 'Outfit'} · {m.label}</span>
        <span className="lead" title={leadName}>{read.leader === 'a' ? 'A leads' : 'B leads'}</span>
      </div>
      <div className="row">
        <span className="na">{m.a}</span>
        <span className="vs-track" style={{ flex: 1 }}>
          <span className="fa" style={{ width: `${p.a}%` }} />
          <span className="fb" style={{ width: `${p.b}%` }} />
          <span className="divline" style={{ left: `${p.a}%` }} />
        </span>
        <span className="nb">{m.b}</span>
      </div>
    </div>
  );
}

/** The verdict tab: swipeable card stack + rich breakdown panel. */
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
  /** AI copy, or null on the dev fallback (punchline/decisiveRead/superlatives hidden then). */
  copy?: VersusCopy | null;
  /** This battle's contender colours (for the exported card's accent). */
  palette: { a: string; b: string };
  onRematch: () => void;
}) {
  const summary = useMemo(() => summarizeBattle(verdict), [verdict]);
  const cards: CardVariant[] = battle.mode === 'face' ? ['face'] : ['fit'];
  const [idx, setIdx] = useState(cards.length - 1);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const overall = verdict.overall;
  const who = whoLabel(overall.winner, names);
  const otherName = overall.winner === 'a' ? names.b : names.a;
  const catsWon = overall.winner === 'a' ? summary.categoriesA : summary.categoriesB;
  const metricsWon = overall.winner === 'a' ? summary.metricsWonA : summary.metricsWonB;
  const catLabel = battle.mode === 'face' ? 'Face' : 'Outfit';

  const breakdownCopy =
    overall.winner === 'tie'
      ? `${names.a} and ${names.b} are neck and neck — the scores land in a dead heat.`
      : `${who} edges ${otherName} by ${summary.marginPts} point${summary.marginPts === 1 ? '' : 's'}, taking ${catsWon} of ${summary.categoryCount} categor${summary.categoryCount === 1 ? 'y' : 'ies'} and ${metricsWon} of ${summary.metricsTotal} metrics.${summary.marginPts <= 4 ? ' Close enough that a restyle could flip it.' : ''}`;

  async function buildCard() {
    if (!cardRef.current) return null;
    const out = await renderCardBlob({ el: cardRef.current, kind: 'face', verdict: 'green_flag', accentHex: overall.winner === 'b' ? palette.b : palette.a });
    out.filename = `fitaura-versus-${cards[idx]}.png`;
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

  return (
    <div className="vs-verdict">
      <div className="vs-stack">
        <div className="vs-stack-row">
          {cards.length > 1 && (
            <button className="vs-stack-nav" aria-label="Previous card" onClick={() => setIdx((i) => (i - 1 + cards.length) % cards.length)}>
              <Icon.chevronLeft />
            </button>
          )}
          <BattleCard variant={cards[idx]} battle={battle} names={names} verdict={verdict} cardRef={cardRef} />
          {cards.length > 1 && (
            <button className="vs-stack-nav" aria-label="Next card" onClick={() => setIdx((i) => (i + 1) % cards.length)}>
              <Icon.chevronRight />
            </button>
          )}
        </div>
        {cards.length > 1 && (
          <div className="vs-stack-dots">
            {cards.map((c, i) => (
              <button key={c} aria-current={i === idx} aria-label={`Card ${i + 1}`} onClick={() => setIdx(i)} />
            ))}
          </div>
        )}
        <button className="ctrl primary" onClick={download} disabled={busy} style={{ minWidth: 210 }}>
          <Icon.download /> {busy ? 'Rendering…' : 'Download card'}
        </button>
      </div>

      <div className="vs-bd" style={{ ['--c2']: SIDE_VAR[overall.winner] } as CSSProperties}>
        <div className="eyebrow">Verdict breakdown · Overall</div>
        <div className="wlabel">{overall.winner === 'tie' ? 'Dead heat' : 'Overall winner'}</div>
        <div className="whead">
          <h2>{overall.winner === 'tie' ? 'Dead heat' : who}</h2>
          <span className="vs-margin-pill">{summary.marginLabel}</span>
        </div>
        {copy?.crown.line && <p className="vs-punchline">{copy.crown.line}</p>}
        <div className="vs-scoreline">
          <div className="s a">
            <span className="nm">{names.a}</span>
            <span className="v">{overall.avgA}</span>
          </div>
          <span className="slash">/</span>
          <div className="s b">
            <span className="nm">{names.b}</span>
            <span className="v">{overall.avgB}</span>
          </div>
        </div>

        <div className="vs-statcards">
          <div className="vs-statcard">
            <div className="k">Win margin</div>
            <div className="v">
              {summary.marginPts}
              <small> pts</small>
            </div>
            <div className="s">{overall.winner === 'tie' ? 'Dead heat' : `${who} ahead`}</div>
          </div>
          <div className="vs-statcard">
            <div className="k">Categories</div>
            <div className="v">{summary.categoriesA}-{summary.categoriesB}</div>
            <div className="s">{catLabel}</div>
          </div>
          <div className="vs-statcard">
            <div className="k">Metrics won</div>
            <div className="v">
              {summary.metricsWonA}-{summary.metricsWonB}
              <small> /{summary.metricsTotal}</small>
            </div>
            <div className="s">All reads</div>
          </div>
        </div>

        <p className="copy">{copy?.decisiveRead || breakdownCopy}</p>

        <div className="vs-catchips">
          {verdict.face && <CatChip label="Face" group={verdict.face} overallWinner={overall.winner} names={names} />}
          {verdict.fit && <CatChip label="Outfit" group={verdict.fit} overallWinner={overall.winner} names={names} />}
        </div>

        {copy && <SuperlativesRow items={copy.superlatives} names={names} />}

        {summary.topReads.length > 0 && (
          <>
            <div className="vs-wonhead">Where it was won · Top {summary.topReads.length}</div>
            <div className="vs-wongrid">
              {summary.topReads.map((r) => (
                <WonCard key={r.category + r.metric.key} read={r} names={names} />
              ))}
            </div>
          </>
        )}

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

  // Clear the one-shot flag after `firstView` has captured it (effects run after the
  // initializer), so a refresh or a later vault reopen renders the final state.
  useEffect(() => {
    try {
      sessionStorage.removeItem('fvf:reveal');
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

      <main className="vs-wrap" style={{ padding: '14px 24px 18px' }}>
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
    </div>
  );
}
