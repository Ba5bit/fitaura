import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Side } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { CardImage } from '../../components/cards';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { battleNames, useBattle } from '../../state/battle';
import '../../design/scanner.css';

/**
 * Versus scan — reuses Solo Scan's `.sa` HUD shell (scanner.css + the global
 * .scan-page wrapper) so it looks/behaves like Solo's scanner: 2-up specimen +
 * face medallion, readout with a rail checklist, header with a live chip, and a
 * full-bleed mobile layout. Themed per contender: the accent alternates icy (A)
 * ↔ gold (B) every ~1s to keep the head-to-head identity.
 */

interface Stage {
  key: string;
  code: string;
  rail: string;
  title: [string, string];
  micro: string[];
}

const STAGES: Stage[] = [
  { key: 'prep', code: '01', rail: 'Prepping photos', title: ['Prepping the ', 'arena'], micro: ['Loading both contenders…', 'Calibrating the matchup…', 'Cracking knuckles…'] },
  { key: 'face', code: '02', rail: 'Reading the face', title: ['Reading the ', 'faces'], micro: ['Mapping both jawlines…', 'Checking the angles…', 'Measuring main-character energy…'] },
  { key: 'fit', code: '03', rail: 'Sizing the fit', title: ['Sizing up the ', 'fits'], micro: ['Tracing silhouettes…', 'Rating the drip…', 'Editorial, or gym-bro?…'] },
  { key: 'aura', code: '04', rail: 'Calculating aura', title: ['Calculating the ', 'aura'], micro: ['Cross-checking the vibe…', 'Tallying good-angle points…', 'Consulting the group chat…'] },
  { key: 'verdict', code: '05', rail: 'Printing verdict', title: ['Weighing the ', 'verdict'], micro: ['Tallying the head-to-head…', 'Crowning a winner…', 'Stamping the verdict…'] },
];

const MARKERS = [
  { st: 'prep', cls: 'h-tr', label: 'Both loaded', ok: true },
  { st: 'face', cls: 'h-l', label: 'Gaze · found', ok: false },
  { st: 'face', cls: 'h-tr', label: 'Jawline', ok: true },
  { st: 'fit', cls: 'h-r', label: 'Silhouette', ok: false },
  { st: 'fit', cls: 'h-bl', label: 'Drip · reading', ok: false },
  { st: 'aura', cls: 'h-bl', label: 'Good angles +', ok: false },
  { st: 'verdict', cls: 'h-br', label: 'Crowning', ok: false },
];

