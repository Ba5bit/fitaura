import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Side } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { CardImage } from '../../components/cards';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { battleNames, useBattle } from '../../state/battle';
import { useAccount } from '../account/AccountContext';
import { useRevealGate } from '../account/useRevealGate';
import { runVersusScan } from '../../services/versusScanService';
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
  const { battle, result, hydrated, commitResult, saveBattle } = useBattle();
  const { spendForBattle, refundBattle, signedIn, credits } = useAccount();
  const mobile = useMediaQuery('(max-width: 760px)');

  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [side, setSide] = useState<Side>('a');
  const [microIdx, setMicroIdx] = useState(0);

  // Real AI lifecycle, run DURING the cosmetic timeline. The verdict comes back
  // from `versus-scan`; the reveal gates on BOTH this settling AND the timeline.
  const [aiState, setAiState] = useState<'pending' | 'done' | 'error' | 'minor'>('pending');
  const [aiError, setAiError] = useState<string | null>(null);
  // The real failure reason from the service (e.g. "The AI service is busy right
  // now.") shown under the generic line so a failed battle says *why* — parity
  // with Solo's scan-reason line.
  const [aiReason, setAiReason] = useState<string | null>(null);
  // Tracks real mount across StrictMode's double-invoke so a settled call never
  // writes state onto an unmounted tree. The in-flight request is NOT aborted on
  // cleanup — StrictMode's transient unmount must not cancel the live scan.
  const mountedRef = useRef(true);
  // Guards the one-time spend + network call against StrictMode's double-invoke
  // (a double run here would double-spend 2 credits / double-call the AI). NOT
  // reset on cleanup — the spend must survive the second mount.
  const startedRef = useRef(false);

  useEffect(() => {
    if (hydrated && !battle) navigate('/versus', { replace: true });
  }, [hydrated, battle, navigate]);

  // Spend 2 credits, fire the comparative scan, commit + save on success. When
  // `revealAfter` is set (the guest resume after register) we jump straight to
  // the result; the eager signed-in path instead lands on the manual reveal CTA.
  // Runs at most once per kickoff (startedRef / the gate's firedRef); the
  // in-flight call is never aborted on cleanup — only the state write is skipped
  // if the tree unmounted for real.
  const startScan = useCallback(async (revealAfter = false) => {
    if (!battle) return;
    const ok = await spendForBattle();
    if (!ok) {
      navigate('/credits');
      return;
    }
    const outcome = await runVersusScan(battle);
    if (!mountedRef.current) return;
    if (outcome.kind === 'result') {
      commitResult(outcome.result);
      // Persist to the on-device vault so the battle shows as a saved card.
      saveBattle(battle, outcome.result);
      if (revealAfter) {
        try {
          sessionStorage.setItem('fvf:reveal', '1');
        } catch {
          /* sessionStorage unavailable — result just renders static */
        }
        navigate('/versus/result', { replace: true });
      } else {
        setAiState('done');
      }
      return;
    }
    await refundBattle();
    if (!mountedRef.current) return;
    // A minor in one of the photos gets its own clean screen (use different photos),
    // not the generic "try again" error.
    if (outcome.kind === 'minor') {
      setAiError(outcome.message);
      setAiState('minor');
      return;
    }
    setAiError('That battle did not go through. Your 2 credits were refunded, give it another go.');
    setAiReason(outcome.message);
    setAiState('error');
  }, [battle, spendForBattle, refundBattle, commitResult, saveBattle, navigate]);

  // Guest deferral: a signed-out visitor runs the teaser only, then registers at
  // the reveal; the battle (spend + AI) runs here, once, after register.
  const { requestRegister } = useRevealGate({
    redirectTo: '/versus/run',
    readyToResume: credits >= 2,
    onResume: () => startScan(true),
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !battle || startedRef.current) return;
    // Already scored (e.g. came back to the scan route) — never re-run or re-spend;
    // send the user to the verdict they already have. Mirrors Solo's alreadyScanned
    // guard. `replace` keeps the unreachable scan out of the back stack. This only
    // fires on a fresh mount: during a live scan the result commits AFTER startedRef
    // is set, so the re-run of this effect bails on the startedRef check above.
    if (result) {
      startedRef.current = true;
      navigate('/versus/result', { replace: true });
      return;
    }
    startedRef.current = true;
    // Signed-in: spend + scan eagerly so the AI runs during the timeline. Guests
    // run the teaser only — no spend until they register at the reveal (the gate).
    if (signedIn) void startScan();
  }, [hydrated, battle, result, signedIn, startScan, navigate]);

  // Retry re-arms the kickoff (a fresh spend + call) after an inline error.
  const retry = useCallback(() => {
    setAiError(null);
    setAiReason(null);
    setAiState('pending');
    void startScan();
  }, [startScan]);

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
  // The reveal CTA needs BOTH the timeline finished AND the verdict landed.
  const revealReady = done && aiState === 'done';
  // Timeline finished but the AI is still in flight → a brief "finishing up" hold.
  const finishingUp = signedIn && done && aiState === 'pending';
  // Timeline finished and the AI failed → inline error (refund already issued).
  const errored = done && aiState === 'error';
  // Timeline finished and a minor was detected → its own 18+ "use different photos" screen.
  const isMinor = done && aiState === 'minor';
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
                {revealReady ? 'Verdict ready' : isMinor ? '18+ only' : errored ? 'Battle hiccup' : finishingUp ? 'Finishing up' : 'Scanning'}
              </span>
              <button className="leave-btn" onClick={() => navigate('/versus')} aria-label="Leave scan">
                <Icon.x />
              </button>
            </div>
          </div>

          {done ? (
            !signedIn ? (
              <div className="reveal">
                <span className="stamp">✶ Battle scored ✶</span>
                <h2>
                  Crown the <span className="hl">winner</span>
                </h2>
                <p className="sub">
                  {names.a} vs {names.b} — create your free account to reveal the head-to-head.
                </p>
                <button className="go" onClick={requestRegister}>
                  <Icon.bolt /> Sign up to reveal the winner
                </button>
              </div>
            ) : isMinor ? (
              <div className="reveal">
                <span className="stamp" style={{ color: 'var(--red)' }}>
                  ✶ 18+ only ✶
                </span>
                <h2>
                  Different <span className="hl">photos</span>
                </h2>
                <p className="sub">{aiError}</p>
                <button className="go retry" onClick={() => navigate('/versus')}>
                  <Icon.refresh /> Use different photos
                </button>
              </div>
            ) : errored ? (
              <div className="reveal">
                <span className="stamp" style={{ color: 'var(--red)' }}>
                  ✶ Battle hiccup ✶
                </span>
                <h2>
                  Let's try <span className="hl">again</span>
                </h2>
                <p className="sub">{aiError}</p>
                {aiReason && <p className="scan-reason">Reason: {aiReason}</p>}
                <button className="go retry" onClick={retry}>
                  <Icon.refresh /> Try again
                </button>
                <div className="reveal-err">
                  <Icon.alert />
                  <span>
                    Photos analyzed in-session only.{' '}
                    <button className="linkbtn" onClick={() => navigate('/versus')}>
                      Back to upload
                    </button>
                  </span>
                </div>
              </div>
            ) : finishingUp ? (
              <div className="reveal">
                <span className="stamp">✶ Crowning a winner ✶</span>
                <h2>
                  Finishing <span className="hl">up</span>
                </h2>
                <p className="sub">
                  {names.a} vs {names.b} — tallying the head-to-head. Almost there…
                </p>
                <button className="go" disabled>
                  Crowning the winner…
                </button>
              </div>
            ) : (
              <div className="reveal">
                <span className="stamp">✶ Battle scored ✶</span>
                <h2>
                  Verdict is <span className="hl">in</span>
                </h2>
                <p className="sub">
                  {names.a} vs {names.b} — both contenders scored. Reveal the head-to-head.
                </p>
                <button
                  className="go"
                  onClick={() => {
                    // One-shot flag the result page consumes to play the stats
                    // reveal exactly once (see VersusResult `firstView`).
                    try {
                      sessionStorage.setItem('fvf:reveal', '1');
                    } catch {
                      /* sessionStorage unavailable — result just renders static */
                    }
                    // replace: once revealed, the scan route is a dead end — keep it
                    // out of the back stack so Chrome back goes to upload, not the scan.
                    navigate('/versus/result', { replace: true });
                  }}
                >
                  <Icon.bolt /> Reveal the verdict
                </button>
              </div>
            )
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
