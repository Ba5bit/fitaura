import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeBattle,
  generateMetrics,
  splitPercent,
  summarizeBattle,
  winnerOf,
  type BattleSummary,
  type BattleVerdict,
  type BattleWinner,
  type CategoryRead,
  type MetricGroupResult,
  type Side,
} from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { renderCardBlob, downloadResult, shareResult } from '../../lib/exportCard';
import { battleNames, useBattle, type Battle } from '../../state/battle';
import { Crown, CrownAvatar, CrownGlyph, FlagChip, SplitBar, VersusMedallion } from './components/versusBits';
import '../../design/result-shell.css';
import '../../design/versus.css';

type Tab = 'face' | 'outfit' | 'verdict';
type CardVariant = 'face' | 'fit' | 'overall';

const ACCENT_HEX: Record<BattleWinner, string> = { a: '#83b4ff', b: '#ff52a6', tie: '#ffcf66' };
const SIDE_VAR: Record<BattleWinner, string> = { a: 'var(--icy)', b: 'var(--magenta)', tie: 'var(--gold)' };

const TAB_LABEL: Record<Tab, { n: string; t: string }> = {
  face: { n: '01', t: 'Face' },
  outfit: { n: '02', t: 'Outfit' },
  verdict: { n: '03', t: 'Verdict' },
};

function whoLabel(winner: BattleWinner, names: { a: string; b: string }): string {
  return winner === 'a' ? names.a : winner === 'b' ? names.b : 'Dead heat';
}

/** Deterministic barcode bar widths for a share-card footer. */
const BARS = Array.from({ length: 28 }, (_, i) => 1 + ((i * 7) % 4));