const DURATION_MS = 7500;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function VersusScan() {
  const navigate = useNavigate();
  const { battle, hydrated } = useBattle();
  const mobile = useMediaQuery('(max-width: 760px)');

  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [side, setSide] = useState<Side>('a');
  const [microIdx, setMicroIdx] = useState(0);

  useEffect(() => {
    if (hydrated && !battle) navigate('/versus', { replace: true });
  }, [hydrated, battle, navigate]);

  // Timeline — no re-entry guard (StrictMode runs effects twice with cleanup
  // between; a guard would let the second mount bail and freeze the bar at 0%).
  useEffect(() => {
    if (!hydrated || !battle) return;
    if (prefersReducedMotion()) {
      setProgress(100);
      setDone(true);
      return;
    }
    const start = performance.now();
    const tick = setInterval(() => {
      const p = Math.min(100, ((performance.now() - start) / DURATION_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(tick);
        setDone(true);
      }
    }, 50);
    const flip = setInterval(() => setSide((s) => (s === 'a' ? 'b' : 'a')), 1000);
    const micro = setInterval(() => setMicroIdx((n) => n + 1), 1750);
    return () => {
      clearInterval(tick);
      clearInterval(flip);
      clearInterval(micro);
    };
  }, [hydrated, battle]);

  if (!battle) return <div className="scan-page" />;

  const names = battleNames(battle);
  const rm = prefersReducedMotion();
  const stageIndex = done ? STAGES.length - 1 : Math.min(STAGES.length - 1, Math.floor(progress / 20));
  const stage = STAGES[stageIndex];
  const accent = side === 'a' ? 'var(--icy)' : 'var(--gold)';
  const accentInk = '#06070a'; // both icy and gold are light → dark ink on accent fills
  const curName = side === 'a' ? names.a : names.b;
  const outfitSrc = side === 'a' ? battle.imgs.aFit ?? null : battle.imgs.bFit ?? null;
  const faceSrc = side === 'a' ? battle.imgs.aFace ?? null : battle.imgs.bFace ?? null;
  const frameSrc = outfitSrc ?? faceSrc;
  const showCircle = !!faceSrc && !!outfitSrc;
  const micro = stage.micro[microIdx % stage.micro.length];

  return (
    <div className="scan-page">
      <div
        className={'sa' + (rm ? ' rm' : '')}
        data-mobile={mobile ? 'true' : 'false'}
        data-stage={done ? 'verdict' : stage.key}
        data-phase={done ? 'done' : 'scanning'}
        // Per-contender accent overrides the per-stage palette while scanning; on
        // the done/reveal screen we fall back to the stage palette (gold verdict).
        style={done ? undefined : ({ ['--accent']: accent, ['--accent-ink']: accentInk } as CSSProperties)}
      >
        <div className="sa-pad">
          <div className="sa-head">
            <div className="brand">
              <span className="dot" />
              <span className="wm">Fitaura</span>
            </div>
            <div className="right">
              <span className="live-chip">
                <span className="d" />
                {done ? 'Verdict ready' : 'Scanning'}
              </span>
              <button className="leave-btn" onClick={() => navigate('/versus')} aria-label="Leave scan">
                <Icon.x />
              </button>
            </div>
          </div>

          {done ? (
            <div className="reveal">
              <span className="stamp">✶ Battle scored ✶</span>
              <h2>
                Verdict is <span className="hl">in</span>
              </h2>
              <p className="sub">
                {names.a} vs {names.b} — both contenders scored. Reveal the head-to-head.
              </p>
              <button className="go" onClick={() => navigate('/versus/result')}>
                <Icon.bolt /> Reveal the verdict
              </button>
            </div>
          ) : (
            <div className="sa-stage">
              <div className="specimen ignite">
                <div className="spec-aura" />
                <div className="spec-frame">
                  <CardImage src={frameSrc} shape="rect" placeholder={outfitSrc ? 'outfit' : 'face'} />
                  <div className="scrim" />
                  <div className="spec-ov">
                    <div className="spec-grid-ov" />
                    <div className="spec-band" />
                    <div className="spec-scanline" />
                  </div>
                  <div className="spec-corners">
                    <span className="tl" />
                    <span className="tr" />
                    <span className="bl" />
                    <span className="br" />
                  </div>
                  <div className="spec-cap">
                    <span className="blip" />
                    <span className="txt">Now scanning · {curName}</span>
                  </div>
                </div>
                {showCircle && (
                  <div className="spec-face">
                    <div className="ring" />
                    <CardImage src={faceSrc} shape="circle" placeholder="face" />
                    <span className="tick t1" />
                    <span className="tick t2" />
                  </div>
                )}
                {MARKERS.map((m, i) => (
                  <span key={i} className={'hud ' + m.cls} data-on={m.st === stage.key}>
                    <span className="hd" />
                    {m.label}
                    {m.ok ? <span className="ok">✓</span> : null}
                  </span>
                ))}
              </div>

              <div className="readout">
                <div className="ro-stage">
                  <span className="ro-code">
                    {stage.code} · {stage.key.toUpperCase()}
                  </span>
                  <span className="ro-of">Stage {stageIndex + 1} of {STAGES.length}</span>
                </div>
                <h2 className="ro-title">
                  {stage.title[0]}
                  <span className="hl">{stage.title[1]}</span>
                </h2>
                <div className="ro-tick">
                  <span className="car">›</span>
                  <span className="txt" key={micro}>
                    {micro}
                  </span>
                </div>
                <div className="ro-prog">
                  <div className="ro-pct">
                    <span className="n">{Math.round(progress)}</span>
                    <span className="p">%</span>
                  </div>
                  <div className="ro-bar">
                    <div className="fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="rail">
                  {STAGES.map((s, i) => {
                    const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'todo';
                    return (
                      <div className="rail-step" key={s.key} data-state={state}>
                        <span className="rail-node">
                          {state === 'done' ? <Icon.check /> : <span className="num">{s.code}</span>}
                        </span>
                        <span className="rail-label">{s.rail}</span>
                        <span className="rail-code">{state === 'active' ? 'scanning' : state === 'done' ? 'done' : '·'}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="ro-foot">
                  <Icon.shield /> Analyzed in-session only · for the bit, not science
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
