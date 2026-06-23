import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Side } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { battleNames, useBattle } from '../../state/battle';
import { DualGlowButton } from './components/versusBits';
import '../../design/versus.css';

const STAGES = ['Prep', 'Face', 'Fit', 'Aura', 'Verdict'] as const;
const TICKERS = [
  'Calibrating the arena…',
  'Mapping facial geometry…',
  'Reading the fit, fabric & fall…',
  'Measuring main-character aura…',
  'Weighing the head-to-head…',
] as const;
const DURATION_MS = 7500;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Step 2 — the animated versus scan, alternating the themed contender. */
export function VersusScan() {
  const navigate = useNavigate();
  const { battle, hydrated } = useBattle();

  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [side, setSide] = useState<Side>('a');

  // No battle in session (e.g. a direct hit) → back to the arena.
  useEffect(() => {
    if (hydrated && !battle) navigate('/versus', { replace: true });
  }, [hydrated, battle, navigate]);

  // Run the scan timeline. No re-entry guard: under StrictMode this effect runs
  // twice with a cleanup between, so each run starts a fresh interval and the
  // first is torn down — a guard would let the second mount bail after the first
  // mount's cleanup, leaving the bar frozen at 0%.
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
    return () => {
      clearInterval(tick);
      clearInterval(flip);
    };
  }, [hydrated, battle]);

  if (!battle) return <div className="vs-page" />;

  const names = battleNames(battle);
  const stageIndex = Math.min(STAGES.length - 1, Math.floor(progress / 20));
  const stage = STAGES[stageIndex];
  const specimen = side === 'a' ? battle.imgs.aFit ?? battle.imgs.aFace : battle.imgs.bFit ?? battle.imgs.bFace;
  const faceInset = side === 'a' ? battle.imgs.aFace ?? battle.imgs.aFit : battle.imgs.bFace ?? battle.imgs.bFit;
  const curName = side === 'a' ? names.a : names.b;

  return (
    <div className="vs-page">
      <div className="vs-wrap">
        <div className="vs-top">
          <Link className="vs-brand" to="/" aria-label="Fitaura home">
            <span className="dot" />
            <span className="wm">Fitaura</span>
          </Link>
          <span className="vs-eyebrow">Friend vs Friend · Step 02 / 03</span>
        </div>

        <div className="vs-scan vs-c" data-side={side}>
          <div className="vs-specimen">
            {specimen ? <img src={specimen} alt="" /> : null}
            <span className="grid" />
            {!done && <span className="sweep" />}
            <div className="corners">
              <span className="tl" />
              <span className="tr" />
              <span className="bl" />
              <span className="br" />
            </div>
            <div className="vs-inset">
              <span className="ring" />
              {faceInset ? <img src={faceInset} alt="" /> : null}
            </div>
          </div>

          <div className="vs-readout">
            <div className="stage-meta">
              Stage {String(stageIndex + 1).padStart(2, '0')} / 05 · {STAGES.join(' · ')}
            </div>
            <h2>{done ? 'Verdict ready' : `Reading the ${stage}`}</h2>
            <div className="ticker">{done ? 'Both contenders scored.' : TICKERS[stageIndex]}</div>

            <span className="vs-versus-pill">
              Now scanning <b>{curName}</b>
            </span>

            <div className="vs-pct">
              {Math.round(progress)}
              <span className="u">%</span>
            </div>
            <div className="vs-pbar">
              <div className="fill" style={{ width: `${progress}%` }} />
            </div>

            <ul className="vs-steps">
              {STAGES.map((s, i) => (
                <li key={s} data-st={i < stageIndex || done ? 'done' : i === stageIndex ? 'active' : 'queued'}>
                  <span className="dot" />
                  {s}
                </li>
              ))}
            </ul>

            {done && (
              <div style={{ marginTop: 24, maxWidth: 320 }}>
                <DualGlowButton onClick={() => navigate('/versus/result')}>
                  <Icon.bolt /> Reveal the verdict
                </DualGlowButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
