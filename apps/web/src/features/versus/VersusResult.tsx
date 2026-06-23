import { useMemo, useRef, useState, type Ref } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  computeBattle,
  generateMetrics,
  winnerOf,
  type BattleVerdict,
  type BattleWinner,
  type Metric,
  type MetricGroupResult,
  type Side,
} from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { renderCardBlob, downloadResult } from '../../lib/exportCard';
import { battleNames, useBattle, type Battle } from '../../state/battle';
import { CrownAvatar, FlagChip, SplitBar, VersusMedallion } from './components/versusBits';
import '../../design/versus.css';

type Tab = 'face' | 'outfit' | 'verdict';
type CardVariant = 'face' | 'fit' | 'overall';

const ACCENT_HEX: Record<BattleWinner, string> = { a: '#83b4ff', b: '#ff52a6', tie: '#ffcf66' };

function whoLabel(winner: BattleWinner, names: { a: string; b: string }): string {
  return winner === 'a' ? names.a : winner === 'b' ? names.b : 'Dead heat';
}

/** Deterministic barcode bar widths for a share card footer. */
const BARS = Array.from({ length: 30 }, (_, i) => 1 + ((i * 7) % 4));

/** One column of a face/outfit comparison (avatar, score, chips, traits). */
function Column({
  side,
  name,
  photo,
  group,
}: {
  side: Side;
  name: string;
  photo?: string;
  group: MetricGroupResult;
}) {
  const score = side === 'a' ? group.avgA : group.avgB;
  const crowned = group.winner === side;
  const state = group.winner === side ? 'win' : group.winner === 'tie' ? 'tie' : 'lose';
  // "What's good": this side's leading metrics.
  const leads = group.metrics
    .filter((m) => (side === 'a' ? m.a > m.b : m.b > m.a))
    .slice(0, 3);
  // Top-3 traits for this side by score.
  const top = [...group.metrics]
    .sort((a, b) => (side === 'a' ? b.a - a.a : b.b - a.b))
    .slice(0, 3);

  return (
    <div className="vs-col vs-c" data-side={side} data-state={state}>
      <CrownAvatar photo={photo} crowned={crowned} name={name} />
      <div className="nm">{name}</div>
      <div className="score">
        {score}
        <small>/100</small>
      </div>
      <div className="state">{crowned ? 'Crowned' : group.winner === 'tie' ? 'Dead heat' : 'Runner-up'}</div>
      <div className="chips">
        {leads.map((m) => (
          <FlagChip key={m.key}>{m.label}</FlagChip>
        ))}
      </div>
      <div className="vs-traits">
        {top.map((m) => {
          const val = side === 'a' ? m.a : m.b;
          return (
            <div className="mstat" key={m.key}>
              <div className="top">
                <span className="lbl">{m.label}</span>
                <span className="val">{val}</span>
              </div>
              <div className="track">
                <span className="fill" style={{ width: `${val}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A face/outfit head-to-head tab: A column · split bars · B column. */
function ComparisonTab({
  group,
  label,
  names,
  photoA,
  photoB,
}: {
  group: MetricGroupResult;
  label: string;
  names: { a: string; b: string };
  photoA?: string;
  photoB?: string;
}) {
  const who = whoLabel(group.winner, names);
  return (
    <>
      <div className="vs-banner">
        <div className={'who' + (group.winner === 'tie' ? ' tie' : '')}>
          {group.winner === 'tie' ? 'Dead heat' : `${who} wins ${label}`}
        </div>
        <div className="sub">
          {group.avgA} <span style={{ color: 'var(--ink-faint)' }}>vs</span> {group.avgB}
        </div>
      </div>
      <div className="vs-deck">
        <Column side="a" name={names.a} photo={photoA} group={group} />
        <div className="vs-center">
          <div className="vs-splits">
            {group.metrics.map((m) => (
              <SplitBar key={m.key} label={m.label} a={m.a} b={m.b} win={winnerOf(m.a, m.b)} />
            ))}
          </div>
        </div>
        <Column side="b" name={names.b} photo={photoB} group={group} />
      </div>
    </>
  );
}

/** A single share/export card (duel photos + scores + winner). */
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
  const kind = variant === 'face' ? 'Face-off' : variant === 'fit' ? 'Fit-off' : 'Final verdict';
  const who = whoLabel(winner, names);

  return (
    <div className="vs-card" ref={cardRef}>
      <div className="duo" data-split={split}>
        <div
          className="half"
          data-side="a"
          role="img"
          aria-label={names.a}
          style={photoA ? { backgroundImage: `url("${photoA}")` } : undefined}
        >
          {!photoA && <span className="ph" />}
        </div>
        <div
          className="half"
          data-side="b"
          role="img"
          aria-label={names.b}
          style={photoB ? { backgroundImage: `url("${photoB}")` } : undefined}
        >
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
      <div className="cardfoot">
        <div className="who">
          {winner === 'tie' ? <span className="gold">Dead heat</span> : `${who} wins`}
        </div>
        <div className="duoscore">
          <span className="sa">{avgA}</span>
          <span style={{ color: 'var(--ink-faint)', fontFamily: '"Space Mono", monospace' }}>vs</span>
          <span className="sb">{avgB}</span>
        </div>
        <div className="barcode">
          {BARS.map((w, i) => (
            <i key={i} style={{ width: w }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The verdict tab: swipeable card stack + breakdown panel. */
function VerdictTab({
  battle,
  names,
  verdict,
}: {
  battle: Battle;
  names: { a: string; b: string };
  verdict: BattleVerdict;
}) {
  const cards: CardVariant[] =
    battle.mode === 'both' ? ['face', 'fit', 'overall'] : battle.mode === 'face' ? ['face'] : ['fit'];
  const [idx, setIdx] = useState(cards.length - 1); // open on the final/overall card
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const overall = verdict.overall;
  const who = whoLabel(overall.winner, names);

  // Most decisive metrics across the active modalities.
  const decisive = useMemo(() => {
    const all: Metric[] = [...(verdict.face?.metrics ?? []), ...(verdict.fit?.metrics ?? [])];
    return [...all].sort((m1, m2) => Math.abs(m2.a - m2.b) - Math.abs(m1.a - m1.b)).slice(0, 4);
  }, [verdict]);

  async function download() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const out = await renderCardBlob({
        el: cardRef.current,
        kind: 'face',
        verdict: 'green_flag',
        accentHex: ACCENT_HEX[overall.winner],
      });
      out.filename = `fitaura-versus-${cards[idx]}.png`;
      downloadResult(out);
    } catch {
      /* export failed — leave the card on screen */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vs-verdict">
      <div className="vs-stack">
        <BattleCard variant={cards[idx]} battle={battle} names={names} verdict={verdict} cardRef={cardRef} />
        {cards.length > 1 && (
          <div className="vs-stack-dots">
            {cards.map((c, i) => (
              <button
                key={c}
                aria-current={i === idx}
                aria-label={`Card ${i + 1}`}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
        )}
        <div className="vs-actions" style={{ justifyContent: 'center' }}>
          <button className="vs-btn" onClick={download} disabled={busy}>
            <Icon.download /> {busy ? 'Rendering…' : 'Download card'}
          </button>
        </div>
      </div>

      <div className="vs-panel">
        <div className="winner">{overall.winner === 'tie' ? 'Dead heat' : who}</div>
        <div className="word">{overall.winner === 'tie' ? 'Too close to call' : 'Takes the crown'}</div>
        <div className="scores">
          <span className="sa">{overall.avgA}</span>
          <span className="vs-x">vs</span>
          <span className="sb">{overall.avgB}</span>
        </div>
        <p className="copy">
          {overall.winner === 'tie'
            ? `${names.a} and ${names.b} are neck and neck — the scores land inside a dead heat.`
            : `${who} edges it ${Math.max(overall.avgA, overall.avgB)} to ${Math.min(overall.avgA, overall.avgB)} across ${battle.mode === 'both' ? 'face and fit' : battle.mode}.`}
        </p>
        <div className="reads">
          {decisive.map((m) => (
            <SplitBar key={m.key} label={m.label} a={m.a} b={m.b} win={winnerOf(m.a, m.b)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Step 3 — the head-to-head result deck. */
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

  if (hydrated && !battle) {
    navigate('/versus', { replace: true });
    return <div className="vs-page" />;
  }
  if (!battle || !verdict) return <div className="vs-page" />;

  function rematch() {
    clear();
    navigate('/versus');
  }

  const TAB_LABEL: Record<Tab, { n: string; t: string }> = {
    face: { n: '01', t: 'Face' },
    outfit: { n: '02', t: 'Outfit' },
    verdict: { n: '03', t: 'Verdict' },
  };

  return (
    <div className="vs-page">
      <div className="vs-wrap">
        <div className="vs-top">
          <span className="vs-eyebrow">Step 03 / 03 — Verdict</span>
          <button className="vs-btn" onClick={rematch}>
            <Icon.refresh /> New battle
          </button>
        </div>

        <div className="vs-tabs" role="tablist" aria-label="Result sections">
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              className="vs-tab"
              onClick={() => setTab(t)}
            >
              <span className="n">{TAB_LABEL[t].n}</span>
              {TAB_LABEL[t].t}
            </button>
          ))}
        </div>

        {activeTab === 'face' && verdict.face && (
          <ComparisonTab
            group={verdict.face}
            label="the face-off"
            names={names}
            photoA={battle.imgs.aFace}
            photoB={battle.imgs.bFace}
          />
        )}
        {activeTab === 'outfit' && verdict.fit && (
          <ComparisonTab
            group={verdict.fit}
            label="the fit-off"
            names={names}
            photoA={battle.imgs.aFit}
            photoB={battle.imgs.bFit}
          />
        )}
        {activeTab === 'verdict' && <VerdictTab battle={battle} names={names} verdict={verdict} />}

        <div className="vs-actions" style={{ justifyContent: 'center', marginTop: 30 }}>
          <button className="vs-btn" onClick={rematch}>
            <Icon.refresh /> Rematch
          </button>
        </div>
      </div>
    </div>
  );
}