/** One side's column of a face/outfit comparison. */
function Column({
  side,
  category,
  name,
  photo,
  group,
}: {
  side: Side;
  category: 'face' | 'fit';
  name: string;
  photo?: string;
  group: MetricGroupResult;
}) {
  const score = side === 'a' ? group.avgA : group.avgB;
  const crowned = group.winner === side;
  const state = group.winner === side ? 'win' : group.winner === 'tie' ? 'tie' : 'lose';
  const leads = group.metrics.filter((m) => (side === 'a' ? m.a > m.b : m.b > m.a)).slice(0, 2);
  const top = [...group.metrics].sort((a, b) => (side === 'a' ? b.a - a.a : b.b - a.b)).slice(0, 3);

  return (
    <div className="vs-col vs-c" data-side={side} data-state={state}>
      {category === 'face' ? (
        <CrownAvatar photo={photo} crowned={crowned} name={name} />
      ) : (
        <div className="vs-fitwrap">
          {crowned && <Crown />}
          <div className="vs-fitframe">
            {photo ? <img className="photo" src={photo} alt={name} /> : <span className="ph" />}
            <span className="bk tl" />
            <span className="bk tr" />
            <span className="bk bl" />
            <span className="bk br" />
          </div>
        </div>
      )}
      <div className="nm">{name}</div>
      <div className="score">
        {score}
        <small>/100</small>
      </div>
      <div className="chips">
        {leads.map((m) => (
          <FlagChip key={m.key}>{m.label}</FlagChip>
        ))}
      </div>
      <div className="vs-reads">
        <div className="h">Top reads</div>
        {top.map((m) => {
          const val = side === 'a' ? m.a : m.b;
          const bar = (
            <span className="bar">
              <i style={{ width: `${val}%` }} />
            </span>
          );
          return (
            <div className="vs-read" key={m.key}>
              {side === 'a' ? (
                <>
                  <span className="lbl">{m.label}</span>
                  {bar}
                  <span className="val">{val}</span>
                </>
              ) : (
                <>
                  <span className="val">{val}</span>
                  {bar}
                  <span className="lbl">{m.label}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A face/outfit head-to-head tab. */
function ComparisonTab({
  category,
  group,
  names,
  battle,
}: {
  category: 'face' | 'fit';
  group: MetricGroupResult;
  names: { a: string; b: string };
  battle: Battle;
}) {
  const who = whoLabel(group.winner, names);
  const title = category === 'face' ? 'Face winner' : 'Drip winner';
  const photoA = category === 'face' ? battle.imgs.aFace : battle.imgs.aFit;
  const photoB = category === 'face' ? battle.imgs.bFace : battle.imgs.bFit;
  const bannerColor = group.winner === 'a' ? 'var(--icy)' : group.winner === 'b' ? 'var(--magenta)' : undefined;

  return (
    <div className="vs-deckpanel">
      <div
        className={'vs-banner' + (group.winner === 'tie' ? ' tie' : '')}
        style={bannerColor ? ({ ['--bc']: bannerColor } as CSSProperties) : undefined}
      >
        <CrownGlyph />
        {group.winner === 'tie' ? <span>Dead heat</span> : <span>{title}</span>}
        {group.winner !== 'tie' && <b>{who}</b>}
      </div>

      <div className="vs-deck">
        <Column side="a" category={category} name={names.a} photo={photoA} group={group} />
        <div className="vs-center">
          <div className="vstitle">VS</div>
          <div className="h2h">Head-to-head</div>
          <div className="vs-splits">
            {group.metrics.map((m) => (
              <SplitBar key={m.key} label={m.label} a={m.a} b={m.b} win={winnerOf(m.a, m.b)} />
            ))}
          </div>
        </div>
        <Column side="b" category={category} name={names.b} photo={photoB} group={group} />
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

/** A single share/export card (photo band + verdict body). */
function BattleCard({
  variant,
  battle,
  names,
  verdict,
  summary,
  cardRef,
}: {
  variant: CardVariant;
  battle: Battle;
  names: { a: string; b: string };
  verdict: BattleVerdict;
  summary: BattleSummary;
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
  const where = variant === 'overall' ? 'across the board' : variant === 'face' ? 'on the face-off' : 'on the fit';
  const tagline = winner === 'tie' ? 'Too close to call — a dead heat.' : `${who} takes the crown ${where}.`;

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
        <div className="medal-anchor">
          <VersusMedallion small />
        </div>
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
        <div className="wl">{winner === 'tie' ? 'Dead heat' : 'Overall winner'}</div>
        <div className={'wn' + (winner === 'tie' ? ' gold' : '')}>{winner === 'tie' ? 'Dead heat' : who}</div>
        <div className="tag">{tagline}</div>
        {variant === 'overall' && verdict.face && verdict.fit && (
          <div className="boxes">
            <div className="box">
              <div className="bv">{summary.marginPts}</div>
              <div className="bk">Margin</div>
            </div>
            <div className="box">
              <div className="bv">{verdict.face.avgA}-{verdict.face.avgB}</div>
              <div className="bk">Face</div>
            </div>
            <div className="box">
              <div className="bv">{verdict.fit.avgA}-{verdict.fit.avgB}</div>
              <div className="bk">Outfit</div>
            </div>
          </div>
        )}
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
  const lc = read.leader === 'a' ? 'var(--icy)' : 'var(--magenta)';
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
  onRematch,
}: {
  battle: Battle;
  names: { a: string; b: string };
  verdict: BattleVerdict;
  onRematch: () => void;
}) {
  const summary = useMemo(() => summarizeBattle(verdict), [verdict]);
  const cards: CardVariant[] =
    battle.mode === 'both' ? ['face', 'fit', 'overall'] : battle.mode === 'face' ? ['face'] : ['fit'];
  const [idx, setIdx] = useState(cards.length - 1);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const overall = verdict.overall;
  const who = whoLabel(overall.winner, names);
  const otherName = overall.winner === 'a' ? names.b : names.a;
  const catsWon = overall.winner === 'a' ? summary.categoriesA : summary.categoriesB;
  const metricsWon = overall.winner === 'a' ? summary.metricsWonA : summary.metricsWonB;
  const catLabel = summary.categoryCount === 2 ? 'Face · Outfit' : battle.mode === 'face' ? 'Face' : 'Outfit';

  const copy =
    overall.winner === 'tie'
      ? `${names.a} and ${names.b} are neck and neck — the scores land in a dead heat.`
      : `${who} edges ${otherName} by ${summary.marginPts} point${summary.marginPts === 1 ? '' : 's'}, taking ${catsWon} of ${summary.categoryCount} categor${summary.categoryCount === 1 ? 'y' : 'ies'} and ${metricsWon} of ${summary.metricsTotal} metrics.${summary.marginPts <= 4 ? ' Close enough that a restyle could flip it.' : ''}`;

  async function buildCard() {
    if (!cardRef.current) return null;
    const out = await renderCardBlob({ el: cardRef.current, kind: 'face', verdict: 'green_flag', accentHex: ACCENT_HEX[overall.winner] });
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
          <BattleCard variant={cards[idx]} battle={battle} names={names} verdict={verdict} summary={summary} cardRef={cardRef} />
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

        <p className="copy">{copy}</p>

        <div className="vs-catchips">
          {verdict.face && <CatChip label="Face" group={verdict.face} overallWinner={overall.winner} names={names} />}
          {verdict.fit && <CatChip label="Outfit" group={verdict.fit} overallWinner={overall.winner} names={names} />}
        </div>

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
  const { battle, hydrated, clear } = useBattle();

  const names = battleNames(battle);
  const verdict = useMemo<BattleVerdict | null>(() => {
    if (!battle) return null;
    const seed = `${names.a}|${names.b}`;
    const { face, fit } = generateMetrics(seed);
    return computeBattle({ mode: battle.mode, face, fit });
  }, [battle, names.a, names.b]);

  const tabs: Tab[] = useMemo(() => {
    if (!battle) return [];
    if (battle.mode === 'face') return ['face', 'verdict'];
    if (battle.mode === 'fit') return ['outfit', 'verdict'];
    return ['face', 'outfit', 'verdict'];
  }, [battle]);
  const [tab, setTab] = useState<Tab>('face');
  const activeTab = tabs.includes(tab) ? tab : tabs[0];

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
    <div className="rs-app">
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
          <button className="rs-newscan" onClick={() => navigate('/vault')}>
            <Icon.grid />
            <span>Vault</span>
          </button>
          <button className="rs-newscan" onClick={rematch}>
            <Icon.plus />
            <span>New battle</span>
          </button>
        </div>
      </header>

      {/* Nav — tabs + stepper, same as Solo. */}
      <nav className="rs-nav">
        <div className="rs-tabs" role="tablist" aria-label="Result sections">
          {tabs.map((t) => (
            <button key={t} className="tab" role="tab" aria-selected={activeTab === t} onClick={() => setTab(t)}>
              <span className="n">{TAB_LABEL[t].n}</span>
              {TAB_LABEL[t].t.toUpperCase()}
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

      <main className="vs-wrap" style={{ paddingTop: 22 }}>
        {activeTab === 'face' && verdict.face && (
          <ComparisonTab category="face" group={verdict.face} names={names} battle={battle} />
        )}
        {activeTab === 'outfit' && verdict.fit && (
          <ComparisonTab category="fit" group={verdict.fit} names={names} battle={battle} />
        )}
        {activeTab === 'verdict' && <VerdictTab battle={battle} names={names} verdict={verdict} onRematch={rematch} />}
      </main>
    </div>
  );
}
